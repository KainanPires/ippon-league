// app/api/liga/mercado/route.ts
//
// MERCADO DE LIGAS (servidor, chave secreta).
//
// Lista as ligas ABERTAS (privacidade = "aberta") — as únicas que aparecem
// publicamente. As "fechadas" só se acede por código, por isso NÃO entram aqui.
//
// Recebe (GET): ?user_id=<uuid>  (opcional — para saber em quais já está)
// Devolve: { ligas: [{ id, name, formato, privacidade, escudo, invite_code,
//                       membros, sou_membro, sou_dono }] }
//
// Nota de filtro: as ligas de amigos são gravadas com scope="privada" mesmo
// quando a privacidade é "aberta". Por isso filtramos por `privacidade`, não
// por `scope`.
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

  // 1) Todas as ligas abertas (as mais recentes primeiro).
  const { data: ligas, error } = await supabaseAdmin
    .from("leagues")
    .select("id, name, formato, privacidade, descricao, escudo, invite_code, created_by, created_at")
    .eq("privacidade", "aberta")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ ligas: [], erro: "Não foi possível carregar o mercado." }, { status: 500 });
  }
  const lista = ligas || [];
  if (lista.length === 0) return NextResponse.json({ ligas: [] });

  const ligaIds = lista.map((l) => l.id);

  // 2) Nº de membros de cada liga (uma contagem por liga).
  const contagens: Record<string, number> = {};
  for (const id of ligaIds) {
    const { count } = await supabaseAdmin
      .from("league_members")
      .select("id", { count: "exact", head: true })
      .eq("league_id", id);
    contagens[id] = count ?? 0;
  }

  // 3) Em quais é que ESTE utilizador já está (para mostrar "Abrir" em vez de "Entrar").
  const meusIds = new Set<string>();
  if (user_id) {
    const { data: filiacoes } = await supabaseAdmin
      .from("league_members")
      .select("league_id")
      .eq("user_id", user_id)
      .in("league_id", ligaIds);
    for (const f of filiacoes || []) meusIds.add(f.league_id);
  }

  const saida = lista.map((l) => ({
    id: l.id,
    name: l.name,
    formato: l.formato,
    privacidade: l.privacidade,
    descricao: l.descricao,
    escudo: l.escudo,
    invite_code: l.invite_code,
    membros: contagens[l.id] ?? 1,
    sou_membro: meusIds.has(l.id),
    sou_dono: l.created_by === user_id,
  }));

  return NextResponse.json({ ligas: saida });
}
