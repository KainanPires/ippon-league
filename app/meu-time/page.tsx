"use client";

import { useState, useEffect } from "react";
import { Mascot } from "@/components/Mascot";
import { Escudo, loadIdentity, DEFAULT_IDENTITY, type Identity } from "@/components/Escudo";
import { loadSaved, resolve, jcLeft, type TeamState } from "@/lib/team";
import { type Athlete } from "@/lib/athletes";
import { scoreAthlete, POINTS, type ActionType } from "@/lib/engine";

const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";
const BELT = "Branca";
const BELT_HEX = "#efeadd";

// Estado do mercado/competição. No passo C liga-se aos dados reais da rodada.
// "aberto" = a montar (mostra preço) · "fechado" = à espera (mostra — — —) · "ao-vivo" = a competir (mostra pontuação)
const MARKET_PHASE: "aberto" | "fechado" | "ao-vivo" = "fechado";

const IOC: Record<string, string> = {
  JP: "JPN", FR: "FRA", BR: "BRA", GE: "GEO", KZ: "KAZ", AZ: "AZE", BE: "BEL",
  TR: "TUR", UZ: "UZB", RU: "AIN", DE: "GER", XK: "KOS", IT: "ITA", CA: "CAN",
  SI: "SLO", HR: "CRO", NL: "NED",
};
const code3 = (iso: string) => IOC[iso] || iso;
const fmt = (n: number) => String(Math.round(n * 10) / 10);

const ACTION_LABEL: Record<ActionType, string> = {
  ippon_feito: "Ippon",
  waza_ari_feito: "Waza-ari",
  yuko_feito: "Yuko",
  shido_provocado: "Shido provocado",
  ippon_sofrido: "Ippon sofrido",
  waza_ari_sofrido: "Waza-ari sofrido",
  yuko_sofrido: "Yuko sofrido",
  shido_recebido: "Shido recebido",
  hansoku_make_recebido: "Hansoku-make",
};

// Ações de exemplo (estáveis por atleta) — ligam aos dados reais da rodada no passo C.
function sampleActions(a: Athlete): ActionType[] {
  let h = 0;
  for (let i = 0; i < a.id.length; i++) h = (h * 31 + a.id.charCodeAt(i)) >>> 0;
  const acts: ActionType[] = [];
  if (a.last >= 8) acts.push("ippon_feito");
  if (a.last >= 14) acts.push("waza_ari_feito");
  if (a.last >= 18) acts.push("waza_ari_feito");
  if (h % 2 === 0) acts.push("shido_provocado");
  if (h % 5 === 0) acts.push("shido_recebido");
  if (acts.length === 0) acts.push("yuko_feito");
  return acts;
}

