"use client";

import { useState, useEffect } from "react";
import { CATEGORIES, STATUS_LEGEND, type Athlete, type Gender, type AthleteStatus } from "@/lib/athletes";
import { loadDraftFor, saveDraftFor, setAthletePool } from "@/lib/team";
import { exigirSessao, temSessao } from "@/lib/auth";
import { Mascot } from "@/components/Mascot";
import { focoMercado } from "@/lib/calendario";
import { tutorialVistoLocal, tutoriaisVistosConta, marcarTutorialVisto } from "@/lib/tutorials";

const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";
const START_JC = 100;
const FAV_KEY = "ippon_favorites";

// Competição-alvo do mercado: a de mercado aberto (mesma regra do resto da app).
// Se a competição da semana já fechou (início - 1h), escala-se para a próxima.
function competicaoAlvo(): string {
  return focoMercado().alvo.idCompeticao;
}
const COMPETICAO = competicaoAlvo();

const STATUS_COLORS: Record<AthleteStatus, [string, string]> = {
  "Elite": ["#3a2f12", "#d9a441"],
  "Em alta": ["#13301f", "#7fd1a3"],
  "Em baixa": ["#3a1f1c", "#ef8d83"],
  "Barganha": ["#12303a", "#7fb8f5"],
  "Aposta": ["#2a1f3a", "#b79be0"],
};

type SortId = "caros" | "baratos" | "valorizados" | "desvalorizados" | "media" | "piores" | "val-esperada" | "min-valorizar";
const SORTS: { id: SortId; label: string; pro?: boolean }[] = [
  { id: "caros", label: "Mais caros" },
  { id: "baratos", label: "Mais baratos" },
  { id: "valorizados", label: "Valorizados" },
  { id: "desvalorizados", label: "Desvalorizados" },
  { id: "media", label: "Maior média" },
  { id: "piores", label: "Piores na última rodada" },
  { id: "val-esperada", label: "Maior valorização esperada", pro: true },
  { id: "min-valorizar", label: "Menos pontos p/ valorizar", pro: true },
];
const sortLabel = (id: SortId) => SORTS.find((s) => s.id === id)?.label || "Ordenar";

const PRICE_MIN = 2;
const PRICE_MAX = 20;

const STEPS = [
  { t: "Saldo JC", x: "Estes são os Judocoins que tens para gastar. Cada atleta tem um preço — geres os teus 100 JC para montar a melhor equipa.", target: "jc" },
  { t: "Valorização", x: "O ▲/▼ ao lado do preço mostra se o atleta está a valorizar ou a desvalorizar. Fica atento a isto: faz toda a diferença no teu património.", target: "price" },
  { t: "Médias e pontuação", x: "A média mostra o nível típico do atleta e a 'última' a pontuação mais recente. Usa-as para descobrir quem pode render mais — e ganhar JC.", target: "scout" },
  { t: "Filtros e favoritos", x: "Lá em cima: a ★ mostra só os teus favoritos, e os botões Ordenar e Filtros (preço, país) ajudam-te a encontrar atletas. A ★ em cada card guarda o atleta como favorito.", target: "filters" },
  { t: "O que significam os estados", target: "legend" },
];

const fmt = (n: number) => String(Math.round(n * 10) / 10);
const code3 = (iso: string) => iso;

type SheetKind = "ord" | "fil" | null;

