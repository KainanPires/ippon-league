// Gestão da equipa: rascunho (em edição) vs guardada (oficial).
// O rascunho só passa a "guardada" quando o jogador carrega em Salvar.
import { ATHLETES, type Athlete } from "@/lib/athletes";

export type TeamState = { ids: string[]; captain: string | null };

const DRAFT = "ippon_team_draft";
const SAVED = "ippon_team_saved";
const LEGACY = "ippon_team"; // versão antiga (só ids)

export const START_JC = 100;

function read(key: string): TeamState | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (Array.isArray(p)) return { ids: p, captain: null };
    return { ids: Array.isArray(p.ids) ? p.ids : [], captain: p.captain ?? null };
  } catch {
    return null;
  }
}

export function loadDraft(): TeamState {
  return read(DRAFT) || read(LEGACY) || { ids: [], captain: null };
}
export function saveDraft(t: TeamState) {
  try { localStorage.setItem(DRAFT, JSON.stringify(t)); } catch {}
}
export function loadSaved(): TeamState {
  return read(SAVED) || { ids: [], captain: null };
}
export function commitSaved(t: TeamState) {
  try {
    localStorage.setItem(SAVED, JSON.stringify(t));
    localStorage.setItem(DRAFT, JSON.stringify(t));
  } catch {}
}

export function resolve(ids: string[]): Athlete[] {
  return ids.map((id) => ATHLETES.find((a) => a.id === id)).filter(Boolean) as Athlete[];
}
export function jcLeft(t: TeamState): number {
  const a = resolve(t.ids);
  return Math.round((START_JC - a.reduce((s, x) => s + x.priceJc, 0)) * 10) / 10;
}
export function counts(t: TeamState) {
  const a = resolve(t.ids);
  return { m: a.filter((x) => x.gender === "M").length, f: a.filter((x) => x.gender === "F").length, total: a.length };
}
export function isComplete(t: TeamState): boolean {
  const c = counts(t);
  return c.m === 4 && c.f === 4 && !!t.captain;
}
export function missing(t: TeamState): string[] {
  const c = counts(t);
  const out: string[] = [];
  if (c.m < 4) out.push(`${4 - c.m} atleta${4 - c.m > 1 ? "s" : ""} masculino${4 - c.m > 1 ? "s" : ""}`);
  if (c.f < 4) out.push(`${4 - c.f} atleta${4 - c.f > 1 ? "s" : ""} feminino${4 - c.f > 1 ? "s" : ""}`);
  if (!t.captain) out.push("escolher o capitão");
  return out;
}
