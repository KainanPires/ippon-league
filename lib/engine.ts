/**
 * Ippon League — Motor do jogo (Fase 3)
 * --------------------------------------
 * Funções puras (sem banco de dados) para:
 *   1. Pontuação por ações       -> scoreAthlete()
 *   2. Valorização / preço        -> computeNewPrice()
 *   3. Faixas por percentil       -> assignBeltsForRanking() / beltForUser()
 *
 * Tudo isto está pronto para ligar ao Supabase depois:
 * lês os dados da base, passas para estas funções, gravas o resultado.
 *
 * Os números foram validados contra os exemplos do documento mestre.
 */

/* =========================================================================
 * 1. PONTUAÇÃO POR AÇÕES
 * ========================================================================= */

/** Tipos de ação que podem acontecer numa luta. */
export type ActionType =
  | "ippon_feito"
  | "waza_ari_feito"
  | "yuko_feito"
  | "shido_provocado"        // shido provocado no adversário (positivo)
  | "ippon_sofrido"
  | "waza_ari_sofrido"
  | "yuko_sofrido"
  | "shido_recebido"
  | "hansoku_make_recebido";

/** Tabela de pontos por ação (do documento mestre). */
export const POINTS: Record<ActionType, number> = {
  ippon_feito: 10,
  waza_ari_feito: 4,
  yuko_feito: 2,
  shido_provocado: 1,
  ippon_sofrido: -5,
  waza_ari_sofrido: -2,
  yuko_sofrido: -1,
  shido_recebido: -2,
  hansoku_make_recebido: -10,
};

/** Arredonda a 1 casa decimal (0,1 JC / 0,1 ponto). */
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Soma os pontos de uma lista de ações.
 * As ações são acumulativas: yuko + waza-ari + ippon = 2 + 4 + 10 = 16.
 *
 * NOTA: os SHIDOS já não passam por aqui. O custo de quem sofre shido é
 * CRESCENTE (1.º -2, 2.º -3, 3.º -4) e o de quem provoca pode DOBRAR numa
 * vitória por hansoku-make — regras que um valor fixo por ação não exprime.
 * Esse cálculo vive em scoreShidosSofridos() e na camada do JudoBase
 * (lib/ijf.ts -> scoreContestSide), não na lista de ações.
 */
export function scoreActions(actions: ActionType[]): number {
  return actions.reduce((total, a) => total + (POINTS[a] ?? 0), 0);
}

/**
 * Custo (negativo) de SOFRER `n` shidos, de forma CRESCENTE.
 *   1.º shido = -2, 2.º = -3, 3.º = -4, ...  (o k-ésimo custa -(k+1))
 * Total de 3 shidos (hansoku-make) = -(2+3+4) = -9.
 *
 * Devolve 0 para n <= 0. É puro e não sabe nada de vitória/derrota — quem
 * decide o resto (ignorar ippon fantasma, dobrar provocados) é o ijf.ts.
 */
export function scoreShidosSofridos(n: number): number {
  let total = 0;
  for (let k = 1; k <= n; k++) total += -(k + 1);
  return total;
}

/**
 * Pontuação final de um atleta numa rodada.
 * Se for capitão, a pontuação total é multiplicada por 2.
 */
export function scoreAthlete(actions: ActionType[], isCaptain = false): number {
  const base = scoreActions(actions);
  return isCaptain ? base * 2 : base;
}

/* =========================================================================
 * 2. VALORIZAÇÃO / DESVALORIZAÇÃO  (preço dos atletas)
 * ========================================================================= */

/** Preço mínimo absoluto: nenhum atleta vale menos que 2 JC. */
export const MIN_PRICE = 2;

/** Pesos da expectativa de desempenho (70% / 30%). */
export const WEIGHT_12M = 0.7;
export const WEIGHT_LAST3 = 0.3;

/**
 * Expectativa de desempenho do atleta.
 *   70% da média dos últimos 12 meses + 30% da média das últimas 3 competições.
 *
 * @param avg12m   Média de pontuação dos últimos 12 meses
 * @param avgLast3 Média de pontuação das últimas 3 competições
 */
export function expectedPerformance(avg12m: number, avgLast3: number): number {
  return WEIGHT_12M * avg12m + WEIGHT_LAST3 * avgLast3;
}

export interface PriceResult {
  oldPrice: number;
  newPrice: number;
  /** Variação bruta calculada (%), antes do amortecedor. */
  rawVariationPct: number;
  /** Variação efetivamente aplicada ao preço (%) = metade da bruta. */
  appliedVariationPct: number;
  /** Quanto o patrimônio de quem escalou ganha (+) ou perde (-), em JC. */
  delta: number;
}

/**
 * Calcula o novo preço de um atleta depois de uma competição.
 *
 * Lógica (documento mestre):
 *   - valoriza se o desempenho real superou a expectativa, desvaloriza se ficou abaixo
 *   - variação aplicada = METADE da variação calculada (amortecedor de inflação)
 *   - nunca abaixo de MIN_PRICE
 *
 * Exemplos validados:
 *   preço 10, esperado 10, real 15  ->  +50% bruto -> +25% aplicado -> 12,5 JC
 *   preço 10, esperado 10, real 17  ->  +70% bruto -> +35% aplicado -> 13,5 JC
 *   preço 10, esperado 10, real  6  ->  -40% bruto -> -20% aplicado ->  8,0 JC
 *
 * @param currentPrice Preço atual em JC
 * @param expected     Expectativa (use expectedPerformance())
 * @param actual       Pontuação real obtida nesta competição
 */
