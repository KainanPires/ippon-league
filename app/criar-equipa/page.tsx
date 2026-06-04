"use client";

import { useState, useEffect } from "react";
import { Mascot } from "@/components/Mascot";

const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";

// 8 lugares: 4 masculino + 4 feminino (1 por categoria, escolhida no Mercado).
const SLOTS = [
  { id: "m1", gender: "Masculino" }, { id: "m2", gender: "Masculino" }, { id: "m3", gender: "Masculino" }, { id: "m4", gender: "Masculino" },
  { id: "f1", gender: "Feminino" }, { id: "f2", gender: "Feminino" }, { id: "f3", gender: "Feminino" }, { id: "f4", gender: "Feminino" },
];

type Guide = "welcome" | "counter" | "slot" | null;

export default function CriarEquipa() {
  const [guide, setGuide] = useState<Guide>(null);

  useEffect(() => {
    try {
      const v = localStorage.getItem("ippon_team_tutorial");
      if (!v) setGuide("welcome");
    } catch {}
  }, []);

  function naoMostrarMais() {
    try { localStorage.setItem("ippon_team_tutorial", "skip"); } catch {}
    setGuide(null);
  }

  function openGuide() {
    setGuide("welcome");
  }

  const males = SLOTS.filter((s) => s.gender === "Masculino");
  const females = SLOTS.filter((s) => s.gender === "Feminino");

  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: FB }}>
      <style>{`@keyframes ilglow{0%,100%{box-shadow:0 0 0 3px rgba(74,144,217,0.55)}50%{box-shadow:0 0 0 8px rgba(74,144,217,0.18)}} .ilglow{animation:ilglow 1.3s ease-in-out infinite;border-radius:10px}`}</style>

      <div style={{ maxWidth: 460, margin: "0 auto", padding: "14px 14px 96px" }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
            <a href="/inicio" aria-label="Voltar" style={{ width: 36, height: 36, borderRadius: "50%", border: "1px solid #243029", display: "flex", alignItems: "center", justifyContent: "center", color: "#cfd8d2", textDecoration: "none", flexShrink: 0 }}>
              <BackIcon />
            </a>
            {/* Escudo + nome: placeholders até existir a criação de escudo */}
            <div style={{ width: 40, height: 46, flexShrink: 0 }}><EscudoPlaceholder /></div>
            <div style={{ minWidth: 0 }}>
              <h1 style={{ fontFamily: FD, fontSize: 18, fontWeight: 700, textTransform: "uppercase", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>A tua equipa</h1>
              <div style={{ fontSize: 11, color: "#93a39a" }}>1 por categoria · 4 masc + 4 fem</div>
            </div>
          </div>
          <button onClick={openGuide} aria-label="Como montar a equipa" style={{ width: 36, height: 36, borderRadius: "50%", border: "1px solid #243029", background: "transparent", color: "#93a39a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>?</button>
        </header>

        <div style={{ background: "#2f6fb3", border: "2px solid #25588f", borderRadius: 16, padding: 10 }}>
          <div style={{ background: "#e6b422", border: "2px solid #f0cf6a", borderRadius: 10, padding: "12px 10px" }}>
            <SectionLabel>Masculino</SectionLabel>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 14 }}>
              {males.map((s, i) => <Slot key={s.id} highlight={guide === "slot" && i === 0} />)}
            </div>
            <SectionLabel>Feminino</SectionLabel>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
              {females.map((s) => <Slot key={s.id} highlight={false} />)}
            </div>
          </div>
        </div>

        <p style={{ fontSize: 12, color: "#93a39a", textAlign: "center", marginTop: 14 }}>
          Toca num lugar livre para abrir o Mercado e contratar um atleta.
        </p>
      </div>

      {/* Barra inferior: contador + saldo */}
      <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, background: "#0f1411", borderTop: "1px solid #243029", padding: "12px 14px", zIndex: 50 }}>
        <div style={{ maxWidth: 460, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div className={guide === "counter" ? "ilglow" : undefined} style={{ padding: "3px 8px" }}>
            <span style={{ fontFamily: FD, fontSize: 18, fontWeight: 700, color: GOLD }}>0</span>
            <span style={{ fontFamily: FD, fontSize: 14, fontWeight: 700, color: "#93a39a" }}>/8 atletas</span>
          </div>
          <div style={{ fontSize: 13, color: "#cfd8d2" }}>
            <span style={{ fontFamily: FD, fontWeight: 700, color: GOLD }}>JC 100</span> disponíveis
          </div>
        </div>
      </div>

      {/* Boas-vindas do guia (tela transparente) */}
      {guide === "welcome" && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(6,8,7,0.80)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18, zIndex: 100 }}>
          <div style={{ width: "100%", maxWidth: 320, background: "#121815", border: `1px solid ${GOLD}`, borderRadius: 16, padding: 22, textAlign: "center" }}>
            <div style={{ width: 90, height: 90, margin: "0 auto 4px" }}>
              <Mascot belt="#efeadd" expression="feliz" />
            </div>
            <h2 style={{ fontFamily: FD, fontSize: 22, fontWeight: 700, textTransform: "uppercase", margin: "4px 0 8px" }}>Vamos montar a tua equipa</h2>
            <p style={{ fontSize: 14, color: "#c7d0c9", lineHeight: 1.55, margin: "0 0 20px" }}>
              Eu guio-te! Toca onde eu indicar e, em segundos, tens a tua equipa de 8 atletas pronta para competir.
            </p>
            <button onClick={() => setGuide("counter")} style={primaryBtn}>Vamos!</button>
            <button onClick={naoMostrarMais} style={ghostBtn}>Não mostrar mais</button>
          </div>
        </div>
      )}

      {/* Passo 1: explica o contador 0/8 */}
      {guide === "counter" && (
        <CoachBubble onSkip={naoMostrarMais}>
          <p style={{ fontSize: 13, color: "#f1ede2", margin: 0, lineHeight: 1.45 }}>
            Aqui em baixo, o <strong style={{ color: GOLD }}>0/8 atletas</strong> mostra quantos atletas já tens na equipa. Vais preenchendo até chegares aos 8.
          </p>
          <button onClick={() => setGuide("slot")} style={{ ...nextBtn, marginTop: 10 }}>Seguinte</button>
          <button onClick={naoMostrarMais} style={{ ...skipLink, marginTop: 8 }}>Não mostrar mais</button>
        </CoachBubble>
      )}

      {/* Passo 2: destaca o 1º lugar */}
      {guide === "slot" && (
        <CoachBubble onSkip={naoMostrarMais}>
          <p style={{ fontSize: 13, color: "#f1ede2", margin: 0, lineHeight: 1.45 }}>
            Toca no <strong style={{ color: "#7fb8f5" }}>1.º lugar destacado</strong> (lá em cima) para abrir o Mercado e contratar o teu primeiro atleta.
          </p>
          <button onClick={naoMostrarMais} style={{ ...skipLink, marginTop: 8 }}>Não mostrar mais</button>
        </CoachBubble>
      )}
    </main>
  );
}

