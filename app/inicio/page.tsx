"use client";

import { useState, useEffect, useRef } from "react";
import { Mascot } from "@/components/Mascot";
import { loadSavedFor, resolve, loadSavedCloudFor, setAthletePool, uid, type TeamState } from "@/lib/team";
import { loadIdentity } from "@/components/Escudo";
import { Desempenho } from "@/components/Desempenho";
import { desempenhosVistosConta, marcarDesempenhoVisto, construirDesempenho, buscarResultados, buscarResultadosCongelados, buscarResumoExtra, mensagemDesempenho, type DesempenhoRodada, type ResumoExtra } from "@/lib/desempenho";
import { supabase } from "@/lib/supabase";
import { focoMercado, textoFecho } from "@/lib/calendario";
import { tutoriaisVistosConta, marcarTutorialVisto } from "@/lib/tutorials";
import { PRECO } from "@/lib/precos";
import { SinoNotificacoes } from "@/components/SinoNotificacoes";
import { criarNotificacao } from "@/lib/notificacoes";
import { normalizarFaixa, corDaFaixa, nomeDaFaixa, type Faixa } from "@/lib/faixas";

const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";

const STEPS = [
  { title: "Como funciona", text: "Vou mostrar-te o essencial em 1 minuto. Avança quando quiseres — ou pula." },
  { title: "Monta a tua equipa", text: "100 Judocoins, 8 atletas e 1 capitão (pontua a dobrar). É por aqui que começas." },
  { title: "Pontua pelas ações", text: "Ippon +10, waza-ari +4, shido a favor +1. Acompanhas tudo ao vivo no início." },
  { title: "Competições e ligas", text: "Cada Grand Slam ou Mundial é uma rodada. Dispute ligas mundial, nacional e de amigos." },
  { title: "Sobe de faixa", text: "O teu desempenho mensal muda a tua faixa — e o visual do jogo. Boa sorte!" },
];

const PRO_BENEFITS = ["Scout avançado: histórico de cada atleta", "Análise do teu time e dica de capitão", "Maior possibilidade de valorização, pela análise", "Acompanhamento ao vivo no dia da competição"];

type TutTarget = "team" | "ligas" | "belt" | "pro" | null;
function targetForStep(step: number): TutTarget {
  const idx = step - 1;
  if (idx === 1) return "team";
  if (idx === 3) return "ligas";
  if (idx === 4) return "belt";
  return null;
}

// "Tem equipa?" depende SÓ de haver ids guardados — não de conseguirmos resolver
// os atletas. A lista de atletas (pool) vem do Mercado/servidor e pode não estar
// carregada ainda. Quando não está, mostramos a equipa na mesma, com o Valor em "—".
function computeTeamInfo(saved: TeamState): { name: string; value: string; last: number } | null {
  if (saved.ids.length === 0) return null; // só sem ids é que NÃO há equipa
  const athletes = resolve(saved.ids);
  const resolvido = athletes.length > 0;
  const value = Math.round(athletes.reduce((s, a) => s + a.priceJc, 0) * 10) / 10;
  const last = athletes.reduce((s, a) => s + a.last + (a.id === saved.captain ? a.last : 0), 0);
  return { name: loadIdentity().name, value: resolvido ? String(value) : "—", last: resolvido ? last : 0 };
}

