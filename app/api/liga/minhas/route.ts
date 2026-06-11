// app/api/liga/minhas/route.ts
//
// AS MINHAS LIGAS (servidor, chave secreta).
//
// Recebe (GET): ?user_id=<uuid>
// Devolve: as ligas onde este utilizador é membro, com dados para a lista
//          (nome, escudo, formato, privacidade, nº de membros).
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ ligas: [], erro: "Servidor sem ligação." }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const user_id = (searchParams.get("user_id") || "").trim();
  if (!user_id) return NextResponse.json({ ligas: [] });

  // 1) Em que ligas este utilizador está?
  const { data: filiacoes } = await supabaseAdmin
    .from("league_members")
    .select("league_id")
    .eq("user_id", user_id);

  const ids = (filiacoes || []).map((f) => f.league_id);
  if (ids.length === 0) return NextResponse.json({ ligas: [] });

  // 2) Dados dessas ligas.
  const { data: ligas } = await supabaseAdmin
    .from("leagues")
    .select("id, name, type, scope, formato, privacidade, descricao, escudo, invite_code, created_by, created_at")
    .in("id", ids);

  // 3) Quantos membros tem cada uma (uma contagem por liga).
  const contagens: Record<string, number> = {};
  for (const id of ids) {
    const { count } = await supabaseAdmin
      .from("league_members")
      .select("id", { count: "exact", head: true })
      .eq("league_id", id);
    contagens[id] = count ?? 0;
  }

  const saida = (ligas || []).map((l) => ({
    id: l.id,
    name: l.name,
    type: l.type,
    formato: l.formato,
    privacidade: l.privacidade,
    descricao: l.descricao,
    escudo: l.escudo,
    invite_code: l.invite_code,
    sou_dono: l.created_by === user_id,
    membros: contagens[l.id] ?? 1,
  }));

  return NextResponse.json({ ligas: saida });
}
