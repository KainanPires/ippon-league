// app/api/stripe/checkout/route.ts
//
// ABRIR UMA SESSÃO DE PAGAMENTO.
//
//   POST /api/stripe/checkout  { alvo: "pro" | "promax" | "subida" }
//   -> { ok: true, url: "https://checkout.stripe.com/..." }
//
// A app manda a pessoa para essa morada. A Stripe trata do cartão, do IVA e do
// período de teste, e devolve-a a /perfil no fim. Quem dá o acesso NÃO é este
// ficheiro — é o webhook, quando a Stripe confirmar que o dinheiro entrou.
//
// ---------------------------------------------------------------------------
// PORQUE É QUE O ACESSO NÃO É DADO AQUI
//
// Seria mais simples marcar is_pro logo a seguir a criar a sessão. Mas criar
// uma sessão não é pagar: a pessoa pode fechar a janela, o cartão pode ser
// recusado, pode desistir no ecrã do banco. Dar o acesso aqui era dá-lo a quem
// carregou no botão, não a quem pagou.
//
// ---------------------------------------------------------------------------
// OS TRÊS CAMINHOS
//
//   pro / promax  — subscrição nova, com DIAS_TESTE dias grátis para quem nunca
//                   subscreveu. Quem já subscreveu antes não recebe teste outra
//                   vez, senão bastava cancelar e voltar para ter semanas
//                   grátis em ciclo.
//
//   subida        — quem já tem Pro e quer Pro Max. Dentro do período de teste
//                   é só trocar o preço da subscrição, sem cobrar nada: ainda
//                   não houve primeira cobrança. Fora dele, cobra-se uma vez os
//                   4,99 e a subscrição passa a Pro Max sem proporcionalidade —
//                   o próximo ciclo já vem a 11,99.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { PRECOS, CUPOES, DIAS_TESTE, stripeFetch } from "@/lib/stripe";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SITE = "https://www.ipponleague.com";

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
  if (!supabaseAdmin) {
    return NextResponse.json({ ok: false, erro: "Servidor sem ligação." }, { status: 500 });
  }

  const uid = await uidDoPedido(req);
  if (!uid) return NextResponse.json({ ok: false, erro: "Entra na tua conta." }, { status: 401 });

  let corpo: { alvo?: string };
  try { corpo = await req.json(); } catch {
    return NextResponse.json({ ok: false, erro: "Pedido inválido." }, { status: 400 });
  }

  const alvo = String(corpo.alvo || "");
  if (!["pro", "promax", "subida"].includes(alvo)) {
    return NextResponse.json({ ok: false, erro: "Nível desconhecido." }, { status: 400 });
  }

  const { data: u } = await supabaseAdmin
    .from("users")
    .select("email, name, is_pro, is_pro_max, stripe_customer_id, stripe_subscription_id")
    .eq("id", uid)
    .maybeSingle();

  if (!u) return NextResponse.json({ ok: false, erro: "Conta não encontrada." }, { status: 404 });

  try {
    // --- O cliente na Stripe ---
    // Criado uma vez e guardado. Sem isto, cada subscrição criava um cliente
    // novo e o histórico da pessoa ficava espalhado por várias fichas.
    let customer = u.stripe_customer_id ? String(u.stripe_customer_id) : "";
    if (!customer) {
      const c = await stripeFetch<{ id: string }>("customers", "POST", {
        email: u.email || undefined,
        name: u.name || undefined,
        metadata: { user_id: uid },
      });
      customer = c.id;
      await supabaseAdmin.from("users").update({ stripe_customer_id: customer }).eq("id", uid);
    }

    // --- SUBIDA DE PRO PARA PRO MAX ---
    if (alvo === "subida") {
      if (!u.is_pro || u.is_pro_max) {
        return NextResponse.json({ ok: false, erro: "Isto é só para quem tem Pro e ainda não tem Pro Max." }, { status: 409 });
      }
      if (!u.stripe_subscription_id) {
        return NextResponse.json({ ok: false, erro: "Não encontrámos a tua subscrição." }, { status: 409 });
      }

      const sub = await stripeFetch<{
        status: string;
        items: { data: { id: string }[] };
      }>(`subscriptions/${u.stripe_subscription_id}`);

      // Dentro do teste ainda não houve cobrança nenhuma: troca-se o preço e
      // acabou. Não há nada para acertar, nem 4,99 a cobrar — é o prémio de
      // decidir cedo.
      if (sub.status === "trialing") {
        await stripeFetch(`subscriptions/${u.stripe_subscription_id}`, "POST", {
          items: [{ id: sub.items.data[0].id, price: PRECOS.promax }],
          proration_behavior: "none",
          metadata: { user_id: uid, nivel: "promax" },
        });
        return NextResponse.json({ ok: true, imediato: true });
      }

      // Fora do teste: cobra-se a subida uma única vez. A troca da subscrição
      // para Pro Max acontece no webhook, quando o pagamento estiver confirmado.
      const sessao = await stripeFetch<{ url: string }>("checkout/sessions", "POST", {
        mode: "payment",
        customer,
        line_items: [{ price: PRECOS.subida, quantity: 1 }],
        success_url: `${SITE}/perfil?pagamento=ok`,
        cancel_url: `${SITE}/perfil?pagamento=cancelado`,
        client_reference_id: uid,
        allow_promotion_codes: true,
        metadata: { user_id: uid, acao: "subida" },
      });
      return NextResponse.json({ ok: true, url: sessao.url });
    }

    // --- SUBSCRIÇÃO NOVA ---
    if (u.is_pro || u.is_pro_max) {
      return NextResponse.json({ ok: false, erro: "Já tens uma subscrição ativa." }, { status: 409 });
    }

    // Teste grátis só para quem nunca subscreveu. Quem já teve subscrição —
    // mesmo cancelada — não recebe outra semana grátis, senão bastava cancelar
    // e voltar a subscrever para nunca pagar.
    const jaTeve = !!u.stripe_subscription_id;
    const preco = alvo === "promax" ? PRECOS.promax : PRECOS.pro;
    const cupao = alvo === "promax" ? CUPOES.promax : CUPOES.pro;

    const base: Record<string, unknown> = {
      mode: "subscription",
      customer,
      line_items: [{ price: preco, quantity: 1 }],
      success_url: `${SITE}/perfil?pagamento=ok`,
      cancel_url: `${SITE}/ippon-pro?pagamento=cancelado`,
      client_reference_id: uid,
      subscription_data: {
        trial_period_days: jaTeve ? undefined : DIAS_TESTE,
        metadata: { user_id: uid, nivel: alvo },
      },
      metadata: { user_id: uid, nivel: alvo },
    };

    // --- O DESCONTO DE LANÇAMENTO, AUTOMÁTICO ---
    //
    // Tenta-se com o cupão colado. Se a Stripe o recusar — porque a data limite
    // já passou, ou porque o cupão foi apagado — tenta-se outra vez sem ele.
    //
    // É de propósito que a data da promoção vive SÓ na Stripe. Se estivesse
    // também aqui, seriam dois sítios a ter de concordar, e no dia em que
    // divergissem a app deixava de conseguir vender: pediria um cupão que já
    // não é aceite e a sessão nunca abriria. Assim o pior que acontece é o
    // primeiro pedido depois do fim da promoção demorar mais um instante.
    //
    // Repara que `allow_promotion_codes` NÃO pode conviver com um desconto já
    // aplicado — a Stripe recusa as duas coisas juntas. Por isso o campo para
    // escrever códigos só aparece quando não há cupão automático.
    let sessao: { url: string };
    try {
      sessao = await stripeFetch<{ url: string }>("checkout/sessions", "POST", {
        ...base,
        discounts: [{ coupon: cupao }],
      });
    } catch (eCupao) {
      console.warn("[stripe/checkout] cupão recusado, a seguir sem desconto:", eCupao);
      sessao = await stripeFetch<{ url: string }>("checkout/sessions", "POST", {
        ...base,
        allow_promotion_codes: true,
      });
    }

    return NextResponse.json({ ok: true, url: sessao.url });
  } catch (e) {
    // A mensagem da Stripe é útil nos registos, mas não vai para o ecrã: pode
    // conter detalhes da conta que não interessam a quem está do outro lado.
    console.error("[stripe/checkout]", e);
    return NextResponse.json({ ok: false, erro: "Não foi possível abrir o pagamento. Tenta outra vez." }, { status: 500 });
  }
}
