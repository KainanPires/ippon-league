"use client";

// components/CartaoFaixa.tsx
//
// CARTÃO DE FAIXA MUNDIAL partilhável (imagem 1080×1350).
//
// A faixa é SEMPRE mundial (percentil entre TODOS os jogadores, grátis incluídos).
// Mostra: dois Dôdos (faixa antiga -> faixa nova) com a seta da cor do resultado
// (verde a subir, vermelho a descer), o TOP X% do mundo, e uma frase que aponta
// SEMPRE para a faixa preta (o topo, os 5% melhores). Quem mantém a faixa vê um
// só Dôdo; quem já é preta recebe a frase de topo. Sem travessões.
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Escudo, type Identity } from "@/components/Escudo";
import { Mascot } from "@/components/Mascot";
import { useT, useLingua, useRotuloFaixa } from "@/lib/i18n";
import { corDaFaixa, normalizarFaixa } from "@/lib/faixas";

const GOLD = "#d9a441";
const VERDE = "#4fc27a"; // seta: subiu
const VERMELHO = "#ef6a5f"; // seta: desceu
const FONT = "'Arial Narrow','Helvetica Neue',Arial,sans-serif";

type Sit = "subiu" | "desceu" | "manteve" | null;

// Textos por língua (mapa local; japonês/russo no rollout). Sem travessões.
const L: Record<string, {
  ranking: string; pctSub: string; fundador: string;
  hSubi: string; hDesci: string; hMantive: string; hAtual: string;
  motSubi: string; motDesci: string; motMantive: string; motPreta: string;
}> = {
  pt: {
    ranking: "Ranking Mundial", pctSub: "de todos os jogadores do mundo", fundador: "Fundador",
    hSubi: "Subi de faixa", hDesci: "Desci de faixa", hMantive: "Mantive a faixa", hAtual: "A minha faixa",
    motSubi: "No topo está a faixa preta, os 5% melhores do mundo. Continua a subir. 🥋",
    motDesci: "É só um mês. Volta a subir, recupera o teu lugar e segue rumo à faixa preta. 🥋",
    motMantive: "Seguras a tua faixa. Rumo à preta, o topo do mundo. 🥋",
    motPreta: "És faixa preta. Estás entre os 5% melhores do mundo. 🥋",
  },
  en: {
    ranking: "World Ranking", pctSub: "of all players worldwide", fundador: "Founder",
    hSubi: "I moved up a belt", hDesci: "I moved down a belt", hMantive: "I kept my belt", hAtual: "My belt",
    motSubi: "At the top is the black belt, the best 5% in the world. Keep climbing. 🥋",
    motDesci: "It is just one month. Climb back, take your place and keep going toward the black belt. 🥋",
    motMantive: "You are holding your belt. Toward the black belt, the top of the world. 🥋",
    motPreta: "You are a black belt. You are among the best 5% in the world. 🥋",
  },
  es: {
    ranking: "Ranking Mundial", pctSub: "de todos los jugadores del mundo", fundador: "Fundador",
    hSubi: "Subí de cinturón", hDesci: "Bajé de cinturón", hMantive: "Mantuve mi cinturón", hAtual: "Mi cinturón",
    motSubi: "En la cima está el cinturón negro, el mejor 5% del mundo. Sigue subiendo. 🥋",
    motDesci: "Es solo un mes. Vuelve a subir, recupera tu lugar y sigue hacia el cinturón negro. 🥋",
    motMantive: "Mantienes tu cinturón. Rumbo al negro, la cima del mundo. 🥋",
    motPreta: "Eres cinturón negro. Estás entre el mejor 5% del mundo. 🥋",
  },
  fr: {
    ranking: "Classement Mondial", pctSub: "de tous les joueurs du monde", fundador: "Fondateur",
    hSubi: "J'ai monté de ceinture", hDesci: "J'ai descendu de ceinture", hMantive: "J'ai gardé ma ceinture", hAtual: "Ma ceinture",
    motSubi: "Au sommet se trouve la ceinture noire, les 5% meilleurs du monde. Continue de monter. 🥋",
    motDesci: "Ce n'est qu'un mois. Remonte, reprends ta place et continue vers la ceinture noire. 🥋",
    motMantive: "Tu gardes ta ceinture. Vers la noire, le sommet du monde. 🥋",
    motPreta: "Tu es ceinture noire. Tu fais partie des 5% meilleurs du monde. 🥋",
  },
  de: {
    ranking: "Weltrangliste", pctSub: "aller Spieler weltweit", fundador: "Gründer",
    hSubi: "Ich bin aufgestiegen", hDesci: "Ich bin abgestiegen", hMantive: "Ich habe meinen Gürtel gehalten", hAtual: "Mein Gürtel",
    motSubi: "An der Spitze steht der schwarze Gürtel, die besten 5% der Welt. Steig weiter auf. 🥋",
    motDesci: "Es ist nur ein Monat. Steig wieder auf, hol dir deinen Platz und geh weiter zum schwarzen Gürtel. 🥋",
    motMantive: "Du hältst deinen Gürtel. Auf zum schwarzen, der Spitze der Welt. 🥋",
    motPreta: "Du bist schwarzer Gürtel. Du gehörst zu den besten 5% der Welt. 🥋",
  },
  ja: {
    ranking: "世界ランキング", pctSub: "世界のすべてのプレイヤーの中で", fundador: "創設メンバー",
    hSubi: "帯が上がりました", hDesci: "帯が下がりました", hMantive: "帯を維持しました", hAtual: "私の帯",
    motSubi: "頂点には黒帯、世界の上位5%がいます。登り続けましょう。🥋",
    motDesci: "たった1か月です。また登って、自分の場所を取り戻し、黒帯を目指し続けましょう。🥋",
    motMantive: "帯を守っています。黒帯へ、世界の頂点へ。🥋",
    motPreta: "あなたは黒帯です。世界の上位5%に入っています。🥋",
  },
  ru: {
    ranking: "Мировой рейтинг", pctSub: "среди всех игроков мира", fundador: "Основатель",
    hSubi: "Я поднялся на пояс выше", hDesci: "Я опустился на пояс ниже", hMantive: "Я сохранил свой пояс", hAtual: "Мой пояс",
    motSubi: "На вершине — чёрный пояс, лучшие 5% в мире. Продолжай подниматься. 🥋",
    motDesci: "Это всего один месяц. Поднимись снова, займи своё место и продолжай идти к чёрному поясу. 🥋",
    motMantive: "Ты держишь свой пояс. К чёрному — на вершину мира. 🥋",
    motPreta: "Ты чёрный пояс. Ты среди лучших 5% в мире. 🥋",
  },
};

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

