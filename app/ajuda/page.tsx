"use client";

import { useEffect, useState } from "react";
import { Mascot } from "@/components/Mascot";
import { temSessao } from "@/lib/auth";

const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";
const EMAIL = "support@ipponleague.com";

// FAQ — perguntas frequentes. As respostas remetem para as páginas que já existem.
const FAQ: { p: string; r: React.ReactNode }[] = [
  {
    p: "O que é a Ippon League?",
    r: <>É o jogo oficial dos fãs de judô. Montas uma equipa de 8 atletas, escolhes um capitão e disputas com fãs do mundo inteiro, pontuando com as ações reais das competições. Sabe mais em <A href="/como-jogar">Como se joga</A>.</>,
  },
  {
    p: "Quanto custa para jogar?",
    r: <>Jogar é totalmente grátis. Há uma assinatura opcional, o Ippon Pro, com ferramentas de vantagem — mas nunca precisas dela para jogar e competir.</>,
  },
  {
    p: "Como ganho pontos?",
    r: <>Os teus atletas pontuam pelas ações nas lutas: ippon, waza-ari, yuko e shidos provocados somam; sofrer pontos ou shidos tira. Vê a tabela completa em <A href="/como-jogar">Como se joga</A>.</>,
  },
  {
    p: "O que são os Judocoins (JC)?",
    r: <>São a moeda do jogo. Começas com 100 JC para montares a tua equipa. Quando os teus atletas valorizam, o teu património cresce.</>,
  },
  {
    p: "O que é o capitão?",
    r: <>É o atleta que escolhes para pontuar a dobrar. Tudo o que ele fizer conta ×2 — por isso escolhe bem!</>,
  },
  {
    p: "Como subo de faixa?",
    r: <>A tua faixa reflete o teu desempenho face aos outros jogadores. Pontua bem nas rodadas para subir; rodadas fracas fazem-te descer. Começas na faixa branca.</>,
  },
  {
    p: "O que é o Ippon Pro?",
    r: <>É a assinatura opcional com scout avançado, análise do teu time, dicas da rodada e mais. Conhece tudo, com total transparência, na página do <A href="/sobre-pro">Ippon Pro</A>.</>,
  },
  {
    p: "Como cancelo o Ippon Pro?",
    r: <>Podes cancelar quando quiseres. Manténs o acesso até ao fim do período já pago — só não há nova renovação. Os primeiros 7 dias são grátis.</>,
  },
  {
    p: "Os meus dados estão seguros?",
    r: <>Levamos a sério a tua privacidade. Vê como tratamos os teus dados na Política de privacidade (em breve), e fala connosco se tiveres dúvidas.</>,
  },
  {
    p: "Encontrei um erro ou tenho uma sugestão.",
    r: <>Adoramos ouvir-te! Escreve-nos para o email abaixo — cada mensagem ajuda-nos a melhorar o jogo.</>,
  },
];

export default function Ajuda() {
  const [logado, setLogado] = useState(false);
  const [aberta, setAberta] = useState<number | null>(null);

  useEffect(() => {
    temSessao().then(setLogado).catch(() => setLogado(false));
  }, []);

  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: FB }}>
      <div style={{ maxWidth: 460, margin: "0 auto", padding: "14px 16px 48px" }}>
        {/* Cabeçalho */}
        <header style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 16 }}>
          <a href={logado ? "/perfil" : "/"} aria-label="Voltar" style={{ width: 34, height: 34, borderRadius: "50%", border: "1px solid #243029", display: "flex", alignItems: "center", justifyContent: "center", color: "#cfd8d2", textDecoration: "none", flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
          </a>
          <h1 style={{ fontFamily: FD, fontSize: 19, fontWeight: 700, textTransform: "uppercase", margin: 0 }}>Ajuda e contacto</h1>
        </header>

        {/* Intro */}
        <section style={{ display: "flex", alignItems: "center", gap: 14, background: "#121815", border: "1px solid #243029", borderRadius: 16, padding: 16, marginBottom: 22 }}>
          <div style={{ width: 60, height: 60, flexShrink: 0 }}><Mascot belt="#141110" expression="indicando" /></div>
          <p style={{ fontSize: 14, color: "#c7d0c9", lineHeight: 1.55, margin: 0 }}>Tens dúvidas? Começa por aqui. E se precisares de nós, é só escrever.</p>
        </section>

        {/* FAQ */}
        <SectionTitle>Perguntas frequentes</SectionTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 26 }}>
          {FAQ.map((item, i) => {
            const open = aberta === i;
            return (
              <div key={i} style={{ background: "#121815", border: `1px solid ${open ? GOLD : "#243029"}`, borderRadius: 12, overflow: "hidden" }}>
                <button
                  onClick={() => setAberta(open ? null : i)}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, width: "100%", textAlign: "left", background: "transparent", border: "none", color: "#f1ede2", padding: "14px 16px", cursor: "pointer", fontFamily: FB, fontSize: 14, fontWeight: 600 }}
                >
                  <span>{item.p}</span>
                  <span style={{ flexShrink: 0, color: open ? GOLD : "#93a39a", transform: open ? "rotate(90deg)" : "none", transition: "transform 0.2s" }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6" /></svg>
                  </span>
                </button>
                {open && (
                  <div style={{ padding: "0 16px 14px", fontSize: 13.5, color: "#a9b4ac", lineHeight: 1.6 }}>{item.r}</div>
                )}
              </div>
            );
          })}
        </div>

        {/* Contacto */}
        <SectionTitle>Fala connosco</SectionTitle>
        <section style={{ background: "linear-gradient(160deg,#1c3a2e,#10160f)", border: `1px solid ${GOLD}`, borderRadius: 16, padding: "20px 18px", textAlign: "center" }}>
          <div style={{ width: 56, height: 56, margin: "0 auto 8px" }}><Mascot belt="#141110" expression="feliz" /></div>
          <p style={{ fontSize: 14, color: "#dfe6e0", lineHeight: 1.55, margin: "0 0 14px" }}>Não encontraste o que procuravas? Escreve-nos — respondemos o mais rápido possível.</p>
          <a href={`mailto:${EMAIL}`} style={{ display: "block", padding: 13, borderRadius: 12, background: GOLD, color: "#1b211e", fontFamily: FD, fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", textDecoration: "none" }}>
            {EMAIL}
          </a>
          <div style={{ fontSize: 11.5, color: "#7c8a82", marginTop: 12 }}>Toca para abrir o teu email</div>
        </section>
      </div>
    </main>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily: FD, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#93a39a", marginBottom: 10 }}>{children}</div>;
}

function A({ href, children }: { href: string; children: React.ReactNode }) {
  return <a href={href} style={{ color: GOLD, fontWeight: 700, textDecoration: "none" }}>{children}</a>;
}
