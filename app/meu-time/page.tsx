"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Mascot } from "@/components/Mascot";
import { Escudo, loadIdentity, DEFAULT_IDENTITY, type Identity } from "@/components/Escudo";
import { loadSavedFor, loadDraftFor, saveDraftFor, commitSavedFor, commitSavedCloudFor, resolve, jcLeft, isComplete, missing, loadSavedCloudFor, setAthletePool, temNomeProprio, type TeamState } from "@/lib/team";
import { type Athlete } from "@/lib/athletes";
import { supabase } from "@/lib/supabase";
import { focoMercado } from "@/lib/calendario";
import { CartaoEquipa } from "@/components/CartaoEquipa";
import { tutorialVistoLocal, tutoriaisVistosConta, marcarTutorialVisto, type TutKey } from "@/lib/tutorials";
import { Avaliacao, devePedirAvaliacao } from "@/components/Avaliacao";

const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";
const BELT = "Branca";
const BELT_HEX = "#efeadd";

const TICK_AO_VIVO_MS = 15000;

type MarketPhase = "aberto" | "fechado" | "ao-vivo";

const IOC: Record<string, string> = {
  JP: "JPN", FR: "FRA", BR: "BRA", GE: "GEO", KZ: "KAZ", AZ: "AZE", BE: "BEL",
  TR: "TUR", UZ: "UZB", RU: "AIN", DE: "GER", XK: "KOS", IT: "ITA", CA: "CAN",
  SI: "SLO", HR: "CRO", NL: "NED",
};
const code3 = (iso: string) => IOC[iso] || iso;
const fmt = (n: number) => String(Math.round(n * 10) / 10);

// Tutorial de EDIÇÃO (mercado aberto). Todas as setas apontam para cima (os
// elementos destacados estão acima do balão, que fica em baixo). `target` indica
// o que pulsa em cada passo.
const STEPS_EDICAO = [
  { t: "Património", x: "No topo vês o teu património: o valor total que tens, que sobe quando os teus atletas valorizam.", target: "topo" },
  { t: "Lugares vazios", x: "Um lugar vazio leva-te ao Mercado para contratares um atleta. Preenche os 8 (4 masculinos + 4 femininas).", target: "vazio" },
  { t: "Os teus atletas", x: "Toca num atleta para o tornares capitão (pontua a dobrar) ou para o venderes.", target: "atletas" },
  { t: "Guardar", x: "Sempre que mudas algo, aparece o botão Salvar em baixo. Guarda para a tua equipa ficar pronta para a rodada.", target: "guardar" },
];
// Tutorial de COMPETIÇÃO (a decorrer). Explica o que se vê ao vivo.
const STEPS_COMPETICAO = [
  { t: "Pontos ao vivo", x: "Os pontos de cada atleta aparecem aqui e atualizam-se sozinhos durante a rodada.", target: "atletas" },
  { t: "Capitão a dobrar", x: "O teu capitão tem o (C) e pontua a dobrar — repara no destaque dele.", target: "atletas" },
  { t: "Total da equipa", x: "A pontuação total da tua equipa está aqui em baixo, e sobe à medida que os teus atletas pontuam.", target: "total" },
  { t: "Acompanha a rodada", x: "A equipa está trancada durante a competição. Volta aqui para ver os pontos a subir!", target: "total" },
];
const TUT_EDICAO_KEY: TutKey = "ippon_meutime_tut_edicao";
const TUT_COMP_KEY: TutKey = "ippon_meutime_tut_competicao";

function sameTeam(a: TeamState, b: TeamState): boolean {
  if ((a.captain || "") !== (b.captain || "")) return false;
  if (a.ids.length !== b.ids.length) return false;
  return [...a.ids].sort().join(",") === [...b.ids].sort().join(",");
}

type Modal =
  | { kind: "saved" | "trash" | "share" | "leave" | "missing" | "incompleta" }
  | { kind: "athlete"; a: Athlete }
  | null;

