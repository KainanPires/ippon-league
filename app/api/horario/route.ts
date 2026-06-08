// app/api/horario/route.ts
//
// BUSCADOR DE HORÁRIOS — Fase 2 (sugestão pronta).
//
// Descoberta confirmada: o JudoBase devolve as horas das lutas (start_planned)
// em UTC, no formato "YYYY-MM-DD HH:MM:SS". A luta mais cedo de uma competição
// é, na prática, o seu início. Logo:
//   inicioUTC = start_planned_mais_cedo (em ISO com "Z")
//   fecho do mercado = inicioUTC - 1h   (regra da app)
//
// Esta rota vai buscar isso e devolve a LINHA exata para colar no calendario.ts.
// Se a competição ainda não tiver lutas publicadas, avisa e lembra o default 9h.
//
// Uso (navegador):  /api/horario?id=3131   /api/horario?id=3295

import { NextResponse } from "next/server";
import { getCompetition, getCompetitionContests } from "@/lib/ijf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// "2026-02-07 07:40:00" (UTC) -> "2026-02-07T07:40:00Z"
function paraIsoUTC(s: string): string | null {
  const m = String(s).trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  const [, y, mo, d, h, mi, se] = m;
  return `${y}-${mo}-${d}T${h}:${mi}:${se ?? "00"}Z`;
}

// Encontra a hora mais cedo entre as lutas. O formato do JudoBase é fixo e
// zero-padded ("YYYY-MM-DD HH:MM:SS"), por isso a ordem alfabética = cronológica.
function maisCedo(contests: { start_planned?: string | null; start?: string | null }[]): string | null {
  let melhor: string | null = null;
  for (const c of contests) {
    const v = (c.start_planned || c.start || "").trim();
    if (!v) continue;
    if (melhor === null || v < melhor) melhor = v;
  }
  return melhor;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json(
      { erro: "Falta ?id=<id_competition>. Ex.: /api/horario?id=3131" },
      { status: 400 }
    );
  }

  const info = await getCompetition(id);
  const contests = await getCompetitionContests(id);
  const nome = info?.name ?? "(desconhecida)";

  const cedo = maisCedo(contests);

  // Sem lutas publicadas -> ainda nao ha hora. Fica o default seguro das 9h locais.
  if (!cedo) {
    return NextResponse.json({
      id_competition: id,
      nome,
      datas: info ? { de: info.date_from, ate: info.date_to } : null,
      tem_horario: false,
      total_contests: contests.length,
      mensagem:
        "Ainda nao ha lutas publicadas para esta competicao, por isso nao ha hora " +
        "oficial. Mantem-se o default seguro das 09:00 locais (mercado fecha as 08:00). " +
        "Voltar a correr esta rota mais perto do evento.",
    });
  }

  const inicioUTC = paraIsoUTC(cedo);
  if (!inicioUTC) {
    return NextResponse.json({
      id_competition: id,
      nome,
      tem_horario: false,
      aviso: `Encontrei uma hora ('${cedo}') mas nao reconheci o formato. Cola-me este valor.`,
    });
  }

  const inicio = new Date(inicioUTC);
  const fecho = new Date(inicio.getTime() - 60 * 60 * 1000);

  return NextResponse.json({
    id_competition: id,
    nome,
    datas: info ? { de: info.date_from, ate: info.date_to } : null,
    tem_horario: true,
    total_contests: contests.length,
    // O resultado util:
    start_planned_mais_cedo_UTC: cedo,
    inicioUTC,                         // o que vai para o calendario.ts
    fecho_mercado_UTC: fecho.toISOString(),
    // A LINHA pronta a colar:
    linha_para_calendario: `inicioUTC: "${inicioUTC}"`,
    nota:
      "Cola o valor de 'inicioUTC' na competicao certa do calendario.ts. " +
      "Fecho = inicio - 1h (regra da app). Horas em UTC, sem adivinhar fusos.",
  });
}
