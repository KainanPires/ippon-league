"use client";

// components/SeletorLinguaInicial.tsx
//
// A PRIMEIRA COISA que qualquer pessoa vê ao chegar: um ecrã que obriga a
// escolher o idioma, antes de montar equipa ou fazer seja o que for. Vale para
// quem entra direto por um link (não só no registo).
//
// QUANDO APARECE: só quando AINDA NÃO HÁ escolha de idioma.
//   • se já houver idioma guardado no aparelho (localStorage `ippon_lingua`),
//     nunca aparece;
//   • se a pessoa tiver sessão e já tiver idioma na conta, também não aparece
//     (o LinguaProvider aplica-o) — por isso esperamos a verificação da conta
//     antes de decidir mostrar, para não piscar a quem já escolheu noutro
//     aparelho.
//
// Depois de escolher, `mudar()` grava no aparelho + conta + servidor, por isso
// não volta a aparecer. É de propósito NÃO ter "pular": a escolha é uma só e
// o idioma detetado já vem pré-selecionado, a um toque.
//
// Os textos do próprio ecrã saem no idioma DETETADO do browser, para já fazer
// sentido antes da escolha. As bandeiras podem não aparecer no Windows, por
// isso cada botão mostra SEMPRE o nome escrito da língua ao lado.

import { useEffect, useState } from "react";
import {
  LINGUAS,
  useLingua,
  linguaGuardadaLocal,
  linguaDoBrowser,
  type Lingua,
} from "@/lib/i18n";
import { supabase } from "@/lib/supabase";

const GOLD = "#d9a441";
const FB = "var(--font-geist-sans), system-ui, sans-serif";

const TXT: Record<Lingua, { titulo: string; sub: string; detetado: string }> = {
  pt: { titulo: "Escolhe o teu idioma", sub: "Toca na tua língua para jogar a Ippon League.", detetado: "detetado" },
  en: { titulo: "Choose your language", sub: "Tap your language to play Ippon League.", detetado: "detected" },
  es: { titulo: "Elige tu idioma", sub: "Toca tu idioma para jugar a Ippon League.", detetado: "detectado" },
  fr: { titulo: "Choisis ta langue", sub: "Touche ta langue pour jouer à Ippon League.", detetado: "détectée" },
  de: { titulo: "Wähle deine Sprache", sub: "Tippe deine Sprache an, um Ippon League zu spielen.", detetado: "erkannt" },
  ja: { titulo: "言語を選んでください", sub: "言語をタップして Ippon League をプレイ。", detetado: "自動検出" },
  ru: { titulo: "Выбери язык", sub: "Нажми на свой язык, чтобы играть в Ippon League.", detetado: "определён" },
};

export function SeletorLinguaInicial() {
  const { mudar } = useLingua();
  const [mostrar, setMostrar] = useState(false);
  // Idioma detetado do browser: pré-selecionado e usado nos textos deste ecrã.
  const [detetado, setDetetado] = useState<Lingua>("pt");

  useEffect(() => {
    // Já escolheu neste aparelho → nunca mostra.
    if (linguaGuardadaLocal()) return;

    const browser = linguaDoBrowser();
    setDetetado(browser);

    let vivo = true;
    (async () => {
      // Quem tem sessão e já definiu idioma na conta não deve ver isto: o
      // LinguaProvider vai aplicá-lo. Esperamos essa verificação antes de
      // mostrar, para não piscar o ecrã a quem já escolheu noutro aparelho.
      try {
        const { data } = await supabase.auth.getSession();
        const meta = data.session?.user?.user_metadata as { lingua?: string } | undefined;
        const l = meta?.lingua;
        if (l && LINGUAS.some((x) => x.id === l)) return;
      } catch {
        /* sem ligação: segue e mostra na mesma — é melhor perguntar */
      }
      if (!vivo) return;
      // O provider pode ter gravado entretanto.
      if (linguaGuardadaLocal()) return;
      setMostrar(true);
    })();

    return () => { vivo = false; };
  }, []);

  if (!mostrar) return null;

  const tx = TXT[detetado] ?? TXT.pt;

  function escolher(l: Lingua) {
    mudar(l); // grava no aparelho + conta + servidor
    setMostrar(false);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={tx.titulo}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        background: "rgba(7,9,8,0.92)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        fontFamily: FB,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: "#121815",
          border: "1px solid #243029",
          borderRadius: 18,
          padding: "22px 18px 18px",
          boxShadow: "0 24px 60px rgba(0,0,0,0.6)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 6 }}>
          <span style={{ fontSize: 26 }} aria-hidden>🥋</span>
        </div>
        <h2
          style={{
            margin: "0 0 4px",
            textAlign: "center",
            fontSize: 20,
            fontWeight: 800,
            color: "#f2f5f1",
            lineHeight: 1.2,
          }}
        >
          {tx.titulo}
        </h2>
        <p
          style={{
            margin: "0 0 16px",
            textAlign: "center",
            fontSize: 13,
            lineHeight: 1.5,
            color: "#93a39a",
          }}
        >
          {tx.sub}
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {LINGUAS.map((l) => {
            const sugerida = l.id === detetado;
            return (
              <button
                key={l.id}
                onClick={() => escolher(l.id)}
                aria-label={l.nome}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  textAlign: "left",
                  background: sugerida ? "#1b2420" : "transparent",
                  border: `1px solid ${sugerida ? GOLD : "#2a3a33"}`,
                  borderRadius: 12,
                  padding: "11px 12px",
                  cursor: "pointer",
                  fontFamily: FB,
                }}
              >
                <span style={{ fontSize: 20, lineHeight: 1 }} aria-hidden>{l.bandeira}</span>
                <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: "#e7ede7",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {l.nome}
                  </span>
                  {sugerida ? (
                    <span style={{ fontSize: 10, fontWeight: 700, color: GOLD, textTransform: "uppercase", letterSpacing: 0.4 }}>
                      {tx.detetado}
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
