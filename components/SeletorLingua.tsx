"use client";

// components/SeletorLingua.tsx
//
// O seletor de idioma, em duas medidas.
//
//   <SeletorLingua compacto />   bandeiras pequenas, para o topo do /entrar e
//                                do /comecar, onde é um detalhe do cabeçalho
//
//   <SeletorLingua />            uma linha com as bandeiras maiores e o nome da
//                                língua atual ao lado, para o perfil
//
// A versão do perfil era uma lista vertical de cinco linhas com nome e visto —
// meia página gasta numa definição que se muda uma vez na vida. As bandeiras
// dizem o mesmo em muito menos espaço, e a língua ativa está escrita para não
// haver dúvida (as bandeiras não aparecem no Windows, que não traz os emojis).
//
// A escolha guarda-se na conta (user_metadata) e numa cache local. Quem ainda
// não tem conta fica só com a cache, e a preferência migra para a conta no
// primeiro login.

import { LINGUAS, useLingua } from "@/lib/i18n";

const FB = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";

export function SeletorLingua({ compacto = false }: { compacto?: boolean }) {
  const { lingua, mudar } = useLingua();
  const atual = LINGUAS.find((l) => l.id === lingua);

  // --- Versão do cabeçalho: só bandeiras, pequenas. ---
  if (compacto) {
    return (
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        {LINGUAS.map((l) => (
          <button
            key={l.id}
            onClick={() => mudar(l.id)}
            aria-label={l.nome}
            aria-pressed={lingua === l.id}
            title={l.nome}
            style={{
              background: "transparent",
              border: `1px solid ${lingua === l.id ? GOLD : "#243029"}`,
              borderRadius: 8,
              padding: "4px 7px",
              fontSize: 15,
              lineHeight: 1,
              cursor: "pointer",
              opacity: lingua === l.id ? 1 : 0.5,
            }}
          >
            {l.bandeira}
          </button>
        ))}
      </div>
    );
  }

  // --- Versão do perfil: uma linha, com o nome da língua ativa. ---
  return (
    <div style={{ background: "#121815", border: "1px solid #243029", borderRadius: 16, padding: "13px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
          {LINGUAS.map((l) => {
            const ativa = lingua === l.id;
            return (
              <button
                key={l.id}
                onClick={() => mudar(l.id)}
                aria-label={l.nome}
                aria-pressed={ativa}
                title={l.nome}
                style={{
                  background: ativa ? "#1b2420" : "transparent",
                  border: `1px solid ${ativa ? GOLD : "#243029"}`,
                  borderRadius: 9,
                  padding: "6px 9px",
                  fontSize: 18,
                  lineHeight: 1,
                  cursor: "pointer",
                  opacity: ativa ? 1 : 0.55,
                }}
              >
                {l.bandeira}
              </button>
            );
          })}
        </div>

        {/* O nome escrito não é redundante: no Windows as bandeiras aparecem
            como "PT GB ES FR DE" e sem isto não se percebe qual está escolhida. */}
        <span style={{ fontFamily: FB, fontSize: 13, fontWeight: 700, color: GOLD, whiteSpace: "nowrap" }}>
          {atual?.nome}
        </span>
      </div>
    </div>
  );
}
