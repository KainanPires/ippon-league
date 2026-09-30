// Utilitários dos testes: cria um "marketing" temporário, com chave de
// aprovador própria do teste, uma campanha e uma referência.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { gerarParDeChaves, assinarAutorizacao } from "../lib/autorizacao.mjs";
import { lerPlano, pacoteDeGasto, hashPacote } from "../lib/plano.mjs";
import { FICHEIRO_AUTORIZACAO } from "../lib/executor.mjs";

export const FRASE = "frase-passe-de-teste-123";
export const ENDPOINT = "kling-video/v3.0-turbo/image-to-video";
export const URL_REF = "https://exemplo.test/dodo.png";

export function criarAmbiente({ quantidade = 1, preco = 10, segundaCena = false } = {}) {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), "ippon-mkt-teste-"));
  fs.mkdirSync(path.join(raiz, "config"), { recursive: true });
  fs.mkdirSync(path.join(raiz, "assets"), { recursive: true });
  const { publicKey, privateKey } = gerarParDeChaves(FRASE);
  fs.writeFileSync(path.join(raiz, "config", "aprovador.pub.pem"), publicKey);
  fs.writeFileSync(path.join(raiz, "assets", "dodo.png"), "PNG-DO-DODO-v1");
  const cena = (id) => ({
    id, duracao_s: 5, origem: "higgsfield",
    acao: "Dôdo aponta para a câmara", texto_ecra: [{ texto: "FANTASY DE JUDÔ" }], narracao: "Fantasy de judô.",
    geracao: {
      endpoint: ENDPOINT,
      parametros: { prompt: `cartoon platypus judoka mascot ${id}`, image_url: URL_REF, duration: 5, resolution: "720p" },
      referencias: [{ caminho: "assets/dodo.png", url: URL_REF }],
      quantidade,
      preco_unitario: { creditos: preco, fonte: "teste", data: "2026-09-30" },
    },
  });
  const plano = {
    campanha: { id: "teste", versao: "1", titulo: "Teste" },
    cenas: [cena("c01"), ...(segundaCena ? [cena("c02")] : []), { id: "c09", duracao_s: 3, origem: "gravacao", texto_ecra: [{ texto: "IPPON LEAGUE" }] }],
  };
  fs.mkdirSync(path.join(raiz, "campanhas", "teste"), { recursive: true });
  escreverPlano(raiz, plano);
  return { raiz, publicKey, privateKey, plano };
}

export function escreverPlano(raiz, plano) {
  fs.writeFileSync(path.join(raiz, "campanhas", plano.campanha.id, "plano.json"), JSON.stringify(plano, null, 2));
}

export function autorizar(amb, { teto = 100, horas = 1, privateKey = amb.privateKey, publicKey = amb.publicKey } = {}) {
  const plano = lerPlano(amb.raiz, "teste");
  const pacote = pacoteDeGasto(amb.raiz, plano);
  const agora = new Date();
  const aut = assinarAutorizacao({
    campanha: "teste", versao: plano.campanha.versao, pacote_sha256: hashPacote(pacote), teto_creditos: teto,
    quantidade_total: pacote.geracoes.reduce((s, g) => s + g.quantidade, 0),
    emitida_em: agora.toISOString(), expira_em: new Date(agora.getTime() + horas * 3600e3).toISOString(),
  }, privateKey, FRASE, publicKey);
  fs.writeFileSync(path.join(amb.raiz, "campanhas", "teste", FICHEIRO_AUTORIZACAO), JSON.stringify(aut, null, 2));
  return aut;
}

export const referenciasOk = { [URL_REF]: "PNG-DO-DODO-v1" };
