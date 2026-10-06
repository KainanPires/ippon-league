// app/api/liga/resolver/route.ts
//
// RESOLVER O EXCESSO DE LIGAS DE AMIGOS APÓS UM DOWNGRADE.
//
// Quando alguém desce de nível (deixa de ser Pro/Pro Max) e fica ACIMA do
// limite de ligas de amigos, escolhe no ecrã /resolver-ligas quais manter; esta
// rota remove-a das restantes. Identidade pelo TOKEN, nunca pelo corpo.
//
// Só funciona se a pessoa estiver MESMO acima do limite — senão seria um
// backdoor para abandonar uma copa a meio (o /api/liga/sair proíbe isso). Como
// aqui é um downgrade forçado (decidido com o Kainan), remove mesmo copas a
// decorrer: quem desce escolhe o que fica, o resto sai já.
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { LIMITES } from "@/lib/planos";

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

export async function POST(req: Request) {
  if (!supabaseAdmin) return NextResponse.json({ ok: false, erro: "Servidor sem ligação." }, { status: 500 });

  const uid = await uidDoPedido(req);
  if (!uid) return NextResponse.json({ ok: false, erro: "Entra na tua conta." }, { status: 401 });

  let corpo: { manter?: string[] } = {};
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ ok: false, erro: "Pedido inválido." }, { status: 400 });
  }
  const manter = new Set((Array.isArray(corpo.manter) ? corpo.manter : []).map((x) => String(x)));

  // Nível atual (da tabela users, nunca do corpo).
  const { data: u } = await supabaseAdmin.from("users").select("is_pro, is_pro_max").eq("id", uid).maybeSingle();
  const nivel: "gratis" | "pro" | "promax" = u?.is_pro_max ? "promax" : u?.is_pro ? "pro" : "gratis";
  const lim = LIMITES[nivel];

  // Ligas de amigos ATIVAS da pessoa (oficiais e terminadas não contam).
  const { data: filiacoes } = await supabaseAdmin.from("league_members").select("league_id").eq("user_id", uid);
  const ids = (filiacoes || []).map((f) => f.league_id);
  if (ids.length === 0) return NextResponse.json({ ok: true, saiu: 0 });
  const { data: ligas } = await supabaseAdmin
    .from("leagues")
    .select("id, formato, estado, copa_estado")
    .in("id", ids)
    .eq("type", "amigos");
  const ativas = (ligas || []).filter((l) =>
    String(l.formato) === "copa" ? String(l.copa_estado) !== "terminada" : String(l.estado) !== "terminada"
  );

  const pontos = ativas.filter((l) => String(l.formato) !== "copa").map((l) => String(l.id));
  const copa = ativas.filter((l) => String(l.formato) === "copa").map((l) => String(l.id));

  // Só resolve se estiver MESMO acima do limite (senão, backdoor para abandonar copa).
  if (pontos.length <= lim.pontos && copa.length <= lim.copa) {
    return NextResponse.json({ ok: false, erro: "Não estás acima do limite — nada a resolver." }, { status: 400 });
  }
  // Não pode manter mais do que o limite permite em cada formato.
  const manterPontos = pontos.filter((id) => manter.has(id)).length;
  const manterCopa = copa.filter((id) => manter.has(id)).length;
  if (manterPontos > lim.pontos || manterCopa > lim.copa) {
    return NextResponse.json({ ok: false, erro: "Escolheste mais ligas do que o teu limite permite." }, { status: 400 });
  }

  // Sai de todas as ligas de amigos ativas que NÃO escolheu manter.
  const sair = ativas.map((l) => String(l.id)).filter((id) => !manter.has(id));
  let saiu = 0;
  for (const league_id of sair) {
    const { error } = await supabaseAdmin.from("league_members").delete().eq("league_id", league_id).eq("user_id", uid);
    if (!error) saiu++;
    try {
      await supabaseAdmin.from("league_requests").delete().eq("league_id", league_id).eq("user_id", uid);
    } catch { /* pedido pendente órfão: não bloqueia */ }
  }

  return NextResponse.json({ ok: true, saiu });
}
