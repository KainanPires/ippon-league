// app/api/diagnostico/route.ts
//
// DIAGNÓSTICO DO MOTOR DE PONTUAÇÃO — ferramenta de TESTE (não é tela do jogo).
//
// Mostra, para uma competição, os campos CRUS de cada luta vindos do JudoBase
// (ippon / waza / yuko / penalty de cada lado) LADO A LADO com os pontos que o
// motor calcula (scoreContestSide). Os pontos já refletem as regras fechadas:
// shido sofrido crescente, shido provocado +1 (x2 em vitória por hansoku) e
// hansoku-make sem o ippon fantasma.
//
// Uso:
//   /api/diagnostico?comp=3161            -> resumo + só as lutas "interessantes"
//   /api/diagnostico?comp=3161&todas=1    -> + todas as lutas (output grande)
//   /api/diagnostico?comp=3295            -> Tahiti (no sábado)
import { NextResponse } from "next/server";
import { getCompetitionContests, scoreContestSide, isHansokuMake } from "@/lib/ijf";
import type { IjfContest } from "@/lib/ijf";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const toInt = (v: unknown): number => {
  const x = parseInt(String(v ?? "0"), 10);
  return isNaN(x) ? 0 : x;
};

function campo(f: IjfContest, nome: string): number {
  return toInt((f as unknown as Record<string, unknown>)[nome]);
}

// Campos crus + pontos calculados de um lado da luta.
function lado(f: IjfContest, side: "b" | "w") {
  const id = String(side === "b" ? f.id_person_blue : f.id_person_white || "");
  return {
    id_person: id,
    ippon: campo(f, `ippon_${side}`),
    waza: campo(f, `waza_${side}`),
    yuko: campo(f, `yuko_${side}`),
    penalty: campo(f, `penalty_${side}`),
    pontos_motor: scoreContestSide(f, side),
  };
}

function linha(f: IjfContest) {
  return {
    id_fight: f.id_fight,
    round: f.round_name ?? f.round ?? "",
    id_winner: f.id_winner ?? "",
    hansoku: isHansokuMake(f),
    blue: lado(f, "b"),
    white: lado(f, "w"),
  };
}

type Linha = ReturnType<typeof linha>;

function ehWaza2(l: Linha): boolean {
  return l.blue.waza >= 2 || l.white.waza >= 2;
}
function ehPenalty3(l: Linha): boolean {
  return l.blue.penalty >= 3 || l.white.penalty >= 3;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const comp = searchParams.get("comp");
  const todas = searchParams.get("todas") === "1";
  if (!comp) {
    return NextResponse.json(
      { erro: "Falta ?comp=<id_competition>. Ex.: /api/diagnostico?comp=3161" },
      { status: 400 }
    );
  }

  const contests = (await getCompetitionContests(comp)) as IjfContest[];
  const linhas = contests.map(linha);

  const casosWaza2 = linhas.filter(ehWaza2);
  const casosPenalty3 = linhas.filter(ehPenalty3);

  const resposta: Record<string, unknown> = {
    comp,
    n_lutas: contests.length,
    tem_resultados: contests.length > 0,

    // ---- DOIS WAZA-ARIS (confirmado: ficam waza=2, motor da 8) ----
    teste_dois_waza: {
      lutas_com_waza2: casosWaza2.length,
      leitura:
        casosWaza2.length === 0
          ? "Sem lutas com waza>=2 nesta competicao (ou ainda sem dados)."
          : "Dois waza-aris contam como 4+4=8 (mais yuko se houver). Conferir em casos_waza2.",
    },

    // ---- HANSOKU-MAKE (regra nova: vencedor shidos x2, sem ippon; perdedor crescente) ----
    teste_hansoku: {
      lutas_com_3_ou_mais_penalty: casosPenalty3.length,
      leitura:
        casosPenalty3.length === 0
          ? "Sem lutas com penalty>=3 nesta competicao (ou ainda sem dados)."
          : "Hansoku-make: vencedor leva (shidos provocados x2) sem ippon; perdedor leva shidos crescentes (-2,-3,-4). Conferir em casos_penalty3.",
    },

    casos_waza2: casosWaza2,
    casos_penalty3: casosPenalty3,
  };

  if (todas) resposta.todas_as_lutas = linhas;

  return NextResponse.json(resposta);
}