export default function Mercado() {
  const [pool, setPool] = useState<Athlete[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState("");
  const [aoVivoIds, setAoVivoIds] = useState<Set<string>>(new Set());
  const [aoVivoNome, setAoVivoNome] = useState<string | null>(null);

  const [gender, setGender] = useState<Gender>("M");
  const [cat, setCat] = useState<string>(CATEGORIES.M[0]);
  const [query, setQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [team, setTeam] = useState<string[]>([]);
  const [captain, setCaptain] = useState<string | null>(null);
  const [guide, setGuide] = useState<number | null>(null);

  const [favs, setFavs] = useState<string[]>([]);
  const [favOnly, setFavOnly] = useState(false);
  const [sort, setSort] = useState<SortId>("caros");
  const [priceMin, setPriceMin] = useState(PRICE_MIN);
  const [priceMax, setPriceMax] = useState(PRICE_MAX);
  const [countrySel, setCountrySel] = useState<string[]>([]);
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [pedirLogin, setPedirLogin] = useState(false);
  const [avisoCategoria, setAvisoCategoria] = useState(false);

  useEffect(() => {
    let active = true;
    let draft: { ids: string[]; captain: string | null } = { ids: [], captain: null };
    try {
      draft = loadDraftFor(COMPETICAO);
      setTeam(draft.ids);
      setCaptain(draft.captain);
      const f = localStorage.getItem(FAV_KEY);
      if (f) setFavs(JSON.parse(f));
      // Guia do Mercado: só aparece se ainda não foi visto neste aparelho NEM na conta.
      if (!tutorialVistoLocal("ippon_market_tutorial")) {
        tutoriaisVistosConta().then((vistos) => {
          if (!active) return;
          if (vistos["ippon_market_tutorial"]) {
            try { localStorage.setItem("ippon_market_tutorial", "done"); } catch {}
          } else {
            setGuide(0);
          }
        });
      }
    } catch {}

    fetch(`/api/atletas?id=${COMPETICAO}`)
      .then((r) => r.json())
      .then((j) => {
        if (!active) return;
        const list: Athlete[] = Array.isArray(j?.atletas) ? j.atletas : [];
        setPool(list);
        setAthletePool(list);
        // Quem está a competir agora (vem do cron, via balcão).
        const av = j?.a_competir_agora;
        if (av && Array.isArray(av.ids)) {
          setAoVivoIds(new Set(av.ids as string[]));
          setAoVivoNome(av.nome ?? null);
        }
        setLoading(false);
        if (list.length > 0) {
          const ids = new Set(list.map((a) => a.id));
          const cleanIds = draft.ids.filter((id) => ids.has(id));
          if (cleanIds.length !== draft.ids.length) {
            const cap = draft.captain && cleanIds.includes(draft.captain) ? draft.captain : null;
            setTeam(cleanIds);
            setCaptain(cap);
            saveDraftFor(COMPETICAO, { ids: cleanIds, captain: cap });
          }
        }
      })
      .catch(() => {
        if (!active) return;
        setLoading(false);
        setLoadErr("Não foi possível carregar os atletas. Tenta recarregar a página.");
      });

    return () => { active = false; };
  }, []);

  function persist(next: string[]) {
    const cap = captain && next.includes(captain) ? captain : null;
    setTeam(next);
    setCaptain(cap);
    saveDraftFor(COMPETICAO, { ids: next, captain: cap });
  }
  function toggleFav(id: string) {
    setFavs((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try { localStorage.setItem(FAV_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }
  function finishTutorial() {
    marcarTutorialVisto("ippon_market_tutorial"); // local (este aparelho) + conta (todos)
    setGuide(null);
  }
  function clearFilters() {
    setPriceMin(PRICE_MIN); setPriceMax(PRICE_MAX); setCountrySel([]); setFavOnly(false);
  }

  const byId = new Map(pool.map((a) => [a.id, a]));
  const teamAthletes = team.map((id) => byId.get(id)).filter(Boolean) as Athlete[];
  const jcLeft = Math.round((START_JC - teamAthletes.reduce((s, a) => s + a.priceJc, 0)) * 10) / 10;
  const countM = teamAthletes.filter((a) => a.gender === "M").length;
  const countF = teamAthletes.filter((a) => a.gender === "F").length;
  const takenM = new Set(teamAthletes.filter((a) => a.gender === "M").map((a) => a.category));
  const takenF = new Set(teamAthletes.filter((a) => a.gender === "F").map((a) => a.category));

  const ALL_COUNTRIES = Array.from(new Set(pool.map((a) => a.countryIso))).sort((a, b) => a.localeCompare(b));

  let filtered = pool.filter((a) => {
    if (a.gender !== gender) return false;
    if (a.category !== cat) return false;
    if (query.trim() && !a.name.toLowerCase().includes(query.trim().toLowerCase())) return false;
    if (favOnly && !favs.includes(a.id)) return false;
    if (a.priceJc < priceMin) return false;
    if (priceMax < PRICE_MAX && a.priceJc > priceMax) return false;
    if (countrySel.length > 0 && !countrySel.includes(a.countryIso)) return false;
    return true;
  });
  filtered = [...filtered].sort((a, b) => {
    switch (sort) {
      case "baratos": return a.priceJc - b.priceJc;
      case "valorizados": return b.variation - a.variation;
      case "desvalorizados": return a.variation - b.variation;
      case "media": return b.avg - a.avg;
      case "piores": return a.last - b.last;
      default: return b.priceJc - a.priceJc;
    }
  });

  function buttonState(a: Athlete) {
    const inTeam = team.includes(a.id);
    const genderCount = a.gender === "M" ? countM : countF;
    const taken = a.gender === "M" ? takenM : takenF;
    const full = !inTeam && genderCount >= 4;
    const catTaken = !inTeam && taken.has(a.category);
    const afford = a.priceJc <= jcLeft;
    if (inTeam) return { label: "Vender", kind: "sell" as const };
    if (full) return { label: "Lotado", kind: "blocked" as const };
    if (catTaken) return { label: "Categoria ocupada", kind: "blocked" as const };
    if (!afford) return { label: "Sem JC", kind: "blocked" as const };
    return { label: "Contratar", kind: "buy" as const };
  }
  async function toggle(a: Athlete) {
    if (team.includes(a.id)) { persist(team.filter((id) => id !== a.id)); return; }
    const st = buttonState(a);
    if (st.kind === "buy") {
      if (!(await temSessao())) { setPedirLogin(true); return; }
      persist([...team, a.id]);
      try {
        if (localStorage.getItem("ippon_aviso_categoria") !== "skip") setAvisoCategoria(true);
      } catch {}
      const g = a.gender;
      const newCount = (g === "M" ? countM : countF) + 1;
      if (newCount >= 4) {
        const opp: Gender = g === "M" ? "F" : "M";
        const oppCount = opp === "M" ? countM : countF;
        if (oppCount < 4) { setGender(opp); setCat(CATEGORIES[opp][0]); }
      }
    }
  }

  const filtroCount = (priceMin > PRICE_MIN ? 1 : 0) + (priceMax < PRICE_MAX ? 1 : 0) + countrySel.length;
  const jcGlow = guide === 0;
  const focus = guide === 1 ? "price" : guide === 2 ? "scout" : null;

  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: FB }}>
      <style>{`@keyframes glow{0%,100%{box-shadow:0 0 0 3px rgba(90,169,255,.65)}50%{box-shadow:0 0 0 8px rgba(90,169,255,.18)}} .glow{animation:glow 1.3s ease-in-out infinite;border-radius:10px} .noscroll::-webkit-scrollbar{display:none} @keyframes ilvivo{0%,100%{opacity:1}50%{opacity:.35}} .ilvivo{animation:ilvivo 1.2s ease-in-out infinite}`}</style>

      <div style={{ maxWidth: 460, margin: "0 auto" }}>
        <div style={{ position: "sticky", top: 0, background: "#0c0e0d", borderBottom: "1px solid #1a221d", zIndex: 5, padding: "12px 14px 10px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <a href="/criar-equipa" aria-label="Voltar" style={{ width: 32, height: 32, borderRadius: "50%", border: "1px solid #243029", display: "flex", alignItems: "center", justifyContent: "center", color: "#cfd8d2", textDecoration: "none" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
              </a>
              <span style={{ fontFamily: FD, fontSize: 19, fontWeight: 700, textTransform: "uppercase" }}>Mercado</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={() => setShowSearch((v) => !v)} aria-label="Procurar" style={{ width: 32, height: 32, borderRadius: "50%", border: "1px solid #243029", background: showSearch ? "#1c3a2e" : "transparent", color: showSearch ? "#aee9c9" : "#93a39a", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
              </button>
              <button onClick={() => setGuide(0)} aria-label="Como funciona" style={{ width: 32, height: 32, borderRadius: "50%", border: "1px solid #243029", background: "transparent", color: "#93a39a", fontWeight: 700, cursor: "pointer" }}>?</button>
              <span className={jcGlow ? "glow" : undefined} style={{ background: "#141a17", border: "1px solid #243029", borderRadius: 10, padding: "6px 11px", fontFamily: FD, fontWeight: 700, color: GOLD, fontSize: 15 }}>JC {fmt(jcLeft)}</span>
            </div>
          </div>

          {aoVivoIds.size > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#2a1f1c", border: "1px solid #5a3a36", borderRadius: 10, padding: "7px 11px", marginBottom: 9 }}>
              <span className="ilvivo" style={{ width: 8, height: 8, borderRadius: "50%", background: "#e2655a", flexShrink: 0 }} />
              <span style={{ fontSize: 11.5, color: "#f1ede2", lineHeight: 1.35 }}>
                <strong style={{ color: "#ef8d83" }}>A decorrer agora{aoVivoNome ? `: ${aoVivoNome}` : ""}.</strong> Os atletas marcados estão a competir — o preço pode mudar quando a competição acabar.
              </span>
            </div>
          )}

          {showSearch && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#141a17", border: "1px solid #243029", borderRadius: 10, padding: "8px 11px", marginBottom: 9 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#93a39a" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
              <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Procurar atleta..." style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#f1ede2", fontSize: 14, fontFamily: FB }} />
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginBottom: 9 }}>
            <button onClick={() => { setGender("M"); setCat(CATEGORIES.M[0]); }} style={genderBtn(gender === "M")}>Masculino {countM}/4</button>
            <button onClick={() => { setGender("F"); setCat(CATEGORIES.F[0]); }} style={genderBtn(gender === "F")}>Feminino {countF}/4</button>
          </div>

          <div className="noscroll" style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, marginBottom: 9 }}>
            <button onClick={() => setFavOnly((v) => !v)} aria-label="Só favoritos" style={{ flexShrink: 0, width: 46, height: 42, borderRadius: 11, border: `1.5px solid ${favOnly ? GOLD : "#2a3a33"}`, background: favOnly ? "#3a2f12" : "#121815", color: favOnly ? GOLD : "#5f6f67", fontSize: 18, cursor: "pointer" }}>★</button>
            <button onClick={() => setSheet("ord")} style={fbtn(false)}>
              <SortIcon /> {sortLabel(sort)}
            </button>
            <button onClick={() => setSheet("fil")} style={fbtn(filtroCount > 0)}>
              <SlidersIcon /> Filtros {filtroCount > 0 && <span style={cnt}>{filtroCount}</span>}
            </button>
          </div>

          <div className="noscroll" style={{ display: "flex", gap: 7, overflowX: "auto" }}>
            {CATEGORIES[gender].map((c) => (
              <button key={c} onClick={() => setCat(c)} style={chip(c === cat)}>{c}</button>
            ))}
          </div>
        </div>

        <div style={{ padding: "12px 14px 92px" }}>
          {loading ? (
            <div style={{ textAlign: "center", color: "#93a39a", fontSize: 13, padding: "40px 0" }}>A carregar atletas reais…</div>
          ) : loadErr ? (
            <div style={{ textAlign: "center", color: "#ef8d83", fontSize: 13, padding: "40px 0" }}>{loadErr}</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: "center", color: "#93a39a", fontSize: 13, padding: "30px 0" }}>
              {favOnly ? "Ainda não tens favoritos nesta categoria. Toca na ★ de um atleta." : "Nenhum atleta nesta categoria com estes filtros."}
            </div>
          ) : (
            filtered.map((a, idx) => {
              const st = buttonState(a);
              const inTeam = st.kind === "sell";
              const dim = st.kind === "blocked" && st.label !== "Sem JC";
              const vUp = a.variation >= 0;
              const isFav = favs.includes(a.id);
              const aVivo = aoVivoIds.has(a.id);
              return (
                <div key={a.id} style={{ background: "#121815", border: `1px solid ${aVivo ? "#5a3a36" : inTeam ? "#2f4a3c" : "#243029"}`, borderRadius: 14, padding: 12, marginBottom: 10, opacity: dim ? 0.7 : 1 }}>
                  {aVivo && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                      <span className="ilvivo" style={{ width: 7, height: 7, borderRadius: "50%", background: "#e2655a", flexShrink: 0 }} />
                      <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "#ef8d83" }}>A competir agora · preço pode mudar</span>
                    </div>
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Avatar code={code3(a.countryIso)} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {a.name}{inTeam && <span style={{ color: "#7fd1a3", fontSize: 11 }}> ✓ na equipa</span>}
                      </div>
                      <div style={{ fontSize: 11.5, color: "#93a39a", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden" }}>
                        {code3(a.countryIso)} · {a.category}kg
                      </div>
                    </div>
                    <span style={{ background: STATUS_COLORS[a.status][0], color: STATUS_COLORS[a.status][1], fontSize: 10, fontWeight: 700, padding: "4px 9px", borderRadius: 999, whiteSpace: "nowrap" }}>{a.status}</span>
                    <button onClick={() => toggleFav(a.id)} aria-label={isFav ? "Remover dos favoritos" : "Adicionar aos favoritos"} style={{ background: "transparent", border: "none", cursor: "pointer", color: isFav ? GOLD : "#3c463f", fontSize: 20, lineHeight: 1, padding: 2, flexShrink: 0 }}>★</button>
                  </div>
                  <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: 10 }}>
                    <div>
                      <span className={idx === 0 && focus === "price" ? "glow" : undefined} style={{ display: "inline-block", padding: "2px 4px" }}>
                        <span style={{ fontFamily: FD, fontSize: 20, fontWeight: 700, color: GOLD }}>JC {a.priceJc.toFixed(1)}</span>{" "}
                        <span style={{ fontSize: 12, color: vUp ? "#7fd1a3" : "#ef8d83", fontWeight: 700 }}>{vUp ? "▲" : "▼"} {Math.abs(a.variation)}%</span>
                      </span>
                      <div className={idx === 0 && focus === "scout" ? "glow" : undefined} style={{ fontSize: 11, color: "#7c8a82", marginTop: 2, display: "inline-block", padding: "2px 4px" }}>
                        Média {a.avg.toFixed(1)} · Última {a.last}
                      </div>
                    </div>
                    <button
                      onClick={() => toggle(a)}
                      disabled={st.kind === "blocked"}
                      style={{
                        background: st.kind === "sell" ? "transparent" : st.kind === "buy" ? GOLD : "#23291f",
                        color: st.kind === "sell" ? "#ef8d83" : st.kind === "buy" ? "#1b211e" : "#5f6f67",
                        border: st.kind === "sell" ? "1px solid #5a2f2c" : "none",
                        fontFamily: FD, fontSize: st.label === "Categoria ocupada" ? 10.5 : 13, fontWeight: 700,
                        textTransform: "uppercase", padding: "9px 12px", borderRadius: 10,
                        cursor: st.kind === "blocked" ? "default" : "pointer", whiteSpace: "nowrap",
                      }}
                    >
                      {st.label}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, background: "#0f1411", borderTop: "1px solid #243029", padding: "10px 14px", zIndex: 40 }}>
        <div style={{ maxWidth: 460, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ fontSize: 12, color: "#cfd8d2" }}>
            <span style={{ fontFamily: FD, fontWeight: 700, color: GOLD, fontSize: 16 }}>{countM + countF}</span>
            <span style={{ fontFamily: FD, fontWeight: 700, color: "#93a39a", fontSize: 13 }}>/8</span> atletas
          </div>
          <a href="/criar-equipa" style={{ background: GOLD, color: "#1b211e", fontFamily: FD, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", padding: "10px 18px", borderRadius: 10, fontSize: 14, textDecoration: "none" }}>Voltar ao Dojo</a>
        </div>
      </div>

      {sheet === "ord" && (
        <Sheet title="Ordenar" onClose={() => setSheet(null)}>
          {SORTS.map((o) => {
            const active = sort === o.id;
            return (
              <button key={o.id} onClick={() => { if (o.pro) return; setSort(o.id); setSheet(null); }}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", textAlign: "left", background: active ? "#16201b" : "#121815", border: `1.5px solid ${active ? GOLD : "#2a3a33"}`, borderRadius: 11, padding: "13px 14px", marginBottom: 8, color: o.pro ? "#cfd8d2" : "#f1ede2", fontSize: 14, fontFamily: FB, cursor: o.pro ? "default" : "pointer", opacity: o.pro ? 0.75 : 1 }}>
                <span>{o.label}</span>
                {o.pro && <span style={{ display: "flex", alignItems: "center", gap: 5, color: GOLD, fontSize: 11, fontWeight: 700 }}><LockIcon /> Pro</span>}
              </button>
            );
          })}
          <div style={{ fontSize: 11, color: "#7c8a82", marginTop: 4 }}>🔒 As ordenações avançadas fazem parte do Ippon Pro.</div>
        </Sheet>
      )}

      {sheet === "fil" && (
        <Sheet title="Filtros" onClose={() => setSheet(null)}>
          <div style={sectionTitle}>Preço</div>
          <div style={{ textAlign: "center", fontSize: 13, color: "#cfd8d2", marginBottom: 10 }}>
            JC {priceMin} — JC {priceMax >= PRICE_MAX ? "20+" : priceMax}
          </div>
          <div style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 11, color: "#7c8a82", marginBottom: 2 }}>Mínimo</div>
            <input type="range" min={PRICE_MIN} max={PRICE_MAX} value={priceMin} onChange={(e) => { const v = Number(e.target.value); setPriceMin(Math.min(v, priceMax)); }} style={{ width: "100%", accentColor: GOLD }} />
          </div>
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11, color: "#7c8a82", marginBottom: 2 }}>Máximo</div>
            <input type="range" min={PRICE_MIN} max={PRICE_MAX} value={priceMax} onChange={(e) => { const v = Number(e.target.value); setPriceMax(Math.max(v, priceMin)); }} style={{ width: "100%", accentColor: GOLD }} />
          </div>

          <div style={sectionTitle}>País</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
            {ALL_COUNTRIES.map((iso) => {
              const on = countrySel.includes(iso);
              return (
                <button key={iso} onClick={() => setCountrySel((prev) => prev.includes(iso) ? prev.filter((x) => x !== iso) : [...prev, iso])} style={chip(on)}>{code3(iso)}</button>
              );
            })}
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => { clearFilters(); }} style={{ flex: 1, background: "transparent", border: "1px solid #243029", color: "#cfd8d2", fontFamily: FD, fontWeight: 700, textTransform: "uppercase", padding: 12, borderRadius: 11, cursor: "pointer" }}>Limpar</button>
            <button onClick={() => setSheet(null)} style={{ flex: 1, ...applyBtn, marginTop: 0 }}>Aplicar</button>
          </div>
        </Sheet>
      )}

      {pedirLogin && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(6,8,7,0.82)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18, zIndex: 110 }}>
          <div style={{ width: "100%", maxWidth: 320, background: "#121815", border: `1px solid ${GOLD}`, borderRadius: 16, padding: 22, textAlign: "center" }}>
            <div style={{ width: 84, height: 84, margin: "0 auto 4px" }}><Mascot belt="#141110" expression="indicando" /></div>
            <h2 style={{ fontFamily: FD, fontSize: 20, fontWeight: 700, textTransform: "uppercase", margin: "4px 0 8px" }}>Entra para contratar</h2>
            <p style={{ fontSize: 14, color: "#c7d0c9", lineHeight: 1.5, margin: "0 0 20px" }}>Para contratares atletas e montares a tua equipa, entra na tua conta. É rápido — e ficas já a jogar!</p>
            <button onClick={() => exigirSessao("/mercado")} style={{ width: "100%", padding: 13, borderRadius: 12, border: "none", background: GOLD, color: "#1b211e", fontFamily: FD, fontSize: 15, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", cursor: "pointer" }}>Entrar / Criar conta</button>
            <button onClick={() => setPedirLogin(false)} style={{ marginTop: 10, background: "transparent", border: "none", color: "#93a39a", fontSize: 13, cursor: "pointer", fontFamily: FB }}>Agora não</button>
          </div>
        </div>
      )}

      {avisoCategoria && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(6,8,7,0.82)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18, zIndex: 110 }}>
          <div style={{ width: "100%", maxWidth: 320, background: "#121815", border: `1px solid ${GOLD}`, borderRadius: 16, padding: 22, textAlign: "center" }}>
            <div style={{ width: 84, height: 84, margin: "0 auto 4px" }}><Mascot belt="#141110" expression="sabio" /></div>
            <h2 style={{ fontFamily: FD, fontSize: 20, fontWeight: 700, textTransform: "uppercase", margin: "4px 0 8px" }}>Um por categoria</h2>
            <p style={{ fontSize: 14, color: "#c7d0c9", lineHeight: 1.5, margin: "0 0 20px" }}>Só podes ter <strong style={{ color: GOLD }}>1 atleta por categoria de peso</strong>. Monta 4 masculinos e 4 femininos, cada um de uma categoria diferente.</p>
            <button onClick={() => setAvisoCategoria(false)} style={{ width: "100%", padding: 13, borderRadius: 12, border: "none", background: GOLD, color: "#1b211e", fontFamily: FD, fontSize: 15, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", cursor: "pointer" }}>Entendi</button>
            <button onClick={() => { try { localStorage.setItem("ippon_aviso_categoria", "skip"); } catch {} setAvisoCategoria(false); }} style={{ marginTop: 10, background: "transparent", border: "none", color: "#93a39a", fontSize: 13, cursor: "pointer", fontFamily: FB }}>Não mostrar mais</button>
          </div>
        </div>
      )}

      {guide !== null && <Tutorial step={guide} setStep={setGuide} onClose={finishTutorial} />}
    </main>
  );
}

