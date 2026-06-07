"use client";

import { useEffect, useRef, useState } from "react";
import type { Athlete } from "@/lib/athletes";
import type { Identity, ShapeId, PatternId, SymbolId } from "@/components/Escudo";

const FD = "var(--font-geist-mono), system-ui, sans-serif";
const GOLD = "#d9a441";

const IOC: Record<string, string> = {
  JP: "JPN", FR: "FRA", BR: "BRA", GE: "GEO", KZ: "KAZ", AZ: "AZE", BE: "BEL",
  TR: "TUR", UZ: "UZB", RU: "AIN", DE: "GER", XK: "KOS", IT: "ITA", CA: "CAN",
  SI: "SLO", HR: "CRO", NL: "NED",
};
const code3 = (iso: string) => IOC[iso] || iso;
const sobrenome = (nome: string) => (nome.split(" ").slice(-1)[0] || nome);

export interface CartaoProps {
  identity: Identity;
  faixa: string;
  atletas: Athlete[];
  capitao: string | null;
}

// --- TEMA POR FAIXA ----------------------------------------------------------
// Cada faixa dá uma identidade visual à carta: cor de sotaque, brilho e moldura.
type Tema = {
  nome: string;
  accent: string;   // cor principal da faixa
  accent2: string;  // cor secundária / brilho
  glow: number;     // intensidade do brilho (0..1)
  moldura: number;  // espessura da moldura
  bgTop: string;    // topo do fundo
  bgBot: string;    // base do fundo
  textoFaixa: string; // cor do texto da faixa
};
const TEMAS: Record<string, Tema> = {
  branca:  { nome: "Branca",  accent: "#d7dcd6", accent2: "#9fb0a6", glow: 0.10, moldura: 5, bgTop: "#141a17", bgBot: "#0c0e0d", textoFaixa: "#e8ece6" },
  azul:    { nome: "Azul",    accent: "#3f86d6", accent2: "#1c4f86", glow: 0.30, moldura: 6, bgTop: "#10171f", bgBot: "#0a0d11", textoFaixa: "#8fc0f2" },
  amarela: { nome: "Amarela", accent: "#e6b422", accent2: "#a97f10", glow: 0.34, moldura: 6, bgTop: "#1a1710", bgBot: "#0c0a06", textoFaixa: "#f5d873" },
  verde:   { nome: "Verde",   accent: "#3f9f5a", accent2: "#1c5e32", glow: 0.32, moldura: 6, bgTop: "#101a13", bgBot: "#080d09", textoFaixa: "#8fe0a8" },
  roxa:    { nome: "Roxa",    accent: "#9b6cc9", accent2: "#5a327f", glow: 0.42, moldura: 7, bgTop: "#16101f", bgBot: "#0a070f", textoFaixa: "#c9a8ee" },
  castanha:{ nome: "Castanha",accent: "#a06a3a", accent2: "#5e3a1c", glow: 0.40, moldura: 7, bgTop: "#1a130d", bgBot: "#0c0805", textoFaixa: "#d6a877" },
  preta:   { nome: "Preta",   accent: "#d9a441", accent2: "#8a6420", glow: 0.55, moldura: 9, bgTop: "#15140f", bgBot: "#070605", textoFaixa: "#f0d79a" },
};
function temaDaFaixa(faixa: string): Tema {
  const k = (faixa || "").trim().toLowerCase();
  return TEMAS[k] || TEMAS.branca;
}