export function computeNewPrice(
  currentPrice: number,
  expected: number,
  actual: number
): PriceResult {
  // Sem histórico fiável (atleta novo): não mexe no preço por desempenho.
  if (expected <= 0.5) {
    const safe = round1(Math.max(MIN_PRICE, currentPrice));
    return {
      oldPrice: currentPrice,
      newPrice: safe,
      rawVariationPct: 0,
      appliedVariationPct: 0,
      delta: round1(safe - currentPrice),
    };
  }

  const rawVariationPct = ((actual - expected) / expected) * 100;
  const appliedVariationPct = rawVariationPct / 2; // amortecedor

  let newPrice = currentPrice * (1 + appliedVariationPct / 100);
  newPrice = round1(Math.max(MIN_PRICE, newPrice));

  return {
    oldPrice: currentPrice,
    newPrice,
    rawVariationPct: round1(rawVariationPct),
    appliedVariationPct: round1(appliedVariationPct),
    delta: round1(newPrice - currentPrice),
  };
}

/* =========================================================================
 * 3. FAIXAS  (por percentil mensal entre jogadores ativos)
 * ========================================================================= */

/** Faixas da melhor para a pior. Índice menor = faixa melhor. */
export const BELTS = [
  "preta",
  "marrom",
  "roxa",
  "verde",
  "amarela",
  "azul",
  "branca",
] as const;

export type Belt = (typeof BELTS)[number];

/**
 * Recebe a "fração de topo" (0 = melhor jogador, 1 = pior) e devolve a faixa.
 * Cortes do documento: Preta 5% · Marrom 10% · Roxa 15% · Verde 20% ·
 * Amarela 20% · Azul 20% · Branca o resto.
 */
export function beltFromTopFraction(topFraction: number): Belt {
  if (topFraction <= 0.05) return "preta";
  if (topFraction <= 0.15) return "marrom";
  if (topFraction <= 0.3) return "roxa";
  if (topFraction <= 0.5) return "verde";
  if (topFraction <= 0.7) return "amarela";
  if (topFraction <= 0.9) return "azul";
  return "branca";
}

/**
 * Faixa de um jogador, comparado com todos os jogadores ativos.
 * Empates ficam com a mesma faixa (a melhor do empate).
 *
 * @param allScores Pontuação mensal de TODOS os jogadores ativos
 * @param userScore Pontuação mensal deste jogador
 */
export function beltForUser(allScores: number[], userScore: number): Belt {
  const n = allScores.length;
  if (n === 0) return "branca";
  const better = allScores.filter((s) => s > userScore).length;
  return beltFromTopFraction((better + 1) / n);
}

export interface RankedUser {
  id: string;
  score: number;
}

export interface BeltedUser extends RankedUser {
  position: number; // 1 = primeiro
  belt: Belt;
}

/**
 * Atribui posição + faixa a uma lista inteira de jogadores de uma vez.
 * Útil para recalcular o ranking mensal e as faixas num só passo.
 */
export function assignBeltsForRanking(users: RankedUser[]): BeltedUser[] {
  const n = users.length;
  const sorted = [...users].sort((a, b) => b.score - a.score);
  return sorted.map((u, i) => {
    const better = sorted.filter((x) => x.score > u.score).length;
    return {
      ...u,
      position: i + 1,
      belt: beltFromTopFraction((better + 1) / n),
    };
  });
}

/* =========================================================================
 * 4. TRANSIÇÃO DE FAIXA  (para animações e mensagens)
 * ========================================================================= */

export type BeltDirection = "subiu" | "manteve" | "desceu";

export interface BeltTransition {
  from: Belt;
  to: Belt;
  direction: BeltDirection;
  message: string;
}

const BELT_LABEL: Record<Belt, string> = {
  preta: "Preta",
  marrom: "Marrom",
  roxa: "Roxa",
  verde: "Verde",
  amarela: "Amarela",
  azul: "Azul",
  branca: "Branca",
};

/**
 * Compara a faixa anterior com a nova e devolve o que mudou,
 * com uma mensagem pronta para mostrar ao jogador.
 */
export function beltTransition(prev: Belt, next: Belt): BeltTransition {
  const pi = BELTS.indexOf(prev);
  const ni = BELTS.indexOf(next);

  let direction: BeltDirection = "manteve";
  let message = `Mantiveste a Faixa ${BELT_LABEL[next]}. Vamos à próxima rodada.`;

  if (ni < pi) {
    direction = "subiu";
    message = `Parabéns! Alcançaste a Faixa ${BELT_LABEL[next]}.`;
  } else if (ni > pi) {
    direction = "desceu";
    message = `Caíste para a Faixa ${BELT_LABEL[next]}. Recupera a tua posição na próxima rodada.`;
  }

  return { from: prev, to: next, direction, message };
}
