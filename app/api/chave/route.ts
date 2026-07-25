// app/api/chave/route.ts
//
// DESATIVADA. Esta era a API da chave ANTIGA — ia direto ao JudoBase e devolvia
// os combates em bruto, SEM Paywall. Foi substituída pela /api/chave-atletas
// (motor próprio + molduras + Paywall no servidor), e a página /chave antiga
// agora redireciona para /chave-atletas.
//
// Mantínhamos o ficheiro só como redirecionamento de página; a API em si não
// deve continuar a servir dados, senão é uma porta aberta ao lado da porta
// blindada (qualquer pessoa com o endereço buscava a chave sem sessão). Por
// isso responde agora "foi movida" e não devolve nada.
//
// Se algum dia for preciso reativar dados por aqui, tem de levar o MESMO Paywall
// da /api/chave-atletas (verificação de token + nível na tabela users).
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function movida() {
  return NextResponse.json(
    {
      ok: false,
      erro: "Esta API foi movida. Usa /api/chave-atletas.",
      movidoPara: "/api/chave-atletas",
    },
    { status: 410 } // 410 Gone: o recurso existiu e foi removido de propósito.
  );
}

export async function GET() { return movida(); }
export async function POST() { return movida(); }