export default function MeuTime() {
  const [team, setTeam] = useState<TeamState>({ ids: [], captain: null });
  const [identity, setIdentity] = useState<Identity>(DEFAULT_IDENTITY);
  const [ready, setReady] = useState(false);
  const [sel, setSel] = useState<Athlete | null>(null);

  useEffect(() => {
    try { setTeam(loadSaved()); setIdentity(loadIdentity()); } catch {}
    setReady(true);
  }, []);

  if (!ready) return <main style={{ minHeight: "100vh", background: "#0c0e0d" }} />;

  const athletes = resolve(team.ids);
  const hasTeam = athletes.length > 0;
  const males = athletes.filter((a) => a.gender === "M");
  const females = athletes.filter((a) => a.gender === "F");
  const squadValue = fmt(athletes.reduce((s, a) => s + a.priceJc, 0));
  const left = jcLeft(team);
  const scoreOf = (a: Athlete) => scoreAthlete(sampleActions(a), a.id === team.captain);
  const totalPts = athletes.reduce((s, a) => s + scoreOf(a), 0);

  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: FB }}>
      <div style={{ maxWidth: 460, margin: "0 auto", padding: "14px 14px 40px" }}>
        <header style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 16 }}>
          <a href="/inicio" aria-label="Voltar" style={{ width: 34, height: 34, borderRadius: "50%", border: "1px solid #243029", display: "flex", alignItems: "center", justifyContent: "center", color: "#cfd8d2", textDecoration: "none", flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
          </a>
          <h1 style={{ fontFamily: FD, fontSize: 19, fontWeight: 700, textTransform: "uppercase", margin: 0 }}>Meu Time</h1>
        </header>

        {!hasTeam ? (
          <div style={{ textAlign: "center", padding: "26px 16px", background: "#121815", border: "1px solid #243029", borderRadius: 16 }}>
            <div style={{ width: 96, height: 96, margin: "0 auto 6px" }}><Mascot belt={BELT_HEX} expression="feliz" /></div>
            <h2 style={{ fontFamily: FD, fontSize: 20, fontWeight: 700, textTransform: "uppercase", margin: "4px 0 8px" }}>Ainda não tens equipa</h2>
            <p style={{ fontSize: 14, color: "#c7d0c9", lineHeight: 1.5, margin: "0 0 18px" }}>Monta 8 atletas com 100 Judocoins, escolhe o teu capitão e vê-os aqui prontos a competir.</p>
            <a href="/criar-equipa" style={{ display: "inline-block", background: GOLD, color: "#1b211e", fontFamily: FD, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", padding: "13px 22px", borderRadius: 12, fontSize: 15, textDecoration: "none" }}>Montar a minha equipa</a>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
                <div style={{ flexShrink: 0 }}><Escudo config={identity} size={40} /></div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: FD, fontSize: 18, fontWeight: 700, textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{identity.name}</div>
                  <div style={{ fontSize: 12, color: GOLD }}>Faixa {BELT}</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Stat label="Património" value={`JC 100`} />
                <Stat label="Saldo" value={`JC ${fmt(left)}`} />
              </div>
            </div>

            <section style={{ background: "#2f6fb3", border: "2px solid #25588f", borderRadius: 16, padding: 10 }}>
              <div style={{ background: "#e6b422", border: "2px solid #f0cf6a", borderRadius: 10, padding: "12px 10px" }}>
                <SectionLabel>Masculino</SectionLabel>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 14 }}>
                  {males.map((a) => <Cell key={a.id} a={a} captain={a.id === team.captain} score={scoreOf(a)} onClick={() => setSel(a)} />)}
                </div>
                <SectionLabel>Feminino</SectionLabel>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
                  {females.map((a) => <Cell key={a.id} a={a} captain={a.id === team.captain} score={scoreOf(a)} onClick={() => setSel(a)} />)}
                </div>
              </div>
            </section>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, padding: "12px 14px", background: "#141a17", border: "1px solid #243029", borderRadius: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 60, height: 60, flexShrink: 0 }}><Mascot belt={BELT_HEX} expression={MARKET_PHASE === "ao-vivo" ? "determinado" : "feliz"} /></div>
                <div>
                  <div style={{ fontSize: 12, color: "#93a39a" }}>
                    {MARKET_PHASE === "aberto" ? "Mercado aberto" : MARKET_PHASE === "fechado" ? "Mercado fechado" : "A rodada está a decorrer!"}
                  </div>
                  <div style={{ fontSize: 12, color: "#7fd1a3", fontWeight: 700, marginTop: 2 }}>
                    {MARKET_PHASE === "fechado" ? "À espera das primeiras lutas." : `Valor da equipa: JC ${squadValue}`}
                  </div>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: FD, fontSize: 26, fontWeight: 700, color: GOLD }}>
                  {MARKET_PHASE === "aberto" ? `JC ${squadValue}` : MARKET_PHASE === "fechado" ? "—" : totalPts}
                </div>
                <div style={{ fontSize: 10, color: "#93a39a", textTransform: "uppercase" }}>{MARKET_PHASE === "aberto" ? "valor" : "pts"}</div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
              <a href="/criar-equipa" style={{ flex: 1, textAlign: "center", background: "transparent", border: "1px solid #243029", color: "#cfd8d2", fontFamily: FD, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", padding: 12, borderRadius: 11, fontSize: 13, textDecoration: "none" }}>Editar equipa</a>
              <a href="/mercado" style={{ flex: 1, textAlign: "center", background: GOLD, color: "#1b211e", fontFamily: FD, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", padding: 12, borderRadius: 11, fontSize: 13, textDecoration: "none" }}>Ver mercado</a>
            </div>

            <p style={{ fontSize: 11, color: "#5f6f67", textAlign: "center", marginTop: 14 }}>
              Toca num atleta para veres as ações e a valorização. A pontuação ao vivo liga-se em breve.
            </p>
          </>
        )}
      </div>

      {sel && <AthleteDetail a={sel} captain={sel.id === team.captain} onClose={() => setSel(null)} />}
    </main>
  );
}

