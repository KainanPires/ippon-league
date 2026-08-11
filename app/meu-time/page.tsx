"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Mascot } from "@/components/Mascot";
import { Escudo, loadIdentity, DEFAULT_IDENTITY, type Identity } from "@/components/Escudo";
import { loadSavedFor, loadDraftFor, saveDraftFor, commitSavedFor, commitSavedCloudFor, resolve, resolveRich, jcLeft, isComplete, missing, loadSavedCloudFor, loadIdentityCloudFor, setAthletePool, temNomeProprio, type TeamState } from "@/lib/team";
import { type Athlete } from "@/lib/athletes";
import { supabase } from "@/lib/supabase";
import { focoMercado, numeroDaRodada, nomeCompeticao, pontosVisiveisPorId, CALENDARIO_2026 } from "@/lib/calendario";
import { CartaoEquipa } from "@/components/CartaoEquipa";
import { tutorialVistoLocal, tutoriaisVistosConta, marcarTutorialVisto, deveMostrarTutorial, type TutKey } from "@/lib/tutorials";
import { Avaliacao, devePedirAvaliacao } from "@/components/Avaliacao";
import { AvisoEquipaGuardada } from "@/components/AvisoEquipaGuardada";
import { useFaixa } from "@/lib/useFaixa";
// Nível da tabela `users` (a mesma fonte do servidor), não do user_metadata.
import { useNivel } from "@/lib/useNivel";
import { useLembreteSalvar } from "@/lib/useLembreteSalvar";
import { TATAMES, tatamePorId, type TatameId } from "@/lib/tatames";
import { useTatame } from "@/components/TatameProvider";
import { useT } from "@/lib/i18n";
const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";
// FAIXA: vem do useFaixa() — a faixa REAL do jogador, a mesma em toda a app.
//
// Antes havia aqui `const BELT = "Branca"` e `BELT_HEX = "#efeadd"` fixos, e este
// ecrã dizia "Faixa Branca" e pintava o Dôdo de branco a TODA A GENTE, mesmo a
// quem fosse preta. O cartão de partilha saía igualmente com "Branca". Era o
// sítio mais errado da app quanto a isto — e o mais visível, porque é onde o
// jogador passa mais tempo.
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
// CHAVES, não texto. Um array fora do componente é avaliado uma vez, no
// arranque do módulo — não tem acesso ao `t`, que vive no contexto do React.
// Guardando as chaves, o texto é resolvido no render, na língua da altura.
const STEPS_EDICAO = [
  { t: "equipa.patrimonio", x: "mtut.patrimonioSub", target: "topo" },
  { t: "mtut.lugaresVazios", x: "mtut.lugaresVaziosSub", target: "vazio" },
  { t: "mtut.tocaAtleta", x: "mtut.tocaAtletaSub", target: "atletas" },
  { t: "mtut.guardar", x: "mtut.guardarSub", target: "guardar" },
];
// Tutorial de COMPETIÇÃO (a decorrer). Explica o que se vê ao vivo.
const STEPS_COMPETICAO = [
  { t: "mtut.pontosAtleta", x: "mtut.pontosAtletaSub", target: "atletas" },
  { t: "mt.capitaoDobrar", x: "mtut.capitaoSub", target: "atletas" },
  { t: "mt.totalEquipa", x: "mtut.totalSub", target: "total" },
  { t: "mt.resultadoRodada", x: "mtut.trancadaSub", target: "total" },
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
// useSearchParams() exige um limite de Suspense no Next.js — o componente real
// vive em MeuTimeRouter, envolvido aqui.
export default function MeuTime() {
  return (
    <Suspense fallback={<main style={{ minHeight: "100vh", background: "#0c0e0d" }} />}>
    <MeuTimeRouter />
    </Suspense>
  );
}
// Decide entre o TEU dojo VIVO (MeuTimeInner — editável / em competição) e o
// MODO VISITA (só-leitura) — ver um dojo via ?ver=<user>&comp=<id>, vindo da
// liga ou da chave da Copa.
// Regra: é VISITA quando (a) o alvo é um rival, OU (b) sou eu mas a competição
// pedida NÃO é a que está viva agora (ex.: ver o meu próprio time numa ronda
  // passada da Copa). Só caio no MeuTimeInner editável quando sou eu E na ronda
// atual — que é o caso normal de abrir o "Meu Time" e de clicar no meu nome na
// liga (cujo ?comp é sempre a competição que decorre).
function MeuTimeRouter() {
  const searchParams = useSearchParams();
  const ver = searchParams.get("ver");
  const comp = searchParams.get("comp");
  // undefined = ainda não sabemos quem somos; null = sem sessão; string = uid.
  const [meuId, setMeuId] = useState<string | null | undefined>(undefined);
  useEffect(() => {
      let active = true;
      supabase.auth.getSession().then(({ data }: { data: { session: unknown } }) => {
          if (!active) return;
          const s = data.session as { user?: { id?: string } } | null;
          setMeuId(s?.user?.id ?? null);
        });
      return () => { active = false; };
    }, []);
  // A competição "viva" agora: a que decorre (mercado fechado) ou a próxima de
  // mercado aberto. Serve para distinguir o meu dojo editável de uma ronda passada.
  const foco = focoMercado();
  const compViva = (foco.aDecorrer ?? foco.alvo).idCompeticao;
  if (ver && comp) {
    // Ainda a descobrir quem sou: espera (evita piscar o dojo errado).
    if (meuId === undefined) return <main style={{ minHeight: "100vh", background: "#0c0e0d" }} />;
    const ehRival = meuId !== ver;
    const rondaPassada = comp !== compViva;
    if (ehRival || rondaPassada) return <DojoVisita alvoUserId={ver} idComp={comp} />;
    // sou eu E na ronda atual -> o meu dojo vivo/editável (fluxo normal).
  }
  return <MeuTimeInner />;
}
// ===========================================================================
// MODO VISITA — ver um DOJO em só-leitura (rival na liga, ou qualquer equipa
  // numa ronda da Copa, incluindo a minha própria numa ronda passada).
// ---------------------------------------------------------------------------
// FONTE PRINCIPAL: /api/equipa-na-rodada (servidor, service-role, contorna a RLS).
// Devolve sempre nome + escudo + capitão + a lista de atletas com nome/país/
// categoria/pontos congelados — funciona mesmo em rondas antigas da Copa.
// ENRIQUECIMENTO: /api/atletas?id=comp (a "pool") dá género e preço. Quando a
// pool resolve TODOS os atletas (ronda a decorrer / competição recente) mostramos
// a GRELHA de tatame (M/F) com detalhe luta-a-luta; quando não (histórico sem
  // pool), caímos numa LISTA com pontos — sem perder informação.
// PONTOS: ao vivo via /api/resultados só na ronda que decorre agora; nas rondas
// passadas usamos os pontos congelados que a equipa-na-rodada já trouxe.
// NADA é editável: sem lixo, sem partilhar, sem salvar, sem capitão/vender.
// ===========================================================================
type ItemVisita = {
  id: string;
  nome: string;
  pais: string; // ISO ("JP") ou já IOC ("JPN"); code3() normaliza
  categoria: string; // ex.: "73"
  capitao: boolean;
  gender?: string; // "M" | "F" quando a pool resolveu
  athlete?: Athlete; // Athlete completo da pool (para a grelha e o detalhe)
};
function DojoVisita({ alvoUserId, idComp }: { alvoUserId: string; idComp: string }) {
  const t = useT();
  const router = useRouter();
  const [fase, setFase] = useState<"carregando" | "sem-equipa" | "erro" | "ok" | "bloqueado">("carregando");
  const [souEu, setSouEu] = useState(false);
  // Nível para o cartão de partilha. Do useNivel() (tabela `users`).
  const { ehPro: souPro, ehProMax: souProMax } = useNivel();
  const meuNivel: "normal" | "pro" | "pro_max" = souProMax ? "pro_max" : souPro ? "pro" : "normal";
  const [nomeTime, setNomeTime] = useState("Equipa");
  const [escudoAlvo, setEscudoAlvo] = useState<Identity | null>(null);
  const [nomeComp, setNomeComp] = useState<string>("");
  const [itens, setItens] = useState<ItemVisita[]>([]);
  const [capitao, setCapitao] = useState<string | null>(null);
  const [pontos, setPontos] = useState<Record<string, number>>({});
  const [temResultados, setTemResultados] = useState(false);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<number | null>(null);
  const [modal, setModal] = useState<Athlete | null>(null);
  const [partilhar, setPartilhar] = useState(false);
  // A MINHA faixa (do hook partilhado). Serve para o Dôdo e para o cartão de
  // partilha — que só aparece quando o dojo é meu, por isso é sempre a certa.
  const { cor: corFaixa, nome: nomeFaixa } = useFaixa();
  const foco = focoMercado();
  const aDecorrerAgora = foco.aDecorrer?.idCompeticao === idComp;
  // Rodada + data desta competição, tiradas do calendário local pelo idComp
  // (mais robusto do que depender da API). A data vem no formato AAAA/MM/DD e
  // mostramo-la como DD/MM/AAAA. rodadaNum é o nº da rodada (1..52) ou null.
  const rodadaNum = numeroDaRodada(idComp);
  const dataRodada = (() => {
      const ent = CALENDARIO_2026.find((s) => s.idCompeticao === idComp);
      if (!ent || !ent.de) return "";
      const partes = ent.de.split("/"); // [AAAA, MM, DD]
      if (partes.length !== 3) return "";
      return `${partes[2]}/${partes[1]}/${partes[0]}`;
    })();
  const linhaRodada = [rodadaNum ? `Rodada ${rodadaNum}` : "", dataRodada].filter(Boolean).join(" · ");
  // Nome a MOSTRAR desta competição: esconde a cidade se for um clássico ainda
  // por abrir. Importa sobretudo no ecrã "mercado ainda aberto" — seria absurdo
  // dizer "ainda não podes ver" e no mesmo fôlego revelar a cidade de 2018.
  const nomeCompMostrar = (() => {
      const ent = CALENDARIO_2026.find((s) => s.idCompeticao === idComp);
      return ent ? nomeCompeticao(ent) : nomeComp;
    })();
  // 1) Sessão (exige login) + equipa do alvo (servidor) + pool da competição.
useEffect(() => {
    let active = true;
    (async () => {
        const { data } = await supabase.auth.getSession();
        if (!active) return;
        const sess = (data as { session: { user?: { id?: string } } | null }).session;
        if (!sess) { window.location.href = "/entrar"; return; }
        const meuId = sess.user?.id ?? "";
        const euMesmo = meuId === alvoUserId;
        setSouEu(euMesmo);
        // O nível vem do useNivel() (ver abaixo), não do metadata.
        const poolP = fetch(`/api/atletas?id=${idComp}`).then((r) => r.json()).catch(() => null);
        const eqP = fetch(`/api/equipa-na-rodada?user=${encodeURIComponent(alvoUserId)}&comp=${encodeURIComponent(idComp)}`).then((r) => r.json()).catch(() => null);
        const [poolJson, eqJson] = await Promise.all([poolP, eqP]);
        if (!active) return;
        if (!eqJson || !eqJson.ok) { setFase("erro"); return; }
        if (typeof eqJson?.competicao?.nome === "string") setNomeComp(eqJson.competicao.nome);
        // Portão do servidor: mercado ainda aberto -> não há escalação para mostrar.
        if (eqJson.bloqueado) { setFase("bloqueado"); return; }
        if (!eqJson.tem_equipa) {
          if (typeof eqJson.nome_time === "string") setNomeTime(eqJson.nome_time);
          setFase("sem-equipa");
          return;
        }
        const pool = new Map<string, Athlete>();
        const lista: Athlete[] = Array.isArray(poolJson?.atletas) ? poolJson.atletas : [];
        for (const a of lista) pool.set(a.id, a);
        const base: { id: unknown; nome?: unknown; pais?: unknown; categoria?: unknown; pontos?: unknown; capitao?: unknown }[] =
        Array.isArray(eqJson.atletas) ? eqJson.atletas : [];
        const novosItens: ItemVisita[] = base.map((a) => {
            const id = String(a.id);
            const p = pool.get(id);
            return {
              id,
              nome: p?.name || String(a.nome || "Atleta"),
              pais: p?.countryIso || String(a.pais || ""),
              categoria: p?.category || String(a.categoria || ""),
              capitao: !!a.capitao,
              gender: p?.gender,
              athlete: p,
            };
          });
        const pontosBase: Record<string, number> = {};
        for (const a of base) pontosBase[String(a.id)] = Number(a.pontos) || 0;
        setItens(novosItens);
        setCapitao(eqJson.capitao ? String(eqJson.capitao) : null);
        setNomeTime(String(eqJson.nome_time || "Equipa"));
        setEscudoAlvo((eqJson.escudo as Identity) ?? null);
        setPontos(pontosBase);
        // Ronda passada -> há resultados congelados; ronda a decorrer -> espera a
        // resposta do /api/resultados (efeito 2) para saber se já há lutas.
        setTemResultados(!aDecorrerAgora);
        setFase("ok");
      })();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alvoUserId, idComp]);
// 2) Pontos AO VIVO — só quando esta é a competição que decorre agora.
useEffect(() => {
    if (fase !== "ok" || !aDecorrerAgora || itens.length === 0) return;
    let active = true;
    const ids = itens.map((i) => i.id);
    const buscar = () => {
      fetch(`/api/resultados?comp=${idComp}&persons=${encodeURIComponent(ids.join(","))}`)
      .then((r) => r.json())
      .then((j) => {
          if (!active) return;
          if (j && j.pontos) setPontos(j.pontos);
          setTemResultados(!!(j && j.tem_resultados));
          setUltimaAtualizacao(Date.now());
        })
      .catch(() => {});
    };
    buscar();
    const timer = setInterval(() => {
        if (typeof document !== "undefined" && document.hidden) return;
        buscar();
      }, TICK_AO_VIVO_MS);
    const onVis = () => { if (typeof document !== "undefined" && !document.hidden) buscar(); };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      active = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase, aDecorrerAgora, itens, idComp]);
const scoreOf = (id: string, cap: boolean) => { const b = pontos[id] ?? 0; return cap ? b * 2 : b; };
const totalPts = Math.round(itens.reduce((s, i) => s + scoreOf(i.id, i.capitao), 0) * 10) / 10;
// Grelha de tatame só quando a pool deu género (e Athlete) para TODOS. Senão,
// lista robusta (histórico sem pool) — igual ao antigo modal da chave.
const podeGrelha = itens.length > 0 && itens.every((i) => (i.gender === "M" || i.gender === "F") && !!i.athlete);
const males = itens.filter((i) => i.gender === "M" && i.athlete);
const females = itens.filter((i) => i.gender === "F" && i.athlete);
const squadValue = podeGrelha ? fmt(itens.reduce((s, i) => s + (i.athlete?.priceJc ?? 0), 0)) : null;
const phase: MarketPhase = temResultados ? "ao-vivo" : "fechado";
const horaTick = ultimaAtualizacao
? new Date(ultimaAtualizacao).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
: null;
return (
  <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: FB }}>
  <style>{`@keyframes ilp{0%,100%{opacity:1}50%{opacity:.25}} .ilp{animation:ilp 1.1s ease-in-out infinite}`}</style>
  <div style={{ maxWidth: 460, margin: "0 auto", padding: "14px 14px 40px" }}>
  <header style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 16 }}>
  <button onClick={() => router.back()} aria-label="Voltar" style={{ width: 34, height: 34, borderRadius: "50%", border: "1px solid #243029", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", color: "#cfd8d2", cursor: "pointer", flexShrink: 0 }}>
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
  </button>
  <h1 style={{ fontFamily: FD, fontSize: 19, fontWeight: 700, textTransform: "uppercase", margin: 0, flex: 1 }}>{souEu ? t("mt.teuDojo") : t("mt.dojoRival")}</h1>
  </header>
  {fase === "carregando" && (
      <div style={{ textAlign: "center", padding: "30px 16px", background: "#121815", border: "1px solid #243029", borderRadius: 16 }}>
      <div style={{ width: 80, height: 80, margin: "0 auto 8px" }}><Mascot belt={corFaixa} expression="feliz" /></div>
      <div style={{ fontFamily: FD, fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#93a39a" }}>{t("mt.aAbrirDojo")}</div>
      </div>
    )}
  {fase === "erro" && (
      <div style={{ textAlign: "center", padding: "30px 16px", background: "#1a1110", border: "1px solid #3a2420", borderRadius: 16 }}>
      <div style={{ fontFamily: FD, fontSize: 15, fontWeight: 700, textTransform: "uppercase", color: "#ef8d83", marginBottom: 8 }}>{t("mt.ups")}</div>
      <p style={{ fontSize: 13, color: "#c7d0c9", lineHeight: 1.5 }}>{t("mt.dojoErro")}</p>
      </div>
    )}
  {fase === "sem-equipa" && (
      <div style={{ textAlign: "center", padding: "26px 16px", background: "#121815", border: "1px solid #243029", borderRadius: 16 }}>
      <div style={{ width: 90, height: 90, margin: "0 auto 6px" }}><Mascot belt={corFaixa} expression="indicando" /></div>
      <h2 style={{ fontFamily: FD, fontSize: 18, fontWeight: 700, textTransform: "uppercase", margin: "4px 0 8px" }}>{t("mt.semEquipaRodada")}</h2>
      <p style={{ fontSize: 13.5, color: "#c7d0c9", lineHeight: 1.5, margin: 0 }}>{souEu ? t("mt.naoEscalaste") : t("mt.rivalNaoEscalou")}</p>
      </div>
    )}
  {fase === "bloqueado" && (
      <div style={{ textAlign: "center", padding: "28px 18px", background: "#121815", border: `1px solid ${GOLD}`, borderRadius: 16 }}>
      <div style={{ fontSize: 32, marginBottom: 6 }}>🔒</div>
      <h2 style={{ fontFamily: FD, fontSize: 18, fontWeight: 700, textTransform: "uppercase", margin: "4px 0 8px", color: GOLD }}>{t("mt.mercadoAberto")}</h2>
      <p style={{ fontSize: 13.5, color: "#c7d0c9", lineHeight: 1.55, margin: 0 }}>
      As equipas {nomeCompMostrar ? <>de <strong style={{ color: "#f1ede2" }}>{nomeCompMostrar}</strong> </> : "desta rodada "}
      só ficam visíveis quando o mercado fechar. Assim ninguém copia a escalação antes da hora — volta quando a competição começar.
      </p>
      </div>
    )}
  {fase === "ok" && (
      <>
      <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 16 }}>
      <div style={{ flexShrink: 0 }}><Escudo config={escudoAlvo || DEFAULT_IDENTITY} size={40} /></div>
      <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 11, color: "#93a39a", textTransform: "uppercase", letterSpacing: "0.06em" }}>{t("mt.dojoDe")}</div>
      <div style={{ fontFamily: FD, fontSize: 18, fontWeight: 700, textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nomeTime}</div>
      {nomeCompMostrar && <div style={{ fontSize: 11, color: "#7fd1a3", marginTop: 1 }}>{nomeCompMostrar}</div>}
      {linhaRodada && <div style={{ fontSize: 11, color: "#93a39a", marginTop: 1 }}>{linhaRodada}</div>}
      </div>
      </div>
      {podeGrelha ? (
          <section style={{ background: "#2f6fb3", border: "2px solid #25588f", borderRadius: 16, padding: 10 }}>
          <div style={{ background: "#e6b422", border: "2px solid #f0cf6a", borderRadius: 10, padding: "12px 10px" }}>
          <SectionLabel>{t("mt.masculino")}</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 14 }}>
          {males.map((i) => <Cell key={i.id} a={i.athlete!} captain={i.capitao} score={scoreOf(i.id, i.capitao)} phase={phase} onClick={() => setModal(i.athlete!)} />)}
          </div>
          <SectionLabel>{t("mt.feminino")}</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
          {females.map((i) => <Cell key={i.id} a={i.athlete!} captain={i.capitao} score={scoreOf(i.id, i.capitao)} phase={phase} onClick={() => setModal(i.athlete!)} />)}
          </div>
          </div>
          </section>
        ) : (
          // FALLBACK em lista (histórico sem pool): país + nome + CAP + pontos
          // simples por atleta. O capitão dobra só no total, em baixo.
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {itens.map((i) => {
                const p = pontos[i.id] ?? 0;
                return (
                  <div key={i.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "#141a17", border: `1px solid ${i.capitao ? "#FF8F00" : "#243029"}`, borderRadius: 11, padding: "9px 11px" }}>
                  <div style={{ width: 30, height: 34, borderRadius: 6, background: "linear-gradient(160deg,#2a4d3e,#1c3a2e)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <div style={{ background: "#f1ede2", color: "#1b211e", fontFamily: FD, fontWeight: 700, fontSize: 8, padding: "1px 3px", borderRadius: 2 }}>{code3(i.pais)}</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: "#f1ede2", display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", overflow: "hidden" }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{i.nome}</span>
                  {i.capitao && <span style={{ background: "#FF8F00", color: "#1b1208", fontFamily: FD, fontWeight: 700, fontSize: 9, padding: "1px 6px", borderRadius: 5, flexShrink: 0 }}>CAP</span>}
                  </div>
                  <div style={{ fontSize: 10.5, color: "#93a39a" }}>{code3(i.pais)}{i.categoria ? ` · ${i.categoria}kg` : ""}</div>
                  </div>
                  <div style={{ flexShrink: 0, textAlign: "right" }}>
                  <span style={{ fontFamily: FD, fontSize: 15, fontWeight: 700, color: p >= 0 ? "#7fd1a3" : "#ef8d83" }}>{p >= 0 ? "+" : ""}{p}</span>
                  <div style={{ fontSize: 8.5, color: "#5f6f67", textTransform: "uppercase" }}>pts</div>
                  </div>
                  </div>
                );
              })}
          </div>
        )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, padding: "12px 14px", background: "#141a17", border: "1px solid #243029", borderRadius: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ width: 60, height: 60, flexShrink: 0 }}><Mascot belt={corFaixa} expression={phase === "ao-vivo" ? "determinado" : "feliz"} /></div>
      <div>
      <div style={{ fontSize: 12, color: "#93a39a" }}>{aDecorrerAgora ? t("equipa.rodadaADecorrer") : t("mt.resultadoRodada")}</div>
      {squadValue && <div style={{ fontSize: 12, color: "#7fd1a3", fontWeight: 700, marginTop: 2 }}>{`Valor da equipa: JC ${squadValue}`}</div>}
      </div>
      </div>
      <div style={{ textAlign: "right" }}>
      <div style={{ fontFamily: FD, fontSize: 26, fontWeight: 700, color: GOLD }}>{totalPts >= 0 ? "+" : ""}{totalPts}</div>
      <div style={{ fontSize: 10, color: "#93a39a", textTransform: "uppercase" }}>pts</div>
      </div>
      </div>
      {aDecorrerAgora && horaTick && (
          <div style={{ marginTop: 12, padding: "11px 14px", background: "#16201b", border: "1px solid #2a4d3e", borderRadius: 12, fontSize: 12.5, color: "#aee9c9", textAlign: "center" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 11, color: "#7fd1a3" }}>
          <span className="ilp" style={{ width: 7, height: 7, borderRadius: "50%", background: "#7fd1a3" }} />
          Ao vivo · atualizado às {horaTick}
          </div>
          </div>
        )}
      <p style={{ fontSize: 11, color: "#5f6f67", textAlign: "center", marginTop: 14 }}>
      {podeGrelha
        ? (souEu ? t("mt.tuaEquipaRodada") : t("mt.dojoRivalSub"))
        : t("mt.pontosCadaAtleta")}
      </p>
      {/* Partilhar a minha equipa desta rodada. Só quando o dojo é meu —
        partilhar a equipa de um rival como se fosse minha não faz sentido. */}
      {souEu && itens.length > 0 && (
          <button onClick={() => setPartilhar(true)} style={{ width: "100%", marginTop: 8, padding: 13, borderRadius: 12, border: "none", background: GOLD, color: "#1b211e", fontFamily: FD, fontSize: 15, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>
          Partilhar a minha equipa
          </button>
        )}
      </>
    )}
  </div>
  {modal && (
      <AthleteDetail
      a={modal}
      captain={modal.id === capitao}
      score={scoreOf(modal.id, modal.id === capitao)}
      temResultados={temResultados}
      editavel={false}
      idComp={idComp}
      onCaptain={() => {}}
      onSell={() => {}}
      onClose={() => setModal(null)}
      />
    )}
  {partilhar && (
      <CartaoEquipa
      identity={escudoAlvo || DEFAULT_IDENTITY}
      faixa={nomeFaixa}
      atletas={itens.map((i) => i.athlete || ({ id: i.id, name: i.nome, countryIso: i.pais, category: i.categoria } as Athlete))}
      capitao={capitao}
      nivel={meuNivel}
      onClose={() => setPartilhar(false)}
      />
    )}
  </main>
);
}
function MeuTimeInner() {
  const t = useT();
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
  // Qual chave de tutorial está ABERTA agora. Guardamos no momento de abrir para
  // que o "Pular/Concluir" marque EXATAMENTE essa chave — sem isto, abrir e
  // gravar podiam usar chaves diferentes (edição vs competição) num instante de
  // carregamento, e o tutorial reaparecia sempre. (Bug corrigido.)
  const [tutKeyAberta, setTutKeyAberta] = useState<TutKey | null>(null);
  // Tutoriais já vistos NA CONTA — carregados uma vez quando a sessão entra.
  // null = ainda não sabemos (não decidir o tutorial antes disto chegar, senão
    // reaparece sempre por causa do timing). {} = já sabemos e não há nenhum visto.
  const [vistosConta, setVistosConta] = useState<Record<string, boolean> | null>(null);
  const [mostrarAvaliacao, setMostrarAvaliacao] = useState(false);
  // Aviso "e agora?" logo depois de guardar (uma vez, com não-mostrar-mais).
  const [avisoGuardada, setAvisoGuardada] = useState(false);
  const { ehPro: isPro } = useNivel();
  // Personalização Pro Max: cor do tatame — agora via TatameProvider, para mudar
  // na hora em todo o lado (Meu Time, central). seletorTatame abre/fecha o painel.
  const { tatameId, isProMax, setTatame } = useTatame();
  const [seletorTatame, setSeletorTatame] = useState(false);
  const router = useRouter();
  // Faixa REAL do jogador: cor para o Dôdo, nome para o cabeçalho e para o
  // cartão de partilha. Substitui os antigos BELT/BELT_HEX fixos.
  const { cor: corFaixa, nome: nomeFaixa } = useFaixa();
  // Marca "montar" (?montar=1): ativada pelo lixo. Enquanto está no ciclo
  // mercado<->meu-time, o meu-time mostra VAZIO (ignora a equipa salva) para a
  // pessoa montar uma nova. Sair do ciclo (link sem o param) restaura a antiga;
  // salvar uma nova substitui-a. (Fluxo pedido pelo Kainan.)
  const searchParams = useSearchParams();
  const montar = searchParams.get("montar") === "1";
  const foco = focoMercado();
  const atual = foco.atual;
  const emAndamento = foco.aDecorrer !== null;
  const alvo = foco.alvo;
  const aDecorrer = foco.aDecorrer;
  const [idComp, setIdComp] = useState<string>(alvo.idCompeticao);
  // Quem sou eu (para o lembrete "esqueceste de salvar"). Guardado quando a
  // sessão é confirmada; usado pelo hook do lembrete.
  const [userId, setUserId] = useState<string | null>(null);
  // PATRIMÓNIO REAL (users.patrimony_jc): o que a equipa vale ao todo, com as
  // valorizações já aplicadas pelo motor de congelamento. Não se calcula aqui.
  const [patrimonio, setPatrimonio] = useState<number | null>(null);
  // LEMBRETE "esqueceste de salvar o teu time" — hook reutilizável. Observa a
  // saída do ecrã e agenda/cancela conforme há (ou não) rascunho por salvar para
  // esta competição. A lógica (rascunho vs guardado) vive no hook, partilhada com
  // o Mercado, por isso aqui basta uma linha. O servidor recusa agendar com o
  // mercado fechado, por isso não é preciso filtrar a competição aqui.
  useLembreteSalvar(userId, idComp);
  useEffect(() => {
      let active = true;
      try {
        setIdentity(loadIdentity());
        const localDecorrer = aDecorrer ? loadSavedFor(aDecorrer.idCompeticao) : { ids: [], captain: null };
        if (localDecorrer.ids.length > 0 && aDecorrer) {
          setTeam(localDecorrer);
          setSaved(localDecorrer);
          setIdComp(aDecorrer.idCompeticao);
        } else if (montar) {
          // Marca "montar" ativa (veio do lixo): IGNORA a equipa salva (a antiga,
            // na nuvem), mas RESPEITA o rascunho — o que a pessoa está a montar no
          // mercado. Se não mexeu no mercado, o rascunho está vazio -> mostra vazio
          // (e a antiga volta ao sair do ciclo). Se montou, o rascunho tem os
          // atletas -> mostra-os, para escolher capitão e salvar.
          const d = loadDraftFor(alvo.idCompeticao);
          setTeam(d);
          setSaved(loadSavedFor(alvo.idCompeticao)); // a antiga, só como referência
          setIdComp(alvo.idCompeticao);
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
            const uid = (data.session as { user?: { id?: string } } | null)?.user?.id;
            if (uid) {
              setUserId(uid);
              // Património real, da mesma fonte que o /inicio.
              supabase.from("users").select("patrimony_jc").eq("id", uid).maybeSingle()
              .then(({ data: row }) => {
                  if (!active) return;
                  const p = Number((row as { patrimony_jc?: unknown } | null)?.patrimony_jc);
                  if (Number.isFinite(p)) setPatrimonio(p);
                });
            }
          } catch {}
          // O nível vem do useNivel() (tabela `users`), não do metadata.
          // Tutoriais já vistos na CONTA — buscar uma vez (decide o tutorial só
            // depois disto chegar, para não reaparecer por causa do timing).
          tutoriaisVistosConta().then((v) => { if (active) setVistosConta(v || {}); }).catch(() => { if (active) setVistosConta({}); });
          (async () => {
              // IDENTIDADE da CONTA é a fonte de verdade do nome/escudo. Lemos da nuvem
              // e aplicamos por cima do que veio do localStorage — assim o nome
              // ("Relâmpago Marquinhos") não se perde ao limpar o browser ou ao mudar
              // de endereço/aparelho. Só sobrepomos o que a nuvem traz (nome e/ou escudo).
              loadIdentityCloudFor(alvo.idCompeticao).then((idc) => {
                  if (!active || !idc) return;
                  setIdentity((prev) => ({
                        ...prev,
                        ...(idc.escudo ? (idc.escudo as Partial<Identity>) : {}),
                        ...(idc.name ? { name: idc.name } : {}),
                      }));
                }).catch(() => {});
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
              // Marca "montar" ativa: NÃO repor o team a partir da nuvem (a antiga). O
              // team já reflete o rascunho (vazio se não mexeu, ou a equipa montada no
                // mercado). Só guardamos a salva (antiga) como referência.
              if (montar) return;
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
  // Pontos reais + tick ao vivo.
  //
  // PORTÃO ANTI-ESPREITADELA (cliente): enquanto o mercado desta competição
  // estiver ABERTO não pedimos pontos nenhuns. Nos clássicos, as lutas de 2018 já
  // existem no JudoBase — sem este travão, bastava escalar um atleta, tocar nele
  // e ver quanto fez, para depois o trocar. O servidor já recusa (/api/resultados
    // e /api/atleta-rodada devolvem vazio), mas parar aqui evita 4 pedidos por
  // minuto que nunca dariam nada, e deixa o ecrã coerente.
  useEffect(() => {
      let active = true;
      if (!idComp) return;
      if (!pontosVisiveisPorId(idComp)) {
        setPontos({});
        setTemResultados(false);
        return () => { active = false; };
      }
      const buscarPontos = () => {
        // Pontuamos os atletas DESTA equipa via competitor.contests (por atleta),
        // que traz as lutas completas mesmo quando competition.contests está
        // incompleto durante o evento (ex.: Tahiti só devolvia algumas categorias,
          // deixando atletas que já lutaram a 0). Lemos os ids guardados no momento
        // da chamada (sem depender do estado, para não reiniciar o tick ao vivo).
        let ids: string[] = [];
        try {
          const guardada = loadSavedFor(idComp);
          const rascunho = loadDraftFor(idComp);
          ids = (guardada.ids.length > 0 ? guardada.ids : rascunho.ids).map(String);
        } catch {}
        const qs = ids.length > 0
        ? `/api/resultados?comp=${idComp}&persons=${encodeURIComponent(ids.join(","))}`
        : `/api/resultados?comp=${idComp}`;
        fetch(qs)
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
  // TUTORIAL — primeira vez: abre automaticamente uma vez por modo. Só decide
  // DEPOIS de sabermos o que já foi visto na CONTA (vistosConta !== null). Sem
  // isto, o efeito corria antes da conta responder e o tutorial reaparecia mesmo
  // tendo sido pulado. Verifica as DUAS fontes: cache local E conta.
  useEffect(() => {
      if (!ready || vistosConta === null) return;
      const chave = emCompeticaoNow ? TUT_COMP_KEY : TUT_EDICAO_KEY;
      const jaVisto = tutorialVistoLocal(chave) || !!vistosConta[chave];
      if (jaVisto) {
        // Se a conta já o tem mas o local não (ex.: novo endereço/aparelho),
        // alinha a cache local para não voltar a verificar à rede da próxima vez.
        if (vistosConta[chave]) { try { localStorage.setItem(chave, "done"); } catch {} }
        return;
      }
      setTutKeyAberta(chave); // regista QUAL tutorial abriu (para o pular gravar a certa)
      setGuide(0);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ready, vistosConta, emCompeticaoNow]);
  if (!ready) return <main style={{ minHeight: "100vh", background: "#0c0e0d" }} />;
  // RESOLUÇÃO RICA: separa os atletas que a pool conhece (resolvidos) dos que
  // já não estão na pool (ausentes — ex.: saíram dos inscritos da competição).
  // Em vez de os esconder (bug antigo do resolve + filter), mostramo-los numa
  // secção "Indisponíveis" para a equipa nunca parecer ter menos atletas do que
  // os 8 que a pessoa guardou.
  const slots = resolveRich(team.ids);
  const athletes = slots.filter((s) => !s.ausente).map((s) => (s as { ausente: false; atleta: Athlete }).atleta);
  const ausentesIds = slots.filter((s) => s.ausente).map((s) => (s as { ausente: true; id: string }).id);
  const temEquipa = team.ids.length > 0;
  // "A carregar" só ENQUANTO ainda estamos a tentar buscar a lista de atletas.
  // Depois de a tentativa terminar (poolPronto), se NENHUM atleta resolver e não
  // há ausentes conhecidos, tratamos como "sem equipa". Se há ids mas nenhum
  // resolve, ainda assim mostramos (como ausentes) — nunca "desaparecem".
  const aCarregarAtletas = temEquipa && athletes.length === 0 && ausentesIds.length === 0 && !poolPronto;
  const equipaIrresoluvel = temEquipa && athletes.length === 0 && ausentesIds.length === 0 && poolPronto;
  const hasTeam = athletes.length > 0 || ausentesIds.length > 0;
  const males = athletes.filter((a) => a.gender === "M");
  const females = athletes.filter((a) => a.gender === "F");
  const squadValue = fmt(athletes.reduce((s, a) => s + a.priceJc, 0));
  // SALDO: o que sobra dos 100 para comprar. É diferente de PATRIMÓNIO — e o
  // ecrã chamava-lhe património, o que fazia parecer que este nunca oscilava.
  // Património = quanto vale ao todo (equipa + saldo). Evolui a cada rodada.
  // Saldo = quanto sobra para gastar agora.
  const saldo = jcLeft(team);
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
  // Tema de cor do tatame (Pro Max). tatamePorId cai no default se o id não
  // existir, por isso isto é sempre seguro.
  const tema = tatamePorId(tatameId);
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
  // Remove um atleta AUSENTE (indisponível) da equipa — só quando editável.
  // Não abre modal: é uma remoção direta de um id que já não tem dados.
  function removerAusente(id: string) {
    update({ ids: team.ids.filter((x) => x !== id), captain: team.captain === id ? null : team.captain });
  }
  function limparTudo() {
    // Limpa só o RASCUNHO (não a equipa salva na nuvem) e vai direto ao mercado
    // para montar de novo. A equipa antiga só é substituída quando o utilizador
    // SALVAR uma nova: se for ao mercado e não mexer/não salvar, a antiga mantém-se;
    // se salvar uma nova, esta substitui a antiga. (Fluxo pedido pelo Kainan.)
    update({ ids: [], captain: null });
    setModal(null);
    router.push("/mercado?montar=1");
  }
  // Depois de fechar o aviso "e agora?": não voltamos a mostrar o modal "Equipa
  // salva" (o aviso já o disse, e melhor). Só a avaliação, se for altura.
  function fecharAvisoGuardada() {
    setAvisoGuardada(false);
    if (temNomeProprio(identity) && devePedirAvaliacao()) setMostrarAvaliacao(true);
  }
  async function salvar(destino?: string | null) {
    if (!isComplete(team)) { setModal({ kind: "missing" }); return; }
    setSavingCloud(true);
    const res = await commitSavedCloudFor(alvo.idCompeticao, team, identity);
    setSaved(team);
    // Salvou: cancela qualquer lembrete "esqueceste de salvar" pendente. Agora
    // que o rascunho ficou igual ao guardado, o hook não voltaria a agendar; mas
    // cancelamos já o que possa estar pendente no servidor, sem esperar pela
    // próxima saída de ecrã.
    cancelarLembreteSalvarAgora(userId, idComp);
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
    // AVISO "E AGORA?": explica que agora é aguardar a competição, quantos dias
    // faltam, e convida a chamar um amigo. Uma vez só (tem "não mostrar mais").
    // Substitui o modal "Equipa salva", que não dizia o que vinha a seguir.
    if (res.ok && (await deveMostrarTutorial("ippon_aviso_pos_guardar"))) {
      setAvisoGuardada(true);
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
  // - equipa COMPLETA alterada -> avisa para guardar (modal "leave").
  // - equipa INCOMPLETA alterada -> avisa que vai descartar as alterações;
  // mantém a equipa anterior (saved) se houver, senão fica vazio (modal "incompleta").
  // - sem alterações -> sai direto.
  function tryLeave(href: string) {
    // No ciclo "montar" (veio do lixo): sair para fora do mercado descarta o que
    // se montou e deixa a equipa antiga voltar (só salvar confirma uma nova). Se
    // o destino é o mercado, fica no ciclo (não descarta). Limpamos o rascunho
    // para a equipa salva (antiga) reaparecer ao voltar.
    if (montar && !href.startsWith("/mercado")) {
      saveDraftFor(alvo.idCompeticao, saved);
      router.push(href);
      return;
    }
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
    <h1 style={{ fontFamily: FD, fontSize: 19, fontWeight: 700, textTransform: "uppercase", margin: 0, flex: 1 }}>{t("mt.titulo")}</h1>
    <button onClick={() => { setTutKeyAberta(emCompeticao ? TUT_COMP_KEY : TUT_EDICAO_KEY); setGuide(0); }} aria-label="Como funciona" style={{ width: 34, height: 34, borderRadius: "50%", border: "1px solid #243029", background: "transparent", color: "#93a39a", fontSize: 16, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>?</button>
    </header>
    {(!temEquipa || equipaIrresoluvel) ? (
        <div style={{ textAlign: "center", padding: "26px 16px", background: "#121815", border: "1px solid #243029", borderRadius: 16 }}>
        <div style={{ width: 96, height: 96, margin: "0 auto 6px" }}><Mascot belt={corFaixa} expression="feliz" /></div>
        <h2 style={{ fontFamily: FD, fontSize: 20, fontWeight: 700, textTransform: "uppercase", margin: "4px 0 8px" }}>{t("mt.aindaSemEquipa")}</h2>
        <p style={{ fontSize: 14, color: "#c7d0c9", lineHeight: 1.5, margin: "0 0 18px" }}>{t("mt.aindaSemEquipaSub")}</p>
        <a href={montar ? "/mercado?montar=1" : "/criar-equipa"} style={{ display: "inline-block", background: GOLD, color: "#1b211e", fontFamily: FD, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", padding: "13px 22px", borderRadius: 12, fontSize: 15, textDecoration: "none" }}>{t("mt.montarEquipa")}</a>
        </div>
      ) : aCarregarAtletas ? (
        <div style={{ textAlign: "center", padding: "30px 16px", background: "#121815", border: "1px solid #243029", borderRadius: 16 }}>
        <div style={{ width: 80, height: 80, margin: "0 auto 8px" }}><Mascot belt={corFaixa} expression="feliz" /></div>
        <div style={{ fontFamily: FD, fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#93a39a" }}>{t("mt.aCarregarEquipa")}</div>
        </div>
      ) : (
        <>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
        <div style={{ flexShrink: 0 }}><Escudo config={identity} size={40} /></div>
        <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: FD, fontSize: 18, fontWeight: 700, textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{identity.name}</div>
        <div style={{ fontSize: 12, color: GOLD, display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 10, height: 10, borderRadius: 3, background: corFaixa, border: "1px solid rgba(255,255,255,0.25)", flexShrink: 0 }} />
        Faixa {nomeFaixa}
        </div>
        </div>
        </div>
        <div className={destaque === "topo" ? "ilglow" : undefined} style={{ display: "flex", gap: 8, padding: 2 }}>
        <div style={{ background: "#141a17", border: `1px solid #2a4d3e`, borderRadius: 12, padding: "8px 16px", textAlign: "right" }}>
        <div style={{ fontSize: 10, color: "#93a39a", textTransform: "uppercase", letterSpacing: "0.08em" }}>{t("equipa.patrimonio")}</div>
        <div style={{ fontFamily: FD, fontSize: 20, fontWeight: 700, color: GOLD }}>
        {patrimonio !== null ? `JC ${fmt(patrimonio)}` : "—"}
        </div>
        {/* O saldo também interessa aqui: é com ele que se compra. */}
        <div style={{ fontSize: 10, color: "#7c8a82", marginTop: 2 }}>Saldo JC {fmt(saldo)}</div>
        </div>
        </div>
        </div>
        {/* AVISO de atletas indisponíveis: a equipa tem ids que já não estão
          na competição (saíram dos inscritos). Mostramo-los em baixo para
          a equipa não parecer mais pequena, e explicamos o que fazer. */}
        {ausentesIds.length > 0 && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 11, background: "linear-gradient(160deg,#2a1f1c,#10160f)", border: "1px solid #5a3a36", borderLeft: "3px solid #e2655a", borderRadius: 12, padding: "11px 13px", marginBottom: 12 }}>
            <div style={{ width: 30, height: 30, flexShrink: 0 }}><Mascot belt={corFaixa} expression="indicando" /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: FD, fontSize: 13, fontWeight: 700, textTransform: "uppercase", color: "#e2655a" }}>
            {ausentesIds.length === 1 ? "1 atleta indisponível" : `${ausentesIds.length} atletas indisponíveis`}
            </div>
            <p style={{ fontSize: 12, color: "#c7d0c9", lineHeight: 1.45, margin: "5px 0 0" }}>
            {ausentesIds.length === 1
              ? t("mt.umIndisponivel")
              : t("mt.variosIndisponiveis")}
            {editavel
              ? t("mt.substituiMercado")
              : t("mt.substituiDepois")}
            </p>
            </div>
            </div>
          )}
        <section className={destaque === "atletas" || destaque === "vazio" ? "ilglow" : undefined} style={{ background: tema.foraBg, border: `2px solid ${tema.foraBorda}`, borderRadius: 16, padding: 10 }}>
        <div style={{ background: tema.dentroBg, border: `2px solid ${tema.dentroBorda}`, borderRadius: 10, padding: "12px 10px" }}>
        <SectionLabel>{t("mt.masculino")}</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 14 }}>
        {males.map((a) => <Cell key={a.id} a={a} captain={a.id === team.captain} score={scoreOf(a)} phase={marketPhase} onClick={() => setModal({ kind: "athlete", a })} />)}
        {editavel && Array.from({ length: vagasM }).map((_, i) => <EmptyCell key={"vm" + i} montar={montar} />)}
        </div>
        <SectionLabel>{t("mt.feminino")}</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
        {females.map((a) => <Cell key={a.id} a={a} captain={a.id === team.captain} score={scoreOf(a)} phase={marketPhase} onClick={() => setModal({ kind: "athlete", a })} />)}
        {editavel && Array.from({ length: vagasF }).map((_, i) => <EmptyCell key={"vf" + i} montar={montar} />)}
        </div>
        </div>
        </section>
        {/* SELETOR DE COR DO TATAME (Pro Max). Botão discreto por baixo do
          tatame. Pro Max escolhe entre os 5 temas; não-Pro-Max vê o painel
          bloqueado, com convite a subir. Guarda no servidor (/api/tatame). */}
        <SeletorTatame
        aberto={seletorTatame}
        onToggle={() => setSeletorTatame((v) => !v)}
        atual={tatameId}
        isProMax={isProMax}
        onEscolher={(id) => {
            if (!isProMax) { router.push("/pro-max"); return; }
            void setTatame(id);
          }}
        />
        {/* SECÇÃO DE INDISPONÍVEIS: atletas guardados na equipa que a pool já
          não conhece (sem dados de nome/género/preço). Mostramos só o id e,
          se editável, um botão para os remover. Fora da grelha M/F porque
          não sabemos o género destes ids. */}
        {ausentesIds.length > 0 && (
            <div style={{ marginTop: 14, background: "#121815", border: "1px solid #3a2422", borderRadius: 14, padding: "12px 14px" }}>
            <div style={{ fontFamily: FD, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#ef8d83", marginBottom: 10 }}>
            Indisponíveis nesta competição
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {ausentesIds.map((id) => (
                  <div key={id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: "#161109", border: "1px dashed #5a3a36", borderRadius: 10, padding: "9px 11px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <div style={{ width: 30, height: 34, borderRadius: 6, background: "#1a1410", border: "1px dashed #5a3a36", display: "flex", alignItems: "center", justifyContent: "center", color: "#7c5a52", fontSize: 16, flexShrink: 0 }}>?</div>
                  <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: "#d6c2bd" }}>{t("mt.atletaIndisponivel")}</div>
                  <div style={{ fontSize: 10.5, color: "#7c5a52" }}>{t("mt.naoInscrito")}</div>
                  </div>
                  </div>
                  {editavel && (
                      <button onClick={() => removerAusente(id)} aria-label={t("mt.removerIndisponivel")} style={{ flexShrink: 0, border: "1px solid #5a2f2c", background: "transparent", color: "#ef8d83", fontFamily: FD, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", padding: "7px 12px", borderRadius: 9, cursor: "pointer" }}>{t("mt.remover")}</button>
                    )}
                  </div>
                ))}
            </div>
            </div>
          )}
        <div className={destaque === "total" ? "ilglow" : undefined} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, padding: "12px 14px", background: "#141a17", border: "1px solid #243029", borderRadius: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 60, height: 60, flexShrink: 0 }}><Mascot belt={corFaixa} expression={emCompeticao ? "determinado" : "feliz"} /></div>
        <div>
        <div style={{ fontSize: 12, color: "#93a39a" }}>
        {emCompeticao ? t("equipa.rodadaADecorrer") : "Mercado aberto"}
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
            <>
            <div style={{ marginTop: 12, padding: "11px 14px", background: "#16201b", border: "1px solid #2a4d3e", borderRadius: 12, fontSize: 12.5, color: "#aee9c9", textAlign: "center" }}>
            A tua equipa está em competição. Podes acompanhar os pontos aqui — o mercado abre de novo para a próxima rodada.
            {horaTick && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 6, fontSize: 11, color: "#7fd1a3" }}>
                <span className="ilp" style={{ width: 7, height: 7, borderRadius: "50%", background: "#7fd1a3" }} />
                Ao vivo · atualizado às {horaTick}
                </div>
              )}
            </div>
            <button onClick={() => setModal({ kind: "share" })} style={{ width: "100%", marginTop: 12, padding: 13, borderRadius: 12, border: "none", background: GOLD, color: "#1b211e", fontFamily: FD, fontSize: 15, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <ShareIcon />
            Partilhar a minha equipa
            </button>
            </>
          ) : (
            <>
            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            <button onClick={() => setModal({ kind: "trash" })} aria-label="Limpar equipa" style={{ width: 46, borderRadius: 11, border: "1px solid #3a2422", background: "transparent", color: "#ef8d83", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
            <TrashIcon />
            </button>
            <button onClick={() => setModal({ kind: "share" })} aria-label="Partilhar equipa" style={{ width: 46, borderRadius: 11, border: "1px solid #243029", background: "transparent", color: "#cfd8d2", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
            <ShareIcon />
            </button>
            <a href={montar ? "/mercado?montar=1" : "/mercado"} onClick={(e) => { e.preventDefault(); tryLeave(montar ? "/mercado?montar=1" : "/mercado"); }} style={{ flex: 1, textAlign: "center", background: GOLD, color: "#1b211e", fontFamily: FD, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", padding: 12, borderRadius: 11, fontSize: 13, textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center" }}>{t("mt.verMercado")}</a>
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
        <div style={{ flex: 1, fontSize: 12, color: "#cfd8d2" }}>{t("mt.porGuardar")}</div>
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
        <div style={{ width: 84, height: 84, margin: "0 auto 4px" }}><Mascot belt={corFaixa} expression="feliz" /></div>
        <h2 style={{ fontFamily: FD, fontSize: 20, fontWeight: 700, textTransform: "uppercase", margin: "4px 0 8px" }}>{t("mt.faltaPouco")}</h2>
        <p style={{ fontSize: 13, color: "#c7d0c9", margin: "0 0 12px" }}>{t("mt.paraGuardar")}</p>
        <div style={{ textAlign: "left", display: "flex", flexDirection: "column", gap: 7, marginBottom: 18 }}>
        {missing(team).map((m) => (
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
    {modal?.kind === "trash" && (
        <div style={overlayBg}>
        <div style={cardBox}>
        <div style={{ width: 84, height: 84, margin: "0 auto 4px" }}><Mascot belt={corFaixa} expression="determinado" /></div>
        <h2 style={{ fontFamily: FD, fontSize: 20, fontWeight: 700, textTransform: "uppercase", margin: "4px 0 8px" }}>{t("mt.limparEquipa")}</h2>
        <p style={{ fontSize: 14, color: "#c7d0c9", lineHeight: 1.5, margin: "0 0 20px" }}>{t("mt.limparEquipaSub")}</p>
        <button onClick={limparTudo} style={{ ...primaryBtn, background: "#e2655a", color: "#1b0f0e" }}>{t("mt.simLimpar")}</button>
        <button onClick={() => setModal(null)} style={ghostBtn}>{t("comum.cancelar")}</button>
        </div>
        </div>
      )}
    {modal?.kind === "leave" && (
        <div style={overlayBg}>
        <div style={cardBox}>
        <div style={{ width: 84, height: 84, margin: "0 auto 4px" }}><Mascot belt={corFaixa} expression="indicando" /></div>
        <h2 style={{ fontFamily: FD, fontSize: 20, fontWeight: 700, textTransform: "uppercase", margin: "4px 0 8px", color: GOLD }}>{t("mt.cuidadoAlteracoes")}</h2>
        <p style={{ fontSize: 14, color: "#c7d0c9", lineHeight: 1.5, margin: "0 0 20px" }}>{t("mt.cuidadoSub")}</p>
        <button onClick={() => salvar(leaveTo)} disabled={savingCloud} style={{ ...primaryBtn, opacity: savingCloud ? 0.7 : 1 }}>{savingCloud ? "A guardar…" : t("mt.salvarAlteracoes")}</button>
        <button onClick={() => { setModal(null); setLeaveTo(null); }} style={ghostBtn}>{t("comum.fechar")}</button>
        </div>
        </div>
      )}
    {modal?.kind === "share" && (
        <CartaoEquipa
        identity={identity}
        faixa={nomeFaixa}
        atletas={resolve(team.ids)}
        capitao={team.captain}
        nivel={isProMax ? "pro_max" : isPro ? "pro" : "normal"}
        pontos={emCompeticao ? pontos : undefined}
        onClose={() => setModal(null)}
        />
      )}
    {modal?.kind === "incompleta" && (
        <div style={overlayBg}>
        <div style={cardBox}>
        <div style={{ width: 84, height: 84, margin: "0 auto 4px" }}><Mascot belt={corFaixa} expression="indicando" /></div>
        <h2 style={{ fontFamily: FD, fontSize: 20, fontWeight: 700, textTransform: "uppercase", margin: "4px 0 8px", color: GOLD }}>{t("mt.equipaIncompleta")}</h2>
        <p style={{ fontSize: 14, color: "#c7d0c9", lineHeight: 1.5, margin: "0 0 20px" }}>
        {isComplete(saved)
          ? "As tuas alterações estão incompletas e não podem ser guardadas assim. Se saíres, mantemos a tua equipa anterior — completa — e descartamos estas alterações."
          : t("mt.soCompleta")}
        </p>
        <button onClick={sairDescartando} style={{ ...primaryBtn, background: "#e2655a", color: "#1b0f0e" }}>
        {isComplete(saved) ? "Sair e manter a anterior" : "Sair sem equipa"}
        </button>
        <button onClick={() => { setModal(null); setLeaveTo(null); }} style={ghostBtn}>{t("mt.continuarMontar")}</button>
        </div>
        </div>
      )}
    {mostrarAvaliacao && (
        <Avaliacao nomeTime={identity.name} onClose={() => setMostrarAvaliacao(false)} />
      )}
    {/* AVISO "e agora?" — logo depois de guardar a equipa, uma vez. */}
    {avisoGuardada && <AvisoEquipaGuardada onFechar={fecharAvisoGuardada} />}
    {guide !== null && passoAtual && (
        <TutorialMeuTime
        passos={passos}
        step={guide}
        setStep={setGuide}
        cor={corFaixa}
        onClose={() => {
            // Marca como visto EXATAMENTE a chave que abriu este tutorial.
            // (Usar tutKeyAberta — não recalcular por emCompeticao — evita o bug
              // de abrir um tutorial e gravar outro, que o fazia reaparecer sempre.)
            const chave = tutKeyAberta ?? (emCompeticao ? TUT_COMP_KEY : TUT_EDICAO_KEY);
            marcarTutorialVisto(chave);
            // Atualiza também o estado local em memória, para o efeito de "primeira
            // vez" não reabrir o tutorial enquanto esta sessão continua aberta.
            setVistosConta((prev) => ({ ...(prev ?? {}), [chave]: true }));
            setGuide(null);
            setTutKeyAberta(null);
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
| { fase: "vazio"; estadoTexto?: string }
| { fase: "ok"; lutas: LutaDetalhe[]; total: number };
const sinal = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
function AthleteDetail({ a, captain, score, temResultados, editavel, idComp, onCaptain, onSell, onClose }: { a: Athlete; captain: boolean; score: number; temResultados: boolean; editavel: boolean; idComp: string; onCaptain: () => void; onSell: () => void; onClose: () => void }) {
  const t = useT();
  const up = a.variation >= 0;
  const [detalhe, setDetalhe] = useState<EstadoDetalhe>({ fase: "carregando" });
  // Mercado ainda aberto? Então não há detalhe nenhum a mostrar — nem sequer
  // pedimos. (Ver o portão anti-espreitadela no MeuTimeInner e no servidor.)
  const podeVerPontos = pontosVisiveisPorId(idComp);
  const mostrarResultados = temResultados && podeVerPontos;
  // Resumo de lutas (para o card "Desempenho" durante a competição). Conta
  // vitórias/derrotas a partir do detalhe já carregado — sem chamadas extra.
  const resumoLutas = (() => {
      if (detalhe.fase !== "ok") return null;
      let v = 0, d = 0;
      for (const l of detalhe.lutas) {
        if (l.venceu === true) v++;
        else if (l.venceu === false) d++;
      }
      return { lutas: detalhe.lutas.length, vitorias: v, derrotas: d };
    })();
  // Busca a decomposição luta-a-luta só quando há resultados (competição a
    // decorrer ou encerrada) E o mercado já fechou. Sem isso não faz sentido
  // (e poupa a chamada).
  useEffect(() => {
      if (!mostrarResultados) return;
      let active = true;
      setDetalhe({ fase: "carregando" });
      fetch(`/api/atleta-rodada?comp=${encodeURIComponent(idComp)}&person=${encodeURIComponent(a.id)}`)
      .then((r) => r.json())
      .then((j) => {
          if (!active) return;
          const lutas: LutaDetalhe[] = Array.isArray(j?.lutas) ? j.lutas : [];
          if (!j || !j.tem_resultados || lutas.length === 0) {
            // Sem lutas: usa a mensagem de estado (a aguardar / não competiu /
              // campeão sem luta) vinda do endpoint, em vez de um texto genérico.
            setDetalhe({ fase: "vazio", estadoTexto: typeof j?.estado_texto === "string" ? j.estado_texto : undefined });
            return;
          }
          setDetalhe({ fase: "ok", lutas, total: typeof j.total === "number" ? j.total : 0 });
        })
      .catch(() => { if (active) setDetalhe({ fase: "erro" }); });
      return () => { active = false; };
    }, [a.id, idComp, mostrarResultados]);
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
    <div style={{ fontSize: 10, color: "#93a39a", textTransform: "uppercase" }}>{t("mt.preco")}</div>
    <div style={{ fontFamily: FD, fontSize: 17, fontWeight: 700, color: GOLD }}>JC {a.priceJc.toFixed(1)}</div>
    </div>
    <div style={{ flex: 1, background: "#141a17", border: "1px solid #243029", borderRadius: 12, padding: "10px 12px" }}>
    {mostrarResultados ? (
        <>
        <div style={{ fontSize: 10, color: "#93a39a", textTransform: "uppercase" }}>{t("mt.desempenho")}</div>
        {resumoLutas ? (
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 2 }}>
            <span style={{ fontFamily: FD, fontSize: 17, fontWeight: 700, color: "#f1ede2" }}>{resumoLutas.lutas}</span>
            <span style={{ fontSize: 11, color: "#93a39a" }}>{resumoLutas.lutas === 1 ? "luta" : "lutas"}</span>
            <span style={{ fontFamily: FD, fontSize: 13, fontWeight: 700, color: "#7fd1a3", marginLeft: 2 }}>{resumoLutas.vitorias}V</span>
            <span style={{ fontFamily: FD, fontSize: 13, fontWeight: 700, color: "#ef8d83" }}>{resumoLutas.derrotas}D</span>
            </div>
          ) : (
            <div style={{ fontFamily: FD, fontSize: 14, fontWeight: 700, color: "#5f6f67", marginTop: 2 }}>—</div>
          )}
        </>
      ) : (
        <>
        <div style={{ fontSize: 10, color: "#93a39a", textTransform: "uppercase" }}>{t("mt.valorizacao")}</div>
        <div style={{ fontFamily: FD, fontSize: 17, fontWeight: 700, color: up ? "#7fd1a3" : "#ef8d83" }}>{up ? "▲" : "▼"} {Math.abs(a.variation)}%</div>
        </>
      )}
    </div>
    </div>
    {mostrarResultados ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#16201b", border: `1px solid ${GOLD}`, borderRadius: 12, padding: "12px 14px", marginBottom: editavel ? 16 : 0 }}>
        <div>
        <div style={{ fontFamily: FD, fontSize: 13, fontWeight: 700, textTransform: "uppercase" }}>{t("mt.pontosRodada")}</div>
        {captain && <div style={{ fontSize: 11, color: "#FF8F00", marginTop: 2 }}>{t("mt.capitaoDobra")}</div>}
        </div>
        <div style={{ fontFamily: FD, fontSize: 26, fontWeight: 700, color: GOLD }}>{score >= 0 ? "+" : ""}{score} pts</div>
        </div>
      ) : (
        <div style={{ background: "#141a17", border: "1px solid #243029", borderRadius: 12, padding: "14px", textAlign: "center", fontSize: 12.5, color: "#93a39a", marginBottom: editavel ? 16 : 0, lineHeight: 1.5 }}>
        {podeVerPontos
          ? t("mt.aindaNaoComecou")
          : "🔒 Os pontos só aparecem depois de o mercado fechar. Assim ninguém escolhe a equipa a olhar para os resultados."}
        </div>
      )}
    {/* DECOMPOSIÇÃO luta-a-luta — só quando há resultados E se podem ver. */}
    {mostrarResultados && (
        <DetalheLutas estado={detalhe} captain={captain} />
      )}
    {/* AÇÕES: só quando editável (mercado aberto). Em competição, não se mexe. */}
    {editavel ? (
        <div style={{ marginTop: 16 }}>
        <button onClick={onCaptain} style={{ ...primaryBtn, background: captain ? "#1c3a2e" : GOLD, color: captain ? "#aee9c9" : "#1b211e" }}>
        {captain ? t("mt.removerCapitao") : t("mt.tornarCapitao")}
        </button>
        <button onClick={onSell} style={{ display: "block", width: "100%", marginTop: 10, textAlign: "center", border: "1px solid #5a2f2c", background: "transparent", color: "#ef8d83", padding: "11px", borderRadius: 12, fontSize: 14, fontWeight: 700, fontFamily: FD, textTransform: "uppercase", letterSpacing: "0.03em", cursor: "pointer" }}>{t("mt.vender")}</button>
        </div>
      ) : null}
    </div>
    </div>
  );
}
// Lista das lutas decompostas (ou estados de carregamento/vazio).
function DetalheLutas({ estado, captain }: { estado: EstadoDetalhe; captain: boolean }) {
  const t = useT();
  if (estado.fase === "carregando") {
    return (
      <div style={{ marginTop: 14, textAlign: "center", fontSize: 12, color: "#93a39a", fontFamily: FD, letterSpacing: "0.05em" }}>
      A carregar o detalhe…
      </div>
    );
  }
  if (estado.fase === "erro" || estado.fase === "vazio") {
    return (
      <div style={{ marginTop: 14, textAlign: "center", fontSize: 12, color: "#5f6f67", lineHeight: 1.45 }}>
      {estado.fase === "erro"
        ? t("mt.detalheErro")
        : (estado.estadoTexto || t("mt.semLutas"))}
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
          {l.venceu === true && <span style={{ fontSize: 9, color: "#7fd1a3", border: "1px solid #2a4d3e", borderRadius: 5, padding: "1px 5px", fontWeight: 700 }}>{t("mt.vitoria")}</span>}
          {l.venceu === false && <span style={{ fontSize: 9, color: "#ef8d83", border: "1px solid #5a2f2c", borderRadius: 5, padding: "1px 5px", fontWeight: 700 }}>{t("mt.derrota")}</span>}
          {l.hansoku && <span style={{ fontSize: 9, color: "#e2655a", border: "1px solid #5a2f2c", borderRadius: 5, padding: "1px 5px", fontWeight: 700 }}>HANSOKU</span>}
          </div>
          <span style={{ fontFamily: FD, fontSize: 14, fontWeight: 700, color: l.pontos >= 0 ? "#7fd1a3" : "#ef8d83", flexShrink: 0 }}>{sinal(l.pontos)}</span>
          </div>
          {/* Rubricas (ações) da luta. */}
          <div style={{ padding: "8px 12px", display: "flex", flexDirection: "column", gap: 5 }}>
          {l.rubricas.length === 0 ? (
              <div style={{ fontSize: 11.5, color: "#5f6f67", fontStyle: "italic" }}>{t("mt.semAcoes")}</div>
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
    <span style={{ fontFamily: FD, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#93a39a" }}>{t("mt.totalLutas")}</span>
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
// Seletor de cor do tatame (Pro Max). Mostra os 5 temas em miniatura. Pro Max
// escolhe; não-Pro-Max vê tudo bloqueado (cadeado + convite a subir a Pro Max).
function SeletorTatame({ aberto, onToggle, atual, isProMax, onEscolher }: { aberto: boolean; onToggle: () => void; atual: TatameId; isProMax: boolean; onEscolher: (id: TatameId) => void }) {
  const t = useT();
  return (
    <div style={{ marginTop: 12 }}>
    <button onClick={onToggle} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", background: "#121815", border: `1px solid ${isProMax ? "#2a4d3e" : "#243029"}`, borderRadius: 12, padding: "11px 14px", cursor: "pointer", color: "#f1ede2", fontFamily: FB }}>
    <span style={{ display: "flex", alignItems: "center", gap: 9 }}>
    <span style={{ display: "flex", gap: 3 }}>
    <span style={{ width: 12, height: 14, borderRadius: 3, background: tatamePorId(atual).foraBg, border: `1px solid ${tatamePorId(atual).foraBorda}` }} />
    <span style={{ width: 12, height: 14, borderRadius: 3, background: tatamePorId(atual).dentroBg, border: `1px solid ${tatamePorId(atual).dentroBorda}` }} />
    </span>
    <span style={{ fontSize: 13, fontWeight: 700 }}>{t("mt.corTatame")}</span>
    {!isProMax && (
        <span style={{ fontSize: 9.5, color: "#7fb8f5", border: "1px solid #2f5478", borderRadius: 999, padding: "2px 7px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>Pro Max</span>
      )}
    </span>
    <span style={{ color: "#93a39a", transform: aberto ? "rotate(90deg)" : "none", transition: "transform 0.2s" }}>
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6" /></svg>
    </span>
    </button>
    {aberto && (
        <div style={{ marginTop: 8, background: "#121815", border: "1px solid #243029", borderRadius: 12, padding: 12 }}>
        {!isProMax && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 9, background: "#0f1620", border: "1px solid #2f5478", borderRadius: 10, padding: "10px 12px", marginBottom: 12 }}>
            <span style={{ color: "#7fb8f5", flexShrink: 0, marginTop: 1 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
            </span>
            <div style={{ fontSize: 12, color: "#cdd9e6", lineHeight: 1.5 }}>
            Trocar a cor do tatame é exclusivo do <strong style={{ color: "#7fb8f5" }}>Pro Max</strong>. Toca num tema para saber mais.
            </div>
            </div>
          )}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10 }}>
        {TATAMES.map((t) => {
              const escolhido = isProMax && t.id === atual;
              return (
                <button key={t.id} onClick={() => onEscolher(t.id)} style={{ position: "relative", display: "flex", flexDirection: "column", gap: 6, background: "transparent", border: `2px solid ${escolhido ? "#7fd1a3" : "#243029"}`, borderRadius: 12, padding: 7, cursor: "pointer", opacity: isProMax ? 1 : 0.85 }}>
                <div style={{ border: `2px solid ${t.foraBorda}`, background: t.foraBg, borderRadius: 9, padding: 5 }}>
                <div style={{ border: `2px solid ${t.dentroBorda}`, background: t.dentroBg, borderRadius: 6, height: 30 }} />
                </div>
                <span style={{ fontSize: 11, color: escolhido ? "#7fd1a3" : "#cfd8d2", fontWeight: 700, textAlign: "center" }}>{t.nome}</span>
                {escolhido && (
                    <span style={{ position: "absolute", top: -8, right: -7, background: "#7fd1a3", color: "#0c1a12", borderRadius: "50%", width: 19, height: 19, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg>
                    </span>
                  )}
                {!isProMax && (
                    <span style={{ position: "absolute", top: 8, right: 8, color: "rgba(255,255,255,0.85)" }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                    </span>
                  )}
                </button>
              );
            })}
        </div>
        {!isProMax && (
            <a href="/pro-max" style={{ display: "block", textAlign: "center", marginTop: 12, background: "#7fb8f5", color: "#0a1828", fontFamily: FD, fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", padding: "11px", borderRadius: 10, textDecoration: "none" }}>{t("mt.desbloquearMax")}</a>
          )}
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
function EmptyCell({ montar }: { montar?: boolean }) {
  const t = useT();
  return (
    <a href={montar ? "/mercado?montar=1" : "/mercado"} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5, padding: "8px 3px", borderRadius: 12, border: "1.5px dashed rgba(217,164,65,0.7)", background: "rgba(12,14,13,0.62)", textDecoration: "none", minHeight: 92 }}>
    <div style={{ width: 26, height: 26, borderRadius: "50%", border: `2px solid ${GOLD}`, color: GOLD, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, lineHeight: 1 }}>+</div>
    <div style={{ fontSize: 9, color: GOLD, fontWeight: 700, textTransform: "uppercase" }}>{t("mt.mercado")}</div>
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
// Cancelamento imediato do lembrete "esqueceste de salvar", chamado ao SALVAR
// (sem esperar pela próxima saída de ecrã). Reutiliza a mesma rota do hook.
function cancelarLembreteSalvarAgora(userId: string | null, idComp: string) {
  if (!userId || !idComp) return;
  try {
    fetch("/api/lembrete-salvar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, id_competicao: idComp, acao: "cancelar" }),
        keepalive: true,
      }).catch(() => {});
  } catch {}
}
// Tutorial do Meu Time (edição ou competição). Balão em baixo, seta SEMPRE para
// cima (os elementos destacados estão acima do balão). O elemento citado pulsa
// via a classe ilglow aplicada no corpo da página (controlada por `destaque`).
// `cor` = cor da faixa do jogador, para o Dôdo aparecer com a faixa certa.
function TutorialMeuTime({ passos, step, setStep, onClose, cor }: { passos: { t: string; x: string; target: string }[]; step: number; setStep: (s: number | null) => void; onClose: () => void; cor: string }) {
  const t = useT();
  const s = passos[step];
  const total = passos.length;
  return (
    <div style={{ position: "fixed", left: 0, right: 0, bottom: 20, padding: "0 12px", zIndex: 100 }}>
    <div style={{ maxWidth: 436, margin: "0 auto", display: "flex", gap: 10, alignItems: "flex-end" }}>
    <div style={{ width: 58, height: 58, flexShrink: 0 }}><Mascot belt={cor} expression="indicando" /></div>
    <div style={{ flex: 1, background: "#121815", border: `1px solid ${GOLD}`, borderRadius: 14, padding: "12px 14px", boxShadow: `0 0 0 3px rgba(217,164,65,0.18)` }}>
    <div className="ilseta" style={{ display: "flex", justifyContent: "center", color: GOLD, margin: "0 0 6px" }}>
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
    </div>
    <div style={{ textAlign: "right", marginBottom: 6 }}>
    <button onClick={onClose} style={{ background: "transparent", border: "none", color: "#cfd8d2", fontSize: 12, cursor: "pointer", fontFamily: FB }}>{t("comum.pular")} ✕</button>
    </div>
    <div style={{ fontFamily: FD, fontSize: 14, fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>{s.t}</div>
    <p style={{ fontSize: 12.5, color: "#c7d0c9", lineHeight: 1.45, margin: 0 }}>{s.x}</p>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
    <button onClick={() => step > 0 && setStep(step - 1)} style={{ background: "transparent", border: "none", color: step === 0 ? "#3c463f" : "#93a39a", fontSize: 13, fontWeight: 700, cursor: step === 0 ? "default" : "pointer", fontFamily: FB }}>{t("comum.anterior")}</button>
    <span style={{ fontSize: 11, color: "#5f6f67" }}>{step + 1} de {total}</span>
    <button onClick={() => (step === total - 1 ? onClose() : setStep(step + 1))} style={{ background: GOLD, border: "none", color: "#1b211e", padding: "8px 18px", borderRadius: 9, fontFamily: FD, fontSize: 13, fontWeight: 700, textTransform: "uppercase", cursor: "pointer" }}>{step === total - 1 ? "Concluir" : "Seguinte"}</button>
    </div>
    </div>
    </div>
    </div>
  );
}
