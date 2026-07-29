// app/api/judogui/route.ts
//
// Cor do judogui do Dôdo (personalização PRO). Mesmo padrão do /api/tatame.
//
// GET  /api/judogui?user_id=...  -> { ok, judogui, pode }
// POST /api/judogui              -> grava { user_id, judogui }
//   Pro e Pro Max podem gravar (verificado NO SERVIDOR, lê users).
//
// ---------------------------------------------------------------------------
// MUDOU DE NÍVEL: era exclusivo do Pro Max, passou a Pro (decisão do Kainan,
// 29/07). O TATAME continua exclusivo do Pro Max — são duas personalizações
// diferentes e é fácil confundi-las.
//
// E OS NÍVEIS SÃO CUMULATIVOS: Grátis ⊂ Pro ⊂ Pro Max. Uma funcionalidade Pro
// tem de aceitar `is_pro OU is_pro_max` — verificar só `is_pro` deixaria de fora
// quem paga mais. (Hoje a base garante que Pro Max implica Pro, mas o código não
// deve depender disso para estar correto.)
//
// O campo da resposta chama-se `pode`, não `is_pro_max`: assim o cliente não
// tem de saber que níveis existem, e mudar a regra outra vez não obriga a mexer
// na interface.
// ---------------------------------------------------------------------------
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
  if (!user_id) return NextResponse.json({ ok: true, judogui: JUDOGUI_DEFAULT, pode: false });
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("judogui, is_pro, is_pro_max")
    .eq("id", user_id)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ ok: false, erro: "Não foi possível ler a preferência." }, { status: 500 });
  }
  const judogui = JUDOGUIS_VALIDOS.includes(String(data?.judogui)) ? String(data?.judogui) : JUDOGUI_DEFAULT;
  // `pode` = tem pelo menos Pro. Cumulativo: o Pro Max também pode.
  const pode = Boolean(data?.is_pro) || Boolean(data?.is_pro_max);
  return NextResponse.json({ ok: true, judogui, pode });
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
    .select("is_pro, is_pro_max")
    .eq("id", user_id)
    .maybeSingle();
  if (errU) {
    return NextResponse.json({ ok: false, erro: "Não foi possível verificar o plano." }, { status: 500 });
  }
  // Pro OU Pro Max — nunca só `is_pro`, ver a nota no topo.
  if (!u?.is_pro && !u?.is_pro_max) {
    return NextResponse.json({ ok: false, erro: "A cor do judogui faz parte do Ippon Pro." }, { status: 403 });
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
