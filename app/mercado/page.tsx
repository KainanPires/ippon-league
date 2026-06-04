"use client";

import { useState, useEffect } from "react";
import { ATHLETES, CATEGORIES, STATUS_LEGEND, type Athlete, type Gender, type AthleteStatus } from "@/lib/athletes";
import { Mascot } from "@/components/Mascot";

const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";
const START_JC = 100;

const IOC: Record<string, string> = {
  JP: "JPN", FR: "FRA", BR: "BRA", GE: "GEO", KZ: "KAZ", AZ: "AZE", BE: "BEL",
  TR: "TUR", UZ: "UZB", RU: "AIN", DE: "GER", XK: "KOS", IT: "ITA", CA: "CAN",
  SI: "SLO", HR: "CRO", NL: "NED",
};
const code3 = (iso: string) => IOC[iso] || iso;

const STATUS_COLORS: Record<AthleteStatus, [string, string]> = {
  "Elite": ["#3a2f12", "#d9a441"],
  "Em alta": ["#13301f", "#7fd1a3"],
  "Em baixa": ["#3a1f1c", "#ef8d83"],
  "Barganha": ["#12303a", "#7fb8f5"],
  "Aposta": ["#2a1f3a", "#b79be0"],
};

const STEPS = [
  { t: "Saldo JC", x: "Estes são os Judocoins que tens para gastar. Cada atleta tem um preço — geres os teus 100 JC para montar a melhor equipa.", target: "jc" },
  { t: "Valorização", x: "O ▲/▼ ao lado do preço mostra se o atleta está a valorizar ou a desvalorizar. Fica atento a isto: faz toda a diferença no teu património.", target: "price" },
  { t: "Médias e pontuação", x: "A média mostra o nível típico do atleta e a 'última' a pontuação mais recente. Usa-as para descobrir quem pode render mais — e ganhar JC.", target: "scout" },
  { t: "O que significam os estados", target: "legend" },
];

const fmt = (n: number) => String(Math.round(n * 10) / 10);

