// Gestão da equipa: rascunho (em edição) vs guardada (oficial).
// Agora cada equipa pertence a UMA competição (id_competicao). O rascunho e a
// equipa guardada são por competição, por isso montar para o Tahiti não mexe na
// equipa do Ulaanbaatar. As funções antigas (sem competição) continuam a existir
// para compatibilidade, mas as páginas devem migrar para as versões "ParaComp".
import { ATHLETES, type Athlete } from "@/lib/athletes";
import { supabase } from "@/lib/supabase";

export type TeamState = { ids: string[]; captain: string | null };

const DRAFT = "ippon_team_draft";
const SAVED = "ippon_team_saved";
const LEGACY = "ippon_team"; // versão antiga (só ids)
const POOL = "ippon_athletes_pool"; // memória partilhada dos atletas reais (do Mercado)
export const START_JC = 100;

// Chaves por competição: "ippon_team_draft__3295".
function draftKey(idComp?: string) { return idComp ? `${DRAFT}__${idComp}` : DRAFT; }
function savedKey(idComp?: string) { return idComp ? `${SAVED}__${idComp}` : SAVED; }

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

// ---- LOCAL (sem competição — compatibilidade) -----------------------------
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

// ---- LOCAL por competição --------------------------------------------------
export function loadDraftFor(idComp: string): TeamState {
  return read(draftKey(idComp)) || { ids: [], captain: null };
}
export function saveDraftFor(idComp: string, t: TeamState) {
  try { localStorage.setItem(draftKey(idComp), JSON.stringify(t)); } catch {}
}
export function loadSavedFor(idComp: string): TeamState {
  return read(savedKey(idComp)) || { ids: [], captain: null };
}
export function commitSavedFor(idComp: string, t: TeamState) {
  try {
    localStorage.setItem(savedKey(idComp), JSON.stringify(t));
    localStorage.setItem(draftKey(idComp), JSON.stringify(t));
  } catch {}
}

// ---- Pool de atletas reais (preenchida pelo Mercado a partir do JudoBase) ---
// O resolve usa esta pool quando existir; senão cai nos atletas de exemplo.
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

// ---- Cálculo (igual) -------------------------------------------------------
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
// NUVEM (Supabase) — equipa oficial ligada à conta do jogador E à competição.
// ---------------------------------------------------------------------------
export type CloudResult = { ok: boolean; error?: string };
type TeamIdentity = { name?: string; [k: string]: unknown };

/**
 * Grava a equipa oficial de uma competição: primeiro no dispositivo (rápido),
 * depois na conta do jogador (tabela `equipas`, uma por user+competição).
 */
export async function commitSavedCloudFor(idComp: string, t: TeamState, identity?: TeamIdentity): Promise<CloudResult> {
  commitSavedFor(idComp, t);
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id as string | undefined;
    if (!userId) return { ok: false, error: "sem sessão" };

    const payload: Record<string, unknown> = {
      user_id: userId,
      id_competicao: idComp,
      atletas: t.ids,
      capitao: t.captain,
      atualizado_em: new Date().toISOString(),
    };
    if (identity) {
      if (identity.name) payload.nome = identity.name;
      payload.escudo = identity;
    }

    const { error } = await supabase.from("equipas").upsert(payload, { onConflict: "user_id,id_competicao" });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    const msg = (e as { message?: string })?.message || "erro desconhecido";
    return { ok: false, error: msg };
  }
}

/**
 * Lê a equipa oficial de uma competição guardada na conta do jogador.
 * Devolve null se não houver sessão, se não houver equipa, ou em erro de rede.
 */
export async function loadSavedCloudFor(idComp: string): Promise<TeamState | null> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id as string | undefined;
    if (!userId) return null;

    const { data, error } = await supabase
      .from("equipas")
      .select("atletas, capitao")
      .eq("user_id", userId)
      .eq("id_competicao", idComp)
      .maybeSingle();

    if (error || !data) return null;
    const ids = Array.isArray(data.atletas) ? (data.atletas as string[]) : [];
    const captain = (data.capitao as string | null) ?? null;
    return { ids, captain };
  } catch {
    return null;
  }
}

// ---- Cloud antigas (compatibilidade — assumem a competição atual) ----------
// Mantidas para as páginas ainda não migradas não partirem. Internamente já não
// devem ser a via principal; preferir as versões "...For".
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
