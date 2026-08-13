"use client";

// Componente de instalação da app (PWA) no telemóvel.
// Exporta:
//  - CartaoInstalarApp: cartão promocional para o dashboard. Só aparece a quem
//    ainda não instalou; some quando a pessoa abre a app em modo instalado
//    (fica marcado no user_metadata.app_instalado).
//  - LinhaInstalarApp: entrada permanente (ex.: no perfil), sempre disponível.
//  - TutorialInstalar: o modal com o passo a passo, que deteta iPhone/Android.

import { useState, useEffect, Fragment } from "react";
import { useT } from "@/lib/i18n";

const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";

const URL_APP = "https://www.ipponleague.com";

type Plataforma = "ios" | "android" | "outro";

function detetarPlataforma(): Plataforma {
  if (typeof navigator === "undefined") return "outro";
  const ua = navigator.userAgent || "";
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  // iPad moderno apresenta-se como Mac com toque.
  if (/Macintosh/i.test(ua) && (navigator as unknown as { maxTouchPoints?: number }).maxTouchPoints && (navigator as unknown as { maxTouchPoints: number }).maxTouchPoints > 1) return "ios";
  if (/android/i.test(ua)) return "android";
  return "outro";
}

function estaInstalada(): boolean {
  if (typeof window === "undefined") return false;
  const mm = window.matchMedia && window.matchMedia("(display-mode: standalone)").matches;
  const iosStandalone = (navigator as unknown as { standalone?: boolean }).standalone === true;
  return Boolean(mm || iosStandalone);
}

// ---------- Passos do tutorial ----------
type Fills = Record<string, React.ReactNode>;
type PassoSpec = { key: string; fills: Fills };

// Preenche os marcadores (%A%, %B%, …) de uma frase traduzida com os nós dados.
function montarPasso(texto: string, fills: Fills): React.ReactNode[] {
  return texto.split(/(%[A-Z]%)/).map((s, i) => {
    const m = /^%([A-Z])%$/.exec(s);
    if (m && fills[m[1]] !== undefined) return <Fragment key={i}>{fills[m[1]]}</Fragment>;
    return s;
  });
}

function passosPara(plat: Plataforma, t: ReturnType<typeof useT>): { tituloK: string; passos: PassoSpec[] } {
  const url = URL_APP.replace("https://", "");
  if (plat === "android") {
    return {
      tituloK: "inst.tituloAndroid",
      passos: [
        { key: "inst.and1", fills: { A: <strong>Chrome</strong>, B: <strong style={{ color: "#e6c97a" }}>{url}</strong>, C: <strong>{t("inst.naoPesquises")}</strong> } },
        { key: "inst.and2", fills: { A: <strong>⋮</strong> } },
        { key: "inst.and3", fills: { A: <strong>{t("inst.adicionarPagInicial")}</strong> } },
        { key: "inst.and4", fills: {} },
      ],
    };
  }
  // iOS (e por defeito também serve de guia no desktop)
  return {
    tituloK: "inst.tituloIphone",
    passos: [
      { key: "inst.ios1", fills: { A: <strong>Safari</strong>, B: <strong style={{ color: "#e6c97a" }}>{url}</strong>, C: <strong>{t("inst.naoPesquises")}</strong> } },
      { key: "inst.ios2", fills: { A: <strong>{t("inst.partilharBtn")}</strong> } },
      { key: "inst.ios3", fills: { A: <strong>{t("inst.adicionarEcra")}</strong> } },
      { key: "inst.ios4", fills: { A: <strong>{t("inst.adicionar")}</strong> } },
    ],
  };
}

