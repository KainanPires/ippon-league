// app/api/push/enviar/route.ts
// Envia uma notificação push. Protegida por CRON_SECRET (cabeçalho Authorization).
// Uso interno (eventos do jogo / cron). Não exposto ao cliente.
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import webpush from "web-push";

export const runtime = "nodejs";

const PUB = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
const PRIV = process.env.VAPID_PRIVATE_KEY || "";
const SUBJECT = process.env.VAPID_SUBJECT || "mailto:support@ipponleague.com";
const CRON_SECRET = process.env.CRON_SECRET || "";

let vapidPronto = false;
function prepararVapid() {
  if (vapidPronto) return true;
  if (!PUB || !PRIV) return false;
  webpush.setVapidDetails(SUBJECT, PUB, PRIV);
  vapidPronto = true;
  return true;
}

type Corpo = {
  user_id?: string;        // enviar a um utilizador
  user_ids?: string[];     // ou a vários
  titulo?: string;
  corpo?: string;
  link?: string;
};

export async function POST(req: NextRequest) {
  // Autorização: tem de trazer "Bearer <CRON_SECRET>".
  const auth = req.headers.get("authorization") || "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, erro: "Não autorizado." }, { status: 401 });
  }
  if (!supabaseAdmin) return NextResponse.json({ ok: false, erro: "Servidor indisponível." }, { status: 500 });
  if (!prepararVapid()) return NextResponse.json({ ok: false, erro: "VAPID não configurado." }, { status: 500 });

  let b: Corpo;
  try { b = (await req.json()) as Corpo; } catch { return NextResponse.json({ ok: false }, { status: 400 }); }

  const ids: string[] = [];
  if (b.user_id) ids.push(String(b.user_id));
  if (Array.isArray(b.user_ids)) for (const x of b.user_ids) ids.push(String(x));
  if (ids.length === 0) return NextResponse.json({ ok: false, erro: "Sem destinatários." }, { status: 400 });

  const titulo = String(b.titulo || "Ippon League");
  const corpo = String(b.corpo || "");
  const link = String(b.link || "/inicio");
  const payload = JSON.stringify({ titulo, corpo, link });

  const { data: subs, error } = await supabaseAdmin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .in("user_id", ids);

  if (error) return NextResponse.json({ ok: false, erro: "Falha a ler subscrições." }, { status: 500 });
  if (!subs || subs.length === 0) return NextResponse.json({ ok: true, enviadas: 0 });

  let enviadas = 0;
  let removidas = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload
      );
      enviadas++;
    } catch (err: unknown) {
      const code = (err as { statusCode?: number })?.statusCode;
      // Subscrição morta (desinstalou / revogou) -> remover.
      if (code === 404 || code === 410) {
        await supabaseAdmin.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
        removidas++;
      }
    }
  }
  return NextResponse.json({ ok: true, enviadas, removidas });
}
