// components/SeloSensei.tsx
//
// SELO "SENSEI" reutilizável. É o MESMO selo em todo o lado (perfil, ranking),
// para a identidade de Sensei ser consistente e reconhecível. Ganha-se por ter
// uma liga de amigos com 20+ membros ativos na semana (ver lib/sensei.ts). É
// sazonal: pode ganhar-se e perder-se semana a semana.
//
// Visual DISTINTO do Fundador (que é um pill claro dourado com ★): o Sensei é um
// pill ESCURO (faixa preta de mestre) com um ícone de faixa e o texto dourado.
// Sem travessões. "Sensei" é universal; japonês e russo têm rótulo próprio.
import type { CSSProperties } from "react";

const COR = "#e7c86b";     // dourado claro (texto + contorno do ícone)
const FUNDO = "#15130f";   // pill escuro (faixa preta)
const BORDA = "#5a4a18";   // contorno discreto

const ROTULO: Record<string, string> = {
  pt: "Sensei",
  en: "Sensei",
  es: "Sensei",
  fr: "Sensei",
  de: "Sensei",
  ja: "先生",
  ru: "Сэнсэй",
};

export function SeloSensei({
  lingua = "pt",
  tam = "md",
  style,
}: {
  lingua?: string;
  tam?: "sm" | "md";
  style?: CSSProperties;
}) {
  const fs = tam === "sm" ? 9 : 11;
  const pad = tam === "sm" ? "1px 7px" : "2px 9px";
  const ico = tam === "sm" ? 11 : 13;
  const label = ROTULO[lingua] ?? ROTULO.pt;
  // Só se põe em maiúsculas o rótulo latino (SENSEI). Japonês/russo ficam como estão.
  const maiusc = /^[A-Za-z]+$/.test(label);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        border: `1px solid ${BORDA}`,
        background: FUNDO,
        borderRadius: 999,
        padding: pad,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {/* Ícone de faixa (obi) com nó. */}
      <svg width={ico} height={ico} viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}>
        <rect x="2" y="9" width="20" height="6" rx="2" fill="#111111" stroke={COR} strokeWidth="1.6" />
        <rect x="9.3" y="6" width="5.4" height="12" rx="1.5" fill="#111111" stroke={COR} strokeWidth="1.6" />
      </svg>
      <span
        style={{
          color: COR,
          fontSize: fs,
          fontWeight: 700,
          textTransform: maiusc ? "uppercase" : "none",
          letterSpacing: maiusc ? "0.05em" : "0",
        }}
      >
        {label}
      </span>
    </span>
  );
}
