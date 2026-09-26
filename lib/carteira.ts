// lib/carteira.ts
//
// CARTEIRA DE JUDOCOINS COMPRADOS (só servidor).
//
// Os JC comprados são orçamento EXTRA da temporada. Vivem na tabela
// `compras_judocoins` (uma linha por compra confirmada), e o saldo de alguém é a
// soma das suas linhas que ainda não expiraram. Guardar linha a linha — e não um
// número numa coluna do `users` — dá histórico, auditoria e, sobretudo,
// idempotência: o webhook da Stripe pode chegar duas vezes, mas cada pagamento
// credita UMA só vez (o UNIQUE em stripe_session_id trava a repetição).
//
// ⚠️ Regra do jogo: este saldo é orçamento, não pontos, e expira a 30 dez.
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Fim da época atual (30 dez, 23:59:59 UTC), em ISO — quando o saldo comprado
 * expira. A época é o ano civil. Se, por acaso, já se passou o dia 30 de
 * dezembro, o saldo comprado conta para a época seguinte.
 */
export function fimDaEpocaISO(agora: Date = new Date()): string {
  const ano = agora.getUTCFullYear();
  const limite = new Date(Date.UTC(ano, 11, 30, 23, 59, 59)); // mês 11 = dezembro
  if (agora.getTime() > limite.getTime()) {
    return new Date(Date.UTC(ano + 1, 11, 30, 23, 59, 59)).toISOString();
  }
  return limite.toISOString();
}

/**
 * Credita uma compra de JC. IDEMPOTENTE: repetir a mesma sessão da Stripe não
 * credita duas vezes (upsert com ignoreDuplicates sobre o stripe_session_id).
 * Nunca lança — uma falha aqui devolve { ok: false } e o webhook trata disso.
 */
export async function creditarJudocoins(args: {
  userId: string;
  stripeSessionId: string;
  jc: number;
  eurosCent?: number | null;
}): Promise<{ ok: boolean }> {
  if (!supabaseAdmin) return { ok: false };
  const { userId, stripeSessionId, jc } = args;
  if (!userId || !stripeSessionId || !(jc > 0)) return { ok: false };
  try {
    const { error } = await supabaseAdmin
      .from("compras_judocoins")
      .upsert(
        {
          user_id: userId,
          stripe_session_id: stripeSessionId,
          jc,
          euros_cent: args.eurosCent ?? null,
          expira_em: fimDaEpocaISO(),
          estado: "creditado",
        },
        { onConflict: "stripe_session_id", ignoreDuplicates: true },
      );
    if (error) {
      console.error("[carteira] creditar:", error.message);
      return { ok: false };
    }
    return { ok: true };
  } catch (e) {
    console.error("[carteira] creditar (exceção):", e);
    return { ok: false };
  }
}

/**
 * Saldo comprado VÁLIDO (não expirado) de um utilizador, em JC. Em caso de
 * dúvida devolve 0 — errar para menos orçamento é preferível a dar de graça.
 */
export async function jcCompradosValidos(userId: string): Promise<number> {
  if (!supabaseAdmin || !userId) return 0;
  try {
    const agora = new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .from("compras_judocoins")
      .select("jc")
      .eq("user_id", userId)
      .eq("estado", "creditado")
      .gt("expira_em", agora);
    if (error || !data) return 0;
    return data.reduce((soma, linha) => soma + (Number((linha as { jc: number }).jc) || 0), 0);
  } catch {
    return 0;
  }
}
