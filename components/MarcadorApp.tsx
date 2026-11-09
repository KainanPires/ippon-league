"use client";

// components/MarcadorApp.tsx
//
// Corre uma vez em todas as páginas (está no layout).
//   1. App das lojas (Capacitor): marca <html data-app="android|ios"> para o
//      globals.css esconder os links de compra; no iPhone pede à barra de estado
//      nativa para não ficar por cima da webview.
//   2. PWA "adicionar ao ecrã principal" (Safari standalone): marca
//      <html data-pwa="1"> para o globals.css empurrar o conteúdo para baixo da
//      barra de estado translúcida (o env() do Safari funciona aqui).
//   3. Páginas de venda dentro das apps das lojas -> volta ao /inicio.
// No browser normal (aba do Safari/Chrome) não faz nada.

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { plataforma, ehPaginaVenda } from "@/lib/plataforma";

type StatusBarBridge = {
  setOverlaysWebView?: (o: { overlay: boolean }) => Promise<void> | void;
  setStyle?: (o: { style: string }) => Promise<void> | void;
  setBackgroundColor?: (o: { color: string }) => Promise<void> | void;
};

// Num site REMOTO, Capacitor.Plugins.StatusBar vem vazio — usa-se registerPlugin.
function statusBarBridge(): StatusBarBridge | undefined {
  const cap = (window as unknown as {
    Capacitor?: {
      Plugins?: { StatusBar?: StatusBarBridge };
      registerPlugin?: (name: string) => StatusBarBridge;
    };
  }).Capacitor;
  if (!cap) return undefined;
  if (cap.Plugins?.StatusBar) return cap.Plugins.StatusBar;
  if (cap.registerPlugin) return cap.registerPlugin("StatusBar");
  return undefined;
}

function ehStandalone(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const mm = !!(window.matchMedia && window.matchMedia("(display-mode: standalone)").matches);
    const ios = (navigator as unknown as { standalone?: boolean }).standalone === true;
    return mm || ios;
  } catch {
    return false;
  }
}

export default function MarcadorApp() {
  const caminho = usePathname() || "/";

  useEffect(() => {
    const p = plataforma();
    const standalone = ehStandalone();

    // PWA instalada (ecrã inicial): o CSS usa isto para empurrar o conteúdo para
    // baixo da barra de estado translúcida.
    if (standalone) document.documentElement.dataset.pwa = "1";

    // App das lojas (Capacitor).
    if (p !== "web") {
      document.documentElement.dataset.app = p;
      if (p === "ios") {
        (async () => {
          const sb = statusBarBridge();
          try {
            if (sb?.setOverlaysWebView) {
              await Promise.resolve(sb.setOverlaysWebView({ overlay: false })).catch(() => {});
              sb.setBackgroundColor?.({ color: "#0c0e0d" });
              sb.setStyle?.({ style: "DARK" }); // "DARK" = texto claro no fundo escuro
            }
          } catch { /* silencioso */ }
        })();
      }

      // Dentro das apps das lojas, páginas de venda voltam ao início (na PWA/web não).
      if (ehPaginaVenda(caminho)) { window.location.replace("/inicio"); return; }
      // No iPhone o nível mostrado é sempre "grátis" (D-03); o ecrã de resolver
      // ligas leria isso como um rebaixamento verdadeiro. Lá não se entra.
      if (p === "ios" && caminho.startsWith("/resolver-ligas")) window.location.replace("/inicio");
    }
  }, [caminho]);

  return null;
}
