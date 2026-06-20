// lib/motorChave.ts
//
// MOTOR DA CHAVE DE ATLETAS (Ippon League — Pro Max) — VERSÃO 2.
//
// O QUE MUDOU FACE À v1 (e PORQUÊ):
//   A v1 decidia TODOS os confrontos por "ganhou quem tem mais vitórias totais".
//   Isso está correto DENTRO do pool, antes da final — mas erra nos nós de garfo
//   (final do pool, meias, bronzes), porque o perdedor desses nós continua a
//   ganhar lutas na repescagem/bronze e ultrapassa o vencedor em vitórias totais.
//   Também enganava com byes e pools de tamanho diferente (comparar vitórias
//   totais entre atletas de pools diferentes não é justo: quem teve bye tem menos
//   uma vitória sem ter perdido).
//
//   A v2 resolve em duas camadas, ambas validadas por simulação (milhares de
//   torneios com pools irregulares + byes + competição a meio):
//
//   (1) CORPO DOS POOLS — por CONSUMO. Quem perde ANTES da final do pool está
//       eliminado para sempre (regra-âncora IJF): as suas vitórias "congelam".
//       Percorrendo o pool de baixo para cima e "gastando" as vitórias já usadas,
//       em cada confronto o vencedor é o único que ainda tem vitórias por gastar.
//       Isto identifica SEMPRE os 2 finalistas de cada pool, mesmo com byes.
//
//   (2) FASE DE MEDALHAS (finais de pool, meias, final, repescagens, bronzes) —
//       por CONSISTÊNCIA. Enumeramos os resultados possíveis e ficamos só com os
//       que reproduzem EXATAMENTE os totais (vitórias/derrotas) dos 8 finalistas.
//       Um nó só é dado como DECIDIDO se todas as soluções consistentes
//       concordarem nele; caso contrário fica "a decidir" (estado "agendada").
//
//   PROPRIEDADE DE OURO (testada): o motor NUNCA afirma um vencedor errado.
//   Ou acerta, ou diz que ainda não dá para saber. Ao vivo, cada final de pool
//   é decidida no momento em que acontece (antes de a repescagem chegar).
//
// Este ficheiro continua PURO (sem Supabase, sem rede). Recebe a moldura e os
// resultados e devolve a chave desenhada.

export type PoolId = "A" | "B" | "C" | "D";

// Moldura de uma categoria (o que vive em chave_atletas.pools, + byes).
export interface MolduraCategoria {
  pools: Record<PoolId, string[]>;          // id_person por ordem do quadro
  byes?: Partial<Record<PoolId, string[]>>; // ids que entram só na 2ª ronda do pool
}

// Resultado acumulado de um atleta (vem de resultados_atletas).
export interface ResultadoAtleta {
  vitorias: number;
  derrotas: number;
}
export type ResultadosPorId = Record<string, ResultadoAtleta>;

export interface IdentidadeAtleta { nome?: string; pais?: string; }
export type IdentidadesPorId = Record<string, IdentidadeAtleta>;

export interface LugarChave {
  id: string | null;
  nome?: string;
  pais?: string;
}

export type EstadoLuta = "por_definir" | "agendada" | "decidida";

export interface Luta {
  fase: "quarto" | "meia" | "final" | "repescagem" | "bronze";
  pool?: PoolId;
  rotulo: string;
  chaveId?: string;          // chave estável do nó (útil p/ bloqueios/persistência)
  azul: LugarChave;
  branco: LugarChave;
  vencedor: string | null;
  estado: EstadoLuta;
  ambigua?: boolean;         // true se os 2 lados são conhecidos mas o vencedor é indeterminável só pelos totais
}

export interface ChaveDesenhada {
  pools: Record<PoolId, { vencedor: string | null; lutas: Luta[] }>;
  meias: Luta[];
  final: Luta | null;
  repescagens: Luta[];
  bronzes: Luta[];
  campeao: string | null;
  vice: string | null;
  terceiros: string[];
}

// "Bloqueios": decisões já travadas (ex.: persistidas ao vivo) que o motor deve
// respeitar para nunca regredir. Mapa chaveId -> id_person vencedor.
export type Bloqueios = Record<string, string>;

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------
const POOLS: PoolId[] = ["A", "B", "C", "D"];

