"use client";

// components/CartaoFaixa.tsx
//
// CARTÃO DE FAIXA partilhável (imagem 1080×1350) — o "boneco" (Dôdo) na COR DA
// FAIXA daquele momento, com a situação (subiu / desceu / manteve) e o período.
// Usa as funções da própria app (corDaFaixa, useRotuloFaixa) para a cor e o nome
// da faixa serem iguais ao resto. Serve a faixa atual E cada mês do histórico.
// Sem travessões nos textos.
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Escudo, type Identity } from "@/components/Escudo";
import { Mascot } from "@/components/Mascot";
import { useT, useLingua, useRotuloFaixa } from "@/lib/i18n";
import { corDaFaixa, normalizarFaixa } from "@/lib/faixas";

const GOLD = "#d9a441";
const FONT = "'Arial Narrow','Helvetica Neue',Arial,sans-serif";

// Rótulos da situação no cartão, por língua (mapa local; japonês/russo no rollout).
const L: Record<string, { subiu: string; desceu: string; manteve: string; atual: string; de: string; para: string; fundador: string }> = {
  pt: { subiu: "Subi de faixa", desceu: "Desci de faixa", manteve: "Mantive a faixa", atual: "A minha faixa", de: "de", para: "para", fundador: "Fundador" },
  en: { subiu: "I moved up a belt", desceu: "I moved down a belt", manteve: "I kept my belt", atual: "My belt", de: "from", para: "to", fundador: "Founder" },
  es: { subiu: "Subí de cinturón", desceu: "Bajé de cinturón", manteve: "Mantuve mi cinturón", atual: "Mi cinturón", de: "de", para: "a", fundador: "Fundador" },
  fr: { subiu: "J'ai monté de ceinture", desceu: "J'ai descendu de ceinture", manteve: "J'ai gardé ma ceinture", atual: "Ma ceinture", de: "de", para: "à", fundador: "Fondateur" },
  de: { subiu: "Ich bin eine Stufe aufgestiegen", desceu: "Ich bin eine Stufe abgestiegen", manteve: "Ich habe meinen Gürtel gehalten", atual: "Mein Gürtel", de: "von", para: "zu", fundador: "Gründer" },
};

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

