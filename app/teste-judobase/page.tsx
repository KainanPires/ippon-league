"use client";
// Teste de login (Supabase Auth): registar, entrar, ver sessão, sair.
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const FD = "var(--font-geist-mono), ui-monospace, monospace";
const GOLD = "#d9a441";

export default function TesteLogin() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [estado, setEstado] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function verSessao() {
    const { data } = await supabase.auth.getUser();
    setUserEmail(data.user?.email ?? null);
    setUserId(data.user?.id ?? null);
  }

  useEffect(() => {
    verSessao();
    const { data: sub } = supabase.auth.onAuthStateChange(() => verSessao());
    return () => sub.subscription.unsubscribe();
  }, []);

  async function registar() {
    if (!email.trim() || senha.length < 6) { setEstado("Email válido e senha de 6+ caracteres."); return; }
    setOcupado(true); setEstado("A criar conta...");
    const { error } = await supabase.auth.signUp({ email: email.trim(), password: senha });
    setOcupado(false);
    if (error) { setEstado("Erro: " + error.message); return; }
    setEstado("Conta criada! Já estás ligado. ✓");
    verSessao();
  }

  async function entrar() {
    if (!email.trim() || !senha) { setEstado("Preenche email e senha."); return; }
    setOcupado(true); setEstado("A entrar...");
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
    setOcupado(false);
    if (error) { setEstado("Erro: " + error.message); return; }
    setEstado("Entraste! ✓");
    verSessao();
  }

  async function sair() {
    await supabase.auth.signOut();
    setEstado("Sessão terminada.");
    verSessao();
  }

  const inputStyle: any = { width: "100%", boxSizing: "border-box", background: "#0c0e0d", border: "1px solid #243029", borderRadius: 9, padding: "10px 12px", color: "#f1ede2", fontSize: 14, fontFamily: "inherit", marginTop: 8 };
  const btn: any = { flex: 1, border: "none", borderRadius: 9, padding: "11px 0", fontSize: 13, fontWeight: 700, textTransform: "uppercase", fontFamily: FD, cursor: "pointer" };

  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: "system-ui, sans-serif", padding: "20px 16px 60px" }}>
      <div style={{ maxWidth: 460, margin: "0 auto" }}>
        <h1 style={{ fontFamily: FD, fontSize: 20, fontWeight: 700, textTransform: "uppercase", margin: 0 }}>Teste de login</h1>
        <p style={{ fontSize: 13, color: "#93a39a", lineHeight: 1.5 }}>Cria uma conta ou entra. Em baixo vês quem está ligado (o "dono" que vai ter equipa).</p>

        {userEmail ? (
          <div style={{ background: "#101a14", border: "1px solid #2f6f4a", borderRadius: 14, padding: 18, marginTop: 12 }}>
            <div style={{ fontFamily: FD, fontSize: 13, color: "#7fd1a3", textTransform: "uppercase" }}>Ligado ✓</div>
            <div style={{ fontSize: 15, fontWeight: 700, marginTop: 6 }}>{userEmail}</div>
            <div style={{ fontSize: 11, color: "#7c8a82", marginTop: 4, wordBreak: "break-all" }}>ID: {userId}</div>
            <button onClick={sair} style={{ ...btn, width: "100%", marginTop: 14, background: "#2a1f1e", color: "#ef8d83" }}>Terminar sessão</button>
          </div>
        ) : (
          <div style={{ background: "#121815", border: "1px solid #243029", borderRadius: 14, padding: 14, marginTop: 12 }}>
            <input style={inputStyle} placeholder="email@exemplo.com" value={email} onChange={(e: any) => setEmail(e.target.value)} />
            <input style={inputStyle} type="password" placeholder="senha (6+ caracteres)" value={senha} onChange={(e: any) => setSenha(e.target.value)} />
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button onClick={registar} disabled={ocupado} style={{ ...btn, background: GOLD, color: "#1b211e", opacity: ocupado ? 0.6 : 1 }}>Registar</button>
              <button onClick={entrar} disabled={ocupado} style={{ ...btn, background: "#1c3a2e", color: "#aee9c9", opacity: ocupado ? 0.6 : 1 }}>Entrar</button>
            </div>
          </div>
        )}

        {estado && <div style={{ fontSize: 12, color: estado.includes("✓") ? "#7fd1a3" : estado.includes("Erro") ? "#ef8d83" : "#93a39a", marginTop: 12, textAlign: "center" }}>{estado}</div>}
        <p style={{ fontSize: 11, color: "#5f6f67", marginTop: 24 }}>Teste temporário de autenticação.</p>
      </div>
    </main>
  );
}
