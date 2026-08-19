// app/api/chaveamento-resultado/route.ts
//
// RESULTADOS MANUAIS DA CHAVE — o chaveador insere o vencedor + ações de uma
// luta que o JudoBase não leu, para a chave destravar. Grava em `lutas_manuais`
// (à parte da resultados_atletas, que o cron reescreve). A fusão acontece na
// leitura, em lib/montarChave.
//
//   GET  /api/chaveamento-resultado?comp=ID[&cat=-81]
//        • chaveador -> { ok, autorizado:true, lutas:[...] }
//        • outros    -> 401
//   POST /api/chaveamento-resultado   (Authorization: Bearer <token>, is_chaveador)
//        { acao:"gravar", comp, categoria, a, b, vencedor, aAcoes:{i,w,y,s}, bAcoes:{i,w,y,s} }
//        { acao:"apagar", id }
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Confirma que quem pede é um chaveador. Devolve o uid, ou null. */
async function chaveadorDoPedido(req: Request): Promise<string | null> {
  try {
    const auth = req.headers.get("authorization") || "";
    const tok = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
    if (!tok) return null;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const pub = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
    if (!url || !pub || !supabaseAdmin) return null;
    const sb = createClient(url, pub, {
      global: { headers: { Authorization: `Bearer ${tok}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await sb.auth.getUser();
    if (error || !data?.user?.id) return null;
    const uid = data.user.id;
    const { data: u } = await supabaseAdmin.from("users").select("is_chaveador").eq("id", uid).maybeSingle();
    return u?.is_chaveador ? uid : null;
  } catch {
    return null;
  }
}

const n0 = (v: unknown): number => {
  const x = parseInt(String(v ?? "0"), 10);
  return isNaN(x) || x < 0 ? 0 : x;
};
type Acoes = { i: number; w: number; y: number; s: number };
const lerAcoes = (o: unknown): Acoes => {
  const r = (o ?? {}) as Record<string, unknown>;
  return { i: n0(r.i), w: n0(r.w), y: n0(r.y), s: Math.min(3, n0(r.s)) };
};

export async function GET(req: Request) {
  if (!supabaseAdmin) return NextResponse.json({ ok: false, erro: "Servidor sem ligação." }, { status: 500 });
  const uid = await chaveadorDoPedido(req);
  if (!uid) return NextResponse.json({ ok: false, erro: "Não autorizado." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const comp = (searchParams.get("comp") || "").trim();
  const cat = (searchParams.get("cat") || "").trim();
  if (!comp) return NextResponse.json({ ok: false, erro: "Falta ?comp=." }, { status: 400 });

  let q = supabaseAdmin
    .from("lutas_manuais")
    .select("id, weight_category, id_person_a, id_person_b, id_vencedor, a_ippon, a_waza, a_yuko, a_shido, b_ippon, b_waza, b_yuko, b_shido")
    .eq("id_competicao", comp);
  if (cat) q = q.eq("weight_category", cat);
  const { data } = await q;
  return NextResponse.json({ ok: true, autorizado: true, lutas: data || [] });
}

export async function POST(req: Request) {
  if (!supabaseAdmin) return NextResponse.json({ ok: false, erro: "Servidor sem ligação." }, { status: 500 });
  const uid = await chaveadorDoPedido(req);
  if (!uid) return NextResponse.json({ ok: false, erro: "Não autorizado." }, { status: 401 });

  let body: {
    acao?: string; comp?: string; categoria?: string;
    a?: string; b?: string; vencedor?: string; aAcoes?: unknown; bAcoes?: unknown; id?: string;
  };
  try { body = await req.json(); } catch {
    return NextResponse.json({ ok: false, erro: "Pedido inválido." }, { status: 400 });
  }
  const acao = String(body.acao || "");

  // --- APAGAR uma luta manual ---
  if (acao === "apagar") {
    const id = String(body.id || "").trim();
    if (!id) return NextResponse.json({ ok: false, erro: "Falta o id." }, { status: 400 });
    const { error } = await supabaseAdmin.from("lutas_manuais").delete().eq("id", id);
    if (error) return NextResponse.json({ ok: false, erro: "Não foi possível apagar." }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // --- GRAVAR (criar/atualizar) uma luta manual ---
  if (acao === "gravar") {
    const comp = String(body.comp || "").trim();
    const categoria = String(body.categoria || "").trim();
    let a = String(body.a || "").trim();
    let b = String(body.b || "").trim();
    const vencedor = String(body.vencedor || "").trim();
    if (!comp || !categoria || !a || !b) return NextResponse.json({ ok: false, erro: "Faltam dados da luta." }, { status: 400 });
    if (a === b) return NextResponse.json({ ok: false, erro: "Os dois lados não podem ser o mesmo atleta." }, { status: 400 });
    if (vencedor !== a && vencedor !== b) return NextResponse.json({ ok: false, erro: "O vencedor tem de ser um dos dois." }, { status: 400 });

    let aAcoes = lerAcoes(body.aAcoes);
    let bAcoes = lerAcoes(body.bAcoes);

    // Canoniza o par (a<=b) para o unique apanhar duplicados em qualquer ordem.
    // O vencedor mantém-se; só trocamos as ações junto com os lados.
    if (a > b) {
      [a, b] = [b, a];
      [aAcoes, bAcoes] = [bAcoes, aAcoes];
    }

    const linha = {
      id_competicao: comp,
      weight_category: categoria,
      id_person_a: a,
      id_person_b: b,
      id_vencedor: vencedor,
      a_ippon: aAcoes.i, a_waza: aAcoes.w, a_yuko: aAcoes.y, a_shido: aAcoes.s,
      b_ippon: bAcoes.i, b_waza: bAcoes.w, b_yuko: bAcoes.y, b_shido: bAcoes.s,
      criado_por: uid,
      atualizado_em: new Date().toISOString(),
    };
    const { error } = await supabaseAdmin
      .from("lutas_manuais")
      .upsert(linha, { onConflict: "id_competicao,weight_category,id_person_a,id_person_b" });
    if (error) return NextResponse.json({ ok: false, erro: "Não foi possível guardar." }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, erro: "Ação desconhecida." }, { status: 400 });
}
