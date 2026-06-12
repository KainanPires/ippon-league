// app/api/liga/pedir/route.ts
//
// PEDIR ENTRADA NUMA LIGA (servidor, chave secreta).
//
// Recebe (POST): { user_id, codigo }
// Comportamento conforme a privacidade da liga:
//   - "aberta"          → entra já como membro (atalho; igual ao /entrar)
//   - "mediante_pedido" → cria um pedido PENDENTE em league_requests
//   - "fechada"         → não se pede pelo mercado; só por código (esta rota
//                         não deixa pedir uma fechada — devolve erro claro)
// Devolve:
//   { ok:true, entrou:true, liga }       quando entrou direto (aberta)
//   { ok:true, pedido:true }             quando ficou um pedido pendente
//   { ok:true, jaEra:true, liga }        quando já era membro
//   { ok:true, jaPediu:true }            quando já tinha pedido pendente
//   { ok:false, erro }                   caso contrário
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const LIMITE_AMIGOS_FREE = 2;

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

// Verifica o limite de ligas de amigos para quem não é Pro.
// Devolve uma mensagem de erro se bateu no limite, ou null se pode avançar.
async function bloqueioPorLimite(user_id: string): Promise<string | null> {
  const pro = await ehPro(user_id);
  if (pro) return null;
  const quantas = await contarLigasAmigos(user_id);
  if (quantas >= LIMITE_AMIGOS_FREE) {
    return "Já estás em 2 ligas de amigos. Passa a Ippon Pro para entrares em ligas ilimitadas.";
  }
  return null;
}

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

  // 2) Já é membro? Não duplica.
  const { data: jaMembro } = await supabaseAdmin
    .from("league_members")
    .select("id")
    .eq("league_id", liga.id)
    .eq("user_id", user_id)
    .maybeSingle();
  if (jaMembro) {
    return NextResponse.json({ ok: true, jaEra: true, liga });
  }

  // 3) Decide conforme a privacidade.
  const priv = String(liga.privacidade || "fechada");

  // 3a) ABERTA → entra direto (com verificação de limite).
  if (priv === "aberta") {
    if (liga.type === "amigos") {
      const bloqueio = await bloqueioPorLimite(user_id);
      if (bloqueio) return NextResponse.json({ ok: false, limite: true, erro: bloqueio }, { status: 403 });
    }
    const { error: erroMembro } = await supabaseAdmin
      .from("league_members")
      .insert({ league_id: liga.id, user_id, score: 0, position: 0 });
    if (erroMembro) {
      return NextResponse.json({ ok: false, erro: "Não foi possível entrar na liga." }, { status: 500 });
    }
    return NextResponse.json({ ok: true, entrou: true, liga });
  }

  // 3b) MEDIANTE PEDIDO → cria (ou confirma) um pedido pendente.
  if (priv === "mediante_pedido") {
    // Já tem pedido? Vê em que estado está.
    const { data: pedidoExistente } = await supabaseAdmin
      .from("league_requests")
      .select("id, estado")
      .eq("league_id", liga.id)
      .eq("user_id", user_id)
      .maybeSingle();

    if (pedidoExistente) {
      if (pedidoExistente.estado === "pendente") {
        return NextResponse.json({ ok: true, jaPediu: true });
      }
      if (pedidoExistente.estado === "recusado") {
        // Foi recusado antes: reabre o pedido (volta a pendente).
        await supabaseAdmin
          .from("league_requests")
          .update({ estado: "pendente", created_at: new Date().toISOString(), decided_at: null })
          .eq("id", pedidoExistente.id);
        return NextResponse.json({ ok: true, pedido: true });
      }
      // estado "aprovado" mas não é membro (caso raro): deixa pedir de novo.
    }

    const { error: erroPedido } = await supabaseAdmin
      .from("league_requests")
      .insert({ league_id: liga.id, user_id, estado: "pendente" });
    if (erroPedido) {
      return NextResponse.json({ ok: false, erro: "Não foi possível enviar o teu pedido." }, { status: 500 });
    }
    return NextResponse.json({ ok: true, pedido: true });
  }

  // 3c) FECHADA → não se entra/pede pelo mercado.
  return NextResponse.json({ ok: false, erro: "Esta liga é fechada." }, { status: 403 });
}
