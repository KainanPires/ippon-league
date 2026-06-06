// Gestão da equipa: rascunho (em edição) vs guardada (oficial).
// O rascunho só passa a "guardada" quando o jogador carrega em Salvar.
import { ATHLETES, type Athlete } from "@/lib/athletes";
import { supabase } from "@/lib/supabase";
export type TeamState = { ids: string[]; captain: string | null };
const DRAFT = "ippon_team_draft";
const SAVED = "ippon_team_saved";
const LEGACY = "ippon_team"; // versão antiga (só ids)
const POOL = "ippon_athletes_pool"; // memória partilhada dos atletas reais (do Mercado)
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

/* ----------------------------------------------------------------------------
 * Memória partilhada de atletas (POOL)
 * O Mercado vai buscar os atletas reais ao /api/atletas e guarda-os aqui.
 * Todas as telas resolvem a equipa a partir desta lista (com fallback aos
 * atletas de exemplo enquanto a pool não estiver preenchida).
 * -------------------------------------------------------------------------- */
export function setAthletePool(list: Athlete[]) {
  try { localStorage.setItem(POOL, JSON.stringify(list)); } catch {}
}
export function getAthletePool(): Athlete[] {
  try {
    const raw = localStorage.getItem(POOL);
    if (raw) {
      const p = JSON.parse(raw);
      if (Array.isArray(p)) return p as Athlete[];
    }
  } catch {}
  return [];
}

export function resolve(ids: string[]): Athlete[] {
  const pool = getAthletePool();
  const source = pool.length > 0 ? pool : ATHLETES; // atletas reais quando existirem
  const byId = new Map<string, Athlete>();
  for (const a of source) byId.set(a.id, a);
  return ids.map((id) => byId.get(id)).filter(Boolean) as Athlete[];
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

// ---------------------------------------------------------------------------
// NUVEM (Supabase) — equipa oficial ligada à conta do jogador.
// ---------------------------------------------------------------------------

export type CloudResult = { ok: boolean; error?: string };
type TeamIdentity = { name?: string; [k: string]: unknown };

export async function commitSavedCloud(t: TeamState, identity?: TeamIdentity): Promise<CloudResult> {
  commitSaved(t);
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id as string | undefined;
    if (!userId) return { ok: false, error: "sem sessão" };

    const payload: Record<string, unknown> = {
      user_id: userId,
      atletas: t.ids,
      capitao: t.captain,
      atualizado_em: new Date().toISOString(),
    };
    if (identity) {
      if (identity.name) payload.nome = identity.name;
      payload.escudo = identity;
    }

    const { error } = await supabase.from("equipas").upsert(payload, { onConflict: "user_id" });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    const msg = (e as { message?: string })?.message || "erro desconhecido";
    return { ok: false, error: msg };
  }
}

export async function loadSavedCloud(): Promise<TeamState | null> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id as string | undefined;
    if (!userId) return null;

    const { data, error } = await supabase
      .from("equipas")
      .select("atletas, capitao")
      .eq("user_id", userId)
      .maybeSingle();

    if (error || !data) return null;

    const ids = Array.isArray(data.atletas) ? (data.atletas as string[]) : [];
    const captain = (data.capitao as string | null) ?? null;
    return { ids, captain };
  } catch {
    return null;
  }
}
