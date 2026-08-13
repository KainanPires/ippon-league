"use client";

// Sino de notificações + painel (drawer) limpo para mobile.
// Mostra a contagem de não lidas no sino; ao tocar, abre um painel de cima com
// a lista (calculadas + guardadas). Tocar numa notificação marca-a como lida e
// navega para o seu link. Há "marcar todas como lidas".

import { useState, useEffect, useCallback } from "react";
import {
  listarTudo,
  contarNaoLidas,
  marcarLida,
  marcarTodasLidas,
  marcarCalculadaLida,
  type Notificacao,
  type OpcoesCalculadas,
} from "@/lib/notificacoes";
import { useT } from "@/lib/i18n";

const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";

// As calculadas agora recebem o tradutor como 1.º argumento; o `opts` é o 2.º.
// Por isso o tipo do `calcOpts` do sino vem do tipo exportado, não de [0].
type CalcOpts = OpcoesCalculadas;

// Ícone por tipo (emoji simples, sem dependências).
function iconePorTipo(tipo: string): string {
  if (tipo === "mercado") return "🛒";
  if (tipo.startsWith("copa")) return "🏆";
  if (tipo.startsWith("liga")) return "🛡️";
  if (tipo.startsWith("faixa")) return "🥋";
  if (tipo === "ranking") return "📈";
  if (tipo === "resumo_rodada") return "📊";
  return "🔔";
}

export function SinoNotificacoes({ calcOpts }: { calcOpts?: CalcOpts }) {
  const t = useT();
  const [aberto, setAberto] = useState(false);
  const [lista, setLista] = useState<Notificacao[]>([]);
  const [naoLidas, setNaoLidas] = useState(0);
  const [carregando, setCarregando] = useState(false);

  function tempoRelativo(ms: number): string {
    const diff = Date.now() - ms;
    const min = Math.floor(diff / 60000);
    if (min < 1) return t("sino.agora");
    if (min < 60) return t("sino.hMin", { min });
    const h = Math.floor(min / 60);
    if (h < 24) return t("sino.hH", { h });
    const d = Math.floor(h / 24);
    return t("sino.hD", { d });
  }

  // Conta as não lidas ao montar (para o ponto vermelho), sem abrir o painel.
  const atualizarContagem = useCallback(async () => {
    try {
      const n = await contarNaoLidas(t, calcOpts);
      setNaoLidas(n);
    } catch {}
  }, [calcOpts, t]);

  useEffect(() => {
    atualizarContagem();
  }, [atualizarContagem]);

  // Ao abrir, carrega a lista completa.
  async function abrir() {
    setAberto(true);
    setCarregando(true);
    try {
      const tudo = await listarTudo(t, calcOpts);
      setLista(tudo);
    } catch {
      setLista([]);
    }
    setCarregando(false);
  }

  function fechar() {
    setAberto(false);
    // Recalcula a contagem (algumas podem ter sido lidas).
    atualizarContagem();
  }

  async function tocar(n: Notificacao) {
    // Marca como lida (na BD se guardada; no aparelho se calculada).
    if (n.calculada) marcarCalculadaLida(n);
    else await marcarLida(n.id);
    setLista((prev) => prev.map((x) => (x.id === n.id ? { ...x, lida: true } : x)));
    if (n.link) {
      window.location.href = n.link;
    } else {
      atualizarContagem();
    }
  }

  async function lerTodas() {
    await marcarTodasLidas();
    // As calculadas também passam a vistas.
    lista.forEach((n) => { if (n.calculada) marcarCalculadaLida(n); });
    setLista((prev) => prev.map((x) => ({ ...x, lida: true })));
    setNaoLidas(0);
  }

  return (
    <>
      <button
        onClick={abrir}
        aria-label={t("perfil.notificacoes")}
        style={{ position: "relative", width: 36, height: 36, borderRadius: "50%", border: "1px solid #243029", background: "transparent", color: "#93a39a", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {naoLidas > 0 && (
          <span style={{ position: "absolute", top: 4, right: 5, minWidth: 16, height: 16, padding: "0 4px", borderRadius: 999, background: "#e2655a", color: "#fff", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FD }}>
            {naoLidas > 9 ? "9+" : naoLidas}
          </span>
        )}
      </button>

      {aberto && (
        <div
          onClick={fechar}
          style={{ position: "fixed", inset: 0, background: "rgba(6,8,7,0.6)", zIndex: 200, display: "flex", justifyContent: "center", alignItems: "flex-start" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: "100%", maxWidth: 460, background: "#0f1411", borderBottomLeftRadius: 18, borderBottomRightRadius: 18, maxHeight: "82vh", display: "flex", flexDirection: "column", borderBottom: "1px solid #243029", boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 16px 12px", borderBottom: "1px solid #1a221d" }}>
              <span style={{ fontFamily: FD, fontSize: 17, fontWeight: 700, textTransform: "uppercase", color: "#f1ede2" }}>{t("perfil.notificacoes")}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {lista.some((n) => !n.lida) && (
                  <button onClick={lerTodas} style={{ background: "transparent", border: "none", color: GOLD, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: FB }}>{t("sino.marcarLidas")}</button>
                )}
                <button onClick={fechar} aria-label={t("comum.fechar")} style={{ background: "transparent", border: "none", color: "#93a39a", fontSize: 20, cursor: "pointer", lineHeight: 1 }}>✕</button>
              </div>
            </div>

            <div className="noscroll" style={{ overflowY: "auto", padding: "8px 12px 16px" }}>
              {carregando ? (
                <div style={{ padding: "30px 12px", textAlign: "center", color: "#7c8a82", fontSize: 13, fontFamily: FD, letterSpacing: "0.08em", textTransform: "uppercase" }}>{t("comum.carregando")}</div>
              ) : lista.length === 0 ? (
                <div style={{ padding: "34px 16px", textAlign: "center" }}>
                  <div style={{ fontSize: 34, marginBottom: 8 }}>🔔</div>
                  <div style={{ fontSize: 14, color: "#c7d0c9", fontWeight: 700 }}>{t("sino.semNotif")}</div>
                  <div style={{ fontSize: 12.5, color: "#7c8a82", marginTop: 4, lineHeight: 1.4 }}>{t("sino.semNotifCorpo")}</div>
                </div>
              ) : (
                lista.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => tocar(n)}
                    style={{ width: "100%", textAlign: "left", display: "flex", gap: 11, alignItems: "flex-start", background: n.lida ? "transparent" : "#141d18", border: `1px solid ${n.lida ? "#1a221d" : "#2a4d3e"}`, borderRadius: 12, padding: "11px 12px", marginBottom: 8, cursor: "pointer", fontFamily: FB }}
                  >
                    <div style={{ fontSize: 20, lineHeight: 1.2, flexShrink: 0 }}>{iconePorTipo(n.tipo)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                        <span style={{ fontSize: 13.5, fontWeight: 700, color: "#f1ede2" }}>{n.titulo}</span>
                        {!n.calculada && <span style={{ fontSize: 10.5, color: "#5f6f67", whiteSpace: "nowrap", flexShrink: 0 }}>{tempoRelativo(n.criadaEm)}</span>}
                      </div>
                      {n.corpo && <div style={{ fontSize: 12.5, color: "#93a39a", marginTop: 2, lineHeight: 1.4 }}>{n.corpo}</div>}
                    </div>
                    {!n.lida && <span style={{ width: 8, height: 8, borderRadius: "50%", background: GOLD, flexShrink: 0, marginTop: 5 }} />}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
