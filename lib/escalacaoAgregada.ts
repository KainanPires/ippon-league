// lib/escalacaoAgregada.ts
//
// MOTOR DOS "MAIS ESCALADOS" — quem a galera mais põe na equipa.
//
// Serve dois sítios:
//   • o cron /api/cron/mais-escalados, que de hora a hora recalcula e GUARDA os
//     agregados na tabela `agregados_escalacao` (rápido de ler depois);
//   • a rota admin /api/admin/mais-escalados, que lê do cache (ou calcula ao
//     vivo com ?fresco=1).
//
// Três escopos:
//   comp:<id>     -> o "time mais escalado" de UMA competição (com %).
//   mes:AAAA-MM   -> acumulado do mês (soma das escalações das competições do mês).
//   ano:AAAA      -> acumulado do ano (o "time do ano").
//
// Contagem por EQUIPA: cada equipa conta 1x por atleta (não interessa se o
// atleta aparece repetido na lista) e 1x para o capitão escolhido. No ano/mês,
// a soma atravessa as competições (um atleta escalado em 3 competições soma 3).
//
// NOTA de colunas: `atletas_cache` usa `id_competition` (inglês); `equipas` e
// `resultados_atletas` usam `id_competicao` (português). É assim na base — não
// é gralha.
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { CALENDARIO_TODAS } from "@/lib/calendario";

export interface AtletaMeta { name: string; countryIso: string; category: string; gender: string }

export interface LinhaEscalacao {
  id: string;
  nome: string;
  pais: string;
  categoria: string;
  escolhas: number;     // nº de equipas que o escalaram (no escopo)
  pct: number;          // % sobre o total de equipas do escopo
  competicoes: number;  // em quantas competições distintas foi escalado (ano/mês)
  capitao: number;      // nº de vezes escolhido como capitão
  capitaoPct: number;
}

export interface AgregadoEscalacao {
  escopo: "comp" | "mes" | "ano";
  chave: string;                         // "comp:3151" | "mes:2026-10" | "ano:2026"
  rotulo: string;                        // nome legível (competição, mês, ano)
  comps: string[];                       // ids das competições incluídas
  total_times: number;                   // soma das equipas (team-rounds) do escopo
  time_mais_escalado: LinhaEscalacao[];  // os 8 primeiros
  ranking: LinhaEscalacao[];             // top N
  top_capitaes: LinhaEscalacao[];        // top 8 por nº de vezes capitão
  atualizado_em: string;
}

/** ids de competições do calendário cujo `de` cai num ano. */
export function compsDoAno(ano: number): string[] {
  const pref = `${ano}/`;
  return CALENDARIO_TODAS.filter((c) => c.de.startsWith(pref)).map((c) => c.idCompeticao);
}

/** ids de competições do calendário cujo `de` cai num mês (AAAA-MM). */
export function compsDoMes(anoMes: string): string[] {
  const [ano, mes] = anoMes.split("-");
  const pref = `${ano}/${mes}/`;
  return CALENDARIO_TODAS.filter((c) => c.de.startsWith(pref)).map((c) => c.idCompeticao);
}

/** Mapa id->meta a partir dos atletas_cache das competições dadas. */
async function metaGlobal(compIds: string[]): Promise<Map<string, AtletaMeta>> {
  const mapa = new Map<string, AtletaMeta>();
  if (!supabaseAdmin || compIds.length === 0) return mapa;
  try {
    const { data } = await supabaseAdmin
      .from("atletas_cache").select("id_competition, atletas").in("id_competition", compIds);
    for (const row of data || []) {
      const lista = Array.isArray(row?.atletas) ? (row.atletas as Array<Record<string, unknown>>) : [];
      for (const a of lista) {
        if (a?.id == null) continue;
        const id = String(a.id);
        if (mapa.get(id)?.name) continue; // a 1ª com nome ganha
        mapa.set(id, {
          name: a.name != null ? String(a.name) : "",
          countryIso: a.countryIso != null ? String(a.countryIso) : "",
          category: a.category != null ? String(a.category) : "",
          gender: a.gender != null ? String(a.gender) : "",
        });
      }
    }
  } catch { /* segue para o fallback */ }
  return mapa;
}

/** Fallback: nomes congelados em resultados_atletas, para ids ainda sem nome. */
async function completarNomes(mapa: Map<string, AtletaMeta>, faltam: string[], compIds: string[]): Promise<void> {
  if (!supabaseAdmin || faltam.length === 0 || compIds.length === 0) return;
  try {
    const { data } = await supabaseAdmin
      .from("resultados_atletas")
      .select("id_person, nome, country_code, weight_category, gender")
      .in("id_competicao", compIds);
    const querem = new Set(faltam);
    for (const r of data || []) {
      const id = String(r.id_person);
      if (!querem.has(id) || mapa.get(id)?.name) continue;
      mapa.set(id, {
        name: r.nome != null ? String(r.nome) : "",
        countryIso: r.country_code != null ? String(r.country_code) : "",
        category: r.weight_category != null ? String(r.weight_category) : "",
        gender: r.gender != null ? String(r.gender) : "",
      });
    }
  } catch { /* fica o id */ }
}

