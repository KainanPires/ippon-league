"use client";

// lib/analytics.ts
//
// CAMADA CENTRAL DE ANALYTICS (cliente) — Ippon League.
//
// Regra da sprint: NADA de chamar posthog.capture(...) espalhado pela app.
// Toda a app fala com ESTA camada: track(), identify(), resetIdentity().
// Vantagens:
//   • os nomes de evento são um TIPO fechado (EventName) — inventar um evento
//     fora da lista NÃO COMPILA. Zero eventos à solta, zero duplicados.
//   • propriedades globais (língua, plataforma) injetadas automaticamente.
//   • privacidade por construção: limpar() recusa enviar campos proibidos.
//   • trocar de ferramenta um dia = mexer só neste ficheiro.
//
// PRIVACIDADE / CONSENTIMENTO (RGPD):
//   O PostHog arranca OPTED-OUT (opt_out_capturing_by_default) e em memória.
//   Nada sai até a pessoa aceitar no banner (concederConsentimento). Assim, sem
//   consentimento, capturar é um no-op — seguro por omissão.
//
// Identificador = user_id do Supabase (pseudónimo). NUNCA email/nome/telefone.

import posthog from "posthog-js";

// -------------------------------------------------------------------------
// TAXONOMIA — a lista fechada de eventos do negócio (todas as fases da sprint).
// Acrescentar um evento novo = acrescentar aqui primeiro (e ao docs/analytics.md).
// -------------------------------------------------------------------------
export const EVENTOS = [
  // Aquisição
  "landing_viewed", "signup_started", "signup_completed",
  // Ativação
  "team_creation_started", "market_viewed", "athlete_viewed", "athlete_added",
  "team_completed", "captain_selected", "team_saved",
  // Engagement
  "ranking_viewed", "results_viewed", "league_viewed", "league_joined",
  "league_created", "invite_shared", "news_opened", "athlete_favorited",
  "live_bracket_viewed",
  // Social / viralidade
  "invite_link_opened", "invite_signup", "invite_activated_player",
  // Monetização
  "paywall_viewed", "plan_selected", "trial_started", "checkout_started",
  "checkout_completed", "subscription_started", "subscription_cancelled",
  "subscription_renewed",
  // Mercado fechado / próxima competição
  "market_closed_experience_viewed", "next_competition_cta_clicked",
  "next_competition_team_started", "next_competition_team_saved",
] as const;

export type EventName = (typeof EVENTOS)[number];
export type EventProps = Record<string, string | number | boolean | null | undefined>;

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const CONSENT_KEY = "ippon_analytics_consent"; // "granted" | "denied"

// Nunca enviar para o analytics (defesa mesmo que alguém passe por engano).
const PROIBIDAS = new Set([
  "email", "name", "nome", "telefone", "phone", "password", "senha",
  "data_nascimento", "datanasc", "datanascimento",
]);

// -------------------------------------------------------------------------
// Inicialização (chamada uma vez, do instrumentation-client.ts).
// -------------------------------------------------------------------------
let iniciado = false;

// -------------------------------------------------------------------------
// "Consentimento pronto": callbacks que só devem correr QUANDO houver
// consentimento E com o id já estável. É isto que faz o funil ligar: o
// landing_viewed e o signup_started esperam por aqui, em vez de dispararem
// cedo demais (opted-out) ou com um id que ainda muda entre páginas.
// -------------------------------------------------------------------------
let consentePronto = false;
const filaConsentimento: Array<() => void> = [];

function dispararConsentimentoPronto(): void {
  if (consentePronto) return;
  consentePronto = true;
  while (filaConsentimento.length) {
    const cb = filaConsentimento.shift();
    if (cb) { try { cb(); } catch {} }
  }
}

/** Corre `cb` quando houver consentimento — já concedido, ou no instante em que
 *  a pessoa aceita. Usado para os eventos de entrada (landing/signup_started). */
export function aoTerConsentimento(cb: () => void): void {
  if (consentePronto) { try { cb(); } catch {} return; }
  filaConsentimento.push(cb);
}

