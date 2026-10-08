"use client";

// app/global-error.tsx
//
// REDE DE SEGURANÇA de último recurso. O Next.js mostra este componente quando um
// erro rebenta no PRÓPRIO layout raiz (acima do app/error.tsx). Sem ele — e sem o
// app/error.tsx — um erro de render deixava a app TODA em branco, sem aviso nem
// forma de recuperar (as "telas brancas" reportadas pelo Kainan, 08/10/2026).
//
// Como substitui o layout raiz, TEM de renderizar o seu próprio <html>/<body>.
// Mantém-se sem dependências (nem i18n nem contexto) de propósito: o erro pode
// estar precisamente numa delas. Mostra a mensagem em pequeno para ajudar o
// diagnóstico (a pessoa pode tirar print e enviar).

import { useEffect } from "react";

const GOLD = "#d9a441";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    try { console.error("[IpponLeague] erro global:", error); } catch {}
  }, [error]);

  return (
    <html lang="pt">
      <body style={{ margin: 0, background: "#0c0e0d", color: "#f1ede2", fontFamily: "system-ui,-apple-system,'Segoe UI',sans-serif", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ maxWidth: 360, textAlign: "center" }}>
          <div style={{ fontSize: 44, marginBottom: 8 }} aria-hidden="true">🥋</div>
          <h1 style={{ fontSize: 20, margin: "0 0 10px", color: GOLD }}>Algo correu mal</h1>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: "#b7afa6", margin: "0 0 18px" }}>
            Tivemos um erro inesperado ao carregar. Tenta de novo — os teus dados estão guardados.
          </p>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={() => reset()} style={{ background: GOLD, color: "#1b211e", border: "none", fontWeight: 700, fontSize: 14, padding: "11px 20px", borderRadius: 10, cursor: "pointer" }}>Tentar de novo</button>
            <button onClick={() => { try { window.location.href = "/inicio"; } catch {} }} style={{ background: "transparent", color: "#cfd8d2", border: "1px solid #2a3a33", fontWeight: 700, fontSize: 14, padding: "11px 20px", borderRadius: 10, cursor: "pointer" }}>Ir ao início</button>
          </div>
          {(error?.message || error?.digest) && (
            <p style={{ marginTop: 16, fontSize: 11, color: "#5f6f67", wordBreak: "break-word", lineHeight: 1.5 }}>
              {error.digest ? `ref: ${error.digest} · ` : ""}{error.message}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