export function CartaoFaixa({
  faixa,
  faixaDe = null,
  situacao = null,
  periodoLabel,
  identity,
  fundador = false,
  onClose,
}: {
  faixa: string;
  faixaDe?: string | null;
  situacao?: "subiu" | "desceu" | "manteve" | null;
  periodoLabel?: string;
  identity: Identity;
  fundador?: boolean;
  onClose: () => void;
}) {
  const t = useT();
  const { lingua } = useLingua();
  const rot = useRotuloFaixa();
  const lbl = L[lingua] ?? L.pt;

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

  async function gerarBlob(): Promise<Blob | null> {
    const node = cardRef.current;
    if (!node) return null;
    try {
      const h2i = await loadHtmlToImage();
      await new Promise((r) => setTimeout(r, 80));
      return await h2i.toBlob(node, { width: 1080, height: 1350, pixelRatio: 1, cacheBust: true, backgroundColor: "#0c0e0d" });
    } catch { return null; }
  }
  function baixarBlob(blob: Blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "ippon-faixa.png";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
  async function partilhar() {
    setBusy(true);
    const blob = await gerarBlob();
    setBusy(false);
    if (!blob) return;
    const file = new File([blob], "ippon-faixa.png", { type: "image/png" });
    const nav = navigator as Navigator & { canShare?: (d: { files?: File[] }) => boolean; share?: any };
    try {
      if (nav.canShare && nav.canShare({ files: [file] })) {
        await nav.share({ files: [file], title: "Ippon League", text: "https://www.ipponleague.com/inicio" });
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

  const fx = normalizarFaixa(faixa);
  const cor = corDaFaixa(fx);
  const nomeFaixa = rot(fx);
  const nomeDe = faixaDe ? rot(normalizarFaixa(faixaDe)) : null;
  const expr = situacao === "subiu" ? "comemorando" : situacao === "desceu" ? "indicando" : "feliz";
  const titulo = situacao === "subiu" ? lbl.subiu : situacao === "desceu" ? lbl.desceu : situacao === "manteve" ? lbl.manteve : lbl.atual;
  const sub = (situacao === "subiu" || situacao === "desceu") && nomeDe ? `${lbl.de} ${nomeDe} ${lbl.para} ${nomeFaixa}` : null;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(6,8,7,0.88)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18, zIndex: 120, overflowY: "auto" }}>
      <div style={{ width: "100%", maxWidth: 360, background: "#121815", border: `1px solid ${GOLD}`, borderRadius: 16, padding: 18, textAlign: "center" }}>
        <h2 style={{ fontFamily: "var(--font-geist-mono), sans-serif", fontSize: 18, fontWeight: 700, textTransform: "uppercase", margin: "0 0 12px", color: GOLD }}>{lbl.atual}</h2>

        <div ref={previewRef} style={{ width: "100%", aspectRatio: "1080 / 1350", borderRadius: 12, overflow: "hidden", marginBottom: 14, position: "relative", background: "#0c0e0d" }}>
          <div style={{ position: "absolute", top: 0, left: 0, width: 1080, height: 1350, transform: `scale(${scale})`, transformOrigin: "top left" }}>
            <FaixaNode innerRef={cardRef} cor={cor} expr={expr} titulo={titulo} sub={sub} nomeFaixa={nomeFaixa} periodoLabel={periodoLabel} identity={identity} fundador={fundador} fundadorLabel={lbl.fundador} />
          </div>
        </div>

        {podePartilhar && (
          <button onClick={partilhar} disabled={busy} style={btnFill(busy)}>{busy ? t("cc.aGerar") : t("comum.partilhar")}</button>
        )}
        <button onClick={guardar} disabled={busy} style={btnGhost(busy)}>{busy ? t("cc.aGerar") : t("cc.guardarImagem")}</button>
        <button onClick={onClose} style={{ marginTop: 10, background: "transparent", border: "none", color: "#93a39a", fontSize: 13, cursor: "pointer" }}>{t("comum.fechar")}</button>
      </div>
    </div>
  );
}

function FaixaNode({ innerRef, cor, expr, titulo, sub, nomeFaixa, periodoLabel, identity, fundador, fundadorLabel }: {
  innerRef: { current: HTMLDivElement | null };
  cor: string;
  expr: "comemorando" | "indicando" | "feliz";
  titulo: string;
  sub: string | null;
  nomeFaixa: string;
  periodoLabel?: string;
  identity: Identity;
  fundador?: boolean;
  fundadorLabel: string;
}) {
  return (
    <div ref={innerRef} style={{
      position: "relative", width: 1080, height: 1350, borderRadius: 34, overflow: "hidden",
      fontFamily: FONT, color: "#f1ede2",
      background: "linear-gradient(180deg,#141a17 0%,#10130f 48%,#0c0e0d 100%)",
      boxShadow: `inset 0 0 0 10px ${cor}`,
      display: "flex", flexDirection: "column", alignItems: "center", boxSizing: "border-box", padding: "72px 60px 60px",
    }}>
      {/* brilho da cor da faixa no topo */}
      <div style={{ position: "absolute", top: -120, left: 0, right: 0, height: 620, background: `radial-gradient(58% 70% at 50% 20%, ${hexA(cor, 0.30)} 0%, transparent 68%)`, pointerEvents: "none" }} />

      {/* identidade (escudo + nome) */}
      <div style={{ position: "relative", zIndex: 2, display: "flex", alignItems: "center", gap: 20, marginBottom: 10 }}>
        <div style={{ width: 92, height: 106, display: "grid", placeItems: "center", filter: "drop-shadow(0 8px 18px rgba(0,0,0,0.45))" }}>
          <Escudo config={identity} size={92} />
        </div>
        <div style={{ fontWeight: 700, fontSize: 46, textTransform: "uppercase", letterSpacing: 0.5, maxWidth: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{identity.name}</div>
      </div>

      {/* selo de Fundador */}
      {fundador && (
        <div style={{ position: "relative", zIndex: 2, display: "inline-flex", alignItems: "center", gap: 12, marginTop: 6, marginBottom: 6, padding: "9px 28px", borderRadius: 999, background: hexA(GOLD, 0.14), border: `2px solid ${GOLD}`, color: "#f3dc9b", fontWeight: 700, fontSize: 26, letterSpacing: 4, textTransform: "uppercase" }}>
          <span style={{ color: GOLD, fontSize: 28 }}>★</span><span>{fundadorLabel}</span>
        </div>
      )}

      {/* o boneco na cor da faixa */}
      <div style={{ position: "relative", zIndex: 2, flex: 1, display: "flex", alignItems: "center", justifyContent: "center", width: "100%" }}>
        <div style={{ width: 560, height: 560, borderRadius: "50%", display: "grid", placeItems: "center", background: `radial-gradient(circle at 50% 38%, ${hexA(cor, 0.22)} 0%, rgba(12,14,13,0.0) 62%)` }}>
          <div style={{ width: 460, height: 460 }}>
            <Mascot belt={cor} expression={expr} />
          </div>
        </div>
      </div>

      {/* faixa + situação */}
      <div style={{ position: "relative", zIndex: 2, textAlign: "center", width: "100%" }}>
        <div style={{ display: "inline-block", padding: "14px 44px", borderRadius: 12, background: cor, color: chipText(cor), fontWeight: 700, fontSize: 52, letterSpacing: 2, textTransform: "uppercase", marginBottom: 20 }}>{nomeFaixa}</div>
        <div style={{ fontWeight: 700, fontSize: 44, letterSpacing: 4, textTransform: "uppercase", color: "#f1ede2" }}>{titulo}</div>
        {sub && <div style={{ fontWeight: 500, fontSize: 32, color: "#c7d0c9", marginTop: 10 }}>{sub}</div>}
        {periodoLabel && <div style={{ fontWeight: 700, fontSize: 28, color: GOLD, letterSpacing: 3, textTransform: "uppercase", marginTop: 14 }}>{periodoLabel}</div>}
      </div>

      {/* rodapé */}
      <div style={{ position: "relative", zIndex: 2, marginTop: 34, paddingTop: 26, borderTop: "1.5px solid rgba(241,237,226,0.12)", textAlign: "center", width: "100%" }}>
        <div style={{ fontWeight: 700, fontSize: 44, letterSpacing: 8, textTransform: "uppercase", color: GOLD }}>IPPON&nbsp;LEAGUE</div>
        <div style={{ fontFamily: "'Courier New',monospace", fontSize: 28, letterSpacing: 1, color: "#e8cf8f", marginTop: 10 }}>www.ipponleague.com</div>
      </div>
    </div>
  );
}

// Cor de texto legível sobre a cor da faixa (clara -> texto escuro; escura -> claro).
function chipText(hex: string): string {
  const c = hex.replace("#", "");
  if (c.length < 6) return "#14181a";
  const r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? "#14181a" : "#f1ede2";
}
// hex (#rrggbb) + alfa -> rgba.
function hexA(hex: string, a: number): string {
  const c = hex.replace("#", "");
  if (c.length < 6) return hex;
  const r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

const btnFill = (busy: boolean): CSSProperties => ({ width: "100%", padding: 13, borderRadius: 12, border: "none", background: GOLD, color: "#1b211e", fontFamily: "var(--font-geist-mono), sans-serif", fontSize: 15, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", cursor: busy ? "default" : "pointer", opacity: busy ? 0.7 : 1, marginBottom: 10 });
const btnGhost = (busy: boolean): CSSProperties => ({ width: "100%", padding: 13, borderRadius: 12, border: `1px solid ${GOLD}`, background: "transparent", color: GOLD, fontFamily: "var(--font-geist-mono), sans-serif", fontSize: 15, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", cursor: busy ? "default" : "pointer", opacity: busy ? 0.7 : 1 });
