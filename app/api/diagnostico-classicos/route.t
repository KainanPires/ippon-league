// app/api/diagnostico-classicos/route.ts
//
// ROTA DE DIAGNÓSTICO (temporária) — listar competições ANTIGAS do JudoBase
// para escolhermos novos CLÁSSICOS para o calendário.
//
// Corre na Vercel (COM internet). O Claude não tem net no ambiente de trabalho,
// por isso é esta rota que vai ao JudoBase buscar os id_competition REAIS — em
// vez de adivinhar ids (perigoso: id errado = competição vazia).
//
// Protegida pelo CRON_SECRET, igual ao cron: dispara com ?key=<CRON_SECRET>.
//
// DOIS MODOS:
//   1) ?modo=amostra&ano=2024   -> resposta CRUA de um ano, SEM filtrar nada.
//      Serve para vermos os valores reais de competition_code, ages, has_results,
//      status, etc. — para afinar a classificação sem adivinhar. (É o 1º a correr.)
//
//   2) ?modo=classicos          -> varre 2015..2025, filtra para os tipos que o
//      Kainan quer (Grand Slam / Grand Prix > Mundial > Masters > Olimpíada),
//      só seniores, exclui equipas/kata e os ids JÁ usados no calendário, e
//      devolve a lista ordenada pela preferência, pronta a escolher.
//
// Filtros opcionais do modo classicos:
//   &comResultados=1  -> só competições com has_results "ligado" (ver temResultados)
//
// Exemplos:
//   /api/diagnostico-classicos?key=SEGREDO&modo=amostra&ano=2023
//   /api/diagnostico-classicos?key=SEGREDO&modo=classicos
//   /api/diagnostico-classicos?key=SEGREDO&modo=classicos&comResultados=1

import { NextResponse } from "next/server";
import { getCompetitions, type IjfCompetition } from "@/lib/ijf";
import { CALENDARIO_2026 } from "@/lib/calendario";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const ANO_INICIO = 2015;
const ANO_FIM = 2025;

// Aceita o segredo por ?key= (teste manual no browser), como o cron.
function autorizado(key: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return key === secret;
}

// Tipos de clássico que o Kainan quer, por ordem de PREFERÊNCIA.
type TipoClassico = "Grand Slam" | "Grand Prix" | "Mundial" | "Masters" | "Olimpíada";
const PRIORIDADE: Record<TipoClassico, number> = {
  "Grand Slam": 1,
  "Grand Prix": 1,
  "Mundial": 2,
  "Masters": 3,
  "Olimpíada": 4,
};

// Classifica uma competição pelo NOME (os nomes do JudoBase são consistentes em
// inglês). Mais fiável do que adivinhar competition_code. Devolve null para tudo
// o que NÃO interessa como clássico (opens, european cups, continentais, etc.)
// ou que não seja senior individual (junior/cadet/veteran/equipas/kata).
function classificar(nome: string): TipoClassico | null {
  const n = (nome || "").toLowerCase();
  // Fora: categorias não-senior, equipas e kata.
  if (/junior|cadet|veteran|kata|\bteam(s)?\b|mixed team/.test(n)) return null;
  // Ordem importa: testar o mais específico primeiro.
  if (/olympic/.test(n)) return "Olimpíada";
  if (/world championship/.test(n)) return "Mundial"; // seniores (junior já saiu acima)
  if (/grand slam/.test(n)) return "Grand Slam";
  if (/grand prix/.test(n)) return "Grand Prix";
  if (/masters/.test(n)) return "Masters";
  return null;
}

