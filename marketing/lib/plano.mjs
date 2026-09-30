// marketing/lib/plano.mjs
//
// Lê e valida o plano de uma campanha (campanhas/<id>/plano.json) e extrai dele
// o PACOTE DE GASTO: a parte do plano que decide dinheiro — campanha, versão,
// cenas geradas, endpoint, parâmetros (incluindo o prompt), referências (com
// hash do ficheiro), quantidade e preço unitário autorizado.
//
// A autorização assina o hash deste pacote. Mudar a versão, um prompt, um
// parâmetro, a quantidade, o preço ou o conteúdo de uma referência muda o hash
// e invalida a autorização. Mudar só texto de ecrã, narração ou música NÃO
// muda o pacote (não mexe no gasto) — mas muda a versão se o planeador a subir.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hashCanonico, sha256Ficheiro } from "./canonico.mjs";
import { verificarExemplos } from "./exemplos.mjs";

export const RAIZ_MARKETING = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export class ErroPlano extends Error {}

export function pastaCampanha(raiz, id) {
  if (!/^[a-z0-9][a-z0-9-]{1,60}$/.test(id)) throw new ErroPlano(`id de campanha inválido: "${id}"`);
  return path.join(raiz, "campanhas", id);
}

export function lerPlano(raiz, id) {
  const f = path.join(pastaCampanha(raiz, id), "plano.json");
  if (!fs.existsSync(f)) throw new ErroPlano(`plano não encontrado: ${path.relative(raiz, f)}`);
  let plano;
  try { plano = JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) { throw new ErroPlano(`plano.json ilegível: ${e.message}`); }
  validarPlano(raiz, plano, id);
  return plano;
}

function urlsEm(valor, acc = []) {
  if (typeof valor === "string" && /^https?:\/\//i.test(valor)) acc.push(valor);
  else if (Array.isArray(valor)) valor.forEach((v) => urlsEm(v, acc));
  else if (valor && typeof valor === "object") Object.values(valor).forEach((v) => urlsEm(v, acc));
  return acc;
}

export function validarPlano(raiz, plano, idEsperado) {
  const erros = [];
  const c = plano?.campanha;
  if (!c || typeof c !== "object") erros.push("falta `campanha`");
  else {
    if (c.id !== idEsperado) erros.push(`campanha.id ("${c?.id}") não bate com a pasta ("${idEsperado}")`);
    if (typeof c.versao !== "string" || !c.versao.trim()) erros.push("campanha.versao é obrigatória");
  }
  if (!Array.isArray(plano?.cenas) || plano.cenas.length === 0) erros.push("`cenas` tem de ser uma lista não vazia");
  const ids = new Set();
  for (const cena of plano?.cenas ?? []) {
    if (!/^c\d{2,3}$/.test(cena?.id ?? "")) erros.push(`cena com id inválido: "${cena?.id}" (usar c01, c02…)`);
    if (ids.has(cena.id)) erros.push(`cena repetida: ${cena.id}`);
    ids.add(cena.id);
    if (!(Number(cena.duracao_s) > 0)) erros.push(`${cena.id}: duracao_s obrigatória`);
    const g = cena.geracao;
    if (!g) continue;
    if (typeof g.endpoint !== "string" || !/^[a-z0-9][a-z0-9._/-]*$/.test(g.endpoint) || g.endpoint.includes(".."))
      erros.push(`${cena.id}: geracao.endpoint inválido (usar o endpoint id da documentação, ex.: kling-video/v3.0-turbo/image-to-video)`);
    if (!g.parametros || typeof g.parametros !== "object") erros.push(`${cena.id}: geracao.parametros obrigatório`);
    if (!Number.isInteger(g.quantidade) || g.quantidade < 1 || g.quantidade > 4)
      erros.push(`${cena.id}: geracao.quantidade tem de ser inteiro entre 1 e 4`);
    const refs = Array.isArray(g.referencias) ? g.referencias : [];
    const urlsPermitidas = new Set();
    for (const r of refs) {
      if (!r?.caminho) { erros.push(`${cena.id}: referência sem caminho`); continue; }
      const abs = path.resolve(raiz, r.caminho);
      if (!abs.startsWith(raiz + path.sep)) { erros.push(`${cena.id}: referência fora da pasta marketing: ${r.caminho}`); continue; }
      if (!fs.existsSync(abs)) { erros.push(`${cena.id}: referência em falta: ${r.caminho}`); continue; }
      if (r.sha256 && r.sha256 !== sha256Ficheiro(abs)) erros.push(`${cena.id}: o ficheiro ${r.caminho} mudou (sha256 diferente do plano)`);
      if (r.url) urlsPermitidas.add(r.url);
    }
    for (const u of urlsEm(g.parametros)) {
      if (!urlsPermitidas.has(u)) erros.push(`${cena.id}: URL nos parâmetros não declarada nas referências: ${u}`);
    }
    if (g.preco_unitario != null) {
      const p = g.preco_unitario;
      if (!(Number(p.creditos) > 0) || !p.fonte || !p.data) erros.push(`${cena.id}: preco_unitario precisa de creditos>0, fonte e data`);
    }
  }
  // Exemplos com números: têm de bater com as regras reais do jogo (lib/engine.ts).
  if (plano?.exemplos) erros.push(...verificarExemplos(plano, path.resolve(raiz, "..")));
  if (erros.length) throw new ErroPlano("plano inválido:\n - " + erros.join("\n - "));
}

/** Parte do plano que decide gasto. Determinística. */
export function pacoteDeGasto(raiz, plano) {
  const geracoes = plano.cenas
    .filter((c) => c.geracao)
    .map((c) => ({
      cena: c.id,
      endpoint: c.geracao.endpoint,
      parametros: c.geracao.parametros,
      quantidade: c.geracao.quantidade,
      preco_unitario_creditos: c.geracao.preco_unitario ? Number(c.geracao.preco_unitario.creditos) : null,
      referencias: (c.geracao.referencias ?? []).map((r) => ({
        caminho: r.caminho,
        sha256: sha256Ficheiro(path.resolve(raiz, r.caminho)),
        url: r.url ?? null,
      })),
    }))
    .sort((a, b) => a.cena.localeCompare(b.cena));
  return { campanha: plano.campanha.id, versao: plano.campanha.versao, geracoes };
}

export function hashPacote(pacote) {
  return hashCanonico(pacote);
}

/** Total máximo do pacote, se todos os preços estiverem confirmados. */
export function custoMaximo(pacote) {
  let total = 0;
  const semPreco = [];
  for (const g of pacote.geracoes) {
    if (!(g.preco_unitario_creditos > 0)) { semPreco.push(g.cena); continue; }
    total += g.preco_unitario_creditos * g.quantidade;
  }
  return { total: Math.round(total * 1000) / 1000, semPreco };
}
