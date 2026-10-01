// app/api/liga/transferir/route.ts
//
// PASSAR O BASTÃO — o dono de uma liga/copa de amigos transfere o papel de admin
// a outro MEMBRO. Identidade pelo TOKEN, nunca pelo corpo (mesmo padrão do
// /api/liga/decidir): só o dono atual pode transferir.
//
// POST { league_id, novo_admin_id }  (Authorization: Bearer <token>)
//
// Serve dois casos:
//   1) Handover voluntário (o dono quer que outro passe a gerir).
//   2) Manter a liga viva quando o dono vai perder o Pro: passa a um membro Pro.
//
// Por isso, quando a liga está ATIVA, exige-se que o novo admin seja Pro — é o
// Pro que sustenta a liga. Numa liga já terminada (só histórico) não se exige.
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { criarNotificacaoServidor } from "@/lib/notificacoesServidor";
import { registarAdminLog } from "@/lib/adminLog";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function uidDoPedido(req: Request): Promise<string | null> {
  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
    if (!token) return null;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const pub = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
    if (!url || !pub) return null;
    const sb = createClient(url, pub, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await sb.auth.getUser();
    if (error) return null;
    return data?.user?.id ?? null;
  } catch {
    return null;
  }
}

function terminada(l: { formato?: unknown; estado?: unknown; copa_estado?: unknown }): boolean {
  if (String(l.formato) === "copa") return String(l.copa_estado) === "terminada";
  return String(l.estado) === "terminada";
}

export async function POST(req: Request) {
  if (!supabaseAdmin) return NextResponse.json({ ok: false, erro: "Servidor sem ligação." }, { status: 500 });

  const uid = await uidDoPedido(req);
  if (!uid) return NextResponse.json({ ok: false, erro: "Entra na tua conta." }, { status: 401 });

  let corpo: { league_id?: string; novo_admin_id?: string };
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ ok: false, erro: "Pedido inválido." }, { status: 400 });
  }
  const league_id = (corpo.league_id || "").trim();
  const novo = (corpo.novo_admin_id || "").trim();
  if (!league_id || !novo) return NextResponse.json({ ok: false, erro: "Falta league_id ou novo_admin_id." }, { status: 400 });
  if (novo === uid) return NextResponse.json({ ok: false, erro: "Já és o admin desta liga." }, { status: 400 });

  // 1) A liga existe e quem pede é o DONO?
  const { data: liga } = await supabaseAdmin
    .from("leagues")
    .select("id, name, type, formato, estado, copa_estado, created_by")
    .eq("id", league_id)
    .maybeSingle();
  if (!liga) return NextResponse.json({ ok: false, erro: "Liga não encontrada." }, { status: 404 });
  if (String(liga.type) !== "amigos") return NextResponse.json({ ok: false, erro: "Só ligas de amigos têm admin transferível." }, { status: 400 });
  if (String(liga.created_by ?? "") !== uid) {
    return NextResponse.json({ ok: false, erro: "Só o admin pode passar o bastão." }, { status: 403 });
  }

  // 2) O novo admin é MEMBRO da liga?
  const { data: membro } = await supabaseAdmin
    .from("league_members").select("id").eq("league_id", league_id).eq("user_id", novo).maybeSingle();
  if (!membro) return NextResponse.json({ ok: false, erro: "Essa pessoa não está na liga." }, { status: 400 });

  // 3) Liga ATIVA: o novo admin tem de ser Pro (é o Pro que a sustenta).
  if (!terminada(liga)) {
    const { data: nu } = await supabaseAdmin
      .from("users").select("is_pro, is_pro_max").eq("id", novo).maybeSingle();
    if (!nu?.is_pro && !nu?.is_pro_max) {
      return NextResponse.json({ ok: false, erro: "O novo admin precisa de ter Ippon Pro para manter a liga." }, { status: 400 });
    }
  }

  // 4) Transfere.
  const { error } = await supabaseAdmin.from("leagues").update({ created_by: novo }).eq("id", league_id);
  if (error) return NextResponse.json({ ok: false, erro: "Não foi possível transferir." }, { status: 500 });

  // Auditoria (best-effort, helper próprio).
  await registarAdminLog({
    uid, email: null, acao: "liga_transferir",
    detalhe: { league_id, novo_admin_id: novo, nome: liga.name ?? null },
  });

  // Avisa o novo admin (best-effort).
  try {
    await criarNotificacaoServidor({
      paraUserId: novo,
      tipo: "liga_bastao",
      chaveTitulo: "liga.bastaoRecebidoTitulo",
      chaveCorpo: "liga.bastaoRecebidoCorpo",
      vars: { liga: liga.name ? String(liga.name) : "" },
      link: "/ligas",
    });
  } catch { /* aviso é extra */ }

  return NextResponse.json({ ok: true, league_id, novo_admin_id: novo });
}
