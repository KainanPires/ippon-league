"use client";

// app/chaveamento/editor/page.tsx
//
// EDITOR DA CHAVE (moldura) — onde o responsável (is_chaveador) monta a chave
// ao vivo de cada categoria. Substitui o antigo editor de prints.
//
// COMO FUNCIONA
//   1) Escolhe a competição (não-clássica).
//   2) A app carrega os inscritos (/api/atletas) — já vêm com categoria e género.
//   3) Escolhe uma categoria; vê só os inscritos dela.
//   4) Distribui-os pelos 4 pools (A/B/C/D), na ordem da chave da IJF, e marca
//      os "bye" (quem salta a 1ª luta).
//   5) Guarda a categoria -> grava em `chave_atletas` (via /api/chaveamento-moldura).
//      A partir daí, o cron "Chave Maestro" preenche o movimento e a chave ao
//      vivo do Pro/Pro Max aparece sozinha.
//   6) Quando a chave estiver montada, "Avisar jogadores" dispara a notificação
//      "Chave oficial disponível" a todos (uma vez por competição).

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Mascot } from "@/components/Mascot";
import { useT } from "@/lib/i18n";
import { CALENDARIO_2026, competicaoDaSemana, proximaDepoisDe } from "@/lib/calendario";

const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";

const COMPS = CALENDARIO_2026.filter((s) => !s.classico).sort((a, b) => a.semana - b.semana);
const CATS_M = ["-60", "-66", "-73", "-81", "-90", "-100", "+100"];
const CATS_F = ["-48", "-52", "-57", "-63", "-70", "-78", "+78"];
const POOLS = ["A", "B", "C", "D"] as const;
type PoolId = (typeof POOLS)[number];

function compPorOmissao(): string {
  const atual = competicaoDaSemana(new Date());
  if (!atual.classico) return atual.idCompeticao;
  let s = atual;
  for (let i = 0; i < CALENDARIO_2026.length; i++) {
    s = proximaDepoisDe(s);
    if (!s.classico) return s.idCompeticao;
  }
  return COMPS[0]?.idCompeticao || "";
}

const norm = (c?: string) => String(c || "").toLowerCase().replace(/kg/g, "").replace(/\s+/g, "");

interface Atleta { id: string; name: string; countryIso?: string; category?: string; gender?: string }
type Pools = Record<PoolId, string[]>;
interface MolduraGuardada { pools: Record<string, unknown>; genero: string | null }

const POOLS_VAZIOS: Pools = { A: [], B: [], C: [], D: [] };

