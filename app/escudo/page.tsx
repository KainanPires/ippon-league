"use client";

import { useState, useEffect, useRef } from "react";
import { Escudo, SymbolGlyph, loadIdentity, saveIdentity, SHAPES, PATTERNS, SYMBOLS, COLORS, type Identity, type ShapeId, type PatternId, type SymbolId } from "@/components/Escudo";

const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";
const ORANGE = "#e67e22";

type Slot = "bg1" | "bg2" | "stamp1" | "stamp2" | "border";
const SLOTS: { id: Slot; label: string }[] = [
  { id: "bg1", label: "Fundo 1" },
  { id: "bg2", label: "Fundo 2" },
  { id: "stamp1", label: "Estampa 1" },
  { id: "stamp2", label: "Estampa 2" },
  { id: "border", label: "Borda" },
];

export default function EscudoEditor() {
  const [id, setId] = useState<Identity | null>(null);
  const [slot, setSlot] = useState<Slot>("bg1");

  useEffect(() => { setId(loadIdentity()); }, []);
  if (!id) return <main style={{ minHeight: "100vh", background: "#0c0e0d" }} />;

  function set<K extends keyof Identity>(key: K, value: Identity[K]) {
    setId((prev) => (prev ? { ...prev, [key]: value } : prev));
  }
  function rnd<T>(a: T[]): T { return a[Math.floor(Math.random() * a.length)]; }
  function sortear() {
    setId((p) => p ? { ...p, shape: rnd(SHAPES), pattern: rnd(PATTERNS).id, symbol: rnd(SYMBOLS).id, bg1: rnd(COLORS), bg2: rnd(COLORS), stamp1: rnd(COLORS), stamp2: rnd(COLORS), border: rnd(COLORS) } : p);
  }
  function guardar() {
    saveIdentity({ ...id!, name: id!.name.trim() || "A minha equipa" });
    window.location.href = "/inicio";
  }

  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: FB }}>
      <div style={{ maxWidth: 460, margin: "0 auto", padding: "0 0 110px" }}>
        <header style={{ display: "flex", alignItems: "center", gap: 11, padding: "14px 16px" }}>
          <a href="/inicio" aria-label="Voltar ao início" style={{ width: 36, height: 36, borderRadius: "50%", border: "1px solid #243029", display: "flex", alignItems: "center", justifyContent: "center", color: "#cfd8d2", textDecoration: "none", flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
          </a>
          <h1 style={{ fontFamily: FD, fontSize: 18, fontWeight: 700, textTransform: "uppercase", margin: 0 }}>Personalizar escudo</h1>
        </header>

        <div style={{ background: "radial-gradient(circle at 50% 28%, #173029, #0c0e0d 72%)", borderTop: "1px solid #1a221d", borderBottom: "1px solid #1a221d", padding: "18px 16px 14px", textAlign: "center" }}>
          <div style={{ filter: "drop-shadow(0 8px 16px rgba(0,0,0,0.5))", display: "inline-block" }}>
            <Escudo config={id} size={128} />
          </div>
          <div style={{ fontFamily: FD, fontSize: 18, fontWeight: 700, textTransform: "uppercase", marginTop: 8, wordBreak: "break-word" }}>{id.name.trim() || "A minha equipa"}</div>
          <button onClick={sortear} style={{ marginTop: 10, display: "inline-flex", alignItems: "center", gap: 7, background: "transparent", border: "none", color: "#7fd1a3", fontFamily: FD, fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", cursor: "pointer" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5" /></svg>
            Sortear
          </button>
        </div>

        <div style={{ padding: "18px 16px 0" }}>
          <Label>Nome do time</Label>
          <input value={id.name} onChange={(e) => set("name", e.target.value.slice(0, 24))} placeholder="Escreve o nome da tua equipa"
            style={{ width: "100%", boxSizing: "border-box", background: "#141a17", border: "1px solid #243029", borderRadius: 12, padding: "12px 14px", color: "#f1ede2", fontSize: 15, fontFamily: FB, outline: "none", marginBottom: 24 }} />

          <CenterLabel>Escolher forma</CenterLabel>
          <ScrollRow>
            {SHAPES.map((s) => (
              <Thumb key={s} on={id.shape === s} onClick={() => set("shape", s as ShapeId)}>
                <Escudo config={{ ...id, shape: s as ShapeId }} size={40} />
              </Thumb>
            ))}
          </ScrollRow>

          <CenterLabel>Escolher estampa</CenterLabel>
          <ScrollRow>
            {PATTERNS.map((p) => (
              <Thumb key={p.id} on={id.pattern === p.id} onClick={() => set("pattern", p.id as PatternId)}>
                <Escudo config={{ ...id, shape: "circle", pattern: p.id as PatternId }} size={40} />
              </Thumb>
            ))}
          </ScrollRow>

          <CenterLabel>Escolher cores</CenterLabel>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 14, marginBottom: 14 }}>
            {SLOTS.map((s) => (
              <div key={s.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <div style={{ fontSize: 10.5, color: slot === s.id ? GOLD : "#93a39a", fontWeight: 700 }}>{s.label}</div>
                <button onClick={() => setSlot(s.id)} aria-label={s.label} style={{ width: 42, height: 42, borderRadius: "50%", background: id[s.id], border: `2px solid ${slot === s.id ? GOLD : "rgba(255,255,255,0.25)"}`, boxShadow: slot === s.id ? `0 0 0 3px rgba(217,164,65,0.35)` : "none", cursor: "pointer" }} />
              </div>
            ))}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 10, marginBottom: 24 }}>
            {COLORS.map((c) => {
              const on = id[slot].toLowerCase() === c.toLowerCase();
              return <button key={c} onClick={() => set(slot, c)} aria-label={c} style={{ width: 34, height: 34, borderRadius: "50%", background: c, border: `2px solid ${on ? "#f1ede2" : "rgba(255,255,255,0.18)"}`, boxShadow: on ? `0 0 0 2px ${GOLD}` : "none", cursor: "pointer" }} />;
            })}
          </div>

          <CenterLabel>Escolher adorno</CenterLabel>
          <ScrollRow>
            {SYMBOLS.map((s) => (
              <Thumb key={s.id} on={id.symbol === s.id} onClick={() => set("symbol", s.id as SymbolId)}>
                {s.id === "none" ? <span style={{ color: "#7c8a82", fontSize: 13 }}>—</span> : <svg viewBox="0 0 24 24" width={22} height={22}><SymbolGlyph id={s.id as SymbolId} color="#f1ede2" /></svg>}
              </Thumb>
            ))}
          </ScrollRow>
        </div>
      </div>

      <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, background: "#0f1411", borderTop: "1px solid #243029", padding: "12px 16px", zIndex: 50 }}>
        <div style={{ maxWidth: 460, margin: "0 auto" }}>
          <button onClick={guardar} style={{ width: "100%", padding: 14, borderRadius: 12, border: "none", background: ORANGE, color: "#1b0f06", fontFamily: FD, fontSize: 16, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", cursor: "pointer" }}>Salvar escudo</button>
        </div>
      </div>
    </main>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily: FD, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#93a39a", marginBottom: 9 }}>{children}</div>;
}
function CenterLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily: FD, fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#cfd8d2", textAlign: "center", marginBottom: 12 }}>{children}</div>;
}
function Thumb({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{ flex: "0 0 auto", width: 52, height: 52, display: "flex", alignItems: "center", justifyContent: "center", background: on ? "#16201b" : "#121815", border: `2px solid ${on ? GOLD : "#243029"}`, borderRadius: "50%", cursor: "pointer" }}>
      {children}
    </button>
  );
}
function ScrollRow({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const go = (dir: number) => { if (ref.current) ref.current.scrollBy({ left: dir * 150, behavior: "smooth" }); };
  return (
    <div style={{ position: "relative", marginBottom: 22 }}>
      <Arrow side="left" onClick={() => go(-1)} />
      <div ref={ref} style={{ display: "flex", gap: 9, overflowX: "auto", WebkitOverflowScrolling: "touch", scrollbarWidth: "none", padding: "2px 34px" }}>
        {children}
      </div>
      <Arrow side="right" onClick={() => go(1)} />
    </div>
  );
}
function Arrow({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-label={side === "left" ? "Anterior" : "Seguinte"} style={{ position: "absolute", top: "50%", transform: "translateY(-50%)", [side]: 0, width: 30, height: 30, borderRadius: "50%", background: "rgba(15,20,17,0.92)", border: "1px solid #2a3a33", color: "#f1ede2", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", zIndex: 2 } as React.CSSProperties}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={side === "left" ? "M15 18l-6-6 6-6" : "M9 18l6-6-6-6"} />
      </svg>
    </button>
  );
}
