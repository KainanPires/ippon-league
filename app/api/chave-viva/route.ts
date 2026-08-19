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
// ---------------------------------------------------------------------------
// POR CURSOR — porque não dá para fazer tudo de uma vez
//
// São ~450 atletas por competição, cada um com uma chamada ao JudoBase. Medido:
// cerca de 30 SEGUNDOS para a competição inteira. O cron-job.org corta aos 30 —
// e foi provavelmente assim que este trabalho morreu em junho: falhava por
// timeout até o serviço o desativar, e ninguém deu por isso.
//
// Agora cada corrida faz as CATEGORIAS que couberem no orçamento e guarda onde
// ficou (linha _cursor_chaveviva_<comp> no atletas_cache — mesmo padrão do
// cursor dos preços). A corrida seguinte continua dali, e o ciclo dá a volta.
//
// Com uma corrida a cada 2 minutos e ~5 categorias por corrida, as 14 dão a
// volta em menos de 6 minutos. Para acompanhar uma chave ao vivo é de sobra —
// e as categorias nunca decorrem todas ao mesmo tempo numa competição real.
//
// Só se processam categorias que TÊM moldura montada. Sem moldura não há chave
// para alimentar.
// ---------------------------------------------------------------------------
//
// Uso:
//   GET /api/chave-viva?key=SEGREDO             -> a decorrer, por cursor
//   GET /api/chave-viva?key=SEGREDO&comp=3149   -> competição específica
//   GET /api/chave-viva?key=SEGREDO&cat=-81     -> só esta categoria (ignora cursor)
//   GET /api/chave-viva?key=SEGREDO&todas=1     -> todas de uma vez (teste; pode passar dos 30s)
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getCompetitorContests, scoreContestForPerson, contestActions } from "@/lib/ijf";
import { focoMercado } from "@/lib/calendario";
import { lerLutasManuais, indexarManuaisPorAtleta, aplicarManuaisAoVivo } from "@/lib/lutasManuais";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60; // fôlego para as chamadas (Vercel Pro; no hobby é 10s)
const n = (v: unknown): number => { const x = parseInt(String(v ?? "0"), 10); return isNaN(x) ? 0 : x; };

// ORÇAMENTO DE TEMPO. O cron-job.org corta aos 30s; trabalhamos até 22 e
// guardamos o resto para a resposta. Uma categoria (~40 atletas) leva ~3s, por
// isso a margem de 6s chega para nunca ficarmos a meio de uma.
const MS_ORCAMENTO = 22_000;
const MS_MARGEM_CATEGORIA = 6_000;

