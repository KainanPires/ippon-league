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

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { plataforma, ehPaginaVenda } from "@/lib/plataforma";
import { supabase } from "@/lib/supabase";

// Conta do fundador — só esta vê o marcador de diagnóstico (temporário).
const FOUNDER_ID = "3e1317bb-db35-444c-a99e-97ee0d7b8ac6";

type StatusBarBridge = {
  setOverlaysWebView?: (o: { overlay: boolean }) => Promise<void> | void;
  setStyle?: (o: { style: string }) => Promise<void> | void;
  setBackgroundColor?: (o: { color: string }) => Promise<void> | void;
  getInfo?: () => Promise<{ overlays?: boolean; visible?: boolean; style?: string }>;
};

// Num site REMOTO, Capacitor.Plugins.StatusBar vem vazio — usa-se registerPlugin.
let sbFonte = "none";
function statusBarBridge(): StatusBarBridge | undefined {
  const cap = (window as unknown as {
    Capacitor?: {
      Plugins?: { StatusBar?: StatusBarBridge };
      registerPlugin?: (name: string) => StatusBarBridge;
    };
  }).Capacitor;
  if (!cap) { sbFonte = "no-cap"; return undefined; }
  if (cap.Plugins?.StatusBar) { sbFonte = "plugins"; return cap.Plugins.StatusBar; }
  if (cap.registerPlugin) { sbFonte = "register"; return cap.registerPlugin("StatusBar"); }
  sbFonte = "no-register";
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
  const [diag, setDiag] = useState<string | null>(null);

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
              sb.setStyle?.({ style: "DARK" });
            }
          } catch { /* silencioso */ }
        })();
      }
    }

    // DIAGNÓSTICO — só para a conta do fundador, na app nativa OU na PWA
    // instalada. Mede o estado real no aparelho. (Remove-se depois.)
    if (p === "ios" || standalone) {
      (async () => {
        try {
          const { data } = await supabase.auth.getSession();
          if (data.session?.user?.id !== FOUNDER_ID) return;
          const probe = document.createElement("div");
          probe.style.cssText =
            "position:fixed;top:0;left:0;height:env(safe-area-inset-top,0px);width:1px;visibility:hidden";
          document.body.appendChild(probe);
          const env = Math.round(probe.getBoundingClientRect().height);
          probe.remove();
          const pad = getComputedStyle(document.body).paddingTop;
          const cap = (window as unknown as { Capacitor?: unknown }).Capacitor ? "Y" : "N";
          const dm = (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ? "standalone" : "browser";
          const nav = (navigator as unknown as { standalone?: boolean }).standalone === true ? "Y" : "N";
          setDiag(`p=${p} sa=${standalone} dm=${dm} navSA=${nav} env=${env} pad=${pad} cap=${cap} sbsrc=${sbFonte}`);
        } catch { /* ignora */ }
      })();
    }

    // Dentro das apps das lojas, páginas de venda voltam ao início (na PWA/web não).
    if (p !== "web") {
      if (ehPaginaVenda(caminho)) { window.location.replace("/inicio"); return; }
      if (p === "ios" && caminho.startsWith("/resolver-ligas")) window.location.replace("/inicio");
    }
  }, [caminho]);

  if (!diag) return null;
  return (
    <div
      style={{
        position: "fixed",
        top: 54,
        left: 8,
        zIndex: 99999,
        background: "#ff2d55",
        color: "#fff",
        font: "700 11px/1.35 ui-monospace, monospace",
        padding: "5px 8px",
        borderRadius: 7,
        pointerEvents: "none",
        maxWidth: "92vw",
        wordBreak: "break-all",
        boxShadow: "0 2px 10px rgba(0,0,0,.5)",
      }}
    >
      IPDIAG {diag}
    </div>
  );
}
