// lib/pushServer.ts
// Envio de notificações push do lado do SERVIDOR (usa a chave VAPID privada).
// Reutilizado pela rota /api/push/enviar e pela ponte notificarServidor.
import webpush from "web-push";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const PUB = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
const PRIV = process.env.VAPID_PRIVATE_KEY || "";
const SUBJECT = process.env.VAPID_SUBJECT || "mailto:support@ipponleague.com";

let vapidPronto = false;
function prepararVapid(): boolean {
  if (vapidPronto) return true;
  if (!PUB || !PRIV) return false;
  webpush.setVapidDetails(SUBJECT, PUB, PRIV);
  vapidPronto = true;
  return true;
}

export type PayloadPush = { titulo: string; corpo?: string; link?: string };

// Envia uma push para todos os aparelhos subscritos dos utilizadores indicados.
// Remove automaticamente subscrições mortas (404/410).
export async function enviarPushPara(userIds: string[], n: PayloadPush): Promise<{ enviadas: number; removidas: number }> {
  if (!supabaseAdmin) return { enviadas: 0, removidas: 0 };
  if (!prepararVapid()) return { enviadas: 0, removidas: 0 };
  const ids = userIds.filter(Boolean);
  if (ids.length === 0) return { enviadas: 0, removidas: 0 };

  const { data: subs, error } = await supabaseAdmin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .in("user_id", ids);
  if (error || !subs || subs.length === 0) return { enviadas: 0, removidas: 0 };

  const payload = JSON.stringify({ titulo: n.titulo, corpo: n.corpo || "", link: n.link || "/inicio" });
  let enviadas = 0;
  let removidas = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
      enviadas++;
    } catch (err: unknown) {
      const code = (err as { statusCode?: number })?.statusCode;
      if (code === 404 || code === 410) {
        await supabaseAdmin.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
        removidas++;
      }
    }
  }
  return { enviadas, removidas };
}
