// app/api/admin/saude/route.ts
//
// SAÚDE DO MOTOR AO VIVO (só admin, só-leitura) — o painel que o fundador abre
// durante uma competição para ver, de relance, se o motor está VIVO, a FLUIR e
// COMPLETO. Não escreve nada; lê o que a observabilidade já grava.
//
// Junta:
//   • Maestro: há quanto tempo correu, estado 🟢/🟡/🔴, duração, falhas. A
//     frescura (minutos desde a última corrida) é recalculada AO VIVO aqui e
//     avaliada com a referência `maestro.intervalo_min` (ao vivo tolera ≤10 min).
//   • Cron principal: há quanto tempo correu (congela/apura/preços).
//   • Cobertura da competição a decorrer: quantas categorias têm moldura, quantas
//     já têm resultados, quantos atletas já lutaram, e anomalias (lutou mas sem
//     detalhe de lutas) — para apanhar um buraco de dados antes que o utilizador o veja.
//   • Últimas corridas (linha do tempo) e alarmes das últimas 24h.
//
// Fonte de verdade: tabela `cron_runs` (lib/cronLog), `resultados_atletas` e
// `chave_atletas` (lib/chave-maestro), `chave_cron_estado` (cursor do maestro).
//
// GET /api/admin/saude            -> deteta a competição a decorrer sozinho
// GET /api/admin/saude?comp=3151  -> força uma competição (teste)
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { avaliar, piorEstado, type Estado, type Leitura } from "@/lib/referencias";
import { CALENDARIO_2026, competicaoRollingAtiva, focoMercado } from "@/lib/calendario";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function ehAdmin(req: Request): Promise<boolean> {
  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
    if (!token) return false;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const pub = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
    if (!url || !pub || !supabaseAdmin) return false;
    const sb = createClient(url, pub, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await sb.auth.getUser();
    const uid = data?.user?.id;
    if (error || !uid) return false;
    const { data: row } = await supabaseAdmin.from("users").select("is_admin").eq("id", uid).maybeSingle();
    return !!row?.is_admin;
  } catch {
    return false;
  }
}

const minsDesde = (iso: string | null | undefined): number | null => {
  if (!iso) return null;
  const t = Date.parse(String(iso));
  if (!Number.isFinite(t)) return null;
  return Math.round(((Date.now() - t) / 60_000) * 10) / 10;
};

interface CorridaLinha {
  job: string;
  estado: Estado | string | null;
  terminado_em: string | null;
  ms: number | null;
  comp: string | null;
  ao_vivo: boolean | null;
  erro: string | null;
  leituras: unknown;
}

