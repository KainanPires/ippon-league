// lib/motorChave.ts
//
// MOTOR DA CHAVE DE ATLETAS (Ippon League — Pro Max) — VERSÃO 4 (HEAD-TO-HEAD).
//
// MUDANÇA DE FUNDO FACE ÀS VERSÕES ANTERIORES:
//   Antes, o motor inferia quem ganhou cada confronto pela CONTAGEM de vitórias
//   de cada atleta. Isso funcionava na maior parte dos nós, mas deixava ~28% das
//   finais de pool "a decidir" quando o perdedor ia longe na repescagem (os
//   totais deixavam de chegar). Isso partia a fase de medalhas desse lado.
//
//   Agora resolvemos cada confronto pelo RESULTADO REAL: "quem ganhou a quem".
//   O JudoBase dá, por atleta, cada luta com o vencedor — por isso passamos ao
//   motor, por atleta, a lista de adversários que ele VENCEU (`vencidos`). Em
//   cada nó da chave o motor pergunta apenas: o A venceu o B, ou o B venceu o A?
//   Determinístico, sem ambiguidade. Onde ainda não lutaram, fica "a decidir".
//
//   A moldura (4 pools, byes na posição certa) continua a dar a ESTRUTURA; o
//   head-to-head dá o MOVIMENTO.
//
// REGRAS (iguais): 4 pools; só o perdedor da FINAL DE POOL vai à repescagem;
//   4 perdedores -> 2 repescagens (A×B, C×D) -> 2 bronzes CRUZADOS; meias A×B e
//   C×D; final entre os vencedores das meias.
//
// Ficheiro PURO (sem rede/base). Mesma assinatura e mesmos tipos de saída das
// versões anteriores — a API e a página não mudam.

export type PoolId = "A" | "B" | "C" | "D";

export interface MolduraCategoria {
  pools: Record<PoolId, string[]>;
  byes?: Partial<Record<PoolId, string[]>>;
}

// Resultado de um atleta. `vencidos` = ids dos adversários que ESTE atleta
// venceu nesta competição (head-to-head). vitorias/derrotas ficam para
// compatibilidade/estatística, mas a resolução usa `vencidos`.
export interface ResultadoAtleta {
  vitorias?: number;
  derrotas?: number;
  vencidos?: string[];
}
export type ResultadosPorId = Record<string, ResultadoAtleta>;

export interface IdentidadeAtleta { nome?: string; pais?: string; }
export type IdentidadesPorId = Record<string, IdentidadeAtleta>;

export interface LugarChave { id: string | null; nome?: string; pais?: string; }
export type EstadoLuta = "por_definir" | "agendada" | "decidida";

