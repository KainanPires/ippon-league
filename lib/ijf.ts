/**
 * Ippon League — Camada de dados do JudoBase (IJF)
 * ------------------------------------------------
 * Funções tipadas para falar com a API pública do JudoBase.
 * USAR APENAS NO SERVIDOR (Server Components / Route Handlers) — não no cliente.
 *
 * Host: data.ijf.org  (o data.judobase.org trava a partir da Vercel — não usar)
 * Padrão: /api/get_json?access_token=&params[action]=ACAO&params[CHAVE]=VALOR
 *
 * Ações confirmadas a funcionar:
 *   competition.get_list (year)          -> lista de competições do ano
 *   competition.info (id_competition)    -> detalhes de uma competição
 *   competition.contests (id_competition)-> {contests:[...]}  as lutas (resultados/ações)
 *   competitor.info (id_person)          -> perfil de um atleta
 *   competitor.contests (id_person)      -> {contests:[...]}  histórico de lutas do atleta
 *
 * A pontuação de fantasy NÃO está aqui — está em lib/engine.ts.
 * Aqui só trazemos os dados e mapeamos os campos crus para as nossas ActionType.
 */

import type { ActionType } from "@/lib/engine";

const IJF = "https://data.ijf.org/api/get_json";
const TIMEOUT_MS = 15000;

/* ----------------------------------------------------------------------------
 * Tipos crus (subconjunto dos campos úteis). A API devolve quase tudo como string.
 * -------------------------------------------------------------------------- */

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
  ages?: string[];        // ex.: ["sen"], ["jun"], ["cad"]
  has_results?: string;   // "0" / "1"
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
  round_name?: string;    // ex.: "best 32", "Quarter Final", "Final"
  round_code?: string;    // contém "rep" quando é repescagem
  mat_number?: string;
  start_planned?: string;
  start?: string;
  end?: string;
  duration?: string;
  // pontuações por lado: _b = azul, _w = branco
  ippon_b?: string; waza_b?: string; yuko_b?: string; penalty_b?: string;
  ippon_w?: string; waza_w?: string; yuko_w?: string; penalty_w?: string;
}

export interface IjfCompetitor {
  family_name?: string;
  given_name?: string;
  short_name?: string;
  gender?: string;        // "male" / "female"
  country?: string;
  country_short?: string;
  categories?: string[];  // ex.: ["-60","-66"]
  belt?: string;
  birth_date?: string;
  dob_year?: string;
  age?: string;
  club?: string;
  ftechique?: string;     // técnica favorita (sic, como vem da API)
}

/* ----------------------------------------------------------------------------
 * Chamada base
 * -------------------------------------------------------------------------- */

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

/* ----------------------------------------------------------------------------
 * Funções públicas
 * -------------------------------------------------------------------------- */

/** Lista de competições de um ano (calendário bruto). */
export async function getCompetitions(year: number): Promise<IjfCompetition[]> {
  const data = await call<IjfCompetition[]>("competition.get_list", { year: String(year) });
  return Array.isArray(data) ? data : [];
}

/** Detalhes de uma competição. */
export async function getCompetition(idCompetition: string): Promise<IjfCompetition | null> {
  const data = await call<IjfCompetition>("competition.info", { id_competition: idCompetition });
  return data && (data as any).id_competition ? data : null;
}

/** Todas as lutas de uma competição (resultados + ações). */
export async function getCompetitionContests(idCompetition: string): Promise<IjfContest[]> {
  const data = await call<{ contests?: IjfContest[] }>("competition.contests", { id_competition: idCompetition });
  return data?.contests ?? [];
}

/** Perfil de um atleta. */
export async function getCompetitor(idPerson: string): Promise<IjfCompetitor | null> {
  const data = await call<IjfCompetitor>("competitor.info", { id_person: idPerson });
  return data && data.family_name ? data : null;
}

/** Histórico de lutas de um atleta. */
export async function getCompetitorContests(idPerson: string): Promise<IjfContest[]> {
  const data = await call<{ contests?: IjfContest[] }>("competitor.contests", { id_person: idPerson });
  return data?.contests ?? [];
}

/* ----------------------------------------------------------------------------
 * Ponte JudoBase -> motor (lib/engine)
 * -------------------------------------------------------------------------- */

const toInt = (v: any): number => {
  const x = parseInt(String(v ?? "0"), 10);
  return isNaN(x) ? 0 : x;
};

/** Devolve o id_person de um lado da luta. */
export function personOnSide(f: IjfContest, side: "b" | "w"): string {
  return String(side === "b" ? f.id_person_blue : f.id_person_white || "");
}

/**
 * Converte UMA luta, do ponto de vista de um lado (azul "b" ou branco "w"),
 * na lista de ações do nosso motor.
 *   - o que fez:      ippon/waza/yuko do próprio lado
 *   - shido provocado: shidos do adversário
 *   - o que sofreu:   ippon/waza/yuko do adversário
 *   - shido recebido:  shidos do próprio lado
 */
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

/** Lista de ações de um atleta numa luta, identificando-o pelo id_person. */
export function contestActionsForPerson(f: IjfContest, idPerson: string): ActionType[] {
  if (String(f.id_person_blue) === idPerson) return contestActions(f, "b");
  if (String(f.id_person_white) === idPerson) return contestActions(f, "w");
  return [];
}

/** True se a luta é de repescagem (pelo código do round). */
export function isRepechage(f: IjfContest): boolean {
  return /rep/i.test(String(f.round_code || ""));
}
