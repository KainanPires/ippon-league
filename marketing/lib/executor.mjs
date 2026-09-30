// marketing/lib/executor.mjs
//
// EXECUTOR — o único componente que pode gastar créditos.
//
// Separado do planeamento: o planeador escreve plano.json e orçamento; não
// assina nada. O executor só envia se TUDO isto for verdade:
//   1. existe autorização de gasto ASSINADA pelo aprovador (chave fora do repo);
//   2. a autorização vincula esta campanha, esta versão e o hash deste pacote
//      (cenas, referências, endpoint, parâmetros/prompt, quantidade, preço);
//   3. as referências locais e remotas têm o hash autorizado;
//   4. o preço aplicável foi confirmado agora (estimativa do fornecedor) e não é
//      maior do que o preço unitário autorizado;
//   5. o comprometido + esta unidade cabe no teto autorizado (e no teto mensal,
//      se configurado);
//   6. não há unidades em estado incerto por reconciliar;
//   7. a unidade (versão/cena#n) nunca foi reservada antes — nada é reenviado.
//
// Timeouts, erros de rede e 5xx → a unidade fica "incerto" e a execução PARA.
// Não há regeração automática: cenas falhadas ou rejeitadas ficam como estão.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { lerPlano, pacoteDeGasto, hashPacote, pastaCampanha } from "./plano.mjs";
import { verificarAutorizacao, lerJsonSeExistir, ErroAutorizacao } from "./autorizacao.mjs";
import {
  adquirirTrinco, lerRazao, registar, estadoUnidades, creditosComprometidos,
  ESTADOS_PENDENTES_DE_RECONCILIACAO,
} from "./razao.mjs";
import { sha256 } from "./canonico.mjs";

export class Bloqueio extends Error { constructor(msg) { super(msg); this.bloqueio = true; } }

export const FICHEIRO_AUTORIZACAO = "autorizacao-gasto.json";

export function lerChavePublica(raiz) {
  const f = path.join(raiz, "config", "aprovador.pub.pem");
  if (!fs.existsSync(f)) throw new Bloqueio("não há chave pública do aprovador configurada (marketing/config/aprovador.pub.pem) — corre `gerar-chaves` primeiro");
  return fs.readFileSync(f, "utf8");
}

function lerLimites(raiz) {
  return lerJsonSeExistir(path.join(raiz, "config", "limites.json")) ?? {};
}

function creditosDoMes(raiz, agora) {
  const mes = agora.toISOString().slice(0, 7);
  const base = path.join(raiz, "campanhas");
  let total = 0;
  if (!fs.existsSync(base)) return 0;
  for (const c of fs.readdirSync(base)) {
    const pasta = path.join(base, c);
    if (!fs.statSync(pasta).isDirectory()) continue;
    const eventos = lerRazao(pasta);
    const doMes = new Set(eventos.filter((e) => e.tipo === "reservado" && String(e.quando).startsWith(mes)).map((e) => e.unidade));
    for (const x of estadoUnidades(eventos).values()) if (doMes.has(x.unidade)) total += Number(x.creditos) || 0;
  }
  return total;
}

export function contextoAutorizado(raiz, campanha, chavePublicaPem, agora = new Date()) {
  const pasta = pastaCampanha(raiz, campanha);
  const plano = lerPlano(raiz, campanha);
  const pacote = pacoteDeGasto(raiz, plano);
  const hash = hashPacote(pacote);
  const quantidade_total = pacote.geracoes.reduce((s, g) => s + g.quantidade, 0);
  const aut = lerJsonSeExistir(path.join(pasta, FICHEIRO_AUTORIZACAO));
  try {
    verificarAutorizacao(aut, chavePublicaPem, { campanha, versao: plano.campanha.versao, pacote_sha256: hash, quantidade_total }, agora);
  } catch (e) {
    if (e instanceof ErroAutorizacao) throw new Bloqueio(e.message);
    throw e;
  }
  return { pasta, plano, pacote, hash, aut };
}

function cenasRejeitadas(eventos, versao) {
  return new Set(eventos.filter((e) => e.tipo === "rejeitada_revisao" && e.versao === versao).map((e) => e.cena));
}

/**
 * Envia as gerações autorizadas que ainda não foram enviadas.
 * Devolve { enviadas, ignoradas, bloqueio? }.
 */
