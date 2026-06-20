// app/api/chave-atletas/route.ts
//
// CHAVE DE ATLETAS (Pro Max) — devolve a chave de uma categoria já DESENHADA.
//
// FONTE DO MOVIMENTO (corrigido):
//   O motor da chave precisa de VITÓRIAS/DERROTAS por atleta. Para competições
//   como o Ulaanbaatar (3149), o JudoBase NÃO expõe as lutas pelo agregado da
//   competição (competition.contests vem vazio) e a tabela resultados_atletas
//   ficava parada nos primeiros combates. MAS o JudoBase TEM os dados pela via
//   POR ATLETA (competitor.contests) — cada luta traz o id_winner. É daí que
//   contamos vitórias e derrotas, AO VIVO. (Mesma via que a /api/resultados usa.)
//
//   Estratégia: por cada atleta da moldura, busca competitor.contests, filtra
//   pela competição e conta vitórias (id_winner == atleta) e derrotas (houve
//   vencedor e não foi ele). Se o JudoBase falhar para alguém, cai para a
//   resultados_atletas (a tabela) como rede de segurança.
//
//   BÓNUS: na mesma passagem somamos pontos Ippon e ações (ippon/waza/yuko/shido)
//   por atleta — devolvidos em `infos` para a página mostrar no cartão.
//
// MOLDURA: tabela chave_atletas (pools A/B/C/D + byes). Devolvida em `moldura`
// para a página reconstruir os ramos da árvore.
//
// Uso: GET /api/chave-atletas?comp=3149&cat=-73
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getCompetitorContests, scoreContestForPerson, contestActions } from "@/lib/ijf";
import {
  desenharChave,
  type MolduraCategoria,
  type ResultadosPorId,
  type IdentidadesPorId,
  type PoolId,
} from "@/lib/motorChave";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const n = (v: unknown): number => { const x = parseInt(String(v ?? "0"), 10); return isNaN(x) ? 0 : x; };

type Acoes = { ippon: number; waza: number; yuko: number; shido_provocado: number; ippon_sof: number; waza_sof: number; yuko_sof: number; shido_sof: number };
function acoesVazias(): Acoes {
  return { ippon: 0, waza: 0, yuko: 0, shido_provocado: 0, ippon_sof: 0, waza_sof: 0, yuko_sof: 0, shido_sof: 0 };
}

