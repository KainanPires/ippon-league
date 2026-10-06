"use client";

// components/ConsentimentoAnalytics.tsx
//
// Banner de consentimento (RGPD/ePrivacy) para o analytics. Aparece só se ainda
// não houver escolha guardada. Aceitar liga o PostHog; recusar mantém-no
// desligado. A escolha fica no aparelho (localStorage).
//
// Textos nas 5 línguas AQUI (não no i18n.ts gigante), como o resto do conteúdo
// legal — segue o seletor de idioma da app.

import { useEffect, useState } from "react";
import { useLingua, type Lingua } from "@/lib/i18n";
import { consentimentoGuardado, concederConsentimento, negarConsentimento } from "@/lib/analytics";

const GOLD = "#d9a441";
const FB = "var(--font-geist-sans), system-ui, sans-serif";

const TXT: Record<Lingua, { texto: string; aceitar: string; recusar: string; politica: string }> = {
  pt: {
    texto: "Usamos análise de utilização para perceber como o jogo é usado e melhorá-lo. Nunca guardamos o teu nome, email ou dados pessoais para isto.",
    aceitar: "Aceitar", recusar: "Recusar", politica: "Política de Privacidade",
  },
  en: {
    texto: "We use product analytics to understand how the game is used and improve it. We never store your name, email or personal data for this.",
    aceitar: "Accept", recusar: "Decline", politica: "Privacy Policy",
  },
  es: {
    texto: "Usamos analítica de uso para entender cómo se usa el juego y mejorarlo. Nunca guardamos tu nombre, email ni datos personales para esto.",
    aceitar: "Aceptar", recusar: "Rechazar", politica: "Política de Privacidad",
  },
  fr: {
    texto: "Nous utilisons des statistiques d'usage pour comprendre comment le jeu est utilisé et l'améliorer. Nous ne stockons jamais ton nom, e-mail ou données personnelles pour cela.",
    aceitar: "Accepter", recusar: "Refuser", politica: "Politique de confidentialité",
  },
  de: {
    texto: "Wir nutzen Produktanalyse, um zu verstehen, wie das Spiel genutzt wird, und es zu verbessern. Deinen Namen, deine E-Mail oder personenbezogene Daten speichern wir dafür nie.",
    aceitar: "Akzeptieren", recusar: "Ablehnen", politica: "Datenschutzerklärung",
  },
};

export function ConsentimentoAnalytics() {
  const { lingua } = useLingua();
  const [mostrar, setMostrar] = useState(false);
  useEffect(() => { setMostrar(consentimentoGuardado() === null); }, []);
  if (!mostrar) return null;
  const t = TXT[lingua] ?? TXT.pt;

  function decidir(sim: boolean) {
    if (sim) concederConsentimento(); else negarConsentimento();
    setMostrar(false);
  }

  return (
    <div
      role="dialog"
      aria-live="polite"
      style={{
        position: "fixed", left: 12, right: 12, bottom: 12, zIndex: 9999,
        maxWidth: 560, margin: "0 auto", background: "#121815",
        border: "1px solid #243029", borderRadius: 14, padding: "14px 16px",
        boxShadow: "0 12px 30px rgba(0,0,0,0.5)", fontFamily: FB, color: "#d6ddd6",
      }}
    >
      <p style={{ fontSize: 13, lineHeight: 1.55, margin: "0 0 12px" }}>
        {t.texto}{" "}
        <a href="/privacidade" style={{ color: GOLD, textDecoration: "none", fontWeight: 700 }}>{t.politica}</a>
      </p>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button
          onClick={() => decidir(false)}
          style={{ background: "transparent", border: "1px solid #2a3a33", color: "#93a39a", fontSize: 13, fontWeight: 700, padding: "9px 16px", borderRadius: 10, cursor: "pointer", fontFamily: FB }}
        >
          {t.recusar}
        </button>
        <button
          onClick={() => decidir(true)}
          style={{ background: GOLD, border: "none", color: "#1b211e", fontSize: 13, fontWeight: 700, padding: "9px 18px", borderRadius: 10, cursor: "pointer", fontFamily: FB }}
        >
          {t.aceitar}
        </button>
      </div>
    </div>
  );
}