function vit(res: ResultadosPorId, id: string | null): number {
  if (!id) return 0;
  return res[id]?.vitorias ?? 0;
}
function der(res: ResultadosPorId, id: string | null): number {
  if (!id) return 0;
  return res[id]?.derrotas ?? 0;
}
function fazerLugar(id: string | null, ids: IdentidadesPorId): LugarChave {
  if (!id) return { id: null };
  return { id, nome: ids[id]?.nome, pais: ids[id]?.pais };
}

// --------------------------------------------------------------------------
// (1) CORPO DO POOL — por consumo. Devolve as lutas do pool (incl. a final, com
//     vencedor por preencher), os 2 finalistas e as vitórias que sobram a cada
//     finalista para a fase de medalhas (wlRest).
// --------------------------------------------------------------------------
interface CorpoPool {
  lutas: Luta[];                 // todas as lutas do pool, em ordem (a última = final do pool)
  finalistas: [string | null, string | null];
  wlRest: Record<string, number>; // vitórias por gastar (depois do corpo) por finalista
}

function consumir(
  a: string | null,
  b: string | null,
  wl: Record<string, number>
): string | null {
  // Pré-final: o perdedor já está eliminado -> wl=0; o vencedor tem wl>0.
  if (!a && !b) return null;
  if (a && !b) return a; // bye/passagem direta
  if (b && !a) return b;
  const wa = wl[a!] ?? 0;
  const wb = wl[b!] ?? 0;
  if (wa > 0 && wb <= 0) { wl[a!] = wa - 1; return a!; }
  if (wb > 0 && wa <= 0) { wl[b!] = wb - 1; return b!; }
  if (wa <= 0 && wb <= 0) return null;           // ainda não jogado
  // ambos > 0 não deveria ocorrer pré-final; escolha defensiva pelo maior
  if (wa > wb) { wl[a!] = wa - 1; return a!; }
  if (wb > wa) { wl[b!] = wb - 1; return b!; }
  return null;
}

function resolverCorpoPool(
  poolId: PoolId,
  ordem: string[],
  byes: string[],
  res: ResultadosPorId,
  ids: IdentidadesPorId
): CorpoPool {
  const wl: Record<string, number> = {};
  for (const x of ordem) wl[x] = vit(res, x);

  const lutas: Luta[] = [];
  let nNo = 0;
  const novoNo = (
    a: string | null, b: string | null, ehFinal: boolean
  ): { venc: string | null } => {
    const venc = ehFinal ? null : consumir(a, b, wl); // a final resolve-se na fase de medalhas
    nNo += 1;
    const ambosLados = !!a && !!b;
    lutas.push({
      fase: "quarto",
      pool: poolId,
      rotulo: ehFinal ? `Final Pool ${poolId}` : `Pool ${poolId}`,
      chaveId: `${poolId}#${nNo}`,
      azul: fazerLugar(a, ids),
      branco: fazerLugar(b, ids),
      vencedor: venc,
      estado: venc ? "decidida" : (ambosLados ? "agendada" : "por_definir"),
    });
    return { venc };
  };

  const naoBye = ordem.filter((id) => !byes.includes(id));
  const comBye = ordem.filter((id) => byes.includes(id));

  // 1ª ronda (entre não-byes)
  let nivel: (string | null)[] = [];
  for (let i = 0; i < naoBye.length; i += 2) {
    const a = naoBye[i] ?? null;
    const b = naoBye[i + 1] ?? null;
    if (a && !b) { nivel.push(a); continue; } // sobra ímpar: passa
    nivel.push(novoNo(a, b, false).venc);
  }
  nivel = [...comBye, ...nivel];

  // rondas seguintes até sobrarem 2 (esses 2 são os finalistas; a luta entre eles
  // é a FINAL do pool, resolvida na fase de medalhas)
  while (nivel.length > 2) {
    const prox: (string | null)[] = [];
    for (let i = 0; i < nivel.length; i += 2) {
      const a = nivel[i] ?? null;
      const b = nivel[i + 1] ?? null;
      if (a && !b) { prox.push(a); continue; }
      prox.push(novoNo(a, b, false).venc);
    }
    nivel = prox;
  }

  let finalistas: [string | null, string | null] = [null, null];
  if (nivel.length === 2) {
    const a = nivel[0] ?? null;
    const b = nivel[1] ?? null;
    finalistas = [a, b];
    novoNo(a, b, true); // a luta-final do pool (vencedor preenchido depois)
  } else if (nivel.length === 1) {
    finalistas = [nivel[0] ?? null, null];
  }

  const wlRest: Record<string, number> = {};
  for (const f of finalistas) if (f) wlRest[f] = wl[f] ?? 0;

  return { lutas, finalistas, wlRest };
}

