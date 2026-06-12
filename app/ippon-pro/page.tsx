"use client";

import { Mascot } from "@/components/Mascot";
import { PRECO } from "@/lib/precos";

const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";

// Apenas benefícios REAIS ou fundamentados na análise. Nada que entregue a
// decisão do jogador (quem montar / quem é o melhor da rodada) — isso mataria o
// jogo. A valorização é vendida como POSSIBILIDADE segundo a análise, não promessa.
const BENEFITS: { t: string; x: string }[] = [
  { t: "Scout avançado dos atletas", x: "O histórico real de cada atleta: títulos, forma recente e como costuma pontuar em cada nível de competição." },
  { t: "Análise do teu time", x: "Uma leitura honesta da tua escalação — o que parece forte e onde está o risco. Sem te dizer o que fazer; a decisão é tua." },
  { t: "Dica de capitão", x: "Entre os atletas que TU escolheste, qual tem o histórico mais forte para esta competição. Continuas a montar o teu time à tua maneira." },
  { t: "Maior possibilidade de valorização", x: "Pela análise do histórico, vê quais dos teus atletas têm mais hipótese de valorizar e render JC. É uma tendência, não uma garantia." },
  { t: "Chaveamento das competições", x: "Vê o quadro de lutas e acompanha o caminho dos teus atletas na chave." },
  { t: "Acompanhamento ao vivo", x: "No dia da competição, segue as pontuações dos teus atletas em tempo real." },
  { t: "Até 5 ligas ativas", x: "Cria até 5 ligas em simultâneo, entre mata-mata e pontos corridos." },
  { t: "Prémios e experiências", x: "Sendo PRO concorres a prémios todas as rodadas — e a experiências no mundo do judô." },
  { t: "Ligas e badges exclusivos", x: "Distinções e ligas só para membros Ippon Pro, com um visual próprio." },
];

export default function IpponPro() {
  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: FB }}>
      <div style={{ maxWidth: 460, margin: "0 auto", padding: "14px 16px 40px" }}>
        <header style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 10 }}>
          <a href="/inicio" aria-label="Voltar" style={{ width: 34, height: 34, borderRadius: "50%", border: "1px solid #243029", display: "flex", alignItems: "center", justifyContent: "center", color: "#cfd8d2", textDecoration: "none", flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
          </a>
          <h1 style={{ fontFamily: FD, fontSize: 19, fontWeight: 700, textTransform: "uppercase", margin: 0 }}>Ippon Pro</h1>
        </header>

        {/* Hero */}
        <div style={{ textAlign: "center", background: "linear-gradient(160deg,#1c3a2e,#10160f)", border: `1px solid ${GOLD}`, borderRadius: 18, padding: "22px 18px", marginBottom: 16 }}>
          <div style={{ width: 92, height: 92, margin: "0 auto 6px" }}><Mascot belt="#141110" expression="sabio" /></div>
          <div style={{ fontFamily: FD, fontSize: 24, fontWeight: 700, textTransform: "uppercase", lineHeight: 1.1 }}>Joga com vantagem</div>
          <p style={{ fontSize: 14, color: "#c7d0c9", lineHeight: 1.5, margin: "8px 0 6px" }}>Conhece o histórico de cada atleta, vê quem tem mais hipótese de render e monta o teu time com mais informação. A estratégia é sempre tua.</p>
          <p style={{ fontSize: 13, color: GOLD, fontWeight: 700, lineHeight: 1.4, margin: "0 0 14px" }}>{PRECO.premios}.</p>
          <div>
            {PRECO.emPromocao && <><span style={{ fontSize: 15, color: "#7c8a82", textDecoration: "line-through" }}>{PRECO.normal}</span>{" "}</>}
            <span style={{ fontFamily: FD, fontSize: 36, fontWeight: 700, color: GOLD }}>{PRECO.atual}</span>
            <span style={{ fontSize: 13, color: "#93a39a" }}>{PRECO.periodo}</span>
          </div>
          {PRECO.emPromocao && <div style={{ fontSize: 11, color: GOLD, marginTop: 2 }}>Oferta de lançamento · 7 dias grátis · plano anual</div>}
        </div>

        {/* Benefícios */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
          {BENEFITS.map((b) => (
            <div key={b.t} style={{ display: "flex", gap: 11, background: "#121815", border: "1px solid #243029", borderRadius: 14, padding: "13px 14px" }}>
              <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#3a2f12", color: GOLD, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, flexShrink: 0 }}>✓</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{b.t}</div>
                <div style={{ fontSize: 12, color: "#93a39a", marginTop: 2, lineHeight: 1.45 }}>{b.x}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Nota honesta: o que o Pro NÃO faz (protege o jogo e a confiança) */}
        <div style={{ background: "#0f1411", border: "1px solid #243029", borderRadius: 14, padding: "13px 14px", marginBottom: 16 }}>
          <div style={{ fontSize: 12.5, color: "#a9b4ac", lineHeight: 1.6 }}>
            O Pro <strong style={{ color: "#cfd8d2" }}>não monta o teu time por ti</strong> nem te diz quem vai ganhar. Dá-te informação e leituras do histórico — a graça de acertar continua a ser tua.
          </div>
        </div>

        <div style={{ fontSize: 12, color: "#7c8a82", textAlign: "center", marginBottom: 14, lineHeight: 1.5 }}>
          Sem anúncios · prioridade em sorteios e experiências · apoia o crescimento da Ippon League. 🥋
        </div>
      </div>

      {/* Barra fixa de assinatura */}
      <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, background: "#0f1411", borderTop: "1px solid #243029", padding: "12px 16px" }}>
        <div style={{ maxWidth: 460, margin: "0 auto" }}>
          <button onClick={() => alert("Pagamento em breve! Estamos a preparar o Ippon Pro.")} style={{ width: "100%", background: GOLD, color: "#1b211e", border: "none", fontFamily: FD, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", padding: 15, borderRadius: 12, fontSize: 16, cursor: "pointer" }}>
            Assinar por {PRECO.atualComPeriodo}
          </button>
          <a href="/inicio" style={{ display: "block", textAlign: "center", marginTop: 8, color: "#93a39a", fontSize: 12, textDecoration: "none", fontFamily: FB }}>Agora não</a>
        </div>
      </div>
    </main>
  );
}
