"use client";

// app/admin/niveis/page.tsx
//
// Painel de ADMIN — níveis (Gratuito / Pro / Pro Max) de cada conta.
// Lista todas as contas, com lupa para filtrar. Cada linha tem três quadradinhos
// (o ativo fica marcado); tocar noutro pede confirmação e muda. Há ainda um
// atalho para pôr TODOS os visíveis num nível de uma vez (útil para conteúdo).
//
// O acesso é decidido pelo SERVIDOR (/api/admin/nivel confirma users.is_admin
// pelo token). Página não indexada (ver app/admin/layout.tsx).
// URL: /admin/niveis  (não está ligada em lado nenhum de propósito).

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";
const AZUL = "#7fb8f5";

type Acesso = "a-ver" | "sim" | "nao";
type Nivel = "gratis" | "pro" | "promax";
const NIVEIS: Nivel[] = ["gratis", "pro", "promax"];
const ROTULO: Record<Nivel, string> = { gratis: "Gratuito", pro: "Pro", promax: "Pro Max" };
const COR: Record<Nivel, string> = { gratis: "#cfd8d2", pro: GOLD, promax: AZUL };

interface Utilizador {
  email: string;
  nome: string | null;
  nivel: Nivel;
}

type Pendente =
  | { tipo: "um"; email: string; nome: string | null; de: Nivel; para: Nivel }
  | { tipo: "lote"; emails: string[]; para: Nivel; n: number }
  | null;

