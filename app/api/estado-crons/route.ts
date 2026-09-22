// app/api/estado-crons/route.ts
//
// PAINEL DE SAÚDE DOS CRONS — o "exame" num relance.
//
// Lê a última corrida de cada cron (tabela cron_runs) e, AGORA, calcula a
// frescura: há quanto tempo cada um correu, contra a referência. Isto é o
// vigia em tempo de leitura — um cron que PAROU não regista o seu próprio
// silêncio, por isso a idade só se vê aqui, ao abrir.
//
//   GET /api/estado-crons?key=CRON_SECRET          -> JSON
//   GET /api/estado-crons?key=CRON_SECRET&html=1   -> página para o telemóvel
//
// A frescura do maestro e do chave-viva só se avalia DURANTE uma competição:
// fora dela não são chamados (e não registam), por isso "parados" é o normal.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { focoMercado } from "@/lib/calendario";
import { avaliar, piorEstado, SINAL, ROTULO_ESTADO, type Leitura, type Estado } from "@/lib/referencias";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface JobDef {
  job: string;
  rotulo: string;
  refFrescura: string;
  soAoVivo: boolean; // frescura só conta durante competição
}

const JOBS: JobDef[] = [
  { job: "cron", rotulo: "Cron principal", refFrescura: "cron.intervalo_min", soAoVivo: false },
  { job: "maestro", rotulo: "Chave-maestro (ao vivo)", refFrescura: "maestro.intervalo_min", soAoVivo: true },
  // A Chave Viva foi substituída pela Chave Maestro (reformada) — fora do painel.
];

interface EstadoJob {
  job: string;
  rotulo: string;
  ultima_corrida: string | null;
  ha_minutos: number | null;
  estado_ultima: Estado | null;
  em_repouso: boolean;
  frescura: Leitura | null;
  ms: number | null;
  erro: string | null;
  leituras: Leitura[];
}

