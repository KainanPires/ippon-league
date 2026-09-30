// marketing/lib/documentos.mjs
//
// Gera, a partir do plano.json, os documentos que o Kainan lê ANTES de
// autorizar: roteiro visual e sonoro, storyboard e orçamento. Nenhum destes
// ficheiros autoriza gasto.

import fs from "node:fs";
import path from "node:path";
import { pacoteDeGasto, hashPacote, custoMaximo, pastaCampanha } from "./plano.mjs";

export function tempos(plano) {
  let t = 0;
  return plano.cenas.map((c) => {
    const de = t;
    t += Number(c.duracao_s);
    return { id: c.id, de, ate: t };
  });
}

export function mmss(s) {
  const m = Math.floor(s / 60);
  const r = Math.round((s - m * 60) * 10) / 10;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(4, "0")}`;
}

const lista = (v) => (Array.isArray(v) ? v : v ? [v] : []);

export function roteiroMd(plano) {
  const t = new Map(tempos(plano).map((x) => [x.id, x]));
  const c = plano.campanha;
  const total = tempos(plano).at(-1)?.ate ?? 0;
  const L = [];
  L.push(`# Roteiro · ${c.titulo ?? c.id} (versão ${c.versao})`, "");
  L.push("> Documento de planeamento. **Não autoriza nenhum gasto.**", "");
  L.push("| Campo | Valor |", "|---|---|");
  for (const [k, v] of [
    ["Objetivo", c.objetivo], ["Público", c.publico], ["Promessa", c.promessa], ["Hipótese", c.hipotese],
    ["Formato / redes", lista(c.redes).join(", ")], ["Duração total", `${total} s`], ["Idioma", c.idioma],
    ["CTA", c.cta], ["Link UTM", c.link_utm],
  ]) L.push(`| ${k} | ${v ?? "—"} |`);
  L.push("");
  if (c.sinopse) L.push("## Sinopse", "", c.sinopse, "");
  L.push("## Cenas", "");
  for (const s of plano.cenas) {
    const tt = t.get(s.id);
    L.push(`### ${s.id} · ${mmss(tt.de)}–${mmss(tt.ate)} (${s.duracao_s} s)${s.funcao ? " · " + s.funcao : ""}`);
    L.push(`- **Origem:** ${s.origem ?? "—"}`);
    for (const [k, v] of [["Cenário", s.cenario], ["Personagens", lista(s.personagens).join(", ")], ["Ação", s.acao],
      ["Enquadramento", s.enquadramento], ["Câmara", s.camera]]) L.push(`- **${k}:** ${v ?? "—"}`);
    L.push(`- **Texto em ecrã:** ${lista(s.texto_ecra).map((x) => `"${x.texto}"${x.estilo ? ` (${x.estilo})` : ""}`).join(" · ") || "—"}`);
    L.push(`- **Narração:** ${s.narracao || "—"}`);
    L.push(`- **Música:** ${s.som?.musica ?? "—"}`);
    L.push(`- **Efeitos sonoros:** ${lista(s.som?.efeitos).join(", ") || "—"}`);
    L.push(`- **Transição de saída:** ${s.transicao_saida ?? "—"}`);
    if (s.geracao) {
      L.push(`- **Geração:** \`${s.geracao.endpoint}\` × ${s.geracao.quantidade}`);
      L.push(`  - Parâmetros: \`${JSON.stringify(s.geracao.parametros)}\``);
      L.push(`  - Referências: ${lista(s.geracao.referencias).map((r) => r.caminho).join(", ") || "—"}`);
    }
    L.push("");
  }
  if (lista(plano.musica).length) {
    L.push("## Mapa musical", "", "| De | Até | Faixa | Fonte / licença | Intensidade | Nota |", "|---|---|---|---|---|---|");
    for (const m of plano.musica) L.push(`| ${mmss(m.de_s)} | ${mmss(m.ate_s)} | ${m.faixa ?? "—"} | ${m.fonte ?? "—"} / ${m.licenca ?? "❓"} | ${m.intensidade ?? "—"} | ${m.nota ?? ""} |`);
    L.push("");
  }
  const narr = plano.cenas.map((s) => s.narracao).filter(Boolean);
  if (narr.length) L.push("## Narração corrida", "", narr.join(" "), "");
  L.push("## Factos usados (verificar com ippon-produto)", "", ...lista(plano.factos).map((f) => `- ${f.texto} — fonte: ${f.fonte ?? "❓"} (${f.estado ?? "❓"})`), "");
  return L.join("\n");
}

