/**
 * tests/engine.caracterizacao.ts
 *
 * TESTES DE CARACTERIZAÇÃO do motor de pontuação e valorização.
 *
 * -------------------------------------------------------------------------
 * O QUE É ISTO (e o que NÃO é)
 *
 * Um teste de caracterização não verifica o que o motor DEVIA fazer — verifica
 * o que ele FAZ HOJE, fixando os números atuais como âncora. Serve para uma só
 * coisa: quando alguém mexer no motor mais tarde, qualquer mudança de resultado
 * ACENDE aqui, em vez de passar despercebida até haver dados reais e dinheiro
 * de jogadores em cima. É a rede que o backlog pedia: "fixar o motor antes de
 * haver dados reais".
 *
 * Os valores abaixo foram CAPTURADOS a correr o próprio motor (não calculados à
 * mão). Se um destes testes falhar depois de uma mudança:
 *   - foi SEM QUERER  -> o teste apanhou uma regressão. Corrige o motor.
 *   - foi DE PROPÓSITO -> atualiza aqui o número âncora, de olhos abertos, no
 *                          mesmo commit da mudança. Nunca "para calar o teste".
 *
 * -------------------------------------------------------------------------
 * COMO CORRER
 *
 *   npm test                 (script novo: npx tsx tests/engine.caracterizacao.ts)
 *   npx tsx tests/engine.caracterizacao.ts
 *
 * Sem dependências novas: o `tsx` é buscado pelo npx só para correr, não entra
 * no package.json nem no lock — o deploy (eslint && next build) não lhe toca.
 *
 * Captura inicial: motor v2 ("pontos − preço"), setembro 2026.
 * -------------------------------------------------------------------------
 */
import assert from "node:assert/strict";
import {
  POINTS, scoreActions, scoreShidosSofridos, scoreShidosProvocados, scoreAthlete,
  expectedPerformance, computeNewPrice, beltFromTopFraction, beltForUser,
  assignBeltsForRanking, beltTransition,
  MIN_PRICE, MAX_PRICE, TETO_PRECO, MAX_VARIACAO_PCT, WEIGHT_12M, WEIGHT_LAST3, BELTS,
  type ActionType,
} from "@/lib/engine";
import {
  contestActions, isHansokuMake, scoreContestSide, scoreContestForPerson,
  type IjfContest,
} from "@/lib/ijf";

// ---------------------------------------------------------------------------
// Mini-runner (sem framework): conta passes/falhas e sai com código != 0 se
// algo falhar, para servir num CI simples.
// ---------------------------------------------------------------------------
let passes = 0;
const falhas: string[] = [];
function teste(nome: string, fn: () => void): void {
  try {
    fn();
    passes++;
  } catch (e) {
    falhas.push(`${nome}\n    ${e instanceof Error ? e.message.split("\n").join("\n    ") : String(e)}`);
  }
}

// Constrói uma luta ao estilo do JudoBase (campos crus como strings). Os
// scorers leem por nome ("ippon_b", "penalty_w", ...), por isso passam-se só
// os campos relevantes; o resto do IjfContest não é lido.
function luta(fields: Record<string, string>): IjfContest {
  return { id_fight: "F", id_competition: "C", id_winner: "0", ...fields } as unknown as IjfContest;
}

// ===========================================================================
// 1. CONSTANTES — a tabela e os limites não mudam sem que se saiba.
// ===========================================================================
teste("POINTS: tabela do documento mestre", () => {
  assert.deepEqual(POINTS, {
    ippon_feito: 10, waza_ari_feito: 4, yuko_feito: 2, shido_provocado: 1,
    ippon_sofrido: -5, waza_ari_sofrido: -2, yuko_sofrido: -1,
    shido_recebido: -2, hansoku_make_recebido: -10,
  });
});
teste("Constantes de preço e pesos", () => {
  assert.equal(MIN_PRICE, 2);
  assert.equal(MAX_PRICE, 20);
  assert.equal(TETO_PRECO, 50);
  assert.equal(MAX_VARIACAO_PCT, 50);
  assert.equal(WEIGHT_12M, 0.7);
  assert.equal(WEIGHT_LAST3, 0.3);
});
teste("Ordem das faixas (melhor -> pior)", () => {
  assert.deepEqual([...BELTS], ["preta","marrom","roxa","verde","amarela","azul","branca"]);
});

