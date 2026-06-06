import { NextResponse } from "next/server";
import { getCompetitions, getCompetitionCompetitorsRaw, mapCompetitorsToAthletes } from "@/lib/ijf";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { Athlete } from "@/lib/athletes";

// Sempre fresco do lado do Next; o cache é o nosso (Supabase).
export const dynamic = "force-dynamic";

// Quantas horas uma cópia do cache é considerada "fresca".
const CACHE_HORAS = 6;

/**
 * Balcão de atletas (com cache NÃO-DESTRUTIVO).
 *
 *   /api/atletas                      -> lista as competições de 2026
 *   /api/atletas?ano=2025             -> competições desse ano
 *   /api/atletas?id=COMPETICAO        -> atletas (do cache se fresco, senão sincroniza com o JudoBase)
 *   /api/atletas?id=COMPETICAO&atualizar=1 -> força sincronizar a lista com o JudoBase
 *
 * IMPORTANTE: ao sincronizar, os preços/médias REAIS já calculados (pelo
 * trabalhador /api/calcular) são PRESERVADOS. Só se atualiza a lista de
 * inscritos: entram novos, saem os que desistiram. Nunca se apagam os valores
 * reais com preços de partida.
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

  // Lê o que está no cache (pode estar vazio).
  let cacheAtual: Athlete[] = [];
  let cacheData: string | null = null;
  if (supabaseAdmin) {
    try {
      const { data } = await supabaseAdmin
        .from("atletas_cache")
        .select("atletas, atualizado_em")
        .eq("id_competition", id)
        .maybeSingle();
      if (data) {
        cacheAtual = Array.isArray(data.atletas) ? (data.atletas as Athlete[]) : [];
        cacheData = data.atualizado_em ?? null;
      }
    } catch {
      // segue sem cache
    }
  }

  // 1) Se o cache está fresco e não estamos a forçar, serve já.
  if (!forcar && cacheAtual.length > 0 && cacheData) {
    const idadeMs = Date.now() - new Date(cacheData).getTime();
    if (idadeMs < CACHE_HORAS * 3600 * 1000) {
      return resposta(id, "cache", cacheAtual);
    }
  }

  // 2) Sincroniza a lista de inscritos com o JudoBase.
  const raw = await getCompetitionCompetitorsRaw(id);
  const frescos = mapCompetitorsToAthletes(raw);

  // Se o JudoBase não respondeu, NÃO estraga o cache — serve o que temos.
  if (frescos.length === 0) {
    if (cacheAtual.length > 0) return resposta(id, "cache", cacheAtual);
    return resposta(id, "judobase", [], raw !== null);
  }

  // 3) JUNTA: mantém os valores reais já calculados; aceita novos inscritos;
  //    descarta quem já não está inscrito (só ficam os "frescos").
  const calculadosPorId = new Map<string, Athlete>();
  for (const a of cacheAtual) {
    // "já calculado" = tem média ou última pontuação reais (deixou de ser placeholder)
    if (a && (a.avg !== 0 || a.last !== 0)) calculadosPorId.set(a.id, a);
  }

  const lista: Athlete[] = frescos.map((novo) => {
    const real = calculadosPorId.get(novo.id);
    if (real) {
      // mantém preço/média/última/estado reais; atualiza só dados de identidade
      return { ...real, name: novo.name, countryIso: novo.countryIso, category: novo.category, gender: novo.gender };
    }
    return novo; // inscrito novo (ou ainda sem cálculo): preço de partida
  });

  // 4) Grava a lista sincronizada.
  if (supabaseAdmin) {
    try {
      await supabaseAdmin.from("atletas_cache").upsert(
        {
          id_competition: id,
          atletas: lista,
          total: lista.length,
          atualizado_em: new Date().toISOString(),
        },
        { onConflict: "id_competition" }
      );
    } catch {
      // ignora erro de escrita
    }
  }

  return resposta(id, "judobase", lista, raw !== null);
}

function resposta(id: string, origem: "cache" | "judobase", atletas: Athlete[], recebido = true) {
  const masculinos = atletas.filter((a) => a.gender === "M").length;
  const femininos = atletas.filter((a) => a.gender === "F").length;
  const com_preco_real = atletas.filter((a) => a.avg !== 0 || a.last !== 0).length;
  return NextResponse.json({
    modo: "atletas",
    id,
    origem,
    recebido,
    total: atletas.length,
    masculinos,
    femininos,
    com_preco_real,
    atletas,
  });
}
