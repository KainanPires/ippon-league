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
type Tema = { nome: string; accent: string; accent2: string; glow: number; moldura: number; bgTop: string; bgBot: string; textoFaixa: string; };
const TEMAS: Record<string, Tema> = {
  branca:  { nome: "Branca",  accent: "#d7dcd6", accent2: "#9fb0a6", glow: 0.10, moldura: 6, bgTop: "#141a17", bgBot: "#0c0e0d", textoFaixa: "#1b211e" },
  azul:    { nome: "Azul",    accent: "#3f86d6", accent2: "#1c4f86", glow: 0.30, moldura: 7, bgTop: "#10171f", bgBot: "#0a0d11", textoFaixa: "#0c0e0d" },
  amarela: { nome: "Amarela", accent: "#e6b422", accent2: "#a97f10", glow: 0.34, moldura: 7, bgTop: "#1a1710", bgBot: "#0c0a06", textoFaixa: "#1b211e" },
  verde:   { nome: "Verde",   accent: "#3f9f5a", accent2: "#1c5e32", glow: 0.32, moldura: 7, bgTop: "#101a13", bgBot: "#080d09", textoFaixa: "#0c0e0d" },
  roxa:    { nome: "Roxa",    accent: "#9b6cc9", accent2: "#5a327f", glow: 0.42, moldura: 8, bgTop: "#16101f", bgBot: "#0a070f", textoFaixa: "#0c0e0d" },
  castanha:{ nome: "Castanha",accent: "#a06a3a", accent2: "#5e3a1c", glow: 0.40, moldura: 8, bgTop: "#1a130d", bgBot: "#0c0805", textoFaixa: "#0c0e0d" },
  preta:   { nome: "Preta",   accent: "#d9a441", accent2: "#8a6420", glow: 0.55, moldura: 10, bgTop: "#15140f", bgBot: "#070605", textoFaixa: "#1b211e" },
};
function temaDaFaixa(faixa: string): Tema {
  const k = (faixa || "").trim().toLowerCase();
  return TEMAS[k] || TEMAS.branca;
}

// --- ESCUDO no canvas (réplica fiel, viewBox 56x64) --------------------------
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
  ctx.save(); ctx.translate(x, y); ctx.scale(w / 56, h / 64);
  const forma = formaPath(id.shape);
  ctx.save(); ctx.clip(forma);
  const g = ctx.createLinearGradient(0, 0, 0, 64);
  g.addColorStop(0, id.bg1); g.addColorStop(1, id.bg2);
  ctx.fillStyle = g; ctx.fillRect(0, 0, 56, 64);
  desenharPadrao(ctx, id.pattern, id.stamp1, id.stamp2);
  ctx.restore();
  if (id.symbol !== "none") { ctx.save(); ctx.clip(forma); ctx.translate(16, 20); desenharSimbolo(ctx, id.symbol, id.border); ctx.restore(); }
  ctx.lineWidth = 3; ctx.strokeStyle = id.border; ctx.lineJoin = "round"; ctx.stroke(forma);
  ctx.restore();
}