// ===========================================================================
// 2. PONTUAÇÃO POR AÇÕES
// ===========================================================================
teste("scoreActions: lista vazia = 0", () => {
  assert.equal(scoreActions([]), 0);
});
teste("scoreActions: acumulativo (yuko+waza+ippon = 16)", () => {
  assert.equal(scoreActions(["yuko_feito","waza_ari_feito","ippon_feito"]), 16);
});
teste("scoreActions: 2 waza-aris (8) < 1 ippon (10) — invariante do documento", () => {
  assert.equal(scoreActions(["waza_ari_feito","waza_ari_feito"]), 8);
  assert.equal(scoreActions(["ippon_feito"]), 10);
  assert.ok(scoreActions(["waza_ari_feito","waza_ari_feito"]) < scoreActions(["ippon_feito"]));
});
teste("scoreActions: mistura de positivas e negativas", () => {
  // ippon(+10) + yuko_sof(-1) + waza_sof(-2) + ippon_sof(-5) = 2
  assert.equal(scoreActions(["ippon_feito","yuko_sofrido","waza_ari_sofrido","ippon_sofrido"]), 2);
});

// Shidos CRESCENTES (não são valor fixo — vivem fora da tabela POINTS).
teste("scoreShidosSofridos: crescente (-2,-3,-4,...) ; 3 shidos = -9", () => {
  assert.deepEqual([0,1,2,3,4,5].map(scoreShidosSofridos), [0,-2,-5,-9,-14,-20]);
});
teste("scoreShidosProvocados: crescente (+1,+2,+3,...) ; 3 shidos = +6", () => {
  assert.deepEqual([0,1,2,3,4,5].map(scoreShidosProvocados), [0,1,3,6,10,15]);
});
teste("scoreShidos*: n <= 0 devolve 0", () => {
  assert.equal(scoreShidosSofridos(-3), 0);
  assert.equal(scoreShidosProvocados(-3), 0);
});

teste("scoreAthlete: capitão pontua a dobrar", () => {
  const acts: ActionType[] = ["yuko_feito","waza_ari_feito","ippon_feito"]; // base 16
  assert.equal(scoreAthlete(acts, false), 16);
  assert.equal(scoreAthlete(acts, true), 32);
  assert.equal(scoreAthlete(acts), 16); // default = não-capitão
});

// ===========================================================================
// 3. VALORIZAÇÃO / PREÇO  (motor v2 — "pontos − preço", metade de D)
// ===========================================================================
teste("expectedPerformance: 70/30", () => {
  assert.equal(expectedPerformance(10, 20), 13);
  assert.equal(expectedPerformance(0, 0), 0);
  assert.equal(expectedPerformance(30, 10), 24);
});
teste("computeNewPrice: exemplos validados (spec Economia v2)", () => {
  const p = (preco: number, real: number) => computeNewPrice(preco, 999, real);
  assert.deepEqual(
    { np: p(15, 35).newPrice, d: p(15, 35).delta }, { np: 25, d: 10 });
  assert.deepEqual(
    { np: p(25, 45).newPrice, d: p(25, 45).delta }, { np: 35, d: 10 }); // passa dos 20
  assert.deepEqual(
    { np: p(35, 5).newPrice, d: p(35, 5).delta }, { np: 20, d: -15 });
  assert.deepEqual(
    { np: p(20, 44).newPrice, d: p(20, 44).delta }, { np: 32, d: 12 });
});
teste("computeNewPrice: % mostrada bate certo com o preço", () => {
  const r = computeNewPrice(15, 999, 35);
  assert.equal(r.rawVariationPct, 66.7);
  assert.equal(r.appliedVariationPct, 66.7);
  assert.equal(r.oldPrice, 15);
});
teste("computeNewPrice: piso em MIN_PRICE (2 JC)", () => {
  const r = computeNewPrice(2, 999, -100);
  assert.equal(r.newPrice, 2);
  assert.equal(r.delta, 0);
});
teste("computeNewPrice: teto em TETO_PRECO (50 JC)", () => {
  const r = computeNewPrice(49, 999, 60);
  assert.equal(r.newPrice, 50);
  assert.equal(r.delta, 1);
});
teste("computeNewPrice: D=0 não mexe no preço", () => {
  const r = computeNewPrice(10, 999, 10);
  assert.equal(r.newPrice, 10);
  assert.equal(r.delta, 0);
});
teste("computeNewPrice: `expected` já NÃO entra no movimento (v2)", () => {
  assert.deepEqual(computeNewPrice(15, 0, 35), computeNewPrice(15, 9999, 35));
});

