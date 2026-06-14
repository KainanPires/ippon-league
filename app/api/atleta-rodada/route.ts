// app/api/atleta-rodada/route.ts
//
// DECOMPOSIÇÃO LUTA-A-LUTA de um atleta numa competição.
// É o que alimenta o detalhe do popup "Meu Time": mostra COMO o atleta fez os
// pontos da rodada (que ações, em que luta), não só o total.
//
// Lê ao vivo da API do JudoBase (reaproveita lib/ijf.ts — NÃO duplica nada):
//   getCompetitionContests  -> todas as lutas da competição
//   contestActionsForPerson -> as ações de valor fixo de um lado (ippon/waza/yuko, feitos/sofridos)
//   isHansokuMake           -> se a luta foi decidida por hansoku-make
//   scoreContestForPerson   -> o total REAL da luta (fonte única de verdade)
//
// IMPORTANTE: o TOTAL de cada luta vem sempre de scoreContestForPerson (que já
// trata shidos crescentes, ippon-fantasma e provocados a dobrar). A lista de
// ações é só para EXIBIÇÃO. Por isso a soma "visual" das ações pode não bater
// ao cêntimo em lutas com shido/hansoku — o número que manda é o `pontos` da luta.
//
// Uso: GET /api/atleta-rodada?comp=3295&person=4143
// Devolve: { comp, person, tem_resultados, total, lutas: [...] }

import { NextResponse } from "next/server";
import {
  getCompetitionContests,
  scoreContestForPerson,
  isHansokuMake,
  type IjfContest,
} from "@/lib/ijf";
import { getCompetitorResults } from "@/lib/scout";
import { estadoDoAtleta, textoEstado, type EstadoAtleta } from "@/lib/estado-atleta";
import { POINTS, type ActionType } from "@/lib/engine";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Rótulos legíveis (PT) das ações de valor fixo. Os shidos NÃO entram aqui:
// são tratados à parte (custo crescente) para a exibição.
const LABEL: Partial<Record<ActionType, string>> = {
  ippon_feito: "Ippon",
  waza_ari_feito: "Waza-ari",
  yuko_feito: "Yuko",
  ippon_sofrido: "Ippon sofrido",
  waza_ari_sofrido: "Waza-ari sofrido",
  yuko_sofrido: "Yuko sofrido",
};

// Custo crescente de SOFRER n shidos: 1.º -2, 2.º -3, 3.º -4...  (igual ao engine)
function custoShidosSofridos(n: number): number {
  let t = 0;
  for (let k = 1; k <= n; k++) t += -(k + 1);
  return t;
}

const toInt = (v: unknown): number => {
  const x = parseInt(String(v ?? "0"), 10);
  return isNaN(x) ? 0 : x;
};

// Qual o lado ("b"/"w") deste atleta nesta luta, ou null se não está nela.
function ladoDoAtleta(f: IjfContest, person: string): "b" | "w" | null {
  if (String(f.id_person_blue) === person) return "b";
  if (String(f.id_person_white) === person) return "w";
  return null;
}

// Uma "rubrica" da decomposição: um tipo de ação agregado (ex.: "2× Waza-ari").
interface Rubrica {
  label: string;
  quantidade: number;
  pontos: number; // pontos NOMINAIS desta rubrica (informativo)
  negativo: boolean;
}

// É uma luta de POULE? (grupo "todos contra todos", usado até 5 atletas).
// A API marca estas lutas com round_code a começar por "small_" (ex.:
// "small_3_plus_final_1-3"). O round_NAME destas lutas é ENGANADOR — a API
// chama "Semi Final" a todas as lutas do grupo, o que dava o falso "3 semifinais".
// Por isso detetamos a poule pelo round_code, que é fiável.
function ehPoule(f: IjfContest): boolean {
  const rc = (f.round_code || "").toLowerCase();
  return rc.startsWith("small_");
}

