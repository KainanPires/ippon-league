"use client";

// O editor do escudo, dentro da Academy.
//
// É o mesmo ecrã do /escudo da Ippon League — mesma pré-visualização grande,
// mesmo sortear, mesmas filas de forma, estampa, cores e símbolo — em azul.
// Existe cá porque nenhum clique da Academy pode atirar a pessoa para o outro
// produto: há quem só use a Academy.
//
// O QUE É PARTILHADO: o escudo e o nome do time são da CONTA, não do produto.
// Grava-se nos mesmos dois sítios que o Fantasy usa — a gaveta do aparelho
// (localStorage, que os dois lêem) e a tabela `equipas` (que a liga lê). Por
// isso, antes de gravar, avisa-se: isto muda nos dois.

import { useState, useEffect, useRef } from "react";
import {
  Escudo, SymbolGlyph, loadIdentity, saveIdentity,
  SHAPES, PATTERNS, SYMBOLS, COLORS,
  type Identity, type ShapeId, type PatternId, type SymbolId,
} from "@/components/Escudo";
import { supabase } from "@/lib/supabase";
import { useLang, useT, type Chave } from "@/lib/i18n";

const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const AZUL = "#4C8DFF";
const CARTA = "#0f1726";
const LINHA = "#1b2a3f";
const APAGADO = "#7c8ba1";

// Slots de cor. Os cinco principais são sempre visíveis; os dois da estampa só
// aparecem quando há um padrão escolhido (não faz sentido no "Sólido").
type Slot = "bg1" | "bg2" | "border" | "icon" | "iconBorder" | "stamp1" | "stamp2";
const SLOTS_PRINCIPAIS: { id: Slot; chave: Chave }[] = [
  { id: "bg1", chave: "corFundo1" },
  { id: "bg2", chave: "corFundo2" },
  { id: "border", chave: "corBordaFundo" },
  { id: "icon", chave: "corIcone" },
  { id: "iconBorder", chave: "corBordaIcone" },
];
const SLOTS_ESTAMPA: { id: Slot; chave: Chave }[] = [
  { id: "stamp1", chave: "corEstampa1" },
  { id: "stamp2", chave: "corEstampa2" },
];

