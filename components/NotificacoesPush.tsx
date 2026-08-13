"use client";

// Notificações push:
//  - BotaoNotificacoes: controlo no perfil (ativar/desativar + teste).
//  - LembreteNotificacoes: banner no dashboard, depois de ter equipa, a pedir
//    permissão com justificação. Só aparece se ainda estiver por ativar e não
//    tiver sido dispensado.

import { useState, useEffect } from "react";
import { suportaPush, estadoPush, ativarPush, desativarPush, type EstadoPush } from "@/lib/push";
import { useT } from "@/lib/i18n";

const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";

// Reúne o que o aparelho reporta, para diagnosticar quando "não suporta".
function diagnostico(t: ReturnType<typeof useT>): { texto: string; standalone: boolean; ios: string; sw: boolean; pm: boolean; nt: boolean } {
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
    texto = t("push.diagNavegador");
  } else if (ios && parseFloat(ios) < 16.4) {
    texto = t("push.diagIosVelho", { ios });
  } else if (!sw || !pm || !nt) {
    const faltam = [!sw ? "Service Worker" : null, !pm ? "PushManager" : null, !nt ? "Notification" : null].filter(Boolean).join(", ");
    texto = t("push.diagFaltam", { faltam });
  } else {
    texto = t("push.diagOk");
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
  const t = useT();
  const [estado, setEstado] = useState<EstadoPush>("pendente");
  const [aFazer, setAFazer] = useState(false);
  const [msg, setMsg] = useState("");
  const [erro, setErro] = useState(false);
  // "Subscrito AGORA neste aparelho": separa a SUBSCRIÇÃO (que controlamos) da
  // PERMISSÃO do iOS (que fica "granted" mesmo após desativar). É isto que evita
  // o botão ficar preso em "Desativar" depois de desativar. null = ainda não
  // sabemos; true = acabou de ativar; false = acabou de desativar.
  const [subscritoAgora, setSubscritoAgora] = useState<boolean | null>(null);

  useEffect(() => { setEstado(estadoPush()); }, []);

  async function ativar() {
    setAFazer(true); setMsg(""); setErro(false);
    const r = await ativarPush(userId);
    setAFazer(false);
    setEstado(estadoPush());
    if (r.ok) {
      setSubscritoAgora(true);
      setErro(false);
      // Diagnóstico útil: mostra a conta para onde foi registado, para se confirmar
      // que é a conta certa (resolve casos de conta trocada no mesmo aparelho).
      setMsg(t("push.ativadas", { conta: userId.slice(0, 8) }));
    } else {
      setErro(true);
      setMsg(r.erro || t("push.naoAtivar"));
    }
  }
  async function desativar() {
    setAFazer(true); setMsg(""); setErro(false);
    await desativarPush();
    setAFazer(false);
    setEstado(estadoPush());
    setSubscritoAgora(false); // <- chave: o botão volta a "Ativar", não fica preso
    setMsg(t("push.desativadas"));
  }

  if (estado === "indisponivel") {
    const d = diagnostico(t);
    return (
      <div style={{ background: "#121815", border: "1px solid #243029", borderRadius: 14, padding: 14 }}>
        <div style={{ fontSize: 13, color: "#c7d0c9", lineHeight: 1.5, marginBottom: 10 }}>
          {d.texto}
        </div>
        <div style={{ fontSize: 11, color: "#5f6f67", lineHeight: 1.6, borderTop: "1px solid #1a221d", paddingTop: 8 }}>
          {t("push.diagnostico")} {t("push.appLabel")} <strong style={{ color: d.standalone ? "#7fd1a3" : "#ef8d83" }}>{d.standalone ? t("push.sim") : t("push.nao")}</strong>
          {d.ios ? <> · iOS: <strong style={{ color: parseFloat(d.ios) >= 16.4 ? "#7fd1a3" : "#ef8d83" }}>{d.ios}</strong></> : null}
          {" · "}SW: <strong style={{ color: d.sw ? "#7fd1a3" : "#ef8d83" }}>{d.sw ? t("push.sim") : t("push.nao")}</strong>
          {" · "}Push: <strong style={{ color: d.pm ? "#7fd1a3" : "#ef8d83" }}>{d.pm ? t("push.sim") : t("push.nao")}</strong>
          {" · "}Notif: <strong style={{ color: d.nt ? "#7fd1a3" : "#ef8d83" }}>{d.nt ? t("push.sim") : t("push.nao")}</strong>
        </div>
      </div>
    );
  }

  // Decide o que mostrar. A PERMISSÃO do iOS já não manda sozinha: o que manda é
  // se o utilizador está subscrito AGORA. Se acabou de desativar (subscritoAgora
  // === false), mostramos o botão "Ativar" mesmo com permissão "granted" — era
  // aqui que o botão ficava preso.
  const negadoNoSO = estado === "negado";
  const mostrarComoAtivo = subscritoAgora === true || (subscritoAgora === null && estado === "concedido");

  return (
    <div style={{ background: "#121815", border: "1px solid #243029", borderRadius: 14, padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <span style={{ width: 38, height: 38, borderRadius: 10, background: "#1c2a20", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><IconeSino /></span>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: FD, fontSize: 14, fontWeight: 700, textTransform: "uppercase" }}>{t("perfil.notificacoes")}</div>
          <div style={{ fontSize: 11.5, color: "#93a39a" }}>
            {mostrarComoAtivo ? t("push.ativas") : negadoNoSO ? t("push.bloqueadas") : t("push.recebeAvisos")}
          </div>
        </div>
      </div>

      {negadoNoSO ? (
        <div style={{ fontSize: 12, color: "#c7d0c9", lineHeight: 1.5 }}>
          {t("push.bloqueadasCorpo")}
        </div>
      ) : mostrarComoAtivo ? (
        <button onClick={desativar} disabled={aFazer} style={{ ...btnGhost, width: "100%" }}>{aFazer ? t("push.aDesativar") : t("push.desativar")}</button>
      ) : (
        <button onClick={ativar} disabled={aFazer} style={btnPri}>{aFazer ? t("push.aAtivar") : t("push.ativar")}</button>
      )}

      {msg && <div style={{ fontSize: 11.5, color: erro ? "#ef8d83" : "#7fd1a3", marginTop: 9, lineHeight: 1.5 }}>{msg}</div>}
    </div>
  );
}

export function LembreteNotificacoes({ userId }: { userId: string }) {
  const t = useT();
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
          <div style={{ fontFamily: FD, fontSize: 14, fontWeight: 700, textTransform: "uppercase" }}>{t("push.querAvisado")}</div>
          <p style={{ fontSize: 12.5, color: "#c7d0c9", lineHeight: 1.5, margin: "4px 0 0" }}>
            {t("push.lembreteCorpo")}
          </p>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button onClick={ativar} disabled={aFazer} style={{ ...btnPri, flex: 1 }}>{aFazer ? t("push.aAtivar") : t("push.ativarCurto")}</button>
        <button onClick={agoraNao} disabled={aFazer} style={btnGhost}>{t("pro.mxAgoraNao")}</button>
      </div>
    </div>
  );
}

const btnPri: React.CSSProperties = {
  background: GOLD, color: "#1b211e", border: "none", fontFamily: FD, fontSize: 13.5, fontWeight: 700,
  textTransform: "uppercase", letterSpacing: "0.03em", padding: "11px 16px", borderRadius: 10, cursor: "pointer",
};
const btnGhost: React.CSSProperties = {
  background: "transparent", color: "#93a39a", border: "1px solid #2a3a33", fontFamily: FB, fontSize: 13,
  fontWeight: 700, padding: "10px 14px", borderRadius: 10, cursor: "pointer",
};
