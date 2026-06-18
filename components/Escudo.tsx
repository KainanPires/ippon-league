"use client";

import { uid } from "@/lib/team";

export type ShapeId = "classic" | "round" | "circle" | "hex" | "diamond";
export type PatternId = "solido" | "listras-v" | "listras-h" | "xadrez" | "cruz" | "diagonal" | "metade";
export type SymbolId = "none" | "estrela" | "montanha" | "torii" | "chama" | "raio" | "punho" | "faixa" | "kimono" | "ippon" | "sol-nascente" | "fuji" | "sakura" | "saudacao" | "dragao" | "trofeu" | "taca" | "medalha" | "bandeirola" | "flamula" | "mundo" | "mapa-americas" | "mapa-europa" | "mapa-africa" | "mapa-asia" | "mapa-oceania";

export type Identity = {
  name: string;
  shape: ShapeId;
  pattern: PatternId;
  bg1: string;
  bg2: string;
  stamp1: string;
  stamp2: string;
  border: string;     // borda do FUNDO (contorno da forma)
  symbol: SymbolId;
  // Cores do ÍCONE — opcionais para retrocompatibilidade. Escudos antigos sem
  // estes campos desenham-se como antes: o ícone usa a cor da borda do fundo e
  // não tem contorno próprio. Os novos (e os editados) ganham cor e contorno
  // próprios, separados da borda do fundo.
  icon?: string;        // cor de preenchimento do ícone
  iconBorder?: string;  // contorno do ícone ("" / ausente = sem contorno)
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
  icon: "#d9a441",      // cor do ícone (igual à antiga, para não mudar o aspeto base)
  iconBorder: "#141110", // contorno escuro tipo autocolante (destaca o ícone)
};

// Chave da identidade, ISOLADA POR CONTA: "ippon_identity__<uid>".
// Assim o nome/escudo de uma conta não aparece noutra no mesmo browser.
const KEY_BASE = "ippon_identity";
function identityKey() { return `${KEY_BASE}__${uid()}`; }

