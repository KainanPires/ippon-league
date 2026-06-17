"use client";

import { useEffect, useState } from "react";
import { Mascot } from "@/components/Mascot";
import { temSessao } from "@/lib/auth";

const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";
const APP_URL = "https://www.ipponleague.com/inicio";

export default function Sobre() {
  const [logado, setLogado] = useState(false);
  const [podePartilhar, setPodePartilhar] = useState(false);

  useEffect(() => {
    temSessao().then(setLogado).catch(() => setLogado(false));
    try {
      const nav = navigator as Navigator & { share?: unknown };
      setPodePartilhar(typeof nav.share === "function");
    } catch { setPodePartilhar(false); }
  }, []);

  async function partilhar() {
    const texto = "A Ippon League — o jogo oficial dos fãs de judô. Vem fazer parte.";
    try {
      const nav = navigator as Navigator & { share?: (d: { title?: string; text?: string; url?: string }) => Promise<void> };
      if (nav.share) {
        await nav.share({ title: "Ippon League", text: texto, url: APP_URL });
        return;
      }
    } catch { /* cancelado */ }
    try {
      await navigator.clipboard.writeText(`${texto} ${APP_URL}`);
      alert("Link copiado!");
    } catch { /* ignora */ }
  }

  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: FB }}>
      <div style={{ maxWidth: 460, margin: "0 auto", padding: "14px 16px 48px" }}>
        {/* Cabeçalho */}
        <header style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 16 }}>
          <a href={logado ? "/perfil" : "/"} aria-label="Voltar" style={{ width: 34, height: 34, borderRadius: "50%", border: "1px solid #243029", display: "flex", alignItems: "center", justifyContent: "center", color: "#cfd8d2", textDecoration: "none", flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
          </a>
          <h1 style={{ fontFamily: FD, fontSize: 19, fontWeight: 700, textTransform: "uppercase", margin: 0 }}>Sobre</h1>
          {podePartilhar && (
            <button onClick={partilhar} aria-label="Partilhar" style={{ marginLeft: "auto", width: 34, height: 34, borderRadius: "50%", border: `1px solid ${GOLD}`, background: "transparent", color: GOLD, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" /></svg>
            </button>
          )}
        </header>

        {/* Hero */}
        <section style={{ textAlign: "center", background: "linear-gradient(160deg,#1c3a2e,#10160f)", border: `1px solid ${GOLD}`, borderRadius: 18, padding: "26px 20px", marginBottom: 18 }}>
          <div style={{ width: 96, height: 96, margin: "0 auto 8px" }}><Mascot belt="#141110" expression="feliz" /></div>
          <h2 style={{ fontFamily: FD, fontSize: 24, fontWeight: 700, textTransform: "uppercase", margin: "4px 0 10px", lineHeight: 1.1 }}>O judô é mais do que uma luta</h2>
          <p style={{ fontSize: 15, color: "#dfe6e0", lineHeight: 1.6, margin: 0 }}>É tradição, é arte, é emoção. E também pode ser o teu jogo.</p>
        </section>

        {/* Corpo — narrativa emocional */}
        <Bloco>
          O judô é uma das artes marciais mais belas do mundo. Mas é mais do que treino e competição: é entretenimento, é paixão, é uma forma de aproximar pessoas. A cada Grand Slam, a cada Mundial, milhões de fãs vibram com cada ippon — mesmo sem nunca pisarem aquele tatame.
        </Bloco>

        <Bloco>
          Reparámos numa coisa simples: existem <strong style={{ color: GOLD }}>muitos fãs de judô</strong> que amam o desporto, acompanham cada competição, conhecem os atletas — mas que não conseguem viver o alto nível por dentro. Por questões técnicas, físicas, de tempo ou de vida. E não devia ser preciso ser atleta de elite para fazer parte da emoção.
        </Bloco>

        <Bloco>
          Foi por isso que criámos a <strong style={{ color: GOLD }}>Ippon League</strong>. Uma plataforma onde o fã deixa de ser só espectador e passa a <strong>jogar junto</strong>. Onde montas a tua equipa, escolhes o teu capitão, disputas com fãs do mundo inteiro e sentes cada competição como se estivesses lá dentro.
        </Bloco>

        {/* Destaque central — a frase-alma */}
        <section style={{ background: "#121815", border: `1px solid ${GOLD}`, borderRadius: 16, padding: "22px 18px", textAlign: "center", margin: "4px 0 14px" }}>
          <div style={{ width: 56, height: 56, margin: "0 auto 10px" }}><Mascot belt={GOLD} expression="comemorando" /></div>
          <p style={{ fontFamily: FD, fontSize: 18, fontWeight: 700, lineHeight: 1.35, margin: 0, color: "#f1ede2" }}>
            Aqui, exaltamos quem joga — não só quem compete.
          </p>
          <p style={{ fontSize: 13.5, color: "#a9b4ac", lineHeight: 1.55, margin: "10px 0 0" }}>
            O palco também é teu. A tua estratégia, a tua faixa, as tuas conquistas — tudo conta.
          </p>
        </section>

        <Bloco>
          E a nossa promessa não acaba aqui. Vamos trabalhar todos os dias para te manter <strong style={{ color: GOLD }}>sempre perto do alto nível</strong> — perto das competições, perto dos atletas, perto da emoção. E perto de ti: a ouvir-te, a observar o que precisas, a fazer crescer este sonho contigo.
        </Bloco>

        {/* Convite final */}
        <section style={{ background: "#121815", border: `2px solid ${GOLD}`, borderRadius: 18, padding: "22px 18px", textAlign: "center" }}>
          <div style={{ width: 64, height: 64, margin: "0 auto 6px" }}><Mascot belt="#141110" expression="determinado" /></div>
          <h2 style={{ fontFamily: FD, fontSize: 18, fontWeight: 700, textTransform: "uppercase", margin: "0 0 6px" }}>Faz parte deste sonho</h2>
          <p style={{ fontSize: 13.5, color: "#c7d0c9", lineHeight: 1.55, margin: "0 0 14px" }}>A Ippon League é dos fãs, para os fãs. Vem viver o judô de uma forma que nunca viveste.</p>
          <a href={logado ? "/meu-time" : "/entrar"} style={{ display: "block", padding: 14, borderRadius: 12, background: GOLD, color: "#1b211e", fontFamily: FD, fontSize: 15, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", textDecoration: "none" }}>
            {logado ? "Ir para o meu time" : "Começar agora"}
          </a>
          <div style={{ fontSize: 11, color: "#5f6f67", marginTop: 12 }}>O jogo oficial dos fãs de judô</div>
        </section>
      </div>
    </main>
  );
}

function Bloco({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 14.5, color: "#c7d0c9", lineHeight: 1.7, margin: "0 0 18px", padding: "0 2px" }}>{children}</p>
  );
}
