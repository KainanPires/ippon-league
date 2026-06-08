// app/api/horario/route.ts
//
// BUSCADOR DE HORÁRIOS — Fase 1 (descoberta).
//
// Vai ao JudoBase buscar a info de uma competição e as HORAS das lutas (contests).
// Cada luta traz "start_planned" / "start" — a luta mais cedra do 1º dia é, na
// prática, o início da competição. Esta rota NÃO assume o formato dessas horas:
// devolve-as cruas para inspecionarmos a forma real (timestamp? fuso?) antes de
// construir a conversão para inicioUTC.
//
// Como usar: abrir no navegador
//   /api/horario?id=3131   (Paris 2026 — já aconteceu, garante lutas com horas)
//   /api/horario?id=3295   (Tahiti — para ver se o horário já está publicado)
// e colar o JSON de volta na conversa.

import { NextResponse } from "next/server";
import { getCompetition, getCompetitionContests } from "@/lib/ijf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json(
      { erro: "Falta ?id=<id_competition>. Ex.: /api/horario?id=3131" },
      { status: 400 }
    );
  }

  // Reutiliza o que já funciona no projeto (lib/ijf.ts).
  const info = await getCompetition(id);
  const contests = await getCompetitionContests(id);

  // Recolhe só os campos relacionados com tempo de cada luta.
  const horas = contests
    .map((c) => ({
      start_planned: c.start_planned ?? null,
      start: c.start ?? null,
      end: c.end ?? null,
      duration: c.duration ?? null,
      round_name: c.round_name ?? null,
      mat_number: c.mat_number ?? null,
    }))
    .filter((h) => h.start_planned || h.start);

  // Ordena pela string da hora (PROVISÓRIO: ainda não sabemos o formato).
  horas.sort((a, b) =>
    String(a.start_planned ?? a.start ?? "").localeCompare(String(b.start_planned ?? b.start ?? ""))
  );

  return NextResponse.json({
    nota:
      "Fase 1 (descoberta). Repara no formato de 'start_planned'/'start' nas amostras " +
      "e no objeto cru. Precisamos de saber se é timestamp/ISO e em que fuso.",
    id_competition: id,
    info: info
      ? {
          name: info.name,
          date_from: info.date_from,
          date_to: info.date_to,
          city: info.city ?? null,
          country: info.country ?? null,
          country_short: info.country_short ?? null,
          continent_short: info.continent_short ?? null,
        }
      : null,
    total_contests: contests.length,
    com_hora: horas.length,
    // As 6 lutas mais cedo (onde deve estar o início real do evento):
    amostra_mais_cedo: horas.slice(0, 6),
    // A luta mais tardia (para vermos o intervalo de um dia):
    mais_tarde: horas.length ? horas[horas.length - 1] : null,
    // Uma luta inteira, crua, para vermos TODOS os campos de tempo disponíveis:
    contest_cru_exemplo: contests.length ? contests[0] : null,
  });
}
