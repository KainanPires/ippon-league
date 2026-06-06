import { NextResponse } from "next/server";
import { contestActionsForPerson, getCompetitionCompetitorsRaw, mapCompetitorsToAthletes, type IjfContest } from "@/lib/ijf";
import type { ActionType } from "@/lib/engine";

// Balcão de TESTE do 3D (forma recente + preço real). NÃO mexe no Mercado ainda.
//   /api/atleta?id=7350           -> detalhe de um atleta
//   /api/atleta?comp=3131&n=6     -> calcula para os primeiros n atletas da competição (mede tempo do lote)
export const dynamic = "force-dynamic";

const IJF = "https://data.ijf.org/api/get_json";
const TIMEOUT_MS = 15000;
const DOZE_MESES_MS = 365 * 24 * 3600 * 1000;

const POINTS: Record<ActionType, number> = {
  ippon_feito: 10, waza_ari_feito: 4, yuko_feito: 2, shido_provocado: 1,
  ippon_sofrido: -5, waza_ari_sofrido: -2, yuko_sofrido: -1, shido_recebido: -2,
  hansoku_make_recebido: -10,
};

const round1 = (n: number) => Math.round(n * 10) / 10;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

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

function fightDate(f: IjfContest): number {
  // Lê os campos de data via Record para não depender do tipo IjfContest.
  const rec = f as unknown as Record<string, unknown>;
  const rawStr = String(rec.competition_date || rec.date_raw || "").replace(/\//g, "-").slice(0, 10);
  if (!rawStr) return 0;
  const t = Date.parse(rawStr);
  return isNaN(t) ? 0 : t;
}

// Calcula a forma de UM atleta a partir das suas lutas cruas.
function calcForma(fights: IjfContest[], idPerson: string) {
  // agrupa por competição: soma de pontos + data
  const comps = new Map<string, { pontos: number; lutas: number; data: number }>();
  for (const f of fights) {
    const comp = String(f.id_competition ?? "—");
    const acoes = contestActionsForPerson(f, idPerson);
    const pts = acoes.reduce((s, a) => s + (POINTS[a] ?? 0), 0);
    const cur = comps.get(comp) || { pontos: 0, lutas: 0, data: 0 };
    cur.pontos += pts;
    cur.lutas += 1;
    const d = fightDate(f);
    if (d > cur.data) cur.data = d;
    comps.set(comp, cur);
  }

  const lista = Array.from(comps.entries())
    .map(([id_competition, v]) => ({ id_competition, pontos: round1(v.pontos), lutas: v.lutas, data: v.data }))
    .sort((a, b) => b.data - a.data); // mais recente primeiro (por DATA)

  const agora = Date.now();
  const recentes = lista.filter((c) => c.data > 0 && agora - c.data <= DOZE_MESES_MS);

  const media12 = recentes.length > 0 ? round1(recentes.reduce((s, c) => s + c.pontos, 0) / recentes.length) : 0;
  const ult3 = lista.slice(0, 3);
  const media3 = ult3.length > 0 ? round1(ult3.reduce((s, c) => s + c.pontos, 0) / ult3.length) : 0;
  const ultima = lista.length > 0 ? lista[0].pontos : 0;

  // Expectativa (regra do projeto): 70% últimos 12 meses + 30% últimas 3.
  // Se não houver nada nos 12 meses, cai para as últimas 3.
  const expectativa = recentes.length > 0 ? round1(0.7 * media12 + 0.3 * media3) : media3;

  // Preço real (2–20 JC) a partir da expectativa de pontos por competição.
  const preco = clamp(round1(3 + expectativa * 0.32), 2, 20);

  return {
    total_competicoes: lista.length,
    competicoes_12m: recentes.length,
    media_12m: media12,
    media_ultimas3: media3,
    ultima,
    ultima_data: lista[0]?.data ? new Date(lista[0].data).toISOString().slice(0, 10) : null,
    expectativa,
    preco_real: preco,
    top_competicoes: lista.slice(0, 8).map((c) => ({ id: c.id_competition, pontos: c.pontos, lutas: c.lutas, data: c.data ? new Date(c.data).toISOString().slice(0, 10) : null })),
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const comp = searchParams.get("comp");
  const n = Math.min(Number(searchParams.get("n") || "6"), 20);

  // ---- Modo lote: vários atletas de uma competição (mede tempo) ----
  if (comp) {
    const t0 = Date.now();
    const raw = await getCompetitionCompetitorsRaw(comp);
    const todos = mapCompetitorsToAthletes(raw);
    const amostra = todos.slice(0, n);

    const resultados = [];
    for (const a of amostra) {
      const data = await callRaw("competitor.contests", { id_person: a.id });
      const fights = extractFights(data);
      const forma = calcForma(fights, a.id);
      resultados.push({
        id: a.id, nome: a.name, pais: a.countryIso, categoria: a.category,
        preco_partida: a.priceJc, preco_real: forma.preco_real,
        media_12m: forma.media_12m, ultima: forma.ultima,
        comps_12m: forma.competicoes_12m, total_comps: forma.total_competicoes,
      });
    }
    const msTotal = Date.now() - t0;

    return NextResponse.json({
      modo: "lote", competicao: comp, atletas_testados: resultados.length,
      pedidos: resultados.length + 1, ms_total: msTotal,
      ms_por_atleta: resultados.length > 0 ? Math.round(msTotal / resultados.length) : 0,
      estimativa_488_em_fila_seg: Math.round((msTotal / Math.max(resultados.length, 1)) * 488 / 1000),
      resultados,
    });
  }

  // ---- Modo detalhe: um atleta ----
  if (!id) {
    return NextResponse.json({
      erro: "Usa /api/atleta?id=7350  ou  /api/atleta?comp=3131&n=6",
      sugestoes: { Nagayama: "7350", Khalmatov: "18231" },
    });
  }

  const t0 = Date.now();
  const data = await callRaw("competitor.contests", { id_person: id });
  const ms = Date.now() - t0;
  const fights = extractFights(data);
  const forma = calcForma(fights, id);

  return NextResponse.json({
    modo: "detalhe", id_person: id, pedidos: 1, ms,
    total_lutas: fights.length, ...forma,
  });
}
