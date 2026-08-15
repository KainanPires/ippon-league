// app/api/push/vapid-public/route.ts
//
// Devolve a chave PÚBLICA VAPID. É pública por natureza (já vai no bundle do
// cliente via NEXT_PUBLIC_VAPID_PUBLIC_KEY) — aqui expomo-la para o service
// worker a poder buscar quando precisa de voltar a subscrever sozinho
// (pushsubscriptionchange). Nunca devolve a chave privada.
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
  return NextResponse.json({ publicKey });
}