export default function MeuTime() {
  const [team, setTeam] = useState<TeamState>({ ids: [], captain: null }); // rascunho (editável)
  const [saved, setSaved] = useState<TeamState>({ ids: [], captain: null }); // guardado (referência p/ dirty)
  const [identity, setIdentity] = useState<Identity>(DEFAULT_IDENTITY);
  const [ready, setReady] = useState(false);
  const [poolPronto, setPoolPronto] = useState(false); // já tentámos carregar a lista de atletas?
  const [pontos, setPontos] = useState<Record<string, number>>({});
  const [temResultados, setTemResultados] = useState(false);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<number | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [savingCloud, setSavingCloud] = useState(false);
  const [cloudWarn, setCloudWarn] = useState(false);
  const [leaveTo, setLeaveTo] = useState<string | null>(null);
  const [, bumpPool] = useState(0);
  // Tutorial: passo atual (null = fechado). O conjunto de passos muda conforme o
  // momento (edição quando mercado aberto; competição quando a decorrer).
  const [guide, setGuide] = useState<number | null>(null);
  const [mostrarAvaliacao, setMostrarAvaliacao] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const router = useRouter();

  const foco = focoMercado();
  const atual = foco.atual;
  const emAndamento = foco.aDecorrer !== null;
  const alvo = foco.alvo;
  const aDecorrer = foco.aDecorrer;
  const [idComp, setIdComp] = useState<string>(alvo.idCompeticao);

  useEffect(() => {
    let active = true;
    try {
      setIdentity(loadIdentity());
      const localDecorrer = aDecorrer ? loadSavedFor(aDecorrer.idCompeticao) : { ids: [], captain: null };
      if (localDecorrer.ids.length > 0 && aDecorrer) {
        setTeam(localDecorrer);
        setSaved(localDecorrer);
        setIdComp(aDecorrer.idCompeticao);
      } else {
        // Mercado aberto. O "Meu Time" mostra a equipa guardada; o rascunho só
        // entra como ponto de edição se for MESMO uma edição em curso (diferente
        // do guardado). Caso contrário, team = saved, para não haver falso "tens
        // alterações por guardar" (ex.: rascunho com a mesma equipa noutra ordem).
        const s = loadSavedFor(alvo.idCompeticao);
        const d = loadDraftFor(alvo.idCompeticao);
        const edicaoEmCurso = d.ids.length > 0 && !sameTeam(d, s);
        setTeam(edicaoEmCurso ? d : s);
        setSaved(s);
        setIdComp(alvo.idCompeticao);
      }
    } catch {}
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
    }).finally(() => {
      // Quer tenha vindo lista ou não, a tentativa terminou. Isto destranca o
      // ecrã: se mesmo assim não houver atletas resolvidos, mostramos "sem equipa".
      if (active) setPoolPronto(true);
    });
    supabase.auth.getSession().then(({ data }: { data: { session: unknown } }) => {
      if (!active) return;
      if (!data.session) {
        window.location.href = "/entrar";
        return;
      }
      setReady(true);
      try {
        const meta = (data.session as { user?: { user_metadata?: { is_pro?: boolean } } } | null)?.user?.user_metadata;
        setIsPro(!!meta?.is_pro);
      } catch {}
      (async () => {
        const naDecorrer = aDecorrer ? await loadSavedCloudFor(aDecorrer.idCompeticao) : null;
        if (!active) return;
        if (naDecorrer && naDecorrer.ids.length > 0 && aDecorrer) {
          setTeam(naDecorrer);
          setSaved(naDecorrer);
          saveDraftFor(aDecorrer.idCompeticao, naDecorrer);
          setIdComp(aDecorrer.idCompeticao);
          return;
        }
        const naAlvo = await loadSavedCloudFor(alvo.idCompeticao);
        if (!active || !naAlvo) return;
        setSaved(naAlvo);
        // A equipa guardada na conta (nuvem) é a fonte de verdade. Para o "Meu Time"
        // não pensar que há alterações por guardar quando NÃO há (ex.: voltar do
        // mercado sem mexer), alinhamos TUDO à nuvem: o que se vê (team), a
        // referência (saved) e o rascunho local. Só NÃO alinhamos se o utilizador
        // tem uma edição mesmo diferente da nuvem em curso (compras/vendas reais).
        const curDraft = loadDraftFor(alvo.idCompeticao);
        const edicaoEmCurso = curDraft.ids.length > 0 && !sameTeam(curDraft, naAlvo);
        if (!edicaoEmCurso) {
          setTeam(naAlvo);
          saveDraftFor(alvo.idCompeticao, naAlvo);
          commitSavedFor(alvo.idCompeticao, naAlvo);
        }
      })();
    });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pontos reais + tick ao vivo (igual ao original).
  useEffect(() => {
    let active = true;
    if (!idComp) return;
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
    buscarPontos();
    const aDecorrerAgora = emAndamento && idComp === atual.idCompeticao;
    if (!aDecorrerAgora) {
      return () => { active = false; };
    }
    let timer: ReturnType<typeof setInterval> | null = null;
    const arranca = () => {
      if (timer) return;
      timer = setInterval(() => {
        if (typeof document !== "undefined" && document.hidden) return;
        buscarPontos();
      }, TICK_AO_VIVO_MS);
    };
    const para = () => { if (timer) { clearInterval(timer); timer = null; } };
    arranca();
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

  // Modo atual (edição vs competição) para decidir qual tutorial. Calculado também
  // aqui (antes do return) para o efeito de "primeira vez" poder usá-lo.
  const emCompeticaoNow = emAndamento && idComp === atual.idCompeticao && team.ids.length > 0;

  // TUTORIAL — primeira vez: abre automaticamente uma vez por modo. Se a pessoa
  // pula ou escolhe "não ver mais", fica marcado e só reabre pelo "?".
  useEffect(() => {
    if (!ready) return;
    const chave = emCompeticaoNow ? TUT_COMP_KEY : TUT_EDICAO_KEY;
    let active = true;
    if (!tutorialVistoLocal(chave)) {
      tutoriaisVistosConta().then((vistos) => {
        if (!active) return;
        if (vistos[chave]) {
          try { localStorage.setItem(chave, "done"); } catch {}
        } else {
          setGuide(0);
        }
      });
    }
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, emCompeticaoNow]);

  if (!ready) return <main style={{ minHeight: "100vh", background: "#0c0e0d" }} />;

  const athletes = resolve(team.ids);
  const temEquipa = team.ids.length > 0;
  // "A carregar" só ENQUANTO ainda estamos a tentar buscar a lista de atletas.
  // Depois de a tentativa terminar (poolPronto), se os atletas não resolverem,
  // deixamos de carregar e a página trata como "sem equipa" (com botão montar).
  const aCarregarAtletas = temEquipa && athletes.length === 0 && !poolPronto;
  const equipaIrresoluvel = temEquipa && athletes.length === 0 && poolPronto;
  const hasTeam = athletes.length > 0;
  const males = athletes.filter((a) => a.gender === "M");
  const females = athletes.filter((a) => a.gender === "F");
  const squadValue = fmt(athletes.reduce((s, a) => s + a.priceJc, 0));
  const saldo = jcLeft(team); // o que sobra para gastar (mostrado como 'Património')
  const scoreOf = (a: Athlete) => {
    const base = pontos[a.id] ?? 0;
    return a.id === team.captain ? base * 2 : base;
  };
  const totalPts = Math.round(athletes.reduce((s, a) => s + scoreOf(a), 0) * 10) / 10;
  const emCompeticao = emAndamento && idComp === atual.idCompeticao && hasTeam;
  const marketPhase: MarketPhase = emCompeticao ? "ao-vivo" : "aberto";
  // EDITÁVEL só quando NÃO está em competição (mercado aberto).
  const editavel = !emCompeticao;
  const dirty = editavel && !sameTeam(team, saved);

  // Tutorial ativo conforme o momento + qual elemento destacar agora.
  const passos = emCompeticao ? STEPS_COMPETICAO : STEPS_EDICAO;
  const passoAtual = guide !== null ? passos[guide] : null;
  const destaque = passoAtual?.target ?? null; // "topo" | "vazio" | "atletas" | "total" | "guardar"

  const horaTick = ultimaAtualizacao
    ? new Date(ultimaAtualizacao).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : null;

  // ---- Edição (só quando editável) ----
  function update(next: TeamState) {
    setTeam(next);
    saveDraftFor(alvo.idCompeticao, next);
  }
  function tornarCapitao(id: string) {
    update({ ...team, captain: team.captain === id ? null : id });
    setModal(null);
  }
  function vender(id: string) {
    update({ ids: team.ids.filter((x) => x !== id), captain: team.captain === id ? null : team.captain });
    setModal(null);
  }
  function limparTudo() {
    update({ ids: [], captain: null });
    setModal(null);
  }
  async function salvar(destino?: string | null) {
    if (!isComplete(team)) { setModal({ kind: "missing" }); return; }
    setSavingCloud(true);
    const res = await commitSavedCloudFor(alvo.idCompeticao, team, identity);
    setSaved(team);
    // Sincroniza o rascunho local com o guardado: sem isto, fica um rascunho
    // "fantasma" diferente do guardado e o meu-time pensaria que há alterações
    // por guardar ao voltar (ex: voltar do mercado sem mexer em nada).
    saveDraftFor(alvo.idCompeticao, team);
    setSavingCloud(false);
    setCloudWarn(!res.ok);
    // Se o salvar veio do aviso de saída, continua para o destino depois de guardar.
    if (destino) {
      setModal(null);
      setLeaveTo(null);
      router.push(destino);
      return;
    }
    // Fim da jornada: conta + equipa escalada + nome próprio. Se for altura (1x/semana
    // para quem não votou, 4 meses para quem votou), pede a avaliação em vez do "saved".
    if (res.ok && temNomeProprio(identity) && devePedirAvaliacao()) {
      setMostrarAvaliacao(true);
      return;
    }
    setModal({ kind: "saved" });
  }
  // PRENDER: ao tentar sair com alterações.
  // Regra: nunca se guarda uma equipa incompleta. Ao sair:
  //  - equipa COMPLETA alterada -> avisa para guardar (modal "leave").
  //  - equipa INCOMPLETA alterada -> avisa que vai descartar as alterações;
  //    mantém a equipa anterior (saved) se houver, senão fica vazio (modal "incompleta").
  //  - sem alterações -> sai direto.
  function tryLeave(href: string) {
    if (!dirty) { router.push(href); return; }
    if (!isComplete(team)) { setLeaveTo(href); setModal({ kind: "incompleta" }); return; }
    setLeaveTo(href); setModal({ kind: "leave" });
  }
  // Sair descartando o rascunho incompleto: o rascunho local volta a ser a equipa
  // guardada (completa ou vazia), para o estado furado não reaparecer ao voltar.
  function sairDescartando() {
    saveDraftFor(alvo.idCompeticao, saved);
    setTeam(saved);
    const destino = leaveTo;
    setModal(null);
    setLeaveTo(null);
    if (destino) router.push(destino);
  }

  // Lugares vazios para completar a equipa (4 masc + 4 fem).
  const vagasM = Math.max(0, 4 - males.length);
  const vagasF = Math.max(0, 4 - females.length);

  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: FB }}>
      <style>{`@keyframes ilp{0%,100%{opacity:1}50%{opacity:.25}} .ilp{animation:ilp 1.1s ease-in-out infinite} @keyframes ilsave{0%,100%{box-shadow:0 0 0 0 rgba(217,164,65,0.0)}50%{box-shadow:0 0 0 6px rgba(217,164,65,0.30)}} .ilsave{animation:ilsave 1.2s ease-in-out infinite} @keyframes ilglow{0%,100%{box-shadow:0 0 0 3px rgba(90,169,255,.65)}50%{box-shadow:0 0 0 8px rgba(90,169,255,.18)}} .ilglow{animation:ilglow 1.3s ease-in-out infinite;border-radius:14px} @keyframes ilseta{0%,100%{transform:translateY(0)}50%{transform:translateY(5px)}} .ilseta{animation:ilseta 0.9s ease-in-out infinite}`}</style>
      <div style={{ maxWidth: 460, margin: "0 auto", padding: dirty ? "14px 14px 96px" : "14px 14px 40px" }}>
        <header style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 16 }}>
          <a href="/inicio" onClick={(e) => { e.preventDefault(); tryLeave("/inicio"); }} aria-label="Voltar" style={{ width: 34, height: 34, borderRadius: "50%", border: "1px solid #243029", display: "flex", alignItems: "center", justifyContent: "center", color: "#cfd8d2", textDecoration: "none", flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
          </a>
          <h1 style={{ fontFamily: FD, fontSize: 19, fontWeight: 700, textTransform: "uppercase", margin: 0, flex: 1 }}>Meu Time</h1>
          <button onClick={() => setGuide(0)} aria-label="Como funciona" style={{ width: 34, height: 34, borderRadius: "50%", border: "1px solid #243029", background: "transparent", color: "#93a39a", fontSize: 16, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>?</button>
        </header>

        {(!temEquipa || equipaIrresoluvel) ? (
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
              <div className={destaque === "topo" ? "ilglow" : undefined} style={{ display: "flex", gap: 8, padding: 2 }}>
                <div style={{ background: "#141a17", border: `1px solid #2a4d3e`, borderRadius: 12, padding: "8px 16px", textAlign: "right" }}>
                  <div style={{ fontSize: 10, color: "#93a39a", textTransform: "uppercase", letterSpacing: "0.08em" }}>Património</div>
                  <div style={{ fontFamily: FD, fontSize: 20, fontWeight: 700, color: GOLD }}>JC {fmt(saldo)}</div>
                </div>
              </div>
            </div>

            <section className={destaque === "atletas" || destaque === "vazio" ? "ilglow" : undefined} style={{ background: "#2f6fb3", border: "2px solid #25588f", borderRadius: 16, padding: 10 }}>
              <div style={{ background: "#e6b422", border: "2px solid #f0cf6a", borderRadius: 10, padding: "12px 10px" }}>
                <SectionLabel>Masculino</SectionLabel>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 14 }}>
                  {males.map((a) => <Cell key={a.id} a={a} captain={a.id === team.captain} score={scoreOf(a)} phase={marketPhase} onClick={() => setModal({ kind: "athlete", a })} />)}
                  {editavel && Array.from({ length: vagasM }).map((_, i) => <EmptyCell key={"vm" + i} />)}
                </div>
                <SectionLabel>Feminino</SectionLabel>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
                  {females.map((a) => <Cell key={a.id} a={a} captain={a.id === team.captain} score={scoreOf(a)} phase={marketPhase} onClick={() => setModal({ kind: "athlete", a })} />)}
                  {editavel && Array.from({ length: vagasF }).map((_, i) => <EmptyCell key={"vf" + i} />)}
                </div>
              </div>
            </section>

            <div className={destaque === "total" ? "ilglow" : undefined} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, padding: "12px 14px", background: "#141a17", border: "1px solid #243029", borderRadius: 14 }}>
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
              <>
                <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                  <button onClick={() => setModal({ kind: "trash" })} aria-label="Limpar equipa" style={{ width: 46, borderRadius: 11, border: "1px solid #3a2422", background: "transparent", color: "#ef8d83", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                    <TrashIcon />
                  </button>
                  <button onClick={() => setModal({ kind: "share" })} aria-label="Partilhar equipa" style={{ width: 46, borderRadius: 11, border: "1px solid #243029", background: "transparent", color: "#cfd8d2", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                    <ShareIcon />
                  </button>
                  <a href="/mercado" onClick={(e) => { e.preventDefault(); tryLeave("/mercado"); }} style={{ flex: 1, textAlign: "center", background: GOLD, color: "#1b211e", fontFamily: FD, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", padding: 12, borderRadius: 11, fontSize: 13, textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center" }}>Ver mercado</a>
                </div>
                <p style={{ fontSize: 11, color: "#5f6f67", textAlign: "center", marginTop: 14 }}>
                  Toca num atleta para o tornares capitão ou venderes. Toca num lugar vazio para ir ao Mercado.
                </p>
              </>
            )}
          </>
        )}
      </div>

      {/* Barra fixa de guardar — só quando há alterações por guardar (prende para salvar). */}
      {dirty && (
        <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, background: "#0f1411", borderTop: "1px solid #243029", padding: "10px 14px", zIndex: 60 }}>
          <div style={{ maxWidth: 460, margin: "0 auto", display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1, fontSize: 12, color: "#cfd8d2" }}>Tens alterações por guardar.</div>
            <button onClick={() => salvar()} disabled={savingCloud} className={!savingCloud ? "ilsave" : undefined} style={{ background: GOLD, color: "#1b211e", border: "none", fontFamily: FD, fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", padding: "11px 20px", borderRadius: 10, cursor: savingCloud ? "default" : "pointer", opacity: savingCloud ? 0.7 : 1 }}>{savingCloud ? "A guardar…" : "Salvar equipa"}</button>
          </div>
        </div>
      )}

      {modal?.kind === "athlete" && (
        <AthleteDetail
          a={modal.a}
          captain={modal.a.id === team.captain}
          score={scoreOf(modal.a)}
          temResultados={temResultados}
          editavel={editavel}
          idComp={idComp}
          onCaptain={() => tornarCapitao(modal.a.id)}
          onSell={() => vender(modal.a.id)}
          onClose={() => setModal(null)}
        />
      )}

      {modal?.kind === "missing" && (
        <div style={overlayBg}>
          <div style={cardBox}>
            <div style={{ width: 84, height: 84, margin: "0 auto 4px" }}><Mascot belt={BELT_HEX} expression="feliz" /></div>
            <h2 style={{ fontFamily: FD, fontSize: 20, fontWeight: 700, textTransform: "uppercase", margin: "4px 0 8px" }}>Falta pouco!</h2>
            <p style={{ fontSize: 13, color: "#c7d0c9", margin: "0 0 12px" }}>Para guardares a equipa ainda precisas de:</p>
            <div style={{ textAlign: "left", display: "flex", flexDirection: "column", gap: 7, marginBottom: 18 }}>
              {missing(team).map((m) => (
                <div key={m} style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
                  <span style={{ color: "#ef8d83", fontWeight: 700 }}>•</span>
                  <span style={{ fontSize: 13, color: "#f1ede2" }}>{m}</span>
                </div>
              ))}
            </div>
            <button onClick={() => setModal(null)} style={primaryBtn}>Continuar a montar</button>
          </div>
        </div>
      )}

      {modal?.kind === "saved" && (
        <div style={overlayBg}>
          <div style={cardBox}>
            <div style={{ width: 88, height: 88, margin: "0 auto 4px" }}><Mascot belt={BELT_HEX} expression="feliz" /></div>
            <h2 style={{ fontFamily: FD, fontSize: 22, fontWeight: 700, textTransform: "uppercase", margin: "4px 0 8px", color: GOLD }}>Equipa salva!</h2>
            <p style={{ fontSize: 14, color: "#c7d0c9", lineHeight: 1.5, margin: "0 0 20px" }}>
              {cloudWarn
                ? "Guardámos a tua equipa neste dispositivo, mas não conseguimos sincronizar com a tua conta agora. Tenta guardar de novo quando tiveres ligação."
                : "A tua equipa está guardada na tua conta e pronta para competir. Boa sorte na próxima rodada!"}
            </p>
            <button onClick={() => setModal(null)} style={primaryBtn}>Fechar</button>
          </div>
        </div>
      )}

      {modal?.kind === "trash" && (
        <div style={overlayBg}>
          <div style={cardBox}>
            <div style={{ width: 84, height: 84, margin: "0 auto 4px" }}><Mascot belt={BELT_HEX} expression="determinado" /></div>
            <h2 style={{ fontFamily: FD, fontSize: 20, fontWeight: 700, textTransform: "uppercase", margin: "4px 0 8px" }}>Limpar a equipa?</h2>
            <p style={{ fontSize: 14, color: "#c7d0c9", lineHeight: 1.5, margin: "0 0 20px" }}>Isto remove todos os atletas e vais ter de escalar de novo.</p>
            <button onClick={limparTudo} style={{ ...primaryBtn, background: "#e2655a", color: "#1b0f0e" }}>Sim, limpar tudo</button>
            <button onClick={() => setModal(null)} style={ghostBtn}>Cancelar</button>
          </div>
        </div>
      )}

      {modal?.kind === "leave" && (
        <div style={overlayBg}>
          <div style={cardBox}>
            <div style={{ width: 84, height: 84, margin: "0 auto 4px" }}><Mascot belt={BELT_HEX} expression="indicando" /></div>
            <h2 style={{ fontFamily: FD, fontSize: 20, fontWeight: 700, textTransform: "uppercase", margin: "4px 0 8px", color: GOLD }}>Cuidado — não percas as alterações</h2>
            <p style={{ fontSize: 14, color: "#c7d0c9", lineHeight: 1.5, margin: "0 0 20px" }}>Tens alterações por guardar. Salva agora para não perderes o teu time.</p>
            <button onClick={() => salvar(leaveTo)} disabled={savingCloud} style={{ ...primaryBtn, opacity: savingCloud ? 0.7 : 1 }}>{savingCloud ? "A guardar…" : "Salvar alterações"}</button>
            <button onClick={() => { setModal(null); setLeaveTo(null); }} style={ghostBtn}>Fechar</button>
          </div>
        </div>
      )}

      {modal?.kind === "share" && (
        <CartaoEquipa
          identity={identity}
          faixa="Branca"
          atletas={resolve(team.ids)}
          capitao={team.captain}
          pro={isPro}
          onClose={() => setModal(null)}
        />
      )}

      {modal?.kind === "incompleta" && (
        <div style={overlayBg}>
          <div style={cardBox}>
            <div style={{ width: 84, height: 84, margin: "0 auto 4px" }}><Mascot belt={BELT_HEX} expression="indicando" /></div>
            <h2 style={{ fontFamily: FD, fontSize: 20, fontWeight: 700, textTransform: "uppercase", margin: "4px 0 8px", color: GOLD }}>Equipa incompleta</h2>
            <p style={{ fontSize: 14, color: "#c7d0c9", lineHeight: 1.5, margin: "0 0 20px" }}>
              {isComplete(saved)
                ? "As tuas alterações estão incompletas e não podem ser guardadas assim. Se saíres, mantemos a tua equipa anterior — completa — e descartamos estas alterações."
                : "Uma equipa só pode ser guardada completa (8 atletas + capitão). Se saíres agora, ficas sem equipa. Queres mesmo sair?"}
            </p>
            <button onClick={sairDescartando} style={{ ...primaryBtn, background: "#e2655a", color: "#1b0f0e" }}>
              {isComplete(saved) ? "Sair e manter a anterior" : "Sair sem equipa"}
            </button>
            <button onClick={() => { setModal(null); setLeaveTo(null); }} style={ghostBtn}>Continuar a montar</button>
          </div>
        </div>
      )}

      {mostrarAvaliacao && (
        <Avaliacao nomeTime={identity.name} onClose={() => setMostrarAvaliacao(false)} />
      )}

      {guide !== null && passoAtual && (
        <TutorialMeuTime
          passos={passos}
          step={guide}
          setStep={setGuide}
          onClose={() => {
            marcarTutorialVisto(emCompeticao ? TUT_COMP_KEY : TUT_EDICAO_KEY);
            setGuide(null);
          }}
        />
      )}
    </main>
  );
}

