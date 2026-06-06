/**
 * Ippon League — Camada de dados do JudoBase (IJF)
 * USAR APENAS NO SERVIDOR.
 */

import type { ActionType } from "@/lib/engine";
import type { Athlete, Gender, AthleteStatus } from "@/lib/athletes";

const IJF = "https://data.ijf.org/api/get_json";
const TIMEOUT_MS = 15000;

export interface IjfCompetition {
  id_competition: string;
  name: string;
  name_short?: string;
  date_from: string;
  date_to: string;
  city?: string;
  country?: string;
  country_short?: string;
  continent_short?: string;
  competition_code?: string;
  ages?: string[];
  has_results?: string;
  status?: string;
  is_teams?: string;
}

export interface IjfContest {
  id_fight: string;
  id_competition: string;
  id_weight?: string;
  id_person_blue: string;
  id_person_white: string;
  id_winner: string;
  round?: string;
  round_name?: string;
  round_code?: string;
  mat_number?: string;
  start_planned?: string;
  start?: string;
  end?: string;
  duration?: string;
  ippon_b?: string; waza_b?: string; yuko_b?: string; penalty_b?: string;
  ippon_w?: string; waza_w?: string; yuko_w?: string; penalty_w?: string;
}

export interface IjfCompetitor {
  family_name?: string;
  given_name?: string;
  short_name?: string;
  gender?: string;
  country?: string;
  country_short?: string;
  categories?: string[];
  belt?: string;
  birth_date?: string;
  dob_year?: string;
  age?: string;
  club?: string;
  ftechique?: string;
}

function buildUrl(action: string, params: Record<string, string>): string {
  const qs = Object.entries(params)
    .map(([k, v]) => `&params%5B${k}%5D=${encodeURIComponent(v)}`)
    .join("");
  return `${IJF}?access_token=&params%5Baction%5D=${action}${qs}`;
}

async function call<T>(action: string, params: Record<string, string>): Promise<T | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(buildUrl(action, params), {
      cache: "no-store",
      signal: ctrl.signal,
      headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 (IpponLeague)" },
    });
    const text = await res.text();
    clearTimeout(timer);
    if (text.includes("unknown action")) return null;
    return JSON.parse(text) as T;
  } catch {
    clearTimeout(timer);
    return null;
  }
}

export async function getCompetitions(year: number): Promise<IjfCompetition[]> {
  const data = await call<IjfCompetition[]>("competition.get_list", { year: String(year) });
  return Array.isArray(data) ? data : [];
}

export async function getCompetition(idCompetition: string): Promise<IjfCompetition | null> {
  const data = await call<IjfCompetition>("competition.info", { id_competition: idCompetition });
  return data && (data as any).id_competition ? data : null;
}

export async function getCompetitionContests(idCompetition: string): Promise<IjfContest[]> {
  const data = await call<{ contests?: IjfContest[] }>("competition.contests", { id_competition: idCompetition });
  return data?.contests ?? [];
}

export async function getCompetitor(idPerson: string): Promise<IjfCompetitor | null> {
  const data = await call<IjfCompetitor>("competitor.info", { id_person: idPerson });
  return data && data.family_name ? data : null;
}

export async function getCompetitorContests(idPerson: string): Promise<IjfContest[]> {
  const data = await call<{ contests?: IjfContest[] }>("competitor.contests", { id_person: idPerson });
  return data?.contests ?? [];
}

/**
 * NOVO (passo 3A): inscritos de uma competição (ação competition.competitors).
 * Devolve o JSON CRU, sem assumir o formato — para inspecionarmos a forma real
 * antes de mapear para o tipo Athlete do jogo (3A-parte-2).
 */
export async function getCompetitionCompetitorsRaw(idCompetition: string): Promise<unknown> {
  return await call<unknown>("competition.competitors", { id_competition: idCompetition });
}

/* ----------------------------------------------------------------------------
 * Mapeamento JudoBase -> Atleta do jogo (passo 3A-parte-2a)
 * Transforma a resposta de competition.competitors no formato Athlete.
 * Preço de PARTIDA simples (baseado no ranking + vitórias) — o preço real
 * pelo histórico fica para o 3D. variation/avg/last ficam a 0 por agora.
 * -------------------------------------------------------------------------- */

const round1 = (n: number): number => Math.round(n * 10) / 10;
const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

// "RYUJU NAGAYAMA" / "ryuju" -> "Ryuju Nagayama"
function titleCase(s: string): string {
  return s.toLowerCase().replace(/(^|[\s-])([a-zà-ú])/g, (_m, sep: string, c: string) => sep + c.toUpperCase());
}