// Vitórias/derrotas + pontos + ações de UM atleta, ao vivo, do JudoBase.
async function vivoDoAtleta(idPerson: string, comp: string): Promise<{
  vitorias: number; derrotas: number; nLutas: number; pontos: number; acoes: Acoes;
} | null> {
  const todas = await getCompetitorContests(idPerson);
  if (!todas) return null; // JudoBase falhou -> deixa o chamador usar a rede de segurança
  const desta = todas.filter((f) => String(f.id_competition) === comp);
  let vitorias = 0, derrotas = 0, pontos = 0;
  const acoes = acoesVazias();
  for (const f of desta) {
    const azul = String(f.id_person_blue ?? "");
    const branco = String(f.id_person_white ?? "");
    if (azul !== idPerson && branco !== idPerson) continue;
    const venc = String(f.id_winner ?? "");
    if (venc === idPerson) vitorias++;
    else if (venc) derrotas++; // houve vencedor e não foi ele
    pontos += scoreContestForPerson(f, idPerson);
    // ações de valor fixo (já trata o ippon fantasma do hansoku)
    const lado: "b" | "w" | null = azul === idPerson ? "b" : branco === idPerson ? "w" : null;
    if (lado) {
      for (const act of contestActions(f, lado)) {
        if (act === "ippon_feito") acoes.ippon++;
        else if (act === "waza_ari_feito") acoes.waza++;
        else if (act === "yuko_feito") acoes.yuko++;
        else if (act === "ippon_sofrido") acoes.ippon_sof++;
        else if (act === "waza_ari_sofrido") acoes.waza_sof++;
        else if (act === "yuko_sofrido") acoes.yuko_sof++;
      }
      const opp = lado === "b" ? "w" : "b";
      const ff = f as unknown as Record<string, unknown>;
      acoes.shido_provocado += n(ff[`penalty_${opp}`]);
      acoes.shido_sof += n(ff[`penalty_${lado}`]);
    }
  }
  return { vitorias, derrotas, nLutas: desta.length, pontos: Math.round(pontos * 10) / 10, acoes };
}

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

  // Normaliza a moldura (4 pools como arrays de string).
  const poolsRaw = linha.pools as Record<string, unknown>;
  const pools = {} as Record<PoolId, string[]>;
  for (const p of ["A", "B", "C", "D"] as PoolId[]) {
    const arr = Array.isArray(poolsRaw?.[p]) ? (poolsRaw[p] as unknown[]) : [];
    pools[p] = arr.map((x) => String(x));
  }
  // Byes opcionais.
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

  const todosIds: string[] = [];
  for (const p of ["A", "B", "C", "D"] as PoolId[]) for (const id of pools[p]) todosIds.push(id);
  const setIds = new Set(todosIds);

  // 2) MOVIMENTO AO VIVO do JudoBase (por atleta). Conta vitórias/derrotas e
  //    recolhe pontos + ações para o cartão. Em lotes, para não disparar 40
  //    chamadas de uma vez.
  const resultados: ResultadosPorId = {};
  const infos: Record<string, { pontos: number; nLutas: number; acoes: Acoes }> = {};
  const semVivo: string[] = []; // atletas onde o JudoBase falhou -> rede de segurança

  const LOTE = 8;
  for (let i = 0; i < todosIds.length; i += LOTE) {
    const lote = todosIds.slice(i, i + LOTE);
    const res = await Promise.all(lote.map(async (id) => ({ id, v: await vivoDoAtleta(id, comp).catch(() => null) })));
    for (const { id, v } of res) {
      if (v === null) { semVivo.push(id); continue; }
      resultados[id] = { vitorias: v.vitorias, derrotas: v.derrotas };
      infos[id] = { pontos: v.pontos, nLutas: v.nLutas, acoes: v.acoes };
    }
  }

  // 3) Rede de segurança: para quem o JudoBase falhou, usa a tabela resultados_atletas.
  if (semVivo.length > 0) {
    const { data: tab } = await supabaseAdmin
      .from("resultados_atletas")
      .select("id_person, vitorias, derrotas")
      .eq("id_competicao", comp)
      .eq("weight_category", cat);
    for (const r of tab || []) {
      const id = String(r.id_person);
      if (!setIds.has(id) || resultados[id]) continue;
      resultados[id] = { vitorias: Number(r.vitorias) || 0, derrotas: Number(r.derrotas) || 0 };
    }
  }

  // 4) IDENTIDADES (nome/país) de TODOS os inscritos, do cache de atletas.
  const identidades: IdentidadesPorId = {};
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
      if (!id || !setIds.has(id)) continue;
      identidades[id] = {
        nome: a?.name ? String(a.name) : undefined,
        pais: a?.countryIso ? String(a.countryIso) : undefined,
      };
    }
  } catch { /* segue com o que houver */ }
  // Completa nome/país em falta com a resultados_atletas (nome/country_code de quem lutou).
  const faltamNome = todosIds.filter((id) => !identidades[id]?.nome);
  if (faltamNome.length > 0) {
    const { data: res } = await supabaseAdmin
      .from("resultados_atletas")
      .select("id_person, nome, country_code")
      .eq("id_competicao", comp)
      .eq("weight_category", cat);
    for (const r of res || []) {
      const id = String(r.id_person);
      if (!setIds.has(id)) continue;
      const atual = identidades[id] || {};
      if (!atual.nome && r.nome) atual.nome = String(r.nome);
      if (!atual.pais && r.country_code) atual.pais = String(r.country_code);
      identidades[id] = atual;
    }
  }

  // 5) Corre o motor.
  const chave = desenharChave(moldura, resultados, identidades);

  return NextResponse.json({
    ok: true,
    comp,
    cat,
    genero: linha.genero ? String(linha.genero) : null,
    existeMoldura: true,
    chave,
    moldura: { pools, byes: byes ?? null },
    // pontos/ações por atleta para o cartão (Pro Max "todo o informativo").
    infos,
    fonte: semVivo.length === 0 ? "judobase_ao_vivo" : (Object.keys(infos).length ? "misto" : "tabela"),
    atualizado_em: new Date().toISOString(),
  });
}
