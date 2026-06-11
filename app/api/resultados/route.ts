// app/api/resultados/route.ts
//
// RESULTADOS REAIS — passo 1c (alimentação para a app).
//
// Dado uma competição, devolve quanto CADA atleta pontuou de verdade, somando a
// pontuação de todas as lutas dele. A pontuação de cada luta é calculada por
// scoreContestSide (lib/ijf.ts), que já aplica as regras fechadas: shido sofrido
// crescente (-2,-3,-4), shido provocado +1 (x2 só em vitória por hansoku-make) e
// hansoku-make a contar como hansoku (sem o ippon fantasma).
//
// O id de cada atleta é o id_person do JudoBase — o MESMO id que vem do mercado
// (/api/atletas), por isso a equipa do jogador casa diretamente com este mapa.
//
// Uso: /api/resultados?comp=3131   (competicao terminada -> tem pontos)
//      /api/resultados?comp=3295   (Tahiti -> ainda sem lutas, mapa vazio)
import { NextResponse } from "next/server";
import { getCompetitionContests, scoreContestSide } from "@/lib/ijf";
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
  const contests = await getCompetitionContests(comp);
  // Soma os pontos de cada atleta (por id_person) ao longo de todas as lutas.
  const pontos: Record<string, number> = {};
  for (const f of contests) {
    const lados: ["b" | "w", string][] = [
      ["b", String(f.id_person_blue ?? "")],
      ["w", String(f.id_person_white ?? "")],
    ];
    for (const [side, id] of lados) {
      if (!id) continue;
      pontos[id] = (pontos[id] ?? 0) + scoreContestSide(f, side);
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
