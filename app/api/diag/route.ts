// app/api/diagnostico-classicos/route.ts  (ou app/api/diag/route.ts)
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
// NOTA SOBRE has_results: NAO e "1"/"0". E a CONTAGEM de resultados/medalhas
// (ex.: "112", "41"); "0" = sem resultados (camps, eventos por realizar). Por
// isso o criterio de "tem resultados" e has_results > 0.
//
// DOIS MODOS:
//   modo=amostra&ano=2024  -> resposta CRUA de um ano, SEM filtrar nada (debug).
//   modo=classicos         -> varre 2015..2025, filtra para os tipos do Kainan
//      (Grand Slam / Grand Prix > Mundial > Masters > Olimpiada), so seniores
//      individuais COM resultados, exclui equipas/kata/camps e os ids JA usados
//      no calendario, e devolve a lista ordenada pela preferencia.
//
// Exemplos:
//   /api/diag?key=SEGREDO&modo=amostra&ano=2023
//   /api/diag?key=SEGREDO&modo=classicos

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

// Tipos de classico que o Kainan quer, por ordem de PREFERENCIA.
type TipoClassico = "Grand Slam" | "Grand Prix" | "Mundial" | "Masters" | "Olimpiada";
const PRIORIDADE: Record<TipoClassico, number> = {
  "Grand Slam": 1,
  "Grand Prix": 1,
  "Mundial": 2,
  "Masters": 3,
  "Olimpiada": 4,
};

// Classifica uma competicao pelo NOME (os nomes do JudoBase sao consistentes em
// ingles — confirmado na amostra de 2024). Devolve null para tudo o que NAO
// interessa: opens, european cups, continentais, e ainda eventos paralelos
// (paralimpicos, IBSA, militares, universitarios, clubes, camps), kata, equipas
// e categorias nao-senior (junior/cadet/veteran).
function classificar(nome: string): TipoClassico | null {
  const n = (nome || "").toLowerCase();
  // Paralimpicos fora (contem "olympic"/"paralympic").
  if (/paralympic/.test(n)) return null;
  // Olimpiada primeiro (antes de qualquer exclusao por "games").
  if (/olympic/.test(n)) return "Olimpiada";
  // Eventos a excluir mesmo que contenham um padrao de tipo.
  if (/junior|cadet|veteran|kata|\bteam(s)?\b|mixed team|military|universit|\bclub\b|training camp|ibsa/.test(n)) return null;
  // Restantes tipos preferidos.
  if (/world championship/.test(n)) return "Mundial"; // seniores (junior/kata ja sairam)
  if (/grand slam/.test(n)) return "Grand Slam";
  if (/grand prix/.test(n)) return "Grand Prix";
  if (/masters/.test(n)) return "Masters";
  return null;
}

// has_results e a CONTAGEM de resultados. "tem resultados" = numero > 0.
function temResultados(c: IjfCompetition): boolean {
  const n = parseInt(String(c.has_results ?? "0"), 10);
  return !isNaN(n) && n > 0;
}

// So seniores: a competicao tem de incluir "sen" em ages (e o nome ja filtra
// junior/cadet). Tolerante: se ages vier vazio/ausente, nao exclui por aqui.
function ehSenior(c: IjfCompetition): boolean {
  if (!Array.isArray(c.ages) || c.ages.length === 0) return true;
  return c.ages.some((a) => String(a).toLowerCase().includes("sen"));
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
  resultados: number;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const key = searchParams.get("key");
  if (!autorizado(key)) {
    return NextResponse.json({ erro: "Nao autorizado. Usa ?key=<CRON_SECRET>." }, { status: 401 });
  }

  const t0 = Date.now();
  const modo = (searchParams.get("modo") || "classicos").trim();

  // ---------------------------------------------------------------------------
  // MODO AMOSTRA — resposta crua de um ano, sem filtrar. Para inspecionar campos.
  // ---------------------------------------------------------------------------
  if (modo === "amostra") {
    const ano = parseInt(searchParams.get("ano") || "2024", 10);
    const comps = await getCompetitions(ano);
    return NextResponse.json({
      modo: "amostra",
      ano,
      total: comps.length,
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
  // MODO CLASSICOS — varre 2015..2025, filtra e ordena pela preferencia.
  // ---------------------------------------------------------------------------
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
      if (usados.has(id)) continue;        // ja esta no calendario — nao repetir
      if (!temResultados(c)) continue;     // sem resultados nao serve como classico
      if (!ehSenior(c)) continue;          // so seniores
      const tipo = classificar(c.name || "");
      if (!tipo) continue;                 // nao e um dos tipos preferidos

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
        resultados: parseInt(String(c.has_results ?? "0"), 10) || 0,
      });
    }
  }

  // Ordena: 1o pela preferencia de tipo, depois pela data (mais recente primeiro).
  linhas.sort((a, b) => (a.prioridade - b.prioridade) || b.data.localeCompare(a.data));

  // Agrupa por tipo, para ser facil escolher e mesclar recentes/antigas.
  const porTipo: Record<string, LinhaClassico[]> = {};
  for (const l of linhas) (porTipo[l.tipo] ||= []).push(l);

  const contagem: Record<string, number> = {};
  for (const t of Object.keys(porTipo)) contagem[t] = porTipo[t].length;

  return NextResponse.json({
    modo: "classicos",
    anos: `${ANO_INICIO}-${ANO_FIM}`,
    anos_sem_resposta: anosFalhados,
    total_encontradas: linhas.length,
    contagem_por_tipo: contagem,
    por_tipo: porTipo,
    lista_ordenada: linhas,
    ms_total: Date.now() - t0,
  });
}
