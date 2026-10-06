"use client";

// components/InstalarApp.tsx
//
// "QUERES A IPPON NO TEU TELEMÓVEL?" — sugestão de instalar o PWA (adicionar ao
// ecrã principal). NÃO é obrigatório e NÃO atrapalha: é uma pergunta simples.
//   • Pergunta → "Sim, como faço?" / "Agora não".
//   • Sim: no Android/Chrome dispara o instalador nativo se existir; senão (e no
//     iPhone) mostra o passo a passo certo para a plataforma.
//   • Não: esconde e não volta a chatear (lembra no localStorage).
//
// Não aparece se já estiver instalada (display-mode: standalone). Multilíngue.
//
// Uso: <InstalarApp />  (onde fizer sentido — ex.: depois do registo, na /evento).

import { useEffect, useState } from "react";
import { useLingua } from "@/lib/i18n";

const GOLD = "#d9a441";
const CARD = "#121815";
const BORDA = "#243029";
const TXT = "#f1ede2";
const DIM = "#93a39a";
const FONT_DISPLAY = "var(--font-geist-mono), system-ui, sans-serif";
const CHAVE_LS = "ippon_instalar_dispensado";

interface PromptInstalar extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type Passos = { titulo: string; passos: string[] };
type Txt = {
  pergunta: string; sim: string; nao: string; instalarJa: string;
  ios: Passos; android: Passos; desktop: Passos; feito: string;
};
const L: Record<string, Txt> = {
  pt: {
    pergunta: "Queres ficar por dentro das principais competições internacionais e ter a chave sempre à mão? Instala a Ippon no teu telemóvel.",
    sim: "Sim, como faço?", nao: "Agora não", instalarJa: "Instalar app",
    ios: { titulo: "No iPhone/iPad (Safari):", passos: ["Toca em Partilhar (o quadrado com a seta ↑)", "Escolhe «Adicionar ao ecrã principal»", "Confirma em «Adicionar»"] },
    android: { titulo: "No Android (Chrome):", passos: ["Abre o menu ⋮ (canto superior direito)", "Escolhe «Instalar app» ou «Adicionar ao ecrã principal»", "Confirma"] },
    desktop: { titulo: "No computador (Chrome/Edge):", passos: ["Clica no ícone de instalar na barra de endereço (⊕)", "Confirma «Instalar»"] },
    feito: "Pronto! A Ippon fica no teu ecrã como uma app.",
  },
  en: {
    pergunta: "Want to stay on top of the biggest international competitions and keep every bracket at your fingertips? Install Ippon on your phone.",
    sim: "Yes, how?", nao: "Not now", instalarJa: "Install app",
    ios: { titulo: "On iPhone/iPad (Safari):", passos: ["Tap Share (the square with an ↑ arrow)", "Choose “Add to Home Screen”", "Confirm with “Add”"] },
    android: { titulo: "On Android (Chrome):", passos: ["Open the ⋮ menu (top right)", "Choose “Install app” or “Add to Home screen”", "Confirm"] },
    desktop: { titulo: "On desktop (Chrome/Edge):", passos: ["Click the install icon in the address bar (⊕)", "Confirm “Install”"] },
    feito: "Done! Ippon now sits on your home screen like an app.",
  },
  es: {
    pergunta: "¿Quieres estar al día de las principales competiciones internacionales y tener el cuadro siempre a mano? Instala Ippon en tu móvil.",
    sim: "Sí, ¿cómo?", nao: "Ahora no", instalarJa: "Instalar app",
    ios: { titulo: "En iPhone/iPad (Safari):", passos: ["Toca Compartir (el cuadrado con la flecha ↑)", "Elige «Añadir a pantalla de inicio»", "Confirma en «Añadir»"] },
    android: { titulo: "En Android (Chrome):", passos: ["Abre el menú ⋮ (arriba a la derecha)", "Elige «Instalar app» o «Añadir a pantalla de inicio»", "Confirma"] },
    desktop: { titulo: "En el ordenador (Chrome/Edge):", passos: ["Haz clic en el icono de instalar en la barra de direcciones (⊕)", "Confirma «Instalar»"] },
    feito: "¡Listo! Ippon queda en tu pantalla como una app.",
  },
  fr: {
    pergunta: "Tu veux suivre les grandes compétitions internationales et avoir le tableau toujours à portée de main ? Installe Ippon sur ton téléphone.",
    sim: "Oui, comment ?", nao: "Plus tard", instalarJa: "Installer l'app",
    ios: { titulo: "Sur iPhone/iPad (Safari) :", passos: ["Touche Partager (le carré avec une flèche ↑)", "Choisis « Sur l'écran d'accueil »", "Confirme avec « Ajouter »"] },
    android: { titulo: "Sur Android (Chrome) :", passos: ["Ouvre le menu ⋮ (en haut à droite)", "Choisis « Installer l'application » ou « Ajouter à l'écran d'accueil »", "Confirme"] },
    desktop: { titulo: "Sur ordinateur (Chrome/Edge) :", passos: ["Clique sur l'icône d'installation dans la barre d'adresse (⊕)", "Confirme « Installer »"] },
    feito: "C'est fait ! Ippon est sur ton écran comme une app.",
  },
  de: {
    pergunta: "Willst du bei den großen internationalen Wettkämpfen am Ball bleiben und den Turnierbaum immer griffbereit haben? Installiere Ippon auf deinem Handy.",
    sim: "Ja, wie?", nao: "Später", instalarJa: "App installieren",
    ios: { titulo: "Auf iPhone/iPad (Safari):", passos: ["Tippe auf Teilen (das Quadrat mit Pfeil ↑)", "Wähle „Zum Home-Bildschirm“", "Bestätige mit „Hinzufügen“"] },
    android: { titulo: "Auf Android (Chrome):", passos: ["Öffne das Menü ⋮ (oben rechts)", "Wähle „App installieren“ oder „Zum Startbildschirm“", "Bestätige"] },
    desktop: { titulo: "Am Computer (Chrome/Edge):", passos: ["Klicke auf das Installieren-Symbol in der Adressleiste (⊕)", "Bestätige „Installieren“"] },
    feito: "Fertig! Ippon liegt jetzt wie eine App auf deinem Startbildschirm.",
  },
};

