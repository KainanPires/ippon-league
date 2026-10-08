"use client";

// app/error.tsx
//
// REDE DE SEGURANÇA ao nível das páginas. Apanha erros de render em qualquer
// página abaixo do layout raiz (liga, meu-time, mercado, etc.) e mostra um ecrã
// recuperável em vez de uma tela branca. Vive DENTRO do layout, por isso não
// renderiza <html>/<body> (ao contrário do global-error).
//
// Mantém-se leve e sem i18n de propósito (o erro pode estar numa dependência).
// Mostra a mensagem em pequeno para ajudar a encontrar a causa.

import { useEffect } from "react";

const GOLD = "#d9a441";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    try { console.error("[IpponLeague] erro de página:", error); } catch {}
  }, [error]);

  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: "system-ui,-apple-system,'Segoe UI',sans-serif", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ maxWidth: 360, textAlign: "center" }}>
        <div style={{ fontSize: 44, marginBottom: 8 }} aria-hidden="true">🥋</div>
        <h1 style={{ fontSize: 20, margin: "0 0 10px", color: GOLD }}>Algo correu mal</h1>
        <p style={{ fontSize: 14, lineHeight: 1.6, color: "#b7afa6", margin: "0 0 18px" }}>
          Esta página teve um erro inesperado. Tenta de novo — os teus dados estão guardados.
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
    </main>
  );
}
