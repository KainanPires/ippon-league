import { NextResponse } from "next/server";
import { competicaoDaSemana, competicaoFechada, CALENDARIO_2026, type SemanaCalendario } from "@/lib/calendario";
import { getCompetitionCompetitorsRaw, mapCompetitorsToAthletes } from "@/lib/ijf";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { congelarCompeticao } from "@/lib/congelar";

// CRON — prepara sozinho os preços/forma da competição que se aproxima.
// Corre 1x/dia (vercel.json). Com Fluid Compute, uma função corre até 300s — as
// 14 categorias (~18s cada ≈ 252s) cabem numa só execução, em sequência.
//
//   /api/cron                  -> prepara a competição que se aproxima (14 categorias)
//   /api/cron?comp=ID          -> força uma competição específica
//   /api/cron?key=SEGREDO      -> disparo MANUAL para teste (em vez do cabeçalho da Vercel)
//   /api/cron?congelar=ID      -> força CONGELAR uma competição específica (teste)
//
// Etapas:
//   (A) atualiza "a competir agora" (aviso no Mercado)
//   (B) prepara preços da competição que se aproxima (14 categorias via /api/calcular)
//   (C) CONGELA as competições recentes terminadas (motor lib/congelar): preenche
//       resultados_atletas, resultados_rodada, precos_atletas, pontuacoes,
//       users.patrimony_jc — com a FONTE CORRETA (competitor.contests por atleta).
//   (D) no início do mês (dia 1), recalcula as faixas do mês anterior (users.belt)
//
// Protegido por CRON_SECRET: a Vercel envia "Authorization: Bearer <CRON_SECRET>"
// automaticamente; em alternativa aceitamos ?key=<CRON_SECRET> para testares à mão.
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CATS: { cat: string; gender: "M" | "F" }[] = [
  { cat: "-60", gender: "M" }, { cat: "-66", gender: "M" }, { cat: "-73", gender: "M" },
  { cat: "-81", gender: "M" }, { cat: "-90", gender: "M" }, { cat: "-100", gender: "M" },
  { cat: "+100", gender: "M" },
  { cat: "-48", gender: "F" }, { cat: "-52", gender: "F" }, { cat: "-57", gender: "F" },
  { cat: "-63", gender: "F" }, { cat: "-70", gender: "F" }, { cat: "-78", gender: "F" },
  { cat: "+78", gender: "F" },
];

// Linha especial no cache que guarda quem está a competir AGORA.
const CHAVE_AO_VIVO = "_a_competir_agora";

// A partir de quantos jogadores ativos os percentis de faixa "ligam".
const MIN_JOGADORES = 100;
// Janela (dias) para procurar competições recém-terminadas a congelar.
const JANELA_DIAS = 21;
// Faixas por ordem (melhor → pior). 5+10+15+20+20+20 = 90%; resto (~10%) = branca.
const ESCADA: { faixa: string; fatia: number }[] = [
  { faixa: "preta", fatia: 0.05 }, { faixa: "marrom", fatia: 0.10 }, { faixa: "roxa", fatia: 0.15 },
  { faixa: "verde", fatia: 0.20 }, { faixa: "amarela", fatia: 0.20 }, { faixa: "azul", fatia: 0.20 },
];

// Aceita o segredo por cabeçalho (Vercel) OU por ?key= (teste manual).
function autorizado(req: Request, key: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  if (key && key === secret) return true;
  const auth = req.headers.get("authorization") || "";
  return auth === `Bearer ${secret}`;
}

