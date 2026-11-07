"use client";

// components/MarcadorApp.tsx
//
// Corre uma vez em todas as páginas (está no layout). Se o site estiver dentro
// de uma app das lojas:
//   1. marca <html data-app="android|ios"> — o globals.css usa isto para
//      esconder os links de compra (ver "APPS DAS LOJAS" no fim do ficheiro);
//   2. se a página atual for de venda (loja, Pro, Pro Max), volta ao /inicio.
// No browser normal não faz nada.

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { plataforma, ehPaginaVenda } from "@/lib/plataforma";

export default function MarcadorApp() {
  const caminho = usePathname() || "/";
  useEffect(() => {
    const p = plataforma();
    if (p === "web") return;
    document.documentElement.dataset.app = p;

    // iPhone (Capacitor): a app foi compilada com StatusBar.overlaysWebView:true,
    // por isso o conteúdo fica POR BAIXO do relógio/barra de estado e, neste
    // WKWebView, o env(safe-area-inset-top) do CSS devolve 0 (o padding não chega).
    // Pedimos ao plugin NATIVO para a barra deixar de ficar por cima: a webview
    // desce para baixo da barra, com fundo sólido #0c0e0d. É a correção definitiva,
    // feita pela web (sem republicar na App Store). Guardado: no browser (sem
    // window.Capacitor) ou se o plugin não existir, não faz nada.
    if (p === "ios") {
      try {
        const sb = (window as unknown as {
          Capacitor?: { Plugins?: { StatusBar?: {
            setOverlaysWebView?: (o: { overlay: boolean }) => Promise<void> | void;
            setStyle?: (o: { style: string }) => Promise<void> | void;
            setBackgroundColor?: (o: { color: string }) => Promise<void> | void;
          } } };
        }).Capacitor?.Plugins?.StatusBar;
        if (sb?.setOverlaysWebView) {
          Promise.resolve(sb.setOverlaysWebView({ overlay: false })).catch(() => {});
          sb.setBackgroundColor?.({ color: "#0c0e0d" });
          sb.setStyle?.({ style: "DARK" }); // "DARK" = texto claro, visível no fundo escuro
        }
      } catch { /* silencioso */ }
    }

    if (ehPaginaVenda(caminho)) { window.location.replace("/inicio"); return; }
    // No iPhone o nível mostrado é sempre "grátis" (D-03); o ecrã de resolver
    // ligas leria isso como um rebaixamento verdadeiro. Lá não se entra.
    if (p === "ios" && caminho.startsWith("/resolver-ligas")) window.location.replace("/inicio");
  }, [caminho]);
  return null;
}