export async function GET(req: Request) {
  if (!supabaseAdmin) return NextResponse.json({ ok: false, erro: "Servidor sem ligação." }, { status: 500 });
  if (!(await ehAdmin(req))) return NextResponse.json({ ok: false, erro: "Não autorizado." }, { status: 401 });

  const { searchParams } = new URL(req.url);

  // 1) Competição a decorrer: no rolling vem de competicaoRollingAtiva; senão do
  // foco do mercado; ?comp= força (teste). Descobrir sozinho é o normal.
  let comp = (searchParams.get("comp") || "").trim();
  let aoVivo = false;
  try {
    const roll = competicaoRollingAtiva();
    if (roll?.idCompeticao) { if (!comp) comp = String(roll.idCompeticao); aoVivo = true; }
  } catch { /* segue */ }
  if (!aoVivo) {
    try {
      const foco = focoMercado();
      if (foco?.aDecorrer?.idCompeticao) { if (!comp) comp = String(foco.aDecorrer.idCompeticao); aoVivo = true; }
    } catch { /* segue */ }
  }
  const nomeComp = comp ? (CALENDARIO_2026.find((c) => c.idCompeticao === comp)?.nome || `Competição ${comp}`) : null;

  const ctx = { aoVivo };
  const leiturasPainel: Leitura[] = [];

  // 2) Última corrida do MAESTRO (frescura recalculada ao vivo).
  let maestro: Record<string, unknown> = { existe: false };
  try {
    const { data } = await supabaseAdmin
      .from("cron_runs")
      .select("estado, terminado_em, ms, comp, erro, leituras")
      .eq("job", "maestro")
      .order("terminado_em", { ascending: false })
      .limit(1);
    const r = (data || [])[0] as CorridaLinha | undefined;
    if (r) {
      const mins = minsDesde(r.terminado_em);
      const frescura = avaliar("maestro.intervalo_min", mins ?? 999, ctx);
      leiturasPainel.push(frescura);
      maestro = {
        existe: true,
        estado_corrida: r.estado ?? null,     // estado gravado na última corrida
        minutos_atras: mins,
        frescura,                               // 🟢/🟡/🔴 do tempo desde a última corrida
        ms: r.ms ?? null,
        comp: r.comp ?? null,
        erro: r.erro ?? null,
        leituras: r.leituras ?? null,
      };
    } else {
      // Nunca correu: ao vivo isto é alarme.
      const frescura = avaliar("maestro.intervalo_min", 999, ctx);
      leiturasPainel.push(frescura);
      maestro = { existe: false, frescura };
    }
  } catch (e) {
    maestro = { existe: false, erro_leitura: String((e as Error)?.message || e) };
  }

  // 3) Última corrida do CRON PRINCIPAL.
  let cron: Record<string, unknown> = { existe: false };
  try {
    const { data } = await supabaseAdmin
      .from("cron_runs")
      .select("estado, terminado_em, ms, erro")
      .eq("job", "cron")
      .order("terminado_em", { ascending: false })
      .limit(1);
    const r = (data || [])[0] as CorridaLinha | undefined;
    if (r) {
      const mins = minsDesde(r.terminado_em);
      const frescura = avaliar("cron.intervalo_min", mins ?? 999, ctx);
      leiturasPainel.push(frescura);
      cron = { existe: true, estado_corrida: r.estado ?? null, minutos_atras: mins, frescura, ms: r.ms ?? null, erro: r.erro ?? null };
    }
  } catch { /* o cron principal não é crítico ao vivo; segue */ }

  // 4) Cursor do maestro (última escrita) — confirma que está a dar a volta.
  let cursor: Record<string, unknown> | null = null;
  try {
    const { data } = await supabaseAdmin.from("chave_cron_estado").select("comp, cursor, atualizado_em").eq("id", 1).maybeSingle();
    if (data) cursor = { comp: data.comp ?? null, cursor: data.cursor ?? null, atualizado_em: data.atualizado_em ?? null, minutos_atras: minsDesde(data.atualizado_em as string | null) };
  } catch { /* opcional */ }

  // 5) COBERTURA da competição a decorrer (fluxo de dados real).
  let cobertura: Record<string, unknown> | null = null;
  if (comp) {
    try {
      const { data: molduras } = await supabaseAdmin
        .from("chave_atletas").select("weight_category").eq("id_competicao", comp);
      const catsComMoldura = [...new Set((molduras || []).map((m) => String(m.weight_category)).filter(Boolean))];

      const { data: res } = await supabaseAdmin
        .from("resultados_atletas")
        .select("weight_category, n_lutas, pontos, lutas")
        .eq("id_competicao", comp);
      const linhas = res || [];
      const comLuta = linhas.filter((r) => Number(r.n_lutas) > 0);
      const catsComResultado = [...new Set(comLuta.map((r) => String(r.weight_category)).filter(Boolean))];
      // Anomalia: diz que lutou (n_lutas>0) mas não tem o detalhe das lutas.
      const semDetalhe = comLuta.filter((r) => !Array.isArray(r.lutas) || (r.lutas as unknown[]).length === 0).length;
      const somaPontos = comLuta.reduce((s, r) => s + (Number(r.pontos) || 0), 0);

      cobertura = {
        categorias_com_moldura: catsComMoldura.length,
        categorias_com_resultado: catsComResultado.length,
        atletas_na_base: linhas.length,
        atletas_que_lutaram: comLuta.length,
        atletas_sem_detalhe: semDetalhe,          // anomalia a vigiar
        soma_pontos_visiveis: Math.round(somaPontos * 10) / 10,
        categorias_por_cobrir: catsComMoldura.filter((c) => !catsComResultado.includes(c)),
      };
      // Uma anomalia de detalhe durante o evento é um aviso; muitas, alarme.
      if (semDetalhe > 0) {
        leiturasPainel.push({
          chave: "cobertura.atletas_sem_detalhe",
          rotulo: "Atletas que lutaram sem detalhe gravado",
          observado: semDetalhe,
          esperado: "0", limite: "≤ 3",
          estado: semDetalhe > 3 ? "alarme" : "aviso",
          ajuda: "Atleta com lutas mas sem o detalhe por luta. Costuma ser falha pontual do JudoBase; se persistir, ver o maestro.",
        });
      }
    } catch (e) {
      cobertura = { erro_leitura: String((e as Error)?.message || e) };
    }
  }

  // 6) Linha do tempo: últimas corridas (todos os jobs).
  let ultimas: CorridaLinha[] = [];
  try {
    const { data } = await supabaseAdmin
      .from("cron_runs")
      .select("job, estado, terminado_em, ms, comp, ao_vivo, erro")
      .order("terminado_em", { ascending: false })
      .limit(25);
    ultimas = (data || []) as CorridaLinha[];
  } catch { /* opcional */ }

  // 7) Alarmes nas últimas 24h.
  let alarmes24h = { total: 0, alertados: 0 };
  try {
    const desde = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data } = await supabaseAdmin
      .from("cron_runs")
      .select("alertado_em")
      .eq("estado", "alarme")
      .gte("terminado_em", desde);
    const lista = data || [];
    alarmes24h = { total: lista.length, alertados: lista.filter((r) => !!r.alertado_em).length };
  } catch { /* opcional */ }

  // 8) Estado GERAL do painel = o pior das leituras recolhidas.
  const estadoGeral: Estado = piorEstado(leiturasPainel.length ? leiturasPainel : [{ estado: "ok" as Estado }]);

  return NextResponse.json({
    ok: true,
    agora: new Date().toISOString(),
    ao_vivo: aoVivo,
    comp,
    nome_comp: nomeComp,
    estado_geral: estadoGeral,
    maestro,
    cron,
    cursor,
    cobertura,
    alarmes_24h: alarmes24h,
    ultimas,
  });
}
