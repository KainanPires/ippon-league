// app/api/chave-viva/route.ts
//
// CRON AO VIVO DA CHAVE — alimenta a tabela resultados_atletas a partir do
// JudoBase, para a chave (e o resto da app) lerem dados frescos SEM bater no
// JudoBase a cada visita.
//
// O QUE FAZ:
//   1. Descobre a competição a decorrer (ou aceita ?comp= para teste).
//   2. Lê todas as molduras (chave_atletas) dessa competição -> junta os
//      id_person de todas as categorias que já têm chave.
//   3. Por cada atleta, busca competitor.contests no JudoBase, filtra pela
//      competição e calcula vitórias/derrotas + pontos Ippon + ações.
//   4. Faz upsert na resultados_atletas (sem tocar nos preços do congelamento).
//
// PORQUÊ: a página da chave passa a LER A TABELA (rápido, escala para milhares).
// O trabalho pesado (40+ chamadas ao JudoBase) acontece aqui, 1x a cada poucos
// minutos, disparado pelo cron-job.org.
//
// SEGURANÇA: protegido por ?key=  (env CHAVE_CRON_KEY).
//
// Uso:
//   GET /api/chave-viva?key=SEGREDO            -> competição a decorrer
//   GET /api/chave-viva?key=SEGREDO&comp=3149  -> competição específica (teste)
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getCompetitorContests, scoreContestForPerson, contestActions } from "@/lib/ijf";
import { focoMercado } from "@/lib/calendario";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60; // fôlego para as chamadas (Vercel Pro; no hobby é 10s)

const n = (v: unknown): number => { const x = parseInt(String(v ?? "0"), 10); return isNaN(x) ? 0 : x; };

type Acoes = { ippon: number; waza: number; yuko: number; shido_provocado: number; ippon_sof: number; waza_sof: number; yuko_sof: number; shido_sof: number };
const acoesVazias = (): Acoes => ({ ippon: 0, waza: 0, yuko: 0, shido_provocado: 0, ippon_sof: 0, waza_sof: 0, yuko_sof: 0, shido_sof: 0 });

async function vivoDoAtleta(idPerson: string, comp: string) {
  const todas = await getCompetitorContests(idPerson);
  if (!todas) return null;
  const desta = todas.filter((f) => String(f.id_competition) === comp);
  let vitorias = 0, derrotas = 0, pontos = 0;
  const vencidos: string[] = []; // ids dos adversários que ESTE atleta venceu (head-to-head)
  const acoes = acoesVazias();
  // Ações POR LUTA, para mostrar selos no cartão da chave (não a soma).
  const lutas: Array<{ adv: string; venceu: boolean; i: number; w: number; y: number; s: number }> = [];
  for (const f of desta) {
    const azul = String(f.id_person_blue ?? "");
    const branco = String(f.id_person_white ?? "");
    if (azul !== idPerson && branco !== idPerson) continue;
    const venc = String(f.id_winner ?? "");
    const adversario = azul === idPerson ? branco : azul;
    if (venc === idPerson) { vitorias++; if (adversario) vencidos.push(adversario); }
    else if (venc) derrotas++;
    pontos += scoreContestForPerson(f, idPerson);
    const lado: "b" | "w" | null = azul === idPerson ? "b" : branco === idPerson ? "w" : null;
    if (lado) {
      const desta_luta = { adv: adversario, venceu: venc === idPerson, i: 0, w: 0, y: 0, s: 0 };
      for (const act of contestActions(f, lado)) {
        if (act === "ippon_feito") { acoes.ippon++; desta_luta.i++; }
        else if (act === "waza_ari_feito") { acoes.waza++; desta_luta.w++; }
        else if (act === "yuko_feito") { acoes.yuko++; desta_luta.y++; }
        else if (act === "ippon_sofrido") acoes.ippon_sof++;
        else if (act === "waza_ari_sofrido") acoes.waza_sof++;
        else if (act === "yuko_sofrido") acoes.yuko_sof++;
      }
      const opp = lado === "b" ? "w" : "b";
      const ff = f as unknown as Record<string, unknown>;
      acoes.shido_provocado += n(ff[`penalty_${opp}`]);
      const shidosSofridos = n(ff[`penalty_${lado}`]);
      acoes.shido_sof += shidosSofridos;
      desta_luta.s = shidosSofridos;
      if (adversario) lutas.push(desta_luta);
    }
  }
  return { vitorias, derrotas, nLutas: desta.length, pontos: Math.round(pontos * 10) / 10, vencidos, acoes, lutas };
}