/** Linha do cursor no atletas_cache. Uma por competição. */
const chaveCursor = (comp: string) => `_cursor_chaveviva_${comp}`;
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
  const t0 = Date.now();
  // ?cat=-81 processa SÓ essa categoria (e ignora o cursor).
  // ?todas=1 processa tudo de uma vez (teste; pode passar dos 30s do cron).
  const cat = (searchParams.get("cat") || "").trim();
  const todas = (searchParams.get("todas") || "").trim() === "1";

  // Molduras desta competição. Trazemos TODAS (são poucas linhas) e escolhemos
  // depois quais processar — assim o cursor sabe que categorias existem.
  const { data: molduras } = await supabaseAdmin
    .from("chave_atletas")
    .select("weight_category, pools")
    .eq("id_competicao", comp);
  if (!molduras || molduras.length === 0) {
    return NextResponse.json({ ok: true, comp, cat: cat || null, nada: "Sem molduras para esta competição." });
  }

  // Categorias COM moldura, por ordem estável (para o cursor ser previsível).
  const categorias: string[] = Array.from(
    new Set<string>(molduras.map((m) => String((m as { weight_category?: unknown }).weight_category)))
  ).sort();

  // ---- Que categorias fazer nesta corrida? ----
  let aFazer: string[] = [];
  let deIdx = 0;
  if (cat) {
    aFazer = categorias.includes(cat) ? [cat] : [];
    if (aFazer.length === 0) {
      return NextResponse.json({ ok: true, comp, cat, nada: "Sem moldura para esta categoria." });
    }
  } else if (todas) {
    aFazer = categorias;
  } else {
    // MODO CURSOR: continua de onde a corrida anterior ficou.
    try {
      const { data: cur } = await supabaseAdmin
        .from("atletas_cache").select("total").eq("id_competition", chaveCursor(comp)).maybeSingle();
      const v = Number(cur?.total);
      if (Number.isFinite(v) && v >= 0) deIdx = v % categorias.length;
    } catch { /* sem cursor: começa do princípio */ }
    // A lista roda: se o cursor está a meio, damos a volta pelo início.
    aFazer = [...categorias.slice(deIdx), ...categorias.slice(0, deIdx)];
  }

  const catDoAtleta = new Map<string, string>(); // id_person -> weight_category
  const molduraPorCat = new Map<string, Record<string, unknown>>();
  for (const m of molduras) molduraPorCat.set(String(m.weight_category), (m.pools || {}) as Record<string, unknown>);
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
  // Lutas manuais desta competição (resultados que o JudoBase não leu), por
  // atleta. Fundidas no vivo de cada um, para contarem nos pontos.
  const manuaisIdx = indexarManuaisPorAtleta(await lerLutasManuais(comp));

  // ---- Processa CATEGORIA A CATEGORIA, dentro do orçamento ----
  // Parar entre categorias (e não a meio de uma) mantém a base sempre coerente:
  // ou uma categoria está toda atualizada, ou não foi tocada nesta corrida.
  const LOTE = 10;
  let atualizados = 0, comResultados = 0, falhas = 0;
  const linhas: Record<string, unknown>[] = [];
  const feitas: string[] = [];
  let ids: string[] = [];

  for (const c of aFazer) {
    // Modo cursor: não começa uma categoria nova sem tempo para a acabar.
    if (!cat && !todas && Date.now() - t0 > MS_ORCAMENTO - MS_MARGEM_CATEGORIA) break;

    // Atletas desta categoria, a partir da moldura.
    const poolsRaw = molduraPorCat.get(c) || {};
    const idsCat: string[] = [];
    for (const p of ["A", "B", "C", "D"]) {
      const arr = Array.isArray(poolsRaw[p]) ? (poolsRaw[p] as unknown[]) : [];
      for (const x of arr) {
        const id = String(x);
        if (!id) continue;
        catDoAtleta.set(id, c);
        idsCat.push(id);
      }
    }
    if (idsCat.length === 0) { feitas.push(c); continue; }
    ids = ids.concat(idsCat);

    for (let i = 0; i < idsCat.length; i += LOTE) {
      const lote = idsCat.slice(i, i + LOTE);
      const res = await Promise.all(lote.map(async (id) => ({ id, v: await vivoDoAtleta(id, comp).catch(() => null) })));
      for (const { id, v } of res) {
        if (v === null) { falhas++; continue; }
        const vm = aplicarManuaisAoVivo(v, manuaisIdx.get(id) || [], id);
        if (vm.nLutas > 0) comResultados++;
        const info = ident.get(id);
      linhas.push({
        id_competicao: comp,
        id_person: id,
        weight_category: catDoAtleta.get(id) || null,
        gender: info?.gender || null,
        nome: info?.nome || null,
        country_code: info?.pais || null,
        vitorias: vm.vitorias,
        derrotas: vm.derrotas,
        n_lutas: vm.nLutas,
        pontos: vm.pontos,
        vencidos: vm.vencidos,
        lutas: vm.lutas,
        acoes: vm.acoes,
      });
      }
    }
    feitas.push(c);
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
  // ---- Guarda o cursor: por onde continuar na próxima corrida ----
  // Só em modo cursor. Com ?cat= ou ?todas=1 não se mexe, para um teste manual
  // não desalinhar o ciclo que está a correr.
  let proximoIdx = deIdx;
  if (!cat && !todas && categorias.length > 0) {
    proximoIdx = (deIdx + feitas.length) % categorias.length;
    try {
      await supabaseAdmin.from("atletas_cache").upsert(
        {
          id_competition: chaveCursor(comp),
          atletas: { comp, indice: proximoIdx, categorias, feitas },
          total: proximoIdx,
          atualizado_em: new Date().toISOString(),
        },
        { onConflict: "id_competition" }
      );
    } catch { /* o cursor é uma otimização: se falhar, recomeça do princípio */ }
  }

  return NextResponse.json({
    ok: true, comp,
    cat: cat || (todas ? "todas" : "cursor"),
    // Estado do ciclo: que categorias esta corrida fez, e onde a próxima começa.
    categorias_total: categorias.length,
    feitas,
    de_indice: deIdx,
    proximo_indice: proximoIdx,
    ciclo_completo: !cat && !todas ? feitas.length >= categorias.length : undefined,
    atletas: ids.length, atualizados, com_resultados: comResultados, falhas_judobase: falhas,
    ms: Date.now() - t0,
    atualizado_em: new Date().toISOString(),
  });
}
