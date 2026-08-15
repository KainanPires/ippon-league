// app/api/push/teste/route.ts
//
// TESTE de push por LINK (GET) — para disparar uma notificação de teste a partir
// do browser do telemóvel, sem ferramentas (curl/Postman). Protegido pela mesma
// key do cron. É um atalho de diagnóstico; o envio "a sério" continua a ser pelo
// /api/push/enviar (POST + Authorization).
//
// Uso (abrir no browser):
//   /api/push/teste?key=<CRON_SECRET>&user=<user_id>
//   /api/push/teste?key=<CRON_SECRET>&user=<user_id>&titulo=Olá&corpo=Funciona
//
// Resposta: { ok, enviadas, removidas } — "enviadas" > 0 significa que o push foi
// entregue ao serviço da Apple/Google para os aparelhos subscritos desse user.
import { NextResponse } from "next/server";
import { enviarPushPara } from "@/lib/pushServer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function autorizado(key: string | null): boolean {
  const a = process.env.CRON_SECRET;
  const b = process.env.LEMBRETE_CRON_SECRET;
  if (!key) return false;
  return (!!a && key === a) || (!!b && key === b);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const key = searchParams.get("key");
  if (!autorizado(key)) {
    return NextResponse.json({ ok: false, erro: "Não autorizado." }, { status: 401 });
  }
  const user = (searchParams.get("user") || "").trim();
  if (!user) {
    return NextResponse.json({ ok: false, erro: "Falta ?user=<user_id>." }, { status: 400 });
  }
  const titulo = searchParams.get("titulo") || "Ippon League 🥋";
  const corpo = searchParams.get("corpo") || "Push de teste — se vês isto no telemóvel, está a funcionar!";
  const link = searchParams.get("link") || "/inicio";

  const { enviadas, removidas } = await enviarPushPara([user], { titulo, corpo, link });
  return NextResponse.json({ ok: true, user, enviadas, removidas });
}
