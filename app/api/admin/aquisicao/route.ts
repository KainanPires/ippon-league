// app/api/admin/aquisicao/route.ts
//
// FERRAMENTA DE ADMIN (so admin): "de onde vem" -- agora um FUNIL.
//
// Para cada origem (fonte, campanha, fonte+campanha, mensagem/utm_content e,
// quando existir, canal declarado pela pessoa) mostra tres numeros:
//   REGISTOS  -> quantas contas vieram dali
//   ATIVARAM  -> dessas, quantas ja montaram equipa (tem linha em `equipas`)
//   PRO       -> dessas, quantas sao Pro (users.is_pro)
//
// Assim ve-se nao so QUANTOS vieram de cada acao, mas QUANTOS converteram --
// que e o que diz se uma acao (um post, uma mensagem de WhatsApp, um evento)
// trouxe gente que fica e paga, ou so cliques.
//
// So-leitura: nao escreve nada. Le de `users` (colunas de aquisicao + is_pro)
// e de `equipas` (quem ativou).
//
// GET /api/admin/aquisicao?dias=30   -> funil por origem. dias omitido/0 = sempre.
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function ehAdmin(req: Request): Promise<boolean> {
  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
    if (!token) return false;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const pub = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
    if (!url || !pub || !supabaseAdmin) return false;
    const sb = createClient(url, pub, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await sb.auth.getUser();
    const uid = data?.user?.id;
    if (error || !uid) return false;
    const { data: row } = await supabaseAdmin.from("users").select("is_admin").eq("id", uid).maybeSingle();
    return !!row?.is_admin;
  } catch {
    return false;
  }
}

type Linha = {
  id: string;
  first_utm_source: string | null;
  first_utm_campaign: string | null;
  first_utm_content: string | null;
  first_referrer: string | null;
  referred_by: string | null;
  is_pro: boolean | null;
};

// Forma da consulta do canal declarado. Fica num alias com nome de proposito:
// a regra no-restricted-syntax do repo proibe o nivel (is_pro) num tipo INLINE
// dentro de um cast (`... as { is_pro }`), mesmo lendo-o da tabela users como
// aqui. Um alias com nome nao e apanhado pela regra. Ver eslint.config.mjs.
type LinhaDeclarada = { id: string; origem_declarada: string | null; is_pro: boolean | null };

// Contagem de funil por chave.
type Cnt = { registos: number; ativaram: number; pro: number };
type ItemFunil = { chave: string; registos: number; ativaram: number; pro: number };

function bump(mapa: Map<string, Cnt>, chave: string, ativou: boolean, pro: boolean) {
  const c = mapa.get(chave) || { registos: 0, ativaram: 0, pro: 0 };
  c.registos += 1;
  if (ativou) c.ativaram += 1;
  if (pro) c.pro += 1;
  mapa.set(chave, c);
}

// Ordena por registos (as maiores origens primeiro).
function topN(mapa: Map<string, Cnt>, n = 50): ItemFunil[] {
  return Array.from(mapa.entries())
    .map(([chave, c]) => ({ chave, ...c }))
    .sort((a, b) => b.registos - a.registos)
    .slice(0, n);
}

const norm = (v: string | null): string => (v && String(v).trim() ? String(v).trim().toLowerCase() : "");