// Nome legível da fase (ronda).
// REGRA (decidida com dados reais da API):
//  - POULE (round_code "small_...") -> "Poule · Nª luta", onde N é a ordem da
//    luta DESTE atleta dentro da poule. Não rotulamos "final da poule": numa
//    poule, a luta decisiva depende da classificação (vitórias/desempates), que
//    não calculamos; a API marca uma "_final" mas pode não ser a verdadeira
//    decisão. Logo, apenas numeramos honestamente todas as lutas da poule.
//  - CHAVE NORMAL (mata-mata) -> mantemos o round_name da API (Semi Final,
//    Bronze, Final...), que ali é razoável. A distinção fina repescagem-vs-bronze
//    fica para o futuro chaveamento reconstruído (projeto C).
// `ordemPoule` é a posição (1, 2, 3...) desta luta entre as lutas de poule do
// atleta; só é usado quando a luta é de poule.
function nomeRonda(f: IjfContest, ordemPoule: number): string {
  if (ehPoule(f)) {
    return `Poule · ${ordemPoule}ª luta`;
  }
  const rn = (f.round_name || "").trim();
  if (rn) {
    // "best 64" / "best 32" -> mais humano; o resto fica como vem.
    const m = rn.match(/best\s*(\d+)/i);
    if (m) return `Eliminatória de ${m[1]}`;
    return rn.charAt(0).toUpperCase() + rn.slice(1);
  }
  // Sem round_name: cair no round_code da chave normal.
  const rc = (f.round_code || "").toLowerCase();
  if (/final/.test(rc) && !/semi|quarter|repe/.test(rc)) return "Final";
  if (/semi/.test(rc)) return "Meia-final";
  if (/quarter/.test(rc)) return "Quartos de final";
  if (/repe/.test(rc)) return "Repescagem";
  return "Combate";
}

// Constrói as rubricas de exibição de uma luta para um lado.
function rubricasDaLuta(f: IjfContest, side: "b" | "w", hansoku: boolean): Rubrica[] {
  const opp = side === "b" ? "w" : "b";

  // Ações de valor fixo (sem shidos). Em hansoku-make removemos o ippon-fantasma
  // (feito e sofrido), tal como o motor faz no cálculo do total.
  let acoes = contestActionsForPersonBySide(f, side);
  if (hansoku) acoes = acoes.filter((a) => a !== "ippon_feito" && a !== "ippon_sofrido");

  // Agrega por tipo.
  const cont = new Map<ActionType, number>();
  for (const a of acoes) cont.set(a, (cont.get(a) ?? 0) + 1);

  const rubricas: Rubrica[] = [];
  // Ordem de exibição: positivas primeiro, depois sofridas.
  const ordem: ActionType[] = [
    "ippon_feito", "waza_ari_feito", "yuko_feito",
    "ippon_sofrido", "waza_ari_sofrido", "yuko_sofrido",
  ];
  for (const tipo of ordem) {
    const q = cont.get(tipo) ?? 0;
    if (q <= 0) continue;
    const pNominal = (POINTS[tipo] ?? 0) * q;
    rubricas.push({
      label: q > 1 ? `${q}× ${LABEL[tipo]}` : (LABEL[tipo] || tipo),
      quantidade: q,
      pontos: pNominal,
      negativo: pNominal < 0,
    });
  }

  // Shidos PROVOCADOS no adversário (penalty do adversário): +1 cada; dobra se
  // este lado venceu POR hansoku-make.
  const shidosProvocados = toInt((f as unknown as Record<string, unknown>)[`penalty_${opp}`]);
  if (shidosProvocados > 0) {
    const shidosSofridos = toInt((f as unknown as Record<string, unknown>)[`penalty_${side}`]);
    const venceuPorHansoku = hansoku && shidosSofridos < 3 && shidosProvocados >= 3;
    const pts = shidosProvocados * (POINTS["shido_provocado"] ?? 1) * (venceuPorHansoku ? 2 : 1);
    rubricas.push({
      label: `${shidosProvocados > 1 ? `${shidosProvocados}× ` : ""}Shido provocado${venceuPorHansoku ? " (hansoku, ×2)" : ""}`,
      quantidade: shidosProvocados,
      pontos: pts,
      negativo: false,
    });
  }

  // Shidos SOFRIDOS por este lado (penalty do próprio lado): custo crescente.
  const shidosSofridos = toInt((f as unknown as Record<string, unknown>)[`penalty_${side}`]);
  if (shidosSofridos > 0) {
    const pts = custoShidosSofridos(shidosSofridos);
    rubricas.push({
      label: `${shidosSofridos > 1 ? `${shidosSofridos}× ` : ""}Shido sofrido`,
      quantidade: shidosSofridos,
      pontos: pts,
      negativo: true,
    });
  }

  return rubricas;
}

