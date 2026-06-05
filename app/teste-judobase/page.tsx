"use client";
// Teste de ligação ao Supabase.
import { useEffect, useState } from "react";
import { supabase, supabaseConfigured } from "@/lib/supabase";

const FD = "var(--font-geist-mono), ui-monospace, monospace";

export default function TesteSupabase() {
  const [status, setStatus] = useState<"a-ligar" | "ok" | "erro">("a-ligar");
  const [detail, setDetail] = useState("A contactar a base de dados...");

  useEffect(() => {
    (async () => {
      if (!supabaseConfigured) {
        setStatus("erro");
        setDetail("Variáveis de ambiente em falta na Vercel.");
        return;
      }
      try {
        // Pedido inofensivo a uma tabela que não existe: se a base responder
        // (mesmo com 'tabela não existe'), a ligação está a funcionar.
        const { error } = await supabase.from("_ping_ippon").select("*").limit(1);
        if (!error) {
          setStatus("ok");
          setDetail("A base respondeu (a tabela de teste até existe!).");
        } else if (/relation|does not exist|not found|schema cache|could not find/i.test(error.message)) {
          setStatus("ok");
          setDetail("A base respondeu — tabela de teste não existe, o que é esperado. Ligação OK.");
        } else {
          setStatus("erro");
          setDetail(error.message);
        }
      } catch (e: any) {
        setStatus("erro");
        setDetail(e?.message || String(e));
      }
    })();
  }, []);

  const color = status === "ok" ? "#7fd1a3" : status === "erro" ? "#ef8d83" : "#d9a441";
  const label = status === "ok" ? "Ligado ✓" : status === "erro" ? "Problema" : "A ligar...";

  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: "system-ui, sans-serif", padding: "20px 16px 60px", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ maxWidth: 460, width: "100%", textAlign: "center" }}>
        <h1 style={{ fontFamily: FD, fontSize: 20, fontWeight: 700, textTransform: "uppercase" }}>Teste Supabase</h1>
        <div style={{ marginTop: 18, background: "#121815", border: `1px solid ${color}`, borderRadius: 14, padding: "22px 18px" }}>
          <div style={{ width: 14, height: 14, borderRadius: "50%", background: color, margin: "0 auto 12px" }} />
          <div style={{ fontFamily: FD, fontSize: 18, fontWeight: 700, color }}>{label}</div>
          <div style={{ fontSize: 13, color: "#93a39a", marginTop: 8, lineHeight: 1.5 }}>{detail}</div>
        </div>
        <p style={{ fontSize: 11, color: "#5f6f67", marginTop: 18 }}>Teste temporário de ligação.</p>
      </div>
    </main>
  );
}
