"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { Athlete } from "@/lib/athletes";
import { Escudo, type Identity } from "@/components/Escudo";
import { Mascot } from "@/components/Mascot";
import { useT } from "@/lib/i18n";

const GOLD = "#d9a441";

const IOC: Record<string, string> = {
  JP: "JPN", FR: "FRA", BR: "BRA", GE: "GEO", KZ: "KAZ", AZ: "AZE", BE: "BEL",
  TR: "TUR", UZ: "UZB", RU: "AIN", DE: "GER", XK: "KOS", IT: "ITA", CA: "CAN",
  SI: "SLO", HR: "CRO", NL: "NED",
};
const code3 = (iso: string) => IOC[iso] || iso;
const sobrenome = (nome: string) => (nome.split(" ").slice(-1)[0] || nome).toUpperCase();

export interface CartaoProps {
  identity: Identity;
  faixa: string;
  atletas: Athlete[];
  capitao: string | null;
}

type Belt = "branca" | "azul" | "amarela" | "verde" | "roxa" | "castanha" | "preta";
interface BeltTheme {
  nameK: string; accent: string; chipText: string; frame: number; frameColor: string; double: boolean; glow: number; glowColor: string;
}
const BELTS: Record<Belt, BeltTheme> = {
  branca:   { nameK: "card.faixaBranca",   accent: "#d7dcd6", chipText: "#14181a", frame: 3, frameColor: "#5a635e", double: false, glow: 0,  glowColor: "transparent" },
  azul:     { nameK: "card.faixaAzul",     accent: "#3f86d6", chipText: "#0a1622", frame: 4, frameColor: "#3f86d6", double: false, glow: 34, glowColor: "rgba(63,134,214,0.30)" },
  amarela:  { nameK: "card.faixaAmarela",  accent: "#e6b422", chipText: "#1f1804", frame: 4, frameColor: "#e6b422", double: false, glow: 44, glowColor: "rgba(230,180,34,0.32)" },
  verde:    { nameK: "card.faixaVerde",    accent: "#3f9f5a", chipText: "#08160d", frame: 5, frameColor: "#3f9f5a", double: false, glow: 48, glowColor: "rgba(63,159,90,0.34)" },
  roxa:     { nameK: "card.faixaRoxa",     accent: "#9b6cc9", chipText: "#f1ede2", frame: 5, frameColor: "#9b6cc9", double: false, glow: 64, glowColor: "rgba(155,108,201,0.46)" },
  castanha: { nameK: "card.faixaCastanha", accent: "#a06a3a", chipText: "#f1ede2", frame: 6, frameColor: "#a06a3a", double: true,  glow: 64, glowColor: "rgba(160,106,58,0.46)" },
  preta:    { nameK: "card.faixaPreta",    accent: GOLD,      chipText: "#1f1804", frame: 9, frameColor: GOLD,      double: true,  glow: 96, glowColor: "rgba(217,164,65,0.62)" },
};
function beltKey(faixa: string): Belt {
  const k = (faixa || "").trim().toLowerCase();
  return (["branca","azul","amarela","verde","roxa","castanha","preta"].includes(k) ? k : "branca") as Belt;
}

const MAX_AZUL = "#7fb8f5";

// premium=true desenha moldura/brilho reforçados; cor = dourado (Pro) ou azul (Pro Max).
function frameShadow(b: BeltTheme, premium: boolean, cor: string): string {
  const w = premium ? 10 : b.frame;
  const fc = premium ? cor : b.frameColor;
  const dbl = premium || b.double;
  const parts: string[] = [];
  parts.push(`inset 0 0 0 ${w}px ${fc}`);
  if (dbl) {
    parts.push(`inset 0 0 0 ${w + 6}px rgba(11,13,12,0.95)`);
    parts.push(`inset 0 0 0 ${w + 8}px ${premium ? cor : "rgba(217,164,65,0.45)"}`);
  }
  const glow = premium ? `0 0 120px ${cor}88` : b.glow ? `0 0 ${b.glow}px ${b.glowColor}` : null;
  if (glow) parts.push(glow);
  parts.push("0 44px 100px rgba(0,0,0,0.55)");
  return parts.join(", ");
}