export interface Luta {
  fase: "quarto" | "meia" | "final" | "repescagem" | "bronze";
  pool?: PoolId;
  rotulo: string;
  chaveId?: string;
  azul: LugarChave;
  branco: LugarChave;
  vencedor: string | null;
  estado: EstadoLuta;
  ambigua?: boolean;
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

const POOLS: PoolId[] = ["A", "B", "C", "D"];

// --------------------------------------------------------------------------
// Head-to-head
// --------------------------------------------------------------------------
// Construímos um mapa global "X venceu Y?" a partir dos `vencidos` de cada um.
function fazerH2H(res: ResultadosPorId): (a: string, b: string) => boolean {
  return (a, b) => !!res[a]?.vencidos?.includes(b);
}

// Decide um confronto entre dois ids: devolve o vencedor (ou null se ainda não
// lutaram / falta um lado).
function decidir(
  a: string | null, b: string | null, venceu: (x: string, y: string) => boolean
): string | null {
  if (!a || !b) return null;
  if (venceu(a, b)) return a;
  if (venceu(b, a)) return b;
  return null;
}

function fazerLugar(id: string | null, ids: IdentidadesPorId): LugarChave {
  if (!id) return { id: null };
  return { id, nome: ids[id]?.nome, pais: ids[id]?.pais };
}

// --------------------------------------------------------------------------
// Construção POSICIONAL dos slots da 1ª ronda (byes na posição certa).
// --------------------------------------------------------------------------
function construirSlots(
  ordem: string[], byes: string[]
): Array<{ bye?: string; match?: [string, string] }> {
  const isBye = (id: string) => byes.includes(id);
  const fighters = ordem.filter((id) => !isBye(id));
  const segundos = new Set<string>();
  const matchAt: Record<number, [string, string]> = {};
  for (let k = 0; k < fighters.length; k += 2) {
    const a = fighters[k];
    const b = fighters[k + 1];
    if (b === undefined) continue;
    matchAt[ordem.indexOf(a)] = [a, b];
    segundos.add(b);
  }
  const slots: Array<{ bye?: string; match?: [string, string] }> = [];
  ordem.forEach((id, idx) => {
    if (isBye(id)) slots.push({ bye: id });
    else if (segundos.has(id)) { /* já no match do parceiro */ }
    else if (matchAt[idx]) slots.push({ match: matchAt[idx] });
    else slots.push({ bye: id });
  });
  return slots;
}

// --------------------------------------------------------------------------
// Resolver um pool: lutas (pré → quartos → meias do pool → final), vencedor do
// pool e perdedor da final do pool (vai à repescagem). Tudo por head-to-head.
// --------------------------------------------------------------------------
interface PoolOut { lutas: Luta[]; vencedor: string | null; perdedorFinal: string | null; }

function resolverPool(
  poolId: PoolId, ordem: string[], byes: string[],
  venceu: (a: string, b: string) => boolean, ids: IdentidadesPorId
): PoolOut {
  const lutas: Luta[] = [];
  let nNo = 0;
  const emit = (a: string | null, b: string | null, ehFinal: boolean): string | null => {
    const venc = decidir(a, b, venceu);
    nNo += 1;
    const ambos = !!a && !!b;
    lutas.push({
      fase: "quarto", pool: poolId,
      rotulo: ehFinal ? `Final Pool ${poolId}` : `Pool ${poolId}`,
      chaveId: `${poolId}#${nNo}`,
      azul: fazerLugar(a, ids), branco: fazerLugar(b, ids),
      vencedor: venc,
      estado: venc ? "decidida" : (ambos ? "agendada" : "por_definir"),
    });
    return venc;
  };

  const slots = construirSlots(ordem, byes);
  let nivel: (string | null)[] = [];
  for (const s of slots) {
    if (s.bye) { nivel.push(s.bye); continue; }
    nivel.push(emit(s.match![0], s.match![1], false));
  }
  while (nivel.length > 2) {
    const prox: (string | null)[] = [];
    for (let i = 0; i < nivel.length; i += 2) {
      prox.push(emit(nivel[i] ?? null, nivel[i + 1] ?? null, false));
    }
    nivel = prox;
  }

  let vencedor: string | null = null;
  let perdedorFinal: string | null = null;
  if (nivel.length === 2) {
    const a = nivel[0] ?? null, b = nivel[1] ?? null;
    vencedor = emit(a, b, true);
    if (vencedor) perdedorFinal = vencedor === a ? b : a;
  } else if (nivel.length === 1) {
    vencedor = nivel[0] ?? null;
  }
  return { lutas, vencedor, perdedorFinal };
}

// --------------------------------------------------------------------------
// FUNÇÃO PRINCIPAL
// --------------------------------------------------------------------------
export function desenharChave(
  moldura: MolduraCategoria,
  resultados: ResultadosPorId,
  identidades: IdentidadesPorId = {}
): ChaveDesenhada {
  const venceu = fazerH2H(resultados);

  // 1) Pools.
  const poolsOut = {} as ChaveDesenhada["pools"];
  const vencedorPool: Record<PoolId, string | null> = { A: null, B: null, C: null, D: null };
  const perdedorFinalPool: Record<PoolId, string | null> = { A: null, B: null, C: null, D: null };
  for (const p of POOLS) {
    const ordem = moldura.pools[p] ?? [];
    const byes = moldura.byes?.[p] ?? [];
    const r = resolverPool(p, ordem, byes, venceu, identidades);
    poolsOut[p] = { vencedor: r.vencedor, lutas: r.lutas };
    vencedorPool[p] = r.vencedor;
    perdedorFinalPool[p] = r.perdedorFinal;
  }

  // 2) Construtor de luta de fase final.
  const mk = (
    fase: Luta["fase"], rotulo: string, chaveId: string, a: string | null, b: string | null
  ): Luta => {
    const venc = decidir(a, b, venceu);
    const ambos = !!a && !!b;
    return {
      fase, rotulo, chaveId,
      azul: fazerLugar(a, identidades), branco: fazerLugar(b, identidades),
      vencedor: venc, estado: venc ? "decidida" : (ambos ? "agendada" : "por_definir"),
    };
  };

  // 3) Meias: A×B e C×D.
  const meia1 = mk("meia", "Meia-final 1", "SF1", vencedorPool.A, vencedorPool.B);
  const meia2 = mk("meia", "Meia-final 2", "SF2", vencedorPool.C, vencedorPool.D);
  const perdedorMeia1 = meia1.vencedor ? (meia1.azul.id === meia1.vencedor ? meia1.branco.id : meia1.azul.id) : null;
  const perdedorMeia2 = meia2.vencedor ? (meia2.azul.id === meia2.vencedor ? meia2.branco.id : meia2.azul.id) : null;

  // 4) Final.
  const final = mk("final", "Final", "FINAL", meia1.vencedor, meia2.vencedor);

  // 5) Repescagens: perdedores das finais de pool (A×B, C×D).
  const rep1 = mk("repescagem", "Repescagem 1", "R1", perdedorFinalPool.A, perdedorFinalPool.B);
  const rep2 = mk("repescagem", "Repescagem 2", "R2", perdedorFinalPool.C, perdedorFinalPool.D);

  // 6) Bronzes CRUZADOS: venc.rep1 × perdedor meia2 ; venc.rep2 × perdedor meia1.
  const bronze1 = mk("bronze", "Bronze 1", "B1", rep1.vencedor, perdedorMeia2);
  const bronze2 = mk("bronze", "Bronze 2", "B2", rep2.vencedor, perdedorMeia1);

  // 7) Pódio.
  const campeao = final.vencedor;
  const vice = final.vencedor ? (final.azul.id === final.vencedor ? final.branco.id : final.azul.id) : null;
  const terceiros = [bronze1.vencedor, bronze2.vencedor].filter((x): x is string => !!x);

  return {
    pools: poolsOut,
    meias: [meia1, meia2],
    final,
    repescagens: [rep1, rep2],
    bronzes: [bronze1, bronze2],
    campeao, vice, terceiros,
  };
}
