// app/api/sensei-semanal/route.ts
//
// SELO DE SENSEI — recálculo SEMANAL.
//
// GET /api/sensei-semanal?key=CRON_SECRET          (uma vez por semana)
// GET /api/sensei-semanal?key=CRON_SECRET&seco=1   (ensaio: calcula, não grava)
//
// Dá/renova o selo (users.sensei_ate) aos criadores de ligas de amigos cuja liga
// teve >= 20 membros ativos (montaram equipa nos últimos 7 dias) na semana. Quem
// não qualifica deixa o selo expirar (não se rebaixa à mão). Ver lib/sensei.ts.
//
// CONFIGURAR no cron-job.org (uma vez por semana, com o www.):
//   URL: https://www.ipponleague.com/api/sensei-semanal?key=SEGREDO
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { recalcularSensei } from "@/lib/sensei";
import { registarCorrida } from "@/lib/cronLog";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const key = (searchParams.get("key") || "").trim();
  if (!process.env.CRON_SECRET || key !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, erro: "Não autorizado." }, { status: 401 });
  }
  const admin = supabaseAdmin;
  if (!admin) {
    return NextResponse.json({ ok: false, erro: "Servidor sem ligação." }, { status: 500 });
  }
  const seco = searchParams.get("seco") === "1";
  const t0 = Date.now();
  try {
    const r = await recalcularSensei(admin, new Date(), seco);
    try {
      await registarCorrida({
        job: "sensei_semanal",
        ms: Date.now() - t0,
        iniciadoMs: t0,
        observados: {
          "sensei.duracao_ms": Date.now() - t0,
          "sensei.qualificados": r.criadoresQualificados,
          "sensei.atualizados": r.atualizados,
        },
        resumo: { ...r },
      });
    } catch { /* observabilidade nunca bloqueia o cron */ }
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    try {
      await registarCorrida({
        job: "sensei_semanal",
        ms: Date.now() - t0,
        iniciadoMs: t0,
        observados: { "sensei.duracao_ms": Date.now() - t0 },
        erro: String(e),
      });
    } catch { /* idem */ }
    console.error("[sensei-semanal] corrida falhou:", e);
    return NextResponse.json({ ok: false, erro: "Falha na corrida.", detalhe: String(e) }, { status: 500 });
  }
}
