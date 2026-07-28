/**
 * Ippon League — Forma recente e preço a partir do histórico (passo 3D).
 *
 * Pega nas lutas reais de um atleta (do JudoBase) e calcula:
 *   - média dos últimos 12 meses
 *   - média das últimas 3 competições
 *   - pontuação na última competição
 *   - expectativa (70% 12 meses + 30% últimas 3) — via engine
 *   - preço real em JC (escala calibrada com dados reais)
 *
 * Reaproveita o motor (lib/engine.ts) para os pontos e a expectativa, e o
 * extrator de ações (lib/ijf.ts). Não duplica regras.
 *
 * ---------------------------------------------------------------------------
 * JANELA DE CÁLCULO — porque é que isto é configurável
 *
 * Numa competição REAL de 2026, "forma recente" quer dizer os últimos 12 meses
 * a contar de hoje. É o comportamento por omissão e não mudou.
 *
 * Mas os CLÁSSICOS são reposições de competições antigas, e aí a regra de hoje
 * dava resultados absurdos:
 *
 *   • Um atleta que dominou 2018 e se aposentou em 2020 não tem pontuação
 *     recente nenhuma -> ficava no mínimo (2 JC) e ia ganhar a competição.
 *     Quem soubesse disso montava uma equipa imbatível por metade do orçamento.
 *   • Ao contrário: quem tinha 19 anos em 2018 e é estrela agora ficava caro,
 *     por um desempenho que naquela altura ainda não tinha.
 *
 * É o mesmo problema do portão anti-espreitadela, por outra porta: em vez de a
 * app revelar os resultados, era o PREÇO que os denunciava.
 *
 * Por isso `calcularForma` aceita uma janela. Para um clássico de 2018, passa-se
 * o ano civil de 2018 e o atleta é avaliado pelo que valia nessa altura —
 * ignorando tudo o que veio depois.
 * ---------------------------------------------------------------------------
 */
import { scoreActions, expectedPerformance, MIN_PRICE } from "@/lib/engine";
import { contestActionsForPerson, type IjfContest } from "@/lib/ijf";
/** Preço máximo de um atleta (os de elite chegam aqui). */
export const MAX_PRICE = 20;
/**
 * Expectativa (pontos por competição) que corresponde ao PREÇO MÁXIMO.
 * É a única constante a afinar se os preços ficarem apertados em cima ou em
 * baixo. AFINADA COM DADOS REAIS: numa competição inteira (415 atletas), o p90
 * da expectativa ficou ~20 e o máximo ~43 (um outlier). Ancoramos o topo em 22
 * (logo acima do p90) para os melhores chegarem aos 20 JC sem que o outlier
 * puxe toda a escala para baixo. Assim a mediana fica barata (aposta) e montar
 * uma equipa só de estrelas estoura o orçamento de 100 JC — que é a decisão que
 * torna o jogo interessante. Se um dia os pontos mudarem muito, remede o p90 e
 * põe esse valor +2 aqui.
 */
export const EXPECTATIVA_TOPO = 22;

/**
 * O mesmo, mas para os CLÁSSICOS. É mais alto de propósito.
 *
 * Porquê: a janela de um clássico é um ano civil de AUGE do atleta, sem os meses
 * fracos que diluem uma média móvel de 12 meses. As médias saem naturalmente mais
 * altas. Medido no The Hague 2018: nos -90kg apareceram médias de 21,6 / 23,3 /
 * 32,8 — com o topo em 22, os três colavam-se aos 20 JC e escolher entre eles
 * deixava de ser uma decisão. Com 32, o campeão mundial fica no topo e os outros
 * distribuem-se por baixo, como deve ser.
 */
export const EXPECTATIVA_TOPO_CLASSICO = 32;

