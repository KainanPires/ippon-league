// app/api/resumo-rodada/route.ts
//
// RESUMO DA RODADA de um utilizador (#7). Lê dos dados congelados:
//   - resultados_rodada -> os pontos do utilizador, ganho de património, melhor/pior atleta
//   - resultados_atletas -> nomes dos atletas (melhor/pior) e contexto
//   - users -> património atual
// Calcula a média geral (de todos os utilizadores da competição) e a posição
// do utilizador na rodada. Tudo a partir das tabelas — sem chamar o JudoBase.
//
// Uso: /api/resumo-rodada?comp=3295&user=<uuid>
//      /api/resumo-rodada?user=<uuid>           (usa a última competição congelada)

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { CALENDARIO_2026 } from "@/lib/calendario";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function nomeCompeticao(idComp: string): string {
  const s = CALENDARIO_2026.find((c) => c.idCompeticao === idComp);
  return s ? s.nome : `Competição ${idComp}`;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const user = (searchParams.get("user") || "").trim();
  let comp = (searchParams.get("comp") || "").trim();

  if (!supabaseAdmin || !user) {
    return NextResponse.json({ tem_resumo: false });
  }

  // Sem comp: última competição congelada (a mais recente em resultados_rodada).
  if (!comp) {
    const { data: ultima } = await supabaseAdmin
      .from("resultados_rodada")
      .select("id_competicao, congelado_em")
      .order("congelado_em", { ascending: false })
      .limit(1)
      .maybeSingle();
    comp = ultima ? String(ultima.id_competicao) : "";
  }
  if (!comp) {
    return NextResponse.json({ tem_resumo: false });
  }

  // Todas as linhas da competição (para média + posição).
  const { data: todas } = await supabaseAdmin
    .from("resultados_rodada")
    .select("user_id, pontos_rodada, ganho_patrimonio, melhor_atleta, pior_atleta")
    .eq("id_competicao", comp);
  const lista = todas || [];

  // A minha linha.
  const minha = lista.find((r) => String(r.user_id) === user);
  if (!minha) {
    return NextResponse.json({ tem_resumo: false, comp });
  }

  // Média geral e posição na rodada.
  const pontosTodos = lista.map((r) => Number(r.pontos_rodada));
  const total = pontosTodos.length;
  const media = total > 0 ? Math.round((pontosTodos.reduce((s, x) => s + x, 0) / total) * 10) / 10 : 0;
  const meusPontos = Number(minha.pontos_rodada);
  const melhoresQueEu = lista.filter((r) => Number(r.pontos_rodada) > meusPontos).length;
  const posicao = melhoresQueEu + 1;

  // Nomes do melhor e pior atleta (de resultados_atletas).
  const idsAtletas = [minha.melhor_atleta, minha.pior_atleta].filter(Boolean) as string[];
  const nomePorId = new Map<string, { nome: string; pontos: number }>();
  if (idsAtletas.length > 0) {
    const { data: ats } = await supabaseAdmin
      .from("resultados_atletas")
      .select("id_person, nome, pontos")
      .eq("id_competicao", comp)
      .in("id_person", idsAtletas);
    for (const a of ats || []) nomePorId.set(String(a.id_person), { nome: a.nome || "—", pontos: Number(a.pontos) });
  }

  // Património atual (da tabela users).
  const { data: u } = await supabaseAdmin
    .from("users")
    .select("patrimony_jc, name")
    .eq("id", user)
    .maybeSingle();

  const melhor = minha.melhor_atleta ? nomePorId.get(String(minha.melhor_atleta)) || null : null;
  const pior = minha.pior_atleta ? nomePorId.get(String(minha.pior_atleta)) || null : null;

  return NextResponse.json({
    tem_resumo: true,
    comp,
    nome: nomeCompeticao(comp),
    pontos: Math.round(meusPontos * 10) / 10,
    ganho_patrimonio: Math.round(Number(minha.ganho_patrimonio) * 10) / 10,
    patrimonio: u ? Math.round(Number(u.patrimony_jc) * 10) / 10 : null,
    posicao,
    total_jogadores: total,
    media,
    acima_da_media: meusPontos >= media,
    melhor: melhor ? { nome: melhor.nome, pontos: Math.round(melhor.pontos * 10) / 10 } : null,
    pior: pior ? { nome: pior.nome, pontos: Math.round(pior.pontos * 10) / 10 } : null,
  });
}
