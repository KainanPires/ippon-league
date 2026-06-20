// app/api/chave-maestro/route.ts
//
// MAESTRO DA CHAVE — um só cron para TODAS as categorias, no plano Hobby.
//
// PROBLEMA QUE RESOLVE: no Hobby cada função tem 10s. Processar todas as
// categorias de uma vez rebenta esse limite. Em vez de um job por categoria
// (trabalhoso de gerir), há UM job que chama este maestro de minuto a minuto.
//
// COMO FUNCIONA:
//   1. Descobre a competição a decorrer (focoMercado), ou aceita ?comp= (teste).
//   2. Lista as categorias que têm moldura (chave_atletas), por ordem estável.
//   3. Lê um CURSOR guardado na tabela chave_cron_estado (onde ficou da última vez).
//   4. A partir do cursor, processa categorias UMA A UMA até gastar ~7s de
//      orçamento (margem segura abaixo dos 10s), e pára. Guarda o novo cursor.
//   5. Na chamada seguinte (1 min depois) continua de onde ficou. Em poucos
//      minutos deu a volta a todas e recomeça.
//
// Assim: UM job, sem gestão manual, novas categorias entram na rotação sozinhas,
// e nunca se excede o tempo-limite — seja qual for o tamanho das categorias.
//
// SEGURANÇA: ?key= (env CHAVE_CRON_KEY), igual ao chave-viva.
// Uso no cron-job.org (de minuto a minuto):
//   GET /api/chave-maestro?key=SEGREDO
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getCompetitorContests, scoreContestForPerson, contestActions } from "@/lib/ijf";
import { focoMercado } from "@/lib/calendario";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const ORCAMENTO_MS = 5000; // pára de pegar categorias novas depois disto. Mesmo que
                           // a última comece aqui e demore ~3-4s, fica < 10s (Hobby).
const LOTE_ATLETAS = 12;   // chamadas em paralelo ao JudoBase, por categoria

const n = (v: unknown): number => { const x = parseInt(String(v ?? "0"), 10); return isNaN(x) ? 0 : x; };

type Acoes = { ippon: number; waza: number; yuko: number; shido_provocado: number; ippon_sof: number; waza_sof: number; yuko_sof: number; shido_sof: number };
const acoesVazias = (): Acoes => ({ ippon: 0, waza: 0, yuko: 0, shido_provocado: 0, ippon_sof: 0, waza_sof: 0, yuko_sof: 0, shido_sof: 0 });

// Vitórias/derrotas + pontos + ações (soma e por luta) de UM atleta, ao vivo.
async function vivoDoAtleta(idPerson: string, comp: string) {
  const todas = await getCompetitorContests(idPerson);
  if (!todas) return null;
  const desta = todas.filter((f) => String(f.id_competition) === comp);
  let vitorias = 0, derrotas = 0, pontos = 0;
  const vencidos: string[] = [];
  const acoes = acoesVazias();
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
      const dl = { adv: adversario, venceu: venc === idPerson, i: 0, w: 0, y: 0, s: 0 };
      for (const act of contestActions(f, lado)) {
        if (act === "ippon_feito") { acoes.ippon++; dl.i++; }
        else if (act === "waza_ari_feito") { acoes.waza++; dl.w++; }
        else if (act === "yuko_feito") { acoes.yuko++; dl.y++; }
        else if (act === "ippon_sofrido") acoes.ippon_sof++;
        else if (act === "waza_ari_sofrido") acoes.waza_sof++;
        else if (act === "yuko_sofrido") acoes.yuko_sof++;
      }
      const opp = lado === "b" ? "w" : "b";
      const ff = f as unknown as Record<string, unknown>;
      acoes.shido_provocado += n(ff[`penalty_${opp}`]);
      const sof = n(ff[`penalty_${lado}`]);
      acoes.shido_sof += sof;
      dl.s = sof;
      if (adversario) lutas.push(dl);
    }
  }
  return { vitorias, derrotas, nLutas: desta.length, pontos: Math.round(pontos * 10) / 10, vencidos, acoes, lutas };
}

