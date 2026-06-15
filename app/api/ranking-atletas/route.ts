// app/api/ranking-atletas/route.ts
//
// RANKING DE ATLETAS CONGELADO — lê da tabela resultados_atletas.
// É o que mantém o ranking visível ENTRE competições (#1): mesmo dias depois de
// uma competição terminar, o seu ranking fica disponível até à próxima ser
// congelada. Não calcula nada nem chama o JudoBase — lê a tabela já pronta.
//
// A página de atletas usa esta rota quando NÃO há competição a decorrer. Durante
// o evento, a página continua a usar o cálculo ao vivo (resultados por atleta).
//
// Uso:
//   /api/ranking-atletas?comp=3295  -> ranking dessa competição
//   /api/ranking-atletas            -> a ÚLTIMA competição congelada (mais recente)

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { CALENDARIO_2026 } from "@/lib/calendario";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Nome legível de uma competição a partir do calendário.
function nomeCompeticao(idComp: string): string {
  const s = CALENDARIO_2026.find((c) => c.idCompeticao === idComp);
  return s ? s.nome : `Competição ${idComp}`;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  let comp = (searchParams.get("comp") || "").trim();

  if (!supabaseAdmin) {
    return NextResponse.json({ comp: null, nome: null, tem_resultados: false, total: 0, atletas: [] });
  }

  // Sem comp: descobre a ÚLTIMA competição congelada (congelado_em mais recente).
  if (!comp) {
    const { data: ultima } = await supabaseAdmin
      .from("resultados_atletas")
      .select("id_competicao, congelado_em")
      .order("congelado_em", { ascending: false })
      .limit(1)
      .maybeSingle();
    comp = ultima ? String(ultima.id_competicao) : "";
  }

  if (!comp) {
    return NextResponse.json({ comp: null, nome: null, tem_resultados: false, total: 0, atletas: [] });
  }

  // Lê o ranking congelado dessa competição, ordenado por pontos.
  const { data: linhas } = await supabaseAdmin
    .from("resultados_atletas")
    .select("id_person, nome, country_code, weight_category, gender, pontos, n_lutas, vitorias, derrotas, variacao_jc")
    .eq("id_competicao", comp)
    .order("pontos", { ascending: false });

  const lista = linhas || [];

  // Atribui posição com empates a partilhar lugar (1,2,2,4...).
  const atletas = lista.map((r, i) => {
    const melhores = lista.filter((o) => Number(o.pontos) > Number(r.pontos)).length;
    return {
      id: String(r.id_person),
      nome: r.nome || `Atleta ${r.id_person}`,
      countryIso: r.country_code || "—",
      category: r.weight_category || "",
      gender: (r.gender || "") as "M" | "F" | "",
      pontos: Math.round(Number(r.pontos) * 10) / 10,
      n_lutas: Number(r.n_lutas) || 0,
      vitorias: Number(r.vitorias) || 0,
      derrotas: Number(r.derrotas) || 0,
      variacao_jc: Math.round(Number(r.variacao_jc) * 10) / 10,
      posicao: melhores + 1,
    };
  });

  return NextResponse.json({
    comp,
    nome: nomeCompeticao(comp),
    tem_resultados: atletas.length > 0,
    total: atletas.length,
    atletas,
  });
}
