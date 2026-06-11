"use client";

import { useState, useEffect } from "react";
import { Mascot } from "@/components/Mascot";
import { Escudo, loadIdentity, DEFAULT_IDENTITY, type Identity } from "@/components/Escudo";
import { loadSavedFor, resolve, jcLeft, loadSavedCloudFor, setAthletePool, patrimonio, loadPrecosFor, loadPrecosCloudFor, type TeamState } from "@/lib/team";
import { type Athlete } from "@/lib/athletes";
import { supabase } from "@/lib/supabase";
import { focoMercado } from "@/lib/calendario";

const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";
const BELT = "Branca";
const BELT_HEX = "#efeadd";

// TICK AO VIVO: de quantos em quantos ms a página vai buscar os pontos novos
// enquanto a competição decorre. 15s — numa luta de ~4min, apanha as ações sem
// atraso percetível. Mudar aqui (15000 -> 30000 -> 60000) ajusta tudo.
// Nota: o tick SÓ corre quando há competição a decorrer e a aba está visível.
const TICK_AO_VIVO_MS = 15000;

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

// A competição a decorrer (ou a de mercado aberto) vem de focoMercado em lib/calendario.
// Os pontos por atleta vêm de /api/resultados (reais, do JudoBase). Sem dados de exemplo.


export default function MeuTime() {
  const [team, setTeam] = useState<TeamState>({ ids: [], captain: null });
  const [identity, setIdentity] = useState<Identity>(DEFAULT_IDENTITY);
  const [ready, setReady] = useState(false);
  const [sel, setSel] = useState<Athlete | null>(null);
  const [, bumpPool] = useState(0); // força um re-render quando a lista de atletas carrega
  const [pontos, setPontos] = useState<Record<string, number>>({}); // id_person -> pontos reais
  const [temResultados, setTemResultados] = useState(false);
  const [precos, setPrecos] = useState<Record<string, number>>({}); // id_person -> preço de compra
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<number | null>(null); // hora do último tick

  // Qual a competição a mostrar:
  // - a que está a decorrer (mercado fechado), se o jogador tiver equipa nela → modo competição (trancado);
  // - senão, a competição de mercado aberto (alvo), onde pode editar.
  const foco = focoMercado();
  const atual = foco.atual;
  const emAndamento = foco.aDecorrer !== null; // mercado da competição da semana já fechou
  const alvo = foco.alvo;            // mercado aberto
  const aDecorrer = foco.aDecorrer;  // mercado fechado, em competição
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

  // Pontos reais da competição que estamos a ver (atualiza quando idComp muda).
  // TICK AO VIVO: além de buscar uma vez, repete a cada TICK_AO_VIVO_MS ENQUANTO
  // a competição estiver a decorrer (emAndamento) e a aba estiver visível.
  useEffect(() => {
    let active = true;
    if (!idComp) return;

    // Preços de compra: local primeiro (instantâneo), depois a nuvem (oficial).
    setPrecos(loadPrecosFor(idComp));
    loadPrecosCloudFor(idComp).then((c) => {
      if (active && c && Object.keys(c).length > 0) setPrecos(c);
    });

    // Busca os pontos uma vez. Reutilizada pelo tick.
    const buscarPontos = () => {
      fetch(`/api/resultados?comp=${idComp}`)
        .then((r) => r.json())
        .then((j) => {
          if (!active) return;
          setPontos(j && j.pontos ? j.pontos : {});
          setTemResultados(!!(j && j.tem_resultados));
          setUltimaAtualizacao(Date.now());
        })
        .catch(() => {});
    };

    buscarPontos(); // primeira carga, imediata

    // Só liga o tick se a competição que estamos a ver está MESMO a decorrer.
    // (Mercado aberto ou prova terminada não têm pontos novos a chegar.)
    const aDecorrerAgora = emAndamento && idComp === atual.idCompeticao;
    if (!aDecorrerAgora) {
      return () => { active = false; };
    }

    let timer: ReturnType<typeof setInterval> | null = null;
    const arranca = () => {
      if (timer) return;
      timer = setInterval(() => {
        // Não desperdiça chamadas se a aba estiver escondida.
        if (typeof document !== "undefined" && document.hidden) return;
        buscarPontos();
      }, TICK_AO_VIVO_MS);
    };
    const para = () => {
      if (timer) { clearInterval(timer); timer = null; }
    };

    arranca();

    // Quando a aba volta a ficar visível, busca já (sem esperar o próximo tick).
    const aoMudarVisibilidade = () => {
      if (typeof document !== "undefined" && !document.hidden) buscarPontos();
    };
    document.addEventListener("visibilitychange", aoMudarVisibilidade);

    return () => {
      active = false;
      para();
      document.removeEventListener("visibilitychange", aoMudarVisibilidade);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idComp]);

  if (!ready) return <main style={{ minHeight: "100vh", background: "#0c0e0d" }} />;

  const athletes = resolve(team.ids);
  const temEquipa = team.ids.length > 0;                       // há ids guardados?
  const aCarregarAtletas = temEquipa && athletes.length === 0;  // tem ids, mas a lista ainda não resolveu
  const hasTeam = athletes.length > 0;
  const males = athletes.filter((a) => a.gender === "M");
  const females = athletes.filter((a) => a.gender === "F");
  const squadValue = fmt(athletes.reduce((s, a) => s + a.priceJc, 0));
  const left = jcLeft(team);
  const patr = patrimonio(team, precos); // 100 + Σ(preço de agora − preço de compra)
  // Pontos reais: o id do atleta é o id_person do JudoBase, igual à chave do mapa /api/resultados.
  const scoreOf = (a: Athlete) => {
    const base = pontos[a.id] ?? 0;
    return a.id === team.captain ? base * 2 : base;
  };
  const totalPts = Math.round(athletes.reduce((s, a) => s + scoreOf(a), 0) * 10) / 10;
  // Estamos a mostrar a equipa da competição a decorrer?
  const emCompeticao = emAndamento && idComp === atual.idCompeticao && hasTeam;
  // Fase calculada (não fixa): se a competição que estamos a ver está a decorrer →
  // "ao-vivo" (mostra pontos e estado da chave). Senão, mercado aberto → "aberto" (mostra preços).
  const marketPhase: MarketPhase = emCompeticao ? "ao-vivo" : "aberto";

  // Texto curto da hora da última atualização (só no modo ao-vivo).
  const horaTick = ultimaAtualizacao
    ? new Date(ultimaAtualizacao).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : null;

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
                <Stat label="Património" value={`JC ${fmt(patr)}`} />
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
                {horaTick && (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 6, fontSize: 11, color: "#7fd1a3" }}>
                    <span className="ilp" style={{ width: 7, height: 7, borderRadius: "50%", background: "#7fd1a3" }} />
                    Ao vivo · atualizado às {horaTick}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                <a href="/criar-equipa" style={{ flex: 1, textAlign: "center", background: "transparent", border: "1px solid #243029", color: "#cfd8d2", fontFamily: FD, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", padding: 12, borderRadius: 11, fontSize: 13, textDecoration: "none" }}>Editar equipa</a>
                <a href="/mercado" style={{ flex: 1, textAlign: "center", background: GOLD, color: "#1b211e", fontFamily: FD, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", padding: 12, borderRadius: 11, fontSize: 13, textDecoration: "none" }}>Ver mercado</a>
              </div>
            )}

            <p style={{ fontSize: 11, color: "#5f6f67", textAlign: "center", marginTop: 14 }}>
              Toca num atleta para veres as ações e a valorização.{emCompeticao ? " Os pontos atualizam-se sozinhos durante a rodada." : " A pontuação ao vivo liga-se na próxima competição."}
            </p>
          </>
        )}
      </div>

      {sel && <AthleteDetail a={sel} captain={sel.id === team.captain} score={scoreOf(sel)} temResultados={temResultados} onClose={() => setSel(null)} />}
    </main>
  );
}

