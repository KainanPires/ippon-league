// app/api/precos-maestro/route.ts
//
// MAESTRO DOS PREÇOS — calcula sozinho os preços REAIS dos atletas.
//
// PORQUÊ: o /api/calcular faz o trabalho certo (forma dos últimos 12 meses +
// últimas 3 competições, 70/30), mas era manual e uma categoria de cada vez —
// 14 chamadas à mão por competição. Ninguém as fazia, e por isso os atletas
// ficavam com o PREÇO DE PARTIDA (só ranking), que põe campeões olímpicos a
// 3 JC. Este cron faz essas 14 chamadas sozinho, de minuto a minuto.
//
// COMO: mesma receita do chave-maestro. Guarda um CURSOR em `precos_cron_estado`
// e, a cada passagem, processa as categorias que couberem no orçamento de tempo.
// Ao fim de umas passagens deu a volta às 14 e recomeça (mantendo os preços
// frescos à medida que os atletas competem).
//
// EFICIÊNCIA: a lista de inscritos e o cache são lidos UMA vez por passagem e
// gravados UMA vez no fim — em vez de uma leitura+escrita por categoria.
//
// Uso: GET /api/precos-maestro?key=SEGREDO           (descobre a competição)
//      GET /api/precos-maestro?key=SEGREDO&comp=3149 (força uma competição)
//      GET /api/precos-maestro?key=SEGREDO&reset=1   (recomeça do início)
import { NextResponse } from "next/server";
import { getCompetitionCompetitorsRaw, mapCompetitorsToAthletes, type IjfContest } from "@/lib/ijf";
import { calcularForma } from "@/lib/forma";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { focoMercado } from "@/lib/calendario";
import type { Athlete, AthleteStatus } from "@/lib/athletes";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// As 14 categorias olímpicas (cada uma pertence a um género).
const COMBOS: Array<{ cat: string; gender: "M" | "F" }> = [
  { cat: "-60", gender: "M" }, { cat: "-66", gender: "M" }, { cat: "-73", gender: "M" },
  { cat: "-81", gender: "M" }, { cat: "-90", gender: "M" }, { cat: "-100", gender: "M" },
  { cat: "+100", gender: "M" },
  { cat: "-48", gender: "F" }, { cat: "-52", gender: "F" }, { cat: "-57", gender: "F" },
  { cat: "-63", gender: "F" }, { cat: "-70", gender: "F" }, { cat: "-78", gender: "F" },
  { cat: "+78", gender: "F" },
];

// Só começa uma categoria nova enquanto estivermos abaixo disto. Uma categoria
// demora ~10-12s (uma chamada ao JudoBase por atleta). Com 50s de orçamento
// cabem ~4-5 por passagem, e mesmo que a última arranque perto do limite acaba
// dentro dos 60s da função (maxDuration). Medido: 4 categorias ~47s.
const ORCAMENTO_MS = 50000;

const IJF = "https://data.ijf.org/api/get_json";
const TIMEOUT_MS = 15000;

function buildUrl(action: string, params: Record<string, string>): string {
  const qs = Object.entries(params).map(([k, v]) => `&params%5B${k}%5D=${encodeURIComponent(v)}`).join("");
  return `${IJF}?access_token=&params%5Baction%5D=${action}${qs}`;
}

async function callRaw(action: string, params: Record<string, string>): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(buildUrl(action, params), {
      cache: "no-store", signal: ctrl.signal,
      headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 (IpponLeague)" },
    });
    const text = await res.text();
    clearTimeout(timer);
    if (text.includes("unknown action")) return null;
    try { return JSON.parse(text); } catch { return null; }
  } catch {
    clearTimeout(timer);
    return null;
  }
}

// A resposta de competitor.contests muda de forma; aceitamos as variantes.
function extractFights(data: unknown): IjfContest[] {
  if (Array.isArray(data)) return data as IjfContest[];
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.contests)) return obj.contests as IjfContest[];
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      if (Array.isArray(v) && v.length > 0 && typeof v[0] === "object") return v as IjfContest[];
    }
  }
  return [];
}

function estadoDoPreco(preco: number): AthleteStatus {
  if (preco >= 14) return "Elite";
  if (preco >= 7) return "Barganha";
  return "Aposta";
}

// Estatísticas da distribuição — servem para AFINAR a EXPECTATIVA_TOPO em
// lib/forma.ts com dados reais, em vez de por palpite.
function distribuicao(valores: number[]) {
  if (valores.length === 0) return null;
  const v = [...valores].sort((a, b) => a - b);
  const q = (p: number) => v[Math.min(v.length - 1, Math.floor(v.length * p))];
  return {
    n: v.length,
    min: v[0],
    p25: q(0.25),
    mediana: q(0.5),
    p75: q(0.75),
    p90: q(0.9),
    max: v[v.length - 1],
  };
}