// --- ESCUDO no canvas (réplica fiel do componente Escudo, viewBox 56x64) -----
function formaPath(shape: ShapeId): Path2D {
  const p = new Path2D();
  switch (shape) {
    case "circle": p.ellipse(28, 32, 26, 26, 0, 0, Math.PI * 2); return p;
    case "round": return new Path2D("M10 6 H46 a4 4 0 0 1 4 4 V36 C50 50 40 60 28 62 C16 60 6 50 6 36 V10 a4 4 0 0 1 4 -4 Z");
    case "hex": return new Path2D("M28 3 L51 16 V48 L28 61 L5 48 V16 Z");
    case "diamond": return new Path2D("M28 3 L53 32 L28 61 L3 32 Z");
    default: return new Path2D("M28 2 L52 11 V32 C52 49 41 58 28 62 C15 58 4 49 4 32 V11 Z");
  }
}
function desenharPadrao(ctx: CanvasRenderingContext2D, pattern: PatternId, c1: string, c2: string) {
  switch (pattern) {
    case "listras-v": [0, 14, 28, 42].forEach((x, i) => { ctx.fillStyle = i % 2 ? c2 : c1; ctx.fillRect(x, 0, 14, 64); }); break;
    case "listras-h": [0, 16, 32, 48].forEach((y, i) => { ctx.fillStyle = i % 2 ? c2 : c1; ctx.fillRect(0, y, 56, 16); }); break;
    case "xadrez": for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) { ctx.fillStyle = (r + c) % 2 ? c2 : c1; ctx.fillRect(c * 14, r * 16, 14, 16); } break;
    case "cruz": ctx.fillStyle = c1; ctx.fillRect(22, 0, 12, 64); ctx.fillStyle = c2; ctx.fillRect(0, 26, 56, 12); break;
    case "diagonal":
      ctx.fillStyle = c1; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(56, 0); ctx.lineTo(0, 64); ctx.closePath(); ctx.fill();
      ctx.fillStyle = c2; ctx.beginPath(); ctx.moveTo(56, 0); ctx.lineTo(56, 64); ctx.lineTo(0, 64); ctx.closePath(); ctx.fill(); break;
    case "metade": ctx.fillStyle = c1; ctx.fillRect(0, 0, 56, 32); ctx.fillStyle = c2; ctx.fillRect(0, 32, 56, 32); break;
    default: break;
  }
}
function desenharSimbolo(ctx: CanvasRenderingContext2D, id: SymbolId, color: string) {
  if (id === "none") return;
  ctx.save(); ctx.fillStyle = color; ctx.strokeStyle = color;
  const fill = (d: string) => ctx.fill(new Path2D(d));
  switch (id) {
    case "estrela": fill("M12 1 L15 9 L23 9 L16.5 14 L19 22 L12 17 L5 22 L7.5 14 L1 9 L9 9 Z"); break;
    case "montanha": fill("M2 21 L9 9 L13 14 L17 6 L22 21 Z"); break;
    case "torii": fill("M4 5 h16 v2.4 h-16 Z"); fill("M3 8.6 h18 v2.8 h-18 Z"); fill("M6 11 h2.4 v11 h-2.4 Z"); fill("M15.6 11 h2.4 v11 h-2.4 Z"); break;
    case "chama": fill("M12 1 C16 6 18 10 18 14 A6 6 0 0 1 6 14 C6 11 8.5 9 9 6 C10.5 7.5 12 9.5 12 11.5 C13 9.5 13 4.5 12 1 Z"); break;
    case "raio": fill("M13 1 L4 13 H10.5 L9 23 L20 9 H13 Z"); break;
    case "punho": fill("M5 10 V8 a2 2 0 0 1 4 0 V7 a2 2 0 0 1 4 0 V7 a2 2 0 0 1 4 0 V8 a2 2 0 0 1 4 0 V15 a7 7 0 0 1 -7 7 H11 a6 6 0 0 1 -6 -6 Z"); break;
    case "trofeu":
      fill("M6 3 H18 V6 C18 11 15.5 14 12 14 C8.5 14 6 11 6 6 Z");
      fill("M6 4 C2 4 2 9.5 7.5 10.2 L7.5 8.1 C4.5 7.6 4.6 6 6 6 Z");
      fill("M18 4 C22 4 22 9.5 16.5 10.2 L16.5 8.1 C19.5 7.6 19.4 6 18 6 Z");
      fill("M11 13.5 h2 v4.5 h-2 Z"); fill("M7.5 18 H16.5 L17.5 21.5 H6.5 Z"); break;
    case "taca": fill("M4 4 H20 C20 9.5 16.5 13 12 13 C7.5 13 4 9.5 4 4 Z"); fill("M11 12.5 h2 v4.5 h-2 Z"); fill("M7 17 H17 L18 21 H6 Z"); break;
    case "medalha": fill("M8 2 L11.5 9 L9 10 L5.5 3 Z"); fill("M16 2 L12.5 9 L15 10 L18.5 3 Z"); ctx.beginPath(); ctx.arc(12, 16, 6, 0, Math.PI * 2); ctx.fill(); break;
    case "bandeirola": fill("M5 2 h2 v20 h-2 Z"); fill("M7 3 H20 L16 7.5 L20 12 H7 Z"); break;
    case "flamula": fill("M6 2 H18 V19 L12 14.5 L6 19 Z"); break;
    default: break;
  }
  ctx.restore();
}
function desenharEscudo(ctx: CanvasRenderingContext2D, id: Identity, x: number, y: number, w: number) {
  const h = (w * 64) / 56;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(w / 56, h / 64);
  const forma = formaPath(id.shape);
  ctx.save();
  ctx.clip(forma);
  const g = ctx.createLinearGradient(0, 0, 0, 64);
  g.addColorStop(0, id.bg1); g.addColorStop(1, id.bg2);
  ctx.fillStyle = g; ctx.fillRect(0, 0, 56, 64);
  desenharPadrao(ctx, id.pattern, id.stamp1, id.stamp2);
  ctx.restore();
  if (id.symbol !== "none") {
    ctx.save(); ctx.clip(forma); ctx.translate(16, 20);
    desenharSimbolo(ctx, id.symbol, id.border); ctx.restore();
  }
  ctx.lineWidth = 3; ctx.strokeStyle = id.border; ctx.lineJoin = "round"; ctx.stroke(forma);
  ctx.restore();
}

