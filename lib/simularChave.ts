// lib/simularChave.ts
//
// SIMULAÇÃO PROBABILÍSTICA DA CHAVE — "quem tem caminho fácil e quem tem caminho duro".
//
// O QUE ISTO ACRESCENTA
//
// A análise de confrontos (sem moldura) responde a "quem é mais forte nesta
// categoria". Mas quem escala quer saber outra coisa: **quem tem mais hipóteses
// de ir longe NESTE quadro**. São perguntas diferentes — o segundo melhor atleta
// do mundo pode cair no mesmo pool do primeiro e sair nos quartos, enquanto um
// atleta médio com um lado fácil chega ao pódio.
//
// É aí que está o valor para quem monta equipa: um atleta barato com caminho
// limpo vale mais do que um caro que apanha o campeão à segunda luta.
//
// COMO FUNCIONA
//
// Não é Monte Carlo nem estimativa: é a conta EXATA sobre a árvore. Percorre-se
// o quadro de baixo para cima, e em cada confronto:
//
//   P(X vence este nó) = P(X vence o seu lado) × Σ P(Y vence o outro lado) × p(X ganha a Y)
//
// Como cada pool tem no máximo 16 atletas, isto corre em milissegundos.
//
// A estrutura replica EXATAMENTE a do lib/motorChave.ts — mesma construção de
// slots (byes na posição certa), mesma árvore binária, meias A×B e C×D, final
// entre os vencedores. Se o motor mudar, isto tem de mudar com ele; por isso o
// emparelhamento está numa constante única (MEIAS) em vez de espalhado.
//
// A probabilidade p(X ganha a Y) vem de fora (o mesmo modelo da rota de
// confrontos: forma + histórico direto pesado pela amostra), para haver UMA
// verdade sobre "quem ganha a quem" e não duas.

export type PoolId = "A" | "B" | "C" | "D";
export const POOLS: PoolId[] = ["A", "B", "C", "D"];

/** Emparelhamento das meias-finais, tal como no motorChave. */
const MEIAS: [PoolId, PoolId][] = [["A", "B"], ["C", "D"]];

export interface MolduraPools {
  pools: Record<PoolId, string[]>;
  byes?: Partial<Record<PoolId, string[]>> | null;
}

/** Distribuição de probabilidade: quem sai vencedor de um ramo. */
type Dist = Record<string, number>;

export interface CaminhoFase {
  /** "1ª luta", "Quartos", "Final do Pool", "Meia-final", "Final" */
  fase: string;
  /** Quem pode aparecer, com a hipótese de cada um lá chegar. */
  possiveis: { id: string; prob: number }[];
}

export interface ResultadoAtleta {
  pool: PoolId;
  /** Probabilidade de vencer o seu pool (= chegar às meias). */
  vencePool: number;
  /** Probabilidade de vencer a meia-final (= chegar à final). */
  chegaFinal: number;
  /** Probabilidade de ser campeão da categoria. */
  venceCategoria: number;
  /** Adversários possíveis em cada fase, com a hipótese de cada um lá estar. */
  caminho: CaminhoFase[];
}

export interface SimulacaoChave {
  porAtleta: Record<string, ResultadoAtleta>;
  /** Ids que aparecem na moldura (a ordem não interessa). */
  ids: string[];
}

// --------------------------------------------------------------------------
// Árvore de um pool — replica construirSlots + o ciclo do motorChave.
// --------------------------------------------------------------------------
type No =
  | { tipo: "folha"; id: string }
  | { tipo: "jogo"; esq: No; dir: No };

/** Todos os atletas que podem sair de um ramo. */
function idsDoNo(n: No): string[] {
  return n.tipo === "folha" ? [n.id] : [...idsDoNo(n.esq), ...idsDoNo(n.dir)];
}

/**
 * Constrói a árvore de um pool exatamente como o motor a desenha.
 * Os byes ficam na posição em que aparecem na `ordem` — é isso que faz o quadro
 * sair igual ao que o utilizador vê na aba da Chave.
 */