function vazio(escopo: AgregadoEscalacao["escopo"], chave: string, rotulo: string, comps: string[]): AgregadoEscalacao {
  return {
    escopo, chave, rotulo, comps,
    total_times: 0, time_mais_escalado: [], ranking: [], top_capitaes: [],
    atualizado_em: new Date().toISOString(),
  };
}

/** Núcleo: lê as equipas de um conjunto de competições e agrega. */
export async function calcularEscalacoes(opts: {
  escopo: "comp" | "mes" | "ano";
  chave: string;
  rotulo: string;
  comps: string[];
  n?: number;
}): Promise<AgregadoEscalacao> {
  const n = Math.max(8, Math.min(50, opts.n ?? 20));
  if (!supabaseAdmin || opts.comps.length === 0) return vazio(opts.escopo, opts.chave, opts.rotulo, opts.comps);

  const { data: equipas } = await supabaseAdmin
    .from("equipas").select("atletas, capitao, id_competicao").in("id_competicao", opts.comps);
  const lista = equipas || [];
  const totalTimes = lista.length;
  if (totalTimes === 0) return vazio(opts.escopo, opts.chave, opts.rotulo, opts.comps);

  const escolhas = new Map<string, number>();
  const capitaes = new Map<string, number>();
  const compsPorAtleta = new Map<string, Set<string>>();
  for (const e of lista) {
    const comp = String(e.id_competicao ?? "");
    const ids = Array.isArray(e.atletas) ? (e.atletas as unknown[]).map(String) : [];
    const vistos = new Set<string>();
    for (const id of ids) {
      if (!id || vistos.has(id)) continue;
      vistos.add(id);
      escolhas.set(id, (escolhas.get(id) ?? 0) + 1);
      if (!compsPorAtleta.has(id)) compsPorAtleta.set(id, new Set<string>());
      if (comp) compsPorAtleta.get(id)!.add(comp);
    }
    const cap = e.capitao ? String(e.capitao) : "";
    if (cap) capitaes.set(cap, (capitaes.get(cap) ?? 0) + 1);
  }

  const meta = await metaGlobal(opts.comps);
  const faltam = [...escolhas.keys()].filter((id) => !meta.get(id)?.name);
  await completarNomes(meta, faltam, opts.comps);
  const nomeDe = (id: string) => meta.get(id)?.name || `#${id}`;
  const pct = (x: number) => (totalTimes > 0 ? Math.round((x / totalTimes) * 1000) / 10 : 0);

  const linha = (id: string, c: number): LinhaEscalacao => ({
    id,
    nome: nomeDe(id),
    pais: meta.get(id)?.countryIso || "",
    categoria: meta.get(id)?.category || "",
    escolhas: c,
    pct: pct(c),
    competicoes: compsPorAtleta.get(id)?.size ?? 0,
    capitao: capitaes.get(id) ?? 0,
    capitaoPct: pct(capitaes.get(id) ?? 0),
  });

  const ranking = [...escolhas.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([id, c]) => linha(id, c));

  const top_capitaes = [...capitaes.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([id]) => linha(id, escolhas.get(id) ?? 0));

  return {
    escopo: opts.escopo, chave: opts.chave, rotulo: opts.rotulo, comps: opts.comps,
    total_times: totalTimes,
    time_mais_escalado: ranking.slice(0, 8),
    ranking,
    top_capitaes,
    atualizado_em: new Date().toISOString(),
  };
}

/** Guarda um agregado na tabela de cache. Best-effort. */
export async function guardarAgregado(a: AgregadoEscalacao): Promise<void> {
  if (!supabaseAdmin) return;
  try {
    await supabaseAdmin.from("agregados_escalacao").upsert({
      chave: a.chave,
      rotulo: a.rotulo,
      total_times: a.total_times,
      dados: a as unknown as Record<string, unknown>,
      atualizado_em: a.atualizado_em,
    }, { onConflict: "chave" });
  } catch { /* o cálculo vale; o cache é um extra */ }
}

/** Lê um agregado do cache. null se não existir. */
export async function lerAgregado(chave: string): Promise<AgregadoEscalacao | null> {
  if (!supabaseAdmin) return null;
  try {
    const { data } = await supabaseAdmin
      .from("agregados_escalacao").select("dados").eq("chave", chave).maybeSingle();
    if (!data?.dados) return null;
    return data.dados as unknown as AgregadoEscalacao;
  } catch { return null; }
}
