// app/api/sondar-atleta/route.ts
//
// FERRAMENTA DE INVESTIGAÇÃO (temporária) — descobrir o que a API do JudoBase
// dá sobre ATLETAS, para construir a análise profunda do Pro:
//   - perfil do atleta (competitor.info)
//   - histórico de lutas do atleta (competitor.contests)  ← a chave de tudo
//   - chaveamento da competição (competition.draw)
//   - e testa nomes prováveis para head-to-head / histórico por competição
//
// Uso:
//   /api/sondar-atleta?person=ID_DO_ATLETA          -> perfil + histórico do atleta
//   /api/sondar-atleta?person=ID&comp=3295          -> + chaveamento dessa competição
//   /api/sondar-atleta?person=ID&extra=a,b,c        -> testa também estes nomes
//
// Como obter um ID de atleta: abre /api/atletas?id=3295 (ou a competição atual),
// e copia um "id" de um atleta da lista. Esse id é o id_person do JudoBase.
//
// Remover esta rota depois da investigação.
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const IJF = "https://data.ijf.org/api/get_json";
const TIMEOUT_MS = 12000;

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
    let amostra: unknown = text.slice(0, 400);
    let chaves: string[] | undefined;
    let n: number | undefined;

    if (!desconhecida) {
      try {
        const json = JSON.parse(text);
        if (Array.isArray(json)) {
          formato = "array";
          n = json.length;
          amostra = json.slice(0, 2);
          if (json[0] && typeof json[0] === "object") chaves = Object.keys(json[0]);
        } else if (json && typeof json === "object") {
          formato = "objeto";
          chaves = Object.keys(json as Record<string, unknown>);
          // Se o objeto tiver um campo "contests" (lista de lutas), mostra detalhe.
          const obj = json as Record<string, unknown>;
          if (Array.isArray(obj.contests)) {
            const lutas = obj.contests as unknown[];
            amostra = {
              total_contests: lutas.length,
              primeira_luta: lutas[0],
              chaves_de_uma_luta: lutas[0] && typeof lutas[0] === "object" ? Object.keys(lutas[0] as object) : undefined,
            };
          } else {
            amostra = obj;
          }
        }
      } catch {
        formato = "texto-nao-json";
      }
    }

    return { acao: action, params, existe: !desconhecida, http: res.status, formato, n, chaves, amostra: desconhecida ? "(unknown action)" : amostra };
  } catch (e) {
    clearTimeout(timer);
    return { acao: action, params, existe: false, erro: String(e) };
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const person = searchParams.get("person") ?? "";
  const comp = searchParams.get("comp") ?? "";
  const extraParam = searchParams.get("extra");

  if (!person) {
    return NextResponse.json({
      erro: "Falta o parâmetro 'person' (id_person de um atleta).",
      como: "Abre /api/atletas?id=3295 (ou a competição atual), copia o 'id' de um atleta, e usa /api/sondar-atleta?person=ESSE_ID",
    });
  }

  const testes: { acao: string; params: Record<string, string> }[] = [
    // 1) Perfil do atleta — quantas medalhas, ranking, dados.
    { acao: "competitor.info", params: { id_person: person } },
    // 2) HISTÓRICO de lutas do atleta — a chave de tudo (competições, adversários, vitórias).
    { acao: "competitor.contests", params: { id_person: person } },
    // 3) Nomes prováveis para mais dados do atleta (descobrir se existem).
    { acao: "competitor.profile", params: { id_person: person } },
    { acao: "competitor.results", params: { id_person: person } },
    { acao: "competitor.medals", params: { id_person: person } },
    { acao: "competitor.statistics", params: { id_person: person } },
    { acao: "competitor.best_results", params: { id_person: person } },
    { acao: "person.info", params: { id_person: person } },
    { acao: "person.contests", params: { id_person: person } },
  ];

  // 4) Se houver competição, testa o chaveamento (draw) e variantes.
  if (comp) {
    testes.push({ acao: "competition.draw", params: { id_competition: comp } });
    testes.push({ acao: "competition.draws", params: { id_competition: comp } });
    testes.push({ acao: "draw.info", params: { id_competition: comp } });
    testes.push({ acao: "competition.brackets", params: { id_competition: comp } });
  }

  // 5) Nomes extra à escolha (se passados).
  if (extraParam) {
    for (const a of extraParam.split(",").map((s) => s.trim()).filter(Boolean)) {
      testes.push({ acao: a, params: comp ? { id_person: person, id_competition: comp } : { id_person: person } });
    }
  }

  const resultados = [];
  for (const t of testes) resultados.push(await sonda(t.acao, t.params));

  const existem = resultados.filter((r) => r.existe).map((r) => r.acao);

  return NextResponse.json({
    person,
    comp: comp || "(nenhuma)",
    existem,
    nota: "Olha sobretudo competitor.contests — se trouxer a lista de lutas com id_competition, id_winner e os dois id_person, dá para reconstruir histórico, confrontos diretos e participações.",
    detalhe: resultados,
  });
}
