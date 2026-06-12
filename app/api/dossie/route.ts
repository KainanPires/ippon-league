// app/api/dossie/route.ts
//
// Dossiê de UM atleta (análise profunda do Pro). Usada pelo dashboard /pro:
// o ecrã chama esta rota uma vez por cada atleta do time, em paralelo.
//
//   /api/dossie?person=63577&comp=3295            -> dossiê (com nível da competição)
//   /api/dossie?person=63577&comp=3295&adversario=34169  -> + head-to-head
//
// (A /api/scout é a versão de inspeção/manual; esta é a de produção.)

import { NextResponse } from "next/server";
import { montarDossie } from "@/lib/scout";
import { getCompetition } from "@/lib/ijf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const person = searchParams.get("person") ?? "";
  const comp = searchParams.get("comp") ?? "";
  const adversario = searchParams.get("adversario") ?? "";

  if (!person) {
    return NextResponse.json({ erro: "Falta o parâmetro 'person'." }, { status: 400 });
  }

  // O scout infere o nível da competição-alvo a partir do NOME — buscamo-lo aqui.
  let nomeCompeticaoAlvo: string | undefined;
  if (comp) {
    const c = await getCompetition(comp);
    nomeCompeticaoAlvo = c?.name;
  }

  const dossie = await montarDossie(person, {
    nomeCompeticaoAlvo,
    idAdversario: adversario || undefined,
  });

  if (!dossie) {
    return NextResponse.json({ erro: "Sem dossiê (atleta inexistente ou API em baixo).", person }, { status: 404 });
  }

  return NextResponse.json({ dossie });
}