// CSS do cartão (do Claude Design), injetado inline para não depender de ficheiro .css externo.
// FONTES: usa SÓ fontes de SISTEMA (Arial Narrow / Courier New) — tal como o
// CartaoDesempenho. As Google Fonts (Oswald/JetBrains) NÃO embebem na imagem
// gerada pelo html-to-image (CORS), o que fazia o texto sair sobreposto/desalinhado
// face à pré-visualização. Com fontes de sistema, a imagem = a pré-visualização.
const CARD_CSS = `
.jcard{position:relative;width:1080px;height:1350px;border-radius:34px;overflow:hidden;font-family:'Arial Narrow','Helvetica Neue',Arial,sans-serif;color:#f1ede2;isolation:isolate;-webkit-font-smoothing:antialiased}
.jcard-bg{position:absolute;inset:0;background:linear-gradient(180deg,#141a17 0%,#10130f 48%,#0c0e0d 100%);z-index:0}
.jcard-headglow{position:absolute;top:-120px;left:0;right:0;height:620px;z-index:0;background:radial-gradient(58% 70% at 34% 24%,color-mix(in srgb,var(--glow-accent) 26%,transparent) 0%,transparent 68%),radial-gradient(80% 60% at 80% 6%,color-mix(in srgb,#d9a441 10%,transparent) 0%,transparent 70%);pointer-events:none}
.jcard-inner{position:relative;z-index:2;height:100%;padding:64px 60px 56px;display:flex;flex-direction:column;box-sizing:border-box}
.pro-badge{align-self:center;margin-top:-14px;margin-bottom:30px;padding:13px 40px;border-radius:999px;background:linear-gradient(180deg,#f1c969 0%,#d9a441 55%,#b9842c 100%);color:#20160a;font-weight:700;font-size:31px;letter-spacing:5px;text-transform:uppercase;border:1.5px solid #f4d489;box-shadow:0 0 44px rgba(217,164,65,0.6),inset 0 1px 0 rgba(255,255,255,0.5)}
.jcard-head{display:flex;flex-direction:column;align-items:center;text-align:center;gap:18px;padding-bottom:30px;margin-bottom:8px;border-bottom:1.5px solid rgba(241,237,226,0.10)}
.crest-wrap{flex-shrink:0;width:150px;height:172px;display:grid;place-items:center;filter:drop-shadow(0 8px 18px rgba(0,0,0,0.45))}
.head-text{min-width:0;width:100%;display:flex;flex-direction:column;align-items:center}
.team-name{margin:0;font-weight:700;font-size:70px;line-height:0.96;letter-spacing:0.5px;text-transform:uppercase;color:#f1ede2;text-align:center}
.belt-pill{display:inline-block;margin-top:20px;padding:11px 32px;border-radius:9px;background:var(--accent);color:var(--chip-text);font-weight:600;font-size:30px;letter-spacing:1.5px;text-transform:uppercase;white-space:nowrap}
.roster{flex:1;display:flex;flex-direction:column;padding:6px 0}
.row{flex:1 1 0;min-height:0;display:flex;align-items:center;gap:28px;padding:0 6px;border-bottom:1.5px solid rgba(241,237,226,0.07)}
.row:last-child{border-bottom:0}
.chip{flex-shrink:0;width:108px;height:62px;display:grid;place-items:center;border-radius:7px;background:var(--accent);color:var(--chip-text);font-family:'Courier New',Courier,monospace;font-weight:700;font-size:33px;letter-spacing:1px}
.surname{flex:1;min-width:0;font-weight:700;font-size:52px;line-height:1;letter-spacing:0.5px;text-transform:uppercase;color:#f1ede2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.weight{flex-shrink:0;font-family:'Courier New',Courier,monospace;font-weight:500;font-size:32px;letter-spacing:0.5px;color:#93a39a}
.pts{flex-shrink:0;font-family:'Courier New',Courier,monospace;font-weight:700;font-size:40px;letter-spacing:0.5px;min-width:120px;text-align:right}
.pts.pos{color:#7fd1a3}
.pts.neg{color:#ef8d83}
.pts.zero{color:#93a39a}
.pts.none{color:#5f6f67;font-size:30px}
.row.is-captain{border-bottom:0;background:linear-gradient(90deg,rgba(217,164,65,0.16) 0%,rgba(217,164,65,0.07) 100%);border:2px solid rgba(217,164,65,0.55);border-radius:14px;padding:0 18px;box-shadow:0 0 30px rgba(217,164,65,0.14)}
.cap-badge{flex-shrink:0;width:58px;height:58px;display:grid;place-items:center;border-radius:50%;background:linear-gradient(180deg,#f1c969 0%,#d9a441 60%,#b9842c 100%);color:#20160a;font-weight:700;font-size:36px;margin-left:6px;box-shadow:0 0 22px rgba(217,164,65,0.5),inset 0 1px 0 rgba(255,255,255,0.5)}
.jcard-foot{margin-top:14px;padding-top:26px;border-top:1.5px solid rgba(241,237,226,0.10);text-align:center}
.foot-total{display:flex;align-items:center;justify-content:center;gap:22px;margin-bottom:20px}
.foot-total .lbl{font-weight:700;font-size:34px;letter-spacing:3px;text-transform:uppercase;color:#93a39a}
.foot-total .val{font-family:'Courier New',Courier,monospace;font-weight:700;font-size:60px;color:#d9a441}
.foot-main{font-weight:700;font-size:48px;letter-spacing:8px;text-transform:uppercase;color:#d9a441;text-shadow:0 0 26px rgba(217,164,65,0.35)}
.foot-main.pro{font-size:39px;letter-spacing:2px;line-height:1.12}
.foot-sub{margin-top:10px;font-weight:300;font-size:27px;letter-spacing:1px;color:#93a39a}
.foot-link{margin-top:12px;font-family:'Courier New',Courier,monospace;font-size:28px;letter-spacing:1px;color:#e8cf8f}
.dodo-medal{position:absolute;right:34px;bottom:40px;width:150px;height:150px;z-index:3;border-radius:50%;background:radial-gradient(circle at 50% 38%,#245446 0%,#1c3a2e 58%,#14271f 100%);border:3px solid color-mix(in srgb,var(--accent) 85%,#1c3a2e);box-shadow:0 0 0 6px rgba(12,14,13,0.55),0 14px 30px rgba(0,0,0,0.5),0 0 34px color-mix(in srgb,var(--glow-accent) 30%,transparent),inset 0 2px 10px rgba(0,0,0,0.4);display:grid;place-items:center;overflow:hidden}
.dodo-fig{width:80%;height:80%;margin-top:8%;filter:drop-shadow(0 3px 5px rgba(0,0,0,0.35))}
.jcard.is-pro .dodo-medal{border-color:#d9a441;border-width:4px;box-shadow:0 0 0 6px rgba(12,14,13,0.55),0 14px 30px rgba(0,0,0,0.5),0 0 44px rgba(217,164,65,0.5),inset 0 2px 10px rgba(0,0,0,0.4)}
.jcard.is-pro .jcard-bg{background:linear-gradient(180deg,#1c1810 0%,#15110a 50%,#0b0906 100%)}
.jcard.is-pro .jcard-headglow{top:-160px;height:720px;background:radial-gradient(46% 60% at 50% 22%,color-mix(in srgb,#d9a441 42%,transparent) 0%,transparent 64%),conic-gradient(from 200deg at 50% 14%,transparent 0deg,color-mix(in srgb,#d9a441 16%,transparent) 30deg,transparent 70deg,transparent 290deg,color-mix(in srgb,#d9a441 16%,transparent) 330deg,transparent 360deg)}
.pro-sheen{position:absolute;inset:0;z-index:1;pointer-events:none;background:linear-gradient(122deg,transparent 38%,rgba(246,220,160,0.10) 49%,rgba(246,220,160,0.02) 56%,transparent 64%)}
.pro-corner{position:absolute;width:92px;height:92px;z-index:3;pointer-events:none;filter:drop-shadow(0 0 14px rgba(217,164,65,0.6))}
.pro-corner.tl{top:30px;left:30px;border-top:5px solid #d9a441;border-left:5px solid #d9a441;border-top-left-radius:14px}
.pro-corner.tr{top:30px;right:30px;border-top:5px solid #d9a441;border-right:5px solid #d9a441;border-top-right-radius:14px}
.jcard.is-pro .jcard-inner{padding:50px 64px 56px}
.jcard.is-pro .pro-badge{margin-top:6px;margin-bottom:30px;padding:15px 50px;font-size:33px;letter-spacing:6px;background:linear-gradient(180deg,#fbe3a4 0%,#e7b75a 45%,#c79235 100%);border:2px solid #fbe7ad;box-shadow:0 0 26px rgba(217,164,65,0.5),0 0 70px rgba(217,164,65,0.6),inset 0 1px 0 rgba(255,255,255,0.65)}
.jcard.is-pro .team-name{background:linear-gradient(176deg,#fbe7ad 0%,#e7c074 42%,#d9a441 100%);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 1px 12px rgba(217,164,65,0.25))}
.jcard.is-pro .foot-main.pro{background:linear-gradient(180deg,#fbe7ad,#d9a441);-webkit-background-clip:text;background-clip:text;color:transparent;text-shadow:none;filter:drop-shadow(0 0 22px rgba(217,164,65,0.45))}
.jcard.is-promax .dodo-medal{border-color:#3f86d6;border-width:4px;box-shadow:0 0 0 6px rgba(12,14,13,0.55),0 14px 30px rgba(0,0,0,0.5),0 0 44px rgba(63,134,214,0.5),inset 0 2px 10px rgba(0,0,0,0.4)}
.jcard.is-promax .jcard-bg{background:linear-gradient(180deg,#101a28 0%,#0b1320 50%,#070b12 100%)}
.jcard.is-promax .jcard-headglow{top:-160px;height:720px;background:radial-gradient(46% 60% at 50% 22%,color-mix(in srgb,#3f86d6 42%,transparent) 0%,transparent 64%),conic-gradient(from 200deg at 50% 14%,transparent 0deg,color-mix(in srgb,#3f86d6 16%,transparent) 30deg,transparent 70deg,transparent 290deg,color-mix(in srgb,#3f86d6 16%,transparent) 330deg,transparent 360deg)}
.jcard.is-promax .pro-sheen{background:linear-gradient(122deg,transparent 38%,rgba(160,200,246,0.10) 49%,rgba(160,200,246,0.02) 56%,transparent 64%)}
.jcard.is-promax .pro-corner{filter:drop-shadow(0 0 14px rgba(63,134,214,0.6))}
.jcard.is-promax .pro-corner.tl{border-top-color:#3f86d6;border-left-color:#3f86d6}
.jcard.is-promax .pro-corner.tr{border-top-color:#3f86d6;border-right-color:#3f86d6}
.jcard.is-promax .jcard-inner{padding:50px 64px 56px}
.jcard.is-promax .pro-badge{margin-top:6px;margin-bottom:30px;padding:15px 50px;font-size:33px;letter-spacing:6px;background:linear-gradient(180deg,#bcdcff 0%,#6aa6e8 45%,#3f86d6 100%);color:#0a1622;border:2px solid #bcdcff;box-shadow:0 0 26px rgba(63,134,214,0.5),0 0 70px rgba(63,134,214,0.6),inset 0 1px 0 rgba(255,255,255,0.65)}
.jcard.is-promax .team-name{background:linear-gradient(176deg,#cfe4ff 0%,#8bb8ec 42%,#3f86d6 100%);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 1px 12px rgba(63,134,214,0.25))}
.jcard.is-promax .foot-main.pro{background:linear-gradient(180deg,#cfe4ff,#3f86d6);-webkit-background-clip:text;background-clip:text;color:transparent;text-shadow:none;filter:drop-shadow(0 0 22px rgba(63,134,214,0.45))}
.jcard.is-promax .foot-total .val{color:#7fb8f5}
.jcard.is-promax .row.is-captain{background:linear-gradient(90deg,rgba(63,134,214,0.18) 0%,rgba(63,134,214,0.07) 100%);border:2px solid rgba(63,134,214,0.6);box-shadow:0 0 30px rgba(63,134,214,0.16)}
.jcard.is-promax .cap-badge{background:linear-gradient(180deg,#bcdcff 0%,#6aa6e8 60%,#3f86d6 100%);color:#0a1622;box-shadow:0 0 22px rgba(63,134,214,0.5),inset 0 1px 0 rgba(255,255,255,0.5)}
`;

