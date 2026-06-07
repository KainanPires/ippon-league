"use client";
import { useState, useEffect } from "react";
import { Mascot } from "@/components/Mascot";
import { Escudo, loadIdentity, DEFAULT_IDENTITY, type Identity } from "@/components/Escudo";
import { supabase } from "@/lib/supabase";
const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";
const INFO: { label: string; href?: string; soon?: boolean }[] = [
  { label: "Como se joga", href: "/como-jogar" },
  { label: "Sobre a Ippon League", soon: true },
  { label: "Ippon Pro", href: "/ippon-pro" },
  { label: "Termos de utilização", soon: true },
  { label: "Política de privacidade", soon: true },
  { label: "Ajuda e contacto", soon: true },
];

// Dados da conta lidos do Supabase (metadados do registo + email do Auth).
type Conta = {
  nome: string;
  email: string;
  telefone: string;
  pais: string;
  faixa: string;
};

export default function Perfil() {
  const [identity, setIdentity] = useState<Identity>(DEFAULT_IDENTITY);
  const [conta, setConta] = useState<Conta | null>(null);
  const [ready, setReady] = useState(false);
  const [saindo, setSaindo] = useState(false);
  const [abertoDados, setAbertoDados] = useState(false);

  useEffect(() => {
    let active = true;
    try { setIdentity(loadIdentity()); } catch {}
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      const u = data.session?.user;
      if (u) {
        const m = u.user_metadata || {};
        setConta({
          nome: String(m.nome || "").trim() || "Campeão",
          email: String(u.email || "").trim(),
          telefone: String(m.telefone || "").trim(),
          pais: String(m.pais || "").trim(),
          faixa: String(m.faixa || "").trim() || "Branca",
        });
      }
      setReady(true);
    });
    return () => { active = false; };
  }, []);

  async function sair() {
    if (saindo) return;
    setSaindo(true);
    try { await supabase.auth.signOut(); } catch {}
    window.location.href = "/entrar";
  }

  const nomeMostrado = conta?.nome || "Campeão";
  const faixaMostrada = conta?.faixa || "Branca";

  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: FB }}>
      <div style={{ maxWidth: 460, margin: "0 auto", padding: "14px 16px 40px" }}>
        <header style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 8 }}>
          <a href="/inicio" aria-label="Voltar ao início" style={{ width: 36, height: 36, borderRadius: "50%", border: "1px solid #243029", display: "flex", alignItems: "center", justifyContent: "center", color: "#cfd8d2", textDecoration: "none", flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
          </a>
          <h1 style={{ fontFamily: FD, fontSize: 19, fontWeight: 700, textTransform: "uppercase", margin: 0 }}>Perfil</h1>
        </header>

        {/* Cartão do jogador — toca para ver/gerir os teus dados */}
        <button onClick={() => setAbertoDados((v) => !v)} style={{ display: "flex", alignItems: "center", gap: 14, width: "100%", textAlign: "left", background: "#121815", border: "1px solid #243029", borderRadius: 16, padding: 16, marginBottom: abertoDados ? 10 : 22, cursor: "pointer", color: "#f1ede2", fontFamily: FB }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#1c3a2e", overflow: "hidden", flexShrink: 0 }}>
            <Mascot belt="#efeadd" expression="feliz" />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontFamily: FD, fontSize: 20, fontWeight: 700, textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nomeMostrado}</div>
            <div style={{ fontSize: 13, color: GOLD, fontWeight: 700, marginTop: 2 }}>Faixa {faixaMostrada}</div>
            <div style={{ fontSize: 11, color: "#7c8a82", marginTop: 4 }}>{abertoDados ? "Toca para fechar" : "Toca para ver os teus dados"}</div>
          </div>
          <span style={{ flexShrink: 0, color: "#93a39a", transform: abertoDados ? "rotate(90deg)" : "none", transition: "transform 0.2s" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6" /></svg>
          </span>
        </button>

        {/* Os meus dados — só aparecem quando o cartão é tocado */}
        {abertoDados && (
          <div style={{ background: "#121815", border: "1px solid #243029", borderRadius: 16, overflow: "hidden", marginBottom: 22 }}>
            {!ready ? (
              <div style={{ padding: 16, fontSize: 13, color: "#7c8a82" }}>A carregar os teus dados…</div>
            ) : !conta ? (
              <div style={{ padding: 16, fontSize: 13, color: "#93a39a" }}>
                Não encontrámos a tua conta. <a href="/entrar" style={{ color: GOLD, fontWeight: 700, textDecoration: "none" }}>Entrar</a>
              </div>
            ) : (
              <>
                <DataRow label="Nome" value={conta.nome || "—"} first />
                <DataRow label="Email" value={conta.email || "—"} />
                <DataRow label="Telefone" value={conta.telefone || "—"} />
                <DataRow label="País" value={conta.pais || "—"} />
                <DataRow label="Faixa" value={conta.faixa || "—"} />
              </>
            )}
          </div>
        )}

        {/* A minha equipa / escudo */}
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

        {/* Informações e políticas */}
        <SectionTitle>Informações e políticas</SectionTitle>
        <div style={{ background: "#121815", border: "1px solid #243029", borderRadius: 16, overflow: "hidden", marginBottom: 26 }}>
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

        {/* Sair (logout) — último botão, ícone de porta aberta */}
        <button onClick={sair} disabled={saindo} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, width: "100%", background: "transparent", border: "1px solid #5a2f2c", color: "#ef8d83", fontFamily: FD, fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", padding: "13px", borderRadius: 12, cursor: saindo ? "default" : "pointer", opacity: saindo ? 0.7 : 1 }}>
          <DoorIcon />
          {saindo ? "A sair…" : "Sair da conta"}
        </button>

        <p style={{ fontSize: 11, color: "#5f6f67", textAlign: "center", marginTop: 22 }}>Ippon League · versão de testes</p>
      </div>
    </main>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily: FD, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#93a39a", marginBottom: 10 }}>{children}</div>;
}

function DataRow({ label, value, first }: { label: string; value: string; first?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "13px 16px", borderTop: first ? "none" : "1px solid #1a221d" }}>
      <span style={{ fontSize: 12, color: "#93a39a", flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 14, color: "#f1ede2", textAlign: "right", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{value}</span>
    </div>
  );
}

function DoorIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}
