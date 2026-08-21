"use client";
import { useState, useEffect, useRef, type ReactNode } from "react";
import { Mascot } from "@/components/Mascot";
import { useJudogui, type JudoguiCor } from "@/components/JudoguiProvider";
import { Escudo, loadIdentity, DEFAULT_IDENTITY, type Identity } from "@/components/Escudo";
import { LinhaInstalarApp } from "@/components/InstalarApp";
import { BotaoNotificacoes } from "@/components/NotificacoesPush";
import { supabase } from "@/lib/supabase";
import { COUNTRIES, flagEmoji } from "@/lib/countries";
import { PRECO } from "@/lib/precos";
import { limparCacheNivel } from "@/lib/useNivel";
import { SeletorLingua } from "@/components/SeletorLingua";
import { useRotuloFaixa, useT, useDataPorExtenso } from "@/lib/i18n";
import { normalizarFaixa, corDaFaixa, type Faixa } from "@/lib/faixas";
const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";
const VERDE_WA = "#25D366"; // verde do WhatsApp

// O link da comunidade vem de uma variável de ambiente da Vercel, não do
// código: trocá-lo não deve obrigar a um deploy.
const LINK_COMUNIDADE = process.env.NEXT_PUBLIC_LINK_COMUNIDADE || "";
// Array de módulo: avaliado antes de o `t` existir, por isso guarda CHAVES.
const INFO: { label: string; href?: string; soon?: boolean }[] = [
  { label: "perfil.infoComoJoga", href: "/como-jogar" },
  { label: "perfil.infoSobre", href: "/sobre" },
  { label: "perfil.infoPro", href: "/sobre-pro" },
  { label: "perfil.infoFaq", href: "/faq" },
  { label: "perfil.infoTermos", href: "/termos" },
  { label: "perfil.infoPrivacidade", href: "/privacidade" },
  { label: "perfil.infoAjuda", href: "/ajuda" },
];
type Sub = {
  ehPro: boolean;
  ehProMax: boolean;
  /** Veio da Stripe e pode ser cancelada aqui. Falso em acessos dados à mão. */
  gerivel: boolean;
  renova: boolean;
  emTeste: boolean;
  expiraEm: string | null;
  fimDoTeste?: string | null;
};
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
  const t = useT();
  const dataExt = useDataPorExtenso();
  const [identity, setIdentity] = useState<Identity>(DEFAULT_IDENTITY);
  const [conta, setConta] = useState<Conta | null>(null);
  const [faixaJogo, setFaixaJogo] = useState<Faixa>("branca");
  const [ready, setReady] = useState(false);
  const [saindo, setSaindo] = useState(false);
  // A subscrição vem da rota, que a lê à Stripe. Não se usa o is_pro do
  // metadata: ele fica desatualizado assim que alguém muda de plano.
  const [sub, setSub] = useState<Sub | null>(null);
  const [aGerir, setAGerir] = useState(false);
  const [confirmarCancelar, setConfirmarCancelar] = useState(false);
  const [erroSub, setErroSub] = useState("");
  // Quem chega aqui vindo do pagamento traz ?pagamento=ok. O nível acabou de
  // mudar, e a cache do useNivel ainda tem o valor de antes de pagar — sem isto,
  // a pessoa paga, volta à app, e continua a ver-se como grátis até fechar tudo.
  useEffect(() => {
      try {
        if (new URLSearchParams(window.location.search).get("pagamento") === "ok") {
          limparCacheNivel();
        }
      } catch {}
    }, []);
  useEffect(() => {
      let vivo = true;
      (async () => {
          try {
            const { data: sess } = await supabase.auth.getSession();
            const tok = sess.session?.access_token;
            if (!tok) return;
            const res = await fetch("/api/stripe/subscricao", {
                cache: "no-store",
                headers: { Authorization: `Bearer ${tok}` },
              });
            const j = await res.json();
            if (vivo && j?.ok) setSub(j as Sub);
          } catch { /* o cartão mostra o estado neutro */ }
        })();
      return () => { vivo = false; };
    }, []);
  async function gerirSubscricao(acao: "cancelar" | "reativar") {
    setErroSub("");
    setAGerir(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const tok = sess.session?.access_token;
      if (!tok) { window.location.href = "/entrar?voltar=/perfil"; return; }
      const res = await fetch("/api/stripe/subscricao", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
          body: JSON.stringify({ acao }),
        });
      const j = await res.json();
      if (j?.ok) {
        setSub((s) => (s ? { ...s, renova: !!j.renova, expiraEm: j.expiraEm ?? s.expiraEm } : s));
      } else {
        setErroSub(j?.erro || t("perfil.erroConcluir"));
      }
    } catch {
      setErroSub(t("dd.falhaLigacao"));
    }
    setAGerir(false);
  }
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
            const nomeFinal = (String(m.nome || "").trim() || nomeLocal || t("pro.campeao"));
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
    setEdNome(conta.nome === t("pro.campeao") ? "" : conta.nome);
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
      setAvisoGuardar(t("perfil.erroGuardar"));
      setGuardando(false);
      return;
    }
    // 2) Email — se mudou, exige confirmação no novo endereço (não muda no ecrã já).
    const novoEmail = edEmail.trim();
    const emailMudou = novoEmail && novoEmail.toLowerCase() !== conta.email.toLowerCase();
    if (emailMudou) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(novoEmail)) {
        setAvisoGuardar(t("erro.emailInvalido"));
        setGuardando(false);
        return;
      }
      const { error: errEmail } = await supabase.auth.updateUser({ email: novoEmail });
      if (errEmail) {
        const m = errEmail.message || "";
        if (/already|registered|exists/i.test(m)) setAvisoGuardar(t("perfil.emailJaExiste"));
        else setAvisoGuardar(t("perfil.erroEmail"));
        setGuardando(false);
        return;
      }
      setEmailPendente(novoEmail);
    }
    setConta((c) => c ? { ...c, nome: edNome.trim() || t("pro.campeao"), telefone, pais: pais?.name ?? "", paisIso: edPaisIso } : c);
    try { localStorage.setItem("ippon_name", (edNome.trim().split(" ")[0]) || ""); } catch {}
    setGuardando(false);
    // Se houver email pendente, mantém o painel aberto para a pessoa ler o aviso.
    if (!emailMudou) setEditando(false);
  }
  const nomeMostrado = conta?.nome || t("pro.campeao");
  const corFaixaJogo = corDaFaixa(faixaJogo);
  // A FAIXA traduzida. O valor gravado em users.belt continua "azul"; só o
  // rótulo muda de língua — mesmo padrão dos países.
  const rotuloFaixa = useRotuloFaixa();
  const nomeFaixaJogo = rotuloFaixa(faixaJogo);
  // Frases com destaque a negrito no meio: a frase inteira numa chave, com um
  // marcador onde entra o negrito (aqui um valor dinâmico), dividida no render.
  const faixaInfo = t("perfil.faixaInfo").split("%F%");
  const emailPendParts = t("perfil.emailPendente").split("%E%");
  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: FB }}>
    <div style={{ maxWidth: 460, margin: "0 auto", padding: "14px 16px 40px" }}>
    <header style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 8 }}>
    <a href="/inicio" aria-label={t("perfil.voltarInicio")} style={{ width: 36, height: 36, borderRadius: "50%", border: "1px solid #243029", display: "flex", alignItems: "center", justifyContent: "center", color: "#cfd8d2", textDecoration: "none", flexShrink: 0 }}>
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
    </a>
    <h1 style={{ fontFamily: FD, fontSize: 19, fontWeight: 700, textTransform: "uppercase", margin: 0 }}>{t("perfil.titulo")}</h1>
    </header>
    <button onClick={() => setAbertoDados((v) => !v)} style={{ display: "flex", alignItems: "center", gap: 14, width: "100%", textAlign: "left", background: "#121815", border: "1px solid #243029", borderRadius: 16, padding: 16, marginBottom: abertoDados ? 10 : 22, cursor: "pointer", color: "#f1ede2", fontFamily: FB }}>
    <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#1c3a2e", overflow: "hidden", flexShrink: 0, border: `2px solid ${corFaixaJogo}` }}>
    <Mascot belt={corFaixaJogo} expression="feliz" />
    </div>
    <div style={{ minWidth: 0, flex: 1 }}>
    <div style={{ fontFamily: FD, fontSize: 20, fontWeight: 700, textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nomeMostrado}</div>
    <div style={{ fontSize: 13, color: GOLD, fontWeight: 700, marginTop: 2, display: "flex", alignItems: "center", gap: 7 }}>
    <span style={{ width: 11, height: 11, borderRadius: 3, background: corFaixaJogo, border: "1px solid rgba(255,255,255,0.25)", flexShrink: 0 }} />
    {nomeFaixaJogo}
    </div>
    <div style={{ fontSize: 11, color: "#7c8a82", marginTop: 4 }}>{abertoDados ? t("perfil.tocaFechar") : t("perfil.tocaVer")}</div>
    </div>
    <span style={{ flexShrink: 0, color: "#93a39a", transform: abertoDados ? "rotate(90deg)" : "none", transition: "transform 0.2s" }}>
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6" /></svg>
    </span>
    </button>
    {abertoDados && (
        <div style={{ marginBottom: 22 }}>
        {!ready ? (
            <div style={{ background: "#121815", border: "1px solid #243029", borderRadius: 16, padding: 16, fontSize: 13, color: "#7c8a82" }}>{t("perfil.aCarregarDados")}</div>
          ) : !conta ? (
            <div style={{ background: "#121815", border: "1px solid #243029", borderRadius: 16, padding: 16, fontSize: 13, color: "#93a39a" }}>
            {t("perfil.contaNaoEncontrada")} <a href="/entrar" style={{ color: GOLD, fontWeight: 700, textDecoration: "none" }}>{t("entrar.titulo")}</a>
            </div>
          ) : !editando ? (
            <>
            <div style={{ background: "#121815", border: "1px solid #243029", borderRadius: 16, overflow: "hidden" }}>
            <DataRow label={t("comecar.nome")} value={conta.nome || "—"} first />
            <DataRow label={t("entrar.email")} value={conta.email || "—"} />
            <DataRow label={t("perfil.telefone")} value={conta.telefone || "—"} />
            <DataRow label={t("perfil.pais")} value={conta.pais || "—"} />
            <DataRow label={t("perfil.faixaJudo")} value={conta.faixaJudo || "—"} />
            </div>
            <p style={{ fontSize: 11, color: "#5f6f67", lineHeight: 1.5, margin: "8px 2px 0" }}>
            {faixaInfo[0]}<strong style={{ color: "#93a39a" }}>{nomeFaixaJogo}</strong>{faixaInfo[1]}
            </p>
            <button onClick={abrirEdicao} style={{ display: "block", width: "100%", textAlign: "center", marginTop: 10, background: "transparent", border: `1px solid ${GOLD}`, color: GOLD, fontFamily: FD, fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", padding: "11px", borderRadius: 12, cursor: "pointer" }}>{t("perfil.editarDados")}</button>
            </>
          ) : (
            <div style={{ background: "#121815", border: `1px solid ${GOLD}`, borderRadius: 16, padding: 16 }}>
            <EditLabel>{t("comecar.nome")}</EditLabel>
            <input value={edNome} onChange={(e) => setEdNome(e.target.value)} placeholder={t("perfil.phNome")} style={inputStyle} />
            <EditLabel>{t("entrar.email")}</EditLabel>
            <input value={edEmail} onChange={(e) => { setEdEmail(e.target.value); setEmailPendente(""); }} type="email" inputMode="email" placeholder="email@exemplo.com" style={inputStyle} />
            {emailPendente ? (
                <div style={{ fontSize: 11.5, color: "#7fd1a3", lineHeight: 1.5, margin: "6px 2px 0" }}>
                {emailPendParts[0]}<strong>{emailPendente}</strong>{emailPendParts[1]}
                </div>
              ) : (
                <div style={{ fontSize: 11, color: "#5f6f67", lineHeight: 1.5, margin: "6px 2px 0" }}>
                {t("perfil.emailAviso")}
                </div>
              )}
            <EditLabel>{t("perfil.telefoneOpcional")}</EditLabel>
            <div style={{ display: "flex", gap: 8 }}>
            <DialSelect value={edDialIso} onChange={setEdDialIso} />
            <input value={edContacto} onChange={(e) => setEdContacto(e.target.value)} inputMode="tel" placeholder={t("perfil.phNumero")} style={inputStyle} />
            </div>
            <EditLabel>{t("perfil.pais")}</EditLabel>
            <CountryPicker value={edPaisIso} onChange={setEdPaisIso} />
            {avisoGuardar && <div style={{ fontSize: 12, color: "#ef8d83", marginTop: 10 }}>{avisoGuardar}</div>}
            <button onClick={guardar} disabled={guardando} style={{ width: "100%", marginTop: 16, background: GOLD, color: "#1b211e", border: "none", fontFamily: FD, fontSize: 15, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", padding: "13px", borderRadius: 12, cursor: guardando ? "default" : "pointer", opacity: guardando ? 0.7 : 1 }}>{guardando ? t("perfil.aGuardar") : t("comum.guardar")}</button>
            <button onClick={() => setEditando(false)} disabled={guardando} style={{ width: "100%", marginTop: 8, background: "transparent", border: "none", color: "#93a39a", fontSize: 13, cursor: "pointer", fontFamily: FB }}>{t("comum.fechar")}</button>
            </div>
          )}
        </div>
      )}
    {/* IDIOMA — antes das personalizações, de propósito.
        A língua não é um enfeite: é o que decide se a pessoa percebe o resto do
        ecrã. Quem chega ao perfil à procura de trocar de língua não devia ter de
        passar por três secções primeiro. É o mesmo componente das outras
        páginas, aqui na versão completa (com os nomes das línguas). */}
    {ready && conta && (
        <>
        <SectionTitle>{t("perfil.lingua")}</SectionTitle>
        <div style={{ marginBottom: 26 }}>
        <SeletorLingua />
        </div>
        </>
      )}

    {abertoDados && ready && conta && <SeletorJudogui />}
    {abertoDados && ready && conta && <AlterarSenha email={conta.email} />}
    {ready && conta && (
        <>
        <SectionTitle>{t("perfil.notificacoes")}</SectionTitle>
        <div style={{ marginBottom: 26 }}>
        <BotaoNotificacoes userId={conta.id} />
        </div>
        </>
      )}
    {abertoDados && ready && conta && (
        <>
        <SectionTitle>{t("perfil.assinatura")}</SectionTitle>
        <CartaoSubscricao
        sub={sub}
        aGerir={aGerir}
        erro={erroSub}
        onCancelar={() => setConfirmarCancelar(true)}
        onReativar={() => gerirSubscricao("reativar")}
        />

        {/* COMUNIDADE PRO MAX — só a quem é Pro Max. Repetido aqui porque o
            perfil é onde se vai à procura de "as minhas coisas". */}
        {sub?.ehProMax && LINK_COMUNIDADE && (
            <a href={LINK_COMUNIDADE} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none", background: "linear-gradient(160deg,#12291d,#0b1310)", border: `1.5px solid ${VERDE_WA}`, borderRadius: 14, padding: "13px 14px", marginBottom: 12, color: "#f1ede2" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: "50%", background: VERDE_WA, flexShrink: 0 }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="#0b1310" aria-hidden="true"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm5.8 14.06c-.24.68-1.42 1.31-1.95 1.35-.5.04-.97.22-3.27-.68-2.75-1.08-4.5-3.87-4.64-4.05-.13-.18-1.1-1.47-1.1-2.8s.7-1.99.94-2.26c.25-.27.54-.34.72-.34.18 0 .36 0 .52.01.17.01.39-.06.61.47.24.55.8 1.9.87 2.04.07.14.12.3.02.48-.09.18-.14.3-.27.46-.14.16-.29.36-.41.48-.14.14-.28.28-.12.55.16.27.72 1.18 1.55 1.91 1.06.95 1.96 1.24 2.23 1.38.27.14.43.12.59-.07.16-.18.68-.79.86-1.07.18-.27.36-.22.61-.13.25.09 1.59.75 1.86.89.27.13.45.2.52.31.07.11.07.64-.17 1.32z" /></svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: FD, fontSize: 15, fontWeight: 700, textTransform: "uppercase", color: VERDE_WA }}>{t("pro.comunidade")}</div>
            <div style={{ fontSize: 12, color: "#9fc9ae", marginTop: 1, lineHeight: 1.4 }}>{t("perfil.comunidadeCurta")}</div>
            </div>
            <span style={{ color: VERDE_WA, fontSize: 20, flexShrink: 0 }}>›</span>
            </a>
          )}
        </>
      )}
    <SectionTitle>{t("perfil.minhaEquipa")}</SectionTitle>
    <div style={{ display: "flex", alignItems: "center", gap: 14, background: "#121815", border: "1px solid #243029", borderRadius: 16, padding: 16, marginBottom: 12 }}>
    <div style={{ flexShrink: 0, display: "flex" }}><Escudo config={identity} size={52} /></div>
    <div style={{ minWidth: 0, flex: 1 }}>
    <div style={{ fontFamily: FD, fontSize: 16, fontWeight: 700, textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{identity.name}</div>
    <div style={{ fontSize: 12, color: "#93a39a", marginTop: 2 }}>{t("perfil.escudoNome")}</div>
    </div>
    </div>
    <a href="/escudo" style={{ display: "block", textAlign: "center", background: GOLD, color: "#1b211e", fontFamily: FD, fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", padding: "12px", borderRadius: 12, textDecoration: "none", marginBottom: 26 }}>
    {t("perfil.mudarEscudo")}
    </a>
    <SectionTitle>{t("perfil.infoPoliticas")}</SectionTitle>
    <div style={{ background: "#121815", border: "1px solid #243029", borderRadius: 16, overflow: "hidden", marginBottom: 26 }}>
    <LinhaInstalarApp />
    {INFO.map((it) => {
          const inner = (
            <>
            <span style={{ fontSize: 14, color: "#f1ede2" }}>{t(it.label)}</span>
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {it.soon && <span style={{ fontSize: 10, color: "#7c8a82", border: "1px solid #2a3a33", borderRadius: 999, padding: "2px 8px" }}>{t("perfil.emBreve")}</span>}
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
    {saindo ? t("perfil.aSair") : t("perfil.sair")}
    </button>
    <p style={{ fontSize: 11, color: "#5f6f67", textAlign: "center", marginTop: 22 }}>Ippon League · {t("perfil.versaoTestes")}</p>
    </div>
    {/* Confirmação de cancelamento. */}
    {confirmarCancelar && (
        <div onClick={() => setConfirmarCancelar(false)} style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }}>
        <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 360, background: "#121815", border: "1px solid #2a3a33", borderRadius: 16, padding: "20px 18px" }}>
        <div style={{ fontFamily: FD, fontSize: 15, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", color: "#f1ede2", textAlign: "center", marginBottom: 10 }}>{t("perfil.cancelarRenovacao")}</div>
        <p style={{ fontSize: 13, color: "#c7d0c9", lineHeight: 1.55, textAlign: "center", margin: "0 0 8px" }}>
        {t("perfil.cancelarCorpo1", { data: sub?.expiraEm ? dataExt(sub.expiraEm) : "—" })}
        </p>
        <p style={{ fontSize: 12, color: "#7c8a82", lineHeight: 1.5, textAlign: "center", margin: "0 0 16px" }}>
        {t("perfil.cancelarCorpo2")}
        </p>
        <div style={{ display: "flex", gap: 9 }}>
        <button onClick={() => setConfirmarCancelar(false)} style={{ flex: 1, background: "transparent", border: "1px solid #2a3a33", color: "#cfd8d2", fontFamily: FD, fontWeight: 700, textTransform: "uppercase", fontSize: 12, padding: "11px 0", borderRadius: 10, cursor: "pointer" }}>{t("dd.ficar")}</button>
        <button onClick={() => { setConfirmarCancelar(false); gerirSubscricao("cancelar"); }} style={{ flex: 1, background: "#4a2420", border: "1px solid #6d3630", color: "#ef8d83", fontFamily: FD, fontWeight: 700, textTransform: "uppercase", fontSize: 12, padding: "11px 0", borderRadius: 10, cursor: "pointer" }}>{t("comum.cancelar")}</button>
        </div>
        </div>
        </div>
      )}
    </main>
  );
}
// Bloco de alteração de senha (logado). Pede a senha atual (reautentica) e a nova.
function AlterarSenha({ email }: { email: string }) {
  const t = useT();
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
    if (!atual) { setErro(t("perfil.errSenhaAtual")); return; }
    if (nova.length < 6) { setErro(t("perfil.errNovaCurta")); return; }
    if (nova !== confirma) { setErro(t("perfil.errNaoCoincidem")); return; }
    if (nova === atual) { setErro(t("perfil.errIgual")); return; }
    setGuardando(true);
    // 1) Reautentica para confirmar a senha atual (não faz logout).
    const { error: errLogin } = await supabase.auth.signInWithPassword({ email, password: atual });
    if (errLogin) {
      setGuardando(false);
      setErro(t("perfil.errAtualIncorreta"));
      return;
    }
    // 2) Define a nova senha.
    const { error } = await supabase.auth.updateUser({ password: nova });
    setGuardando(false);
    if (error) {
      const m = error.message || "";
      if (/different from the old|should be different/i.test(m)) setErro(t("perfil.errIgual"));
      else setErro(t("perfil.errAlterarSenha"));
      return;
    }
    limpar();
    setOk(true);
    setAberto(false);
  }
  return (
    <>
    <SectionTitle>{t("perfil.seguranca")}</SectionTitle>
    <div style={{ background: "#121815", border: "1px solid #243029", borderRadius: 16, overflow: "hidden", marginBottom: 26 }}>
    {!aberto ? (
        <button onClick={() => { limpar(); setOk(false); setAberto(true); }} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "14px 16px", background: "transparent", border: "none", color: "#f1ede2", fontFamily: FB, fontSize: 14, cursor: "pointer" }}>
        <span>{t("perfil.alterarSenha")}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {ok && <span style={{ fontSize: 11.5, color: "#7fd1a3" }}>{t("perfil.senhaAlterada")}</span>}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5f6f67" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6" /></svg>
        </span>
        </button>
      ) : (
        <div style={{ padding: 16 }}>
        <EditLabel>{t("perfil.senhaAtual")}</EditLabel>
        <div style={{ position: "relative" }}>
        <input value={atual} onChange={(e) => { setAtual(e.target.value); setErro(""); }} type={showPw ? "text" : "password"} placeholder={t("perfil.phSenhaAtual")} style={{ ...inputStyle, paddingRight: 44 }} />
        <button onClick={() => setShowPw((v) => !v)} aria-label={showPw ? t("entrar.esconderSenha") : t("entrar.mostrarSenha")} style={{ position: "absolute", right: 8, top: 7, width: 30, height: 30, background: "transparent", border: "none", color: "#93a39a", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {showPw
          ? <><path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8" /><path d="M9.4 5.2A9 9 0 0 1 21 12a9.8 9.8 0 0 1-2.3 3M6.1 6.1A9.8 9.8 0 0 0 3 12a9 9 0 0 0 11.6 5.3" /></>
          : <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>}
        </svg>
        </button>
        </div>
        <EditLabel>{t("perfil.novaSenha")}</EditLabel>
        <input value={nova} onChange={(e) => { setNova(e.target.value); setErro(""); }} type={showPw ? "text" : "password"} placeholder={t("perfil.phMinimo")} style={inputStyle} />
        <EditLabel>{t("perfil.confirmarSenha")}</EditLabel>
        <input value={confirma} onChange={(e) => { setConfirma(e.target.value); setErro(""); }} type={showPw ? "text" : "password"} placeholder={t("perfil.phRepete")} style={inputStyle} />
        {erro && <div style={{ fontSize: 12, color: "#ef8d83", marginTop: 10 }}>{erro}</div>}
        <button onClick={alterar} disabled={guardando} style={{ width: "100%", marginTop: 16, background: GOLD, color: "#1b211e", border: "none", fontFamily: FD, fontSize: 15, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", padding: "13px", borderRadius: 12, cursor: guardando ? "default" : "pointer", opacity: guardando ? 0.7 : 1 }}>{guardando ? t("perfil.aAlterar") : t("perfil.alterarSenha")}</button>
        <button onClick={() => { setAberto(false); limpar(); }} disabled={guardando} style={{ width: "100%", marginTop: 8, background: "transparent", border: "none", color: "#93a39a", fontSize: 13, cursor: "pointer", fontFamily: FB }}>{t("comum.cancelar")}</button>
        </div>
      )}
    </div>
    </>
  );
}
// Dourado do Pro (o azul MAX fica para o que é mesmo exclusivo do Pro Max,
// como a cor do tatame).
const PRO_DOURADO = "#d9a441";
function SeletorJudogui() {
  const t = useT();
  const { judogui, pode, setJudogui } = useJudogui();
  const [aberto, setAberto] = useState(false);
  function escolher(cor: JudoguiCor) {
    if (!pode) { window.location.href = "/ippon-pro"; return; }
    void setJudogui(cor);
  }
  const opcoes: { id: JudoguiCor; nome: string }[] = [
    { id: "branco", nome: t("pro.corBranco") },
    { id: "azul", nome: t("pro.corAzul") },
  ];
  const judoguiProParts = t("perfil.judoguiPro").split("%D%");
  return (
    <>
    <SectionTitle>{t("perfil.judoguiDodo")}</SectionTitle>
    <div style={{ background: "#121815", border: `1px solid ${pode ? "#2a4d3e" : "#243029"}`, borderRadius: 16, overflow: "hidden", marginBottom: 26 }}>
    <button onClick={() => setAberto((v) => !v)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "14px 16px", background: "transparent", border: "none", color: "#f1ede2", fontFamily: FB, fontSize: 14, cursor: "pointer" }}>
    <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
    <span style={{ width: 30, height: 30, flexShrink: 0 }}><Mascot belt="#141110" expression="feliz" judogui={judogui} /></span>
    <span>{t("pro.mxCorJudogui")}</span>
    {!pode && <span style={{ fontSize: 9.5, color: PRO_DOURADO, border: `1px solid #5a4a18`, borderRadius: 999, padding: "2px 7px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>Pro</span>}
    </span>
    <span style={{ color: "#93a39a", transform: aberto ? "rotate(90deg)" : "none", transition: "transform 0.2s" }}>
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6" /></svg>
    </span>
    </button>
    {aberto && (
        <div style={{ padding: "0 16px 16px" }}>
        {!pode && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 9, background: "#0f1620", border: "1px solid #2f5478", borderRadius: 10, padding: "10px 12px", marginBottom: 12 }}>
            <span style={{ color: PRO_DOURADO, flexShrink: 0, marginTop: 1 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
            </span>
            <div style={{ fontSize: 12, color: "#cdd9e6", lineHeight: 1.5 }}>
            {judoguiProParts[0]}<strong style={{ color: PRO_DOURADO }}>Ippon Pro</strong>{judoguiProParts[1]}
            </div>
            </div>
          )}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10 }}>
        {opcoes.map((o) => {
              const escolhido = judogui === o.id;
              return (
                <button key={o.id} onClick={() => escolher(o.id)} style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, background: "#0c0e0d", border: `2px solid ${escolhido ? "#7fd1a3" : "#243029"}`, borderRadius: 12, padding: "12px 8px", cursor: "pointer", opacity: pode ? 1 : 0.85 }}>
                <span style={{ width: 56, height: 56 }}><Mascot belt="#141110" expression="feliz" judogui={o.id} /></span>
                <span style={{ fontSize: 12, color: escolhido ? "#7fd1a3" : "#cfd8d2", fontWeight: 700 }}>{o.nome}</span>
                {escolhido && (
                    <span style={{ position: "absolute", top: -8, right: -7, background: "#7fd1a3", color: "#0c1a12", borderRadius: "50%", width: 19, height: 19, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg>
                    </span>
                  )}
                {!pode && (
                    <span style={{ position: "absolute", top: 8, right: 8, color: "#93a39a" }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                    </span>
                  )}
                </button>
              );
            })}
        </div>
        {!pode && (
            <a href="/ippon-pro" style={{ display: "block", textAlign: "center", marginTop: 12, background: PRO_DOURADO, color: "#1b211e", fontFamily: FD, fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", padding: "11px", borderRadius: 10, textDecoration: "none" }}>{t("perfil.desbloquearPro")}</a>
          )}
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
  const t = useT();
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
        <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("perfil.procurar")} style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", background: "#0c0e0d", border: "none", borderBottom: "1px solid #2a3a33", color: "#f1ede2", fontSize: 14, outline: "none", fontFamily: FB }} />
        <div style={{ maxHeight: 240, overflowY: "auto" }}>
        {filtered.length === 0 && <div style={{ padding: 12, color: "#93a39a", fontSize: 13 }}>{t("perfil.semResultados")}</div>}
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
  const t = useT();
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
    <span style={{ color: selected ? "#f1ede2" : "#6f7d76" }}>{selected ? `${flagEmoji(selected.iso2)} ${selected.name}` : t("comecar.selecionaPais")}</span>
    <span style={{ color: "#93a39a", fontSize: 12 }}>▾</span>
    </button>
    {open && (
        <div style={{ ...panelStyle, width: "100%" }}>
        <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("perfil.procurarPais")} style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", background: "#0c0e0d", border: "none", borderBottom: "1px solid #2a3a33", color: "#f1ede2", fontSize: 14, outline: "none", fontFamily: FB }} />
        <div style={{ maxHeight: 240, overflowY: "auto" }}>
        {filtered.length === 0 && <div style={{ padding: 12, color: "#93a39a", fontSize: 13 }}>{t("perfil.semResultados")}</div>}
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
// O cartão da subscrição. CANCELAR NÃO TIRA O ACESSO: desliga a renovação, e a
// pessoa joga até ao fim do mês que pagou.
function CartaoSubscricao({
    sub, aGerir, erro, onCancelar, onReativar,
  }: {
    sub: Sub | null;
    aGerir: boolean;
    erro: string;
    onCancelar: () => void;
    onReativar: () => void;
  }) {
  const t = useT();
  const dataExt = useDataPorExtenso();
  const porMes = t("precos.porMes");
  const ativo = !!sub?.ehPro;
  const plano = sub?.ehProMax ? "Ippon Pro Max" : sub?.ehPro ? "Ippon Pro" : t("perfil.gratuito");
  const preco = sub?.ehProMax ? `${PRECO.maxAtual}${porMes}` : sub?.ehPro ? `${PRECO.atual}${porMes}` : "—";
  const cancelada = ativo && sub?.renova === false;
  return (
    <div style={{ background: "#121815", border: `1px solid ${cancelada ? "#5c332c" : ativo ? GOLD : "#243029"}`, borderRadius: 16, overflow: "hidden", marginBottom: 26 }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 16px" }}>
    <span style={{ fontSize: 12, color: "#93a39a" }}>{t("perfil.estado")}</span>
    <span style={{ fontSize: 13, fontWeight: 700, color: cancelada ? "#ef8d83" : ativo ? GOLD : "#93a39a", display: "flex", alignItems: "center", gap: 7 }}>
    <span style={{ width: 8, height: 8, borderRadius: "50%", background: cancelada ? "#c56a5f" : ativo ? "#7fd1a3" : "#5f6f67" }} />
    {cancelada ? t("perfil.terminaBreve") : sub?.emTeste ? t("perfil.emTeste") : ativo ? t("perfil.ativo") : t("perfil.gratuito")}
    </span>
    </div>
    <DataRow label={t("perfil.plano")} value={plano} />
    <DataRow label={t("perfil.preco")} value={preco} />
    {ativo && sub?.expiraEm && (
        <DataRow
        label={cancelada ? t("perfil.acessoAte") : sub?.emTeste ? t("perfil.primeiraCobranca") : t("perfil.proximaCobranca")}
        value={dataExt(sub.expiraEm)}
        />
      )}
    {cancelada && (
        <div style={{ padding: "12px 16px", borderTop: "1px solid #1a221d" }}>
        <p style={{ fontSize: 12.5, color: "#d6b3ad", lineHeight: 1.55, margin: 0 }}>
        {t("perfil.canceladaCorpo", { data: sub?.expiraEm ? dataExt(sub.expiraEm) : "—" })}
        </p>
        </div>
      )}
    {erro && <div style={{ padding: "0 16px 10px", fontSize: 12, color: "#ef8d83" }}>{erro}</div>}
    <div style={{ padding: 12, display: "grid", gap: 8 }}>
    {!ativo && (
        <a href="/ippon-pro" style={{ display: "block", textAlign: "center", background: GOLD, color: "#1b211e", fontFamily: FD, fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", padding: "12px", borderRadius: 10, textDecoration: "none" }}>{t("perfil.tornaPro")}</a>
      )}
    {ativo && !sub?.ehProMax && (
        <a href="/pro-max" style={{ display: "block", textAlign: "center", background: "#2a2410", border: "1px solid #5a4a18", color: GOLD, fontFamily: FD, fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", padding: "11px", borderRadius: 10, textDecoration: "none" }}>{t("pro.passarMax")}</a>
      )}
    {ativo && sub?.gerivel && !cancelada && (
        <button onClick={onCancelar} disabled={aGerir} style={{ background: "transparent", border: "1px solid #243029", color: "#93a39a", fontFamily: FD, fontSize: 12.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", padding: "11px", borderRadius: 10, cursor: aGerir ? "default" : "pointer" }}>
        {aGerir ? "…" : t("perfil.cancelarRenovacao")}
        </button>
      )}
    {ativo && sub?.gerivel && cancelada && (
        <button onClick={onReativar} disabled={aGerir} style={{ background: "#3f8f5a", border: "none", color: "#06140d", fontFamily: FD, fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", padding: "12px", borderRadius: 10, cursor: aGerir ? "default" : "pointer" }}>
        {aGerir ? "…" : t("perfil.voltarAtivar")}
        </button>
      )}
    {ativo && !sub?.gerivel && (
        <p style={{ fontSize: 12, color: "#7c8a82", textAlign: "center", margin: 0, lineHeight: 1.5 }}>
        {t("perfil.acessoManual")}
        </p>
      )}
    </div>
    </div>
  );
}
