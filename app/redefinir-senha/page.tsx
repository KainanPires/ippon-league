"use client";

// Página de redefinição de senha. O link do email de recuperação (enviado pelo
// Supabase a partir de /entrar) aponta para aqui. O Supabase estabelece uma
// sessão temporária de recuperação ao abrir o link; aqui a pessoa define a nova
// senha (supabase.auth.updateUser).

import { useState, useEffect } from "react";
import { Mascot } from "@/components/Mascot";
import { supabase, supabaseConfigured } from "@/lib/supabase";

const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";
const BLUE = "#8fbef0";

export default function RedefinirSenha() {
  const [estado, setEstado] = useState<"validando" | "pronto" | "invalido">("validando");
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [erro, setErro] = useState("");
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    if (!supabaseConfigured) { setEstado("invalido"); return; }
    // O Supabase processa o token do link e dispara PASSWORD_RECOVERY / cria sessão.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) setEstado("pronto");
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setEstado("pronto");
      else setTimeout(() => setEstado((e) => (e === "validando" ? "invalido" : e)), 2500);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function guardar() {
    if (saving) return;
    setErro("");
    if (senha.length < 6) { setErro("A senha precisa de pelo menos 6 caracteres."); return; }
    if (senha !== confirmar) { setErro("As senhas não coincidem."); return; }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setSaving(false);
    if (error) {
      setErro("Não foi possível guardar. O link pode ter expirado — pede um novo no login.");
      return;
    }
    setOk(true);
  }

  return (
    <main style={{ minHeight: "100vh", background: "radial-gradient(circle at 50% 0%, #143026 0%, #0c0e0d 58%)", color: "#f1ede2", fontFamily: FB, display: "flex", alignItems: "center", justifyContent: "center", padding: "28px 18px" }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, justifyContent: "center", marginBottom: 14 }}>
          <span style={{ fontFamily: FD, fontSize: 21, fontWeight: 700, textTransform: "uppercase" }}>Ippon <span style={{ color: BLUE }}>League</span></span>
        </div>
        <div style={{ width: 70, height: 70, margin: "0 auto 8px" }}><Mascot belt="#141110" expression="feliz" /></div>

        <div style={{ background: "#121815", border: "1px solid #243029", borderRadius: 18, padding: 22 }}>
          {ok ? (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 34, marginBottom: 8 }}>🥋</div>
              <h1 style={{ fontFamily: FD, fontSize: 20, fontWeight: 700, textTransform: "uppercase", margin: "0 0 8px" }}>Senha alterada</h1>
              <p style={{ fontSize: 13.5, color: "#c7d0c9", lineHeight: 1.5, margin: "0 0 16px" }}>Já podes entrar no dojo com a tua nova senha.</p>
              <a href="/entrar" style={{ display: "inline-block", background: GOLD, color: "#1b211e", fontFamily: FD, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", fontSize: 14, padding: "12px 22px", borderRadius: 12, textDecoration: "none" }}>Ir para o login</a>
            </div>
          ) : estado === "validando" ? (
            <div style={{ textAlign: "center", padding: "20px 0", fontFamily: FD, fontSize: 13, letterSpacing: "0.12em", textTransform: "uppercase", color: "#7c8a82" }}>A validar o link…</div>
          ) : estado === "invalido" ? (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 30, marginBottom: 8 }}>⏳</div>
              <h1 style={{ fontFamily: FD, fontSize: 19, fontWeight: 700, textTransform: "uppercase", margin: "0 0 8px" }}>Link inválido</h1>
              <p style={{ fontSize: 13.5, color: "#c7d0c9", lineHeight: 1.5, margin: "0 0 16px" }}>Este link expirou ou já foi usado. Pede um novo no login, em "Esqueceste a senha?".</p>
              <a href="/entrar" style={{ display: "inline-block", background: GOLD, color: "#1b211e", fontFamily: FD, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", fontSize: 14, padding: "12px 22px", borderRadius: 12, textDecoration: "none" }}>Voltar ao login</a>
            </div>
          ) : (
            <>
              <h1 style={{ fontFamily: FD, fontSize: 21, fontWeight: 700, textTransform: "uppercase", textAlign: "center", margin: "0 0 6px" }}>Nova senha</h1>
              <p style={{ fontSize: 12.5, color: "#93a39a", textAlign: "center", margin: "0 0 16px" }}>Escolhe uma senha nova para a tua conta.</p>

              <Label>Nova senha</Label>
              <div style={{ position: "relative" }}>
                <input value={senha} onChange={(e) => { setSenha(e.target.value); setErro(""); }} type={showPw ? "text" : "password"} placeholder="Mínimo 6 caracteres" style={{ ...inp, paddingRight: 44 }} />
                <button onClick={() => setShowPw((v) => !v)} aria-label={showPw ? "Esconder senha" : "Mostrar senha"} style={{ position: "absolute", right: 8, top: 8, width: 32, height: 32, background: "transparent", border: "none", color: "#93a39a", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    {showPw
                      ? <><path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8" /><path d="M9.4 5.2A9 9 0 0 1 21 12a9.8 9.8 0 0 1-2.3 3M6.1 6.1A9.8 9.8 0 0 0 3 12a9 9 0 0 0 11.6 5.3" /></>
                      : <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>}
                  </svg>
                </button>
              </div>

              <Label>Confirmar senha</Label>
              <input value={confirmar} onChange={(e) => { setConfirmar(e.target.value); setErro(""); }} type={showPw ? "text" : "password"} placeholder="Repete a senha" style={inp} />

              {erro && <div style={{ fontSize: 12, color: "#ef8d83", margin: "6px 0 0" }}>{erro}</div>}

              <button onClick={guardar} disabled={saving} style={{ width: "100%", marginTop: 14, background: GOLD, color: "#1b211e", border: "none", fontFamily: FD, fontSize: 16, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", padding: 14, borderRadius: 12, cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1 }}>{saving ? "A guardar..." : "Guardar nova senha"}</button>
            </>
          )}
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
