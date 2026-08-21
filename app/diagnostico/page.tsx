"use client";

// ===================================================================
// REPOSITÓRIO DO FANTASY (ippon-league) → app/diagnostico/page.tsx
// TEMPORÁRIA — apaga-se quando acabarmos.
//
// É a gémea da página que já está na Academy. A da Academy mostrou que a
// sessão fica guardada com o nome certo. Esta responde à outra metade da
// pergunta: quando o Fantasy vai lá procurar, encontra?
//
// NÃO mostra tokens nem palavras-passe.
// ===================================================================

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Entrada = { chave: string; tamanho: number; comeca: string };

export default function Diagnostico() {
  const [entradas, setEntradas] = useState<Entrada[] | null>(null);
  const [sessao, setSessao] = useState<string>("a ver...");
  const [url, setUrl] = useState("");

  useEffect(() => {
    const lista: Entrada[] = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const chave = localStorage.key(i);
        if (!chave || !chave.startsWith("sb-")) continue;
        const valor = localStorage.getItem(chave) || "";
        lista.push({ chave, tamanho: valor.length, comeca: valor.slice(0, 12) });
      }
    } catch { /* browser sem localStorage */ }
    setEntradas(lista);

    setUrl(process.env.NEXT_PUBLIC_SUPABASE_URL || "(vazio)");

    supabase.auth.getSession().then(({ data }) => {
      const s = data.session;
      setSessao(s ? `SIM · ${s.user.email ?? s.user.id.slice(0, 8)}` : "NÃO — sem sessão");
    }).catch((e) => setSessao("erro: " + String(e)));
  }, []);

  const caixa: React.CSSProperties = {
    background: "#111613", border: "1px solid #23262a", borderRadius: 12,
    padding: 14, marginBottom: 12, fontSize: 13, lineHeight: 1.6,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    wordBreak: "break-all",
    color: "#e8eef7",
  };

  return (
    <div style={{ padding: 16, color: "#e8eef7" }}>
      <h1 style={{ fontSize: 18, marginBottom: 4 }}>Diagnóstico da sessão · FANTASY</h1>
      <p style={{ fontSize: 13, color: "#7c8ba1", marginTop: 0, marginBottom: 16 }}>
        Tira um print desta página. Não há aqui nada secreto.
      </p>

      <div style={caixa}>
        <div style={{ color: "#7c8ba1" }}>Supabase que o Fantasy usa:</div>
        {url}
      </div>

      <div style={caixa}>
        <div style={{ color: "#7c8ba1" }}>O Fantasy acha que tenho sessão?</div>
        {sessao}
      </div>

      <div style={caixa}>
        <div style={{ color: "#7c8ba1", marginBottom: 6 }}>
          Gavetas guardadas neste endereço ({entradas?.length ?? 0}):
        </div>
        {entradas === null && "a ler..."}
        {entradas?.length === 0 && "nenhuma — não há sessão guardada aqui"}
        {entradas?.map((e) => (
          <div key={e.chave} style={{ marginBottom: 8 }}>
            <div style={{ color: "#C9A227" }}>{e.chave}</div>
            <div>tamanho: {e.tamanho} · começa por: {e.comeca}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
