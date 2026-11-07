"use client";

// components/MarcadorApp.tsx
//
// Corre uma vez em todas as páginas (está no layout). Se o site estiver dentro
// de uma app das lojas:
//   1. marca <html data-app="android|ios"> — o globals.css usa isto para
//      esconder os links de compra (ver "APPS DAS LOJAS" no fim do ficheiro);
//   2. se a página atual for de venda (loja, Pro, Pro Max), volta ao /inicio;
//   3. no iPhone, pede à barra de estado NATIVA para não ficar por cima da
//      webview (corrige o conteúdo cortado no topo — não depende do env()).
// No browser normal não faz nada.

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

// IMPORTANTE: num site REMOTO (server.url), Capacitor.Plugins.StatusBar vem
// VAZIO — o Plugins só é preenchido por quem importa o plugin em JS, e o nosso
// bundle web não o importa. A forma certa de falar com o plugin NATIVO é
// Capacitor.registerPlugin("StatusBar"), que devolve a ponte para o nativo.
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

export default function MarcadorApp() {
  const caminho = usePathname() || "/";
  const [diag, setDiag] = useState<string | null>(null);

  useEffect(() => {
    const p = plataforma();
    if (p === "web") return;
    document.documentElement.dataset.app = p;

    if (p === "ios") {
      (async () => {
        const sb = statusBarBridge();
        // FIX: tirar a barra de estado de cima da webview (webview desce para
        // baixo da barra, com fundo sólido escuro). Não depende do env().
        try {
          if (sb?.setOverlaysWebView) {
            await Promise.resolve(sb.setOverlaysWebView({ overlay: false })).catch(() => {});
            sb.setBackgroundColor?.({ color: "#0c0e0d" });
            sb.setStyle?.({ style: "DARK" }); // "DARK" = texto claro no fundo escuro
          }
        } catch { /* silencioso */ }

        // DIAGNÓSTICO — só para a conta do fundador. Mede o estado real no
        // aparelho para percebermos o que falta. (Remove-se depois.)
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
          const hasSb = sb ? "Y" : "N";
          let ov = "?";
          let vis = "?";
          try {
            if (sb?.getInfo) {
              const info = await sb.getInfo();
              ov = String(info?.overlays);
              vis = String(info?.visible);
            }
          } catch { /* ignora */ }
          setDiag(`src=${sbFonte} env=${env} pad=${pad} cap=${cap} sb=${hasSb} ov=${ov} vis=${vis} ih=${window.innerHeight} sh=${window.screen?.height}`);
        } catch { /* ignora */ }
      })();
    }

    if (ehPaginaVenda(caminho)) { window.location.replace("/inicio"); return; }
    // No iPhone o nível mostrado é sempre "grátis" (D-03); o ecrã de resolver
    // ligas leria isso como um rebaixamento verdadeiro. Lá não se entra.
    if (p === "ios" && caminho.startsWith("/resolver-ligas")) window.location.replace("/inicio");
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
