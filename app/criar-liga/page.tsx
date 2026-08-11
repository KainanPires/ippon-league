"use client";
import { useState, useRef, useEffect } from "react";
import { Escudo, SymbolGlyph, SHAPES, PATTERNS, LEAGUE_SYMBOLS, COLORS, type Identity } from "@/components/Escudo";
import { DEFAULT_LEAGUE_SHIELD, type LeagueFormat, type LeaguePrivacy } from "@/lib/leagues";
import { supabase } from "@/lib/supabase";
import { focoMercado, proximaDepoisDe, CALENDARIO_2026, type SemanaCalendario } from "@/lib/calendario";
import { useNivel } from "@/lib/useNivel";
import { LIMITES } from "@/lib/planos";
import { useT, useLingua } from "@/lib/i18n";
const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";
// Slots de cor. Guardam a CHAVE de tradução (mesmo modelo do editor do escudo).
type Slot = "bg1" | "bg2" | "border" | "icon" | "iconBorder" | "stamp1" | "stamp2";
const SLOTS_PRINCIPAIS: { id: Slot; label: string }[] = [
  { id: "bg1", label: "escudo.fundo1" },
  { id: "bg2", label: "escudo.fundo2" },
  { id: "border", label: "escudo.bordaFundo" },
  { id: "icon", label: "escudo.icone" },
  { id: "iconBorder", label: "escudo.bordaIcone" },
];
const SLOTS_ESTAMPA: { id: Slot; label: string }[] = [
  { id: "stamp1", label: "escudo.estampa1" },
  { id: "stamp2", label: "escudo.estampa2" },
];
const rnd = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
// "AAAA/MM/DD" (formato do calendário) -> Date local. Devolve null se inválido.
function dataDe(s: string): Date | null {
  const p = (s || "").split("/");
  if (p.length !== 3) return null;
  const d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  return isNaN(d.getTime()) ? null : d;
}
// Competições REAIS (sem clássicos), ordenadas por data, a partir de HOJE e até
// 1 ANO depois. É a "janela" de onde se escolhe o início e o fim por competição.
function janelaCompeticoes(): SemanaCalendario[] {
  const hoje = new Date();
  const limite = new Date(hoje.getFullYear() + 1, hoje.getMonth(), hoje.getDate());
  return CALENDARIO_2026
  .filter((s) => !s.classico && s.de)
  .map((s) => ({ s, d: dataDe(s.de) }))
  .filter((x): x is { s: SemanaCalendario; d: Date } => x.d !== null && x.d >= startOfDay(hoje) && x.d <= limite)
  .sort((a, b) => a.d.getTime() - b.d.getTime())
  .map((x) => x.s);
}
function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
// Lista de meses possíveis para o "fim por mês": do mês a seguir ao mês de início
// (ou ao mês atual) até, no máximo, o mesmo mês de hoje no ANO SEGUINTE (teto de 1
// ano). Devolve { valor: "AAAA-MM", ano, mes } — o rótulo localizado é montado no
// ecrã, com o mês na língua da pessoa (via Intl).
function mesesDeFim(dataInicio: Date | null): { valor: string; ano: number; mes: number }[] {
  const hoje = new Date();
  const base = dataInicio || hoje;
  let ano = base.getFullYear();
  let mes = base.getMonth() + 1; // mês seguinte (0-based)
  if (mes > 11) { mes = 0; ano += 1; }
  const tetoAno = hoje.getFullYear() + 1;
  const tetoMes = hoje.getMonth();
  const out: { valor: string; ano: number; mes: number }[] = [];
  let guardas = 0;
  while (guardas < 24) {
    if (ano > tetoAno || (ano === tetoAno && mes > tetoMes)) break;
    out.push({ valor: `${ano}-${String(mes + 1).padStart(2, "0")}`, ano, mes });
    mes += 1;
    if (mes > 11) { mes = 0; ano += 1; }
    guardas += 1;
  }
  return out;
}
interface LigaCriada {
  id: string;
  name: string;
  invite_code: string;
  formato: string;
  privacidade: string;
}
// Nome amigável do estado de privacidade — devolve a CHAVE de tradução.
function nomePrivacidade(p: string): string {
  if (p === "aberta") return "cl.aberta";
  if (p === "mediante_pedido") return "cl.porAprovacao";
  return "cl.fechada";
}
export default function CriarLiga() {
  const t = useT();
  const { lingua } = useLingua();
  const [step, setStep] = useState<"criar" | "convites">("criar");
  const [cfg, setCfg] = useState<Identity>(DEFAULT_LEAGUE_SHIELD);
  const [name, setName] = useState("");
  const [descricao, setDescricao] = useState("");
  const [format, setFormat] = useState<LeagueFormat>("pontos");
  // Copa: o admin escolhe a competição inicial (1ª ronda). O fecho da inscrição
  // é automático (1h antes dessa competição começar).
  const proximasComps: SemanaCalendario[] = (() => {
      const lista: SemanaCalendario[] = [];
      let c = focoMercado().alvo;
      for (let i = 0; i < 10; i++) { lista.push(c); c = proximaDepoisDe(c); }
      return lista;
    })();
  const [copaCompInicial, setCopaCompInicial] = useState<string>(proximasComps[0]?.idCompeticao || "");
  // --- Ligas de PONTOS CORRIDOS: início e fim escolhidos pelo dono ---
  const janela: SemanaCalendario[] = (() => janelaCompeticoes())();
  const [ligaCompInicial, setLigaCompInicial] = useState<string>(janela[0]?.idCompeticao || "");
  const [fimTipo, setFimTipo] = useState<"competicao" | "mes">("competicao");
  const [fimComp, setFimComp] = useState<string>(""); // id da competição de fim
  const [fimMes, setFimMes] = useState<string>(""); // "AAAA-MM"
  const [privacy, setPrivacy] = useState<LeaguePrivacy>("fechada");
  const [slot, setSlot] = useState<Slot>("bg1");
  const [created, setCreated] = useState<LigaCriada | null>(null);
  const [copied, setCopied] = useState(false);
  const [a_criar, setACriar] = useState(false);
  const [erro, setErro] = useState("");
  // Verificação de limite à entrada: quantas ligas de amigos já criou?
  const [aVerificar, setAVerificar] = useState(true);
  const [noLimite, setNoLimite] = useState(false);
  const [ehPro, setEhPro] = useState(false);
  const [ehProMax, setEhProMax] = useState(false);
  const [maximo, setMaximo] = useState(0);

  // O NÍVEL VEM DO useNivel (tabela `users`), NÃO DO user_metadata.
  const { ehPro: proReal, ehProMax: proMaxReal, pronto: nivelPronto } = useNivel();

  useEffect(() => {
      let vivo = true;
      // Espera saber o nível. Sem isto decidia-se o limite com "gratis".
      if (!nivelPronto) return;
      (async () => {
          try {
            const { data: sess } = await supabase.auth.getSession();
            const uid = sess.session?.user?.id;
            if (!uid) { if (vivo) setAVerificar(false); return; } // sem sessão: deixa seguir (a rota trata)
            const nivel = proMaxReal ? "promax" : proReal ? "pro" : "gratis";
            const lim = LIMITES[nivel].pontos;
            const res = await fetch(`/api/liga/minhas?user_id=${uid}`);
            const j = await res.json();
            const minhas = Array.isArray(j.ligas) ? j.ligas : [];
            // CONTA COMO O SERVIDOR CONTA: ligas de AMIGOS de pontos corridos em
            // que participa; sem as terminadas; sem as oficiais; sem as copas.
            const usadas = minhas.filter((l: { type?: string | null; formato?: string; estado?: string | null; copa_estado?: string | null }) => {
                if (String(l.type) === "oficial") return false;
                if (String(l.formato) === "copa") return false;
                return String(l.estado) !== "terminada";
              }).length;
            if (vivo) {
              setEhPro(proReal);
              setEhProMax(proMaxReal);
              setMaximo(lim);
              setNoLimite(usadas >= lim);
              setAVerificar(false);
            }
          } catch {
            if (vivo) setAVerificar(false); // em erro, deixa seguir (a rota é a barreira real)
          }
        })();
      return () => { vivo = false; };
    }, [nivelPronto, proReal, proMaxReal]);
  function set<K extends keyof Identity>(key: K, value: Identity[K]) {
    setCfg((prev) => ({ ...prev, [key]: value }));
  }
  function sortear() {
    setCfg((p) => ({ ...p, shape: rnd(SHAPES), pattern: rnd(PATTERNS).id, symbol: rnd(LEAGUE_SYMBOLS).id, bg1: rnd(COLORS), bg2: rnd(COLORS), stamp1: rnd(COLORS), stamp2: rnd(COLORS), border: rnd(COLORS), icon: rnd(COLORS), iconBorder: rnd(COLORS) }));
  }
  // A estampa só importa quando há um padrão (não "Sólido").
  const temEstampa = cfg.pattern !== "solido";
  const slotsVisiveis = temEstampa ? [...SLOTS_PRINCIPAIS, ...SLOTS_ESTAMPA] : SLOTS_PRINCIPAIS;
  const valorSlot = (cfg[slot] as string | undefined) || "";
  // --- Derivados das escolhas (ligas de pontos corridos) ---
  const compInicialObj = janela.find((c) => c.idCompeticao === ligaCompInicial) || null;
  const dataInicio = compInicialObj ? dataDe(compInicialObj.de) : null;
  const compsFim = janela.filter((c) => {
      if (!dataInicio) return false;
      const d = dataDe(c.de);
      return d != null && d > dataInicio && c.idCompeticao !== ligaCompInicial;
    });
  const mesesFim = mesesDeFim(dataInicio);
  // Rótulo do mês localizado (ex.: "Março de 2026" / "March 2026" / "März 2026").
  const rotuloMes = (m: { ano: number; mes: number }) => {
    const s = new Date(m.ano, m.mes, 1).toLocaleDateString(lingua, { month: "long", year: "numeric" });
    return s.charAt(0).toUpperCase() + s.slice(1);
  };
  const compFimObj = compsFim.find((c) => c.idCompeticao === fimComp) || null;
  const mesFimObj = mesesFim.find((m) => m.valor === fimMes) || null;
  // Texto informativo (pré-visualização do que será mostrado a quem entra).
  const informativo = (() => {
      if (!compInicialObj) return "";
      const ini = compInicialObj.nome;
      if (fimTipo === "competicao" && compFimObj) return t("cl.infoAte", { ini, fim: compFimObj.nome });
      if (fimTipo === "mes" && mesFimObj) return t("cl.infoMes", { ini, mesFim: rotuloMes(mesFimObj) });
      return "";
    })();
  const fimValido = fimTipo === "competicao" ? !!compFimObj : !!mesFimObj;
  const pontosOk = format !== "pontos" || (!!compInicialObj && fimValido);
  const canCreate = name.trim().length >= 2 && pontosOk && !a_criar;
  async function criar() {
    if (!canCreate) return;
    setErro("");
    setACriar(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const user_id = sess.session?.user?.id;
      if (!user_id) {
        window.location.href = "/entrar?voltar=/criar-liga";
        return;
      }
      const res = await fetch("/api/liga/criar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
              user_id,
              nome: name.trim(),
              descricao: descricao.trim(),
              formato: format,
              privacidade: privacy,
              escudo: { ...cfg, name: name.trim() },
              copa_competicao_inicial: format === "copa" ? copaCompInicial : null,
              liga_competicao_inicial: format === "pontos" ? ligaCompInicial : null,
              fim_tipo: format === "pontos" ? fimTipo : null,
              fim_valor: format === "pontos" ? (fimTipo === "competicao" ? fimComp : fimMes) : null,
            }),
        });
      const j = await res.json();
      if (!j.ok) {
        setErro(j.erro || t("cl.erroCriar"));
        setACriar(false);
        return;
      }
      setCreated(j.liga);
      setStep("convites");
    } catch {
      setErro(t("cl.falhaLigacao"));
      setACriar(false);
    }
  }
  const inviteLink = created ? `https://www.ipponleague.com/liga/${created.invite_code}` : "";
  function copy() {
    try { navigator.clipboard.writeText(inviteLink); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch {}
  }
  function partilhar() {
    if (!created) return;
    const texto = t("cl.partilharTexto", { nome: created.name, codigo: created.invite_code });
    const navAny = navigator as unknown as { share?: (d: { title?: string; text?: string; url?: string }) => Promise<void> };
    if (navAny.share) {
      navAny.share({ title: "Ippon League", text: texto, url: inviteLink }).catch(() => {});
    } else {
      try { navigator.clipboard.writeText(inviteLink); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch {}
    }
  }
  // "Não há competições... Escolhe o fim <por mês>." — negrito no meio.
  const semCompsFim = t("cl.semCompsFim").split("%D%");
  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: FB }}>
    <div style={{ maxWidth: 460, margin: "0 auto", padding: "14px 16px 40px" }}>
    <header style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
    {step === "criar" ? (
        <a href="/ligas" aria-label={t("comum.voltar")} style={backBtn}><BackArrow /></a>
      ) : (
        <button onClick={() => setStep("criar")} aria-label={t("comum.voltar")} style={{ ...backBtn, cursor: "pointer" }}><BackArrow /></button>
      )}
    <span style={{ fontFamily: FD, fontSize: 19, fontWeight: 700, textTransform: "uppercase" }}>{step === "criar" ? t("cl.criarLiga") : t("cl.convidar")}</span>
    </header>
    {step === "criar" && aVerificar ? (
        <div style={{ textAlign: "center", padding: "50px 16px", color: "#7c8a82", fontFamily: FD, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.1em" }}>{t("comum.carregando")}</div>
      ) : step === "criar" && noLimite ? (
        <div style={{ background: ehPro ? "#121815" : "#2a2410", border: `1px solid ${ehPro ? "#243029" : "#5a4a18"}`, borderRadius: 16, padding: "22px 18px", textAlign: "center" }}>
        <div style={{ fontSize: 34, marginBottom: 8 }}>{ehPro ? "✓" : "🔒"}</div>
        <div style={{ fontFamily: FD, fontSize: 16, fontWeight: 700, textTransform: "uppercase", color: ehPro ? "#cfd8d2" : GOLD, marginBottom: 8 }}>
        {ehPro ? t("cl.atingisteMax") : t("cl.jaCriaste")}
        </div>
        {/* A MENSAGEM DO LIMITE — e a oferta certa para cada nível. Os números
            vêm do LIMITES, não escritos à mão. */}
        <p style={{ fontSize: 13.5, color: "#c7d0c9", lineHeight: 1.55, margin: "0 0 18px" }}>
        {ehProMax
          ? t("cl.limMax", { maximo })
          : ehPro
          ? t("cl.limPro", { maximo, promax: LIMITES.promax.pontos })
          : t("cl.limGratis", { maximo, pro: LIMITES.pro.pontos, promax: LIMITES.promax.pontos })}
        </p>
        {ehPro && !ehProMax && (
            <a href="/pro-max" style={{ display: "inline-block", background: "#7fb8f5", color: "#0b1220", fontFamily: FD, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", fontSize: 14, padding: "12px 22px", borderRadius: 11, textDecoration: "none", marginBottom: 12 }}>{t("pro.passarMax")}</a>
          )}
        {!ehPro && (
            <a href="/ippon-pro" style={{ display: "inline-block", background: GOLD, color: "#1b211e", fontFamily: FD, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", fontSize: 14, padding: "12px 22px", borderRadius: 11, textDecoration: "none", marginBottom: 12 }}>{t("lg.conhecerPro")}</a>
          )}
        <div>
        <a href="/ligas" style={{ display: "inline-block", color: "#93a39a", fontSize: 13, fontFamily: FD, fontWeight: 700, textDecoration: "none" }}>← {t("cl.voltarLigas")}</a>
        </div>
        </div>
      ) : step === "criar" ? (
        <>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 8 }}>
        <Escudo config={cfg} size={96} />
        <button onClick={sortear} style={{ marginTop: 10, background: "#141a17", border: "1px solid #243029", color: "#cfd8d2", fontFamily: FD, fontWeight: 700, textTransform: "uppercase", fontSize: 12, padding: "8px 16px", borderRadius: 10, cursor: "pointer" }}>↻ {t("escudo.sortear")}</button>
        </div>
        <Label>{t("cl.nomeLiga")}</Label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("cl.phNomeLiga")} maxLength={28} style={inputStyle} />
        <Label>{t("cl.forma")}</Label>
        <ScrollRow>
        {SHAPES.map((s) => (
              <PickBox key={s} on={cfg.shape === s} onClick={() => set("shape", s)}>
              <Escudo config={{ ...cfg, shape: s }} size={40} />
              </PickBox>
            ))}
        </ScrollRow>
        <Label>{t("cl.estampa")}</Label>
        <ScrollRow>
        {PATTERNS.map((p) => (
              <PickBox key={p.id} on={cfg.pattern === p.id} onClick={() => set("pattern", p.id)} label={p.label}>
              <Escudo config={{ ...cfg, pattern: p.id }} size={40} />
              </PickBox>
            ))}
        </ScrollRow>
        <Label>{t("cl.adorno")}</Label>
        <ScrollRow>
        {LEAGUE_SYMBOLS.map((sy) => (
              <PickBox key={sy.id} on={cfg.symbol === sy.id} onClick={() => set("symbol", sy.id)} label={sy.label}>
              {sy.id === "none" ? (
                  <span style={{ fontSize: 11, color: "#7c8a82" }}>—</span>
                ) : (
                  <svg width="34" height="34" viewBox="0 0 24 24"><g transform="scale(0.85) translate(2,2)"><SymbolGlyph id={sy.id} color={GOLD} /></g></svg>
                )}
              </PickBox>
            ))}
        </ScrollRow>
        {/* CORES — mesmo modelo do escudo do time. */}
        <Label>{t("cl.cores")}</Label>
        <ScrollRow>
        {slotsVisiveis.map((s) => (
              <button key={s.id} onClick={() => setSlot(s.id)} aria-label={t(s.label)}
              style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, background: "transparent", border: "none", cursor: "pointer", padding: 0, width: 64 }}>
              <span style={{ position: "relative", width: 44, height: 44, borderRadius: "50%", background: ((cfg[s.id] as string | undefined) || "") || "transparent", border: `2px solid ${slot === s.id ? GOLD : "rgba(255,255,255,0.25)"}`, boxShadow: slot === s.id ? `0 0 0 3px rgba(217,164,65,0.35)` : "none", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {!((cfg[s.id] as string | undefined) || "") && (
                  <svg width="44" height="44" viewBox="0 0 44 44" aria-hidden="true" style={{ position: "absolute", inset: 0 }}>
                  <line x1="10" y1="34" x2="34" y2="10" stroke="#7c8a82" strokeWidth="2" />
                  </svg>
                )}
              </span>
              <span style={{ fontSize: 10, fontWeight: 700, color: slot === s.id ? GOLD : "#93a39a", textAlign: "center", lineHeight: 1.2 }}>{t(s.label)}</span>
              </button>
            ))}
        </ScrollRow>
        <div style={{ fontSize: 11, color: "#93a39a", textAlign: "center", marginBottom: 10 }}>
        {t("escudo.aPintar")} <span style={{ color: GOLD, fontWeight: 700 }}>{t(slotsVisiveis.find((s) => s.id === slot)?.label || "")}</span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 9, marginBottom: 22 }}>
        {/* A "Borda do ícone" pode ser NENHUMA (sem contorno). */}
        {slot === "iconBorder" && (
            <button onClick={() => set("iconBorder", "")} aria-label={t("escudo.semBordaIcone")}
            style={{ position: "relative", width: 30, height: 30, borderRadius: "50%", background: "#0c0e0d", border: `2px solid ${valorSlot === "" ? "#f1ede2" : "#243029"}`, boxShadow: valorSlot === "" ? `0 0 0 2px ${GOLD}` : "none", cursor: "pointer" }}>
            <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true" style={{ position: "absolute", inset: 0 }}>
            <line x1="6" y1="20" x2="20" y2="6" stroke="#ef8d83" strokeWidth="2" />
            </svg>
            </button>
          )}
        {COLORS.map((c) => {
              const on = valorSlot.toLowerCase() === c.toLowerCase();
              return <button key={c} onClick={() => set(slot, c)} aria-label={c} style={{ width: 30, height: 30, borderRadius: "50%", background: c, border: on ? `2px solid ${GOLD}` : "2px solid #243029", cursor: "pointer" }} />;
            })}
        </div>
        <Label>{t("cl.formato")}</Label>
        <div style={{ display: "flex", gap: 10, marginBottom: 22 }}>
        <FormatCard on={format === "pontos"} onClick={() => setFormat("pontos")} title={t("cl.pontosTitulo")} desc={t("cl.pontosDesc")} icon="🏅" />
        <FormatCard on={format === "copa"} onClick={() => setFormat("copa")} title="Copa Ippon" desc={t("cl.copaDesc")} icon="🏆" />
        </div>
        {format === "copa" && (
            <>
            <Label>{t("cl.compArranque")}</Label>
            <p style={{ fontSize: 11.5, color: "#7c8a82", margin: "-2px 0 9px", lineHeight: 1.5 }}>
            {t("cl.copaHelp")}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 22 }}>
            {proximasComps.map((c) => (
                  <button key={c.idCompeticao} type="button" onClick={() => setCopaCompInicial(c.idCompeticao)} style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", textAlign: "left", background: copaCompInicial === c.idCompeticao ? "#16201b" : "#121815", border: `1.5px solid ${copaCompInicial === c.idCompeticao ? GOLD : "#243029"}`, borderRadius: 12, padding: "11px 13px", cursor: "pointer", color: "#f1ede2" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.nome}</div>
                  <div style={{ fontSize: 11, color: "#93a39a", marginTop: 1 }}>{c.nivel} · {c.de.replace(/\//g, "-")}</div>
                  </div>
                  <div style={{ flexShrink: 0, width: 18, height: 18, borderRadius: "50%", border: `2px solid ${copaCompInicial === c.idCompeticao ? GOLD : "#3a4a42"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {copaCompInicial === c.idCompeticao && <div style={{ width: 8, height: 8, borderRadius: "50%", background: GOLD }} />}
                  </div>
                  </button>
                ))}
            </div>
            </>
          )}
        {format === "pontos" && (
            <>
            <Label>{t("cl.compArranque")}</Label>
            <p style={{ fontSize: 11.5, color: "#7c8a82", margin: "-2px 0 9px", lineHeight: 1.5 }}>
            {t("cl.pontosHelp")}
            </p>
            {janela.length === 0 ? (
                <div style={{ background: "#2a1a18", border: "1px solid #5a2a24", color: "#ef8d83", fontSize: 12.5, padding: "10px 12px", borderRadius: 10, marginBottom: 22 }}>
                {t("cl.semComps")}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 22 }}>
                {janela.slice(0, 12).map((c) => (
                      <button key={c.idCompeticao} type="button" onClick={() => { setLigaCompInicial(c.idCompeticao); setFimComp(""); setFimMes(""); }} style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", textAlign: "left", background: ligaCompInicial === c.idCompeticao ? "#16201b" : "#121815", border: `1.5px solid ${ligaCompInicial === c.idCompeticao ? GOLD : "#243029"}`, borderRadius: 12, padding: "11px 13px", cursor: "pointer", color: "#f1ede2" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.nome}</div>
                      <div style={{ fontSize: 11, color: "#93a39a", marginTop: 1 }}>{c.nivel} · {c.de.replace(/\//g, "-")}</div>
                      </div>
                      <div style={{ flexShrink: 0, width: 18, height: 18, borderRadius: "50%", border: `2px solid ${ligaCompInicial === c.idCompeticao ? GOLD : "#3a4a42"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {ligaCompInicial === c.idCompeticao && <div style={{ width: 8, height: 8, borderRadius: "50%", background: GOLD }} />}
                      </div>
                      </button>
                    ))}
                </div>
              )}
            <Label>{t("cl.fimLiga")}</Label>
            <p style={{ fontSize: 11.5, color: "#7c8a82", margin: "-2px 0 9px", lineHeight: 1.5 }}>
            {t("cl.fimHelp")}
            </p>
            {/* Abas: por competição | por mês */}
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <button type="button" onClick={() => setFimTipo("competicao")} style={{ flex: 1, background: fimTipo === "competicao" ? "#16201b" : "#121815", border: `1.5px solid ${fimTipo === "competicao" ? GOLD : "#243029"}`, borderRadius: 10, padding: "9px 8px", cursor: "pointer", color: fimTipo === "competicao" ? "#f1ede2" : "#93a39a", fontFamily: FD, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em" }}>{t("cl.porCompeticao")}</button>
            <button type="button" onClick={() => setFimTipo("mes")} style={{ flex: 1, background: fimTipo === "mes" ? "#16201b" : "#121815", border: `1.5px solid ${fimTipo === "mes" ? GOLD : "#243029"}`, borderRadius: 10, padding: "9px 8px", cursor: "pointer", color: fimTipo === "mes" ? "#f1ede2" : "#93a39a", fontFamily: FD, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em" }}>{t("cl.porMes")}</button>
            </div>
            {fimTipo === "competicao" ? (
                compsFim.length === 0 ? (
                  <div style={{ background: "#2a2410", border: "1px solid #5a4a18", color: GOLD, fontSize: 12.5, padding: "10px 12px", borderRadius: 10, marginBottom: 22, lineHeight: 1.45 }}>
                  {semCompsFim[0]}<strong>{t("cl.semCompsFimDestaque")}</strong>{semCompsFim[1]}
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 22 }}>
                  {compsFim.slice(0, 16).map((c) => (
                        <button key={c.idCompeticao} type="button" onClick={() => setFimComp(c.idCompeticao)} style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", textAlign: "left", background: fimComp === c.idCompeticao ? "#16201b" : "#121815", border: `1.5px solid ${fimComp === c.idCompeticao ? GOLD : "#243029"}`, borderRadius: 12, padding: "11px 13px", cursor: "pointer", color: "#f1ede2" }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.nome}</div>
                        <div style={{ fontSize: 11, color: "#93a39a", marginTop: 1 }}>{c.nivel} · {c.de.replace(/\//g, "-")}</div>
                        </div>
                        <div style={{ flexShrink: 0, width: 18, height: 18, borderRadius: "50%", border: `2px solid ${fimComp === c.idCompeticao ? GOLD : "#3a4a42"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {fimComp === c.idCompeticao && <div style={{ width: 8, height: 8, borderRadius: "50%", background: GOLD }} />}
                        </div>
                        </button>
                      ))}
                  </div>
                )
              ) : (
                <select value={fimMes} onChange={(e) => setFimMes(e.target.value)} aria-label={t("cl.mesDeFim")} style={{ ...inputStyle, marginBottom: 22, cursor: "pointer", color: fimMes ? "#f1ede2" : "#93a39a" }}>
                <option value="">{t("cl.escolheMes")}</option>
                {mesesFim.map((m) => (
                      <option key={m.valor} value={m.valor}>{rotuloMes(m)}</option>
                    ))}
                </select>
              )}
            {/* Pré-visualização do informativo que quem entra vai ver. */}
            {informativo && (
                <div style={{ background: "#121815", border: "1px solid #2a4d3e", borderRadius: 12, padding: "11px 13px", marginBottom: 22, display: "flex", gap: 9, alignItems: "flex-start" }}>
                <span aria-hidden="true" style={{ fontSize: 15, flexShrink: 0 }}>📅</span>
                <span style={{ fontSize: 12.5, color: "#aee9c9", lineHeight: 1.45 }}>{informativo}</span>
                </div>
              )}
            </>
          )}
        <Label>{t("cl.descricao")}</Label>
        <textarea
        value={descricao}
        onChange={(e) => setDescricao(e.target.value)}
        placeholder={t("cl.phDescricao")}
        maxLength={400}
        rows={4}
        style={{ ...inputStyle, marginBottom: 6, resize: "vertical", lineHeight: 1.5, fontFamily: FB }}
        />
        <div style={{ fontSize: 11, color: "#7c8a82", marginBottom: 22, textAlign: "right" }}>{descricao.length}/400</div>
        <Label>{t("cl.privacidade")}</Label>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 26 }}>
        <PrivacyRow on={privacy === "aberta"} onClick={() => setPrivacy("aberta")} title={t("cl.aberta")} desc={t("cl.abertaDesc")} icon="🌍" />
        <PrivacyRow on={privacy === "mediante_pedido"} onClick={() => setPrivacy("mediante_pedido")} title={t("cl.porAprovacao")} desc={t("cl.porAprovacaoDesc")} icon="✋" />
        <PrivacyRow on={privacy === "fechada"} onClick={() => setPrivacy("fechada")} title={t("cl.fechada")} desc={t("cl.fechadaDesc")} icon="🔒" />
        </div>
        {erro && (
            erro.includes("Pro") ? (
              <a href="/ippon-pro" style={{ display: "block", background: "#2a2410", border: "1px solid #5a4a18", color: GOLD, fontSize: 12.5, padding: "10px 12px", borderRadius: 10, marginBottom: 12, textDecoration: "none", lineHeight: 1.4 }}>{erro} →</a>
            ) : (
              <div style={{ background: "#2a1a18", border: "1px solid #5a2a24", color: "#ef8d83", fontSize: 12.5, padding: "10px 12px", borderRadius: 10, marginBottom: 12 }}>{erro}</div>
            )
          )}
        <button onClick={criar} disabled={!canCreate} style={{ width: "100%", background: canCreate ? GOLD : "#23291f", color: canCreate ? "#1b211e" : "#5f6f67", border: "none", fontFamily: FD, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", padding: 15, borderRadius: 12, fontSize: 16, cursor: canCreate ? "pointer" : "default" }}>{a_criar ? t("cl.aCriar") : t("cl.criarLiga")}</button>
        {!canCreate && !a_criar && (
            <div style={{ textAlign: "center", fontSize: 11, color: "#7c8a82", marginTop: 8 }}>
            {name.trim().length < 2
              ? t("cl.daNomeLiga")
              : format === "pontos" && !compInicialObj
              ? t("cl.escolheArranque")
              : format === "pontos" && !fimValido
              ? t("cl.escolheFim")
              : t("cl.daNomeLiga")}
            </div>
          )}
        </>
      ) : (
        created && (
          <>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", marginBottom: 18 }}>
          <Escudo config={{ ...cfg, name: created.name }} size={84} />
          <div style={{ fontFamily: FD, fontSize: 20, fontWeight: 700, textTransform: "uppercase", marginTop: 10 }}>{created.name}</div>
          <div style={{ fontSize: 12, color: "#7fd1a3", marginTop: 3 }}>{t("cl.ligaCriada")}</div>
          <div style={{ fontSize: 11, color: "#93a39a", marginTop: 2 }}>{t(nomePrivacidade(created.privacidade))}</div>
          </div>
          <Label>{t("cl.convidarLink")}</Label>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <div style={{ flex: 1, background: "#141a17", border: "1px solid #243029", borderRadius: 10, padding: "11px 12px", fontSize: 12.5, color: "#cfd8d2", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "flex", alignItems: "center" }}>{inviteLink}</div>
          <button onClick={copy} aria-label={t("cl.copiarLink")} style={{ background: copied ? "#3f8f5a" : "#141a17", color: copied ? "#06140d" : "#cfd8d2", border: "1px solid #243029", fontFamily: FD, fontWeight: 700, textTransform: "uppercase", fontSize: 12, padding: "0 14px", borderRadius: 10, cursor: "pointer", whiteSpace: "nowrap" }}>{copied ? "✓" : t("cl.copiar")}</button>
          <button onClick={partilhar} aria-label={t("cl.partilharLink")} style={{ background: GOLD, color: "#1b211e", border: "none", fontFamily: FD, fontWeight: 700, textTransform: "uppercase", fontSize: 12, padding: "0 14px", borderRadius: 10, cursor: "pointer", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>
          {t("cl.partilhar")}
          </button>
          </div>
          <div style={{ background: "#121815", border: "1px solid #243029", borderRadius: 12, padding: "12px 14px", marginBottom: 26, textAlign: "center" }}>
          <div style={{ fontSize: 11, color: "#93a39a", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>{t("cl.codigoConvite")}</div>
          <div style={{ fontFamily: FD, fontSize: 26, fontWeight: 700, color: GOLD, letterSpacing: "0.12em" }}>{created.invite_code}</div>
          </div>
          <a href="/ligas" style={{ display: "block", textAlign: "center", background: GOLD, color: "#1b211e", fontFamily: FD, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", padding: 15, borderRadius: 12, fontSize: 16, textDecoration: "none" }}>{t("cl.concluir")}</a>
          </>
        )
      )}
    </div>
    </main>
  );
}
const backBtn: React.CSSProperties = { width: 34, height: 34, borderRadius: "50%", border: "1px solid #243029", display: "flex", alignItems: "center", justifyContent: "center", color: "#cfd8d2", textDecoration: "none", background: "transparent" };
const inputStyle: React.CSSProperties = { width: "100%", background: "#141a17", border: "1px solid #243029", borderRadius: 11, padding: "13px 14px", color: "#f1ede2", fontSize: 15, fontFamily: FB, outline: "none", marginBottom: 22 };
function BackArrow() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>;
}
function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily: FD, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#93a39a", marginBottom: 9 }}>{children}</div>;
}
// Linha de privacidade empilhada (ícone + título + descrição, largura total).
function PrivacyRow({ on, onClick, title, desc, icon }: { on: boolean; onClick: () => void; title: string; desc: string; icon: string }) {
  return (
    <button onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", background: on ? "#16201b" : "#121815", border: `1.5px solid ${on ? GOLD : "#243029"}`, borderRadius: 13, padding: "12px 14px", cursor: "pointer", color: "#f1ede2" }}>
    <div style={{ fontSize: 22, flexShrink: 0 }}>{icon}</div>
    <div style={{ minWidth: 0 }}>
    <div style={{ fontFamily: FD, fontSize: 14, fontWeight: 700, textTransform: "uppercase", marginBottom: 2 }}>{title}</div>
    <div style={{ fontSize: 11.5, color: "#93a39a", lineHeight: 1.4 }}>{desc}</div>
    </div>
    <div style={{ marginLeft: "auto", flexShrink: 0, width: 18, height: 18, borderRadius: "50%", border: `2px solid ${on ? GOLD : "#3a4a42"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
    {on && <div style={{ width: 8, height: 8, borderRadius: "50%", background: GOLD }} />}
    </div>
    </button>
  );
}
function FormatCard({ on, onClick, title, desc, icon }: { on: boolean; onClick: () => void; title: string; desc: string; icon: string }) {
  return (
    <button onClick={onClick} style={{ flex: 1, textAlign: "left", background: on ? "#16201b" : "#121815", border: `1.5px solid ${on ? GOLD : "#243029"}`, borderRadius: 13, padding: 13, cursor: "pointer", color: "#f1ede2" }}>
    <div style={{ fontSize: 22, marginBottom: 6 }}>{icon}</div>
    <div style={{ fontFamily: FD, fontSize: 14, fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>{title}</div>
    <div style={{ fontSize: 11, color: "#93a39a", lineHeight: 1.4 }}>{desc}</div>
    </button>
  );
}
function PickBox({ on, onClick, children, label }: { on: boolean; onClick: () => void; children: React.ReactNode; label?: string }) {
  return (
    <button onClick={onClick} style={{ flexShrink: 0, width: 64, background: on ? "#16201b" : "#121815", border: `1.5px solid ${on ? GOLD : "#243029"}`, borderRadius: 12, padding: "10px 6px 7px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
    <div style={{ height: 42, display: "flex", alignItems: "center", justifyContent: "center" }}>{children}</div>
    {label && <span style={{ fontSize: 9.5, color: on ? GOLD : "#93a39a", textAlign: "center", lineHeight: 1.1 }}>{label}</span>}
    </button>
  );
}
function ScrollRow({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const go = (dir: number) => { if (ref.current) ref.current.scrollBy({ left: dir * 150, behavior: "smooth" }); };
  return (
    <div style={{ position: "relative", marginBottom: 22 }}>
    <Arrow side="left" onClick={() => go(-1)} />
    <div ref={ref} style={{ display: "flex", gap: 9, overflowX: "auto", scrollbarWidth: "none", padding: "2px 34px" }}>
    {children}
    </div>
    <Arrow side="right" onClick={() => go(1)} />
    </div>
  );
}
function Arrow({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  const t = useT();
  return (
    <button onClick={onClick} aria-label={side === "left" ? t("escudo.anterior") : t("escudo.seguinte")} style={{ position: "absolute", top: "50%", transform: "translateY(-50%)", [side]: 0, zIndex: 2, width: 28, height: 28, borderRadius: "50%", background: "#0c0e0d", border: "1px solid #243029", color: "#cfd8d2", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 } as React.CSSProperties}>
    {side === "left" ? "‹" : "›"}
    </button>
  );
}
