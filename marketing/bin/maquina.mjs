#!/usr/bin/env node
// marketing/bin/maquina.mjs — linha de comandos da Máquina de Conteúdo.
//
// MODO POR DEFEITO: planeamento/simulação. Nada é gerado nem pago sem
// `executar --real` E uma autorização assinada pelo Kainan.
//
// Uso: node marketing/bin/maquina.mjs <comando> [campanha] [opções]
//   ajuda

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { RAIZ_MARKETING, lerPlano, pacoteDeGasto, hashPacote, custoMaximo, pastaCampanha, ErroPlano } from "../lib/plano.mjs";
import { escreverDocumentos } from "../lib/documentos.mjs";
import { gerarParDeChaves, assinarAutorizacao, impressaoDigital } from "../lib/autorizacao.mjs";
import { executar, acompanhar, reconciliar, rejeitarCena, lerChavePublica, FICHEIRO_AUTORIZACAO } from "../lib/executor.mjs";
import { lerRazao, estadoUnidades, caminhosExecucao } from "../lib/razao.mjs";
import { gerarEntregaCapcut } from "../lib/capcut.mjs";
import { criarProvedorHiggsfield } from "../lib/provedores/higgsfield.mjs";
import { criarProvedorSimulado } from "../lib/provedores/simulado.mjs";
import { verificarConhecimento } from "../lib/conhecimento.mjs";

const RAIZ = RAIZ_MARKETING;
const PASTA_CHAVE = path.join(os.homedir(), ".ippon-marketing");
const CHAVE_PRIVADA = path.join(PASTA_CHAVE, "aprovador.key");

const AJUDA = `
Máquina de Conteúdo · Ippon League

PLANEAMENTO (sem custo)
  validar <campanha>                 valida o plano e gera roteiro.md, storyboard.md, orcamento.md
  confirmar-precos <campanha>        pede a estimativa oficial ao Higgsfield (não gera) e grava no plano
  capcut <campanha>                  gera o pacote de montagem para o CapCut
  estado <campanha>                  mostra o razão de execução
  verificar-conhecimento             confere os factos da base de conhecimento com o código da app

APROVAÇÃO (só o Kainan, num terminal interativo)
  gerar-chaves                       cria a chave do aprovador (uma vez)
  autorizar <campanha> --teto N --validade-horas H

EXECUÇÃO
  executar <campanha>                SIMULAÇÃO (padrão): mostra o que seria enviado, sem rede e sem gasto
  executar <campanha> --real         envia ao Higgsfield (exige autorização assinada e credenciais)
  acompanhar <campanha> --real       consulta estados e descarrega resultados (nunca envia)
  reconciliar <campanha> --unidade U [--request-id ID | --nao-enviado]
  rejeitar <campanha> --cena cNN --motivo "..."
  verificar-credenciais              confirma as credenciais SEM gerar nada
  desbloquear <campanha>             remove um trinco abandonado (confirmação no terminal)
`;

function opcoes(args) {
  const o = { _: [] };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith("--")) {
      const k = a.slice(2);
      const v = args[i + 1] && !args[i + 1].startsWith("--") ? args[++i] : true;
      o[k] = v;
    } else o._.push(a);
  }
  return o;
}

function exigirTerminal(motivo) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    console.error(`⛔ ${motivo} exige um terminal interativo (tu, no teu computador). Não pode ser feito por um agente.`);
    process.exit(3);
  }
}

function perguntar(texto, { oculto = false } = {}) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (oculto) {
      rl._writeToOutput = (s) => { if (s.includes(texto)) rl.output.write(texto); };
    }
    rl.question(texto, (r) => { rl.close(); if (oculto) process.stdout.write("\n"); resolve(r); });
  });
}

function provedorReal() {
  return criarProvedorHiggsfield({ env: process.env });
}