// --------------------------------------------------------------------------
// (2) FASE DE MEDALHAS — por consistência.
//     Enumera (qual finalista venceu cada pool) × (resultados das lutas de
//     medalha) e guarda só as soluções que batem certo com vitórias/derrotas
//     totais dos 8 finalistas. Estados por luta: 0=azul venceu, 1=branco venceu,
//     2=ainda não jogada.
// --------------------------------------------------------------------------
interface SolucaoMedalha {
  venc: Record<PoolId, string>;     // vencedor de cada pool
  perd: Record<PoolId, string>;     // perdedor da final de cada pool (vai à repescagem)
  sf1: number; sf2: number; r1: number; r2: number; ff: number; bb1: number; bb2: number;
  champ: string | null;
  b1w: string | null;
  b2w: string | null;
}

function resolverMedalhas(
  finalistas: Record<PoolId, [string | null, string | null]>,
  wlRest: Record<string, number>,
  res: ResultadosPorId
): SolucaoMedalha[] {
  // só corre se os 4 pools tiverem 2 finalistas conhecidos
  for (const p of POOLS) {
    const [f1, f2] = finalistas[p];
    if (!f1 || !f2) return [];
  }

  const oitoIds: string[] = [];
  for (const p of POOLS) { oitoIds.push(finalistas[p][0]!, finalistas[p][1]!); }

  // necessidades: vitórias na fase de medalhas = wlRest (já tirámos as do corpo);
  // derrotas na fase de medalhas = derrotas totais (um finalista não perde no corpo).
  const needW: Record<string, number> = {};
  const needL: Record<string, number> = {};
  for (const x of oitoIds) { needW[x] = wlRest[x] ?? 0; needL[x] = der(res, x); }

  const solucoes: SolucaoMedalha[] = [];
  const opt = [0, 1, 2];

  for (let m = 0; m < 16; m++) {
    const venc = {} as Record<PoolId, string>;
    const perd = {} as Record<PoolId, string>;
    POOLS.forEach((p, i) => {
      const [f1, f2] = finalistas[p];
      const w = ((m >> i) & 1) ? f2! : f1!;
      venc[p] = w; perd[p] = (w === f1 ? f2! : f1!);
    });

    const SF1 = [venc.A, venc.B];
    const SF2 = [venc.C, venc.D];
    const R1 = [perd.A, perd.B];
    const R2 = [perd.C, perd.D];

    for (const sf1 of opt) for (const sf2 of opt) for (const r1 of opt) for (const r2 of opt) {
      const wsf1 = sf1 === 2 ? null : SF1[sf1];
      const lsf1 = sf1 === 2 ? null : SF1[1 - sf1];
      const wsf2 = sf2 === 2 ? null : SF2[sf2];
      const lsf2 = sf2 === 2 ? null : SF2[1 - sf2];
      const wr1 = r1 === 2 ? null : R1[r1];
      const wr2 = r2 === 2 ? null : R2[r2];

      for (const ff of opt) {
        if (ff !== 2 && (wsf1 == null || wsf2 == null)) continue;
        const FIN = [wsf1, wsf2];
        const champ = ff === 2 ? null : FIN[ff];
        const vice = ff === 2 ? null : FIN[1 - ff];

        for (const bb1 of opt) for (const bb2 of opt) {
          // bronzes CRUZADOS: B1 = venc.repescagem1 vs perdedor meia2 ;
          //                   B2 = venc.repescagem2 vs perdedor meia1
          if (bb1 !== 2 && (wr1 == null || lsf2 == null)) continue;
          if (bb2 !== 2 && (wr2 == null || lsf1 == null)) continue;
          const B1 = [wr1, lsf2];
          const B2 = [wr2, lsf1];
          const wb1 = bb1 === 2 ? null : B1[bb1];
          const wb2 = bb2 === 2 ? null : B2[bb2];

          // contar vitórias/derrotas na fase de medalhas
          const W: Record<string, number> = {};
          const L: Record<string, number> = {};
          const add = (w: string | null, l: string | null) => {
            if (w) W[w] = (W[w] || 0) + 1;
            if (l) L[l] = (L[l] || 0) + 1;
          };
          // a própria final de cada pool conta
          for (const p of POOLS) add(venc[p], perd[p]);
          if (sf1 !== 2) add(wsf1, lsf1);
          if (sf2 !== 2) add(wsf2, lsf2);
          if (r1 !== 2) add(wr1, R1[1 - r1]);
          if (r2 !== 2) add(wr2, R2[1 - r2]);
          if (ff !== 2) add(champ, vice);
          if (bb1 !== 2) add(wb1, B1[1 - bb1]);
          if (bb2 !== 2) add(wb2, B2[1 - bb2]);

          let ok = true;
          for (const x of oitoIds) {
            if ((W[x] || 0) !== needW[x] || (L[x] || 0) !== needL[x]) { ok = false; break; }
          }
          if (ok) {
            solucoes.push({
              venc: { ...venc }, perd: { ...perd },
              sf1, sf2, r1, r2, ff, bb1, bb2,
              champ: champ ?? null, b1w: wb1 ?? null, b2w: wb2 ?? null,
            });
          }
        }
      }
    }
  }
  return solucoes;
}

