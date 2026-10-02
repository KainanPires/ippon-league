// app/api/admin/mais-escalados/route.ts
//
// "O TIME MAIS ESCALADO DA RODADA" (estilo Cartola) — para CONTEÚDO/mídia.
//
// Agrega as equipas de uma competição e devolve os atletas MAIS ESCOLHIDOS por
// toda a gente: quantas escalações cada um tem, a % de equipas que o meteram, e
// o capitão mais escolhido. Os 8 primeiros são o "time mais escalado" da rodada.
//
// GET /api/admin/mais-escalados?key=<CRON_SECRET>[&comp=<id>][&n=20][&html=1]
//   comp  — competição; por omissão, a competição da semana.
//   n     — quantos atletas listar (default 20). Os 8 primeiros são o "time".
//   html=1 — página pronta para ver no telemóvel e tirar print (senão, JSON).
//
// ADMIN-ONLY por CRON_SECRET: NÃO é público. É dado de bastidor para o fundador
// decidir sobre quem falar — mostrar "mais escalados" aos jogadores com o mercado
// aberto deixaria copiar a maioria (fica para uma decisão de produto, se quiser).
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { CALENDARIO_2026, competicaoDaSemana } from "@/lib/calendario";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface AtletaMeta { name: string; countryIso: string; category: string; gender: string }
interface LinhaRank { id: string; nome: string; pais: string; categoria: string; escolhas: number; pct: number; capitao: number; capitaoPct: number }

