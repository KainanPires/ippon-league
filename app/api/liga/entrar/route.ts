// app/api/liga/entrar/route.ts
//
// ENTRAR NUMA LIGA por código de convite (servidor, chave secreta).
//
// Recebe (POST): { user_id, codigo }
// Faz: encontra a liga pelo invite_code, e mete o utilizador na league_members
//      (se ainda não estiver lá).
// Devolve: { ok, liga } ou { ok:false, erro }
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ ok: false, erro: "Servidor sem ligação à base de dados." }, { status: 500 });
  }

  let corpo: { user_id?: string; codigo?: string };
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ ok: false, erro: "Pedido inválido." }, { status: 400 });
  }

  const user_id = (corpo.user_id || "").trim();
  const codigo = (corpo.codigo || "").trim().toUpperCase();

  if (!user_id) return NextResponse.json({ ok: false, erro: "Entra para te juntares a uma liga." }, { status: 401 });
  if (codigo.length < 4) return NextResponse.json({ ok: false, erro: "Código inválido." }, { status: 400 });

  // 1) Encontra a liga pelo código.
  const { data: liga, error: erroLiga } = await supabaseAdmin
    .from("leagues")
    .select("id, name, type, formato, privacidade, descricao, escudo, invite_code")
    .eq("invite_code", codigo)
    .maybeSingle();

  if (erroLiga || !liga) {
    return NextResponse.json({ ok: false, erro: "Não encontrámos nenhuma liga com esse código." }, { status: 404 });
  }

  // 2) Já é membro? Então não duplica — devolve sucesso na mesma.
  const { data: jaMembro } = await supabaseAdmin
    .from("league_members")
    .select("id")
    .eq("league_id", liga.id)
    .eq("user_id", user_id)
    .maybeSingle();

  if (jaMembro) {
    return NextResponse.json({ ok: true, jaEra: true, liga });
  }

  // 3) Adiciona como membro.
  const { error: erroMembro } = await supabaseAdmin
    .from("league_members")
    .insert({ league_id: liga.id, user_id, score: 0, position: 0 });

  if (erroMembro) {
    return NextResponse.json({ ok: false, erro: "Não foi possível entrar na liga.", detalhe: erroMembro.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, liga });
}
