// app/api/atleta-rodada/route.ts
//
// DECOMPOSIÇÃO LUTA-A-LUTA de um atleta numa competição.
// É o que alimenta o detalhe do popup "Meu Time": mostra COMO o atleta fez os
// pontos da rodada (que ações, em que luta), não só o total.
//
// FONTE DAS LUTAS (corrigido): usamos competitor.contests (lutas POR atleta) e
// filtramos pela competição-alvo, em vez de competition.contests (lutas POR
// competição). Motivo: o competition.contests pode vir INCOMPLETO durante e logo
// após o evento (ex.: Tahiti 2026 só devolvia algumas categorias), deixando
// atletas que já lutaram a 0 pontos. O competitor.contests traz o histórico
// completo do atleta, incluindo as lutas da competição em curso. Os campos das
// lutas (ippon_b/w, waza_b/w, yuko_b/w, penalty_b/w, id_winner...) são idênticos
// nos dois endpoints, por isso o cálculo não muda — muda só a fonte.
//
//   getCompetitorContests   -> todas as lutas do atleta (filtramos por id_competition)
//   contestActionsForPerson -> as ações de valor fixo de um lado (ippon/waza/yuko, feitos/sofridos)
//   isHansokuMake           -> se a luta foi decidida por hansoku-make
//   scoreContestForPerson   -> o total REAL da luta (fonte única de verdade)
//
// IMPORTANTE: o TOTAL de cada luta vem sempre de scoreContestForPerson (que já
// trata shidos crescentes, ippon-fantasma e provocados a dobrar). A lista de
// ações é só para EXIBIÇÃO. Por isso a soma "visual" das ações pode não bater
// ao cêntimo em lutas com shido/hansoku — o número que manda é o `pontos` da luta.
//
// ---------------------------------------------------------------------------
// PORTÃO ANTI-ESPREITADELA (servidor) — LER ANTES DE MEXER
//
// Esta rota é a MAIS sensível do jogo: devolve, luta a luta, exatamente como um
// atleta pontuou. Num CLÁSSICO, essas lutas já aconteceram em 2018 e estão no
// JudoBase — por isso, sem portão, qualquer pessoa via o desempenho de qualquer
// atleta ANTES de escalar e montava a equipa perfeita.
//
// Regra: nada é devolvido enquanto o mercado dessa competição estiver ABERTO.
// A guarda vive no SERVIDOR porque um bloqueio só na interface seria contornado
// escrevendo o URL à mão. Mesma regra do /api/resultados e do /api/equipa-na-rodada.
// ---------------------------------------------------------------------------
//
// Uso: GET /api/atleta-rodada?comp=3295&person=4143
// Devolve: { comp, person, tem_resultados, total, lutas: [...] }

import { NextResponse } from "next/server";
import {
  getCompetitorContests,
  scoreContestForPerson,
  isHansokuMake,
  type IjfContest,
} from "@/lib/ijf";
import { getCompetitorResults } from "@/lib/scout";
import { estadoDoAtleta, textoEstado, type EstadoAtleta } from "@/lib/estado-atleta";
import { POINTS, type ActionType } from "@/lib/engine";
import { CALENDARIO_2026, pontosVisiveisPorId } from "@/lib/calendario";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const LABEL: Partial<Record<ActionType, string>> = {
  ippon_feito: "Ippon",
  waza_ari_feito: "Waza-ari",
  yuko_feito: "Yuko",
  ippon_sofrido: "Ippon sofrido",
  waza_ari_sofrido: "Waza-ari sofrido",
  yuko_sofrido: "Yuko sofrido",
};

function custoShidosSofridos(n: number): number {
  let t = 0;
  for (let k = 1; k <= n; k++) t += -(k + 1);
  return t;
}

const toInt = (v: unknown): number => {
  const x = parseInt(String(v ?? "0"), 10);
  return isNaN(x) ? 0 : x;
};

function ladoDoAtleta(f: IjfContest, person: string): "b" | "w" | null {
  if (String(f.id_person_blue) === person) return "b";
  if (String(f.id_person_white) === person) return "w";
  return null;
}

interface Rubrica {
  label: string;
  quantidade: number;
  pontos: number;
  negativo: boolean;
}

// É uma luta de POULE (grupo todos-contra-todos)?
//  - Sinal 1: round_code começa por "small_" (poules pequenas, até ~5 atletas).
//  - Sinal 2: o mesmo round_name aparece MAIS DO QUE UMA VEZ para este atleta
//    nesta competição. Numa eliminação direta normal, cada fase (Quartos,
//    Meia-final, Final...) ocorre UMA vez por atleta; se "Quarter Final" ou
//    "Semi Final" se repete, é porque a API está a reutilizar o rótulo para as
//    lutas de um grupo round-robin (caso das categorias maiores da Tahiti, cujo
//    round_code é "cont_open_..." e não "small_"). `repetido` é calculado a
//    partir da contagem de round_names do próprio atleta (ver GET).
function ehPoule(f: IjfContest, repetido: boolean): boolean {
  const rc = (f.round_code || "").toLowerCase();
  if (rc.startsWith("small_")) return true;
  return repetido;
}