function AthleteDetail({ a, captain, onClose }: { a: Athlete; captain: boolean; onClose: () => void }) {
  const acts = sampleActions(a);
  const total = scoreAthlete(acts, captain);
  const up = a.variation >= 0;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(6,8,7,0.78)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 100 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 460, background: "#10160f", borderTop: `2px solid ${captain ? "#FF8F00" : "#243029"}`, borderRadius: "18px 18px 0 0", padding: "16px 16px 24px", maxHeight: "86%", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <div style={{ width: 46, height: 50, borderRadius: 8, background: "linear-gradient(160deg,#2a4d3e,#1c3a2e)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <div style={{ background: "#f1ede2", color: "#1b211e", fontFamily: FD, fontWeight: 700, fontSize: 10, padding: "1px 4px", borderRadius: 3 }}>{code3(a.countryIso)}</div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", gap: 7 }}>
              {a.name}{captain && <span style={{ background: "#FF8F00", color: "#1b1208", fontFamily: FD, fontWeight: 700, fontSize: 10, padding: "1px 6px", borderRadius: 5 }}>CAP</span>}
            </div>
            <div style={{ fontSize: 12, color: "#93a39a" }}>{code3(a.countryIso)} · {a.category}kg</div>
          </div>
          <button onClick={onClose} aria-label="Fechar" style={{ background: "transparent", border: "none", color: "#93a39a", fontSize: 20, cursor: "pointer" }}>✕</button>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <div style={{ flex: 1, background: "#141a17", border: "1px solid #243029", borderRadius: 12, padding: "10px 12px" }}>
            <div style={{ fontSize: 10, color: "#93a39a", textTransform: "uppercase" }}>Preço</div>
            <div style={{ fontFamily: FD, fontSize: 17, fontWeight: 700, color: GOLD }}>JC {a.priceJc.toFixed(1)}</div>
          </div>
          <div style={{ flex: 1, background: "#141a17", border: "1px solid #243029", borderRadius: 12, padding: "10px 12px" }}>
            <div style={{ fontSize: 10, color: "#93a39a", textTransform: "uppercase" }}>Valorização</div>
            <div style={{ fontFamily: FD, fontSize: 17, fontWeight: 700, color: up ? "#7fd1a3" : "#ef8d83" }}>{up ? "▲" : "▼"} {Math.abs(a.variation)}%</div>
          </div>
        </div>

        <div style={{ fontFamily: FD, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#93a39a", marginBottom: 8 }}>Ações na rodada</div>
        <div style={{ background: "#141a17", border: "1px solid #243029", borderRadius: 12, overflow: "hidden", marginBottom: 12 }}>
          {acts.map((act, i) => {
            const pts = POINTS[act];
            const pos = pts >= 0;
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 13px", borderTop: i === 0 ? "none" : "1px solid #1a221d" }}>
                <span style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: pos ? "#7fd1a3" : "#ef8d83" }} />
                  {ACTION_LABEL[act]}
                </span>
                <span style={{ fontFamily: FD, fontWeight: 700, fontSize: 14, color: pos ? "#7fd1a3" : "#ef8d83" }}>{pos ? "+" : ""}{pts}</span>
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#16201b", border: `1px solid ${GOLD}`, borderRadius: 12, padding: "12px 14px" }}>
          <div>
            <div style={{ fontFamily: FD, fontSize: 13, fontWeight: 700, textTransform: "uppercase" }}>Total na rodada</div>
            {captain && <div style={{ fontSize: 11, color: "#FF8F00", marginTop: 2 }}>Capitão — pontuação a dobrar</div>}
          </div>
          <div style={{ fontFamily: FD, fontSize: 26, fontWeight: 700, color: GOLD }}>{total >= 0 ? "+" : ""}{total} pts</div>
        </div>

        <p style={{ fontSize: 11, color: "#5f6f67", textAlign: "center", marginTop: 12 }}>Exemplo — liga-se às ações reais da competição em breve.</p>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "#141a17", border: "1px solid #243029", borderRadius: 12, padding: "8px 12px", textAlign: "right" }}>
      <div style={{ fontSize: 10, color: "#93a39a", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: GOLD }}>{value}</div>
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

function Cell({ a, captain, score, onClick }: { a: Athlete; captain: boolean; score: number; onClick: () => void }) {
  const surname = a.name.split(" ").slice(-1)[0];
  let value: React.ReactNode;
  if (MARKET_PHASE === "aberto") {
    value = <span style={{ fontFamily: FD, fontSize: 11, fontWeight: 700, color: "#f2c84b" }}>JC {a.priceJc.toFixed(1)}</span>;
  } else if (MARKET_PHASE === "fechado") {
    value = <span style={{ fontFamily: FD, fontSize: 13, fontWeight: 700, color: "#7c8a82", letterSpacing: "0.16em", whiteSpace: "nowrap" }}>— —</span>;
  } else {
    value = <span style={{ background: "#1d3a2b", color: "#9be3bd", fontFamily: FD, fontWeight: 700, fontSize: 11, padding: "2px 9px", borderRadius: 999 }}>{score >= 0 ? "+" : ""}{score} pts</span>;
  }
  return (
    <button onClick={onClick} style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "8px 3px", borderRadius: 12, border: `1.5px solid ${captain ? "#FF8F00" : "#2f4a3c"}`, background: "rgba(12,14,13,0.80)", cursor: "pointer", fontFamily: FB }}>
      {captain && <div style={{ position: "absolute", top: -8, right: -5, background: "#FF8F00", border: "1px solid #c2410c", color: "#1b1208", fontFamily: FD, fontWeight: 700, fontSize: 11, padding: "1px 6px", borderRadius: 5, lineHeight: 1.3 }}>C</div>}
      <div style={{ width: 30, height: 34, borderRadius: 6, background: "linear-gradient(160deg,#2a4d3e,#1c3a2e)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ background: "#f1ede2", color: "#1b211e", fontFamily: FD, fontWeight: 700, fontSize: 8, padding: "1px 3px", borderRadius: 2 }}>{code3(a.countryIso)}</div>
      </div>
      <div style={{ fontSize: 10, fontWeight: 700, width: "100%", textAlign: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "#fff" }}>{surname}</div>
      <div style={{ fontSize: 9, color: "#b6c0b9" }}>{a.category}kg</div>
      <div style={{ marginTop: 1, minHeight: 18, display: "flex", alignItems: "center" }}>{value}</div>
    </button>
  );
}