export function storyboardMd(plano) {
  const t = new Map(tempos(plano).map((x) => [x.id, x]));
  const L = [`# Storyboard · ${plano.campanha.titulo ?? plano.campanha.id} (v${plano.campanha.versao})`, ""];
  L.push("| # | Tempo | Quadro | Enquadramento / câmara | Texto | Som | Saída |", "|---|---|---|---|---|---|---|");
  for (const s of plano.cenas) {
    const tt = t.get(s.id);
    L.push(`| ${s.id} | ${mmss(tt.de)}–${mmss(tt.ate)} | ${s.storyboard ?? s.acao ?? "—"} | ${s.enquadramento ?? "—"} / ${s.camera ?? "—"} | ${lista(s.texto_ecra).map((x) => x.texto).join(" / ") || "—"} | ${[s.som?.musica, ...lista(s.som?.efeitos)].filter(Boolean).join("; ") || "—"} | ${s.transicao_saida ?? "—"} |`);
  }
  return L.join("\n") + "\n";
}

export function orcamentoMd(raiz, plano) {
  const pacote = pacoteDeGasto(raiz, plano);
  const hash = hashPacote(pacote);
  const { total, semPreco } = custoMaximo(pacote);
  const L = [`# Orçamento · ${plano.campanha.id} (versão ${plano.campanha.versao})`, ""];
  L.push("> O orçamento é uma proposta do planeador. **Só o Kainan autoriza**, com `autorizar` no terminal.", "");
  L.push("| Cena | Endpoint | Qtd | Créditos/unid. | Fonte do preço | Data | Subtotal |", "|---|---|---|---|---|---|---|");
  for (const s of plano.cenas.filter((x) => x.geracao)) {
    const g = s.geracao; const p = g.preco_unitario;
    L.push(`| ${s.id} | \`${g.endpoint}\` | ${g.quantidade} | ${p?.creditos ?? "❓ não confirmado"} | ${p?.fonte ?? "—"} | ${p?.data ?? "—"} | ${p ? Math.round(p.creditos * g.quantidade * 1000) / 1000 : "—"} |`);
  }
  const semGeracao = plano.cenas.filter((x) => !x.geracao).map((x) => `${x.id} (${x.origem ?? "sem origem"})`);
  L.push("", `**Total máximo:** ${semPreco.length ? "INDETERMINADO — faltam preços confirmados em " + semPreco.join(", ") : total + " créditos"}`);
  L.push(`**Cenas sem custo de geração:** ${semGeracao.join(", ") || "—"}`);
  L.push("", "Regras aplicadas pelo executor:", "- o preço é reconfirmado no fornecedor antes de cada envio; se subir, bloqueia;",
    "- falhas e cenas rejeitadas **não** são regeradas automaticamente;",
    "- o custo reservado conta contra o teto mesmo que a geração falhe (não se presume devolução).", "");
  L.push("## Para autorizar", "", "```", `pacote: ${hash}`, "```", "",
    "No teu terminal (não no Claude):", "", "```", `node marketing/bin/maquina.mjs autorizar ${plano.campanha.id} --teto <créditos> --validade-horas <h>`, "```", "");
  return { texto: L.join("\n"), hash, total, semPreco };
}

export function escreverDocumentos(raiz, plano) {
  const pasta = pastaCampanha(raiz, plano.campanha.id);
  fs.writeFileSync(path.join(pasta, "roteiro.md"), roteiroMd(plano));
  fs.writeFileSync(path.join(pasta, "storyboard.md"), storyboardMd(plano));
  const o = orcamentoMd(raiz, plano);
  fs.writeFileSync(path.join(pasta, "orcamento.md"), o.texto);
  return o;
}
