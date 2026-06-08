// app/api/pontuacao/route.ts
//
// DESCOBERTA DA PONTUAÇÃO — passo 1c (inspeção).
//
// Pega numa competição TERMINADA, escolhe um atleta e mostra, luta a luta, as
// ações reais (do JudoBase) e os pontos pela nossa tabela (lib/engine.ts).
// NÃO grava nada, NÃO mexe na app — é só para confirmarmos que a conta bate certo.
//
// Uso (navegador):
//   /api/pontuacao?comp=3131                 (escolhe o atleta que mais lutou)
//   /api/pontuacao?comp=3131&atleta=72823    (um atleta específico)
//   /api/pontuacao?comp=3131&atleta=72823&capitao=1   (com o x2 de capitão)

import { NextResponse } from "next/server";
import {
  getCompetition,
  getCompetitionContests,
  contestActionsForPerson,
} from "@/lib/ijf";
import { POINTS, scoreActions, scoreAthlete, type ActionType } from "@/lib/engine";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const LABEL: Record<ActionType, string> = {
  ippon_feito: "Ippon feito",
  waza_ari_feito: "Waza-ari feito",
  yuko_feito: "Yuko feito",
  shido_provocado: "Shido provocado no adversario",
  ippon_sofrido: "Ippon sofrido",
  waza_ari_sofrido: "Waza-ari sofrido",
  yuko_sofrido: "Yuko sofrido",
  shido_recebido: "Shido recebido",
  hansoku_make_recebido: "Hansoku-make recebido",
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const comp = searchParams.get("comp");
  let atleta = searchParams.get("atleta");
  const capitao = searchParams.get("capitao") === "1";

  if (!comp) {
    return NextResponse.json(
      { erro: "Falta ?comp=<id_competition>. Ex.: /api/pontuacao?comp=3131" },
      { status: 400 }
    );
  }

  const info = await getCompetition(comp);
  const contests = await getCompetitionContests(comp);
  if (contests.length === 0) {
    return NextResponse.json({
      comp,
      nome: info?.name ?? null,
      erro: "Esta competicao ainda nao tem lutas publicadas. Usa uma ja terminada (ex.: 3131).",
    });
  }

  // Mapa id_person -> nome (os contests trazem person_blue / person_white).
  const nomes = new Map<string, string>();
  for (const f of contests as any[]) {
    const b = String(f.id_person_blue ?? "");
    const w = String(f.id_person_white ?? "");
    if (b) nomes.set(b, String(f.person_blue ?? b).trim() || b);
    if (w) nomes.set(w, String(f.person_white ?? w).trim() || w);
  }

  // Sem atleta indicado: escolhe o que aparece em mais lutas (normalmente um medalhista).
  if (!atleta) {
    const freq = new Map<string, number>();
    for (const f of contests as any[]) {
      for (const id of [String(f.id_person_blue ?? ""), String(f.id_person_white ?? "")]) {
        if (id) freq.set(id, (freq.get(id) ?? 0) + 1);
      }
    }
    atleta = [...freq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  }
  if (!atleta) {
    return NextResponse.json({ comp, erro: "Nao consegui identificar um atleta." });
  }

  // Percorre as lutas do atleta (ordenadas pela hora), junta acoes e pontos.
  const ordenadas = [...(contests as any[])].sort((a, b) =>
    String(a.start_planned ?? a.start ?? "").localeCompare(String(b.start_planned ?? b.start ?? ""))
  );

  const lutas: any[] = [];
  let todasAcoes: ActionType[] = [];

  for (const f of ordenadas) {
    const ehAzul = String(f.id_person_blue ?? "") === atleta;
    const ehBranco = String(f.id_person_white ?? "") === atleta;
    if (!ehAzul && !ehBranco) continue; // nao participou nesta luta

    const acoes = contestActionsForPerson(f, atleta);
    const pontos = scoreActions(acoes);
    todasAcoes = todasAcoes.concat(acoes);

    const oponenteId = ehAzul ? String(f.id_person_white ?? "") : String(f.id_person_blue ?? "");
    const venceu = String(f.id_winner ?? "") === atleta;

    lutas.push({
      fase: f.round_name ?? f.round_code ?? "-",
      oponente: nomes.get(oponenteId) ?? oponenteId,
      resultado: venceu ? "venceu" : "perdeu",
      acoes: acoes.map((a) => `${LABEL[a]} (${POINTS[a] > 0 ? "+" : ""}${POINTS[a]})`),
      pontos_da_luta: pontos,
    });
  }

  // Resumo por tipo de acao (para conferir: 2 waza-aris = +8, etc.).
  const resumo: Record<string, { vezes: number; subtotal: number }> = {};
  for (const a of todasAcoes) {
    const k = LABEL[a];
    if (!resumo[k]) resumo[k] = { vezes: 0, subtotal: 0 };
    resumo[k].vezes += 1;
    resumo[k].subtotal += POINTS[a];
  }

  const total = scoreActions(todasAcoes);

  return NextResponse.json({
    competicao: info?.name ?? comp,
    atleta_id: atleta,
    atleta_nome: nomes.get(atleta) ?? atleta,
    n_lutas: lutas.length,
    lutas,
    resumo_por_acao: resumo,
    total_pontos: total,
    total_se_capitao_x2: scoreAthlete(todasAcoes, true),
    aplicado_como_capitao: capitao,
    pontuacao_final: scoreAthlete(todasAcoes, capitao),
    nota:
      "Acoes vindas do JudoBase (contestActionsForPerson) + tabela POINTS (engine.ts). " +
      "Nada gravado. Confere se os numeros fazem sentido antes de ligarmos isto ao jogo.",
  });
}
