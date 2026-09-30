// Verifica os números dos exemplos de um plano contra as regras REAIS do jogo.
// Os pontos por ação são lidos de lib/engine.ts (fonte única), para nunca divergir.
// Regras de preço e património (lib/engine.ts computeNewPrice e lib/congelar.ts):
//   D = pontos − preço · novo preço = preço + 0,5·D (mín. 2 JC) · arredondado a 0,1
//   património do dono: sobe metade da valorização; desce a desvalorização inteira.
import fs from "node:fs";
import path from "node:path";

export function lerPontosDoMotor(raizRepo) {
  const src = fs.readFileSync(path.join(raizRepo, "lib", "engine.ts"), "utf8");
  const bloco = src.match(/export const POINTS[^{]*\{([\s\S]*?)\};/);
  if (!bloco) throw new Error("não encontrei a tabela POINTS em lib/engine.ts");
  const pontos = {};
  for (const m of bloco[1].matchAll(/(\w+)\s*:\s*(-?\d+(?:\.\d+)?)/g)) pontos[m[1]] = Number(m[2]);
  return pontos;
}

const r1 = (n) => Math.round(n * 10) / 10;

export function calcularExemplo(ex, tabela) {
  let pontos = 0;
  for (const luta of ex.lutas ?? []) {
    for (const acao of luta.acoes ?? []) {
      if (!(acao in tabela)) throw new Error(`ação desconhecida "${acao}" (usar: ${Object.keys(tabela).join(", ")})`);
      pontos += tabela[acao];
    }
  }
  const D = pontos - ex.preco;
  const precoNovo = Math.max(2, r1(ex.preco + 0.5 * D));
  const v = r1(precoNovo - ex.preco);
  const patrimonio = v > 0 ? r1(v / 2) : v;
  return { pontos, precoNovo, variacao: v, patrimonio };
}

/** Devolve lista de erros (vazia = tudo certo). */
export function verificarExemplos(plano, raizRepo) {
  const exemplos = plano?.exemplos;
  if (!exemplos) return [];
  const tabela = lerPontosDoMotor(raizRepo);
  const erros = [];
  for (const ex of exemplos) {
    const nome = ex.id ?? ex.atleta ?? "exemplo";
    let r;
    try { r = calcularExemplo(ex, tabela); } catch (e) { erros.push(`${nome}: ${e.message}`); continue; }
    const cmp = [["pontos", r.pontos], ["preco_novo", r.precoNovo], ["patrimonio", r.patrimonio]];
    for (const [campo, certo] of cmp) {
      if (ex[campo] == null) erros.push(`${nome}: falta "${campo}" (valor certo: ${certo})`);
      else if (Number(ex[campo]) !== certo) erros.push(`${nome}: ${campo} = ${ex[campo]}, mas pelas regras do jogo dá ${certo}`);
    }
  }
  return erros;
}