// --- CROMO do atleta (limpo, legível) ----------------------------------------
function desenharCromo(ctx: CanvasRenderingContext2D, a: Athlete, capitao: boolean, x: number, y: number, w: number, h: number, tema: Tema) {
  ctx.save();
  // fundo do cromo
  const r = 18;
  roundRect(ctx, x, y, w, h, r);
  const cardGrad = ctx.createLinearGradient(x, y, x, y + h);
  cardGrad.addColorStop(0, "#181f1b");
  cardGrad.addColorStop(1, "#0f1411");
  ctx.fillStyle = cardGrad; ctx.fill();
  ctx.lineWidth = capitao ? 3 : 1.5;
  ctx.strokeStyle = capitao ? tema.accent : "#2a342d";
  ctx.stroke();

  // brilho da faixa no topo do cromo (banda fina)
  ctx.save();
  roundRect(ctx, x, y, w, h, r); ctx.clip();
  ctx.fillStyle = capitao ? tema.accent : tema.accent2;
  ctx.globalAlpha = capitao ? 0.9 : 0.5;
  ctx.fillRect(x, y, w, 6);
  ctx.restore();

  // etiqueta de país (tipo bandeira) à esquerda em cima
  const padX = w * 0.10;
  const tagY = y + h * 0.14;
  const tagH = h * 0.17;
  const tagW = w * 0.48;
  roundRect(ctx, x + padX, tagY, tagW, tagH, 6);
  ctx.fillStyle = tema.accent; ctx.fill();
  ctx.fillStyle = "#0c0e0d";
  ctx.font = `700 ${Math.round(tagH * 0.62)}px ${FD}`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(code3(a.countryIso), x + padX + tagW / 2, tagY + tagH / 2 + 1);

  // preço JC à direita em cima
  ctx.fillStyle = "#7fd1a3";
  ctx.font = `700 ${Math.round(h * 0.10)}px ${FD}`;
  ctx.textAlign = "right"; ctx.textBaseline = "middle";
  ctx.fillText(`JC ${a.priceJc.toFixed(0)}`, x + w - padX, tagY + tagH / 2 + 1);

  // sobrenome grande
  ctx.fillStyle = "#f1ede2";
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  let fs = Math.round(w * 0.155);
  ctx.font = `700 ${fs}px ${FD}`;
  let nome = sobrenome(a.name).toUpperCase();
  const maxNome = w - padX * 2;
  while (fs > 14 && ctx.measureText(nome).width > maxNome) { fs -= 1; ctx.font = `700 ${fs}px ${FD}`; }
  ctx.fillText(cortar(ctx, nome, maxNome), x + padX, y + h * 0.62);

  // categoria
  ctx.fillStyle = "#93a39a";
  ctx.font = `400 ${Math.round(w * 0.105)}px ${FD}`;
  ctx.fillText(`${a.category}kg`, x + padX, y + h * 0.78);

  // selo de capitão: barra dourada em baixo
  if (capitao) {
    ctx.save();
    roundRect(ctx, x, y, w, h, r); ctx.clip();
    ctx.fillStyle = tema.accent;
    ctx.fillRect(x, y + h - h * 0.16, w, h * 0.16);
    ctx.fillStyle = "#0c0e0d";
    ctx.font = `700 ${Math.round(h * 0.085)}px ${FD}`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("CAPITÃO · PONTUA A DOBRAR", x + w / 2, y + h - h * 0.08 + 1);
    ctx.restore();
  }
  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function cortar(ctx: CanvasRenderingContext2D, txt: string, maxW: number): string {
  if (ctx.measureText(txt).width <= maxW) return txt;
  let s = txt;
  while (s.length > 1 && ctx.measureText(s + "…").width > maxW) s = s.slice(0, -1);
  return s + "…";
}

function desenharCartao(canvas: HTMLCanvasElement, props: CartaoProps): string {
  const W = 1080, H = 1350;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  const tema = temaDaFaixa(props.faixa);

  // fundo: gradiente + vinheta
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, tema.bgTop); bg.addColorStop(1, tema.bgBot);
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  // brilho radial subtil da cor da faixa, no topo
  const rg = ctx.createRadialGradient(W / 2, 230, 40, W / 2, 230, 620);
  rg.addColorStop(0, hexA(tema.accent, tema.glow));
  rg.addColorStop(1, hexA(tema.accent, 0));
  ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);

  // moldura (espessura/brilho dependem da faixa)
  ctx.save();
  ctx.shadowColor = hexA(tema.accent, tema.glow);
  ctx.shadowBlur = 40 * tema.glow + 6;
  ctx.strokeStyle = tema.accent;
  ctx.lineWidth = tema.moldura;
  roundRect(ctx, 26, 26, W - 52, H - 52, 30);
  ctx.stroke();
  ctx.restore();
  // moldura interior fina (toque "carta rara")
  ctx.strokeStyle = hexA(tema.accent, 0.35);
  ctx.lineWidth = 1.5;
  roundRect(ctx, 40, 40, W - 80, H - 80, 24);
  ctx.stroke();

  // cabeçalho: escudo
  const escW = 132;
  desenharEscudo(ctx, props.identity, 74, 74, escW);

  // nome
  const headerX = 74 + escW + 28;
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#f1ede2";
  let nf = 52; ctx.font = `700 ${nf}px ${FD}`;
  const nome = props.identity.name.toUpperCase();
  const maxHeader = W - 74 - headerX;
  while (nf > 28 && ctx.measureText(nome).width > maxHeader) { nf -= 1; ctx.font = `700 ${nf}px ${FD}`; }
  ctx.fillText(cortar(ctx, nome, maxHeader), headerX, 132);

  // FAIXA em destaque (pílula com a cor da faixa)
  const fLabel = `FAIXA ${tema.nome.toUpperCase()}`;
  ctx.font = `700 30px ${FD}`;
  const fw = ctx.measureText(fLabel).width;
  const pillH = 46, pillW = fw + 46, pillX = headerX, pillY = 152;
  roundRect(ctx, pillX, pillY, pillW, pillH, pillH / 2);
  ctx.save();
  ctx.shadowColor = hexA(tema.accent, tema.glow); ctx.shadowBlur = 24 * tema.glow;
  ctx.fillStyle = hexA(tema.accent, 0.18); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = tema.accent; ctx.lineWidth = 2; ctx.stroke();
  // ícone de faixa (knot) — pequeno retângulo arredondado
  ctx.fillStyle = tema.accent;
  roundRect(ctx, pillX + 16, pillY + pillH / 2 - 7, 18, 14, 3); ctx.fill();
  ctx.fillStyle = tema.textoFaixa;
  ctx.textAlign = "left"; ctx.textBaseline = "middle";
  ctx.fillText(fLabel, pillX + 44, pillY + pillH / 2 + 1);

  // linha separadora
  ctx.strokeStyle = hexA(tema.accent, 0.25); ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(74, 250); ctx.lineTo(W - 74, 250); ctx.stroke();

  // grelha 2x4 de cromos
  const cols = 2, rows = 4;
  const gridTop = 286, gridBottom = H - 196;
  const gx0 = 74, gx1 = W - 74;
  const gapX = 26, gapY = 22;
  const colW = (gx1 - gx0 - gapX * (cols - 1)) / cols;
  const cromoH = (gridBottom - gridTop - gapY * (rows - 1)) / rows;
  for (let i = 0; i < 8; i++) {
    const a = props.atletas[i];
    const col = i % cols, row = Math.floor(i / cols);
    const x = gx0 + (colW + gapX) * col;
    const y = gridTop + (cromoH + gapY) * row;
    if (!a) { // lugar vazio
      ctx.save();
      roundRect(ctx, x, y, colW, cromoH, 18);
      ctx.fillStyle = "rgba(255,255,255,0.02)"; ctx.fill();
      ctx.setLineDash([8, 6]); ctx.strokeStyle = hexA(tema.accent, 0.4); ctx.lineWidth = 1.5; ctx.stroke();
      ctx.restore();
      continue;
    }
    desenharCromo(ctx, a, props.capitao === a.id, x, y, colW, cromoH, tema);
  }

  // rodapé
  ctx.textAlign = "center";
  ctx.fillStyle = tema.accent; ctx.font = `700 38px ${FD}`;
  ctx.fillText("IPPON LEAGUE", W / 2, H - 104);
  ctx.fillStyle = "#93a39a"; ctx.font = `400 26px ${FD}`;
  ctx.fillText("O jogo oficial dos fãs de judô", W / 2, H - 64);

  return canvas.toDataURL("image/png");
}