function arvoreDoPool(ordem: string[], byes: string[]): No | null {
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
  let nivel: No[] = [];
  ordem.forEach((id, idx) => {
    if (isBye(id)) { nivel.push({ tipo: "folha", id }); return; }
    if (segundos.has(id)) return;             // já entrou no jogo do parceiro
    const m = matchAt[idx];
    if (m) nivel.push({ tipo: "jogo", esq: { tipo: "folha", id: m[0] }, dir: { tipo: "folha", id: m[1] } });
    else nivel.push({ tipo: "folha", id });   // ímpar sem par: passa
  });
  if (nivel.length === 0) return null;
  while (nivel.length > 1) {
    const prox: No[] = [];
    for (let i = 0; i < nivel.length; i += 2) {
      const a = nivel[i], b = nivel[i + 1];
      prox.push(b ? { tipo: "jogo", esq: a, dir: b } : a);
    }
    nivel = prox;
  }
  return nivel[0];
}

/**
 * Distribuição de quem vence um ramo, calculada de baixo para cima.
 * `p(a,b)` = probabilidade de `a` ganhar a `b` (0..1).
 */
function distDoNo(n: No, p: (a: string, b: string) => number): Dist {
  if (n.tipo === "folha") return { [n.id]: 1 };
  const de = distDoNo(n.esq, p);
  const dd = distDoNo(n.dir, p);
  const out: Dist = {};
  for (const [x, px] of Object.entries(de)) {
    let ganha = 0;
    for (const [y, py] of Object.entries(dd)) ganha += py * p(x, y);
    out[x] = (out[x] ?? 0) + px * ganha;
  }
  for (const [y, py] of Object.entries(dd)) {
    let ganha = 0;
    for (const [x, px] of Object.entries(de)) ganha += px * p(y, x);
    out[y] = (out[y] ?? 0) + py * ganha;
  }
  return out;
}

/** Nome legível da fase, contando de trás para a frente dentro do pool. */
function nomeFase(faseIdx: number, totalFases: number): string {
  const doFim = totalFases - 1 - faseIdx; // 0 = final do pool
  if (doFim === 0) return "Final do Pool";
  if (doFim === 1) return "Meia do Pool";
  if (doFim === 2) return "Quartos";
  return `${faseIdx + 1}ª luta`;
}

/** O caminho de um atleta dentro do seu pool: em cada nó, quem vem do outro lado. */
function caminhoNoPool(raiz: No, id: string, dist: (n: No) => Dist): CaminhoFase[] {
  // Desce até à folha, guardando os ramos irmãos pelo caminho.
  const irmaos: No[] = [];
  const desce = (n: No): boolean => {
    if (n.tipo === "folha") return n.id === id;
    if (desce(n.esq)) { irmaos.push(n.dir); return true; }
    if (desce(n.dir)) { irmaos.push(n.esq); return true; }
    return false;
  };
  if (!desce(raiz)) return [];
  // `irmaos` vem de baixo para cima — é a ordem das fases.
  return irmaos.map((irmao, i) => {
    const d = dist(irmao);
    const possiveis = Object.entries(d)
      .filter(([, v]) => v > 0.001)
      .map(([pid, v]) => ({ id: pid, prob: Math.round(v * 1000) / 10 }))
      .sort((a, b) => b.prob - a.prob);
    return { fase: nomeFase(i, irmaos.length), possiveis };
  });
}

/**
 * Simula a chave inteira a partir da moldura.
 *
 * @param moldura  pools + byes, tal como estão em chave_atletas
 * @param p        p(a,b) = probabilidade de `a` ganhar a `b` (0..1)
 */