// has_results "ligado"? Tolerante a vários formatos (o formato exato confirma-se
// no modo amostra). Competições passadas (2015-2025) quase sempre têm resultados.
function temResultados(c: IjfCompetition): boolean {
  const v = String(c.has_results ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "y";
}

interface LinhaClassico {
  id: string;
  nome: string;
  tipo: TipoClassico;
  prioridade: number;
  data: string;
  ano: number;
  cidade: string;
  pais: string;
  competition_code: string;
  has_results: string;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const key = searchParams.get("key");
  if (!autorizado(key)) {
    return NextResponse.json({ erro: "Não autorizado. Usa ?key=<CRON_SECRET>." }, { status: 401 });
  }

  const t0 = Date.now();
  const modo = (searchParams.get("modo") || "classicos").trim();

  // ---------------------------------------------------------------------------
  // MODO AMOSTRA — resposta crua de um ano, sem filtrar. Para vermos os campos.
  // ---------------------------------------------------------------------------
  if (modo === "amostra") {
    const ano = parseInt(searchParams.get("ano") || "2024", 10);
    const comps = await getCompetitions(ano);
    return NextResponse.json({
      modo: "amostra",
      ano,
      total: comps.length,
      // Mostra os campos que interessam para afinar a classificação/os filtros.
      competicoes: comps.map((c) => ({
        id_competition: c.id_competition,
        name: c.name,
        competition_code: c.competition_code ?? null,
        date_from: c.date_from,
        date_to: c.date_to,
        city: c.city ?? null,
        country_short: c.country_short ?? null,
        continent_short: c.continent_short ?? null,
        ages: c.ages ?? null,
        has_results: c.has_results ?? null,
        status: c.status ?? null,
        is_teams: c.is_teams ?? null,
      })),
      ms_total: Date.now() - t0,
    });
  }

  // ---------------------------------------------------------------------------
  // MODO CLASSICOS — varre 2015..2025, filtra e ordena pela preferência.
  // ---------------------------------------------------------------------------
  const soComResultados = searchParams.get("comResultados") === "1";
  const usados = new Set(CALENDARIO_2026.map((c) => String(c.idCompeticao)));

  const anosFalhados: number[] = [];
  const linhas: LinhaClassico[] = [];
  const vistos = new Set<string>();

  for (let ano = ANO_INICIO; ano <= ANO_FIM; ano++) {
    const comps = await getCompetitions(ano);
    if (!comps || comps.length === 0) { anosFalhados.push(ano); continue; }

    for (const c of comps) {
      const id = String(c.id_competition ?? "").trim();
      if (!id || vistos.has(id)) continue;
      if (usados.has(id)) continue; // já está no calendário — não repetir
      const tipo = classificar(c.name || "");
      if (!tipo) continue; // não é um dos tipos preferidos
      if (soComResultados && !temResultados(c)) continue;

      vistos.add(id);
      const data = String(c.date_from || "");
      const ano4 = parseInt(data.slice(0, 4) || String(ano), 10);
      linhas.push({
        id,
        nome: c.name,
        tipo,
        prioridade: PRIORIDADE[tipo],
        data,
        ano: isNaN(ano4) ? ano : ano4,
        cidade: c.city ?? "",
        pais: c.country_short ?? "",
        competition_code: c.competition_code ?? "",
        has_results: String(c.has_results ?? ""),
      });
    }
  }

  // Ordena: 1º pela preferência de tipo, depois pela data (mais recente primeiro).
  linhas.sort((a, b) => (a.prioridade - b.prioridade) || b.data.localeCompare(a.data));

  // Também agrupa por tipo, para ser fácil escolher e mesclar recentes/antigas.
  const porTipo: Record<string, LinhaClassico[]> = {};
  for (const l of linhas) (porTipo[l.tipo] ||= []).push(l);

  const contagem: Record<string, number> = {};
  for (const t of Object.keys(porTipo)) contagem[t] = porTipo[t].length;

  return NextResponse.json({
    modo: "classicos",
    anos: `${ANO_INICIO}-${ANO_FIM}`,
    so_com_resultados: soComResultados,
    anos_sem_resposta: anosFalhados,
    total_encontradas: linhas.length,
    contagem_por_tipo: contagem,
    por_tipo: porTipo,
    lista_ordenada: linhas,
    ms_total: Date.now() - t0,
  });
}