export function TutorialInstalar({ aberto, onClose }: { aberto: boolean; onClose: () => void }) {
  const t = useT();
  const [plat, setPlat] = useState<Plataforma>("ios");
  useEffect(() => { setPlat(detetarPlataforma()); }, []);
  if (!aberto) return null;

  const desktop = plat === "outro";
  const { tituloK, passos } = passosPara(plat === "android" ? "android" : "ios", t);
  const url = URL_APP.replace("https://", "");

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(6,8,7,0.82)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18, zIndex: 200 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 360, background: "#121815", border: `1px solid ${GOLD}`, borderRadius: 18, padding: "22px 18px", maxHeight: "88vh", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <span style={{ fontFamily: FD, fontSize: 16, fontWeight: 700, textTransform: "uppercase", color: "#f1ede2" }}>{desktop ? t("inst.tituloTelemovel") : t(tituloK)}</span>
          <button onClick={onClose} aria-label={t("comum.fechar")} style={{ background: "transparent", border: "none", color: "#93a39a", fontSize: 18, cursor: "pointer", fontFamily: FB, lineHeight: 1 }}>✕</button>
        </div>

        {desktop && (
          <p style={{ fontSize: 12.5, color: "#93a39a", lineHeight: 1.5, margin: "0 0 14px" }}>
            {montarPasso(t("inst.desktopIntro"), { A: <strong style={{ color: "#e6c97a" }}>{url}</strong> })}
          </p>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
          {passos.map((p, i) => (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <span style={{ background: GOLD, color: "#1b211e", fontWeight: 700, fontSize: 12, width: 20, height: 20, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</span>
              <span style={{ fontSize: 12.5, color: "#c7d0c9", lineHeight: 1.5 }}>{montarPasso(t(p.key), p.fills)}</span>
            </div>
          ))}
        </div>

        {desktop && (
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid #243029" }}>
            <div style={{ fontFamily: FD, fontSize: 13, fontWeight: 700, textTransform: "uppercase", color: "#f1ede2", marginBottom: 9 }}>{t("inst.noAndroid")}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
              {passosPara("android", t).passos.map((p, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span style={{ background: "#2a3a33", color: "#cfd8d2", fontWeight: 700, fontSize: 12, width: 20, height: 20, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</span>
                  <span style={{ fontSize: 12.5, color: "#c7d0c9", lineHeight: 1.5 }}>{montarPasso(t(p.key), p.fills)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <button onClick={onClose} style={{ width: "100%", marginTop: 18, background: GOLD, color: "#1b211e", border: "none", fontFamily: FD, fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", padding: "12px", borderRadius: 12, cursor: "pointer" }}>{t("inst.percebi")}</button>
      </div>
    </div>
  );
}

function IconeDownload({ cor = GOLD }: { cor?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={cor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v12" /><path d="M7 10l5 5 5-5" /><path d="M5 21h14" />
    </svg>
  );
}

// Cartão promocional para o dashboard. Só aparece a quem ainda não instalou.
export function CartaoInstalarApp() {
  const t = useT();
  const [mostrar, setMostrar] = useState(false);
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    let vivo = true;
    const instalada = estaInstalada();
    // Importação dinâmica do supabase para o componente ser autossuficiente.
    import("@/lib/supabase").then(async ({ supabase }) => {
      if (!vivo) return;
      const { data } = await supabase.auth.getSession();
      if (!vivo) return;
      const u = data.session?.user;
      const jaInstalou = Boolean(u?.user_metadata?.app_instalado);
      if (instalada) {
        setMostrar(false);
        // Está a abrir em modo app -> regista na conta que instalou.
        if (u && !jaInstalou) {
          try { await supabase.auth.updateUser({ data: { app_instalado: true } }); } catch {}
        }
        return;
      }
      setMostrar(!jaInstalou);
    }).catch(() => { if (vivo) setMostrar(true); });
    return () => { vivo = false; };
  }, []);

  if (!mostrar) return null;

  return (
    <>
      <button onClick={() => setAberto(true)} style={{ display: "flex", alignItems: "center", gap: 13, width: "100%", textAlign: "left", background: "#121815", border: `1px solid ${GOLD}`, borderRadius: 14, padding: 14, marginBottom: 14, cursor: "pointer", fontFamily: FB, color: "#f1ede2" }}>
        <span style={{ width: 42, height: 42, borderRadius: 11, background: "#1c2a20", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <IconeDownload />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontFamily: FD, fontSize: 14, fontWeight: 700, textTransform: "uppercase" }}>{t("inst.jogaComoApp")}</span>
          <span style={{ display: "block", fontSize: 11.5, color: "#93a39a", marginTop: 2 }}>{t("inst.poeNoEcra")}</span>
        </span>
        <span style={{ background: GOLD, color: "#1b211e", fontFamily: FD, fontSize: 11, fontWeight: 700, textTransform: "uppercase", padding: "7px 12px", borderRadius: 9, flexShrink: 0 }}>{t("inst.verComo")}</span>
      </button>
      <TutorialInstalar aberto={aberto} onClose={() => setAberto(false)} />
    </>
  );
}

// Linha permanente (ex.: no perfil). Sempre disponível, mesmo a quem já instalou.
export function LinhaInstalarApp() {
  const t = useT();
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <button onClick={() => setAberto(true)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "14px 16px", background: "transparent", border: "none", color: "#f1ede2", fontFamily: FB, fontSize: 14, cursor: "pointer" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <IconeDownload cor="#93a39a" />
          <span>{t("inst.instalarNoTelemovel")}</span>
        </span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5f6f67" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6" /></svg>
      </button>
      <TutorialInstalar aberto={aberto} onClose={() => setAberto(false)} />
    </>
  );
}
