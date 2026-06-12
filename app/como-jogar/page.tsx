"use client";

import { useEffect, useState } from "react";
import { Mascot } from "@/components/Mascot";
import { PRECO } from "@/lib/precos";
import { temSessao } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";
const APP_URL = "https://ippon-league.vercel.app";

const FAIXAS: { nome: string; cor: string }[] = [
  { nome: "Branca", cor: "#d7dcd6" },
  { nome: "Azul", cor: "#3f86d6" },
  { nome: "Amarela", cor: "#e6b422" },
  { nome: "Verde", cor: "#3f9f5a" },
  { nome: "Roxa", cor: "#9b6cc9" },
  { nome: "Castanha", cor: "#a06a3a" },
  { nome: "Preta", cor: GOLD },
];

const PONTOS: { acao: string; aplica: string; sofre: string }[] = [
  { acao: "Ippon", aplica: "+10", sofre: "−5" },
  { acao: "Waza-ari", aplica: "+4", sofre: "−2" },
  { acao: "Yuko", aplica: "+2", sofre: "−1" },
  { acao: "Shido", aplica: "+1 *", sofre: "−2 **" },
  { acao: "Hansoku-make direto", aplica: "—", sofre: "−10" },
];

export default function ComoJogar() {
  const [logado, setLogado] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const [podePartilhar, setPodePartilhar] = useState(false);

  useEffect(() => {
    temSessao().then(setLogado).catch(() => setLogado(false));
    // Lê o estado Pro: quem já é Pro NÃO vê ofertas de Pro.
    supabase.auth.getSession().then(({ data }) => {
      const m = data.session?.user?.user_metadata || {};
      setIsPro(Boolean(m.is_pro));
    }).catch(() => setIsPro(false));
    try {
      const nav = navigator as Navigator & { share?: unknown };
      setPodePartilhar(typeof nav.share === "function");
    } catch { setPodePartilhar(false); }
  }, []);

  async function partilhar() {
    const texto = "Aprende a jogar a Ippon League — o jogo oficial dos fãs de judô. Monta a tua equipa e dispute com fãs do mundo inteiro!";
    try {
      const nav = navigator as Navigator & { share?: (d: { title?: string; text?: string; url?: string }) => Promise<void> };
      if (nav.share) {
        await nav.share({ title: "Como se joga a Ippon League", text: texto, url: APP_URL });
        return;
      }
    } catch { /* cancelado */ }
    try {
      await navigator.clipboard.writeText(`${texto} ${APP_URL}`);
      alert("Link copiado! Partilha com quem ainda não joga.");
    } catch { /* ignora */ }
  }

  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: FB }}>
      <div style={{ maxWidth: 460, margin: "0 auto", padding: "14px 16px 48px" }}>
        <header style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 16 }}>
          <a href={logado ? "/perfil" : "/"} aria-label="Voltar" style={{ width: 34, height: 34, borderRadius: "50%", border: "1px solid #243029", display: "flex", alignItems: "center", justifyContent: "center", color: "#cfd8d2", textDecoration: "none", flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
          </a>
          <h1 style={{ fontFamily: FD, fontSize: 19, fontWeight: 700, textTransform: "uppercase", margin: 0 }}>Como se joga</h1>
          {podePartilhar && (
            <button onClick={partilhar} aria-label="Partilhar guia" style={{ marginLeft: "auto", width: 34, height: 34, borderRadius: "50%", border: `1px solid ${GOLD}`, background: "transparent", color: GOLD, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" /></svg>
            </button>
          )}
        </header>

        <section style={{ textAlign: "center", background: "linear-gradient(160deg,#1c3a2e,#10160f)", border: `1px solid ${GOLD}`, borderRadius: 18, padding: "22px 18px", marginBottom: 16 }}>
          <div style={{ width: 92, height: 92, margin: "0 auto 6px" }}><Mascot belt="#141110" expression="feliz" /></div>
          <div style={{ fontSize: 11, color: "#93a39a", textTransform: "uppercase", letterSpacing: "0.1em" }}>Guia do jogo</div>
          <h2 style={{ fontFamily: FD, fontSize: 22, fontWeight: 700, textTransform: "uppercase", margin: "4px 0 8px", lineHeight: 1.1 }}>Como se joga a Ippon League</h2>
          <p style={{ fontSize: 14, color: "#c7d0c9", lineHeight: 1.55, margin: 0 }}>Olá, sou o Dôdo! Em poucos minutos ficas a saber tudo. Lê ao teu ritmo.</p>
        </section>

        <Secao expr="indicando" titulo="1. Monta a tua equipa">
          Começas com <strong style={{ color: GOLD }}>100 Judocoins (JC)</strong>. Escolhe 8 atletas — 4 masculinos e 4 femininos — e nomeia 1 capitão. Equilibra estrelas caras com apostas baratas para caberes no orçamento.
        </Secao>

        <section style={cardStyle}>
          <Cabecalho expr="determinado" titulo="2. Como pontuas" />
          <p style={pStyle}>Pontuas pelas <strong>ações reais</strong> dos teus atletas nas lutas — não por medalhas. Aplicar uma ação dá pontos; sofrê-la tira.</p>

          <div style={{ display: "flex", gap: 10, margin: "14px 0" }}>
            <div style={{ flex: 1, background: "rgba(127,209,163,0.10)", border: "1px solid #1f5e44", borderRadius: 12, padding: "12px 8px", textAlign: "center" }}>
              <div style={{ width: 56, height: 56, margin: "0 auto 4px" }}><Mascot belt={GOLD} expression="comemorando" /></div>
              <div style={{ fontSize: 11, color: "#7fd1a3", fontWeight: 700 }}>aplica ippon</div>
              <div style={{ fontFamily: FD, fontSize: 20, fontWeight: 700, color: "#7fd1a3" }}>+10</div>
            </div>
            <div style={{ flex: 1, background: "rgba(239,141,131,0.10)", border: "1px solid #5a2f2c", borderRadius: 12, padding: "12px 8px", textAlign: "center" }}>
              <div style={{ width: 56, height: 56, margin: "0 auto 4px" }}><Mascot belt="#5a2f2c" expression="determinado" /></div>
              <div style={{ fontSize: 11, color: "#ef8d83", fontWeight: 700 }}>sofre ippon</div>
              <div style={{ fontFamily: FD, fontSize: 20, fontWeight: 700, color: "#ef8d83" }}>−5</div>
            </div>
          </div>

          <div style={{ fontSize: 11, color: "#7c8a82", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Tabela de pontuação</div>
          <table style={{ width: "100%", fontSize: 13.5, borderCollapse: "collapse" }}>
            <tbody>
              <tr style={{ borderBottom: "1px solid #2a3a33" }}>
                <td style={{ padding: "7px 0", color: "#93a39a" }}>Ação</td>
                <td style={{ padding: "7px 0", textAlign: "center", color: "#7fd1a3" }}>Aplica</td>
                <td style={{ padding: "7px 0", textAlign: "center", color: "#ef8d83" }}>Sofre</td>
              </tr>
              {PONTOS.map((p) => (
                <tr key={p.acao} style={{ borderBottom: "1px solid #1a221d" }}>
                  <td style={{ padding: "7px 0" }}>{p.acao}</td>
                  <td style={{ padding: "7px 0", textAlign: "center", color: p.aplica === "—" ? "#5f6f67" : "#7fd1a3", fontFamily: FD }}>{p.aplica}</td>
                  <td style={{ padding: "7px 0", textAlign: "center", color: p.sofre === "—" ? "#5f6f67" : "#ef8d83", fontFamily: FD }}>{p.sofre}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ background: "#0f1411", border: "1px solid #243029", borderRadius: 12, padding: "12px 14px", marginTop: 14 }}>
            <div style={{ fontSize: 12.5, color: "#7fd1a3", fontWeight: 700, marginBottom: 3 }}>* Shido a teu favor (acumula)</div>
            <p style={{ fontSize: 12.5, color: "#a9b4ac", lineHeight: 1.55, margin: "0 0 10px" }}>Ganhas +1 por cada shido que o adversário leva. Ao 3.º, ele perde por hansoku-make e o valor <strong style={{ color: "#f1ede2" }}>dobra</strong>: +1, +2 → <strong style={{ color: "#7fd1a3" }}>+6</strong> no total.</p>
            <div style={{ fontSize: 12.5, color: "#ef8d83", fontWeight: 700, marginBottom: 3 }}>** Shido contra ti (custo crescente)</div>
            <p style={{ fontSize: 12.5, color: "#a9b4ac", lineHeight: 1.55, margin: 0 }}>Cada shido custa mais: 1.º <strong style={{ color: "#f1ede2" }}>−2</strong>, 2.º <strong style={{ color: "#f1ede2" }}>−3</strong>, 3.º <strong style={{ color: "#f1ede2" }}>−4</strong>. Se levares 3, perdes por hansoku-make: total <strong style={{ color: "#ef8d83" }}>−9</strong>.</p>
          </div>
        </section>

        <Secao expr="determinado" titulo="3. O capitão pontua a dobrar" destaque>
          Tudo o que o teu capitão fizer conta a <strong style={{ color: GOLD }}>dobrar</strong>. Um ippon do capitão vale +20! Escolhe o atleta que achas que vai brilhar.
        </Secao>

        <section style={cardStyle}>
          <Cabecalho expr="sabio" titulo="4. As faixas e a tua evolução" />
          <p style={pStyle}>Começas na <strong>branca</strong>. A tua faixa reflete o teu desempenho face aos outros jogadores e muda o visual do jogo. Há 7 faixas:</p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, margin: "14px 0" }}>
            {FAIXAS.map((f) => (
              <div key={f.nome} style={{ textAlign: "center" }}>
                <div style={{ width: 48, height: 48, margin: "0 auto" }}><Mascot belt={f.cor} expression="feliz" /></div>
                <div style={{ height: 5, background: f.cor, borderRadius: 3, margin: "3px 8px" }} />
                <div style={{ fontSize: 10, color: "#93a39a" }}>{f.nome}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1, background: "rgba(127,209,163,0.08)", border: "1px solid #1f5e44", borderRadius: 12, padding: 12 }}>
              <div style={{ fontSize: 12.5, color: "#7fd1a3", fontWeight: 700, marginBottom: 4 }}>↑ Como subir</div>
              <p style={{ fontSize: 12, color: "#a9b4ac", lineHeight: 1.5, margin: 0 }}>Pontua bem nas rodadas. Quanto melhor fores face aos outros jogadores no mês, mais alta a tua faixa.</p>
            </div>
            <div style={{ flex: 1, background: "rgba(239,141,131,0.08)", border: "1px solid #5a2f2c", borderRadius: 12, padding: 12 }}>
              <div style={{ fontSize: 12.5, color: "#ef8d83", fontWeight: 700, marginBottom: 4 }}>↓ Como descer</div>
              <p style={{ fontSize: 12, color: "#a9b4ac", lineHeight: 1.5, margin: 0 }}>Rodadas fracas fazem-te cair. A faixa acompanha o teu desempenho mês a mês — nada fica garantido.</p>
            </div>
          </div>
        </section>

        <Secao expr="indicando" titulo="5. Património e mercado">
          Os atletas valorizam ou desvalorizam conforme rendem. Compra barato quem está prestes a brilhar e vê o teu <strong style={{ color: GOLD }}>património</strong> crescer rodada após rodada.
        </Secao>

        <Secao expr="determinado" titulo="6. As competições são as rodadas">
          Cada Grand Slam, Mundial ou Continental é uma rodada jogável. Escala a tua equipa antes de o mercado fechar e acompanha os pontos a entrar ao vivo.
        </Secao>

        <Secao expr="feliz" titulo="7. Ligas e mata-mata">
          Disputa ligas mundial, nacional e de amigos. E na <strong>Copa Ippon</strong> (mata-mata), cada rodada é uma eliminatória — basta uma boa escalação para avançar.
        </Secao>

        {!isPro && (
          <section style={{ background: "linear-gradient(160deg,#2a2410,#15110a)", border: `1px solid ${GOLD}`, borderRadius: 18, padding: "20px 18px", textAlign: "center", marginBottom: 14 }}>
            <div style={{ width: 64, height: 64, margin: "0 auto 6px" }}><Mascot belt="#141110" expression="sabio" /></div>
            <div style={{ fontFamily: FD, fontSize: 18, fontWeight: 700, textTransform: "uppercase", color: GOLD }}>Joga com vantagem: Ippon Pro</div>
            <p style={{ fontSize: 13, color: "#c7d0c9", lineHeight: 1.55, margin: "6px 0 4px" }}>Scout avançado, valorização esperada, dicas e capitães da rodada.</p>
            <p style={{ fontSize: 13, color: GOLD, fontWeight: 700, margin: "0 0 14px" }}>{PRECO.premios}.</p>
            <a href="/ippon-pro" style={{ display: "block", padding: 13, borderRadius: 12, background: GOLD, color: "#1b211e", fontFamily: FD, fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", textDecoration: "none" }}>
              Conhecer o Ippon Pro
            </a>
          </section>
        )}

        <section style={{ background: "#121815", border: `2px solid ${GOLD}`, borderRadius: 18, padding: "22px 18px", textAlign: "center" }}>
          <div style={{ width: 72, height: 72, margin: "0 auto 6px" }}><Mascot belt="#141110" expression="comemorando" /></div>
          <h2 style={{ fontFamily: FD, fontSize: 18, fontWeight: 700, textTransform: "uppercase", margin: "0 0 6px" }}>Pronto para entrar no tatame?</h2>
          <p style={{ fontSize: 13.5, color: "#c7d0c9", lineHeight: 1.55, margin: "0 0 14px" }}>Cria a tua conta, monta a tua equipa e dispute com fãs de judô do mundo inteiro.</p>
          <a href={logado ? "/meu-time" : "/entrar"} style={{ display: "block", padding: 14, borderRadius: 12, background: GOLD, color: "#1b211e", fontFamily: FD, fontSize: 15, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", textDecoration: "none" }}>
            {logado ? "Ir para o meu time" : "Criar a minha conta grátis"}
          </a>
          {podePartilhar && (
            <button onClick={partilhar} style={{ marginTop: 10, background: "transparent", border: "none", color: GOLD, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: FB }}>
              Partilhar este guia
            </button>
          )}
          <div style={{ fontSize: 11, color: "#5f6f67", marginTop: 10 }}>ippon-league.vercel.app</div>
        </section>
      </div>
    </main>
  );
}

const cardStyle: React.CSSProperties = {
  background: "#121815", border: "1px solid #243029", borderRadius: 16, padding: 18, marginBottom: 14,
};
const pStyle: React.CSSProperties = {
  fontSize: 14, color: "#c7d0c9", lineHeight: 1.6, margin: 0,
};

function Cabecalho({ expr, titulo }: { expr: string; titulo: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
      <div style={{ width: 44, height: 44, flexShrink: 0 }}><Mascot belt="#141110" expression={expr as never} /></div>
      <div style={{ fontFamily: FD, fontSize: 16, fontWeight: 700, textTransform: "uppercase" }}>{titulo}</div>
    </div>
  );
}

function Secao({ expr, titulo, children, destaque }: { expr: string; titulo: string; children: React.ReactNode; destaque?: boolean }) {
  return (
    <section style={{ ...cardStyle, border: destaque ? `1px solid ${GOLD}` : "1px solid #243029" }}>
      <Cabecalho expr={expr} titulo={titulo} />
      <p style={pStyle}>{children}</p>
    </section>
  );
}
