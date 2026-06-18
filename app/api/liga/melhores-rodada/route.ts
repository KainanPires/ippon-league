// app/api/liga/melhores-rodada/route.ts
//
// MELHORES DA RODADA (servidor). Serve o(s) vencedor(es) da rodada mais recente
// que já foi congelada (tabela melhores_rodada, preenchida pelo cron).
//
// GET ?tipo=mundial|continental & user_id=<uuid?>
//   • mundial     -> o nº1 do mundo (certificado combinado Mundial + continente).
//   • continental -> o nº1 do continente do utilizador. Se esse continente for o
//                    do nº1 do mundo, devolve o combinado (esse jogador "leva"
//                    também o título continental).
// Devolve sempre a competição MAIS RECENTE com dados (não depende da rodada atual,
// que pode ainda não estar congelada).
//
// Resposta:
//   {
//     ok, comp, nomeComp,
//     melhores: [{ user_id, nome_time, escudo, pontos, escopo, continente, combinado, n_participantes, rotulo }],
//     souVencedor
//   }
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NOME_CONTINENTE, type Continente } from "@/lib/continentes";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface LinhaMelhor {
  user_id: string;
  nome_time: string;
  escudo: unknown;
  pontos: number;
  escopo: string;
  continente: string;
  combinado: boolean;
  n_participantes: number;
}

function rotuloDe(l: LinhaMelhor): string {
  if (l.escopo === "mundial") {
    return l.continente ? `Mundial + ${nomeCont(l.continente)}` : "Mundial";
  }
  return nomeCont(l.continente);
}
function nomeCont(c: string): string {
  return NOME_CONTINENTE[c as Continente] ?? c;
}

export async function GET(req: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ ok: false, erro: "Servidor sem ligação." }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const tipo = (searchParams.get("tipo") || "").trim();
  const user_id = (searchParams.get("user_id") || "").trim();

  if (tipo !== "mundial" && tipo !== "continental") {
    return NextResponse.json({ ok: false, erro: "tipo deve ser 'mundial' ou 'continental'." }, { status: 400 });
  }

  // 1) Competição mais recente com vencedores registados.
  const { data: ultima } = await supabaseAdmin
    .from("melhores_rodada")
    .select("id_competicao, nome_competicao, criada_em")
    .order("criada_em", { ascending: false })
    .limit(1);

  if (!ultima || ultima.length === 0) {
    return NextResponse.json({ ok: true, comp: null, nomeComp: null, melhores: [], souVencedor: false });
  }
  const comp = String(ultima[0].id_competicao);
  const nomeComp = String(ultima[0].nome_competicao || "");

  // 2) Todas as linhas dessa competição.
  const { data: linhasRaw } = await supabaseAdmin
    .from("melhores_rodada")
    .select("user_id, nome_time, escudo, pontos, escopo, continente, combinado, n_participantes")
    .eq("id_competicao", comp);
  const linhas: LinhaMelhor[] = (linhasRaw || []).map((r) => ({
    user_id: String(r.user_id),
    nome_time: String(r.nome_time || "Equipa"),
    escudo: r.escudo ?? null,
    pontos: Number(r.pontos ?? 0),
    escopo: String(r.escopo || ""),
    continente: String(r.continente || ""),
    combinado: !!r.combinado,
    n_participantes: Number(r.n_participantes ?? 0),
  }));

  let selecionadas: LinhaMelhor[] = [];

  if (tipo === "mundial") {
    selecionadas = linhas.filter((l) => l.escopo === "mundial");
  } else {
    // Continental: precisa do continente de quem pergunta.
    let continente: string | null = null;
    if (user_id) {
      const { data: eu } = await supabaseAdmin.from("users").select("continente").eq("id", user_id).maybeSingle();
      continente = eu?.continente ? String(eu.continente) : null;
    }
    if (!continente) {
      return NextResponse.json({ ok: true, comp, nomeComp, melhores: [], souVencedor: false, semContinente: true });
    }
    // Vencedor continental do MEU continente: linha continental desse continente;
    // se não houver, o combinado mundial cujo continente é o meu (o nº1 do mundo
    // "leva" o título do próprio continente).
    selecionadas = linhas.filter((l) => l.escopo === "continental" && l.continente === continente);
    if (selecionadas.length === 0) {
      selecionadas = linhas.filter((l) => l.escopo === "mundial" && l.continente === continente);
    }
  }

  const melhores = selecionadas.map((l) => ({ ...l, rotulo: rotuloDe(l) }));
  const souVencedor = !!user_id && melhores.some((m) => m.user_id === user_id);

  return NextResponse.json({ ok: true, comp, nomeComp, melhores, souVencedor });
}
