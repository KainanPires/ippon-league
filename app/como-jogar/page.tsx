"use client";

import { useState } from "react";
import { Mascot } from "@/components/Mascot";

const FONT_DISPLAY = "var(--font-geist-mono), system-ui, sans-serif";
const FONT_BODY = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";

const STEPS = [
  { title: "Olá, sou o teu sensei!", text: "Em poucos passos ensino-te tudo o que precisas. Avança quando quiseres." },
  { title: "Monta a tua equipa", text: "Começas com 100 Judocoins (JC). Escolhe 8 atletas e nomeia 1 capitão — o capitão pontua a dobrar." },
  { title: "Ganha pontos nas lutas", text: "Os teus atletas pontuam pelas ações reais: ippon +10, waza-ari +4, shido a favor +1. Sofrer pontos ou shidos tira." },
  { title: "Faz o teu património crescer", text: "Se um atleta rende acima do esperado, valoriza e ganhas JC. Compra barato, escala bem e vê o património subir." },
  { title: "As competições são as rodadas", text: "Cada Grand Slam, Mundial ou Continental é uma rodada. Escala a equipa antes de o mercado fechar." },
  { title: "Ao vivo e em ligas", text: "Acompanha a pontuação a entrar ao vivo e compete em ligas mundial, nacional, de amigos — e no mata-mata Copa Ippon." },
  { title: "Sobe de faixa", text: "O teu desempenho mensal sobe (ou desce) a tua faixa — e muda o visual do jogo. Começas na branca." },
];

const PRO_BENEFITS = [
  "Scout avançado dos atletas",
  "Valorização esperada e mínimo para valorizar",
  "Dicas e capitães recomendados da rodada",
  "Barganhas da rodada",
  "Ligas e badges exclusivos",
];

export default function ComoJogar() {
  const total = STEPS.length + 1; // +1 = cartão do Pro
  const [step, setStep] = useState(0);
  const isPro = step >= STEPS.length;

  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: FONT_BODY, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px" }}>
      <div style={{ width: "100%", maxWidth: 460 }}>
        {/* Progresso */}
        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          {Array.from({ length: total }).map((_, i) => (
            <div key={i} style={{ flex: 1, height: 4, borderRadius: 999, background: i <= step ? GOLD : "#243029" }} />
          ))}
        </div>

        {!isPro ? (
          <div style={{ background: "#121815", border: "1px solid #243029", borderRadius: 18, padding: 22 }}>
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
              <div style={{ width: 76, height: 76, flexShrink: 0 }}>
                <Mascot belt="#efeadd" expression="feliz" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>
                  {STEPS[step].title}
                </div>
                <p style={{ fontSize: 14, color: "#c7d0c9", lineHeight: 1.55, margin: 0 }}>{STEPS[step].text}</p>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 22 }}>
              <button
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                disabled={step === 0}
                style={{ background: "transparent", border: "none", color: step === 0 ? "#3c463f" : "#93a39a", fontSize: 14, fontWeight: 700, cursor: step === 0 ? "default" : "pointer", fontFamily: FONT_BODY }}
              >
                Anterior
              </button>
              <span style={{ fontSize: 12, color: "#5f6f67" }}>{step + 1} de {total}</span>
              <button
                onClick={() => setStep((s) => s + 1)}
                style={{ background: GOLD, border: "none", color: "#1b211e", padding: "10px 20px", borderRadius: 10, fontFamily: FONT_DISPLAY, fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", cursor: "pointer" }}
              >
                Seguinte
              </button>
            </div>
          </div>
        ) : (
          <div style={{ background: "#121815", border: `1px solid ${GOLD}`, borderRadius: 18, padding: 24, textAlign: "center" }}>
            <div style={{ width: 84, height: 84, margin: "0 auto 4px" }}>
              <Mascot belt="#141110" expression="feliz" />
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: GOLD }}>Oferta de lançamento</div>
            <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 24, fontWeight: 700, textTransform: "uppercase", margin: "6px 0 4px" }}>Joga com vantagem: Ippon Pro</h2>

            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 10, margin: "10px 0 16px" }}>
              <span style={{ fontSize: 16, color: "#7c8a82", textDecoration: "line-through" }}>9,90€</span>
              <span style={{ fontFamily: FONT_DISPLAY, fontSize: 34, fontWeight: 700, color: GOLD }}>4,90€</span>
              <span style={{ fontSize: 13, color: "#93a39a" }}>/mês</span>
            </div>

            <div style={{ textAlign: "left", display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
              {PRO_BENEFITS.map((b) => (
                <div key={b} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span style={{ color: GOLD, fontWeight: 700 }}>✓</span>
                  <span style={{ fontSize: 14, color: "#c7d0c9" }}>{b}</span>
                </div>
              ))}
            </div>

            <a href="/meu-time" style={{ display: "block", padding: "13px", borderRadius: 12, background: GOLD, color: "#1b211e", fontFamily: FONT_DISPLAY, fontSize: 15, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", textDecoration: "none" }}>
              Quero o Ippon Pro
            </a>
            <a href="/meu-time" style={{ display: "inline-block", marginTop: 12, fontSize: 13, color: "#93a39a", textDecoration: "none" }}>
              Talvez depois — ir para o meu time
            </a>
          </div>
        )}
      </div>
    </main>
  );
}
