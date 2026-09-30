// Verifica os números dos exemplos de um plano contra as regras REAIS do jogo.
// Os pontos por ação são lidos de lib/engine.ts (fonte única), para nunca divergir.
// A pontuação de uma luta replica lib/ijf.ts → scoreContestSide (os testes comparam
// com as funções reais de lib/engine.ts):
//   - ippon/waza-ari/yuko feitos e sofridos: tabela POINTS
//   - shidos SOFRIDOS: custo crescente (1.º −2, 2.º −3, 3.º −4)
//   - shidos PROVOCADOS: bónus crescente (1.º +1, 2.º +2, 3.º +3)
//   - hansoku-make (3+ shidos de um lado): o ippon registado é fantasma e não conta
// Preço e património (lib/engine.ts computeNewPrice e lib/congelar.ts):
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
const shidosSofridos = (n) => { let t = 0; for (let k = 1; k <= n; k++) t += -(k + 1); return t; };
const shidosProvocados = (n) => { let t = 0; for (let k = 1; k <= n; k++) t += k; return t; };

/** Pontos de UMA luta. Formato: { eu: {ippon, waza, yuko, shido}, adv: {...} } ou { acoes: [...] }. */
export function pontosDaLuta(luta, tabela) {
  if (Array.isArray(luta.acoes)) {
    let t = 0;
    for (const a of luta.acoes) {
      if (!(a in tabela)) throw new Error(`ação desconhecida "${a}" (usar: ${Object.keys(tabela).join(", ")})`);
      t += tabela[a];
    }
    return t;
  }
  const eu = luta.eu ?? {}, adv = luta.adv ?? {};
  const n = (o, k) => Number(o[k] ?? 0);
  const hansoku = n(eu, "shido") >= 3 || n(adv, "shido") >= 3;
  let t = 0;
  if (!hansoku) t += n(eu, "ippon") * tabela.ippon_feito + n(adv, "ippon") * tabela.ippon_sofrido;
  t += n(eu, "waza") * tabela.waza_ari_feito + n(adv, "waza") * tabela.waza_ari_sofrido;
  t += n(eu, "yuko") * tabela.yuko_feito + n(adv, "yuko") * tabela.yuko_sofrido;
  t += shidosSofridos(n(eu, "shido")) + shidosProvocados(n(adv, "shido"));
  return t;
}

export function calcularExemplo(ex, tabela) {
  const porLuta = (ex.lutas ?? []).map((l) => pontosDaLuta(l, tabela));
  const pontos = r1(porLuta.reduce((s, x) => s + x, 0));
  const r = { pontos, porLuta };
  if (ex.preco != null) {
    const D = pontos - ex.preco;
    r.precoNovo = Math.max(2, r1(ex.preco + 0.5 * D));
    r.variacao = r1(r.precoNovo - ex.preco);
    r.patrimonio = r.variacao > 0 ? r1(r.variacao / 2) : r.variacao;
  }
  return r;
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
    (ex.lutas ?? []).forEach((l, i) => {
      if (l.pontos != null && Number(l.pontos) !== r.porLuta[i])
        erros.push(`${nome}: luta ${i + 1} = ${l.pontos}, mas pelas regras do jogo dá ${r.porLuta[i]}`);
    });
    const cmp = [["pontos", r.pontos]];
    if (ex.preco != null) cmp.push(["preco_novo", r.precoNovo], ["patrimonio", r.patrimonio]);
    for (const [campo, certo] of cmp) {
      if (ex[campo] == null) erros.push(`${nome}: falta "${campo}" (valor certo: ${certo})`);
      else if (Number(ex[campo]) !== certo) erros.push(`${nome}: ${campo} = ${ex[campo]}, mas pelas regras do jogo dá ${certo}`);
    }
  }
  return erros;
}
