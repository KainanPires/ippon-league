// app/api/scout/route.ts
//
// ROTA TEMPORÁRIA — só para inspecionar, no browser, o dossiê que o lib/scout.ts
// monta para um atleta. Serve para confirmarmos que os dados reais vêm certos
// (perfil, experiência, medalhas, conquistas, forma recente) ANTES de construir
// o ecrã do Pro. REMOVER depois de validado.
//
// Uso:
//   /api/scout?person=63577              -> dossiê do atleta
//   /api/scout?person=63577&comp=3295    -> + "nesta competição" (usa o nome do evento)
//   /api/scout?person=63577&adversario=34169  -> + confronto direto (head-to-head)
//
// Como obter ids: /api/atletas?id=3295 dá a lista de atletas da competição; o
// campo "id" de cada um é o id_person para usar aqui.

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
    return NextResponse.json({
      erro: "Falta o parâmetro 'person' (id_person de um atleta).",
      como: "Ex.: /api/scout?person=63577  (ou abre /api/atletas?id=3295 e copia o 'id' de um atleta).",
    });
  }

  // Se vier uma competição, vamos buscar o NOME do evento para alimentar o
  // "nesta competição" (o scout precisa do nome, não do id, para casar edições).
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
    return NextResponse.json({
      erro: "Não consegui montar o dossiê (atleta inexistente ou API do JudoBase em baixo).",
      person,
    });
  }

  return NextResponse.json({
    person,
    comp: comp || "(nenhuma)",
    nomeCompeticaoAlvo: nomeCompeticaoAlvo ?? "(nenhuma)",
    adversario: adversario || "(nenhum)",
    dossie,
  });
}
