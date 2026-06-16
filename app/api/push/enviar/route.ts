// app/api/push/enviar/route.ts
// Envia uma notificação push. Protegida por CRON_SECRET (cabeçalho Authorization).
// Uso interno (eventos do jogo / cron / página de teste). Não exposto livremente.
import { NextRequest, NextResponse } from "next/server";
import { enviarPushPara } from "@/lib/pushServer";

export const runtime = "nodejs";

const CRON_SECRET = process.env.CRON_SECRET || "";

type Corpo = {
  user_id?: string;
  user_ids?: string[];
  titulo?: string;
  corpo?: string;
  link?: string;
};

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, erro: "Não autorizado." }, { status: 401 });
  }

  let b: Corpo;
  try { b = (await req.json()) as Corpo; } catch { return NextResponse.json({ ok: false }, { status: 400 }); }

  const ids: string[] = [];
  if (b.user_id) ids.push(String(b.user_id));
  if (Array.isArray(b.user_ids)) for (const x of b.user_ids) ids.push(String(x));
  if (ids.length === 0) return NextResponse.json({ ok: false, erro: "Sem destinatários." }, { status: 400 });

  const { enviadas, removidas } = await enviarPushPara(ids, {
    titulo: String(b.titulo || "Ippon League"),
    corpo: String(b.corpo || ""),
    link: String(b.link || "/inicio"),
  });
  return NextResponse.json({ ok: true, enviadas, removidas });
}