function nomeRonda(f: IjfContest, ordemPoule: number, ehPouleLuta: boolean): string {
  if (ehPouleLuta) {
    return `Poule · ${ordemPoule}ª luta`;
  }
  const rn = (f.round_name || "").trim();
  if (rn) {
    const m = rn.match(/best\s*(\d+)/i);
    if (m) return `Eliminatória de ${m[1]}`;
    return rn.charAt(0).toUpperCase() + rn.slice(1);
  }
  const rc = (f.round_code || "").toLowerCase();
  if (/final/.test(rc) && !/semi|quarter|repe/.test(rc)) return "Final";
  if (/semi/.test(rc)) return "Meia-final";
  if (/quarter/.test(rc)) return "Quartos de final";
  if (/repe/.test(rc)) return "Repescagem";
  return "Combate";
}

function rubricasDaLuta(f: IjfContest, side: "b" | "w", hansoku: boolean): Rubrica[] {
  const opp = side === "b" ? "w" : "b";

  let acoes = contestActionsForPersonBySide(f, side);
  if (hansoku) acoes = acoes.filter((a) => a !== "ippon_feito" && a !== "ippon_sofrido");

  const cont = new Map<ActionType, number>();
  for (const a of acoes) cont.set(a, (cont.get(a) ?? 0) + 1);

  const rubricas: Rubrica[] = [];
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

  // PORTÃO ANTI-ESPREITADELA: com o mercado aberto, não se vê nada. Devolve a
  // MESMA forma de um atleta sem lutas, para o cliente não precisar de saber
  // nada de novo (mostra "ainda não tem lutas registadas").
  const noCalendario = CALENDARIO_2026.some((c) => c.idCompeticao === comp);
  if (noCalendario && !pontosVisiveisPorId(comp)) {
    return NextResponse.json({
      comp,
      person,
      bloqueado: true,
      mercado_aberto: true,
      tem_resultados: false,
      total: 0,
      n_lutas: 0,
      lutas: [],
      estado: "a_aguardar",
      estado_texto: "Os pontos desta rodada aparecem quando o mercado fechar.",
      place: null,
    });
  }

  // FONTE: lutas DO ATLETA (competitor.contests), filtradas pela competição-alvo.
  // É o que garante que apanhamos TODAS as lutas dele nesta competição, mesmo
  // que o competition.contests ainda esteja incompleto.
  let todas: IjfContest[] = [];
  try {
    todas = await getCompetitorContests(person);
  } catch {
    return NextResponse.json({ comp, person, tem_resultados: false, total: 0, n_lutas: 0, lutas: [], estado: "a_aguardar", estado_texto: textoEstado("a_aguardar"), place: null });
  }

  // Só as lutas desta competição.
  const contests = (todas || []).filter((f) => String(f.id_competition) === comp);

  if (contests.length === 0) {
    return NextResponse.json({ comp, person, tem_resultados: false, total: 0, n_lutas: 0, lutas: [], estado: "a_aguardar", estado_texto: textoEstado("a_aguardar"), place: null });
  }

  const lutas: {
    id_fight: string;
    ronda: string;
    venceu: boolean | null;
    hansoku: boolean;
    pontos: number;
    rubricas: Rubrica[];
  }[] = [];

  let total = 0;
  let ordemPoule = 0;

  // Conta quantas vezes cada round_name aparece NAS LUTAS DESTE ATLETA nesta
  // competição. Se um round_name se repete, são lutas de poule (a API reutiliza
  // o rótulo) — ver ehPoule. Numa eliminação direta cada fase ocorre 1 vez.
  const contRoundName = new Map<string, number>();
  for (const f of contests) {
    if (ladoDoAtleta(f, person) === null) continue;
    const rn = (f.round_name || "").toLowerCase().trim();
    contRoundName.set(rn, (contRoundName.get(rn) ?? 0) + 1);
  }

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

    // É poule? (small_ no código, ou round_name repetido para este atleta.)
    const rn = (f.round_name || "").toLowerCase().trim();
    const repetido = (contRoundName.get(rn) ?? 0) > 1;
    const pouleLuta = ehPoule(f, repetido);
    if (pouleLuta) ordemPoule += 1;

    lutas.push({
      id_fight: String(f.id_fight ?? ""),
      ronda: nomeRonda(f, ordemPoule, pouleLuta),
      venceu,
      hansoku,
      pontos: Math.round(pontosLuta * 10) / 10,
      rubricas: rubricasDaLuta(f, side, hansoku),
    });
  }

  const nLutas = lutas.length;
  let place: string | null = null;
  try {
    const rows = await getCompetitorResults(person);
    const desta = rows.find((r) => String(r.id_competition) === comp);
    place = desta ? String(desta.place ?? "") : null;
  } catch {
    place = null;
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
