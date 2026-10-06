// lib/adminLog.ts
//
// Registo de auditoria das acoes de admin que mexem na jogabilidade.
// Grava QUEM (uid + email), O QUE (acao + detalhe) e QUANDO na tabela admin_log.
//
// BEST-EFFORT: nunca lanca nem bloqueia a acao principal. A auditoria e um
// extra de seguranca -- se falhar, a operacao que o admin pediu deve seguir na
// mesma. (Uma copa criada mas nao registada e melhor do que uma copa que nao se
// cria porque o registo falhou.)
//
// A escrita usa o supabaseAdmin (service key), por isso a tabela pode ter RLS
// ligado sem politicas -- so o servidor escreve, e os clientes nem leem.
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export interface EntradaLog {
  uid: string;
  email: string | null;
  acao: string;         // ex.: "copa_teste_criada", "dodo_edicao_aberta"
  detalhe?: unknown;    // objeto livre (vai como jsonb)
}

/** Grava uma linha de auditoria. Nunca lanca. */
export async function registarAdminLog(entrada: EntradaLog): Promise<void> {
  try {
    if (!supabaseAdmin) return;
    await supabaseAdmin.from("admin_log").insert({
      uid: entrada.uid,
      email: entrada.email ?? null,
      acao: entrada.acao,
      detalhe: (entrada.detalhe ?? null) as never,
    });
  } catch {
    // Auditoria falhada nao bloqueia a acao.
  }
}

/**
 * Alerta por email (Resend) para as acoes mais sensiveis. Best-effort.
 * Reutiliza as variaveis de ambiente que ja existem para os alertas de nivel:
 *   RESEND_API_KEY  - chave do Resend
 *   ALERTA_EMAIL    - destino (cai para MAIL_TO)
 *   MAIL_FROM       - remetente (cai para o remetente de teste do Resend)
 */
export async function alertaAdmin(assunto: string, corpo: string): Promise<void> {
  try {
    const apiKey = process.env.RESEND_API_KEY || "";
    const dest = process.env.ALERTA_EMAIL || process.env.MAIL_TO || "";
    if (!apiKey || !dest) return;
    const from = process.env.MAIL_FROM || "Ippon League <onboarding@resend.dev>";
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [dest], subject: assunto, text: corpo }),
    });
  } catch {
    // Email falhado nao bloqueia.
  }
}
