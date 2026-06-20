// app/api/chave-atletas/route.ts
//
// CHAVE DE ATLETAS (Pro Max) — devolve a chave de uma categoria já DESENHADA.
//
// FONTE DO MOVIMENTO: a tabela resultados_atletas, que é mantida FRESCA pelo
// cron /api/chave-viva (lê o JudoBase por atleta a cada poucos minutos e grava
// vitórias/derrotas + pontos + ações). Assim a página é instantânea e ESCALA
// para milhares de visitas — o JudoBase é consultado pelo cron, não por visita.
//
// Devolve:
//   chave    -> o quadro desenhado pelo motor
//   moldura  -> { pools, byes } para a página reconstruir os ramos
//   infos    -> por atleta: { pontos, nLutas, acoes } para o cartão (Pro Max)
//
// Uso: GET /api/chave-atletas?comp=3149&cat=-73
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  desenharChave,
  type MolduraCategoria,
  type ResultadosPorId,
  type IdentidadesPorId,
  type PoolId,
} from "@/lib/motorChave";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ ok: false, erro: "Servidor sem ligação." }, { status: 500 });
  }
  const { searchParams } = new URL(req.url);
  const comp = (searchParams.get("comp") || "").trim();
  const cat = (searchParams.get("cat") || "").trim();
  if (!comp || !cat) {
    return NextResponse.json(
      { ok: false, erro: "Faltam ?comp= e ?cat=. Ex.: /api/chave-atletas?comp=3149&cat=-73" },
      { status: 400 }
    );
  }

  // 1) Moldura da categoria.
  const { data: linha, error: errMold } = await supabaseAdmin
    .from("chave_atletas")
    .select("genero, pools")
    .eq("id_competicao", comp)
    .eq("weight_category", cat)
    .maybeSingle();
  if (errMold) {
    return NextResponse.json({ ok: false, erro: "Erro a ler a moldura." }, { status: 500 });
  }
  if (!linha || !linha.pools) {
    return NextResponse.json({
      ok: true, comp, cat, genero: null, existeMoldura: false, chave: null, moldura: null, infos: {},
      atualizado_em: new Date().toISOString(),
    });
  }

  // Normaliza a moldura.
  const poolsRaw = linha.pools as Record<string, unknown>;
  const pools = {} as Record<PoolId, string[]>;
  for (const p of ["A", "B", "C", "D"] as PoolId[]) {
    const arr = Array.isArray(poolsRaw?.[p]) ? (poolsRaw[p] as unknown[]) : [];
    pools[p] = arr.map((x) => String(x));
  }
  let byes: Partial<Record<PoolId, string[]>> | undefined;
  const byesRaw = (poolsRaw?.["byes"] ?? null) as Record<string, unknown> | null;
  if (byesRaw) {
    byes = {};
    for (const p of ["A", "B", "C", "D"] as PoolId[]) {
      const arr = Array.isArray(byesRaw?.[p]) ? (byesRaw[p] as unknown[]) : [];
      if (arr.length) byes[p] = arr.map((x) => String(x));
    }
  }
  const moldura: MolduraCategoria = { pools, byes };

  const todosIds = new Set<string>();
  for (const p of ["A", "B", "C", "D"] as PoolId[]) for (const id of pools[p]) todosIds.add(id);

  // 2) Movimento + pontos + ações da TABELA (mantida fresca pelo cron).
  const { data: res } = await supabaseAdmin
    .from("resultados_atletas")
    .select("id_person, nome, country_code, vitorias, derrotas, pontos, n_lutas, vencidos, acoes")
    .eq("id_competicao", comp)
    .eq("weight_category", cat);
  const resultados: ResultadosPorId = {};
  const identidades: IdentidadesPorId = {};
  const infos: Record<string, { pontos: number; nLutas: number; acoes: unknown }> = {};
  for (const r of res || []) {
    const id = String(r.id_person);
    const venc = Array.isArray(r.vencidos) ? (r.vencidos as unknown[]).map((x) => String(x)) : [];
    resultados[id] = { vitorias: Number(r.vitorias) || 0, derrotas: Number(r.derrotas) || 0, vencidos: venc };
    identidades[id] = { nome: r.nome ? String(r.nome) : undefined, pais: r.country_code ? String(r.country_code) : undefined };
    infos[id] = { pontos: Number(r.pontos) || 0, nLutas: Number(r.n_lutas) || 0, acoes: r.acoes ?? null };
  }

  // 3) Nomes de TODOS os inscritos (cache) — para byes/quem ainda não lutou.
  try {
    const { data: cacheRow } = await supabaseAdmin
      .from("atletas_cache").select("atletas").eq("id_competition", comp).maybeSingle();
    const lista = Array.isArray(cacheRow?.atletas)
      ? (cacheRow!.atletas as Array<{ id?: unknown; name?: unknown; countryIso?: unknown }>)
      : [];
    for (const a of lista) {
      const id = a?.id != null ? String(a.id) : "";
      if (!id || !todosIds.has(id)) continue;
      const atual = identidades[id] || {};
      if (!atual.nome && a?.name) atual.nome = String(a.name);
      if (!atual.pais && a?.countryIso) atual.pais = String(a.countryIso);
      identidades[id] = atual;
    }
  } catch { /* segue com o que houver */ }

  // 4) Corre o motor.
  const chave = desenharChave(moldura, resultados, identidades);

  return NextResponse.json({
    ok: true,
    comp,
    cat,
    genero: linha.genero ? String(linha.genero) : null,
    existeMoldura: true,
    chave,
    moldura: { pools, byes: byes ?? null },
    infos,
    atualizado_em: new Date().toISOString(),
  });
}
