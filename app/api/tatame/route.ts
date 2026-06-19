// app/api/tatame/route.ts
//
// Cor do tatame (personalização Pro Max). Segue o padrão do projeto: o cliente
// envia o user_id e o servidor usa supabaseAdmin (passa por cima do RLS).
//
// GET  /api/tatame?user_id=...   -> { ok, tatame, is_pro_max }
// POST /api/tatame               -> grava a escolha
//   corpo: { user_id, tatame }
//   devolve: { ok, tatame } | 403 se não for Pro Max | 400 se tema inválido
//
// BLOQUEIO: só Pro Max pode gravar. Verificado NO SERVIDOR (lê users.is_pro_max),
// para ninguém contornar pelo cliente.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Ids válidos (espelho de lib/tatames.ts — o servidor não importa libs de UI).
const TATAMES_VALIDOS = ["amarelo_azul", "amarelo_vermelho", "azul_vermelho", "amarelo_verde", "verde_vermelho"];
const TATAME_DEFAULT = "amarelo_azul";

export async function GET(req: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ ok: false, erro: "Servidor sem ligação à base de dados." }, { status: 500 });
  }
  const { searchParams } = new URL(req.url);
  const user_id = (searchParams.get("user_id") || "").trim();
  if (!user_id) return NextResponse.json({ ok: true, tatame: TATAME_DEFAULT, is_pro_max: false });

  const { data, error } = await supabaseAdmin
    .from("users")
    .select("tatame, is_pro_max")
    .eq("id", user_id)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ ok: false, erro: "Não foi possível ler a preferência." }, { status: 500 });
  }
  const tatame = TATAMES_VALIDOS.includes(String(data?.tatame)) ? String(data?.tatame) : TATAME_DEFAULT;
  return NextResponse.json({ ok: true, tatame, is_pro_max: Boolean(data?.is_pro_max) });
}

export async function POST(req: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ ok: false, erro: "Servidor sem ligação à base de dados." }, { status: 500 });
  }
  let corpo: { user_id?: string; tatame?: string };
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ ok: false, erro: "Pedido inválido." }, { status: 400 });
  }
  const user_id = (corpo.user_id || "").trim();
  const tatame = (corpo.tatame || "").trim();
  if (!user_id) return NextResponse.json({ ok: false, erro: "Sessão em falta." }, { status: 401 });
  if (!TATAMES_VALIDOS.includes(tatame)) {
    return NextResponse.json({ ok: false, erro: "Tema de tatame inválido." }, { status: 400 });
  }

  // BLOQUEIO: confirma que é Pro Max (fonte de verdade: users.is_pro_max).
  const { data: u, error: errU } = await supabaseAdmin
    .from("users")
    .select("is_pro_max")
    .eq("id", user_id)
    .maybeSingle();
  if (errU) {
    return NextResponse.json({ ok: false, erro: "Não foi possível verificar o plano." }, { status: 500 });
  }
  if (!u?.is_pro_max) {
    return NextResponse.json({ ok: false, erro: "A cor do tatame é exclusiva do Pro Max." }, { status: 403 });
  }

  const { error } = await supabaseAdmin
    .from("users")
    .update({ tatame })
    .eq("id", user_id);
  if (error) {
    return NextResponse.json({ ok: false, erro: "Não foi possível guardar." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, tatame });
}
