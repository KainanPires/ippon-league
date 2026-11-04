// app/api/conta/apagar/route.ts
//
// ELIMINAÇÃO DE CONTA PELO PRÓPRIO UTILIZADOR (exigida pela Apple e pela Google).
//
// POST { confirmar: true }  com  Authorization: Bearer <token da sessão>
// -> { ok: true }  |  { ok: false, erro, etapa }
//
// O ecrã pede a password antes de chamar isto (reautenticação no cliente, igual
// a "Alterar senha"). Aqui só se apaga A CONTA DE QUEM PEDE — o uid vem do token,
// nunca do corpo.
//
// ---------------------------------------------------------------------------
// A ORDEM IMPORTA (cada passo só corre se o anterior correu bem)
//
//  1. Stripe: cancelar já a assinatura ativa. Se a Stripe falhar, PÁRA — apagar
//     a conta e continuar a cobrar seria o pior resultado possível.
//  2. Ligas de amigos ativas criadas pela pessoa: passam a outro membro (D-07).
//  3. Limpeza de tabelas que a função SQL não cobre (push, faixas, mensagens...).
//     `compras_judocoins` FICA: é registo contabilístico de pagamentos.
//  4. Retira is_pro/is_pro_max — a função SQL recusa (em silêncio) quem paga.
//  5. Função SQL `ippon_apagar_conta_inativa` (anonimiza histórico partilhado e
//     apaga equipas, membros, notificações, pontuações e a linha em users).
//  6. SÓ SE O 5 CORREU SEM ERRO: apaga o login (auth.users). As tabelas da
//     Academy (aca_*, quiz_historico) caem em cascata.
//
// Se algo falhar a meio, regista em admin_log para o fundador resolver à mão.
// ---------------------------------------------------------------------------
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { stripeFetch } from "@/lib/stripe";
import { entregarLigaAoApagarConta } from "@/lib/sucessaoLigas";
import { registarAdminLog } from "@/lib/adminLog";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Estados da Stripe em que a assinatura ainda pode cobrar. */
const ESTADOS_ATIVOS = ["active", "trialing", "past_due", "unpaid", "incomplete"];

/** Tabelas com dados da pessoa que a função SQL não apaga (coluna user_id). */
const TABELAS_EXTRA = [
  "push_subscriptions",
  "faixas_historico",
  "mensagens",
  "avaliacoes",
  "promo_emails_enviados",
  "favoritos_notif_estado",
];

async function utilizadorDoPedido(req: Request): Promise<{ id: string; email: string | null } | null> {
  try {
    const auth = req.headers.get("authorization") || "";
    const t = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
    if (!t) return null;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const pub = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
    if (!url || !pub) return null;
    const sb = createClient(url, pub, {
      global: { headers: { Authorization: `Bearer ${t}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await sb.auth.getUser();
    if (error || !data?.user?.id) return null;
    return { id: data.user.id, email: data.user.email ?? null };
  } catch {
    return null;
  }
}

function falha(etapa: string, status = 500) {
  return NextResponse.json(
    { ok: false, etapa, erro: "Não foi possível apagar a conta. Contacta support@ipponleague.com." },
    { status },
  );
}

export async function POST(req: Request) {
  if (!supabaseAdmin) return falha("servidor");
  const quem = await utilizadorDoPedido(req);
  if (!quem) return NextResponse.json({ ok: false, erro: "Entra na tua conta." }, { status: 401 });

  let corpo: { confirmar?: unknown } = {};
  try { corpo = await req.json(); } catch { /* corpo vazio */ }
  if (corpo.confirmar !== true) {
    return NextResponse.json({ ok: false, erro: "Confirmação em falta." }, { status: 400 });
  }

  const uid = quem.id;
  const log = (acao: string, detalhe?: unknown) =>
    registarAdminLog({ uid, email: quem.email, acao, detalhe });

  const { data: u } = await supabaseAdmin
    .from("users")
    .select("id, is_pro, is_pro_max, stripe_subscription_id")
    .eq("id", uid)
    .maybeSingle();

  // 1. STRIPE
  const subId = u?.stripe_subscription_id ? String(u.stripe_subscription_id) : "";
  if (subId) {
    try {
      const sub = await stripeFetch<{ status?: string }>(`subscriptions/${encodeURIComponent(subId)}`);
      if (sub?.status && ESTADOS_ATIVOS.includes(sub.status)) {
        await stripeFetch(`subscriptions/${encodeURIComponent(subId)}`, "DELETE");
      }
    } catch (e) {
      await log("conta_apagar_falhou", { etapa: "stripe", erro: String(e) });
      return falha("stripe");
    }
  }

  // 2. LIGAS DE AMIGOS QUE CRIOU
  try {
    const { data: ligas } = await supabaseAdmin
      .from("leagues").select("id").eq("type", "amigos").eq("created_by", uid);
    for (const l of ligas || []) {
      await entregarLigaAoApagarConta(String(l.id), uid);
    }
  } catch { /* best-effort: não impede a eliminação */ }

  // 3. LIMPEZA EXTRA
  for (const tabela of TABELAS_EXTRA) {
    try { await supabaseAdmin.from(tabela).delete().eq("user_id", uid); } catch { /* segue */ }
  }

  // 4. RETIRAR O PRO (senão a função SQL não faz nada)
  if (u && (u.is_pro || u.is_pro_max)) {
    const { error } = await supabaseAdmin
      .from("users").update({ is_pro: false, is_pro_max: false }).eq("id", uid);
    if (error) {
      await log("conta_apagar_falhou", { etapa: "retirar_pro", erro: error.message });
      return falha("retirar_pro");
    }
  }

  // 5. FUNÇÃO SQL
  const { error: erroRpc } = await supabaseAdmin.rpc("ippon_apagar_conta_inativa", { p_user: uid });
  if (erroRpc) {
    await log("conta_apagar_falhou", { etapa: "sql", erro: erroRpc.message });
    return falha("sql");
  }
  // Confirma que a linha saiu mesmo (a função não devolve erro quando recusa).
  const { data: ainda } = await supabaseAdmin.from("users").select("id").eq("id", uid).maybeSingle();
  if (ainda) {
    await log("conta_apagar_falhou", { etapa: "sql_nao_apagou" });
    return falha("sql_nao_apagou");
  }

  // 6. LOGIN (e Academy, em cascata)
  const { error: erroAuth } = await supabaseAdmin.auth.admin.deleteUser(uid);
  if (erroAuth) {
    await log("conta_apagar_falhou", { etapa: "auth", erro: erroAuth.message });
    return falha("auth");
  }

  // Sem email: a pessoa pediu para ser apagada; fica só o uid como registo.
  await registarAdminLog({ uid, email: null, acao: "conta_apagada_pelo_utilizador", detalhe: { tinhaSubscricao: Boolean(subId) } });
  return NextResponse.json({ ok: true });
}
