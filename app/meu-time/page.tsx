"use client";

import { useState, useEffect } from "react";
import { Mascot } from "@/components/Mascot";
import { Escudo, loadIdentity, DEFAULT_IDENTITY, type Identity } from "@/components/Escudo";
import { loadSavedFor, resolve, jcLeft, loadSavedCloudFor, setAthletePool, type TeamState } from "@/lib/team";
import { type Athlete } from "@/lib/athletes";
import { scoreAthlete, POINTS, type ActionType } from "@/lib/engine";
import { supabase } from "@/lib/supabase";
import { competicaoDaSemana, proximaDepoisDe, type SemanaCalendario } from "@/lib/calendario";

const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";
const BELT = "Branca";
const BELT_HEX = "#efeadd";

// Fase do mercado/competição. Já NÃO é fixa: é calculada a partir do calendário.
// "aberto" = a montar (mostra preço) · "fechado" = à espera (mostra — — —) · "ao-vivo" = a competir (mostra pontuação)
type MarketPhase = "aberto" | "fechado" | "ao-vivo";

const IOC: Record<string, string> = {
  JP: "JPN", FR: "FRA", BR: "BRA", GE: "GEO", KZ: "KAZ", AZ: "AZE", BE: "BEL",
  TR: "TUR", UZ: "UZB", RU: "AIN", DE: "GER", XK: "KOS", IT: "ITA", CA: "CAN",
  SI: "SLO", HR: "CRO", NL: "NED",
};
const code3 = (iso: string) => IOC[iso] || iso;
const fmt = (n: number) => String(Math.round(n * 10) / 10);

