"use client";

// components/SeletorLingua.tsx
//
// O seletor de idioma. Vive no perfil, mas é um componente à parte para poder
// aparecer também no registo — alguém que não fala português precisa de trocar
// a língua ANTES de criar conta, não depois.
//
// A escolha guarda-se na conta (user_metadata) e numa cache local. Quem ainda
// não tem conta fica só com a cache, e a preferência migra para a conta no
// primeiro login.

import { LINGUAS, useLingua, useT } from "@/lib/i18n";

const FD = "var(--font-geist-mono), system-ui, sans-serif";
const GOLD = "#d9a441";

export function SeletorLingua({ compacto = false }: { compacto?: boolean }) {
  const { lingua, mudar } = useLingua();
  const t = useT();

  if (compacto) {
    // Versão de uma linha, para cabeçalhos e para o ecrã de registo.
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

  return (
    <div style={{ background: "#121815", border: "1px solid #243029", borderRadius: 16, padding: 14 }}>
      <div style={{ fontFamily: FD, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#7c8a82", marginBottom: 10 }}>
        {t("perfil.lingua")}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {LINGUAS.map((l) => {
          const ativa = lingua === l.id;
          return (
            <button
              key={l.id}
              onClick={() => mudar(l.id)}
              aria-pressed={ativa}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 11,
                width: "100%",
                textAlign: "left",
                background: ativa ? "#1b2420" : "transparent",
                border: `1px solid ${ativa ? GOLD : "#243029"}`,
                borderRadius: 11,
                padding: "11px 13px",
                cursor: "pointer",
                color: "#f1ede2",
              }}
            >
              <span style={{ fontSize: 19, lineHeight: 1 }}>{l.bandeira}</span>
              <span style={{ flex: 1, fontSize: 14, fontWeight: ativa ? 700 : 400 }}>{l.nome}</span>
              {ativa && <span style={{ color: GOLD, fontSize: 15 }}>✓</span>}
            </button>
          );
        })}
      </div>

      {/* O que NÃO se traduz, dito à pessoa. Evita a dúvida de "porque é que
          isto continua em japonês" quando ela troca para inglês. */}
      <p style={{ fontSize: 11, color: "#5f6f67", lineHeight: 1.5, margin: "12px 0 0" }}>
        Os termos de judo — ippon, waza-ari, shido, judogi — mantêm-se iguais em
        todas as línguas, como no tatame.
      </p>
    </div>
  );
}
