"use client";
import { useState, useEffect, useRef, type ReactNode } from "react";
import { Mascot } from "@/components/Mascot";
import { Escudo, loadIdentity, DEFAULT_IDENTITY, type Identity } from "@/components/Escudo";
import { LinhaInstalarApp } from "@/components/InstalarApp";
import { BotaoNotificacoes } from "@/components/NotificacoesPush";
import { supabase } from "@/lib/supabase";
import { COUNTRIES, flagEmoji } from "@/lib/countries";
import { PRECO } from "@/lib/precos";
import { normalizarFaixa, corDaFaixa, nomeDaFaixa, type Faixa } from "@/lib/faixas";
const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";
const INFO: { label: string; href?: string; soon?: boolean }[] = [
  { label: "Como se joga", href: "/como-jogar" },
  { label: "Sobre a Ippon League", href: "/sobre" },
  { label: "Ippon Pro e Pro Max", href: "/sobre-pro" },
  { label: "Perguntas frequentes", href: "/faq" },
  { label: "Termos de utilização", href: "/termos" },
  { label: "Política de privacidade", href: "/privacidade" },
  { label: "Ajuda e contacto", href: "/ajuda" },
];

type Conta = {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  pais: string;
  paisIso: string;
  faixaJudo: string;
  isPro: boolean;
};

