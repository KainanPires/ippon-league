"use client";

// Página de diagnóstico de notificações push. Aberta num aparelho, mostra
// exatamente o que ele reporta — para sabermos PORQUÊ as notificações não estão
// disponíveis (Safari vs app instalada, versão do iOS, etc.). Interna.
import { useState, useEffect } from "react";

const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";

type Linha = { rotulo: string; valor: string; bom: boolean | null };

export default function DiagPush() {
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [veredito, setVeredito] = useState<{ texto: string; cor: string } | null>(null);

  useEffect(() => {
    const temSW = "serviceWorker" in navigator;
    const temPM = "PushManager" in window;
    const temN = "Notification" in window;
    const permissao = temN ? Notification.permission : "n/a";
    const standaloneMM = !!(window.matchMedia && window.matchMedia("(display-mode: standalone)").matches);
    const standaloneIOS = (navigator as unknown as { standalone?: boolean }).standalone;
    const ua = navigator.userAgent || "";

    // Tenta extrair a versão do iOS do userAgent (ex.: "OS 16_4" -> 16.4).
    let iosVersao = "";
    const m = ua.match(/OS (\d+)[._](\d+)/);
    if (m) iosVersao = `${m[1]}.${m[2]}`;

    const ls: Linha[] = [
      { rotulo: "Aberto como app (standalone)", valor: standaloneMM ? "SIM (app)" : "NÃO (navegador)", bom: standaloneMM },
      { rotulo: "standalone iOS", valor: standaloneIOS === true ? "SIM" : standaloneIOS === false ? "NÃO" : "n/a", bom: standaloneIOS === true ? true : standaloneIOS === false ? false : null },
      { rotulo: "Versão iOS detetada", valor: iosVersao || "(não-iOS ou desconhecida)", bom: iosVersao ? parseFloat(iosVersao) >= 16.4 : null },
      { rotulo: "Service Worker disponível", valor: temSW ? "SIM" : "NÃO", bom: temSW },
      { rotulo: "PushManager disponível", valor: temPM ? "SIM" : "NÃO", bom: temPM },
      { rotulo: "Notification disponível", valor: temN ? "SIM" : "NÃO", bom: temN },
      { rotulo: "Permissão de notificações", valor: String(permissao), bom: permissao === "granted" ? true : permissao === "denied" ? false : null },
    ];
    setLinhas(ls);

    // Veredito.
    const suporta = temSW && temPM && temN;
    if (suporta) {
      setVeredito({ texto: "✅ Este aparelho SUPORTA notificações. Se o botão dizia 'não suporta', estavas no Safari — abre pela APP (ícone) e funciona.", cor: "#7fd1a3" });
    } else if (!standaloneMM && standaloneIOS !== true) {
      setVeredito({ texto: "⚠️ Estás no NAVEGADOR (Safari), não na app. No iPhone, as notificações só existem dentro da app: fecha isto, abre pelo ÍCONE do Dodô no ecrã, e tenta de novo.", cor: "#e6c97a" });
    } else if (iosVersao && parseFloat(iosVersao) < 16.4) {
      setVeredito({ texto: `❌ O iOS deste aparelho (${iosVersao}) é anterior ao 16.4 — a Apple só permite notificações web a partir do 16.4. É preciso atualizar o iPhone (Definições → Geral → Atualização de Software).`, cor: "#ef8d83" });
    } else {
      setVeredito({ texto: "❓ Está na app, mas falta uma capacidade. Tira um print desta página e mostra — vemos o que é.", cor: "#e6c97a" });
    }
  }, []);

  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: FB, padding: "24px 16px" }}>
      <div style={{ maxWidth: 460, margin: "0 auto" }}>
        <h1 style={{ fontFamily: FD, fontSize: 20, fontWeight: 700, textTransform: "uppercase", marginBottom: 14 }}>Diagnóstico de notificações</h1>

        {veredito && (
          <div style={{ background: "#121815", border: `1px solid ${veredito.cor}`, borderRadius: 14, padding: 14, marginBottom: 16, fontSize: 14, lineHeight: 1.5, color: "#f1ede2" }}>
            {veredito.texto}
          </div>
        )}

        <div style={{ background: "#121815", border: "1px solid #243029", borderRadius: 14, overflow: "hidden" }}>
          {linhas.map((l, i) => (
            <div key={l.rotulo} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "11px 14px", borderTop: i === 0 ? "none" : "1px solid #1a221d" }}>
              <span style={{ fontSize: 12.5, color: "#b6c0b9" }}>{l.rotulo}</span>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: l.bom === true ? "#7fd1a3" : l.bom === false ? "#ef8d83" : "#93a39a", whiteSpace: "nowrap" }}>{l.valor}</span>
            </div>
          ))}
        </div>

        <p style={{ fontSize: 11, color: "#5f6f67", marginTop: 16, lineHeight: 1.5 }}>
          Página interna de teste. Tira um print e mostra para resolvermos. Abre esta página
          <strong> pela app (ícone)</strong> e também <strong>pelo Safari</strong>, para comparar.
        </p>
      </div>
    </main>
  );
}