export default function Inicio() {
  const [ready, setReady] = useState(false);
  const [visitante, setVisitante] = useState(false);
  const [phase, setPhase] = useState<"tutorial" | null>(null);
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [isPro, setIsPro] = useState(false);
  const [faixaJogo, setFaixaJogo] = useState<Faixa>("branca");
  const [savedTeam, setSavedTeam] = useState<TeamState | null>(null);
  const [minhasLigas, setMinhasLigas] = useState<{ id: string; name: string; membros: number }[] | null>(null);
  const [desempenho, setDesempenho] = useState<{ dados: DesempenhoRodada; team: TeamState } | null>(null);
  const [extra, setExtra] = useState<ResumoExtra | null>(null);
  const [, bumpPool] = useState(0);

  const beltRef = useRef<HTMLAnchorElement | null>(null);
  const teamRef = useRef<HTMLDivElement | null>(null);
  const ligasRef = useRef<HTMLAnchorElement | null>(null);
  const tutTarget: TutTarget = phase === "tutorial" ? targetForStep(step) : null;

  const foco = focoMercado();
  const comp = foco.atual;
  const ehClassico = comp.classico;
  const emAndamento = foco.aDecorrer !== null;
  const alvo = foco.alvo;
  const aDecorrer = foco.aDecorrer;

  const teamInfo = !visitante && savedTeam ? computeTeamInfo(savedTeam) : null;
  const temEquipaCompleta = !!savedTeam && savedTeam.ids.length === 8 && !!savedTeam.captain;
  const destinoEscalar = temEquipaCompleta ? "/meu-time" : "/criar-equipa";
  const nomeMostrado = visitante ? "Campeão" : name;

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }: { data: { session: { user?: { id?: string; user_metadata?: { nome?: string } } } | null } }) => {
      if (!active) return;

      if (!data.session) {
        setVisitante(true);
        setSavedTeam(null);
        setReady(true);
        return;
      }

      setVisitante(false);
      const userId = data.session.user?.id;
      if (userId) {
        fetch(`/api/liga/minhas?user_id=${userId}`)
          .then((r) => r.json())
          .then((j) => {
            if (!active) return;
            const ligas = Array.isArray(j?.ligas) ? j.ligas : [];
            setMinhasLigas(ligas.map((l: { id: string; name: string; membros?: number }) => ({ id: l.id, name: l.name, membros: l.membros ?? 1 })));
          })
          .catch(() => { if (active) setMinhasLigas([]); });
      }
      try {
        const metaName = data.session.user?.user_metadata?.nome;
        const savedName = localStorage.getItem(`ippon_name__${uid()}`) ?? localStorage.getItem("ippon_name");
        if (metaName) setName(String(metaName).split(" ")[0]);
        else if (savedName) setName(savedName);
        else setName("Campeão");
        const meta = (data.session.user?.user_metadata ?? {}) as { is_pro?: boolean };
        setIsPro(Boolean(meta.is_pro));
        if (userId) {
          supabase.from("users").select("belt").eq("id", userId).maybeSingle()
            .then(({ data: row }) => { if (active) setFaixaJogo(normalizarFaixa(row?.belt)); });
        }
        if (localStorage.getItem("ippon_onboarding") === "pending") {
          tutoriaisVistosConta().then((vistos) => {
            if (!active) return;
            if (vistos["ippon_onboarding"]) {
              try { localStorage.setItem("ippon_onboarding", "done"); } catch {}
            } else {
              setStep(0);
              setPhase("tutorial");
            }
          });
        }
        const localDecorrer = aDecorrer ? loadSavedFor(aDecorrer.idCompeticao) : { ids: [], captain: null };
        const localBase = localDecorrer.ids.length > 0 ? localDecorrer : loadSavedFor(alvo.idCompeticao);
        if (localBase.ids.length > 0) setSavedTeam(localBase);
      } catch {}
      setReady(true);
      const compsPool = aDecorrer ? [aDecorrer.idCompeticao, alvo.idCompeticao] : [alvo.idCompeticao];
      Promise.all(
        compsPool.map((id) => fetch(`/api/atletas?id=${id}`).then((r) => r.json()).catch(() => null))
      ).then((resultados) => {
        if (!active) return;
        const merged = new Map<string, { id: string }>();
        for (const j of resultados) {
          const list = Array.isArray(j?.atletas) ? j.atletas : [];
          for (const a of list) merged.set(a.id, a);
        }
        if (merged.size > 0) {
          setAthletePool(Array.from(merged.values()) as never);
          bumpPool((t) => t + 1);
        }
      });
      (async () => {
        const naDecorrer = aDecorrer ? await loadSavedCloudFor(aDecorrer.idCompeticao) : null;
        if (!active) return;
        if (naDecorrer && naDecorrer.ids.length > 0) {
          setSavedTeam(naDecorrer);
          return;
        }
        const naAlvo = await loadSavedCloudFor(alvo.idCompeticao);
        if (!active || !naAlvo || naAlvo.ids.length === 0) return;
        setSavedTeam(naAlvo);
      })();

      // "O TEU DESEMPENHO NA RODADA":
      //  - Se há competição A DECORRER: usa os pontos AO VIVO (como antes).
      //  - Senão: usa a ÚLTIMA competição CONGELADA não vista (persiste após fechar).
      (async () => {
        const vistos = await desempenhosVistosConta();
        if (!active) return;

        // ---- Caso 1: competição a decorrer (ao vivo) ----
        if (aDecorrer) {
          if (vistos[aDecorrer.idCompeticao]) return;
          const teamComp = await loadSavedCloudFor(aDecorrer.idCompeticao);
          if (!active || !teamComp || teamComp.ids.length === 0) return;
          const pontos = await buscarResultados(aDecorrer.idCompeticao);
          if (!active || !pontos) return;
          try {
            const j = await fetch(`/api/atletas?id=${aDecorrer.idCompeticao}`).then((r) => r.json());
            const list = Array.isArray(j?.atletas) ? j.atletas : [];
            if (list.length > 0) setAthletePool(list as never);
          } catch {}
          if (!active) return;
          const dados = construirDesempenho(aDecorrer.idCompeticao, aDecorrer.nome, teamComp, pontos);
          if (dados) {
            setDesempenho({ dados, team: teamComp });
            await notificarResumo(aDecorrer.idCompeticao, aDecorrer.nome, dados);
          }
          return;
        }

        // ---- Caso 2: sem evento a decorrer -> última competição CONGELADA ----
        const cong = await buscarResultadosCongelados(); // sem comp = última congelada
        if (!active || !cong) return;
        if (vistos[cong.comp]) return;
        const teamComp = await loadSavedCloudFor(cong.comp);
        if (!active || !teamComp || teamComp.ids.length === 0) return;
        // Garante o pool de atletas dessa competição (para resolver nomes/país).
        try {
          const j = await fetch(`/api/atletas?id=${cong.comp}`).then((r) => r.json());
          const list = Array.isArray(j?.atletas) ? j.atletas : [];
          if (list.length > 0) setAthletePool(list as never);
        } catch {}
        if (!active) return;
        const dados = construirDesempenho(cong.comp, cong.nome, teamComp, cong.pontos);
        if (!dados) return;
        // Números extra (média, posição, património) para o modal.
        let ex: ResumoExtra | null = null;
        if (userId) ex = await buscarResumoExtra(cong.comp, userId);
        if (!active) return;
        setDesempenho({ dados, team: teamComp });
        setExtra(ex);
        await notificarResumo(cong.comp, cong.nome, dados);
      })();
    });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase !== "tutorial") return;
    const t = targetForStep(step);
    const el = t === "team" ? teamRef.current : t === "ligas" ? ligasRef.current : t === "belt" ? beltRef.current : null;
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [phase, step]);

  const glow = (n: TutTarget) => (tutTarget === n ? "iltut" : undefined);

  function finishOnboarding() {
    marcarTutorialVisto("ippon_onboarding");
    setPhase(null);
  }

  function openTutorial() {
    setStep(0);
    setPhase("tutorial");
  }

  if (!ready) {
    return (
      <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#7c8a82", fontFamily: FB, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontFamily: FD, fontSize: 13, letterSpacing: "0.14em", textTransform: "uppercase" }}>A carregar…</div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: FB }}>
      <style>{`@keyframes ilpulse{0%,100%{opacity:1}50%{opacity:.3}} .ilpulse{animation:ilpulse 1.2s ease-in-out infinite} @keyframes iltut{0%,100%{box-shadow:0 0 0 3px rgba(74,144,217,0.75)}50%{box-shadow:0 0 0 9px rgba(74,144,217,0.18)}} .iltut{animation:iltut 1.3s ease-in-out infinite} @keyframes ilentrar{0%,100%{box-shadow:0 0 0 0 rgba(217,164,65,0.0)}50%{box-shadow:0 0 0 6px rgba(217,164,65,0.28)}} .ilentrar{animation:ilentrar 1.5s ease-in-out infinite;border-radius:999px}`}</style>

      <div style={{ maxWidth: 460, margin: "0 auto", padding: "16px 14px 86px" }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          {visitante ? (
            <a href="/entrar?voltar=/inicio" className="ilentrar" style={{ display: "flex", alignItems: "center", gap: 9, background: "#141a17", border: `1px solid ${GOLD}`, borderRadius: 999, padding: "5px 14px 5px 5px", textDecoration: "none", color: "#f1ede2" }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#1c3a2e", overflow: "hidden", flexShrink: 0 }}>
                <Mascot belt="#efeadd" expression="feliz" />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.1 }}>Campeão</div>
                <div style={{ fontSize: 11, color: GOLD }}>Entrar para jogar</div>
              </div>
            </a>
          ) : (
            <a ref={beltRef} className={glow("belt")} href="/perfil" style={{ display: "flex", alignItems: "center", gap: 9, background: "#141a17", border: "1px solid #243029", borderRadius: 999, padding: "5px 14px 5px 5px", textDecoration: "none", color: "#f1ede2" }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#1c3a2e", overflow: "hidden", flexShrink: 0, border: `2px solid ${corDaFaixa(faixaJogo)}` }}>
                <Mascot belt={corDaFaixa(faixaJogo)} expression="feliz" />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.1 }}>{nomeMostrado || "\u00A0"}</div>
                <div style={{ fontSize: 11, color: GOLD }}>Faixa {nomeDaFaixa(faixaJogo)}</div>
              </div>
            </a>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={openTutorial} aria-label="Como se joga" style={iconBtn}>?</button>
            <SinoNotificacoes calcOpts={{ temEquipa: temEquipaCompleta }} />
          </div>
        </header>

        {isPro ? (
          <a href="/pro" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: GOLD, borderRadius: 14, padding: "13px 14px", marginBottom: 14, textDecoration: "none" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontFamily: FD, fontSize: 15, fontWeight: 700, color: "#3a2a08", textTransform: "uppercase" }}>A tua central Pro</span>
                <span style={{ background: "#1b211e", color: GOLD, fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 999, textTransform: "uppercase", letterSpacing: "0.05em" }}>★ Pro</span>
              </div>
              <div style={{ fontSize: 11, color: "#5c4410", marginTop: 3 }}>Análise do teu time e as tuas vantagens</div>
            </div>
            <span style={{ background: "#1b211e", color: GOLD, fontSize: 11, fontWeight: 700, padding: "7px 12px", borderRadius: 9, whiteSpace: "nowrap" }}>Abrir</span>
          </a>
        ) : (
          <a href="/ippon-pro" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: GOLD, borderRadius: 14, padding: "11px 14px", marginBottom: 14, textDecoration: "none" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontFamily: FD, fontSize: 15, fontWeight: 700, color: "#3a2a08", textTransform: "uppercase" }}>Ippon Pro</span>
                {PRECO.emPromocao && <span style={{ background: "#1b211e", color: GOLD, fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 999, textTransform: "uppercase", letterSpacing: "0.05em" }}>{PRECO.etiqueta}</span>}
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 2 }}>
                {PRECO.emPromocao && <span style={{ fontSize: 12, color: "#7a5e12", textDecoration: "line-through" }}>{PRECO.normal}</span>}
                <span style={{ fontFamily: FD, fontSize: 18, fontWeight: 700, color: "#3a2a08" }}>{PRECO.atual}</span>
                <span style={{ fontSize: 11, color: "#5c4410" }}>{PRECO.periodo}</span>
              </div>
              <div style={{ fontSize: 11, color: "#5c4410", marginTop: 2 }}>Joga com vantagem competitiva</div>
              <div style={{ fontSize: 11, color: "#3a2a08", fontWeight: 700, marginTop: 3 }}>{PRECO.premios}</div>
            </div>
            <span style={{ background: "#1b211e", color: GOLD, fontSize: 11, fontWeight: 700, padding: "7px 12px", borderRadius: 9, whiteSpace: "nowrap" }}>Assinar</span>
          </a>
        )}

        <div ref={teamRef} className={glow("team")}>
          {!visitante && teamInfo ? <TeamBuilt info={teamInfo} fechoTexto={textoFecho(alvo)} faixa={faixaJogo} /> : <TeamCreate />}
        </div>

        <Card>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <CardTitle>{ehClassico ? (emAndamento ? "Clássico atual" : "Próximo clássico") : (emAndamento ? "Competição atual" : "Próxima competição")}</CardTitle>
            {ehClassico && (
              <span style={{ display: "flex", alignItems: "center", gap: 4, background: "#3a2f12", color: GOLD, fontSize: 10.5, fontWeight: 700, padding: "3px 9px", borderRadius: 999, whiteSpace: "nowrap", textTransform: "uppercase", letterSpacing: "0.03em" }}>↻ Clássico</span>
            )}
          </div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{comp.nome}</div>
          <div style={{ fontSize: 12, color: "#93a39a", marginTop: 2 }}>
            {comp.nivel}{ehClassico ? " · rodada especial" : ""} · está a valer pontos
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
            {emAndamento ? (
              <span style={{ display: "flex", alignItems: "center", gap: 6, color: "#e2655a", fontSize: 12, fontWeight: 700 }}>
                <span className="ilpulse" style={{ width: 8, height: 8, borderRadius: "50%", background: "#e2655a" }} />
                Em andamento · acompanha aqui
              </span>
            ) : (
              <span style={{ fontSize: 12, color: "#7fd1a3" }}>{textoFecho(comp)}</span>
            )}
            {emAndamento ? (
              visitante ? (
                <a href="/entrar?voltar=/inicio" style={{ background: "#1c3a2e", color: "#aee9c9", fontSize: 11, fontWeight: 700, padding: "6px 12px", borderRadius: 8, textDecoration: "none", whiteSpace: "nowrap" }}>Entrar para jogar</a>
              ) : (
                <a href="/meu-time" style={{ background: "#1c3a2e", color: "#aee9c9", fontSize: 11, fontWeight: 700, padding: "6px 12px", borderRadius: 8, textDecoration: "none", whiteSpace: "nowrap" }}>Ver a minha equipa</a>
              )
            ) : (
              <a href={destinoEscalar} style={{ background: "#1c3a2e", color: "#aee9c9", fontSize: 11, fontWeight: 700, padding: "6px 12px", borderRadius: 8, textDecoration: "none" }}>Escalar</a>
            )}
          </div>
        </Card>

        {emAndamento ? (
          <Card>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 9 }}>
              <span className="ilpulse" style={{ width: 8, height: 8, borderRadius: "50%", background: "#e2655a" }} />
              <span style={{ fontFamily: FD, fontSize: 14, fontWeight: 700, textTransform: "uppercase", color: "#e2655a" }}>Ao vivo agora</span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{aDecorrer?.nome ?? comp.nome}</div>
            <div style={{ fontSize: 12, color: "#93a39a", marginTop: 3, lineHeight: 1.4 }}>
              A competição está a decorrer. Acompanha as pontuações dos teus atletas no teu time, ao vivo.
            </div>
          </Card>
        ) : (
          <Card>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 7 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#3a463f" }} />
              <span style={{ fontFamily: FD, fontSize: 14, fontWeight: 700, textTransform: "uppercase", color: "#6f7d76" }}>Ao vivo</span>
            </div>
            <div style={{ fontSize: 12, color: "#7c8a82", lineHeight: 1.4 }}>
              Sem competição a decorrer agora. Quando houver, acompanhas aqui as lutas e as pontuações ao vivo.
            </div>
          </Card>
        )}

        <a ref={ligasRef} className={glow("ligas")} href="/ligas" style={{ textDecoration: "none", color: "inherit", display: "block" }}>
          <Card>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: minhasLigas && minhasLigas.length > 0 ? 6 : 0 }}>
              <CardTitle>As tuas ligas</CardTitle>
              <span style={{ fontFamily: FD, fontSize: 12, fontWeight: 700, color: GOLD }}>Ver todas ›</span>
            </div>
            {minhasLigas === null ? (
              <div style={{ fontSize: 12, color: "#7c8a82", paddingTop: 6 }}>A carregar as tuas ligas…</div>
            ) : minhasLigas.length === 0 ? (
              <div style={{ fontSize: 12, color: "#7c8a82", paddingTop: 6, lineHeight: 1.4 }}>
                Ainda não estás em nenhuma liga. Entra numa liga oficial ou cria uma com os teus amigos.
              </div>
            ) : (
              minhasLigas.slice(0, 4).map((l) => (
                <div key={l.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0" }}>
                  <span style={{ fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "70%" }}>{l.name}</span>
                  <span style={{ fontSize: 12, color: "#93a39a" }}>{l.membros} {l.membros === 1 ? "membro" : "membros"}</span>
                </div>
              ))
            )}
          </Card>
        </a>

      </div>

      <nav style={{ position: "fixed", left: 0, right: 0, bottom: 0, height: 62, background: "#0f1411", borderTop: "1px solid #243029", display: "flex", alignItems: "center", justifyContent: "space-around" }}>
        <Tab label="Início" active icon={<HomeIcon />} href="/inicio" />
        <Tab label="Competições" icon={<TrophyIcon />} href="/ligas" />
        <Tab label="Atletas" icon={<AthletesIcon />} href="/atletas" />
        <Tab label="Pro" icon={<BoltIcon />} href={isPro ? "/pro" : "/ippon-pro"} />
      </nav>

      {phase === "tutorial" && <Tutorial step={step} setStep={setStep} onClose={finishOnboarding} name={nomeMostrado || "Campeão"} target={tutTarget} />}

      {desempenho && (
        <Desempenho
          dados={desempenho.dados}
          identity={loadIdentity()}
          team={desempenho.team}
          nome={nomeMostrado || "Campeão"}
          faixa={nomeDaFaixa(faixaJogo)}
          pro={isPro}
          extra={extra}
          onClose={() => {
            marcarDesempenhoVisto(desempenho.dados.idCompeticao);
            setDesempenho(null);
            setExtra(null);
          }}
        />
      )}
    </main>
  );
}

