// lib/motorChave.ts
//
// MOTOR DA CHAVE DE ATLETAS (Ippon League — funcionalidade Pro Max).
//
// IDEIA (decidida com o Kainan):
//   - A MOLDURA vem da tabela chave_atletas.pools: sempre 4 pools (A,B,C,D),
//     cada um uma lista ORDENADA de id_person (ordem do quadro IJF, de cima para
//     baixo), com tamanho variável. Byes marcados à parte.
//   - O MOVIMENTO vem de resultados_atletas: vitorias/derrotas de cada atleta na
//     competição (enche ao vivo durante o dia).
//   - A chave começa com todos a 0-0; conforme as vitórias entram, quem ganha
//     avança ao confronto seguinte da moldura; quem perde para e (se perdeu na
//     QUARTA DE FINAL = final do pool) desce à repescagem.
//
// REGRA-ÂNCORA (IJF, confirmada pelo Kainan): só quem perde nos QUARTOS DE FINAL
// vai à repescagem. O "quarto de final" é a luta que decide o vencedor de cada
// pool. 4 perdedores de pool -> 2 repescagens -> 2 bronzes CRUZADOS:
//   Repescagem 1: perdedor-final-PoolA  vs  perdedor-final-PoolB
//   Repescagem 2: perdedor-final-PoolC  vs  perdedor-final-PoolD
//   Bronze 1: vencedor Repescagem 1  vs  semifinalista perdedor do LADO OPOSTO (C/D)
//   Bronze 2: vencedor Repescagem 2  vs  semifinalista perdedor do LADO OPOSTO (A/B)
//   Meias: vencedorA vs vencedorB  (meia 1) ; vencedorC vs vencedorD (meia 2)
//   Final: vencedor meia1 vs vencedor meia2
//
// COMO DECIDE UM CONFRONTO AO VIVO:
//   Seguindo a moldura, o motor sabe QUEM são os dois lados de cada confronto.
//   Para saber quem ganhou, usa as vitórias acumuladas: dentro de uma sequência
//   de eliminação, quem avançou tem necessariamente MAIS vitórias do que quem
//   parou nesse ponto. O motor avança um atleta enquanto as suas vitórias
//   "chegarem" para a etapa seguinte. É determinístico ao vivo (todos partem de
//   0 e sobem), e reconstrói também uma competição já terminada.
//
// Este ficheiro é PURO (sem Supabase, sem rede): recebe a moldura e os
// resultados e devolve a chave desenhada. Assim é fácil de testar e a página/API
// só tem de o alimentar.

export type PoolId = "A" | "B" | "C" | "D";

// Moldura de uma categoria (o que vive em chave_atletas.pools, + byes).
export interface MolduraCategoria {
  pools: Record<PoolId, string[]>;        // id_person por ordem do quadro
  byes?: Partial<Record<PoolId, string[]>>; // ids com bye na 1ª ronda do pool
}

// Resultado acumulado de um atleta (vem de resultados_atletas).
export interface ResultadoAtleta {
  vitorias: number;
  derrotas: number;
}
export type ResultadosPorId = Record<string, ResultadoAtleta>;

// Identidade opcional para mostrar (nome/país) — o motor não precisa dela para a
// lógica, mas passa-a adiante se existir.
export interface IdentidadeAtleta { nome?: string; pais?: string; }
export type IdentidadesPorId = Record<string, IdentidadeAtleta>;

// Um lugar num confronto: o atleta + a sua identidade + estado.
export interface LugarChave {
  id: string | null;                 // id_person, ou null se ainda indefinido
  nome?: string;
  pais?: string;
}

export type EstadoLuta = "por_definir" | "agendada" | "decidida";

export interface Luta {
  fase: "quarto" | "meia" | "final" | "repescagem" | "bronze";
  pool?: PoolId;                     // só nos quartos (a final de cada pool)
  rotulo: string;                    // ex.: "Final Pool A", "Meia-final 1", "Bronze 1"
  azul: LugarChave;
  branco: LugarChave;
  vencedor: string | null;           // id_person do vencedor, ou null
  estado: EstadoLuta;
}

export interface ChaveDesenhada {
  pools: Record<PoolId, { vencedor: string | null; lutas: Luta[] }>;
  meias: Luta[];
  final: Luta | null;
  repescagens: Luta[];
  bronzes: Luta[];
  campeao: string | null;
  vice: string | null;
  terceiros: string[];               // até 2 (os dois bronzes)
}

