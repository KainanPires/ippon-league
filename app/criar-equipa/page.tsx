"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Mascot } from "@/components/Mascot";
import { type Athlete } from "@/lib/athletes";
import { loadDraft, saveDraft, loadSaved, commitSaved, resolve, jcLeft, counts, isComplete, missing, loadSavedCloud, commitSavedCloud, type TeamState } from "@/lib/team";
import { Escudo, loadIdentity, DEFAULT_IDENTITY, type Identity } from "@/components/Escudo";
import { temSessao, exigirSessao } from "@/lib/auth";
import { competicaoDaSemana, proximaDepoisDe, type SemanaCalendario } from "@/lib/calendario";
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

// Competição vinda do Calendário Oficial. A "atual" é a da semana; se já começou,
// escala-se para a "próxima". Dias até uma competição (a partir de hoje).
function diasAte(c: SemanaCalendario, hoje: Date): number {
  const ini = new Date(c.de.replace(/\//g, "-") + "T00:00:00");
  return Math.max(0, Math.ceil((ini.getTime() - hoje.getTime()) / 86400000));
}

type Guide = "welcome" | "counter" | "slot" | "captain" | "actions" | null;
type Modal = { kind: "missing" | "saved" | "trash" | "share" | "login" } | { kind: "athlete"; a: Athlete } | null;
function sameTeam(a: TeamState, b: TeamState): boolean {
  if ((a.captain || "") !== (b.captain || "")) return false;
  if (a.ids.length !== b.ids.length) return false;
  return [...a.ids].sort().join(",") === [...b.ids].sort().join(",");
}
export default function CriarEquipa() {
  const [guide, setGuide] = useState<Guide>(null);
  const [draft, setDraft] = useState<TeamState>({ ids: [], captain: null });
  const [saved, setSaved] = useState<TeamState>({ ids: [], captain: null });
  const [modal, setModal] = useState<Modal>(null);
  const [identity, setIdentity] = useState<Identity>(DEFAULT_IDENTITY);
  const [savingCloud, setSavingCloud] = useState(false);
  const [cloudWarn, setCloudWarn] = useState(false);
  const router = useRouter();

  // Competição: atual (semana) e próxima. Se a atual já começou (dias<=0),
  // o mercado dela está fechado → escala-se para a próxima.
  const hoje = new Date();
  const atual = competicaoDaSemana(hoje);
  const diasAtual = diasAte(atual, hoje);
  const emAndamento = diasAtual <= 0;
  const proxima = proximaDepoisDe(atual);
  const diasProxima = diasAte(proxima, hoje);
  // A competição para a qual se ESCALA agora:
  const alvo = emAndamento ? proxima : atual;
  const diasAlvo = emAndamento ? diasProxima : diasAtual;
  function rotuloDias(d: number): string {
    if (d <= 0) return "fecha em breve";
    if (d === 1) return "em 1 dia";
    return `em ${d} dias`;
  }

  useEffect(() => {
    let active = true;
    try {
      if (!localStorage.getItem("ippon_team_tutorial")) setGuide("welcome");
    } catch {}
    temSessao().then((logado) => {
      if (!active || !logado) return;
      try {
        setDraft(loadDraft());
        setSaved(loadSaved());
        setIdentity(loadIdentity());
      } catch {}
      loadSavedCloud().then((cloud) => {
        if (!active || !cloud) return;
        setSaved(cloud);
        const localDraft = loadDraft();
        const localSaved = loadSaved();
        if (sameTeam(localDraft, localSaved)) {
          setDraft(cloud);
          saveDraft(cloud);
          commitSaved(cloud);
        }
      });
    });
    return () => { active = false; };
  }, []);
  const dirty = !sameTeam(draft, saved) && draft.ids.length > 0;
  const [nudge, setNudge] = useState(false);
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (dirty) { e.preventDefault(); e.returnValue = ""; }
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);
  function tryLeave(href: string) {
    if (dirty) { setNudge(true); setTimeout(() => setNudge(false), 1000); return; }
    router.push(href);
  }
  function update(next: TeamState) { setDraft(next); saveDraft(next); }
  function naoMostrarMais() { try { localStorage.setItem("ippon_team_tutorial", "skip"); } catch {} setGuide(null); }
  function openGuide() { setGuide("welcome"); }
  function setCaptain(id: string) {
    update({ ...draft, captain: draft.captain === id ? null : id });
    setModal(null);
  }
  function clearAll() { update({ ids: [], captain: null }); setModal(null); }
  function sell(id: string) {
    update({ ids: draft.ids.filter((x) => x !== id), captain: draft.captain === id ? null : draft.captain });
    setModal(null);
  }
  async function save() {
    if (!(await temSessao())) { setModal({ kind: "login" }); return; }
    if (!isComplete(draft)) { setModal({ kind: "missing" }); return; }
    setSavingCloud(true);
    const res = await commitSavedCloud(draft, identity);
    setSaved(draft);
    setSavingCloud(false);
    setCloudWarn(!res.ok);
    setModal({ kind: "saved" });
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
      <style>{`@keyframes ilglow{0%,100%{box-shadow:0 0 0 3px rgba(74,144,217,0.55)}50%{box-shadow:0 0 0 8px rgba(74,144,217,0.18)}} .ilglow{animation:ilglow 1.3s ease-in-out infinite;border-radius:10px} @keyframes ilsave{0%,100%{box-shadow:0 0 0 0 rgba(217,164,65,0.0)}50%{box-shadow:0 0 0 6px rgba(217,164,65,0.30)}} .ilsave{animation:ilsave 1.2s ease-in-out infinite} @keyframes ilsavebig{0%{transform:scale(1)}30%{transform:scale(1.06)}60%{transform:scale(0.98)}100%{transform:scale(1)}} .ilsavebig{animation:ilsave 1.2s ease-in-out infinite, ilsavebig 0.5s ease-in-out 2} @keyframes ilpulse{0%,100%{opacity:1}50%{opacity:.3}} .ilpulse{animation:ilpulse 1.2s ease-in-out infinite}`}</style>
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

        {/* Quando há competição a decorrer, mostra-a com aviso de que se escala para a próxima. */}
        {emAndamento && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 11, background: "linear-gradient(160deg,#2a1f1c,#10160f)", border: "1px solid #5a3a36", borderLeft: "3px solid #e2655a", borderRadius: 12, padding: "10px 13px", marginBottom: 10 }}>
            <span className="ilpulse" style={{ width: 9, height: 9, borderRadius: "50%", background: "#e2655a", marginTop: 4, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#e2655a" }}>A decorrer agora{atual.classico ? " · Clássico" : ""}</div>
              <div style={{ fontFamily: FD, fontSize: 14, fontWeight: 700, lineHeight: 1.1, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{atual.nome}</div>
              <p style={{ fontSize: 12, color: "#c7d0c9", lineHeight: 1.45, margin: "6px 0 0" }}>
                O mercado desta competição já fechou — os preços podem oscilar enquanto os atletas competem. <strong style={{ color: "#f1ede2" }}>Já podes escalar para a próxima:</strong> {proxima.nome}, {rotuloDias(diasProxima)}.
              </p>
            </div>
          </div>
        )}

        {/* Cabeçalho: a competição para a qual se está a escalar (alvo). */}
        <div style={{ display: "flex", alignItems: "center", gap: 11, background: "linear-gradient(160deg,#1c3a2e,#10160f)", border: "1px solid #2a4d3e", borderLeft: `3px solid ${GOLD}`, borderRadius: 12, padding: "10px 13px", marginBottom: 14 }}>
          <div style={{ width: 34, height: 34, borderRadius: 8, background: GOLD, color: "#1b211e", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <TrophyIcon />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#7fd1a3" }}>A escalar para{alvo.classico ? " · Clássico" : ""}</div>
            <div style={{ fontFamily: FD, fontSize: 16, fontWeight: 700, textTransform: "uppercase", lineHeight: 1.05, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{alvo.nome}</div>
            <div style={{ fontSize: 11, color: "#93a39a", marginTop: 2 }}>Mercado fecha {rotuloDias(diasAlvo)}</div>
          </div>
          <span style={{ background: "#1b211e", color: GOLD, fontSize: 10, fontWeight: 700, textTransform: "uppercase", padding: "4px 9px", borderRadius: 7, whiteSpace: "nowrap", flexShrink: 0 }}>{alvo.nivel}</span>
        </div>

        <div style={{ background: "#2f6fb3", border: "2px solid #25588f", borderRadius: 16, padding: 10 }}>
          <div style={{ background: "#e6b422", border: "2px solid #f0cf6a", borderRadius: 10, padding: "12px 10px" }}>
            <SectionLabel>Masculino</SectionLabel>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 14 }}>{renderRow(males, "M")}</div>
            <SectionLabel>Feminino</SectionLabel>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>{renderRow(females, "F")}</div>
          </div>
        </div>
        <p style={{ fontSize: 12, color: "#93a39a", textAlign: "center", marginTop: 14 }}>
          Toca num lugar livre para abrir o Mercado. Toca num atleta para o tornar capitão.
        </p>
        <a href="/ippon-pro" onClick={(e) => { e.preventDefault(); tryLeave("/ippon-pro"); }} style={{ display: "flex", alignItems: "center", gap: 12, background: GOLD, borderRadius: 16, padding: "10px 14px", marginTop: 16, textDecoration: "none" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: FD, fontSize: 15, fontWeight: 700, color: "#3a2a08", textTransform: "uppercase" }}>Sê Pro e avalia a tua equipa</div>
            <div style={{ fontSize: 11.5, color: "#5c4410", marginTop: 2 }}>Scout, valorização esperada e dicas da rodada.</div>
            <span style={{ display: "inline-block", marginTop: 8, background: "#1b211e", color: GOLD, fontSize: 11, fontWeight: 700, padding: "6px 12px", borderRadius: 8 }}>Ver Ippon Pro</span>
          </div>
          <div style={{ width: 66, height: 66, flexShrink: 0 }}><Mascot belt="#141110" expression="sabio" /></div>
        </a>
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
              <button onClick={save} disabled={savingCloud} className={dirty && !savingCloud ? (nudge ? "ilsavebig" : "ilsave") : undefined} style={{ background: GOLD, color: "#1b211e", border: "none", fontFamily: FD, fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", padding: "11px 18px", borderRadius: 10, cursor: savingCloud ? "default" : "pointer", opacity: savingCloud ? 0.7 : 1 }}>{savingCloud ? "A guardar…" : "Salvar equipa"}</button>
            </div>
          </div>
        </div>
        <nav style={{ height: 60, background: "#0f1411", borderTop: "1px solid #243029", display: "flex", alignItems: "center", justifyContent: "space-around" }}>
          <NavTab label="Início" href="/inicio" icon={<HomeIcon />} onNav={tryLeave} />
          <NavTab label="Competições" href="/ligas" icon={<TrophyIcon />} onNav={tryLeave} />
          <NavTab label="Pro" icon={<BoltIcon />} href="/ippon-pro" onNav={tryLeave} />
          <NavTab label="Amigos" icon={<FriendsIcon />} />
        </nav>
      </div>
      {guide === "welcome" && (
        <div style={overlayBg}>
          <div style={cardBox}>
            <div style={{ width: 90, height: 90, margin: "0 auto 4px" }}><Mascot belt="#efeadd" expression="feliz" /></div>
            <h2 style={{ fontFamily: FD, fontSize: 22, fontWeight: 700, textTransform: "uppercase", margin: "4px 0 8px" }}>Vamos montar a tua equipa</h2>
            <p style={{ fontSize: 14, color: "#c7d0c9", lineHeight: 1.55, margin: "0 0 20px" }}>Eu guio-te! Toca onde eu indicar e, em segundos, tens a tua equipa de 8 atletas pronta para competir.</p>
            <button onClick={() => setGuide("counter")} style={primaryBtn}>Vamos!</button>
            <button onClick={naoMostrarMais} style={ghostBtn}>Não mostrar mais</button>
          </div>
        </div>
      )}
      {guide === "counter" && (
        <CoachBubble>
          <p style={coachP}>Aqui em baixo, o <strong style={{ color: GOLD }}>{total}/8</strong> mostra quantos atletas já tens. Vais preenchendo até teres 8.</p>
          <button onClick={() => setGuide("slot")} style={{ ...nextBtn, marginTop: 10 }}>Seguinte</button>
          <button onClick={naoMostrarMais} style={{ ...skipLink, marginTop: 8 }}>Não mostrar mais</button>
        </CoachBubble>
      )}
      {guide === "slot" && (
        <CoachBubble>
          <p style={coachP}>Toca no <strong style={{ color: "#7fb8f5" }}>lugar destacado</strong> para abrir o Mercado e contratar um atleta.</p>
          <button onClick={() => setGuide("captain")} style={{ ...nextBtn, marginTop: 10 }}>Seguinte</button>
          <button onClick={naoMostrarMais} style={{ ...skipLink, marginTop: 8 }}>Não mostrar mais</button>
        </CoachBubble>
      )}
      {guide === "captain" && (
        <CoachBubble>
          <p style={coachP}>Toca num atleta já escalado para o <strong style={{ color: "#FF8F00" }}>tornares capitão</strong> (pontua a dobrar) ou para o <strong style={{ color: "#ef8d83" }}>venderes</strong>.</p>
          <button onClick={() => setGuide("actions")} style={{ ...nextBtn, marginTop: 10 }}>Seguinte</button>
          <button onClick={naoMostrarMais} style={{ ...skipLink, marginTop: 8 }}>Não mostrar mais</button>
        </CoachBubble>
      )}
      {guide === "actions" && (
        <CoachBubble>
          <p style={coachP}>Em baixo: <strong style={{ color: "#ef8d83" }}>🗑 limpa</strong> a equipa, <strong style={{ color: GOLD }}>partilha</strong> o teu time e <strong style={{ color: GOLD }}>Salvar equipa</strong> guarda a escalação. Boa sorte!</p>
          <button onClick={naoMostrarMais} style={{ ...nextBtn, marginTop: 10 }}>Concluir</button>
        </CoachBubble>
      )}
      {modal?.kind === "missing" && (
        <div style={overlayBg}>
          <div style={cardBox}>
            <div style={{ width: 84, height: 84, margin: "0 auto 4px" }}><Mascot belt="#efeadd" expression="feliz" /></div>
            <h2 style={{ fontFamily: FD, fontSize: 20, fontWeight: 700, textTransform: "uppercase", margin: "4px 0 8px" }}>Falta pouco!</h2>
            <p style={{ fontSize: 13, color: "#c7d0c9", margin: "0 0 12px" }}>Para guardares a equipa ainda precisas de:</p>
            <div style={{ textAlign: "left", display: "flex", flexDirection: "column", gap: 7, marginBottom: 18 }}>
              {missing(draft).map((m) => (
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
      {modal?.kind === "login" && (
        <div style={overlayBg}>
          <div style={cardBox}>
            <div style={{ width: 84, height: 84, margin: "0 auto 4px" }}><Mascot belt="#141110" expression="indicando" /></div>
            <h2 style={{ fontFamily: FD, fontSize: 20, fontWeight: 700, textTransform: "uppercase", margin: "4px 0 8px" }}>Entra para guardar</h2>
            <p style={{ fontSize: 14, color: "#c7d0c9", lineHeight: 1.5, margin: "0 0 20px" }}>Para guardares a tua equipa e competires, entra na tua conta. É rápido — e ficas já a jogar!</p>
            <button onClick={() => exigirSessao("/criar-equipa")} style={primaryBtn}>Entrar / Criar conta</button>
            <button onClick={() => setModal(null)} style={ghostBtn}>Agora não</button>
          </div>
        </div>
      )}
            {modal?.kind === "saved" && (
        <div style={overlayBg}>
          <div style={cardBox}>
            <div style={{ width: 88, height: 88, margin: "0 auto 4px" }}><Mascot belt="#efeadd" expression="feliz" /></div>
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
            <div style={{ width: 84, height: 84, margin: "0 auto 4px" }}><Mascot belt="#efeadd" expression="determinado" /></div>
            <h2 style={{ fontFamily: FD, fontSize: 20, fontWeight: 700, textTransform: "uppercase", margin: "4px 0 8px" }}>Limpar a equipa?</h2>
            <p style={{ fontSize: 14, color: "#c7d0c9", lineHeight: 1.5, margin: "0 0 20px" }}>Isto remove todos os atletas e vais ter de escalar de novo.</p>
            <button onClick={clearAll} style={{ ...primaryBtn, background: "#e2655a", color: "#1b0f0e" }}>Sim, limpar tudo</button>
            <button onClick={() => setModal(null)} style={ghostBtn}>Cancelar</button>
          </div>
        </div>
      )}
      {modal?.kind === "share" && (
        <div style={overlayBg}>
          <div style={cardBox}>
            <div style={{ width: 84, height: 84, margin: "0 auto 4px" }}><Mascot belt="#141110" expression="comemorando" /></div>
            <h2 style={{ fontFamily: FD, fontSize: 20, fontWeight: 700, textTransform: "uppercase", margin: "4px 0 8px", color: GOLD }}>Partilhar a equipa</h2>
            <p style={{ fontSize: 14, color: "#c7d0c9", lineHeight: 1.5, margin: "0 0 20px" }}>Em breve vais poder gerar um cartão da tua equipa para mostrares aos amigos. 🥋</p>
            <button onClick={() => setModal(null)} style={primaryBtn}>Fechar</button>
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
              {draft.captain === modal.a.id ? "Remover capitão" : "Tornar capitão (pontua x2)"}
            </button>
            <button onClick={() => sell(modal.a.id)} style={{ display: "block", width: "100%", marginTop: 10, textAlign: "center", border: "1px solid #5a2f2c", background: "transparent", color: "#ef8d83", padding: "11px", borderRadius: 12, fontSize: 14, fontWeight: 700, fontFamily: FD, textTransform: "uppercase", letterSpacing: "0.03em", cursor: "pointer" }}>Vender</button>
            <button onClick={() => setModal(null)} style={ghostBtn}>Fechar</button>
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
function CoachBubble({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: "fixed", left: 0, right: 0, bottom: 134, display: "flex", justifyContent: "center", padding: "0 14px", zIndex: 90 }}>
      <div style={{ width: "100%", maxWidth: 432, display: "flex", alignItems: "flex-end", gap: 10 }}>
        <div style={{ width: 64, height: 64, flexShrink: 0 }}><Mascot belt="#efeadd" expression="feliz" /></div>
        <div style={{ flex: 1, background: "#121815", border: `1px solid ${GOLD}`, borderRadius: 14, padding: "12px 14px", display: "flex", flexDirection: "column" }}>{children}</div>
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
function NavTab({ label, icon, href, onNav }: { label: string; icon: React.ReactNode; href?: string; onNav?: (href: string) => void }) {
  const style: React.CSSProperties = { display: "flex", flexDirection: "column", alignItems: "center", gap: 3, color: "#6f7d76", textDecoration: "none" };
  const inner = <>{icon}<span style={{ fontSize: 11 }}>{label}</span></>;
  if (href && onNav) return <a href={href} onClick={(e) => { e.preventDefault(); onNav(href); }} style={style}>{inner}</a>;
  return href ? <a href={href} style={style}>{inner}</a> : <div style={style}>{inner}</div>;
}
function HomeIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /></svg>;
}
function TrophyIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 4h8v5a4 4 0 0 1-8 0V4z" /><path d="M8 6H5v2a3 3 0 0 0 3 3M16 6h3v2a3 3 0 0 1-3 3M10 17h4M9 21h6M12 13v4" /></svg>;
}
function BoltIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" /></svg>;
}
function FriendsIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
}