export async function executar({ raiz, campanha, provedor, chavePublicaPem, agora = () => new Date(), log = () => {} }) {
  const libertar = adquirirTrinco(pastaCampanha(raiz, campanha), "executar");
  const resultado = { enviadas: [], ignoradas: [], bloqueio: null };
  try {
    const { pasta, plano, pacote, hash, aut } = contextoAutorizado(raiz, campanha, chavePublicaPem, agora());
    const eventos = lerRazao(pasta);
    const unidades = estadoUnidades(eventos);
    const pendentes = [...unidades.values()].filter((u) => ESTADOS_PENDENTES_DE_RECONCILIACAO.has(u.estado));
    if (pendentes.length)
      throw new Bloqueio(`há ${pendentes.length} envio(s) em estado incerto (${pendentes.map((u) => u.unidade).join(", ")}). Corre \`reconciliar\` antes de qualquer novo envio.`);

    const rejeitadas = cenasRejeitadas(eventos, plano.campanha.versao);
    const limites = lerLimites(raiz);
    let comprometido = creditosComprometidos(unidades, hash);

    for (const g of pacote.geracoes) {
      if (rejeitadas.has(g.cena)) { resultado.ignoradas.push(`${g.cena}: rejeitada na revisão — sem nova tentativa`); continue; }
      if (!(g.preco_unitario_creditos > 0)) throw new Bloqueio(`${g.cena}: sem preço unitário confirmado no plano autorizado`);

      // referências: o que o modelo vai ver tem de ser exatamente o autorizado
      for (const r of g.referencias) {
        if (!r.url) continue;
        let buf;
        try { buf = await provedor.obterReferencia(r.url); } catch (e) { throw new Bloqueio(`${g.cena}: não consegui confirmar a referência remota ${r.url} (${e.message})`); }
        if (sha256(buf) !== r.sha256) throw new Bloqueio(`${g.cena}: a referência publicada em ${r.url} não é igual ao ficheiro autorizado ${r.caminho}`);
      }

      for (let k = 1; k <= g.quantidade; k++) {
        const unidade = `${plano.campanha.versao}/${g.cena}#${k}`;
        if (unidades.has(unidade)) { resultado.ignoradas.push(`${unidade}: já enviada antes (${unidades.get(unidade).estado}) — nunca se reenvia`); continue; }

        let est;
        try { est = await provedor.estimar(g.endpoint, g.parametros); }
        catch (e) { throw new Bloqueio(`${g.cena}: preço aplicável não confirmado pelo fornecedor (${e.message})`); }
        if (!(est.creditos > 0)) throw new Bloqueio(`${g.cena}: estimativa sem valor`);
        if (est.creditos > g.preco_unitario_creditos)
          throw new Bloqueio(`${g.cena}: o preço atual (${est.creditos}) é maior do que o autorizado (${g.preco_unitario_creditos}) — precisa de nova autorização`);

        const custo = g.preco_unitario_creditos; // conta o valor autorizado (≥ estimativa): conservador
        if (comprometido + custo > Number(aut.teto_creditos))
          throw new Bloqueio(`orçamento insuficiente: ${comprometido} já comprometidos + ${custo} > teto autorizado ${aut.teto_creditos}`);
        if (Number(limites.teto_mensal_creditos) > 0) {
          const mes = creditosDoMes(raiz, agora());
          if (mes + custo > Number(limites.teto_mensal_creditos))
            throw new Bloqueio(`teto mensal atingido: ${mes} + ${custo} > ${limites.teto_mensal_creditos}`);
        }

        const idempotency_key = crypto.randomUUID();
        registar(pasta, { tipo: "reservado", unidade, cena: g.cena, versao: plano.campanha.versao, endpoint: g.endpoint, creditos: custo, estimativa: est.creditos, idempotency_key, autorizacao: hash, fornecedor: provedor.nome });
        comprometido += custo;
        try {
          const r = await provedor.enviar(g.endpoint, g.parametros, idempotency_key);
          registar(pasta, { tipo: "enviado", unidade, cena: g.cena, request_id: r.request_id });
          resultado.enviadas.push({ unidade, request_id: r.request_id });
          log(`enviado ${unidade} → ${r.request_id}`);
        } catch (e) {
          if (e.recusado) {
            registar(pasta, { tipo: "recusado", unidade, cena: g.cena, motivo: e.message });
            throw new Bloqueio(`${unidade}: o fornecedor recusou o pedido (${e.message}). Execução parada; nada é reenviado.`);
          }
          registar(pasta, { tipo: "incerto", unidade, cena: g.cena, motivo: e.message });
          throw new Bloqueio(`${unidade}: estado incerto (${e.message}). Execução parada. Corre \`reconciliar\` — NÃO reenviar à mão.`);
        }
      }
    }
  } catch (e) {
    if (e.bloqueio) resultado.bloqueio = e.message;
    else throw e;
  } finally {
    libertar();
  }
  return resultado;
}