const primaryBtn: React.CSSProperties = { width: "100%", padding: 14, borderRadius: 12, border: "none", background: GOLD, color: "#1b211e", fontFamily: FD, fontSize: 16, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", cursor: "pointer" };
const ghostBtn: React.CSSProperties = { marginTop: 10, background: "transparent", border: "none", color: "#93a39a", fontSize: 12, cursor: "pointer", fontFamily: FB };
const nextBtn: React.CSSProperties = { background: GOLD, border: "none", color: "#1b211e", padding: "8px 18px", borderRadius: 9, fontFamily: FD, fontSize: 13, fontWeight: 700, textTransform: "uppercase", cursor: "pointer", alignSelf: "flex-start" };
const skipLink: React.CSSProperties = { background: "transparent", border: "none", color: "#93a39a", fontSize: 11, cursor: "pointer", fontFamily: FB, padding: 0, alignSelf: "flex-start" };

function CoachBubble({ children, onSkip }: { children: React.ReactNode; onSkip: () => void }) {
  void onSkip;
  return (
    <div style={{ position: "fixed", left: 0, right: 0, bottom: 82, display: "flex", justifyContent: "center", padding: "0 14px", zIndex: 90 }}>
      <div style={{ width: "100%", maxWidth: 432, display: "flex", alignItems: "flex-end", gap: 10 }}>
        <div style={{ width: 64, height: 64, flexShrink: 0 }}>
          <Mascot belt="#efeadd" expression="feliz" />
        </div>
        <div style={{ flex: 1, background: "#121815", border: `1px solid ${GOLD}`, borderRadius: 14, padding: "12px 14px", display: "flex", flexDirection: "column" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
      <span style={{ fontFamily: FD, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#5a4a12" }}>{children}</span>
      <span style={{ flex: 1, height: 1, background: "rgba(90,74,18,0.35)" }} />
    </div>
  );
}

function Slot({ highlight }: { highlight: boolean }) {
  return (
    <a
      href="/mercado"
      className={highlight ? "ilglow" : undefined}
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 5,
        padding: "9px 3px 7px",
        borderRadius: 12,
        border: highlight ? "2px solid #5aa9ff" : "1.5px dashed rgba(217,164,65,0.7)",
        background: "rgba(12,14,13,0.62)",
        textDecoration: "none",
        color: "#f1ede2",
      }}
    >
      <div style={{ width: 26, height: 26, borderRadius: "50%", border: `2px solid ${highlight ? "#5aa9ff" : GOLD}`, color: highlight ? "#7fb8f5" : GOLD, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, lineHeight: 1 }}>+</div>
      <div style={{ width: 38, height: 42 }}><GiGhost /></div>
    </a>
  );
}

function GiGhost() {
  return (
    <svg viewBox="0 0 60 70" width="100%" height="100%" aria-hidden="true">
      <path d="M16 16 L7 25 L13 34 L20 29 L20 60 Q30 64 40 60 L40 29 L47 34 L53 25 L44 16 Q37 12 30 12 Q23 12 16 16 Z" fill="rgba(255,255,255,0.10)" stroke="rgba(255,255,255,0.40)" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M26 16 L30 26 L34 16" fill="none" stroke="rgba(255,255,255,0.40)" strokeWidth="1.4" />
      <rect x="18" y="44" width="24" height="5" rx="1" fill="rgba(255,255,255,0.28)" />
    </svg>
  );
}

function EscudoPlaceholder() {
  return (
    <svg viewBox="0 0 48 56" width="100%" height="100%" aria-hidden="true">
      <path d="M24 2 L44 9 V28 C44 42 35 50 24 54 C13 50 4 42 4 28 V9 Z" fill="#1c3a2e" stroke={GOLD} strokeWidth="2" strokeLinejoin="round" />
      <path d="M24 16 l2.6 5.3 5.8 0.8 -4.2 4.1 1 5.8 -5.2 -2.7 -5.2 2.7 1 -5.8 -4.2 -4.1 5.8 -0.8 Z" fill={GOLD} opacity="0.85" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}
