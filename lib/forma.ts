/**
 * Ippon League — Forma recente e preço a partir do histórico (passo 3D).
 *
 * Pega nas lutas reais de um atleta (do JudoBase) e calcula:
 *   - média dos últimos 12 meses
 *   - média das últimas 3 competições
 *   - pontuação na última competição
 *   - expectativa (70% 12 meses + 30% últimas 3) — via engine
 *   - preço real em JC (escala calibrada com dados reais)
 *
 * Reaproveita o motor (lib/engine.ts) para os pontos e a expectativa, e o
 * extrator de ações (lib/ijf.ts). Não duplica regras.
 */
import { scoreActions, expectedPerformance, MIN_PRICE } from "@/lib/engine";
import { contestActionsForPerson, type IjfContest } from "@/lib/ijf";

/** Preço máximo de um atleta (os de elite chegam aqui). */
export const MAX_PRICE = 20;

const DOZE_MESES_MS = 365 * 24 * 3600 * 1000;
const round1 = (n: number) => Math.round(n * 10) / 10;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/**
 * Converte a expectativa de pontos por competição num preço (JC).
 * Escala decidida com dados reais: 3 + expectativa × 1,1, entre 2 e 20.
 *   exp 0 -> ~3 JC · exp 5 -> ~8,5 · exp 10 -> ~14 · exp 14 -> ~18,4 · exp 15+ -> 20
 */
export function precoDeExpectativa(expectativa: number): number {
  return clamp(round1(3 + expectativa * 1.1), MIN_PRICE, MAX_PRICE);
}

/** Lê a data de uma luta (campos do JudoBase) sem depender do tipo IjfContest. */
function dataDaLuta(f: IjfContest): number {
  const rec = f as unknown as Record<string, unknown>;
  const raw = String(rec.competition_date || rec.date_raw || "").replace(/\//g, "-").slice(0, 10);
  if (!raw) return 0;
  const t = Date.parse(raw);
  return isNaN(t) ? 0 : t;
}

export interface FormaResult {
  totalComps: number;
  comps12m: number;
  media12m: number;
  mediaUltimas3: number;
  ultima: number;
  ultimaData: string | null;
  expectativa: number;
  preco: number;
}

/**
 * Calcula a forma recente e o preço de um atleta a partir das suas lutas cruas.
 * @param fights   lutas do atleta (resposta de competitor.contests, já extraída)
 * @param idPerson id do atleta (para saber de que lado lutou em cada luta)
 */
export function calcularForma(fights: IjfContest[], idPerson: string): FormaResult {
  // Agrupa por competição: soma de pontos + data mais recente da competição.
  const comps = new Map<string, { pontos: number; data: number }>();
  for (const f of fights) {
    const comp = String(f.id_competition ?? "—");
    const pts = scoreActions(contestActionsForPerson(f, idPerson));
    const cur = comps.get(comp) || { pontos: 0, data: 0 };
    cur.pontos += pts;
    const d = dataDaLuta(f);
    if (d > cur.data) cur.data = d;
    comps.set(comp, cur);
  }

  const lista = Array.from(comps.entries())
    .map(([id, v]) => ({ id, pontos: round1(v.pontos), data: v.data }))
    .sort((a, b) => b.data - a.data); // mais recente primeiro (por data)

  const agora = Date.now();
  const recentes = lista.filter((c) => c.data > 0 && agora - c.data <= DOZE_MESES_MS);

  const media12m = recentes.length > 0 ? round1(avg(recentes.map((c) => c.pontos))) : 0;
  const ult3 = lista.slice(0, 3);
  const mediaUltimas3 = ult3.length > 0 ? round1(avg(ult3.map((c) => c.pontos))) : 0;
  const ultima = lista.length > 0 ? lista[0].pontos : 0;

  // Se não houver nada nos últimos 12 meses, cai para as últimas 3 competições.
  const expectativa = recentes.length > 0
    ? round1(expectedPerformance(media12m, mediaUltimas3))
    : mediaUltimas3;

  return {
    totalComps: lista.length,
    comps12m: recentes.length,
    media12m,
    mediaUltimas3,
    ultima,
    ultimaData: lista[0]?.data ? new Date(lista[0].data).toISOString().slice(0, 10) : null,
    expectativa,
    preco: precoDeExpectativa(expectativa),
  };
}

function avg(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((s, x) => s + x, 0) / arr.length;
}
