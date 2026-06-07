import { NextResponse } from "next/server";
import { competicaoDaSemana, type SemanaCalendario } from "@/lib/calendario";
import { getCompetitionCompetitorsRaw, mapCompetitorsToAthletes } from "@/lib/ijf";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// CRON — prepara sozinho os preços/forma da competição que se aproxima.
// Corre 1x/dia (vercel.json). Com Fluid Compute, uma função corre até 300s — as
// 14 categorias (~18s cada ≈ 252s) cabem numa só execução, em sequência.
//
//   /api/cron                  -> prepara a competição que se aproxima (14 categorias)
//   /api/cron?comp=ID          -> força uma competição específica
//   /api/cron?key=SEGREDO      -> disparo MANUAL para teste (em vez do cabeçalho da Vercel)
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

// Aceita o segredo por cabeçalho (Vercel) OU por ?key= (teste manual).
function autorizado(req: Request, key: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  if (key && key === secret) return true;
  const auth = req.headers.get("authorization") || "";
  return auth === `Bearer ${secret}`;
}

function baseUrl(req: Request): string {
  // Preferir o host do PRÓPRIO pedido (domínio público correto, ex.:
  // ippon-league.vercel.app). O VERCEL_URL aponta para o URL interno do
  // deployment, que pode devolver uma página HTML de redirecionamento em vez
  // do JSON — foi o que causou o erro "Unexpected token '<'".
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
  // a "semana" da competição vai do início até 6 dias depois
  const fim = new Date(ini.getTime() + 6 * 86400000);
  return hoje >= ini && hoje <= fim;
}

// Guarda (ou limpa) a lista de IDs de quem está a competir agora.
async function atualizarAoVivo(hoje: Date): Promise<{ ao_vivo: string | null; atletas_ao_vivo: number }> {
  if (!supabaseAdmin) return { ao_vivo: null, atletas_ao_vivo: 0 };

  const atual = competicaoDaSemana(hoje);
  const aDecorrer = jaComecou(atual, hoje);

  if (!aDecorrer) {
    // Não há competição a decorrer → limpa a linha para o Mercado não avisar à toa.
    await supabaseAdmin.from("atletas_cache").upsert(
      {
        id_competition: CHAVE_AO_VIVO,
        atletas: [],
        total: 0,
        atualizado_em: new Date().toISOString(),
      },
      { onConflict: "id_competition" }
    );
    return { ao_vivo: null, atletas_ao_vivo: 0 };
  }

  // Há competição a decorrer → busca os inscritos e guarda só os IDs.
  const raw = await getCompetitionCompetitorsRaw(atual.idCompeticao);
  const atletas = mapCompetitorsToAthletes(raw);
  const ids = atletas.map((a) => a.id).filter(Boolean);

  // Guarda um objeto leve: id e nome da competição + lista de IDs.
  const payload = {
    id_competicao: atual.idCompeticao,
    nome: atual.nome,
    ids,
  };

  await supabaseAdmin.from("atletas_cache").upsert(
    {
      id_competition: CHAVE_AO_VIVO,
      atletas: payload,
      total: ids.length,
      atualizado_em: new Date().toISOString(),
    },
    { onConflict: "id_competition" }
  );

  return { ao_vivo: atual.nome, atletas_ao_vivo: ids.length };
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
    const catUrl = encodeURIComponent(cat); // "+100" -> "%2B100"
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

  return NextResponse.json({
    feito: true,
    comp,
    competicao: alvo ? alvo.nome : "(forçada por id)",
    classico: alvo ? alvo.classico : undefined,
    a_competir_agora: aoVivo.ao_vivo,
    atletas_a_competir_agora: aoVivo.atletas_ao_vivo,
    categorias_ok: `${ok}/${CATS.length}`,
    total_atletas_atualizados: totalAtualizados,
    ms_total: Date.now() - t0,
    passos,
  });
}
