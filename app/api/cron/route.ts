import { NextResponse } from "next/server";
import { competicaoDaSemana, type SemanaCalendario } from "@/lib/calendario";

// CRON — prepara sozinho os preços/forma da competição que se aproxima.
// Corre 1x/dia (configurado no vercel.json). Graças ao Fluid Compute da Vercel,
// uma função pode correr até 300s — as 14 categorias (~18s cada ≈ 252s) cabem
// todas numa só execução, em sequência. Sem encadeamento, simples e fiável.
//
//   /api/cron            -> prepara a competição que se aproxima (14 categorias)
//   /api/cron?comp=ID    -> força uma competição específica (útil para clássicos)
//
// Protegido por CRON_SECRET: o pedido tem de trazer
// "Authorization: Bearer <CRON_SECRET>". A Vercel envia-o automaticamente.
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// As 14 categorias, na ordem em que são processadas (7 masculinas + 7 femininas).
const CATS: { cat: string; gender: "M" | "F" }[] = [
  { cat: "-60", gender: "M" }, { cat: "-66", gender: "M" }, { cat: "-73", gender: "M" },
  { cat: "-81", gender: "M" }, { cat: "-90", gender: "M" }, { cat: "-100", gender: "M" },
  { cat: "+100", gender: "M" },
  { cat: "-48", gender: "F" }, { cat: "-52", gender: "F" }, { cat: "-57", gender: "F" },
  { cat: "-63", gender: "F" }, { cat: "-70", gender: "F" }, { cat: "-78", gender: "F" },
  { cat: "+78", gender: "F" },
];

// Verifica o segredo. Sem CRON_SECRET definido, recusa (mais seguro).
function autorizado(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization") || "";
  return auth === `Bearer ${secret}`;
}

// URL absoluto da própria app (para chamar /api/calcular).
function baseUrl(req: Request): string {
  const fromEnv = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "";
  if (fromEnv) return fromEnv;
  try {
    const u = new URL(req.url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return "";
  }
}

export async function GET(req: Request) {
  if (!autorizado(req)) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const base = baseUrl(req);
  const t0 = Date.now();

  // Que competição preparar: a próxima a contar (do calendário). Pode ser forçada por ?comp.
  let comp = searchParams.get("comp");
  let alvo: SemanaCalendario | null = null;
  if (!comp) {
    alvo = competicaoDaSemana(new Date());
    comp = alvo.idCompeticao;
  }

  // Processa as 14 categorias EM SEQUÊNCIA (uma de cada vez, à espera de cada).
  const passos: Array<{ categoria: string; ok: boolean; atualizados?: number; ms?: number; nota?: string }> = [];
  for (const { cat, gender } of CATS) {
    // O + das categorias (+100/+78) tem de ir como %2B no URL.
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
    categorias_ok: `${ok}/${CATS.length}`,
    total_atletas_atualizados: totalAtualizados,
    ms_total: Date.now() - t0,
    passos,
  });
}
