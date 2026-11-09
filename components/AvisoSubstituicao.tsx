"use client";

// components/AvisoSubstituicao.tsx
//
// Aviso na tela inicial: se um atleta que o utilizador escalou já SAIU da
// competição a decorrer (não está no mercado reconciliado com a chave), mostra
// um banner a ligar para /substituir — onde ele troca o atleta enquanto a
// categoria do substituto ainda não começou. Sem atletas que saíram (ou sem
// competição a decorrer, ou visitante sem equipa), não mostra nada.
// Autossuficiente: não depende do resto do home.

import { useEffect, useState } from "react";
import { loadSavedCloudFor } from "@/lib/team";
import { focoMercado } from "@/lib/calendario";

export function AvisoSubstituicao() {
  const [n, setN] = useState(0);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const aDecorrer = focoMercado().aDecorrer;
        if (!aDecorrer) return;
        const comp = String(aDecorrer.idCompeticao);
        const [team, mercadoRes] = await Promise.all([
          loadSavedCloudFor(comp),
          fetch(`/api/atletas?id=${comp}`).then((r) => r.json()).catch(() => null),
        ]);
        const ids: string[] = team?.ids ?? [];
        if (ids.length === 0) return;
        const mercado = Array.isArray(mercadoRes?.atletas) ? mercadoRes.atletas : [];
        const noMercado = new Set<string>(
          mercado.map((a: { id?: unknown }) => String(a?.id))
        );
        const fora = ids.filter((id) => !noMercado.has(String(id)));
        if (vivo) setN(fora.length);
      } catch {
        /* silencioso */
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  if (n <= 0) return null;

  return (
    <a
      href="/mercado?sub=1"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 11,
        textDecoration: "none",
        background: "rgba(226,101,90,0.10)",
        border: "1px solid #7a3a34",
        borderRadius: 13,
        padding: "12px 14px",
        marginBottom: 14,
      }}
    >
      <span style={{ fontSize: 22, flexShrink: 0 }} aria-hidden="true">⚠️</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: "#f4d7d2" }}>
          {n === 1 ? "1 atleta teu saiu da competição" : `${n} atletas teus saíram da competição`}
        </span>
        <span style={{ display: "block", fontSize: 12, color: "#d6a9a3", marginTop: 2, lineHeight: 1.4 }}>
          Toca para substituir enquanto a categoria do substituto ainda não começou →
        </span>
      </span>
    </a>
  );
}
