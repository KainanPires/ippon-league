// app/api/atribuicao/route.ts
//
// Fase D (caminho B) — escreve a ORIGEM do jogador na sua conta, logo após o
// registo. Não toca no trigger que cria a conta: é um ajudante separado.
//
// IDENTIDADE PELO TOKEN (nunca pelo corpo): o uid vem do token da sessão, como
// nas rotas /api/reivindicar e /api/chaveamento. Assim ninguém escreve origem
// na conta de outra pessoa.
//
// FIRST-TOUCH é imutável: só se grava se a conta ainda não tiver `first_seen_at`.
// LAST-TOUCH atualiza sempre. referred_by grava-se uma vez (se vier um ?ref=).
//
//   POST /api/atribuicao   { first, last }   (Authorization: Bearer <token>)
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface Toque {
  utm_source?: string; utm_medium?: string; utm_campaign?: string;
  utm_content?: string; utm_term?: string; ref?: string; referrer?: string; ts?: string;
}

// Confirma a sessão pelo token e devolve o uid, ou null.
async function uidDoPedido(req: Request): Promise<string | null> {
  try {
    const auth = req.headers.get("authorization") || "";
    const tok = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
    if (!tok) return null;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const pub = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
    if (!url || !pub) return null;
    const sb = createClient(url, pub, {
      global: { headers: { Authorization: `Bearer ${tok}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await sb.auth.getUser();
    if (error || !data?.user?.id) return null;
    return data.user.id;
  } catch {
    return null;
  }
}

const str = (v: unknown): string | null => {
  const s = String(v ?? "").trim();
  return s ? s.slice(0, 300) : null; // limita tamanho; vazio -> null
};

export async function POST(req: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ ok: false, erro: "Servidor sem ligação." }, { status: 500 });
  }
  const uid = await uidDoPedido(req);
  if (!uid) return NextResponse.json({ ok: false, erro: "Não autorizado." }, { status: 401 });

  let body: { first?: Toque | null; last?: Toque | null };
  try { body = await req.json(); } catch {
    return NextResponse.json({ ok: false, erro: "Pedido inválido." }, { status: 400 });
  }
  const first = body.first || {};
  const last = body.last || body.first || {}; // se não houve last-touch, usa o first

  // Estado atual: o first-touch é imutável, por isso só se escreve se ainda não
  // existir. Lê-se o mínimo.
  const { data: row } = await supabaseAdmin
    .from("users")
    .select("first_seen_at, referred_by")
    .eq("id", uid)
    .maybeSingle();

  const update: Record<string, string | null> = {
    // LAST-TOUCH — sempre.
    last_utm_source: str(last.utm_source),
    last_utm_medium: str(last.utm_medium),
    last_utm_campaign: str(last.utm_campaign),
    last_utm_content: str(last.utm_content),
    last_utm_term: str(last.utm_term),
    last_referrer: str(last.referrer),
  };

  // FIRST-TOUCH — só na primeira vez (conta ainda sem first_seen_at).
  if (!row?.first_seen_at) {
    update.first_utm_source = str(first.utm_source);
    update.first_utm_medium = str(first.utm_medium);
    update.first_utm_campaign = str(first.utm_campaign);
    update.first_utm_content = str(first.utm_content);
    update.first_utm_term = str(first.utm_term);
    update.first_referrer = str(first.referrer);
    update.first_seen_at = str(first.ts) || new Date().toISOString();
  }

  // referred_by — grava uma vez, se veio um ?ref= (do first, senão do last).
  if (!row?.referred_by) {
    const ref = str(first.ref) || str(last.ref);
    if (ref) update.referred_by = ref;
  }

  const { error } = await supabaseAdmin.from("users").update(update).eq("id", uid);
  if (error) {
    return NextResponse.json({ ok: false, erro: "Não foi possível gravar a origem." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
