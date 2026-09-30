// Testes da trava de gasto — fornecedor SIMULADO, sem rede, sem custo.
// Correr: node --test marketing/tests/

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { criarAmbiente, autorizar, escreverPlano, referenciasOk, ENDPOINT, URL_REF, FRASE } from "./ajuda.mjs";
import { criarProvedorSimulado } from "../lib/provedores/simulado.mjs";
import { gerarParDeChaves } from "../lib/autorizacao.mjs";
import { executar, acompanhar, reconciliar, rejeitarCena } from "../lib/executor.mjs";
import { lerRazao, estadoUnidades, adquirirTrinco, registar } from "../lib/razao.mjs";
import { criarProvedorHiggsfield } from "../lib/provedores/higgsfield.mjs";

const sim = (o = {}) => criarProvedorSimulado({ precos: { [ENDPOINT]: 10 }, referenciasRemotas: referenciasOk, ...o });
const correr = (amb, provedor) => executar({ raiz: amb.raiz, campanha: "teste", provedor, chavePublicaPem: amb.publicKey });

// ---------------------------------------------------------------- 1
test("1. sem autorização de gasto, nada é enviado", async () => {
  const amb = criarAmbiente();
  const p = sim();
  const r = await correr(amb, p);
  assert.match(r.bloqueio, /não há autorização/);
  assert.equal(p.tentativas.length, 0);
});

// ---------------------------------------------------------------- 2
test("2. aprovação criativa sozinha não autoriza gasto", async () => {
  const amb = criarAmbiente();
  const pasta = path.join(amb.raiz, "campanhas", "teste");
  fs.writeFileSync(path.join(pasta, "aprovacao-criativa.json"), JSON.stringify({ aprovado: true, por: "Kainan" }));
  // mesmo que alguém escreva um "aprovado: true" no ficheiro da autorização de gasto:
  fs.writeFileSync(path.join(pasta, "autorizacao-gasto.json"), JSON.stringify({ tipo: "aprovacao-criativa", aprovado: true }));
  const p = sim();
  assert.match((await correr(amb, p)).bloqueio, /aprovação criativa não autoriza/);
  // e um campo editado à mão sem assinatura válida:
  fs.writeFileSync(path.join(pasta, "autorizacao-gasto.json"), JSON.stringify({ tipo: "autorizacao-gasto", aprovado: true, teto_creditos: 999 }));
  assert.match((await correr(amb, p)).bloqueio, /sem assinatura/);
  assert.equal(p.tentativas.length, 0);
});

test("2b. autorização assinada por outra chave (ex.: do planeador) é recusada", async () => {
  const amb = criarAmbiente();
  const intruso = gerarParDeChaves(FRASE); // outra chave, mesma frase (a do planeador)
  autorizar(amb, { privateKey: intruso.privateKey, publicKey: intruso.publicKey });
  // o intruso tenta usar a sua impressão digital
  const p = sim();
  assert.match((await correr(amb, p)).bloqueio, /não é a do aprovador/);
  assert.equal(p.tentativas.length, 0);
});

test("2c. autorização adulterada (teto aumentado depois de assinar) é recusada", async () => {
  const amb = criarAmbiente();
  autorizar(amb, { teto: 10 });
  const f = path.join(amb.raiz, "campanhas", "teste", "autorizacao-gasto.json");
  const a = JSON.parse(fs.readFileSync(f, "utf8"));
  a.teto_creditos = 1000;
  fs.writeFileSync(f, JSON.stringify(a));
  const p = sim();
  assert.match((await correr(amb, p)).bloqueio, /assinatura inválida/);
  assert.equal(p.tentativas.length, 0);
});

// ---------------------------------------------------------------- 3
test("3a. mudar a versão depois de autorizar bloqueia", async () => {
  const amb = criarAmbiente();
  autorizar(amb);
  amb.plano.campanha.versao = "2";
  escreverPlano(amb.raiz, amb.plano);
  const p = sim();
  assert.match((await correr(amb, p)).bloqueio, /versão/);
  assert.equal(p.tentativas.length, 0);
});

test("3b. mudar o prompt depois de autorizar bloqueia", async () => {
  const amb = criarAmbiente();
  autorizar(amb);
  amb.plano.cenas[0].geracao.parametros.prompt += " com chapéu";
  escreverPlano(amb.raiz, amb.plano);
  const p = sim();
  assert.match((await correr(amb, p)).bloqueio, /o plano mudou depois da autorização/);
  assert.equal(p.tentativas.length, 0);
});

