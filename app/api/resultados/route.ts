// app/api/resultados/route.ts
//
// RESULTADOS REAIS — pontos de cada atleta numa competição.
//
// FONTE (corrigido): quando recebe a lista de atletas (?persons=id1,id2,...),
// busca as lutas DE CADA ATLETA via competitor.contests e filtra pela competição.
// Isto resolve o caso em que competition.contests vem INCOMPLETO durante/logo
// após o evento (ex.: Tahiti 2026 só devolvia -52 e -60, deixando os outros
// atletas a 0 mesmo já tendo lutado). O competitor.contests traz o histórico
// completo do atleta, com as lutas da competição em curso.
//
// Retrocompatível: SEM ?persons, mantém o comportamento antigo (competition.contests,
// todos os atletas da competição) — usado onde se quer o mapa completo.
//
// Os campos das lutas são idênticos nos dois endpoints, por isso o cálculo
// (scoreContestSide / scoreContestForPerson) é o mesmo.
//
// ALÉM dos pontos, agora devolve também as AÇÕES somadas por atleta (no modo
// por_atleta): ippon/waza/yuko/shido_provocado e os _sof (sofridos). É o "como
// pontuou" que o ranking de atletas mostra — antes só existia no congelado.
// As ações de valor fixo vêm de contestActions() (que já trata o ippon fantasma
// do hansoku); os shidos vêm dos penalty_, igual ao scoreContestSide.
//
// ---------------------------------------------------------------------------
// PORTÃO ANTI-ESPREITADELA (servidor) — LER ANTES DE MEXER
//
// Esta rota NÃO devolve pontos de uma competição cujo mercado ainda está ABERTO.
//
// Porquê: nos CLÁSSICOS (competições antigas revividas), as lutas já existem
// todas no JudoBase desde 2018/2019. Sem este portão, bastava abrir o "Meu Time",
// tocar num atleta e ver quanto ele fez — e trocá-lo se fosse mau. Quem escalasse
// com calma montava a equipa perfeita. O jogo não teria mérito nenhum.
//
// A guarda vive no SERVIDOR, e não só no clique do cliente, porque escrever o URL
// à mão (/api/resultados?comp=1598&persons=...) contornaria qualquer bloqueio de
// interface. Mesma regra e mesmo espírito do /api/equipa-na-rodada.
//
// Competições fora do CALENDARIO_2026 passam à frente: não são rodadas geridas
// pelo jogo, não há mercado para respeitar.
// ---------------------------------------------------------------------------
//
// Uso:
//   /api/resultados?comp=3295&persons=4143,67160,32250   (pontua só estes — recomendado)
//   /api/resultados?comp=3131                            (todos — modo antigo)
import { NextResponse } from "next/server";
import {
  getCompetitionContests,
  getCompetitorContests,
  scoreContestSide,
  scoreContestForPerson,
  contestActions,
  isHansokuMake,
  type IjfContest,
} from "@/lib/ijf";
import { CALENDARIO_2026, pontosVisiveisPorId } from "@/lib/calendario";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Contagem de ações de UM atleta numa luta, com as chaves que o ranking espera.
type Acoes = { ippon: number; waza: number; yuko: number; shido_provocado: number; ippon_sof: number; waza_sof: number; yuko_sof: number; shido_sof: number };
function acoesVazias(): Acoes {
  return { ippon: 0, waza: 0, yuko: 0, shido_provocado: 0, ippon_sof: 0, waza_sof: 0, yuko_sof: 0, shido_sof: 0 };
}
const n = (v: unknown): number => { const x = parseInt(String(v ?? "0"), 10); return isNaN(x) ? 0 : x; };