export default function Mercado() {
  const [gender, setGender] = useState<Gender>("M");
  const [cat, setCat] = useState<string>("Todas");
  const [query, setQuery] = useState("");
  const [team, setTeam] = useState<string[]>([]);
  const [guide, setGuide] = useState<number | null>(null);

  useEffect(() => {
    try {
      const t = localStorage.getItem("ippon_team");
      if (t) setTeam(JSON.parse(t));
      if (!localStorage.getItem("ippon_market_tutorial")) setGuide(0);
    } catch {}
  }, []);

  function persist(next: string[]) {
    setTeam(next);
    try { localStorage.setItem("ippon_team", JSON.stringify(next)); } catch {}
  }
  function finishTutorial() {
    try { localStorage.setItem("ippon_market_tutorial", "done"); } catch {}
    setGuide(null);
  }

  const teamAthletes = team.map((id) => ATHLETES.find((a) => a.id === id)).filter(Boolean) as Athlete[];
  const jcLeft = Math.round((START_JC - teamAthletes.reduce((s, a) => s + a.priceJc, 0)) * 10) / 10;
  const countM = teamAthletes.filter((a) => a.gender === "M").length;
  const countF = teamAthletes.filter((a) => a.gender === "F").length;
  const takenM = new Set(teamAthletes.filter((a) => a.gender === "M").map((a) => a.category));
  const takenF = new Set(teamAthletes.filter((a) => a.gender === "F").map((a) => a.category));

  const filtered = ATHLETES.filter((a) => {
    const okGender = a.gender === gender;
    const okCat = cat === "Todas" || a.category === cat;
    const okQ = !query.trim() || a.name.toLowerCase().includes(query.trim().toLowerCase());
    return okGender && okCat && okQ;
  });

  function buttonState(a: Athlete) {
    const inTeam = team.includes(a.id);
    const genderCount = a.gender === "M" ? countM : countF;
    const taken = a.gender === "M" ? takenM : takenF;
    const full = !inTeam && genderCount >= 4;
    const catTaken = !inTeam && taken.has(a.category);
    const afford = a.priceJc <= jcLeft;
    if (inTeam) return { label: "Vender", kind: "sell" as const };
    if (full) return { label: "Lotado", kind: "blocked" as const };
    if (catTaken) return { label: "Categoria ocupada", kind: "blocked" as const };
    if (!afford) return { label: "Sem JC", kind: "blocked" as const };
    return { label: "Contratar", kind: "buy" as const };
  }

  function toggle(a: Athlete) {
    if (team.includes(a.id)) { persist(team.filter((id) => id !== a.id)); return; }
    const st = buttonState(a);
    if (st.kind === "buy") persist([...team, a.id]);
  }

  const jcGlow = guide === 0;
  const focus = guide === 1 ? "price" : guide === 2 ? "scout" : null;

  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: FB }}>
      <style>{`@keyframes glow{0%,100%{box-shadow:0 0 0 3px rgba(90,169,255,.65)}50%{box-shadow:0 0 0 8px rgba(90,169,255,.18)}} .glow{animation:glow 1.3s ease-in-out infinite;border-radius:10px}`}</style>

      <div style={{ maxWidth: 460, margin: "0 auto" }}>
        {/* Cabeçalho fixo */}
        <div style={{ position: "sticky", top: 0, background: "#0c0e0d", borderBottom: "1px solid #1a221d", zIndex: 5, padding: "12px 14px 10px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <a href="/criar-equipa" aria-label="Voltar" style={{ width: 32, height: 32, borderRadius: "50%", border: "1px solid #243029", display: "flex", alignItems: "center", justifyContent: "center", color: "#cfd8d2", textDecoration: "none" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
              </a>
              <span style={{ fontFamily: FD, fontSize: 19, fontWeight: 700, textTransform: "uppercase" }}>Mercado</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={() => setGuide(0)} aria-label="Como funciona" style={{ width: 32, height: 32, borderRadius: "50%", border: "1px solid #243029", background: "transparent", color: "#93a39a", fontWeight: 700, cursor: "pointer" }}>?</button>
              <span className={jcGlow ? "glow" : undefined} style={{ background: "#141a17", border: "1px solid #243029", borderRadius: 10, padding: "6px 11px", fontFamily: FD, fontWeight: 700, color: GOLD, fontSize: 15 }}>JC {fmt(jcLeft)}</span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#141a17", border: "1px solid #243029", borderRadius: 10, padding: "8px 11px", marginBottom: 9 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#93a39a" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Procurar atleta..." style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#f1ede2", fontSize: 14, fontFamily: FB }} />
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 9 }}>
            <button onClick={() => { setGender("M"); setCat("Todas"); }} style={genderBtn(gender === "M")}>Masculino {countM}/4</button>
            <button onClick={() => { setGender("F"); setCat("Todas"); }} style={genderBtn(gender === "F")}>Feminino {countF}/4</button>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {["Todas", ...CATEGORIES[gender]].map((c) => (
              <button key={c} onClick={() => setCat(c)} style={chip(c === cat)}>{c}</button>
            ))}
          </div>
        </div>

        {/* Lista */}
        <div style={{ padding: "12px 14px 24px" }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: "center", color: "#93a39a", fontSize: 13, padding: "24px 0" }}>Sem atletas para este filtro (mais em breve).</div>
          ) : (
            filtered.map((a, idx) => {
              const st = buttonState(a);
              const inTeam = st.kind === "sell";
              const dim = st.kind === "blocked" && st.label !== "Sem JC";
              const vUp = a.variation >= 0;
              return (
                <div key={a.id} style={{ background: "#121815", border: `1px solid ${inTeam ? "#2f4a3c" : "#243029"}`, borderRadius: 14, padding: 12, marginBottom: 10, opacity: dim ? 0.7 : 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Avatar code={code3(a.countryIso)} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {a.name}{inTeam && <span style={{ color: "#7fd1a3", fontSize: 11 }}> ✓ na equipa</span>}
                      </div>
                      <div style={{ fontSize: 12, color: "#93a39a" }}>{code3(a.countryIso)} · {a.category}kg</div>
                    </div>
                    <span style={{ background: STATUS_COLORS[a.status][0], color: STATUS_COLORS[a.status][1], fontSize: 10, fontWeight: 700, padding: "4px 9px", borderRadius: 999, whiteSpace: "nowrap" }}>{a.status}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: 10 }}>
                    <div>
                      <span className={idx === 0 && focus === "price" ? "glow" : undefined} style={{ display: "inline-block", padding: "2px 4px" }}>
                        <span style={{ fontFamily: FD, fontSize: 20, fontWeight: 700, color: GOLD }}>JC {a.priceJc.toFixed(1)}</span>{" "}
                        <span style={{ fontSize: 12, color: vUp ? "#7fd1a3" : "#ef8d83", fontWeight: 700 }}>{vUp ? "▲" : "▼"} {Math.abs(a.variation)}%</span>
                      </span>
                      <div className={idx === 0 && focus === "scout" ? "glow" : undefined} style={{ fontSize: 11, color: "#7c8a82", marginTop: 2, display: "inline-block", padding: "2px 4px" }}>
                        Média {a.avg.toFixed(1)} · Última {a.last}
                      </div>
                    </div>
                    <button
                      onClick={() => toggle(a)}
                      disabled={st.kind === "blocked"}
                      style={{
                        background: st.kind === "sell" ? "transparent" : st.kind === "buy" ? GOLD : "#23291f",
                        color: st.kind === "sell" ? "#ef8d83" : st.kind === "buy" ? "#1b211e" : "#5f6f67",
                        border: st.kind === "sell" ? "1px solid #5a2f2c" : "none",
                        fontFamily: FD, fontSize: st.label === "Categoria ocupada" ? 10.5 : 13, fontWeight: 700,
                        textTransform: "uppercase", padding: "9px 12px", borderRadius: 10,
                        cursor: st.kind === "blocked" ? "default" : "pointer", whiteSpace: "nowrap",
                      }}
                    >
                      {st.label}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Tutorial guiado */}
      {guide !== null && <Tutorial step={guide} setStep={setGuide} onClose={finishTutorial} />}
    </main>
  );
}

function genderBtn(on: boolean): React.CSSProperties {
  return { flex: 1, textAlign: "center", fontSize: 12, padding: "7px 11px", borderRadius: 999, cursor: "pointer", fontFamily: FB, fontWeight: 700, border: `1px solid ${on ? "#1c3a2e" : "#243029"}`, background: on ? "#1c3a2e" : "#141a17", color: on ? "#aee9c9" : "#93a39a" };
}
function chip(on: boolean): React.CSSProperties {
  return { whiteSpace: "nowrap", fontSize: 12, padding: "6px 11px", borderRadius: 999, cursor: "pointer", fontFamily: FB, border: `1px solid ${on ? "#1c3a2e" : "#243029"}`, background: on ? "#1c3a2e" : "#141a17", color: on ? "#aee9c9" : "#93a39a" };
}

function Avatar({ code }: { code: string }) {
  return (
    <div style={{ width: 40, height: 44, borderRadius: 8, background: "linear-gradient(160deg,#2a4d3e,#1c3a2e)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <div style={{ background: "#f1ede2", color: "#1b211e", fontFamily: FD, fontWeight: 700, fontSize: 10, padding: "1px 4px", borderRadius: 3 }}>{code}</div>
    </div>
  );
}

function Tutorial({ step, setStep, onClose }: { step: number; setStep: (s: number | null) => void; onClose: () => void }) {
  const s = STEPS[step];
  const total = STEPS.length;
  const isLegend = s.target === "legend";

  const controls = (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
      <button onClick={() => step > 0 && setStep(step - 1)} style={{ background: "transparent", border: "none", color: step === 0 ? "#3c463f" : "#93a39a", fontSize: 13, fontWeight: 700, cursor: step === 0 ? "default" : "pointer", fontFamily: FB }}>Anterior</button>
      <span style={{ fontSize: 11, color: "#5f6f67" }}>{step + 1} de {total}</span>
      <button onClick={() => (step === total - 1 ? onClose() : setStep(step + 1))} style={{ background: GOLD, border: "none", color: "#1b211e", padding: "8px 18px", borderRadius: 9, fontFamily: FD, fontSize: 13, fontWeight: 700, textTransform: "uppercase", cursor: "pointer" }}>{step === total - 1 ? "Começar" : "Seguinte"}</button>
    </div>
  );
  const skip = (
    <div style={{ textAlign: "right", marginBottom: 8 }}>
      <button onClick={onClose} style={{ background: "transparent", border: "none", color: "#cfd8d2", fontSize: 12, cursor: "pointer", fontFamily: FB }}>Pular ✕</button>
    </div>
  );

  if (isLegend) {
    return (
      <div style={{ position: "fixed", inset: 0, background: "rgba(6,8,7,0.82)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18, zIndex: 100 }}>
        <div style={{ width: "100%", maxWidth: 300 }}>
          {skip}
          <div style={{ background: "#121815", border: `1px solid ${GOLD}`, borderRadius: 16, padding: 18 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
              <div style={{ width: 54, height: 54, flexShrink: 0 }}><Mascot belt="#efeadd" expression="feliz" /></div>
              <div style={{ fontFamily: FD, fontSize: 16, fontWeight: 700, textTransform: "uppercase" }}>{s.t}</div>
            </div>
            {STATUS_LEGEND.map((l) => (
              <div key={l.label} style={{ display: "flex", gap: 9, alignItems: "flex-start", marginBottom: 7 }}>
                <span style={{ background: "rgba(255,255,255,0.05)", color: l.color, fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999, whiteSpace: "nowrap" }}>{l.label}</span>
                <span style={{ fontSize: 12, color: "#c7d0c9" }}>{l.desc}</span>
              </div>
            ))}
            {controls}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "fixed", left: 0, right: 0, bottom: 14, padding: "0 12px", zIndex: 100 }}>
      <div style={{ maxWidth: 436, margin: "0 auto", display: "flex", gap: 10, alignItems: "flex-end" }}>
        <div style={{ width: 58, height: 58, flexShrink: 0 }}><Mascot belt="#efeadd" expression="feliz" /></div>
        <div style={{ flex: 1, background: "#121815", border: `1px solid ${GOLD}`, borderRadius: 14, padding: "12px 14px" }}>
          {skip}
          <div style={{ fontFamily: FD, fontSize: 14, fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>{s.t}</div>
          <p style={{ fontSize: 12.5, color: "#c7d0c9", lineHeight: 1.45, margin: 0 }}>{s.x}</p>
          {controls}
        </div>
      </div>
    </div>
  );
}
