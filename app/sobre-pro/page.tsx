"use client";

import { useEffect, useState } from "react";
import { Mascot } from "@/components/Mascot";
import { PRECO } from "@/lib/precos";
import { temSessao } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";

// O que tens com o Pro.
const VANTAGENS: { t: string; x: string }[] = [
  { t: "Scout avançado", x: "Estatísticas baseadas no histórico real de cada atleta nas últimas competições." },
  { t: "Análise do teu time", x: "Uma leitura honesta da tua escalação: o que parece sólido, onde há dúvida e porquê. Sem te dizer o que fazer — a decisão é sempre tua." },
  { t: "Recomendações da rodada", x: "Analisamos o chaveamento e os confrontos diretos para estimar possíveis campeões e maiores pontuadores. São estimativas, não garantias." },
  { t: "Chaveamento das competições", x: "Vê as chaves de cada competição e acompanha o caminho dos teus atletas." },
  { t: "Acompanhamento ao vivo", x: "No dia da competição, acompanha o desenrolar com base nos dados que recolhemos." },
  { t: "Até 5 ligas ativas", x: "Cria até 5 ligas em simultâneo, entre mata-mata e pontos corridos." },
  { t: "Design exclusivo Pro", x: "Um visual próprio e distinto, só para membros Ippon Pro." },
  { t: "Elegibilidade a prémios", x: "Concorre aos prémios das ligas Mundial e Continental (ver abaixo)." },
];

