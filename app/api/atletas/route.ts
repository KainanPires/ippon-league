import { NextResponse } from "next/server";
import { getCompetitions, getCompetitionCompetitorsRaw, mapCompetitorsToAthletes } from "@/lib/ijf";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { Athlete } from "@/lib/athletes";

// Sempre fresco do lado do Next; o cache é o nosso (Supabase).
export const dynamic = "force-dynamic";

// Quantas horas uma cópia do cache é considerada "fresca".
const CACHE_HORAS = 6;

/**
 * Balcão de atletas (passo 3A-2b, com cache).
 *
 *   /api/atletas                      -> lista as competições de 2026
 *   /api/atletas?ano=2025             -> competições desse ano
 *   /api/atletas?id=COMPETICAO        -> atletas (do cache se fresco, senão do JudoBase)
 *   /api/atletas?id=COMPETICAO&atualizar=1 -> força ir buscar ao JudoBase e renovar o cache
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const ano = searchParams.get("ano") || "2026";
  const forcar = searchParams.get("atualizar") === "1";

  // ----- Modo: lista de competições -----
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

  // ----- Modo: atletas de uma competição -----

  // 1) Tenta servir do cache (se houver cópia fresca).
  if (supabaseAdmin && !forcar) {
    try {
      const { data } = await supabaseAdmin
        .from("atletas_cache")
        .select("atletas, total, atualizado_em")
        .eq("id_competition", id)
        .maybeSingle();
      if (data && data.atualizado_em) {
        const idadeMs = Date.now() - new Date(data.atualizado_em).getTime();
        if (idadeMs < CACHE_HORAS * 3600 * 1000) {
          return resposta(id, "cache", (data.atletas as Athlete[]) || []);
        }
      }
    } catch {
      // se o cache falhar, seguimos para o JudoBase
    }
  }

  // 2) Vai ao JudoBase e mapeia.
  const raw = await getCompetitionCompetitorsRaw(id);
  const atletas = mapCompetitorsToAthletes(raw);

  // 3) Guarda a cópia no cache (best-effort; se falhar, não estraga a resposta).
  if (supabaseAdmin && atletas.length > 0) {
    try {
      await supabaseAdmin.from("atletas_cache").upsert(
        {
          id_competition: id,
          atletas,
          total: atletas.length,
          atualizado_em: new Date().toISOString(),
        },
        { onConflict: "id_competition" }
      );
    } catch {
      // ignora erros de escrita do cache
    }
  }

  return resposta(id, "judobase", atletas, raw !== null);
}

function resposta(id: string, origem: "cache" | "judobase", atletas: Athlete[], recebido = true) {
  const masculinos = atletas.filter((a) => a.gender === "M").length;
  const femininos = atletas.filter((a) => a.gender === "F").length;
  return NextResponse.json({
    modo: "atletas",
    id,
    origem,
    recebido,
    total: atletas.length,
    masculinos,
    femininos,
    atletas,
  });
}