export default function Perfil() {
  const [identity, setIdentity] = useState<Identity>(DEFAULT_IDENTITY);
  const [conta, setConta] = useState<Conta | null>(null);
  const [faixaJogo, setFaixaJogo] = useState<Faixa>("branca");
  const [ready, setReady] = useState(false);
  const [saindo, setSaindo] = useState(false);
  const [abertoDados, setAbertoDados] = useState(false);
  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [avisoGuardar, setAvisoGuardar] = useState("");
  const [edNome, setEdNome] = useState("");
  const [edEmail, setEdEmail] = useState("");
  const [edPaisIso, setEdPaisIso] = useState("PT");
  const [edDialIso, setEdDialIso] = useState("PT");
  const [edContacto, setEdContacto] = useState("");
  const [emailPendente, setEmailPendente] = useState("");

  useEffect(() => {
    let active = true;
    try { setIdentity(loadIdentity()); } catch {}
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      const u = data.session?.user;
      if (u) {
        const m = u.user_metadata || {};
        let nomeLocal = "";
        try { nomeLocal = String(localStorage.getItem("ippon_name") || "").trim(); } catch {}
        const nomeFinal = (String(m.nome || "").trim() || nomeLocal || "Campeão");
        setConta({
          id: u.id,
          nome: nomeFinal,
          email: String(u.email || "").trim(),
          telefone: String(m.telefone || "").trim(),
          pais: String(m.pais || "").trim(),
          paisIso: String(m.pais_iso || "").trim(),
          faixaJudo: String(m.faixa || "").trim() || "Branca",
          isPro: Boolean(m.is_pro),
        });
        try {
          const { data: row } = await supabase.from("users").select("belt").eq("id", u.id).maybeSingle();
          if (active) setFaixaJogo(normalizarFaixa(row?.belt));
        } catch { /* fica branca por defeito */ }
      }
      setReady(true);
    });
    return () => { active = false; };
  }, []);

  async function sair() {
    if (saindo) return;
    setSaindo(true);
    try { await supabase.auth.signOut(); } catch {}
    window.location.href = "/entrar";
  }

  function abrirEdicao() {
    if (!conta) return;
    setEdNome(conta.nome === "Campeão" ? "" : conta.nome);
    setEdEmail(conta.email || "");
    setEdPaisIso(conta.paisIso || "PT");
    const tel = conta.telefone || "";
    const match = COUNTRIES
      .slice()
      .sort((a, b) => b.dial.length - a.dial.length)
      .find((c) => tel.startsWith(c.dial));
    if (match) {
      setEdDialIso(match.iso2);
      setEdContacto(tel.slice(match.dial.length).trim());
    } else {
      setEdDialIso(conta.paisIso || "PT");
      setEdContacto(tel);
    }
    setAvisoGuardar("");
    setEmailPendente("");
    setEditando(true);
  }

  async function guardar() {
    if (guardando || !conta) return;
    setGuardando(true);
    setAvisoGuardar("");
    setEmailPendente("");
    const pais = COUNTRIES.find((c) => c.iso2 === edPaisIso);
    const dial = COUNTRIES.find((c) => c.iso2 === edDialIso)?.dial ?? "";
    const telefone = edContacto.trim() ? `${dial} ${edContacto.trim()}`.trim() : "";

    // 1) Dados (nome, telefone, país) — guardam direto.
    const { error } = await supabase.auth.updateUser({
      data: {
        nome: edNome.trim(),
        telefone,
        pais: pais?.name ?? "",
        pais_iso: edPaisIso,
      },
    });
    if (error) {
      setAvisoGuardar("Não foi possível guardar agora. Tenta de novo.");
      setGuardando(false);
      return;
    }

    // 2) Email — se mudou, exige confirmação no novo endereço (não muda no ecrã já).
    const novoEmail = edEmail.trim();
    const emailMudou = novoEmail && novoEmail.toLowerCase() !== conta.email.toLowerCase();
    if (emailMudou) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(novoEmail)) {
        setAvisoGuardar("Esse email não parece válido.");
        setGuardando(false);
        return;
      }
      const { error: errEmail } = await supabase.auth.updateUser({ email: novoEmail });
      if (errEmail) {
        const m = errEmail.message || "";
        if (/already|registered|exists/i.test(m)) setAvisoGuardar("Já existe uma conta com esse email.");
        else setAvisoGuardar("Não foi possível alterar o email. Tenta de novo.");
        setGuardando(false);
        return;
      }
      setEmailPendente(novoEmail);
    }

    setConta((c) => c ? { ...c, nome: edNome.trim() || "Campeão", telefone, pais: pais?.name ?? "", paisIso: edPaisIso } : c);
    try { localStorage.setItem("ippon_name", (edNome.trim().split(" ")[0]) || ""); } catch {}
    setGuardando(false);
    // Se houver email pendente, mantém o painel aberto para a pessoa ler o aviso.
    if (!emailMudou) setEditando(false);
  }

  const nomeMostrado = conta?.nome || "Campeão";
  const corFaixaJogo = corDaFaixa(faixaJogo);
  const nomeFaixaJogo = nomeDaFaixa(faixaJogo);

  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: FB }}>
      <div style={{ maxWidth: 460, margin: "0 auto", padding: "14px 16px 40px" }}>
        <header style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 8 }}>
          <a href="/inicio" aria-label="Voltar ao início" style={{ width: 36, height: 36, borderRadius: "50%", border: "1px solid #243029", display: "flex", alignItems: "center", justifyContent: "center", color: "#cfd8d2", textDecoration: "none", flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
          </a>
          <h1 style={{ fontFamily: FD, fontSize: 19, fontWeight: 700, textTransform: "uppercase", margin: 0 }}>Perfil</h1>
        </header>

        <button onClick={() => setAbertoDados((v) => !v)} style={{ display: "flex", alignItems: "center", gap: 14, width: "100%", textAlign: "left", background: "#121815", border: "1px solid #243029", borderRadius: 16, padding: 16, marginBottom: abertoDados ? 10 : 22, cursor: "pointer", color: "#f1ede2", fontFamily: FB }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#1c3a2e", overflow: "hidden", flexShrink: 0, border: `2px solid ${corFaixaJogo}` }}>
            <Mascot belt={corFaixaJogo} expression="feliz" />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontFamily: FD, fontSize: 20, fontWeight: 700, textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nomeMostrado}</div>
            <div style={{ fontSize: 13, color: GOLD, fontWeight: 700, marginTop: 2, display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ width: 11, height: 11, borderRadius: 3, background: corFaixaJogo, border: "1px solid rgba(255,255,255,0.25)", flexShrink: 0 }} />
              Faixa {nomeFaixaJogo}
            </div>
            <div style={{ fontSize: 11, color: "#7c8a82", marginTop: 4 }}>{abertoDados ? "Toca para fechar" : "Toca para ver os teus dados"}</div>
          </div>
          <span style={{ flexShrink: 0, color: "#93a39a", transform: abertoDados ? "rotate(90deg)" : "none", transition: "transform 0.2s" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6" /></svg>
          </span>
        </button>

        {abertoDados && (
          <div style={{ marginBottom: 22 }}>
            {!ready ? (
              <div style={{ background: "#121815", border: "1px solid #243029", borderRadius: 16, padding: 16, fontSize: 13, color: "#7c8a82" }}>A carregar os teus dados…</div>
            ) : !conta ? (
              <div style={{ background: "#121815", border: "1px solid #243029", borderRadius: 16, padding: 16, fontSize: 13, color: "#93a39a" }}>
                Não encontrámos a tua conta. <a href="/entrar" style={{ color: GOLD, fontWeight: 700, textDecoration: "none" }}>Entrar</a>
              </div>
            ) : !editando ? (
              <>
                <div style={{ background: "#121815", border: "1px solid #243029", borderRadius: 16, overflow: "hidden" }}>
                  <DataRow label="Nome" value={conta.nome || "—"} first />
                  <DataRow label="Email" value={conta.email || "—"} />
                  <DataRow label="Telefone" value={conta.telefone || "—"} />
                  <DataRow label="País" value={conta.pais || "—"} />
                  <DataRow label="Faixa no judô" value={conta.faixaJudo || "—"} />
                </div>
                <p style={{ fontSize: 11, color: "#5f6f67", lineHeight: 1.5, margin: "8px 2px 0" }}>
                  A tua faixa no judô é informativa. A faixa que conta na Ippon League é a <strong style={{ color: "#93a39a" }}>Faixa {nomeFaixaJogo}</strong>, conquistada pelo teu desempenho.
                </p>
                <button onClick={abrirEdicao} style={{ display: "block", width: "100%", textAlign: "center", marginTop: 10, background: "transparent", border: `1px solid ${GOLD}`, color: GOLD, fontFamily: FD, fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", padding: "11px", borderRadius: 12, cursor: "pointer" }}>Editar dados</button>
              </>
            ) : (
              <div style={{ background: "#121815", border: `1px solid ${GOLD}`, borderRadius: 16, padding: 16 }}>
                <EditLabel>Nome</EditLabel>
                <input value={edNome} onChange={(e) => setEdNome(e.target.value)} placeholder="O teu nome" style={inputStyle} />

                <EditLabel>Email</EditLabel>
                <input value={edEmail} onChange={(e) => { setEdEmail(e.target.value); setEmailPendente(""); }} type="email" inputMode="email" placeholder="email@exemplo.com" style={inputStyle} />
                {emailPendente ? (
                  <div style={{ fontSize: 11.5, color: "#7fd1a3", lineHeight: 1.5, margin: "6px 2px 0" }}>
                    Enviámos um link para <strong>{emailPendente}</strong>. O email só muda depois de o confirmares aí.
                  </div>
                ) : (
                  <div style={{ fontSize: 11, color: "#5f6f67", lineHeight: 1.5, margin: "6px 2px 0" }}>
                    Se mudares o email, enviamos um link de confirmação para o novo endereço.
                  </div>
                )}

                <EditLabel>Telefone (opcional)</EditLabel>
                <div style={{ display: "flex", gap: 8 }}>
                  <DialSelect value={edDialIso} onChange={setEdDialIso} />
                  <input value={edContacto} onChange={(e) => setEdContacto(e.target.value)} inputMode="tel" placeholder="Número" style={inputStyle} />
                </div>

                <EditLabel>País</EditLabel>
                <CountryPicker value={edPaisIso} onChange={setEdPaisIso} />

                {avisoGuardar && <div style={{ fontSize: 12, color: "#ef8d83", marginTop: 10 }}>{avisoGuardar}</div>}

                <button onClick={guardar} disabled={guardando} style={{ width: "100%", marginTop: 16, background: GOLD, color: "#1b211e", border: "none", fontFamily: FD, fontSize: 15, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", padding: "13px", borderRadius: 12, cursor: guardando ? "default" : "pointer", opacity: guardando ? 0.7 : 1 }}>{guardando ? "A guardar…" : "Guardar"}</button>
                <button onClick={() => setEditando(false)} disabled={guardando} style={{ width: "100%", marginTop: 8, background: "transparent", border: "none", color: "#93a39a", fontSize: 13, cursor: "pointer", fontFamily: FB }}>Fechar</button>
              </div>
            )}
          </div>
        )}

        {abertoDados && ready && conta && <AlterarSenha email={conta.email} />}

        {ready && conta && (
          <>
            <SectionTitle>Notificações</SectionTitle>
            <div style={{ marginBottom: 26 }}>
              <BotaoNotificacoes userId={conta.id} />
            </div>
          </>
        )}

        {abertoDados && ready && conta && (
          <>
            <SectionTitle>A minha assinatura</SectionTitle>
            <div style={{ background: "#121815", border: `1px solid ${conta.isPro ? GOLD : "#243029"}`, borderRadius: 16, overflow: "hidden", marginBottom: 26 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 16px" }}>
                <span style={{ fontSize: 12, color: "#93a39a" }}>Estado</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: conta.isPro ? GOLD : "#93a39a", display: "flex", alignItems: "center", gap: 7 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: conta.isPro ? "#7fd1a3" : "#5f6f67" }} />
                  {conta.isPro ? "Ativo" : "Gratuito"}
                </span>
              </div>
              <DataRow label="Plano" value={conta.isPro ? "Ippon Pro" : "Gratuito"} />
              <DataRow label="Preço" value={conta.isPro ? PRECO.atualComPeriodo : "—"} />
              {conta.isPro ? (
                <div style={{ padding: 12 }}>
                  <a href="/ippon-pro" style={{ display: "block", textAlign: "center", background: "transparent", border: "1px solid #243029", color: "#cfd8d2", fontFamily: FD, fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", padding: "11px", borderRadius: 10, textDecoration: "none" }}>Gerir assinatura</a>
                </div>
              ) : (
                <div style={{ padding: 12 }}>
                  <a href="/ippon-pro" style={{ display: "block", textAlign: "center", background: GOLD, color: "#1b211e", fontFamily: FD, fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", padding: "12px", borderRadius: 10, textDecoration: "none" }}>Torna-te Pro</a>
                </div>
              )}
            </div>
          </>
        )}

        <SectionTitle>A minha equipa</SectionTitle>
        <div style={{ display: "flex", alignItems: "center", gap: 14, background: "#121815", border: "1px solid #243029", borderRadius: 16, padding: 16, marginBottom: 12 }}>
          <div style={{ flexShrink: 0, display: "flex" }}><Escudo config={identity} size={52} /></div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontFamily: FD, fontSize: 16, fontWeight: 700, textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{identity.name}</div>
            <div style={{ fontSize: 12, color: "#93a39a", marginTop: 2 }}>Escudo e nome do time</div>
          </div>
        </div>
        <a href="/escudo" style={{ display: "block", textAlign: "center", background: GOLD, color: "#1b211e", fontFamily: FD, fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", padding: "12px", borderRadius: 12, textDecoration: "none", marginBottom: 26 }}>
          Mudar escudo
        </a>

        <SectionTitle>Informações e políticas</SectionTitle>
        <div style={{ background: "#121815", border: "1px solid #243029", borderRadius: 16, overflow: "hidden", marginBottom: 26 }}>
          <LinhaInstalarApp />
          {INFO.map((it, i) => {
            const inner = (
              <>
                <span style={{ fontSize: 14, color: "#f1ede2" }}>{it.label}</span>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {it.soon && <span style={{ fontSize: 10, color: "#7c8a82", border: "1px solid #2a3a33", borderRadius: 999, padding: "2px 8px" }}>Em breve</span>}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5f6f67" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6" /></svg>
                </span>
              </>
            );
            const rowStyle: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderTop: "1px solid #1a221d", textDecoration: "none", color: "#f1ede2" };
            return it.href
              ? <a key={it.label} href={it.href} style={rowStyle}>{inner}</a>
              : <div key={it.label} style={{ ...rowStyle, opacity: 0.85, cursor: "default" }}>{inner}</div>;
          })}
        </div>

        <button onClick={sair} disabled={saindo} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, width: "100%", background: "transparent", border: "1px solid #5a2f2c", color: "#ef8d83", fontFamily: FD, fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", padding: "13px", borderRadius: 12, cursor: saindo ? "default" : "pointer", opacity: saindo ? 0.7 : 1 }}>
          <DoorIcon />
          {saindo ? "A sair…" : "Sair da conta"}
        </button>

        <p style={{ fontSize: 11, color: "#5f6f67", textAlign: "center", marginTop: 22 }}>Ippon League · versão de testes</p>
      </div>
    </main>
  );
}

// Bloco de alteração de senha (logado). Pede a senha atual (reautentica) e a nova.
function AlterarSenha({ email }: { email: string }) {
  const [aberto, setAberto] = useState(false);
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [confirma, setConfirma] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState(false);

  function limpar() {
    setAtual(""); setNova(""); setConfirma(""); setErro("");
  }

  async function alterar() {
    if (guardando) return;
    setErro(""); setOk(false);
    if (!atual) { setErro("Escreve a tua senha atual."); return; }
    if (nova.length < 6) { setErro("A nova senha precisa de pelo menos 6 caracteres."); return; }
    if (nova !== confirma) { setErro("As senhas novas não coincidem."); return; }
    if (nova === atual) { setErro("A nova senha tem de ser diferente da atual."); return; }
    setGuardando(true);
    // 1) Reautentica para confirmar a senha atual (não faz logout).
    const { error: errLogin } = await supabase.auth.signInWithPassword({ email, password: atual });
    if (errLogin) {
      setGuardando(false);
      setErro("A senha atual está incorreta.");
      return;
    }
    // 2) Define a nova senha.
    const { error } = await supabase.auth.updateUser({ password: nova });
    setGuardando(false);
    if (error) {
      const m = error.message || "";
      if (/different from the old|should be different/i.test(m)) setErro("A nova senha tem de ser diferente da atual.");
      else setErro("Não foi possível alterar a senha. Tenta de novo.");
      return;
    }
    limpar();
    setOk(true);
    setAberto(false);
  }

  return (
    <>
      <SectionTitle>Segurança</SectionTitle>
      <div style={{ background: "#121815", border: "1px solid #243029", borderRadius: 16, overflow: "hidden", marginBottom: 26 }}>
        {!aberto ? (
          <button onClick={() => { limpar(); setOk(false); setAberto(true); }} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "14px 16px", background: "transparent", border: "none", color: "#f1ede2", fontFamily: FB, fontSize: 14, cursor: "pointer" }}>
            <span>Alterar senha</span>
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {ok && <span style={{ fontSize: 11.5, color: "#7fd1a3" }}>Senha alterada</span>}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5f6f67" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6" /></svg>
            </span>
          </button>
        ) : (
          <div style={{ padding: 16 }}>
            <EditLabel>Senha atual</EditLabel>
            <div style={{ position: "relative" }}>
              <input value={atual} onChange={(e) => { setAtual(e.target.value); setErro(""); }} type={showPw ? "text" : "password"} placeholder="A tua senha atual" style={{ ...inputStyle, paddingRight: 44 }} />
              <button onClick={() => setShowPw((v) => !v)} aria-label={showPw ? "Esconder senha" : "Mostrar senha"} style={{ position: "absolute", right: 8, top: 7, width: 30, height: 30, background: "transparent", border: "none", color: "#93a39a", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  {showPw
                    ? <><path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8" /><path d="M9.4 5.2A9 9 0 0 1 21 12a9.8 9.8 0 0 1-2.3 3M6.1 6.1A9.8 9.8 0 0 0 3 12a9 9 0 0 0 11.6 5.3" /></>
                    : <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>}
                </svg>
              </button>
            </div>

            <EditLabel>Nova senha</EditLabel>
            <input value={nova} onChange={(e) => { setNova(e.target.value); setErro(""); }} type={showPw ? "text" : "password"} placeholder="Mínimo 6 caracteres" style={inputStyle} />

            <EditLabel>Confirmar nova senha</EditLabel>
            <input value={confirma} onChange={(e) => { setConfirma(e.target.value); setErro(""); }} type={showPw ? "text" : "password"} placeholder="Repete a nova senha" style={inputStyle} />

            {erro && <div style={{ fontSize: 12, color: "#ef8d83", marginTop: 10 }}>{erro}</div>}

            <button onClick={alterar} disabled={guardando} style={{ width: "100%", marginTop: 16, background: GOLD, color: "#1b211e", border: "none", fontFamily: FD, fontSize: 15, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", padding: "13px", borderRadius: 12, cursor: guardando ? "default" : "pointer", opacity: guardando ? 0.7 : 1 }}>{guardando ? "A alterar…" : "Alterar senha"}</button>
            <button onClick={() => { setAberto(false); limpar(); }} disabled={guardando} style={{ width: "100%", marginTop: 8, background: "transparent", border: "none", color: "#93a39a", fontSize: 13, cursor: "pointer", fontFamily: FB }}>Cancelar</button>
          </div>
        )}
      </div>
    </>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily: FD, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#93a39a", marginBottom: 10 }}>{children}</div>;
}

function DataRow({ label, value, first }: { label: string; value: string; first?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "13px 16px", borderTop: first ? "none" : "1px solid #1a221d" }}>
      <span style={{ fontSize: 12, color: "#93a39a", flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 14, color: "#f1ede2", textAlign: "right", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{value}</span>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", padding: "11px 13px", borderRadius: 11,
  background: "#0c0e0d", border: "1px solid #2a3a33", color: "#f1ede2",
  fontSize: 15, fontFamily: FB, outline: "none",
};

function EditLabel({ children }: { children: ReactNode }) {
  return <div style={{ fontSize: 12, color: "#b6c0b9", margin: "12px 0 6px", fontWeight: 700 }}>{children}</div>;
}

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const panelStyle: React.CSSProperties = {
  position: "absolute", top: "calc(100% + 6px)", left: 0, background: "#0f1411",
  border: "1px solid #2a3a33", borderRadius: 12, zIndex: 30,
  boxShadow: "0 12px 30px rgba(0,0,0,0.5)", overflow: "hidden",
};
const optStyle = (active: boolean): React.CSSProperties => ({
  display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left",
  padding: "9px 12px", background: active ? "#16201b" : "transparent", border: "none",
  color: "#f1ede2", fontSize: 14, cursor: "pointer", fontFamily: FB,
});

function DialSelect({ value, onChange }: { value: string; onChange: (iso: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement | null>(null);
  const selected = COUNTRIES.find((c) => c.iso2 === value) ?? COUNTRIES[0];
  useEffect(() => {
    function onDoc(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  const q = norm(query.trim());
  const filtered = q ? COUNTRIES.filter((c) => norm(c.name).includes(q) || c.dial.includes(query.trim()) || c.iso2.toLowerCase().includes(q)) : COUNTRIES;
  return (
    <div ref={ref} style={{ position: "relative", width: 124, flexShrink: 0 }}>
      <button type="button" onClick={() => setOpen((o) => !o)} style={{ ...inputStyle, textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span>{flagEmoji(selected.iso2)} {selected.dial}</span>
        <span style={{ color: "#93a39a", fontSize: 12 }}>▾</span>
      </button>
      {open && (
        <div style={{ ...panelStyle, width: 270, maxWidth: "80vw" }}>
          <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Procurar..." style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", background: "#0c0e0d", border: "none", borderBottom: "1px solid #2a3a33", color: "#f1ede2", fontSize: 14, outline: "none", fontFamily: FB }} />
          <div style={{ maxHeight: 240, overflowY: "auto" }}>
            {filtered.length === 0 && <div style={{ padding: 12, color: "#93a39a", fontSize: 13 }}>Sem resultados</div>}
            {filtered.map((c) => (
              <button key={c.iso2} type="button" onClick={() => { onChange(c.iso2); setOpen(false); setQuery(""); }} style={optStyle(c.iso2 === value)}>
                <span>{flagEmoji(c.iso2)}</span>
                <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</span>
                <span style={{ color: "#93a39a" }}>{c.dial}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CountryPicker({ value, onChange }: { value: string; onChange: (iso: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement | null>(null);
  const selected = COUNTRIES.find((c) => c.iso2 === value);
  useEffect(() => {
    function onDoc(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  const q = norm(query.trim());
  const filtered = q ? COUNTRIES.filter((c) => norm(c.name).includes(q) || c.iso2.toLowerCase().includes(q)) : COUNTRIES;
  return (
    <div ref={ref} style={{ position: "relative", width: "100%" }}>
      <button type="button" onClick={() => setOpen((o) => !o)} style={{ ...inputStyle, textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ color: selected ? "#f1ede2" : "#6f7d76" }}>{selected ? `${flagEmoji(selected.iso2)} ${selected.name}` : "Seleciona o teu país"}</span>
        <span style={{ color: "#93a39a", fontSize: 12 }}>▾</span>
      </button>
      {open && (
        <div style={{ ...panelStyle, width: "100%" }}>
          <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Procurar país..." style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", background: "#0c0e0d", border: "none", borderBottom: "1px solid #2a3a33", color: "#f1ede2", fontSize: 14, outline: "none", fontFamily: FB }} />
          <div style={{ maxHeight: 240, overflowY: "auto" }}>
            {filtered.length === 0 && <div style={{ padding: 12, color: "#93a39a", fontSize: 13 }}>Sem resultados</div>}
            {filtered.map((c) => (
              <button key={c.iso2} type="button" onClick={() => { onChange(c.iso2); setOpen(false); setQuery(""); }} style={optStyle(c.iso2 === value)}>
                <span>{flagEmoji(c.iso2)}</span>
                <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DoorIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}