// ===========================================================================
// 4. FAIXAS (percentil)
// ===========================================================================
teste("beltFromTopFraction: cortes 5/15/30/50/70/90", () => {
  assert.deepEqual(
    [0.0, 0.05, 0.051, 0.15, 0.151, 0.30, 0.301, 0.50, 0.501, 0.70, 0.701, 0.90, 0.901, 1.0].map(beltFromTopFraction),
    ["preta","preta","marrom","marrom","roxa","roxa","verde","verde","amarela","amarela","azul","azul","branca","branca"],
  );
});
teste("beltForUser: sem jogadores = branca", () => {
  assert.equal(beltForUser([], 10), "branca");
});
teste("beltForUser: 1 em 10 no topo = marrom (1/10 = 0,1 > 0,05, logo não é preta)", () => {
  assert.equal(beltForUser([1,2,3,4,5,6,7,8,9,100], 100), "marrom");
  assert.equal(beltForUser([1,2,3,4,5,6,7,8,9,100], 1), "branca");
});
teste("assignBeltsForRanking: posições + empates com a MESMA faixa (a melhor)", () => {
  const r = assignBeltsForRanking([
    { id: "a", score: 100 }, { id: "b", score: 50 }, { id: "c", score: 50 }, { id: "d", score: 10 },
  ]);
  assert.deepEqual(r, [
    { id: "a", score: 100, position: 1, belt: "roxa" },
    { id: "b", score: 50, position: 2, belt: "verde" },
    { id: "c", score: 50, position: 3, belt: "verde" },
    { id: "d", score: 10, position: 4, belt: "branca" },
  ]);
});
teste("beltTransition: subiu / manteve / desceu + mensagem", () => {
  assert.deepEqual(beltTransition("azul","roxa"), {
    from: "azul", to: "roxa", direction: "subiu",
    message: "Parabéns! Alcançaste a Faixa Roxa.",
  });
  assert.deepEqual(beltTransition("verde","verde"), {
    from: "verde", to: "verde", direction: "manteve",
    message: "Mantiveste a Faixa Verde. Vamos à próxima rodada.",
  });
  assert.deepEqual(beltTransition("preta","marrom"), {
    from: "preta", to: "marrom", direction: "desceu",
    message: "Caíste para a Faixa Marrom. Recupera a tua posição na próxima rodada.",
  });
});

// ===========================================================================
// 5. PONTUAÇÃO REAL DE UMA LUTA (lib/ijf) — shidos crescentes + ippon fantasma
// ===========================================================================
teste("contestActions: lê ações fixas (feitas + sofridas), sem shidos", () => {
  const clean = luta({ id_person_blue: "B", id_person_white: "W", ippon_b: "1" });
  assert.deepEqual(contestActions(clean, "b"), ["ippon_feito"]);
  assert.deepEqual(contestActions(clean, "w"), ["ippon_sofrido"]);
});
teste("isHansokuMake: 3+ shidos de um lado", () => {
  assert.equal(isHansokuMake(luta({ penalty_w: "3" })), true);
  assert.equal(isHansokuMake(luta({ penalty_w: "2" })), false);
});
teste("scoreContestSide: ippon limpo sem shidos = +10 / -5", () => {
  const f = luta({ id_person_blue: "B", id_person_white: "W", ippon_b: "1" });
  assert.equal(scoreContestSide(f, "b"), 10);
  assert.equal(scoreContestSide(f, "w"), -5);
});
teste("scoreContestSide: ippon a sério + 2 shidos provocados = +13 / -10", () => {
  const f = luta({ id_person_blue: "B", id_person_white: "W", ippon_b: "1", penalty_w: "2" });
  assert.equal(scoreContestSide(f, "b"), 13); // 10 + (1+2)
  assert.equal(scoreContestSide(f, "w"), -10); // -5 + (-2-3)
});
teste("scoreContestSide: hansoku-make ignora o ippon fantasma = +6 / -9", () => {
  const f = luta({ id_person_blue: "B", id_person_white: "W", ippon_b: "1", penalty_w: "3" });
  assert.equal(scoreContestSide(f, "b"), 6);  // só shidos provocados 1+2+3
  assert.equal(scoreContestSide(f, "w"), -9); // só shidos sofridos -(2+3+4)
});
teste("scoreContestForPerson: encaminha por id; ausente = 0", () => {
  const f = luta({ id_person_blue: "B", id_person_white: "W", ippon_b: "1", penalty_w: "2" });
  assert.equal(scoreContestForPerson(f, "B"), 13);
  assert.equal(scoreContestForPerson(f, "W"), -10);
  assert.equal(scoreContestForPerson(f, "Z"), 0);
});

// ---------------------------------------------------------------------------
// Relatório
// ---------------------------------------------------------------------------
console.log(`\n${passes} testes passaram.`);
if (falhas.length > 0) {
  console.error(`\n${falhas.length} FALHARAM:\n`);
  for (const f of falhas) console.error(`  ✗ ${f}\n`);
  process.exit(1);
}
console.log("Motor caracterizado — tudo âncora. ✅");
