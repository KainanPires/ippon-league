// app/api/resultados/route.ts
//
// RESULTADOS REAIS — passo 1c (alimentação para a app).
//
// Dado uma competição, devolve quanto CADA atleta pontuou de verdade, somando as
// acoes de todas as lutas dele (lib/ijf.ts) com a tabela validada (lib/engine.ts).
// É a fonte que o Meu Time vai consultar para mostrar pontos reais por atleta.
//
// O id de cada atleta é o id_person do JudoBase — o MESMO id que vem do mercado
// (/api/atletas), por isso a equipa do jogador casa diretamente com este mapa.
//
// Uso: /api/resultados?comp=3131   (competicao terminada -> tem pontos)
//      /api/resultados?comp=3295   (Tahiti -> ainda sem lutas, mapa vazio)

import { NextResponse } from "next/server";
import { getCompetitionContests, contestActions } from "@/lib/ijf";
import { scoreActions } from "@/lib/engine";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const comp = searchParams.get("comp");
  if (!comp) {
    return NextResponse.json(
      { erro: "Falta ?comp=<id_competition>. Ex.: /api/resultados?comp=3131" },
      { status: 400 }
    );
  }

  const contests = (await getCompetitionContests(comp)) as any[];

  // Soma os pontos de cada atleta (por id_person) ao longo de todas as lutas.
  const pontos: Record<string, number> = {};
  for (const f of contests) {
    const lados: ["b" | "w", string][] = [
      ["b", String(f.id_person_blue ?? "")],
      ["w", String(f.id_person_white ?? "")],
    ];
    for (const [side, id] of lados) {
      if (!id) continue;
      pontos[id] = (pontos[id] ?? 0) + scoreActions(contestActions(f, side));
    }
  }

  return NextResponse.json({
    comp,
    tem_resultados: contests.length > 0,
    n_lutas: contests.length,
    n_atletas: Object.keys(pontos).length,
    pontos, // { "<id_person>": <pontos>, ... }
  });
}
