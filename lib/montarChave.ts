// lib/montarChave.ts
//
// FONTE ÚNICA da chave desenhada. Lê da base (molduras + resultados + cache),
// corre o motor e devolve a chave pronta, com o estado da categoria e as ações
// por luta já anexadas. NÃO tem Paywall nem decide competição — isso é da API.
//
// Existe para que a /api/chave-atletas E o cron alerta-chave usem EXATAMENTE a
// mesma lógica (uma verdade, um sítio). Antes, a lógica vivia dentro da API e o
// alerta-chave chamava a API antiga /api/chave — o que obrigava a furar o
// Paywall. Agora ambos leem a base diretamente por aqui.
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  desenharChave,
  type MolduraCategoria,
  type ResultadosPorId,
  type IdentidadesPorId,
  type PoolId,
  type ChaveDesenhada,
} from "@/lib/motorChave";

export type EstadoCategoria = "naoComecou" | "aDecorrer" | "terminada";

export interface ChaveMontada {
  existeMoldura: boolean;
  genero: string | null;
  estado: EstadoCategoria;
  chave: ChaveDesenhada | null;
  // Quadro INICIAL (motor sem resultados) — usado pelo Paywall do Pro.
  chaveInicial: ChaveDesenhada | null;
  moldura: { pools: Record<PoolId, string[]>; byes: Partial<Record<PoolId, string[]>> | null } | null;
  infos: Record<string, { pontos: number; nLutas: number; acoes: unknown }>;
}

const POOLS: PoolId[] = ["A", "B", "C", "D"];

// Monta a chave de uma categoria (comp + cat) a partir da base de dados.
// Devolve existeMoldura:false se a categoria não tiver moldura montada.
export async function montarChaveDaBase(comp: string, cat: string): Promise<ChaveMontada> {
  const vazio: ChaveMontada = {
    existeMoldura: false, genero: null, estado: "naoComecou",
    chave: null, chaveInicial: null, moldura: null, infos: {},
  };
  if (!supabaseAdmin || !comp || !cat) return vazio;

  // 1) Moldura da categoria.
  const { data: linha, error: errMold } = await supabaseAdmin
    .from("chave_atletas")
    .select("genero, pools")
    .eq("id_competicao", comp)
    .eq("weight_category", cat)
    .maybeSingle();
  if (errMold || !linha || !linha.pools) return vazio;

  // Normaliza a moldura.
  const poolsRaw = linha.pools as Record<string, unknown>;
  const pools = {} as Record<PoolId, string[]>;
  for (const p of POOLS) {
    const arr = Array.isArray(poolsRaw?.[p]) ? (poolsRaw[p] as unknown[]) : [];
    pools[p] = arr.map((x) => String(x));
  }
  let byes: Partial<Record<PoolId, string[]>> | undefined;
  const byesRaw = (poolsRaw?.["byes"] ?? null) as Record<string, unknown> | null;
  if (byesRaw) {
    byes = {};
    for (const p of POOLS) {
      const arr = Array.isArray(byesRaw?.[p]) ? (byesRaw[p] as unknown[]) : [];
      if (arr.length) byes[p] = arr.map((x) => String(x));
    }
  }
  const moldura: MolduraCategoria = { pools, byes };

  const todosIds = new Set<string>();
  for (const p of POOLS) for (const id of pools[p]) todosIds.add(id);

  // 2) Movimento + pontos + ações da tabela (mantida fresca pelo cron).
  const { data: res } = await supabaseAdmin
    .from("resultados_atletas")
    .select("id_person, nome, country_code, vitorias, derrotas, pontos, n_lutas, vencidos, lutas, acoes")
    .eq("id_competicao", comp)
    .eq("weight_category", cat);
  const resultados: ResultadosPorId = {};
  const identidades: IdentidadesPorId = {};
  const infos: Record<string, { pontos: number; nLutas: number; acoes: unknown }> = {};
  const acoesPar: Record<string, { i: number; w: number; y: number; s: number }> = {};
  for (const r of res || []) {
    const id = String(r.id_person);
    const venc = Array.isArray(r.vencidos) ? (r.vencidos as unknown[]).map((x) => String(x)) : [];
    resultados[id] = { vitorias: Number(r.vitorias) || 0, derrotas: Number(r.derrotas) || 0, vencidos: venc };
    identidades[id] = { nome: r.nome ? String(r.nome) : undefined, pais: r.country_code ? String(r.country_code) : undefined };
    infos[id] = { pontos: Number(r.pontos) || 0, nLutas: Number(r.n_lutas) || 0, acoes: r.acoes ?? null };
    const lutas = Array.isArray(r.lutas) ? (r.lutas as Array<Record<string, unknown>>) : [];
    for (const lt of lutas) {
      const adv = lt?.adv != null ? String(lt.adv) : "";
      if (!adv) continue;
      acoesPar[`${id}->${adv}`] = {
        i: Number(lt.i) || 0, w: Number(lt.w) || 0, y: Number(lt.y) || 0, s: Number(lt.s) || 0,
      };
    }
  }

  // 3) Nomes de todos os inscritos (cache) — para byes/quem ainda não lutou.
  try {
    const { data: cacheRow } = await supabaseAdmin
      .from("atletas_cache").select("atletas").eq("id_competition", comp).maybeSingle();
    const lista = Array.isArray(cacheRow?.atletas)
      ? (cacheRow!.atletas as Array<{ id?: unknown; name?: unknown; countryIso?: unknown }>)
      : [];
    for (const a of lista) {
      const id = a?.id != null ? String(a.id) : "";
      if (!id || !todosIds.has(id)) continue;
      const atual = identidades[id] || {};
      if (!atual.nome && a?.name) atual.nome = String(a.name);
      if (!atual.pais && a?.countryIso) atual.pais = String(a.countryIso);
      identidades[id] = atual;
    }
  } catch { /* segue com o que houver */ }

  // 4) Corre o motor.
  const chave = desenharChave(moldura, resultados, identidades);

  // Estado da categoria.
  const todasLutas = [
    ...POOLS.flatMap((p) => chave.pools[p].lutas),
    ...chave.meias,
    ...(chave.final ? [chave.final] : []),
    ...chave.repescagens,
    ...chave.bronzes,
  ];
  const estado: EstadoCategoria =
    chave.campeao ? "terminada"
      : todasLutas.some((l) => l && l.vencedor) ? "aDecorrer"
        : "naoComecou";

  // 5) Anexa a cada lado de cada luta as ações daquele confronto.
  const aplicar = (luta: { azul: { id: string | null; acoes?: unknown }; branco: { id: string | null; acoes?: unknown } } | null) => {
    if (!luta) return;
    const a = luta.azul?.id, b = luta.branco?.id;
    if (a && b) {
      const av = acoesPar[`${a}->${b}`];
      const bv = acoesPar[`${b}->${a}`];
      if (av) luta.azul.acoes = av;
      if (bv) luta.branco.acoes = bv;
    }
  };
  for (const p of POOLS) for (const l of chave.pools[p].lutas) aplicar(l);
  for (const l of chave.meias) aplicar(l);
  aplicar(chave.final);
  for (const l of chave.repescagens) aplicar(l);
  for (const l of chave.bronzes) aplicar(l);

  // Quadro inicial (motor sem resultados) — para o Paywall do Pro.
  const chaveInicial = desenharChave(moldura, {}, identidades);

  return {
    existeMoldura: true,
    genero: linha.genero ? String(linha.genero) : null,
    estado,
    chave,
    chaveInicial,
    moldura: { pools, byes: byes ?? null },
    infos,
  };
}