export function CartaoFaixa({
  faixa,
  faixaDe = null,
  situacao = null,
  percentil = null,
  periodoLabel,
  identity,
  fundador = false,
  onClose,
}: {
  faixa: string;
  faixaDe?: string | null;
  situacao?: Sit;
  percentil?: number | null;
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
    const nav = navigator as Navigator & { canShare?: (d: { files?: File[] }) => boolean; share?: (d: unknown) => Promise<void> };
    try {
      if (nav.canShare && nav.canShare({ files: [file] }) && nav.share) {
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

  const fxNova = normalizarFaixa(faixa);
  const corNova = corDaFaixa(fxNova);
  const ehPreta = fxNova === "preta";
  const temTransicao = !!faixaDe && normalizarFaixa(faixaDe) !== fxNova && (situacao === "subiu" || situacao === "desceu");
  const fxVelha = faixaDe ? normalizarFaixa(faixaDe) : fxNova;
  const corVelha = corDaFaixa(fxVelha);
  const corSeta = situacao === "subiu" ? VERDE : VERMELHO;
  const seta = situacao === "subiu" ? "↗" : "↘";

  const headline = situacao === "subiu" ? lbl.hSubi : situacao === "desceu" ? lbl.hDesci : situacao === "manteve" ? lbl.hMantive : lbl.hAtual;
  const motiv = ehPreta ? lbl.motPreta : situacao === "subiu" ? lbl.motSubi : situacao === "desceu" ? lbl.motDesci : lbl.motMantive;
  const exprNova = situacao === "subiu" ? "comemorando" : situacao === "desceu" ? "indicando" : "feliz";
  const topPct = typeof percentil === "number" && percentil > 0 ? `Top ${percentil}%` : null;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(6,8,7,0.88)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18, zIndex: 120, overflowY: "auto" }}>
      <div style={{ width: "100%", maxWidth: 360, background: "#121815", border: `1px solid ${GOLD}`, borderRadius: 16, padding: 18, textAlign: "center" }}>
        <h2 style={{ fontFamily: "var(--font-geist-mono), sans-serif", fontSize: 18, fontWeight: 700, textTransform: "uppercase", margin: "0 0 12px", color: GOLD }}>{headline}</h2>

        <div ref={previewRef} style={{ width: "100%", aspectRatio: "1080 / 1350", borderRadius: 12, overflow: "hidden", marginBottom: 14, position: "relative", background: "#0b0d0a" }}>
          <div style={{ position: "absolute", top: 0, left: 0, width: 1080, height: 1350, transform: `scale(${scale})`, transformOrigin: "top left" }}>
            <FaixaNode
              innerRef={cardRef} corNova={corNova} corVelha={corVelha} corSeta={corSeta} seta={seta}
              temTransicao={temTransicao} exprNova={exprNova} headline={headline} motiv={motiv}
              topPct={topPct} pctSub={lbl.pctSub} ranking={lbl.ranking} nomeNova={rot(fxNova)} nomeVelha={rot(fxVelha)}
              periodoLabel={periodoLabel} identity={identity} fundador={fundador} fundadorLabel={lbl.fundador}
            />
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

function FaixaNode({ innerRef, corNova, corVelha, corSeta, seta, temTransicao, exprNova, headline, motiv, topPct, pctSub, ranking, nomeNova, nomeVelha, periodoLabel, identity, fundador, fundadorLabel }: {
  innerRef: { current: HTMLDivElement | null };
  corNova: string; corVelha: string; corSeta: string; seta: string;
  temTransicao: boolean; exprNova: "comemorando" | "indicando" | "feliz";
  headline: string; motiv: string; topPct: string | null; pctSub: string; ranking: string;
  nomeNova: string; nomeVelha: string; periodoLabel?: string;
  identity: Identity; fundador?: boolean; fundadorLabel: string;
}) {
  const medal = (cor: string, expr: "comemorando" | "indicando" | "feliz", nome: string, destaque: boolean) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, opacity: destaque ? 1 : 0.8 }}>
      <div style={{ width: 190, height: 190, borderRadius: "50%", display: "grid", placeItems: "center",
        background: `radial-gradient(circle at 50% 38%, ${hexA(cor, 0.26)} 0%, rgba(12,14,13,0) 64%)`,
        boxShadow: destaque ? `0 0 0 4px ${hexA(cor, 0.6)}, 0 0 46px ${hexA(cor, 0.45)}` : "none" }}>
        <div style={{ width: 150, height: 150 }}><Mascot belt={cor} expression={expr} /></div>
      </div>
      <div style={{ fontWeight: 700, fontSize: 26, letterSpacing: 2, textTransform: "uppercase", color: cor }}>{nome}</div>
    </div>
  );

  return (
    <div ref={innerRef} style={{
      position: "relative", width: 1080, height: 1350, borderRadius: 34, overflow: "hidden", boxSizing: "border-box",
      fontFamily: FONT, color: "#f1ede2",
      background: "linear-gradient(180deg,#141a17 0%,#10130f 50%,#0b0d0a 100%)",
      boxShadow: `inset 0 0 0 8px ${corNova}`,
    }}>
      <div style={{ position: "absolute", top: -110, left: 0, right: 0, height: 700, background: `radial-gradient(60% 70% at 50% 22%, ${hexA(corNova, 0.30)} 0%, transparent 66%)`, pointerEvents: "none" }} />
      <div style={{ position: "absolute", inset: 0, zIndex: 2, padding: "70px 64px 56px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", boxSizing: "border-box" }}>
        <div style={{ fontWeight: 700, fontSize: 28, letterSpacing: 11, textTransform: "uppercase", color: "#aab4ac" }}>{ranking}</div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 28, marginTop: 26 }}>
          {temTransicao && (
            <>
              {medal(corVelha, "feliz", nomeVelha, false)}
              <div style={{ fontSize: 70, lineHeight: 1, color: corSeta, fontWeight: 900, marginBottom: 34 }}>{seta}</div>
            </>
          )}
          {medal(corNova, exprNova, nomeNova, true)}
        </div>

        <div style={{ fontWeight: 900, fontSize: 42, lineHeight: 1.1, letterSpacing: -0.5, textTransform: "uppercase", color: corNova, marginTop: 22, textShadow: `0 0 34px ${hexA(corNova, 0.38)}` }}>{headline}</div>

        {topPct && (
          <>
            <div style={{ fontWeight: 900, fontSize: 84, lineHeight: 1.05, letterSpacing: -2, color: corNova, marginTop: 22, textShadow: `0 0 30px ${hexA(corNova, 0.38)}` }}>{topPct}</div>
            <div style={{ fontWeight: 600, fontSize: 29, lineHeight: 1.3, letterSpacing: 0.5, textTransform: "uppercase", color: "#cfd8d2", marginTop: 20 }}>{pctSub}</div>
          </>
        )}

        <div style={{ fontWeight: 600, fontSize: 30, lineHeight: 1.45, color: "#e9e4d7", marginTop: 32, maxWidth: 860 }}>{motiv}</div>
        {periodoLabel && <div style={{ fontWeight: 700, fontSize: 25, letterSpacing: 6, textTransform: "uppercase", color: GOLD, marginTop: 20 }}>{periodoLabel}</div>}

        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 14, width: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 22, justifyContent: "center" }}>
            <div style={{ width: 86, height: 96, display: "grid", placeItems: "center", flexShrink: 0 }}><Escudo config={identity} size={86} /></div>
            <div style={{ fontWeight: 700, fontSize: 44, letterSpacing: 0.3, textTransform: "uppercase", color: "#f1ede2", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 760 }}>{identity.name}</div>
          </div>
          {fundador && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 12, padding: "10px 30px", borderRadius: 999, background: hexA(GOLD, 0.14), border: `2px solid ${GOLD}`, color: "#f3dc9b", fontWeight: 700, fontSize: 26, letterSpacing: 5, textTransform: "uppercase" }}>
              <span style={{ color: GOLD, fontSize: 28 }}>★</span><span>{fundadorLabel}</span>
            </div>
          )}
          <div style={{ fontWeight: 700, fontSize: 40, letterSpacing: 8, textTransform: "uppercase", color: GOLD, marginTop: 6 }}>IPPON&nbsp;LEAGUE</div>
          <div style={{ fontFamily: "'Courier New',monospace", fontSize: 24, letterSpacing: 1, color: "#e8cf8f" }}>www.ipponleague.com</div>
        </div>
      </div>
    </div>
  );
}

function hexA(hex: string, a: number): string {
  const c = hex.replace("#", "");
  if (c.length < 6) return hex;
  const r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

const btnFill = (busy: boolean): CSSProperties => ({ width: "100%", padding: 13, borderRadius: 12, border: "none", background: GOLD, color: "#1b211e", fontFamily: "var(--font-geist-mono), sans-serif", fontSize: 15, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", cursor: busy ? "default" : "pointer", opacity: busy ? 0.7 : 1, marginBottom: 10 });
const btnGhost = (busy: boolean): CSSProperties => ({ width: "100%", padding: 13, borderRadius: 12, border: `1px solid ${GOLD}`, background: "transparent", color: GOLD, fontFamily: "var(--font-geist-mono), sans-serif", fontSize: 15, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", cursor: busy ? "default" : "pointer", opacity: busy ? 0.7 : 1 });
