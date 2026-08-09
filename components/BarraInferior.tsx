"use client";

// components/BarraInferior.tsx
//
// A BARRA DE NAVEGACAO INFERIOR, UMA VEZ SO.
//
// Ate agora cada pagina tinha a sua propria copia do <nav> e do componente do
// separador - umas chamavam-lhe `Tab`, outras `NavTab`, e os quatro icones
// estavam repetidos em cada ficheiro. Mudar a barra obrigava a mexer em dez
// paginas e a nao esquecer nenhuma.
//
// COMO USAR (substitui o bloco <nav>...</nav> inteiro da pagina):
//   import { BarraInferior } from "@/components/BarraInferior";
//   ...
//   <BarraInferior ativo="inicio" />
//
// Valores de `ativo`: "inicio" | "ligas" | "atletas" | "pro" | undefined.
//
// ---------------------------------------------------------------------------
// O SEPARADOR PRO A PULSAR
//
// Quem tem Pro ou Pro Max e ainda nao visitou a area Pro ve o separador a
// pulsar em amarelo. Serve para quem acabou de pagar perceber onde esta o que
// comprou - e apanha tambem quem ja e assinante ha semanas e nunca la foi.
//
// Para de pulsar assim que ele la vai uma vez. A marca fica no proprio
// dispositivo (localStorage): se ele trocar de telemovel, pulsa outra vez.
// E um aviso visual, nao um direito - repetir uma vez nao faz mal a ninguem, e
// evita uma coluna nova na base de dados so para isto.
//
// Quem marca como visto e a propria area Pro, chamando marcarAreaProVista().
// ---------------------------------------------------------------------------

import { useEffect, useState } from "react";
import { useNivel } from "@/lib/useNivel";

const GOLD = "#d9a441";
const CHAVE_VISTA = "ippon_viu_area_pro";

/** Chamar na area Pro, quando ela abre. Para o separador de pulsar. */
export function marcarAreaProVista(): void {
  try {
    localStorage.setItem(CHAVE_VISTA, "1");
  } catch {
    // Modo privado ou armazenamento cheio: o separador continua a pulsar.
    // Chato, mas inofensivo.
  }
}

/** Ja visitou a area Pro neste dispositivo? */
function jaViuAreaPro(): boolean {
  try {
    return localStorage.getItem(CHAVE_VISTA) === "1";
  } catch {
    return true; // Na duvida, nao chatear.
  }
}

type Ativo = "inicio" | "ligas" | "atletas" | "pro" | undefined;

export function BarraInferior({ ativo }: { ativo?: Ativo }) {
  const { ehPro, ehProMax } = useNivel();
  const [pulsar, setPulsar] = useState(false);

  // So depois de montar: o localStorage nao existe no servidor, e ler ao
  // renderizar dava diferencas entre servidor e cliente (hydration mismatch).
  useEffect(() => {
    const temAcesso = !!ehPro || !!ehProMax;
    setPulsar(temAcesso && !jaViuAreaPro());
  }, [ehPro, ehProMax]);

  // Se ele esta a ver a propria area Pro, nao faz sentido pulsar.
  const aPulsar = pulsar && ativo !== "pro";

  return (
    <>
      {aPulsar && (
        <style>{`
          @keyframes ipponPulsoPro {
            0%, 100% { opacity: 1;    transform: scale(1); }
            50%      { opacity: 0.55; transform: scale(1.12); }
          }
          @media (prefers-reduced-motion: reduce) {
            .ippon-pulso-pro { animation: none !important; }
          }
        `}</style>
      )}

      <nav
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          height: 62,
          background: "#0f1411",
          borderTop: "1px solid #243029",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-around",
        }}
      >
        <Tab label="Início" icon={<HomeIcon />} href="/inicio" active={ativo === "inicio"} />
        <Tab label="Competições" icon={<TrophyIcon />} href="/ligas" active={ativo === "ligas"} />
        <Tab label="Atletas" icon={<AthletesIcon />} href="/atletas" active={ativo === "atletas"} />

        {/* Destino ÚNICO: /pro-central decide para onde ir (ver app/pro-central).
            Assim todas as barras da app apontam para o mesmo sítio e nenhuma
            precisa de saber o nível — era essa divergência que levava um Pro Max
            à página de vendas a partir de qualquer ecrã. */}
        <Tab
          label="Pro"
          icon={<BoltIcon />}
          href="/pro-central"
          active={ativo === "pro"}
          pulsar={aPulsar}
        />
      </nav>
    </>
  );
}

function Tab({
  label,
  icon,
  active,
  href,
  pulsar,
}: {
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  href?: string;
  pulsar?: boolean;
}) {
  const baseStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 3,
    color: pulsar ? GOLD : active ? GOLD : "#6f7d76",
    textDecoration: "none",
    position: "relative",
  };

  const estiloPulso: React.CSSProperties = pulsar
    ? { animation: "ipponPulsoPro 1.4s ease-in-out infinite" }
    : {};

  const content = (
    <>
      <span className={pulsar ? "ippon-pulso-pro" : undefined} style={estiloPulso}>
        {icon}
      </span>
      <span style={{ fontSize: 11, fontWeight: pulsar || active ? 700 : 400 }}>{label}</span>

      {/* Ponto dourado no canto, para quem nao repara no pulsar. */}
      {pulsar && (
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            top: -2,
            right: -6,
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: GOLD,
            boxShadow: `0 0 6px ${GOLD}`,
          }}
        />
      )}
    </>
  );

  return href ? (
    <a href={href} style={baseStyle} aria-label={pulsar ? `${label} — novidade` : label}>
      {content}
    </a>
  ) : (
    <div style={baseStyle}>{content}</div>
  );
}

// --- Ícones (estavam repetidos em cada página) -------------------------------

export function HomeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 11l9-8 9 8" />
      <path d="M5 10v10h14V10" />
    </svg>
  );
}

export function TrophyIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 4h8v5a4 4 0 0 1-8 0V4z" />
      <path d="M8 6H5v2a3 3 0 0 0 3 3M16 6h3v2a3 3 0 0 1-3 3M10 17h4M9 21h6M12 13v4" />
    </svg>
  );
}

export function AthletesIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="8" cy="6" r="3" />
      <circle cx="17" cy="7" r="2.5" />
      <path d="M3 20v-1a5 5 0 0 1 10 0v1M14 20v-1a4 4 0 0 1 7-2.6" />
    </svg>
  );
}

export function BoltIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />
    </svg>
  );
}
