// app/api/chave-preview/route.ts
//
// PRÉVIA PÚBLICA da chave de UMA competição — alimenta a página /evento/<id>
// (a isca do funil). Genérica: serve o Mundial e qualquer competição futura.
//
// Leitura pública (SEM login, SEM segredo): só devolve a MOLDURA (quem está em
// cada pool), que é informação de sorteio, não conteúdo Pro. A chave completa +
// resultados ao vivo continuam na página real (/chave-atletas), atrás do registo.
//
// Fonte (confirmada em chave-viva/chave-maestro):
//   chave_atletas (id_competicao, weight_category, pools A/B/C/D = ids) — a moldura.
//   atletas_cache (id_competition) — nomes/país.
//
// GET /api/chave-preview?comp=3151   -> competição 3151 (Mundial)
// GET /api/chave-preview             -> competição da semana (por omissão)
//   { ok, comp, pronta, categorias: [{ cat, total, pools: {A:[{id,nome,pais}],...} }] }
//   pronta=false quando ainda não há moldura montada.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { competicaoDaSemana } from "@/lib/calendario";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Ordem estável das categorias (masculino depois feminino), como no resto da app.
const ORDEM = ["-60", "-66", "-73", "-81", "-90", "-100", "+100", "-48", "-52", "-57", "-63", "-70", "-78", "+78"];

interface AtletaPrev { id: string; nome: string; pais: string }

export async function GET(req: Request) {
  if (!supabaseAdmin) return NextResponse.json({ ok: false, erro: "Servidor sem ligação." }, { status: 500 });
  const { searchParams } = new URL(req.url);
  const comp = (searchParams.get("comp") || "").trim() || competicaoDaSemana(new Date()).idCompeticao;

  // 1) Molduras montadas desta competição.
  const { data: molduras } = await supabaseAdmin
    .from("chave_atletas").select("weight_category, pools").eq("id_competicao", comp);
  const lista = molduras || [];
  if (lista.length === 0) {
    return NextResponse.json({ ok: true, comp, pronta: false, categorias: [] });
  }

  // 2) Nomes/país do cache de atletas.
  const meta = new Map<string, { nome: string; pais: string }>();
  try {
    const { data } = await supabaseAdmin
      .from("atletas_cache").select("atletas").eq("id_competition", comp).maybeSingle();
    const arr = Array.isArray(data?.atletas) ? (data!.atletas as Array<Record<string, unknown>>) : [];
    for (const a of arr) {
      const id = a?.id != null ? String(a.id) : "";
      if (!id) continue;
      meta.set(id, { nome: a?.name ? String(a.name) : "", pais: a?.countryIso ? String(a.countryIso) : "" });
    }
  } catch { /* segue sem nomes */ }
  const atleta = (id: string): AtletaPrev => ({ id, nome: meta.get(id)?.nome || `#${id}`, pais: meta.get(id)?.pais || "" });

  // 3) Monta as categorias.
  const idx = (c: string) => { const i = ORDEM.indexOf(c); return i < 0 ? 999 : i; };
  const categorias = lista
    .map((row) => {
      const poolsRaw = (row.pools || {}) as Record<string, unknown>;
      const pools: Record<string, AtletaPrev[]> = {};
      let total = 0;
      for (const p of ["A", "B", "C", "D"]) {
        const arr = Array.isArray(poolsRaw[p]) ? (poolsRaw[p] as unknown[]) : [];
        pools[p] = arr.map((x) => atleta(String(x)));
        total += pools[p].length;
      }
      return { cat: String(row.weight_category || ""), total, pools };
    })
    .filter((c) => c.total > 0)
    .sort((a, b) => idx(a.cat) - idx(b.cat));

  return NextResponse.json({ ok: true, comp, pronta: categorias.length > 0, categorias });
}
