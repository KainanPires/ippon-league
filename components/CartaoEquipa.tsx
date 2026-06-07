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
const sobrenome = (nome: string) => nome.split(" ").slice(-1)[0] || nome;

export interface CartaoProps {
  identity: Identity;
  faixa: string;
  atletas: Athlete[];
  capitao: string | null;
}

// --- ESCUDO no canvas (réplica fiel do componente Escudo, viewBox 56x64) ---

// Caminho da forma do escudo. Devolve um Path2D no espaço do viewBox (0..56, 0..64).
function formaPath(shape: ShapeId): Path2D {
  const p = new Path2D();
  switch (shape) {
    case "circle":
      p.ellipse(28, 32, 26, 26, 0, 0, Math.PI * 2);
      return p;
    case "round":
      return new Path2D("M10 6 H46 a4 4 0 0 1 4 4 V36 C50 50 40 60 28 62 C16 60 6 50 6 36 V10 a4 4 0 0 1 4 -4 Z");
    case "hex":
      return new Path2D("M28 3 L51 16 V48 L28 61 L5 48 V16 Z");
    case "diamond":
      return new Path2D("M28 3 L53 32 L28 61 L3 32 Z");
    default:
      return new Path2D("M28 2 L52 11 V32 C52 49 41 58 28 62 C15 58 4 49 4 32 V11 Z");
  }
}

// Desenha o padrão dentro da forma (já com clip aplicado pelo chamador).
function desenharPadrao(ctx: CanvasRenderingContext2D, pattern: PatternId, c1: string, c2: string) {
  switch (pattern) {
    case "listras-v":
      [0, 14, 28, 42].forEach((x, i) => { ctx.fillStyle = i % 2 ? c2 : c1; ctx.fillRect(x, 0, 14, 64); });
      break;
    case "listras-h":
      [0, 16, 32, 48].forEach((y, i) => { ctx.fillStyle = i % 2 ? c2 : c1; ctx.fillRect(0, y, 56, 16); });
      break;
    case "xadrez":
      for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) { ctx.fillStyle = (r + c) % 2 ? c2 : c1; ctx.fillRect(c * 14, r * 16, 14, 16); }
      break;
    case "cruz":
      ctx.fillStyle = c1; ctx.fillRect(22, 0, 12, 64);
      ctx.fillStyle = c2; ctx.fillRect(0, 26, 56, 12);
      break;
    case "diagonal":
      ctx.fillStyle = c1; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(56, 0); ctx.lineTo(0, 64); ctx.closePath(); ctx.fill();
      ctx.fillStyle = c2; ctx.beginPath(); ctx.moveTo(56, 0); ctx.lineTo(56, 64); ctx.lineTo(0, 64); ctx.closePath(); ctx.fill();
      break;
    case "metade":
      ctx.fillStyle = c1; ctx.fillRect(0, 0, 56, 32);
      ctx.fillStyle = c2; ctx.fillRect(0, 32, 56, 32);
      break;
    default:
      break; // sólido: já tem o gradiente por baixo
  }
}

