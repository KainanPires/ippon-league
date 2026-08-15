// Funções de notificações push (lado do cliente).
// A subscrição é guardada no servidor via /api/push/subscrever.
const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

// INTENÇÃO DA PESSOA (guardada no próprio aparelho). Distingue duas coisas que a
// permissão do iOS não distingue:
//   • "on"  — a pessoa QUER push (carregou Ativar).
//   • "off" — a pessoa DESATIVOU dentro da app (não queremos importuná-la).
// A auto-cura no arranque só recria a subscrição quando a intenção é "on".
// Se a pessoa desativou, fica desativado — mesmo que a permissão do iOS continue
// "granted" (que é o que acontece quando se desativa dentro da app).
const CHAVE_INTENCAO = "ippon_push_intencao";
function lerIntencao(): "on" | "off" | null {
  try {
    if (typeof window === "undefined") return null;
    const v = window.localStorage.getItem(CHAVE_INTENCAO);
    return v === "on" || v === "off" ? v : null;
  } catch {
    return null;
  }
}
function guardarIntencao(v: "on" | "off"): void {
  try {
    if (typeof window !== "undefined") window.localStorage.setItem(CHAVE_INTENCAO, v);
  } catch {}
}

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
    // A pessoa QUER push: guarda a intenção para a auto-cura poder renovar depois.
    guardarIntencao("on");
    return { ok: true };
  } catch {
    return { ok: false, erro: "Não foi possível ativar agora." };
  }
}

// RECONCILIAÇÃO SILENCIOSA (AUTO-CURA no arranque da app). Chamar no arranque,
// com sessão. Regra de ouro: NUNCA importunar quem desligou.
//
//  • Permissão "denied" (a pessoa desligou nas Definições do iOS) => não faz nada.
//  • Existe subscrição => reenvia-a (mantém o servidor fresco e liga-a à conta
//    atual) e regista a intenção "on", captando a realidade de quem já usa.
//  • NÃO existe subscrição:
//      - intenção "on"  => o iOS/Android reciclou-a em silêncio; recriamos aqui,
//        sem prompt (a permissão já está dada). É a auto-cura.
//      - intenção "off"/ausente => a pessoa desativou (ou nunca ativou); NÃO
//        recriamos. Fica como ela deixou.
//
// É seguro chamar sempre.
export async function reconciliarPush(userId: string): Promise<void> {
  try {
    if (!suportaPush() || !userId) return;
    if (Notification.permission !== "granted") return; // Definições do iOS OFF => respeitamos
    if (!VAPID_PUBLIC) return;
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (sub) {
      // Já subscrito neste aparelho: mantém tudo fresco e capta a intenção real.
      guardarIntencao("on");
      await registarNoServidor(userId, sub);
      return;
    }
    // Sem subscrição: só recriamos se a pessoa QUER push. Se desativou, fica off.
    if (lerIntencao() !== "on") return;
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
    });
    await registarNoServidor(userId, sub);
  } catch {
    // silencioso: a reconciliação nunca deve partir o arranque da app
  }
}

export async function desativarPush(): Promise<void> {
  // A pessoa DESATIVOU: guarda a intenção "off" ANTES de tudo, para a auto-cura
  // no próximo arranque não a voltar a ligar.
  guardarIntencao("off");
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
