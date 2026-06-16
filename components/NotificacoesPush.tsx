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
    return (
      <div style={{ background: "#121815", border: "1px solid #243029", borderRadius: 14, padding: 14 }}>
        <div style={{ fontSize: 13, color: "#93a39a", lineHeight: 1.5 }}>
          Este aparelho não suporta notificações. No iPhone, instala primeiro a app no ecrã principal e abre por aí.
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
