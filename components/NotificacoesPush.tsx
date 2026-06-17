"use client";

// Notificações push:
//  - BotaoNotificacoes: controlo no perfil (ativar/desativar + teste).
//  - LembreteNotificacoes: banner no dashboard, depois de ter equipa, a pedir
//    permissão com justificação. Só aparece se ainda estiver por ativar e não
//    tiver sido dispensado.

import { useState, useEffect } from "react";
import { suportaPush, estadoPush, ativarPush, desativarPush, notificacaoTesteLocal, type EstadoPush } from "@/lib/push";

const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";

// Reúne o que o aparelho reporta, para diagnosticar quando "não suporta".
function diagnostico(): { texto: string; standalone: boolean; ios: string; sw: boolean; pm: boolean; nt: boolean } {
  if (typeof window === "undefined") return { texto: "", standalone: false, ios: "", sw: false, pm: false, nt: false };
  const ua = navigator.userAgent || "";
  const m = ua.match(/OS (\d+)[._](\d+)/);
  const ios = m ? `${m[1]}.${m[2]}` : "";
  const standalone = !!(window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || (navigator as unknown as { standalone?: boolean }).standalone === true;
  const sw = "serviceWorker" in navigator;
  const pm = "PushManager" in window;
  const nt = "Notification" in window;
  let texto = "";
  if (!standalone) {
    texto = "Estás a abrir pelo navegador. No iPhone, as notificações só funcionam dentro da app: abre pelo ícone no ecrã principal.";
  } else if (ios && parseFloat(ios) < 16.4) {
    texto = `O iOS deste iPhone (${ios}) é anterior ao 16.4. A Apple só permite notificações a partir do 16.4 — atualiza em Definições → Geral → Atualização de Software.`;
  } else if (!sw || !pm || !nt) {
    const faltam = [!sw ? "Service Worker" : null, !pm ? "PushManager" : null, !nt ? "Notification" : null].filter(Boolean).join(", ");
    texto = `A app está aberta, mas falta(m): ${faltam}. Tira um print desta caixa para resolvermos.`;
  } else {
    texto = "A app está aberta corretamente. Tira um print desta caixa para resolvermos.";
  }
  return { texto, standalone, ios, sw, pm, nt };
}

function IconeSino({ cor = GOLD }: { cor?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={cor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  );
}

export function BotaoNotificacoes({ userId }: { userId: string }) {
  const [estado, setEstado] = useState<EstadoPush>("pendente");
  const [aFazer, setAFazer] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => { setEstado(estadoPush()); }, []);

  async function ativar() {
    setAFazer(true); setMsg("");
    const r = await ativarPush(userId);
    setAFazer(false);
    setEstado(estadoPush());
    setMsg(r.ok ? "Notificações ativadas! 🥋" : (r.erro || "Não foi possível ativar."));
  }
  async function desativar() {
    setAFazer(true); setMsg("");
    await desativarPush();
    setAFazer(false);
    setEstado(estadoPush());
    setMsg("Notificações desativadas neste aparelho.");
  }

  if (estado === "indisponivel") {
    const d = diagnostico();
    return (
      <div style={{ background: "#121815", border: "1px solid #243029", borderRadius: 14, padding: 14 }}>
        <div style={{ fontSize: 13, color: "#c7d0c9", lineHeight: 1.5, marginBottom: 10 }}>
          {d.texto}
        </div>
        <div style={{ fontSize: 11, color: "#5f6f67", lineHeight: 1.6, borderTop: "1px solid #1a221d", paddingTop: 8 }}>
          Diagnóstico: app: <strong style={{ color: d.standalone ? "#7fd1a3" : "#ef8d83" }}>{d.standalone ? "sim" : "não"}</strong>
          {d.ios ? <> · iOS: <strong style={{ color: parseFloat(d.ios) >= 16.4 ? "#7fd1a3" : "#ef8d83" }}>{d.ios}</strong></> : null}
          {" · "}SW: <strong style={{ color: d.sw ? "#7fd1a3" : "#ef8d83" }}>{d.sw ? "sim" : "não"}</strong>
          {" · "}Push: <strong style={{ color: d.pm ? "#7fd1a3" : "#ef8d83" }}>{d.pm ? "sim" : "não"}</strong>
          {" · "}Notif: <strong style={{ color: d.nt ? "#7fd1a3" : "#ef8d83" }}>{d.nt ? "sim" : "não"}</strong>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: "#121815", border: "1px solid #243029", borderRadius: 14, padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <span style={{ width: 38, height: 38, borderRadius: 10, background: "#1c2a20", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><IconeSino /></span>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: FD, fontSize: 14, fontWeight: 700, textTransform: "uppercase" }}>Notificações</div>
          <div style={{ fontSize: 11.5, color: "#93a39a" }}>
            {estado === "concedido" ? "Ativas neste aparelho" : estado === "negado" ? "Bloqueadas no navegador" : "Recebe avisos das tuas competições"}
          </div>
        </div>
      </div>

      {estado === "concedido" ? (
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => notificacaoTesteLocal()} style={btnSec}>Enviar teste</button>
          <button onClick={desativar} disabled={aFazer} style={btnGhost}>Desativar</button>
        </div>
      ) : estado === "negado" ? (
        <div style={{ fontSize: 12, color: "#c7d0c9", lineHeight: 1.5 }}>
          As notificações estão bloqueadas. Para ativar, vai às definições do navegador (ou do site) e permite notificações para a Ippon League.
        </div>
      ) : (
        <button onClick={ativar} disabled={aFazer} style={btnPri}>{aFazer ? "A ativar..." : "Ativar notificações"}</button>
      )}

      {msg && <div style={{ fontSize: 11.5, color: "#7fd1a3", marginTop: 9 }}>{msg}</div>}
    </div>
  );
}

export function LembreteNotificacoes({ userId }: { userId: string }) {
  const [mostrar, setMostrar] = useState(false);
  const [aFazer, setAFazer] = useState(false);

  useEffect(() => {
    if (!suportaPush()) return;
    if (estadoPush() !== "pendente") return;
    try { if (localStorage.getItem("ippon_push_lembrete_dispensado") === "1") return; } catch {}
    setMostrar(true);
  }, []);

  async function ativar() {
    setAFazer(true);
    await ativarPush(userId);
    setAFazer(false);
    setMostrar(false);
  }
  function agoraNao() {
    try { localStorage.setItem("ippon_push_lembrete_dispensado", "1"); } catch {}
    setMostrar(false);
  }

  if (!mostrar) return null;

  return (
    <div style={{ background: "#121815", border: `1px solid ${GOLD}`, borderRadius: 14, padding: 14, marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 11 }}>
        <span style={{ width: 40, height: 40, borderRadius: 11, background: "#1c2a20", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><IconeSino /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: FD, fontSize: 14, fontWeight: 700, textTransform: "uppercase" }}>Quer ser avisado?</div>
          <p style={{ fontSize: 12.5, color: "#c7d0c9", lineHeight: 1.5, margin: "4px 0 0" }}>
            Ativa as notificações e avisamos-te quando uma competição começar, quando faltar montar a equipa e quando houver novidades importantes.
          </p>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button onClick={ativar} disabled={aFazer} style={{ ...btnPri, flex: 1 }}>{aFazer ? "A ativar..." : "Ativar"}</button>
        <button onClick={agoraNao} disabled={aFazer} style={btnGhost}>Agora não</button>
      </div>
    </div>
  );
}

const btnPri: React.CSSProperties = {
  background: GOLD, color: "#1b211e", border: "none", fontFamily: FD, fontSize: 13.5, fontWeight: 700,
  textTransform: "uppercase", letterSpacing: "0.03em", padding: "11px 16px", borderRadius: 10, cursor: "pointer",
};
const btnSec: React.CSSProperties = {
  background: "#1c3a2e", color: "#aee9c9", border: "none", fontFamily: FB, fontSize: 13, fontWeight: 700,
  padding: "10px 14px", borderRadius: 10, cursor: "pointer", flex: 1,
};
const btnGhost: React.CSSProperties = {
  background: "transparent", color: "#93a39a", border: "1px solid #2a3a33", fontFamily: FB, fontSize: 13,
  fontWeight: 700, padding: "10px 14px", borderRadius: 10, cursor: "pointer",
};