// Símbolos (viewBox 24x24, desenhados a (16,20) como no componente). Devolve fills a aplicar.
function desenharSimbolo(ctx: CanvasRenderingContext2D, id: SymbolId, color: string) {
  if (id === "none") return;
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  const fill = (d: string) => ctx.fill(new Path2D(d));
  switch (id) {
    case "estrela": fill("M12 1 L15 9 L23 9 L16.5 14 L19 22 L12 17 L5 22 L7.5 14 L1 9 L9 9 Z"); break;
    case "montanha": fill("M2 21 L9 9 L13 14 L17 6 L22 21 Z"); break;
    case "torii":
      fill("M4 5 h16 v2.4 h-16 Z"); fill("M3 8.6 h18 v2.8 h-18 Z");
      fill("M6 11 h2.4 v11 h-2.4 Z"); fill("M15.6 11 h2.4 v11 h-2.4 Z"); break;
    case "chama": fill("M12 1 C16 6 18 10 18 14 A6 6 0 0 1 6 14 C6 11 8.5 9 9 6 C10.5 7.5 12 9.5 12 11.5 C13 9.5 13 4.5 12 1 Z"); break;
    case "raio": fill("M13 1 L4 13 H10.5 L9 23 L20 9 H13 Z"); break;
    case "punho": fill("M5 10 V8 a2 2 0 0 1 4 0 V7 a2 2 0 0 1 4 0 V7 a2 2 0 0 1 4 0 V8 a2 2 0 0 1 4 0 V15 a7 7 0 0 1 -7 7 H11 a6 6 0 0 1 -6 -6 Z"); break;
    case "trofeu":
      fill("M6 3 H18 V6 C18 11 15.5 14 12 14 C8.5 14 6 11 6 6 Z");
      fill("M6 4 C2 4 2 9.5 7.5 10.2 L7.5 8.1 C4.5 7.6 4.6 6 6 6 Z");
      fill("M18 4 C22 4 22 9.5 16.5 10.2 L16.5 8.1 C19.5 7.6 19.4 6 18 6 Z");
      fill("M11 13.5 h2 v4.5 h-2 Z"); fill("M7.5 18 H16.5 L17.5 21.5 H6.5 Z"); break;
    case "taca":
      fill("M4 4 H20 C20 9.5 16.5 13 12 13 C7.5 13 4 9.5 4 4 Z");
      fill("M11 12.5 h2 v4.5 h-2 Z"); fill("M7 17 H17 L18 21 H6 Z"); break;
    case "medalha":
      fill("M8 2 L11.5 9 L9 10 L5.5 3 Z"); fill("M16 2 L12.5 9 L15 10 L18.5 3 Z");
      ctx.beginPath(); ctx.arc(12, 16, 6, 0, Math.PI * 2); ctx.fill(); break;
    case "bandeirola":
      fill("M5 2 h2 v20 h-2 Z"); fill("M7 3 H20 L16 7.5 L20 12 H7 Z"); break;
    case "flamula": fill("M6 2 H18 V19 L12 14.5 L6 19 Z"); break;
    default: break; // mapas/mundo: omitidos (raros); a forma+cor mantêm a coerência
  }
  ctx.restore();
}

// Desenha o escudo completo numa caixa (x,y,w,h), replicando o componente.
function desenharEscudo(ctx: CanvasRenderingContext2D, id: Identity, x: number, y: number, w: number) {
  const h = (w * 64) / 56;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(w / 56, h / 64); // agora desenhamos no espaço 56x64

  const forma = formaPath(id.shape);

  // 1) fundo com gradiente
  ctx.save();
  ctx.clip(forma);
  const g = ctx.createLinearGradient(0, 0, 0, 64);
  g.addColorStop(0, id.bg1);
  g.addColorStop(1, id.bg2);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 56, 64);
  // 2) padrão por cima
  desenharPadrao(ctx, id.pattern, id.stamp1, id.stamp2);
  ctx.restore();

  // 3) símbolo (a translate 16,20 como no componente)
  if (id.symbol !== "none") {
    ctx.save();
    ctx.clip(forma);
    ctx.translate(16, 20);
    desenharSimbolo(ctx, id.symbol, id.border);
    ctx.restore();
  }

  // 4) borda
  ctx.lineWidth = 3;
  ctx.strokeStyle = id.border;
  ctx.lineJoin = "round";
  ctx.stroke(forma);

  ctx.restore();
}

