// app/api/consentimento-email/route.ts
//
// Grava o CONSENTIMENTO DE EMAIL DE MARKETING (opt-in) do utilizador.
//
// A identidade vem do TOKEN da sessão (não se confia num uid no corpo). O
// cliente não escreve na `users` por causa do RLS — por isso passa por aqui,
// com a chave de serviço. Mesmo padrão de /api/origem-declarada e /api/atribuicao.
//
// POST /api/consentimento-email   { aceita: boolean }
//   Authorization: Bearer <token da sessão>
//
// RGPD/GDPR: só governa emails de MARKETING (novidades/dicas/promoções). Os
// transacionais (verificação de email, avisos de rodada) não dependem disto.
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!supabaseAdmin) return NextResponse.json({ ok: false, erro: "Servidor sem ligação." }, { status: 500 });

  // Identidade pelo token da sessão.
  const auth = req.headers.get("authorization") || "";
  const tok = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  if (!tok) return NextResponse.json({ ok: false, erro: "Sem sessão." }, { status: 401 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const pub = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
  if (!url || !pub) return NextResponse.json({ ok: false, erro: "Servidor mal configurado." }, { status: 500 });

  const sb = createClient(url, pub, {
    global: { headers: { Authorization: `Bearer ${tok}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await sb.auth.getUser();
  if (error || !data?.user?.id) return NextResponse.json({ ok: false, erro: "Sem sessão." }, { status: 401 });

  let body: { aceita?: unknown };
  try { body = await req.json(); } catch { body = {}; }
  const aceita = body.aceita === true;

  const { error: upErr } = await supabaseAdmin
    .from("users")
    .update({ aceita_email_marketing: aceita })
    .eq("id", data.user.id);
  if (upErr) return NextResponse.json({ ok: false, erro: "Não foi possível gravar." }, { status: 500 });

  return NextResponse.json({ ok: true, aceita });
}