export function simularChave(moldura: MolduraPools, p: (a: string, b: string) => number): SimulacaoChave {
  const cache = new Map<No, Dist>();
  const dist = (n: No): Dist => {
    const guardado = cache.get(n);
    if (guardado) return guardado;
    const d = distDoNo(n, p);
    cache.set(n, d);
    return d;
  };

  // 1) Pools.
  const raizes: Partial<Record<PoolId, No>> = {};
  const distPool: Partial<Record<PoolId, Dist>> = {};
  const ids: string[] = [];
  for (const q of POOLS) {
    const ordem = moldura.pools?.[q] ?? [];
    if (ordem.length === 0) continue;
    ids.push(...ordem);
    const raiz = arvoreDoPool(ordem, moldura.byes?.[q] ?? []);
    if (!raiz) continue;
    raizes[q] = raiz;
    distPool[q] = dist(raiz);
  }

  // 2) Meias A×B e C×D — quem vence cada meia.
  const distMeia: Record<string, Dist> = {};
  for (const [x, y] of MEIAS) {
    const dx = distPool[x] ?? {};
    const dy = distPool[y] ?? {};
    const out: Dist = {};
    for (const [a, pa] of Object.entries(dx)) {
      let g = 0;
      for (const [b, pb] of Object.entries(dy)) g += pb * p(a, b);
      out[a] = pa * g;
    }
    for (const [b, pb] of Object.entries(dy)) {
      let g = 0;
      for (const [a, pa] of Object.entries(dx)) g += pa * p(b, a);
      out[b] = pb * g;
    }
    distMeia[`${x}${y}`] = out;
  }

  // 3) Final entre os vencedores das duas meias.
  const m1 = distMeia["AB"] ?? {};
  const m2 = distMeia["CD"] ?? {};
  const distFinal: Dist = {};
  for (const [a, pa] of Object.entries(m1)) {
    let g = 0;
    for (const [b, pb] of Object.entries(m2)) g += pb * p(a, b);
    distFinal[a] = pa * g;
  }
  for (const [b, pb] of Object.entries(m2)) {
    let g = 0;
    for (const [a, pa] of Object.entries(m1)) g += pa * p(b, a);
    distFinal[b] = pb * g;
  }

  // 4) Junta tudo por atleta, com o caminho.
  const porAtleta: Record<string, ResultadoAtleta> = {};
  for (const q of POOLS) {
    const raiz = raizes[q];
    if (!raiz) continue;
    const chaveMeia = MEIAS.find(([x, y]) => x === q || y === q);
    const meiaKey = chaveMeia ? `${chaveMeia[0]}${chaveMeia[1]}` : "";
    const outroPool = chaveMeia ? (chaveMeia[0] === q ? chaveMeia[1] : chaveMeia[0]) : null;
    // A outra metade da chave (quem se pode encontrar na final).
    const outraMetade = MEIAS.find(([x, y]) => x !== q && y !== q);

    for (const id of moldura.pools[q] ?? []) {
      const caminho = caminhoNoPool(raiz, id, dist);
      // Meia-final: quem vem do pool emparelhado.
      if (outroPool) {
        const d = distPool[outroPool] ?? {};
        caminho.push({
          fase: "Meia-final",
          possiveis: Object.entries(d)
            .filter(([, v]) => v > 0.001)
            .map(([pid, v]) => ({ id: pid, prob: Math.round(v * 1000) / 10 }))
            .sort((a, b) => b.prob - a.prob),
        });
      }
      // Final: quem vem da outra metade.
      if (outraMetade) {
        const d = distMeia[`${outraMetade[0]}${outraMetade[1]}`] ?? {};
        caminho.push({
          fase: "Final",
          possiveis: Object.entries(d)
            .filter(([, v]) => v > 0.001)
            .map(([pid, v]) => ({ id: pid, prob: Math.round(v * 1000) / 10 }))
            .sort((a, b) => b.prob - a.prob),
        });
      }
      porAtleta[id] = {
        pool: q,
        vencePool: Math.round((distPool[q]?.[id] ?? 0) * 1000) / 10,
        chegaFinal: Math.round((distMeia[meiaKey]?.[id] ?? 0) * 1000) / 10,
        venceCategoria: Math.round((distFinal[id] ?? 0) * 1000) / 10,
        caminho,
      };
    }
  }

  return { porAtleta, ids: Array.from(new Set(ids)) };
}
