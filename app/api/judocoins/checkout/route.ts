// app/api/judocoins/checkout/route.ts
//
// ABRIR O PAGAMENTO DE UM PACOTE DE JUDOCOINS (compra avulsa).
//
// POST { jc: number }   (ex.: { jc: 50 })
// -> { ok: true, url: "https://checkout.stripe.com/..." }
//
// A app manda a pessoa para essa morada. Quem CREDITA os JC não é este ficheiro
// — é o webhook, quando a Stripe confirmar que o dinheiro entrou. Aqui só se
// abre o ecrã de pagamento. (Mesmo princípio do /api/stripe/checkout do Pro.)
//
// O preço encontra-se pela CHAVE DE PESQUISA (lookup key) `jc_<quantidade>` — a
// mesma em teste e em produção —, por isso o código não depende de price IDs que
// mudam entre os dois modos.
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { stripeFetch } from "@/lib/stripe";
import { pacotePorJc } from "@/lib/planos";
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

  let corpo: { jc?: number };
  try { corpo = await req.json(); } catch {
    return NextResponse.json({ ok: false, erro: "Pedido inválido." }, { status: 400 });
  }
  const pacote = pacotePorJc(Number(corpo.jc));
  if (!pacote) {
    return NextResponse.json({ ok: false, erro: "Pacote desconhecido." }, { status: 400 });
  }

  const { data: u } = await supabaseAdmin
    .from("users")
    .select("email, name, stripe_customer_id")
    .eq("id", uid)
    .maybeSingle();
  if (!u) return NextResponse.json({ ok: false, erro: "Conta não encontrada." }, { status: 404 });

  try {
    // O cliente na Stripe — criado uma vez e reutilizado, para o histórico da
    // pessoa não ficar espalhado por várias fichas.
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

    // Encontra o preço pela chave de pesquisa (funciona em teste e produção).
    const lista = await stripeFetch<{ data: { id: string }[] }>(
      `prices?lookup_keys[]=${encodeURIComponent(pacote.lookupKey)}&active=true&limit=1`,
      "GET",
    );
    const priceId = lista.data?.[0]?.id;
    if (!priceId) {
      console.error("[judocoins/checkout] sem preço para", pacote.lookupKey);
      return NextResponse.json({ ok: false, erro: "Este pacote está indisponível de momento." }, { status: 409 });
    }

    const sessao = await stripeFetch<{ url: string }>("checkout/sessions", "POST", {
        mode: "payment",
        customer,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${SITE}/loja?compra=ok`,
        cancel_url: `${SITE}/loja?compra=cancelada`,
        client_reference_id: uid,
        // O webhook lê estes campos para creditar: `tipo` distingue dos pagamentos
        // do Pro, `jc` diz quantos creditar (à prova de enganos).
        metadata: { user_id: uid, tipo: "judocoins", jc: String(pacote.jc) },
      });
    return NextResponse.json({ ok: true, url: sessao.url });
  } catch (e) {
    console.error("[judocoins/checkout]", e);
    return NextResponse.json({ ok: false, erro: "Não foi possível abrir o pagamento. Tenta outra vez." }, { status: 500 });
  }
}
