// app/api/chave/route.ts
//
// CHAVE DOS ATLETAS (Pro Max) — lê o quadro REAL de uma competição direto do
// JudoBase (competition.contests) e devolve-o organizado por ZONAS e FASES,
// pronto a desenhar. NÃO há inserção manual: a chave reflete os resultados
// reais e atualiza ao vivo (cada chamada vai buscar as lutas mais recentes).
//
// GET /api/chave?comp=<id_competicao>&cat=<weight>
//   comp  — id da competição no JudoBase (ex.: "3149" = Ulaanbaatar)
//   cat   — categoria pelo campo `weight` do JudoBase (ex.: "-48")
//
// Estrutura devolvida (uma categoria):
//   {
//     ok, comp, categoria, nome_competicao,
//     zonas: [ { zona: 1, lutas: [Luta...] }, ... 4 zonas ],
//     meias:  [Luta...],
//     final:  Luta | null,
//     repescagem: [Luta...],   // se existir
//     bronzes: [Luta...],
//     atualizado_em
//   }
//
// FONTE DA ESTRUTURA (descoberta nos dados reais do 3149):
//   round "4" = 1ª ronda (best 32, dentro das zonas)
//   round "3" = best 16
//   round "2" = Quarter Final (quem PERDE aqui cai ao bloco bronze/repescagem)
//   round "1"/"0" = Semi Final / Bronze / Final (distinguidos por round_name + type)
//   pool "1".."4" = zona da chave; "0" nas fases finais.
//   id_winner = vencedor; type "1" = luta de bronze.
import { NextResponse } from "next/server";
import { getCompetitionContests } from "@/lib/ijf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// O IjfContest do lib/ijf não declara todos os campos que precisamos (round,
// round_name, type, pool, weight, person_blue/white, country_short_*). Lemos de
// forma defensiva a partir de um registo genérico, sem depender do tipo.
type Bruto = Record<string, unknown>;
const s = (v: unknown): string => (v === null || v === undefined ? "" : String(v));

export interface LadoChave {
  id: string;        // id_person ("" se vazio)
  nome: string;      // "BOUKLI Shirine"
  pais: string;      // "FRA"
  vencedor: boolean; // ganhou esta luta?
}
export interface LutaChave {
  id: string;             // id_fight
  fase: string;           // "best 32" | "best 16" | "Quarter Final" | "Semi Final" | "Bronze" | "Final"
  round: number;          // 4..0 (apoio à ordenação)
  zona: number;           // 1..4 (pool); 0 nas fases finais
  ordem: number;          // fight_no (ordem cronológica)
  azul: LadoChave;
  branco: LadoChave;
  decidida: boolean;      // já há vencedor?
}

function lado(c: Bruto, cor: "blue" | "white"): LadoChave {
  const id = s(c[`id_person_${cor}`]);
  const winner = s(c["id_winner"]);
  return {
    id,
    nome: s(c[`person_${cor}`]) || "—",
    pais: s(c[`country_short_${cor}`]).toUpperCase() || "—",
    vencedor: !!id && id === winner,
  };
}

function toLuta(c: Bruto): LutaChave {
  const roundNum = parseInt(s(c["round"]), 10);
  return {
    id: s(c["id_fight"]),
    fase: s(c["round_name"]) || "—",
    round: isNaN(roundNum) ? -1 : roundNum,
    zona: parseInt(s(c["pool"]), 10) || 0,
    ordem: parseInt(s(c["fight_no"]), 10) || 0,
    azul: lado(c, "blue"),
    branco: lado(c, "white"),
    decidida: !!s(c["id_winner"]),
  };
}

// Classificação da fase a partir de round_name + type (bronze) — robusto.
function ehBronze(c: Bruto): boolean {
  return s(c["type"]) === "1" || /bronze/i.test(s(c["round_name"]));
}
function ehFinal(c: Bruto): boolean {
  return /final/i.test(s(c["round_name"])) && !/semi|quarter/i.test(s(c["round_name"]));
}
function ehSemi(c: Bruto): boolean {
  return /semi/i.test(s(c["round_name"]));
}
// Fases de ZONA: tudo o que tem pool 1..4 e não é bronze/semi/final.
function ehZona(c: Bruto): boolean {
  const zona = parseInt(s(c["pool"]), 10) || 0;
  return zona >= 1 && zona <= 4 && !ehBronze(c) && !ehSemi(c) && !ehFinal(c);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const comp = (searchParams.get("comp") || "").trim();
  const cat = (searchParams.get("cat") || "").trim();
  if (!comp || !cat) {
    return NextResponse.json({ ok: false, erro: "Faltam parâmetros comp e cat." }, { status: 400 });
  }

  let todos: unknown[];
  try {
    todos = (await getCompetitionContests(comp)) as unknown[];
  } catch {
    return NextResponse.json({ ok: false, erro: "Falha ao ler o JudoBase." }, { status: 502 });
  }

  // Filtra a categoria pedida (campo `weight`, ex.: "-48").
  const daCat = (todos as Bruto[]).filter((c) => s(c["weight"]) === cat);
  if (daCat.length === 0) {
    return NextResponse.json({
      ok: true, comp, categoria: cat, nome_competicao: "",
      zonas: [], meias: [], final: null, repescagem: [], bronzes: [],
      vazio: true, atualizado_em: new Date().toISOString(),
    });
  }

  const nomeComp = s(daCat[0]["competition_name"]);

  // Reparte as lutas pelos baldes.
  const zonasMap = new Map<number, LutaChave[]>([[1, []], [2, []], [3, []], [4, []]]);
  const meias: LutaChave[] = [];
  const bronzes: LutaChave[] = [];
  let final: LutaChave | null = null;

  for (const c of daCat) {
    const luta = toLuta(c);
    if (ehFinal(c)) {
      // Pode haver mais que uma "Final" só se o JudoBase repetir; ficamos com a
      // de maior fight_no (a verdadeira final é a última).
      if (!final || luta.ordem > final.ordem) final = luta;
    } else if (ehBronze(c)) {
      bronzes.push(luta);
    } else if (ehSemi(c)) {
      meias.push(luta);
    } else if (ehZona(c)) {
      zonasMap.get(luta.zona)!.push(luta);
    }
    // (Qualquer luta que não caia em nenhum balde é ignorada com segurança.)
  }

  // Ordena cada balde por ordem cronológica (fight_no).
  const porOrdem = (a: LutaChave, b: LutaChave) => a.ordem - b.ordem;
  const zonas = [1, 2, 3, 4].map((z) => ({ zona: z, lutas: zonasMap.get(z)!.sort(porOrdem) }));
  meias.sort(porOrdem);
  bronzes.sort(porOrdem);

  return NextResponse.json({
    ok: true,
    comp,
    categoria: cat,
    nome_competicao: nomeComp,
    zonas,
    meias,
    final,
    bronzes,
    atualizado_em: new Date().toISOString(),
  });
}