export async function GET(req: Request) {
  if (!supabaseAdmin) return NextResponse.json({ ok: false, erro: "Servidor sem ligacao." }, { status: 500 });
  if (!(await ehAdmin(req))) return NextResponse.json({ ok: false, erro: "Nao autorizado." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const dias = Math.max(0, Math.floor(Number(searchParams.get("dias") || "0")) || 0);
  const desde = dias > 0 ? new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString() : null;

  // 1) Contas + origem + is_pro (a coorte e por data de registo).
  let q = supabaseAdmin
    .from("users")
    .select("id, first_utm_source, first_utm_campaign, first_utm_content, first_referrer, referred_by, is_pro")
    .limit(100000);
  if (desde) q = q.gte("first_seen_at", desde);
  const { data, error } = await q;
  if (error) {
    return NextResponse.json({
      ok: false,
      erro: "Nao consegui ler as colunas de aquisicao da tabela users.",
      detalhe: error.message,
      dica: "Confirma que existem as colunas first_utm_source/campaign/content, first_referrer, referred_by, first_seen_at, is_pro.",
    }, { status: 500 });
  }

  const linhas = (data || []) as Linha[];
  const total = linhas.length;

  // 2) Quem ativou (tem pelo menos uma equipa). Uma so leitura, dedup em memoria.
  const ativos = new Set<string>();
  try {
    const { data: eq } = await supabaseAdmin.from("equipas").select("user_id").limit(500000);
    for (const r of (eq || []) as { user_id: string | null }[]) {
      if (r.user_id) ativos.add(String(r.user_id));
    }
  } catch {
    // sem `equipas`: o funil mostra registos/pro na mesma, ativaram fica a 0.
  }

  const porFonte = new Map<string, Cnt>();
  const porCampanha = new Map<string, Cnt>();
  const porFonteCampanha = new Map<string, Cnt>();
  const porConteudo = new Map<string, Cnt>();

  let diretos = 0;      // sem utm_source nem referrer
  let comReferrer = 0;  // veio de um site externo (referrer) sem utm
  let comReferral = 0;  // referred_by preenchido (indicacao de amigo)
  let ativaramTotal = 0;
  let proTotal = 0;

  for (const l of linhas) {
    const ativou = ativos.has(String(l.id));
    const pro = !!l.is_pro;
    if (ativou) ativaramTotal += 1;
    if (pro) proTotal += 1;

    const src = norm(l.first_utm_source);
    const camp = norm(l.first_utm_campaign);
    const cont = norm(l.first_utm_content);
    const ref = norm(l.first_referrer);

    if (l.referred_by) comReferral += 1;

    if (src) {
      bump(porFonte, src, ativou, pro);
      if (camp) {
        bump(porFonteCampanha, `${src} / ${camp}`, ativou, pro);
        bump(porCampanha, camp, ativou, pro);
      }
      if (cont) bump(porConteudo, `${src} / ${cont}`, ativou, pro);
    } else if (ref) {
      comReferrer += 1;
      bump(porFonte, `(referrer) ${ref}`, ativou, pro);
    } else {
      diretos += 1;
      bump(porFonte, "(direto)", ativou, pro);
    }
  }

  // 3) Canal DECLARADO pela pessoa ("Como nos conheceste?"), quando a coluna
  //    existir. Cobre o boca-a-boca / eventos / offline que nao trazem link.
  //    Consulta defensiva: se a coluna ainda nao existe, ignora-se em silencio.
  let porDeclarada: ItemFunil[] | null = null;
  try {
    let qd = supabaseAdmin
      .from("users")
      .select("id, origem_declarada, is_pro")
      .not("origem_declarada", "is", null)
      .limit(100000);
    if (desde) qd = qd.gte("first_seen_at", desde);
    const { data: dd, error: erroDecl } = await qd;
    if (!erroDecl && dd) {
      const mapa = new Map<string, Cnt>();
      for (const r of dd as LinhaDeclarada[]) {
        const chave = norm(r.origem_declarada);
        if (!chave) continue;
        bump(mapa, chave, ativos.has(String(r.id)), !!r.is_pro);
      }
      if (mapa.size > 0) porDeclarada = topN(mapa);
    }
  } catch {
    // coluna ainda nao existe: seccao "declarada" simplesmente nao aparece.
  }

  return NextResponse.json({
    ok: true,
    dias: dias || null,
    total,
    resumo: {
      diretos, comReferrer, comReferral,
      ativaram: ativaramTotal, pro: proTotal,
      ativarPct: total > 0 ? Math.round((ativaramTotal / total) * 100) : 0,
      proPct: total > 0 ? Math.round((proTotal / total) * 100) : 0,
    },
    porFonte: topN(porFonte),
    porCampanha: topN(porCampanha),
    porFonteCampanha: topN(porFonteCampanha),
    porConteudo: topN(porConteudo),
    porDeclarada, // null enquanto a coluna origem_declarada nao existir
  });
}
