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
const PRECOS = "ippon_team_precos"; // preço de compra por atleta (para o património)
export const START_JC = 100;

// Chaves por competição: "ippon_team_draft__3295".
function draftKey(idComp?: string) { return idComp ? `${DRAFT}__${idComp}` : DRAFT; }
function savedKey(idComp?: string) { return idComp ? `${SAVED}__${idComp}` : SAVED; }
function precosKey(idComp?: string) { return idComp ? `${PRECOS}__${idComp}` : PRECOS; }

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
    // Guarda o preço de compra de cada atleta neste momento (para o património).
    localStorage.setItem(precosKey(idComp), JSON.stringify(pricesOf(t)));
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

// ---- Preço de compra / património -----------------------------------------
// Mapa { id_person: preço } com o preço ATUAL de cada atleta da equipa — usado
// como "preço de compra" no momento em que a equipa é guardada.
export function pricesOf(t: TeamState): Record<string, number> {
  const out: Record<string, number> = {};
  for (const a of resolve(t.ids)) out[a.id] = a.priceJc;
  return out;
}
// Lê os preços de compra guardados localmente para uma competição.
export function loadPrecosFor(idComp: string): Record<string, number> {
  try {
    const raw = localStorage.getItem(precosKey(idComp));
    if (raw) {
      const p = JSON.parse(raw);
      if (p && typeof p === "object") return p as Record<string, number>;
    }
  } catch {}
  return {};
}
// Lê os preços de compra guardados na nuvem (tabela equipas) para uma competição.
export async function loadPrecosCloudFor(idComp: string): Promise<Record<string, number>> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id as string | undefined;
    if (!userId) return {};
    const { data, error } = await supabase
      .from("equipas")
      .select("precos")
      .eq("user_id", userId)
      .eq("id_competicao", idComp)
      .maybeSingle();
    if (error || !data || !data.precos || typeof data.precos !== "object") return {};
    return data.precos as Record<string, number>;
  } catch {
    return {};
  }
}
// Património = 100 + Σ (preço de agora − preço de compra) dos atletas da equipa.
// Sem atletas, ou sem preços de compra, devolve exatamente START_JC (100).
export function patrimonio(t: TeamState, precosCompra: Record<string, number>): number {
  const atuais = resolve(t.ids);
  let delta = 0;
  for (const a of atuais) {
    const compra = precosCompra[a.id];
    if (typeof compra === "number") delta += a.priceJc - compra;
  }
  return Math.round((START_JC + delta) * 10) / 10;
}

// ---------------------------------------------------------------------------
// CARRY-OVER ENTRE COMPETIÇÕES
// ---------------------------------------------------------------------------
// Quando uma nova competição abre, a equipa NÃO transita sozinha: cada equipa é
// guardada por competição e a nova começa vazia. Estas funções trazem a última
// equipa guardada como PONTO DE PARTIDA e largam quem não está inscrito na nova.
// Decisão (opção A): só semeamos o rascunho — NÃO há commit automático na nuvem.
// A pessoa revê e carrega em "Salvar equipa" ("Reescala o teu time", liberdade
// total para trocar só os que cairam ou refazer tudo). Assim nunca se grava uma
// equipa furada (sem capitão / com menos de 8): o isComplete trata disso.

export type CarryResult = {
  team: TeamState;          // equipa já podada (só inscritos); capitão limpo se caiu
  dropped: string[];        // ids dos atletas que sairam por não estarem inscritos
  captainDropped: boolean;  // o capitão estava entre os que sairam
};

// Poda uma equipa-base contra os atletas INSCRITOS na competição-alvo.
// `inscritosIds` = ids (id_person) presentes na pool da competição-alvo.
// GUARDA DE SEGURANÇA: se a lista de inscritos vier vazia, NÃO larga ninguém
// (evita apagar a equipa por uma falha de rede ou pool ainda não carregada).
export function carryOver(base: TeamState, inscritosIds: string[]): CarryResult {
  if (base.ids.length === 0 || inscritosIds.length === 0) {
    return { team: base, dropped: [], captainDropped: false };
  }
  const inscritos = new Set(inscritosIds);
  const ficam = base.ids.filter((id) => inscritos.has(id));
  const dropped = base.ids.filter((id) => !inscritos.has(id));
  const captainDropped = base.captain != null && !inscritos.has(base.captain);
  return {
    team: { ids: ficam, captain: captainDropped ? null : base.captain },
    dropped,
    captainDropped,
  };
}

// A última equipa guardada na nuvem que NÃO seja a da competição-alvo (a mais
// recente). Serve de base ao carry-over. Ordena por `atualizado_em`; se essa
// coluna não existir no schema, tenta de novo sem ordenação (não parte nada).
export async function loadLatestSavedCloudExcept(
  idCompAlvo: string
): Promise<{ team: TeamState; idComp: string } | null> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id as string | undefined;
    if (!userId) return null;

    const base = supabase
      .from("equipas")
      .select("atletas, capitao, id_competicao, atualizado_em")
      .eq("user_id", userId)
      .neq("id_competicao", idCompAlvo);

    // 1ª tentativa: a mais recente por atualizado_em.
    let resp = await base
      .order("atualizado_em", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Se a coluna de ordenação não existir (ou outro erro), tenta sem order.
    if (resp.error) {
      resp = await supabase
        .from("equipas")
        .select("atletas, capitao, id_competicao")
        .eq("user_id", userId)
        .neq("id_competicao", idCompAlvo)
        .limit(1)
        .maybeSingle();
    }

    const data = resp.data as
      | { atletas?: unknown; capitao?: unknown; id_competicao?: unknown }
      | null;
    if (resp.error || !data) return null;
    const ids = Array.isArray(data.atletas) ? (data.atletas as string[]) : [];
    if (ids.length === 0) return null;
    const captain = (data.capitao as string | null) ?? null;
    return { team: { ids, captain }, idComp: String(data.id_competicao) };
  } catch {
    return null;
  }
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
      precos: pricesOf(t), // preço de compra de cada atleta, para o património
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
