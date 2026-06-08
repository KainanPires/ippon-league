// app/api/historico/route.ts
//
// EXPECTATIVA DO ATLETA — passo 1e (descoberta do histórico).
//
// Para valorizar um atleta precisamos da sua EXPECTATIVA de desempenho:
//   70% media dos ultimos 12 meses + 30% media das ultimas 3 competicoes  (engine.ts)
//
// Esta rota vai buscar o historico de lutas de UM atleta (getCompetitorContests),
// agrupa por competicao, soma os pontos de cada uma e mostra as medias — para
// vermos, com dados reais, se conseguimos calcular a expectativa a partir daqui.
// NAO grava nada. E so inspecao, com um atleta, antes de fazer para todos.
//
// Uso: /api/historico?atleta=72823   (Zhuang Wenna)

import { NextResponse } from "next/server";
import { getCompetitorContests, contestActionsForPerson } from "@/lib/ijf";
import { scoreActions, expectedPerformance } from "@/lib/engine";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const round1 = (n: number) => Math.round(n * 10) / 10;

// "2026-02-07 07:40:00" -> Date (UTC). Aceita varios campos de data.
function dataDaLuta(f: any): Date | null {
  const s = String(f.start ?? f.start_planned ?? f.date ?? f.competition_date ?? "").trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const atleta = searchParams.get("atleta");
  if (!atleta) {
    return NextResponse.json(
      { erro: "Falta ?atleta=<id_person>. Ex.: /api/historico?atleta=72823" },
      { status: 400 }
    );
  }

  const contests = (await getCompetitorContests(atleta)) as any[];
  if (contests.length === 0) {
    return NextResponse.json({
      atleta,
      total_lutas: 0,
      mensagem: "Sem historico de lutas para este atleta (ou a API nao devolveu nada).",
    });
  }

  const agora = Date.now();
  const UM_ANO = 365 * 24 * 60 * 60 * 1000;

  // Agrupa as lutas por competicao: soma pontos, conta lutas, guarda a data.
  const porComp = new Map<string, { nome: string; pontos: number; lutas: number; data: Date | null }>();
  for (const f of contests) {
    const idc = String(f.id_competition ?? f.id_competition_id ?? "sem_id");
    const nome = String(f.competition_name ?? f.competition ?? idc);
    const pts = scoreActions(contestActionsForPerson(f, atleta));
    const d = dataDaLuta(f);
    const cur = porComp.get(idc) ?? { nome, pontos: 0, lutas: 0, data: d };
    cur.pontos += pts;
    cur.lutas += 1;
    if (!cur.data && d) cur.data = d;
    porComp.set(idc, cur);
  }

  // Lista de competicoes (pontos = total do atleta nessa competicao), ordenada por data desc.
  const comps = [...porComp.entries()]
    .map(([id, v]) => ({
      id_competition: id,
      nome: v.nome,
      data: v.data ? v.data.toISOString().slice(0, 10) : null,
      lutas: v.lutas,
      pontos_na_competicao: v.pontos,
      dentro_12m: v.data ? agora - v.data.getTime() <= UM_ANO : false,
    }))
    .sort((a, b) => String(b.data ?? "").localeCompare(String(a.data ?? "")));

  // Media dos ultimos 12 meses.
  const ult12 = comps.filter((c) => c.dentro_12m);
  const avg12m = ult12.length ? round1(ult12.reduce((s, c) => s + c.pontos_na_competicao, 0) / ult12.length) : 0;

  // Media das ultimas 3 competicoes (por data).
  const ult3 = comps.slice(0, 3);
  const avgLast3 = ult3.length ? round1(ult3.reduce((s, c) => s + c.pontos_na_competicao, 0) / ult3.length) : 0;

  const esperado = round1(expectedPerformance(avg12m, avgLast3));

  return NextResponse.json({
    atleta,
    total_lutas: contests.length,
    n_competicoes: comps.length,
    competicoes: comps.slice(0, 12), // mostra as 12 mais recentes
    media_12m: avg12m,
    n_competicoes_12m: ult12.length,
    media_ultimas_3: avgLast3,
    expectativa_esperada: esperado, // 70% x 12m + 30% x ult3 (engine.expectedPerformance)
    nota:
      "Pontos por competicao = soma das acoes do atleta nessa competicao. Confere se as " +
      "datas e os agrupamentos batem certo. So depois fazemos isto para todos os atletas.",
  });
}
