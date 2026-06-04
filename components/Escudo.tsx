"use client";

export type ShapeId = "classic" | "round" | "circle" | "hex" | "diamond";
export type PatternId = "solido" | "listras-v" | "listras-h" | "xadrez" | "cruz" | "diagonal" | "metade";
export type SymbolId = "none" | "estrela" | "montanha" | "torii" | "chama" | "raio" | "punho";

export type Identity = {
  name: string;
  shape: ShapeId;
  pattern: PatternId;
  bg1: string;
  bg2: string;
  stamp1: string;
  stamp2: string;
  border: string;
  symbol: SymbolId;
};

export const DEFAULT_IDENTITY: Identity = {
  name: "A minha equipa",
  shape: "classic",
  pattern: "solido",
  bg1: "#1c3a2e",
  bg2: "#2a4d3e",
  stamp1: "#d9a441",
  stamp2: "#efeadd",
  border: "#d9a441",
  symbol: "estrela",
};

const KEY = "ippon_identity";

export function loadIdentity(): Identity {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_IDENTITY;
    return { ...DEFAULT_IDENTITY, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_IDENTITY;
  }
}
export function saveIdentity(id: Identity) {
  try { localStorage.setItem(KEY, JSON.stringify(id)); } catch {}
}

export const SHAPES: ShapeId[] = ["classic", "round", "circle", "hex", "diamond"];
export const PATTERNS: { id: PatternId; label: string }[] = [
  { id: "solido", label: "Sólido" },
  { id: "listras-v", label: "Riscas" },
  { id: "listras-h", label: "Faixas" },
  { id: "xadrez", label: "Xadrez" },
  { id: "cruz", label: "Cruz" },
  { id: "diagonal", label: "Diagonal" },
  { id: "metade", label: "Metade" },
];
export const SYMBOLS: { id: SymbolId; label: string }[] = [
  { id: "none", label: "Nenhum" },
  { id: "estrela", label: "Estrela" },
  { id: "montanha", label: "Montanha" },
  { id: "torii", label: "Torii" },
  { id: "chama", label: "Chama" },
  { id: "raio", label: "Raio" },
  { id: "punho", label: "Punho" },
];
export const COLORS: string[] = [
  "#1c3a2e", "#2a4d3e", "#d9a441", "#2f6fb3", "#c0392b",
  "#7a4fa3", "#141110", "#efeadd", "#2a9d8f", "#e67e22", "#c9b037", "#3f8f5a",
];

function shapeNode(shape: ShapeId, props: Record<string, unknown>) {
  switch (shape) {
    case "circle": return <circle cx={28} cy={32} r={26} {...props} />;
    case "round": return <path d="M10 6 H46 a4 4 0 0 1 4 4 V36 C50 50 40 60 28 62 C16 60 6 50 6 36 V10 a4 4 0 0 1 4 -4 Z" {...props} />;
    case "hex": return <path d="M28 3 L51 16 V48 L28 61 L5 48 V16 Z" {...props} />;
    case "diamond": return <path d="M28 3 L53 32 L28 61 L3 32 Z" {...props} />;
    default: return <path d="M28 2 L52 11 V32 C52 49 41 58 28 62 C15 58 4 49 4 32 V11 Z" {...props} />;
  }
}

function PatternNode({ pattern, c1, c2 }: { pattern: PatternId; c1: string; c2: string }) {
  switch (pattern) {
    case "listras-v":
      return <g>{[0, 14, 28, 42].map((x, i) => <rect key={x} x={x} y={0} width={14} height={64} fill={i % 2 ? c2 : c1} />)}</g>;
    case "listras-h":
      return <g>{[0, 16, 32, 48].map((y, i) => <rect key={y} x={0} y={y} width={56} height={16} fill={i % 2 ? c2 : c1} />)}</g>;
    case "xadrez": {
      const cells = [];
      for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) cells.push(<rect key={`${r}-${c}`} x={c * 14} y={r * 16} width={14} height={16} fill={(r + c) % 2 ? c2 : c1} />);
      return <g>{cells}</g>;
    }
    case "cruz":
      return <g><rect x={22} y={0} width={12} height={64} fill={c1} /><rect x={0} y={26} width={56} height={12} fill={c2} /></g>;
    case "diagonal":
      return <g><path d="M0 0 L56 0 L0 64 Z" fill={c1} /><path d="M56 0 L56 64 L0 64 Z" fill={c2} /></g>;
    case "metade":
      return <g><rect x={0} y={0} width={56} height={32} fill={c1} /><rect x={0} y={32} width={56} height={32} fill={c2} /></g>;
    default:
      return null;
  }
}

export function SymbolGlyph({ id, color }: { id: SymbolId; color: string }) {
  switch (id) {
    case "estrela": return <path d="M12 1 L15 9 L23 9 L16.5 14 L19 22 L12 17 L5 22 L7.5 14 L1 9 L9 9 Z" fill={color} />;
    case "montanha": return <path d="M2 21 L9 9 L13 14 L17 6 L22 21 Z" fill={color} />;
    case "torii": return <g fill={color}><rect x="4" y="5" width="16" height="2.4" /><rect x="3" y="8.6" width="18" height="2.8" /><rect x="6" y="11" width="2.4" height="11" /><rect x="15.6" y="11" width="2.4" height="11" /></g>;
    case "chama": return <path d="M12 1 C16 6 18 10 18 14 A6 6 0 0 1 6 14 C6 11 8.5 9 9 6 C10.5 7.5 12 9.5 12 11.5 C13 9.5 13 4.5 12 1 Z" fill={color} />;
    case "raio": return <path d="M13 1 L4 13 H10.5 L9 23 L20 9 H13 Z" fill={color} />;
    case "punho": return <path d="M5 10 V8 a2 2 0 0 1 4 0 V7 a2 2 0 0 1 4 0 V7 a2 2 0 0 1 4 0 V8 a2 2 0 0 1 4 0 V15 a7 7 0 0 1 -7 7 H11 a6 6 0 0 1 -6 -6 Z" fill={color} />;
    default: return null;
  }
}

export function Escudo({ config, size = 48 }: { config: Identity; size?: number }) {
  const u = Math.random().toString(36).slice(2, 9);
  const cid = "clip-" + u;
  const gid = "grad-" + u;
  return (
    <svg viewBox="0 0 56 64" width={size} height={(size * 64) / 56} aria-hidden="true">
      <defs>
        <clipPath id={cid}>{shapeNode(config.shape, {})}</clipPath>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={config.bg1} />
          <stop offset="1" stopColor={config.bg2} />
        </linearGradient>
      </defs>
      {shapeNode(config.shape, { fill: `url(#${gid})` })}
      <g clipPath={`url(#${cid})`}>
        <PatternNode pattern={config.pattern} c1={config.stamp1} c2={config.stamp2} />
      </g>
      {config.symbol !== "none" && (
        <g transform="translate(16,20)"><SymbolGlyph id={config.symbol} color={config.border} /></g>
      )}
      {shapeNode(config.shape, { fill: "none", stroke: config.border, strokeWidth: 3, strokeLinejoin: "round" })}
    </svg>
  );
}