function plataforma(): "ios" | "android" | "desktop" {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent || "";
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

export function InstalarApp() {
  const { lingua } = useLingua();
  const tl = L[lingua] ?? L.pt;
  const [fase, setFase] = useState<"pergunta" | "passos" | "escondido">("escondido");
  const [deferred, setDeferred] = useState<PromptInstalar | null>(null);

  useEffect(() => {
    // Já instalada? Não mostra.
    const standalone =
      (typeof window !== "undefined" && window.matchMedia?.("(display-mode: standalone)").matches) ||
      // iOS Safari
      (typeof navigator !== "undefined" && (navigator as unknown as { standalone?: boolean }).standalone === true);
    if (standalone) return;
    // Já dispensou antes? Não volta a chatear.
    try { if (localStorage.getItem(CHAVE_LS) === "1") return; } catch { /* sem localStorage */ }
    setFase("pergunta");

    // Android/Chrome oferece o instalador nativo por este evento.
    const onBIP = (e: Event) => { e.preventDefault(); setDeferred(e as PromptInstalar); };
    window.addEventListener("beforeinstallprompt", onBIP);
    return () => window.removeEventListener("beforeinstallprompt", onBIP);
  }, []);

  function dispensar() {
    try { localStorage.setItem(CHAVE_LS, "1"); } catch { /* idem */ }
    setFase("escondido");
  }

  async function sim() {
    // Se o navegador oferece o instalador nativo, usa-o direto.
    if (deferred) {
      try {
        await deferred.prompt();
        await deferred.userChoice;
      } catch { /* segue para os passos manuais */ }
      setDeferred(null);
      dispensar();
      return;
    }
    // Senão, mostra o passo a passo da plataforma.
    setFase("passos");
  }

  if (fase === "escondido") return null;

  const p = plataforma();
  const guia = p === "ios" ? tl.ios : p === "android" ? tl.android : tl.desktop;

  return (
    <div style={{ background: CARD, border: `1px solid ${BORDA}`, borderRadius: 14, padding: 16, marginTop: 16 }}>
      {fase === "pergunta" ? (
        <>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 12 }}>
            <span style={{ fontSize: 22, lineHeight: 1 }}>📲</span>
            <p style={{ margin: 0, fontSize: 13.5, color: TXT, lineHeight: 1.5 }}>{tl.pergunta}</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={sim} style={{ flex: 1, background: GOLD, color: "#1b211e", border: "none", borderRadius: 10, padding: "11px 14px", fontFamily: FONT_DISPLAY, fontSize: 13.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", cursor: "pointer" }}>
              {deferred ? tl.instalarJa : tl.sim}
            </button>
            <button onClick={dispensar} style={{ background: "transparent", color: DIM, border: `1px solid ${BORDA}`, borderRadius: 10, padding: "11px 14px", fontSize: 13, cursor: "pointer" }}>
              {tl.nao}
            </button>
          </div>
        </>
      ) : (
        <>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 13, fontWeight: 700, color: GOLD, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>{guia.titulo}</div>
          <ol style={{ margin: "0 0 12px", paddingLeft: 20, color: TXT, fontSize: 13.5, lineHeight: 1.7 }}>
            {guia.passos.map((s, i) => <li key={i}>{s}</li>)}
          </ol>
          <p style={{ margin: "0 0 12px", fontSize: 12.5, color: DIM }}>{tl.feito}</p>
          <button onClick={dispensar} style={{ width: "100%", background: "transparent", color: DIM, border: `1px solid ${BORDA}`, borderRadius: 10, padding: "10px 14px", fontSize: 13, cursor: "pointer" }}>
            {tl.nao}
          </button>
        </>
      )}
    </div>
  );
}
