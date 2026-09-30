// marketing/lib/razao.mjs
//
// RAZÃO DE EXECUÇÃO — diário só-de-acrescentar (JSONL) + trinco exclusivo.
//
// Regra de ouro: o registo "reservado" é escrito (e sincronizado para disco)
// ANTES de qualquer envio ao fornecedor. Se o processo morrer, der timeout ou
// ficar num estado desconhecido, fica no razão uma unidade "reservada" sem
// resposta — e o executor recusa-se a enviar mais nada até ela ser
// reconciliada. Assim, reinícios e timeouts nunca geram envios duplicados.
//
// O custo reservado conta SEMPRE contra o teto, mesmo que a geração falhe:
// não se presume devolução de saldo.

import fs from "node:fs";
import path from "node:path";

export class ErroTrinco extends Error {}

export function caminhosExecucao(pastaCampanha) {
  const dir = path.join(pastaCampanha, "execucao");
  return { dir, razao: path.join(dir, "razao.jsonl"), trinco: path.join(dir, ".trinco") };
}

export function adquirirTrinco(pastaCampanha, dono) {
  const { dir, trinco } = caminhosExecucao(pastaCampanha);
  fs.mkdirSync(dir, { recursive: true });
  let fd;
  try {
    fd = fs.openSync(trinco, "wx");
  } catch (e) {
    if (e.code === "EEXIST") {
      let info = "";
      try { info = fs.readFileSync(trinco, "utf8"); } catch { /* ignora */ }
      throw new ErroTrinco(
        `já há uma execução em curso ou interrompida nesta campanha (${trinco}). ${info}\n` +
          "Se tens a certeza de que nenhuma está a correr, corre: node marketing/bin/maquina.mjs desbloquear <campanha>",
      );
    }
    throw e;
  }
  fs.writeSync(fd, JSON.stringify({ dono, pid: process.pid, desde: new Date().toISOString() }));
  fs.fsyncSync(fd);
  fs.closeSync(fd);
  return () => { try { fs.unlinkSync(trinco); } catch { /* ignora */ } };
}

export function lerRazao(pastaCampanha) {
  const { razao } = caminhosExecucao(pastaCampanha);
  if (!fs.existsSync(razao)) return [];
  return fs.readFileSync(razao, "utf8").split("\n").filter(Boolean).map((l, i) => {
    try { return JSON.parse(l); } catch { throw new Error(`razão corrompido na linha ${i + 1} — não continuar sem rever o ficheiro`); }
  });
}

export function registar(pastaCampanha, evento) {
  const { dir, razao } = caminhosExecucao(pastaCampanha);
  fs.mkdirSync(dir, { recursive: true });
  const linha = JSON.stringify({ quando: new Date().toISOString(), ...evento }) + "\n";
  const fd = fs.openSync(razao, "a");
  fs.writeSync(fd, linha);
  fs.fsyncSync(fd);
  fs.closeSync(fd);
}

/**
 * Estado atual de cada unidade (cena#n) a partir do razão.
 * estados: reservado → enviado → (em_curso) → concluido | falhou | nsfw | cancelado
 *          reservado → incerto (timeout/erro de rede/5xx) → reconciliado…
 *          reservado → recusado (4xx do fornecedor: pedido não aceite)
 *          qualquer → rejeitada_revisao (o Kainan rejeitou a cena)
 */
export function estadoUnidades(eventos) {
  const u = new Map();
  for (const ev of eventos) {
    if (!ev.unidade) continue;
    const atual = u.get(ev.unidade) ?? { unidade: ev.unidade, cena: ev.cena, historico: [] };
    atual.historico.push(ev.tipo);
    switch (ev.tipo) {
      case "reservado":
        Object.assign(atual, { estado: "reservado", idempotency_key: ev.idempotency_key, creditos: ev.creditos, autorizacao: ev.autorizacao });
        break;
      case "enviado":
        Object.assign(atual, { estado: "enviado", request_id: ev.request_id });
        break;
      case "incerto":
        Object.assign(atual, { estado: "incerto", motivo: ev.motivo, request_id: ev.request_id ?? atual.request_id });
        break;
      case "recusado":
        Object.assign(atual, { estado: "recusado", creditos: 0, motivo: ev.motivo });
        break;
      case "estado":
        Object.assign(atual, { estado: ev.estado, request_id: ev.request_id ?? atual.request_id, saidas: ev.saidas ?? atual.saidas });
        break;
      case "reconciliado":
        Object.assign(atual, { estado: ev.estado, request_id: ev.request_id ?? atual.request_id, nota: ev.nota });
        if (ev.creditos != null) atual.creditos = ev.creditos;
        break;
      case "rejeitada_revisao":
        Object.assign(atual, { rejeitada: true, motivo_rejeicao: ev.motivo });
        break;
      default:
        break;
    }
    u.set(ev.unidade, atual);
  }
  return u;
}

export const ESTADOS_TERMINAIS = new Set(["concluido", "failed", "nsfw", "canceled", "recusado", "nao_enviado"]);
export const ESTADOS_PENDENTES_DE_RECONCILIACAO = new Set(["reservado", "incerto"]);

export function creditosComprometidos(unidades, pacoteSha) {
  let t = 0;
  for (const x of unidades.values()) if (!pacoteSha || x.autorizacao === pacoteSha) t += Number(x.creditos) || 0;
  return Math.round(t * 1000) / 1000;
}
