"use client";

import { useState, useEffect, useRef, type ReactNode, type CSSProperties } from "react";
import { COUNTRIES, flagEmoji } from "@/lib/countries";
import { supabase, supabaseConfigured } from "@/lib/supabase";

const FONT_DISPLAY = "var(--font-geist-mono), system-ui, sans-serif";
const FONT_BODY = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";

const BELTS = ["Branca", "Azul", "Amarela", "Verde", "Roxa", "Marrom", "Preta", "Ainda não tenho faixa"];

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

type Form = {
  name: string;
  email: string;
  senha: string;
  contact: string;
  dialIso: string;
  belt: string;
  countryIso: string;
};

const EMPTY: Form = { name: "", email: "", senha: "", contact: "", dialIso: "PT", belt: "", countryIso: "" };

export default function Comecar() {
  const [form, setForm] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [saving, setSaving] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [confirmSent, setConfirmSent] = useState(false);

  function update(field: keyof Form, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  }

  function validate(): boolean {
    const e: Partial<Record<keyof Form, string>> = {};
    if (!form.name.trim()) e.name = "Diz-nos o teu nome.";
    if (!form.email.trim()) e.email = "Precisamos do teu email.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Esse email não parece válido.";
    if (!form.senha) e.senha = "Cria uma senha.";
    else if (form.senha.length < 6) e.senha = "A senha precisa de pelo menos 6 caracteres.";
    if (!form.contact.trim()) e.contact = "Deixa um contacto.";
    if (!form.belt) e.belt = "Escolhe a tua faixa.";
    if (!form.countryIso) e.countryIso = "Escolhe o teu país.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit() {
    if (saving) return;
    if (!validate()) return;
    if (!supabaseConfigured) {
      setErrors((e) => ({ ...e, email: "A ligação ao servidor não está configurada. Tenta mais tarde." }));
      return;
    }

    setSaving(true);
    const country = COUNTRIES.find((c) => c.iso2 === form.countryIso);
    const dial = COUNTRIES.find((c) => c.iso2 === form.dialIso)?.dial ?? "";
    const telefone = `${dial} ${form.contact.trim()}`.trim();

    const { data, error } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.senha,
      options: {
        data: {
          nome: form.name.trim(),
          telefone,
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
        setErrors((e) => ({ ...e, email: "Já existe uma conta com este email. Tenta entrar." }));
      } else if (/password/i.test(msg)) {
        setErrors((e) => ({ ...e, senha: "Essa senha não é aceite. Tenta outra (mín. 6 caracteres)." }));
      } else {
        setErrors((e) => ({ ...e, email: "Não foi possível criar a conta. Tenta novamente." }));
      }
      setSaving(false);
      return;
    }

    // Compatibilidade com telas que ainda leem o localStorage (substituído pelo Supabase a seguir).
    try {
      localStorage.setItem("ippon_onboarding", "pending");
      localStorage.setItem("ippon_name", form.name.trim().split(" ")[0] || "");
    } catch {}

    if (data.session) {
      // Conta criada e sessão iniciada (confirmação de email desligada) → entra direto.
      window.location.href = "/inicio";
    } else {
      // Confirmação de email ligada → conta criada, falta confirmar.
      setSaving(false);
      setConfirmSent(true);
    }
  }

  if (confirmSent) {
    return (
      <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: FONT_BODY, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px" }}>
        <div style={{ width: "100%", maxWidth: 440 }}>
          <div style={{ background: "#121815", border: "1px solid #243029", borderRadius: 18, padding: 24, textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>📩</div>
            <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 24, fontWeight: 700, textTransform: "uppercase", margin: "0 0 8px" }}>Confirma o teu email</h1>
            <p style={{ fontSize: 14, color: "#93a39a", margin: "0 0 18px" }}>
              Enviámos um link para <strong style={{ color: "#f1ede2" }}>{form.email.trim()}</strong>. Abre-o para ativar a conta e depois volta para entrar.
            </p>
            <a href="/entrar" style={{ display: "inline-block", padding: "12px 22px", borderRadius: 12, background: GOLD, color: "#1b211e", fontFamily: FONT_DISPLAY, fontSize: 15, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", textDecoration: "none" }}>Ir para o login</a>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: FONT_BODY, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px" }}>
      <div style={{ width: "100%", maxWidth: 440 }}>
        <div style={{ background: "#121815", border: "1px solid #243029", borderRadius: 18, padding: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <span style={{ fontFamily: FONT_DISPLAY, fontSize: 20, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>Ippon League</span>
            <span style={{ borderRadius: 999, border: `1px solid ${GOLD}`, color: GOLD, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", padding: "1px 8px" }}>Beta</span>
          </div>
          <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 28, fontWeight: 700, textTransform: "uppercase", margin: "0 0 4px" }}>Entra no jogo</h1>
          <p style={{ fontSize: 14, color: "#93a39a", margin: "0 0 20px" }}>Cria a tua conta para montares a equipa e disputares com fãs de judô do mundo todo.</p>

          <Field label="Nome" error={errors.name}>
            <input style={inputStyle(!!errors.name)} value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="O teu nome" />
          </Field>

          <Field label="Email" error={errors.email}>
            <input style={inputStyle(!!errors.email)} type="email" value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="email@exemplo.com" />
          </Field>

          <Field label="Senha" error={errors.senha}>
            <div style={{ position: "relative" }}>
              <input style={{ ...inputStyle(!!errors.senha), paddingRight: 44 }} type={showPw ? "text" : "password"} value={form.senha} onChange={(e) => update("senha", e.target.value)} placeholder="Mínimo 6 caracteres" />
              <button type="button" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? "Esconder senha" : "Mostrar senha"} style={{ position: "absolute", right: 8, top: 8, width: 32, height: 32, background: "transparent", border: "none", color: "#93a39a", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  {showPw
                    ? <><path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8" /><path d="M9.4 5.2A9 9 0 0 1 21 12a9.8 9.8 0 0 1-2.3 3M6.1 6.1A9.8 9.8 0 0 0 3 12a9 9 0 0 0 11.6 5.3" /></>
                    : <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>}
                </svg>
              </button>
            </div>
          </Field>

          <Field label="Contacto" error={errors.contact}>
            <div style={{ display: "flex", gap: 8 }}>
              <CountrySelect value={form.dialIso} onChange={(iso) => update("dialIso", iso)} />
              <input style={inputStyle(!!errors.contact)} inputMode="tel" value={form.contact} onChange={(e) => update("contact", e.target.value)} placeholder="Número de telemóvel" />
            </div>
          </Field>

          <Field label="Faixa" error={errors.belt}>
            <select style={{ ...inputStyle(!!errors.belt), appearance: "none" }} value={form.belt} onChange={(e) => update("belt", e.target.value)}>
              <option value="" disabled>Seleciona a tua faixa</option>
              {BELTS.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </Field>

          <Field label="País" error={errors.countryIso}>
            <CountryPicker value={form.countryIso} hasError={!!errors.countryIso} onChange={(iso) => update("countryIso", iso)} />
          </Field>

          <button onClick={handleSubmit} disabled={saving} style={{ width: "100%", marginTop: 8, padding: "14px", borderRadius: 12, border: "none", background: GOLD, color: "#1b211e", fontFamily: FONT_DISPLAY, fontSize: 16, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1 }}>
            {saving ? "A criar conta..." : "Começar a jogar"}
          </button>

          <p style={{ fontSize: 13, color: "#93a39a", textAlign: "center", marginTop: 14 }}>
            Já tens conta?{" "}
            <a href="/entrar" style={{ color: "#f1ede2", fontWeight: 700, textDecoration: "none", borderBottom: `2px solid ${GOLD}`, paddingBottom: 1 }}>Entrar</a>
          </p>

          <p style={{ fontSize: 11, color: "#5f6f67", textAlign: "center", marginTop: 10 }}>Ao continuar, aceitas receber novidades da Ippon League.</p>
        </div>
      </div>
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
  const filtered = q ? COUNTRIES.filter((c) => norm(c.name).includes(q) || c.dial.includes(query.trim()) || c.iso2.toLowerCase().includes(q)) : COUNTRIES;

  return (
    <div ref={ref} style={{ position: "relative", width: 132, flexShrink: 0 }}>
      <button type="button" onClick={() => setOpen((o) => !o)} style={{ ...inputStyle(false), textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span>{flagEmoji(selected.iso2)} {selected.dial}</span>
        <span style={{ color: "#93a39a", fontSize: 12 }}>▾</span>
      </button>
      {open && (
        <div style={{ ...panelStyle, width: 280, maxWidth: "80vw" }}>
          <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Procurar país..." style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", background: "#0c0e0d", border: "none", borderBottom: "1px solid #2a3a33", color: "#f1ede2", fontSize: 14, outline: "none", fontFamily: FONT_BODY }} />
          <div style={{ maxHeight: 240, overflowY: "auto" }}>
            {filtered.length === 0 && <div style={{ padding: 12, color: "#93a39a", fontSize: 13 }}>Sem resultados</div>}
            {filtered.map((c) => (
              <button key={c.iso2} type="button" onClick={() => { onChange(c.iso2); setOpen(false); setQuery(""); }} style={optionStyle(c.iso2 === value)}>
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

function CountryPicker({ value, hasError, onChange }: { value: string; hasError: boolean; onChange: (iso: string) => void }) {
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
  const filtered = q ? COUNTRIES.filter((c) => norm(c.name).includes(q) || c.iso2.toLowerCase().includes(q)) : COUNTRIES;

  return (
    <div ref={ref} style={{ position: "relative", width: "100%" }}>
      <button type="button" onClick={() => setOpen((o) => !o)} style={{ ...inputStyle(hasError), textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ color: selected ? "#f1ede2" : "#6f7d76" }}>{selected ? `${flagEmoji(selected.iso2)} ${selected.name}` : "Seleciona o teu país"}</span>
        <span style={{ color: "#93a39a", fontSize: 12 }}>▾</span>
      </button>
      {open && (
        <div style={{ ...panelStyle, width: "100%" }}>
          <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Procurar país..." style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", background: "#0c0e0d", border: "none", borderBottom: "1px solid #2a3a33", color: "#f1ede2", fontSize: 14, outline: "none", fontFamily: FONT_BODY }} />
          <div style={{ maxHeight: 240, overflowY: "auto" }}>
            {filtered.length === 0 && <div style={{ padding: 12, color: "#93a39a", fontSize: 13 }}>Sem resultados</div>}
            {filtered.map((c) => (
              <button key={c.iso2} type="button" onClick={() => { onChange(c.iso2); setOpen(false); setQuery(""); }} style={optionStyle(c.iso2 === value)}>
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