test("3c. mudar o ficheiro de referência depois de autorizar bloqueia", async () => {
  const amb = criarAmbiente();
  autorizar(amb);
  fs.writeFileSync(path.join(amb.raiz, "assets", "dodo.png"), "PNG-DO-DODO-v2-alterado");
  const p = sim({ referenciasRemotas: { [URL_REF]: "PNG-DO-DODO-v2-alterado" } });
  assert.match((await correr(amb, p)).bloqueio, /o plano mudou depois da autorização/);
  assert.equal(p.tentativas.length, 0);
});

test("3d. referência publicada diferente da autorizada bloqueia", async () => {
  const amb = criarAmbiente();
  autorizar(amb);
  const p = sim({ referenciasRemotas: { [URL_REF]: "OUTRA-IMAGEM" } });
  assert.match((await correr(amb, p)).bloqueio, /não é igual ao ficheiro autorizado/);
  assert.equal(p.tentativas.length, 0);
});

test("3e. mudar o modelo/endpoint ou a quantidade depois de autorizar bloqueia", async () => {
  const amb = criarAmbiente();
  autorizar(amb);
  amb.plano.cenas[0].geracao.quantidade = 2;
  escreverPlano(amb.raiz, amb.plano);
  const p = sim();
  assert.match((await correr(amb, p)).bloqueio, /o plano mudou/);
  amb.plano.cenas[0].geracao.quantidade = 1;
  amb.plano.cenas[0].geracao.endpoint = "kling-video/v3.0/image-to-video";
  escreverPlano(amb.raiz, amb.plano);
  assert.match((await correr(amb, p)).bloqueio, /o plano mudou/);
  assert.equal(p.tentativas.length, 0);
});

test("3f. mudar só a narração (sem efeito no gasto) não invalida a autorização", async () => {
  const amb = criarAmbiente();
  autorizar(amb);
  amb.plano.cenas[0].narracao = "Outra frase.";
  escreverPlano(amb.raiz, amb.plano);
  const p = sim();
  const r = await correr(amb, p);
  assert.equal(r.bloqueio, null);
  assert.equal(p.tentativas.length, 1);
});

// ---------------------------------------------------------------- 4
test("4a. teto menor que o custo bloqueia antes de enviar", async () => {
  const amb = criarAmbiente({ preco: 10 });
  autorizar(amb, { teto: 5 });
  const p = sim();
  assert.match((await correr(amb, p)).bloqueio, /orçamento insuficiente/);
  assert.equal(p.tentativas.length, 0);
});

test("4b. preço atual maior do que o autorizado bloqueia", async () => {
  const amb = criarAmbiente({ preco: 10 });
  autorizar(amb, { teto: 100 });
  const p = sim({ precos: { [ENDPOINT]: 12 } });
  assert.match((await correr(amb, p)).bloqueio, /maior do que o autorizado/);
  assert.equal(p.tentativas.length, 0);
});

test("4c. sem preço aplicável confirmado pelo fornecedor, bloqueia", async () => {
  const amb = criarAmbiente();
  autorizar(amb);
  const p = sim({ precos: {} });
  assert.match((await correr(amb, p)).bloqueio, /preço aplicável não confirmado/);
  assert.equal(p.tentativas.length, 0);
});

test("4d. teto mensal configurado bloqueia", async () => {
  const amb = criarAmbiente({ preco: 10 });
  fs.writeFileSync(path.join(amb.raiz, "config", "limites.json"), JSON.stringify({ teto_mensal_creditos: 5 }));
  autorizar(amb, { teto: 100 });
  const p = sim();
  assert.match((await correr(amb, p)).bloqueio, /teto mensal/);
  assert.equal(p.tentativas.length, 0);
});

test("4e. o teto é respeitado a meio: com 2 cenas de 10 e teto 15, só 1 é enviada", async () => {
  const amb = criarAmbiente({ preco: 10, segundaCena: true });
  autorizar(amb, { teto: 15 });
  const p = sim();
  const r = await correr(amb, p);
  assert.match(r.bloqueio, /orçamento insuficiente/);
  assert.equal(p.aceites, 1);
});

