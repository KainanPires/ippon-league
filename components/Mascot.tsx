"use client";

// Mascot.tsx
// Mascote ornitorrinco judoca da Ippon League — o "Dôdo".
// Expressões: feliz, determinado, comemorando, indicando, sabio (óculos).
// A faixa (belt) muda de cor conforme o contexto.

export type MascotExpression =
  | "feliz"
  | "determinado"
  | "comemorando"
  | "indicando"
  | "sabio";

export function Mascot({
  belt = "#141110",
  expression = "feliz",
}: {
  belt?: string;
  expression?: MascotExpression;
}) {
  const happy = expression !== "determinado";
  const armsUp = expression === "comemorando";
  const pointing = expression === "indicando";
  const glasses = expression === "sabio";
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true">
      {/* cauda */}
      <ellipse cx="72" cy="72" rx="13" ry="7.5" fill="#39998f" transform="rotate(-18 72 72)" />
      <line x1="65" y1="70" x2="79" y2="73" stroke="#2d7a72" strokeWidth="0.8" transform="rotate(-18 72 72)" />
      {/* corpo (judogi) */}
      <path d="M50,40 C40,40 33,44 32,52 L30,80 C30,85 36,86 50,86 C64,86 70,85 70,80 L68,52 C67,44 60,40 50,40 Z" fill="#f6f3ea" stroke="#d8d1c0" strokeWidth="1" />
      {/* braço esquerdo: ao alto (comemorar) ou em repouso */}
      {armsUp ? (
        <>
          <path d="M33,47 L20,34 L14,24 L27,30 Z" fill="#f6f3ea" stroke="#d8d1c0" strokeWidth="1" strokeLinejoin="round" />
          <circle cx="14" cy="22" r="4.4" fill="#E65100" />
        </>
      ) : (
        <>
          <path d="M33,47 L21,54 L25,63 L35,57 Z" fill="#f6f3ea" stroke="#d8d1c0" strokeWidth="1" strokeLinejoin="round" />
          <circle cx="23" cy="62" r="4.2" fill="#E65100" />
        </>
      )}
      {/* braço direito: ao alto (comemorar/indicar) ou em repouso */}
      {armsUp || pointing ? (
        <>
          <path d="M67,47 L80,34 L86,24 L73,30 Z" fill="#f6f3ea" stroke="#d8d1c0" strokeWidth="1" strokeLinejoin="round" />
          <circle cx="86" cy="22" r="4.4" fill="#E65100" />
        </>
      ) : (
        <>
          <path d="M67,47 L79,54 L75,63 L65,57 Z" fill="#f6f3ea" stroke="#d8d1c0" strokeWidth="1" strokeLinejoin="round" />
          <circle cx="77" cy="62" r="4.2" fill="#E65100" />
        </>
      )}
      {/* cabeça */}
      <path d="M34,30 C34,18 42,12 50,12 C58,12 66,18 66,30 C66,38 60,43 50,43 C40,43 34,38 34,30 Z" fill="#4DB6AC" stroke="#2f8a80" strokeWidth="1" />
      {/* gola */}
      <path d="M43,41 L50,53 L50,60 L41,51 Z" fill="#ece5d5" stroke="#d8d1c0" strokeWidth="0.6" />
      <path d="M57,41 L50,53 L50,60 L59,51 Z" fill="#e3dccb" stroke="#d8d1c0" strokeWidth="0.6" />
      {/* faixa */}
      <rect x="28" y="65" width="44" height="8" rx="2" fill={belt} stroke="rgba(0,0,0,0.25)" strokeWidth="0.6" />
      <rect x="44" y="64" width="12" height="11" rx="2" fill={belt} />
      <rect x="44" y="64" width="12" height="11" rx="2" fill="rgba(0,0,0,0.2)" />
      <rect x="46" y="74" width="3.5" height="10" rx="1.5" fill={belt} />
      <rect x="51" y="74" width="3.5" height="10" rx="1.5" fill={belt} />
      {/* bochechas (faces felizes) */}
      {happy && (
        <>
          <ellipse cx="39" cy="33" rx="3" ry="2" fill="rgba(255,143,0,0.30)" />
          <ellipse cx="61" cy="33" rx="3" ry="2" fill="rgba(255,143,0,0.30)" />
        </>
      )}
      {/* olhos */}
      <ellipse cx="43.5" cy="26" rx="3.3" ry="3.8" fill="#fff" />
      <ellipse cx="56.5" cy="26" rx="3.3" ry="3.8" fill="#fff" />
      <circle cx="44.3" cy="27" r="1.9" fill="#1A237E" />
      <circle cx="55.7" cy="27" r="1.9" fill="#1A237E" />
      <circle cx="45" cy="26" r="0.7" fill="#fff" />
      <circle cx="57.2" cy="26" r="0.7" fill="#fff" />
      {/* óculos (sábio / dicas) */}
      {glasses && (
        <g fill="none" stroke="#1b211e" strokeWidth="1.6">
          <circle cx="43.5" cy="26" r="5.4" />
          <circle cx="56.5" cy="26" r="5.4" />
          <path d="M48.9 26 H51.1" />
          <path d="M38.1 24.6 L34.6 23.6" />
          <path d="M61.9 24.6 L65.4 23.6" />
        </g>
      )}
      {/* sobrancelhas: relaxadas (feliz) ou franzidas (determinado) */}
      {happy ? (
        <>
          <path d="M40,20 Q43.5,18 47,20" fill="none" stroke="#E65100" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M53,20 Q56.5,18 60,20" fill="none" stroke="#E65100" strokeWidth="1.6" strokeLinecap="round" />
        </>
      ) : (
        <>
          <line x1="39" y1="20.5" x2="46.5" y2="22.5" stroke="#E65100" strokeWidth="1.8" strokeLinecap="round" />
          <line x1="61" y1="20.5" x2="53.5" y2="22.5" stroke="#E65100" strokeWidth="1.8" strokeLinecap="round" />
        </>
      )}
      {/* bico */}
      <ellipse cx="50" cy="37" rx="11" ry="4.6" fill="#FF8F00" stroke="#E65100" strokeWidth="0.7" />
      <circle cx="46" cy="35.5" r="0.9" fill="#E65100" />
      <circle cx="54" cy="35.5" r="0.9" fill="#E65100" />
      {/* sorriso (faces felizes) */}
      {happy && <path d="M45.5,40.5 Q50,43.5 54.5,40.5" fill="none" stroke="#C2410C" strokeWidth="1" strokeLinecap="round" />}
      {/* patas */}
      <path d="M37,84 L46,84 L48,93 L35,93 Z" fill="#FF8F00" />
      <path d="M63,84 L54,84 L52,93 L65,93 Z" fill="#FF8F00" />
    </svg>
  );
}
