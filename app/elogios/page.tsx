"use client";

// Aba de Elogios — vitrine pública dos elogios que os jogadores autorizaram a
// tornar públicos (is_elogio + consentimento_publico). Mostra nome de time,
// nome de utilizador e dados de perfil (faixa/país). Nunca mostra o email.
// Lê de /api/elogios.

import { useState, useEffect } from "react";
import { corDaFaixa, nomeDaFaixa, normalizarFaixa } from "@/lib/faixas";

const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";

interface Elogio {
  id: string;
  nome: string;
  nome_time: string;
  faixa: string;
  pais: string;
  corpo: string;
  criado_em: string | null;
}

function dataLegivel(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-PT", { day: "numeric", month: "short", year: "numeric" });
}

export default function ElogiosPage() {
  const [elogios, setElogios] = useState<Elogio[] | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const j = await fetch("/api/elogios").then((r) => r.json());
        if (vivo) setElogios(Array.isArray(j?.elogios) ? j.elogios : []);
      } catch {
        if (vivo) setElogios([]);
      }
    })();
    return () => { vivo = false; };
  }, []);

  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: FB }}>
      <div style={{ maxWidth: 460, margin: "0 auto", padding: "14px 14px 40px" }}>
        <header style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 12 }}>
          <a href="/ajuda" aria-label="Voltar" style={{ width: 34, height: 34, borderRadius: "50%", border: "1px solid #243029", display: "flex", alignItems: "center", justifyContent: "center", color: "#cfd8d2", textDecoration: "none", flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
          </a>
          <h1 style={{ fontFamily: FD, fontSize: 19, fontWeight: 700, textTransform: "uppercase", margin: 0 }}>Elogios</h1>
        </header>
        <p style={{ fontSize: 13, color: "#c7d0c9", lineHeight: 1.55, margin: "0 0 16px" }}>
          O que a comunidade diz da Ippon League. Só aparecem os elogios que os próprios jogadores autorizaram a tornar públicos.
        </p>

        {elogios === null ? (
          <div style={{ textAlign: "center", padding: "40px 16px", color: "#7c8a82", fontFamily: FD, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.1em" }}>A carregar elogios…</div>
        ) : elogios.length === 0 ? (
          <div style={{ background: "#121815", border: "1px dashed #2a3a33", borderRadius: 16, padding: "30px 18px", textAlign: "center" }}>
            <div style={{ fontSize: 30, marginBottom: 8 }}>💬</div>
            <div style={{ fontFamily: FD, fontSize: 15, fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>Ainda sem elogios</div>
            <p style={{ fontSize: 13, color: "#c7d0c9", lineHeight: 1.5, margin: "0 0 14px" }}>
              Sê o primeiro a deixar um elogio — e autoriza a partilha para apareceres aqui.
            </p>
            <a href="/ajuda" style={{ display: "inline-block", background: GOLD, color: "#1b211e", fontFamily: FD, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", fontSize: 13, padding: "10px 18px", borderRadius: 10, textDecoration: "none" }}>Deixar um elogio</a>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {elogios.map((e) => <CartaoElogio key={e.id} e={e} />)}
          </div>
        )}
      </div>
    </main>
  );
}

function CartaoElogio({ e }: { e: Elogio }) {
  const faixa = e.faixa ? normalizarFaixa(e.faixa) : null;
  const titulo = e.nome_time || e.nome || "Jogador Ippon";
  const sub: string[] = [];
  if (e.nome_time && e.nome) sub.push(e.nome);
  if (e.pais) sub.push(e.pais);

  return (
    <div style={{ background: "#121815", border: "1px solid #243029", borderRadius: 14, padding: "13px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 9 }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#1c3a2e", border: `2px solid ${faixa ? corDaFaixa(faixa) : "#243029"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontFamily: FD, fontWeight: 700, fontSize: 14, color: "#f1ede2" }}>
          {titulo.charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#f1ede2", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{titulo}</div>
          <div style={{ fontSize: 11, color: "#93a39a" }}>
            {sub.join(" · ")}{faixa ? `${sub.length ? " · " : ""}Faixa ${nomeDaFaixa(faixa)}` : ""}
          </div>
        </div>
      </div>
      <p style={{ fontSize: 13.5, color: "#dce4dd", lineHeight: 1.55, margin: 0, fontStyle: "italic" }}>“{e.corpo}”</p>
      {e.criado_em && <div style={{ fontSize: 10.5, color: "#5f6f67", marginTop: 8 }}>{dataLegivel(e.criado_em)}</div>}
    </div>
  );
}
