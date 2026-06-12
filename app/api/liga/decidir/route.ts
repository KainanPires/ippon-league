// app/api/liga/decidir/route.ts
//
// APROVAR OU RECUSAR UM PEDIDO DE ENTRADA (servidor, chave secreta).
//
// Só o DONO da liga pode decidir. Recebe (POST):
//   { user_id, request_id, acao }   acao = "aprovar" | "recusar"
// Faz:
//   - aprovar  → marca o pedido "aprovado" e mete a pessoa em league_members
//   - recusar  → marca o pedido "recusado"
// Devolve: { ok:true, acao } ou { ok:false, erro }
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ ok: false, erro: "Servidor sem ligação." }, { status: 500 });
  }

  let corpo: { user_id?: string; request_id?: string; acao?: string };
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ ok: false, erro: "Pedido inválido." }, { status: 400 });
  }

  const user_id = (corpo.user_id || "").trim();
  const request_id = (corpo.request_id || "").trim();
  const acao = (corpo.acao || "").trim();
  if (!user_id || !request_id) return NextResponse.json({ ok: false, erro: "Faltam parâmetros." }, { status: 400 });
  if (acao !== "aprovar" && acao !== "recusar") {
    return NextResponse.json({ ok: false, erro: "Ação inválida." }, { status: 400 });
  }

  // 1) Lê o pedido.
  const { data: pedido } = await supabaseAdmin
    .from("league_requests")
    .select("id, league_id, user_id, estado")
    .eq("id", request_id)
    .maybeSingle();
  if (!pedido) return NextResponse.json({ ok: false, erro: "Pedido não encontrado." }, { status: 404 });

  // 2) Confirma que quem decide é o DONO da liga do pedido.
  const { data: liga } = await supabaseAdmin
    .from("leagues")
    .select("id, created_by")
    .eq("id", pedido.league_id)
    .maybeSingle();
  if (!liga) return NextResponse.json({ ok: false, erro: "Liga não encontrada." }, { status: 404 });
  if (liga.created_by !== user_id) {
    return NextResponse.json({ ok: false, erro: "Só o dono pode decidir." }, { status: 403 });
  }

  // 3) Se já foi decidido antes, não repete.
  if (pedido.estado !== "pendente") {
    return NextResponse.json({ ok: true, jaDecidido: true, acao: pedido.estado });
  }

  const agora = new Date().toISOString();

  // 4a) RECUSAR.
  if (acao === "recusar") {
    await supabaseAdmin
      .from("league_requests")
      .update({ estado: "recusado", decided_at: agora })
      .eq("id", request_id);
    return NextResponse.json({ ok: true, acao: "recusar" });
  }

  // 4b) APROVAR → mete na league_members (se ainda não estiver) e marca aprovado.
  const { data: jaMembro } = await supabaseAdmin
    .from("league_members")
    .select("id")
    .eq("league_id", pedido.league_id)
    .eq("user_id", pedido.user_id)
    .maybeSingle();

  if (!jaMembro) {
    const { error: erroMembro } = await supabaseAdmin
      .from("league_members")
      .insert({ league_id: pedido.league_id, user_id: pedido.user_id, score: 0, position: 0 });
    if (erroMembro) {
      return NextResponse.json({ ok: false, erro: "Não foi possível adicionar o membro." }, { status: 500 });
    }
  }

  await supabaseAdmin
    .from("league_requests")
    .update({ estado: "aprovado", decided_at: agora })
    .eq("id", request_id);

  return NextResponse.json({ ok: true, acao: "aprovar" });
}
