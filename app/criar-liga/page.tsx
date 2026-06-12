"use client";

import { useState, useRef } from "react";
import { Escudo, SymbolGlyph, SHAPES, PATTERNS, LEAGUE_SYMBOLS, COLORS, DEFAULT_IDENTITY, type Identity } from "@/components/Escudo";
import { DEFAULT_LEAGUE_SHIELD, type LeagueFormat, type LeaguePrivacy } from "@/lib/leagues";
import { supabase } from "@/lib/supabase";

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

interface LigaCriada {
  id: string;
  name: string;
  invite_code: string;
  formato: string;
  privacidade: string;
}

export default function CriarLiga() {
  const [step, setStep] = useState<"criar" | "convites">("criar");
  const [cfg, setCfg] = useState<Identity>(DEFAULT_LEAGUE_SHIELD);
  const [name, setName] = useState("");
  const [descricao, setDescricao] = useState("");
  const [format, setFormat] = useState<LeagueFormat>("pontos");
  const [privacy, setPrivacy] = useState<LeaguePrivacy>("fechada");
  const [activeColor, setActiveColor] = useState<keyof Identity>("bg1");
  const [created, setCreated] = useState<LigaCriada | null>(null);
  const [copied, setCopied] = useState(false);
  const [a_criar, setACriar] = useState(false);
  const [erro, setErro] = useState("");

  function set<K extends keyof Identity>(key: K, value: Identity[K]) {
    setCfg((prev) => ({ ...prev, [key]: value }));
  }
  function sortear() {
    setCfg((p) => ({ ...p, shape: rnd(SHAPES), pattern: rnd(PATTERNS).id, symbol: rnd(LEAGUE_SYMBOLS).id, bg1: rnd(COLORS), bg2: rnd(COLORS), stamp1: rnd(COLORS), stamp2: rnd(COLORS), border: rnd(COLORS) }));
  }

  const canCreate = name.trim().length >= 2 && !a_criar;

  async function criar() {
    if (!canCreate) return;
    setErro("");
    setACriar(true);
    try {
      // Quem está a criar? Precisa de sessão.
      const { data: sess } = await supabase.auth.getSession();
      const user_id = sess.session?.user?.id;
      if (!user_id) {
        window.location.href = "/entrar?voltar=/criar-liga";
        return;
      }
      const res = await fetch("/api/liga/criar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id,
          nome: name.trim(),
          descricao: descricao.trim(),
          formato: format,
          privacidade: privacy,
          escudo: { ...cfg, name: name.trim() },
        }),
      });
      const j = await res.json();
      if (!j.ok) {
        setErro(j.erro || "Não foi possível criar a liga.");
        setACriar(false);
        return;
      }
      setCreated(j.liga);
      setStep("convites");
    } catch {
      setErro("Falha de ligação. Tenta de novo.");
      setACriar(false);
    }
  }

  const inviteLink = created ? `https://ippon-league.vercel.app/liga/${created.invite_code}` : "";
  function copy() {
    try { navigator.clipboard.writeText(inviteLink); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch {}
  }
  function partilhar() {
    if (!created) return;
    const texto = `Entra na minha liga "${created.name}" na Ippon League! Código: ${created.invite_code}`;
    const navAny = navigator as unknown as { share?: (d: { title?: string; text?: string; url?: string }) => Promise<void> };
    if (navAny.share) {
      navAny.share({ title: "Ippon League", text: texto, url: inviteLink }).catch(() => {});
    } else {
      try { navigator.clipboard.writeText(inviteLink); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch {}
    }
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
            <div style={{ display: "flex", gap: 10, marginBottom: 22 }}>
              <FormatCard on={format === "pontos"} onClick={() => setFormat("pontos")} title="Pontos Corridos" desc="Soma de pontos rodada após rodada. Vence quem tiver mais no fim." icon="🏅" />
              <FormatCard on={format === "copa"} onClick={() => setFormat("copa")} title="Copa Ippon" desc="Mata-mata: quem pontuar mais na rodada avança. Ideal para amigos." icon="🏆" />
            </div>

            <Label>Descrição da liga</Label>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Regras, premiação e informações da liga — opcional. Ex.: O campeão do mês ganha o jantar. Vale tudo menos escalar lesionado! 🥋"
              maxLength={400}
              rows={4}
              style={{ ...inputStyle, marginBottom: 6, resize: "vertical", lineHeight: 1.5, fontFamily: FB }}
            />
            <div style={{ fontSize: 11, color: "#7c8a82", marginBottom: 22, textAlign: "right" }}>{descricao.length}/400</div>

            <Label>Privacidade</Label>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 26 }}>
              <PrivacyRow on={privacy === "aberta"} onClick={() => setPrivacy("aberta")} title="Aberta" desc="Aparece no mercado de ligas. Qualquer um pode entrar." icon="🌍" />
              <PrivacyRow on={privacy === "mediante_pedido"} onClick={() => setPrivacy("mediante_pedido")} title="Por aprovação" desc="Aparece no mercado. Tu aprovas quem entra." icon="✋" />
              <PrivacyRow on={privacy === "fechada"} onClick={() => setPrivacy("fechada")} title="Fechada" desc="Não aparece no mercado. Só entra quem tiver o código." icon="🔒" />
            </div>

            {erro && (
              erro.includes("Pro") ? (
                <a href="/ippon-pro" style={{ display: "block", background: "#2a2410", border: "1px solid #5a4a18", color: GOLD, fontSize: 12.5, padding: "10px 12px", borderRadius: 10, marginBottom: 12, textDecoration: "none", lineHeight: 1.4 }}>{erro} →</a>
              ) : (
                <div style={{ background: "#2a1a18", border: "1px solid #5a2a24", color: "#ef8d83", fontSize: 12.5, padding: "10px 12px", borderRadius: 10, marginBottom: 12 }}>{erro}</div>
              )
            )}

            <button onClick={criar} disabled={!canCreate} style={{ width: "100%", background: canCreate ? GOLD : "#23291f", color: canCreate ? "#1b211e" : "#5f6f67", border: "none", fontFamily: FD, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", padding: 15, borderRadius: 12, fontSize: 16, cursor: canCreate ? "pointer" : "default" }}>{a_criar ? "A criar…" : "Criar liga"}</button>
            {!canCreate && !a_criar && <div style={{ textAlign: "center", fontSize: 11, color: "#7c8a82", marginTop: 8 }}>Dá um nome à tua liga para continuar.</div>}
          </>
        ) : (
          created && (
            <>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", marginBottom: 18 }}>
                <Escudo config={{ ...cfg, name: created.name }} size={84} />
                <div style={{ fontFamily: FD, fontSize: 20, fontWeight: 700, textTransform: "uppercase", marginTop: 10 }}>{created.name}</div>
                <div style={{ fontSize: 12, color: "#7fd1a3", marginTop: 3 }}>Liga criada! Agora chama o teu dojo. 🥋</div>
                <div style={{ fontSize: 11, color: "#93a39a", marginTop: 2 }}>{nomePrivacidade(created.privacidade)}</div>
              </div>

              <Label>Convidar por link</Label>
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <div style={{ flex: 1, background: "#141a17", border: "1px solid #243029", borderRadius: 10, padding: "11px 12px", fontSize: 12.5, color: "#cfd8d2", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "flex", alignItems: "center" }}>{inviteLink}</div>
                <button onClick={copy} aria-label="Copiar link" style={{ background: copied ? "#3f8f5a" : "#141a17", color: copied ? "#06140d" : "#cfd8d2", border: "1px solid #243029", fontFamily: FD, fontWeight: 700, textTransform: "uppercase", fontSize: 12, padding: "0 14px", borderRadius: 10, cursor: "pointer", whiteSpace: "nowrap" }}>{copied ? "✓" : "Copiar"}</button>
                <button onClick={partilhar} aria-label="Partilhar link" style={{ background: GOLD, color: "#1b211e", border: "none", fontFamily: FD, fontWeight: 700, textTransform: "uppercase", fontSize: 12, padding: "0 14px", borderRadius: 10, cursor: "pointer", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>
                  Partilhar
                </button>
              </div>
              <div style={{ background: "#121815", border: "1px solid #243029", borderRadius: 12, padding: "12px 14px", marginBottom: 26, textAlign: "center" }}>
                <div style={{ fontSize: 11, color: "#93a39a", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Código de convite</div>
                <div style={{ fontFamily: FD, fontSize: 26, fontWeight: 700, color: GOLD, letterSpacing: "0.12em" }}>{created.invite_code}</div>
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

// Nome amigável do estado de privacidade (para mostrar ao utilizador).
function nomePrivacidade(p: string): string {
  if (p === "aberta") return "Aberta";
  if (p === "mediante_pedido") return "Por aprovação";
  return "Fechada";
}

// Linha de privacidade empilhada (ícone + título + descrição, largura total).
function PrivacyRow({ on, onClick, title, desc, icon }: { on: boolean; onClick: () => void; title: string; desc: string; icon: string }) {
  return (
    <button onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", background: on ? "#16201b" : "#121815", border: `1.5px solid ${on ? GOLD : "#243029"}`, borderRadius: 13, padding: "12px 14px", cursor: "pointer", color: "#f1ede2" }}>
      <div style={{ fontSize: 22, flexShrink: 0 }}>{icon}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: FD, fontSize: 14, fontWeight: 700, textTransform: "uppercase", marginBottom: 2 }}>{title}</div>
        <div style={{ fontSize: 11.5, color: "#93a39a", lineHeight: 1.4 }}>{desc}</div>
      </div>
      <div style={{ marginLeft: "auto", flexShrink: 0, width: 18, height: 18, borderRadius: "50%", border: `2px solid ${on ? GOLD : "#3a4a42"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {on && <div style={{ width: 8, height: 8, borderRadius: "50%", background: GOLD }} />}
      </div>
    </button>
  );
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