/**
 * Nº de competições no ano que dá direito à média "cheia" num clássico.
 *
 * O problema que isto resolve: numa janela de ano civil, um atleta pouco ativo
 * pode ter UMA só competição. Se correu bem, a "média" é o resultado dessa vez —
 * e ele vale o preço máximo por uma atuação isolada. (Visto no The Hague 2018:
 * Terumi Otsuji com média 50 e última 50 — o mesmo número, sinal de competição
 * única — a valer 20 JC.)
 *
 * Com menos competições do que isto, a expectativa é reduzida na proporção: 1 em
 * 3 conta um terço, 2 em 3 contam dois terços. Não é castigo — é reconhecer que
 * uma amostra pequena diz pouco. Numa média móvel de 12 meses o problema quase
 * não aparece (apanha sempre várias), por isso só se aplica aos clássicos.
 */
export const MIN_COMPS_CLASSICO = 3;

const DOZE_MESES_MS = 365 * 24 * 3600 * 1000;
const round1 = (n: number) => Math.round(n * 10) / 10;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/**
 * Intervalo de tempo em que a forma é medida (milissegundos epoch).
 *   de  = início da janela (a competição mais antiga que conta)
 *   ate = fim da janela E CORTE DO HISTÓRICO — nada depois disto é considerado,
 *         nem sequer para as "últimas 3 competições".
 *
 * Esse corte é a parte que interessa. Sem ele, um clássico de 2018 continuaria a
 * usar as 3 competições mais recentes do atleta (de 2026) na expectativa, e o
 * preço vinha errado na mesma.
 */
export interface JanelaForma {
  de: number;
  ate: number;
}

/**
 * Janela de um ANO CIVIL inteiro — de 1 de janeiro a 31 de dezembro.
 *
 * É a regra dos clássicos (decidida com o Kainan): "se o Grand Prix é de 2018,
 * usa-se a média de 2018 desse atleta". Simples de explicar e de verificar, e
 * não precisa de saber a data exata da competição original — basta o
 * `anoOriginal`, que o CALENDARIO_2026 já guarda.
 */
export function janelaDoAnoCivil(ano: number): JanelaForma {
  return {
    de: Date.UTC(ano, 0, 1, 0, 0, 0),
    ate: Date.UTC(ano, 11, 31, 23, 59, 59),
  };
}

/**
 * Converte a expectativa de pontos por competição num preço (JC).
 *
 * Escala LINEAR entre o mínimo e o máximo, ancorada em EXPECTATIVA_TOPO:
 *   exp 0 -> 2 JC · exp 8 -> ~6,5 · exp 16 -> ~11 · exp 24 -> ~15,5 · exp 32+ -> 20
 *
 * Isto substitui a escala antiga (3 + exp × 1,1), que saturava aos 15,5 pontos
 * de expectativa: na prática TODOS os atletas bons ficavam colados nos 20 JC e
 * deixava de haver decisão ao montar equipa. Com esta, as faixas do projeto
 * voltam a fazer sentido — elite 15-20, fortes 10-14, médios 6-9, apostas 3-5.
 */
