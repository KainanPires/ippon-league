import { NextResponse } from "next/server";
import { getCompetitionCompetitorsRaw, mapCompetitorsToAthletes, type IjfContest } from "@/lib/ijf";
import { calcularForma, janelaDoAnoCivil, EXPECTATIVA_TOPO, EXPECTATIVA_TOPO_CLASSICO, type JanelaForma } from "@/lib/forma";
import { MIN_PRICE } from "@/lib/engine";
import { CALENDARIO_2026 } from "@/lib/calendario";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { Athlete, AthleteStatus } from "@/lib/athletes";
// Trabalhador do 3D-3: calcula preços/forma REAIS de UMA categoria e atualiza o cache.
//   /api/calcular?comp=3131&cat=-60&gender=M
// Faz poucos atletas de cada vez (cabe no limite de tempo da Vercel).
//
// ---------------------------------------------------------------------------
// CLÁSSICOS — o preço é o do ANO ORIGINAL, não o de hoje.
//
// Uma competição clássica é a reposição de uma competição antiga (ex.: Grand
// Prix The Hague 2018). Os ATLETAS já vinham certos — o JudoBase devolve os
// inscritos de 2018 para o id 1598. Mas o PREÇO era calculado com a forma dos
// últimos 12 meses a contar de HOJE, o que produzia disparates:
//
//   • quem dominou 2018 e se aposentou em 2020 não tem lutas recentes -> caía
//     para o mínimo (2 JC) e ia ganhar a competição. Uma equipa imbatível por
//     metade do orçamento, para quem soubesse.
//   • quem era promessa em 2018 e hoje é estrela ficava caro por um desempenho
//     que naquela altura ainda não tinha.
//
// Agora, quando a competição é um clássico, passamos a `calcularForma` a janela
// do ano original: para o clássico de 2018, a média DE 2018 desse atleta. O
// histórico posterior é ignorado por completo (ver o corte em lib/forma.ts).
//
// Nas competições reais de 2026 nada muda — janela indefinida, comportamento
// de sempre.
// ---------------------------------------------------------------------------
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
//
// CORTES QUE ACOMPANHAM A ESCALA. Num clássico, o topo da expectativa é mais
// alto (EXPECTATIVA_TOPO_CLASSICO), por isso o mesmo desempenho dá um preço
// menor. Com os cortes fixos de sempre, categorias inteiras ficavam sem um único
// "Elite" — visto nos -57kg do The Hague 2018, onde até a mais cara aparecia
// como "Barganha" e o rótulo deixava de dizer nada.
//
// Em vez de escolher números novos à mão, converte-se o corte para a escala do
// clássico com a mesma conta que gera os preços:
//     preço = MIN_PRICE + (MAX-MIN) × (expectativa / topo)
//   => preço' = MIN_PRICE + (preço - MIN_PRICE) × (topo / topo_clássico)
// Assim, se um dia afinares EXPECTATIVA_TOPO_CLASSICO, os rótulos seguem
// sozinhos e não voltam a ficar dessincronizados.
const CORTE_ELITE = 14;
const CORTE_BARGANHA = 7;

function corteNaEscala(corte: number, classico: boolean): number {
  if (!classico) return corte;
  return MIN_PRICE + (corte - MIN_PRICE) * (EXPECTATIVA_TOPO / EXPECTATIVA_TOPO_CLASSICO);
}

function estadoDoPreco(preco: number, classico: boolean): AthleteStatus {
  if (preco >= corteNaEscala(CORTE_ELITE, classico)) return "Elite";
  if (preco >= corteNaEscala(CORTE_BARGANHA, classico)) return "Barganha";
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

  // JANELA DE CÁLCULO: só os clássicos a têm. Para um clássico de 2018, os
  // atletas são avaliados pela média DE 2018 — ver a explicação no topo.
  const semana = CALENDARIO_2026.find((s) => s.idCompeticao === comp);
  const janela: JanelaForma | undefined =
    semana?.classico && semana.anoOriginal ? janelaDoAnoCivil(semana.anoOriginal) : undefined;

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
    const forma = calcularForma(fights, a.id, janela);
    calculados.set(a.id, {
      ...a,
      priceJc: forma.preco,
      avg: forma.media12m,
      last: forma.ultima,
      variation: 0, // a variação real só aparece com rodadas ao vivo
      status: estadoDoPreco(forma.preco, !!janela),
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
    // Diz que base de tempo foi usada — para se ver de relance, na resposta, se
    // um clássico foi mesmo avaliado pelo ano dele e não pelo de hoje.
    classico: !!janela,
    ano_base: janela ? semana?.anoOriginal ?? null : null,
    atualizados: calculados.size,
    total_no_cache: novaLista.length,
    ms,
    amostra,
  });
}
