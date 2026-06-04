"use client";

import { useState, useEffect, useRef, type ReactNode, type CSSProperties } from "react";
import { COUNTRIES, flagEmoji } from "@/lib/countries";

const FONT_DISPLAY = "var(--font-geist-mono), system-ui, sans-serif";
const FONT_BODY = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";

const BELTS = ["Branca", "Azul", "Amarela", "Verde", "Roxa", "Marrom", "Preta", "Ainda não tenho faixa"];

type Form = {
  name: string;
  email: string;
  contact: string;
  dialIso: string;
  belt: string;
  location: string;
};

const EMPTY: Form = { name: "", email: "", contact: "", dialIso: "PT", belt: "", location: "" };

export default function Comecar() {
  const [form, setForm] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  function update(field: keyof Form, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  }

  function validate(): boolean {
    const e: Partial<Record<keyof Form, string>> = {};
    if (!form.name.trim()) e.name = "Diz-nos o teu nome.";
    if (!form.email.trim()) e.email = "Precisamos do teu email.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Esse email não parece válido.";
    if (!form.contact.trim()) e.contact = "Deixa um contacto.";
    if (!form.belt) e.belt = "Escolhe a tua faixa.";
    if (!form.location.trim()) e.location = "Onde vives?";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setSaving(true);
    const dial = COUNTRIES.find((c) => c.iso2 === form.dialIso)?.dial ?? "";
    const lead = {
      name: form.name.trim(),
      email: form.email.trim(),
      phone: `${dial} ${form.contact.trim()}`.trim(),
      belt: form.belt,
      location: form.location.trim(),
    };
    // TODO: enviar `lead` para o Supabase + CRM (próximo passo)
    console.log("lead", lead);
    await new Promise((r) => setTimeout(r, 600));
    setSaving(false);
    setSubmitted(true);
  }

  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: FONT_BODY, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px" }}>
      <div style={{ width: "100%", maxWidth: 440 }}>
        {!submitted ? (
          <div style={{ background: "#121815", border: "1px solid #243029", borderRadius: 18, padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <span style={{ fontFamily: FONT_DISPLAY, fontSize: 20, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Ippon League
              </span>
              <span style={{ borderRadius: 999, border: `1px solid ${GOLD}`, color: GOLD, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", padding: "1px 8px" }}>
                Beta
              </span>
            </div>
            <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 28, fontWeight: 700, textTransform: "uppercase", margin: "0 0 4px" }}>
              Entra no jogo
            </h1>
            <p style={{ fontSize: 14, color: "#93a39a", margin: "0 0 20px" }}>
              Cria a tua conta para montares a equipa e disputares com fãs de judô do mundo todo.
            </p>

            <Field label="Nome" error={errors.name}>
              <input style={inputStyle(!!errors.name)} value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="O teu nome" />
            </Field>

            <Field label="Email" error={errors.email}>
              <input style={inputStyle(!!errors.email)} type="email" value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="email@exemplo.com" />
            </Field>

            <Field label="Contacto" error={errors.contact}>
              <div style={{ display: "flex", gap: 8 }}>
                <CountrySelect value={form.dialIso} onChange={(iso) => update("dialIso", iso)} />
                <input
                  style={inputStyle(!!errors.contact)}
                  inputMode="tel"
                  value={form.contact}
                  onChange={(e) => update("contact", e.target.value)}
                  placeholder="Número de telemóvel"
                />
              </div>
            </Field>

            <Field label="Faixa" error={errors.belt}>
              <select style={{ ...inputStyle(!!errors.belt), appearance: "none" }} value={form.belt} onChange={(e) => update("belt", e.target.value)}>
                <option value="" disabled>
                  Seleciona a tua faixa
                </option>
                {BELTS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Onde vives" error={errors.location}>
              <input style={inputStyle(!!errors.location)} value={form.location} onChange={(e) => update("location", e.target.value)} placeholder="Cidade, País" />
            </Field>

            <button
              onClick={handleSubmit}
              disabled={saving}
              style={{
                width: "100%",
                marginTop: 8,
                padding: "14px",
                borderRadius: 12,
                border: "none",
                background: GOLD,
                color: "#1b211e",
                fontFamily: FONT_DISPLAY,
                fontSize: 16,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                cursor: saving ? "default" : "pointer",
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? "A entrar..." : "Começar a jogar"}
            </button>

            <p style={{ fontSize: 11, color: "#5f6f67", textAlign: "center", marginTop: 14 }}>
              Ao continuar, aceitas receber novidades da Ippon League.
            </p>
          </div>
        ) : (
          <div style={{ background: "#121815", border: "1px solid #243029", borderRadius: 18, padding: 28, textAlign: "center" }}>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 30, fontWeight: 700, color: GOLD, textTransform: "uppercase" }}>Ippon!</div>
            <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 22, fontWeight: 700, margin: "10px 0 6px", textTransform: "uppercase" }}>
              Bem-vindo, {form.name.split(" ")[0]}
            </h2>
            <p style={{ fontSize: 14, color: "#93a39a", margin: "0 0 20px" }}>
              A tua conta está pronta. Vamos montar a tua equipa de 8 atletas com 100 Judocoins.
            </p>
            <a
              href="/meu-time"
              style={{
                display: "inline-block",
                padding: "12px 22px",
                borderRadius: 12,
                background: GOLD,
                color: "#1b211e",
                fontFamily: FONT_DISPLAY,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                textDecoration: "none",
              }}
            >
              Ir para o meu time
            </a>
          </div>
        )}
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
  };
}

function CountrySelect({ value, onChange }: { value: string; onChange: (iso: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const selected = COUNTRIES.find((c) => c.iso2 === value) ?? COUNTRIES[0];

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const q = norm(query.trim());
  const filtered = q
    ? COUNTRIES.filter((c) => norm(c.name).includes(q) || c.dial.includes(query.trim()) || c.iso2.toLowerCase().includes(q))
    : COUNTRIES;

  return (
    <div ref={ref} style={{ position: "relative", width: 132, flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{ ...inputStyle(false), width: "100%", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}
      >
        <span>
          {flagEmoji(selected.iso2)} {selected.dial}
        </span>
        <span style={{ color: "#93a39a", fontSize: 12 }}>▾</span>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            width: 280,
            maxWidth: "80vw",
            background: "#0f1411",
            border: "1px solid #2a3a33",
            borderRadius: 12,
            zIndex: 30,
            boxShadow: "0 12px 30px rgba(0,0,0,0.5)",
            overflow: "hidden",
          }}
        >
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Procurar país..."
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "10px 12px",
              background: "#0c0e0d",
              border: "none",
              borderBottom: "1px solid #2a3a33",
              color: "#f1ede2",
              fontSize: 14,
              outline: "none",
              fontFamily: FONT_BODY,
            }}
          />
          <div style={{ maxHeight: 240, overflowY: "auto" }}>
            {filtered.length === 0 && <div style={{ padding: 12, color: "#93a39a", fontSize: 13 }}>Sem resultados</div>}
            {filtered.map((c) => (
              <button
                key={c.iso2}
                type="button"
                onClick={() => {
                  onChange(c.iso2);
                  setOpen(false);
                  setQuery("");
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  width: "100%",
                  textAlign: "left",
                  padding: "9px 12px",
                  background: c.iso2 === value ? "#16201b" : "transparent",
                  border: "none",
                  color: "#f1ede2",
                  fontSize: 14,
                  cursor: "pointer",
                  fontFamily: FONT_BODY,
                }}
              >
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
