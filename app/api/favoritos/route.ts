// app/api/favoritos/route.ts
//
// ATLETAS FAVORITOS — lista e alterna (marca/desmarca) os favoritos de um
// utilizador. Segue o padrão do projeto: o cliente envia o user_id e o servidor
// usa supabaseAdmin (passa por cima do RLS). Por agora SEM bloqueio de plano —
// quando o Pro Max existir, é aqui (e na página) que se fecha o acesso.
//
// GET  /api/favoritos?user_id=...        -> { ok, favoritos: [{id_person, nome, country_code}] }
// POST /api/favoritos                    -> alterna um favorito
//   corpo: { user_id, id_person, nome?, country_code? }
//   devolve: { ok, favorito: true|false }   (estado APÓS a operação)
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ ok: false, erro: "Servidor sem ligação à base de dados." }, { status: 500 });
  }
  const { searchParams } = new URL(req.url);
  const user_id = (searchParams.get("user_id") || "").trim();
  if (!user_id) return NextResponse.json({ ok: true, favoritos: [] });

  const { data, error } = await supabaseAdmin
    .from("atletas_favoritos")
    .select("id_person, nome, country_code")
    .eq("user_id", user_id)
    .order("criado_em", { ascending: false });

  if (error) {
    return NextResponse.json({ ok: false, erro: "Não foi possível ler os favoritos." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, favoritos: data || [] });
}

export async function POST(req: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ ok: false, erro: "Servidor sem ligação à base de dados." }, { status: 500 });
  }

  let corpo: { user_id?: string; id_person?: string; nome?: string; country_code?: string };
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ ok: false, erro: "Pedido inválido." }, { status: 400 });
  }

  const user_id = (corpo.user_id || "").trim();
  const id_person = (corpo.id_person || "").trim();
  const nome = (corpo.nome || "").trim();
  const country_code = (corpo.country_code || "").trim().toUpperCase();

  if (!user_id) return NextResponse.json({ ok: false, erro: "Sessão em falta. Entra para guardar favoritos." }, { status: 401 });
  if (!id_person) return NextResponse.json({ ok: false, erro: "Atleta em falta." }, { status: 400 });

  // Já é favorito? Então desmarca.
  const { data: existe } = await supabaseAdmin
    .from("atletas_favoritos")
    .select("id")
    .eq("user_id", user_id)
    .eq("id_person", id_person)
    .maybeSingle();

  if (existe) {
    const { error } = await supabaseAdmin
      .from("atletas_favoritos")
      .delete()
      .eq("user_id", user_id)
      .eq("id_person", id_person);
    if (error) return NextResponse.json({ ok: false, erro: "Não foi possível remover o favorito." }, { status: 500 });
    return NextResponse.json({ ok: true, favorito: false });
  }

  // Não era favorito: marca.
  const { error } = await supabaseAdmin
    .from("atletas_favoritos")
    .insert({ user_id, id_person, nome: nome || null, country_code: country_code || null });
  if (error) {
    return NextResponse.json({ ok: false, erro: "Não foi possível guardar o favorito." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, favorito: true });
}
