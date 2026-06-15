"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Escudo, type Identity } from "@/components/Escudo";
import { Mascot } from "@/components/Mascot";
import type { DesempenhoRodada } from "@/lib/desempenho";

const GOLD = "#d9a441";

const IOC: Record<string, string> = {
  JP: "JPN", FR: "FRA", BR: "BRA", GE: "GEO", KZ: "KAZ", AZ: "AZE", BE: "BEL",
  TR: "TUR", UZ: "UZB", RU: "AIN", DE: "GER", XK: "KOS", IT: "ITA", CA: "CAN",
  SI: "SLO", HR: "CRO", NL: "NED",
};
const code3 = (iso: string) => IOC[iso] || iso;
const sobrenome = (nome: string) => (nome.split(" ").slice(-1)[0] || nome).toUpperCase();
const sinal = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

type Belt = "branca" | "azul" | "amarela" | "verde" | "roxa" | "castanha" | "preta";
interface BeltTheme {
  name: string; accent: string; chipText: string; frame: number; frameColor: string; double: boolean; glow: number; glowColor: string;
}
const BELTS: Record<Belt, BeltTheme> = {
  branca:   { name: "FAIXA BRANCA",   accent: "#d7dcd6", chipText: "#14181a", frame: 3, frameColor: "#5a635e", double: false, glow: 0,  glowColor: "transparent" },
  azul:     { name: "FAIXA AZUL",     accent: "#3f86d6", chipText: "#0a1622", frame: 4, frameColor: "#3f86d6", double: false, glow: 34, glowColor: "rgba(63,134,214,0.30)" },
  amarela:  { name: "FAIXA AMARELA",  accent: "#e6b422", chipText: "#1f1804", frame: 4, frameColor: "#e6b422", double: false, glow: 44, glowColor: "rgba(230,180,34,0.32)" },
  verde:    { name: "FAIXA VERDE",    accent: "#3f9f5a", chipText: "#08160d", frame: 5, frameColor: "#3f9f5a", double: false, glow: 48, glowColor: "rgba(63,159,90,0.34)" },
  roxa:     { name: "FAIXA ROXA",     accent: "#9b6cc9", chipText: "#f1ede2", frame: 5, frameColor: "#9b6cc9", double: false, glow: 64, glowColor: "rgba(155,108,201,0.46)" },
  castanha: { name: "FAIXA CASTANHA", accent: "#a06a3a", chipText: "#f1ede2", frame: 6, frameColor: "#a06a3a", double: true,  glow: 64, glowColor: "rgba(160,106,58,0.46)" },
  preta:    { name: "FAIXA PRETA",    accent: GOLD,      chipText: "#1f1804", frame: 9, frameColor: GOLD,      double: true,  glow: 96, glowColor: "rgba(217,164,65,0.62)" },
};
function beltKey(faixa: string): Belt {
  const k = (faixa || "").trim().toLowerCase();
  return (["branca","azul","amarela","verde","roxa","castanha","preta"].includes(k) ? k : "branca") as Belt;
}

function frameShadow(b: BeltTheme, pro: boolean): string {
  const w = pro ? 10 : b.frame;
  const fc = pro ? GOLD : b.frameColor;
  const dbl = pro || b.double;
  const parts: string[] = [];
  parts.push(`inset 0 0 0 ${w}px ${fc}`);
  if (dbl) {
    parts.push(`inset 0 0 0 ${w + 6}px rgba(11,13,12,0.95)`);
    parts.push(`inset 0 0 0 ${w + 8}px ${pro ? "rgba(217,164,65,0.85)" : "rgba(217,164,65,0.45)"}`);
  }
  const glow = pro ? "0 0 120px rgba(217,164,65,0.55)" : b.glow ? `0 0 ${b.glow}px ${b.glowColor}` : null;
  if (glow) parts.push(glow);
  parts.push("0 44px 100px rgba(0,0,0,0.55)");
  return parts.join(", ");
}

