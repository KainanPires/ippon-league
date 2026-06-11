// app/api/sondar/route.ts
//
// FERRAMENTA DE INVESTIGAÇÃO (temporária) — descobrir endpoints da data.ijf.org.
//
// A data.ijf.org/api/get_json aceita "params[action]=<nome>". Sabemos algumas
// ações (competition.contests, etc.), mas pode haver ações de AO VIVO que ainda
// não usamos. Esta rota testa uma lista de nomes prováveis e diz-nos quais
// respondem (e uma amostra do que devolvem), para mapearmos a fonte.
//
// Uso:
//   /api/sondar                 -> testa a lista padrão (sem competição)
//   /api/sondar?comp=3161       -> testa as ações passando id_competition
//   /api/sondar?comp=3295       -> idem, para o Tahiti
//   /api/sondar?acoes=a,b,c     -> testa nomes à escolha (separados por vírgula)
//
// Remover esta rota depois da investigação.
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const IJF = "https://data.ijf.org/api/get_json";
const TIMEOUT_MS = 12000;

// Nomes de ação prováveis para dados ao vivo / estado atual / calendário de lutas.
const ACOES_PADRAO = [
  // ao vivo / estado atual
  "competition.live",
  "competition.current",
  "competition.live_contests",
  "competition.contests_live",
  "competition.now",
  "competition.fights_live",
  "competition.results_live",
  "competition.mat",
  "competition.mats",
  "competition.schedule",
  "competition.timetable",
  "competition.draw",
  "contest.live",
  "contest.current",
  "contests.live",
  "live.competition",
  "live.contests",
  "live.get",
  "draw.current",
  "draw.live",
  // já conhecidas (controlo — devem responder)
  "competition.contests",
  "competition.info",
];

function buildUrl(action: string, params: Record<string, string>): string {
  const qs = Object.entries(params)
    .map(([k, v]) => `&params%5B${k}%5D=${encodeURIComponent(v)}`)
    .join("");
  return `${IJF}?access_token=&params%5Baction%5D=${action}${qs}`;
}

async function sonda(action: string, params: Record<string, string>) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(buildUrl(action, params), {
      cache: "no-store",
      signal: ctrl.signal,
      headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 (IpponLeague)" },
    });
    const text = await res.text();
    clearTimeout(timer);

    const desconhecida = text.includes("unknown action");
    let formato = "texto";
    let amostra: unknown = text.slice(0, 300);
    let chaves: string[] | undefined;
    let n: number | undefined;

    if (!desconhecida) {
      try {
        const json = JSON.parse(text);
        if (Array.isArray(json)) {
          formato = "array";
          n = json.length;
          amostra = json.slice(0, 1);
          if (json[0] && typeof json[0] === "object") chaves = Object.keys(json[0]);
        } else if (json && typeof json === "object") {
          formato = "objeto";
          chaves = Object.keys(json as Record<string, unknown>);
          amostra = undefined;
        }
      } catch {
        formato = "texto-nao-json";
      }
    }

    return {
      acao: action,
      existe: !desconhecida,
      http: res.status,
      formato,
      n,
      chaves,
      amostra: desconhecida ? "(unknown action)" : amostra,
    };
  } catch (e) {
    clearTimeout(timer);
    return { acao: action, existe: false, erro: String(e) };
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const comp = searchParams.get("comp") ?? "";
  const acoesParam = searchParams.get("acoes");
  const acoes = acoesParam ? acoesParam.split(",").map((s) => s.trim()).filter(Boolean) : ACOES_PADRAO;

  // Se houver comp, passamos id_competition (a maioria das ações precisa dele).
  const params: Record<string, string> = comp ? { id_competition: comp } : {};

  // Testa em paralelo (com um limite suave para não martelar a fonte).
  const resultados = [];
  for (const a of acoes) {
    resultados.push(await sonda(a, params));
  }

  const existentes = resultados.filter((r) => r.existe).map((r) => r.acao);

  return NextResponse.json({
    comp: comp || "(nenhuma)",
    testadas: acoes.length,
    existem: existentes,
    detalhe: resultados,
  });
}
