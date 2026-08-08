// app/api/pontuacoes/registar/route.ts
//
// ---------------------------------------------------------------------------
// ROTA APOSENTADA (agosto de 2026)
//
// O lib/congelar.ts e o UNICO dono da tabela `pontuacoes`.
//
// Esta rota escrevia na mesma tabela, com a mesma chave de conflito
// (user_id, id_competicao), por isso quem corresse por ultimo prevalecia. Pior:
// pontuava pela fonte errada - competition.contests, que vem incompleto durante
// e logo apos o evento e deixa a 0 atletas que ja lutaram. Podia portanto
// gravar pontuacoes a MENOS por cima das que o congelamento gravou bem.
//
// Verificou-se que nunca chegou a acontecer: as quatro rodadas ja fechadas
// (3295, 1601, 1598, 3149) foram recalculadas pela fonte certa e batem certo
// ao ponto com o que esta gravado. Uma busca no repositorio tambem nao
// encontrou ninguem a chamar esta rota.
//
// POR ISSO fica travada em vez de apagada: se este aviso aparecer nos registos
// da Vercel, alguma coisa ainda a chama (um cron do cron-job.org, por exemplo,
// que vive fora do repositorio) e e preciso descobrir o que antes de apagar.
//
// Depois de uma ou duas competicoes sem o aviso aparecer, apagar a pasta
// app/api/pontuacoes/registar/ inteira.
//
// Se algum dia for preciso reconstruir esta funcionalidade como ferramenta
// manual de recuperacao: pontuar por atleta com getCompetitorContests +
// scoreContestForPerson, filtrando por id_competition, e capitao a dobrar.
// NUNCA com getCompetitionContests.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  console.warn("[pontuacoes/registar] rota aposentada foi chamada");
  return NextResponse.json(
    { ok: false, erro: "Rota aposentada. O congelamento e o unico dono de pontuacoes." },
    { status: 410 }
  );
}