export function precoDeExpectativa(expectativa: number, topo: number = EXPECTATIVA_TOPO): number {
  const alvo = topo > 0 ? topo : EXPECTATIVA_TOPO;
  const fatia = (MAX_PRICE - MIN_PRICE) * (expectativa / alvo);
  return clamp(round1(MIN_PRICE + fatia), MIN_PRICE, MAX_PRICE);
}
/** Lê a data de uma luta (campos do JudoBase) sem depender do tipo IjfContest. */
function dataDaLuta(f: IjfContest): number {
  const rec = f as unknown as Record<string, unknown>;
  const raw = String(rec.competition_date || rec.date_raw || "").replace(/\//g, "-").slice(0, 10);
  if (!raw) return 0;
  const t = Date.parse(raw);
  return isNaN(t) ? 0 : t;
}
export interface FormaResult {
  totalComps: number;
  comps12m: number;
  media12m: number;
  mediaUltimas3: number;
  ultima: number;
  ultimaData: string | null;
  expectativa: number;
  preco: number;
}
/**
 * Calcula a forma recente e o preço de um atleta a partir das suas lutas cruas.
 * @param fights   lutas do atleta (resposta de competitor.contests, já extraída)
 * @param idPerson id do atleta (para saber de que lado lutou em cada luta)
 * @param janela   opcional. Sem ela, comporta-se como sempre: últimos 12 meses a
 *                 contar de agora, e as últimas 3 competições de sempre. Com ela
 *                 (clássicos), o histórico é CORTADO em `janela.ate` e a média
 *                 mede-se dentro de [de, ate].
 */
export function calcularForma(fights: IjfContest[], idPerson: string, janela?: JanelaForma): FormaResult {
  // Agrupa por competição: soma de pontos + data mais recente da competição.
  const comps = new Map<string, { pontos: number; data: number }>();
  for (const f of fights) {
    const comp = String(f.id_competition ?? "—");
    const pts = scoreActions(contestActionsForPerson(f, idPerson));
    const cur = comps.get(comp) || { pontos: 0, data: 0 };
    cur.pontos += pts;
    const d = dataDaLuta(f);
    if (d > cur.data) cur.data = d;
    comps.set(comp, cur);
  }
  const lista = Array.from(comps.entries())
    .map(([id, v]) => ({ id, pontos: round1(v.pontos), data: v.data }))
    .sort((a, b) => b.data - a.data); // mais recente primeiro (por data)

  const agora = Date.now();
  const jan: JanelaForma = janela ?? { de: agora - DOZE_MESES_MS, ate: agora };

  // CORTE DO HISTÓRICO. Só com janela explícita (clássicos): tudo o que aconteceu
  // DEPOIS da data de referência deixa de existir para este cálculo — incluindo
  // as "últimas 3 competições". Sem este corte, um clássico de 2018 media a
  // forma em 2018 mas continuava a puxar as 3 competições mais recentes de 2026
  // para a expectativa, e o preço saía errado na mesma.
  // Sem janela, nada muda: o histórico é o de sempre (comportamento original).
  const historico = janela
    ? lista.filter((c) => c.data > 0 && c.data <= jan.ate)
    : lista;

  const recentes = historico.filter((c) => c.data > 0 && c.data >= jan.de && c.data <= jan.ate);
  const media12m = recentes.length > 0 ? round1(avg(recentes.map((c) => c.pontos))) : 0;
  const ult3 = historico.slice(0, 3);
  const mediaUltimas3 = ult3.length > 0 ? round1(avg(ult3.map((c) => c.pontos))) : 0;
  const ultima = historico.length > 0 ? historico[0].pontos : 0;
  // Se não houver nada dentro da janela, cai para as últimas 3 competições
  // (já cortadas na data de referência, quando há janela).
  let expectativa = recentes.length > 0
    ? round1(expectedPerformance(media12m, mediaUltimas3))
    : mediaUltimas3;

  // AMOSTRA PEQUENA (só clássicos): com poucas competições no ano, a "média" é
  // pouco mais do que um resultado avulso. Reduz-se na proporção, para uma boa
  // atuação isolada não valer o mesmo que um ano inteiro de consistência.
  if (janela && recentes.length > 0 && recentes.length < MIN_COMPS_CLASSICO) {
    expectativa = round1(expectativa * (recentes.length / MIN_COMPS_CLASSICO));
  }

  // O topo da escala é mais alto nos clássicos (ver EXPECTATIVA_TOPO_CLASSICO).
  const topo = janela ? EXPECTATIVA_TOPO_CLASSICO : EXPECTATIVA_TOPO;

  return {
    totalComps: historico.length,
    comps12m: recentes.length,
    media12m,
    mediaUltimas3,
    ultima,
    ultimaData: historico[0]?.data ? new Date(historico[0].data).toISOString().slice(0, 10) : null,
    expectativa,
    preco: precoDeExpectativa(expectativa, topo),
  };
}
function avg(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((s, x) => s + x, 0) / arr.length;
}
