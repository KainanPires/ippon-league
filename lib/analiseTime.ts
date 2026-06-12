// lib/analiseTime.ts
//
// ANÁLISE DO TEU TIME (ferramenta Pro). Lê a escalação e devolve uma leitura
// HONESTA e NEUTRA — observações, nunca ordens. Fiel ao princípio do Pro:
// "mostramos possibilidades, a decisão é sempre tua".
//
// Usa só dados que já temos (a equipa guardada + priceJc dos atletas). Zero
// dependências externas — 100% construível agora.

import { resolve, type TeamState } from "@/lib/team";
import type { Athlete } from "@/lib/athletes";

const START_JC = 100;

export type Tom = "bom" | "atencao" | "neutro";

export interface Observacao {
  tom: Tom;
  titulo: string;
  texto: string;
}

export interface AnaliseTime {
  completa: boolean;            // 8 atletas?
  gastoTotal: number;          // soma dos priceJc
  saldo: number;               // START_JC - gasto
  maisCaro: Athlete | null;
  maisBarato: Athlete | null;
  capitao: Athlete | null;
  capitaoCaro: boolean;        // o capitão é o mais caro?
  observacoes: Observacao[];
  resumo: string;              // frase-resumo do Dôdo
}

const preco = (a: Athlete) => (a as Athlete & { priceJc: number }).priceJc ?? 0;

export function analisarTime(team: TeamState): AnaliseTime {
  const atletas = resolve(team.ids);
  const completa = atletas.length === 8;
  const gastoTotal = Math.round(atletas.reduce((s, a) => s + preco(a), 0) * 10) / 10;
  const saldo = Math.round((START_JC - gastoTotal) * 10) / 10;

  const ordenados = [...atletas].sort((a, b) => preco(b) - preco(a));
  const maisCaro = ordenados[0] ?? null;
  const maisBarato = ordenados[ordenados.length - 1] ?? null;
  const capitao = atletas.find((a) => a.id === team.captain) ?? null;
  const capitaoCaro = !!(capitao && maisCaro && capitao.id === maisCaro.id);

  const obs: Observacao[] = [];

  // 1) Orçamento
  if (saldo < 0) {
    obs.push({ tom: "atencao", titulo: "Estás acima do orçamento", texto: `Gastaste JC ${gastoTotal} dos teus 100. Precisas de ajustar a equipa antes de a guardar.` });
  } else if (saldo <= 3) {
    obs.push({ tom: "bom", titulo: "Orçamento bem aproveitado", texto: `Gastaste JC ${gastoTotal} e sobram JC ${saldo}. Usaste quase toda a tua verba — pouco JC parado.` });
  } else if (saldo >= 20) {
    obs.push({ tom: "atencao", titulo: "Tens muito JC parado", texto: `Sobram JC ${saldo}. Há margem para trocar apostas baratas por atletas mais fortes, se quiseres.` });
  } else {
    obs.push({ tom: "neutro", titulo: "Orçamento equilibrado", texto: `Gastaste JC ${gastoTotal} e sobram JC ${saldo}.` });
  }

  // 2) Distribuição de preços (estrelas vs apostas)
  if (completa) {
    const caros = atletas.filter((a) => preco(a) >= 12).length;
    const baratos = atletas.filter((a) => preco(a) <= 5).length;
    if (caros >= 5) {
      obs.push({ tom: "atencao", titulo: "Equipa de estrelas", texto: `Tens ${caros} atletas caros. Forte no papel, mas sobra pouco para apostas que podem surpreender e valorizar.` });
    } else if (baratos >= 5) {
      obs.push({ tom: "atencao", titulo: "Equipa de apostas", texto: `Tens ${baratos} atletas baratos. É arriscado, mas se eles renderem, a valorização pode ser grande.` });
    } else {
      obs.push({ tom: "bom", titulo: "Boa mistura", texto: "Tens um equilíbrio entre atletas caros e apostas baratas — uma base sólida." });
    }
  }

  // 3) O capitão
  if (capitao) {
    if (capitaoCaro) {
      obs.push({ tom: "neutro", titulo: "Capitão é a tua estrela", texto: `Escolheste ${sobrenome(capitao.name)}, o teu atleta mais caro. Aposta segura para dobrar pontos — mas também a mais esperada.` });
    } else {
      obs.push({ tom: "neutro", titulo: "Capitão surpresa", texto: `O teu capitão (${sobrenome(capitao.name)}) não é o mais caro. Se ele pontuar bem, dobras pontos num atleta que os outros talvez não esperem.` });
    }
  } else if (completa) {
    obs.push({ tom: "atencao", titulo: "Sem capitão", texto: "Ainda não escolheste capitão. O capitão dobra os pontos — não te esqueças antes de guardar." });
  }

  // 4) Concentração de país
  if (completa) {
    const porPais = new Map<string, number>();
    for (const a of atletas) porPais.set(a.countryIso, (porPais.get(a.countryIso) ?? 0) + 1);
    const maxPais = [...porPais.entries()].sort((x, y) => y[1] - x[1])[0];
    if (maxPais && maxPais[1] >= 4) {
      obs.push({ tom: "atencao", titulo: "Muitos do mesmo país", texto: `Tens ${maxPais[1]} atletas do mesmo país. Se essa equipa nacional tiver um mau dia, sentes-o todo de uma vez.` });
    }
  }

  // Resumo do Dôdo (tom geral)
  const atencoes = obs.filter((o) => o.tom === "atencao").length;
  let resumo: string;
  if (!completa) resumo = "A tua equipa ainda não está completa. Volta quando tiveres os 8 atletas para uma análise completa.";
  else if (atencoes === 0) resumo = "Equipa bem montada! Está equilibrada e sem pontos óbvios a corrigir. Boa sorte na rodada.";
  else if (atencoes === 1) resumo = "Equipa sólida, com um ponto a considerar. Vê a observação e decide — a escolha é tua.";
  else resumo = `Equipa com algum risco: há ${atencoes} pontos a pensar. Não há certo nem errado — só leituras para te ajudar a decidir.`;

  return { completa, gastoTotal, saldo, maisCaro, maisBarato, capitao, capitaoCaro, observacoes: obs, resumo };
}

function sobrenome(nome: string): string {
  return nome.split(" ").slice(-1)[0] || nome;
}