// CSS do cartão de DESEMPENHO. Mesmo "esqueleto" e linguagem visual do
// CartaoEquipa (molduras, fontes, brilho Pro), mas o herói é a PONTUAÇÃO da
// rodada — não a lista de atletas.
const CARD_CSS = `
.dcard{position:relative;width:1080px;height:1350px;border-radius:34px;overflow:hidden;font-family:'Arial Narrow','Helvetica Neue',Arial,sans-serif;color:#f1ede2;isolation:isolate;-webkit-font-smoothing:antialiased}
.dcard-bg{position:absolute;inset:0;background:linear-gradient(180deg,#141a17 0%,#10130f 48%,#0c0e0d 100%);z-index:0}
.dcard-headglow{position:absolute;top:-120px;left:0;right:0;height:680px;z-index:0;background:radial-gradient(58% 70% at 50% 22%,color-mix(in srgb,var(--glow-accent) 30%,transparent) 0%,transparent 66%),radial-gradient(80% 60% at 80% 6%,color-mix(in srgb,#d9a441 10%,transparent) 0%,transparent 70%);pointer-events:none}
.dcard-inner{position:relative;z-index:2;height:100%;padding:64px 60px 56px;display:flex;flex-direction:column;box-sizing:border-box}
.pro-badge{align-self:center;margin-top:-14px;margin-bottom:26px;padding:13px 40px;border-radius:999px;background:linear-gradient(180deg,#f1c969 0%,#d9a441 55%,#b9842c 100%);color:#20160a;font-weight:700;font-size:31px;letter-spacing:5px;text-transform:uppercase;border:1.5px solid #f4d489;box-shadow:0 0 44px rgba(217,164,65,0.6),inset 0 1px 0 rgba(255,255,255,0.5)}
.dcard-head{display:flex;align-items:center;gap:20px;padding-bottom:28px;margin-bottom:6px;border-bottom:1.5px solid rgba(241,237,226,0.10)}
.dcrest{flex-shrink:0;width:96px;height:110px;display:grid;place-items:center;filter:drop-shadow(0 8px 18px rgba(0,0,0,0.45))}
.dhead-text{min-width:0;flex:1;display:flex;flex-direction:column;align-items:flex-start}
.dteam-name{margin:0;font-weight:700;font-size:44px;line-height:1.04;letter-spacing:0.3px;text-transform:uppercase;color:#f1ede2;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;max-width:100%;overflow-wrap:break-word}
.dbelt-pill{display:inline-block;margin-top:14px;padding:9px 26px;border-radius:9px;background:var(--accent);color:var(--chip-text);font-weight:600;font-size:26px;letter-spacing:1.5px;text-transform:uppercase;white-space:nowrap}
.dhero{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:0}
.dhero-label{font-weight:500;font-size:34px;letter-spacing:6px;text-transform:uppercase;color:#93a39a;margin-bottom:30px}
.dhero-pts{font-family:'Arial Black','Helvetica Neue',Helvetica,Arial,sans-serif;font-weight:900;font-size:230px;line-height:1.1;letter-spacing:-4px;color:var(--score-color);text-shadow:0 0 80px var(--score-glow);display:block;height:250px}
.dhero-unit{font-weight:500;font-size:38px;line-height:1.35;letter-spacing:5px;text-transform:uppercase;color:#93a39a;margin-top:30px}
.dhero-comp{margin-top:50px;font-weight:700;font-size:38px;line-height:1.2;letter-spacing:0.3px;text-transform:uppercase;color:#f1ede2;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dcards{display:flex;gap:24px;margin:56px 0 8px}
.dchip-card{flex:1;background:rgba(12,14,13,0.55);border:2px solid var(--card-border);border-radius:20px;padding:26px 18px;display:flex;flex-direction:column;align-items:center;gap:6px}
.dchip-role{font-weight:700;font-size:24px;letter-spacing:3px;text-transform:uppercase;color:var(--role-color)}
.dchip-flag{margin-top:4px;background:var(--accent);color:var(--chip-text);font-family:'Courier New',Courier,monospace;font-weight:700;font-size:26px;letter-spacing:1px;padding:4px 14px;border-radius:7px}
.dchip-name{font-weight:700;font-size:40px;line-height:1;letter-spacing:0.5px;text-transform:uppercase;color:#f1ede2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
.dchip-pts{font-family:'Courier New',Courier,monospace;font-weight:700;font-size:46px;color:var(--pts-color)}
.dcard-foot{margin-top:14px;padding-top:26px;border-top:1.5px solid rgba(241,237,226,0.10);text-align:center}
.dfoot-main{font-weight:700;font-size:46px;letter-spacing:8px;text-transform:uppercase;color:#d9a441;text-shadow:0 0 26px rgba(217,164,65,0.35)}
.dfoot-main.pro{font-size:37px;letter-spacing:2px;line-height:1.12}
.dfoot-sub{margin-top:10px;font-weight:300;font-size:26px;letter-spacing:1px;color:#93a39a}
.dfoot-link{margin-top:12px;font-family:'Courier New',Courier,monospace;font-size:27px;letter-spacing:1px;color:#e8cf8f}
.dcard.is-pro .dcard-bg{background:linear-gradient(180deg,#1c1810 0%,#15110a 50%,#0b0906 100%)}
.dcard.is-pro .dteam-name{background:linear-gradient(176deg,#fbe7ad 0%,#e7c074 42%,#d9a441 100%);-webkit-background-clip:text;background-clip:text;color:transparent}
.dcard.is-pro .dfoot-main.pro{background:linear-gradient(180deg,#fbe7ad,#d9a441);-webkit-background-clip:text;background-clip:text;color:transparent;text-shadow:none}
.pro-corner{position:absolute;width:92px;height:92px;z-index:3;pointer-events:none;filter:drop-shadow(0 0 14px rgba(217,164,65,0.6))}
.pro-corner.tl{top:30px;left:30px;border-top:5px solid #d9a441;border-left:5px solid #d9a441;border-top-left-radius:14px}
.pro-corner.tr{top:30px;right:30px;border-top:5px solid #d9a441;border-right:5px solid #d9a441;border-top-right-radius:14px}
`;

