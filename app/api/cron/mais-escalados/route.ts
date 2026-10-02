// app/api/cron/mais-escalados/route.ts
//
// CRON DOS "MAIS ESCALADOS" — recalcula e GUARDA os agregados de escalação.
// De hora a hora mantém fresco: a competição da semana, o mês atual e o ano
// inteiro. Depois a rota admin lê do cache (instantâneo).
//
// É um cron À PARTE do /api/cron de propósito: aquele é o motor pesado
// (congelar + preços, teto de 300s). Este é leve (só conta escalações), isolado,
// e se falhar não arrasta o motor. Idempotente: reescreve sempre as mesmas 3
// linhas da tabela, por isso correr de hora a hora não duplica nada.
//
// GET /api/cron/mais-escalados?key=<CRON_SECRET>
//
// AGENDAR no cron-job.org (de hora a hora, com o www., senão dá 308):
//   https://www.ipponleague.com/api/cron/mais-escalados?key=SEGREDO
import { NextResponse } from "next/server";
import { competicaoDaSemana } from "@/lib/calendario";
import { calcularEscalacoes, guardarAgregado, compsDoAno, compsDoMes } from "@/lib/escalacaoAgregada";
import { registarCorrida } from "@/lib/cronLog";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const key = (searchParams.get("key") || "").trim();
  // Aceita também o cabeçalho da Vercel (como o /api/cron), além do ?key=.
  const auth = req.headers.get("authorization") || "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  const segredo = process.env.CRON_SECRET || "";
  if (!segredo || (key !== segredo && bearer !== segredo)) {
    return NextResponse.json({ ok: false, erro: "Não autorizado." }, { status: 401 });
  }

  const t0 = Date.now();
  const feitos: Record<string, number> = {};
  try {
    const hoje = new Date();
    const comp = competicaoDaSemana(hoje);
    const ano = hoje.getUTCFullYear();
    const anoMes = `${ano}-${String(hoje.getUTCMonth() + 1).padStart(2, "0")}`;

    // 1) Competição da semana — o "time mais escalado" desta rodada (com %).
    const aComp = await calcularEscalacoes({
      escopo: "comp", chave: `comp:${comp.idCompeticao}`, rotulo: comp.nome,
      comps: [comp.idCompeticao], n: 20,
    });
    await guardarAgregado(aComp);
    feitos[aComp.chave] = aComp.total_times;

    // 2) Mês atual — acumulado das competições do mês (para matéria mensal).
    const aMes = await calcularEscalacoes({
      escopo: "mes", chave: `mes:${anoMes}`, rotulo: anoMes,
      comps: compsDoMes(anoMes), n: 20,
    });
    await guardarAgregado(aMes);
    feitos[aMes.chave] = aMes.total_times;

    // 3) Ano — o "time do ano" (os mais escalados de toda a temporada).
    const aAno = await calcularEscalacoes({
      escopo: "ano", chave: `ano:${ano}`, rotulo: String(ano),
      comps: compsDoAno(ano), n: 20,
    });
    await guardarAgregado(aAno);
    feitos[aAno.chave] = aAno.total_times;

    try {
      const msTotal = Date.now() - t0;
      await registarCorrida({
        job: "mais_escalados",
        ms: msTotal,
        iniciadoMs: t0,
        observados: { "mais_escalados.duracao_ms": msTotal },
        resumo: feitos,
      });
    } catch { /* observabilidade nunca bloqueia o cron */ }

    return NextResponse.json({ ok: true, feitos });
  } catch (e) {
    try {
      await registarCorrida({
        job: "mais_escalados",
        ms: Date.now() - t0,
        iniciadoMs: t0,
        observados: { "mais_escalados.duracao_ms": Date.now() - t0 },
        erro: String(e),
        resumo: feitos,
      });
    } catch { /* idem */ }
    console.error("[cron/mais-escalados]", e);
    return NextResponse.json({ ok: false, erro: "Falha na corrida." }, { status: 500 });
  }
}