// Ações do atleta numa luta. Reutiliza contestActions() para as ações de valor
// fixo (ippon/waza/yuko, feitos e sofridos) — que já remove o ippon fantasma do
// hansoku — e lê os penalty_ para os shidos (que contestActions não inclui).
function acoesDoAtletaNaLuta(f: IjfContest, idPerson: string): Acoes | null {
  const azul = String(f.id_person_blue ?? "");
  const branco = String(f.id_person_white ?? "");
  let lado: "b" | "w" | null = null;
  if (azul === idPerson) lado = "b";
  else if (branco === idPerson) lado = "w";
  if (!lado) return null;

  const opp = lado === "b" ? "w" : "b";
  const ff = f as unknown as Record<string, unknown>;
  const a = acoesVazias();

  // Valor fixo: conta as ações que contestActions devolve para este lado.
  for (const act of contestActions(f, lado)) {
    if (act === "ippon_feito") a.ippon++;
    else if (act === "waza_ari_feito") a.waza++;
    else if (act === "yuko_feito") a.yuko++;
    else if (act === "ippon_sofrido") a.ippon_sof++;
    else if (act === "waza_ari_sofrido") a.waza_sof++;
    else if (act === "yuko_sofrido") a.yuko_sof++;
  }

  // Shidos (contestActions não os inclui — lê dos penalty_, igual ao score):
  // provocado = penalty do adversário; sofrido = penalty do próprio lado.
  a.shido_provocado = n(ff[`penalty_${opp}`]);
  a.shido_sof = n(ff[`penalty_${lado}`]);

  // Nota: em hansoku-make, contestActions já tirou o ippon fantasma do lado
  // vencedor e sofrido; os shidos é que explicam o resultado. Coerente com os pts.
  void isHansokuMake;
  return a;
}

function somarAcoes(acc: Acoes, x: Acoes) {
  acc.ippon += x.ippon; acc.waza += x.waza; acc.yuko += x.yuko; acc.shido_provocado += x.shido_provocado;
  acc.ippon_sof += x.ippon_sof; acc.waza_sof += x.waza_sof; acc.yuko_sof += x.yuko_sof; acc.shido_sof += x.shido_sof;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const comp = (searchParams.get("comp") || "").trim();
  const personsParam = (searchParams.get("persons") || "").trim();
  if (!comp) {
    return NextResponse.json(
      { erro: "Falta ?comp=<id_competition>. Ex.: /api/resultados?comp=3131" },
      { status: 400 }
    );
  }

  // PORTÃO ANTI-ESPREITADELA: mercado ainda aberto -> não há pontos para ver.
  // (Ver a explicação no cabeçalho. Competições fora do calendário passam.)
  const noCalendario = CALENDARIO_2026.some((c) => c.idCompeticao === comp);
  if (noCalendario && !pontosVisiveisPorId(comp)) {
    return NextResponse.json({
      comp,
      modo: "bloqueado",
      bloqueado: true,
      mercado_aberto: true,
      tem_resultados: false,
      n_lutas: 0,
      n_atletas: 0,
      pontos: {},
      acoes: {},
    });
  }

  // MODO POR ATLETA (recomendado): pontua só os atletas pedidos, buscando as
  // lutas de cada um (competitor.contests) filtradas pela competição.
  if (personsParam) {
    const ids = personsParam.split(",").map((s) => s.trim()).filter(Boolean);
    const pontos: Record<string, number> = {};
    const acoes: Record<string, Acoes> = {};
    let nLutas = 0;
    // Em paralelo, mas com cuidado: cada atleta é uma chamada à API.
    await Promise.all(
      ids.map(async (id) => {
        try {
          const todas = await getCompetitorContests(id);
          const desta = (todas || []).filter((f) => String(f.id_competition) === comp);
          let soma = 0;
          const ac = acoesVazias();
          for (const f of desta) {
            soma += scoreContestForPerson(f, id);
            const x = acoesDoAtletaNaLuta(f, id);
            if (x) somarAcoes(ac, x);
          }
          pontos[id] = Math.round(soma * 10) / 10;
          acoes[id] = ac;
          nLutas += desta.length;
        } catch {
          pontos[id] = 0;
          acoes[id] = acoesVazias();
        }
      })
    );
    return NextResponse.json({
      comp,
      modo: "por_atleta",
      tem_resultados: nLutas > 0,
      n_lutas: nLutas,
      n_atletas: Object.keys(pontos).length,
      pontos,
      acoes,
    });
  }
  // MODO ANTIGO (todos os atletas da competição) — competition.contests.
  // Mantido por retrocompatibilidade. Pode vir incompleto durante o evento.
  const contests = await getCompetitionContests(comp);
  const pontos: Record<string, number> = {};
  for (const f of contests) {
    const lados: ["b" | "w", string][] = [
      ["b", String(f.id_person_blue ?? "")],
      ["w", String(f.id_person_white ?? "")],
    ];
    for (const [side, id] of lados) {
      if (!id) continue;
      pontos[id] = (pontos[id] ?? 0) + scoreContestSide(f, side);
    }
  }
  return NextResponse.json({
    comp,
    modo: "por_competicao",
    tem_resultados: contests.length > 0,
    n_lutas: contests.length,
    n_atletas: Object.keys(pontos).length,
    pontos,
  });
}