export default function SobrePro() {
  const [logado, setLogado] = useState(false);
  const [isPro, setIsPro] = useState(false);

  useEffect(() => {
    temSessao().then(setLogado).catch(() => setLogado(false));
    supabase.auth.getSession().then(({ data }) => {
      const m = data.session?.user?.user_metadata || {};
      setIsPro(Boolean(m.is_pro));
    }).catch(() => setIsPro(false));
  }, []);

  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: FB }}>
      <div style={{ maxWidth: 460, margin: "0 auto", padding: "14px 16px 48px" }}>
        {/* Cabeçalho */}
        <header style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 16 }}>
          <a href={logado ? "/perfil" : "/"} aria-label="Voltar" style={{ width: 34, height: 34, borderRadius: "50%", border: "1px solid #243029", display: "flex", alignItems: "center", justifyContent: "center", color: "#cfd8d2", textDecoration: "none", flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
          </a>
          <h1 style={{ fontFamily: FD, fontSize: 19, fontWeight: 700, textTransform: "uppercase", margin: 0 }}>Ippon Pro</h1>
        </header>

        {/* Intro */}
        <section style={{ textAlign: "center", background: "linear-gradient(160deg,#2a2410,#15110a)", border: `1px solid ${GOLD}`, borderRadius: 18, padding: "24px 18px", marginBottom: 18 }}>
          <div style={{ width: 88, height: 88, margin: "0 auto 8px" }}><Mascot belt="#141110" expression="sabio" /></div>
          <h2 style={{ fontFamily: FD, fontSize: 22, fontWeight: 700, textTransform: "uppercase", margin: "4px 0 8px", lineHeight: 1.1, color: GOLD }}>O que é o Ippon Pro</h2>
          <p style={{ fontSize: 14, color: "#dfe6e0", lineHeight: 1.6, margin: 0 }}>Uma assinatura que te dá ferramentas de informação e vantagem para jogares com mais conhecimento. Tudo baseado em dados — a estratégia é sempre tua.</p>
        </section>

        {/* O que tens */}
        <SectionTitle>O que tens com o Pro</SectionTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 22 }}>
          {VANTAGENS.map((v) => (
            <div key={v.t} style={{ display: "flex", gap: 11, background: "#121815", border: "1px solid #243029", borderRadius: 14, padding: "13px 14px" }}>
              <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#3a2f12", color: GOLD, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, flexShrink: 0 }}>✓</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{v.t}</div>
                <div style={{ fontSize: 12.5, color: "#93a39a", marginTop: 2, lineHeight: 1.5 }}>{v.x}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Prémios */}
        <SectionTitle>Como funcionam os prémios</SectionTitle>
        <div style={{ background: "#121815", border: "1px solid #243029", borderRadius: 16, padding: 16, marginBottom: 22 }}>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontFamily: FD, fontSize: 14, fontWeight: 700, textTransform: "uppercase", color: GOLD, marginBottom: 4 }}>Liga Mundial</div>
            <p style={{ fontSize: 13, color: "#c7d0c9", lineHeight: 1.55, margin: 0 }}>Prémio em <strong>cada rodada</strong> para o melhor da rodada a nível mundial, e ainda um <strong>prémio final de temporada</strong> para o 1.º lugar no fim do ano.</p>
          </div>
          <div style={{ borderTop: "1px solid #1a221d", paddingTop: 14 }}>
            <div style={{ fontFamily: FD, fontSize: 14, fontWeight: 700, textTransform: "uppercase", color: GOLD, marginBottom: 4 }}>Liga Continental</div>
            <p style={{ fontSize: 13, color: "#c7d0c9", lineHeight: 1.55, margin: 0 }}>Um <strong>prémio final de temporada</strong> para o 1.º lugar, atribuído no fim do ano.</p>
          </div>
          <p style={{ fontSize: 11.5, color: "#7c8a82", lineHeight: 1.5, margin: "14px 0 0" }}>Os prémios e experiências são definidos a cada temporada e podem contar com o apoio de patrocinadores.</p>
        </div>

        {/* Assinatura */}
        <SectionTitle>A assinatura</SectionTitle>
        <div style={{ background: "#121815", border: "1px solid #243029", borderRadius: 16, padding: 16, marginBottom: 22 }}>
          <LinhaInfo titulo="7 dias grátis" texto="Experimenta o Pro durante 7 dias. Se cancelares dentro desse período, não pagas nada." />
          <LinhaInfo titulo="Plano anual" texto="A assinatura é anual e renova-se automaticamente no ano seguinte." />
          <LinhaInfo titulo="Cancelar quando quiseres" texto="Ao cancelar, manténs o acesso até ao fim do período já pago — só não há nova renovação." ultimo />
        </div>

        {/* Transparência — o mais importante */}
        <SectionTitle>Transparência total</SectionTitle>
        <div style={{ background: "#0f1411", border: `1px solid ${GOLD}`, borderRadius: 16, padding: "16px 16px 18px", marginBottom: 22 }}>
          <div style={{ display: "flex", gap: 11, alignItems: "flex-start", marginBottom: 10 }}>
            <div style={{ width: 40, height: 40, flexShrink: 0 }}><Mascot belt="#141110" expression="indicando" /></div>
            <p style={{ fontSize: 13.5, color: "#dfe6e0", lineHeight: 1.6, margin: 0 }}>Queremos ser muito claros contigo sobre o que o Pro é — e o que não é.</p>
          </div>
          <p style={{ fontSize: 13, color: "#c7d0c9", lineHeight: 1.6, margin: "0 0 10px" }}>O Ippon Pro oferece <strong>apenas informação</strong>, baseada em dados e no histórico dos atletas: os seus resultados naquela competição nos últimos anos, a dificuldade dos confrontos seguintes e a possibilidade de cada um pontuar bem.</p>
          <p style={{ fontSize: 13, color: "#c7d0c9", lineHeight: 1.6, margin: 0 }}>Ao assinar, reconheces que o Pro é <strong style={{ color: GOLD }}>meramente informativo e não garante qualquer resultado</strong>. Mostramos possibilidades e estimativas — nunca certezas. A decisão e a estratégia são sempre tuas.</p>
        </div>

        {/* Link discreto para vendas — só para quem NÃO é Pro */}
        {!isPro && (
          <a href="/ippon-pro" style={{ display: "block", textAlign: "center", background: GOLD, color: "#1b211e", fontFamily: FD, fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", padding: "13px", borderRadius: 12, textDecoration: "none" }}>
            Ver o Ippon Pro · {PRECO.atualComPeriodo}
          </a>
        )}
        {isPro && (
          <div style={{ textAlign: "center", background: "#121815", border: `1px solid ${GOLD}`, borderRadius: 12, padding: "13px", fontSize: 13, color: GOLD, fontWeight: 700 }}>
            És membro Ippon Pro. Obrigado por fazeres parte! ★
          </div>
        )}
      </div>
    </main>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily: FD, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#93a39a", marginBottom: 10 }}>{children}</div>;
}

function LinhaInfo({ titulo, texto, ultimo }: { titulo: string; texto: string; ultimo?: boolean }) {
  return (
    <div style={{ borderBottom: ultimo ? "none" : "1px solid #1a221d", paddingBottom: ultimo ? 0 : 12, marginBottom: ultimo ? 0 : 12 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: GOLD, marginBottom: 2 }}>{titulo}</div>
      <p style={{ fontSize: 12.5, color: "#a9b4ac", lineHeight: 1.55, margin: 0 }}>{texto}</p>
    </div>
  );
}