// --- LINHA de atleta (toda a largura → texto GRANDE e legível) ---------------
function desenharLinha(ctx: CanvasRenderingContext2D, a: Athlete, capitao: boolean, x: number, y: number, w: number, h: number, tema: Tema) {
  ctx.save();
  const r = 16;
  roundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = capitao ? hexA(tema.accent, 0.16) : "rgba(255,255,255,0.035)";
  ctx.fill();
  ctx.lineWidth = capitao ? 2.5 : 1.5;
  ctx.strokeStyle = capitao ? tema.accent : "#2a342d";
  ctx.stroke();

  const padX = h * 0.32;
  const cy = y + h / 2;

  // etiqueta de país (grande, cor da faixa)
  const tagW = w * 0.155, tagH = h * 0.50, tagX = x + padX, tagY = cy - tagH / 2;
  roundRect(ctx, tagX, tagY, tagW, tagH, 7);
  ctx.fillStyle = tema.accent; ctx.fill();
  ctx.fillStyle = tema.textoFaixa;
  ctx.font = `700 ${Math.round(tagH * 0.46)}px ${FD}`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(code3(a.countryIso), tagX + tagW / 2, cy + 1);

  // nome grande
  const nomeX = tagX + tagW + h * 0.34;
  ctx.fillStyle = "#f1ede2";
  ctx.textAlign = "left"; ctx.textBaseline = "middle";
  let fs = Math.round(h * 0.40);
  ctx.font = `700 ${fs}px ${FD}`;
  const catTxt = `${a.category}kg`;
  ctx.font = `400 ${Math.round(h * 0.30)}px ${FD}`;
  const catW = ctx.measureText(catTxt).width;
  const capW = capitao ? h * 0.9 : 0;
  const nomeMax = x + w - padX - catW - h * 0.4 - capW - nomeX;
  ctx.font = `700 ${fs}px ${FD}`;
  let nome = sobrenome(a.name).toUpperCase();
  while (fs > 18 && ctx.measureText(nome).width > nomeMax) { fs -= 1; ctx.font = `700 ${fs}px ${FD}`; }
  ctx.fillText(cortar(ctx, nome, nomeMax), nomeX, cy + 1);

  // categoria à direita (antes do selo de capitão, se houver)
  ctx.fillStyle = "#93a39a";
  ctx.font = `400 ${Math.round(h * 0.30)}px ${FD}`;
  ctx.textAlign = "right"; ctx.textBaseline = "middle";
  const catX = x + w - padX - capW;
  ctx.fillText(catTxt, catX, cy + 1);

  // selo de capitão (círculo dourado "C" à direita)
  if (capitao) {
    const cr = h * 0.30;
    const ccx = x + w - padX - cr;
    roundCircle(ctx, ccx, cy, cr);
    ctx.fillStyle = tema.accent; ctx.fill();
    ctx.fillStyle = tema.textoFaixa;
    ctx.font = `700 ${Math.round(cr * 1.2)}px ${FD}`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("C", ccx, cy + 1);
  }
  ctx.restore();
}
function roundCircle(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) { ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); }

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
function hexA(hex: string, a: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function desenharCartao(canvas: HTMLCanvasElement, props: CartaoProps & { pro: boolean }): string {
  const W = 1080, H = 1350;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  const tema = temaDaFaixa(props.faixa);
  const pro = props.pro;

  // fundo
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, tema.bgTop); bg.addColorStop(1, tema.bgBot);
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  const rg = ctx.createRadialGradient(W / 2, 260, 40, W / 2, 260, 660);
  rg.addColorStop(0, hexA(tema.accent, pro ? tema.glow + 0.12 : tema.glow));
  rg.addColorStop(1, hexA(tema.accent, 0));
  ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);

  // moldura (Pro: dourada, mais grossa, brilho extra + moldura dupla)
  const molCor = pro ? GOLD : tema.accent;
  const molEsp = pro ? tema.moldura + 4 : tema.moldura;
  ctx.save();
  ctx.shadowColor = hexA(molCor, pro ? 0.7 : tema.glow);
  ctx.shadowBlur = (pro ? 60 : 40) * (tema.glow + (pro ? 0.3 : 0)) + 6;
  ctx.strokeStyle = molCor; ctx.lineWidth = molEsp;
  roundRect(ctx, 26, 26, W - 52, H - 52, 30); ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = hexA(molCor, pro ? 0.6 : 0.35); ctx.lineWidth = pro ? 2.5 : 1.5;
  roundRect(ctx, 42, 42, W - 84, H - 84, 24); ctx.stroke();

  // emblema PRO (topo centro), só se pro
  let topo = 80;
  if (pro) {
    const eW = 260, eH = 56, eX = W / 2 - eW / 2, eY = 56;
    ctx.save();
    ctx.shadowColor = hexA(GOLD, 0.8); ctx.shadowBlur = 30;
    roundRect(ctx, eX, eY, eW, eH, eH / 2);
    const gg = ctx.createLinearGradient(eX, eY, eX, eY + eH);
    gg.addColorStop(0, "#f0d79a"); gg.addColorStop(1, GOLD);
    ctx.fillStyle = gg; ctx.fill();
    ctx.restore();
    ctx.fillStyle = "#1b1208";
    ctx.font = `700 30px ${FD}`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("★ IPPON PRO ★", W / 2, eY + eH / 2 + 1);
    topo = 140;
  }

  // cabeçalho: escudo
  const escW = 120;
  desenharEscudo(ctx, props.identity, 74, topo, escW);

  // nome
  const headerX = 74 + escW + 28;
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#f1ede2";
  let nf = 50; ctx.font = `700 ${nf}px ${FD}`;
  const nome = props.identity.name.toUpperCase();
  const maxHeader = W - 74 - headerX;
  while (nf > 26 && ctx.measureText(nome).width > maxHeader) { nf -= 1; ctx.font = `700 ${nf}px ${FD}`; }
  ctx.fillText(cortar(ctx, nome, maxHeader), headerX, topo + 50);

  // pílula da faixa
  const fLabel = `FAIXA ${tema.nome.toUpperCase()}`;
  ctx.font = `700 28px ${FD}`;
  const fw = ctx.measureText(fLabel).width;
  const pillH = 44, pillW = fw + 62, pillX = headerX, pillY = topo + 66;
  roundRect(ctx, pillX, pillY, pillW, pillH, pillH / 2);
  ctx.save();
  ctx.shadowColor = hexA(tema.accent, tema.glow); ctx.shadowBlur = 24 * tema.glow;
  ctx.fillStyle = tema.accent; ctx.fill();
  ctx.restore();
  ctx.fillStyle = tema.textoFaixa;
  ctx.textAlign = "left"; ctx.textBaseline = "middle";
  // nó da faixa
  ctx.fillRect(pillX + 18, pillY + pillH / 2 - 8, 20, 16);
  ctx.fillText(fLabel, pillX + 48, pillY + pillH / 2 + 1);

  // separador
  const sepY = topo + 150;
  ctx.strokeStyle = hexA(tema.accent, 0.25); ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(74, sepY); ctx.lineTo(W - 74, sepY); ctx.stroke();

  // 8 linhas de atletas (toda a largura)
  const listTop = sepY + 26;
  const listBottom = H - (pro ? 150 : 130);
  const gap = 16;
  const lineH = (listBottom - listTop - gap * 7) / 8;
  for (let i = 0; i < 8; i++) {
    const a = props.atletas[i];
    const y = listTop + (lineH + gap) * i;
    if (!a) {
      roundRect(ctx, 74, y, W - 148, lineH, 16);
      ctx.fillStyle = "rgba(255,255,255,0.02)"; ctx.fill();
      ctx.save(); ctx.setLineDash([8, 6]); ctx.strokeStyle = hexA(tema.accent, 0.35); ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore();
      continue;
    }
    desenharLinha(ctx, a, props.capitao === a.id, 74, y, W - 148, lineH, tema);
  }

  // rodapé
  ctx.textAlign = "center";
  if (pro) {
    ctx.fillStyle = GOLD; ctx.font = `700 36px ${FD}`;
    ctx.fillText("JOGA COM VANTAGEM. SÊ IPPON PRO.", W / 2, H - 92);
    ctx.fillStyle = "#93a39a"; ctx.font = `400 24px ${FD}`;
    ctx.fillText("ippon-league.vercel.app", W / 2, H - 56);
  } else {
    ctx.fillStyle = tema.accent; ctx.font = `700 36px ${FD}`;
    ctx.fillText("IPPON LEAGUE", W / 2, H - 88);
    ctx.fillStyle = "#93a39a"; ctx.font = `400 24px ${FD}`;
    ctx.fillText("O jogo oficial dos fãs de judô", W / 2, H - 52);
  }

  return canvas.toDataURL("image/png");
}

