"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Mascot } from "@/components/Mascot";
import { type Athlete } from "@/lib/athletes";
import { loadDraftFor, saveDraftFor, loadSavedFor, commitSavedFor, resolve, jcLeft, counts, isComplete, missing, loadSavedCloudFor, commitSavedCloudFor, setAthletePool, carryOver, loadLatestSavedCloudExcept, temNomeProprio, loadIdentityCloudFor, type TeamState } from "@/lib/team";
import { Escudo, loadIdentity, DEFAULT_IDENTITY, type Identity } from "@/components/Escudo";
import { CartaoEquipa } from "@/components/CartaoEquipa";
import { temSessao, exigirSessao } from "@/lib/auth";
import { focoMercado, textoFecho, numeroDaRodada, nomeCompeticao } from "@/lib/calendario";
import { tutorialVistoLocal, tutoriaisVistosConta, marcarTutorialVisto, deveMostrarTutorial } from "@/lib/tutorials";
import { Avaliacao, devePedirAvaliacao } from "@/components/Avaliacao";
import { AvisoEquipaGuardada } from "@/components/AvisoEquipaGuardada";
import { useFaixa } from "@/lib/useFaixa";
// Nível da tabela `users` (a mesma fonte do servidor), não do user_metadata.
import { useNivel } from "@/lib/useNivel";
import { supabase } from "@/lib/supabase";
import { PRECO } from "@/lib/precos";
import { useT } from "@/lib/i18n";
const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";
const IOC: Record<string, string> = {
  JP: "JPN", FR: "FRA", BR: "BRA", GE: "GEO", KZ: "KAZ", AZ: "AZE", BE: "BEL",
  TR: "TUR", UZ: "UZB", RU: "AIN", DE: "GER", XK: "KOS", IT: "ITA", CA: "CAN",
  SI: "SLO", HR: "CRO", NL: "NED",
};
const code3 = (iso: string) => IOC[iso] || iso;
const fmt = (n: number) => String(Math.round(n * 10) / 10);
// Competição vinda do Calendário Oficial. A "atual" é a da semana; se o mercado dela
// já fechou (início - 1h), escala-se para a "próxima". Ver focoMercado em lib/calendario.
//
// NOME DA COMPETIÇÃO: usar SEMPRE nomeCompeticao(s) e nunca s.nome cru. Num
// clássico, o nome cru revela a cidade ("Grand Prix The Hague 2018") — e quem a
// vê antes de escalar vai ao JudoBase buscar os resultados de 2018 e monta a
// equipa perfeita. A função esconde a cidade enquanto o mercado está aberto.
// Junta a identidade da CONTA (nuvem) por cima da que temos em memória.
// A nuvem é a fonte de verdade do nome/escudo: o localStorage perde-se ao mudar
// de aparelho ou limpar o browser.
function juntarIdentidade(prev: Identity, idc: { name?: string; escudo?: Record<string, unknown> | null } | null): Identity {
  if (!idc) return prev;
  return {
    ...prev,
    ...(idc.escudo ? (idc.escudo as Partial<Identity>) : {}),
    ...(idc.name ? { name: idc.name } : {}),
  };
}
type Guide = "welcome" | "counter" | "slot" | "captain" | "actions" | null;
type Modal = { kind: "missing" | "saved" | "trash" | "share" | "login" | "leave" | "precisaNome" } | { kind: "athlete"; a: Athlete } | null;
// Resultado do carry-over para mostrar no banner "Reescala o teu time".
type Carry = { dropped: string[]; captainDropped: boolean } | null;
function sameTeam(a: TeamState, b: TeamState): boolean {
  if ((a.captain || "") !== (b.captain || "")) return false;
  if (a.ids.length !== b.ids.length) return false;
  return [...a.ids].sort().join(",") === [...b.ids].sort().join(",");
}
export default function CriarEquipa() {
  const t = useT();
  const [guide, setGuide] = useState<Guide>(null);
  const [draft, setDraft] = useState<TeamState>({ ids: [], captain: null });
  const [saved, setSaved] = useState<TeamState>({ ids: [], captain: null });
  const [modal, setModal] = useState<Modal>(null);
  const [mostrarAvaliacao, setMostrarAvaliacao] = useState(false);
  // Aviso "e agora?" logo depois de guardar (uma vez, com não-mostrar-mais).
  const [avisoGuardada, setAvisoGuardada] = useState(false);
  const [identity, setIdentity] = useState<Identity>(DEFAULT_IDENTITY);
  const [savingCloud, setSavingCloud] = useState(false);
  const [leaveTo, setLeaveTo] = useState<string | null>(null);
  const [cloudWarn, setCloudWarn] = useState(false);
  const [carry, setCarry] = useState<Carry>(null); // atletas que sairam no carry-over
  const { ehPro: isPro } = useNivel();
  const [, bumpPool] = useState(0); // força um re-render quando a lista de atletas carrega
  const router = useRouter();
  // Faixa REAL do jogador (cor para o Dôdo, nome para o cartão de partilha).
  const { cor: corFaixa, nome: nomeFaixa } = useFaixa();
  // Foco do mercado (regra única no calendário): competição-alvo (mercado aberto),
  // a que está a decorrer (mercado fechado) e o estado para a contagem.
  const foco = focoMercado();
  const atual = foco.atual;
  const emAndamento = foco.aDecorrer !== null;
  const alvo = foco.alvo; // a competição para a qual se ESCALA agora
  const rodadaAlvo = numeroDaRodada(alvo.idCompeticao); // nº da rodada no calendário (1..52) ou null
  // Nomes a MOSTRAR (cidade escondida nos clássicos com mercado aberto).
  const nomeAlvo = nomeCompeticao(alvo);
  const nomeAtual = nomeCompeticao(atual);
  useEffect(() => {
      let active = true;
      const idAlvo = alvo.idCompeticao;
      try {
        // Guia do Dojo: só aparece se ainda não foi visto neste aparelho NEM na conta.
        if (!tutorialVistoLocal("ippon_team_tutorial")) {
          tutoriaisVistosConta().then((vistos) => {
              if (!active) return;
              if (vistos["ippon_team_tutorial"]) {
                try { localStorage.setItem("ippon_team_tutorial", "done"); } catch {}
              } else {
                setGuide("welcome");
              }
            });
        }
      } catch {}
      // Carrega a lista de atletas desta competição (mesma fonte do Mercado). Sem isto,
      // o resolve() não traduz os ids da equipa e o Dojo aparece "0/8" mesmo com equipa.
      // Esta lista é também a de INSCRITOS usada pelo carry-over (quem não está aqui,
        // não está inscrito nesta competição).
      fetch(`/api/atletas?id=${idAlvo}`)
      .then((r) => r.json())
      .then((j) => {
          if (!active) return;
          const list: Athlete[] = Array.isArray(j?.atletas) ? j.atletas : [];
          if (list.length > 0) {
            setAthletePool(list);
            bumpPool((t) => t + 1);
            // CARRY-OVER: só quando esta competição ainda está MESMO vazia (sem
              // rascunho, sem guardado local e sem nuvem) E só depois de termos a
            // lista de inscritos. Traz a última equipa guardada e larga os não
            // inscritos. Só semeia o rascunho — não há commit automático.
            tryCarryOver(idAlvo, list);
          }
        })
      .catch(() => {});
      // Corre o carry-over quando a competição-alvo está vazia. `inscritos` é a
      // lista de atletas desta competição (a pool acabada de carregar). A guarda
      // de segurança contra inscritos vazios vive dentro de carryOver().
      async function tryCarryOver(idComp: string, inscritos: Athlete[]) {
        // Não mexer se já há rascunho ou equipa guardada local nesta competição.
        const draftLocal = loadDraftFor(idComp);
        const savedLocal = loadSavedFor(idComp);
        if (draftLocal.ids.length > 0 || savedLocal.ids.length > 0) return;
        if (!(await temSessao())) return;
        // Não mexer se já existe equipa na nuvem para esta competição.
        const cloudAlvo = await loadSavedCloudFor(idComp);
        if (!active) return;
        if (cloudAlvo && cloudAlvo.ids.length > 0) return;
        // Base = última equipa guardada noutra competição.
        const anterior = await loadLatestSavedCloudExcept(idComp);
        if (!active || !anterior) return;
        const inscritosIds = inscritos.map((a) => a.id);
        const res = carryOver(anterior.team, inscritosIds);
        // Se, entretanto, o utilizador já começou a montar, não sobrescrever.
        const draftAgora = loadDraftFor(idComp);
        if (draftAgora.ids.length > 0) return;
        setDraft(res.team);
        saveDraftFor(idComp, res.team);
        if (res.dropped.length > 0 || res.captainDropped) {
          setCarry({ dropped: res.dropped, captainDropped: res.captainDropped });
        }
      }
      temSessao().then((logado) => {
          if (!active || !logado) return;
          try {
            setIdentity(loadIdentity());
            const localSaved = loadSavedFor(idAlvo);
            let localDraft = loadDraftFor(idAlvo);
            setSaved(localSaved);
            // BUG 2: se o rascunho desta competição está vazio mas há equipa guardada
            // localmente, parte dessa equipa — em vez de abrir o Dojo em branco.
            if (localDraft.ids.length === 0 && localSaved.ids.length > 0) {
              localDraft = localSaved;
              saveDraftFor(idAlvo, localDraft);
            }
            setDraft(localDraft);
          } catch {}
          // IDENTIDADE DA CONTA (nuvem) por cima da local. Sem isto, abrir a app num
          // browser/telemóvel novo mostrava "A minha equipa" — e ao guardar pedia o
          // nome outra vez a quem já o tinha (e gravava o nome por omissão na conta).
          loadIdentityCloudFor(idAlvo).then((idc) => {
              if (!active || !idc) return;
              setIdentity((prev) => juntarIdentidade(prev, idc));
            }).catch(() => {});
          loadSavedCloudFor(idAlvo).then((cloud) => {
              if (!active || !cloud || cloud.ids.length === 0) return;
              setSaved(cloud);
              const curDraft = loadDraftFor(idAlvo);
              const curSaved = loadSavedFor(idAlvo);
              // Adota a equipa da nuvem como ponto de partida da edição SÓ se o utilizador
              // ainda não começou a editar: rascunho vazio, OU rascunho igual ao guardado
              // local (sem alterações por guardar). Assim nunca apagamos edições em curso.
              if (curDraft.ids.length === 0 || sameTeam(curDraft, curSaved)) {
                setDraft(cloud);
                saveDraftFor(idAlvo, cloud);
                commitSavedFor(idAlvo, cloud);
              }
            });
        });
      return () => { active = false; };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
  const dirty = !sameTeam(draft, saved) && draft.ids.length > 0;
  // O rascunho fica gravado localmente a cada alteração. Ao sair com alterações
  // por guardar, avisamos (sem bloquear): a pessoa decide sair ou ficar.
  function tryLeave(href: string) {
    if (dirty) { setLeaveTo(href); setModal({ kind: "leave" }); return; }
    router.push(href);
  }
  function update(next: TeamState) { setDraft(next); saveDraftFor(alvo.idCompeticao, next); }
  function naoMostrarMais() { marcarTutorialVisto("ippon_team_tutorial"); setGuide(null); }
  function openGuide() { setGuide("welcome"); }
  function setCaptain(id: string) {
    update({ ...draft, captain: draft.captain === id ? null : id });
    setModal(null);
  }
  function clearAll() { update({ ids: [], captain: null }); setCarry(null); setModal(null); }
  function sell(id: string) {
    update({ ids: draft.ids.filter((x) => x !== id), captain: draft.captain === id ? null : draft.captain });
    setModal(null);
  }
  async function save() {
    if (!(await temSessao())) { setModal({ kind: "login" }); return; }
    if (!isComplete(draft)) { setModal({ kind: "missing" }); return; }
    setSavingCloud(true);
    // Antes de gravar: se a identidade em memória ainda é a por omissão, vai
    // confirmar à CONTA. Evita gravar "A minha equipa" por cima do nome real e
    // evita pedir o nome a quem já o definiu noutro aparelho.
    let ident = identity;
    if (!temNomeProprio(ident)) {
      const idc = await loadIdentityCloudFor(alvo.idCompeticao);
      if (idc) { ident = juntarIdentidade(ident, idc); setIdentity(ident); }
    }
    const res = await commitSavedCloudFor(alvo.idCompeticao, draft, ident);
    setSaved(draft);
    // Sincroniza o rascunho local com o guardado, para não ficar um rascunho
    // "fantasma" que faria o meu-time pedir para guardar sem haver alterações.
    saveDraftFor(alvo.idCompeticao, draft);
    setCarry(null); // a partir daqui a equipa desta competição está confirmada
    setSavingCloud(false);
    setCloudWarn(!res.ok);
    // FUNIL DO NOME: a equipa está guardada. Mas se o time ainda não tem nome
    // próprio (é "A minha equipa" ou vazio), a pessoa TEM de o definir — é a sua
    // identidade na liga. Mostramos uma notificação de saída única que a leva
    // obrigatoriamente ao /escudo. Se já tem nome, segue o fluxo normal.
    if (!temNomeProprio(ident)) {
      setModal({ kind: "precisaNome" });
      return;
    }
    // AVISO "E AGORA?": o momento mais importante do fluxo. A pessoa acabou de
    // montar a equipa e, sem isto, ficava sem saber o que esperar — foi um
    // feedback real de quem testou. Uma vez só; quem já percebeu o ciclo tem
    // "não mostrar mais".
    if (res.ok && (await deveMostrarTutorial("ippon_aviso_pos_guardar"))) {
      setAvisoGuardada(true);
      return;
    }
    if (res.ok && devePedirAvaliacao()) {
      // Fim da jornada (conta + equipa + nome): pede avaliação se for altura.
      // Ao fechar a avaliação, segue para a vista de gestão (/meu-time).
      setMostrarAvaliacao(true);
      return;
    }
    // Equipa guardada e com nome: vai para a vista de gestão da equipa
    // (/meu-time), com património, valor e "Ver Mercado" — em vez de ficar
    // preso na vista de montagem.
    router.push("/meu-time");
  }
  // Depois de fechar o aviso "e agora?": segue o mesmo caminho que seguiria se
  // ele não existisse (avaliação, se for altura; senão, a vista de gestão).
  function fecharAvisoGuardada() {
    setAvisoGuardada(false);
    if (devePedirAvaliacao()) { setMostrarAvaliacao(true); return; }
    router.push("/meu-time");
  }
  const all = resolve(draft.ids);
  const males = all.filter((a) => a.gender === "M");
  const females = all.filter((a) => a.gender === "F");
  const total = all.length;
  const left = jcLeft(draft);
  const firstEmpty = males.length < 4 ? { row: "M", i: males.length } : females.length < 4 ? { row: "F", i: females.length } : null;
  function renderRow(list: Athlete[], row: "M" | "F") {
    return Array.from({ length: 4 }).map((_, i) => {
        const a = list[i];
        const highlight = guide === "slot" && firstEmpty != null && firstEmpty.row === row && firstEmpty.i === i;
        return a
        ? <FilledSlot key={row + i} a={a} isCaptain={draft.captain === a.id} onClick={() => setModal({ kind: "athlete", a })} />
        : <EmptySlot key={row + i} highlight={highlight} />;
      });
  }
  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: FB }}>
    <style>{`@keyframes ilglow{0%,100%{box-shadow:0 0 0 3px rgba(74,144,217,0.55)}50%{box-shadow:0 0 0 8px rgba(74,144,217,0.18)}} .ilglow{animation:ilglow 1.3s ease-in-out infinite;border-radius:10px} @keyframes ilsave{0%,100%{box-shadow:0 0 0 0 rgba(217,164,65,0.0)}50%{box-shadow:0 0 0 6px rgba(217,164,65,0.30)}} .ilsave{animation:ilsave 1.2s ease-in-out infinite} @keyframes ilsavebig{0%{transform:scale(1)}30%{transform:scale(1.06)}60%{transform:scale(0.98)}100%{transform:scale(1)}} .ilsavebig{animation:ilsave 1.2s ease-in-out infinite, ilsavebig 0.5s ease-in-out 2} @keyframes ilpulse{0%,100%{opacity:1}50%{opacity:.3}} .ilpulse{animation:ilpulse 1.2s ease-in-out infinite} @keyframes ilseta{0%,100%{transform:translateY(0)}50%{transform:translateY(5px)}} .ilseta{animation:ilseta 0.9s ease-in-out infinite}`}</style>
    <div style={{ maxWidth: 460, margin: "0 auto", padding: "14px 14px 150px" }}>
    <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 14 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
    <a href="/inicio" onClick={(e) => { e.preventDefault(); tryLeave("/inicio"); }} aria-label="Voltar" style={{ width: 36, height: 36, borderRadius: "50%", border: "1px solid #243029", display: "flex", alignItems: "center", justifyContent: "center", color: "#cfd8d2", textDecoration: "none", flexShrink: 0 }}>
    <BackIcon />
    </a>
    <div style={{ display: "flex", alignItems: "center", gap: 11, color: "#f1ede2", minWidth: 0 }}>
    <div style={{ flexShrink: 0, display: "flex" }}><Escudo config={identity} size={40} /></div>
    <div style={{ minWidth: 0 }}>
    <h1 style={{ fontFamily: FD, fontSize: 18, fontWeight: 700, textTransform: "uppercase", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{identity.name}</h1>
    <div style={{ fontSize: 11, color: "#93a39a" }}>1 por categoria · 4 masc + 4 fem</div>
    </div>
    </div>
    </div>
    <button onClick={openGuide} aria-label="Como montar a equipa" style={{ width: 36, height: 36, borderRadius: "50%", border: "1px solid #243029", background: "transparent", color: "#93a39a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>?</button>
    </header>
    {/* Banner do carry-over: atletas da equipa anterior que não estão inscritos
      nesta competição sairam; o JC deles já voltou pelo preço atual. */}
    {carry && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 11, background: "linear-gradient(160deg,#2a2410,#10160f)", border: "1px solid #5a4a18", borderLeft: `3px solid ${GOLD}`, borderRadius: 12, padding: "11px 13px", marginBottom: 10 }}>
        <div style={{ width: 34, height: 34, flexShrink: 0 }}><Mascot belt={corFaixa} expression="indicando" /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: FD, fontSize: 14, fontWeight: 700, textTransform: "uppercase", color: GOLD }}>{t("ce.reescala")}</div>
        <p style={{ fontSize: 12, color: "#c7d0c9", lineHeight: 1.45, margin: "5px 0 0" }}>
        {carry.dropped.length === 1
          ? "1 atleta da tua equipa não está inscrito nesta competição e saiu."
          : `${carry.dropped.length} atletas da tua equipa não estão inscritos nesta competição e sairam.`}
        {carry.captainDropped ? " O teu capitão era um deles — escolhe um novo." : ""}
        {" "}Os JC voltaram pelo preço atual. Escala quem falta (ou refaz tudo) e guarda.
        </p>
        <button onClick={() => setCarry(null)} style={{ marginTop: 8, background: "transparent", border: "none", color: "#93a39a", fontSize: 11, cursor: "pointer", fontFamily: FB, padding: 0 }}>{t("ce.percebiDispensar")}</button>
        </div>
        </div>
      )}
    {/* Quando há competição a decorrer, mostra-a com aviso de que se escala para a próxima. */}
    {emAndamento && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 11, background: "linear-gradient(160deg,#2a1f1c,#10160f)", border: "1px solid #5a3a36", borderLeft: "3px solid #e2655a", borderRadius: 12, padding: "10px 13px", marginBottom: 10 }}>
        <span className="ilpulse" style={{ width: 9, height: 9, borderRadius: "50%", background: "#e2655a", marginTop: 4, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#e2655a" }}>A decorrer agora{atual.classico ? " · Clássico" : ""}</div>
        <div style={{ fontFamily: FD, fontSize: 14, fontWeight: 700, lineHeight: 1.1, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nomeAtual}</div>
        <p style={{ fontSize: 12, color: "#c7d0c9", lineHeight: 1.45, margin: "6px 0 0" }}>
        O mercado desta competição já fechou — os preços podem oscilar enquanto os atletas competem. <strong style={{ color: "#f1ede2" }}>{t("ce.jaPodesEscalar")}</strong> {nomeAlvo} — {textoFecho(alvo)}.
        </p>
        </div>
        </div>
      )}
    {/* Cabeçalho: a competição para a qual se está a escalar (alvo).
      NOTA: nomeAlvo esconde a cidade se for um clássico de mercado aberto. */}
    <div style={{ display: "flex", alignItems: "center", gap: 11, background: "linear-gradient(160deg,#1c3a2e,#10160f)", border: "1px solid #2a4d3e", borderLeft: `3px solid ${GOLD}`, borderRadius: 12, padding: "10px 13px", marginBottom: 14 }}>
    <div style={{ width: 34, height: 34, borderRadius: 8, background: GOLD, color: "#1b211e", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
    <TrophyIcon />
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#7fd1a3" }}>A escalar para{rodadaAlvo ? ` · Rodada ${rodadaAlvo}` : ""}{alvo.classico ? " · Clássico" : ""}</div>
    <div style={{ fontFamily: FD, fontSize: 16, fontWeight: 700, textTransform: "uppercase", lineHeight: 1.05, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nomeAlvo}</div>
    <div style={{ fontSize: 11, color: "#93a39a", marginTop: 2 }}>{textoFecho(alvo)}</div>
    </div>
    <span style={{ background: "#1b211e", color: GOLD, fontSize: 10, fontWeight: 700, textTransform: "uppercase", padding: "4px 9px", borderRadius: 7, whiteSpace: "nowrap", flexShrink: 0 }}>{alvo.nivel}</span>
    </div>
    <div style={{ background: "#2f6fb3", border: "2px solid #25588f", borderRadius: 16, padding: 10 }}>
    <div style={{ background: "#e6b422", border: "2px solid #f0cf6a", borderRadius: 10, padding: "12px 10px" }}>
    <SectionLabel>{t("mt.masculino")}</SectionLabel>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 14 }}>{renderRow(males, "M")}</div>
    <SectionLabel>{t("mt.feminino")}</SectionLabel>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>{renderRow(females, "F")}</div>
    </div>
    </div>
    <p style={{ fontSize: 12, color: "#93a39a", textAlign: "center", marginTop: 14 }}>
    Toca num lugar livre para abrir o Mercado. Toca num atleta para o tornar capitão.
    </p>
    {!isPro && (
        <a href="/ippon-pro" onClick={(e) => { e.preventDefault(); tryLeave("/ippon-pro"); }} style={{ display: "flex", alignItems: "center", gap: 12, background: GOLD, borderRadius: 16, padding: "10px 14px", marginTop: 16, textDecoration: "none" }}>
        <div style={{ flex: 1 }}>
        <div style={{ fontFamily: FD, fontSize: 15, fontWeight: 700, color: "#3a2a08", textTransform: "uppercase" }}>{t("ce.seProAvalia")}</div>
        <div style={{ fontSize: 11.5, color: "#5c4410", marginTop: 2 }}>{t("ce.seProSub")}</div>
        <div style={{ fontSize: 11.5, color: "#3a2a08", fontWeight: 700, marginTop: 3 }}>{PRECO.premios}</div>
        <span style={{ display: "inline-block", marginTop: 8, background: "#1b211e", color: GOLD, fontSize: 11, fontWeight: 700, padding: "6px 12px", borderRadius: 8 }}>{t("ce.verIpponPro")}</span>
        </div>
        <div style={{ width: 66, height: 66, flexShrink: 0 }}><Mascot belt={corFaixa} expression="sabio" /></div>
        </a>
      )}
    </div>
    <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 50 }}>
    <div style={{ background: "#0f1411", borderTop: "1px solid #243029", padding: "9px 14px" }}>
    <div style={{ maxWidth: 460, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
    <div className={guide === "counter" ? "ilglow" : undefined} style={{ padding: "2px 6px" }}>
    <div><span style={{ fontFamily: FD, fontSize: 17, fontWeight: 700, color: GOLD }}>{total}</span><span style={{ fontFamily: FD, fontSize: 13, fontWeight: 700, color: "#93a39a" }}>/8</span></div>
    <div style={{ fontSize: 11, color: "#cfd8d2" }}>JC {fmt(left)}</div>
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
    <button onClick={() => setModal({ kind: "trash" })} aria-label="Limpar equipa" style={roundBtn("#3a2422", "#ef8d83")}>
    <TrashIcon />
    </button>
    <button onClick={() => setModal({ kind: "share" })} aria-label="Partilhar equipa" style={roundBtn("#243029", "#cfd8d2")}>
    <ShareIcon />
    </button>
    <button onClick={save} disabled={savingCloud} className={dirty && !savingCloud ? "ilsave" : undefined} style={{ background: GOLD, color: "#1b211e", border: "none", fontFamily: FD, fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", padding: "11px 18px", borderRadius: 10, cursor: savingCloud ? "default" : "pointer", opacity: savingCloud ? 0.7 : 1 }}>{savingCloud ? "A guardar…" : "Salvar equipa"}</button>
    </div>
    </div>
    </div>
    </div>
    {guide === "welcome" && (
        <div style={overlayBg}>
        <div style={cardBox}>
        <div style={{ width: 90, height: 90, margin: "0 auto 4px" }}><Mascot belt={corFaixa} expression="feliz" /></div>
        <h2 style={{ fontFamily: FD, fontSize: 22, fontWeight: 700, textTransform: "uppercase", margin: "4px 0 8px" }}>{t("ce.vamosMontar")}</h2>
        <p style={{ fontSize: 14, color: "#c7d0c9", lineHeight: 1.55, margin: "0 0 20px" }}>Eu guio-te! Toca onde eu indicar e, em segundos, tens a tua equipa de 8 atletas pronta para competir.</p>
        <button onClick={() => setGuide("counter")} style={primaryBtn}>{t("inicio.vamos")}</button>
        <button onClick={naoMostrarMais} style={ghostBtn}>{t("comum.naoMostrarMais")}</button>
        </div>
        </div>
      )}
    {guide === "counter" && (
        <CoachBubble dir="down" cor={corFaixa}>
        <p style={coachP}>{t("ce.contador", { total: `${total}/8` })}</p>
        <button onClick={() => setGuide("slot")} style={{ ...nextBtn, marginTop: 10 }}>{t("comum.seguinte")}</button>
        <button onClick={naoMostrarMais} style={{ ...skipLink, marginTop: 8 }}>{t("comum.naoMostrarMais")}</button>
        </CoachBubble>
      )}
    {guide === "slot" && (
        <CoachBubble dir="up" cor={corFaixa}>
        <p style={coachP}>{t("ce.tocaLugar", { lugar: t("ce.lugarDestacado") })}</p>
        <button onClick={() => setGuide("captain")} style={{ ...nextBtn, marginTop: 10 }}>{t("comum.seguinte")}</button>
        <button onClick={naoMostrarMais} style={{ ...skipLink, marginTop: 8 }}>{t("comum.naoMostrarMais")}</button>
        </CoachBubble>
      )}
    {guide === "captain" && (
        <CoachBubble dir="up" cor={corFaixa}>
        <p style={coachP}>{t("ce.tocaAtleta", { capitao: t("ce.tornaresCapitao"), vender: t("ce.venderes") })}</p>
        <button onClick={() => setGuide("actions")} style={{ ...nextBtn, marginTop: 10 }}>{t("comum.seguinte")}</button>
        <button onClick={naoMostrarMais} style={{ ...skipLink, marginTop: 8 }}>{t("comum.naoMostrarMais")}</button>
        </CoachBubble>
      )}
    {guide === "actions" && (
        <CoachBubble dir="down" cor={corFaixa}>
        <p style={coachP}>{t("ce.rodape", { limpa: t("ce.limpa"), partilha: t("ce.partilha"), salvar: t("ce.salvarEquipa") })}</p>
        <button onClick={naoMostrarMais} style={{ ...nextBtn, marginTop: 10 }}>{t("ce.concluir")}</button>
        </CoachBubble>
      )}
    {modal?.kind === "missing" && (
        <div style={overlayBg}>
        <div style={cardBox}>
        <div style={{ width: 84, height: 84, margin: "0 auto 4px" }}><Mascot belt={corFaixa} expression="feliz" /></div>
        <h2 style={{ fontFamily: FD, fontSize: 20, fontWeight: 700, textTransform: "uppercase", margin: "4px 0 8px" }}>{t("mt.faltaPouco")}</h2>
        <p style={{ fontSize: 13, color: "#c7d0c9", margin: "0 0 12px" }}>{t("mt.paraGuardar")}</p>
        <div style={{ textAlign: "left", display: "flex", flexDirection: "column", gap: 7, marginBottom: 18 }}>
        {missing(draft).map((m) => (
              <div key={m} style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
              <span style={{ color: "#ef8d83", fontWeight: 700 }}>•</span>
              <span style={{ fontSize: 13, color: "#f1ede2" }}>{m}</span>
              </div>
            ))}
        </div>
        <button onClick={() => setModal(null)} style={primaryBtn}>{t("mt.continuarMontar")}</button>
        </div>
        </div>
      )}
    {modal?.kind === "login" && (
        <div style={overlayBg}>
        <div style={cardBox}>
        <div style={{ width: 84, height: 84, margin: "0 auto 4px" }}><Mascot belt={corFaixa} expression="indicando" /></div>
        <h2 style={{ fontFamily: FD, fontSize: 20, fontWeight: 700, textTransform: "uppercase", margin: "4px 0 8px" }}>{t("ce.entraGuardar")}</h2>
        <p style={{ fontSize: 14, color: "#c7d0c9", lineHeight: 1.5, margin: "0 0 20px" }}>{t("ce.entraGuardarSub")}</p>
        <button onClick={() => exigirSessao("/criar-equipa")} style={primaryBtn}>{t("mk.entrarCriar")}</button>
        <button onClick={() => setModal(null)} style={ghostBtn}>{t("mk.agoraNao")}</button>
        </div>
        </div>
      )}
    {mostrarAvaliacao && (
        <Avaliacao nomeTime={identity.name} onClose={() => { setMostrarAvaliacao(false); router.push("/meu-time"); }} />
      )}
    {/* AVISO "e agora?" — logo depois de guardar a equipa, uma vez. */}
    {avisoGuardada && (
        <AvisoEquipaGuardada
        nomeCompeticao={nomeAlvo}
        rodada={rodadaAlvo}
        onFechar={fecharAvisoGuardada}
        />
      )}
    {modal?.kind === "saved" && (
        <div style={overlayBg}>
        <div style={cardBox}>
        <div style={{ width: 88, height: 88, margin: "0 auto 4px" }}><Mascot belt={corFaixa} expression="feliz" /></div>
        <h2 style={{ fontFamily: FD, fontSize: 22, fontWeight: 700, textTransform: "uppercase", margin: "4px 0 8px", color: GOLD }}>{t("mt.equipaSalva")}</h2>
        <p style={{ fontSize: 14, color: "#c7d0c9", lineHeight: 1.5, margin: "0 0 20px" }}>
        {cloudWarn
          ? t("mt.guardadoSoAqui")
          : t("mt.guardadaNaConta")}
        </p>
        <button onClick={() => setModal(null)} style={primaryBtn}>{t("comum.fechar")}</button>
        </div>
        </div>
      )}
    {modal?.kind === "precisaNome" && (
        <div style={overlayBg}>
        <div style={cardBox}>
        <div style={{ width: 88, height: 88, margin: "0 auto 4px" }}><Mascot belt={corFaixa} expression="feliz" /></div>
        <h2 style={{ fontFamily: FD, fontSize: 20, fontWeight: 700, textTransform: "uppercase", margin: "4px 0 8px", color: GOLD }}>{t("mt.equipaSalva")}</h2>
        <p style={{ fontSize: 14, color: "#c7d0c9", lineHeight: 1.5, margin: "0 0 8px" }}>
        {t("ce.faltaPasso").split(/(%A%)/).map((seg, i) =>
          seg === "%A%" ? <strong key={i} style={{ color: "#f1ede2" }}>{t("ce.daNome")}</strong> : seg
        )}
        </p>
        <p style={{ fontSize: 12.5, color: "#93a39a", lineHeight: 1.5, margin: "0 0 20px" }}>{t("ce.daNomeSub")}</p>
        <button onClick={() => { window.location.href = "/escudo?voltar=/inicio&obrigatorio=1"; }} style={primaryBtn}>{t("ce.darNomeBtn")}</button>
        </div>
        </div>
      )}
    {modal?.kind === "trash" && (
        <div style={overlayBg}>
        <div style={cardBox}>
        <div style={{ width: 84, height: 84, margin: "0 auto 4px" }}><Mascot belt={corFaixa} expression="determinado" /></div>
        <h2 style={{ fontFamily: FD, fontSize: 20, fontWeight: 700, textTransform: "uppercase", margin: "4px 0 8px" }}>{t("mt.limparEquipa")}</h2>
        <p style={{ fontSize: 14, color: "#c7d0c9", lineHeight: 1.5, margin: "0 0 20px" }}>{t("mt.limparEquipaSub")}</p>
        <button onClick={clearAll} style={{ ...primaryBtn, background: "#e2655a", color: "#1b0f0e" }}>{t("mt.simLimpar")}</button>
        <button onClick={() => setModal(null)} style={ghostBtn}>{t("comum.cancelar")}</button>
        </div>
        </div>
      )}
    {modal?.kind === "share" && (
        <CartaoEquipa
        identity={identity}
        faixa={nomeFaixa}
        atletas={resolve(draft.ids)}
        capitao={draft.captain}
        pro={isPro}
        onClose={() => setModal(null)}
        />
      )}
    {modal?.kind === "leave" && (
        <div style={overlayBg}>
        <div style={cardBox}>
        <div style={{ width: 84, height: 84, margin: "0 auto 4px" }}><Mascot belt={corFaixa} expression="indicando" /></div>
        <h2 style={{ fontFamily: FD, fontSize: 20, fontWeight: 700, textTransform: "uppercase", margin: "4px 0 8px" }}>{t("ce.sairSemGuardar")}</h2>
        <p style={{ fontSize: 14, color: "#c7d0c9", lineHeight: 1.5, margin: "0 0 20px" }}>{t("ce.sairSemGuardarSub")}</p>
        <button onClick={() => { const to = leaveTo; setModal(null); setLeaveTo(null); if (to) router.push(to); }} style={{ ...primaryBtn, background: "#e2655a", color: "#1b0f0e" }}>{t("ce.sairBtn")}</button>
        <button onClick={() => { setModal(null); setLeaveTo(null); }} style={ghostBtn}>{t("mt.continuarMontar")}</button>
        </div>
        </div>
      )}
    {modal?.kind === "athlete" && (
        <div style={overlayBg}>
        <div style={cardBox}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <div style={{ width: 44, height: 48, borderRadius: 8, background: "linear-gradient(160deg,#2a4d3e,#1c3a2e)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <div style={{ background: "#f1ede2", color: "#1b211e", fontFamily: FD, fontWeight: 700, fontSize: 9, padding: "1px 4px", borderRadius: 3 }}>{code3(modal.a.countryIso)}</div>
        </div>
        <div style={{ textAlign: "left" }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>{modal.a.name}</div>
        <div style={{ fontSize: 12, color: "#93a39a" }}>{code3(modal.a.countryIso)} · {modal.a.category}kg · <span style={{ color: GOLD }}>JC {modal.a.priceJc.toFixed(1)}</span></div>
        </div>
        </div>
        <button onClick={() => setCaptain(modal.a.id)} style={{ ...primaryBtn, background: draft.captain === modal.a.id ? "#1c3a2e" : GOLD, color: draft.captain === modal.a.id ? "#aee9c9" : "#1b211e" }}>
        {draft.captain === modal.a.id ? t("mt.removerCapitao") : t("mt.tornarCapitao")}
        </button>
        <button onClick={() => sell(modal.a.id)} style={{ display: "block", width: "100%", marginTop: 10, textAlign: "center", border: "1px solid #5a2f2c", background: "transparent", color: "#ef8d83", padding: "11px", borderRadius: 12, fontSize: 14, fontWeight: 700, fontFamily: FD, textTransform: "uppercase", letterSpacing: "0.03em", cursor: "pointer" }}>{t("mt.vender")}</button>
        <button onClick={() => setModal(null)} style={ghostBtn}>{t("comum.fechar")}</button>
        </div>
        </div>
      )}
    </main>
  );
}
const overlayBg: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(6,8,7,0.82)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18, zIndex: 100 };
const cardBox: React.CSSProperties = { width: "100%", maxWidth: 320, background: "#121815", border: `1px solid ${GOLD}`, borderRadius: 16, padding: 22, textAlign: "center" };
const primaryBtn: React.CSSProperties = { width: "100%", padding: 13, borderRadius: 12, border: "none", background: GOLD, color: "#1b211e", fontFamily: FD, fontSize: 15, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", cursor: "pointer" };
const ghostBtn: React.CSSProperties = { marginTop: 10, background: "transparent", border: "none", color: "#93a39a", fontSize: 12, cursor: "pointer", fontFamily: FB };
const nextBtn: React.CSSProperties = { background: GOLD, border: "none", color: "#1b211e", padding: "8px 18px", borderRadius: 9, fontFamily: FD, fontSize: 13, fontWeight: 700, textTransform: "uppercase", cursor: "pointer", alignSelf: "flex-start" };
const skipLink: React.CSSProperties = { background: "transparent", border: "none", color: "#93a39a", fontSize: 11, cursor: "pointer", fontFamily: FB, padding: 0, alignSelf: "flex-start" };
const coachP: React.CSSProperties = { fontSize: 13, color: "#f1ede2", margin: 0, lineHeight: 1.45 };
function SetaCoach({ dir }: { dir: "up" | "down" }) {
  return (
    <div className="ilseta" style={{ display: "flex", justifyContent: "center", color: GOLD, margin: dir === "up" ? "0 0 6px" : "6px 0 0" }}>
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {dir === "up" ? <path d="M12 19V5M5 12l7-7 7 7" /> : <path d="M12 5v14M5 12l7 7 7-7" />}
    </svg>
    </div>
  );
}
// `cor` = cor da faixa do jogador, para o Dôdo do balão aparecer com a faixa
// certa (era fixo em #efeadd, o que dava um Dôdo branco a toda a gente).
function CoachBubble({ children, dir = "down", cor }: { children: React.ReactNode; dir?: "up" | "down"; cor: string }) {
  return (
    <div style={{ position: "fixed", left: 0, right: 0, bottom: 134, display: "flex", justifyContent: "center", padding: "0 14px", zIndex: 90 }}>
    <div style={{ width: "100%", maxWidth: 432, display: "flex", alignItems: "flex-end", gap: 10 }}>
    <div style={{ width: 64, height: 64, flexShrink: 0 }}><Mascot belt={cor} expression="feliz" /></div>
    <div style={{ flex: 1, background: "#121815", border: `1px solid ${GOLD}`, borderRadius: 14, padding: "12px 14px", display: "flex", flexDirection: "column", boxShadow: `0 0 0 3px rgba(217,164,65,0.18)` }}>
    {dir === "up" && <SetaCoach dir="up" />}
    {children}
    {dir === "down" && <SetaCoach dir="down" />}
    </div>
    </div>
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
function FilledSlot({ a, isCaptain, onClick }: { a: Athlete; isCaptain: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "8px 3px", borderRadius: 12, border: `1.5px solid ${isCaptain ? "#FF8F00" : "#2f4a3c"}`, background: "rgba(12,14,13,0.78)", color: "#f1ede2", minWidth: 0, cursor: "pointer", fontFamily: FB }}>
    {isCaptain && <div style={{ position: "absolute", top: -8, right: -5, background: "#FF8F00", border: "1px solid #c2410c", color: "#1b1208", fontFamily: FD, fontWeight: 700, fontSize: 11, padding: "1px 6px", borderRadius: 5, lineHeight: 1.3, boxShadow: "0 1px 3px rgba(0,0,0,0.4)" }}>C</div>}
    <div style={{ width: 30, height: 34, borderRadius: 6, background: "linear-gradient(160deg,#2a4d3e,#1c3a2e)", display: "flex", alignItems: "center", justifyContent: "center" }}>
    <div style={{ background: "#f1ede2", color: "#1b211e", fontFamily: FD, fontWeight: 700, fontSize: 8, padding: "1px 3px", borderRadius: 2 }}>{code3(a.countryIso)}</div>
    </div>
    <div style={{ fontSize: 10, fontWeight: 700, width: "100%", textAlign: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.name.split(" ").slice(-1)[0]}</div>
    <div style={{ fontSize: 9, color: "#93a39a" }}>{a.category}kg</div>
    <div style={{ fontFamily: FD, fontSize: 11, fontWeight: 700, color: "#7fd1a3" }}>JC {a.priceJc.toFixed(1)}</div>
    </button>
  );
}
function EmptySlot({ highlight }: { highlight: boolean }) {
  return (
    <a href="/mercado" className={highlight ? "ilglow" : undefined} style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 5, padding: "9px 3px 7px", borderRadius: 12, border: highlight ? "2px solid #5aa9ff" : "1.5px dashed rgba(217,164,65,0.7)", background: "rgba(12,14,13,0.62)", textDecoration: "none", color: "#f1ede2" }}>
    <div style={{ width: 26, height: 26, borderRadius: "50%", border: `2px solid ${highlight ? "#5aa9ff" : GOLD}`, color: highlight ? "#7fb8f5" : GOLD, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, lineHeight: 1 }}>+</div>
    <div style={{ width: 38, height: 42 }}><GiGhost /></div>
    </a>
  );
}
function GiGhost() {
  return (
    <svg viewBox="0 0 60 70" width="100%" height="100%" aria-hidden="true">
    <path d="M16 16 L7 25 L13 34 L20 29 L20 60 Q30 64 40 60 L40 29 L47 34 L53 25 L44 16 Q37 12 30 12 Q23 12 16 16 Z" fill="rgba(255,255,255,0.10)" stroke="rgba(255,255,255,0.40)" strokeWidth="1.6" strokeLinejoin="round" />
    <path d="M26 16 L30 26 L34 16" fill="none" stroke="rgba(255,255,255,0.40)" strokeWidth="1.4" />
    <rect x="18" y="44" width="24" height="5" rx="1" fill="rgba(255,255,255,0.28)" />
    </svg>
  );
}
function BackIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
  );
}
function TrashIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" /></svg>
  );
}
function ShareIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M12 3v13M8 7l4-4 4 4" /></svg>
  );
}
function roundBtn(border: string, color: string): React.CSSProperties {
  return { width: 42, height: 42, borderRadius: 10, border: `1px solid ${border}`, background: "transparent", color, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 };
}
function TrophyIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 4h8v5a4 4 0 0 1-8 0V4z" /><path d="M8 6H5v2a3 3 0 0 0 3 3M16 6h3v2a3 3 0 0 1-3 3M10 17h4M9 21h6M12 13v4" /></svg>;
}
