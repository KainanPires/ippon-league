import { NextResponse } from "next/server";
import { getCompetitionCompetitorsRaw, mapCompetitorsToAthletes, type IjfContest } from "@/lib/ijf";
import { calcularForma } from "@/lib/forma";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { Athlete, AthleteStatus } from "@/lib/athletes";

// Trabalhador do 3D-3: calcula preços/forma REAIS de UMA categoria e atualiza o cache.
//   /api/calcular?comp=3131&cat=-60&gender=M
// Faz poucos atletas de cada vez (cabe no limite de tempo da Vercel).
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const IJF = "https://data.ijf.org/api/get_json";
const TIMEOUT_MS = 15000;

function buildUrl(action: string, params: Record<string, string>): string {
  const qs = Object.entries(params).map(([k, v]) => `&params%5B${k}%5D=${encodeURIComponent(v)}`).join("");
  return `${IJF}?access_token=&params%5Baction%5D=${action}${qs}`;
}

async function callRaw(action: string, params: Record<string, string>): Promise<any> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(buildUrl(action, params), {
      cache: "no-store", signal: ctrl.signal,
      headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 (IpponLeague)" },
    });
    const text = await res.text();
    clearTimeout(timer);
    if (text.includes("unknown action")) return null;
    try { return JSON.parse(text); } catch { return null; }
  } catch {
    clearTimeout(timer);
    return null;
  }
}

function extractFights(data: any): IjfContest[] {
  if (Array.isArray(data)) return data as IjfContest[];
  if (data && typeof data === "object") {
    if (Array.isArray(data.contests)) return data.contests as IjfContest[];
    for (const k of Object.keys(data)) {
      const v = (data as Record<string, unknown>)[k];
      if (Array.isArray(v) && v.length > 0 && typeof v[0] === "object") return v as IjfContest[];
    }
  }
  return [];
}

// Estado simples a partir do preço real (afinamos Em alta/Em baixa quando houver rodadas).
function estadoDoPreco(preco: number): AthleteStatus {
  if (preco >= 14) return "Elite";
  if (preco >= 7) return "Barganha";
  return "Aposta";
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const comp = searchParams.get("comp") || "3131";
  const cat = searchParams.get("cat");
  const gender = (searchParams.get("gender") || "M").toUpperCase() === "F" ? "F" : "M";

  if (!cat) {
    return NextResponse.json({
      erro: "Falta a categoria. Ex.: /api/calcular?comp=3131&cat=-60&gender=M",
    });
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ erro: "Cache indisponível (sem chave de servidor)." }, { status: 500 });
  }

  const t0 = Date.now();

  // 1) Lista completa da competição (mapeada) — fonte dos atletas a processar.
  const raw = await getCompetitionCompetitorsRaw(comp);
  const todos = mapCompetitorsToAthletes(raw);
  const alvo = todos.filter((a) => a.category === cat && a.gender === gender);

  if (alvo.length === 0) {
    return NextResponse.json({ comp, cat, gender, atualizados: 0, nota: "Nenhum atleta nesta categoria/género." });
  }

  // 2) Calcula forma/preço real de cada atleta da categoria.
  const calculados = new Map<string, Athlete>();
  for (const a of alvo) {
    const data = await callRaw("competitor.contests", { id_person: a.id });
    const fights = extractFights(data);
    const forma = calcularForma(fights, a.id);
    calculados.set(a.id, {
      ...a,
      priceJc: forma.preco,
      avg: forma.media12m,
      last: forma.ultima,
      variation: 0, // a variação real só aparece com rodadas ao vivo
      status: estadoDoPreco(forma.preco),
    });
  }

  // 3) Lê o cache atual (lista inteira dos 488).
  const { data: linha } = await supabaseAdmin
    .from("atletas_cache")
    .select("atletas, total")
    .eq("id_competition", comp)
    .maybeSingle();

  const listaCache: Athlete[] = Array.isArray(linha?.atletas) ? (linha!.atletas as Athlete[]) : todos;

  // 4) Substitui só os atletas calculados; os outros ficam intactos.
  const novaLista = listaCache.map((a) => calculados.get(a.id) || a);

  // 5) Grava a lista inteira de volta.
  const { error } = await supabaseAdmin.from("atletas_cache").upsert(
    {
      id_competition: comp,
      atletas: novaLista,
      total: novaLista.length,
      atualizado_em: new Date().toISOString(),
    },
    { onConflict: "id_competition" }
  );

  const ms = Date.now() - t0;

  if (error) {
    return NextResponse.json({ comp, cat, gender, erro: "Falha ao gravar no cache: " + error.message }, { status: 500 });
  }

  // Pequena amostra para confirmares os números.
  const amostra = Array.from(calculados.values())
    .sort((a, b) => b.priceJc - a.priceJc)
    .slice(0, 6)
    .map((a) => ({ nome: a.name, pais: a.countryIso, preco: a.priceJc, media: a.avg, ultima: a.last, estado: a.status }));

  return NextResponse.json({
    sucesso: true,
    comp, cat, gender,
    atualizados: calculados.size,
    total_no_cache: novaLista.length,
    ms,
    amostra,
  });
}
