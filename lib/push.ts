// Funções de notificações push (lado do cliente).
// A subscrição é guardada no servidor via /api/push/subscrever.
const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const arr = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}
export type EstadoPush = "indisponivel" | "pendente" | "concedido" | "negado";
export function suportaPush(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}
export function estadoPush(): EstadoPush {
  if (!suportaPush()) return "indisponivel";
  const p = Notification.permission;
  if (p === "granted") return "concedido";
  if (p === "denied") return "negado";
  return "pendente";
}

// Envia uma subscrição ao servidor, associando-a à conta atual. O endpoint faz
// upsert por endpoint, por isso isto também serve para RE-associar uma subscrição
// que estava ligada a outra conta (ex.: trocaram de conta no mesmo aparelho).
async function registarNoServidor(userId: string, sub: PushSubscription): Promise<boolean> {
  const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return false;
  try {
    const res = await fetch("/api/push/subscrever", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: userId,
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
        userAgent: navigator.userAgent,
      }),
    });
    const j = await res.json();
    return !!j.ok;
  } catch {
    return false;
  }
}

export async function ativarPush(userId: string): Promise<{ ok: boolean; erro?: string }> {
  if (!suportaPush()) return { ok: false, erro: "O teu aparelho não suporta notificações." };
  if (!VAPID_PUBLIC) return { ok: false, erro: "As notificações ainda não estão configuradas." };
  try {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return { ok: false, erro: "Permissão não concedida." };
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
      });
    }
    const ok = await registarNoServidor(userId, sub);
    if (!ok) return { ok: false, erro: "Falha ao registar." };
    return { ok: true };
  } catch {
    return { ok: false, erro: "Não foi possível ativar agora." };
  }
}

// RECONCILIAÇÃO SILENCIOSA: garante que a subscrição EXISTENTE deste aparelho
// fica associada à conta ATUAL no servidor. Chamar no arranque (com sessão),
// quando a permissão já está concedida. Resolve o caso em que se troca de conta
// no mesmo telemóvel: a permissão do iOS já está "granted" (logo nunca se chama
// ativarPush), mas a subscrição no servidor continuava ligada à conta anterior,
// deixando a nova conta sem push. Não pede permissão nem cria nada novo: só
// reenvia a subscrição que já existe, para a passar para a conta certa.
//
// Não faz nada se: não suporta push, não há userId, a permissão não está
// concedida, ou ainda não há subscrição no browser. É seguro chamar sempre.
export async function reconciliarPush(userId: string): Promise<void> {
  try {
    if (!suportaPush() || !userId) return;
    if (Notification.permission !== "granted") return;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return; // permissão dada mas sem subscrição: o utilizador terá de ativar (cria-a)
    await registarNoServidor(userId, sub);
  } catch {
    // silencioso: a reconciliação nunca deve partir o arranque da app
  }
}

export async function desativarPush(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      try {
        await fetch("/api/push/cancelar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
      } catch {}
      await sub.unsubscribe();
    }
  } catch {}
}
// Mostra uma notificação local (teste imediato — confirma permissão + service worker).
export async function notificacaoTesteLocal(): Promise<void> {
  if (!suportaPush()) return;
  const reg = await navigator.serviceWorker.ready;
  reg.showNotification("Ippon League", {
    body: "As notificações estão a funcionar! 🥋",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: { link: "/inicio" },
  });
}
