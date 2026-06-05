"use client";
// Prova de gravar/ler na nuvem (tabela ping_mural no Supabase).
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const FD = "var(--font-geist-mono), ui-monospace, monospace";
const GOLD = "#d9a441";

type Row = { id: string; nome: string; mensagem: string; criado_em: string };

export default function MuralTeste() {
  const [nome, setNome] = useState("");
  const [msg, setMsg] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [estado, setEstado] = useState("");
  const [aGravar, setAGravar] = useState(false);

  async function carregar() {
    const { data, error } = await supabase
      .from("ping_mural")
      .select("*")
      .order("criado_em", { ascending: false })
      .limit(50);
    if (error) { setEstado("Erro a ler: " + error.message); return; }
    setRows((data || []) as Row[]);
  }

  useEffect(() => { carregar(); }, []);

  async function gravar() {
    if (!nome.trim() || !msg.trim()) { setEstado("Preenche o nome e a mensagem."); return; }
    setAGravar(true);
    setEstado("A gravar na nuvem...");
    const { error } = await supabase.from("ping_mural").insert({ nome: nome.trim(), mensagem: msg.trim() });
    setAGravar(false);
    if (error) { setEstado("Erro a gravar: " + error.message); return; }
    setMsg("");
    setEstado("Gravado na nuvem ✓");
    carregar();
  }

  const inputStyle: any = { width: "100%", boxSizing: "border-box", background: "#0c0e0d", border: "1px solid #243029", borderRadius: 9, padding: "10px 12px", color: "#f1ede2", fontSize: 14, fontFamily: "inherit", marginTop: 8 };

  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: "system-ui, sans-serif", padding: "20px 16px 60px" }}>
      <div style={{ maxWidth: 460, margin: "0 auto" }}>
        <h1 style={{ fontFamily: FD, fontSize: 20, fontWeight: 700, textTransform: "uppercase", margin: 0 }}>Mural na nuvem · teste</h1>
        <p style={{ fontSize: 13, color: "#93a39a", lineHeight: 1.5 }}>
          Escreve algo, grava, e aparece na lista — guardado no Supabase. Abre noutro telemóvel/PC e vais ver o mesmo. 🌍
        </p>

        <div style={{ background: "#121815", border: "1px solid #243029", borderRadius: 14, padding: 14, marginTop: 12 }}>
          <input style={inputStyle} placeholder="O teu nome" value={nome} onChange={(e: any) => setNome(e.target.value)} />
          <input style={inputStyle} placeholder="Uma mensagem" value={msg} onChange={(e: any) => setMsg(e.target.value)} />
          <button
            onClick={gravar}
            disabled={aGravar}
            style={{ width: "100%", marginTop: 12, background: GOLD, color: "#1b211e", border: "none", borderRadius: 9, padding: "11px 0", fontSize: 14, fontWeight: 700, textTransform: "uppercase", fontFamily: FD, cursor: "pointer", opacity: aGravar ? 0.6 : 1 }}
          >
            {aGravar ? "A gravar..." : "Gravar na nuvem"}
          </button>
          {estado && <div style={{ fontSize: 12, color: estado.includes("✓") ? "#7fd1a3" : estado.includes("Erro") ? "#ef8d83" : "#93a39a", marginTop: 10, textAlign: "center" }}>{estado}</div>}
        </div>

        <h2 style={{ fontFamily: FD, fontSize: 13, textTransform: "uppercase", color: GOLD, marginTop: 24 }}>Mensagens guardadas · {rows.length}</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 8 }}>
          {rows.length === 0 && <div style={{ fontSize: 13, color: "#5f6f67" }}>Ainda nada — grava a primeira!</div>}
          {rows.map((r) => (
            <div key={r.id} style={{ background: "#0f1411", border: "1px solid #1a221d", borderRadius: 10, padding: "9px 12px" }}>
              <div style={{ fontSize: 14, color: "#f1ede2" }}>{r.mensagem}</div>
              <div style={{ fontSize: 11, color: "#7c8a82", marginTop: 3 }}>
                — {r.nome} · {new Date(r.criado_em).toLocaleString("pt-PT")}
              </div>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 11, color: "#5f6f67", marginTop: 24 }}>Teste temporário de gravar/ler na nuvem.</p>
      </div>
    </main>
  );
}