// Cria a notificação de RESUMO (guardada), uma vez por competição neste aparelho.
async function notificarResumo(idComp: string, nomeComp: string, dados: DesempenhoRodada) {
  try {
    const chaveResumo = `ippon_notif_resumo_${idComp}`;
    if (localStorage.getItem(chaveResumo)) return;
    const cap = dados.capitao;
    const corpo = cap
      ? `${mensagemDesempenho(dados.pontuacaoTotal, "")} Fizeste ${dados.pontuacaoTotal} pts — o teu capitão ${cap.atleta.name.split(" ").slice(-1)[0]} somou ${cap.pontos}.`
      : `${mensagemDesempenho(dados.pontuacaoTotal, "")} Fizeste ${dados.pontuacaoTotal} pts nesta rodada.`;
    await criarNotificacao({
      tipo: "resumo_rodada",
      titulo: `Resumo: ${nomeComp}`,
      corpo: corpo.trim(),
      link: "/meu-time",
    });
    localStorage.setItem(chaveResumo, "1");
  } catch {}
}

const iconBtn: React.CSSProperties = {
  width: 36, height: 36, borderRadius: "50%", border: "1px solid #243029", background: "transparent",
  color: "#93a39a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, cursor: "pointer",
};

function Card({ children }: { children: React.ReactNode }) {
  return <div style={{ background: "#121815", border: "1px solid #243029", borderRadius: 14, padding: 13, marginBottom: 12 }}>{children}</div>;
}
function CardTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily: FD, fontSize: 14, fontWeight: 700, textTransform: "uppercase" }}>{children}</div>;
}

