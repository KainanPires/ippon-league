// app/api/chave-atletas/route.ts
//
// CHAVE DE ATLETAS (Pro Max) — devolve a chave de uma categoria já DESENHADA.
//
// Junta as duas fontes:
//   - MOLDURA: tabela chave_atletas (pools A/B/C/D com id_person por ordem + byes)
//   - MOVIMENTO: tabela resultados_atletas (vitorias/derrotas por atleta, ao vivo)
// e corre o motor (lib/motorChave) para devolver a chave pronta a desenhar.
//
// Uso:
//   GET /api/chave-atletas?comp=3149&cat=-73
//
// Devolve: { ok, comp, cat, genero, existeMoldura, chave, moldura, atualizado_em }
// `moldura` = { pools, byes } é usado pela página para reconstruir os ramos da
// árvore (a mesma construção que o motor usa). Se não houver moldura para a
// categoria, existeMoldura=false (a página mostra "chave ainda não disponível").
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
      ok: true, comp, cat, genero: null, existeMoldura: false, chave: null, moldura: null,
      atualizado_em: new Date().toISOString(),
    });
  }
  // Normaliza a moldura (garante 4 pools como arrays de string).
  const poolsRaw = linha.pools as Record<string, unknown>;
  const pools = {} as Record<PoolId, string[]>;
  for (const p of ["A", "B", "C", "D"] as PoolId[]) {
    const arr = Array.isArray(poolsRaw?.[p]) ? (poolsRaw[p] as unknown[]) : [];
    pools[p] = arr.map((x) => String(x));
  }
  // Byes opcionais (se a moldura os tiver).
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
  // 2) Resultados (vitorias/derrotas) + identidades (nome/país) desta categoria.
  const todosIds = new Set<string>();
  for (const p of ["A", "B", "C", "D"] as PoolId[]) for (const id of pools[p]) todosIds.add(id);
  const { data: res } = await supabaseAdmin
    .from("resultados_atletas")
    .select("id_person, nome, country_code, vitorias, derrotas")
    .eq("id_competicao", comp)
    .eq("weight_category", cat);
  const resultados: ResultadosPorId = {};
  const identidades: IdentidadesPorId = {};
  for (const r of res || []) {
    const id = String(r.id_person);
    resultados[id] = { vitorias: Number(r.vitorias) || 0, derrotas: Number(r.derrotas) || 0 };
    identidades[id] = { nome: r.nome ? String(r.nome) : undefined, pais: r.country_code ? String(r.country_code) : undefined };
  }

  // 2b) Nomes de TODOS os inscritos (não só de quem já lutou). A resultados_atletas
  //     só tem linha para quem entrou em ação; os byes e os que ainda não lutaram
  //     ficavam sem nome. O atletas_cache tem a lista completa (id, nome, país).
  //     Os nomes da resultados_atletas têm prioridade; o cache só preenche o resto.
  try {
    const { data: cacheRow } = await supabaseAdmin
      .from("atletas_cache")
      .select("atletas")
      .eq("id_competition", comp)
      .maybeSingle();
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
  } catch {
    // segue com os nomes que já houver
  }

  // 3) Corre o motor.
  const chave = desenharChave(moldura, resultados, identidades);
  return NextResponse.json({
    ok: true,
    comp,
    cat,
    genero: linha.genero ? String(linha.genero) : null,
    existeMoldura: true,
    chave,
    // moldura para a página reconstruir os ramos (mesma construção do motor).
    moldura: { pools, byes: byes ?? null },
    atualizado_em: new Date().toISOString(),
  });
}
