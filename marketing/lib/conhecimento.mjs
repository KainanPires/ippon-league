// marketing/lib/conhecimento.mjs
//
// Confere os números da base de conhecimento (conhecimento/factos.json) com o
// código da app. Se o jogo mudar e a base não, isto acusa — e o ippon-produto
// não deixa o facto desatualizado ir para um roteiro.
// Só LÊ ficheiros da app. Não importa nem executa código do jogo.

import fs from "node:fs";
import path from "node:path";

export function verificarConhecimento(raizMarketing) {
  const raizApp = path.resolve(raizMarketing, "..");
  const factos = JSON.parse(fs.readFileSync(path.join(raizMarketing, "conhecimento", "factos.json"), "utf8"));
  const linhas = [];
  let ok = true;
  for (const f of factos.factos) {
    const ficheiro = path.join(raizApp, f.fonte.ficheiro);
    if (!fs.existsSync(ficheiro)) { ok = false; linhas.push(`❌ ${f.id}: ficheiro-fonte desapareceu (${f.fonte.ficheiro})`); continue; }
    const m = fs.readFileSync(ficheiro, "utf8").match(new RegExp(f.fonte.padrao, "m"));
    const atual = m ? m.slice(1).join("|") : null;
    if (atual === String(f.valor)) linhas.push(`✅ ${f.id} = ${f.valor}`);
    else { ok = false; linhas.push(`❌ ${f.id}: base diz "${f.valor}", código diz "${atual ?? "não encontrado"}" (${f.fonte.ficheiro})`); }
  }
  return { ok, linhas };
}