// A competição a decorrer (ou a próxima). Dias até começar (a partir de hoje).
function diasAte(c: SemanaCalendario, hoje: Date): number {
  const ini = new Date(c.de.replace(/\//g, "-") + "T00:00:00");
  return Math.max(0, Math.ceil((ini.getTime() - hoje.getTime()) / 86400000));
}

const ACTION_LABEL: Record<ActionType, string> = {
  ippon_feito: "Ippon",
  waza_ari_feito: "Waza-ari",
  yuko_feito: "Yuko",
  shido_provocado: "Shido provocado",
  ippon_sofrido: "Ippon sofrido",
  waza_ari_sofrido: "Waza-ari sofrido",
  yuko_sofrido: "Yuko sofrido",
  shido_recebido: "Shido recebido",
  hansoku_make_recebido: "Hansoku-make",
};

// Ações de exemplo (estáveis por atleta) — ligam aos dados reais da rodada no passo C.
function sampleActions(a: Athlete): ActionType[] {
  let h = 0;
  for (let i = 0; i < a.id.length; i++) h = (h * 31 + a.id.charCodeAt(i)) >>> 0;
  const acts: ActionType[] = [];
  if (a.last >= 8) acts.push("ippon_feito");
  if (a.last >= 14) acts.push("waza_ari_feito");
  if (a.last >= 18) acts.push("waza_ari_feito");
  if (h % 2 === 0) acts.push("shido_provocado");
  if (h % 5 === 0) acts.push("shido_recebido");
  if (acts.length === 0) acts.push("yuko_feito");
  return acts;
}

// ---- Estado na competição (esqueleto da chave) — liga aos dados reais no passo C ----
type Stage = "32" | "16" | "8" | "semi" | "final" | "repescagem" | "bronze";
const STAGE_LABEL: Record<Stage, string> = {
  "32": "32-avos", "16": "Oitavas", "8": "Quartas", semi: "Meias", final: "Final", repescagem: "Repescagem", bronze: "Bronze",
};
type Opp = { iso: string; name: string };
type RoundState =
  | { kind: "proxima"; stage: Stage; opp: Opp }
  | { kind: "a-lutar"; stage: Stage; opp: Opp }
  | { kind: "repescagem"; opp: Opp }
  | { kind: "eliminado"; stage: Stage }
  | { kind: "bronze"; opp: Opp }
  | { kind: "resultado"; place: number };

const OPP_POOL: Opp[] = [
  { iso: "JP", name: "Maruyama" }, { iso: "FR", name: "Pereira" }, { iso: "GE", name: "Liparteliani" },
  { iso: "BR", name: "Silva" }, { iso: "KZ", name: "Smetov" }, { iso: "IT", name: "Lombardo" },
  { iso: "UZ", name: "Yusupov" }, { iso: "DE", name: "Wandtke" },
];

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}
// Estado de exemplo, estável por atleta (mostra as várias situações da chave).
function sampleRoundState(a: Athlete): RoundState {
  const h = hashId(a.id);
  const opp = OPP_POOL[h % OPP_POOL.length];
  switch (h % 7) {
    case 0: return { kind: "resultado", place: 1 };
    case 1: return { kind: "proxima", stage: "8", opp };
    case 2: return { kind: "a-lutar", stage: "semi", opp };
    case 3: return { kind: "eliminado", stage: "16" };
    case 4: return { kind: "repescagem", opp };
    case 5: return { kind: "bronze", opp };
    default: return { kind: "resultado", place: h % 2 === 0 ? 5 : 3 };
  }
}

function placeMeta(place: number): { label: string; color: string } {
  if (place === 1) return { label: "Ouro", color: "#d9a441" };
  if (place === 2) return { label: "Prata", color: "#cfd8d2" };
  if (place === 3) return { label: "Bronze", color: "#c08457" };
  return { label: `${place}º lugar`, color: "#93a39a" };
}

export default function MeuTime() {
  const [team, setTeam] = useState<TeamState>({ ids: [], captain: null });
  const [identity, setIdentity] = useState<Identity>(DEFAULT_IDENTITY);
  const [ready, setReady] = useState(false);
  const [sel, setSel] = useState<Athlete | null>(null);
  const [, bumpPool] = useState(0); // força um re-render quando a lista de atletas carrega

  // Qual a competição a mostrar:
  // - a que está a decorrer (mercado fechado), se o jogador tiver equipa nela → modo competição (trancado);
  // - senão, a competição de mercado aberto (alvo), onde pode editar.
  const hoje = new Date();
  const atual = competicaoDaSemana(hoje);
  const emAndamento = diasAte(atual, hoje) <= 0;
  const proxima = proximaDepoisDe(atual);
  const alvo = emAndamento ? proxima : atual;      // mercado aberto
  const aDecorrer = emAndamento ? atual : null;    // mercado fechado, em competição
  // idComp definido depois de sabermos onde há equipa (no useEffect). Começa pela alvo.
  const [idComp, setIdComp] = useState<string>(alvo.idCompeticao);

  useEffect(() => {
    let active = true;
    // Cache local primeiro (instantâneo): equipa a decorrer (se existir), senão a da alvo.
    try {
      setIdentity(loadIdentity());
      const localDecorrer = aDecorrer ? loadSavedFor(aDecorrer.idCompeticao) : { ids: [], captain: null };
      if (localDecorrer.ids.length > 0 && aDecorrer) {
        setTeam(localDecorrer);
        setIdComp(aDecorrer.idCompeticao);
      } else {
        setTeam(loadSavedFor(alvo.idCompeticao));
        setIdComp(alvo.idCompeticao);
      }
    } catch {}
    // Carrega a lista de atletas das competições relevantes (mesma fonte do Mercado).
    // Sem isto, o resolve() não traduz os ids e a página diz "ainda não tens equipa".
    const compsPool = aDecorrer ? [aDecorrer.idCompeticao, alvo.idCompeticao] : [alvo.idCompeticao];
    Promise.all(
      compsPool.map((id) => fetch(`/api/atletas?id=${id}`).then((r) => r.json()).catch(() => null))
    ).then((resultados) => {
      if (!active) return;
      const merged = new Map<string, Athlete>();
      for (const j of resultados) {
        const list: Athlete[] = Array.isArray(j?.atletas) ? j.atletas : [];
        for (const a of list) merged.set(a.id, a);
      }
      if (merged.size > 0) { setAthletePool(Array.from(merged.values())); bumpPool((t) => t + 1); }
    });
    // Proteção de rota + equipa da nuvem (a oficial).
    supabase.auth.getSession().then(({ data }: { data: { session: unknown } }) => {
      if (!active) return;
      if (!data.session) {
        window.location.href = "/entrar";
        return;
      }
      setReady(true);
      // Regra: se há competição a decorrer e tenho equipa nela, é essa (trancada). Senão, a de mercado aberto.
      (async () => {
        const naDecorrer = aDecorrer ? await loadSavedCloudFor(aDecorrer.idCompeticao) : null;
        if (!active) return;
        if (naDecorrer && naDecorrer.ids.length > 0 && aDecorrer) {
          setTeam(naDecorrer);
          setIdComp(aDecorrer.idCompeticao);
          return;
        }
        const naAlvo = await loadSavedCloudFor(alvo.idCompeticao);
        if (!active || !naAlvo) return;
        setTeam(naAlvo);
        setIdComp(alvo.idCompeticao);
      })();
    });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!ready) return <main style={{ minHeight: "100vh", background: "#0c0e0d" }} />;

  const athletes = resolve(team.ids);
  const temEquipa = team.ids.length > 0;                       // há ids guardados?
  const aCarregarAtletas = temEquipa && athletes.length === 0;  // tem ids, mas a lista ainda não resolveu
  const hasTeam = athletes.length > 0;
  const males = athletes.filter((a) => a.gender === "M");
  const females = athletes.filter((a) => a.gender === "F");
  const squadValue = fmt(athletes.reduce((s, a) => s + a.priceJc, 0));
  const left = jcLeft(team);
  const scoreOf = (a: Athlete) => scoreAthlete(sampleActions(a), a.id === team.captain);
  const totalPts = athletes.reduce((s, a) => s + scoreOf(a), 0);
  // Estamos a mostrar a equipa da competição a decorrer?
  const emCompeticao = emAndamento && idComp === atual.idCompeticao && hasTeam;
  // Fase calculada (não fixa): se a competição que estamos a ver está a decorrer →
  // "ao-vivo" (mostra pontos e estado da chave). Senão, mercado aberto → "aberto" (mostra preços).
  const marketPhase: MarketPhase = emCompeticao ? "ao-vivo" : "aberto";

  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: FB }}>
      <style>{`@keyframes ilp{0%,100%{opacity:1}50%{opacity:.25}} .ilp{animation:ilp 1.1s ease-in-out infinite}`}</style>
      <div style={{ maxWidth: 460, margin: "0 auto", padding: "14px 14px 40px" }}>
        <header style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 16 }}>
          <a href="/inicio" aria-label="Voltar" style={{ width: 34, height: 34, borderRadius: "50%", border: "1px solid #243029", display: "flex", alignItems: "center", justifyContent: "center", color: "#cfd8d2", textDecoration: "none", flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
          </a>
          <h1 style={{ fontFamily: FD, fontSize: 19, fontWeight: 700, textTransform: "uppercase", margin: 0 }}>Meu Time</h1>
        </header>

        {!temEquipa ? (
          <div style={{ textAlign: "center", padding: "26px 16px", background: "#121815", border: "1px solid #243029", borderRadius: 16 }}>
            <div style={{ width: 96, height: 96, margin: "0 auto 6px" }}><Mascot belt={BELT_HEX} expression="feliz" /></div>
            <h2 style={{ fontFamily: FD, fontSize: 20, fontWeight: 700, textTransform: "uppercase", margin: "4px 0 8px" }}>Ainda não tens equipa</h2>
            <p style={{ fontSize: 14, color: "#c7d0c9", lineHeight: 1.5, margin: "0 0 18px" }}>Monta 8 atletas com 100 Judocoins, escolhe o teu capitão e vê-os aqui prontos a competir.</p>
            <a href="/criar-equipa" style={{ display: "inline-block", background: GOLD, color: "#1b211e", fontFamily: FD, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", padding: "13px 22px", borderRadius: 12, fontSize: 15, textDecoration: "none" }}>Montar a minha equipa</a>
          </div>
        ) : aCarregarAtletas ? (
          <div style={{ textAlign: "center", padding: "30px 16px", background: "#121815", border: "1px solid #243029", borderRadius: 16 }}>
            <div style={{ width: 80, height: 80, margin: "0 auto 8px" }}><Mascot belt={BELT_HEX} expression="feliz" /></div>
            <div style={{ fontFamily: FD, fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#93a39a" }}>A carregar a tua equipa…</div>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
                <div style={{ flexShrink: 0 }}><Escudo config={identity} size={40} /></div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: FD, fontSize: 18, fontWeight: 700, textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{identity.name}</div>
                  <div style={{ fontSize: 12, color: GOLD }}>Faixa {BELT}</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Stat label="Património" value={`JC 100`} />
                <Stat label="Saldo" value={`JC ${fmt(left)}`} />
              </div>
            </div>

            <section style={{ background: "#2f6fb3", border: "2px solid #25588f", borderRadius: 16, padding: 10 }}>
              <div style={{ background: "#e6b422", border: "2px solid #f0cf6a", borderRadius: 10, padding: "12px 10px" }}>
                <SectionLabel>Masculino</SectionLabel>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 14 }}>
                  {males.map((a) => <Cell key={a.id} a={a} captain={a.id === team.captain} score={scoreOf(a)} phase={marketPhase} onClick={() => setSel(a)} />)}
                </div>
                <SectionLabel>Feminino</SectionLabel>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
                  {females.map((a) => <Cell key={a.id} a={a} captain={a.id === team.captain} score={scoreOf(a)} phase={marketPhase} onClick={() => setSel(a)} />)}
                </div>
              </div>
            </section>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, padding: "12px 14px", background: "#141a17", border: "1px solid #243029", borderRadius: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 60, height: 60, flexShrink: 0 }}><Mascot belt={BELT_HEX} expression={emCompeticao ? "determinado" : "feliz"} /></div>
                <div>
                  <div style={{ fontSize: 12, color: "#93a39a" }}>
                    {emCompeticao ? "A rodada está a decorrer!" : "Mercado aberto"}
                  </div>
                  <div style={{ fontSize: 12, color: "#7fd1a3", fontWeight: 700, marginTop: 2 }}>
                    {`Valor da equipa: JC ${squadValue}`}
                  </div>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: FD, fontSize: 26, fontWeight: 700, color: GOLD }}>
                  {emCompeticao ? totalPts : `JC ${squadValue}`}
                </div>
                <div style={{ fontSize: 10, color: "#93a39a", textTransform: "uppercase" }}>{emCompeticao ? "pts" : "valor"}</div>
              </div>
            </div>

            {/* Durante a competição a decorrer (equipa trancada): só ver/partilhar, sem editar nem mercado.
                Fora disso (mercado aberto): pode editar e ir ao mercado. */}
            {emCompeticao ? (
              <div style={{ marginTop: 12, padding: "11px 14px", background: "#16201b", border: "1px solid #2a4d3e", borderRadius: 12, fontSize: 12.5, color: "#aee9c9", textAlign: "center" }}>
                A tua equipa está em competição. Podes acompanhar os pontos aqui — o mercado abre de novo para a próxima rodada.
              </div>
            ) : (
              <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                <a href="/criar-equipa" style={{ flex: 1, textAlign: "center", background: "transparent", border: "1px solid #243029", color: "#cfd8d2", fontFamily: FD, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", padding: 12, borderRadius: 11, fontSize: 13, textDecoration: "none" }}>Editar equipa</a>
                <a href="/mercado" style={{ flex: 1, textAlign: "center", background: GOLD, color: "#1b211e", fontFamily: FD, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", padding: 12, borderRadius: 11, fontSize: 13, textDecoration: "none" }}>Ver mercado</a>
              </div>
            )}

            <p style={{ fontSize: 11, color: "#5f6f67", textAlign: "center", marginTop: 14 }}>
              Toca num atleta para veres as ações e a valorização. A pontuação ao vivo liga-se em breve.
            </p>
          </>
        )}
      </div>

      {sel && <AthleteDetail a={sel} captain={sel.id === team.captain} onClose={() => setSel(null)} />}
    </main>
  );
}

function AthleteDetail({ a, captain, onClose }: { a: Athlete; captain: boolean; onClose: () => void }) {
  const acts = sampleActions(a);
  const total = scoreAthlete(acts, captain);
  const up = a.variation >= 0;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(6,8,7,0.78)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 100 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 460, background: "#10160f", borderTop: `2px solid ${captain ? "#FF8F00" : "#243029"}`, borderRadius: "18px 18px 0 0", padding: "16px 16px 24px", maxHeight: "86%", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <div style={{ width: 46, height: 50, borderRadius: 8, background: "linear-gradient(160deg,#2a4d3e,#1c3a2e)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <div style={{ background: "#f1ede2", color: "#1b211e", fontFamily: FD, fontWeight: 700, fontSize: 10, padding: "1px 4px", borderRadius: 3 }}>{code3(a.countryIso)}</div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", gap: 7 }}>
              {a.name}{captain && <span style={{ background: "#FF8F00", color: "#1b1208", fontFamily: FD, fontWeight: 700, fontSize: 10, padding: "1px 6px", borderRadius: 5 }}>CAP</span>}
            </div>
            <div style={{ fontSize: 12, color: "#93a39a" }}>{code3(a.countryIso)} · {a.category}kg</div>
          </div>
          <button onClick={onClose} aria-label="Fechar" style={{ background: "transparent", border: "none", color: "#93a39a", fontSize: 20, cursor: "pointer" }}>✕</button>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <div style={{ flex: 1, background: "#141a17", border: "1px solid #243029", borderRadius: 12, padding: "10px 12px" }}>
            <div style={{ fontSize: 10, color: "#93a39a", textTransform: "uppercase" }}>Preço</div>
            <div style={{ fontFamily: FD, fontSize: 17, fontWeight: 700, color: GOLD }}>JC {a.priceJc.toFixed(1)}</div>
          </div>
          <div style={{ flex: 1, background: "#141a17", border: "1px solid #243029", borderRadius: 12, padding: "10px 12px" }}>
            <div style={{ fontSize: 10, color: "#93a39a", textTransform: "uppercase" }}>Valorização</div>
            <div style={{ fontFamily: FD, fontSize: 17, fontWeight: 700, color: up ? "#7fd1a3" : "#ef8d83" }}>{up ? "▲" : "▼"} {Math.abs(a.variation)}%</div>
          </div>
        </div>

        <div style={{ fontFamily: FD, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#93a39a", marginBottom: 8 }}>Na competição</div>
        <CompetitionBlock a={a} />

        <div style={{ fontFamily: FD, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#93a39a", margin: "16px 0 8px" }}>Ações na rodada</div>
        <div style={{ background: "#141a17", border: "1px solid #243029", borderRadius: 12, overflow: "hidden", marginBottom: 12 }}>
          {acts.map((act, i) => {
            const pts = POINTS[act];
            const pos = pts >= 0;
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 13px", borderTop: i === 0 ? "none" : "1px solid #1a221d" }}>
                <span style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: pos ? "#7fd1a3" : "#ef8d83" }} />
                  {ACTION_LABEL[act]}
                </span>
                <span style={{ fontFamily: FD, fontWeight: 700, fontSize: 14, color: pos ? "#7fd1a3" : "#ef8d83" }}>{pos ? "+" : ""}{pts}</span>
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#16201b", border: `1px solid ${GOLD}`, borderRadius: 12, padding: "12px 14px" }}>
          <div>
            <div style={{ fontFamily: FD, fontSize: 13, fontWeight: 700, textTransform: "uppercase" }}>Total na rodada</div>
            {captain && <div style={{ fontSize: 11, color: "#FF8F00", marginTop: 2 }}>Capitão — pontuação a dobrar</div>}
          </div>
          <div style={{ fontFamily: FD, fontSize: 26, fontWeight: 700, color: GOLD }}>{total >= 0 ? "+" : ""}{total} pts</div>
        </div>

        <p style={{ fontSize: 11, color: "#5f6f67", textAlign: "center", marginTop: 12 }}>Exemplo — liga-se às ações reais da competição em breve.</p>
      </div>
    </div>
  );
}

function CompetitionBlock({ a }: { a: Athlete }) {
  const st = sampleRoundState(a);
  const box: React.CSSProperties = { background: "#141a17", border: "1px solid #243029", borderRadius: 12, padding: "12px 14px", marginBottom: 4 };
  const oppRow = (opp: Opp, label: string, color: string) => (
    <div style={box}>
      <div style={{ fontSize: 12, color, fontWeight: 700, marginBottom: 8 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 34, height: 38, borderRadius: 7, background: "linear-gradient(160deg,#3a2422,#2a1a18)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <div style={{ background: "#f1ede2", color: "#1b211e", fontFamily: FD, fontWeight: 700, fontSize: 9, padding: "1px 3px", borderRadius: 2 }}>{code3(opp.iso)}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "#93a39a" }}>Próximo adversário</div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{opp.name} <span style={{ color: "#93a39a", fontWeight: 400, fontSize: 12 }}>({code3(opp.iso)})</span></div>
        </div>
      </div>
    </div>
  );

  if (st.kind === "resultado") {
    const m = placeMeta(st.place);
    return (
      <div style={{ ...box, display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: "50%", background: m.color, color: "#1b211e", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FD, fontWeight: 700, fontSize: 15, flexShrink: 0 }}>{st.place}º</div>
        <div>
          <div style={{ fontSize: 12, color: "#93a39a" }}>Resultado final</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: m.color }}>{m.label}</div>
        </div>
      </div>
    );
  }
  if (st.kind === "eliminado") {
    return <div style={box}><div style={{ fontSize: 14, fontWeight: 700, color: "#ef8d83" }}>Eliminado nas {STAGE_LABEL[st.stage]}</div><div style={{ fontSize: 12, color: "#93a39a", marginTop: 3 }}>Fim de percurso nesta competição.</div></div>;
  }
  if (st.kind === "a-lutar") return oppRow(st.opp, `A lutar agora · ${STAGE_LABEL[st.stage]}`, "#7fd1a3");
  if (st.kind === "repescagem") return oppRow(st.opp, "Repescagem", "#e6c84f");
  if (st.kind === "bronze") return oppRow(st.opp, "Disputa do bronze", "#c08457");
  return oppRow(st.opp, `Próxima luta · ${STAGE_LABEL[st.stage]}`, "#cfd8d2");
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "#141a17", border: "1px solid #243029", borderRadius: 12, padding: "8px 12px", textAlign: "right" }}>
      <div style={{ fontSize: 10, color: "#93a39a", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: GOLD }}>{value}</div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
      <span style={{ fontFamily: FD, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#5a4a12" }}>{children}</span>
      <span style={{ flex: 1, height: 1, background: "rgba(90,74,18,0.35)" }} />
    </div>
  );
}

function Cell({ a, captain, score, phase, onClick }: { a: Athlete; captain: boolean; score: number; phase: MarketPhase; onClick: () => void }) {
  const surname = a.name.split(" ").slice(-1)[0];
  let value: React.ReactNode;
  if (phase === "aberto") {
    value = <span style={{ fontFamily: FD, fontSize: 11, fontWeight: 700, color: "#f2c84b" }}>JC {a.priceJc.toFixed(1)}</span>;
  } else if (phase === "fechado") {
    value = <span style={{ fontFamily: FD, fontSize: 13, fontWeight: 700, color: "#7c8a82", letterSpacing: "0.16em", whiteSpace: "nowrap" }}>— —</span>;
  } else {
    value = <span style={{ background: "#1d3a2b", color: "#9be3bd", fontFamily: FD, fontWeight: 700, fontSize: 11, padding: "2px 9px", borderRadius: 999 }}>{score >= 0 ? "+" : ""}{score} pts</span>;
  }
  return (
    <button onClick={onClick} style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "8px 3px", borderRadius: 12, border: `1.5px solid ${captain ? "#FF8F00" : "#2f4a3c"}`, background: "rgba(12,14,13,0.80)", cursor: "pointer", fontFamily: FB }}>
      {captain && <div style={{ position: "absolute", top: -8, right: -5, background: "#FF8F00", border: "1px solid #c2410c", color: "#1b1208", fontFamily: FD, fontWeight: 700, fontSize: 11, padding: "1px 6px", borderRadius: 5, lineHeight: 1.3 }}>C</div>}
      <div style={{ width: 30, height: 34, borderRadius: 6, background: "linear-gradient(160deg,#2a4d3e,#1c3a2e)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ background: "#f1ede2", color: "#1b211e", fontFamily: FD, fontWeight: 700, fontSize: 8, padding: "1px 3px", borderRadius: 2 }}>{code3(a.countryIso)}</div>
      </div>
      <div style={{ fontSize: 10, fontWeight: 700, width: "100%", textAlign: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "#fff" }}>{surname}</div>
      <div style={{ fontSize: 9, color: "#b6c0b9" }}>{a.category}kg</div>
      <div style={{ marginTop: 1, minHeight: 18, display: "flex", alignItems: "center" }}>{value}</div>
      {phase === "ao-vivo" && <CardStatusLine state={sampleRoundState(a)} />}
    </button>
  );
}

function CardStatusLine({ state }: { state: RoundState }) {
  const wrap: React.CSSProperties = { fontSize: 8.5, width: "100%", textAlign: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 1, lineHeight: 1.2 };
  if (state.kind === "resultado") {
    const m = placeMeta(state.place);
    return <div style={{ ...wrap, color: m.color, fontWeight: 700 }}>{state.place <= 3 ? "● " : ""}{m.label}</div>;
  }
  if (state.kind === "eliminado") return <div style={{ ...wrap, color: "#ef8d83" }}>Eliminado · {STAGE_LABEL[state.stage]}</div>;
  if (state.kind === "a-lutar") return <div style={{ ...wrap, color: "#7fd1a3", fontWeight: 700 }}><span className="ilp">●</span> A lutar · {STAGE_LABEL[state.stage]}</div>;
  if (state.kind === "repescagem") return <div style={{ ...wrap, color: "#e6c84f" }}>Repescagem · vs {code3(state.opp.iso)}</div>;
  if (state.kind === "bronze") return <div style={{ ...wrap, color: "#c08457", fontWeight: 700 }}>Bronze · vs {code3(state.opp.iso)}</div>;
  return <div style={{ ...wrap, color: "#93a39a" }}>{STAGE_LABEL[state.stage]} · vs {code3(state.opp.iso)}</div>;
}