export async function GET(req: Request) {
  const t0 = Date.now();
  const { searchParams } = new URL(req.url);

  // Mesma chave do cron da chave — não é preciso criar variável de ambiente nova.
  const segredo = process.env.CHAVE_CRON_KEY || "";
  if (segredo && searchParams.get("key") !== segredo) {
    return NextResponse.json({ ok: false, erro: "Sem autorização." }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ ok: false, erro: "Servidor sem ligação." }, { status: 500 });
  }

  // Qual competição? A de mercado ABERTO (é onde os preços importam para montar
  // equipa); se estiver a decorrer alguma, essa também serve. ?comp= força.
  const forcada = (searchParams.get("comp") || "").trim();
  let comp = forcada;
  if (!comp) {
    try {
      const foco = focoMercado();
      comp = String(foco.alvo?.idCompeticao || foco.aDecorrer?.idCompeticao || "");
    } catch { /* sem calendário: fica vazio */ }
  }
  if (!comp) {
    return NextResponse.json({ ok: false, erro: "Não consegui descobrir a competição. Usa ?comp=." });
  }

  // ---- Cursor: onde ficámos da última vez ----
  let posicao = 0;
  try {
    const { data: est } = await supabaseAdmin
      .from("precos_cron_estado").select("posicao, id_competicao").eq("id", 1).maybeSingle();
    posicao = Number(est?.posicao) || 0;
    // Competição mudou (ou pediram reset) -> recomeça do início.
    if (searchParams.get("reset") === "1" || (est?.id_competicao && String(est.id_competicao) !== comp)) {
      posicao = 0;
    }
  } catch { /* sem estado: começa do zero */ }
  if (posicao < 0 || posicao >= COMBOS.length) posicao = 0;

  // ---- Inscritos da competição: UMA leitura para todas as categorias ----
  const raw = await getCompetitionCompetitorsRaw(comp);
  const todos = mapCompetitorsToAthletes(raw);
  if (todos.length === 0) {
    return NextResponse.json({
      ok: false, comp, erro: "O JudoBase não devolveu inscritos agora. Nada foi alterado.",
    });
  }

  // ---- Cache atual: UMA leitura ----
  const { data: linha } = await supabaseAdmin
    .from("atletas_cache").select("atletas").eq("id_competition", comp).maybeSingle();
  const listaCache: Athlete[] = Array.isArray(linha?.atletas) ? (linha!.atletas as Athlete[]) : todos;

  // ---- Percorre categorias enquanto houver orçamento ----
  const calculados = new Map<string, Athlete>();
  const expectativas: number[] = [];
  const precos: number[] = [];
  const resumos: Array<{ cat: string; gender: string; atletas: number; ms: number }> = [];

  let processadas = 0;
  while (processadas < COMBOS.length && Date.now() - t0 < ORCAMENTO_MS) {
    const { cat, gender } = COMBOS[posicao];
    const tCat = Date.now();
    const alvo = todos.filter((a) => a.category === cat && a.gender === gender);

    for (const a of alvo) {
      const dados = await callRaw("competitor.contests", { id_person: a.id });
      const fights = extractFights(dados);
      const forma = calcularForma(fights, a.id);
      calculados.set(a.id, {
        ...a,
        priceJc: forma.preco,
        avg: forma.media12m,
        last: forma.ultima,
        variation: 0,
        status: estadoDoPreco(forma.preco),
      });
      expectativas.push(forma.expectativa);
      precos.push(forma.preco);
    }

    resumos.push({ cat, gender, atletas: alvo.length, ms: Date.now() - tCat });
    posicao = (posicao + 1) % COMBOS.length;
    processadas++;
  }

  // ---- Grava: lista inteira de volta, UMA escrita ----
  let gravado = false;
  if (calculados.size > 0) {
    const novaLista = listaCache.map((a) => calculados.get(a.id) || a);
    // Inscritos novos que ainda não estavam no cache entram na mesma.
    const noCache = new Set(novaLista.map((a) => a.id));
    for (const [id, a] of calculados) if (!noCache.has(id)) novaLista.push(a);

    const { error } = await supabaseAdmin.from("atletas_cache").upsert(
      {
        id_competition: comp,
        atletas: novaLista,
        total: novaLista.length,
        atualizado_em: new Date().toISOString(),
      },
      { onConflict: "id_competition" }
    );
    gravado = !error;
    if (error) {
      return NextResponse.json({ ok: false, comp, erro: "Falha ao gravar no cache: " + error.message }, { status: 500 });
    }
  }

  // ---- Guarda o cursor para a próxima passagem ----
  try {
    await supabaseAdmin.from("precos_cron_estado").upsert(
      { id: 1, posicao, id_competicao: comp, atualizado_em: new Date().toISOString() },
      { onConflict: "id" }
    );
  } catch { /* se falhar, na próxima recomeça — não é grave */ }

  return NextResponse.json({
    ok: true,
    comp,
    categorias_no_total: COMBOS.length,
    processadas_agora: processadas,
    proxima_posicao: posicao,
    atletas_calculados: calculados.size,
    gravado,
    ms: Date.now() - t0,
    // Para afinar EXPECTATIVA_TOPO em lib/forma.ts com dados reais.
    distribuicao_expectativa: distribuicao(expectativas),
    distribuicao_preco: distribuicao(precos),
    resumos,
    atualizado_em: new Date().toISOString(),
  });
}
