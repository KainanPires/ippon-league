// app/api/copa/inspecionar/route.ts
//
// ROTA DE DIAGNÓSTICO (temporária) — inspecionar as lutas cruas de uma competição.
//
// Serve para responder a UMA pergunta: a API do IJF devolve o DRAW (confrontos
// agendados antes de acontecer, sem vencedor) ou só RESULTADOS (com vencedor)?
//
// Mostra as primeiras N lutas com os campos que importam: os dois atletas, a
// fase, a hora planeada, e se já há vencedor. Se houver lutas com os dois
// atletas mas SEM id_winner, isso é o draw.
//
// Uso: /api/copa/inspecionar?comp=3295&n=10
// APAGAR esta rota depois de tirarmos a conclusão.
import { NextResponse } from "next/server";
import { getCompetitionContests } from "@/lib/ijf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const comp = (searchParams.get("comp") || "").trim();
  const n = Math.min(parseInt(searchParams.get("n") || "10", 10) || 10, 40);
  if (!comp) return NextResponse.json({ erro: "Falta ?comp=<id_competition>." }, { status: 400 });

  const contests = await getCompetitionContests(comp);

  // Resumo: quantas lutas têm vencedor vs não têm.
  let comVencedor = 0;
  let semVencedor = 0;
  for (const f of contests) {
    const w = String(f.id_winner ?? "").trim();
    if (w && w !== "0") comVencedor++;
    else semVencedor++;
  }

  // As primeiras N lutas, só com os campos relevantes para ler facilmente.
  const amostra = contests.slice(0, n).map((f) => ({
    fase: f.round_name || f.round_code || f.round || "—",
    azul: f.id_person_blue,
    branco: f.id_person_white,
    vencedor: f.id_winner || "(sem vencedor)",
    hora_planeada: f.start_planned || "—",
    hora_real: f.start || "—",
    tatame: f.mat_number || "—",
  }));

  return NextResponse.json({
    comp,
    n_lutas: contests.length,
    com_vencedor: comVencedor,
    sem_vencedor: semVencedor,
    // Se sem_vencedor > 0 e as lutas têm os dois atletas, ISSO é o draw.
    leitura:
      contests.length === 0
        ? "A API não devolve lutas para esta competição (ainda sem draw nem resultados)."
        : semVencedor > 0
          ? "Há lutas SEM vencedor — provável DRAW disponível."
          : "Todas as lutas têm vencedor — só RESULTADOS (competição já disputada).",
    amostra,
  });
}