// Processa UMA categoria: lê a moldura, busca o vivo de cada atleta e grava.
async function processarCategoria(comp: string, cat: string) {
  if (!supabaseAdmin) return { cat, atletas: 0, atualizados: 0, com_resultados: 0, falhas: 0, erro: "sem ligação" };

  const { data: linha } = await supabaseAdmin
    .from("chave_atletas").select("pools").eq("id_competicao", comp).eq("weight_category", cat).maybeSingle();
  if (!linha?.pools) return { cat, atletas: 0, atualizados: 0, com_resultados: 0, falhas: 0, erro: "sem moldura" };

  const poolsRaw = linha.pools as Record<string, unknown>;
  const ids: string[] = [];
  for (const p of ["A", "B", "C", "D"]) {
    const arr = Array.isArray(poolsRaw[p]) ? (poolsRaw[p] as unknown[]) : [];
    for (const x of arr) ids.push(String(x));
  }

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

  let comResultados = 0, falhas = 0;
  const linhas: Record<string, unknown>[] = [];
  for (let i = 0; i < ids.length; i += LOTE_ATLETAS) {
    const lote = ids.slice(i, i + LOTE_ATLETAS);
    const res = await Promise.all(lote.map(async (id) => ({ id, v: await vivoDoAtleta(id, comp).catch(() => null) })));
    for (const { id, v } of res) {
      if (v === null) { falhas++; continue; }
      if (v.nLutas > 0) comResultados++;
      const info = ident.get(id);
      linhas.push({
        id_competicao: comp, id_person: id, weight_category: cat,
        gender: info?.gender || null, nome: info?.nome || null, country_code: info?.pais || null,
        vitorias: v.vitorias, derrotas: v.derrotas, n_lutas: v.nLutas, pontos: v.pontos,
        vencidos: v.vencidos, lutas: v.lutas, acoes: v.acoes,
      });
    }
  }

  if (linhas.length > 0) {
    const { error } = await supabaseAdmin
      .from("resultados_atletas").upsert(linhas, { onConflict: "id_competicao,id_person" });
    if (error) return { cat, atletas: ids.length, atualizados: 0, com_resultados: comResultados, falhas, erro: error.message };
  }
  return { cat, atletas: ids.length, atualizados: linhas.length, com_resultados: comResultados, falhas };
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
    try { comp = String(focoMercado()?.aDecorrer?.idCompeticao || ""); } catch { /* sem foco */ }
  }
  if (!comp) {
    return NextResponse.json({ ok: true, comp: null, nada: "Nenhuma competição a decorrer." });
  }

  // Categorias com moldura, por ordem estável.
  const { data: linhas } = await supabaseAdmin
    .from("chave_atletas").select("weight_category").eq("id_competicao", comp).order("weight_category");
  const cats = [...new Set((linhas || []).map((r) => String(r.weight_category)).filter(Boolean))];
  if (cats.length === 0) {
    return NextResponse.json({ ok: true, comp, nada: "Sem molduras para esta competição." });
  }

  // Cursor: onde ficou da última vez (reinicia se a competição mudou).
  const { data: estado } = await supabaseAdmin
    .from("chave_cron_estado").select("comp, cursor").eq("id", 1).maybeSingle();
  let cursor = (estado && String(estado.comp) === comp) ? (Number(estado.cursor) || 0) : 0;
  if (cursor < 0 || cursor >= cats.length) cursor = 0;

  // Processa por orçamento de tempo: pelo menos 1 categoria, e tantas quantas
  // couberem em ~7s, dando a volta sem repetir nesta passagem.
  const t0 = Date.now();
  const resumos: Array<Record<string, unknown>> = [];
  let i = cursor;
  let feitas = 0;
  do {
    const cat = cats[i % cats.length];
    resumos.push(await processarCategoria(comp, cat));
    feitas++;
    i = (i + 1) % cats.length;
  } while (Date.now() - t0 < ORCAMENTO_MS && feitas < cats.length);

  // Guarda o novo cursor (próxima categoria a processar).
  await supabaseAdmin.from("chave_cron_estado").upsert(
    { id: 1, comp, cursor: i, atualizado_em: new Date().toISOString() },
    { onConflict: "id" }
  );

  return NextResponse.json({
    ok: true,
    comp,
    total_categorias: cats.length,
    processadas_agora: feitas,
    proxima_posicao: i,
    ms: Date.now() - t0,
    resumos,
    atualizado_em: new Date().toISOString(),
  });
}