function esc(v: unknown): string {
  return String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** id -> metadados do atleta, a partir do atletas_cache (lista de inscritos). */
async function metaDosAtletas(comp: string): Promise<Map<string, AtletaMeta>> {
  const mapa = new Map<string, AtletaMeta>();
  if (!supabaseAdmin) return mapa;
  try {
    const { data } = await supabaseAdmin
      .from("atletas_cache").select("atletas").eq("id_competition", comp).maybeSingle();
    const lista = Array.isArray(data?.atletas) ? (data!.atletas as Array<Record<string, unknown>>) : [];
    for (const a of lista) {
      if (a?.id == null) continue;
      mapa.set(String(a.id), {
        name: a.name != null ? String(a.name) : "",
        countryIso: a.countryIso != null ? String(a.countryIso) : "",
        category: a.category != null ? String(a.category) : "",
        gender: a.gender != null ? String(a.gender) : "",
      });
    }
  } catch { /* sem cache: os nomes caem para o id */ }
  // Recurso extra: se o cache estiver vazio, tenta os nomes já congelados.
  if (mapa.size === 0) {
    try {
      const { data } = await supabaseAdmin
        .from("resultados_atletas").select("id_person, nome, country_code, weight_category, gender").eq("id_competicao", comp);
      for (const r of data || []) {
        mapa.set(String(r.id_person), {
          name: r.nome != null ? String(r.nome) : "",
          countryIso: r.country_code != null ? String(r.country_code) : "",
          category: r.weight_category != null ? String(r.weight_category) : "",
          gender: r.gender != null ? String(r.gender) : "",
        });
      }
    } catch { /* fica com o id */ }
  }
  return mapa;
}

export async function GET(req: Request) {
  if (!supabaseAdmin) return NextResponse.json({ ok: false, erro: "Servidor sem ligação." }, { status: 500 });
  const { searchParams } = new URL(req.url);
  const key = searchParams.get("key") || "";
  if (!process.env.CRON_SECRET || key !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, erro: "Não autorizado." }, { status: 401 });
  }

  const comp = (searchParams.get("comp") || "").trim() || competicaoDaSemana(new Date()).idCompeticao;
  const n = Math.max(8, Math.min(50, parseInt(searchParams.get("n") || "20", 10) || 20));
  const html = searchParams.get("html") === "1";
  const entrada = CALENDARIO_2026.find((c) => c.idCompeticao === comp);
  const nomeComp = entrada?.nomeCompleto || entrada?.nome || `Competição ${comp}`;

  // 1) Equipas desta competição.
  const { data: equipas } = await supabaseAdmin
    .from("equipas").select("atletas, capitao").eq("id_competicao", comp);
  const lista = equipas || [];
  const totalTimes = lista.length;

  // 2) Contagem de escolhas (e de capitão) por atleta.
  const escolhas = new Map<string, number>();
  const capitaes = new Map<string, number>();
  for (const e of lista) {
    const ids = Array.isArray(e.atletas) ? (e.atletas as unknown[]).map(String) : [];
    const vistos = new Set<string>(); // uma equipa conta 1x por atleta
    for (const id of ids) {
      if (!id || vistos.has(id)) continue;
      vistos.add(id);
      escolhas.set(id, (escolhas.get(id) ?? 0) + 1);
    }
    const cap = e.capitao ? String(e.capitao) : "";
    if (cap) capitaes.set(cap, (capitaes.get(cap) ?? 0) + 1);
  }

  // 3) Nomes.
  const meta = await metaDosAtletas(comp);
  const nomeDe = (id: string) => meta.get(id)?.name || `#${id}`;

  // 4) Ranking.
  const pct = (x: number) => (totalTimes > 0 ? Math.round((x / totalTimes) * 1000) / 10 : 0);
  const ranking: LinhaRank[] = [...escolhas.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([id, c]) => ({
      id,
      nome: nomeDe(id),
      pais: meta.get(id)?.countryIso || "",
      categoria: meta.get(id)?.category || "",
      escolhas: c,
      pct: pct(c),
      capitao: capitaes.get(id) ?? 0,
      capitaoPct: pct(capitaes.get(id) ?? 0),
    }));

  const topCapitaes = [...capitaes.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([id, c]) => ({ id, nome: nomeDe(id), pais: meta.get(id)?.countryIso || "", categoria: meta.get(id)?.category || "", escolhas: c, pct: pct(c) }));

  const payload = {
    ok: true,
    comp,
    nome_competicao: nomeComp,
    total_times: totalTimes,
    time_mais_escalado: ranking.slice(0, 8), // os 8 do "time"
    ranking,                                  // top N completo
    top_capitaes: topCapitaes,
  };

  if (!html) return NextResponse.json(payload);

  // ---- Página HTML (abrir no telemóvel, tirar print) ----
  const linha = (r: LinhaRank, i: number) => `
    <tr${i < 8 ? ' class="top8"' : ""}>
      <td class="pos">${i + 1}</td>
      <td class="nome">${esc(r.nome)}${r.pais ? ` <span class="pais">${esc(r.pais)}</span>` : ""}</td>
      <td class="cat">${esc(r.categoria)}</td>
      <td class="num">${r.escolhas}</td>
      <td class="num pct">${r.pct}%</td>
      <td class="num cap">${r.capitao}${r.capitao ? ` <span class="pais">(${r.capitaoPct}%)</span>` : ""}</td>
    </tr>`;
  const capLinha = (r: { nome: string; pais: string; categoria: string; escolhas: number; pct: number }, i: number) => `
    <tr><td class="pos">${i + 1}</td><td class="nome">${esc(r.nome)}${r.pais ? ` <span class="pais">${esc(r.pais)}</span>` : ""}</td><td class="cat">${esc(r.categoria)}</td><td class="num">${r.escolhas}</td><td class="num pct">${r.pct}%</td></tr>`;

  const page = `<!doctype html><html lang="pt"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Mais escalados</title>
<style>
  :root{--bg:#0c0e0d;--card:#121815;--line:#243029;--gold:#d9a441;--txt:#f1ede2;--dim:#93a39a}
  *{box-sizing:border-box} body{margin:0;background:var(--bg);color:var(--txt);font:15px/1.4 system-ui,-apple-system,sans-serif;padding:16px}
  h1{font-size:18px;margin:0 0 2px} .sub{color:var(--dim);font-size:13px;margin:0 0 4px}
  .tot{color:var(--gold);font-weight:700;font-size:14px;margin:0 0 14px}
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
  <h1>Time mais escalado</h1>
  <p class="sub">${esc(nomeComp)} · comp ${esc(comp)}</p>
  <p class="tot">${totalTimes} equipa(s) escalada(s)</p>
  ${totalTimes === 0 ? '<p class="sub">Ainda ninguém escalou nesta competição.</p>' : `
  <h2>Os 8 + mais escolhidos</h2>
  <table><thead><tr><th>#</th><th>Atleta</th><th>Cat.</th><th>Escal.</th><th>%</th><th>Cap.</th></tr></thead>
  <tbody>${ranking.map(linha).join("")}</tbody></table>
  ${topCapitaes.length ? `<h2>Capitães mais escolhidos</h2>
  <table><thead><tr><th>#</th><th>Atleta</th><th>Cat.</th><th>Vezes</th><th>%</th></tr></thead>
  <tbody>${topCapitaes.map(capLinha).join("")}</tbody></table>` : ""}`}
  <p class="foot">As 8 primeiras linhas (destacadas) são o “time mais escalado” da rodada. % = sobre o total de equipas. Admin — não partilhar com o link à vista.</p>
</body></html>`;
  return new NextResponse(page, { headers: { "content-type": "text/html; charset=utf-8" } });
}