async function main() {
  const [cmd, ...resto] = process.argv.slice(2);
  const o = opcoes(resto);
  const campanha = o._[0];

  switch (cmd) {
    case undefined:
    case "ajuda":
      console.log(AJUDA);
      return;

    case "validar": {
      const plano = lerPlano(RAIZ, campanha);
      const orc = escreverDocumentos(RAIZ, plano);
      console.log(`✅ plano válido · versão ${plano.campanha.versao} · pacote ${orc.hash.slice(0, 12)}…`);
      console.log(orc.semPreco.length ? `⚠️  sem preço confirmado: ${orc.semPreco.join(", ")}` : `Total máximo: ${orc.total} créditos`);
      console.log(`Gerados: campanhas/${campanha}/roteiro.md, storyboard.md, orcamento.md`);
      return;
    }

    case "confirmar-precos": {
      const f = path.join(pastaCampanha(RAIZ, campanha), "plano.json");
      const plano = lerPlano(RAIZ, campanha);
      const prov = provedorReal();
      const hoje = new Date().toISOString();
      for (const c of plano.cenas.filter((x) => x.geracao)) {
        const est = await prov.estimar(c.geracao.endpoint, c.geracao.parametros);
        c.geracao.preco_unitario = { creditos: est.creditos, usd: est.usd, fonte: "higgsfield /estimate", data: hoje };
        console.log(`${c.id}: ${est.creditos} créditos`);
      }
      fs.writeFileSync(f, JSON.stringify(plano, null, 2) + "\n");
      escreverDocumentos(RAIZ, plano);
      console.log("Preços gravados no plano (isto muda o pacote: qualquer autorização anterior deixa de valer).");
      return;
    }

    case "gerar-chaves": {
      exigirTerminal("Gerar a chave do aprovador");
      if (fs.existsSync(CHAVE_PRIVADA) && !o.substituir) { console.error(`Já existe ${CHAVE_PRIVADA}. Usa --substituir para criar outra.`); process.exit(1); }
      const f1 = await perguntar("Frase-passe do aprovador (mín. 12 caracteres): ", { oculto: true });
      const f2 = await perguntar("Repete a frase-passe: ", { oculto: true });
      if (f1 !== f2) { console.error("As frases não coincidem."); process.exit(1); }
      const { publicKey, privateKey } = gerarParDeChaves(f1);
      fs.mkdirSync(PASTA_CHAVE, { recursive: true, mode: 0o700 });
      fs.writeFileSync(CHAVE_PRIVADA, privateKey, { mode: 0o600 });
      fs.mkdirSync(path.join(RAIZ, "config"), { recursive: true });
      fs.writeFileSync(path.join(RAIZ, "config", "aprovador.pub.pem"), publicKey);
      console.log(`Chave privada (cifrada): ${CHAVE_PRIVADA} — fica só no teu computador, fora do repositório.`);
      console.log(`Chave pública: marketing/config/aprovador.pub.pem · impressão digital ${impressaoDigital(publicKey)}`);
      console.log("Faz commit da chave pública. Nunca partilhes a frase-passe com ninguém, nem com o Claude.");
      return;
    }

    case "autorizar": {
      exigirTerminal("Autorizar gasto");
      const teto = Number(o.teto);
      const horas = Number(o["validade-horas"] ?? 24);
      if (!(teto > 0)) { console.error("Indica --teto <créditos>."); process.exit(1); }
      const plano = lerPlano(RAIZ, campanha);
      const pacote = pacoteDeGasto(RAIZ, plano);
      const hash = hashPacote(pacote);
      const { total, semPreco } = custoMaximo(pacote);
      if (semPreco.length) { console.error(`⛔ Sem preço confirmado em: ${semPreco.join(", ")}. Corre confirmar-precos primeiro.`); process.exit(1); }
      const quantidade_total = pacote.geracoes.reduce((s, g) => s + g.quantidade, 0);
      console.log(`\nCampanha ${campanha} · versão ${plano.campanha.versao}`);
      for (const g of pacote.geracoes) {
        console.log(`  ${g.cena}  ${g.endpoint}  ×${g.quantidade}  ${g.preco_unitario_creditos} cr/unid.`);
        console.log(`        parâmetros: ${JSON.stringify(g.parametros).slice(0, 300)}`);
        for (const r of g.referencias) console.log(`        referência: ${r.caminho} (${r.sha256.slice(0, 12)}…)${r.url ? " ← " + r.url : ""}`);
      }
      console.log(`\nGerações: ${quantidade_total} · custo máximo do plano: ${total} créditos · teto pedido: ${teto} · validade: ${horas} h`);
      console.log(`Pacote: ${hash}\n`);
      if (teto < total) console.log(`⚠️  O teto (${teto}) é menor do que o custo máximo (${total}); algumas gerações serão bloqueadas.`);
      const conf = await perguntar(`Para autorizar, escreve os 8 primeiros caracteres do pacote (${hash.slice(0, 8)}): `);
      if (conf.trim() !== hash.slice(0, 8)) { console.log("Não autorizado."); process.exit(1); }
      if (!fs.existsSync(CHAVE_PRIVADA)) { console.error("Não há chave do aprovador neste computador. Corre gerar-chaves."); process.exit(1); }
      const frase = await perguntar("Frase-passe do aprovador: ", { oculto: true });
      const pub = lerChavePublica(RAIZ);
      const agora = new Date();
      let aut;
      try {
        aut = assinarAutorizacao({
        campanha, versao: plano.campanha.versao, pacote_sha256: hash, teto_creditos: teto, quantidade_total,
        emitida_em: agora.toISOString(), expira_em: new Date(agora.getTime() + horas * 3600e3).toISOString(),
        }, fs.readFileSync(CHAVE_PRIVADA, "utf8"), frase, pub);
      } catch {
        console.error("⛔ Frase-passe errada (ou chave privada diferente da pública configurada). Nada foi autorizado.");
        process.exit(1);
      }
      fs.writeFileSync(path.join(pastaCampanha(RAIZ, campanha), FICHEIRO_AUTORIZACAO), JSON.stringify(aut, null, 2) + "\n");
      console.log(`✅ Autorização assinada até ${aut.expira_em}. Qualquer mudança relevante no plano anula-a.`);
      return;
    }

    case "executar": {
      const pub = lerChavePublica(RAIZ);
      if (o.real) {
        const r = await executar({ raiz: RAIZ, campanha, provedor: provedorReal(), chavePublicaPem: pub, log: console.log });
        imprimirResultado(r);
        if (r.bloqueio) process.exit(2);
        return;
      }
      // SIMULAÇÃO: corre numa cópia temporária — o razão real nunca é tocado.
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ippon-sim-"));
      fs.cpSync(RAIZ, tmp, { recursive: true, filter: (s) => !s.includes(`${path.sep}saidas`) });
      const plano = lerPlano(tmp, campanha);
      const precos = Object.fromEntries(plano.cenas.filter((c) => c.geracao?.preco_unitario).map((c) => [c.geracao.endpoint, c.geracao.preco_unitario.creditos]));
      const refs = {};
      for (const c of plano.cenas) for (const r of c.geracao?.referencias ?? []) if (r.url) refs[r.url] = fs.readFileSync(path.join(tmp, r.caminho));
      const sim = criarProvedorSimulado({ precos, referenciasRemotas: refs });
      console.log("🧪 SIMULAÇÃO — sem rede, sem gasto, numa cópia temporária.\n");
      const r = await executar({ raiz: tmp, campanha, provedor: sim, chavePublicaPem: pub, log: console.log });
      imprimirResultado(r);
      fs.rmSync(tmp, { recursive: true, force: true });
      return;
    }

    case "acompanhar": {
      if (!o.real) { console.log("Acompanhar só faz sentido com --real (consulta o fornecedor; nunca envia)."); return; }
      const r = await acompanhar({ raiz: RAIZ, campanha, provedor: provedorReal(), log: console.log });
      if (!r.length) console.log("Nada por acompanhar.");
      return;
    }

    case "reconciliar": {
      if (!o.unidade) { console.error("Indica --unidade <versao/cNN#n>."); process.exit(1); }
      let confirmacaoHumana = false;
      if (o["nao-enviado"]) {
        exigirTerminal("Marcar um envio como não enviado");
        const r = await perguntar(`Confirmas que o pedido ${o.unidade} NÃO aparece no painel Higgsfield? Escreve NAO-ENVIADO: `);
        confirmacaoHumana = r.trim() === "NAO-ENVIADO";
      }
      const r = await reconciliar({ raiz: RAIZ, campanha, provedor: provedorReal(), unidade: o.unidade, requestId: o["request-id"], naoEnviado: !!o["nao-enviado"], confirmacaoHumana });
      console.log(r);
      return;
    }

    case "rejeitar": {
      rejeitarCena({ raiz: RAIZ, campanha, cena: o.cena, motivo: o.motivo });
      console.log(`Cena ${o.cena} rejeitada e registada. Não haverá nova tentativa automática.`);
      return;
    }

    case "estado": {
      const u = estadoUnidades(lerRazao(pastaCampanha(RAIZ, campanha)));
      if (!u.size) { console.log("Sem envios registados."); return; }
      for (const x of u.values()) console.log(`${x.unidade.padEnd(16)} ${String(x.estado).padEnd(12)} ${x.creditos ?? 0} cr ${x.request_id ?? ""}`);
      return;
    }

    case "capcut": {
      const plano = lerPlano(RAIZ, campanha);
      const r = gerarEntregaCapcut(RAIZ, plano);
      console.log(`Pacote CapCut: ${path.relative(process.cwd(), r.destino)}`);
      if (r.faltam.length) console.log(`Em falta: ${r.faltam.join("; ")}`);
      return;
    }

    case "verificar-credenciais": {
      const r = await provedorReal().verificarCredenciais();
      console.log(r.ok ? `✅ ${r.detalhe}` : `⛔ ${r.detalhe}`);
      return;
    }

    case "verificar-conhecimento": {
      const r = verificarConhecimento(RAIZ);
      for (const l of r.linhas) console.log(l);
      if (!r.ok) process.exit(1);
      return;
    }

    case "desbloquear": {
      exigirTerminal("Desbloquear");
      const { trinco } = caminhosExecucao(pastaCampanha(RAIZ, campanha));
      const r = await perguntar("Confirmas que nenhuma execução está a correr? (sim/não): ");
      if (r.trim().toLowerCase() === "sim" && fs.existsSync(trinco)) { fs.unlinkSync(trinco); console.log("Trinco removido. Corre `estado` e `reconciliar` antes de executar."); }
      return;
    }

    default:
      console.error(`Comando desconhecido: ${cmd}`);
      console.log(AJUDA);
      process.exit(1);
  }
}

function imprimirResultado(r) {
  for (const e of r.enviadas) console.log(`  ✅ ${e.unidade} → ${e.request_id}`);
  for (const i of r.ignoradas) console.log(`  ↷ ${i}`);
  if (r.bloqueio) console.log(`\n⛔ BLOQUEADO: ${r.bloqueio}`);
  else console.log(`\n${r.enviadas.length} envio(s).`);
}

main().catch((e) => {
  const msg = e instanceof ErroPlano || e.bloqueio ? e.message : `${e.name}: ${e.message}`;
  console.error(`⛔ ${msg}`);
  process.exit(1);
});