export function initAnalytics(): void {
  if (iniciado || typeof window === "undefined" || !KEY) return;
  iniciado = true;

  let jaConsentiu = false;
  try { jaConsentiu = localStorage.getItem(CONSENT_KEY) === "granted"; } catch {}

  posthog.init(KEY, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "/ingest",
    ui_host: "https://eu.posthog.com",
    person_profiles: "identified_only",
    capture_pageview: false,   // pageviews manuais (App Router) — ver PostHogProvider
    capture_pageleave: true,
    autocapture: false,        // só eventos explícitos; sem cliques automáticos
    // SEM consentimento: opted-out e em MEMÓRIA (nada é enviado, nenhum cookie).
    // COM consentimento já dado: opted-in e PERSISTENTE — o MESMO id em todas as
    // páginas, para o funil ligar a jornada da pessoa do início ao fim.
    opt_out_capturing_by_default: !jaConsentiu,
    persistence: jaConsentiu ? "localStorage+cookie" : "memory",
  });

  // Já tinha aceitado antes: o id é estável desde já, liberta a fila.
  if (jaConsentiu) dispararConsentimentoPronto();
}

function aplicar(sim: boolean): void {
  if (!KEY) return;
  try {
    if (sim) {
      posthog.set_config({ persistence: "localStorage+cookie" });
      posthog.opt_in_capturing();
    } else {
      posthog.opt_out_capturing();
    }
  } catch { /* não rebenta a app por causa do analytics */ }
}

// -------------------------------------------------------------------------
// Consentimento (usado pelo banner).
// -------------------------------------------------------------------------
export function consentimentoGuardado(): "granted" | "denied" | null {
  try {
    const c = localStorage.getItem(CONSENT_KEY);
    return c === "granted" || c === "denied" ? c : null;
  } catch { return null; }
}
export function concederConsentimento(): void {
  try { localStorage.setItem(CONSENT_KEY, "granted"); } catch {}
  aplicar(true);          // opt-in + passa a persistir o id (fica estável)
  trackPageview();        // regista a página atual, agora que há consentimento
  dispararConsentimentoPronto(); // liberta landing_viewed / signup_started em espera
}
export function negarConsentimento(): void {
  try { localStorage.setItem(CONSENT_KEY, "denied"); } catch {}
  aplicar(false);
}

// -------------------------------------------------------------------------
// Propriedades globais + limpeza de dados pessoais.
// -------------------------------------------------------------------------
function propsGlobais(): EventProps {
  let language: string | undefined;
  try { language = localStorage.getItem("ippon_lingua") || undefined; } catch {}
  let platform = "web";
  try {
    const standalone =
      (typeof window !== "undefined" && window.matchMedia?.("(display-mode: standalone)")?.matches) ||
      // iOS Safari PWA
      (typeof navigator !== "undefined" && (navigator as unknown as { standalone?: boolean }).standalone === true);
    if (standalone) platform = "pwa";
  } catch {}
  return { language, platform };
}

function limpar(props?: EventProps): EventProps {
  const out: EventProps = {};
  if (!props) return out;
  for (const [k, v] of Object.entries(props)) {
    if (PROIBIDAS.has(k.toLowerCase())) continue; // nunca envia dados pessoais
    out[k] = v;
  }
  return out;
}

// -------------------------------------------------------------------------
// A API que a app usa.
// -------------------------------------------------------------------------
export function track(event: EventName, props?: EventProps): void {
  if (!KEY) return;
  try { posthog.capture(event, { ...propsGlobais(), ...limpar(props) }); } catch {}
}

/** Pageview manual (App Router não os deteta sozinho). */
export function trackPageview(url?: string): void {
  if (!KEY) return;
  try { posthog.capture("$pageview", { ...propsGlobais(), ...(url ? { $current_url: url } : {}) }); } catch {}
}

/** Liga a jornada anónima ao utilizador real (user_id do Supabase). */
export function identify(userId: string, props?: EventProps): void {
  if (!KEY || !userId) return;
  try { posthog.identify(userId, limpar(props)); } catch {}
}

/** No logout: corta a identidade para o próximo não herdar a sessão. */
export function resetIdentity(): void {
  if (!KEY) return;
  try { posthog.reset(); } catch {}
}
