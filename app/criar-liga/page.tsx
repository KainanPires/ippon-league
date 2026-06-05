"use client";

import { useState, useRef } from "react";
import { Escudo, SymbolGlyph, SHAPES, PATTERNS, LEAGUE_SYMBOLS, COLORS, DEFAULT_IDENTITY, type Identity, type ShapeId, type PatternId, type SymbolId } from "@/components/Escudo";
import { addLeague, newId, newInviteCode, DEFAULT_LEAGUE_SHIELD, type LeagueFormat, type LeaguePrivacy, type MyLeague } from "@/lib/leagues";

const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";

const COLOR_SLOTS: { key: keyof Identity; label: string }[] = [
  { key: "bg1", label: "Fundo 1" },
  { key: "bg2", label: "Fundo 2" },
  { key: "stamp1", label: "Estampa 1" },
  { key: "stamp2", label: "Estampa 2" },
  { key: "border", label: "Borda" },
];

const rnd = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

export default function CriarLiga() {
  const [step, setStep] = useState<"criar" | "convites">("criar");
  const [cfg, setCfg] = useState<Identity>(DEFAULT_LEAGUE_SHIELD);
  const [name, setName] = useState("");
  const [format, setFormat] = useState<LeagueFormat>("pontos");
  const [formatName, setFormatName] = useState("");
  const [privacy, setPrivacy] = useState<LeaguePrivacy>("fechada");
  const [activeColor, setActiveColor] = useState<keyof Identity>("bg1");
  const [created, setCreated] = useState<MyLeague | null>(null);
  const [copied, setCopied] = useState(false);

  function set<K extends keyof Identity>(key: K, value: Identity[K]) {
    setCfg((prev) => ({ ...prev, [key]: value }));
  }
  function sortear() {
    setCfg((p) => ({ ...p, shape: rnd(SHAPES), pattern: rnd(PATTERNS).id, symbol: rnd(LEAGUE_SYMBOLS).id, bg1: rnd(COLORS), bg2: rnd(COLORS), stamp1: rnd(COLORS), stamp2: rnd(COLORS), border: rnd(COLORS) }));
  }

  const canCreate = name.trim().length >= 2;

  function criar() {
    if (!canCreate) return;
    const lg: MyLeague = {
      id: newId(),
      name: name.trim(),
      format,
      formatName: formatName.trim() || (format === "copa" ? "Copa Ippon" : "Pontos Corridos"),
      privacy,
      cfg: { ...cfg, name: name.trim() },
      inviteCode: newInviteCode(),
      createdAt: Date.now(),
    };
    addLeague(lg);
    setCreated(lg);
    setStep("convites");
  }

  const inviteLink = created ? `https://ippon-league.vercel.app/liga/${created.inviteCode}` : "";
  function copy() {
    try { navigator.clipboard.writeText(inviteLink); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch {}
  }

  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: FB }}>
      <div style={{ maxWidth: 460, margin: "0 auto", padding: "14px 16px 40px" }}>
        <header style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
          {step === "criar" ? (
            <a href="/ligas" aria-label="Voltar" style={backBtn}><BackArrow /></a>
          ) : (
            <button onClick={() => setStep("criar")} aria-label="Voltar" style={{ ...backBtn, cursor: "pointer" }}><BackArrow /></button>
          )}
          <span style={{ fontFamily: FD, fontSize: 19, fontWeight: 700, textTransform: "uppercase" }}>{step === "criar" ? "Criar liga" : "Convidar"}</span>
        </header>

        {step === "criar" ? (
          <>
            {/* Escudo da liga */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 8 }}>
              <Escudo config={cfg} size={96} />
              <button onClick={sortear} style={{ marginTop: 10, background: "#141a17", border: "1px solid #243029", color: "#cfd8d2", fontFamily: FD, fontWeight: 700, textTransform: "uppercase", fontSize: 12, padding: "8px 16px", borderRadius: 10, cursor: "pointer" }}>↻ Sortear</button>
            </div>

            <Label>Nome da liga</Label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Liga do Dojo Lisboa" maxLength={28} style={inputStyle} />

            <Label>Forma</Label>
            <ScrollRow>
              {SHAPES.map((s) => (
                <PickBox key={s} on={cfg.shape === s} onClick={() => set("shape", s)}>
                  <Escudo config={{ ...cfg, shape: s }} size={40} />
                </PickBox>
              ))}
            </ScrollRow>

            <Label>Estampa</Label>
            <ScrollRow>
              {PATTERNS.map((p) => (
                <PickBox key={p.id} on={cfg.pattern === p.id} onClick={() => set("pattern", p.id)} label={p.label}>
                  <Escudo config={{ ...cfg, pattern: p.id }} size={40} />
                </PickBox>
              ))}
            </ScrollRow>

            <Label>Adorno</Label>
            <ScrollRow>
              {LEAGUE_SYMBOLS.map((sy) => (
                <PickBox key={sy.id} on={cfg.symbol === sy.id} onClick={() => set("symbol", sy.id)} label={sy.label}>
                  {sy.id === "none" ? (
                    <span style={{ fontSize: 11, color: "#7c8a82" }}>—</span>
                  ) : (
                    <svg width="34" height="34" viewBox="0 0 24 24"><g transform="scale(0.85) translate(2,2)"><SymbolGlyph id={sy.id} color={GOLD} /></g></svg>
                  )}
                </PickBox>
              ))}
            </ScrollRow>

            <Label>Cores</Label>
            <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
              {COLOR_SLOTS.map((sl) => (
                <button key={sl.key} onClick={() => setActiveColor(sl.key)} style={{ flex: 1, minWidth: 64, background: activeColor === sl.key ? "#16201b" : "#121815", border: `1.5px solid ${activeColor === sl.key ? GOLD : "#243029"}`, borderRadius: 10, padding: "7px 4px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 20, height: 20, borderRadius: 5, background: cfg[sl.key] as string, border: "1px solid rgba(255,255,255,0.15)" }} />
                  <span style={{ fontSize: 9.5, color: "#93a39a", textTransform: "uppercase", letterSpacing: "0.03em" }}>{sl.label}</span>
                </button>
              ))}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 22 }}>
              {COLORS.map((c) => (
                <button key={c} onClick={() => set(activeColor, c)} aria-label={c} style={{ width: 30, height: 30, borderRadius: "50%", background: c, border: (cfg[activeColor] as string) === c ? `2px solid ${GOLD}` : "2px solid #243029", cursor: "pointer" }} />
              ))}
            </div>

            <Label>Formato</Label>
            <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
              <FormatCard on={format === "pontos"} onClick={() => setFormat("pontos")} title="Pontos Corridos" desc="Soma de pontos rodada após rodada. Vence quem tiver mais no fim." icon="🏅" />
              <FormatCard on={format === "copa"} onClick={() => setFormat("copa")} title="Copa Ippon" desc="Mata-mata: quem pontuar mais na rodada avança. Ideal para amigos." icon="🏆" />
            </div>
            <input value={formatName} onChange={(e) => setFormatName(e.target.value)} placeholder={format === "copa" ? "Nome do troféu (ex.: Copa do Dojo)" : "Nome do campeonato (opcional)"} maxLength={28} style={{ ...inputStyle, marginBottom: 22 }} />

            <Label>Privacidade</Label>
            <div style={{ display: "flex", gap: 10, marginBottom: 26 }}>
              <FormatCard on={privacy === "fechada"} onClick={() => setPrivacy("fechada")} title="Fechada" desc="Só entra quem tiver convite ou código." icon="🔒" />
              <FormatCard on={privacy === "aberta"} onClick={() => setPrivacy("aberta")} title="Aberta" desc="Aparece no mercado de ligas. Qualquer um pode pedir para entrar." icon="🌍" />
            </div>

            <button onClick={criar} disabled={!canCreate} style={{ width: "100%", background: canCreate ? GOLD : "#23291f", color: canCreate ? "#1b211e" : "#5f6f67", border: "none", fontFamily: FD, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", padding: 15, borderRadius: 12, fontSize: 16, cursor: canCreate ? "pointer" : "default" }}>Criar liga</button>
            {!canCreate && <div style={{ textAlign: "center", fontSize: 11, color: "#7c8a82", marginTop: 8 }}>Dá um nome à tua liga para continuar.</div>}
          </>
        ) : (
          created && (
            <>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", marginBottom: 18 }}>
                <Escudo config={created.cfg} size={84} />
                <div style={{ fontFamily: FD, fontSize: 20, fontWeight: 700, textTransform: "uppercase", marginTop: 10 }}>{created.name}</div>
                <div style={{ fontSize: 12, color: "#7fd1a3", marginTop: 3 }}>Liga criada! Agora chama o teu dojo. 🥋</div>
                <div style={{ fontSize: 11, color: "#93a39a", marginTop: 2 }}>{created.formatName} · {created.privacy === "fechada" ? "Fechada" : "Aberta"}</div>
              </div>

              <Label>Convidar por nick</Label>
              <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#141a17", border: "1px solid #243029", borderRadius: 10, padding: "10px 12px", marginBottom: 6, opacity: 0.7 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#93a39a" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
                <input disabled placeholder="Procurar jogador pelo nick..." style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#cfd8d2", fontSize: 14, fontFamily: FB }} />
              </div>
              <div style={{ fontSize: 11, color: "#7c8a82", marginBottom: 22 }}>Disponível quando as contas estiverem ligadas. Por agora, partilha o link. 👇</div>

              <Label>Convidar por link</Label>
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <div style={{ flex: 1, background: "#141a17", border: "1px solid #243029", borderRadius: 10, padding: "11px 12px", fontSize: 12.5, color: "#cfd8d2", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{inviteLink}</div>
                <button onClick={copy} style={{ background: copied ? "#3f8f5a" : GOLD, color: copied ? "#06140d" : "#1b211e", border: "none", fontFamily: FD, fontWeight: 700, textTransform: "uppercase", fontSize: 12, padding: "0 16px", borderRadius: 10, cursor: "pointer", whiteSpace: "nowrap" }}>{copied ? "Copiado!" : "Copiar"}</button>
              </div>
              <div style={{ background: "#121815", border: "1px solid #243029", borderRadius: 12, padding: "12px 14px", marginBottom: 26, textAlign: "center" }}>
                <div style={{ fontSize: 11, color: "#93a39a", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Código de convite</div>
                <div style={{ fontFamily: FD, fontSize: 26, fontWeight: 700, color: GOLD, letterSpacing: "0.12em" }}>{created.inviteCode}</div>
              </div>

              <a href="/ligas" style={{ display: "block", textAlign: "center", background: GOLD, color: "#1b211e", fontFamily: FD, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", padding: 15, borderRadius: 12, fontSize: 16, textDecoration: "none" }}>Concluir</a>
            </>
          )
        )}
      </div>
    </main>
  );
}

const backBtn: React.CSSProperties = { width: 34, height: 34, borderRadius: "50%", border: "1px solid #243029", display: "flex", alignItems: "center", justifyContent: "center", color: "#cfd8d2", textDecoration: "none", background: "transparent" };
const inputStyle: React.CSSProperties = { width: "100%", background: "#141a17", border: "1px solid #243029", borderRadius: 11, padding: "13px 14px", color: "#f1ede2", fontSize: 15, fontFamily: FB, outline: "none", marginBottom: 22 };

function BackArrow() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>;
}
function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily: FD, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#93a39a", marginBottom: 9 }}>{children}</div>;
}

function FormatCard({ on, onClick, title, desc, icon }: { on: boolean; onClick: () => void; title: string; desc: string; icon: string }) {
  return (
    <button onClick={onClick} style={{ flex: 1, textAlign: "left", background: on ? "#16201b" : "#121815", border: `1.5px solid ${on ? GOLD : "#243029"}`, borderRadius: 13, padding: 13, cursor: "pointer", color: "#f1ede2" }}>
      <div style={{ fontSize: 22, marginBottom: 6 }}>{icon}</div>
      <div style={{ fontFamily: FD, fontSize: 14, fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 11, color: "#93a39a", lineHeight: 1.4 }}>{desc}</div>
    </button>
  );
}

function PickBox({ on, onClick, children, label }: { on: boolean; onClick: () => void; children: React.ReactNode; label?: string }) {
  return (
    <button onClick={onClick} style={{ flexShrink: 0, width: 64, background: on ? "#16201b" : "#121815", border: `1.5px solid ${on ? GOLD : "#243029"}`, borderRadius: 12, padding: "10px 6px 7px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
      <div style={{ height: 42, display: "flex", alignItems: "center", justifyContent: "center" }}>{children}</div>
      {label && <span style={{ fontSize: 9.5, color: on ? GOLD : "#93a39a", textAlign: "center", lineHeight: 1.1 }}>{label}</span>}
    </button>
  );
}

function ScrollRow({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const go = (dir: number) => { if (ref.current) ref.current.scrollBy({ left: dir * 150, behavior: "smooth" }); };
  return (
    <div style={{ position: "relative", marginBottom: 22 }}>
      <Arrow side="left" onClick={() => go(-1)} />
      <div ref={ref} style={{ display: "flex", gap: 9, overflowX: "auto", scrollbarWidth: "none", padding: "2px 34px" }}>
        {children}
      </div>
      <Arrow side="right" onClick={() => go(1)} />
    </div>
  );
}
function Arrow({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-label={side === "left" ? "Anterior" : "Seguinte"} style={{ position: "absolute", top: "50%", transform: "translateY(-50%)", [side]: 0, zIndex: 2, width: 28, height: 28, borderRadius: "50%", background: "#0c0e0d", border: "1px solid #243029", color: "#cfd8d2", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 } as React.CSSProperties}>
      {side === "left" ? "‹" : "›"}
    </button>
  );
}