export default function AdminNiveis() {
  const [acesso, setAcesso] = useState<Acesso>("a-ver");
  const [lista, setLista] = useState<Utilizador[]>([]);
  const [procura, setProcura] = useState("");
  const [pendente, setPendente] = useState<Pendente>(null);
  const [msg, setMsg] = useState("");
  const [erro, setErro] = useState("");
  const [aTrabalhar, setATrabalhar] = useState(false);

  async function token(): Promise<string> {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || "";
  }

  const carregar = useCallback(async () => {
    try {
      const tk = await token();
      if (!tk) { setAcesso("nao"); return; }
      const r = await fetch("/api/admin/nivel", { headers: { authorization: `Bearer ${tk}` } });
      if (!r.ok) { setAcesso("nao"); return; }
      const j = await r.json();
      setLista(Array.isArray(j.utilizadores) ? (j.utilizadores as Utilizador[]) : []);
      setAcesso("sim");
    } catch {
      setAcesso("nao");
    }
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);

  const termo = procura.trim().toLowerCase();
  const visiveis = termo === ""
    ? lista
    : lista.filter((u) => u.email.toLowerCase().includes(termo) || (u.nome || "").toLowerCase().includes(termo));

  async function aplicar() {
    if (!pendente) return;
    setErro(""); setMsg("");
    setATrabalhar(true);
    try {
      const tk = await token();
      if (pendente.tipo === "um") {
        const r = await fetch("/api/admin/nivel", {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${tk}` },
          body: JSON.stringify({ email: pendente.email, nivel: pendente.para }),
        });
        const j = await r.json();
        if (!j.ok) { setErro(j.erro || "Falhou."); return; }
        const alvo = pendente.email.toLowerCase();
        setLista((prev) => prev.map((u) => (u.email.toLowerCase() === alvo ? { ...u, nivel: pendente.para } : u)));
        setMsg(`${pendente.email} agora é ${ROTULO[pendente.para]}. A conta precisa de recarregar a app.`);
      } else {
        const r = await fetch("/api/admin/nivel", {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${tk}` },
          body: JSON.stringify({ emails: pendente.emails, nivel: pendente.para }),
        });
        const j = await r.json();
        if (!j.ok) { setErro(j.erro || "Falhou."); return; }
        const set = new Set(pendente.emails.map((e) => e.toLowerCase()));
        setLista((prev) => prev.map((u) => (set.has(u.email.toLowerCase()) ? { ...u, nivel: pendente.para } : u)));
        setMsg(`${pendente.n} conta(s) agora são ${ROTULO[pendente.para]}. Cada uma precisa de recarregar a app.`);
      }
      setPendente(null);
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
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "20px 16px 60px" }}>
        <h1 style={{ fontFamily: FD, fontSize: 18, fontWeight: 700, textTransform: "uppercase", margin: "0 0 4px" }}>Admin · Níveis</h1>
        <p style={{ fontSize: 12.5, color: "#93a39a", margin: "0 0 16px", lineHeight: 1.5 }}>
          Toca no quadradinho do nível que queres. A conta afetada precisa de recarregar a app.
        </p>

        {/* Lupa / procura */}
        <div style={{ position: "relative", marginBottom: 12 }}>
          <span aria-hidden="true" style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "#7c8a82", display: "flex" }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
          </span>
          <input value={procura} onChange={(e) => setProcura(e.target.value)} placeholder="Procurar por email ou nome" inputMode="email" autoCapitalize="none" autoCorrect="off"
            style={{ width: "100%", boxSizing: "border-box", background: "#141a17", border: "1px solid #243029", borderRadius: 12, padding: "12px 14px 12px 38px", color: "#f1ede2", fontSize: 15, fontFamily: FB, outline: "none" }} />
        </div>

        {erro && <div style={{ fontSize: 13, color: "#ef8d83", fontWeight: 700, marginBottom: 12 }}>{erro}</div>}
        {msg && <div style={{ fontSize: 13, color: "#7fd1a3", fontWeight: 700, marginBottom: 12, lineHeight: 1.5 }}>{msg}</div>}

        {/* Atalho: pôr TODOS os visíveis num nível */}
        {visiveis.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, background: "#101512", border: "1px dashed #2a3a33", borderRadius: 12, padding: "10px 12px", marginBottom: 16 }}>
            <span style={{ fontSize: 12, color: "#93a39a", fontWeight: 700 }}>Pôr os {visiveis.length} visíveis em:</span>
            {NIVEIS.map((n) => (
              <button key={n} onClick={() => setPendente({ tipo: "lote", emails: visiveis.map((u) => u.email), para: n, n: visiveis.length })} disabled={aTrabalhar}
                style={{ padding: "6px 12px", borderRadius: 999, cursor: aTrabalhar ? "default" : "pointer", fontFamily: FD, fontWeight: 700, textTransform: "uppercase", fontSize: 11.5, border: `1px solid ${COR[n]}`, background: "transparent", color: COR[n] }}>
                {ROTULO[n]}
              </button>
            ))}
          </div>
        )}

        {/* Lista */}
        <div style={{ fontSize: 11.5, color: "#6b7a72", marginBottom: 8 }}>{visiveis.length} de {lista.length} contas</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {visiveis.map((u) => (
            <div key={u.email} style={{ background: "#121815", border: "1px solid #243029", borderRadius: 12, padding: "10px 12px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 180px", minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.email}</div>
                {u.nome && <div style={{ fontSize: 11.5, color: "#93a39a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.nome}</div>}
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                {NIVEIS.map((n) => {
                  const ativo = u.nivel === n;
                  return (
                    <button key={n} onClick={() => { if (!ativo) setPendente({ tipo: "um", email: u.email, nome: u.nome, de: u.nivel, para: n }); }}
                      aria-label={ROTULO[n]} title={ROTULO[n]} disabled={aTrabalhar}
                      style={{ minWidth: 44, padding: "7px 8px", borderRadius: 9, cursor: ativo || aTrabalhar ? "default" : "pointer", fontFamily: FD, fontWeight: 700, textTransform: "uppercase", fontSize: 10.5, letterSpacing: "0.02em", border: `2px solid ${ativo ? COR[n] : "#2a3a33"}`, background: ativo ? "#16201b" : "#141a17", color: ativo ? COR[n] : "#7c8a82", boxShadow: ativo ? `0 0 0 2px ${COR[n]}22` : "none" }}>
                      {n === "promax" ? "Max" : ROTULO[n]}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {visiveis.length === 0 && (
            <div style={{ textAlign: "center", color: "#6b7a72", fontSize: 13, padding: "24px 0" }}>Nenhuma conta com esse filtro.</div>
          )}
        </div>
      </div>

      {/* Confirmação (uma conta ou lote) */}
      {pendente && (
        <div onClick={() => !aTrabalhar && setPendente(null)} style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(6,8,7,0.82)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 340, background: "#121815", border: `1px solid ${GOLD}`, borderRadius: 16, padding: 22, textAlign: "center" }}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>⚠️</div>
            <h2 style={{ fontFamily: FD, fontSize: 17, fontWeight: 700, textTransform: "uppercase", margin: "0 0 10px" }}>Tens a certeza?</h2>
            <p style={{ fontSize: 13.5, color: "#c7d0c9", lineHeight: 1.5, margin: "0 0 18px" }}>
              {pendente.tipo === "um" ? (
                <>Passar <strong style={{ color: "#f1ede2" }}>{pendente.email}</strong> de <strong style={{ color: COR[pendente.de] }}>{ROTULO[pendente.de]}</strong> para <strong style={{ color: COR[pendente.para] }}>{ROTULO[pendente.para]}</strong>?</>
              ) : (
                <>Passar os <strong style={{ color: "#f1ede2" }}>{pendente.n}</strong> utilizadores visíveis para <strong style={{ color: COR[pendente.para] }}>{ROTULO[pendente.para]}</strong>?</>
              )}
            </p>
            <button onClick={aplicar} disabled={aTrabalhar} style={{ width: "100%", padding: 13, borderRadius: 12, border: "none", background: GOLD, color: "#1b211e", fontFamily: FD, fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", cursor: aTrabalhar ? "default" : "pointer" }}>
              {aTrabalhar ? "A gravar…" : "Sim, mudar"}
            </button>
            <button onClick={() => !aTrabalhar && setPendente(null)} style={{ marginTop: 10, background: "transparent", border: "none", color: "#93a39a", fontSize: 13, cursor: "pointer", fontFamily: FB }}>Cancelar</button>
          </div>
        </div>
      )}
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