// valor único entre todas as soluções, ou null se divergirem.
function unico<T>(vals: (T | null)[]): T | null {
  let v: T | null | undefined = undefined;
  for (const x of vals) {
    if (x == null) return null;          // alguma solução não decide -> indeterminado
    if (v === undefined) v = x;
    else if (v !== x) return null;
  }
  return (v === undefined ? null : v);
}

// --------------------------------------------------------------------------
// FUNÇÃO PRINCIPAL
// --------------------------------------------------------------------------
export function desenharChave(
  moldura: MolduraCategoria,
  resultados: ResultadosPorId,
  identidades: IdentidadesPorId = {},
  bloqueios: Bloqueios = {}
): ChaveDesenhada {
  // 1) corpo dos pools
  const corpo = {} as Record<PoolId, CorpoPool>;
  const finalistas = {} as Record<PoolId, [string | null, string | null]>;
  const wlRest: Record<string, number> = {};
  for (const p of POOLS) {
    const ordem = moldura.pools[p] ?? [];
    const byes = moldura.byes?.[p] ?? [];
    const c = resolverCorpoPool(p, ordem, byes, resultados, identidades);
    corpo[p] = c;
    finalistas[p] = c.finalistas;
    for (const k in c.wlRest) wlRest[k] = c.wlRest[k];
  }

  // 2) fase de medalhas por consistência
  let solucoes = resolverMedalhas(finalistas, wlRest, resultados);

  // respeitar bloqueios (decisões já travadas): filtrar soluções compatíveis
  if (solucoes.length && Object.keys(bloqueios).length) {
    const compat = (s: SolucaoMedalha): boolean => {
      for (const p of POOLS) {
        const b = bloqueios[`PF#${p}`];
        if (b && s.venc[p] !== b) return false;
      }
      const checks: Array<[string, string | null]> = [
        ["SF1", s.sf1 === 2 ? null : [s.venc.A, s.venc.B][s.sf1]],
        ["SF2", s.sf2 === 2 ? null : [s.venc.C, s.venc.D][s.sf2]],
        ["FINAL", s.champ],
        ["R1", s.r1 === 2 ? null : [s.perd.A, s.perd.B][s.r1]],
        ["R2", s.r2 === 2 ? null : [s.perd.C, s.perd.D][s.r2]],
        ["B1", s.b1w],
        ["B2", s.b2w],
      ];
      for (const [k, v] of checks) {
        const b = bloqueios[k];
        if (b && v && v !== b) return false;
      }
      return true;
    };
    const filtradas = solucoes.filter(compat);
    if (filtradas.length) solucoes = filtradas; // só aplica se não esvaziar
  }

  // ----- derivar vencedores/participantes únicos por nó -----
  const vencPool = {} as Record<PoolId, string | null>;
  for (const p of POOLS) {
    vencPool[p] = solucoes.length ? unico(solucoes.map((s) => s.venc[p])) : null;
    if (bloqueios[`PF#${p}`]) vencPool[p] = bloqueios[`PF#${p}`];
  }
  const perdPool = {} as Record<PoolId, string | null>;
  for (const p of POOLS) {
    const [f1, f2] = finalistas[p];
    perdPool[p] = vencPool[p] ? (vencPool[p] === f1 ? f2 : f1) : null;
  }

  // preencher o vencedor da final de cada pool (último nó das lutas do pool)
  const poolsOut = {} as ChaveDesenhada["pools"];
  for (const p of POOLS) {
    const lutas = corpo[p].lutas;
    const finPool = [...lutas].reverse().find((l) => l.rotulo.startsWith("Final Pool"));
    if (finPool) {
      finPool.vencedor = vencPool[p];
      const ambos = !!finPool.azul.id && !!finPool.branco.id;
      finPool.estado = vencPool[p] ? "decidida" : (ambos ? "agendada" : "por_definir");
      finPool.ambigua = !vencPool[p] && ambos;
    }
    poolsOut[p] = { vencedor: vencPool[p], lutas };
  }

  // ----- helpers de nó de medalha -----
  const valSF1 = (s: SolucaoMedalha) => s.sf1 === 2 ? null : [s.venc.A, s.venc.B][s.sf1];
  const valSF2 = (s: SolucaoMedalha) => s.sf2 === 2 ? null : [s.venc.C, s.venc.D][s.sf2];
  const valR1 = (s: SolucaoMedalha) => s.r1 === 2 ? null : [s.perd.A, s.perd.B][s.r1];
  const valR2 = (s: SolucaoMedalha) => s.r2 === 2 ? null : [s.perd.C, s.perd.D][s.r2];
  const lSF1 = (s: SolucaoMedalha) => s.sf1 === 2 ? null : [s.venc.A, s.venc.B][1 - s.sf1];
  const lSF2 = (s: SolucaoMedalha) => s.sf2 === 2 ? null : [s.venc.C, s.venc.D][1 - s.sf2];

  const sf1W = solucoes.length ? unico(solucoes.map(valSF1)) : null;
  const sf2W = solucoes.length ? unico(solucoes.map(valSF2)) : null;
  const r1W = solucoes.length ? unico(solucoes.map(valR1)) : null;
  const r2W = solucoes.length ? unico(solucoes.map(valR2)) : null;
  const champ = solucoes.length ? unico(solucoes.map((s) => s.champ)) : null;
  const b1W = solucoes.length ? unico(solucoes.map((s) => s.b1w)) : null;
  const b2W = solucoes.length ? unico(solucoes.map((s) => s.b2w)) : null;
  const sf1L = solucoes.length ? unico(solucoes.map(lSF1)) : null;
  const sf2L = solucoes.length ? unico(solucoes.map(lSF2)) : null;

  const mkLuta = (
    fase: Luta["fase"], rotulo: string, chaveId: string,
    a: string | null, b: string | null, vencedor: string | null
  ): Luta => {
    const ambos = !!a && !!b;
    return {
      fase, rotulo, chaveId,
      azul: fazerLugar(a, identidades),
      branco: fazerLugar(b, identidades),
      vencedor,
      estado: vencedor ? "decidida" : (ambos ? "agendada" : "por_definir"),
      ambigua: !vencedor && ambos,
    };
  };

  const meia1 = mkLuta("meia", "Meia-final 1", "SF1", vencPool.A, vencPool.B, sf1W);
  const meia2 = mkLuta("meia", "Meia-final 2", "SF2", vencPool.C, vencPool.D, sf2W);
  const meias = [meia1, meia2];

  const final = mkLuta("final", "Final", "FINAL", sf1W, sf2W, champ);

  const rep1 = mkLuta("repescagem", "Repescagem 1", "R1", perdPool.A, perdPool.B, r1W);
  const rep2 = mkLuta("repescagem", "Repescagem 2", "R2", perdPool.C, perdPool.D, r2W);
  const repescagens = [rep1, rep2];

  // bronzes cruzados: Bronze 1 = venc rep1 (lado A/B) vs perdedor meia2 (lado C/D)
  //                   Bronze 2 = venc rep2 (lado C/D) vs perdedor meia1 (lado A/B)
  const bronze1 = mkLuta("bronze", "Bronze 1", "B1", r1W, sf2L, b1W);
  const bronze2 = mkLuta("bronze", "Bronze 2", "B2", r2W, sf1L, b2W);
  const bronzes = [bronze1, bronze2];

  const vice = champ ? (sf1W === champ ? sf2W : sf1W) : null;
  const terceiros = [b1W, b2W].filter((x): x is string => !!x);

  return {
    pools: poolsOut,
    meias,
    final,
    repescagens,
    bronzes,
    campeao: champ,
    vice,
    terceiros,
  };
}
