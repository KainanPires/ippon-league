// app/api/liga/pedidos/route.ts
//
// PEDIDOS PENDENTES DE UMA LIGA (servidor, chave secreta).
//
// Só o DONO da liga pode ver os pedidos. Recebe (GET):
//   ?league_id=<uuid>&user_id=<uuid do dono>
// Devolve:
//   { ok:true, pedidos: [{ request_id, user_id, nome, created_at }] }
//   { ok:false, erro }  se não for o dono ou a liga não existir
//
// O nome de cada candidato é lido do user_metadata do Auth (nome do registo).
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ ok: false, erro: "Servidor sem ligação." }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const league_id = (searchParams.get("league_id") || "").trim();
  const user_id = (searchParams.get("user_id") || "").trim();
  if (!league_id || !user_id) {
    return NextResponse.json({ ok: false, erro: "Faltam parâmetros." }, { status: 400 });
  }

  // 1) Confirma que quem pergunta é o DONO da liga.
  const { data: liga } = await supabaseAdmin
    .from("leagues")
    .select("id, created_by")
    .eq("id", league_id)
    .maybeSingle();
  if (!liga) return NextResponse.json({ ok: false, erro: "Liga não encontrada." }, { status: 404 });
  if (liga.created_by !== user_id) {
    return NextResponse.json({ ok: false, erro: "Só o dono vê os pedidos." }, { status: 403 });
  }

  // 2) Pedidos pendentes desta liga (mais antigos primeiro).
  const { data: pedidos } = await supabaseAdmin
    .from("league_requests")
    .select("id, user_id, created_at")
    .eq("league_id", league_id)
    .eq("estado", "pendente")
    .order("created_at", { ascending: true });

  const lista = pedidos || [];
  if (lista.length === 0) return NextResponse.json({ ok: true, pedidos: [] });

  // 3) Resolve o nome de cada candidato (do Auth).
  const saida = [];
  for (const p of lista) {
    let nome = "Jogador";
    try {
      const { data } = await supabaseAdmin.auth.admin.getUserById(p.user_id);
      const meta = data?.user?.user_metadata as { nome?: string } | undefined;
      const n = String(meta?.nome || "").trim();
      if (n) nome = n;
    } catch { /* mantém "Jogador" */ }
    saida.push({ request_id: p.id, user_id: p.user_id, nome, created_at: p.created_at });
  }

  return NextResponse.json({ ok: true, pedidos: saida });
}
