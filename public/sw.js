// Service worker da Ippon League.
// - Permite "instalar" a app no Android (requer um fetch handler).
// - Recebe notificações push e trata do clique.
// - AUTO-CURA: quando o browser/OS renova ou invalida a subscrição
//   (pushsubscriptionchange), volta a subscrever e regista a nova no servidor
//   SOZINHO — o utilizador não precisa de fazer nada.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Handler mínimo: necessário para o Android oferecer "Instalar aplicação".
// Não fazemos cache offline para já — deixamos passar todos os pedidos.
self.addEventListener("fetch", () => {});

// Recebe uma notificação push e mostra-a.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { corpo: event.data ? event.data.text() : "" };
  }
  const titulo = data.titulo || "Ippon League";
  const opcoes = {
    body: data.corpo || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: { link: data.link || "/inicio" },
  };
  event.waitUntil(self.registration.showNotification(titulo, opcoes));
});

// Clique na notificação: abre (ou foca) a app no link indicado.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || "/inicio";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((lista) => {
      for (const c of lista) {
        if ("focus" in c) {
          c.navigate(link);
          return c.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(link);
    })
  );
});

// --- AUTO-CURA DA SUBSCRIÇÃO -------------------------------------------------
// O browser dispara "pushsubscriptionchange" quando a subscrição é renovada ou
// invalidada pelo sistema (iOS a reciclar a PWA, Android a rodar a chave, etc.).
// Aqui voltamos a subscrever com a MESMA chave pública VAPID e migramos o registo
// no servidor: da subscrição ANTIGA (que morreu) para a NOVA. Como enviamos o
// endpoint antigo, o servidor sabe a que conta pertence e apenas atualiza a linha
// — não precisa do userId aqui dentro (o SW não tem sessão).

function base64ParaUint8(base64) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

async function chavePublicaVapid() {
  // A chave pública é... pública. Vamos buscá-la ao servidor para não a fixar
  // aqui (assim, se um dia rodar, o SW continua a funcionar sem alteração).
  try {
    const r = await fetch("/api/push/vapid-public", { cache: "no-store" });
    const j = await r.json();
    return j && j.publicKey ? j.publicKey : "";
  } catch (e) {
    return "";
  }
}

self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const oldEndpoint =
          (event.oldSubscription && event.oldSubscription.endpoint) || null;

        // Se o browser já nos deu a nova subscrição, usa-a; senão, cria uma.
        let novo = event.newSubscription || null;
        if (!novo) {
          const pub = await chavePublicaVapid();
          if (!pub) return;
          novo = await self.registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: base64ParaUint8(pub),
          });
        }

        const json = novo.toJSON ? novo.toJSON() : novo;
        if (!json || !json.endpoint || !json.keys) return;

        await fetch("/api/push/migrar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            oldEndpoint,
            endpoint: json.endpoint,
            p256dh: json.keys.p256dh,
            auth: json.keys.auth,
          }),
        });
      } catch (e) {
        // silencioso: nunca partir o SW
      }
    })()
  );
});
