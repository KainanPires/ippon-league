// components/SeloFundador.tsx
//
// SELO "★ FUNDADOR" reutilizável. É o MESMO selo em todo o lado (perfil, modal,
// cards de partilha), para a identidade de Fundador ser consistente e reconhecível.
// Exclusivo da coorte de lançamento. Sem travessões. Japonês/russo entram no
// rollout das línguas (acrescentar aqui o rótulo).
import type { CSSProperties } from "react";

const GOLD = "#d9a441";
const ROTULO: Record<string, string> = {
  pt: "Fundador",
  en: "Founder",
  es: "Fundador",
  fr: "Fondateur",
  de: "Gründer",
};

export function SeloFundador({
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
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, border: `1px solid ${GOLD}`, background: "rgba(217,164,65,0.12)", borderRadius: 999, padding: pad, whiteSpace: "nowrap", ...style }}>
      <span style={{ color: GOLD, fontSize: fs, lineHeight: 1 }}>★</span>
      <span style={{ color: GOLD, fontSize: fs, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>{ROTULO[lingua] ?? ROTULO.pt}</span>
    </span>
  );
}
