"use client";

// components/ApagarConta.tsx
//
// "Apagar a minha conta" — exigido pela Apple (5.1.1(v)) e pela Google.
// Fica no fundo do Perfil, discreto, por baixo do "Sair".
//
// Fluxo: botão -> janela de confirmação com o que acontece -> password ->
// reautentica (como em "Alterar senha") -> POST /api/conta/apagar -> sai da
// sessão -> /apagar-conta?feito=1.

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useT } from "@/lib/i18n";

const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";

export default function ApagarConta({ email }: { email: string }) {
  const t = useT();
  const [aberto, setAberto] = useState(false);
  const [senha, setSenha] = useState("");
  const [aApagar, setAApagar] = useState(false);
  const [erro, setErro] = useState("");

  function fechar() {
    if (aApagar) return;
    setAberto(false); setSenha(""); setErro("");
  }

  async function apagar() {
    if (aApagar) return;
    setErro("");
    if (!senha) { setErro(t("apagar.errSenha")); return; }
    setAApagar(true);
    // 1) Confirma a password (não termina a sessão).
    const { error: errLogin } = await supabase.auth.signInWithPassword({ email, password: senha });
    if (errLogin) { setAApagar(false); setErro(t("perfil.errAtualIncorreta")); return; }
    // 2) Pede ao servidor para apagar.
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token || "";
      const r = await fetch("/api/conta/apagar", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ confirmar: true }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) { setAApagar(false); setErro(t("apagar.errServidor")); return; }
    } catch {
      setAApagar(false); setErro(t("dd.falhaLigacao")); return;
    }
    // 3) Limpa a sessão local e sai.
    try { await supabase.auth.signOut(); } catch {}
    try { localStorage.removeItem("ippon_name"); } catch {}
    window.location.href = "/apagar-conta?feito=1";
  }

  return (
    <>
      <button
        onClick={() => setAberto(true)}
        style={{ display: "block", width: "100%", marginTop: 14, background: "transparent", border: "none", color: "#8a5a55", fontFamily: FB, fontSize: 12.5, textDecoration: "underline", cursor: "pointer", padding: 6 }}
      >
        {t("apagar.botao")}
      </button>

      {aberto && (
        <div onClick={fechar} style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }}>
          <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" style={{ width: "100%", maxWidth: 380, background: "#121815", border: "1px solid #5a2f2c", borderRadius: 16, padding: "20px 18px" }}>
            <div style={{ fontFamily: FD, fontSize: 15, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", color: "#ef8d83", textAlign: "center", marginBottom: 12 }}>
              {t("apagar.titulo")}
            </div>
            <p style={{ fontSize: 13, color: "#c7d0c9", lineHeight: 1.55, margin: "0 0 8px" }}>{t("apagar.intro")}</p>
            <ul style={{ listStyle: "disc", fontSize: 12.5, color: "#c7d0c9", lineHeight: 1.55, margin: "0 0 12px", paddingLeft: 18 }}>
              <li>{t("apagar.itemDados")}</li>
              <li>{t("apagar.itemPro")}</li>
              <li>{t("apagar.itemLigas")}</li>
              <li>{t("apagar.itemAcademy")}</li>
              <li>{t("apagar.itemHistorico")}</li>
            </ul>
            <p style={{ fontSize: 12.5, color: "#ef8d83", fontWeight: 700, margin: "0 0 10px" }}>{t("apagar.irreversivel")}</p>
            <div style={{ fontSize: 12, color: "#b6c0b9", margin: "0 0 6px", fontWeight: 700 }}>{t("apagar.confirmaSenha")}</div>
            <input
              type="password"
              value={senha}
              onChange={(e) => { setSenha(e.target.value); setErro(""); }}
              autoComplete="current-password"
              style={{ width: "100%", boxSizing: "border-box", padding: "11px 13px", borderRadius: 11, background: "#0c0e0d", border: "1px solid #2a3a33", color: "#f1ede2", fontSize: 15, fontFamily: FB, outline: "none" }}
            />
            {erro && <div style={{ fontSize: 12, color: "#ef8d83", marginTop: 8 }}>{erro}</div>}
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button onClick={fechar} disabled={aApagar} style={{ flex: 1, padding: 12, borderRadius: 11, background: "transparent", border: "1px solid #2a3a33", color: "#cfd8d2", fontFamily: FD, fontSize: 13, fontWeight: 700, textTransform: "uppercase", cursor: "pointer" }}>
                {t("apagar.cancelar")}
              </button>
              <button onClick={apagar} disabled={aApagar} style={{ flex: 1, padding: 12, borderRadius: 11, background: "#8f2f28", border: "none", color: "#fff", fontFamily: FD, fontSize: 13, fontWeight: 700, textTransform: "uppercase", cursor: aApagar ? "default" : "pointer", opacity: aApagar ? 0.7 : 1 }}>
                {aApagar ? t("apagar.aApagar") : t("apagar.confirmar")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