/* =========================================================================
 * DECOMPOSIÇÃO LUTA-A-LUTA (popup do atleta)
 * ========================================================================= */

interface Rubrica { label: string; quantidade: number; pontos: number; negativo: boolean }
interface LutaDetalhe {
  id_fight: string;
  ronda: string;
  venceu: boolean | null;
  hansoku: boolean;
  pontos: number;
  rubricas: Rubrica[];
}
type EstadoDetalhe =
  | { fase: "carregando" }
  | { fase: "erro" }
  | { fase: "vazio" }
  | { fase: "ok"; lutas: LutaDetalhe[]; total: number };

const sinal = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

function AthleteDetail({ a, captain, score, temResultados, editavel, idComp, onCaptain, onSell, onClose }: { a: Athlete; captain: boolean; score: number; temResultados: boolean; editavel: boolean; idComp: string; onCaptain: () => void; onSell: () => void; onClose: () => void }) {
  const up = a.variation >= 0;
  const [detalhe, setDetalhe] = useState<EstadoDetalhe>({ fase: "carregando" });

  // Busca a decomposição luta-a-luta só quando há resultados (competição a
  // decorrer ou encerrada). Sem resultados não faz sentido (e poupa a chamada).
  useEffect(() => {
    if (!temResultados) return;
    let active = true;
    setDetalhe({ fase: "carregando" });
    fetch(`/api/atleta-rodada?comp=${encodeURIComponent(idComp)}&person=${encodeURIComponent(a.id)}`)
      .then((r) => r.json())
      .then((j) => {
        if (!active) return;
        const lutas: LutaDetalhe[] = Array.isArray(j?.lutas) ? j.lutas : [];
        if (!j || !j.tem_resultados || lutas.length === 0) { setDetalhe({ fase: "vazio" }); return; }
        setDetalhe({ fase: "ok", lutas, total: typeof j.total === "number" ? j.total : 0 });
      })
      .catch(() => { if (active) setDetalhe({ fase: "erro" }); });
    return () => { active = false; };
  }, [a.id, idComp, temResultados]);

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
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#16201b", border: `1px solid ${GOLD}`, borderRadius: 12, padding: "12px 14px", marginBottom: editavel ? 16 : 0 }}>
            <div>
              <div style={{ fontFamily: FD, fontSize: 13, fontWeight: 700, textTransform: "uppercase" }}>Pontos na rodada</div>
              {captain && <div style={{ fontSize: 11, color: "#FF8F00", marginTop: 2 }}>Capitão — pontuação a dobrar</div>}
            </div>
            <div style={{ fontFamily: FD, fontSize: 26, fontWeight: 700, color: GOLD }}>{score >= 0 ? "+" : ""}{score} pts</div>
          </div>
        ) : (
          <div style={{ background: "#141a17", border: "1px solid #243029", borderRadius: 12, padding: "14px", textAlign: "center", fontSize: 12.5, color: "#93a39a", marginBottom: editavel ? 16 : 0 }}>
            A competição ainda não começou. Os pontos deste atleta aparecem aqui durante a rodada.
          </div>
        )}

        {/* DECOMPOSIÇÃO luta-a-luta — só quando há resultados. */}
        {temResultados && (
          <DetalheLutas estado={detalhe} captain={captain} />
        )}

        {/* AÇÕES: só quando editável (mercado aberto). Em competição, não se mexe. */}
        {editavel ? (
          <div style={{ marginTop: 16 }}>
            <button onClick={onCaptain} style={{ ...primaryBtn, background: captain ? "#1c3a2e" : GOLD, color: captain ? "#aee9c9" : "#1b211e" }}>
              {captain ? "Remover capitão" : "Tornar capitão (pontua x2)"}
            </button>
            <button onClick={onSell} style={{ display: "block", width: "100%", marginTop: 10, textAlign: "center", border: "1px solid #5a2f2c", background: "transparent", color: "#ef8d83", padding: "11px", borderRadius: 12, fontSize: 14, fontWeight: 700, fontFamily: FD, textTransform: "uppercase", letterSpacing: "0.03em", cursor: "pointer" }}>Vender</button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// Lista das lutas decompostas (ou estados de carregamento/vazio).
function DetalheLutas({ estado, captain }: { estado: EstadoDetalhe; captain: boolean }) {
  if (estado.fase === "carregando") {
    return (
      <div style={{ marginTop: 14, textAlign: "center", fontSize: 12, color: "#93a39a", fontFamily: FD, letterSpacing: "0.05em" }}>
        A carregar o detalhe…
      </div>
    );
  }
  if (estado.fase === "erro" || estado.fase === "vazio") {
    return (
      <div style={{ marginTop: 14, textAlign: "center", fontSize: 12, color: "#5f6f67" }}>
        {estado.fase === "erro"
          ? "Não foi possível carregar o detalhe agora."
          : "Este atleta ainda não tem lutas registadas nesta competição."}
      </div>
    );
  }

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontFamily: FD, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#93a39a", marginBottom: 10 }}>
        Como pontuou {captain && <span style={{ color: "#FF8F00" }}>· valores simples (capitão dobra no total)</span>}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {estado.lutas.map((l, idx) => (
          <div key={l.id_fight || idx} style={{ background: "#141a17", border: "1px solid #243029", borderRadius: 12, overflow: "hidden" }}>
            {/* Cabeçalho da luta: ronda, resultado, total da luta. */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 12px", background: "#16201b", borderBottom: "1px solid #243029" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <span style={{ fontFamily: FD, fontSize: 12, fontWeight: 700, color: "#cfd8d2", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.ronda}</span>
                {l.venceu === true && <span style={{ fontSize: 9, color: "#7fd1a3", border: "1px solid #2a4d3e", borderRadius: 5, padding: "1px 5px", fontWeight: 700 }}>VITÓRIA</span>}
                {l.venceu === false && <span style={{ fontSize: 9, color: "#ef8d83", border: "1px solid #5a2f2c", borderRadius: 5, padding: "1px 5px", fontWeight: 700 }}>DERROTA</span>}
                {l.hansoku && <span style={{ fontSize: 9, color: "#e2655a", border: "1px solid #5a2f2c", borderRadius: 5, padding: "1px 5px", fontWeight: 700 }}>HANSOKU</span>}
              </div>
              <span style={{ fontFamily: FD, fontSize: 14, fontWeight: 700, color: l.pontos >= 0 ? "#7fd1a3" : "#ef8d83", flexShrink: 0 }}>{sinal(l.pontos)}</span>
            </div>
            {/* Rubricas (ações) da luta. */}
            <div style={{ padding: "8px 12px", display: "flex", flexDirection: "column", gap: 5 }}>
              {l.rubricas.length === 0 ? (
                <div style={{ fontSize: 11.5, color: "#5f6f67", fontStyle: "italic" }}>Sem ações pontuáveis nesta luta.</div>
              ) : (
                l.rubricas.map((r, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 12.5, color: "#d6ddd6" }}>{r.label}</span>
                    <span style={{ fontFamily: FD, fontSize: 12.5, fontWeight: 700, color: r.negativo ? "#ef8d83" : "#7fd1a3" }}>{sinal(r.pontos)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
      {/* Total simples (soma das lutas, sem dobrar). Ajuda a fechar a conta. */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10, padding: "10px 12px", background: "#141a17", border: "1px solid #243029", borderRadius: 12 }}>
        <span style={{ fontFamily: FD, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#93a39a" }}>Total nas lutas</span>
        <span style={{ fontFamily: FD, fontSize: 15, fontWeight: 700, color: GOLD }}>{sinal(estado.total)} pts</span>
      </div>
      {captain && (
        <div style={{ fontSize: 11, color: "#FF8F00", marginTop: 6, textAlign: "center" }}>
          Como capitão, este total conta a dobrar na tua pontuação da rodada.
        </div>
      )}
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

function EmptyCell() {
  return (
    <a href="/mercado" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5, padding: "8px 3px", borderRadius: 12, border: "1.5px dashed rgba(217,164,65,0.7)", background: "rgba(12,14,13,0.62)", textDecoration: "none", minHeight: 92 }}>
      <div style={{ width: 26, height: 26, borderRadius: "50%", border: `2px solid ${GOLD}`, color: GOLD, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, lineHeight: 1 }}>+</div>
      <div style={{ fontSize: 9, color: GOLD, fontWeight: 700, textTransform: "uppercase" }}>Mercado</div>
    </a>
  );
}

function TrashIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" /></svg>;
}
function ShareIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M12 3v13M8 7l4-4 4 4" /></svg>;
}

const overlayBg: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(6,8,7,0.82)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18, zIndex: 110 };
const cardBox: React.CSSProperties = { width: "100%", maxWidth: 320, background: "#121815", border: `1px solid ${GOLD}`, borderRadius: 16, padding: 22, textAlign: "center" };
const primaryBtn: React.CSSProperties = { width: "100%", padding: 13, borderRadius: 12, border: "none", background: GOLD, color: "#1b211e", fontFamily: FD, fontSize: 15, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", cursor: "pointer" };
const ghostBtn: React.CSSProperties = { marginTop: 10, background: "transparent", border: "none", color: "#93a39a", fontSize: 12, cursor: "pointer", fontFamily: FB };

// Tutorial do Meu Time (edição ou competição). Balão em baixo, seta SEMPRE para
// cima (os elementos destacados estão acima do balão). O elemento citado pulsa
// via a classe ilglow aplicada no corpo da página (controlada por `destaque`).
function TutorialMeuTime({ passos, step, setStep, onClose }: { passos: { t: string; x: string; target: string }[]; step: number; setStep: (s: number | null) => void; onClose: () => void }) {
  const s = passos[step];
  const total = passos.length;
  return (
    <div style={{ position: "fixed", left: 0, right: 0, bottom: 20, padding: "0 12px", zIndex: 100 }}>
      <div style={{ maxWidth: 436, margin: "0 auto", display: "flex", gap: 10, alignItems: "flex-end" }}>
        <div style={{ width: 58, height: 58, flexShrink: 0 }}><Mascot belt="#141110" expression="indicando" /></div>
        <div style={{ flex: 1, background: "#121815", border: `1px solid ${GOLD}`, borderRadius: 14, padding: "12px 14px", boxShadow: `0 0 0 3px rgba(217,164,65,0.18)` }}>
          <div className="ilseta" style={{ display: "flex", justifyContent: "center", color: GOLD, margin: "0 0 6px" }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
          </div>
          <div style={{ textAlign: "right", marginBottom: 6 }}>
            <button onClick={onClose} style={{ background: "transparent", border: "none", color: "#cfd8d2", fontSize: 12, cursor: "pointer", fontFamily: FB }}>Pular ✕</button>
          </div>
          <div style={{ fontFamily: FD, fontSize: 14, fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>{s.t}</div>
          <p style={{ fontSize: 12.5, color: "#c7d0c9", lineHeight: 1.45, margin: 0 }}>{s.x}</p>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
            <button onClick={() => step > 0 && setStep(step - 1)} style={{ background: "transparent", border: "none", color: step === 0 ? "#3c463f" : "#93a39a", fontSize: 13, fontWeight: 700, cursor: step === 0 ? "default" : "pointer", fontFamily: FB }}>Anterior</button>
            <span style={{ fontSize: 11, color: "#5f6f67" }}>{step + 1} de {total}</span>
            <button onClick={() => (step === total - 1 ? onClose() : setStep(step + 1))} style={{ background: GOLD, border: "none", color: "#1b211e", padding: "8px 18px", borderRadius: 9, fontFamily: FD, fontSize: 13, fontWeight: 700, textTransform: "uppercase", cursor: "pointer" }}>{step === total - 1 ? "Concluir" : "Seguinte"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
