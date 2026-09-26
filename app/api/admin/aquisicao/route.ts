// app/api/admin/aquisicao/route.ts
//
// FERRAMENTA DE ADMIN (so admin): "de onde vem" -- agrega a aquisicao das contas
// a partir das colunas de UTM/referral que a app ja grava na tabela users
// (first_utm_source/medium/campaign/content, first_referrer, referred_by,
// first_seen_at). So-leitura: nao escreve nada.
//
// GET /api/admin/aquisicao?dias=30   -> agregados (por fonte, campanha, etc.)
//   dias omitido ou 0 = desde sempre.
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
  first_utm_source: string | null;
  first_utm_medium: string | null;
  first_utm_campaign: string | null;
  first_utm_content: string | null;
  first_referrer: string | null;
  referred_by: string | null;
  first_seen_at: string | null;
};

function topN(mapa: Map<string, number>, n = 50): { chave: string; total: number }[] {
  return Array.from(mapa.entries())
    .map(([chave, total]) => ({ chave, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, n);
}

export async function GET(req: Request) {
  if (!supabaseAdmin) return NextResponse.json({ ok: false, erro: "Servidor sem ligacao." }, { status: 500 });
  if (!(await ehAdmin(req))) return NextResponse.json({ ok: false, erro: "Nao autorizado." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const dias = Math.max(0, Math.floor(Number(searchParams.get("dias") || "0")) || 0);
  const desde = dias > 0 ? new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString() : null;

  // Le as colunas de aquisicao. Se alguma nao existir na tabela, a consulta
  // falha -- nesse caso devolvemos um aviso claro em vez de rebentar.
  let q = supabaseAdmin
    .from("users")
    .select("first_utm_source, first_utm_medium, first_utm_campaign, first_utm_content, first_referrer, referred_by, first_seen_at")
    .limit(100000);
  if (desde) q = q.gte("first_seen_at", desde);
  const { data, error } = await q;
  if (error) {
    return NextResponse.json({
      ok: false,
      erro: "Nao consegui ler as colunas de aquisicao da tabela users.",
      detalhe: error.message,
      dica: "Confirma que existem as colunas first_utm_source/medium/campaign/content, first_referrer, referred_by, first_seen_at.",
    }, { status: 500 });
  }

  const linhas = (data || []) as Linha[];
  const total = linhas.length;

  const porFonte = new Map<string, number>();
  const porCampanha = new Map<string, number>();
  const porFonteCampanha = new Map<string, number>();
  const porConteudo = new Map<string, number>();
  let diretos = 0;       // sem utm_source nem referrer
  let comReferral = 0;   // referred_by preenchido
  let comReferrer = 0;   // veio de um site externo (referrer) sem utm

  const norm = (v: string | null): string => (v && String(v).trim() ? String(v).trim().toLowerCase() : "");

  for (const l of linhas) {
    const src = norm(l.first_utm_source);
    const camp = norm(l.first_utm_campaign);
    const cont = norm(l.first_utm_content);
    const ref = norm(l.first_referrer);

    if (l.referred_by) comReferral++;

    if (src) {
      porFonte.set(src, (porFonte.get(src) ?? 0) + 1);
      if (camp) porFonteCampanha.set(`${src} / ${camp}`, (porFonteCampanha.get(`${src} / ${camp}`) ?? 0) + 1);
      if (cont) porConteudo.set(`${src} / ${cont}`, (porConteudo.get(`${src} / ${cont}`) ?? 0) + 1);
      if (camp) porCampanha.set(camp, (porCampanha.get(camp) ?? 0) + 1);
    } else if (ref) {
      comReferrer++;
      porFonte.set(`(referrer) ${ref}`, (porFonte.get(`(referrer) ${ref}`) ?? 0) + 1);
    } else {
      diretos++;
    }
  }

  return NextResponse.json({
    ok: true,
    dias: dias || null,
    total,
    resumo: { diretos, comReferrer, comReferral },
    porFonte: topN(porFonte),
    porCampanha: topN(porCampanha),
    porFonteCampanha: topN(porFonteCampanha),
    porConteudo: topN(porConteudo),
  });
}
