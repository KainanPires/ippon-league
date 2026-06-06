// Gestão da equipa: rascunho (em edição) vs guardada (oficial).
// O rascunho só passa a "guardada" quando o jogador carrega em Salvar.
import { ATHLETES, type Athlete } from "@/lib/athletes";
import { supabase } from "@/lib/supabase";
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

// ---------------------------------------------------------------------------
// NUVEM (Supabase) — equipa oficial ligada à conta do jogador.
// As funções acima continuam a funcionar exatamente como antes (cache local,
// instantâneo). Estas novas falam com a internet, por isso são assíncronas.
// ---------------------------------------------------------------------------

export type CloudResult = { ok: boolean; error?: string };

/** Identidade mínima da equipa (nome e, opcionalmente, escudo/cores). */
type TeamIdentity = { name?: string; [k: string]: unknown };

/**
 * Grava a equipa oficial: primeiro no dispositivo (rápido), depois na conta do
 * jogador (tabela `equipas`). Devolve ok:false se não houver sessão ou a nuvem falhar.
 */
export async function commitSavedCloud(t: TeamState, identity?: TeamIdentity): Promise<CloudResult> {
  // 1) Garante o cache local imediatamente (mesmo que a nuvem falhe).
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

/**
 * Lê a equipa oficial guardada na conta do jogador. Devolve null se não houver
 * sessão, se não houver equipa guardada, ou em caso de erro de rede.
 * NÃO escreve no cache local — quem decide sincronizar é a tela.
 */
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
