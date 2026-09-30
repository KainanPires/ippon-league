// marketing/lib/provedores/simulado.mjs
//
// Fornecedor SIMULADO — mesmo contrato do cliente Higgsfield, sem rede e sem
// custo. É o modo por defeito do executor e o que os testes usam.
//
// `comportamentos` controla o que acontece em cada envio, por ordem:
//   "ok"              aceita e devolve request_id
//   "timeout"         não responde (o cliente não sabe se foi aceite)
//   "aceite-timeout"  o servidor ACEITA mas a resposta perde-se (caso ambíguo real)
//   "http500"         erro do servidor (estado incerto)
//   "http400"         recusa o pedido
// `estadosFinais` mapeia ordem de envio → estado final ("completed", "failed", "nsfw").

import crypto from "node:crypto";
import { ErroIncerto, ErroRecusado } from "./higgsfield.mjs";

export function criarProvedorSimulado({ precos = {}, comportamentos = [], estadosFinais = {}, atrasoMs = 0, referenciasRemotas = {} } = {}) {
  const envios = [];          // cada envio que o servidor "viu" (inclui aceites com resposta perdida)
  const tentativas = [];      // cada chamada a enviar()
  const pedidos = new Map();  // request_id → { estado, ... }
  const porChave = new Map(); // idempotency key → request_id
  let n = 0;
  const espera = () => (atrasoMs ? new Promise((r) => setTimeout(r, atrasoMs)) : Promise.resolve());

  return {
    nome: "simulado",
    real: false,
    envios,
    tentativas,
    pedidos,

    async estimar(endpoint) {
      await espera();
      if (!(endpoint in precos)) throw new ErroRecusado(`sem preço para ${endpoint} (simulado)`);
      return { creditos: precos[endpoint], usd: null };
    },

    async enviar(endpoint, parametros, idempotencyKey) {
      await espera();
      const ordem = n++;
      tentativas.push({ endpoint, parametros, idempotencyKey });
      const comp = comportamentos[ordem] ?? "ok";
      if (comp === "timeout") throw new ErroIncerto("sem resposta do fornecedor (timeout) [simulado]");
      if (comp === "http500") throw new ErroIncerto("fornecedor devolveu HTTP 500 [simulado]", { http: 500 });
      if (comp === "http400") throw new ErroRecusado("pedido recusado (HTTP 400) [simulado]", { http: 400 });
      // idempotência simulada: a mesma chave devolve o mesmo pedido
      if (porChave.has(idempotencyKey)) return { request_id: porChave.get(idempotencyKey), status: "queued" };
      const request_id = crypto.randomUUID();
      porChave.set(idempotencyKey, request_id);
      const final = estadosFinais[ordem] ?? "completed";
      pedidos.set(request_id, { endpoint, estado: "queued", final, consultas: 0 });
      envios.push({ endpoint, parametros, idempotencyKey, request_id });
      if (comp === "aceite-timeout") throw new ErroIncerto("resposta perdida depois de o servidor aceitar [simulado]");
      return { request_id, status: "queued" };
    },

    async estado(requestId) {
      await espera();
      const p = pedidos.get(requestId);
      if (!p) throw new ErroRecusado("pedido inexistente (HTTP 404) [simulado]", { http: 404 });
      p.consultas++;
      if (p.consultas >= 2) p.estado = p.final;
      else p.estado = "in_progress";
      const r = { status: p.estado, request_id: requestId };
      if (p.estado === "completed") r.video = { url: `sim://saidas/${requestId}.mp4` };
      return r;
    },

    async descarregar(url) {
      return Buffer.from(`conteudo simulado de ${url}`);
    },

    async obterReferencia(url) {
      if (!(url in referenciasRemotas)) throw new Error(`referência inacessível: ${url} [simulado]`);
      return Buffer.from(referenciasRemotas[url]);
    },

    async verificarCredenciais() {
      return { ok: true, detalhe: "fornecedor simulado (sem credenciais)" };
    },

    /** Quantos pedidos o "servidor" aceitou (o que custaria dinheiro a sério). */
    get aceites() { return envios.length; },
  };
}
