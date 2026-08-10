"use client";
import { useState, useEffect, useRef, type ReactNode, type CSSProperties } from "react";
// Deteção de erros de escrita no domínio do email ("@gamil.com").
// Não valida se o email existe — isso é impossível do lado do cliente. Aqui
// apanha-se o engano de teclado, que é a causa mais comum de contas com email
// morto: já houve uma na base com "@gamil.com" que nunca receberia nada.
import { avisoDoEmail, type AvisoEmail } from "@/lib/emailSugestao";
import { COUNTRIES, flagEmoji, nomeDoPais, procurarPaises } from "@/lib/countries";
import { useT, useLingua } from "@/lib/i18n";
import { SeletorLingua } from "@/components/SeletorLingua";
import { supabase, supabaseConfigured } from "@/lib/supabase";
const FONT_DISPLAY = "var(--font-geist-mono), system-ui, sans-serif";
const FONT_BODY = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";
// OS NOMES DAS FAIXAS NÃO SE TRADUZEM.
//
// "Branca", "Azul", "Preta" — é assim que um judoca fala da sua faixa em
// qualquer país, e é este valor que fica gravado no perfil. Traduzir criaria
// perfis com "White" numa conta e "Branca" noutra, para a mesma pessoa.
//
// A única linha traduzida é a última, que não é uma faixa mas uma resposta.
const BELTS = ["Branca", "Azul", "Amarela", "Verde", "Roxa", "Marrom", "Preta"];
const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
type Form = {
  name: string;
  email: string;
  senha: string;
  dataNasc: string;
  contact: string;
  dialIso: string;
  belt: string;
  countryIso: string;
};
const EMPTY: Form = { name: "", email: "", senha: "", dataNasc: "", contact: "", dialIso: "PT", belt: "", countryIso: "" };
export default function Comecar() {
  // A PORTA DE ENTRADA. O seletor de bandeiras fica no topo, antes de tudo:
  // quem não percebe a língua do ecrã tem de a poder trocar sem ler nada.
  const t = useT();
  const { lingua } = useLingua();

  const [form, setForm] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [saving, setSaving] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [confirmSent, setConfirmSent] = useState(false);
  // Aviso sobre o email: aparece ao sair do campo, e volta a ser mostrado como
  // confirmação antes de criar a conta (ver `criar`). No registo o custo de um
  // engano é alto — a conta fica sem receber nada e acaba apagada por inatividade.
  const [aviso, setAviso] = useState<AvisoEmail | null>(null);
  const [confirmarEmail, setConfirmarEmail] = useState(false);
  const [mostrarDeclaracao, setMostrarDeclaracao] = useState(false);
  const maxData = new Date().toISOString().slice(0, 10);
  function update(field: keyof Form, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  }
  function validate(): boolean {
    const e: Partial<Record<keyof Form, string>> = {};
    if (!form.name.trim()) e.name = t("erro.nome");
    if (!form.email.trim()) e.email = t("erro.emailFalta");
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = t("erro.emailInvalido");
    if (!form.senha) e.senha = t("erro.senhaFalta");
    else if (form.senha.length < 6) e.senha = t("erro.senhaCurta");
    if (!form.dataNasc) e.dataNasc = t("erro.dataFalta");
    else if (form.dataNasc > maxData) e.dataNasc = t("erro.dataFutura");
    // Telefone é opcional — sem validação.
    if (!form.belt) e.belt = t("erro.faixaFalta");
    if (!form.countryIso) e.countryIso = t("erro.paisFalta");
    setErrors(e);
    return Object.keys(e).length === 0;
  }
  // Botão principal: valida os campos e abre a janela de declaração.
  //
  // Antes disso, se o email parecer ter um erro de escrita, pede-se confirmação.
  // É o único momento em que vale a pena insistir: uma conta criada com o email
  // errado nunca recebe nada — nem a confirmação, nem recuperação de senha, nem
  // recibos — e acaba apagada por inatividade sem a pessoa perceber porquê.
  function abrirDeclaracao() {
    if (saving) return;
    // A VERIFICAÇÃO DO EMAIL VEM PRIMEIRO, antes do validate().
    //
    // Estava depois, e nunca chegava a correr: o validate() sai da função assim
    // que encontra QUALQUER campo por preencher. Com o formulário incompleto —
    // que é o caso normal enquanto se está a escrever — o aviso do email nunca
    // aparecia. Só surgiria no clique em que tudo o resto já estivesse certo,
    // e aí a janela da declaração já tinha aberto por cima.
    const a = avisoDoEmail(form.email);
    if (a && !confirmarEmail) { setAviso(a); setConfirmarEmail(true); return; }
    if (!validate()) return;
    if (!supabaseConfigured) {
      setErrors((e) => ({ ...e, email: t("entrar.servidor") }));
      return;
    }
    setMostrarDeclaracao(true);
  }
  // Confirmada a declaração, cria a conta de facto.
  async function confirmarCriacao() {
    if (saving) return;
    setSaving(true);
    const country = COUNTRIES.find((c) => c.iso2 === form.countryIso);
    const dial = COUNTRIES.find((c) => c.iso2 === form.dialIso)?.dial ?? "";
    const telefone = form.contact.trim() ? `${dial} ${form.contact.trim()}`.trim() : "";
    const { data, error } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.senha,
        options: {
          data: {
            nome: form.name.trim(),
            telefone,
            data_nascimento: form.dataNasc,
            faixa: form.belt,
            pais: country?.name ?? "",
            pais_iso: form.countryIso,
          },
          emailRedirectTo: typeof window !== "undefined" ? `${window.location.origin}/inicio` : undefined,
        },
      });
    if (error) {
      const msg = error.message || "";
      if (/already registered|already exists|user already/i.test(msg)) {
        setErrors((e) => ({ ...e, email: t("erro.emailExiste") }));
      } else if (/password/i.test(msg)) {
        setErrors((e) => ({ ...e, senha: t("erro.senhaRecusada") }));
      } else {
        setErrors((e) => ({ ...e, email: t("erro.contaFalhou") }));
      }
      setSaving(false);
      return;
    }
    try {
      localStorage.setItem("ippon_onboarding", "pending");
      localStorage.setItem("ippon_name", form.name.trim().split(" ")[0] || "");
    } catch {}
    if (data.session) {
      window.location.href = "/inicio";
    } else {
      setSaving(false);
      setConfirmSent(true);
    }
  }
  if (confirmSent) {
    return (
      <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: FONT_BODY, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px" }}>
      <div style={{ width: "100%", maxWidth: 440 }}>
      <div style={{ background: "#121815", border: "1px solid #243029", borderRadius: 18, padding: 24, textAlign: "center" }}>
      {/* A conta JÁ está criada e pode entrar agora — a confirmação do
        Supabase está desligada de propósito (pôr alguém à espera de um
          email no momento em que se entusiasmou é a forma mais rápida de
          a perder). O email de verificação é NOSSO e chega a seguir; até
        lá, joga-se na mesma.
        Este ecrã dizia "abre o link para ativar a conta" — do tempo em
        que a confirmação estava ligada. Ficou a mandar as pessoas
        esperar por um email que já não existia. */}
      <div style={{ fontSize: 40, marginBottom: 8 }}>🥋</div>
      <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 24, fontWeight: 700, textTransform: "uppercase", margin: "0 0 8px" }}>{t("comecar.contaCriada")}</h1>
      <p style={{ fontSize: 14, color: "#93a39a", margin: "0 0 8px" }}>
      Já podes entrar e montar a tua equipa.
      </p>
      <p style={{ fontSize: 13, color: "#7c8a82", margin: "0 0 18px", lineHeight: 1.5 }}>
      Vamos enviar-te um email para <strong style={{ color: "#c7d0c9" }}>{form.email.trim()}</strong> para confirmares o endereço.
      Não é preciso esperar — mas confirma quando puderes, para não perderes avisos das rodadas.
      </p>
      <a href="/entrar" style={{ display: "inline-block", padding: "12px 22px", borderRadius: 12, background: GOLD, color: "#1b211e", fontFamily: FONT_DISPLAY, fontSize: 15, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", textDecoration: "none" }}>{t("comecar.entrarAgora")}</a>
      </div>
      </div>
      </main>
    );
  }
  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: FONT_BODY, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px" }}>
    <div style={{ width: "100%", maxWidth: 440 }}>

    {/* AS BANDEIRAS ANTES DE TUDO. Quem chega aqui sem perceber português tem
      de conseguir trocar a língua sem ler uma palavra — daí só bandeiras. */}
    <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
    <SeletorLingua compacto />
    </div>

    <div style={{ background: "#121815", border: "1px solid #243029", borderRadius: 18, padding: 24 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
    <span style={{ fontFamily: FONT_DISPLAY, fontSize: 20, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>Ippon League</span>
    <span style={{ borderRadius: 999, border: `1px solid ${GOLD}`, color: GOLD, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", padding: "1px 8px" }}>{t("comecar.beta")}</span>
    </div>
    <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 28, fontWeight: 700, textTransform: "uppercase", margin: "0 0 4px" }}>{t("comecar.entraNoJogo")}</h1>
    <p style={{ fontSize: 14, color: "#93a39a", margin: "0 0 20px" }}>{t("comecar.sub")}</p>
    <Field label={t("comecar.nome")} error={errors.name}>
    <input style={inputStyle(!!errors.name)} value={form.name} onChange={(e) => update("name", e.target.value)} placeholder={t("comecar.phNome")} />
    </Field>
    <Field label={t("entrar.email")} error={errors.email}>
    <input
    style={inputStyle(!!errors.email)}
    type="email"
    value={form.email}
    onChange={(e) => { update("email", e.target.value); setAviso(null); setConfirmarEmail(false); }}
    onBlur={() => setAviso(avisoDoEmail(form.email))}
    placeholder={t("comecar.phEmail")}
    />
    {aviso && (
        <div style={{ background: "#2a2410", border: "1px solid #5a4a18", borderRadius: 9, padding: "9px 11px", marginTop: 6, fontSize: 12.5, color: "#e8d9a8", lineHeight: 1.45 }}>
        {confirmarEmail && aviso.tipo === "sugestao"
          ? t("comecar.temCerteza", { email: form.email.trim() })
          : aviso.mensagem}
        {aviso.corrigido && (
            <button
            type="button"
            onClick={() => { update("email", aviso.corrigido!); setAviso(null); setConfirmarEmail(false); }}
            style={{ display: "block", marginTop: 6, background: "transparent", border: "none", color: GOLD, fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: FONT_BODY, padding: 0, textDecoration: "underline" }}
            >
            {t("comecar.naoCorrigir", { sugestao: aviso.corrigido })}
            </button>
          )}
        {confirmarEmail && (
            <div style={{ fontSize: 11.5, color: "#93a39a", marginTop: 6 }}>
            {t("comecar.seEstiverCerto")}
            </div>
          )}
        </div>
      )}
    </Field>
    <Field label={t("entrar.senha")} error={errors.senha}>
    <div style={{ position: "relative" }}>
    <input style={{ ...inputStyle(!!errors.senha), paddingRight: 44 }} type={showPw ? "text" : "password"} value={form.senha} onChange={(e) => update("senha", e.target.value)} placeholder={t("comecar.phSenha")} />
    <button type="button" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? t("entrar.esconderSenha") : t("entrar.mostrarSenha")} style={{ position: "absolute", right: 8, top: 8, width: 32, height: 32, background: "transparent", border: "none", color: "#93a39a", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {showPw
      ? <><path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8" /><path d="M9.4 5.2A9 9 0 0 1 21 12a9.8 9.8 0 0 1-2.3 3M6.1 6.1A9.8 9.8 0 0 0 3 12a9 9 0 0 0 11.6 5.3" /></>
      : <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>}
    </svg>
    </button>
    </div>
    </Field>
    <Field label={t("comecar.dataNasc")} error={errors.dataNasc}>
    <input style={{ ...inputStyle(!!errors.dataNasc), colorScheme: "dark" }} type="date" max={maxData} value={form.dataNasc} onChange={(e) => update("dataNasc", e.target.value)} />
    </Field>
    <Field label={t("comecar.contacto")} error={errors.contact}>
    <div style={{ display: "flex", gap: 8 }}>
    <CountrySelect value={form.dialIso} onChange={(iso) => update("dialIso", iso)} />
    <input style={inputStyle(!!errors.contact)} inputMode="tel" value={form.contact} onChange={(e) => update("contact", e.target.value)} placeholder={t("comecar.phTelemovel")} />
    </div>
    </Field>
    <Field label={t("comecar.faixa")} error={errors.belt}>
    <select style={{ ...inputStyle(!!errors.belt), appearance: "none" }} value={form.belt} onChange={(e) => update("belt", e.target.value)}>
    <option value="" disabled>{t("comecar.selecionaFaixa")}</option>
    {BELTS.map((b) => (
          <option key={b} value={b}>{b}</option>
        ))}
    {/* Não é uma faixa: é uma resposta. Por isso traduz-se, ao contrário
      dos nomes das faixas. O valor gravado fica igual em toda a app. */}
    <option value="sem-faixa">{t("comecar.semFaixa")}</option>
    </select>
    </Field>
    <Field label={t("comecar.pais")} error={errors.countryIso}>
    <CountryPicker value={form.countryIso} hasError={!!errors.countryIso} onChange={(iso) => update("countryIso", iso)} />
    </Field>
    <button onClick={abrirDeclaracao} disabled={saving} style={{ width: "100%", marginTop: 8, padding: "14px", borderRadius: 12, border: "none", background: GOLD, color: "#1b211e", fontFamily: FONT_DISPLAY, fontSize: 16, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1 }}>
    {t("comecar.comecarJogar")}
    </button>
    <p style={{ fontSize: 13, color: "#93a39a", textAlign: "center", marginTop: 14 }}>
    {t("comecar.jaTens")}{" "}
    <a href="/entrar" style={{ color: "#f1ede2", fontWeight: 700, textDecoration: "none", borderBottom: `2px solid ${GOLD}`, paddingBottom: 1 }}>{t("comecar.entrar")}</a>
    </p>
    <p style={{ fontSize: 11, color: "#5f6f67", textAlign: "center", marginTop: 10 }}>{t("comecar.novidades")}</p>
    </div>
    </div>
    {mostrarDeclaracao && (
        <div onClick={() => !saving && setMostrarDeclaracao(false)} style={{ position: "fixed", inset: 0, background: "rgba(6,8,7,0.82)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 100 }}>
        <div onClick={(ev) => ev.stopPropagation()} style={{ width: "100%", maxWidth: 380, background: "#121815", border: `1px solid ${GOLD}`, borderRadius: 18, padding: "24px 20px" }}>
        <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 18, fontWeight: 700, textTransform: "uppercase", textAlign: "center", margin: "0 0 12px" }}>{t("decl.titulo")}</h2>
        <p style={{ fontSize: 13.5, color: "#c7d0c9", lineHeight: 1.6, margin: "0 0 12px" }}>
        {t("decl.corpo", { dataNasc: t("decl.dataNasc"), verdadeiras: t("decl.verdadeiras") })}
    </p>
        <p style={{ fontSize: 12.5, color: "#93a39a", lineHeight: 1.6, margin: "0 0 18px" }}>
        {t("decl.aviso")}{" "}
        <a href="/termos" target="_blank" style={{ color: GOLD, textDecoration: "none", fontWeight: 700 }}>{t("decl.termos")}</a> e a{" "}
        <a href="/privacidade" target="_blank" style={{ color: GOLD, textDecoration: "none", fontWeight: 700 }}>{t("decl.privacidade")}</a>.
        </p>
        <button onClick={confirmarCriacao} disabled={saving} style={{ width: "100%", background: GOLD, color: "#1b211e", border: "none", fontFamily: FONT_DISPLAY, fontSize: 15, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", padding: "13px", borderRadius: 12, cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1 }}>
        {saving ? t("decl.aCriarConta") : t("decl.confirmar")}
        </button>
        <button onClick={() => setMostrarDeclaracao(false)} disabled={saving} style={{ width: "100%", marginTop: 8, background: "transparent", border: "none", color: "#93a39a", fontSize: 13, cursor: saving ? "default" : "pointer", fontFamily: FONT_BODY }}>{t("decl.voltarRever")}</button>
        </div>
        </div>
      )}
    </main>
  );
}
function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
    <label style={{ display: "block", fontSize: 12, color: "#b6c0b9", marginBottom: 6, fontWeight: 700 }}>{label}</label>
    {children}
    {error && <div style={{ fontSize: 11, color: "#ef8d83", marginTop: 4 }}>{error}</div>}
    </div>
  );
}
function inputStyle(hasError: boolean): CSSProperties {
  return {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 12,
    background: "#0c0e0d",
    border: `1px solid ${hasError ? "#ef8d83" : "#2a3a33"}`,
    color: "#f1ede2",
    fontSize: 15,
    fontFamily: FONT_BODY,
    outline: "none",
    boxSizing: "border-box",
  };
}
const panelStyle: CSSProperties = {
  position: "absolute",
  top: "calc(100% + 6px)",
  left: 0,
  background: "#0f1411",
  border: "1px solid #2a3a33",
  borderRadius: 12,
  zIndex: 30,
  boxShadow: "0 12px 30px rgba(0,0,0,0.5)",
  overflow: "hidden",
};
const optionStyle = (active: boolean): CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: 8,
    width: "100%",
    textAlign: "left",
    padding: "9px 12px",
    background: active ? "#16201b" : "transparent",
    border: "none",
    color: "#f1ede2",
    fontSize: 14,
    cursor: "pointer",
    fontFamily: FONT_BODY,
  });
function CountrySelect({ value, onChange }: { value: string; onChange: (iso: string) => void }) {
  // Hooks próprios: este é um componente à parte, não vê o `t` nem o `lingua`
  // do ecrã que o usa.
  const t = useT();
  const { lingua } = useLingua();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement | null>(null);
  const selected = COUNTRIES.find((c) => c.iso2 === value) ?? COUNTRIES[0];
  useEffect(() => {
      function onDocClick(e: MouseEvent) {
        if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
      }
      document.addEventListener("mousedown", onDocClick);
      return () => document.removeEventListener("mousedown", onDocClick);
    }, []);
  const q = norm(query.trim());
  // Procura pelo nome NA LÍNGUA ATUAL e também em português — quem tem a app
  // em inglês continua a escrever "Alemanha" sem pensar.
  const filtered = procurarPaises(query, lingua);
  return (
    <div ref={ref} style={{ position: "relative", width: 132, flexShrink: 0 }}>
    <button type="button" onClick={() => setOpen((o) => !o)} style={{ ...inputStyle(false), textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
    <span>{flagEmoji(selected.iso2)} {selected.dial}</span>
    <span style={{ color: "#93a39a", fontSize: 12 }}>▾</span>
    </button>
    {open && (
        <div style={{ ...panelStyle, width: 280, maxWidth: "80vw" }}>
        <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("comecar.procurarPais")} style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", background: "#0c0e0d", border: "none", borderBottom: "1px solid #2a3a33", color: "#f1ede2", fontSize: 14, outline: "none", fontFamily: FONT_BODY }} />
        <div style={{ maxHeight: 240, overflowY: "auto" }}>
        {filtered.length === 0 && <div style={{ padding: 12, color: "#93a39a", fontSize: 13 }}>{t("comecar.semResultados")}</div>}
        {filtered.map((c) => (
              <button key={c.iso2} type="button" onClick={() => { onChange(c.iso2); setOpen(false); setQuery(""); }} style={optionStyle(c.iso2 === value)}>
              <span>{flagEmoji(c.iso2)}</span>
              <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nomeDoPais(c.iso2, lingua)}</span>
              <span style={{ color: "#93a39a" }}>{c.dial}</span>
              </button>
            ))}
        </div>
        </div>
      )}
    </div>
  );
}
function CountryPicker({ value, hasError, onChange }: { value: string; hasError: boolean; onChange: (iso: string) => void }) {
  // Hooks próprios: este é um componente à parte, não vê o `t` nem o `lingua`
  // do ecrã que o usa.
  const t = useT();
  const { lingua } = useLingua();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement | null>(null);
  const selected = COUNTRIES.find((c) => c.iso2 === value);
  useEffect(() => {
      function onDocClick(e: MouseEvent) {
        if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
      }
      document.addEventListener("mousedown", onDocClick);
      return () => document.removeEventListener("mousedown", onDocClick);
    }, []);
  const q = norm(query.trim());
  const filtered = procurarPaises(query, lingua);
  return (
    <div ref={ref} style={{ position: "relative", width: "100%" }}>
    <button type="button" onClick={() => setOpen((o) => !o)} style={{ ...inputStyle(hasError), textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
    <span style={{ color: selected ? "#f1ede2" : "#6f7d76" }}>{selected ? `${flagEmoji(selected.iso2)} ${nomeDoPais(selected.iso2, lingua)}` : t("comecar.selecionaPais")}</span>
    <span style={{ color: "#93a39a", fontSize: 12 }}>▾</span>
    </button>
    {open && (
        <div style={{ ...panelStyle, width: "100%" }}>
        <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("comecar.procurarPais")} style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", background: "#0c0e0d", border: "none", borderBottom: "1px solid #2a3a33", color: "#f1ede2", fontSize: 14, outline: "none", fontFamily: FONT_BODY }} />
        <div style={{ maxHeight: 240, overflowY: "auto" }}>
        {filtered.length === 0 && <div style={{ padding: 12, color: "#93a39a", fontSize: 13 }}>{t("comecar.semResultados")}</div>}
        {filtered.map((c) => (
              <button key={c.iso2} type="button" onClick={() => { onChange(c.iso2); setOpen(false); setQuery(""); }} style={optionStyle(c.iso2 === value)}>
              <span>{flagEmoji(c.iso2)}</span>
              <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nomeDoPais(c.iso2, lingua)}</span>
              </button>
            ))}
        </div>
        </div>
      )}
    </div>
  );
}