// --- Atleta (kimono de costas com back number) ---
function desenharAtleta(ctx: CanvasRenderingContext2D, a: Athlete, capitao: boolean, cx: number, cy: number, w: number) {
  const h = w * 1.15;
  const x = cx - w / 2;
  const y = cy - h / 2;
  ctx.save();

  roundRect(ctx, x, y, w, h, 14);
  ctx.fillStyle = "rgba(12,14,13,0.55)";
  ctx.fill();
  ctx.lineWidth = capitao ? 3 : 1.5;
  ctx.strokeStyle = capitao ? "#FF8F00" : "#2f4a3c";
  ctx.stroke();

  const kw = w * 0.62, kh = h * 0.42, kx = cx - kw / 2, ky = y + h * 0.13;
  const grad = ctx.createLinearGradient(kx, ky, kx, ky + kh);
  grad.addColorStop(0, "#2a4d3e"); grad.addColorStop(1, "#1c3a2e");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(kx, ky + kh);
  ctx.lineTo(kx + kw * 0.12, ky);
  ctx.lineTo(kx + kw * 0.88, ky);
  ctx.lineTo(kx + kw, ky + kh);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(kx + kw * 0.30, ky);
  ctx.lineTo(cx, ky + kh * 0.42);
  ctx.lineTo(kx + kw * 0.70, ky);
  ctx.stroke();

  const bnW = w * 0.50, bnH = h * 0.16, bnX = cx - bnW / 2, bnY = ky + kh * 0.34;
  ctx.fillStyle = "#f1ede2";
  roundRect(ctx, bnX, bnY, bnW, bnH, 4); ctx.fill();
  ctx.fillStyle = "#1b211e";
  ctx.font = `700 ${Math.round(bnH * 0.72)}px ${FD}`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(code3(a.countryIso), cx, bnY + bnH / 2 + 1);

  ctx.fillStyle = "#f1ede2";
  ctx.font = `700 ${Math.round(w * 0.155)}px ${FD}`;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(cortar(ctx, sobrenome(a.name).toUpperCase(), w * 0.92), cx, y + h * 0.74);

  ctx.fillStyle = "#93a39a";
  ctx.font = `400 ${Math.round(w * 0.125)}px ${FD}`;
  ctx.fillText(`${a.category}kg`, cx, y + h * 0.88);

  if (capitao) {
    const cr = w * 0.16, ccx = x + w - cr * 0.7, ccy = y + cr * 0.7;
    ctx.beginPath(); ctx.arc(ccx, ccy, cr, 0, Math.PI * 2);
    ctx.fillStyle = "#FF8F00"; ctx.fill();
    ctx.fillStyle = "#1b1208";
    ctx.font = `700 ${Math.round(cr * 1.1)}px ${FD}`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("C", ccx, ccy + 1);
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

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#0f1411"); bg.addColorStop(1, "#0c0e0d");
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = "rgba(217,164,65,0.5)"; ctx.lineWidth = 6;
  roundRect(ctx, 24, 24, W - 48, H - 48, 28); ctx.stroke();

  // cabeçalho
  const escW = 150;
  desenharEscudo(ctx, props.identity, 70, 66, escW);

  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#f1ede2"; ctx.font = `700 58px ${FD}`;
  const headerX = 70 + escW + 30;
  ctx.fillText(cortar(ctx, props.identity.name.toUpperCase(), W - 70 - headerX), headerX, 150);
  ctx.fillStyle = GOLD; ctx.font = `700 34px ${FD}`;
  ctx.fillText(`FAIXA ${props.faixa.toUpperCase()}`, headerX, 200);

  ctx.strokeStyle = "#243029"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(70, 262); ctx.lineTo(W - 70, 262); ctx.stroke();

  // grelha 2x4
  const cols = 2, rows = 4, gridTop = 300, gridBottom = H - 180, gx0 = 90, gx1 = W - 90;
  const colW = (gx1 - gx0) / cols, cardW = colW * 0.78, rowH = (gridBottom - gridTop) / rows;
  for (let i = 0; i < 8; i++) {
    const a = props.atletas[i];
    if (!a) continue;
    const col = i % cols, row = Math.floor(i / cols);
    const cx = gx0 + colW * col + colW / 2;
    const cy = gridTop + rowH * row + rowH / 2;
    desenharAtleta(ctx, a, props.capitao === a.id, cx, cy, cardW);
  }

  // rodapé
  ctx.textAlign = "center";
  ctx.fillStyle = GOLD; ctx.font = `700 40px ${FD}`;
  ctx.fillText("IPPON LEAGUE", W / 2, H - 95);
  ctx.fillStyle = "#93a39a"; ctx.font = `400 28px ${FD}`;
  ctx.fillText("O jogo oficial dos fãs de judô", W / 2, H - 55);

  return canvas.toDataURL("image/png");
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
          <img src={img} alt="A minha equipa" style={{ width: "100%", borderRadius: 12, border: "1px solid #243029", marginBottom: 14 }} />
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