export default function EditorEscudo() {
  const [lang] = useLang();
  const t = useT(lang);

  const [id, setId] = useState<Identity | null>(null);
  const [voltar, setVoltar] = useState("/academy/perfil");
  const [slot, setSlot] = useState<Slot>("bg1");
  const [erro, setErro] = useState("");
  const [sugestoes, setSugestoes] = useState<string[]>([]);
  const [aVerificar, setAVerificar] = useState(false);
  const [aGuardar, setAGuardar] = useState(false);
  const [nomeOriginal, setNomeOriginal] = useState("");
  const [confirmar, setConfirmar] = useState(false);

  const nomeOriginalRef = useRef("");
  useEffect(() => { nomeOriginalRef.current = nomeOriginal; }, [nomeOriginal]);

  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const v = sp.get("voltar");
      if (v && v.startsWith("/") && !v.startsWith("//")) setVoltar(v);
    } catch { /* sem parâmetros */ }
  }, []);

  useEffect(() => {
    let vivo = true;

    // 1) Arranque rápido com o que está no aparelho.
    const local = loadIdentity();
    const nomeLocal = (local.name || "").trim();
    // O nome por omissão antigo foi gravado em português: a comparação é
    // histórica, por isso fica literal e não se traduz.
    const ehOmissao = nomeLocal === "" || nomeLocal.toLowerCase() === "a minha equipa";
    setId(ehOmissao ? { ...local, name: "" } : local);
    setNomeOriginal(ehOmissao ? "" : nomeLocal);

    // 2) A conta manda: se o aparelho é novo ou o browser foi limpo, o nome e
    //    o escudo verdadeiros estão na tabela `equipas`. Só sobrepõe se de lá
    //    vier mesmo alguma coisa.
    (async () => {
      try {
        const sb = supabase();
        const { data: sess } = await sb.auth.getSession();
        const uid = sess.session?.user?.id;
        if (!uid) return;
        const { data } = await sb.from("equipas")
          .select("nome, escudo").eq("user_id", uid).limit(1);
        const linha = (data ?? [])[0] as { nome?: string; escudo?: unknown } | undefined;
        if (!vivo || !linha) return;
        const nomeConta = (linha.nome || "").trim();
        setId((prev) => {
          if (!prev) return prev;
          const junto: Identity = { ...prev };
          if (linha.escudo && typeof linha.escudo === "object") {
            Object.assign(junto, linha.escudo as Partial<Identity>);
          }
          // O nome da conta manda, excepto se a pessoa já escreveu outro aqui.
          if (nomeConta && (prev.name || "").trim() === (nomeOriginalRef.current || "")) {
            junto.name = nomeConta;
          }
          return junto;
        });
        if (nomeConta) setNomeOriginal(nomeConta);
      } catch { /* sem conta ou sem tabela: fica o local */ }
    })();

    return () => { vivo = false; };
  }, []);

  if (!id) return <div style={{ minHeight: "60vh" }} />;

  const temEstampa = id.pattern !== "solido";
  const slotsVisiveis = temEstampa ? [...SLOTS_PRINCIPAIS, ...SLOTS_ESTAMPA] : SLOTS_PRINCIPAIS;

  function set<K extends keyof Identity>(chave: K, valor: Identity[K]) {
    setId((p) => (p ? { ...p, [chave]: valor } : p));
    if (chave === "name") { setErro(""); setSugestoes([]); }
  }

  function sorte<T>(a: T[]): T { return a[Math.floor(Math.random() * a.length)]; }
  function sortear() {
    setId((p) => p ? {
      ...p,
      shape: sorte(SHAPES), pattern: sorte(PATTERNS).id, symbol: sorte(SYMBOLS).id,
      bg1: sorte(COLORS), bg2: sorte(COLORS), stamp1: sorte(COLORS), stamp2: sorte(COLORS),
      border: sorte(COLORS), icon: sorte(COLORS), iconBorder: sorte(COLORS),
    } : p);
  }

  async function pedirGuardar() {
    const nome = (id!.name || "").trim();
    if (nome.length < 2) {
      setErro(t("erroNomeTime"));
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    // NOME ÚNICO. A verificação é a mesma do Fantasy — a mesma rota, no mesmo
    // endereço. Se a rede falhar, não se prende ninguém: deixa guardar.
    setAVerificar(true);
    setErro("");
    setSugestoes([]);
    try {
      const { data: sess } = await supabase().auth.getSession();
      const uid = sess.session?.user?.id ?? "";
      const params = new URLSearchParams({ nome });
      if (uid) params.set("user_id", uid);
      const res = await fetch(`/api/nome-disponivel?${params.toString()}`);
      const j = await res.json();
      if (j && j.ok && j.livre === false) {
        setErro(t("nomeEmUso"));
        setSugestoes(Array.isArray(j.sugestoes) ? j.sugestoes : []);
        setAVerificar(false);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
    } catch { /* rede falhou: segue */ }
    setAVerificar(false);

    setConfirmar(true);
  }

  async function guardar() {
    const nome = (id!.name || "").trim();
    setConfirmar(false);
    setAGuardar(true);
    const identidade: Identity = { ...id!, name: nome };

    // 1) No aparelho — os dois produtos lêem daqui, é o que muda já.
    saveIdentity(identidade);

    // 2) Na conta — é daqui que a liga lê o nome. Actualiza todas as equipas
    //    desta conta, tal como o Fantasy faz.
    try {
      const sb = supabase();
      const { data: sess } = await sb.auth.getSession();
      const uid = sess.session?.user?.id;
      if (uid) {
        const campos: Record<string, unknown> = { escudo: identidade };
        if (nome) campos.nome = nome;
        await sb.from("equipas").update(campos).eq("user_id", uid);
      }
    } catch { /* o local já ficou gravado; seguimos */ }

    window.location.href = voltar;
  }

  const nomeVazio = (id.name || "").trim().length < 2;
  const ocupado = (aGuardar || aVerificar) ? false : sugestoes.length > 0;
  const valorSlot = (id[slot] as string | undefined) || "";
  const rotuloSlot: Chave = slotsVisiveis.find((s) => s.id === slot)?.chave ?? "corFundo1";

  return (
    <>
      <header style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 4 }}>
        <a href={voltar} aria-label={t("voltar")} style={{
          width: 36, height: 36, borderRadius: "50%", border: `1px solid ${LINHA}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#cfd8d2", textDecoration: "none", flexShrink: 0,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </a>
        <h1 style={{
          fontFamily: FD, fontSize: 18, fontWeight: 700, textTransform: "uppercase", margin: 0,
        }}>
          {t("escudoTitulo")}
        </h1>
      </header>

      {/* A pré-visualização grande, sempre à vista enquanto se mexe. */}
      <div style={{
        background: "radial-gradient(circle at 50% 28%, #12294a, #070d18 72%)",
        border: `1px solid ${LINHA}`, borderRadius: 16,
        padding: "18px 16px 14px", textAlign: "center", margin: "10px 0 18px",
      }}>
        <div style={{ filter: "drop-shadow(0 8px 16px rgba(0,0,0,0.5))", display: "inline-block" }}>
          <Escudo config={{ ...id, name: id.name || t("aMinhaEquipa") }} size={128} />
        </div>
        <div style={{
          fontFamily: FD, fontSize: 18, fontWeight: 700, textTransform: "uppercase",
          marginTop: 8, wordBreak: "break-word", color: nomeVazio ? APAGADO : "#f1ede2",
        }}>
          {id.name.trim() || t("semNome")}
        </div>
        <button onClick={sortear} style={{
          marginTop: 10, display: "inline-flex", alignItems: "center", gap: 7,
          background: "transparent", border: "none", color: "#7fd1a3", fontFamily: FD,
          fontSize: 13, fontWeight: 700, textTransform: "uppercase",
          letterSpacing: "0.05em", cursor: "pointer",
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
          </svg>
          {t("sortear")}
        </button>
      </div>

      <Etiqueta>{t("nomeTime")} <span style={{ color: AZUL }}>*</span></Etiqueta>
      <input
        value={id.name}
        onChange={(e) => set("name", e.target.value.slice(0, 24))}
        placeholder={t("phNomeTime")}
        style={{
          width: "100%", boxSizing: "border-box", background: "#131c2c",
          border: `1px solid ${erro ? "#c0392b" : LINHA}`, borderRadius: 12,
          padding: "12px 14px", color: "#f1ede2", fontSize: 15, fontFamily: FB,
          outline: "none", marginBottom: (erro || ocupado) ? 8 : 16,
        }} />

      {erro && (
        <div style={{
          fontSize: 12.5, color: "#ef8d83", marginBottom: ocupado ? 10 : 16, fontWeight: 700,
        }}>{erro}</div>
      )}

      {!erro && nomeOriginal === "" && (
        <div style={{
          fontSize: 12, color: "#aee9c9", lineHeight: 1.5, margin: "-6px 0 18px",
          display: "flex", gap: 7, alignItems: "flex-start",
        }}>
          <span aria-hidden="true" style={{ flexShrink: 0 }}>ℹ️</span>
          <span>{t("nomeUnicoInfo")}</span>
        </div>
      )}

      {ocupado && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
          {sugestoes.map((s) => (
            <button key={s} onClick={() => { set("name", s); }} style={{
              background: "#12294a", border: `1px solid ${AZUL}`, color: AZUL,
              fontFamily: FD, fontSize: 13, fontWeight: 700, padding: "8px 13px",
              borderRadius: 999, cursor: "pointer",
            }}>{s}</button>
          ))}
        </div>
      )}

      <EtiquetaCentro>{t("escolherForma")}</EtiquetaCentro>
      <Fila>
        {SHAPES.map((s) => (
          <Quadro key={s} aceso={id.shape === s} onClick={() => set("shape", s as ShapeId)}>
            <Escudo config={{ ...id, shape: s as ShapeId }} size={40} />
          </Quadro>
        ))}
      </Fila>

      <EtiquetaCentro>{t("escolherEstampa")}</EtiquetaCentro>
      <Fila>
        {PATTERNS.map((p) => (
          <Quadro key={p.id} aceso={id.pattern === p.id} onClick={() => set("pattern", p.id as PatternId)}>
            <Escudo config={{ ...id, shape: "circle", pattern: p.id as PatternId }} size={40} />
          </Quadro>
        ))}
      </Fila>

      {/* CORES — cada camada tem o seu controlo. O contorno do símbolo pode
          ficar em "nenhum". As cores da estampa só aparecem com padrão. */}
      <EtiquetaCentro>{t("escolherCores")}</EtiquetaCentro>
      <Fila>
        {slotsVisiveis.map((s) => {
          const cor = (id[s.id] as string | undefined) || "";
          const aceso = slot === s.id;
          return (
            <button key={s.id} onClick={() => setSlot(s.id)} aria-label={t(s.chave)}
              style={{
                flex: "0 0 auto", display: "flex", flexDirection: "column",
                alignItems: "center", gap: 6, background: "transparent",
                border: "none", cursor: "pointer", padding: 0, width: 64,
              }}>
              <span style={{
                position: "relative", width: 46, height: 46, borderRadius: "50%",
                background: cor || "transparent",
                border: `2px solid ${aceso ? AZUL : "rgba(255,255,255,0.25)"}`,
                boxShadow: aceso ? "0 0 0 3px rgba(76,141,255,0.35)" : "none",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {!cor && (
                  <svg width="46" height="46" viewBox="0 0 46 46" aria-hidden="true"
                       style={{ position: "absolute", inset: 0 }}>
                    <line x1="10" y1="36" x2="36" y2="10" stroke={APAGADO} strokeWidth="2" />
                  </svg>
                )}
              </span>
              <span style={{
                fontSize: 10.5, fontWeight: 700, color: aceso ? AZUL : APAGADO,
                textAlign: "center", lineHeight: 1.2,
              }}>{t(s.chave)}</span>
            </button>
          );
        })}
      </Fila>

      <div style={{ fontSize: 11, color: APAGADO, textAlign: "center", marginBottom: 10 }}>
        {t("aPintar")}{" "}
        <span style={{ color: AZUL, fontWeight: 700 }}>{t(rotuloSlot)}</span>
      </div>
      <div style={{
        display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 10, marginBottom: 22,
      }}>
        {slot === "iconBorder" && (
          <button onClick={() => set("iconBorder", "")} aria-label={t("semBordaIcone")}
            style={{
              position: "relative", width: 34, height: 34, borderRadius: "50%",
              background: "#070d18",
              border: `2px solid ${valorSlot === "" ? "#f1ede2" : "rgba(255,255,255,0.18)"}`,
              boxShadow: valorSlot === "" ? `0 0 0 2px ${AZUL}` : "none", cursor: "pointer",
            }}>
            <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true"
                 style={{ position: "absolute", inset: 0 }}>
              <line x1="7" y1="23" x2="23" y2="7" stroke="#ef8d83" strokeWidth="2.2" />
            </svg>
          </button>
        )}
        {COLORS.map((c) => {
          const aceso = valorSlot.toLowerCase() === c.toLowerCase();
          return (
            <button key={c} onClick={() => set(slot, c)} aria-label={c} style={{
              width: 34, height: 34, borderRadius: "50%", background: c,
              border: `2px solid ${aceso ? "#f1ede2" : "rgba(255,255,255,0.18)"}`,
              boxShadow: aceso ? `0 0 0 2px ${AZUL}` : "none", cursor: "pointer",
            }} />
          );
        })}
      </div>

      <EtiquetaCentro>{t("escolherAdorno")}</EtiquetaCentro>
      <Fila>
        {SYMBOLS.map((s) => (
          <Quadro key={s.id} aceso={id.symbol === s.id} onClick={() => set("symbol", s.id as SymbolId)}>
            {s.id === "none"
              ? <span style={{ color: APAGADO, fontSize: 13 }}>—</span>
              : <svg viewBox="0 0 24 24" width={22} height={22}>
                  <SymbolGlyph id={s.id as SymbolId} color="#f1ede2" />
                </svg>}
          </Quadro>
        ))}
      </Fila>

      <button onClick={pedirGuardar} disabled={aGuardar || aVerificar} style={{
        width: "100%", padding: 14, borderRadius: 12, border: "none",
        background: nomeVazio ? "#12294a" : AZUL,
        color: nomeVazio ? AZUL : "#06101f",
        fontFamily: FD, fontSize: 16, fontWeight: 700, textTransform: "uppercase",
        letterSpacing: "0.05em", marginBottom: 10,
        cursor: (aGuardar || aVerificar) ? "default" : "pointer",
      }}>
        {aVerificar ? t("aVerificarNome")
          : aGuardar ? t("aGuardar")
          : nomeVazio ? t("daNomeSalvar")
          : t("salvarEscudo")}
      </button>

      {/* O AVISO. Antes de gravar, diz-se o que vai acontecer: isto é da conta,
          não da Academy, e o Fantasy vai ficar igual. Quem muda o nome vê
          também o antes e o depois. */}
      {confirmar && (
        <div onClick={() => setConfirmar(false)} style={{
          position: "fixed", inset: 0, zIndex: 120, background: "rgba(3,7,15,.9)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 18,
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            width: "100%", maxWidth: 340, background: CARTA, border: `1px solid ${AZUL}`,
            borderRadius: 16, padding: 22, textAlign: "center",
          }}>
            <div style={{ marginBottom: 10 }}>
              <Escudo config={{ ...id, name: (id.name || "").trim() }} size={64} />
            </div>
            <h2 style={{
              fontFamily: FD, fontSize: 17, fontWeight: 700, textTransform: "uppercase",
              margin: "0 0 8px",
            }}>
              {t("mudaNosDoisTitulo")}
            </h2>
            <p style={{ fontSize: 13, color: "#b9c3d1", lineHeight: 1.5, margin: "0 0 10px" }}>
              {t("mudaNosDoisTexto")}
            </p>

            {nomeOriginal !== "" && (id.name || "").trim() !== nomeOriginal && (
              <>
                <p style={{ fontSize: 13, color: "#f1ede2", lineHeight: 1.5, margin: "0 0 4px" }}>
                  {t("vaisTrocarNome", { a: nomeOriginal, b: (id.name || "").trim() })}
                </p>
                <p style={{ fontSize: 12, color: APAGADO, lineHeight: 1.5, margin: "0 0 4px" }}>
                  {t("nomeAnteriorLivre")}
                </p>
              </>
            )}

            <button onClick={guardar} className="botao" style={{ marginTop: 14 }}>
              {t("guardarNosDois")}
            </button>
            <button onClick={() => setConfirmar(false)} style={{
              marginTop: 10, background: "transparent", border: "none",
              color: APAGADO, fontSize: 13, cursor: "pointer", fontFamily: FB,
            }}>
              {t("cancelar")}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */

function Etiqueta({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: FD, fontSize: 12, fontWeight: 700, textTransform: "uppercase",
      letterSpacing: "0.06em", color: APAGADO, marginBottom: 9,
    }}>{children}</div>
  );
}

function EtiquetaCentro({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: FD, fontSize: 13, fontWeight: 700, textTransform: "uppercase",
      letterSpacing: "0.06em", color: "#cfd8d2", textAlign: "center", marginBottom: 12,
    }}>{children}</div>
  );
}

function Quadro({
  aceso, onClick, children,
}: { aceso: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      flex: "0 0 auto", width: 52, height: 52, display: "flex",
      alignItems: "center", justifyContent: "center",
      background: aceso ? "#12294a" : CARTA,
      border: `2px solid ${aceso ? AZUL : LINHA}`, borderRadius: "50%", cursor: "pointer",
    }}>
      {children}
    </button>
  );
}

function Fila({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const ir = (lado: number) => {
    if (ref.current) ref.current.scrollBy({ left: lado * 150, behavior: "smooth" });
  };
  return (
    <div style={{ position: "relative", marginBottom: 22 }}>
      <Seta lado="left" onClick={() => ir(-1)} />
      <div ref={ref} style={{
        display: "flex", gap: 9, overflowX: "auto",
        WebkitOverflowScrolling: "touch", scrollbarWidth: "none", padding: "2px 34px",
      }}>
        {children}
      </div>
      <Seta lado="right" onClick={() => ir(1)} />
    </div>
  );
}

function Seta({ lado, onClick }: { lado: "left" | "right"; onClick: () => void }) {
  const [lang] = useLang();
  const t = useT(lang);
  return (
    <button onClick={onClick} aria-label={lado === "left" ? t("anterior") : t("seguinte")}
      style={{
        position: "absolute", top: "50%", transform: "translateY(-50%)", [lado]: 0,
        width: 30, height: 30, borderRadius: "50%", background: "rgba(7,13,24,0.92)",
        border: `1px solid ${LINHA}`, color: "#f1ede2", display: "flex",
        alignItems: "center", justifyContent: "center", cursor: "pointer", zIndex: 2,
      } as React.CSSProperties}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={lado === "left" ? "M15 18l-6-6 6-6" : "M9 18l6-6-6-6"} />
      </svg>
    </button>
  );
}
