// Testes do planeamento e da entrega CapCut (sem gasto).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { criarAmbiente, autorizar, escreverPlano, referenciasOk, ENDPOINT } from "./ajuda.mjs";
import { lerPlano } from "../lib/plano.mjs";
import { escreverDocumentos } from "../lib/documentos.mjs";
import { gerarEntregaCapcut } from "../lib/capcut.mjs";
import { criarProvedorSimulado } from "../lib/provedores/simulado.mjs";
import { executar, acompanhar } from "../lib/executor.mjs";

test("plano com URL não declarada nas referências é inválido", () => {
  const amb = criarAmbiente();
  amb.plano.cenas[0].geracao.parametros.image_url = "https://outro.test/x.png";
  escreverPlano(amb.raiz, amb.plano);
  assert.throws(() => lerPlano(amb.raiz, "teste"), /URL nos parâmetros não declarada/);
});

test("plano com referência em falta é inválido", () => {
  const amb = criarAmbiente();
  amb.plano.cenas[0].geracao.referencias[0].caminho = "assets/nao-existe.png";
  escreverPlano(amb.raiz, amb.plano);
  assert.throws(() => lerPlano(amb.raiz, "teste"), /referência em falta/);
});

test("o planeador gera roteiro, storyboard e orçamento sem autorizar nada", () => {
  const amb = criarAmbiente();
  const o = escreverDocumentos(amb.raiz, lerPlano(amb.raiz, "teste"));
  const pasta = path.join(amb.raiz, "campanhas", "teste");
  for (const f of ["roteiro.md", "storyboard.md", "orcamento.md"]) assert.ok(fs.existsSync(path.join(pasta, f)));
  assert.equal(o.total, 10);
  assert.ok(!fs.existsSync(path.join(pasta, "autorizacao-gasto.json")));
});

test("orçamento sem preço confirmado fica indeterminado", () => {
  const amb = criarAmbiente();
  delete amb.plano.cenas[0].geracao.preco_unitario;
  escreverPlano(amb.raiz, amb.plano);
  const o = escreverDocumentos(amb.raiz, lerPlano(amb.raiz, "teste"));
  assert.deepEqual(o.semPreco, ["c01"]);
  assert.match(o.texto, /INDETERMINADO/);
});

test("entrega CapCut: cenas numeradas, textos, narração, SRT, mapa musical, efeitos e instruções", async () => {
  const amb = criarAmbiente();
  amb.plano.musica = [{ de_s: 0, ate_s: 8, faixa: "tema", fonte: "biblioteca X", licenca: null, intensidade: "média" }];
  escreverPlano(amb.raiz, amb.plano);
  autorizar(amb);
  const p = criarProvedorSimulado({ precos: { [ENDPOINT]: 10 }, referenciasRemotas: referenciasOk });
  await executar({ raiz: amb.raiz, campanha: "teste", provedor: p, chavePublicaPem: amb.publicKey });
  await acompanhar({ raiz: amb.raiz, campanha: "teste", provedor: p });
  await acompanhar({ raiz: amb.raiz, campanha: "teste", provedor: p });
  const r = gerarEntregaCapcut(amb.raiz, lerPlano(amb.raiz, "teste"));
  const ls = fs.readdirSync(path.join(r.destino, "cenas")).sort();
  assert.deepEqual(ls, ["01_c01.mp4", "02_c09_PENDENTE.txt"]);
  for (const f of ["00_LEIA-ME.md", "textos-ecra.csv", "legendas-narracao.srt", "mapa-musical.csv", "efeitos-transicoes.csv", "narracao/narracao-corrida.txt", "narracao/01_c01.txt"])
    assert.ok(fs.existsSync(path.join(r.destino, f)), f);
  assert.match(fs.readFileSync(path.join(r.destino, "legendas-narracao.srt"), "utf8"), /00:00:00,000 --> 00:00:05,000/);
  assert.match(fs.readFileSync(path.join(r.destino, "mapa-musical.csv"), "utf8"), /A CONFIRMAR/);
  assert.deepEqual(r.faltam, ["02 c09 (gravacao)"]);
});
