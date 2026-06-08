// app/api/pontuacao/route.ts
//
// DESCOBERTA DA PONTUAÇÃO — passo 1c (inspeção + calibração da escala).
//
// Dois modos:
//   /api/pontuacao?comp=3131                -> TABELA dos melhores (campeão, medalhistas...),
//                                              com o total atual e como ficaria a x0,4 e x0,5.
//   /api/pontuacao?comp=3131&atleta=72823   -> DETALHE de um atleta, luta a luta.
//   (junta &capitao=1 para ver o x2)
//
// NÃO grava nada, NÃO mexe na app. Serve para validar a tabela e escolher a ESCALA.

import { NextResponse } from "next/server";
import {
  getCompetition,
  getCompetitionContests,
  contestActions,
  contestActionsForPerson,
} from "@/lib/ijf";
import { POINTS, scoreActions, scoreAthlete, type ActionType } from "@/lib/engine";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const round1 = (n: number) => Math.round(n * 10) / 10;

const LABEL: Record<ActionType, string> = {
  ippon_feito: "Ippon feito",
  waza_ari_feito: "Waza-ari feito",
  yuko_feito: "Yuko feito",
  shido_provocado: "Shido provocado no adversario",
  ippon_sofrido: "Ippon sofrido",
  waza_ari_sofrido: "Waza-ari sofrido",
  yuko_sofrido: "Yuko sofrido",
  shido_recebido: "Shido recebido",
  hansoku_make_recebido: "Hansoku-make recebido",
};

function mapaNomes(contests: any[]): Map<string, string> {
  const nomes = new Map<string, string>();
  for (const f of contests) {
    const b = String(f.id_person_blue ?? "");
    const w = String(f.id_person_white ?? "");
    if (b) nomes.set(b, String(f.person_blue ?? b).trim() || b);
    if (w) nomes.set(w, String(f.person_white ?? w).trim() || w);
  }
  return nomes;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const comp = searchParams.get("comp");
  const atleta = searchParams.get("atleta");
  const capitao = searchParams.get("capitao") === "1";

  if (!comp) {
    return NextResponse.json(
      { erro: "Falta ?comp=<id_competition>. Ex.: /api/pontuacao?comp=3131" },
      { status: 400 }
    );
  }

  const info = await getCompetition(comp);
  const contests = (await getCompetitionContests(comp)) as any[];
  if (contests.length === 0) {
    return NextResponse.json({
      comp,
      nome: info?.name ?? null,
      erro: "Esta competicao ainda nao tem lutas publicadas. Usa uma ja terminada (ex.: 3131).",
    });
  }

  const nomes = mapaNomes(contests);

  // ----- MODO DETALHE: um atleta, luta a luta -----
  if (atleta) {
    const ordenadas = [...contests].sort((a, b) =>
      String(a.start_planned ?? a.start ?? "").localeCompare(String(b.start_planned ?? b.start ?? ""))
    );
    const lutas: any[] = [];
    let todasAcoes: ActionType[] = [];
    for (const f of ordenadas) {
      const ehAzul = String(f.id_person_blue ?? "") === atleta;
      const ehBranco = String(f.id_person_white ?? "") === atleta;
      if (!ehAzul && !ehBranco) continue;
      const acoes = contestActionsForPerson(f, atleta);
      todasAcoes = todasAcoes.concat(acoes);
      const oponenteId = ehAzul ? String(f.id_person_white ?? "") : String(f.id_person_blue ?? "");
      lutas.push({
        fase: f.round_name ?? f.round_code ?? "-",
        oponente: nomes.get(oponenteId) ?? oponenteId,
        resultado: String(f.id_winner ?? "") === atleta ? "venceu" : "perdeu",
        acoes: acoes.map((a) => `${LABEL[a]} (${POINTS[a] > 0 ? "+" : ""}${POINTS[a]})`),
        pontos_da_luta: scoreActions(acoes),
      });
    }
    const total = scoreActions(todasAcoes);
    return NextResponse.json({
      competicao: info?.name ?? comp,
      atleta_id: atleta,
      atleta_nome: nomes.get(atleta) ?? atleta,
      n_lutas: lutas.length,
      lutas,
      total_pontos: total,
      // pré-visualização da escala (decide-se o fator depois):
      total_x0_4: round1(total * 0.4),
      total_x0_5: round1(total * 0.5),
      total_se_capitao_x2: scoreAthlete(todasAcoes, true),
      pontuacao_final: scoreAthlete(todasAcoes, capitao),
      nota: "Detalhe de um atleta. Nada gravado.",
    });
  }

  // ----- MODO TABELA: melhores da competição (todos os atletas) -----
  const pontos = new Map<string, number>();
  const nLutas = new Map<string, number>();
  for (const f of contests) {
    const lados: ["b" | "w", string][] = [
      ["b", String(f.id_person_blue ?? "")],
      ["w", String(f.id_person_white ?? "")],
    ];
    for (const [side, id] of lados) {
      if (!id) continue;
      const p = scoreActions(contestActions(f, side));
      pontos.set(id, (pontos.get(id) ?? 0) + p);
      nLutas.set(id, (nLutas.get(id) ?? 0) + 1);
    }
  }

  const tabela = [...pontos.entries()]
    .map(([id, total]) => ({
      id,
      nome: nomes.get(id) ?? id,
      n_lutas: nLutas.get(id) ?? 0,
      total_raw: total,
      x0_4: round1(total * 0.4),
      x0_5: round1(total * 0.5),
    }))
    .sort((a, b) => b.total_raw - a.total_raw);

  const maximo = tabela.length ? tabela[0].total_raw : 0;

  return NextResponse.json({
    competicao: info?.name ?? comp,
    n_atletas: tabela.length,
    maximo_raw: maximo,
    melhores_15: tabela.slice(0, 15),
    nota:
      "Tabela dos melhores (pontos brutos da nossa tabela validada). 'x0_4' e 'x0_5' " +
      "mostram como ficaria a escala com cada fator. Escolhe o fator pela sensacao do topo. " +
      "Para o detalhe de um atleta: &atleta=<id>.",
  });
}
