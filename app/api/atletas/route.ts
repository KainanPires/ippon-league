import { NextResponse } from "next/server";
import { getCompetitions, getCompetitionCompetitorsRaw, mapCompetitorsToAthletes } from "@/lib/ijf";

// Sempre fresco (sem cache de build) — é um endereço de diagnóstico.
export const dynamic = "force-dynamic";

/**
 * Balcão de diagnóstico (passo 3A).
 *
 *   /api/atletas                 -> lista as competições de 2026 (para escolheres um id)
 *   /api/atletas?ano=2025        -> lista as competições desse ano
 *   /api/atletas?id=COMPETICAO   -> inscritos dessa competição, em CRU (para vermos o formato)
 *
 * Ainda não mapeia para o formato do jogo — é só para confirmarmos que o cano
 * traz água e ver a forma real dos dados.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const ano = searchParams.get("ano") || "2026";

  if (!id) {
    const comps = await getCompetitions(Number(ano));
    const competicoes = comps.map((c) => ({
      id: c.id_competition,
      nome: c.name,
      de: c.date_from,
      ate: c.date_to,
      pais: c.country_short || c.country || "",
      idades: c.ages || [],
      equipas: c.is_teams,
      tem_resultados: c.has_results,
    }));
    return NextResponse.json({
      modo: "competicoes",
      ano: Number(ano),
      total: competicoes.length,
      dica: "Escolhe um id da lista e abre /api/atletas?id=ESSE_ID",
      competicoes,
    });
  }

  const dados = await getCompetitionCompetitorsRaw(id);
  const atletas = mapCompetitorsToAthletes(dados);
  const masculinos = atletas.filter((a) => a.gender === "M").length;
  const femininos = atletas.filter((a) => a.gender === "F").length;
  return NextResponse.json({
    modo: "atletas",
    id,
    recebido: dados !== null,
    total: atletas.length,
    masculinos,
    femininos,
    nota: "Atletas reais do JudoBase já no formato do jogo. Preço é de PARTIDA (afinado no 3D).",
    atletas,
  });
}