// html-to-image de CDN (uma vez). Mesma abordagem do CartaoEquipa.
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

function ensureFonts() {
  if (document.getElementById("ippon-card-fonts")) return;
  const l = document.createElement("link");
  l.id = "ippon-card-fonts";
  l.rel = "stylesheet";
  l.href = "https://fonts.googleapis.com/css2?family=Oswald:wght@300;400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap";
  document.head.appendChild(l);
}

export function CartaoDesempenho({
  identity,
  faixa,
  dados,
  pro = false,
  onClose,
}: {
  identity: Identity;
  faixa: string;
  dados: DesempenhoRodada;
  pro?: boolean;
  onClose: () => void;
}) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(0.3);
  const [busy, setBusy] = useState(false);
  const [podePartilhar, setPodePartilhar] = useState(false);

  useEffect(() => {
    ensureFonts();
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

  const bk = beltKey(faixa);
  const b = BELTS[bk];

  async function gerarBlob(): Promise<Blob | null> {
    const node = cardRef.current;
    if (!node) return null;
    try {
      const h2i = await loadHtmlToImage() as { toBlob: (n: HTMLElement, o: Record<string, unknown>) => Promise<Blob> };
      // O cartão usa só fontes de SISTEMA (Arial/Courier) — não depende de
      // download do Google Fonts, por isso a imagem gerada fica idêntica à
      // pré-visualização. Pequena pausa só para o layout assentar.
      await new Promise((r) => setTimeout(r, 80));
      return await h2i.toBlob(node, { width: 1080, height: 1350, pixelRatio: 1, cacheBust: true, backgroundColor: "#0c0e0d" });
    } catch { return null; }
  }

  function baixarBlob(blob: Blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "ippon-desempenho.png";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  async function partilhar() {
    setBusy(true);
    const blob = await gerarBlob();
    setBusy(false);
    if (!blob) return;
    const file = new File([blob], "ippon-desempenho.png", { type: "image/png" });
    // Link para a app: a raiz encaminha conforme a sessão (com conta -> início;
    // sem conta -> entrada/cadastro).
    const link = "https://ippon-league.vercel.app";
    const texto = `Fiz ${sinal(dados.pontuacaoTotal)} pts em ${dados.nomeCompeticao} na Ippon League! Joga também: ${link}`;
    const nav = navigator as Navigator & { canShare?: (d: { files?: File[] }) => boolean; share?: (d: unknown) => Promise<void> };
    try {
      if (nav.canShare && nav.canShare({ files: [file] }) && nav.share) {
        await nav.share({ files: [file], title: "O meu desempenho na Ippon League", text: texto, url: link });
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
    ["--accent" as string]: b.accent,
    ["--chip-text" as string]: b.chipText,
    ["--glow-accent" as string]: pro ? GOLD : b.accent,
    boxShadow: frameShadow(b, pro),
  } as CSSProperties;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(6,8,7,0.88)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18, zIndex: 130, overflowY: "auto" }}>
      <style>{CARD_CSS}</style>
      <div style={{ width: "100%", maxWidth: 360, background: "#121815", border: `1px solid ${GOLD}`, borderRadius: 16, padding: 18, textAlign: "center" }}>
        <h2 style={{ fontFamily: "var(--font-geist-mono), sans-serif", fontSize: 18, fontWeight: 700, textTransform: "uppercase", margin: "0 0 12px", color: GOLD }}>Partilhar desempenho</h2>

        {/* Pré-visualização: o cartão real (1080px) escalado para a largura do modal. */}
        <div ref={previewRef} style={{ width: "100%", aspectRatio: "1080 / 1350", borderRadius: 12, overflow: "hidden", marginBottom: 14, position: "relative", background: "#0c0e0d" }}>
          <div style={{ position: "absolute", top: 0, left: 0, width: 1080, height: 1350, transform: `scale(${scale})`, transformOrigin: "top left" }}>
            <DesempenhoNode innerRef={cardRef} vars={cardVars} pro={pro} belt={bk} beltName={b.name} accent={b.accent} identity={identity} dados={dados} />
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

// O nó do cartão a 1080×1350 — é isto que o html-to-image captura.
function DesempenhoNode({ innerRef, vars, pro, belt, beltName, accent, identity, dados }: {
  innerRef: { current: HTMLDivElement | null };
  vars: CSSProperties;
  pro: boolean;
  belt: Belt;
  beltName: string;
  accent: string;
  identity: Identity;
  dados: DesempenhoRodada;
}) {
  const total = dados.pontuacaoTotal;
  const positivo = total >= 0;
  const scoreColor = positivo ? GOLD : "#ef8d83";
  const scoreGlow = positivo ? "rgba(217,164,65,0.40)" : "rgba(239,141,131,0.35)";

  const heroVars = {
    ...vars,
    ["--score-color" as string]: scoreColor,
    ["--score-glow" as string]: scoreGlow,
  } as CSSProperties;

  return (
    <div ref={innerRef} className={`dcard belt-${belt} ${pro ? "is-pro" : ""}`} style={heroVars}>
      <div className="dcard-bg" />
      <div className="dcard-headglow" />
      {pro && (<><div className="pro-corner tl" /><div className="pro-corner tr" /></>)}
      <div className="dcard-inner">
        {pro && <div className="pro-badge">★&nbsp;&nbsp;IPPON&nbsp;PRO&nbsp;&nbsp;★</div>}

        <header className="dcard-head">
          <div className="dcrest"><Escudo config={identity} size={96} /></div>
          <div className="dhead-text">
            <h1 className="dteam-name">{identity.name}</h1>
            <span className="dbelt-pill">{beltName}</span>
          </div>
        </header>

        <div className="dhero">
          <div className="dhero-label">O meu desempenho</div>
          <div className="dhero-pts">{sinal(total)}</div>
          <div className="dhero-unit">pontos na rodada</div>
          <div className="dhero-comp">{dados.nomeCompeticao}</div>

          <div className="dcards">
            {dados.capitao && (
              <div className="dchip-card" style={{ ["--card-border" as string]: GOLD, ["--role-color" as string]: GOLD, ["--pts-color" as string]: dados.capitao.pontos >= 0 ? "#7fd1a3" : "#ef8d83" } as CSSProperties}>
                <span className="dchip-role">★ Capitão</span>
                <span className="dchip-flag">{code3(dados.capitao.atleta.countryIso)}</span>
                <span className="dchip-name">{sobrenome(dados.capitao.atleta.name)}</span>
                <span className="dchip-pts">{sinal(dados.capitao.pontos)}</span>
              </div>
            )}
            {dados.melhor && (
              <div className="dchip-card" style={{ ["--card-border" as string]: "rgba(241,237,226,0.16)", ["--role-color" as string]: "#93a39a", ["--pts-color" as string]: dados.melhor.pontos >= 0 ? "#7fd1a3" : "#ef8d83" } as CSSProperties}>
                <span className="dchip-role">Melhor atleta</span>
                <span className="dchip-flag">{code3(dados.melhor.atleta.countryIso)}</span>
                <span className="dchip-name">{sobrenome(dados.melhor.atleta.name)}</span>
                <span className="dchip-pts">{sinal(dados.melhor.pontos)}</span>
              </div>
            )}
          </div>
        </div>

        <footer className="dcard-foot">
          {pro ? (
            <>
              <div className="dfoot-main pro">JOGA COM VANTAGEM.<br />SÊ IPPON PRO.</div>
              <div className="dfoot-link">ippon-league.vercel.app</div>
            </>
          ) : (
            <>
              <div className="dfoot-main">IPPON&nbsp;LEAGUE</div>
              <div className="dfoot-sub">O jogo oficial dos fãs de judô</div>
            </>
          )}
        </footer>
      </div>
    </div>
  );
}
