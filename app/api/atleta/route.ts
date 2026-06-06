import { NextResponse } from "next/server";
import { contestActionsForPerson, type IjfContest } from "@/lib/ijf";
import type { ActionType } from "@/lib/engine";

// Balcão de TESTE do 3D-1: histórico real de UM atleta.
// /api/atleta?id=ID_PERSON   (ex.: /api/atleta?id=7350)
// Mede quantos pedidos faz e quanto tempo demora — para sabermos o custo de escalar.
export const dynamic = "force-dynamic";

const IJF = "https://data.ijf.org/api/get_json";
const TIMEOUT_MS = 15000;

// Tabela de pontos do jogo (a mesma do engine; aqui local para o teste ser autónomo).
const POINTS: Record<ActionType, number> = {
  ippon_feito: 10,
  waza_ari_feito: 4,
  yuko_feito: 2,
  shido_provocado: 1,
  ippon_sofrido: -5,
  waza_ari_sofrido: -2,
  yuko_sofrido: -1,
  shido_recebido: -2,
  hansoku_make_recebido: -10,
};

function buildUrl(action: string, params: Record<string, string>): string {
  const qs = Object.entries(params)
    .map(([k, v]) => `&params%5B${k}%5D=${encodeURIComponent(v)}`)
    .join("");
  return `${IJF}?access_token=&params%5Baction%5D=${action}${qs}`;
}

async function callRaw(action: string, params: Record<string, string>): Promise<{ ok: boolean; data: any; nota?: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(buildUrl(action, params), {
      cache: "no-store",
      signal: ctrl.signal,
      headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 (IpponLeague)" },
    });
    const text = await res.text();
    clearTimeout(timer);
    if (text.includes("unknown action")) return { ok: false, data: null, nota: "ação desconhecida no JudoBase" };
    try {
      return { ok: true, data: JSON.parse(text) };
    } catch {
      return { ok: false, data: null, nota: "resposta não é JSON: " + text.slice(0, 120) };
    }
  } catch (e) {
    clearTimeout(timer);
    return { ok: false, data: null, nota: "erro/timeout: " + ((e as { message?: string })?.message || "?") };
  }
}

// Tenta encontrar a lista de lutas dentro da resposta, seja qual for a forma.
function extractFights(data: any): IjfContest[] {
  if (Array.isArray(data)) return data as IjfContest[];
  if (data && typeof data === "object") {
    if (Array.isArray(data.contests)) return data.contests as IjfContest[];
    if (Array.isArray(data.fights)) return data.fights as IjfContest[];
    // procura a primeira propriedade que seja um array de objetos
    for (const k of Object.keys(data)) {
      const v = (data as Record<string, unknown>)[k];
      if (Array.isArray(v) && v.length > 0 && typeof v[0] === "object") return v as IjfContest[];
    }
  }
  return [];
}

function pontosDaLuta(f: IjfContest, idPerson: string): number {
  const acoes = contestActionsForPerson(f, idPerson);
  return acoes.reduce((s, a) => s + (POINTS[a] ?? 0), 0);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({
      erro: "Falta o id do atleta. Usa /api/atleta?id=7350",
      sugestoes: { Nagayama: "7350", Khalmatov: "18231", Aghayev: "20144" },
    });
  }

  const t0 = Date.now();
  const r = await callRaw("competitor.contests", { id_person: id });
  const ms = Date.now() - t0;

  if (!r.ok) {
    return NextResponse.json({ id_person: id, pedidos: 1, ms, sucesso: false, nota: r.nota });
  }

  const fights = extractFights(r.data);

  // Agrupa por competição e soma os pontos do atleta em cada uma.
  const porComp = new Map<string, { lutas: number; pontos: number }>();
  for (const f of fights) {
    const comp = String(f.id_competition ?? "—");
    const cur = porComp.get(comp) || { lutas: 0, pontos: 0 };
    cur.lutas += 1;
    cur.pontos += pontosDaLuta(f, id);
    porComp.set(comp, cur);
  }

  const lista = Array.from(porComp.entries())
    .map(([id_competition, v]) => ({ id_competition, lutas: v.lutas, pontos: Math.round(v.pontos * 10) / 10 }))
    .sort((a, b) => Number(b.id_competition) - Number(a.id_competition)); // mais recente (id maior) primeiro

  const pontosTotais = lista.reduce((s, c) => s + c.pontos, 0);
  const media = lista.length > 0 ? Math.round((pontosTotais / lista.length) * 10) / 10 : 0;
  const ultima = lista.length > 0 ? lista[0].pontos : 0;

  return NextResponse.json({
    id_person: id,
    sucesso: true,
    pedidos: 1,
    ms,
    total_lutas: fights.length,
    total_competicoes: lista.length,
    pontos_totais: Math.round(pontosTotais * 10) / 10,
    media_por_competicao: media,
    ultima_competicao_pontos: ultima,
    por_competicao: lista.slice(0, 12),
    // amostra crua para vermos os nomes reais dos campos de uma luta:
    chaves_topo: r.data && typeof r.data === "object" && !Array.isArray(r.data) ? Object.keys(r.data) : "(array)",
    amostra_luta: fights[0] ?? null,
  });
}