// ---------------------------------------------------------------- 5
test("5. a quantidade autorizada nunca é excedida, mesmo a correr várias vezes", async () => {
  const amb = criarAmbiente({ quantidade: 2 });
  autorizar(amb, { teto: 100 });
  const p = sim();
  await correr(amb, p);
  await correr(amb, p);
  await correr(amb, p);
  assert.equal(p.tentativas.length, 2);
  assert.equal(p.aceites, 2);
});

// ---------------------------------------------------------------- 6
test("6a. timeout no envio: estado incerto, execução pára, reinício não reenvia", async () => {
  const amb = criarAmbiente({ quantidade: 2 });
  autorizar(amb);
  const p = sim({ comportamentos: ["aceite-timeout"] });
  const r1 = await correr(amb, p);
  assert.match(r1.bloqueio, /estado incerto/);
  const r2 = await correr(amb, p); // "reinício"
  assert.match(r2.bloqueio, /reconciliar/);
  assert.equal(p.tentativas.length, 1);
  assert.equal(p.aceites, 1);
});

test("6b. queda do processo entre reservar e enviar: reinício bloqueia até reconciliar", async () => {
  const amb = criarAmbiente();
  autorizar(amb);
  // simula a queda: a reserva ficou escrita no razão, a resposta nunca chegou
  // e o processo morreu (o trinco foi libertado pelo sistema/por uma pessoa).
  registar(path.join(amb.raiz, "campanhas", "teste"), { tipo: "reservado", unidade: "1/c01#1", cena: "c01", creditos: 10, idempotency_key: "k-1", autorizacao: "x" });
  const p = sim();
  const r = await correr(amb, p);
  assert.match(r.bloqueio, /estado incerto/);
  assert.equal(p.tentativas.length, 0);
  // o Kainan confirma no painel que o pedido não existe: fica terminal, sem reenvio
  const rec = await reconciliar({ raiz: amb.raiz, campanha: "teste", provedor: p, unidade: "1/c01#1", naoEnviado: true, confirmacaoHumana: true });
  assert.equal(rec.estado, "nao_enviado");
  const r2 = await correr(amb, p);
  assert.equal(r2.bloqueio, null);
  assert.equal(p.tentativas.length, 0);
});

test("6c. marcar como não enviado exige confirmação humana", async () => {
  const amb = criarAmbiente();
  autorizar(amb);
  await correr(amb, sim({ comportamentos: ["timeout"] }));
  await assert.rejects(reconciliar({ raiz: amb.raiz, campanha: "teste", provedor: sim(), unidade: "1/c01#1", naoEnviado: true }), /confirmação humana/);
});

test("6d. reconciliar com request_id consulta o estado e não reenvia", async () => {
  const amb = criarAmbiente();
  autorizar(amb);
  const p = sim({ comportamentos: ["aceite-timeout"] });
  await correr(amb, p);
  const rid = p.envios[0].request_id; // o Kainan encontrou-o no painel
  const rec = await reconciliar({ raiz: amb.raiz, campanha: "teste", provedor: p, unidade: "1/c01#1", requestId: rid });
  assert.equal(rec.request_id, rid);
  const r = await correr(amb, p);
  assert.equal(r.bloqueio, null);
  assert.equal(p.tentativas.length, 1);
});

test("6e. execuções concorrentes: só uma corre e o gasto não duplica", async () => {
  const amb = criarAmbiente({ quantidade: 2, segundaCena: true });
  autorizar(amb, { teto: 1000 });
  const p = sim({ atrasoMs: 20 });
  const rs = await Promise.allSettled([correr(amb, p), correr(amb, p), correr(amb, p)]);
  const bloqueadas = rs.filter((r) => r.status === "rejected" && /execução em curso/.test(r.reason.message));
  assert.ok(bloqueadas.length >= 1);
  await correr(amb, p); // depois das corridas, completa o que faltar
  assert.equal(p.tentativas.length, 4);
  assert.equal(p.aceites, 4);
});

test("6f. trinco abandonado impede execução até ser removido por uma pessoa", async () => {
  const amb = criarAmbiente();
  autorizar(amb);
  adquirirTrinco(path.join(amb.raiz, "campanhas", "teste"), "processo-que-morreu"); // nunca libertado
  const p = sim();
  await assert.rejects(correr(amb, p), /execução em curso ou interrompida/);
  assert.equal(p.tentativas.length, 0);
});

