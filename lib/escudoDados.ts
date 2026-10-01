// lib/escudoDados.ts
//
// FONTE ÚNICA DOS DADOS DO ESCUDO — módulo PURO (sem React, sem "use client",
// sem imports do browser). Pode ser usado tanto no cliente (components/Escudo.tsx
// re-exporta tudo isto) como no SERVIDOR (lib/escudoServidor.ts, webhook da
// Stripe, cron de expiração), onde não se pode importar um componente de cliente.
//
// Aqui vivem: os tipos, as listas de opções, as listas do que é GRÁTIS, e a
// função que "limpa" um escudo para a versão gratuita quando alguém perde o Pro.
// Para mudar o que é grátis, edita só as quatro listas FREE_* abaixo.

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

// ---------------------------------------------------------------------------
// GRÁTIS vs. PRO — a personalização do escudo é uma vantagem do Ippon Pro.
// Esta é a FONTE ÚNICA do que é grátis; o construtor (app/escudo) lê isto para
// pôr cadeados e bloquear a seleção a quem não é Pro, e o servidor lê isto para
// reverter o escudo quando o Pro termina.
// Para mudar o que é grátis, edita só estas quatro listas.
//
// NOTA: as cores por defeito do escudo (DEFAULT_IDENTITY) têm de estar todas em
// FREE_COLORS, senão um utilizador grátis começaria com um escudo "trancado".
// ---------------------------------------------------------------------------
export const FREE_SHAPES: ShapeId[] = ["classic", "round"];
export const FREE_PATTERNS: PatternId[] = ["solido", "metade", "listras-v"];
export const FREE_SYMBOLS: SymbolId[] = ["none", "estrela", "kimono", "faixa", "ippon"];
export const FREE_COLORS: string[] = ["#1c3a2e", "#2a4d3e", "#d9a441", "#efeadd", "#141110", "#c0392b"];

const normCor = (c: string) => (c || "").trim().toLowerCase();
export function shapeIsFree(s: ShapeId): boolean { return FREE_SHAPES.includes(s); }
export function patternIsFree(p: PatternId): boolean { return FREE_PATTERNS.includes(p); }
export function symbolIsFree(s: SymbolId): boolean { return FREE_SYMBOLS.includes(s); }
export function colorIsFree(c: string): boolean { return FREE_COLORS.some((f) => normCor(f) === normCor(c)); }

// ---------------------------------------------------------------------------
// REVERSÃO PARA GRÁTIS — usado quando alguém perde o Pro.
// ---------------------------------------------------------------------------
// Cada campo pago vira o equivalente gratuito mais próximo, para o escudo
// continuar coerente e NUNCA ficar em branco:
//   forma fora do grátis   -> "classic"
//   estampa fora do grátis -> "solido"
//   símbolo fora do grátis -> "none"
//   cada cor fora das grátis -> a cor gratuita mais próxima (distância RGB)
// O nome e tudo o resto do escudo mantêm-se. Devolve { escudo, mudou } — `mudou`
// é false quando o escudo já era todo gratuito (não há nada a fazer nem a avisar).

/** "#rrggbb" -> [r,g,b], ou null se não for um hex de 6 dígitos. */
function hexParaRgb(h: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec((h || "").trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** A cor GRÁTIS mais próxima de `cor` (menor distância RGB ao quadrado). */
export function corGratisMaisProxima(cor: string): string {
  const alvo = hexParaRgb(cor);
  if (!alvo) return FREE_COLORS[0];
  let melhor = FREE_COLORS[0];
  let menor = Infinity;
  for (const f of FREE_COLORS) {
    const rgb = hexParaRgb(f);
    if (!rgb) continue;
    const d = (rgb[0] - alvo[0]) ** 2 + (rgb[1] - alvo[1]) ** 2 + (rgb[2] - alvo[2]) ** 2;
    if (d < menor) { menor = d; melhor = f; }
  }
  return melhor;
}

// Campos de cor do escudo. O iconBorder pode ser "" (= sem contorno): esse valor
// é neutro e mantém-se; só se troca uma cor que EXISTE e não é gratuita.
const CAMPOS_COR = ["bg1", "bg2", "stamp1", "stamp2", "border", "icon", "iconBorder"] as const;

export function sanitizarEscudoParaGratis(
  escudo: Record<string, unknown>
): { escudo: Record<string, unknown>; mudou: boolean } {
  const out: Record<string, unknown> = { ...escudo };
  let mudou = false;

  const shape = typeof escudo.shape === "string" ? escudo.shape : "";
  if (shape && !FREE_SHAPES.includes(shape as ShapeId)) { out.shape = "classic"; mudou = true; }

  const pattern = typeof escudo.pattern === "string" ? escudo.pattern : "";
  if (pattern && !FREE_PATTERNS.includes(pattern as PatternId)) { out.pattern = "solido"; mudou = true; }

  const symbol = typeof escudo.symbol === "string" ? escudo.symbol : "";
  if (symbol && !FREE_SYMBOLS.includes(symbol as SymbolId)) { out.symbol = "none"; mudou = true; }

  for (const campo of CAMPOS_COR) {
    const cor = escudo[campo];
    if (typeof cor === "string" && cor.trim() && !colorIsFree(cor)) {
      out[campo] = corGratisMaisProxima(cor);
      mudou = true;
    }
  }

  return { escudo: out, mudou };
}
