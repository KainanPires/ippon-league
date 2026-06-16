"use client";

import { useEffect } from "react";

// Regista o service worker (/sw.js) uma vez, no arranque da app.
// Necessário para a app ser instalável no Android e para receber notificações.
export function RegistarServiceWorker() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    const reg = () => navigator.serviceWorker.register("/sw.js").catch(() => {});
    if (document.readyState === "complete") reg();
    else window.addEventListener("load", reg, { once: true });
  }, []);
  return null;
}