// --------------------------------------------------------------------------
// Núcleo: resolver a ordem de um POOL (mini-eliminatória) com vitórias.
// --------------------------------------------------------------------------
// Recebe a lista ordenada de ids do pool e os byes; devolve a sequência de lutas
// do pool (na ordem em que acontecem) e o vencedor do pool, usando as vitórias
// acumuladas para decidir cada confronto.
//
// MODELO de pool IJF (eliminação simples dentro do pool, com a ordem do quadro):
//   Emparelha de dois em dois pela ordem; quem tem bye salta a 1ª ronda e entra
//   na seguinte. O vencedor de cada luta sobe; repete até sobrar 1.
//
// "Quem ganhou?" -> entre dois atletas que se defrontam, ganhou o que tem MAIS
// vitórias acumuladas (teve de vencer mais lutas para continuar vivo). Empate de
// vitórias (ainda não lutaram, ou dados ainda não chegaram) -> luta agendada,
// sem vencedor (estado "agendada").
function vit(res: ResultadosPorId, id: string | null): number {
  if (!id) return -1;
  return res[id]?.vitorias ?? 0;
}

function fazerLugar(id: string | null, ids: IdentidadesPorId): LugarChave {
  if (!id) return { id: null };
  return { id, nome: ids[id]?.nome, pais: ids[id]?.pais };
}

// Decide o vencedor de um confronto entre dois ids, pelas vitórias acumuladas.
// Devolve { vencedor, estado }. Se faltar um lado, fica por_definir.
function decidir(
  a: string | null,
  b: string | null,
  res: ResultadosPorId
): { vencedor: string | null; estado: EstadoLuta } {
  if (!a && !b) return { vencedor: null, estado: "por_definir" };
  // Bye real: um lado existe e o outro não -> o que existe passa.
  if (a && !b) return { vencedor: a, estado: "decidida" };
  if (b && !a) return { vencedor: b, estado: "decidida" };
  const va = vit(res, a);
  const vb = vit(res, b);
  if (va === vb) return { vencedor: null, estado: "agendada" }; // ainda não decidido
  return { vencedor: va > vb ? a! : b!, estado: "decidida" };
}

// Resolve um pool inteiro: devolve as lutas (em ordem) e o vencedor do pool.
// A "final do pool" (última luta) é o QUARTO DE FINAL cujo perdedor desce à
// repescagem — devolvida também à parte (perdedorFinalPool).
function resolverPool(
  poolId: PoolId,
  ordem: string[],
  byes: string[],
  res: ResultadosPorId,
  ids: IdentidadesPorId
): { lutas: Luta[]; vencedor: string | null; perdedorFinalPool: string | null } {
  const lutas: Luta[] = [];

  // Fila de quem ainda não entrou (respeitando bye: byes entram só na 2ª ronda).
  // 1ª ronda: empareia os NÃO-bye pela ordem; os bye ficam à espera.
  const naoBye = ordem.filter((id) => !byes.includes(id));
  const comBye = ordem.filter((id) => byes.includes(id));

  // Vencedores que vão subindo.
  let nivel: string[] = [];

  // 1ª ronda entre não-bye, dois a dois.
  for (let i = 0; i < naoBye.length; i += 2) {
    const a = naoBye[i] ?? null;
    const b = naoBye[i + 1] ?? null;
    if (a && !b) { nivel.push(a); continue; } // sobra ímpar: passa direto
    const d = decidir(a, b, res);
    lutas.push({
      fase: "quarto", pool: poolId, rotulo: `Pool ${poolId}`,
      azul: fazerLugar(a, ids), branco: fazerLugar(b, ids),
      vencedor: d.vencedor, estado: d.estado,
    });
    if (d.vencedor) nivel.push(d.vencedor);
  }

  // Junta os que tinham bye ao grupo de vencedores da 1ª ronda.
  nivel = [...comBye, ...nivel];

  // Rondas seguintes até sobrar 1.
  while (nivel.length > 1) {
    const prox: string[] = [];
    for (let i = 0; i < nivel.length; i += 2) {
      const a = nivel[i] ?? null;
      const b = nivel[i + 1] ?? null;
      if (a && !b) { prox.push(a); continue; }
      const d = decidir(a, b, res);
      const ehFinalPool = nivel.length === 2; // a última luta do pool
      lutas.push({
        fase: "quarto", pool: poolId,
        rotulo: ehFinalPool ? `Final Pool ${poolId}` : `Pool ${poolId}`,
        azul: fazerLugar(a, ids), branco: fazerLugar(b, ids),
        vencedor: d.vencedor, estado: d.estado,
      });
      if (d.vencedor) prox.push(d.vencedor);
    }
    nivel = prox;
    if (prox.length <= 1) break;
  }

  const vencedor = nivel[0] ?? null;

  // Perdedor da final do pool (o quarto-de-final): o que perdeu a última luta.
  let perdedorFinalPool: string | null = null;
  const finalPool = [...lutas].reverse().find((l) => l.rotulo.startsWith(`Final Pool`));
  if (finalPool && finalPool.vencedor) {
    perdedorFinalPool = finalPool.azul.id === finalPool.vencedor ? finalPool.branco.id : finalPool.azul.id;
  }

  return { lutas, vencedor, perdedorFinalPool };
}

