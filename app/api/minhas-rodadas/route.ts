// app/api/minhas-rodadas/route.ts
//
// GALERIA DE RESUMOS — lista TODAS as rodadas (competições) onde o utilizador
// tem resultado congelado (resultados_rodada), da mais recente para a mais antiga.
// Cada item traz o essencial para a lista; o detalhe completo de cada rodada usa
// /api/resumo-rodada (comp+user) ao tocar.
//
// Uso: /api/minhas-rodadas?user=<uuid>

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

  if (!supabaseAdmin || !user) {
    return NextResponse.json({ rodadas: [] });
  }

  // Todas as rodadas do utilizador, mais recente primeiro.
  const { data: minhas } = await supabaseAdmin
    .from("resultados_rodada")
    .select("id_competicao, pontos_rodada, ganho_patrimonio, congelado_em")
    .eq("user_id", user)
    .order("congelado_em", { ascending: false });
  const lista = minhas || [];

  // Para a posição de cada rodada, precisamos de comparar com os outros dessa comp.
  // Buscamos todas as linhas das competições envolvidas de uma vez.
  const comps = Array.from(new Set(lista.map((r) => String(r.id_competicao))));
  const posicaoPorComp = new Map<string, { posicao: number; total: number }>();
  if (comps.length > 0) {
    const { data: todas } = await supabaseAdmin
      .from("resultados_rodada")
      .select("id_competicao, user_id, pontos_rodada")
      .in("id_competicao", comps);
    const porComp = new Map<string, { user_id: string; pontos: number }[]>();
    for (const r of todas || []) {
      const c = String(r.id_competicao);
      if (!porComp.has(c)) porComp.set(c, []);
      porComp.get(c)!.push({ user_id: String(r.user_id), pontos: Number(r.pontos_rodada) });
    }
    for (const [c, arr] of porComp) {
      const meu = arr.find((x) => x.user_id === user);
      if (!meu) continue;
      const melhores = arr.filter((x) => x.pontos > meu.pontos).length;
      posicaoPorComp.set(c, { posicao: melhores + 1, total: arr.length });
    }
  }

  const rodadas = lista.map((r) => {
    const c = String(r.id_competicao);
    const pos = posicaoPorComp.get(c);
    return {
      comp: c,
      nome: nomeCompeticao(c),
      pontos: Math.round(Number(r.pontos_rodada) * 10) / 10,
      ganho_patrimonio: Math.round(Number(r.ganho_patrimonio) * 10) / 10,
      posicao: pos ? pos.posicao : null,
      total_jogadores: pos ? pos.total : null,
      data: r.congelado_em ? String(r.congelado_em).slice(0, 10) : null,
    };
  });

  return NextResponse.json({ rodadas, total: rodadas.length });
}