export async function GET(req: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ ok: false, erro: "Servidor sem ligação." }, { status: 500 });
  }
  const { searchParams } = new URL(req.url);
  const key = searchParams.get("key") || "";
  if (!process.env.CHAVE_CRON_KEY || key !== process.env.CHAVE_CRON_KEY) {
    return NextResponse.json({ ok: false, erro: "Não autorizado." }, { status: 401 });
  }

  // Competição: ?comp= (teste) ou a que está a decorrer.
  let comp = (searchParams.get("comp") || "").trim();
  if (!comp) {
    try {
      const foco = focoMercado();
      comp = String(foco?.aDecorrer?.idCompeticao || "");
    } catch { /* sem foco */ }
  }
  if (!comp) {
    return NextResponse.json({ ok: true, comp: null, nada: "Nenhuma competição a decorrer." });
  }

  // Molduras desta competição -> junta atletas (id, categoria).
  const { data: molduras } = await supabaseAdmin
    .from("chave_atletas")
    .select("weight_category, pools")
    .eq("id_competicao", comp);
  if (!molduras || molduras.length === 0) {
    return NextResponse.json({ ok: true, comp, nada: "Sem molduras para esta competição." });
  }
  const catDoAtleta = new Map<string, string>(); // id_person -> weight_category
  for (const m of molduras) {
    const poolsRaw = (m.pools || {}) as Record<string, unknown>;
    for (const p of ["A", "B", "C", "D"]) {
      const arr = Array.isArray(poolsRaw[p]) ? (poolsRaw[p] as unknown[]) : [];
      for (const x of arr) catDoAtleta.set(String(x), String(m.weight_category));
    }
  }
  const ids = [...catDoAtleta.keys()];

  // Identidades (nome/país/género) do cache de atletas.
  const ident = new Map<string, { nome: string; pais: string; gender: string }>();
  try {
    const { data: cacheRow } = await supabaseAdmin
      .from("atletas_cache").select("atletas").eq("id_competition", comp).maybeSingle();
    const lista = Array.isArray(cacheRow?.atletas) ? (cacheRow!.atletas as Array<Record<string, unknown>>) : [];
    for (const a of lista) {
      const id = a?.id != null ? String(a.id) : "";
      if (!id) continue;
      ident.set(id, {
        nome: a?.name ? String(a.name) : "",
        pais: a?.countryIso ? String(a.countryIso) : "",
        gender: a?.gender ? String(a.gender) : "",
      });
    }
  } catch { /* segue sem identidades */ }

  // Processa em lotes e faz upsert.
  const LOTE = 10;
  let atualizados = 0, comResultados = 0, falhas = 0;
  const linhas: Record<string, unknown>[] = [];
  for (let i = 0; i < ids.length; i += LOTE) {
    const lote = ids.slice(i, i + LOTE);
    const res = await Promise.all(lote.map(async (id) => ({ id, v: await vivoDoAtleta(id, comp).catch(() => null) })));
    for (const { id, v } of res) {
      if (v === null) { falhas++; continue; }
      if (v.nLutas > 0) comResultados++;
      const info = ident.get(id);
      linhas.push({
        id_competicao: comp,
        id_person: id,
        weight_category: catDoAtleta.get(id) || null,
        gender: info?.gender || null,
        nome: info?.nome || null,
        country_code: info?.pais || null,
        vitorias: v.vitorias,
        derrotas: v.derrotas,
        n_lutas: v.nLutas,
        pontos: v.pontos,
        vencidos: v.vencidos,
        lutas: v.lutas,
        acoes: v.acoes,
      });
    }
  }

  if (linhas.length > 0) {
    try {
      const { error } = await supabaseAdmin
        .from("resultados_atletas")
        .upsert(linhas, { onConflict: "id_competicao,id_person" });
      if (error) {
        return NextResponse.json({ ok: false, comp, erro: "Falha ao gravar: " + error.message, atletas: ids.length }, { status: 500 });
      }
      atualizados = linhas.length;
    } catch (e) {
      return NextResponse.json({ ok: false, comp, erro: "Exceção ao gravar." }, { status: 500 });
    }
  }

  return NextResponse.json({
    ok: true, comp, atletas: ids.length, atualizados, com_resultados: comResultados, falhas_judobase: falhas,
    atualizado_em: new Date().toISOString(),
  });
}
