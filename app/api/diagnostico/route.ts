// app/api/diagnostico/route.ts
//
// DIAGNÓSTICO DO MOTOR DE PONTUAÇÃO — ferramenta de TESTE (não é tela do jogo).
//
// Mostra, para uma competição, os campos CRUS de cada luta vindos do JudoBase
// (ippon / waza / yuko / penalty de cada lado) LADO A LADO com os pontos que o
// nosso motor calcula (contestActions + scoreActions). Serve para responder,
// com dados reais e sem vasculhar JSON à mão, a duas perguntas em aberto:
//
//   1. DOIS WAZA-ARIS: quando uma luta acaba por dois waza-aris, o JudoBase
//      grava waza=2 (e então o motor dá 8) ou converte para ippon=1 (e dá 10)?
//   2. HANSOKU-MAKE: três shidos aparecem como penalty=3? E o JudoBase marca
//      TAMBÉM um ippon ao adversário, ou regista só a penalização?
//
// Estes dois testes NÃO precisam do Tahiti ao vivo — fazem-se já hoje numa
// competição terminada (Tallinn 3161). O sábado fica só para o teste do "ao vivo".
//
// Uso:
//   /api/diagnostico?comp=3161            -> resumo + só as lutas "interessantes"
//   /api/diagnostico?comp=3161&todas=1    -> + todas as lutas (output grande)
//   /api/diagnostico?comp=3295            -> Tahiti (no sábado)
import { NextResponse } from "next/server";
import { getCompetitionContests, contestActions } from "@/lib/ijf";
import { scoreActions } from "@/lib/engine";
import type { IjfContest } from "@/lib/ijf";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const toInt = (v: unknown): number => {
  const x = parseInt(String(v ?? "0"), 10);
  return isNaN(x) ? 0 : x;
};

// Campos crus + pontos calculados de um lado da luta.
function lado(f: IjfContest, side: "b" | "w") {
  const id = String(side === "b" ? f.id_person_blue : f.id_person_white || "");
  return {
    id_person: id,
    ippon: toInt((f as Record<string, unknown>)[`ippon_${side}`]),
    waza: toInt((f as Record<string, unknown>)[`waza_${side}`]),
    yuko: toInt((f as Record<string, unknown>)[`yuko_${side}`]),
    penalty: toInt((f as Record<string, unknown>)[`penalty_${side}`]),
    pontos_motor: scoreActions(contestActions(f, side)),
  };
}

function linha(f: IjfContest) {
  return {
    id_fight: f.id_fight,
    round: f.round_name ?? f.round ?? "",
    id_winner: f.id_winner ?? "",
    blue: lado(f, "b"),
    white: lado(f, "w"),
  };
}

type Linha = ReturnType<typeof linha>;

// Uma luta é "caso de dois waza-aris" se algum lado tem waza >= 2.
function ehWaza2(l: Linha): boolean {
  return l.blue.waza >= 2 || l.white.waza >= 2;
}
// "Caso de hansoku-make" se algum lado tem 3+ penalizações (3 shidos).
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

  // Para os casos de 3 shidos: o lado que NÃO levou os 3 shidos tem também um
  // ippon registado? (responde "o hansoku-make traz um ippon ao vencedor?")
  const penalty3ComIpponNoVencedor = casosPenalty3.filter((l) => {
    const perdedorAzul = l.blue.penalty >= 3;
    const vencedor = perdedorAzul ? l.white : l.blue;
    return vencedor.ippon >= 1;
  }).length;

  // Para os casos de 2 waza: algum tem TAMBÉM ippon no mesmo lado? (sinal de
  // que o JudoBase converteu os 2 waza em ippon e manteve ambos os campos.)
  const waza2ComIpponMesmoLado = casosWaza2.filter(
    (l) => (l.blue.waza >= 2 && l.blue.ippon >= 1) || (l.white.waza >= 2 && l.white.ippon >= 1)
  ).length;

  const resposta: Record<string, unknown> = {
    comp,
    n_lutas: contests.length,
    tem_resultados: contests.length > 0,

    // ---- TESTE 1: DOIS WAZA-ARIS ----
    teste_dois_waza: {
      lutas_com_waza2: casosWaza2.length,
      destas_com_ippon_no_mesmo_lado: waza2ComIpponMesmoLado,
      leitura:
        casosWaza2.length === 0
          ? "Sem lutas com waza>=2 nesta competição (ou ainda sem dados)."
          : waza2ComIpponMesmoLado === 0
            ? "Dois waza-aris ficam como waza=2 (ippon=0). O motor dá 8 (4+4) — É O QUE QUERES."
            : "Há lutas com waza>=2 E ippon>=1 no mesmo lado. O JudoBase pode estar a converter — VERIFICAR os campos crus em casos_waza2.",
    },

    // ---- TESTE 2: HANSOKU-MAKE (3 shidos) ----
    teste_hansoku: {
      lutas_com_3_ou_mais_penalty: casosPenalty3.length,
      destas_com_ippon_no_vencedor: penalty3ComIpponNoVencedor,
      leitura:
        casosPenalty3.length === 0
          ? "Sem lutas com penalty>=3 nesta competição (ou ainda sem dados)."
          : penalty3ComIpponNoVencedor === 0
            ? "Hansoku-make aparece só como penalty=3, sem ippon ao vencedor. Quem leva: -6 (3 shidos). Quem ganha: +3."
            : "Atenção: em hansoku-make o vencedor TAMBÉM tem ippon. Isso soma +10 ao vencedor e -5 ao perdedor — DECIDIR se é o pretendido.",
    },

    casos_waza2: casosWaza2,
    casos_penalty3: casosPenalty3,
  };

  if (todas) resposta.todas_as_lutas = linhas;

  return NextResponse.json(resposta);
}
