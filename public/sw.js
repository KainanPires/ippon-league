// Service worker da Ippon League.
// - Permite "instalar" a app no Android (requer um fetch handler).
// - Recebe notificações push e trata do clique (etapas seguintes).

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
