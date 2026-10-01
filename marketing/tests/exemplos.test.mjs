import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { lerPontosDoMotor, calcularExemplo, verificarExemplos } from "../lib/exemplos.mjs";
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

test("lê a tabela de pontos do motor do jogo", () => {
  const t = lerPontosDoMotor(REPO);
  assert.equal(t.ippon_feito, 10);
  assert.equal(t.waza_ari_sofrido, -2);
});
test("favorito 18 JC: ippon + waza-ari sofrido = 8 pts → 13 JC, dono −5", () => {
  const r = calcularExemplo({ preco: 18, lutas: [{ acoes: ["ippon_feito"] }, { acoes: ["waza_ari_sofrido"] }] }, lerPontosDoMotor(REPO));
  assert.deepEqual([r.pontos, r.precoNovo, r.variacao, r.patrimonio], [8, 13, -5, -5]);
});
test("barganha 6 JC com 16 pts → 11 JC, dono +2,5", () => {
  const r = calcularExemplo({ preco: 6, lutas: [{ acoes: ["ippon_feito"] }, { acoes: ["waza_ari_feito", "yuko_feito"] }] }, lerPontosDoMotor(REPO));
  assert.deepEqual([r.pontos, r.precoNovo, r.variacao, r.patrimonio], [16, 11, 5, 2.5]);
});
test("apanha um número errado no plano", () => {
  const erros = verificarExemplos({ exemplos: [{ id: "x", preco: 18, lutas: [{ acoes: ["ippon_feito"] }, { acoes: ["waza_ari_sofrido"] }], pontos: 13, preco_novo: 13, patrimonio: -5 }] }, REPO);
  assert.equal(erros.length, 1);
  assert.match(erros[0], /pontos = 13, mas pelas regras do jogo dá 8/);
});
test("preço nunca abaixo de 2 JC", () => {
  const r = calcularExemplo({ preco: 4, lutas: [{ acoes: ["ippon_sofrido"] }] }, lerPontosDoMotor(REPO));
  assert.equal(r.precoNovo, 2);
});

// Compara a pontuação de luta da Máquina com as funções REAIS do motor (lib/engine.ts).
test("luta com shidos e hansoku bate com o motor real", async () => {
  const eng = await import(path.join(REPO, "lib", "engine.ts"));
  const t = lerPontosDoMotor(REPO);
  const { pontosDaLuta } = await import("../lib/exemplos.mjs");
  for (let se = 0; se <= 3; se++) for (let sa = 0; sa <= 3; sa++) for (const ip of [0, 1]) for (const wz of [0, 1]) {
    const hansoku = se >= 3 || sa >= 3;
    const acoes = [];
    if (!hansoku && ip) acoes.push("ippon_feito");
    if (wz) acoes.push("waza_ari_feito");
    const esperado = eng.scoreActions(acoes) + eng.scoreShidosSofridos(se) + eng.scoreShidosProvocados(sa);
    assert.equal(pontosDaLuta({ eu: { ippon: ip, waza: wz, shido: se }, adv: { shido: sa } }, t), esperado);
  }
  // exemplos documentados em lib/ijf.ts
  assert.equal(pontosDaLuta({ eu: {}, adv: { shido: 3, ippon: 0 } }, t), 6);
  assert.equal(pontosDaLuta({ eu: { shido: 3 }, adv: { ippon: 1 } }, t), -9);
  assert.equal(pontosDaLuta({ eu: { ippon: 1 }, adv: { shido: 2 } }, t), 13);
});

import { verificarNarracao, contarPalavras } from "../lib/narracao.mjs";
const base = () => ({ cenas: [{ id: "c01", duracao_s: 15, narracao: "" }], audio: { narracao: { continua: true, velocidade_alvo_wps: 2.7,
  trechos: [{ id: "T1", cenas: ["c01"], texto: "Você tem cem Judocoins. Quem entra no seu time?", intencao: "desafiar", energia: "alta", ritmo: "contínuo", velocidade: "rápida", enfase: ["cem Judocoins"], entonacao: "sobe em quem", duracao_estimada_s: 3.5, edicao: "sem silêncio" }],
  texto_completo: "Você tem cem Judocoins. Quem entra no seu time?" } } });
test("narração contínua válida passa", () => { const r = verificarNarracao(base()); assert.deepEqual(r.erros, []); assert.equal(r.estimativa.palavras, 9); });
test("reticências e [pausa] são bloqueadas", () => {
  const p = base(); p.audio.narracao.trechos[0].texto = "Você tem… cem [pausa 0,3 s] Judocoins"; p.audio.narracao.texto_completo = p.audio.narracao.trechos[0].texto;
  const e = verificarNarracao(p).erros.join(" | "); assert.match(e, /reticências/); assert.match(e, /pausa/);
});
test("falta direção vocal é erro", () => { const p = base(); delete p.audio.narracao.trechos[0].energia; assert.match(verificarNarracao(p).erros.join(), /energia/); });
test("texto que não cabe no tempo é erro", () => { const p = base(); p.cenas[0].duracao_s = 2; assert.match(verificarNarracao(p).erros.join(), /não cabe|corte ou reformule/); });
test("bloco contínuo tem de bater com os trechos", () => { const p = base(); p.audio.narracao.texto_completo = "outra coisa"; assert.match(verificarNarracao(p).erros.join(), /não coincide/); });
test("plano antigo (sem continua) não é afetado", () => { assert.deepEqual(verificarNarracao({ cenas: [{ id: "c01", narracao: "a… b" }] }).erros, []); });
test("contagem de palavras com acentos e hífens", () => { assert.equal(contarPalavras("Waza-ari, yuko e ippon: dezesseis!"), 5); });
