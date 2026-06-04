"use client";

import { Mascot } from "@/components/Mascot";

const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";

export default function Mercado() {
  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: FB, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px" }}>
      <div style={{ width: "100%", maxWidth: 420, background: "#121815", border: "1px solid #243029", borderRadius: 18, padding: 28, textAlign: "center" }}>
        <div style={{ width: 84, height: 84, margin: "0 auto 8px" }}>
          <Mascot belt="#efeadd" expression="feliz" />
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: GOLD }}>Mercado</div>
        <h1 style={{ fontFamily: FD, fontSize: 24, fontWeight: 700, textTransform: "uppercase", margin: "6px 0 8px" }}>Em construção</h1>
        <p style={{ fontSize: 14, color: "#93a39a", margin: "0 0 20px" }}>
          É aqui que vais contratar atletas — valor, valorização e mini-scout. Estamos a montar este ecrã a seguir.
        </p>
        <a href="/criar-equipa" style={{ display: "inline-block", padding: "12px 22px", borderRadius: 12, background: GOLD, color: "#1b211e", fontFamily: FD, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", textDecoration: "none" }}>
          Voltar à equipa
        </a>
      </div>
    </main>
  );
}