// Preço de partida (2–20 JC). Melhor ranking => mais caro. Sem ranking => usa vitórias.
function startingPrice(rankingPlace: number | null, won: number, lost: number): number {
  let price: number;
  if (rankingPlace !== null && rankingPlace > 0 && rankingPlace < 9000) {
    price = 19 - Math.log10(rankingPlace) * 5.5; // rank1≈19, rank10≈13.5, rank100≈8, rank1000≈2.5
  } else {
    const total = won + lost;
    const ratio = total > 0 ? won / total : 0.4;
    price = 3 + ratio * 4; // 3..7 para quem não tem ranking
  }
  price += Math.min(won, 12) * 0.1; // pequeno empurrão por vitórias
  return clamp(round1(price), 2, 20);
}

function statusFromPrice(price: number): AthleteStatus {
  if (price >= 15) return "Elite";
  if (price >= 8) return "Barganha";
  return "Aposta";
}

// Recolhe, na árvore "categories", todos os nós-folha (os que têm "persons").
function collectLeaves(node: unknown, out: Record<string, unknown>[]): void {
  if (!node || typeof node !== "object") return;
  const obj = node as Record<string, unknown>;
  if (obj.persons !== undefined && (obj.category !== undefined || obj.gender !== undefined)) {
    out.push(obj);
    return;
  }
  for (const key of Object.keys(obj)) collectLeaves(obj[key], out);
}

/** Converte a resposta crua de competition.competitors numa lista de Athlete. */
export function mapCompetitorsToAthletes(raw: unknown): Athlete[] {
  const data = raw as Record<string, unknown> | null;
  const categories = data?.categories;
  if (!categories || typeof categories !== "object") return [];

  const leaves: Record<string, unknown>[] = [];
  collectLeaves(categories, leaves);

  const athletes: Athlete[] = [];
  const seen = new Set<string>();

  for (const leaf of leaves) {
    const leafCat = String(leaf.category ?? "").trim();
    const genderRaw = String(leaf.gender ?? "").toLowerCase();
    const gender: Gender = genderRaw.startsWith("f") ? "F" : "M";

    const personsRaw = leaf.persons;
    const persons: unknown[] = Array.isArray(personsRaw)
      ? personsRaw
      : personsRaw && typeof personsRaw === "object"
        ? Object.values(personsRaw as Record<string, unknown>)
        : [];

    for (const pu of persons) {
      const p = pu as Record<string, unknown>;
      const id = String(p?.id_person ?? "").trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);

      const given = String(p?.given_name ?? "").trim();
      const family = String(p?.family_name ?? "").trim();
      const name = titleCase(`${given} ${family}`.trim()) || "Atleta";
      const countryIso = (String(p?.country_short ?? "").trim().toUpperCase()) || "—";
      const category = (String(p?.category ?? "").trim() || leafCat) || "-";
      const ranking = toNum(p?.ranking_place);
      const won = toNum(p?.contests_won) ?? 0;
      const lost = toNum(p?.contests_lost) ?? 0;
      const priceJc = startingPrice(ranking, won, lost);

      athletes.push({
        id, name, countryIso, gender, category, priceJc,
        variation: 0, avg: 0, last: 0, status: statusFromPrice(priceJc),
      });
    }
  }

  return athletes;
}

const toInt = (v: any): number => {
  const x = parseInt(String(v ?? "0"), 10);
  return isNaN(x) ? 0 : x;
};

export function personOnSide(f: IjfContest, side: "b" | "w"): string {
  return String(side === "b" ? f.id_person_blue : f.id_person_white || "");
}

export function contestActions(f: IjfContest, side: "b" | "w"): ActionType[] {
  const opp = side === "b" ? "w" : "b";
  const out: ActionType[] = [];
  const push = (a: ActionType, times: number) => { for (let i = 0; i < times; i++) out.push(a); };
  push("ippon_feito", toInt((f as any)[`ippon_${side}`]));
  push("waza_ari_feito", toInt((f as any)[`waza_${side}`]));
  push("yuko_feito", toInt((f as any)[`yuko_${side}`]));
  push("shido_provocado", toInt((f as any)[`penalty_${opp}`]));
  push("ippon_sofrido", toInt((f as any)[`ippon_${opp}`]));
  push("waza_ari_sofrido", toInt((f as any)[`waza_${opp}`]));
  push("yuko_sofrido", toInt((f as any)[`yuko_${opp}`]));
  push("shido_recebido", toInt((f as any)[`penalty_${side}`]));
  return out;
}

export function contestActionsForPerson(f: IjfContest, idPerson: string): ActionType[] {
  if (String(f.id_person_blue) === idPerson) return contestActions(f, "b");
  if (String(f.id_person_white) === idPerson) return contestActions(f, "w");
  return [];
}

export function isRepechage(f: IjfContest): boolean {
  return /rep/i.test(String(f.round_code || ""));
}
