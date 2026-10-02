// app/api/admin/mais-escalados/route.ts
//
// "O TIME MAIS ESCALADO" (estilo Cartola) — para CONTEÚDO/mídia.
//
// Mostra os atletas MAIS ESCOLHIDOS por toda a gente: quantas escalações cada um
// tem, a % de equipas que o meteram, e o capitão mais escolhido. Os 8 primeiros
// são o "time mais escalado".
//
// Três escopos:
//   escopo=comp  (por omissão) — uma competição (a da semana, ou ?comp=<id>).
//   escopo=mes   — acumulado do mês (?mes=AAAA-MM; por omissão, o mês atual).
//   escopo=ano   — o "time do ano" (?ano=AAAA; por omissão, o ano atual).
//
// GET /api/admin/mais-escalados?key=<CRON_SECRET>
//     [&escopo=comp|mes|ano][&comp=<id>][&mes=AAAA-MM][&ano=AAAA][&fresco=1][&html=1]
//   fresco=1 — ignora o cache e calcula ao vivo (senão lê o que o cron guardou).
//   html=1   — página pronta para telemóvel/print (senão, JSON).
//
// ADMIN-ONLY por CRON_SECRET: NÃO é público. Mostrar "mais escalados" aos
// jogadores com o mercado ABERTO deixaria copiar a maioria — fica como decisão
// de produto (uma aba pública só faz sentido depois de o mercado fechar).
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { competicaoDaSemana, CALENDARIO_2026 } from "@/lib/calendario";
import {
  calcularEscalacoes, lerAgregado, guardarAgregado,
  compsDoAno, compsDoMes, type AgregadoEscalacao, type LinhaEscalacao,
} from "@/lib/escalacaoAgregada";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function esc(v: unknown): string {
  return String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function GET(req: Request) {
  if (!supabaseAdmin) return NextResponse.json({ ok: false, erro: "Servidor sem ligação." }, { status: 500 });
  const { searchParams } = new URL(req.url);
  const key = searchParams.get("key") || "";
  if (!process.env.CRON_SECRET || key !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, erro: "Não autorizado." }, { status: 401 });
  }

  const escopo = (searchParams.get("escopo") || "comp").toLowerCase() as "comp" | "mes" | "ano";
  const fresco = searchParams.get("fresco") === "1";
  const html = searchParams.get("html") === "1";
  const n = Math.max(8, Math.min(50, parseInt(searchParams.get("n") || "20", 10) || 20));
  const hoje = new Date();

  // Resolve o escopo -> chave, rótulo e lista de competições.
  let chave: string, rotulo: string, comps: string[];
  if (escopo === "ano") {
    const ano = parseInt(searchParams.get("ano") || "", 10) || hoje.getUTCFullYear();
    chave = `ano:${ano}`; rotulo = String(ano); comps = compsDoAno(ano);
  } else if (escopo === "mes") {
    const mes = (searchParams.get("mes") || "").trim()
      || `${hoje.getUTCFullYear()}-${String(hoje.getUTCMonth() + 1).padStart(2, "0")}`;
    chave = `mes:${mes}`; rotulo = mes; comps = compsDoMes(mes);
  } else {
    const comp = (searchParams.get("comp") || "").trim() || competicaoDaSemana(hoje).idCompeticao;
    const entrada = CALENDARIO_2026.find((c) => c.idCompeticao === comp);
    chave = `comp:${comp}`;
    rotulo = entrada?.nome || `Competição ${comp}`;
    comps = [comp];
  }

  // Lê do cache; se não houver (ou ?fresco=1), calcula ao vivo e guarda.
  let agg: AgregadoEscalacao | null = fresco ? null : await lerAgregado(chave);
  let doCache = !!agg;
  if (!agg) {
    agg = await calcularEscalacoes({ escopo, chave, rotulo, comps, n });
    guardarAgregado(agg).catch(() => {});
    doCache = false;
  }

  if (!html) return NextResponse.json({ ok: true, do_cache: doCache, ...agg });

  // ---- Página HTML (abrir no telemóvel, tirar print) ----
  const porAno = escopo !== "comp"; // ano/mês mostram "competições" em vez de %
  const ranking = agg.ranking.slice(0, n);
  const linha = (r: LinhaEscalacao, i: number) => `
    <tr${i < 8 ? ' class="top8"' : ""}>
      <td class="pos">${i + 1}</td>
      <td class="nome">${esc(r.nome)}${r.pais ? ` <span class="pais">${esc(r.pais)}</span>` : ""}</td>
      <td class="cat">${esc(r.categoria)}</td>
      <td class="num">${r.escolhas}</td>
      ${porAno
        ? `<td class="num">${r.competicoes}</td>`
        : `<td class="num pct">${r.pct}%</td>`}
      <td class="num cap">${r.capitao}${r.capitao ? ` <span class="pais">(${r.capitaoPct}%)</span>` : ""}</td>
    </tr>`;
  const capLinha = (r: LinhaEscalacao, i: number) => `
    <tr><td class="pos">${i + 1}</td><td class="nome">${esc(r.nome)}${r.pais ? ` <span class="pais">${esc(r.pais)}</span>` : ""}</td><td class="cat">${esc(r.categoria)}</td><td class="num">${r.capitao}</td></tr>`;

  const titulo = escopo === "ano" ? "Time do ano" : escopo === "mes" ? "Time do mês" : "Time mais escalado";
  const colEscal = porAno ? "Escal." : "Escal.";
  const col3 = porAno ? "Comp." : "%";
  const atual = new Date(agg.atualizado_em);
  const quando = isNaN(atual.getTime()) ? "" : atual.toISOString().replace("T", " ").slice(0, 16) + " UTC";

  const page = `<!doctype html><html lang="pt"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Mais escalados</title>
<style>
  :root{--bg:#0c0e0d;--card:#121815;--line:#243029;--gold:#d9a441;--txt:#f1ede2;--dim:#93a39a}
  *{box-sizing:border-box} body{margin:0;background:var(--bg);color:var(--txt);font:15px/1.4 system-ui,-apple-system,sans-serif;padding:16px}
  h1{font-size:18px;margin:0 0 2px} .sub{color:var(--dim);font-size:13px;margin:0 0 4px}
  .tot{color:var(--gold);font-weight:700;font-size:14px;margin:0 0 6px}
  .nav{display:flex;gap:8px;margin:0 0 14px;flex-wrap:wrap}
  .nav a{font-size:12px;color:var(--dim);border:1px solid var(--line);border-radius:999px;padding:4px 11px;text-decoration:none}
  .nav a.on{color:var(--bg);background:var(--gold);border-color:var(--gold);font-weight:700}
  h2{font-size:14px;text-transform:uppercase;letter-spacing:.05em;color:var(--gold);margin:18px 0 6px}
  table{width:100%;border-collapse:collapse;background:var(--card);border:1px solid var(--line);border-radius:12px;overflow:hidden}
  th,td{padding:8px 9px;text-align:left;font-size:13px;border-bottom:1px solid var(--line)}
  th{color:var(--dim);font-weight:600;text-transform:uppercase;font-size:10.5px;letter-spacing:.04em}
  tr:last-child td{border-bottom:none}
  .pos{color:var(--dim);width:26px;text-align:center}
  .num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap} .pct{color:var(--gold);font-weight:700} .cap{color:var(--dim)}
  .cat{color:var(--dim);white-space:nowrap} .pais{color:var(--dim);font-size:11px}
  tr.top8 td{background:rgba(217,164,65,.07)} tr.top8 .nome{font-weight:700}
  .foot{color:var(--dim);font-size:11px;margin-top:14px}
</style></head><body>
  <h1>${esc(titulo)}</h1>
  <p class="sub">${esc(agg.rotulo)}${escopo === "comp" ? ` · comp ${esc(comps[0] || "")}` : ""}</p>
  <p class="tot">${agg.total_times} escalação(ões)${quando ? ` · atualizado ${esc(quando)}` : ""}${doCache ? "" : " · ao vivo"}</p>
  <div class="nav">
    <a href="?key=${esc(key)}&escopo=comp&html=1"${escopo === "comp" ? ' class="on"' : ""}>Rodada</a>
    <a href="?key=${esc(key)}&escopo=mes&html=1"${escopo === "mes" ? ' class="on"' : ""}>Mês</a>
    <a href="?key=${esc(key)}&escopo=ano&html=1"${escopo === "ano" ? ' class="on"' : ""}>Ano</a>
    <a href="?key=${esc(key)}&escopo=${esc(escopo)}&html=1&fresco=1">↻ recalcular</a>
  </div>
  ${agg.total_times === 0 ? '<p class="sub">Ainda ninguém escalou neste período.</p>' : `
  <h2>Os ${Math.min(8, ranking.length)} + mais escolhidos</h2>
  <table><thead><tr><th>#</th><th>Atleta</th><th>Cat.</th><th>${colEscal}</th><th>${col3}</th><th>Cap.</th></tr></thead>
  <tbody>${ranking.map(linha).join("")}</tbody></table>
  ${agg.top_capitaes.length ? `<h2>Capitães mais escolhidos</h2>
  <table><thead><tr><th>#</th><th>Atleta</th><th>Cat.</th><th>Vezes</th></tr></thead>
  <tbody>${agg.top_capitaes.map(capLinha).join("")}</tbody></table>` : ""}`}
  <p class="foot">As 8 primeiras linhas (destacadas) são o "${esc(titulo.toLowerCase())}". ${porAno ? '"Comp." = em quantas competições foi escalado.' : '% = sobre o total de equipas da rodada.'} Admin — não partilhar com o link à vista.</p>
</body></html>`;
  return new NextResponse(page, { headers: { "content-type": "text/html; charset=utf-8" } });
}