// Carrega o html-to-image de um CDN, uma vez.
let _h2iPromise: Promise<any> | null = null;
function loadHtmlToImage(): Promise<any> {
  const w = window as unknown as { htmlToImage?: any };
  if (w.htmlToImage) return Promise.resolve(w.htmlToImage);
  if (_h2iPromise) return _h2iPromise;
  _h2iPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/html-to-image/1.11.13/html-to-image.min.js";
    s.crossOrigin = "anonymous";
    s.onload = () => resolve((window as unknown as { htmlToImage?: any }).htmlToImage);
    s.onerror = () => reject(new Error("CDN html-to-image falhou"));
    document.head.appendChild(s);
  });
  return _h2iPromise;
}

export function CartaoEquipa({ identity, faixa, atletas, capitao, pro = false, nivel, pontos, onClose }: CartaoProps & { pro?: boolean; nivel?: "normal" | "pro" | "pro_max"; pontos?: Record<string, number>; onClose: () => void }) {
  const t = useT();
  // Nível efetivo: usa 'nivel' se vier; senão converte o 'pro' antigo (compat).
  const nivelEf: "normal" | "pro" | "pro_max" = nivel ?? (pro ? "pro" : "normal");
  const ehProMax = nivelEf === "pro_max";
  const ehPremium = nivelEf !== "normal"; // pro ou pro_max têm moldura/brilho
  const cardRef = useRef<HTMLDivElement | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(0.3);
  const [busy, setBusy] = useState(false);
  const [podePartilhar, setPodePartilhar] = useState(false);

  useEffect(() => {
    loadHtmlToImage().catch(() => {});
    try {
      const nav = navigator as Navigator & { share?: any };
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
      const h2i = await loadHtmlToImage();
      // O cartão usa só fontes de SISTEMA (Arial Narrow / Courier New) — não
      // depende de download do Google Fonts, por isso a imagem gerada fica
      // idêntica à pré-visualização. Pequena pausa só para o layout assentar.
      await new Promise((r) => setTimeout(r, 80));
      const blob: Blob = await h2i.toBlob(node, { width: 1080, height: 1350, pixelRatio: 1, cacheBust: true, backgroundColor: "#0c0e0d" });
      return blob;
    } catch { return null; }
  }

  async function partilhar() {
    setBusy(true);
    const blob = await gerarBlob();
    setBusy(false);
    if (!blob) return;
    const file = new File([blob], "ippon-equipa.png", { type: "image/png" });
    const nav = navigator as Navigator & { canShare?: (d: { files?: File[] }) => boolean; share?: any };
    try {
      if (nav.canShare && nav.canShare({ files: [file] })) {
        await nav.share({ files: [file], title: t("ce.shareTitle"), text: t("ce.partilhaTexto", { link: "https://www.ipponleague.com/inicio" }) });
        return;
      }
    } catch { /* cancelado */ }
    // fallback: descarrega
    baixarBlob(blob);
  }

  async function guardar() {
    setBusy(true);
    const blob = await gerarBlob();
    setBusy(false);
    if (blob) baixarBlob(blob);
  }

  function baixarBlob(blob: Blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "ippon-equipa.png";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  // monta as 8 linhas a partir dos dados reais
  const linhas = atletas.slice(0, 8);

  const corPremium = ehProMax ? MAX_AZUL : GOLD;
  const cardVars = {
    ["--accent" as any]: b.accent,
    ["--chip-text" as any]: b.chipText,
    ["--glow-accent" as any]: ehPremium ? corPremium : b.accent,
    boxShadow: frameShadow(b, ehPremium, corPremium),
  } as CSSProperties;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(6,8,7,0.88)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18, zIndex: 120, overflowY: "auto" }}>
      <style>{CARD_CSS}</style>
      <div style={{ width: "100%", maxWidth: 360, background: "#121815", border: `1px solid ${GOLD}`, borderRadius: 16, padding: 18, textAlign: "center" }}>
        <h2 style={{ fontFamily: "var(--font-geist-mono), sans-serif", fontSize: 18, fontWeight: 700, textTransform: "uppercase", margin: "0 0 12px", color: GOLD }}>{t("ce.partilharEquipa")}</h2>

        {/* Pré-visualização: o cartão real (1080px) escalado para a largura do modal. */}
        <div ref={previewRef} style={{ width: "100%", aspectRatio: "1080 / 1350", borderRadius: 12, overflow: "hidden", marginBottom: 14, position: "relative", background: "#0c0e0d" }}>
          <div style={{ position: "absolute", top: 0, left: 0, width: 1080, height: 1350, transform: `scale(${scale})`, transformOrigin: "top left" }}>
            <CardNode innerRef={cardRef} vars={cardVars} nivel={nivelEf} belt={bk} beltName={t(b.nameK)} identity={identity} linhas={linhas} capitao={capitao} pontos={pontos} />
          </div>
        </div>

        {podePartilhar && (
          <button onClick={partilhar} disabled={busy} style={{ width: "100%", padding: 13, borderRadius: 12, border: "none", background: GOLD, color: "#1b211e", fontFamily: "var(--font-geist-mono), sans-serif", fontSize: 15, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", cursor: busy ? "default" : "pointer", opacity: busy ? 0.7 : 1, marginBottom: 10 }}>{busy ? t("cc.aGerar") : t("comum.partilhar")}</button>
        )}
        <button onClick={guardar} disabled={busy} style={{ width: "100%", padding: 13, borderRadius: 12, border: `1px solid ${GOLD}`, background: "transparent", color: GOLD, fontFamily: "var(--font-geist-mono), sans-serif", fontSize: 15, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", cursor: busy ? "default" : "pointer", opacity: busy ? 0.7 : 1 }}>{busy ? t("cc.aGerar") : t("cc.guardarImagem")}</button>
        <button onClick={onClose} style={{ marginTop: 10, background: "transparent", border: "none", color: "#93a39a", fontSize: 13, cursor: "pointer" }}>{t("comum.fechar")}</button>
      </div>
    </div>
  );
}

// O nó do cartão a 1080×1350 — é isto que o html-to-image captura.
function CardNode({ innerRef, vars, nivel, belt, beltName, identity, linhas, capitao, pontos }: {
  innerRef: { current: HTMLDivElement | null };
  vars: CSSProperties;
  nivel: "normal" | "pro" | "pro_max";
  belt: Belt;
  beltName: string;
  identity: Identity;
  linhas: Athlete[];
  capitao: string | null;
  pontos?: Record<string, number>;
}) {
  const t = useT();
  const accent = (vars as any)["--accent"] as string;
  const ehPro = nivel === "pro";
  const ehProMax = nivel === "pro_max";
  const premium = ehPro || ehProMax;
  // Classe de moldura: dourado (is-pro) ou azul (is-promax). O Dôdo na medalha
  // herda a cor do judogui do contexto, por isso aqui não forçamos cor de judogui.
  const classeNivel = ehProMax ? "is-promax" : ehPro ? "is-pro" : "";
  const seloTexto = ehProMax ? "★  IPPON PRO MAX  ★" : "★  IPPON PRO  ★";
  const rodapeTexto = ehProMax ? t("card.rodapeMax") : t("card.rodapePro");
  // Há pontuação para mostrar? (modo competição). Se vier o mapa de pontos com
  // pelo menos uma entrada, mostramos a coluna de pontos e o total no rodapé.
  const temPontos = !!pontos && Object.keys(pontos).length > 0;
  // Total da equipa: soma dos pontos, dobrando o capitão. Só atletas com pontos.
  const total = temPontos
    ? Math.round(
        linhas.reduce((s, a) => {
          const p = pontos![a.id];
          if (typeof p !== "number") return s;
          return s + (a.id === capitao ? p * 2 : p);
        }, 0) * 10
      ) / 10
    : 0;

  return (
    <div ref={innerRef} className={`jcard belt-${belt} ${classeNivel}`} style={vars}>
      <div className="jcard-bg" />
      <div className="jcard-headglow" />
      {premium && (<><div className="pro-sheen" /><div className="pro-corner tl" /><div className="pro-corner tr" /></>)}
      <div className="jcard-inner">
        {premium && <div className="pro-badge">{seloTexto}</div>}
        <header className="jcard-head">
          <div className="crest-wrap"><Escudo config={identity} size={150} /></div>
          <div className="head-text">
            <h1 className="team-name">{identity.name}</h1>
            <span className="belt-pill">{beltName}</span>
          </div>
        </header>
        <div className="roster">
          {linhas.map((a, i) => {
            const cap = capitao != null && a.id === capitao;
            // Pontos do atleta (já dobrados se capitão). undefined = ainda sem pontos.
            const base = temPontos ? pontos![a.id] : undefined;
            const tem = typeof base === "number";
            const val = tem ? (cap ? (base as number) * 2 : (base as number)) : null;
            const cls = !temPontos ? "" : val === null ? "none" : val > 0 ? "pos" : val < 0 ? "neg" : "zero";
            return (
              <div key={i} className={`row ${cap ? "is-captain" : ""}`}>
                <span className="chip">{code3(a.countryIso)}</span>
                <span className="surname">{sobrenome(a.name)}</span>
                {temPontos
                  ? <span className={`pts ${cls}`}>{val === null ? "—" : `${val > 0 ? "+" : ""}${val}`}</span>
                  : <span className="weight">{a.category}KG</span>}
                {cap && <span className="cap-badge">C</span>}
              </div>
            );
          })}
        </div>
        <footer className="jcard-foot">
          {temPontos && (
            <div className="foot-total">
              <span className="lbl">{t("ce.totalRodada")}</span>
              <span className="val">{total > 0 ? "+" : ""}{total} pts</span>
            </div>
          )}
          {premium ? (
            <>
              <div className="foot-main pro">{rodapeTexto}</div>
              <div className="foot-link">www.ipponleague.com</div>
            </>
          ) : (
            <>
              <div className="foot-main">IPPON&nbsp;LEAGUE</div>
              <div className="foot-sub">{t("sobre.rodape")}</div>
            </>
          )}
        </footer>
        <div className="dodo-medal">
          <div className="dodo-fig"><Mascot belt={accent} expression={premium ? "sabio" : "feliz"} /></div>
        </div>
      </div>
    </div>
  );
}
