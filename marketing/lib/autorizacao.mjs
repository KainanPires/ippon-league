// marketing/lib/autorizacao.mjs
//
// AUTORIZAÇÃO DE GASTO — assinatura Ed25519.
//
// Porquê assinatura e não um campo "aprovado: true": o planeador (e qualquer
// agente) consegue escrever ficheiros JSON. Não consegue produzir uma
// assinatura válida sem a chave privada do Kainan, que vive FORA do repositório
// e está cifrada com uma frase-passe que só o Kainan sabe. O executor só aceita
// autorizações assinadas por essa chave.
//
// A autorização vincula: campanha + versão + hash do pacote de gasto (cenas,
// referências, endpoint, parâmetros/prompt, quantidade, preço unitário) + teto
// de créditos + validade. Qualquer mudança relevante invalida-a.

import crypto from "node:crypto";
import fs from "node:fs";
import { canonico } from "./canonico.mjs";

export class ErroAutorizacao extends Error {}

export function impressaoDigital(chavePublicaPem) {
  const der = crypto.createPublicKey(chavePublicaPem).export({ type: "spki", format: "der" });
  return crypto.createHash("sha256").update(der).digest("hex").slice(0, 32);
}

export function gerarParDeChaves(frasePasse) {
  if (!frasePasse || frasePasse.length < 12) throw new ErroAutorizacao("a frase-passe tem de ter pelo menos 12 caracteres");
  return crypto.generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem", cipher: "aes-256-cbc", passphrase: frasePasse },
  });
}

function corpoAssinado(a) {
  const { assinatura, ...resto } = a;
  void assinatura;
  return canonico(resto);
}

export function assinarAutorizacao(dados, chavePrivadaPem, frasePasse, chavePublicaPem) {
  const chave = crypto.createPrivateKey({ key: chavePrivadaPem, format: "pem", passphrase: frasePasse });
  const aut = {
    tipo: "autorizacao-gasto",
    campanha: dados.campanha,
    versao: dados.versao,
    pacote_sha256: dados.pacote_sha256,
    teto_creditos: dados.teto_creditos,
    quantidade_total: dados.quantidade_total,
    emitida_em: dados.emitida_em,
    expira_em: dados.expira_em,
    chave_fp: impressaoDigital(chavePublicaPem),
  };
  aut.assinatura = crypto.sign(null, Buffer.from(corpoAssinado(aut)), chave).toString("base64");
  return aut;
}

/**
 * Verifica tudo o que o executor precisa. Lança ErroAutorizacao com o motivo.
 * `esperado` = { campanha, versao, pacote_sha256, quantidade_total }.
 */
export function verificarAutorizacao(aut, chavePublicaPem, esperado, agora = new Date()) {
  if (!aut || typeof aut !== "object") throw new ErroAutorizacao("não há autorização de gasto para esta campanha");
  if (aut.tipo !== "autorizacao-gasto") throw new ErroAutorizacao("o ficheiro não é uma autorização de gasto (aprovação criativa não autoriza gastar)");
  if (!aut.assinatura) throw new ErroAutorizacao("autorização sem assinatura");
  const fp = impressaoDigital(chavePublicaPem);
  if (aut.chave_fp !== fp) throw new ErroAutorizacao("autorização assinada por uma chave que não é a do aprovador configurado");
  let ok = false;
  try {
    ok = crypto.verify(null, Buffer.from(corpoAssinado(aut)), crypto.createPublicKey(chavePublicaPem), Buffer.from(aut.assinatura, "base64"));
  } catch { ok = false; }
  if (!ok) throw new ErroAutorizacao("assinatura inválida — a autorização foi alterada ou não foi emitida pelo aprovador");
  if (aut.campanha !== esperado.campanha) throw new ErroAutorizacao(`autorização é da campanha "${aut.campanha}", não de "${esperado.campanha}"`);
  if (aut.versao !== esperado.versao) throw new ErroAutorizacao(`autorização é da versão "${aut.versao}"; o plano está na versão "${esperado.versao}"`);
  if (aut.pacote_sha256 !== esperado.pacote_sha256)
    throw new ErroAutorizacao("o plano mudou depois da autorização (cenas, referências, prompt, modelo, parâmetros, quantidade ou preço) — precisa de nova autorização");
  if (aut.quantidade_total !== esperado.quantidade_total) throw new ErroAutorizacao("quantidade de gerações diferente da autorizada");
  if (!(Number(aut.teto_creditos) > 0)) throw new ErroAutorizacao("teto de créditos inválido");
  if (!aut.expira_em || agora.getTime() > Date.parse(aut.expira_em)) throw new ErroAutorizacao("autorização expirada");
  return aut;
}

export function lerJsonSeExistir(f) {
  if (!fs.existsSync(f)) return null;
  try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return { invalido: true }; }
}
