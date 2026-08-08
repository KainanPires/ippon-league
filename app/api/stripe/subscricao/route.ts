// app/api/stripe/subscricao/route.ts
//
// VER E GERIR A PRÓPRIA SUBSCRIÇÃO.
//
//   GET  /api/stripe/subscricao                    -> o meu estado
//   POST /api/stripe/subscricao { acao:"cancelar" }  -> não renova mais
//   POST /api/stripe/subscricao { acao:"reativar" }  -> volta a renovar
//
// ---------------------------------------------------------------------------
// CANCELAR NÃO É PERDER O ACESSO
//
// Cancelar apenas desliga a renovação. A pessoa continua a jogar até ao fim do
// mês que já pagou — pagou-o, é dela. Só quando essa data chegar é que o acesso
// sai, e disso trata o webhook (ou, se ele falhar, a rota de expirar).
//
// É por isso que aqui não se toca em is_pro nem em is_pro_max. A tentação é
// grande e seria um erro: tirava o acesso no momento do clique a alguém que
// ainda tem três semanas pagas.
//
// ---------------------------------------------------------------------------
// DÁ PARA VOLTAR ATRÁS
//
// Enquanto o período pago não acabar, reativar é só voltar a ligar a renovação —
// nem sequer há nova cobrança, porque o ciclo nunca chegou a fechar. Quem
// cancela por engano, ou muda de ideias na mesma semana, resolve num clique em
// vez de subscrever de novo.
//
// O estado vem da Stripe e não da nossa tabela: é ela quem sabe a verdade sobre
// datas e renovações, e ler daqui evita mostrar uma data desatualizada por causa
// de um webhook que se atrasou.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { stripeFetch, nivelDoPreco } from "@/lib/stripe";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface Assinatura {
  id: string;
  status: string;
  cancel_at_period_end?: boolean;
  current_period_end?: number;
  trial_end?: number | null;
  items?: { data: { price?: { id?: string } }[] };
}

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

export async function GET(req: Request) {
  if (!supabaseAdmin) return NextResponse.json({ ok: false }, { status: 500 });

  const uid = await uidDoPedido(req);
  if (!uid) return NextResponse.json({ ok: false, erro: "Entra na tua conta." }, { status: 401 });

  const { data: u } = await supabaseAdmin
    .from("users")
    .select("is_pro, is_pro_max, stripe_subscription_id, pro_expira_em, renova_automaticamente")
    .eq("id", uid)
    .maybeSingle();

  if (!u) return NextResponse.json({ ok: false, erro: "Conta não encontrada." }, { status: 404 });

  const base = {
    ok: true,
    ehPro: !!u.is_pro,
    ehProMax: !!u.is_pro_max,
    // Acesso dado à mão, sem passar pela Stripe: contas de teste, ofertas.
    // Não há nada para gerir, e o ecrã tem de saber para não mostrar botões
    // de cancelamento que não fariam nada.
    gerivel: !!u.stripe_subscription_id,
    expiraEm: u.pro_expira_em ?? null,
    renova: u.renova_automaticamente !== false,
    emTeste: false,
    estado: u.is_pro ? "ativa" : "sem",
  };

  if (!u.stripe_subscription_id) return NextResponse.json(base);

  try {
    const sub = await stripeFetch<Assinatura>(`subscriptions/${u.stripe_subscription_id}`);
    const nivel = nivelDoPreco(sub.items?.data?.[0]?.price?.id);
    return NextResponse.json({
      ...base,
      estado: sub.status,
      emTeste: sub.status === "trialing",
      renova: !sub.cancel_at_period_end,
      expiraEm: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : base.expiraEm,
      fimDoTeste: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
      nivel,
    });
  } catch {
    // A Stripe não respondeu: devolve-se o que a nossa tabela sabe, em vez de
    // um erro. A pessoa vê o plano dela, ainda que a data possa estar velha.
    return NextResponse.json(base);
  }
}

export async function POST(req: Request) {
  if (!supabaseAdmin) return NextResponse.json({ ok: false }, { status: 500 });

  const uid = await uidDoPedido(req);
  if (!uid) return NextResponse.json({ ok: false, erro: "Entra na tua conta." }, { status: 401 });

  let corpo: { acao?: string };
  try { corpo = await req.json(); } catch {
    return NextResponse.json({ ok: false, erro: "Pedido inválido." }, { status: 400 });
  }

  const acao = String(corpo.acao || "");
  if (!["cancelar", "reativar"].includes(acao)) {
    return NextResponse.json({ ok: false, erro: "Ação desconhecida." }, { status: 400 });
  }

  const { data: u } = await supabaseAdmin
    .from("users").select("stripe_subscription_id").eq("id", uid).maybeSingle();

  if (!u?.stripe_subscription_id) {
    return NextResponse.json({ ok: false, erro: "Não há subscrição para gerir." }, { status: 409 });
  }

  try {
    const sub = await stripeFetch<Assinatura>(`subscriptions/${u.stripe_subscription_id}`, "POST", {
      cancel_at_period_end: acao === "cancelar",
    });

    // Guarda-se o estado, mas NÃO o acesso: quem cancela joga até ao fim do mês
    // pago (ver a nota no topo).
    await supabaseAdmin.from("users").update({
      renova_automaticamente: acao !== "cancelar",
      cancelado_em: acao === "cancelar" ? new Date().toISOString() : null,
      pro_expira_em: sub.current_period_end
        ? new Date(sub.current_period_end * 1000).toISOString()
        : undefined,
    }).eq("id", uid);

    return NextResponse.json({
      ok: true,
      renova: acao !== "cancelar",
      expiraEm: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
    });
  } catch (e) {
    console.error("[stripe/subscricao]", e);
    return NextResponse.json({ ok: false, erro: "Não foi possível concluir. Tenta outra vez." }, { status: 500 });
  }
}
