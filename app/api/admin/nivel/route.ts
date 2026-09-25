// app/api/admin/nivel/route.ts
//
// ADMIN — dar/tirar Pro e Pro Max a uma conta (para criar conteúdo e testar).
//
// AUTORIZAÇÃO NO SERVIDOR (não é "esconder um botão"): a identidade vem do TOKEN
// da sessão e exige-se users.is_admin = true. Uma conta sem is_admin leva 401,
// mesmo que chegue ao endpoint a escrever o URL à mão. Mesmo padrão do
// is_chaveador (app/api/chaveamento).
//
// Esta é uma peça AUTORIZADA a mexer em is_pro/is_pro_max (além do lib/useNivel
// e do webhook da Stripe): uma ferramenta de admin, protegida no servidor.
// Escreve por OBJETO LITERAL na tabela `users` (nunca no user_metadata, que
// continua a não ser fonte de nível) — por isso não é o furo que o lint tranca.
//
//   GET  /api/admin/nivel                 -> { ok, admin:true }              (só confirma acesso)
//   GET  /api/admin/nivel?email=...       -> { ok, encontrado, email, nome, nivel }
//   POST /api/admin/nivel  { email, nivel }   nivel: "gratis" | "pro" | "promax"
//
// Authorization: Bearer <token da sessão>  (nos dois métodos).
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Confirma que quem pede é admin. Devolve o uid, ou null. */
async function adminDoPedido(req: Request): Promise<string | null> {
  try {
    const auth = req.headers.get("authorization") || "";
    const tok = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
    if (!tok) return null;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const pub = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
    if (!url || !pub || !supabaseAdmin) return null;
    const sb = createClient(url, pub, {
      global: { headers: { Authorization: `Bearer ${tok}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await sb.auth.getUser();
    if (error || !data?.user?.id) return null;
    const uid = data.user.id;
    const { data: u } = await supabaseAdmin.from("users").select("is_admin").eq("id", uid).maybeSingle();
    return u?.is_admin ? uid : null;
  } catch {
    return null;
  }
}

/** Nível legível a partir da linha da tabela users. */
function nivelDoRow(row: Record<string, unknown> | null | undefined): "gratis" | "pro" | "promax" {
  if (!row) return "gratis";
  if (row.is_pro_max) return "promax";
  if (row.is_pro) return "pro";
  return "gratis";
}

export async function GET(req: Request) {
  if (!supabaseAdmin) return NextResponse.json({ ok: false, erro: "Servidor sem ligação." }, { status: 500 });
  const uid = await adminDoPedido(req);
  if (!uid) return NextResponse.json({ ok: false, erro: "Não autorizado." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const email = (searchParams.get("email") || "").trim().toLowerCase();
  if (!email) return NextResponse.json({ ok: true, admin: true });

  const { data: row } = await supabaseAdmin
    .from("users")
    .select("id, email, name, is_pro, is_pro_max")
    .ilike("email", email)
    .maybeSingle();
  if (!row) return NextResponse.json({ ok: true, admin: true, encontrado: false, email });
  return NextResponse.json({
    ok: true,
    admin: true,
    encontrado: true,
    email: String(row.email || email),
    nome: row.name ? String(row.name) : null,
    nivel: nivelDoRow(row as Record<string, unknown>),
  });
}

export async function POST(req: Request) {
  if (!supabaseAdmin) return NextResponse.json({ ok: false, erro: "Servidor sem ligação." }, { status: 500 });
  const uid = await adminDoPedido(req);
  if (!uid) return NextResponse.json({ ok: false, erro: "Não autorizado." }, { status: 401 });

  let body: { email?: string; nivel?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, erro: "Pedido inválido." }, { status: 400 });
  }
  const email = String(body.email || "").trim().toLowerCase();
  const nivel = String(body.nivel || "").trim();
  if (!email) return NextResponse.json({ ok: false, erro: "Falta o email." }, { status: 400 });
  if (!["gratis", "pro", "promax"].includes(nivel)) {
    return NextResponse.json({ ok: false, erro: "nivel deve ser gratis, pro ou promax." }, { status: 400 });
  }

  const { data: row } = await supabaseAdmin
    .from("users")
    .select("id, email, name")
    .ilike("email", email)
    .maybeSingle();
  if (!row?.id) return NextResponse.json({ ok: false, erro: "Não há conta com esse email." }, { status: 404 });

  // Escrita por objeto literal na tabela (não no metadata). Cumulativo: promax
  // implica pro.
  const novo = { is_pro: nivel !== "gratis", is_pro_max: nivel === "promax" };
  const { error } = await supabaseAdmin.from("users").update(novo).eq("id", row.id);
  if (error) return NextResponse.json({ ok: false, erro: "Não foi possível gravar." }, { status: 500 });

  return NextResponse.json({
    ok: true,
    email: String(row.email || email),
    nome: row.name ? String(row.name) : null,
    nivel,
  });
}
