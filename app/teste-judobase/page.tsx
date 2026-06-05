"use client";
// Prova completa: login -> guardar a MINHA equipa na nuvem -> ler de volta (tabela equipas + RLS).
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const FD = "var(--font-geist-mono), ui-monospace, monospace";
const GOLD = "#d9a441";

type Equipa = { nome: string; atletas: string[]; capitao: string | null; atualizado_em?: string };

export default function TesteEquipa() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [estado, setEstado] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const [nomeTime, setNomeTime] = useState("");
  const [equipaNuvem, setEquipaNuvem] = useState<Equipa | null>(null);

  async function verSessao() {
    const { data } = await supabase.auth.getUser();
    setUserEmail(data.user?.email ?? null);
    setUserId(data.user?.id ?? null);
    if (data.user) carregarEquipa();
  }
  useEffect(() => {
    verSessao();
    const { data: sub } = supabase.auth.onAuthStateChange(() => verSessao());
    return () => sub.subscription.unsubscribe();
  }, []);

  async function entrar() {
    if (!email.trim() || !senha) { setEstado("Preenche email e senha."); return; }
    setOcupado(true); setEstado("A entrar...");
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
    setOcupado(false);
    setEstado(error ? "Erro: " + error.message : "Entraste! ✓");
  }
  async function sair() { await supabase.auth.signOut(); setEquipaNuvem(null); setEstado("Sessão terminada."); }

  async function carregarEquipa() {
    const { data, error } = await supabase.from("equipas").select("nome, atletas, capitao, atualizado_em").maybeSingle();
    if (error) { setEstado("Erro a ler equipa: " + error.message); return; }
    if (data) { setEquipaNuvem(data as Equipa); setNomeTime((data as any).nome || ""); }
    else setEquipaNuvem(null);
  }

  async function guardarEquipa() {
    if (!userId) return;
    if (!nomeTime.trim()) { setEstado("Dá um nome ao time."); return; }
    setOcupado(true); setEstado("A guardar equipa na nuvem...");
    // Equipa de exemplo (8 atletas fictícios) só para provar o ciclo
    const exemplo = ["ATL-1", "ATL-2", "ATL-3", "ATL-4", "ATL-5", "ATL-6", "ATL-7", "ATL-8"];
    const { error } = await supabase.from("equipas").upsert(
      { user_id: userId, nome: nomeTime.trim(), atletas: exemplo, capitao: "ATL-1", atualizado_em: new Date().toISOString() },
      { onConflict: "user_id" }
    );
    setOcupado(false);
    if (error) { setEstado("Erro a guardar: " + error.message); return; }
    setEstado("Equipa guardada na nuvem ✓");
    carregarEquipa();
  }

  const inputStyle: any = { width: "100%", boxSizing: "border-box", background: "#0c0e0d", border: "1px solid #243029", borderRadius: 9, padding: "10px 12px", color: "#f1ede2", fontSize: 14, fontFamily: "inherit", marginTop: 8 };
  const btn: any = { border: "none", borderRadius: 9, padding: "11px 16px", fontSize: 13, fontWeight: 700, textTransform: "uppercase", fontFamily: FD, cursor: "pointer" };

  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: "system-ui, sans-serif", padding: "20px 16px 60px" }}>
      <div style={{ maxWidth: 460, margin: "0 auto" }}>
        <h1 style={{ fontFamily: FD, fontSize: 20, fontWeight: 700, textTransform: "uppercase", margin: 0 }}>A minha equipa · na nuvem</h1>
        <p style={{ fontSize: 13, color: "#93a39a", lineHeight: 1.5 }}>Entra, guarda a tua equipa, e ela fica ligada à tua conta — só tu a vês.</p>

        {!userEmail ? (
          <div style={{ background: "#121815", border: "1px solid #243029", borderRadius: 14, padding: 14, marginTop: 12 }}>
            <input style={inputStyle} placeholder="email" value={email} onChange={(e: any) => setEmail(e.target.value)} />
            <input style={inputStyle} type="password" placeholder="senha" value={senha} onChange={(e: any) => setSenha(e.target.value)} />
            <button onClick={entrar} disabled={ocupado} style={{ ...btn, width: "100%", marginTop: 12, background: "#1c3a2e", color: "#aee9c9", opacity: ocupado ? 0.6 : 1 }}>Entrar</button>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#101a14", border: "1px solid #2f6f4a", borderRadius: 12, padding: "10px 14px", marginTop: 12 }}>
              <span style={{ fontSize: 13, color: "#7fd1a3" }}>Ligado: <b>{userEmail}</b></span>
              <button onClick={sair} style={{ ...btn, background: "transparent", color: "#ef8d83", padding: "4px 8px" }}>Sair</button>
            </div>

            <div style={{ background: "#121815", border: "1px solid #243029", borderRadius: 14, padding: 14, marginTop: 12 }}>
              <input style={inputStyle} placeholder="Nome do teu time" value={nomeTime} onChange={(e: any) => setNomeTime(e.target.value)} />
              <button onClick={guardarEquipa} disabled={ocupado} style={{ ...btn, width: "100%", marginTop: 12, background: GOLD, color: "#1b211e", opacity: ocupado ? 0.6 : 1 }}>Guardar equipa na nuvem</button>
            </div>

            <h2 style={{ fontFamily: FD, fontSize: 13, textTransform: "uppercase", color: GOLD, marginTop: 22 }}>O que está na nuvem</h2>
            {equipaNuvem ? (
              <div style={{ background: "#0f1411", border: "1px solid #1a221d", borderRadius: 12, padding: 14, marginTop: 8 }}>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{equipaNuvem.nome}</div>
                <div style={{ fontSize: 12, color: "#93a39a", marginTop: 4 }}>{equipaNuvem.atletas.length} atletas · capitão: {equipaNuvem.capitao}</div>
                <div style={{ fontSize: 11, color: "#7c8a82", marginTop: 4 }}>Guardado: {equipaNuvem.atualizado_em ? new Date(equipaNuvem.atualizado_em).toLocaleString("pt-PT") : "—"}</div>
              </div>
            ) : (
              <div style={{ fontSize: 13, color: "#5f6f67", marginTop: 8 }}>Ainda não tens equipa guardada — escreve um nome e guarda.</div>
            )}
          </>
        )}

        {estado && <div style={{ fontSize: 12, color: estado.includes("✓") ? "#7fd1a3" : estado.includes("Erro") ? "#ef8d83" : "#93a39a", marginTop: 12, textAlign: "center" }}>{estado}</div>}
        <p style={{ fontSize: 11, color: "#5f6f67", marginTop: 24 }}>Teste temporário: equipa do jogador na nuvem.</p>
      </div>
    </main>
  );
}
