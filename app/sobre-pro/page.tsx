"use client";
import { useEffect, useState } from "react";
import { Mascot } from "@/components/Mascot";
import { PRECO } from "@/lib/precos";
import { temSessao } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";
const MAX = "#7fb8f5"; // tom do Pro Max
// Extras que o Pro Max dá a mais (além de tudo o que o Pro tem). A chave ao vivo
// e a análise existem só nas competições de topo (Mundial, Grand Slam, Grand
// Prix, Masters, Olimpíadas) — dito de forma explícita, para não prometer chave
// em competições onde ela não vai existir.
const MAX_EXTRA: { t: string; x: string }[] = [
  { t: "Chave ao vivo", x: "Acompanha o chaveamento a decorrer em tempo real, durante a competição — vês as pontuações e o caminho dos atletas enquanto as lutas acontecem. Nas competições de topo: Mundial, Grand Slam, Grand Prix, Masters e Olimpíadas." },
  { t: "Alerta dos teus favoritos", x: "Avisamos-te quando um atleta que segues é o próximo a entrar no tatame." },
  { t: "Até 10 ligas e copas", x: "O dobro do Pro: cria e joga em até 10 ligas e copas em simultâneo." },
  { t: "Análise da chave", x: "Quando o chaveamento sai, mostramos quais atletas têm mais hipótese de pontuar muito ou chegar longe, pelos confrontos prováveis. Nas competições de topo: Mundial, Grand Slam, Grand Prix, Masters e Olimpíadas." },
  { t: "Grupo exclusivo", x: "Acesso ao grupo de WhatsApp/Telegram só para membros Pro Max — informação da rodada e conversa com outros jogadores." },
  { t: "Layout e visual exclusivos", x: "Um aspeto próprio e distinto, reservado a quem é Pro Max." },
];
// O que tens com o Pro. Só o que é REAL ou fundamentado na análise. Nada que
// entregue a decisão do jogador (quem montar / quem é o melhor da rodada).
// NOTA (fase de testes): não prometemos prémios — o foco é a vantagem de
// informação e a competição. Prémios/experiências ficam para quando o jogo
// estiver validado.
const VANTAGENS: { t: string; x: string }[] = [
  { t: "Scout avançado", x: "Estatísticas baseadas no histórico real de cada atleta: títulos, forma recente e como pontua em cada nível de competição." },
  { t: "Análise do teu time", x: "Uma leitura honesta da tua escalação: o que parece sólido, onde há risco e porquê. Sem te dizer o que fazer — a decisão é sempre tua." },
  { t: "Dica de capitão", x: "Entre os atletas que tu escolheste, qual tem o histórico mais forte para esta competição. Continuas a montar o teu time à tua maneira." },
  { t: "Maior possibilidade de valorização", x: "Pela análise do histórico, vê quais dos teus atletas têm mais hipótese de valorizar e render JC. É uma tendência, não uma garantia." },
  { t: "Chaveamento das competições", x: "Vê o quadro de lutas de cada competição e acompanha o caminho dos teus atletas na chave." },
  { t: "Acompanhamento ao vivo", x: "No dia da competição, acompanha as pontuações dos teus atletas em tempo real." },
  { t: "Até 5 ligas ativas", x: "Cria até 5 ligas em simultâneo, entre mata-mata e pontos corridos." },
  { t: "Design exclusivo Pro", x: "Um visual próprio e distinto, só para membros Ippon Pro." },
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
          <h2 style={{ fontFamily: FD, fontSize: 22, fontWeight: 700, textTransform: "uppercase", margin: "4px 0 8px", lineHeight: 1.1, color: GOLD }}>Pro e Pro Max</h2>
          <p style={{ fontSize: 14, color: "#dfe6e0", lineHeight: 1.6, margin: 0 }}>Dois níveis de vantagem para jogares com mais informação. O <strong style={{ color: GOLD }}>Pro</strong> dá-te as ferramentas de scout e análise; o <strong style={{ color: MAX }}>Pro Max</strong> acrescenta a competição ao vivo e mais. A estratégia é sempre tua.</p>
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
        {/* O QUE O PRO MAX ACRESCENTA — secção própria, tom azul (MAX) */}
        <SectionTitle>O Pro Max acrescenta</SectionTitle>
        <p style={{ fontSize: 12.5, color: "#93a39a", margin: "0 0 12px", lineHeight: 1.55 }}>
          O Pro Max inclui <strong style={{ color: "#cfd8d2" }}>tudo o que o Pro tem</strong> — e ainda:
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 22 }}>
          {MAX_EXTRA.map((v) => (
            <div key={v.t} style={{ display: "flex", gap: 11, background: "#121815", border: `1px solid #24364a`, borderRadius: 14, padding: "13px 14px" }}>
              <div style={{ width: 26, height: 26, borderRadius: "50%", background: "rgba(127,184,245,0.14)", color: MAX, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, flexShrink: 0 }}>✓</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{v.t}</div>
                <div style={{ fontSize: 12.5, color: "#93a39a", marginTop: 2, lineHeight: 1.5 }}>{v.x}</div>
              </div>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 11.5, color: "#7c8a82", lineHeight: 1.55, margin: "0 2px 22px" }}>
          Os Clássicos (competições do passado) não têm chave ao vivo nem análise, por já terem acontecido.
        </p>
        {/* O que o Pro NÃO faz — protege o jogo e a confiança */}
        <SectionTitle>O que o Pro não faz</SectionTitle>
        <div style={{ background: "#0f1411", border: "1px solid #243029", borderRadius: 16, padding: 16, marginBottom: 22 }}>
          <p style={{ fontSize: 13, color: "#c7d0c9", lineHeight: 1.6, margin: 0 }}>
            O Pro <strong style={{ color: "#cfd8d2" }}>não monta o teu time por ti</strong> e <strong style={{ color: "#cfd8d2" }}>não te diz quem vai ganhar a competição</strong>. Não entregamos &quot;os melhores da rodada&quot; nem em quem apostar — isso tiraria a graça do jogo. Damos-te informação e leituras do histórico; o mérito de acertar é sempre teu.
          </p>
        </div>
        {/* Assinatura */}
        <SectionTitle>A assinatura</SectionTitle>
        <div style={{ background: "#121815", border: "1px solid #243029", borderRadius: 16, padding: 16, marginBottom: 22 }}>
          <LinhaInfo titulo="7 dias grátis" texto="Experimenta o Pro durante 7 dias. Se cancelares dentro desse período, não pagas nada." />
          <LinhaInfo titulo="Plano mensal" texto="A subscrição é mensal e renova-se automaticamente todos os meses, até cancelares. Se cancelares, ficas com acesso até ao fim do mês já pago." />
          <LinhaInfo titulo="Cancelar quando quiseres" texto="Ao cancelar, manténs o acesso até ao fim do período já pago — só não há nova renovação." ultimo />
        </div>
        {/* Transparência — o mais importante */}
        <SectionTitle>Transparência total</SectionTitle>
        <div style={{ background: "#0f1411", border: `1px solid ${GOLD}`, borderRadius: 16, padding: "16px 16px 18px", marginBottom: 22 }}>
          <div style={{ display: "flex", gap: 11, alignItems: "flex-start", marginBottom: 10 }}>
            <div style={{ width: 40, height: 40, flexShrink: 0 }}><Mascot belt="#141110" expression="indicando" /></div>
            <p style={{ fontSize: 13.5, color: "#dfe6e0", lineHeight: 1.6, margin: 0 }}>Queremos ser muito claros contigo sobre o que o Pro é — e o que não é.</p>
          </div>
          <p style={{ fontSize: 13, color: "#c7d0c9", lineHeight: 1.6, margin: "0 0 10px" }}>O Ippon Pro oferece <strong>apenas informação</strong>, baseada em dados e no histórico dos atletas: os seus resultados nas últimas competições e como costumam pontuar em cada nível. Mostramos tendências e possibilidades — por exemplo, quem tem mais hipótese de valorizar.</p>
          <p style={{ fontSize: 13, color: "#c7d0c9", lineHeight: 1.6, margin: 0 }}>Ao assinar, reconheces que o Pro é <strong style={{ color: GOLD }}>meramente informativo e não garante qualquer resultado</strong>. Nunca prometemos certezas nem te dizemos em quem apostar. A decisão e a estratégia são sempre tuas.</p>
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
