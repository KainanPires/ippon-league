"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";

export default function PushTeste() {
  const [segredo, setSegredo] = useState("");
  const [userId, setUserId] = useState("");
  const [titulo, setTitulo] = useState("Ippon League");
  const [corpo, setCorpo] = useState("O teu capitão vai lutar daqui a pouco! 🥋");
  const [link, setLink] = useState("/inicio");
  const [estado, setEstado] = useState("");
  const [aEnviar, setAEnviar] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const id = data.session?.user?.id;
      if (id) setUserId(id);
    });
  }, []);

  async function enviar() {
    setAEnviar(true);
    setEstado("");
    try {
      const res = await fetch("/api/push/enviar", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${segredo}` },
        body: JSON.stringify({ user_id: userId, titulo, corpo, link }),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) {
        setEstado(`Erro: ${j.erro || res.status}`);
      } else {
        setEstado(`Enviadas: ${j.enviadas} · Removidas: ${j.removidas ?? 0}`);
      }
    } catch {
      setEstado("Falha de rede.");
    }
    setAEnviar(false);
  }

  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: FB, padding: "24px 16px" }}>
      <div style={{ maxWidth: 460, margin: "0 auto" }}>
        <h1 style={{ fontFamily: FD, fontSize: 20, fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>Teste de envio push</h1>
        <p style={{ fontSize: 12.5, color: "#93a39a", marginBottom: 18 }}>Página interna. Mete o segredo e envia uma notificação real para o teu utilizador.</p>

        <Campo label="Segredo (CRON_SECRET)"><input value={segredo} onChange={(e) => setSegredo(e.target.value)} type="password" placeholder="cola aqui o teu CRON_SECRET" style={inp} /></Campo>
        <Campo label="User ID (destinatário)"><input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="user_id" style={inp} /></Campo>
        <Campo label="Título"><input value={titulo} onChange={(e) => setTitulo(e.target.value)} style={inp} /></Campo>
        <Campo label="Mensagem"><input value={corpo} onChange={(e) => setCorpo(e.target.value)} style={inp} /></Campo>
        <Campo label="Link ao tocar"><input value={link} onChange={(e) => setLink(e.target.value)} style={inp} /></Campo>

        <button onClick={enviar} disabled={aEnviar || !segredo} style={{ width: "100%", marginTop: 8, background: GOLD, color: "#1b211e", border: "none", fontFamily: FD, fontSize: 15, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", padding: 13, borderRadius: 12, cursor: aEnviar || !segredo ? "default" : "pointer", opacity: aEnviar || !segredo ? 0.6 : 1 }}>
          {aEnviar ? "A enviar..." : "Enviar notificação"}
        </button>

        {estado && <div style={{ marginTop: 14, fontSize: 13, color: estado.startsWith("Erro") || estado.startsWith("Falha") ? "#ef8d83" : "#7fd1a3" }}>{estado}</div>}

        <p style={{ fontSize: 11, color: "#5f6f67", marginTop: 22, lineHeight: 1.5 }}>
          Dica: fecha a app depois de enviares, para veres a notificação chegar com a app fechada (no iPhone, fecha a app instalada no ecrã).
        </p>
      </div>
    </main>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: "block", fontSize: 12, color: "#b6c0b9", marginBottom: 6, fontWeight: 700 }}>{label}</label>
      {children}
    </div>
  );
}

const inp: React.CSSProperties = {
  width: "100%", padding: "11px 13px", borderRadius: 11, background: "#0f1411",
  border: "1px solid #2a3a33", color: "#f1ede2", fontSize: 14, fontFamily: FB, outline: "none", boxSizing: "border-box",
};
