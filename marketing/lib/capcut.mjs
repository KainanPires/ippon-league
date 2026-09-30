// marketing/lib/capcut.mjs
//
// PACOTE DE MONTAGEM PARA O CAPCUT — ficheiros abertos e universais.
//
// Não cria nenhum projeto nativo do CapCut: o formato interno do CapCut não é
// documentado publicamente e não foi validado. O pacote tem o que a montagem
// manual precisa: cenas numeradas, textos, narração por cena e corrida,
// legendas SRT, mapa musical, efeitos, transições e instruções passo a passo.

import fs from "node:fs";
import path from "node:path";
import { pastaCampanha } from "./plano.mjs";
import { lerRazao, estadoUnidades } from "./razao.mjs";
import { tempos, mmss } from "./documentos.mjs";

const csv = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
const srtT = (s) => {
  const ms = Math.round(s * 1000);
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), se = Math.floor((ms % 60000) / 1000), r = ms % 1000;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(se).padStart(2, "0")},${String(r).padStart(3, "0")}`;
};
const lista = (v) => (Array.isArray(v) ? v : v ? [v] : []);

export function gerarEntregaCapcut(raiz, plano) {
  const pasta = pastaCampanha(raiz, plano.campanha.id);
  const destino = path.join(pasta, "entrega-capcut", `v${plano.campanha.versao}`);
  fs.mkdirSync(path.join(destino, "cenas"), { recursive: true });
  fs.mkdirSync(path.join(destino, "narracao"), { recursive: true });
  const t = tempos(plano);
  const eventos = lerRazao(pasta);
  const unidades = [...estadoUnidades(eventos).values()];
  const rejeitadas = new Set(eventos.filter((e) => e.tipo === "rejeitada_revisao" && e.versao === plano.campanha.versao).map((e) => e.cena));
  const faltam = [];

  const linhasCenas = [];
  plano.cenas.forEach((s, i) => {
    const n = String(i + 1).padStart(2, "0");
    const saida = unidades.find((u) => u.cena === s.id && u.estado === "concluido" && !rejeitadas.has(s.id) && u.unidade.startsWith(plano.campanha.versao + "/") && u.saidas?.length);
    let ficheiro = "";
    if (saida) {
      const orig = path.join(pasta, saida.saidas[0]);
      ficheiro = `${n}_${s.id}${path.extname(orig)}`;
      fs.copyFileSync(orig, path.join(destino, "cenas", ficheiro));
    } else {
      ficheiro = `${n}_${s.id}_PENDENTE.txt`;
      fs.writeFileSync(path.join(destino, "cenas", ficheiro), `Cena ${s.id} ainda sem ficheiro.\nOrigem prevista: ${s.origem ?? "—"}\nO que filmar/animar: ${s.acao ?? "—"}\n`);
      faltam.push(`${n} ${s.id} (${s.origem ?? "sem origem"})`);
    }
    linhasCenas.push({ n, s, ficheiro, de: t[i].de, ate: t[i].ate });
    fs.writeFileSync(path.join(destino, "narracao", `${n}_${s.id}.txt`), (s.narracao ?? "") + "\n");
  });

  fs.writeFileSync(path.join(destino, "narracao", "narracao-corrida.txt"), plano.cenas.map((s) => s.narracao).filter(Boolean).join(" ") + "\n");

  fs.writeFileSync(path.join(destino, "textos-ecra.csv"),
    ["n,cena,inicio,fim,texto,estilo,posicao", ...linhasCenas.flatMap(({ n, s, de, ate }) =>
      lista(s.texto_ecra).map((x) => [n, s.id, mmss(de), mmss(ate), x.texto, x.estilo, x.posicao].map(csv).join(",")))].join("\n") + "\n");

  let k = 0;
  const srt = linhasCenas.filter(({ s }) => s.narracao).map(({ s, de, ate }) => `${++k}\n${srtT(de)} --> ${srtT(ate)}\n${s.narracao}\n`).join("\n");
  fs.writeFileSync(path.join(destino, "legendas-narracao.srt"), srt);

  fs.writeFileSync(path.join(destino, "mapa-musical.csv"),
    ["inicio,fim,faixa,fonte,licenca,intensidade,nota", ...lista(plano.musica).map((m) =>
      [mmss(m.de_s), mmss(m.ate_s), m.faixa, m.fonte, m.licenca ?? "A CONFIRMAR", m.intensidade, m.nota].map(csv).join(","))].join("\n") + "\n");

  fs.writeFileSync(path.join(destino, "efeitos-transicoes.csv"),
    ["n,cena,inicio,fim,efeitos_sonoros,efeitos_visuais,transicao_saida", ...linhasCenas.map(({ n, s, de, ate }) =>
      [n, s.id, mmss(de), mmss(ate), lista(s.som?.efeitos).join(" | "), lista(s.efeitos_visuais).join(" | "), s.transicao_saida].map(csv).join(","))].join("\n") + "\n");

  const total = t.at(-1)?.ate ?? 0;
  const guia = [
    `# Montagem no CapCut · ${plano.campanha.titulo ?? plano.campanha.id} (v${plano.campanha.versao})`, "",
    `Duração total: ${total} s · Formato: ${plano.campanha.formato ?? "9:16 vertical, 1080×1920"}`, "",
    "Este pacote é para montagem MANUAL. Não é um projeto nativo do CapCut.", "",
    "## Passos", "",
    "1. Criar um projeto novo no CapCut com a proporção indicada acima.",
    "2. Importar a pasta `cenas/` e colocar os ficheiros na linha do tempo pela ordem do número (01, 02, …).",
    "3. Ajustar a duração de cada cena à tabela abaixo.",
    "4. Adicionar os textos de `textos-ecra.csv` (fonte Oswald para títulos, Manrope para texto; creme #f1ede2 e dourado #d9a441).",
    "5. Narração: gravar ou importar o áudio a partir de `narracao/`; o texto corrido está em `narracao-corrida.txt`.",
    "6. Legendas: `legendas-narracao.srt` é um SRT padrão. Se a tua versão do CapCut importar legendas, usa-o; se não, copia o texto à mão.",
    "7. Música e efeitos: seguir `mapa-musical.csv` e `efeitos-transicoes.csv`. Usar só música com licença confirmada.",
    "8. Exportar e enviar o vídeo final para revisão (portão P4).", "",
    "## Linha do tempo", "", "| # | Cena | Início | Fim | Ficheiro | Transição de saída |", "|---|---|---|---|---|---|",
    ...linhasCenas.map(({ n, s, de, ate, ficheiro }) => `| ${n} | ${s.id} | ${mmss(de)} | ${mmss(ate)} | ${ficheiro} | ${s.transicao_saida ?? "—"} |`), "",
    faltam.length ? `## Em falta\n\n${faltam.map((f) => "- " + f).join("\n")}\n` : "## Em falta\n\nNada.\n",
  ];
  fs.writeFileSync(path.join(destino, "00_LEIA-ME.md"), guia.join("\n"));
  return { destino, faltam };
}
