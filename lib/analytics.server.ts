// lib/analytics.server.ts
//
// CAMADA DE ANALYTICS DO SERVIDOR — só para eventos que têm de ser VERDADE de
// estado/financeira, disparados no servidor: subscrições (webhook da Stripe) e
// AGORA também o ciclo de vida dos e-mails (webhook do Resend).
//
// A Stripe continua a ser a FONTE OFICIAL dos pagamentos e o Resend a fonte
// oficial da entrega dos e-mails. Isto é só espelhar o comportamento no
// analytics — nunca substituir a lógica de nenhum dos dois.
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
  // Subscrições (Stripe)
  | "subscription_started"
  | "subscription_renewed"
  | "subscription_cancelled"
  | "trial_started"
  | "checkout_completed"
  // Ciclo de vida dos e-mails (Resend) — medição delivered/opened/clicked
  | "email_sent"
  | "email_delivered"
  | "email_opened"
  | "email_clicked"
  | "email_bounced"
  | "email_complained";

/**
 * Regista um evento no servidor, associado ao user_id do Supabase (distinctId).
 * NUNCA passar dados pessoais em `props` — só ids/planos/valores/tipos.
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
  } catch { /* o pagamento/e-mail nunca falha por causa do analytics */ }
}