// cor hex + alpha -> rgba()
function hexA(hex: string, a: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

export function CartaoEquipa({ identity, faixa, atletas, capitao, onClose }: CartaoProps & { onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [img, setImg] = useState<string>("");
  const [podePartilhar, setPodePartilhar] = useState(false);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    try { setImg(desenharCartao(c, { identity, faixa, atletas, capitao })); } catch { setImg(""); }
    try {
      const nav = navigator as Navigator & { canShare?: (d: { files?: File[] }) => boolean };
      setPodePartilhar(typeof nav.share === "function");
    } catch { setPodePartilhar(false); }
  }, [identity, faixa, atletas, capitao]);

  async function dataUrlParaFicheiro(): Promise<File | null> {
    if (!img) return null;
    try {
      const blob = await (await fetch(img)).blob();
      return new File([blob], "ippon-equipa.png", { type: "image/png" });
    } catch { return null; }
  }
  async function partilhar() {
    const file = await dataUrlParaFicheiro();
    const nav = navigator as Navigator & { canShare?: (d: { files?: File[] }) => boolean };
    try {
      if (file && nav.canShare && nav.canShare({ files: [file] })) {
        await nav.share({ files: [file], title: "A minha equipa Ippon League", text: "Vê a minha equipa na Ippon League!" });
        return;
      }
      if (nav.share) { await nav.share({ title: "Ippon League", text: "Vê a minha equipa na Ippon League!" }); }
    } catch { /* cancelado */ }
  }
  function guardar() {
    if (!img) return;
    const a = document.createElement("a");
    a.href = img; a.download = "ippon-equipa.png";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(6,8,7,0.86)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18, zIndex: 120 }}>
      <div style={{ width: "100%", maxWidth: 340, background: "#121815", border: `1px solid ${GOLD}`, borderRadius: 16, padding: 18, textAlign: "center" }}>
        <h2 style={{ fontFamily: FD, fontSize: 18, fontWeight: 700, textTransform: "uppercase", margin: "0 0 12px", color: GOLD }}>Partilhar a equipa</h2>
        <canvas ref={canvasRef} style={{ display: "none" }} />
        {img ? (
          <img src={img} alt="A minha equipa" style={{ width: "100%", borderRadius: 12, marginBottom: 14 }} />
        ) : (
          <div style={{ padding: "40px 0", color: "#93a39a", fontSize: 13 }}>A gerar o cartão…</div>
        )}
        {podePartilhar && (
          <button onClick={partilhar} style={{ width: "100%", padding: 13, borderRadius: 12, border: "none", background: GOLD, color: "#1b211e", fontFamily: FD, fontSize: 15, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", cursor: "pointer", marginBottom: 10 }}>Partilhar</button>
        )}
        <button onClick={guardar} disabled={!img} style={{ width: "100%", padding: 13, borderRadius: 12, border: `1px solid ${GOLD}`, background: "transparent", color: GOLD, fontFamily: FD, fontSize: 15, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", cursor: img ? "pointer" : "default", opacity: img ? 1 : 0.5 }}>Guardar imagem</button>
        <button onClick={onClose} style={{ marginTop: 10, background: "transparent", border: "none", color: "#93a39a", fontSize: 13, cursor: "pointer" }}>Fechar</button>
      </div>
    </div>
  );
}