// --------------------------------------------------------------------------
// FUNÇÃO PRINCIPAL — desenha a chave inteira.
// --------------------------------------------------------------------------
export function desenharChave(
  moldura: MolduraCategoria,
  resultados: ResultadosPorId,
  identidades: IdentidadesPorId = {}
): ChaveDesenhada {
  const poolsIds: PoolId[] = ["A", "B", "C", "D"];

  // 1) Resolver cada pool.
  const poolsOut = {} as ChaveDesenhada["pools"];
  const vencedorPool: Record<PoolId, string | null> = { A: null, B: null, C: null, D: null };
  const perdedorQuarto: Record<PoolId, string | null> = { A: null, B: null, C: null, D: null };

  for (const p of poolsIds) {
    const ordem = moldura.pools[p] ?? [];
    const byes = moldura.byes?.[p] ?? [];
    const r = resolverPool(p, ordem, byes, resultados, identidades);
    poolsOut[p] = { vencedor: r.vencedor, lutas: r.lutas };
    vencedorPool[p] = r.vencedor;
    perdedorQuarto[p] = r.perdedorFinalPool;
  }

  // 2) Meias: A×B (meia 1) e C×D (meia 2).
  const mkLuta = (
    fase: Luta["fase"], rotulo: string, a: string | null, b: string | null
  ): Luta => {
    const d = decidir(a, b, resultados);
    return {
      fase, rotulo,
      azul: fazerLugar(a, identidades), branco: fazerLugar(b, identidades),
      vencedor: d.vencedor, estado: a || b ? d.estado : "por_definir",
    };
  };

  const meia1 = mkLuta("meia", "Meia-final 1", vencedorPool.A, vencedorPool.B);
  const meia2 = mkLuta("meia", "Meia-final 2", vencedorPool.C, vencedorPool.D);
  const meias = [meia1, meia2];

  // Semifinalistas perdedores (para os bronzes cruzados).
  const perdedorMeia1 = meia1.vencedor ? (meia1.azul.id === meia1.vencedor ? meia1.branco.id : meia1.azul.id) : null;
  const perdedorMeia2 = meia2.vencedor ? (meia2.azul.id === meia2.vencedor ? meia2.branco.id : meia2.azul.id) : null;

  // 3) Final.
  const final = mkLuta("final", "Final", meia1.vencedor, meia2.vencedor);

  // 4) Repescagens: A×B e C×D (perdedores das finais de pool).
  const rep1 = mkLuta("repescagem", "Repescagem 1", perdedorQuarto.A, perdedorQuarto.B);
  const rep2 = mkLuta("repescagem", "Repescagem 2", perdedorQuarto.C, perdedorQuarto.D);
  const repescagens = [rep1, rep2];

  // 5) Bronzes CRUZADOS: vencedor rep1 (lado A/B) vs perdedor meia2 (lado C/D);
  //    vencedor rep2 (lado C/D) vs perdedor meia1 (lado A/B).
  const bronze1 = mkLuta("bronze", "Bronze 1", rep1.vencedor, perdedorMeia2);
  const bronze2 = mkLuta("bronze", "Bronze 2", rep2.vencedor, perdedorMeia1);
  const bronzes = [bronze1, bronze2];

  // 6) Pódio.
  const campeao = final.vencedor;
  const vice = final.vencedor ? (final.azul.id === final.vencedor ? final.branco.id : final.azul.id) : null;
  const terceiros = [bronze1.vencedor, bronze2.vencedor].filter((x): x is string => !!x);

  return {
    pools: poolsOut,
    meias,
    final,
    repescagens,
    bronzes,
    campeao,
    vice,
    terceiros,
  };
}
