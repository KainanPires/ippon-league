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
  assert.deepEqual(r, { pontos: 8, precoNovo: 13, variacao: -5, patrimonio: -5 });
});
test("barganha 6 JC com 16 pts → 11 JC, dono +2,5", () => {
  const r = calcularExemplo({ preco: 6, lutas: [{ acoes: ["ippon_feito"] }, { acoes: ["waza_ari_feito", "yuko_feito"] }] }, lerPontosDoMotor(REPO));
  assert.deepEqual(r, { pontos: 16, precoNovo: 11, variacao: 5, patrimonio: 2.5 });
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
