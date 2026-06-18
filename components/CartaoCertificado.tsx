"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Escudo, type Identity } from "@/components/Escudo";
import { Mascot } from "@/components/Mascot";

const GOLD = "#d9a441";

// Posição no pódio. Cada uma tem a sua medalha, cor e título.
export type PosicaoPodio = "campeao" | "vice" | "terceiro";

interface TemaPosicao {
  medalha: string; titulo: string; cor: string; corText: string; glow: string; selo: string;
}
const TEMAS: Record<PosicaoPodio, TemaPosicao> = {
  campeao:  { medalha: "🥇", titulo: "Campeão",       cor: GOLD,      corText: "#1f1804", glow: "rgba(217,164,65,0.55)",  selo: "1º LUGAR" },
  vice:     { medalha: "🥈", titulo: "Vice-campeão",  cor: "#c8ccd2", corText: "#14181a", glow: "rgba(200,204,210,0.40)", selo: "2º LUGAR" },
  terceiro: { medalha: "🥉", titulo: "3º lugar",      cor: "#c87f43", corText: "#1c0f06", glow: "rgba(200,127,67,0.42)",  selo: "3º LUGAR" },
};

const CARD_CSS = `
.ccard{position:relative;width:1080px;height:1350px;border-radius:34px;overflow:hidden;font-family:'Arial Narrow','Helvetica Neue',Arial,sans-serif;color:#f1ede2;isolation:isolate;-webkit-font-smoothing:antialiased}
.ccard-bg{position:absolute;inset:0;background:linear-gradient(180deg,#161a14 0%,#10130f 50%,#0b0d0a 100%);z-index:0}
.ccard-glow{position:absolute;top:-120px;left:0;right:0;height:760px;z-index:0;background:radial-gradient(60% 70% at 50% 20%,color-mix(in srgb,var(--cor) 30%,transparent) 0%,transparent 64%);pointer-events:none}
.ccard-inner{position:relative;z-index:2;height:100%;padding:74px 64px 60px;display:flex;flex-direction:column;align-items:center;text-align:center;box-sizing:border-box}
.ccard-selo{font-weight:700;font-size:30px;letter-spacing:9px;text-transform:uppercase;color:var(--cor)}
.ccard-medalha{font-size:200px;line-height:1.05;margin:4px 0 0;filter:drop-shadow(0 0 60px var(--glow))}
.ccard-titulo{font-weight:900;font-size:96px;line-height:1;letter-spacing:-1px;text-transform:uppercase;color:var(--cor);text-shadow:0 0 70px var(--glow);margin:6px 0 0}
.ccard-titulo.rodada{font-size:72px;line-height:1.05;letter-spacing:0;overflow-wrap:break-word;max-width:100%}
.ccard-sep{width:120px;height:4px;background:var(--cor);border-radius:2px;margin:40px 0 36px;opacity:0.7}
.ccard-crest{width:200px;height:230px;display:grid;place-items:center;filter:drop-shadow(0 10px 22px rgba(0,0,0,0.5))}
.ccard-team{font-weight:700;font-size:62px;line-height:1.04;letter-spacing:0.3px;text-transform:uppercase;color:#f1ede2;margin:22px 0 0;max-width:100%;overflow-wrap:break-word}
.ccard-copa{font-weight:500;font-size:34px;line-height:1.3;letter-spacing:0.5px;color:#aab4ac;margin:18px 0 0;max-width:100%}
.ccard-part{margin-top:42px;padding:16px 38px;border:2px solid var(--cor);border-radius:999px;font-weight:700;font-size:34px;letter-spacing:1px;color:var(--cor)}
.ccard-foot{margin-top:auto;display:flex;flex-direction:column;align-items:center;gap:6px}
.ccard-foot-main{font-weight:700;font-size:44px;letter-spacing:8px;text-transform:uppercase;color:#d9a441}
.ccard-foot-sub{font-weight:300;font-size:25px;letter-spacing:1px;color:#93a39a}
.ccard-dodo{position:absolute;right:50px;bottom:150px;width:150px;height:150px;z-index:3}
`;