// Ações de valor fixo de um LADO (b/w) — espelha contestActions do ijf.ts, mas
// aqui por lado direto (evita depender do mapeamento id->lado duas vezes).
function contestActionsForPersonBySide(f: IjfContest, side: "b" | "w"): ActionType[] {
  const opp = side === "b" ? "w" : "b";
  const out: ActionType[] = [];
  const push = (a: ActionType, n: number) => { for (let i = 0; i < n; i++) out.push(a); };
  push("ippon_feito", toInt((f as unknown as Record<string, unknown>)[`ippon_${side}`]));
  push("waza_ari_feito", toInt((f as unknown as Record<string, unknown>)[`waza_${side}`]));
  push("yuko_feito", toInt((f as unknown as Record<string, unknown>)[`yuko_${side}`]));
  push("ippon_sofrido", toInt((f as unknown as Record<string, unknown>)[`ippon_${opp}`]));
  push("waza_ari_sofrido", toInt((f as unknown as Record<string, unknown>)[`waza_${opp}`]));
  push("yuko_sofrido", toInt((f as unknown as Record<string, unknown>)[`yuko_${opp}`]));
  return out;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const comp = (searchParams.get("comp") || "").trim();
  const person = (searchParams.get("person") || "").trim();

  if (!comp || !person) {
    return NextResponse.json({ erro: "Faltam parâmetros (comp e person)." }, { status: 400 });
  }

  let contests: IjfContest[] = [];
  try {
    contests = await getCompetitionContests(comp);
  } catch {
    return NextResponse.json({ comp, person, tem_resultados: false, total: 0, n_lutas: 0, lutas: [], estado: "a_aguardar", estado_texto: textoEstado("a_aguardar"), place: null });
  }

  if (!contests || contests.length === 0) {
    return NextResponse.json({ comp, person, tem_resultados: false, total: 0, n_lutas: 0, lutas: [], estado: "a_aguardar", estado_texto: textoEstado("a_aguardar"), place: null });
  }

  // Lutas deste atleta, na ordem em que vêm (normalmente cronológica).
  const lutas: {
    id_fight: string;
    ronda: string;
    venceu: boolean | null;
    hansoku: boolean;
    pontos: number;
    rubricas: Rubrica[];
  }[] = [];

  let total = 0;
  // Contador da ordem das lutas de POULE deste atleta (para numerar "Poule · Nª luta").
  // Só conta lutas de poule; as de chave normal não entram nesta numeração.
  let ordemPoule = 0;

  for (const f of contests) {
    const side = ladoDoAtleta(f, person);
    if (!side) continue;

    const hansoku = isHansokuMake(f);
    const pontosLuta = scoreContestForPerson(f, person);
    total += pontosLuta;

    const venceu = (() => {
      const w = String(f.id_winner ?? "");
      if (!w || w === "0") return null;
      return w === person;
    })();

    // Se é luta de poule, incrementa a ordem ANTES de nomear (1ª, 2ª, 3ª...).
    if (ehPoule(f)) ordemPoule += 1;

    lutas.push({
      id_fight: String(f.id_fight ?? ""),
      ronda: nomeRonda(f, ordemPoule),
      venceu,
      hansoku,
      pontos: Math.round(pontosLuta * 10) / 10,
      rubricas: rubricasDaLuta(f, side, hansoku),
    });
  }

  // ESTADO DE PARTICIPAÇÃO do atleta nesta competição.
  // Fonte de verdade: o `place` do competitor.results (declaração oficial da IJF
  // de que a participação terminou). nLutas = quantas lutas teve aqui.
  // A decisão fica na função pura estadoDoAtleta (lib/estado-atleta) — se um dia
  // mudarmos a fonte, mexe-se só aqui, nunca na UI.
  const nLutas = lutas.length;
  let place: string | null = null;
  try {
    const rows = await getCompetitorResults(person);
    const desta = rows.find((r) => String(r.id_competition) === comp);
    place = desta ? String(desta.place ?? "") : null;
  } catch {
    place = null; // sem dados de resultado: a função trata como "a aguardar"
  }
  const estado: EstadoAtleta = estadoDoAtleta(nLutas, place);

  return NextResponse.json({
    comp,
    person,
    tem_resultados: lutas.length > 0,
    total: Math.round(total * 10) / 10,
    n_lutas: nLutas,
    lutas,
    estado,
    estado_texto: textoEstado(estado),
    place,
  });
}
