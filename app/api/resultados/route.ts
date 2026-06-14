// app/api/resultados/route.ts
//
// RESULTADOS REAIS — pontos de cada atleta numa competição.
//
// FONTE (corrigido): quando recebe a lista de atletas (?persons=id1,id2,...),
// busca as lutas DE CADA ATLETA via competitor.contests e filtra pela competição.
// Isto resolve o caso em que competition.contests vem INCOMPLETO durante/logo
// após o evento (ex.: Tahiti 2026 só devolvia -52 e -60, deixando os outros
// atletas a 0 mesmo já tendo lutado). O competitor.contests traz o histórico
// completo do atleta, com as lutas da competição em curso.
//
// Retrocompatível: SEM ?persons, mantém o comportamento antigo (competition.contests,
// todos os atletas da competição) — usado onde se quer o mapa completo.
//
// Os campos das lutas são idênticos nos dois endpoints, por isso o cálculo
// (scoreContestSide / scoreContestForPerson) é o mesmo.
//
// Uso:
//   /api/resultados?comp=3295&persons=4143,67160,32250   (pontua só estes — recomendado)
//   /api/resultados?comp=3131                            (todos — modo antigo)
import { NextResponse } from "next/server";
import {
  getCompetitionContests,
  getCompetitorContests,
  scoreContestSide,
  scoreContestForPerson,
} from "@/lib/ijf";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const comp = (searchParams.get("comp") || "").trim();
  const personsParam = (searchParams.get("persons") || "").trim();

  if (!comp) {
    return NextResponse.json(
      { erro: "Falta ?comp=<id_competition>. Ex.: /api/resultados?comp=3131" },
      { status: 400 }
    );
  }

  // MODO POR ATLETA (recomendado): pontua só os atletas pedidos, buscando as
  // lutas de cada um (competitor.contests) filtradas pela competição.
  if (personsParam) {
    const ids = personsParam.split(",").map((s) => s.trim()).filter(Boolean);
    const pontos: Record<string, number> = {};
    let nLutas = 0;

    // Em paralelo, mas com cuidado: cada atleta é uma chamada à API.
    await Promise.all(
      ids.map(async (id) => {
        try {
          const todas = await getCompetitorContests(id);
          const desta = (todas || []).filter((f) => String(f.id_competition) === comp);
          let soma = 0;
          for (const f of desta) soma += scoreContestForPerson(f, id);
          pontos[id] = Math.round(soma * 10) / 10;
          nLutas += desta.length;
        } catch {
          pontos[id] = 0;
        }
      })
    );

    return NextResponse.json({
      comp,
      modo: "por_atleta",
      tem_resultados: nLutas > 0,
      n_lutas: nLutas,
      n_atletas: Object.keys(pontos).length,
      pontos,
    });
  }

  // MODO ANTIGO (todos os atletas da competição) — competition.contests.
  // Mantido por retrocompatibilidade. Pode vir incompleto durante o evento.
  const contests = await getCompetitionContests(comp);
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
    modo: "por_competicao",
    tem_resultados: contests.length > 0,
    n_lutas: contests.length,
    n_atletas: Object.keys(pontos).length,
    pontos,
  });
}
