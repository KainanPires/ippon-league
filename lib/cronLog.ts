// lib/cronLog.ts
//
// REGISTO E VIGIA DOS CRONS (observabilidade).
//
// Duas funções, ambas seguras (nunca lançam — um problema no registo não pode
// partir o cron que o chama):
//
//   registarCorrida(...)   — no FIM de cada cron: transforma os números crus em
//                            leituras de exame (lib/referencias), grava uma linha
//                            em cron_runs e, se acender 🔴, manda email (com
//                            travão de 60 min para não repetir o mesmo alarme).
//
//   vigiarCronsAoVivo(...)  — chamado pelo cron principal (de hora a hora): durante
//                            uma competição, confirma que o maestro e o chave-viva
//                            correram há pouco. Se um deles emudeceu, acende 🔴.
//                            É a rede que apanha um cron ao vivo que PAROU (o
//                            cron-job.org só apanha os que dão erro, não os que
//                            deixam de ser chamados).

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { avaliar, piorEstado, type Leitura, type CtxRef, type Estado } from "@/lib/referencias";
import { alertarFundador } from "@/lib/alertas";

const THROTTLE_MIN = 60; // não repetir o email do mesmo job dentro desta janela

export interface RegistoCron {
  job: string; // "cron" | "maestro" | "chave-viva" | "vigia"
  observados: Record<string, number>; // chave de REFERENCIAS -> valor observado
  ctx?: CtxRef; // { aoVivo }
  comp?: string | null;
  ms?: number;
  iniciadoMs?: number; // Date.now() no arranque, para gravar iniciado_em
  resumo?: unknown; // payload cru, guardado como jsonb
  erro?: string | null; // se a corrida rebentou
}

/**
 * Regista uma corrida: grava a linha e alerta se necessário.
 * Devolve o estado geral e as leituras (útil para juntar à resposta do cron).
 */
export async function registarCorrida(reg: RegistoCron): Promise<{ estado: Estado; leituras: Leitura[] }> {
  const ctx = reg.ctx || {};
  const leituras: Leitura[] = Object.entries(reg.observados).map(([k, v]) => avaliar(k, v, ctx));

  // Um erro que rebentou a corrida é sempre 🔴, mesmo que os sinais medidos
  // pareçam bons (podem nem ter chegado a ser calculados).
  let estado = piorEstado(leituras);
  if (reg.erro) estado = "alarme";

  if (!supabaseAdmin) return { estado, leituras };

  // Decide se manda email: só em 🔴 e só se não houve já um alarme avisado
  // deste mesmo job na última hora (evita spam durante uma competição).
  let vaiAlertar = estado === "alarme";
  if (vaiAlertar) {
    try {
      const desde = new Date(Date.now() - THROTTLE_MIN * 60_000).toISOString();
      const { data } = await supabaseAdmin
        .from("cron_runs")
        .select("id")
        .eq("job", reg.job)
        .eq("estado", "alarme")
        .not("alertado_em", "is", null)
        .gte("alertado_em", desde)
        .limit(1);
      if (data && data.length > 0) vaiAlertar = false;
    } catch {
      /* na dúvida, deixa alertar */
    }
  }

  const agora = new Date().toISOString();
  try {
    await supabaseAdmin.from("cron_runs").insert({
      job: reg.job,
      ok: estado !== "alarme",
      estado,
      iniciado_em: reg.iniciadoMs ? new Date(reg.iniciadoMs).toISOString() : null,
      terminado_em: agora,
      ms: reg.ms ?? null,
      comp: reg.comp ?? null,
      ao_vivo: !!ctx.aoVivo,
      leituras,
      resumo: reg.resumo ?? null,
      erro: reg.erro ?? null,
      alertado_em: vaiAlertar ? agora : null,
    });
  } catch {
    /* nunca deixar o registo partir o cron */
  }

  if (vaiAlertar) {
    try {
      await alertarFundador(reg.job, leituras, { comp: reg.comp ?? null, aoVivo: !!ctx.aoVivo, erro: reg.erro ?? null });
    } catch {
      /* email é best-effort */
    }
  }

  return { estado, leituras };
}

/** Minutos desde a última corrida de um job (Infinity se nunca correu). */
async function minutosDesdeUltima(job: string): Promise<number> {
  if (!supabaseAdmin) return Infinity;
  try {
    const { data } = await supabaseAdmin
      .from("cron_runs")
      .select("terminado_em")
      .eq("job", job)
      .order("terminado_em", { ascending: false })
      .limit(1);
    const t = data && data[0]?.terminado_em ? Date.parse(String(data[0].terminado_em)) : NaN;
    if (!Number.isFinite(t)) return Infinity;
    return (Date.now() - t) / 60_000;
  } catch {
    return Infinity;
  }
}

/**
 * Vigia os crons AO VIVO. Chamar do cron principal quando há competição a
 * decorrer. Grava uma corrida "vigia" com o tempo desde a última corrida do
 * maestro e do chave-viva; se algum emudeceu, registarCorrida acende 🔴 e alerta
 * (com o mesmo travão de 60 min). Um número muito alto (nunca correu) vira 999.
 */
export async function vigiarCronsAoVivo(comp: string | null): Promise<void> {
  const maestro = await minutosDesdeUltima("maestro");
  const viva = await minutosDesdeUltima("chave-viva");
  const cap = (n: number) => (Number.isFinite(n) ? Math.round(n) : 999);
  await registarCorrida({
    job: "vigia",
    ctx: { aoVivo: true },
    comp,
    observados: {
      "maestro.intervalo_min": cap(maestro),
      "chaveviva.intervalo_min": cap(viva),
    },
  });
}
