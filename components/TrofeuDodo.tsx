"use client";

// components/TrofeuDodo.tsx
//
// O TROFÉU DA COPA DO DÔDO.
//
// O Dôdo na pose "comemorando" do Mascot, fundido em ouro, sobre uma base de
// madeira. É o símbolo da Copa: aparece pequeno na lista de competições e
// grande dentro da página da Copa.
//
// ---------------------------------------------------------------------------
// PORQUE NÃO IMPORTA O Mascot
//
// O Mascot tem as cores fixas no corpo (cabeça #4DB6AC, bico #FF8F00) e lê o
// judogui do JudoguiProvider — um Pro Max com o judogui azul veria um troféu
// azul. Um troféu não muda de cor com as preferências de quem o vê.
//
// A geometria é a MESMA, copiada do Mascot: mesma cabeça, mesmo bico, mesmos
// braços ao alto. Se um dia mexeres nas formas do Mascot, mexe também aqui —
// são dois ficheiros a desenhar o mesmo pássaro de propósito.
//
// ---------------------------------------------------------------------------
// O JUDOGI NÃO É DOURADO, E ISSO É DE PROPÓSITO
//
// Com o corpo, o judogi e a faixa todos em ouro, o Dôdo vira uma mancha só e
// deixa de se perceber que é um judoca. Corpo e cabeça em ouro, judogi em
// marfim, faixa preta: assim o judô continua a ler-se a 30 pixels.
// ---------------------------------------------------------------------------

import { useId } from "react";