export function loadIdentity(): Identity {
  try {
    // Primeiro a chave isolada por conta; se não houver, tenta a chave antiga
    // (migração suave de quem já tinha identidade gravada na chave global).
    const raw = localStorage.getItem(identityKey()) ?? localStorage.getItem(KEY_BASE);
    if (!raw) return DEFAULT_IDENTITY;
    return { ...DEFAULT_IDENTITY, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_IDENTITY;
  }
}
export function saveIdentity(id: Identity) {
  try { localStorage.setItem(identityKey(), JSON.stringify(id)); } catch {}
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
  { id: "faixa", label: "Faixa" },
  { id: "kimono", label: "Kimono" },
  { id: "ippon", label: "Ippon" },
  { id: "sol-nascente", label: "Sol nascente" },
  { id: "fuji", label: "Fuji" },
  { id: "sakura", label: "Sakura" },
  { id: "saudacao", label: "Saudação" },
  { id: "dragao", label: "Dragão" },
];
export const LEAGUE_SYMBOLS: { id: SymbolId; label: string }[] = [
  { id: "trofeu", label: "Troféu" },
  { id: "taca", label: "Taça" },
  { id: "medalha", label: "Medalha" },
  { id: "bandeirola", label: "Bandeirola" },
  { id: "flamula", label: "Flâmula" },
  { id: "none", label: "Nenhum" },
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

const CONTS: Record<string, string> = {
  americas: "M5 4 C7 3.2 8.6 4.2 8.2 6 L7.2 8.2 L8.6 9.2 C8.6 11.4 7.6 13.6 8.2 15.8 C8.2 17.8 6.6 17.8 6.1 15.8 L6.1 11.6 L4.7 9 L5.7 6.2 Z",
  europa: "M10.6 4.4 C12 4 13.4 4.4 13 5.8 L12 7.2 L10.4 6.8 L10 5.4 Z",
  africa: "M10.8 8.6 C12.2 8.6 13.2 9.6 13.2 11.4 L12.3 15.6 C11.9 17.6 10.8 17.6 10.4 15.6 L9.8 11.6 C9.8 10 10.2 8.6 10.8 8.6 Z",
  asia: "M13.8 4 C16.6 3.2 19.6 4 18.8 6.4 L20 7.8 L17.8 8.8 L15.2 8 L14 6 Z",
  oceania: "M16.2 14.6 C18 14.1 19.8 15 19.4 16.4 C19 17.8 16.6 17.8 16.1 16.4 Z",
};
function WorldMap({ active, color }: { active: string; color: string }) {
  return (
    <g>
      <circle cx={12} cy={12} r={10} fill="none" stroke={color} strokeWidth={1.6} />
      {Object.keys(CONTS).map((k) => (
        <path key={k} d={CONTS[k]} fill={color} fillOpacity={k === active ? 1 : 0.28} />
      ))}
    </g>
  );
}

export function SymbolGlyph({ id, color }: { id: SymbolId; color: string }) {
  switch (id) {
    case "estrela": return <path d="M12 1 L15 9 L23 9 L16.5 14 L19 22 L12 17 L5 22 L7.5 14 L1 9 L9 9 Z" fill={color} />;
    case "montanha": return <path d="M2 21 L9 9 L13 14 L17 6 L22 21 Z" fill={color} />;
    case "torii": return <g fill={color}><rect x="4" y="5" width="16" height="2.4" /><rect x="3" y="8.6" width="18" height="2.8" /><rect x="6" y="11" width="2.4" height="11" /><rect x="15.6" y="11" width="2.4" height="11" /></g>;
    case "chama": return <path d="M12 1 C16 6 18 10 18 14 A6 6 0 0 1 6 14 C6 11 8.5 9 9 6 C10.5 7.5 12 9.5 12 11.5 C13 9.5 13 4.5 12 1 Z" fill={color} />;
    case "raio": return <path d="M13 1 L4 13 H10.5 L9 23 L20 9 H13 Z" fill={color} />;
    case "punho": return <path d="M5 10 V8 a2 2 0 0 1 4 0 V7 a2 2 0 0 1 4 0 V7 a2 2 0 0 1 4 0 V8 a2 2 0 0 1 4 0 V15 a7 7 0 0 1 -7 7 H11 a6 6 0 0 1 -6 -6 Z" fill={color} />;
    case "faixa": return (
      // Faixa de judô atada com o nó ao centro e as duas pontas a cair.
      <g fill={color}>
        <rect x="1" y="9" width="9" height="4.5" rx="1" />
        <rect x="14" y="9" width="9" height="4.5" rx="1" />
        <path d="M9 8 H15 V14.5 H9 Z" />
        <path d="M9.5 14 L7.5 22 L10.5 20.5 L11.8 14 Z" />
        <path d="M14.5 14 L16.5 22 L13.5 20.5 L12.2 14 Z" />
      </g>
    );
    case "kimono": return (
      // Gi de judô visto de frente: a gola cruzada em V é o traço mais icónico.
      <g fill={color}>
        <path d="M8 2 L12 5 L16 2 L21 5 L18 9 L17 8 L17 22 L7 22 L7 8 L6 9 L3 5 Z" />
        <path d="M12 5 L12 22" stroke={color} strokeWidth="0.6" />
      </g>
    );
    case "ippon": return (
      // Projeção (ippon): silhueta de um judoca a arremessar outro por cima.
      <g fill={color}>
        <circle cx="7" cy="5" r="2.4" />
        <path d="M5 8 C4 11 4 15 6 18 L8.5 17 C7.2 14.5 7.2 11.5 8.5 9.5 Z" />
        <path d="M6 18 L4 23 L6.5 23 L8 19 Z" />
        <path d="M8.5 17 L11 18.5 L9.7 21 L7.5 19 Z" />
        <circle cx="18" cy="6.5" r="2.2" />
        <path d="M9 9 C13 6 17 6 20 9 L19 11.5 C16 9.5 13 9.5 10.5 11 Z" />
        <path d="M20 9 L22 12 L20 13.5 L18.5 11 Z" />
      </g>
    );
    case "sol-nascente": return (
      // Hinomaru/sol nascente: disco com raios a abrir para baixo.
      <g fill={color}>
        <circle cx="12" cy="9" r="5" />
        <path d="M12 14 L8 23 L10.6 23 L12 16.5 L13.4 23 L16 23 Z" />
        <path d="M12 14 L3 21 L5 22.5 L12 17 Z" />
        <path d="M12 14 L21 21 L19 22.5 L12 17 Z" />
      </g>
    );
    case "fuji": return (
      // Monte Fuji com o cume nevado.
      <g fill={color}>
        <path d="M2 21 L9 8 C10.5 5.5 13.5 5.5 15 8 L22 21 Z" />
        <path d="M8.4 9 C10 6.6 14 6.6 15.6 9 L13.7 11 L12 9.6 L10.3 11 Z" fill="#ffffff" fillOpacity="0.9" />
      </g>
    );
    case "sakura": return (
      // Flor de cerejeira: 5 pétalas com entalhe na ponta.
      <g fill={color}>
        {[0, 72, 144, 216, 288].map((a) => (
          <path key={a} d="M12 12 C9.5 10 9.5 5 11 2.5 C11.5 3.6 12.5 3.6 13 2.5 C14.5 5 14.5 10 12 12 Z" transform={`rotate(${a} 12 12)`} />
        ))}
        <circle cx="12" cy="12" r="1.6" fill="#ffffff" fillOpacity="0.85" />
      </g>
    );
    case "saudacao": return (
      // Saudação marcial: punho de uma mão contra a palma da outra.
      <g fill={color}>
        <path d="M3 9 H9 a2 2 0 0 1 2 2 V17 a2 2 0 0 1 -2 2 H3 a3 3 0 0 1 -3 -3 V12 a3 3 0 0 1 3 -3 Z" />
        <path d="M21 7 a3 3 0 0 1 3 3 V18 a3 3 0 0 1 -3 3 H14 a2 2 0 0 1 -2 -2 V14 L18 14 V11 a2 2 0 0 1 2 -2 Z" />
      </g>
    );
    case "dragao": return (
      // Cabeça de dragão estilizada (estilo marcial oriental), de perfil.
      <g fill={color}>
        <path d="M3 14 C3 9 7 5 12 5 C14 5 15 3 14 1 C17 2 18 5 17 7 C20 8 22 11 21 15 L18 14 C18.5 12 17 10.5 15 10.5 C16 12 15 14 13 14 C14 15.5 13 17.5 11 17 L12 20 L8 18 C5.5 17.5 3.5 16 3 14 Z" />
        <circle cx="9" cy="9.5" r="1.3" fill="#ffffff" fillOpacity="0.85" />
        <path d="M15 1 C16.5 0 18.5 0.5 19 2 C17.8 1.8 16.5 2 16 3 Z" />
      </g>
    );
    case "trofeu": return (
      <g fill={color}>
        <path d="M6 3 H18 V6 C18 11 15.5 14 12 14 C8.5 14 6 11 6 6 Z" />
        <path d="M6 4 C2 4 2 9.5 7.5 10.2 L7.5 8.1 C4.5 7.6 4.6 6 6 6 Z" />
        <path d="M18 4 C22 4 22 9.5 16.5 10.2 L16.5 8.1 C19.5 7.6 19.4 6 18 6 Z" />
        <rect x="11" y="13.5" width="2" height="4.5" />
        <path d="M7.5 18 H16.5 L17.5 21.5 H6.5 Z" />
      </g>
    );
    case "taca": return (
      <g fill={color}>
        <path d="M4 4 H20 C20 9.5 16.5 13 12 13 C7.5 13 4 9.5 4 4 Z" />
        <rect x="11" y="12.5" width="2" height="4.5" />
        <path d="M7 17 H17 L18 21 H6 Z" />
      </g>
    );
    case "medalha": return (
      <g fill={color}>
        <path d="M8 2 L11.5 9 L9 10 L5.5 3 Z" />
        <path d="M16 2 L12.5 9 L15 10 L18.5 3 Z" />
        <circle cx="12" cy="16" r="6" />
      </g>
    );
    case "bandeirola": return (
      <g fill={color}>
        <rect x="5" y="2" width="2" height="20" />
        <path d="M7 3 H20 L16 7.5 L20 12 H7 Z" />
      </g>
    );
    case "flamula": return <path d="M6 2 H18 V19 L12 14.5 L6 19 Z" fill={color} />;
    case "mundo": return (
      <g fill="none" stroke={color} strokeWidth={1.8}>
        <circle cx={12} cy={12} r={10} />
        <ellipse cx={12} cy={12} rx={4.3} ry={10} />
        <line x1={2} y1={12} x2={22} y2={12} />
        <path d="M3.5 7 H20.5 M3.5 17 H20.5" />
      </g>
    );
    case "mapa-americas": return <WorldMap active="americas" color={color} />;
    case "mapa-europa": return <WorldMap active="europa" color={color} />;
    case "mapa-africa": return <WorldMap active="africa" color={color} />;
    case "mapa-asia": return <WorldMap active="asia" color={color} />;
    case "mapa-oceania": return <WorldMap active="oceania" color={color} />;
    default: return null;
  }
}

export function Escudo({ config, size = 48 }: { config: Identity; size?: number }) {
  const u = Math.random().toString(36).slice(2, 9);
  const cid = "clip-" + u;
  const gid = "grad-" + u;
  // Cores do ícone com recurso retrocompatível: se não houver `icon`, usa a
  // borda do fundo (comportamento antigo). O contorno só existe se houver
  // `iconBorder` com cor — escudos antigos (sem o campo) não ganham contorno.
  const corIcone = config.icon || config.border;
  const corBordaIcone = config.iconBorder || "";
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
        <g transform="translate(16,20)">
          {corBordaIcone ? (
            // Contorno "autocolante": o traço é pintado ATRÁS do preenchimento
            // (paint-order: stroke). Os glifos do time são preenchidos, por isso
            // herdam o stroke do grupo e ganham um contorno limpo à volta.
            <g stroke={corBordaIcone} strokeWidth={2.6} strokeLinejoin="round" strokeLinecap="round" style={{ paintOrder: "stroke" }}>
              <SymbolGlyph id={config.symbol} color={corIcone} />
            </g>
          ) : (
            <SymbolGlyph id={config.symbol} color={corIcone} />
          )}
        </g>
      )}
      {shapeNode(config.shape, { fill: "none", stroke: config.border, strokeWidth: 3, strokeLinejoin: "round" })}
    </svg>
  );
}
