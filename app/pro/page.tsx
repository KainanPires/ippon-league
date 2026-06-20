"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Mascot } from "@/components/Mascot";
import { supabase } from "@/lib/supabase";
import { ScoutDoTime } from "@/components/ScoutDoTime";

const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";
const MAX = "#7fb8f5"; // tom do Pro Max

export default function DashboardPro() {
  const router = useRouter();
  const [estado, setEstado] = useState<"carregando" | "pro">("carregando");
  const [nome, setNome] = useState("Campeão");
  const [verBoasVindas, setVerBoasVindas] = useState(true); // caixa de boas-vindas fechável
  // Convite "Sê Pro Max" só aparece a quem NÃO é Pro Max (não fazer propaganda a quem já é Max).
  const [ehProMax, setEhProMax] = useState(false);

  // Depois de fechada uma vez, a caixa de boas-vindas fica fechada (no aparelho).
  useEffect(() => {
    try {
      if (localStorage.getItem("ippon_pro_boasvindas_fechada") === "1") setVerBoasVindas(false);
    } catch {}
  }, []);
  function fecharBoasVindas() {
    setVerBoasVindas(false);
    try { localStorage.setItem("ippon_pro_boasvindas_fechada", "1"); } catch {}
  }

  useEffect(() => {
    let active = true;

    // Lê is_pro da sessão. PROBLEMA conhecido: no PRIMEIRO instante, o metadata
    // pode vir "frio" e is_pro vir undefined → expulsava um Pro. Por isso, se a
    // 1ª leitura disser "não Pro", CONFIRMAMOS com getUser() antes de reencaminhar.
    function lerIsPro(u: { user_metadata?: { is_pro?: boolean } } | null | undefined): boolean {
      return Boolean(u?.user_metadata?.is_pro);
    }
    function lerIsProMax(u: { user_metadata?: { is_pro_max?: boolean } } | null | undefined): boolean {
      return Boolean(u?.user_metadata?.is_pro_max);
    }

    function arrancar(u: { user_metadata?: { nome?: string; is_pro_max?: boolean } } | null | undefined) {
      if (!active) return;
      const m = u?.user_metadata || {};
      setNome(String(m.nome || "").trim().split(" ")[0] || "Campeão");
      setEhProMax(lerIsProMax(u));
      setEstado("pro");
    }

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      const u = data.session?.user;
      if (!u) { router.replace("/ippon-pro"); return; }

      if (lerIsPro(u)) { arrancar(u); return; }

      try {
        const { data: fresco } = await supabase.auth.getUser();
        if (!active) return;
        if (lerIsPro(fresco?.user)) { arrancar(fresco?.user); return; }
      } catch { /* trata como não-Pro abaixo */ }

      if (active) router.replace("/ippon-pro");
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      if (!active) return;
      const u = session?.user;
      if (u && lerIsPro(u)) {
        setEstado((e) => { if (e === "carregando") arrancar(u); return e; });
      }
    });

    return () => { active = false; sub?.subscription?.unsubscribe?.(); };
  }, [router]);

  if (estado === "carregando") {
    return (
      <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: FB, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#7c8a82", fontSize: 14 }}>A carregar…</p>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: FB }}>
      <div style={{ maxWidth: 460, margin: "0 auto", padding: "14px 16px 48px" }}>
        <header style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 16 }}>
          <a href="/inicio" aria-label="Voltar" style={{ width: 34, height: 34, borderRadius: "50%", border: "1px solid #243029", display: "flex", alignItems: "center", justifyContent: "center", color: "#cfd8d2", textDecoration: "none", flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
          </a>
          <h1 style={{ fontFamily: FD, fontSize: 18, fontWeight: 700, textTransform: "uppercase", margin: 0 }}>A minha central Pro</h1>
        </header>

        {/* Boas-vindas Pro — fechável (permanente) */}
        {verBoasVindas && (
          <section style={{ position: "relative", textAlign: "center", background: "linear-gradient(160deg,#2a2410,#15110a)", border: `1px solid ${GOLD}`, borderRadius: 18, padding: "20px 18px", marginBottom: 18 }}>
            <button onClick={fecharBoasVindas} aria-label="Fechar" style={{ position: "absolute", top: 10, right: 10, width: 26, height: 26, borderRadius: "50%", border: "1px solid #4a3d18", background: "rgba(0,0,0,0.25)", color: "#c9b878", cursor: "pointer", fontSize: 13, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
            <div style={{ width: 72, height: 72, margin: "0 auto 6px" }}><Mascot belt="#141110" expression="comemorando" /></div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: GOLD }}>★ Membro Ippon Pro ★</div>
            <h2 style={{ fontFamily: FD, fontSize: 20, fontWeight: 700, textTransform: "uppercase", margin: "4px 0 6px" }}>Olá, {nome}!</h2>
            <p style={{ fontSize: 13.5, color: "#dfe6e0", lineHeight: 1.55, margin: 0 }}>Esta é a tua central de vantagens. Toca em cada atleta para veres a análise profunda do scout.</p>
          </section>
        )}

        {/* CHAVE DE ATLETAS — atalho para a chave. O Pro vê a chave congelada
            (início e resultado final) com convite a Pro Max para o ao vivo. */}
        <a href="/chave-atletas" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none", background: "linear-gradient(160deg,#2a2410,#15110a)", border: `1px solid ${GOLD}`, borderRadius: 14, padding: "13px 14px", marginBottom: 14, color: "#f1ede2" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 8, background: "#1c3a2e", flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#aee9c9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 3v18h18" /><path d="M7 14l4-4 3 3 5-6" /></svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: FD, fontSize: 15, fontWeight: 700, textTransform: "uppercase", color: GOLD }}>Chave de atletas</div>
            <div style={{ fontSize: 12, color: "#c9b878", marginTop: 1, lineHeight: 1.4 }}>Vê o quadro de cada categoria e o resultado final.</div>
          </div>
          <span style={{ color: GOLD, fontSize: 20, flexShrink: 0 }}>›</span>
        </a>

        {/* CHAMADA "Sê Pro Max" — só a quem AINDA não é Pro Max (sem propaganda a quem já é Max). */}
        {!ehProMax && (
          <a href="/pro-max" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none", background: "linear-gradient(160deg,#16243a,#0d1116)", border: `1.5px solid ${MAX}`, borderRadius: 14, padding: "13px 14px", marginBottom: 18 }}>
            <div style={{ width: 30, height: 30, borderRadius: "50%", background: MAX, color: "#0b1220", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontFamily: FD, fontWeight: 700 }}>★</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: FD, fontSize: 15, fontWeight: 700, textTransform: "uppercase", color: MAX }}>Sê Pro Max</div>
              <div style={{ fontSize: 12, color: "#9fb3cc", marginTop: 1, lineHeight: 1.4 }}>Chave ao vivo, alerta de favoritos, mais ligas, análise da chave e grupo exclusivo.</div>
            </div>
            <span style={{ color: MAX, fontSize: 20, flexShrink: 0 }}>›</span>
          </a>
        )}

        {/* SCOUT — componente partilhado (também usado na central Pro Max). */}
        <ScoutDoTime />
      </div>
    </main>
  );
}
