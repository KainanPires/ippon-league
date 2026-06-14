// app/api/inspecionar-rondas/route.ts
//
// ROTA TEMPORÁRIA DE INVESTIGAÇÃO — descobrir que vocabulário a API do JudoBase
// usa para as RONDAS (round / round_name) de cada luta de uma competição.
// Serve para corrigir o nomeRonda do /api/atleta-rodada (rótulos das fases:
// round of N, quartas, semi, repescagem, bronze, final).
//
// Uso: /api/inspecionar-rondas?comp=3295
// Devolve, por luta: round, round_name, contest_code, id_winner, e os dois ids.
// Agrupa também uma CONTAGEM por (round + round_name) para vermos o "alfabeto"
// de rondas que esta competição usa, sem ruído.
//
// REMOVER esta rota depois de fechar os rótulos.
import { NextResponse } from "next/server";
import { getCompetitionContests } from "@/lib/ijf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const comp = (searchParams.get("comp") || "").trim();
  if (!comp) {
    return NextResponse.json({ erro: "Falta o parâmetro comp." }, { status: 400 });
  }

  let contests;
  try {
    contests = await getCompetitionContests(comp);
  } catch (e) {
    return NextResponse.json({ erro: "Falha ao buscar contests.", detalhe: String(e) });
  }

  if (!contests || contests.length === 0) {
    return NextResponse.json({ comp, n_lutas: 0, vocabulario: [], lutas: [] });
  }

  // "Alfabeto" de rondas: contagem por (round | round_name | round_code).
  const conta = new Map<string, number>();
  for (const f of contests) {
    const c = f as unknown as Record<string, unknown>;
    const chave = `round=${String(c.round ?? "")} | round_name=${String((c as Record<string, unknown>).round_name ?? "")} | round_code=${String(c.round_code ?? "")}`;
    conta.set(chave, (conta.get(chave) ?? 0) + 1);
  }
  const vocabulario = [...conta.entries()]
    .map(([combinacao, n]) => ({ combinacao, n_lutas: n }))
    .sort((a, b) => b.n_lutas - a.n_lutas);

  // Detalhe luta a luta (campos crus relevantes para a ronda).
  const lutas = contests.map((f) => {
    const c = f as unknown as Record<string, unknown>;
    return {
      id_fight: String(c.id_fight ?? ""),
      round: String(c.round ?? ""),
      round_name: String((c as Record<string, unknown>).round_name ?? ""),
      round_code: String(c.round_code ?? ""),
      contest_code: String(c.contest_code ?? ""),
      id_weight: String(c.id_weight ?? ""),
      id_person_blue: String(c.id_person_blue ?? ""),
      id_person_white: String(c.id_person_white ?? ""),
      id_winner: String(c.id_winner ?? ""),
    };
  });

  return NextResponse.json({
    comp,
    n_lutas: contests.length,
    nota: "vocabulario = combinações distintas de round/round_name/round_code nesta competição. lutas = detalhe cru de cada combate.",
    vocabulario,
    lutas,
  });
}