const cnt: React.CSSProperties = { background: GOLD, color: "#1b211e", borderRadius: 999, fontSize: 11, fontWeight: 700, padding: "1px 7px" };
const sectionTitle: React.CSSProperties = { fontFamily: FD, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#93a39a", marginBottom: 8 };
const applyBtn: React.CSSProperties = { width: "100%", marginTop: 14, background: "#3f8f5a", color: "#06140d", border: "none", fontFamily: FD, fontWeight: 700, textTransform: "uppercase", padding: 13, borderRadius: 11, cursor: "pointer", fontSize: 14 };

function fbtn(active: boolean): React.CSSProperties {
  return { display: "flex", alignItems: "center", gap: 7, flexShrink: 0, whiteSpace: "nowrap", background: active ? "#16201b" : "#121815", border: `1.5px solid ${active ? GOLD : "#2a3a33"}`, color: "#f1ede2", fontFamily: FD, fontWeight: 700, textTransform: "uppercase", fontSize: 13, padding: "0 14px", height: 42, borderRadius: 11, cursor: "pointer" };
}
function genderBtn(on: boolean): React.CSSProperties {
  return { flex: 1, textAlign: "center", fontSize: 12, padding: "7px 11px", borderRadius: 999, cursor: "pointer", fontFamily: FB, fontWeight: 700, border: `1px solid ${on ? "#1c3a2e" : "#243029"}`, background: on ? "#1c3a2e" : "#141a17", color: on ? "#aee9c9" : "#93a39a" };
}
function chip(on: boolean): React.CSSProperties {
  return { whiteSpace: "nowrap", fontSize: 12, padding: "6px 12px", borderRadius: 999, cursor: "pointer", fontFamily: FB, border: `1px solid ${on ? "#1c3a2e" : "#243029"}`, background: on ? "#1c3a2e" : "#141a17", color: on ? "#aee9c9" : "#93a39a" };
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 80 }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(6,8,7,0.6)" }} />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, margin: "0 auto", maxWidth: 460, background: "#10160f", borderTop: "1px solid #243029", borderRadius: "18px 18px 0 0", padding: "16px 16px 22px", maxHeight: "82%", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span style={{ fontFamily: FD, fontSize: 16, fontWeight: 700, textTransform: "uppercase" }}>{title}</span>
          <button onClick={onClose} aria-label="Fechar" style={{ background: "transparent", border: "none", color: "#93a39a", fontSize: 18, cursor: "pointer" }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Avatar({ code }: { code: string }) {
  return (
    <div style={{ width: 40, height: 44, borderRadius: 8, background: "linear-gradient(160deg,#2a4d3e,#1c3a2e)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <div style={{ background: "#f1ede2", color: "#1b211e", fontFamily: FD, fontWeight: 700, fontSize: 10, padding: "1px 4px", borderRadius: 3 }}>{code}</div>
    </div>
  );
}

function SortIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 4v16M7 20l-3-3M7 4l3 3M17 20V4M17 4l3 3M17 20l-3-3" /></svg>;
}
function SlidersIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 8h10M18 8h2M4 16h4M12 16h8" /><circle cx="16" cy="8" r="2.2" /><circle cx="10" cy="16" r="2.2" /></svg>;
}
function LockIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>;
}

function Tutorial({ step, setStep, onClose }: { step: number; setStep: (s: number | null) => void; onClose: () => void }) {
  const s = STEPS[step];
  const total = STEPS.length;
  const isLegend = s.target === "legend";

  const controls = (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
      <button onClick={() => step > 0 && setStep(step - 1)} style={{ background: "transparent", border: "none", color: step === 0 ? "#3c463f" : "#93a39a", fontSize: 13, fontWeight: 700, cursor: step === 0 ? "default" : "pointer", fontFamily: FB }}>Anterior</button>
      <span style={{ fontSize: 11, color: "#5f6f67" }}>{step + 1} de {total}</span>
      <button onClick={() => (step === total - 1 ? onClose() : setStep(step + 1))} style={{ background: GOLD, border: "none", color: "#1b211e", padding: "8px 18px", borderRadius: 9, fontFamily: FD, fontSize: 13, fontWeight: 700, textTransform: "uppercase", cursor: "pointer" }}>{step === total - 1 ? "Começar" : "Seguinte"}</button>
    </div>
  );
  const skip = (
    <div style={{ textAlign: "right", marginBottom: 8 }}>
      <button onClick={onClose} style={{ background: "transparent", border: "none", color: "#cfd8d2", fontSize: 12, cursor: "pointer", fontFamily: FB }}>Pular ✕</button>
    </div>
  );

  if (isLegend) {
    return (
      <div style={{ position: "fixed", inset: 0, background: "rgba(6,8,7,0.82)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18, zIndex: 100 }}>
        <div style={{ width: "100%", maxWidth: 300 }}>
          {skip}
          <div style={{ background: "#121815", border: `1px solid ${GOLD}`, borderRadius: 16, padding: 18 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
              <div style={{ width: 54, height: 54, flexShrink: 0 }}><Mascot belt="#141110" expression="sabio" /></div>
              <div style={{ fontFamily: FD, fontSize: 16, fontWeight: 700, textTransform: "uppercase" }}>{s.t}</div>
            </div>
            {STATUS_LEGEND.map((l) => (
              <div key={l.label} style={{ display: "flex", gap: 9, alignItems: "flex-start", marginBottom: 7 }}>
                <span style={{ background: "rgba(255,255,255,0.05)", color: l.color, fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999, whiteSpace: "nowrap" }}>{l.label}</span>
                <span style={{ fontSize: 12, color: "#c7d0c9" }}>{l.desc}</span>
              </div>
            ))}
            {controls}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "fixed", left: 0, right: 0, bottom: 74, padding: "0 12px", zIndex: 100 }}>
      <div style={{ maxWidth: 436, margin: "0 auto", display: "flex", gap: 10, alignItems: "flex-end" }}>
        <div style={{ width: 58, height: 58, flexShrink: 0 }}><Mascot belt="#141110" expression="indicando" /></div>
        <div style={{ flex: 1, background: "#121815", border: `1px solid ${GOLD}`, borderRadius: 14, padding: "12px 14px" }}>
          {skip}
          <div style={{ fontFamily: FD, fontSize: 14, fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>{s.t}</div>
          <p style={{ fontSize: 12.5, color: "#c7d0c9", lineHeight: 1.45, margin: 0 }}>{s.x}</p>
          {controls}
        </div>
      </div>
    </div>
  );
}
