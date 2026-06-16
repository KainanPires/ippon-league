"use client";

// Página de Ajuda & Contacto. Formulário que grava em `mensagens` via
// /api/mensagens. Funciona com ou sem conta: se houver sessão, associa o
// utilizador e o contexto; senão pede um email. Quando o assunto é "Elogio",
// mostra um visto de consentimento para o elogio poder aparecer publicamente.

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { loadIdentity } from "@/components/Escudo";

const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";

// EMAIL DE CONTACTO DIRETO — substitui pelo email real da Ippon League.
const EMAIL_CONTACTO = "support@ipponleague.com";

const ASSUNTOS = [
  "Dúvida",
  "Problema técnico",
  "Sugestão",
  "Elogio",
  "Conta e pagamento",
  "Parcerias",
  "Outro",
];

export default function AjudaPage() {
  const [uid, setUid] = useState<string | null>(null);
  const [emailSessao, setEmailSessao] = useState<string>("");
  const [meta, setMeta] = useState<{ is_pro?: boolean; pais_iso?: string; faixa?: string; nome?: string }>({});

  const [assunto, setAssunto] = useState<string>("");
  const [corpo, setCorpo] = useState("");
  const [consent, setConsent] = useState(false);

  const [aEnviar, setAEnviar] = useState(false);
  const [erro, setErro] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [precisaConta, setPrecisaConta] = useState(false);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!vivo) return;
      const u = sess.session?.user;
      setUid(u?.id ?? null);
      setEmailSessao(u?.email ?? "");
      setMeta((u?.user_metadata as typeof meta) ?? {});
      // Restaura um rascunho deixado antes de ir criar conta (e limpa-o).
      try {
        const raw = localStorage.getItem("ippon_ajuda_rascunho");
        if (raw) {
          const d = JSON.parse(raw) as { assunto?: string; corpo?: string; consent?: boolean };
          if (d.assunto) setAssunto(d.assunto);
          if (d.corpo) setCorpo(d.corpo);
          if (d.consent) setConsent(d.consent);
          localStorage.removeItem("ippon_ajuda_rascunho");
        }
      } catch {}
    })();
    return () => { vivo = false; };
  }, []);

  const ehElogio = assunto === "Elogio";

  async function enviar() {
    setErro("");
    if (!assunto) { setErro("Escolhe um assunto."); return; }
    if (corpo.trim().length < 5) { setErro("Escreve a tua mensagem."); return; }
    // Sem conta: guarda o que escreveu e pede para criar conta (não perde o texto).
    if (!uid) {
      try { localStorage.setItem("ippon_ajuda_rascunho", JSON.stringify({ assunto, corpo, consent })); } catch {}
      setPrecisaConta(true);
      return;
    }

    setAEnviar(true);
    const nomeTime = (() => { try { return loadIdentity().name || ""; } catch { return ""; } })();
    try {
      const res = await fetch("/api/mensagens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: uid,
          nome: meta.nome ?? "",
          nome_time: nomeTime,
          email: emailSessao,
          assunto,
          corpo,
          faixa: meta.faixa ?? null,
          pais: meta.pais_iso ?? null,
          is_pro: !!meta.is_pro,
          consentimento_publico: ehElogio ? consent : false,
        }),
      });
      const j = await res.json();
      if (!j.ok) { setErro(j.erro || "Não foi possível enviar."); setAEnviar(false); return; }
      setEnviado(true);
    } catch {
      setErro("Falha de ligação. Tenta de novo.");
      setAEnviar(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: FB }}>
      <div style={{ maxWidth: 460, margin: "0 auto", padding: "14px 14px 40px" }}>
        <header style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 14 }}>
          <a href="/inicio" aria-label="Voltar" style={{ width: 34, height: 34, borderRadius: "50%", border: "1px solid #243029", display: "flex", alignItems: "center", justifyContent: "center", color: "#cfd8d2", textDecoration: "none", flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
          </a>
          <h1 style={{ fontFamily: FD, fontSize: 19, fontWeight: 700, textTransform: "uppercase", margin: 0 }}>Ajuda e Contacto</h1>
        </header>

        {enviado ? (
          <div style={{ background: "#121815", border: `1px solid ${GOLD}`, borderRadius: 16, padding: "26px 18px", textAlign: "center" }}>
            <div style={{ fontSize: 34, marginBottom: 8 }}>🥋</div>
            <div style={{ fontFamily: FD, fontSize: 16, fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>Mensagem enviada</div>
            <p style={{ fontSize: 13.5, color: "#c7d0c9", lineHeight: 1.55, margin: 0 }}>
              Recebemos a tua mensagem. Se deixaste um email, respondemos por aí. Obrigado por ajudares a Ippon League a melhorar.
            </p>
            <a href="/inicio" style={{ display: "inline-block", marginTop: 16, background: GOLD, color: "#1b211e", fontFamily: FD, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", fontSize: 13, padding: "10px 20px", borderRadius: 10, textDecoration: "none" }}>Voltar ao início</a>
          </div>
        ) : (
          <>
            <p style={{ fontSize: 13, color: "#c7d0c9", lineHeight: 1.55, margin: "0 0 14px" }}>
              Dúvida, problema, sugestão ou só um elogio? Escreve-nos — respondemos pelo email da tua conta.
            </p>

            {/* Assunto */}
            <label style={{ display: "block", fontSize: 11, color: "#93a39a", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 7 }}>Assunto <span style={{ color: GOLD }}>*</span></label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 16 }}>
              {ASSUNTOS.map((a) => (
                <button key={a} onClick={() => setAssunto(a)} style={{ background: assunto === a ? GOLD : "#141a17", color: assunto === a ? "#1b211e" : "#cfd8d2", border: `1px solid ${assunto === a ? GOLD : "#243029"}`, borderRadius: 999, padding: "7px 13px", fontSize: 12.5, fontWeight: assunto === a ? 700 : 400, cursor: "pointer", fontFamily: FB }}>{a}</button>
              ))}
            </div>

            {uid ? (
              <div style={{ fontSize: 12, color: "#7c8a82", marginBottom: 14 }}>
                A enviar como <span style={{ color: "#cfd8d2" }}>{emailSessao || "a tua conta"}</span>.
              </div>
            ) : (
              <div style={{ fontSize: 12, color: "#93a39a", marginBottom: 14, background: "#181410", border: "1px solid #3a3320", borderRadius: 10, padding: "9px 11px", lineHeight: 1.45 }}>
                Escreve à vontade. Para enviar vais precisar de uma conta (é rápido) — guardamos o que escreveste.
              </div>
            )}

            {/* Mensagem */}
            <label style={{ display: "block", fontSize: 11, color: "#93a39a", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 7px" }}>Mensagem</label>
            <textarea value={corpo} onChange={(e) => setCorpo(e.target.value)} placeholder="Conta-nos com algum detalhe…" rows={6} maxLength={4000} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5, fontFamily: FB }} />

            {/* Consentimento — só para elogios */}
            {ehElogio && (
              <label style={{ display: "flex", alignItems: "flex-start", gap: 9, marginTop: 12, cursor: "pointer", background: "#181410", border: "1px solid #3a3320", borderRadius: 10, padding: "11px 12px" }}>
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: 2, width: 16, height: 16, accentColor: GOLD, flexShrink: 0 }} />
                <span style={{ fontSize: 12.5, color: "#c7d0c9", lineHeight: 1.5 }}>Autorizo a Ippon League a <strong style={{ color: "#e6c97a" }}>usar e divulgar</strong> este elogio, com o meu <strong style={{ color: "#e6c97a" }}>nome de utilizador, nome de time e dados de perfil</strong> (como a faixa e o país). O meu <strong style={{ color: "#e6c97a" }}>email nunca é divulgado</strong>.</span>
              </label>
            )}

            {erro && <div style={{ fontSize: 12.5, color: "#ef8d83", marginTop: 12 }}>{erro}</div>}

            {(() => {
              const podeEnviar = !!assunto && corpo.trim().length >= 5;
              const desativado = aEnviar || !podeEnviar;
              return (
                <button onClick={enviar} disabled={desativado} style={{ width: "100%", marginTop: 16, background: GOLD, color: "#1b211e", border: "none", fontFamily: FD, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", fontSize: 14, padding: "13px", borderRadius: 12, cursor: desativado ? "default" : "pointer", opacity: desativado ? 0.45 : 1 }}>
                  {aEnviar ? "A enviar…" : !assunto ? "Escolhe um assunto" : "Enviar mensagem"}
                </button>
              );
            })()}
          </>
        )}
      </div>

      {precisaConta && (
        <div onClick={() => setPrecisaConta(false)} style={{ position: "fixed", inset: 0, background: "rgba(6,8,7,0.8)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 100 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 340, background: "#121815", border: `1px solid ${GOLD}`, borderRadius: 16, padding: "22px 18px", textAlign: "center" }}>
            <div style={{ fontSize: 30, marginBottom: 8 }}>🔒</div>
            <div style={{ fontFamily: FD, fontSize: 16, fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>Precisas de conta</div>
            <p style={{ fontSize: 13.5, color: "#c7d0c9", lineHeight: 1.55, margin: "0 0 16px" }}>
              Para enviar a tua mensagem, precisas de uma conta — é rápido. Guardámos o que escreveste; quando voltares, está aqui à tua espera.
            </p>
            <a href="/entrar?voltar=/ajuda" style={{ display: "block", background: GOLD, color: "#1b211e", fontFamily: FD, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", fontSize: 14, padding: "12px", borderRadius: 11, textDecoration: "none" }}>Criar conta / Entrar</a>
            <button onClick={() => setPrecisaConta(false)} style={{ marginTop: 10, background: "transparent", border: "none", color: "#93a39a", fontSize: 12.5, cursor: "pointer", fontFamily: FB }}>Voltar</button>
            <div style={{ marginTop: 8, fontSize: 11.5 }}>
              <a href={`mailto:${EMAIL_CONTACTO}`} style={{ color: "#7c8a82", textDecoration: "none" }}>ou escreve direto para {EMAIL_CONTACTO}</a>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "#141a17",
  border: "1px solid #243029",
  borderRadius: 10,
  padding: "11px 13px",
  color: "#f1ede2",
  fontSize: 14,
  fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
  outline: "none",
  boxSizing: "border-box",
};