export default function EditorChave() {
  const t = useT();
  const [acesso, setAcesso] = useState<"a-ver" | "sim" | "nao">("a-ver");
  const [comp, setComp] = useState<string>(compPorOmissao());
  const [atletas, setAtletas] = useState<Atleta[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [cat, setCat] = useState<string>("-73");
  const [pools, setPools] = useState<Pools>(POOLS_VAZIOS);
  const [byes, setByes] = useState<Pools>(POOLS_VAZIOS);
  const [feitas, setFeitas] = useState<Record<string, boolean>>({});
  const [cache, setCache] = useState<Record<string, MolduraGuardada>>({});
  const [aGravar, setAGravar] = useState(false);
  const [msg, setMsg] = useState("");
  const [erro, setErro] = useState("");

  const genero = CATS_M.includes(cat) ? "M" : "F";

  useEffect(() => {
    let vivo = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user?.id;
      if (!uid) { if (vivo) setAcesso("nao"); return; }
      const { data: u } = await supabase.from("users").select("is_chaveador").eq("id", uid).maybeSingle();
      if (!vivo) return;
      setAcesso(u?.is_chaveador ? "sim" : "nao");
    })();
    return () => { vivo = false; };
  }, []);

  async function token(): Promise<string> {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || "";
  }

  // Carrega os ids guardados de uma categoria para os pools/byes editáveis.
  const carregarCat = useCallback((categoria: string, c: Record<string, MolduraGuardada>) => {
    const m = c[categoria];
    if (!m || !m.pools || typeof m.pools !== "object") { setPools(POOLS_VAZIOS); setByes(POOLS_VAZIOS); return; }
    const raw = m.pools as Record<string, unknown>;
    const np: Pools = { A: [], B: [], C: [], D: [] };
    const nb: Pools = { A: [], B: [], C: [], D: [] };
    for (const p of POOLS) np[p] = Array.isArray(raw[p]) ? (raw[p] as unknown[]).map(String) : [];
    const byesRaw = (raw["byes"] ?? null) as Record<string, unknown> | null;
    if (byesRaw) for (const p of POOLS) nb[p] = Array.isArray(byesRaw[p]) ? (byesRaw[p] as unknown[]).map(String) : [];
    setPools(np); setByes(nb);
    setMsg(""); setErro("");
  }, []);

  // Ao mudar de competição: carrega inscritos + molduras já guardadas.
  const carregarComp = useCallback(async (idc: string) => {
    setCarregando(true); setMsg(""); setErro("");
    try {
      const [rAtletas, rMold] = await Promise.all([
        fetch(`/api/atletas?id=${encodeURIComponent(idc)}`).then((r) => r.json()).catch(() => null),
        (async () => {
          const tk = await token();
          return fetch(`/api/chaveamento-moldura?comp=${encodeURIComponent(idc)}`, tk ? { headers: { authorization: `Bearer ${tk}` } } : undefined)
            .then((r) => r.json()).catch(() => null);
        })(),
      ]);
      setAtletas(Array.isArray(rAtletas?.atletas) ? rAtletas.atletas : []);
      const novoCache: Record<string, MolduraGuardada> = {};
      const novasFeitas: Record<string, boolean> = {};
      for (const m of (rMold?.molduras || []) as Array<{ weight_category?: unknown; genero?: unknown; pools?: unknown }>) {
        const wc = String(m.weight_category || "");
        if (!wc) continue;
        novoCache[wc] = { pools: (m.pools && typeof m.pools === "object" ? m.pools : {}) as Record<string, unknown>, genero: m.genero ? String(m.genero) : null };
        novasFeitas[wc] = true;
      }
      setCache(novoCache); setFeitas(novasFeitas);
      carregarCat(cat, novoCache);
    } finally {
      setCarregando(false);
    }
  }, [cat, carregarCat]);

  useEffect(() => { if (acesso === "sim") void carregarComp(comp); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [acesso, comp]);

  function escolherCat(c: string) {
    setCat(c);
    carregarCat(c, cache);
  }

  // --- movimentos de atletas ---
  function colocar(id: string, pool: PoolId) {
    setPools((prev) => {
      const np: Pools = { A: [...prev.A], B: [...prev.B], C: [...prev.C], D: [...prev.D] };
      for (const p of POOLS) np[p] = np[p].filter((x) => x !== id);
      np[pool] = [...np[pool], id];
      return np;
    });
    setByes((prev) => {
      const nb: Pools = { A: [...prev.A], B: [...prev.B], C: [...prev.C], D: [...prev.D] };
      for (const p of POOLS) nb[p] = nb[p].filter((x) => x !== id);
      return nb;
    });
    setMsg("");
  }
  function tirar(id: string) {
    setPools((prev) => {
      const np: Pools = { A: [...prev.A], B: [...prev.B], C: [...prev.C], D: [...prev.D] };
      for (const p of POOLS) np[p] = np[p].filter((x) => x !== id);
      return np;
    });
    setByes((prev) => {
      const nb: Pools = { A: [...prev.A], B: [...prev.B], C: [...prev.C], D: [...prev.D] };
      for (const p of POOLS) nb[p] = nb[p].filter((x) => x !== id);
      return nb;
    });
  }
  function alternarBye(id: string, pool: PoolId) {
    setByes((prev) => {
      const nb: Pools = { A: [...prev.A], B: [...prev.B], C: [...prev.C], D: [...prev.D] };
      nb[pool] = nb[pool].includes(id) ? nb[pool].filter((x) => x !== id) : [...nb[pool], id];
      return nb;
    });
  }

  async function guardar() {
    setErro(""); setMsg("");
    const totalColocados = POOLS.reduce((n, p) => n + pools[p].length, 0);
    if (totalColocados === 0) { setErro(t("chvm.faltaColocar")); return; }
    setAGravar(true);
    try {
      const tk = await token();
      const payload = { A: pools.A, B: pools.B, C: pools.C, D: pools.D, byes: { A: byes.A, B: byes.B, C: byes.C, D: byes.D } };
      const r = await fetch("/api/chaveamento-moldura", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${tk}` },
        body: JSON.stringify({ acao: "gravar", comp, categoria: cat, genero, pools: payload }),
      });
      const j = await r.json().catch(() => null);
      if (!j?.ok) { setErro(t("chvm.naoGuardar")); return; }
      setMsg(t("chvm.guardado"));
      setFeitas((f) => ({ ...f, [cat]: true }));
      setCache((c) => ({ ...c, [cat]: { pools: payload, genero } }));
    } catch {
      setErro(t("chvm.naoGuardar"));
    } finally {
      setAGravar(false);
    }
  }

  async function apagar() {
    if (!confirm(t("chvm.confirmApagarCat"))) return;
    const tk = await token();
    await fetch("/api/chaveamento-moldura", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${tk}` },
      body: JSON.stringify({ acao: "apagar", comp, categoria: cat }),
    });
    setFeitas((f) => { const n = { ...f }; delete n[cat]; return n; });
    setCache((c) => { const n = { ...c }; delete n[cat]; return n; });
    setPools(POOLS_VAZIOS); setByes(POOLS_VAZIOS);
    setMsg("");
  }

  async function avisar() {
    setErro(""); setMsg("");
    const tk = await token();
    const r = await fetch("/api/chaveamento-moldura", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${tk}` },
      body: JSON.stringify({ acao: "avisar", comp }),
    });
    const j = await r.json().catch(() => null);
    if (j?.jaAvisado) setMsg(t("chvm.jaAvisado"));
    else if (j?.ok) setMsg(t("chvm.avisado"));
    else setErro(t("chvm.naoGuardar"));
  }

  if (acesso === "a-ver") return <Centro texto={t("be.aVerificar")} />;
  if (acesso === "nao") return <SemAcesso />;

  // Índice id -> atleta, para render.
  const idA: Record<string, Atleta> = {};
  for (const a of atletas) idA[a.id] = a;

  const daCat = atletas.filter((a) => norm(a.category) === norm(cat) && String(a.gender || "").toUpperCase() === genero);
  const colocado = new Set<string>([...pools.A, ...pools.B, ...pools.C, ...pools.D]);
  const porColocar = daCat.filter((a) => !colocado.has(a.id));
  const totalColocados = colocado.size;

  const nomeCurto = (a?: Atleta) => (a ? `${a.name}${a.countryIso ? ` (${a.countryIso})` : ""}` : "—");

  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: FB }}>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "14px 14px 60px" }}>
        <header style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 16 }}>
          <a href="/inicio" aria-label={t("comum.voltar")} style={{ width: 34, height: 34, borderRadius: "50%", border: "1px solid #243029", display: "flex", alignItems: "center", justifyContent: "center", color: "#cfd8d2", textDecoration: "none", flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
          </a>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontFamily: FD, fontSize: 18, fontWeight: 700, textTransform: "uppercase", margin: 0 }}>{t("chvm.titulo")}</h1>
            <div style={{ fontSize: 11.5, color: "#93a39a" }}>{t("chvm.sub")}</div>
          </div>
        </header>

        <Campo label={t("chv.labelComp")}>
          <select value={comp} onChange={(e) => setComp(e.target.value)} style={{ ...inp, appearance: "auto" }}>
            <option value="" disabled>{t("chv.compPlaceholder")}</option>
            {COMPS.map((s) => <option key={s.idCompeticao} value={s.idCompeticao}>{s.nome}</option>)}
          </select>
        </Campo>

        {carregando ? (
          <div style={{ fontSize: 13, color: "#7c8a82", textAlign: "center", padding: "24px 0", fontFamily: FD, letterSpacing: "0.08em", textTransform: "uppercase" }}>{t("chvm.aCarregarInscritos")}</div>
        ) : atletas.length === 0 ? (
          <div style={{ fontSize: 13.5, color: "#93a39a", lineHeight: 1.6, textAlign: "center", padding: "20px 12px", background: "#121815", border: "1px solid #243029", borderRadius: 12 }}>{t("chvm.semInscritos")}</div>
        ) : (
          <>
            {/* Categorias: M em cima, F em baixo. ✓ nas que já têm moldura. */}
            {[CATS_M, CATS_F].map((linha, li) => (
              <div key={li} style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: li === 0 ? 6 : 12 }}>
                {linha.map((c) => {
                  const sel = c === cat;
                  return (
                    <button key={c} onClick={() => escolherCat(c)}
                      style={{ background: sel ? GOLD : "transparent", border: `1px solid ${sel ? GOLD : "#2a3a33"}`, color: sel ? "#1b211e" : "#93a39a", fontFamily: FD, fontSize: 11.5, fontWeight: 700, padding: "6px 9px", borderRadius: 8, cursor: "pointer" }}>
                      {feitas[c] ? "✓ " : ""}{c}
                    </button>
                  );
                })}
              </div>
            ))}

            <div style={{ fontSize: 11.5, color: "#5f6f67", lineHeight: 1.5, margin: "2px 0 12px" }}>{t("chvm.dica")}</div>

            {daCat.length === 0 ? (
              <div style={{ fontSize: 13, color: "#5f6f67", textAlign: "center", padding: "16px 0" }}>{t("chvm.semAtletasCat")}</div>
            ) : (
              <>
                {/* POR COLOCAR */}
                {porColocar.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontFamily: FD, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#93a39a", marginBottom: 6 }}>
                      {t("chvm.porColocar")} · {porColocar.length}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {porColocar.map((a) => (
                        <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, background: "#121815", border: "1px solid #243029", borderRadius: 9, padding: "7px 9px" }}>
                          <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: "#d6ddd6", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nomeCurto(a)}</span>
                          {POOLS.map((p) => (
                            <button key={p} onClick={() => colocar(a.id, p)} style={miniPool}>{p}</button>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* POOLS */}
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {POOLS.map((p) => (
                    <div key={p} style={{ background: "#121815", border: "1px solid #243029", borderRadius: 11, padding: "10px 12px" }}>
                      <div style={{ fontFamily: FD, fontSize: 12.5, fontWeight: 700, textTransform: "uppercase", color: GOLD, marginBottom: 7 }}>
                        Pool {p} · {pools[p].length}
                      </div>
                      {pools[p].length === 0 ? (
                        <div style={{ fontSize: 12, color: "#5f6f67" }}>—</div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                          {pools[p].map((id, i) => {
                            const ehBye = byes[p].includes(id);
                            return (
                              <div key={id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ flexShrink: 0, width: 18, fontSize: 11, color: "#7c8a82", fontFamily: FD }}>{i + 1}</span>
                                <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: "#d6ddd6", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nomeCurto(idA[id])}</span>
                                <button onClick={() => alternarBye(id, p)} title={t("chvm.bye")}
                                  style={{ flexShrink: 0, background: ehBye ? "#2a2410" : "transparent", border: `1px solid ${ehBye ? GOLD : "#2a3a33"}`, color: ehBye ? GOLD : "#7c8a82", fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", padding: "3px 7px", borderRadius: 6, cursor: "pointer", fontFamily: FD }}>
                                  {t("chvm.bye")}
                                </button>
                                <button onClick={() => tirar(id)} aria-label={t("chv.removerPrint")} style={{ flexShrink: 0, background: "transparent", border: "none", color: "#ef8d83", fontSize: 15, cursor: "pointer", lineHeight: 1, padding: "0 2px" }}>✕</button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {erro && <Aviso cor="#ef8d83" texto={erro} />}
                {msg && <Aviso cor="#7fd1a3" texto={msg} />}

                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <button onClick={guardar} disabled={aGravar} style={btnPri}>
                    {aGravar ? t("be.aGuardarPub") : t("chvm.guardarCat")}
                  </button>
                  {feitas[cat] && <button onClick={apagar} disabled={aGravar} style={btnSec}>{t("chvm.apagarCat")}</button>}
                </div>
                <div style={{ fontSize: 11, color: "#5f6f67", marginTop: 8 }}>{t("chvm.colocados", { n: totalColocados })}</div>
              </>
            )}

            {/* AVISAR — separado, no fim. */}
            <div style={{ marginTop: 22, paddingTop: 16, borderTop: "1px solid #1a221d" }}>
              <button onClick={avisar} style={{ ...btnSec, width: "100%" }}>{t("chvm.avisar")}</button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontFamily: FD, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#93a39a", marginBottom: 5 }}>{label}</div>
      {children}
    </div>
  );
}

function Aviso({ cor, texto }: { cor: string; texto: string }) {
  return <div style={{ fontSize: 12.5, color: cor, marginTop: 10, lineHeight: 1.45 }}>{texto}</div>;
}

function SemAcesso() {
  const t = useT();
  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: FB, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ maxWidth: 320, textAlign: "center" }}>
        <div style={{ position: "relative", width: 130, height: 130, margin: "0 auto 6px" }}>
          <Mascot belt="#efeadd" expression="indicando" />
          <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 52 }} aria-hidden="true">🙅</span>
        </div>
        <h1 style={{ fontFamily: FD, fontSize: 19, fontWeight: 700, textTransform: "uppercase", margin: "6px 0 10px" }}>{t("be.porAquiNao")}</h1>
        <p style={{ fontSize: 14, color: "#93a39a", lineHeight: 1.6, margin: "0 0 20px" }}>{t("chv.semAcessoCorpo")}</p>
        <a href="/inicio" style={{ display: "inline-block", background: GOLD, color: "#1b211e", fontFamily: FD, fontSize: 13.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", padding: "12px 24px", borderRadius: 11, textDecoration: "none" }}>{t("chv.irInicio")}</a>
      </div>
    </main>
  );
}

function Centro({ texto }: { texto: string }) {
  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#7c8a82", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FD, fontSize: 13, letterSpacing: "0.1em", textTransform: "uppercase", padding: 20, textAlign: "center" }}>
      {texto}
    </main>
  );
}

const inp: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", background: "#0c0e0d", border: "1px solid #24364a",
  borderRadius: 9, padding: "10px 12px", color: "#f1ede2", fontSize: 14, fontFamily: FB, outline: "none",
};
const btnPri: React.CSSProperties = {
  flex: 1, background: GOLD, color: "#1b211e", border: "none", fontFamily: FD, fontSize: 13.5,
  fontWeight: 700, textTransform: "uppercase", padding: "12px", borderRadius: 10, cursor: "pointer",
};
const btnSec: React.CSSProperties = {
  background: "transparent", color: "#cfd8d2", border: "1px solid #2a3a33", fontFamily: FD, fontSize: 12.5,
  fontWeight: 700, textTransform: "uppercase", padding: "12px 14px", borderRadius: 10, cursor: "pointer",
};
const miniPool: React.CSSProperties = {
  flexShrink: 0, width: 26, height: 26, background: "transparent", border: "1px solid #2a3a33",
  color: GOLD, fontSize: 12, fontWeight: 700, borderRadius: 7, cursor: "pointer", fontFamily: FD,
};
