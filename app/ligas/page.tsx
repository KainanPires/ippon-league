"use client";

import { useState } from "react";
import { Escudo, DEFAULT_IDENTITY, type Identity } from "@/components/Escudo";

const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";

type Tab = "ativas" | "mercado" | "resultados";

function esc(p: Partial<Identity>): Identity { return { ...DEFAULT_IDENTITY, ...p }; }

const OFICIAIS = [
  { id: "mundial", name: "Liga Mundial", sub: "Todos os jogadores", pos: "#1.243", cfg: esc({ bg1: "#1c3a2e", bg2: "#102a20", border: GOLD, symbol: "mundo" }) },
  { id: "europa", name: "Continental · Europa", sub: "Jogadores da Europa", pos: "#312", cfg: esc({ bg1: "#2f6fb3", bg2: "#25588f", border: "#eaf2fd", symbol: "mapa-europa" }) },
  { id: "portugal", name: "Nacional · Portugal", sub: "Jogadores de Portugal", pos: "#14", cfg: esc({ bg1: "#c0392b", bg2: "#7a1f17", border: "#efeadd", symbol: "estrela" }) },
];

const DESTAQUES = [
  { id: "pretas", name: "Liga dos Faixas-Pretas", sub: "12.340 jogadores", cfg: esc({ bg1: "#141110", bg2: "#000000", border: GOLD, symbol: "estrela" }), action: "Ver" },
  { id: "brasil", name: "Tatame Brasil", sub: "8.901 jogadores", cfg: esc({ bg1: "#2a4d3e", bg2: "#16302a", border: "#7fd1a3", symbol: "montanha" }), action: "Ver" },
  { id: "ippt", name: "Ippon Portugal", sub: "3.221 jogadores", cfg: esc({ bg1: "#7a4fa3", bg2: "#4a2f66", border: "#efeadd", symbol: "raio" }), action: "Ver" },
];
const PRIVADAS = [
  { id: "sensei", name: "Sensei Masters", sub: "Privada · moderada", cfg: esc({ bg1: "#2f6fb3", bg2: "#25588f", border: "#7fb8f5", symbol: "torii" }), action: "Solicitar" },
];

export default function Ligas() {
  const [tab, setTab] = useState<Tab>("ativas");

  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: FB }}>
      <div style={{ maxWidth: 460, margin: "0 auto", padding: "14px 14px 40px" }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <a href="/inicio" aria-label="Voltar" style={{ width: 34, height: 34, borderRadius: "50%", border: "1px solid #243029", display: "flex", alignItems: "center", justifyContent: "center", color: "#cfd8d2", textDecoration: "none" }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
            </a>
            <h1 style={{ fontFamily: FD, fontSize: 19, fontWeight: 700, textTransform: "uppercase", margin: 0 }}>Ligas</h1>
          </div>
          <a href="/criar-liga" aria-label="Criar liga" style={{ width: 36, height: 36, borderRadius: "50%", background: GOLD, color: "#1b211e", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          </a>
        </header>

        <div style={{ display: "flex", gap: 8, marginBottom: 16, borderBottom: "1px solid #1a221d" }}>
          {(["ativas", "mercado", "resultados"] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)} style={{ flex: 1, textAlign: "center", background: "transparent", border: "none", borderBottom: `2px solid ${tab === t ? GOLD : "transparent"}`, color: tab === t ? "#f1ede2" : "#7c8a82", fontFamily: FD, fontSize: 14, fontWeight: 700, textTransform: "uppercase", padding: "8px 0", cursor: "pointer" }}>
              {t === "ativas" ? "Ativas" : t === "mercado" ? "Mercado" : "Resultados"}
            </button>
          ))}
        </div>

        {tab === "ativas" && (
          <>
            <Section>Ligas oficiais</Section>
            {OFICIAIS.map((l) => <LeagueRow key={l.id} cfg={l.cfg} name={l.name} sub={l.sub} right={<span style={{ fontFamily: FD, fontWeight: 700, color: GOLD, fontSize: 15 }}>{l.pos}</span>} />)}
            <Section style={{ marginTop: 18 }}>Ligas de amigos</Section>
            <div style={{ background: "#121815", border: "1px dashed #2a3a33", borderRadius: 14, padding: "18px 14px", textAlign: "center" }}>
              <div style={{ fontSize: 13, color: "#c7d0c9", marginBottom: 12, lineHeight: 1.5 }}>Ainda não tens ligas de amigos.<br />Cria uma e desafia o teu dojo!</div>
              <a href="/criar-liga" style={{ display: "inline-block", background: "#3f8f5a", color: "#06140d", fontFamily: FD, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", padding: "11px 20px", borderRadius: 10, textDecoration: "none", fontSize: 14 }}>Criar liga</a>
            </div>
          </>
        )}

        {tab === "mercado" && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#141a17", border: "1px solid #243029", borderRadius: 10, padding: "9px 12px", marginBottom: 16 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#93a39a" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
              <input placeholder="Procurar liga pelo nome" style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#f1ede2", fontSize: 14, fontFamily: FB }} />
            </div>
            <Section>Destaques</Section>
            {DESTAQUES.map((l) => <LeagueRow key={l.id} cfg={l.cfg} name={l.name} sub={l.sub} right={<ActionBtn kind="ver">{l.action}</ActionBtn>} />)}
            <Section style={{ marginTop: 18 }}>Últimas ligas</Section>
            {PRIVADAS.map((l) => <LeagueRow key={l.id} cfg={l.cfg} name={l.name} sub={l.sub} right={<ActionBtn kind="solicitar">{l.action}</ActionBtn>} />)}
          </>
        )}

        {tab === "resultados" && (
          <div style={{ textAlign: "center", padding: "50px 16px", color: "#7c8a82" }}>
            <div style={{ fontFamily: FD, fontSize: 15, fontWeight: 700, textTransform: "uppercase", color: "#cfd8d2", marginBottom: 6 }}>Resultados</div>
            <div style={{ fontSize: 13, lineHeight: 1.5 }}>As classificações de cada rodada aparecem aqui depois de cada competição.</div>
            <div style={{ marginTop: 12, fontSize: 11, color: "#5f6f67", border: "1px solid #2a3a33", borderRadius: 999, padding: "4px 12px", display: "inline-block" }}>Em breve</div>
          </div>
        )}
      </div>
    </main>
  );
}

function Section({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ fontFamily: FD, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#93a39a", margin: "4px 0 10px", ...style }}>{children}</div>;
}
function LeagueRow({ cfg, name, sub, right }: { cfg: Identity; name: string; sub: string; right: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, background: "#121815", border: "1px solid #243029", borderRadius: 14, padding: "11px 13px", marginBottom: 9 }}>
      <div style={{ flexShrink: 0, display: "flex" }}><Escudo config={cfg} size={34} /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</div>
        <div style={{ fontSize: 11, color: "#93a39a" }}>{sub}</div>
      </div>
      {right}
    </div>
  );
}
function ActionBtn({ kind, children }: { kind: "ver" | "solicitar"; children: React.ReactNode }) {
  const ver = kind === "ver";
  return <button style={{ background: ver ? "#e67e22" : "#3f8f5a", color: ver ? "#1b0f06" : "#06140d", border: "none", fontFamily: FD, fontWeight: 700, textTransform: "uppercase", fontSize: 11, padding: "7px 12px", borderRadius: 8, cursor: "pointer", whiteSpace: "nowrap" }}>{children}</button>;
}
