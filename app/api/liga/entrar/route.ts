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


async function contarLigasAmigos(user_id: string): Promise<number> {
  if (!supabaseAdmin) return 0;
  try {
    const { data: filiacoes } = await supabaseAdmin
      .from("league_members")
      .select("league_id")
      .eq("user_id", user_id);
    const ids = (filiacoes || []).map((f) => f.league_id);
    if (ids.length === 0) return 0;
    const { count } = await supabaseAdmin
      .from("leagues")
      .select("id", { count: "exact", head: true })
      .in("id", ids)
      .eq("type", "amigos");
    return count ?? 0;
  } catch {
    return 0;
  }
}

async function ehPro(user_id: string): Promise<boolean> {
  if (!supabaseAdmin) return false;
  try {
    const { data } = await supabaseAdmin.auth.admin.getUserById(user_id);
    const meta = data?.user?.user_metadata as { is_pro?: boolean } | undefined;
    return !!meta?.is_pro;
  } catch {
    return false;
  }
}

const LIMITE_AMIGOS_FREE = 2;

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

  // Limite: quem não é Pro só pode estar em 2 ligas de amigos (oficiais não contam).
  if (liga.type === "amigos") {
    const pro = await ehPro(user_id);
    if (!pro) {
      const quantas = await contarLigasAmigos(user_id);
      if (quantas >= LIMITE_AMIGOS_FREE) {
        return NextResponse.json({
          ok: false,
          limite: true,
          erro: "Já estás em 2 ligas de amigos. Passa a Ippon Pro para entrares em ligas ilimitadas.",
        }, { status: 403 });
      }
    }
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
