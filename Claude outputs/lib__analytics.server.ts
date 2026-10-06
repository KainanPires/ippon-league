// lib/analytics.server.ts
//
// CAMADA DE ANALYTICS DO SERVIDOR — só para eventos que têm de ser VERDADE de
// estado/financeira, disparados no servidor (ex.: no webhook da Stripe):
// subscription_started / _renewed / _cancelled.
//
// A Stripe continua a ser a FONTE OFICIAL dos pagamentos. Isto é só espelhar o
// comportamento no analytics — nunca substituir a lógica financeira da Stripe.
//
// Usa posthog-node. Em serverless, capturamos e damos flush imediato.

import { PostHog } from "posthog-node";

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;

let cliente: PostHog | null = null;
function ph(): PostHog | null {
  if (!KEY) return null;
  if (!cliente) {
    cliente = new PostHog(KEY, {
      host: "https://eu.i.posthog.com", // região EU (server-side usa host absoluto)
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return cliente;
}

// Nomes de evento do servidor (subconjunto da taxonomia — mantê-los alinhados
// com lib/analytics.ts EVENTOS).
export type ServerEventName =
  | "subscription_started"
  | "subscription_renewed"
  | "subscription_cancelled"
  | "trial_started"
  | "checkout_completed";

/**
 * Regista um evento no servidor, associado ao user_id do Supabase (distinctId).
 * NUNCA passar dados pessoais em `props` — só ids/planos/valores.
 */
export async function trackServer(
  userId: string,
  event: ServerEventName,
  props?: Record<string, string | number | boolean | null | undefined>,
): Promise<void> {
  const c = ph();
  if (!c || !userId) return;
  try {
    c.capture({ distinctId: userId, event, properties: props });
    await c.flush();
  } catch { /* o pagamento nunca falha por causa do analytics */ }
}