async function lerUltima(job: string) {
  if (!supabaseAdmin) return null;
  try {
    const { data } = await supabaseAdmin
      .from("cron_runs")
      .select("terminado_em, estado, ms, erro, leituras")
      .eq("job", job)
      .order("terminado_em", { ascending: false })
      .limit(1);
    return data && data[0] ? data[0] : null;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ ok: false, erro: "Servidor sem ligação." }, { status: 500 });
  }
  const { searchParams } = new URL(req.url);
  const key = (searchParams.get("key") || "").trim();
  if (!process.env.CRON_SECRET || key !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, erro: "Não autorizado." }, { status: 401 });
  }

  let comp: string | null = null;
  try {
    comp = String(focoMercado()?.aDecorrer?.idCompeticao || "") || null;
  } catch {
    comp = null;
  }
  const aoVivo = !!comp;

  const jobs: EstadoJob[] = [];
  const paraEstadoGeral: Estado[] = [];

  for (const def of JOBS) {
    const linha = await lerUltima(def.job);
    const terminado = linha?.terminado_em ? String(linha.terminado_em) : null;
    const tMs = terminado ? Date.parse(terminado) : NaN;
    const haMin = Number.isFinite(tMs) ? Math.round((Date.now() - tMs) / 60_000) : null;

    // Repouso: job só-ao-vivo, fora de competição. Não se julga a frescura.
    const emRepouso = def.soAoVivo && !aoVivo;

    let frescura: Leitura | null = null;
    if (!emRepouso) {
      const valor = haMin === null ? 999 : haMin; // nunca correu = muito velho
      frescura = avaliar(def.refFrescura, valor, { aoVivo });
      paraEstadoGeral.push(frescura.estado);
    }

    const estadoUltima = (linha?.estado as Estado) || null;
    if (estadoUltima) paraEstadoGeral.push(estadoUltima);

    jobs.push({
      job: def.job,
      rotulo: def.rotulo,
      ultima_corrida: terminado,
      ha_minutos: haMin,
      estado_ultima: estadoUltima,
      em_repouso: emRepouso,
      frescura,
      ms: linha?.ms != null ? Number(linha.ms) : null,
      erro: linha?.erro ? String(linha.erro) : null,
      leituras: Array.isArray(linha?.leituras) ? (linha!.leituras as Leitura[]) : [],
    });
  }

  const estadoGeral: Estado = paraEstadoGeral.length ? piorEstado(paraEstadoGeral.map((e) => ({ estado: e }))) : "ok";

  if (searchParams.get("html") === "1") {
    return new Response(paginaHtml(estadoGeral, aoVivo, comp, jobs), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  return NextResponse.json({
    ok: true,
    ao_vivo: aoVivo,
    comp,
    estado_geral: estadoGeral,
    atualizado_em: new Date().toISOString(),
    jobs,
  });
}

// ---------------------------------------------------------------------------
// Página para o telemóvel (?html=1). Auto-atualiza a cada 60s.
// ---------------------------------------------------------------------------
function esc(v: unknown): string {
  return String(v ?? "")
    .split("&").join(String.fromCharCode(38) + "amp;")
    .split("<").join(String.fromCharCode(38) + "lt;")
    .split(">").join(String.fromCharCode(38) + "gt;");
}
function cor(e: Estado): string {
  return e === "alarme" ? "#ef8d83" : e === "aviso" ? "#e6b968" : "#7fd1a3";
}

function linhaLeitura(l: Leitura): string {
  const un = l.unidade ? " " + esc(l.unidade) : "";
  return `<tr>
    <td>${esc(l.rotulo)}</td>
    <td style="color:${cor(l.estado)};font-weight:700">${esc(l.observado)}${un}</td>
    <td class="ref">${esc(l.esperado)}</td>
    <td class="ref">${esc(l.limite)}</td>
    <td>${SINAL[l.estado]}</td>
  </tr>`;
}

function cartaoJob(j: EstadoJob): string {
  const partes: string[] = [];
  if (j.frescura) partes.push(linhaLeitura(j.frescura));
  for (const l of j.leituras) partes.push(linhaLeitura(l));
  const quando = j.ultima_corrida
    ? `há ${j.ha_minutos} min`
    : "sem registo";
  const selo = j.em_repouso ? "😴 em repouso" : `${SINAL[j.estado_ultima || "ok"]} ${ROTULO_ESTADO[j.estado_ultima || "ok"]}`;
  return `
  <section class="card">
    <div class="chd">
      <h2>${esc(j.rotulo)}</h2>
      <span class="selo">${selo}</span>
    </div>
    <p class="meta">Última corrida: ${esc(quando)}${j.ms != null ? ` · ${esc(j.ms)} ms` : ""}</p>
    ${j.erro ? `<p class="err">Erro: ${esc(j.erro)}</p>` : ""}
    ${partes.length ? `<table><thead><tr><th>Sinal</th><th>Observado</th><th>Esperado</th><th>Limite</th><th></th></tr></thead><tbody>${partes.join("")}</tbody></table>` : `<p class="meta">Sem leituras.</p>`}
  </section>`;
}

function paginaHtml(estadoGeral: Estado, aoVivo: boolean, comp: string | null, jobs: EstadoJob[]): string {
  const cabecalho = `${SINAL[estadoGeral]} ${ROTULO_ESTADO[estadoGeral]}`;
  return `<!doctype html><html lang="pt"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="60">
<title>Saúde dos crons · Ippon League</title>
<style>
  :root{color-scheme:dark}
  *{box-sizing:border-box}
  body{margin:0;background:#0c0e0d;color:#f1ede2;font-family:system-ui,-apple-system,sans-serif;line-height:1.5}
  .wrap{max-width:720px;margin:0 auto;padding:20px 16px 60px}
  h1{font-size:1.2rem;margin:0 0 2px}
  .top{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:4px}
  .geral{font-weight:700;font-size:1.05rem;color:${cor(estadoGeral)}}
  .contexto{color:#93a39a;font-size:.85rem;margin:0 0 20px}
  .card{background:#121815;border:1px solid #243029;border-radius:14px;padding:14px 16px;margin-bottom:14px}
  .chd{display:flex;align-items:center;justify-content:space-between;gap:10px}
  h2{font-size:1rem;margin:0}
  .selo{font-size:.85rem;font-weight:600;white-space:nowrap}
  .meta{color:#93a39a;font-size:.8rem;margin:4px 0 10px}
  .err{color:#ef8d83;font-size:.85rem;background:#2a1614;border-radius:8px;padding:8px 10px;margin:0 0 10px}
  table{width:100%;border-collapse:collapse;font-size:.84rem}
  th{text-align:left;color:#6b7a72;font-size:.68rem;text-transform:uppercase;letter-spacing:.05em;padding:4px 8px;border-bottom:1px solid #243029}
  td{padding:7px 8px;border-bottom:1px solid #1a221d}
  td.ref{color:#93a39a}
  .rodape{color:#6b7a72;font-size:.72rem;text-align:center;margin-top:20px}
</style></head><body>
<div class="wrap">
  <div class="top">
    <h1>Saúde dos crons</h1>
    <span class="geral">${cabecalho}</span>
  </div>
  <p class="contexto">${aoVivo ? `🔴 Competição a decorrer${comp ? " (" + esc(comp) + ")" : ""} — os crons ao vivo são vigiados de perto.` : "Sem competição a decorrer — os crons ao vivo estão em repouso."}</p>
  ${jobs.map(cartaoJob).join("")}
  <p class="rodape">Atualiza sozinho a cada 60s · Ippon League</p>
</div>
</body></html>`;
}