function baseUrl(req: Request): string {
  try {
    const u = new URL(req.url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "";
  }
}

// Diz se uma competição (pela data do calendário) já começou — está a decorrer.
function jaComecou(c: SemanaCalendario, hoje: Date): boolean {
  const ini = new Date(c.de.replace(/\//g, "-") + "T00:00:00");
  const fim = new Date(ini.getTime() + 6 * 86400000);
  return hoje >= ini && hoje <= fim;
}

// Guarda (ou limpa) a lista de IDs de quem está a competir agora.
async function atualizarAoVivo(hoje: Date): Promise<{ ao_vivo: string | null; atletas_ao_vivo: number }> {
  if (!supabaseAdmin) return { ao_vivo: null, atletas_ao_vivo: 0 };

  const atual = competicaoDaSemana(hoje);
  const aDecorrer = jaComecou(atual, hoje);

  if (!aDecorrer) {
    await supabaseAdmin.from("atletas_cache").upsert(
      { id_competition: CHAVE_AO_VIVO, atletas: [], total: 0, atualizado_em: new Date().toISOString() },
      { onConflict: "id_competition" }
    );
    return { ao_vivo: null, atletas_ao_vivo: 0 };
  }

  const raw = await getCompetitionCompetitorsRaw(atual.idCompeticao);
  const atletas = mapCompetitorsToAthletes(raw);
  const ids = atletas.map((a) => a.id).filter(Boolean);
  const payload = { id_competicao: atual.idCompeticao, nome: atual.nome, ids };

  await supabaseAdmin.from("atletas_cache").upsert(
    { id_competition: CHAVE_AO_VIVO, atletas: payload, total: ids.length, atualizado_em: new Date().toISOString() },
    { onConflict: "id_competition" }
  );

  return { ao_vivo: atual.nome, atletas_ao_vivo: ids.length };
}

// (C) CONGELA as competições recentes que já TERMINARAM (regra das 60h).
// Usa o motor lib/congelar (fonte correta competitor.contests). Idempotente:
// o motor tem retoma e não incha. Devolve um resumo por competição.
async function congelarRecentes(hoje: Date): Promise<{ comp: string; nome: string; processados: number; faltam: number; utilizadores: number; completa: boolean }[]> {
  const agora = hoje.getTime();
  const janelaMs = JANELA_DIAS * 24 * 60 * 60 * 1000;
  const candidatas = CALENDARIO_2026.filter((s) => {
    const inicio = new Date(s.de.replace(/\//g, "-") + "T00:00:00").getTime();
    const dentroDaJanela = inicio <= agora && agora - inicio <= janelaMs;
    return dentroDaJanela && competicaoFechada(s, hoje); // só as JÁ TERMINADAS (60h)
  });

  const out: { comp: string; nome: string; processados: number; faltam: number; utilizadores: number; completa: boolean }[] = [];
  for (const s of candidatas) {
    const mes = s.de.slice(0, 7).replace("/", "-");
    const anoEpoca = parseInt(s.de.slice(0, 4), 10);
    try {
      const r = await congelarCompeticao(s.idCompeticao, mes, anoEpoca);
      out.push({ comp: s.idCompeticao, nome: s.nome, processados: r.atletasProcessados, faltam: r.atletasEmFalta, utilizadores: r.utilizadores, completa: r.completa });
    } catch (e) {
      out.push({ comp: s.idCompeticao, nome: s.nome, processados: 0, faltam: -1, utilizadores: 0, completa: false });
    }
  }
  return out;
}

// (D) Recalcula as faixas de um mês por percentil e grava em users.belt.
async function recalcularFaixas(mes: string): Promise<{ jogadores: number; percentilAtivo: boolean; distribuicao: Record<string, number> }> {
  if (!supabaseAdmin) return { jogadores: 0, percentilAtivo: false, distribuicao: {} };

  const { data: linhas } = await supabaseAdmin.from("pontuacoes").select("user_id, pontos").eq("mes", mes);
  const soma = new Map<string, number>();
  for (const l of linhas || []) soma.set(l.user_id, (soma.get(l.user_id) ?? 0) + (l.pontos ?? 0));

  const jogadores = [...soma.entries()].map(([user_id, total]) => ({ user_id, total }));
  const n = jogadores.length;
  if (n === 0) return { jogadores: 0, percentilAtivo: false, distribuicao: {} };

  jogadores.sort((a, b) => b.total - a.total);
  const percentilAtivo = n >= MIN_JOGADORES;
  const distribuicao: Record<string, number> = {};
  const atualizacoes: { user_id: string; faixa: string }[] = [];

  if (!percentilAtivo) {
    for (const j of jogadores) atualizacoes.push({ user_id: j.user_id, faixa: "branca" });
    distribuicao["branca"] = n;
  } else {
    let acum = 0;
    const limites: { faixa: string; ate: number }[] = [];
    for (const passo of ESCADA) { acum += passo.fatia; limites.push({ faixa: passo.faixa, ate: Math.round(acum * n) }); }
    for (let i = 0; i < n; i++) {
      const cap = limites.find((l) => i < l.ate);
      const faixa = cap ? cap.faixa : "branca";
      atualizacoes.push({ user_id: jogadores[i].user_id, faixa });
      distribuicao[faixa] = (distribuicao[faixa] ?? 0) + 1;
    }
  }

  for (const a of atualizacoes) {
    await supabaseAdmin.from("users").update({ belt: a.faixa }).eq("id", a.user_id);
  }
  return { jogadores: n, percentilAtivo, distribuicao };
}

// Mês anterior ao da data dada, "AAAA-MM".
function mesAnteriorDe(d: Date): string {
  const x = new Date(d.getFullYear(), d.getMonth(), 1);
  x.setMonth(x.getMonth() - 1);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const key = searchParams.get("key");

  if (!autorizado(req, key)) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }

  const base = baseUrl(req);
  const t0 = Date.now();
  const hoje = new Date();

  // Disparo manual de congelamento de UMA competição (teste): ?congelar=ID
  const congelarId = (searchParams.get("congelar") || "").trim();
  if (congelarId) {
    const s = CALENDARIO_2026.find((c) => c.idCompeticao === congelarId);
    const mes = s ? s.de.slice(0, 7).replace("/", "-") : new Date().toISOString().slice(0, 7);
    const anoEpoca = s ? parseInt(s.de.slice(0, 4), 10) : hoje.getUTCFullYear();
    const r = await congelarCompeticao(congelarId, mes, anoEpoca);
    return NextResponse.json({ feito: true, modo: "congelar_forcado", resultado: r, ms_total: Date.now() - t0 });
  }

  // (A) Atualiza a lista de "a competir agora" (para o aviso no Mercado).
  let aoVivo: { ao_vivo: string | null; atletas_ao_vivo: number } = { ao_vivo: null, atletas_ao_vivo: 0 };
  try {
    aoVivo = await atualizarAoVivo(hoje);
  } catch (e) {
    aoVivo = { ao_vivo: `erro: ${(e as { message?: string })?.message || "falha"}`, atletas_ao_vivo: 0 };
  }

  // (B) Prepara os preços da competição que se aproxima (14 categorias).
  let comp = searchParams.get("comp");
  let alvo: SemanaCalendario | null = null;
  if (!comp) {
    alvo = competicaoDaSemana(hoje);
    comp = alvo.idCompeticao;
  }

  const passos: Array<{ categoria: string; ok: boolean; atualizados?: number; ms?: number; nota?: string }> = [];
  for (const { cat, gender } of CATS) {
    const catUrl = encodeURIComponent(cat);
    const url = `${base}/api/calcular?comp=${comp}&cat=${catUrl}&gender=${gender}`;
    try {
      const r = await fetch(url, { cache: "no-store" });
      const j = (await r.json()) as { sucesso?: boolean; atualizados?: number; ms?: number; nota?: string; erro?: string };
      passos.push({
        categoria: `${cat} ${gender}`,
        ok: !!j?.sucesso || typeof j?.atualizados === "number",
        atualizados: j?.atualizados,
        ms: j?.ms,
        nota: j?.erro || j?.nota,
      });
    } catch (e) {
      passos.push({ categoria: `${cat} ${gender}`, ok: false, nota: (e as { message?: string })?.message || "falha" });
    }
  }

  const totalAtualizados = passos.reduce((s, p) => s + (p.atualizados || 0), 0);
  const ok = passos.filter((p) => p.ok).length;

  // (C) CONGELA as competições recentes terminadas (motor lib/congelar).
  // Preenche resultados_atletas, resultados_rodada, precos_atletas, pontuacoes
  // e users.patrimony_jc — com a fonte correta. Idempotente.
  let congelamentos: { comp: string; nome: string; processados: number; faltam: number; utilizadores: number; completa: boolean }[] = [];
  try {
    congelamentos = await congelarRecentes(hoje);
  } catch { /* não bloqueia o resto do cron */ }

  // (D) No início do mês (dia 1), recalcula as faixas do mês anterior. Permite
  //     também forçar via ?faixas=AAAA-MM para teste manual.
  let faixas: { mes: string; jogadores: number; percentilAtivo: boolean; distribuicao: Record<string, number> } | null = null;
  const forcarFaixas = (searchParams.get("faixas") || "").trim();
  try {
    if (forcarFaixas) {
      const r = await recalcularFaixas(forcarFaixas);
      faixas = { mes: forcarFaixas, ...r };
    } else if (hoje.getDate() === 1) {
      const mes = mesAnteriorDe(hoje);
      const r = await recalcularFaixas(mes);
      faixas = { mes, ...r };
    }
  } catch { /* não bloqueia */ }

  return NextResponse.json({
    feito: true,
    comp,
    competicao: alvo ? alvo.nome : "(forçada por id)",
    classico: alvo ? alvo.classico : undefined,
    a_competir_agora: aoVivo.ao_vivo,
    atletas_a_competir_agora: aoVivo.atletas_ao_vivo,
    categorias_ok: `${ok}/${CATS.length}`,
    total_atletas_atualizados: totalAtualizados,
    congelamentos,
    faixas,
    ms_total: Date.now() - t0,
    passos,
  });
}