function TeamCreate() {
  return (
    <div style={{ border: "1px solid #2a4d3e", borderRadius: 16, overflow: "hidden", marginBottom: 14, background: "repeating-linear-gradient(45deg,#1c3a2e 0 16px,#1a352a 16px 32px)" }}>
      <div style={{ padding: "20px 16px", textAlign: "center" }}>
        <div style={{ width: 64, height: 64, margin: "0 auto 6px" }}>
          <Mascot belt="#efeadd" expression="feliz" />
        </div>
        <div style={{ fontFamily: FD, fontSize: 20, fontWeight: 700, textTransform: "uppercase" }}>Cria a tua equipa</div>
        <div style={{ fontSize: 12, color: "#cfe4d8", margin: "4px 0 14px" }}>Monta 8 atletas com 100 Judocoins e escolhe o teu capitão.</div>
        <a href="/criar-equipa" style={{ display: "block", background: GOLD, color: "#1b211e", fontFamily: FD, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", padding: 13, borderRadius: 11, fontSize: 15, textDecoration: "none" }}>
          Criar a minha equipa
        </a>
      </div>
    </div>
  );
}

function TeamBuilt({ info, fechoTexto, faixa }: { info: { name: string; value: string; last: number }; fechoTexto: string; faixa: Faixa }) {
  return (
    <div style={{ border: "1px solid #243029", borderRadius: 16, overflow: "hidden", marginBottom: 14 }}>
      <div style={{ background: "#1c3a2e", padding: 9, textAlign: "center", fontFamily: FD, fontSize: 13, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#aee9c9" }}>A minha equipa</div>
      <div style={{ background: "#0f1411", padding: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <div style={{ width: 48, height: 48 }}>
            <Mascot belt={corDaFaixa(faixa)} expression="feliz" />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{info.name}</div>
            <div style={{ fontSize: 12, color: GOLD }}>Faixa {nomeDaFaixa(faixa)}</div>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", textAlign: "center", marginBottom: 12 }}>
          {(() => {
            const temValor = info.value !== "—";
            const valorNum = temValor ? Number(info.value) : 0;
            const patrimonio = temValor ? `JC ${Math.round((100 - valorNum) * 10) / 10}` : "—";
            return [[patrimonio, "Património"], [String(info.last), "Última"], [`JC ${info.value}`, "Valor"]].map(([v, l]) => (
              <div key={l}>
                <div style={{ fontFamily: FD, fontSize: 17, fontWeight: 700, color: l === "Património" ? GOLD : "#f1ede2" }}>{v}</div>
                <div style={{ fontSize: 10, color: "#93a39a", textTransform: "uppercase" }}>{l}</div>
              </div>
            ));
          })()}
        </div>
        <div style={{ fontSize: 12, color: "#7fd1a3", marginBottom: 10 }}>{fechoTexto}</div>
        <a href="/meu-time" style={{ display: "block", background: GOLD, color: "#1b211e", textAlign: "center", fontFamily: FD, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", padding: 12, borderRadius: 11, fontSize: 14, textDecoration: "none" }}>
          Ver o meu time
        </a>
      </div>
    </div>
  );
}

function Tab({ label, icon, active, href }: { label: string; icon: React.ReactNode; active?: boolean; href?: string }) {
  const baseStyle: React.CSSProperties = { display: "flex", flexDirection: "column", alignItems: "center", gap: 3, color: active ? GOLD : "#6f7d76", textDecoration: "none" };
  const content = (
    <>
      {icon}
      <span style={{ fontSize: 11, fontWeight: active ? 700 : 400 }}>{label}</span>
    </>
  );
  return href ? <a href={href} style={baseStyle}>{content}</a> : <div style={baseStyle}>{content}</div>;
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(6,8,7,0.78)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18, zIndex: 100 }}>
      <div style={{ width: "100%", maxWidth: 320 }}>{children}</div>
    </div>
  );
}

function Tutorial({ step, setStep, onClose, name, target }: { step: number; setStep: (s: number) => void; onClose: () => void; name: string; target: TutTarget }) {
  const total = STEPS.length + 2;
  const isWelcome = step === 0;
  const isPro = step === STEPS.length + 1;
  const teach = STEPS[step - 1];

  if (target) {
    const title = isPro ? "Ippon Pro" : teach.title;
    const text = isPro
      ? `Toca aqui para teres o Ippon Pro: scout avançado, análise do teu time e dica de capitão. ${PRECO.atualComPeriodo}.`
      : teach.text;
    return (
      <div style={{ position: "fixed", left: 0, right: 0, bottom: 74, padding: "0 12px", zIndex: 100 }}>
        <div style={{ maxWidth: 436, margin: "0 auto", display: "flex", gap: 10, alignItems: "flex-end" }}>
          <div style={{ width: 56, height: 56, flexShrink: 0 }}><Mascot belt="#141110" expression="indicando" /></div>
          <div style={{ flex: 1, background: "#121815", border: `1px solid ${GOLD}`, borderRadius: 14, padding: "12px 14px" }}>
            <div style={{ textAlign: "right", marginBottom: 4 }}>
              <button onClick={onClose} style={{ background: "transparent", border: "none", color: "#93a39a", fontSize: 11, cursor: "pointer", fontFamily: FB }}>Pular ✕</button>
            </div>
            <div style={{ fontFamily: FD, fontSize: 15, fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>{title}</div>
            <p style={{ fontSize: 12.5, color: "#c7d0c9", lineHeight: 1.45, margin: 0 }}>{text}</p>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
              <button onClick={() => setStep(step - 1)} style={{ background: "transparent", border: "none", color: "#93a39a", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: FB }}>Anterior</button>
              <span style={{ fontSize: 11, color: "#5f6f67" }}>{step + 1} de {total}</span>
              <button onClick={() => (isPro ? onClose() : setStep(step + 1))} style={{ background: GOLD, border: "none", color: "#1b211e", padding: "8px 18px", borderRadius: 9, fontFamily: FD, fontSize: 13, fontWeight: 700, textTransform: "uppercase", cursor: "pointer" }}>{isPro ? "Concluir" : "Seguinte"}</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Overlay>
      <div style={{ textAlign: "right", marginBottom: 8 }}>
        <button onClick={onClose} style={{ background: "transparent", border: "none", color: "#cfd8d2", fontSize: 12, cursor: "pointer", fontFamily: FB }}>Pular tutorial ✕</button>
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} style={{ flex: 1, height: 4, borderRadius: 999, background: i <= step ? GOLD : "#3a463f" }} />
        ))}
      </div>

      {isWelcome ? (
        <div style={{ background: "#121815", border: `1px solid ${GOLD}`, borderRadius: 16, padding: 18 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={{ width: 64, height: 64, flexShrink: 0 }}>
              <Mascot belt="#141110" expression="comemorando" />
            </div>
            <div>
              <div style={{ fontFamily: FD, fontSize: 16, fontWeight: 700, textTransform: "uppercase", marginBottom: 5 }}>Olá, {name}! Sou o Dôdo</div>
              <p style={{ fontSize: 13, color: "#c7d0c9", lineHeight: 1.5, margin: 0 }}>Sou o teu sensei aqui na Ippon League e vou guiar-te. Vou apontar no ecrã o que importa. Bora começar?</p>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
            <button onClick={() => setStep(1)} style={{ background: GOLD, border: "none", color: "#1b211e", padding: "9px 20px", borderRadius: 9, fontFamily: FD, fontSize: 14, fontWeight: 700, textTransform: "uppercase", cursor: "pointer" }}>Vamos!</button>
          </div>
        </div>
      ) : isPro ? (
        <div style={{ background: "#121815", border: `1px solid ${GOLD}`, borderRadius: 16, padding: 20, textAlign: "center" }}>
          <div style={{ width: 80, height: 80, margin: "0 auto 2px" }}>
            <Mascot belt="#141110" expression="sabio" />
          </div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: GOLD }}>Oferta de lançamento</div>
          <div style={{ fontFamily: FD, fontSize: 20, fontWeight: 700, textTransform: "uppercase", margin: "4px 0" }}>Ippon Pro</div>
          <div style={{ margin: "6px 0 14px" }}>
            {PRECO.emPromocao && <><span style={{ fontSize: 14, color: "#7c8a82", textDecoration: "line-through" }}>{PRECO.normal}</span>{" "}</>}
            <span style={{ fontFamily: FD, fontSize: 30, fontWeight: 700, color: GOLD }}>{PRECO.atual}</span>
            <span style={{ fontSize: 12, color: "#93a39a" }}>/mês</span>
          </div>
          <div style={{ textAlign: "left", display: "flex", flexDirection: "column", gap: 7, marginBottom: 18 }}>
            {PRO_BENEFITS.map((b) => (
              <div key={b} style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
                <span style={{ color: GOLD, fontWeight: 700 }}>✓</span>
                <span style={{ fontSize: 13, color: "#c7d0c9" }}>{b}</span>
              </div>
            ))}
          </div>
          <a href="/ippon-pro" style={{ display: "block", width: "100%", background: GOLD, color: "#1b211e", border: "none", fontFamily: FD, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", padding: 15, borderRadius: 12, fontSize: 16, textDecoration: "none", boxSizing: "border-box" }}>Seja Ippon Pro agora</a>
          <a href="/ippon-pro" style={{ display: "block", marginTop: 9, textAlign: "center", color: GOLD, fontSize: 13, fontWeight: 700, textDecoration: "none", fontFamily: FB }}>Saber mais</a>
          <button onClick={onClose} style={{ marginTop: 10, background: "transparent", border: "none", color: "#93a39a", fontSize: 12, cursor: "pointer", fontFamily: FB }}>Continuar sem pagar</button>
        </div>
      ) : (
        <div style={{ background: "#121815", border: `1px solid ${GOLD}`, borderRadius: 16, padding: 18 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={{ width: 64, height: 64, flexShrink: 0 }}>
              <Mascot belt="#141110" expression="indicando" />
            </div>
            <div>
              <div style={{ fontFamily: FD, fontSize: 16, fontWeight: 700, textTransform: "uppercase", marginBottom: 5 }}>{teach.title}</div>
              <p style={{ fontSize: 13, color: "#c7d0c9", lineHeight: 1.5, margin: 0 }}>{teach.text}</p>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16 }}>
            <button onClick={() => setStep(step - 1)} style={{ background: "transparent", border: "none", color: "#93a39a", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: FB }}>Anterior</button>
            <span style={{ fontSize: 11, color: "#5f6f67" }}>{step + 1} de {total}</span>
            <button onClick={() => setStep(step + 1)} style={{ background: GOLD, border: "none", color: "#1b211e", padding: "9px 18px", borderRadius: 9, fontFamily: FD, fontSize: 13, fontWeight: 700, textTransform: "uppercase", cursor: "pointer" }}>Seguinte</button>
          </div>
        </div>
      )}
    </Overlay>
  );
}

function HomeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" />
    </svg>
  );
}
function TrophyIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 4h8v5a4 4 0 0 1-8 0V4z" /><path d="M8 6H5v2a3 3 0 0 0 3 3M16 6h3v2a3 3 0 0 1-3 3M10 17h4M9 21h6M12 13v4" />
    </svg>
  );
}
function AthletesIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="8" cy="6" r="3" /><circle cx="17" cy="7" r="2.5" /><path d="M3 20v-1a5 5 0 0 1 10 0v1M14 20v-1a4 4 0 0 1 7-2.6" />
    </svg>
  );
}
function BoltIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />
    </svg>
  );
}
