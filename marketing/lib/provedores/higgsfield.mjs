// marketing/lib/provedores/higgsfield.mjs
//
// Cliente da API oficial Higgsfield — SÓ o que está na documentação oficial
// (consultada a 30/09/2026, ver conhecimento/10-higgsfield-api.md):
//
//   Base:          https://api.higgsfield.ai
//   Autenticação:  Authorization: Key <HF_API_KEY_ID>:<HF_API_KEY_SECRET>
//   Estimativa:    POST /estimate/<endpoint-do-modelo>   (mesmo corpo) → { credits, usd }
//   Envio:         POST /<endpoint-do-modelo>   + Idempotency-Key → { status, request_id, status_url, cancel_url }
//   Estado:        GET  /requests/<request_id>/status → status ∈ queued|in_progress|completed|failed|nsfw|canceled
//   Saídas:        images[].url | video.url | audio.url | audios[].url (retidas ≥ 7 dias)
//
// O endpoint de cada modelo vem da página do modelo na documentação/console e
// é escrito no plano pelo planeador; este cliente não inventa nenhum.
//
// Credenciais: lidas do ambiente de execução (HF_API_KEY_ID, HF_API_KEY_SECRET).
// Nunca são escritas em ficheiros, registos nem mensagens de erro.

const BASE = "https://api.higgsfield.ai";

export class ErroIncerto extends Error {
  constructor(msg, extra = {}) { super(msg); this.incerto = true; Object.assign(this, extra); }
}
export class ErroRecusado extends Error {
  constructor(msg, extra = {}) { super(msg); this.recusado = true; Object.assign(this, extra); }
}
export class ErroCredenciais extends Error {}

function credenciais(env) {
  const id = env.HF_API_KEY_ID;
  const segredo = env.HF_API_KEY_SECRET;
  if (!id || !segredo) throw new ErroCredenciais("faltam HF_API_KEY_ID e/ou HF_API_KEY_SECRET no ambiente de execução");
  return { id, segredo };
}

function tapar(texto, env) {
  let t = String(texto ?? "");
  for (const v of [env.HF_API_KEY_ID, env.HF_API_KEY_SECRET]) if (v) t = t.split(v).join("[oculto]");
  return t.slice(0, 500);
}

export function criarProvedorHiggsfield({ env = process.env, fetchImpl = fetch, timeoutMs = 30000 } = {}) {
  async function pedido(metodo, caminho, corpo, cabecalhosExtra = {}) {
    const { id, segredo } = credenciais(env);
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    let res;
    try {
      res = await fetchImpl(BASE + caminho, {
        method: metodo,
        headers: {
          Authorization: `Key ${id}:${segredo}`,
          ...(corpo ? { "Content-Type": "application/json" } : {}),
          ...cabecalhosExtra,
        },
        body: corpo ? JSON.stringify(corpo) : undefined,
        signal: ctrl.signal,
      });
    } catch (e) {
      throw new ErroIncerto(`sem resposta do fornecedor (${e.name === "AbortError" ? "timeout" : "erro de rede"})`);
    } finally {
      clearTimeout(t);
    }
    const texto = await res.text().catch(() => "");
    let json = null;
    try { json = texto ? JSON.parse(texto) : null; } catch { json = null; }
    return { status: res.status, json, texto: tapar(texto, env) };
  }

  return {
    nome: "higgsfield",
    real: true,

    /** Preço aplicável (créditos) para este endpoint + corpo. Não gera nada. */
    async estimar(endpoint, parametros) {
      const r = await pedido("POST", `/estimate/${endpoint}`, parametros);
      if (r.status !== 200 || r.json?.credits == null) throw new ErroRecusado(`estimativa indisponível (HTTP ${r.status}): ${r.texto}`, { http: r.status });
      const creditos = Number(r.json.credits);
      if (!(creditos > 0)) throw new ErroRecusado(`estimativa sem valor válido: ${r.texto}`);
      return { creditos, usd: r.json.usd != null ? Number(r.json.usd) : null };
    },

    /** Envio de uma geração. Timeout/rede/5xx → ErroIncerto (NÃO reenviar). 4xx → ErroRecusado. */
    async enviar(endpoint, parametros, idempotencyKey) {
      const r = await pedido("POST", `/${endpoint}`, parametros, { "Idempotency-Key": idempotencyKey });
      if (r.status >= 500) throw new ErroIncerto(`fornecedor devolveu HTTP ${r.status}`, { http: r.status });
      if (r.status >= 400) throw new ErroRecusado(`pedido recusado (HTTP ${r.status}): ${r.texto}`, { http: r.status });
      if (!r.json?.request_id) throw new ErroIncerto(`resposta sem request_id (HTTP ${r.status})`, { http: r.status });
      return { request_id: r.json.request_id, status: r.json.status ?? "queued" };
    },

    async estado(requestId) {
      if (!/^[0-9a-f-]{36}$/i.test(requestId)) throw new ErroRecusado("request_id inválido");
      const r = await pedido("GET", `/requests/${requestId}/status`);
      if (r.status !== 200 || !r.json?.status) throw new ErroIncerto(`estado indisponível (HTTP ${r.status})`, { http: r.status });
      return r.json;
    },

    /** Descarrega um ficheiro de saída (URL devolvido pela API) sem credenciais. */
    async descarregar(url) {
      if (!/^https:\/\//i.test(url)) throw new Error("URL de saída não é https");
      const res = await fetchImpl(url);
      if (!res.ok) throw new Error(`download falhou (HTTP ${res.status})`);
      return Buffer.from(await res.arrayBuffer());
    },

    /** Lê uma referência pública (a que o modelo vai ver) para confirmar o hash. Sem credenciais. */
    async obterReferencia(url) {
      if (!/^https:\/\//i.test(url)) throw new Error("URL de referência não é https");
      const res = await fetchImpl(url);
      if (!res.ok) throw new Error(`referência inacessível (HTTP ${res.status})`);
      return Buffer.from(await res.arrayBuffer());
    },

    /**
     * Verifica credenciais SEM gerar nada: pede o estado de um request_id que
     * não existe. 404 = credenciais aceites; 401 = inválidas.
     */
    async verificarCredenciais() {
      const r = await pedido("GET", "/requests/00000000-0000-4000-8000-000000000000/status");
      if (r.status === 401) return { ok: false, detalhe: "credenciais rejeitadas (HTTP 401)" };
      if (r.status === 404) return { ok: true, detalhe: "credenciais aceites (HTTP 404 para um pedido inexistente, como esperado)" };
      return { ok: false, detalhe: `resposta inesperada (HTTP ${r.status}) — verificar manualmente` };
    },
  };
}