/** Consulta o estado dos envios e descarrega o que estiver concluído. Nunca envia. */
export async function acompanhar({ raiz, campanha, provedor, log = () => {} }) {
  const pasta = pastaCampanha(raiz, campanha);
  const libertar = adquirirTrinco(pasta, "acompanhar");
  const feitos = [];
  try {
    const unidades = estadoUnidades(lerRazao(pasta));
    for (const u of unidades.values()) {
      if (!u.request_id || !["enviado", "queued", "in_progress"].includes(u.estado)) continue;
      let st;
      try { st = await provedor.estado(u.request_id); } catch (e) { log(`${u.unidade}: estado indisponível (${e.message})`); continue; }
      const saidas = [];
      if (st.status === "completed") {
        const urls = [st.video?.url, st.audio?.url, ...(st.images ?? []).map((i) => i.url), ...(st.audios ?? []).map((a) => a.url)].filter(Boolean);
        const dir = path.join(pasta, "saidas");
        fs.mkdirSync(dir, { recursive: true });
        for (const [i, url] of urls.entries()) {
          const ext = (url.split("?")[0].match(/\.([a-z0-9]{2,4})$/i)?.[1] ?? "bin").toLowerCase();
          const nome = `${u.unidade.replace(/[/#]/g, "_")}${urls.length > 1 ? "_" + (i + 1) : ""}.${ext}`;
          fs.writeFileSync(path.join(dir, nome), await provedor.descarregar(url));
          saidas.push(`saidas/${nome}`);
        }
      }
      registar(pasta, { tipo: "estado", unidade: u.unidade, cena: u.cena, request_id: u.request_id, estado: st.status === "completed" ? "concluido" : st.status, erro: st.error ?? null, saidas });
      feitos.push({ unidade: u.unidade, estado: st.status, saidas });
      log(`${u.unidade}: ${st.status}`);
    }
  } finally {
    libertar();
  }
  return feitos;
}

/**
 * Reconciliação de unidades incertas. Nunca envia nada.
 *  - com request_id (do razão ou dado pelo Kainan depois de ver no painel) → consulta o estado;
 *  - `naoEnviado` → o Kainan confirma que o pedido não existe no painel; a unidade
 *    fica terminal ("nao_enviado") e NÃO é reenviada. Exige confirmação humana.
 */
export async function reconciliar({ raiz, campanha, provedor, unidade, requestId, naoEnviado = false, confirmacaoHumana = false }) {
  const pasta = pastaCampanha(raiz, campanha);
  const libertar = adquirirTrinco(pasta, "reconciliar");
  try {
    const u = estadoUnidades(lerRazao(pasta)).get(unidade);
    if (!u) throw new Bloqueio(`unidade desconhecida: ${unidade}`);
    if (!ESTADOS_PENDENTES_DE_RECONCILIACAO.has(u.estado)) return { unidade, estado: u.estado, nota: "já não estava incerta" };
    if (naoEnviado) {
      if (!confirmacaoHumana) throw new Bloqueio("marcar como não enviado exige confirmação humana no terminal");
      registar(pasta, { tipo: "reconciliado", unidade, cena: u.cena, estado: "nao_enviado", creditos: 0, nota: "confirmado pelo Kainan: pedido não existe no painel" });
      return { unidade, estado: "nao_enviado" };
    }
    const rid = requestId ?? u.request_id;
    if (!rid) throw new Bloqueio(`${unidade}: sem request_id. Procura o pedido no painel Higgsfield e corre reconciliar com --request-id, ou --nao-enviado se não existir.`);
    const st = await provedor.estado(rid);
    registar(pasta, { tipo: "reconciliado", unidade, cena: u.cena, request_id: rid, estado: st.status === "completed" ? "concluido" : st.status });
    return { unidade, estado: st.status, request_id: rid };
  } finally {
    libertar();
  }
}

/** O Kainan rejeita uma cena na revisão. Fica registado; nunca provoca nova tentativa. */
export function rejeitarCena({ raiz, campanha, cena, motivo }) {
  const pasta = pastaCampanha(raiz, campanha);
  const plano = lerPlano(raiz, campanha);
  if (!plano.cenas.some((c) => c.id === cena)) throw new Bloqueio(`cena inexistente: ${cena}`);
  registar(pasta, { tipo: "rejeitada_revisao", cena, versao: plano.campanha.versao, motivo: motivo ?? "" });
}