let _h2iPromise: Promise<unknown> | null = null;
function loadHtmlToImage(): Promise<unknown> {
  const w = window as unknown as { htmlToImage?: unknown };
  if (w.htmlToImage) return Promise.resolve(w.htmlToImage);
  if (_h2iPromise) return _h2iPromise;
  _h2iPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/html-to-image/1.11.13/html-to-image.min.js";
    s.crossOrigin = "anonymous";
    s.onload = () => resolve((window as unknown as { htmlToImage?: unknown }).htmlToImage);
    s.onerror = () => reject(new Error("CDN html-to-image falhou"));
    document.head.appendChild(s);
  });
  return _h2iPromise;
}

export function CartaoCertificado({
  posicao,
  identity,
  nomeCopa,
  nParticipantes,
  variante = "anual",
  tituloRodada,
  onClose,
}: {
  posicao: PosicaoPodio;
  identity: Identity;
  nomeCopa: string;
  nParticipantes: number;
  variante?: "anual" | "rodada";
  tituloRodada?: string;
  onClose: () => void;
}) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(0.3);
  const [busy, setBusy] = useState(false);
  const [podePartilhar, setPodePartilhar] = useState(false);

  const t = TEMAS[posicao];

  useEffect(() => {
    loadHtmlToImage().catch(() => {});
    try {
      const nav = navigator as Navigator & { share?: unknown };
      setPodePartilhar(typeof nav.share === "function");
    } catch { setPodePartilhar(false); }
    function medir() {
      const w = previewRef.current?.clientWidth || 324;
      setScale(w / 1080);
    }
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, []);

  async function gerarBlob(): Promise<Blob | null> {
    const node = cardRef.current;
    if (!node) return null;
    try {
      const h2i = await loadHtmlToImage() as { toBlob: (n: HTMLElement, o: Record<string, unknown>) => Promise<Blob> };
      await new Promise((r) => setTimeout(r, 80));
      return await h2i.toBlob(node, { width: 1080, height: 1350, pixelRatio: 1, cacheBust: true, backgroundColor: "#0b0d0a" });
    } catch { return null; }
  }

  function baixarBlob(blob: Blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "ippon-certificado.png";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  async function partilhar() {
    setBusy(true);
    const blob = await gerarBlob();
    setBusy(false);
    if (!blob) return;
    const file = new File([blob], "ippon-certificado.png", { type: "image/png" });
    const link = "https://www.ipponleague.com/inicio";
    const texto = variante === "rodada"
      ? `Melhor da Rodada — ${tituloRodada} em ${nomeCopa} na Ippon League, entre ${nParticipantes} ${nParticipantes === 1 ? "participante" : "participantes"}! Joga também: ${link}`
      : `${t.titulo} da ${nomeCopa} na Ippon League — entre ${nParticipantes} participantes! Joga também: ${link}`;
    const nav = navigator as Navigator & { canShare?: (d: { files?: File[] }) => boolean; share?: (d: unknown) => Promise<void> };
    try {
      if (nav.canShare && nav.canShare({ files: [file] }) && nav.share) {
        await nav.share({ files: [file], title: "Ippon League", text: texto });
        return;
      }
    } catch { /* cancelado */ }
    baixarBlob(blob);
  }

  async function guardar() {
    setBusy(true);
    const blob = await gerarBlob();
    setBusy(false);
    if (blob) baixarBlob(blob);
  }

  const cardVars = {
    ["--cor" as string]: t.cor,
    ["--glow" as string]: t.glow,
  } as CSSProperties;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(6,8,7,0.88)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18, zIndex: 130, overflowY: "auto" }}>
      <style>{CARD_CSS}</style>
      <div style={{ width: "100%", maxWidth: 360, background: "#121815", border: `1px solid ${GOLD}`, borderRadius: 16, padding: 18, textAlign: "center" }}>
        <h2 style={{ fontFamily: "var(--font-geist-mono), sans-serif", fontSize: 18, fontWeight: 700, textTransform: "uppercase", margin: "0 0 12px", color: GOLD }}>O teu título</h2>

        <div ref={previewRef} style={{ width: "100%", aspectRatio: "1080 / 1350", borderRadius: 12, overflow: "hidden", marginBottom: 14, position: "relative", background: "#0b0d0a" }}>
          <div style={{ position: "absolute", top: 0, left: 0, width: 1080, height: 1350, transform: `scale(${scale})`, transformOrigin: "top left" }}>
            <CertificadoNode innerRef={cardRef} vars={cardVars} tema={t} identity={identity} nomeCopa={nomeCopa} nParticipantes={nParticipantes} variante={variante} tituloRodada={tituloRodada} />
          </div>
        </div>

        {podePartilhar && (
          <button onClick={partilhar} disabled={busy} style={{ width: "100%", padding: 13, borderRadius: 12, border: "none", background: GOLD, color: "#1b211e", fontFamily: "var(--font-geist-mono), sans-serif", fontSize: 15, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", cursor: busy ? "default" : "pointer", opacity: busy ? 0.7 : 1, marginBottom: 10 }}>{busy ? "A gerar…" : "Partilhar"}</button>
        )}
        <button onClick={guardar} disabled={busy} style={{ width: "100%", padding: 13, borderRadius: 12, border: `1px solid ${GOLD}`, background: "transparent", color: GOLD, fontFamily: "var(--font-geist-mono), sans-serif", fontSize: 15, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", cursor: busy ? "default" : "pointer", opacity: busy ? 0.7 : 1 }}>{busy ? "A gerar…" : "Guardar imagem"}</button>
        <button onClick={onClose} style={{ marginTop: 10, background: "transparent", border: "none", color: "#93a39a", fontSize: 13, cursor: "pointer" }}>Fechar</button>
      </div>
    </div>
  );
}

function CertificadoNode({ innerRef, vars, tema, identity, nomeCopa, nParticipantes, variante, tituloRodada }: {
  innerRef: { current: HTMLDivElement | null };
  vars: CSSProperties;
  tema: TemaPosicao;
  identity: Identity;
  nomeCopa: string;
  nParticipantes: number;
  variante: "anual" | "rodada";
  tituloRodada?: string;
}) {
  const ehRodada = variante === "rodada";
  const selo = ehRodada ? "MELHOR DA RODADA" : tema.selo;
  const titulo = ehRodada ? (tituloRodada || "Melhor da Rodada") : tema.titulo;
  return (
    <div ref={innerRef} className="ccard" style={vars}>
      <div className="ccard-bg" />
      <div className="ccard-glow" />
      <div className="ccard-inner">
        <div className="ccard-selo">{selo}</div>
        <div className="ccard-medalha">{tema.medalha}</div>
        <div className={ehRodada ? "ccard-titulo rodada" : "ccard-titulo"}>{titulo}</div>
        <div className="ccard-sep" />
        <div className="ccard-crest"><Escudo config={identity} size={200} /></div>
        <div className="ccard-team">{identity.name}</div>
        <div className="ccard-copa">{nomeCopa}</div>
        <div className="ccard-part">entre {nParticipantes} {nParticipantes === 1 ? "participante" : "participantes"}</div>
        <div className="ccard-foot">
          <div className="ccard-foot-main">IPPON&nbsp;LEAGUE</div>
          <div className="ccard-foot-sub">O jogo oficial dos fãs de judô</div>
        </div>
      </div>
      <div className="ccard-dodo"><Mascot belt={tema.cor} expression="comemorando" /></div>
    </div>
  );
}