function AthleteDetail({ a, captain, score, temResultados, onClose }: { a: Athlete; captain: boolean; score: number; temResultados: boolean; onClose: () => void }) {
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

        {temResultados ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#16201b", border: `1px solid ${GOLD}`, borderRadius: 12, padding: "12px 14px" }}>
            <div>
              <div style={{ fontFamily: FD, fontSize: 13, fontWeight: 700, textTransform: "uppercase" }}>Pontos na rodada</div>
              {captain && <div style={{ fontSize: 11, color: "#FF8F00", marginTop: 2 }}>Capitão — pontuação a dobrar</div>}
            </div>
            <div style={{ fontFamily: FD, fontSize: 26, fontWeight: 700, color: GOLD }}>{score >= 0 ? "+" : ""}{score} pts</div>
          </div>
        ) : (
          <div style={{ background: "#141a17", border: "1px solid #243029", borderRadius: 12, padding: "14px", textAlign: "center", fontSize: 12.5, color: "#93a39a" }}>
            A competição ainda não começou. Os pontos deste atleta aparecem aqui durante a rodada.
          </div>
        )}

        <p style={{ fontSize: 11, color: "#5f6f67", textAlign: "center", marginTop: 12 }}>O detalhe luta a luta liga-se em breve.</p>
      </div>
    </div>
  );
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
    </button>
  );
}