export function TrofeuDodo({
  size = 120,
  base = true,
  numero,
  titulo = "Troféu da Copa do Dôdo",
}: {
  /** Largura em pixels. A altura é calculada a partir dela. */
  size?: number;
  /** Com base de madeira. Desliga em tamanhos pequenos: abaixo de ~48px a base
   *  vira uma mancha castanha e o Dôdo perde espaço. */
  base?: boolean;
  /** Número da edição, gravado na placa. Só aparece com base. */
  numero?: number | string | null;
  titulo?: string;
}) {
  const uid = useId();
  const ouro = `ouro-${uid}`;
  const alturaVB = base ? 134 : 100;
  const altura = Math.round((size * alturaVB) / 100);

  return (
    <svg
      viewBox={`0 0 100 ${alturaVB}`}
      width={size}
      height={altura}
      role="img"
      aria-label={titulo}
      style={{ display: "block" }}
    >
      <title>{titulo}</title>

      <defs>
        <linearGradient id={ouro} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f0d089" />
          <stop offset="0.45" stopColor="#d9a441" />
          <stop offset="1" stopColor="#a3761f" />
        </linearGradient>
      </defs>

      {/* cauda */}
      <ellipse cx="72" cy="72" rx="13" ry="7.5" fill="#b8862b" transform="rotate(-18 72 72)" />
      <line x1="65" y1="70" x2="79" y2="73" stroke="#8a6220" strokeWidth="0.8" transform="rotate(-18 72 72)" />

      {/* corpo (judogi) */}
      <path d="M50,40 C40,40 33,44 32,52 L30,80 C30,85 36,86 50,86 C64,86 70,85 70,80 L68,52 C67,44 60,40 50,40 Z" fill="#f2e6c9" stroke="#cbb27f" strokeWidth="1" />

      {/* braços ao alto — a pose comemorando */}
      <path d="M33,47 L20,34 L14,24 L27,30 Z" fill="#f2e6c9" stroke="#cbb27f" strokeWidth="1" strokeLinejoin="round" />
      <circle cx="14" cy="22" r="4.4" fill="#e0b45c" stroke="#b8862b" strokeWidth="0.6" />
      <path d="M67,47 L80,34 L86,24 L73,30 Z" fill="#f2e6c9" stroke="#cbb27f" strokeWidth="1" strokeLinejoin="round" />
      <circle cx="86" cy="22" r="4.4" fill="#e0b45c" stroke="#b8862b" strokeWidth="0.6" />

      {/* cabeça */}
      <path d="M34,30 C34,18 42,12 50,12 C58,12 66,18 66,30 C66,38 60,43 50,43 C40,43 34,38 34,30 Z" fill={`url(#${ouro})`} stroke="#a3761f" strokeWidth="1" />

      {/* gola */}
      <path d="M43,41 L50,53 L50,60 L41,51 Z" fill="#e9dcbc" stroke="#cbb27f" strokeWidth="0.6" />
      <path d="M57,41 L50,53 L50,60 L59,51 Z" fill="#ded0ad" stroke="#cbb27f" strokeWidth="0.6" />

      {/* faixa preta */}
      <rect x="28" y="65" width="44" height="8" rx="2" fill="#151513" stroke="rgba(0,0,0,0.25)" strokeWidth="0.6" />
      <rect x="44" y="64" width="12" height="11" rx="2" fill="#151513" />
      <rect x="44" y="64" width="12" height="11" rx="2" fill="rgba(0,0,0,0.2)" />
      <rect x="46" y="74" width="3.5" height="10" rx="1.5" fill="#151513" />
      <rect x="51" y="74" width="3.5" height="10" rx="1.5" fill="#151513" />

      {/* bochechas */}
      <ellipse cx="39" cy="33" rx="3" ry="2" fill="rgba(184,134,43,0.35)" />
      <ellipse cx="61" cy="33" rx="3" ry="2" fill="rgba(184,134,43,0.35)" />

      {/* olhos — ficam escuros, senão o troféu perde o olhar */}
      <ellipse cx="43.5" cy="26" rx="3.3" ry="3.8" fill="#fbf3e0" />
      <ellipse cx="56.5" cy="26" rx="3.3" ry="3.8" fill="#fbf3e0" />
      <circle cx="44.3" cy="27" r="1.9" fill="#2a2118" />
      <circle cx="55.7" cy="27" r="1.9" fill="#2a2118" />
      <circle cx="45" cy="26" r="0.7" fill="#fff" />
      <circle cx="57.2" cy="26" r="0.7" fill="#fff" />

      {/* sobrancelhas relaxadas — o Dôdo está a ganhar, não a lutar */}
      <path d="M40,20 Q43.5,18 47,20" fill="none" stroke="#a3761f" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M53,20 Q56.5,18 60,20" fill="none" stroke="#a3761f" strokeWidth="1.6" strokeLinecap="round" />

      {/* bico */}
      <ellipse cx="50" cy="37" rx="11" ry="4.6" fill="#e0b45c" stroke="#b8862b" strokeWidth="0.7" />
      <circle cx="46" cy="35.5" r="0.9" fill="#b8862b" />
      <circle cx="54" cy="35.5" r="0.9" fill="#b8862b" />
      <path d="M45.5,40.5 Q50,43.5 54.5,40.5" fill="none" stroke="#a3761f" strokeWidth="1" strokeLinecap="round" />

      {/* patas */}
      <path d="M37,84 L46,84 L48,93 L35,93 Z" fill="#e0b45c" stroke="#b8862b" strokeWidth="0.6" />
      <path d="M63,84 L54,84 L52,93 L65,93 Z" fill="#e0b45c" stroke="#b8862b" strokeWidth="0.6" />

      {/* base de madeira com placa dourada */}
      {base && (
        <>
          <ellipse cx="50" cy="130" rx="42" ry="3.4" fill="rgba(0,0,0,0.35)" />
          <rect x="22" y="95" width="56" height="8" rx="2" fill="#c9a05f" />
          <rect x="22" y="95" width="56" height="2.6" rx="1.3" fill="#e6c68d" />
          <rect x="16" y="103" width="68" height="20" rx="3" fill="#6b4a2a" />
          <rect x="16" y="103" width="68" height="4" rx="2" fill="#8a6238" />
          <rect x="11" y="123" width="78" height="7" rx="2.5" fill="#4e341c" />
          {numero !== null && numero !== undefined && String(numero).length > 0 && (
            <>
              <rect x="35" y="107" width="30" height="12" rx="2" fill="#d9a441" stroke="#a3761f" strokeWidth="0.6" />
              <text x="50" y="115.8" textAnchor="middle" fontSize="8" fontWeight="700" fill="#4a3410" fontFamily="ui-monospace, monospace">{numero}</text>
            </>
          )}
        </>
      )}
    </svg>
  );
}

export default TrofeuDodo;
