"use client";

// lib/atribuicao.ts
//
// ATRIBUIÇÃO (Fase D) — de onde veio o jogador. É PRIMEIRA-PARTE: os dados vão
// só para a NOSSA base (tabela users), ligados à conta. Não é rastreamento de
// terceiros, é saber a origem dos nossos próprios utilizadores.
//
// Como funciona:
//   • Em cada carregamento, lê os utm_* do URL, o ?ref= (referral) e o referrer.
//   • FIRST-TOUCH: grava-se UMA vez e nunca se sobrescreve ("como me conheceu").
//   • LAST-TOUCH: atualiza-se sempre que há uma nova campanha ("o que me trouxe
//     desta vez"). Uma visita direta (sem utm) não apaga a última campanha.
//   • No registo, o comecar envia isto para /api/atribuicao, que o escreve na
//     conta. A partir daí, cruzas origem × retenção no Supabase.

const FIRST = "ippon_attr_first";
const LAST = "ippon_attr_last";

export interface Toque {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  ref?: string;        // referral (?ref= no link de convite)
  referrer?: string;   // de que site veio
  ts?: string;         // quando
}

function lerDoUrl(): Toque {
  const t: Toque = {};
  try {
    const q = new URLSearchParams(window.location.search);
    const g = (k: string) => (q.get(k) || "").trim() || undefined;
    t.utm_source = g("utm_source");
    t.utm_medium = g("utm_medium");
    t.utm_campaign = g("utm_campaign");
    t.utm_content = g("utm_content");
    t.utm_term = g("utm_term");
    t.ref = g("ref");
    const r = (document.referrer || "").trim();
    // Só guardamos o referrer se for de FORA do próprio site.
    if (r && !r.includes(window.location.host)) t.referrer = r;
  } catch { /* sem window/URL: devolve vazio */ }
  return t;
}

function temCampanha(t: Toque): boolean {
  return !!(t.utm_source || t.utm_medium || t.utm_campaign || t.utm_content || t.utm_term || t.ref);
}

/** Corre em cada carregamento (via PostHogProvider). Guarda first/last no aparelho. */
export function capturarAtribuicao(): void {
  if (typeof window === "undefined") return;
  const t = lerDoUrl();
  try {
    // First-touch: grava na primeira vez de sempre (mesmo sem utm — fica o
    // referrer e o momento da primeira visita).
    if (!localStorage.getItem(FIRST)) {
      localStorage.setItem(FIRST, JSON.stringify({ ...t, ts: new Date().toISOString() }));
    }
    // Last-touch: só atualiza quando há mesmo uma campanha/origem nova.
    if (temCampanha(t)) {
      localStorage.setItem(LAST, JSON.stringify({ ...t, ts: new Date().toISOString() }));
    }
  } catch { /* storage indisponível: não bloqueia nada */ }
}

/** Lê o que está guardado, para enviar no registo. */
export function lerAtribuicaoGuardada(): { first: Toque | null; last: Toque | null } {
  try {
    const f = localStorage.getItem(FIRST);
    const l = localStorage.getItem(LAST);
    return { first: f ? JSON.parse(f) : null, last: l ? JSON.parse(l) : null };
  } catch {
    return { first: null, last: null };
  }
}
