"use client";

import { useState, useEffect } from "react";
import { Mascot } from "@/components/Mascot";
import { Escudo, loadIdentity, DEFAULT_IDENTITY, type Identity } from "@/components/Escudo";

const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";

const INFO: { label: string; href?: string; soon?: boolean }[] = [
  { label: "Como se joga", href: "/como-jogar" },
  { label: "Sobre a Ippon League", soon: true },
  { label: "Ippon Pro", soon: true },
  { label: "Termos de utilização", soon: true },
  { label: "Política de privacidade", soon: true },
  { label: "Ajuda e contacto", soon: true },
];

export default function Perfil() {
  const [name, setName] = useState("campeão");
  const [identity, setIdentity] = useState<Identity>(DEFAULT_IDENTITY);

  useEffect(() => {
    try {
      const n = localStorage.getItem("ippon_name");
      if (n) setName(n);
      setIdentity(loadIdentity());
    } catch {}
  }, []);

  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: FB }}>
      <div style={{ maxWidth: 460, margin: "0 auto", padding: "14px 16px 40px" }}>
        <header style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 8 }}>
          <a href="/inicio" aria-label="Voltar ao início" style={{ width: 36, height: 36, borderRadius: "50%", border: "1px solid #243029", display: "flex", alignItems: "center", justifyContent: "center", color: "#cfd8d2", textDecoration: "none", flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
          </a>
          <h1 style={{ fontFamily: FD, fontSize: 19, fontWeight: 700, textTransform: "uppercase", margin: 0 }}>Perfil</h1>
        </header>

        <div style={{ display: "flex", alignItems: "center", gap: 14, background: "#121815", border: "1px solid #243029", borderRadius: 16, padding: 16, marginBottom: 22 }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#1c3a2e", overflow: "hidden", flexShrink: 0 }}>
            <Mascot belt="#efeadd" expression="feliz" />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: FD, fontSize: 20, fontWeight: 700, textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</div>
            <div style={{ fontSize: 13, color: GOLD, fontWeight: 700, marginTop: 2 }}>Faixa Branca</div>
          </div>
        </div>

        <SectionTitle>A minha equipa</SectionTitle>
        <div style={{ display: "flex", alignItems: "center", gap: 14, background: "#121815", border: "1px solid #243029", borderRadius: 16, padding: 16, marginBottom: 12 }}>
          <div style={{ flexShrink: 0, display: "flex" }}><Escudo config={identity} size={52} /></div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontFamily: FD, fontSize: 16, fontWeight: 700, textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{identity.name}</div>
            <div style={{ fontSize: 12, color: "#93a39a", marginTop: 2 }}>Escudo e nome do time</div>
          </div>
        </div>
        <a href="/escudo" style={{ display: "block", textAlign: "center", background: GOLD, color: "#1b211e", fontFamily: FD, fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", padding: "12px", borderRadius: 12, textDecoration: "none", marginBottom: 26 }}>
          Mudar escudo
        </a>

        <SectionTitle>Informações e políticas</SectionTitle>
        <div style={{ background: "#121815", border: "1px solid #243029", borderRadius: 16, overflow: "hidden" }}>
          {INFO.map((it, i) => {
            const inner = (
              <>
                <span style={{ fontSize: 14, color: "#f1ede2" }}>{it.label}</span>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {it.soon && <span style={{ fontSize: 10, color: "#7c8a82", border: "1px solid #2a3a33", borderRadius: 999, padding: "2px 8px" }}>Em breve</span>}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5f6f67" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6" /></svg>
                </span>
              </>
            );
            const rowStyle: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderTop: i === 0 ? "none" : "1px solid #1a221d", textDecoration: "none", color: "#f1ede2" };
            return it.href
              ? <a key={it.label} href={it.href} style={rowStyle}>{inner}</a>
              : <div key={it.label} style={{ ...rowStyle, opacity: 0.85, cursor: "default" }}>{inner}</div>;
          })}
        </div>

        <p style={{ fontSize: 11, color: "#5f6f67", textAlign: "center", marginTop: 22 }}>Ippon League · versão de testes</p>
      </div>
    </main>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily: FD, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#93a39a", marginBottom: 10 }}>{children}</div>;
}