export function CartaoEquipa({ identity, faixa, atletas, capitao, pro = false, onClose }: CartaoProps & { pro?: boolean; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [img, setImg] = useState<string>("");
  const [podePartilhar, setPodePartilhar] = useState(false);
  // Interruptor de TESTE: deixa ver a versão Pro mesmo sem conta Pro. Remover quando o Pro estiver ligado a sério.
  const [verPro, setVerPro] = useState(pro);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    try { setImg(desenharCartao(c, { identity, faixa, atletas, capitao, pro: verPro })); } catch { setImg(""); }
    try {
      const nav = navigator as Navigator & { canShare?: (d: { files?: File[] }) => boolean };
      setPodePartilhar(typeof nav.share === "function");
    } catch { setPodePartilhar(false); }
  }, [identity, faixa, atletas, capitao, verPro]);

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
      <div style={{ width: "100%", maxWidth: 360, background: "#121815", border: `1px solid ${GOLD}`, borderRadius: 16, padding: 18, textAlign: "center" }}>
        <h2 style={{ fontFamily: FD, fontSize: 18, fontWeight: 700, textTransform: "uppercase", margin: "0 0 12px", color: GOLD }}>Partilhar a equipa</h2>

        {/* Interruptor de TESTE — alterna a vista Normal/Pro do cartão. Remover quando o Pro estiver ligado. */}
        <div style={{ display: "flex", gap: 6, marginBottom: 12, background: "#0c0e0d", border: "1px solid #243029", borderRadius: 10, padding: 4 }}>
          {[{ k: false, lbl: "Normal" }, { k: true, lbl: "Pro" }].map((opt) => (
            <button
              key={String(opt.k)}
              onClick={() => setVerPro(opt.k)}
              style={{
                flex: 1, padding: "8px 0", borderRadius: 7, border: "none", cursor: "pointer",
                fontFamily: FD, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em",
                background: verPro === opt.k ? GOLD : "transparent",
                color: verPro === opt.k ? "#1b211e" : "#93a39a",
              }}
            >
              {opt.lbl}
            </button>
          ))}
        </div>

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
