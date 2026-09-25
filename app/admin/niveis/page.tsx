"use client";

// app/admin/niveis/page.tsx
//
// Painel de ADMIN para dar/tirar Pro e Pro Max a uma conta (conteúdo e testes).
// O acesso é decidido pelo SERVIDOR (/api/admin/nivel confirma users.is_admin
// pelo token). Aqui o estado `acesso` só controla o que se desenha — quem manda
// é a rota. Página não indexada (ver app/admin/layout.tsx).
//
// URL: /admin/niveis  (não está ligada em lado nenhum de propósito).

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";

type Acesso = "a-ver" | "sim" | "nao";
type Nivel = "gratis" | "pro" | "promax";
const ROTULO: Record<Nivel, string> = { gratis: "Grátis", pro: "Pro", promax: "Pro Max" };

interface Info {
  email: string;
  nome: string | null;
  nivel: Nivel;
}

export default function AdminNiveis() {
  const [acesso, setAcesso] = useState<Acesso>("a-ver");
  const [email, setEmail] = useState("");
  const [info, setInfo] = useState<Info | null>(null);
  const [msg, setMsg] = useState("");
  const [erro, setErro] = useState("");
  const [aTrabalhar, setATrabalhar] = useState(false);

  async function token(): Promise<string> {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || "";
  }

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const tk = await token();
        if (!tk) { if (vivo) setAcesso("nao"); return; }
        const r = await fetch("/api/admin/nivel", { headers: { authorization: `Bearer ${tk}` } });
        if (vivo) setAcesso(r.ok ? "sim" : "nao");
      } catch {
        if (vivo) setAcesso("nao");
      }
    })();
    return () => { vivo = false; };
  }, []);

  async function procurar() {
    setErro(""); setMsg(""); setInfo(null);
    const e = email.trim().toLowerCase();
    if (!e) { setErro("Escreve um email."); return; }
    setATrabalhar(true);
    try {
      const tk = await token();
      const r = await fetch(`/api/admin/nivel?email=${encodeURIComponent(e)}`, { headers: { authorization: `Bearer ${tk}` } });
      const j = await r.json();
      if (!j.ok) { setErro(j.erro || "Falhou."); return; }
      if (!j.encontrado) { setErro("Não há conta com esse email."); return; }
      setInfo({ email: String(j.email), nome: j.nome ?? null, nivel: j.nivel as Nivel });
    } catch {
      setErro("Falha de rede.");
    } finally {
      setATrabalhar(false);
    }
  }

  async function definir(nivel: Nivel) {
    setErro(""); setMsg("");
    const e = (info?.email || email).trim().toLowerCase();
    if (!e) { setErro("Procura uma conta primeiro."); return; }
    setATrabalhar(true);
    try {
      const tk = await token();
      const r = await fetch("/api/admin/nivel", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${tk}` },
        body: JSON.stringify({ email: e, nivel }),
      });
      const j = await r.json();
      if (!j.ok) { setErro(j.erro || "Falhou."); return; }
      setInfo((p) => (p ? { ...p, nivel } : { email: e, nome: null, nivel }));
      setMsg(`${e} agora é ${ROTULO[nivel]}. A conta precisa de recarregar a app para ver a mudança.`);
    } catch {
      setErro("Falha de rede.");
    } finally {
      setATrabalhar(false);
    }
  }

  if (acesso === "a-ver") return <Centro texto="A verificar acesso…" />;
  if (acesso === "nao") return <Centro texto="Sem acesso." />;

  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: FB }}>
      <div style={{ maxWidth: 460, margin: "0 auto", padding: "20px 16px 60px" }}>
        <h1 style={{ fontFamily: FD, fontSize: 18, fontWeight: 700, textTransform: "uppercase", margin: "0 0 4px" }}>Admin · Níveis</h1>
        <p style={{ fontSize: 12.5, color: "#93a39a", margin: "0 0 20px", lineHeight: 1.5 }}>
          Dar ou tirar Pro / Pro Max a uma conta (conteúdo e testes). A conta afetada precisa de recarregar a app.
        </p>

        <label style={{ display: "block", fontFamily: FD, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#93a39a", marginBottom: 8 }}>Email da conta</label>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <input value={email} onChange={(ev) => setEmail(ev.target.value)} placeholder="email@exemplo.com" inputMode="email" autoCapitalize="none" autoCorrect="off"
            style={{ flex: 1, minWidth: 0, background: "#141a17", border: "1px solid #243029", borderRadius: 12, padding: "12px 14px", color: "#f1ede2", fontSize: 15, fontFamily: FB, outline: "none" }} />
          <button onClick={procurar} disabled={aTrabalhar}
            style={{ flexShrink: 0, background: "#3f8f5a", color: "#06140d", border: "none", borderRadius: 12, padding: "0 16px", fontFamily: FD, fontWeight: 700, textTransform: "uppercase", fontSize: 13, cursor: aTrabalhar ? "default" : "pointer" }}>
            Procurar
          </button>
        </div>

        {erro && <div style={{ fontSize: 13, color: "#ef8d83", fontWeight: 700, marginBottom: 14 }}>{erro}</div>}
        {msg && <div style={{ fontSize: 13, color: "#7fd1a3", fontWeight: 700, marginBottom: 14, lineHeight: 1.5 }}>{msg}</div>}

        {info && (
          <div style={{ background: "#121815", border: "1px solid #243029", borderRadius: 14, padding: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{info.nome || "(sem nome)"}</div>
            <div style={{ fontSize: 12.5, color: "#93a39a", marginBottom: 12 }}>{info.email}</div>
            <div style={{ fontSize: 12, color: "#cfd8d2", marginBottom: 12 }}>
              Nível atual: <strong style={{ color: GOLD }}>{ROTULO[info.nivel]}</strong>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {(["gratis", "pro", "promax"] as Nivel[]).map((n) => (
                <button key={n} onClick={() => definir(n)} disabled={aTrabalhar}
                  style={{ flex: 1, padding: "11px 8px", borderRadius: 11, cursor: aTrabalhar ? "default" : "pointer", fontFamily: FD, fontWeight: 700, textTransform: "uppercase", fontSize: 12.5, border: info.nivel === n ? `2px solid ${GOLD}` : "1px solid #2a3a33", background: info.nivel === n ? "#16201b" : "#141a17", color: info.nivel === n ? GOLD : "#cfd8d2" }}>
                  {ROTULO[n]}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function Centro({ texto }: { texto: string }) {
  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#7c8a82", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-geist-mono), system-ui, sans-serif", fontSize: 13, letterSpacing: "0.14em", textTransform: "uppercase" }}>
      {texto}
    </main>
  );
}
