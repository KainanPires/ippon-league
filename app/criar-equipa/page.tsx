"use client";

import { useState, useEffect } from "react";
import { Mascot } from "@/components/Mascot";
import { type Athlete } from "@/lib/athletes";
import { loadDraft, saveDraft, loadSaved, commitSaved, resolve, jcLeft, counts, isComplete, missing, type TeamState } from "@/lib/team";
import { Escudo, loadIdentity, DEFAULT_IDENTITY, type Identity } from "@/components/Escudo";

const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";

const IOC: Record<string, string> = {
  JP: "JPN", FR: "FRA", BR: "BRA", GE: "GEO", KZ: "KAZ", AZ: "AZE", BE: "BEL",
  TR: "TUR", UZ: "UZB", RU: "AIN", DE: "GER", XK: "KOS", IT: "ITA", CA: "CAN",
  SI: "SLO", HR: "CRO", NL: "NED",
};
const code3 = (iso: string) => IOC[iso] || iso;
const fmt = (n: number) => String(Math.round(n * 10) / 10);

type Guide = "welcome" | "counter" | "slot" | null;
type Modal = { kind: "missing" | "saved" | "trash" } | { kind: "athlete"; a: Athlete } | null;

export default function CriarEquipa() {
  const [guide, setGuide] = useState<Guide>(null);
  const [draft, setDraft] = useState<TeamState>({ ids: [], captain: null });
  const [saved, setSaved] = useState<TeamState>({ ids: [], captain: null });
  const [modal, setModal] = useState<Modal>(null);
  const [identity, setIdentity] = useState<Identity>(DEFAULT_IDENTITY);

  useEffect(() => {
    try {
      setDraft(loadDraft());
      setSaved(loadSaved());
      setIdentity(loadIdentity());
      if (!localStorage.getItem("ippon_team_tutorial")) setGuide("welcome");
    } catch {}
  }, []);

  function update(next: TeamState) { setDraft(next); saveDraft(next); }
  function naoMostrarMais() { try { localStorage.setItem("ippon_team_tutorial", "skip"); } catch {} setGuide(null); }
  function openGuide() { setGuide("welcome"); }

  function setCaptain(id: string) {
    update({ ...draft, captain: draft.captain === id ? null : id });
    setModal(null);
  }
  function clearAll() { update({ ids: [], captain: null }); setModal(null); }
  function revert() { setDraft(saved); saveDraft(saved); }
  function save() {
    if (isComplete(draft)) { commitSaved(draft); setSaved(draft); setModal({ kind: "saved" }); }
    else { setModal({ kind: "missing" }); }
  }

  const all = resolve(draft.ids);
  const males = all.filter((a) => a.gender === "M");
  const females = all.filter((a) => a.gender === "F");
  const total = all.length;
  const left = jcLeft(draft);
  const changed = JSON.stringify(draft) !== JSON.stringify(saved);
  const firstEmpty = males.length < 4 ? { row: "M", i: males.length } : females.length < 4 ? { row: "F", i: females.length } : null;

  function renderRow(list: Athlete[], row: "M" | "F") {
    return Array.from({ length: 4 }).map((_, i) => {
      const a = list[i];
      const highlight = guide === "slot" && firstEmpty != null && firstEmpty.row === row && firstEmpty.i === i;
      return a
        ? <FilledSlot key={row + i} a={a} isCaptain={draft.captain === a.id} onClick={() => setModal({ kind: "athlete", a })} />
        : <EmptySlot key={row + i} highlight={highlight} />;
    });
  }

  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: FB }}>
      <style>{`@keyframes ilglow{0%,100%{box-shadow:0 0 0 3px rgba(74,144,217,0.55)}50%{box-shadow:0 0 0 8px rgba(74,144,217,0.18)}} .ilglow{animation:ilglow 1.3s ease-in-out infinite;border-radius:10px}`}</style>

      <div style={{ maxWidth: 460, margin: "0 auto", padding: "14px 14px 104px" }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
            <a href="/inicio" aria-label="Voltar" style={{ width: 36, height: 36, borderRadius: "50%", border: "1px solid #243029", display: "flex", alignItems: "center", justifyContent: "center", color: "#cfd8d2", textDecoration: "none", flexShrink: 0 }}>
              <BackIcon />
            </a>
            <div style={{ display: "flex", alignItems: "center", gap: 11, color: "#f1ede2", minWidth: 0 }}>
              <div style={{ flexShrink: 0, display: "flex" }}><Escudo config={identity} size={40} /></div>
              <div style={{ minWidth: 0 }}>
                <h1 style={{ fontFamily: FD, fontSize: 18, fontWeight: 700, textTransform: "uppercase", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{identity.name}</h1>
                <div style={{ fontSize: 11, color: "#93a39a" }}>1 por categoria · 4 masc + 4 fem</div>
              </div>
            </div>
          </div>
          <button onClick={openGuide} aria-label="Como montar a equipa" style={{ width: 36, height: 36, borderRadius: "50%", border: "1px solid #243029", background: "transparent", color: "#93a39a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>?</button>
        </header>

        <div style={{ background: "#2f6fb3", border: "2px solid #25588f", borderRadius: 16, padding: 10 }}>
          <div style={{ background: "#e6b422", border: "2px solid #f0cf6a", borderRadius: 10, padding: "12px 10px" }}>
            <SectionLabel>Masculino</SectionLabel>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 14 }}>{renderRow(males, "M")}</div>
            <SectionLabel>Feminino</SectionLabel>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>{renderRow(females, "F")}</div>
          </div>
        </div>

        <p style={{ fontSize: 12, color: "#93a39a", textAlign: "center", marginTop: 14 }}>
          Toca num lugar livre para abrir o Mercado. Toca num atleta para o tornar capitão.
        </p>
      </div>

      <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, background: "#0f1411", borderTop: "1px solid #243029", padding: "10px 14px", zIndex: 50 }}>
        <div style={{ maxWidth: 460, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div className={guide === "counter" ? "ilglow" : undefined} style={{ padding: "2px 6px" }}>
            <div><span style={{ fontFamily: FD, fontSize: 17, fontWeight: 700, color: GOLD }}>{total}</span><span style={{ fontFamily: FD, fontSize: 13, fontWeight: 700, color: "#93a39a" }}>/8</span></div>
            <div style={{ fontSize: 11, color: "#cfd8d2" }}>JC {fmt(left)}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {changed && saved.ids.length > 0 && (
              <button onClick={revert} style={{ background: "transparent", border: "none", color: "#93a39a", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: FB }}>Reverter</button>
            )}
            <button onClick={() => setModal({ kind: "trash" })} aria-label="Limpar equipa" style={{ width: 42, height: 42, borderRadius: 10, border: "1px solid #3a2422", background: "transparent", color: "#ef8d83", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
              <TrashIcon />
            </button>
            <button onClick={save} style={{ background: GOLD, color: "#1b211e", border: "none", fontFamily: FD, fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", padding: "11px 18px", borderRadius: 10, cursor: "pointer" }}>Salvar equipa</button>
          </div>
        </div>
      </div>

      {guide === "welcome" && (
        <div style={overlayBg}>
          <div style={cardBox}>
            <div style={{ width: 90, height: 90, margin: "0 auto 4px" }}><Mascot belt="#efeadd" expression="feliz" /></div>
            <h2 style={{ fontFamily: FD, fontSize: 22, fontWeight: 700, textTransform: "uppercase", margin: "4px 0 8px" }}>Vamos montar a tua equipa</h2>
            <p style={{ fontSize: 14, color: "#c7d0c9", lineHeight: 1.55, margin: "0 0 20px" }}>Eu guio-te! Toca onde eu indicar e, em segundos, tens a tua equipa de 8 atletas pronta para competir.</p>
            <button onClick={() => setGuide("counter")} style={primaryBtn}>Vamos!</button>
            <button onClick={naoMostrarMais} style={ghostBtn}>Não mostrar mais</button>
          </div>
        </div>
      )}
      {guide === "counter" && (
        <CoachBubble>
          <p style={coachP}>Aqui em baixo, o <strong style={{ color: GOLD }}>{total}/8</strong> mostra quantos atletas já tens. Vais preenchendo até teres 8.</p>
          <button onClick={() => setGuide("slot")} style={{ ...nextBtn, marginTop: 10 }}>Seguinte</button>
          <button onClick={naoMostrarMais} style={{ ...skipLink, marginTop: 8 }}>Não mostrar mais</button>
        </CoachBubble>
      )}
      {guide === "slot" && (
        <CoachBubble>
          <p style={coachP}>Toca no <strong style={{ color: "#7fb8f5" }}>lugar destacado</strong> para abrir o Mercado e contratar um atleta.</p>
          <button onClick={naoMostrarMais} style={{ ...skipLink, marginTop: 8 }}>Não mostrar mais</button>
        </CoachBubble>
      )}

      {modal?.kind === "missing" && (
        <div style={overlayBg}>
          <div style={cardBox}>
            <div style={{ width: 84, height: 84, margin: "0 auto 4px" }}><Mascot belt="#efeadd" expression="feliz" /></div>
            <h2 style={{ fontFamily: FD, fontSize: 20, fontWeight: 700, textTransform: "uppercase", margin: "4px 0 8px" }}>Falta pouco!</h2>
            <p style={{ fontSize: 13, color: "#c7d0c9", margin: "0 0 12px" }}>Para guardares a equipa ainda precisas de:</p>
            <div style={{ textAlign: "left", display: "flex", flexDirection: "column", gap: 7, marginBottom: 18 }}>
              {missing(draft).map((m) => (
                <div key={m} style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
                  <span style={{ color: "#ef8d83", fontWeight: 700 }}>•</span>
                  <span style={{ fontSize: 13, color: "#f1ede2" }}>{m}</span>
                </div>
              ))}
            </div>
            <button onClick={() => setModal(null)} style={primaryBtn}>Continuar a montar</button>
          </div>
        </div>
      )}
      {modal?.kind === "saved" && (
        <div style={overlayBg}>
          <div style={cardBox}>
            <div style={{ width: 88, height: 88, margin: "0 auto 4px" }}><Mascot belt="#efeadd" expression="feliz" /></div>
            <h2 style={{ fontFamily: FD, fontSize: 22, fontWeight: 700, textTransform: "uppercase", margin: "4px 0 8px", color: GOLD }}>Equipa salva!</h2>
            <p style={{ fontSize: 14, color: "#c7d0c9", lineHeight: 1.5, margin: "0 0 20px" }}>A tua equipa está pronta para competir. Boa sorte na próxima rodada!</p>
            <button onClick={() => setModal(null)} style={primaryBtn}>Fechar</button>
          </div>
        </div>
      )}
      {modal?.kind === "trash" && (
        <div style={overlayBg}>
          <div style={cardBox}>
            <div style={{ width: 84, height: 84, margin: "0 auto 4px" }}><Mascot belt="#efeadd" expression="determinado" /></div>
            <h2 style={{ fontFamily: FD, fontSize: 20, fontWeight: 700, textTransform: "uppercase", margin: "4px 0 8px" }}>Limpar a equipa?</h2>
            <p style={{ fontSize: 14, color: "#c7d0c9", lineHeight: 1.5, margin: "0 0 20px" }}>Isto remove todos os atletas e vais ter de escalar de novo.</p>
            <button onClick={clearAll} style={{ ...primaryBtn, background: "#e2655a", color: "#1b0f0e" }}>Sim, limpar tudo</button>
            <button onClick={() => setModal(null)} style={ghostBtn}>Cancelar</button>
          </div>
        </div>
      )}
      {modal?.kind === "athlete" && (
        <div style={overlayBg}>
          <div style={cardBox}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div style={{ width: 44, height: 48, borderRadius: 8, background: "linear-gradient(160deg,#2a4d3e,#1c3a2e)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <div style={{ background: "#f1ede2", color: "#1b211e", fontFamily: FD, fontWeight: 700, fontSize: 9, padding: "1px 4px", borderRadius: 3 }}>{code3(modal.a.countryIso)}</div>
              </div>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{modal.a.name}</div>
                <div style={{ fontSize: 12, color: "#93a39a" }}>{code3(modal.a.countryIso)} · {modal.a.category}kg · <span style={{ color: GOLD }}>JC {modal.a.priceJc.toFixed(1)}</span></div>
              </div>
            </div>
            <button onClick={() => setCaptain(modal.a.id)} style={{ ...primaryBtn, background: draft.captain === modal.a.id ? "#1c3a2e" : GOLD, color: draft.captain === modal.a.id ? "#aee9c9" : "#1b211e" }}>
              {draft.captain === modal.a.id ? "Remover capitão" : "Tornar capitão (pontua x2)"}
            </button>
            <a href="/mercado" style={{ display: "block", marginTop: 10, textAlign: "center", border: "1px solid #243029", color: "#cfd8d2", padding: "11px", borderRadius: 12, textDecoration: "none", fontSize: 14, fontFamily: FB }}>Trocar no Mercado</a>
            <button onClick={() => setModal(null)} style={ghostBtn}>Fechar</button>
          </div>
        </div>
      )}
    </main>
  );
}

const overlayBg: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(6,8,7,0.82)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18, zIndex: 100 };
const cardBox: React.CSSProperties = { width: "100%", maxWidth: 320, background: "#121815", border: `1px solid ${GOLD}`, borderRadius: 16, padding: 22, textAlign: "center" };
const primaryBtn: React.CSSProperties = { width: "100%", padding: 13, borderRadius: 12, border: "none", background: GOLD, color: "#1b211e", fontFamily: FD, fontSize: 15, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", cursor: "pointer" };
const ghostBtn: React.CSSProperties = { marginTop: 10, background: "transparent", border: "none", color: "#93a39a", fontSize: 12, cursor: "pointer", fontFamily: FB };
const nextBtn: React.CSSProperties = { background: GOLD, border: "none", color: "#1b211e", padding: "8px 18px", borderRadius: 9, fontFamily: FD, fontSize: 13, fontWeight: 700, textTransform: "uppercase", cursor: "pointer", alignSelf: "flex-start" };
const skipLink: React.CSSProperties = { background: "transparent", border: "none", color: "#93a39a", fontSize: 11, cursor: "pointer", fontFamily: FB, padding: 0, alignSelf: "flex-start" };
const coachP: React.CSSProperties = { fontSize: 13, color: "#f1ede2", margin: 0, lineHeight: 1.45 };

function CoachBubble({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: "fixed", left: 0, right: 0, bottom: 88, display: "flex", justifyContent: "center", padding: "0 14px", zIndex: 90 }}>
      <div style={{ width: "100%", maxWidth: 432, display: "flex", alignItems: "flex-end", gap: 10 }}>
        <div style={{ width: 64, height: 64, flexShrink: 0 }}><Mascot belt="#efeadd" expression="feliz" /></div>
        <div style={{ flex: 1, background: "#121815", border: `1px solid ${GOLD}`, borderRadius: 14, padding: "12px 14px", display: "flex", flexDirection: "column" }}>{children}</div>
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

function FilledSlot({ a, isCaptain, onClick }: { a: Athlete; isCaptain: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "8px 3px", borderRadius: 12, border: `1.5px solid ${isCaptain ? "#FF8F00" : "#2f4a3c"}`, background: "rgba(12,14,13,0.78)", color: "#f1ede2", minWidth: 0, cursor: "pointer", fontFamily: FB }}>
      {isCaptain && <div style={{ position: "absolute", top: -8, right: -5, background: "#FF8F00", border: "1px solid #c2410c", color: "#1b1208", fontFamily: FD, fontWeight: 700, fontSize: 11, padding: "1px 6px", borderRadius: 5, lineHeight: 1.3, boxShadow: "0 1px 3px rgba(0,0,0,0.4)" }}>C</div>}
      <div style={{ width: 30, height: 34, borderRadius: 6, background: "linear-gradient(160deg,#2a4d3e,#1c3a2e)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ background: "#f1ede2", color: "#1b211e", fontFamily: FD, fontWeight: 700, fontSize: 8, padding: "1px 3px", borderRadius: 2 }}>{code3(a.countryIso)}</div>
      </div>
      <div style={{ fontSize: 10, fontWeight: 700, width: "100%", textAlign: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.name.split(" ").slice(-1)[0]}</div>
      <div style={{ fontSize: 9, color: "#93a39a" }}>{a.category}kg</div>
      <div style={{ fontFamily: FD, fontSize: 11, fontWeight: 700, color: "#7fd1a3" }}>JC {a.priceJc.toFixed(1)}</div>
    </button>
  );
}

function EmptySlot({ highlight }: { highlight: boolean }) {
  return (
    <a href="/mercado" className={highlight ? "ilglow" : undefined} style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 5, padding: "9px 3px 7px", borderRadius: 12, border: highlight ? "2px solid #5aa9ff" : "1.5px dashed rgba(217,164,65,0.7)", background: "rgba(12,14,13,0.62)", textDecoration: "none", color: "#f1ede2" }}>
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

function BackIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
  );
}
function TrashIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" /></svg>
  );
}