test("6g. erro 5xx no envio é tratado como incerto (sem reenvio)", async () => {
  const amb = criarAmbiente({ quantidade: 2 });
  autorizar(amb);
  const p = sim({ comportamentos: ["http500"] });
  assert.match((await correr(amb, p)).bloqueio, /estado incerto/);
  assert.match((await correr(amb, p)).bloqueio, /reconciliar/);
  assert.equal(p.tentativas.length, 1);
});

// ---------------------------------------------------------------- 7
test("7a. geração falhada não provoca nova tentativa", async () => {
  const amb = criarAmbiente();
  autorizar(amb);
  const p = sim({ estadosFinais: { 0: "failed" } });
  await correr(amb, p);
  await acompanhar({ raiz: amb.raiz, campanha: "teste", provedor: p });
  await acompanhar({ raiz: amb.raiz, campanha: "teste", provedor: p });
  const u = estadoUnidades(lerRazao(path.join(amb.raiz, "campanhas", "teste"))).get("1/c01#1");
  assert.equal(u.estado, "failed");
  await correr(amb, p);
  assert.equal(p.tentativas.length, 1);
});

test("7b. cena rejeitada na revisão não gera outra tentativa", async () => {
  const amb = criarAmbiente({ quantidade: 2 });
  autorizar(amb);
  rejeitarCena({ raiz: amb.raiz, campanha: "teste", cena: "c01", motivo: "Dôdo deformado" });
  const p = sim();
  const r = await correr(amb, p);
  assert.ok(r.ignoradas.some((x) => /rejeitada/.test(x)));
  assert.equal(p.tentativas.length, 0);
});

test("7c. conteúdo moderado (nsfw) fica terminal e o custo continua contado", async () => {
  const amb = criarAmbiente({ preco: 10, segundaCena: true });
  autorizar(amb, { teto: 15 });
  const p = sim({ estadosFinais: { 0: "nsfw" } });
  await correr(amb, p);
  await acompanhar({ raiz: amb.raiz, campanha: "teste", provedor: p });
  await acompanhar({ raiz: amb.raiz, campanha: "teste", provedor: p });
  const r = await correr(amb, p); // não presume devolução: c02 não cabe no teto
  assert.match(r.bloqueio, /orçamento insuficiente/);
  assert.equal(p.tentativas.length, 1);
});

// ---------------------------------------------------------------- credenciais
test("credenciais nunca aparecem em erros nem no razão", async () => {
  const env = { HF_API_KEY_ID: "id-secreto-123", HF_API_KEY_SECRET: "segredo-super-456" };
  const fetchFalso = async (_url, opt) => ({
    status: 500,
    text: async () => `eco ${opt.headers.Authorization}`,
    ok: false,
  });
  const prov = criarProvedorHiggsfield({ env, fetchImpl: fetchFalso });
  const amb = criarAmbiente();
  autorizar(amb);
  prov.obterReferencia = async () => Buffer.from("PNG-DO-DODO-v1");
  const r = await executar({ raiz: amb.raiz, campanha: "teste", provedor: prov, chavePublicaPem: amb.publicKey });
  const tudo = r.bloqueio + fs.readdirSync(path.join(amb.raiz, "campanhas", "teste", "execucao")).map((f) => fs.readFileSync(path.join(amb.raiz, "campanhas", "teste", "execucao", f), "utf8")).join("");
  assert.ok(!tudo.includes("segredo-super-456"));
  assert.ok(!tudo.includes("id-secreto-123"));
});

test("sem credenciais no ambiente, o cliente real recusa-se a chamar a API", async () => {
  let chamou = false;
  const prov = criarProvedorHiggsfield({ env: {}, fetchImpl: async () => { chamou = true; } });
  await assert.rejects(prov.estimar(ENDPOINT, {}), /HF_API_KEY_ID/);
  assert.equal(chamou, false);
});

test("verificar credenciais usa só a consulta de estado (nunca gera)", async () => {
  const chamadas = [];
  const prov = criarProvedorHiggsfield({
    env: { HF_API_KEY_ID: "a", HF_API_KEY_SECRET: "b" },
    fetchImpl: async (url, opt) => { chamadas.push([opt.method, url]); return { status: 404, text: async () => "{}" }; },
  });
  const r = await prov.verificarCredenciais();
  assert.equal(r.ok, true);
  assert.deepEqual(chamadas, [["GET", "https://api.higgsfield.ai/requests/00000000-0000-4000-8000-000000000000/status"]]);
});
