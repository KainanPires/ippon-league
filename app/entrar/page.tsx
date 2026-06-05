"use client";

import { useState } from "react";
import { Mascot } from "@/components/Mascot";
import { supabase, supabaseConfigured } from "@/lib/supabase";

const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";
const BLUE = "#8fbef0";

export default function Entrar() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [erro, setErro] = useState("");
  const [saving, setSaving] = useState(false);

  async function entrar() {
    if (saving) return;
    if (!email.trim() || !senha.trim()) {
      setErro("Preenche o email e a senha.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErro("Esse email não parece válido.");
      return;
    }
    if (!supabaseConfigured) {
      setErro("A ligação ao servidor não está configurada. Tenta mais tarde.");
      return;
    }

    setErro("");
    setSaving(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: senha,
    });

    if (error) {
      const msg = error.message || "";
      if (/invalid login credentials/i.test(msg)) {
        setErro("Email ou senha incorretos.");
      } else if (/email not confirmed/i.test(msg)) {
        setErro("Ainda não confirmaste o email. Verifica a tua caixa de entrada.");
      } else {
        setErro("Não foi possível entrar. Tenta novamente.");
      }
      setSaving(false);
      return;
    }

    window.location.href = "/inicio";
  }

  function onEnter(e: { key: string }) {
    if (e.key === "Enter") entrar();
  }

  return (
    <main style={{ minHeight: "100vh", background: "radial-gradient(circle at 50% 0%, #143026 0%, #0c0e0d 58%)", color: "#f1ede2", fontFamily: FB, display: "flex", alignItems: "center", justifyContent: "center", padding: "28px 18px" }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, justifyContent: "center", marginBottom: 4 }}>
          <span style={{ width: 30, height: 30, borderRadius: "50%", background: GOLD, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ width: 13, height: 3.5, background: "#1b211e", borderRadius: 2 }} />
          </span>
          <span style={{ fontFamily: FD, fontSize: 23, fontWeight: 700, textTransform: "uppercase" }}>
            Ippon <span style={{ color: BLUE }}>League</span>
          </span>
        </div>
        <div style={{ textAlign: "center", fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "#7c8a82", marginBottom: 14 }}>O jogo oficial dos fãs de judô</div>

        <div style={{ width: 76, height: 76, margin: "0 auto 6px" }}><Mascot belt="#141110" expression="feliz" /></div>

        <div style={{ background: "#121815", border: "1px solid #243029", borderRadius: 18, padding: 22 }}>
          <h1 style={{ fontFamily: FD, fontSize: 22, fontWeight: 700, textTransform: "uppercase", textAlign: "center", margin: "0 0 18px" }}>Entrar no dojo</h1>

          <Label>Email</Label>
          <input value={email} onChange={(e) => { setEmail(e.target.value); setErro(""); }} onKeyDown={onEnter} placeholder="tu@email.com" inputMode="email" style={inp} />

          <Label>Senha</Label>
          <div style={{ position: "relative" }}>
            <input value={senha} onChange={(e) => { setSenha(e.target.value); setErro(""); }} onKeyDown={onEnter} type={showPw ? "text" : "password"} placeholder="••••••••" style={{ ...inp, paddingRight: 44 }} />
            <button onClick={() => setShowPw((v) => !v)} aria-label={showPw ? "Esconder senha" : "Mostrar senha"} style={{ position: "absolute", right: 8, top: 8, width: 32, height: 32, background: "transparent", border: "none", color: "#93a39a", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {showPw
                  ? <><path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8" /><path d="M9.4 5.2A9 9 0 0 1 21 12a9.8 9.8 0 0 1-2.3 3M6.1 6.1A9.8 9.8 0 0 0 3 12a9 9 0 0 0 11.6 5.3" /></>
                  : <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>}
              </svg>
            </button>
          </div>

          <div style={{ textAlign: "right", margin: "8px 0 4px" }}>
            <span style={{ fontSize: 12, color: "#7c8a82" }}>Esqueceste a senha?</span>
          </div>

          {erro && <div style={{ fontSize: 12, color: "#ef8d83", margin: "4px 0 8px" }}>{erro}</div>}

          <button onClick={entrar} disabled={saving} style={{ width: "100%", marginTop: 8, background: GOLD, color: "#1b211e", border: "none", fontFamily: FD, fontSize: 16, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", padding: 14, borderRadius: 12, cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1 }}>{saving ? "A entrar..." : "Entrar"}</button>
        </div>

        <div style={{ textAlign: "center", fontSize: 13, color: "#93a39a", marginTop: 18 }}>
          Ainda não tens conta?{" "}
          <a href="/comecar" style={{ color: "#f1ede2", fontWeight: 700, textDecoration: "none", borderBottom: `2px solid ${GOLD}`, paddingBottom: 1 }}>Criar conta</a>
        </div>
      </div>
    </main>
  );
}

const inp: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", background: "#141a17", border: "1px solid #243029", borderRadius: 12,
  padding: "12px 14px", color: "#f1ede2", fontSize: 15, fontFamily: FB, outline: "none", marginBottom: 4,
};

function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily: FD, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#93a39a", margin: "12px 0 6px" }}>{children}</div>;
}
