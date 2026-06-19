// app/api/judogui/route.ts
//
// Cor do judogui do Dôdo (personalização Pro Max). Mesmo padrão do /api/tatame.
//
// GET  /api/judogui?user_id=...  -> { ok, judogui, is_pro_max }
// POST /api/judogui              -> grava { user_id, judogui }
//   só Pro Max pode gravar (verificado NO SERVIDOR, lê users.is_pro_max).
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const JUDOGUIS_VALIDOS = ["branco", "azul"];
const JUDOGUI_DEFAULT = "branco";

export async function GET(req: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ ok: false, erro: "Servidor sem ligação à base de dados." }, { status: 500 });
  }
  const { searchParams } = new URL(req.url);
  const user_id = (searchParams.get("user_id") || "").trim();
  if (!user_id) return NextResponse.json({ ok: true, judogui: JUDOGUI_DEFAULT, is_pro_max: false });

  const { data, error } = await supabaseAdmin
    .from("users")
    .select("judogui, is_pro_max")
    .eq("id", user_id)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ ok: false, erro: "Não foi possível ler a preferência." }, { status: 500 });
  }
  const judogui = JUDOGUIS_VALIDOS.includes(String(data?.judogui)) ? String(data?.judogui) : JUDOGUI_DEFAULT;
  return NextResponse.json({ ok: true, judogui, is_pro_max: Boolean(data?.is_pro_max) });
}

export async function POST(req: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ ok: false, erro: "Servidor sem ligação à base de dados." }, { status: 500 });
  }
  let corpo: { user_id?: string; judogui?: string };
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ ok: false, erro: "Pedido inválido." }, { status: 400 });
  }
  const user_id = (corpo.user_id || "").trim();
  const judogui = (corpo.judogui || "").trim();
  if (!user_id) return NextResponse.json({ ok: false, erro: "Sessão em falta." }, { status: 401 });
  if (!JUDOGUIS_VALIDOS.includes(judogui)) {
    return NextResponse.json({ ok: false, erro: "Cor de judogui inválida." }, { status: 400 });
  }

  const { data: u, error: errU } = await supabaseAdmin
    .from("users")
    .select("is_pro_max")
    .eq("id", user_id)
    .maybeSingle();
  if (errU) {
    return NextResponse.json({ ok: false, erro: "Não foi possível verificar o plano." }, { status: 500 });
  }
  if (!u?.is_pro_max) {
    return NextResponse.json({ ok: false, erro: "A cor do judogui é exclusiva do Pro Max." }, { status: 403 });
  }

  const { error } = await supabaseAdmin
    .from("users")
    .update({ judogui })
    .eq("id", user_id);
  if (error) {
    return NextResponse.json({ ok: false, erro: "Não foi possível guardar." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, judogui });
}
