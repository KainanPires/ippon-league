// app/api/promo/aderir/route.ts
//
// ADESÃO À PROMOÇÃO DE LANÇAMENTO (Mundial) — dá Pro Max GRÁTIS a quem se
// inscreve dentro da janela, até 31/10. Disparada no registo (fire-and-forget
// a partir de /comecar), com a identidade pelo token.
//
// NÃO toca na Stripe: é acesso de promoção, marcado por `users.promo_lancamento_ate`.
// O corte é feito pelo cron /api/promo/expirar (NUNCA pelo cron do dinheiro, que
// de propósito não mexe em contas sem subscrição).
//
// Idempotente e seguro:
//   • fora da janela  -> no-op (não é erro).
//   • já tem subscrição na Stripe -> não se toca (é cliente a sério).
//   • já é da promoção -> não repete.
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sincronizarLigasOficiais } from "@/lib/ligasOficiais";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// --- JANELA DA PROMOÇÃO (edita aqui se precisares) ---
// Datas em UTC. Portugal está a UTC+1 até 26/10 e UTC+0 depois — a folga de
// horas nas pontas é irrelevante. Para TESTAR hoje, mete PROMO_INICIO no passado.
const PROMO_INICIO = Date.parse("2026-09-28T00:00:00Z");
const PROMO_FIM_ISO = "2026-10-31T23:59:59Z";
const PROMO_FIM = Date.parse(PROMO_FIM_ISO);

async function uidDoPedido(req: Request): Promise<string | null> {
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
    if (error) return null;
    return data?.user?.id ?? null;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const admin = supabaseAdmin;
  if (!admin) {
    return NextResponse.json({ ok: false, erro: "Servidor sem ligação." }, { status: 500 });
  }
  const uid = await uidDoPedido(req);
  if (!uid) return NextResponse.json({ ok: false, erro: "Sem sessão." }, { status: 401 });

  // Fora da janela: não é erro, é só não haver promoção.
  const agora = Date.now();
  if (agora < PROMO_INICIO || agora > PROMO_FIM) {
    return NextResponse.json({ ok: true, promo: false, motivo: "fora_da_janela" });
  }

  // Estado atual da conta.
  const { data: u } = await admin
    .from("users")
    .select("stripe_subscription_id, promo_lancamento_ate")
    .eq("id", uid)
    .maybeSingle();
  const row = (u || {}) as Record<string, unknown>;

  // Já é cliente a sério (tem subscrição na Stripe): não se toca.
  if (row.stripe_subscription_id) {
    return NextResponse.json({ ok: true, promo: false, motivo: "ja_subscrito" });
  }
  // Já é da promoção: idempotente.
  if (row.promo_lancamento_ate) {
    return NextResponse.json({ ok: true, promo: true, ate: String(row.promo_lancamento_ate) });
  }

  const campos: Record<string, unknown> = {
    is_pro: true,
    is_pro_max: true,
    promo_lancamento_ate: PROMO_FIM_ISO,
    renova_automaticamente: false,
  };

  // A linha em `users` é criada no registo; pode não estar pronta no instante
  // exato deste pedido. Se o update não apanhar a linha, espera e tenta 1x.
  async function aplicar(): Promise<number> {
    const { data, error } = await admin!.from("users").update(campos).eq("id", uid!).select("id");
    if (error) throw new Error(error.message);
    return (data || []).length;
  }
  try {
    let n = await aplicar();
    if (n === 0) {
      await new Promise((r) => setTimeout(r, 1200));
      n = await aplicar();
    }
    if (n === 0) {
      return NextResponse.json({ ok: false, erro: "Conta ainda não pronta." }, { status: 409 });
    }
  } catch (e) {
    console.error("[promo/aderir]", e);
    return NextResponse.json({ ok: false, erro: "Não foi possível ativar a promoção." }, { status: 500 });
  }

  // Liga os benefícios de ligas oficiais ao novo nível. Benefício extra: não bloqueia.
  try { await sincronizarLigasOficiais(uid); } catch { /* segue na mesma */ }

  return NextResponse.json({ ok: true, promo: true, ate: PROMO_FIM_ISO });
}
