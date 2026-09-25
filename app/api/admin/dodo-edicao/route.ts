// app/api/admin/dodo-edicao/route.ts
//
// FERRAMENTA DE ADMIN (so admin): abre a 1a edicao da Copa do Dodo.
//
// As edicoes SEGUINTES abrem sozinhas (o sorteio da edicao atual abre a proxima
// no fim). So a PRIMEIRA precisa de ser criada a mao -- e e isto que esta rota
// faz: insere uma linha em dodo_edicoes com as inscricoes abertas.
//
// O que escreve: uma linha em dodo_edicoes { numero, ano, estado:"inscricoes",
// inscricoes_de: agora, inscricoes_ate: <data escolhida> }. Nada mais.
//
// A competicao onde a Copa ARRANCA nao e definida aqui: o sorteio (feito quando
// as inscricoes fecham) usa focoMercado().alvo nesse momento. Por isso o fecho
// das inscricoes deve cair enquanto o mercado da competicao de arranque ainda
// esta ABERTO (a vespera), para a 1a ronda ser essa competicao.
//
// SEGURANCA: so admin (Bearer -> users.is_admin), igual ao /api/admin/nivel.
//
// GET  /api/admin/dodo-edicao  -> pre-visualizacao (edicoes existentes, proximo numero)
// POST /api/admin/dodo-edicao  { inscricoes_ate, numero?, ano?, forcar? }
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function adminDoPedido(req: Request): Promise<{ uid: string } | null> {
  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
    if (!token) return null;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const pub = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
    if (!url || !pub || !supabaseAdmin) return null;
    const sb = createClient(url, pub, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await sb.auth.getUser();
    const uid = data?.user?.id;
    if (error || !uid) return null;
    const { data: row } = await supabaseAdmin.from("users").select("is_admin").eq("id", uid).maybeSingle();
    return row?.is_admin ? { uid } : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// GET -- pre-visualizacao (nao escreve nada).
// ---------------------------------------------------------------------------
export async function GET(req: Request) {
  if (!supabaseAdmin) return NextResponse.json({ ok: false, erro: "Servidor sem ligacao." }, { status: 500 });
  const admin = await adminDoPedido(req);
  if (!admin) return NextResponse.json({ ok: false, erro: "Nao autorizado." }, { status: 401 });

  const { data: edicoes } = await supabaseAdmin
    .from("dodo_edicoes")
    .select("id, numero, ano, estado, inscricoes_de, inscricoes_ate, league_id")
    .order("numero", { ascending: false })
    .limit(20);
  const lista = edicoes || [];
  const maxNumero = lista.reduce((m, e) => Math.max(m, Number(e.numero) || 0), 0);
  const abertaAgora = lista.find((e) => String(e.estado) === "inscricoes") || null;

  return NextResponse.json({
    ok: true,
    edicoes: lista,
    proximoNumero: maxNumero + 1,
    jaHaAberta: abertaAgora
      ? { numero: abertaAgora.numero, inscricoes_ate: abertaAgora.inscricoes_ate }
      : null,
  });
}

// ---------------------------------------------------------------------------
// POST -- cria a edicao com inscricoes abertas.
// ---------------------------------------------------------------------------
export async function POST(req: Request) {
  if (!supabaseAdmin) return NextResponse.json({ ok: false, erro: "Servidor sem ligacao." }, { status: 500 });
  const admin = await adminDoPedido(req);
  if (!admin) return NextResponse.json({ ok: false, erro: "Nao autorizado." }, { status: 401 });

  let corpo: { inscricoes_ate?: string; numero?: number; ano?: number; forcar?: boolean } = {};
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ ok: false, erro: "Pedido invalido." }, { status: 400 });
  }

  // 1) Data de fecho das inscricoes: obrigatoria e no futuro.
  const ateStr = (corpo.inscricoes_ate || "").trim();
  const ateMs = ateStr ? Date.parse(ateStr) : NaN;
  if (!ateStr || !Number.isFinite(ateMs)) {
    return NextResponse.json({ ok: false, erro: "Falta a data de fecho das inscricoes (inscricoes_ate) valida." }, { status: 400 });
  }
  if (ateMs <= Date.now()) {
    return NextResponse.json({ ok: false, erro: "A data de fecho tem de ser no futuro." }, { status: 400 });
  }
  const inscricoesAteIso = new Date(ateMs).toISOString();

  // 2) Ja ha uma edicao a receber inscricoes? Duas ao mesmo tempo baralham o
  //    sorteio. So se avanca com forcar:true.
  if (!corpo.forcar) {
    const { data: aberta } = await supabaseAdmin
      .from("dodo_edicoes")
      .select("id, numero")
      .eq("estado", "inscricoes")
      .limit(1)
      .maybeSingle();
    if (aberta) {
      return NextResponse.json({
        ok: false,
        jaAberta: true,
        erro: `Ja existe a ${aberta.numero}a edicao com inscricoes abertas. Fecha/sorteia essa primeiro, ou envia forcar:true.`,
      }, { status: 409 });
    }
  }

  // 3) Numero: o indicado, ou o proximo automatico. Tem de ser unico.
  const { data: todas } = await supabaseAdmin.from("dodo_edicoes").select("numero");
  const usados = new Set((todas || []).map((e) => Number(e.numero)));
  const maxNumero = (todas || []).reduce((m, e) => Math.max(m, Number(e.numero) || 0), 0);
  const numero = Number.isFinite(Number(corpo.numero)) && Number(corpo.numero) > 0 ? Math.floor(Number(corpo.numero)) : maxNumero + 1;
  if (usados.has(numero)) {
    return NextResponse.json({ ok: false, erro: `Ja existe uma edicao com o numero ${numero}.` }, { status: 409 });
  }

  const ano = Number.isFinite(Number(corpo.ano)) && Number(corpo.ano) > 2000 ? Math.floor(Number(corpo.ano)) : new Date(ateMs).getUTCFullYear();

  // 4) Cria a edicao com as inscricoes abertas JA.
  const { data: nova, error } = await supabaseAdmin
    .from("dodo_edicoes")
    .insert({
      numero,
      ano,
      estado: "inscricoes",
      inscricoes_de: new Date().toISOString(),
      inscricoes_ate: inscricoesAteIso,
    })
    .select("id, numero, ano, estado, inscricoes_de, inscricoes_ate")
    .single();
  if (error || !nova) {
    return NextResponse.json({ ok: false, erro: "Nao foi possivel criar a edicao.", detalhe: error?.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    edicao: nova,
    nota: "Inscricoes abertas. Quando fecharem, o sorteio corre por /api/dodo?sortear=1&key=SEGREDO (cron ou a mao) e a chave e gerada.",
  });
}
