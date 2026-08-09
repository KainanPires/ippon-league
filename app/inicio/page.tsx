"use client";
import { useState, useEffect, useRef } from "react";
import { Mascot } from "@/components/Mascot";
import { loadSavedFor, resolve, loadSavedCloudFor, loadIdentityCloudFor, setAthletePool, uid, type TeamState } from "@/lib/team";
import { loadIdentity, type Identity } from "@/components/Escudo";
import { Desempenho } from "@/components/Desempenho";
import { GaleriaResumos } from "@/components/GaleriaResumos";
import { desempenhosVistosConta, marcarDesempenhoVisto, aoVivoVistoConta, marcarAoVivoVisto, construirDesempenho, buscarResultados, buscarResultadosCongelados, buscarResumoExtra, mensagemDesempenho, type DesempenhoRodada, type ResumoExtra } from "@/lib/desempenho";
import { supabase } from "@/lib/supabase";
import { focoMercado, textoFecho, competicaoDaSemana, nomeCompeticao } from "@/lib/calendario";
import { mensagensModaisDeHoje, type MensagemEspecial } from "@/lib/mensagensEspeciais";
import { continenteDoPais } from "@/lib/continentes";
import { tutoriaisVistosConta, marcarTutorialVisto } from "@/lib/tutorials";
import { PRECO } from "@/lib/precos";
import { SinoNotificacoes } from "@/components/SinoNotificacoes";
import { criarNotificacao } from "@/lib/notificacoes";
import { normalizarFaixa, corDaFaixa, nomeDaFaixa, type Faixa } from "@/lib/faixas";
// NÍVEL DE SUBSCRIÇÃO: vem do useNivel(), que lê da tabela `users` — a MESMA
// fonte que o servidor usa para bloquear. Antes lia-se do user_metadata da
// sessão, e desde que o trigger deixou de sincronizar o nível, essa cópia podia
// estar desatualizada: alguém marcado como Pro na tabela via "Sê Pro" na app.
import { useNivel } from "@/lib/useNivel";
import { CartaoInstalarApp } from "@/components/InstalarApp";
import { LembreteNotificacoes } from "@/components/NotificacoesPush";
import { reconciliarPush } from "@/lib/push";
// Blog do Dôdo: notícias geradas a partir dos dados do jogo. Dá motivo para
// abrir a app num dia sem competição — o buraco de retenção que o plano
// original identificou.
import { HubCarrossel } from "@/components/HubCarrossel";

// A barra inferior deixou de estar copiada em cada página. Vive uma vez em
// components/BarraInferior.tsx, e é lá que o separador Pro pulsa a dourado
// para quem tem Pro e ainda não visitou a área.
import { BarraInferior } from "@/components/BarraInferior";
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
// ---------------------------------------------------------------------------
// LIGA TERMINADA? Mesma regra do ecrã /ligas (componente Ligas), de propósito:
// os dois sítios têm de concordar sempre. Pontos corridos acabam com
// estado='terminada'; uma copa acaba com copa_estado='terminada'.
//
// O cartão "As tuas ligas" do início mostra o que está A DECORRER. Uma copa já
// decidida não é uma competição em curso — dizer que é engana o jogador (parecia
  // que o mata-mata ainda estava a jogar-se depois de haver campeão). O histórico
// e os certificados vivem em /ligas → Resultados.
// ---------------------------------------------------------------------------
interface LigaBruta {
  id: string;
  name: string;
  membros?: number;
  formato?: string;
  estado?: string | null;
  copa_estado?: string | null;
}
function ligaTerminada(l: LigaBruta): boolean {
  if (String(l.formato) === "copa") return l.copa_estado === "terminada";
  return l.estado === "terminada";
}
function computeTeamInfo(saved: TeamState): { name: string; value: string; last: number } | null {
  if (saved.ids.length === 0) return null;
  const athletes = resolve(saved.ids);
  const resolvido = athletes.length > 0;
  const value = Math.round(athletes.reduce((s, a) => s + a.priceJc, 0) * 10) / 10;
  const last = athletes.reduce((s, a) => s + a.last + (a.id === saved.captain ? a.last : 0), 0);
  return { name: loadIdentity().name, value: resolvido ? String(value) : "—", last: resolvido ? last : 0 };
}
// ---------------------------------------------------------------------------
// Modais de evento: controlo de "visto" (1x por evento) em localStorage, por
// utilizador. A chave de cada modal vem do motor (comp-<id>, aniversario-<ano>…).
// ---------------------------------------------------------------------------
function modalKey(chave: string, userId: string | null | undefined): string {
  return `ippon_modal_visto__${chave}__${userId ?? "anon"}`;
}
function modalVisto(chave: string, userId: string | null | undefined): boolean {
  try { return localStorage.getItem(modalKey(chave, userId)) === "1"; } catch { return false; }
}
function marcarModalVisto(chave: string, userId: string | null | undefined) {
  try { localStorage.setItem(modalKey(chave, userId), "1"); } catch {}
}
export default function Inicio() {
  const [ready, setReady] = useState(false);
  const [visitante, setVisitante] = useState(false);
  const [phase, setPhase] = useState<"tutorial" | null>(null);
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  // ehPro é verdadeiro para Pro E para Pro Max (os níveis são cumulativos).
  const { ehPro: isPro, ehProMax: isProMax } = useNivel();
  const [faixaJogo, setFaixaJogo] = useState<Faixa>("branca");
  // PATRIMÓNIO REAL, de users.patrimony_jc. Não se calcula no ecrã: é o valor
  // que o motor de congelamento escreve a cada rodada, com as valorizações e
  // desvalorizações já aplicadas. Ver a nota em TeamBuilt.
  const [patrimonio, setPatrimonio] = useState<number | null>(null);
  // Email por confirmar? Enquanto não estiver, mostra-se uma faixa. Não bloqueia
  // nada — a pessoa joga na mesma; só fica a saber que falta.
  const [emailPorVerificar, setEmailPorVerificar] = useState(false);
  const [modaisFila, setModaisFila] = useState<MensagemEspecial[]>([]);
  const [savedTeam, setSavedTeam] = useState<TeamState | null>(null);
  const [minhasLigas, setMinhasLigas] = useState<{ id: string; name: string; membros: number }[] | null>(null);
  const [desempenho, setDesempenho] = useState<{ dados: DesempenhoRodada; team: TeamState } | null>(null);
  const [extra, setExtra] = useState<ResumoExtra | null>(null);
  const [desempenhoDaGaleria, setDesempenhoDaGaleria] = useState(false);
  // O resumo aberto é AO VIVO (competição a decorrer, pontos parciais)? A galeria
  // e os resultados congelados são sempre FINAIS (aoVivo=false).
  const [desempenhoAoVivo, setDesempenhoAoVivo] = useState(false);
  const [galeriaAberta, setGaleriaAberta] = useState(false);
  const [userIdState, setUserIdState] = useState<string | null>(null);
  // Identidade (nome + escudo) a usar no cartão de resumo. Arranca da identidade
  // local (rápida), mas ao abrir um resumo é substituída pela identidade REAL da
  // conta vinda da cloud (loadIdentityCloudFor) — senão o cartão saía com "A minha
  // equipa" + escudo cinza quando o localStorage não tinha a identidade carregada.
  const [identityResumo, setIdentityResumo] = useState<Identity>(loadIdentity());
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
  // Nomes a MOSTRAR. Num clássico com o mercado ainda aberto, nomeCompeticao()
  // esconde a cidade ("Grand Prix 2018 — Clássico"): quem a visse ia ao JudoBase
  // buscar os resultados de 2018 e montava a equipa perfeita.
  const nomeComp = nomeCompeticao(comp);
  const nomeADecorrer = aDecorrer ? nomeCompeticao(aDecorrer) : null;
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
          if (userId) setUserIdState(userId);
          // Reconciliação silenciosa do push: garante que a subscrição deste aparelho
          // fica ligada à conta ATUAL no servidor. Resolve a troca de conta no mesmo
          // telemóvel (permissão já concedida → ativarPush nunca corria → a conta nova
            // ficava sem push). Seguro: não faz nada sem permissão/subscrição.
          if (userId) { void reconciliarPush(userId); }
          // MARCA ATIVIDADE. É isto que impede uma conta de ser apagada por
          // inatividade — e por isso é "abrir a app", não "escalar": quem abre para
          // ver o ranking está a usar o produto na mesma.
          //
          // Não se usa o `last_sign_in_at` do Supabase porque esse só regista logins
          // NOVOS: quem fica com a sessão aberta no telemóvel durante meses nunca
          // volta a fazer login, e apareceria como inativo estando cá todos os dias.
          supabase.rpc("ippon_marcar_atividade").then(() => {}, () => {});
          if (userId) {
            fetch(`/api/liga/minhas?user_id=${userId}`)
            .then((r) => r.json())
            .then((j) => {
                if (!active) return;
                const ligas: LigaBruta[] = Array.isArray(j?.ligas) ? j.ligas : [];
                // Só as que ainda estão A DECORRER. As terminadas (copa com campeão,
                  // liga de pontos com a janela fechada) saem daqui — o seu lugar é em
                // /ligas → Resultados, com o pódio e o certificado.
                const ativas = ligas.filter((l) => !ligaTerminada(l));
                setMinhasLigas(ativas.map((l) => ({ id: l.id, name: l.name, membros: l.membros ?? 1 })));
              })
            .catch(() => { if (active) setMinhasLigas([]); });
          }
          try {
            const metaName = data.session.user?.user_metadata?.nome;
            const savedName = localStorage.getItem(`ippon_name__${uid()}`) ?? localStorage.getItem("ippon_name");
            const nomeParaMsg = metaName ? String(metaName).split(" ")[0] : (savedName || "");
            if (metaName) setName(String(metaName).split(" ")[0]);
            else if (savedName) setName(savedName);
            else setName("Campeão");
            // O nível já vem do useNivel() (tabela `users`) — não se lê do metadata.
            if (userId) {
              supabase.from("users").select("belt, data_nascimento, country_code, patrimony_jc, email_verificado_em").eq("id", userId).maybeSingle()
              .then(({ data: row }) => {
                  if (!active) return;
                  setFaixaJogo(normalizarFaixa(row?.belt));
                  const pat = Number((row as { patrimony_jc?: unknown } | null)?.patrimony_jc);
                  if (Number.isFinite(pat)) setPatrimonio(pat);
                  setEmailPorVerificar(!(row as { email_verificado_em?: unknown } | null)?.email_verificado_em);
                  // Modais de evento do dia: junta data civil (aniversário/Dia do
                    // Judô/fim/começo de ano) com a grande competição da semana (do
                    // calendário; nunca clássicos; continental só do continente do user).
                  // Mostra só os que ainda não foram vistos (1x por evento).
                  try {
                    const compSemana = competicaoDaSemana();
                    const lista = mensagensModaisDeHoje(
                      new Date(),
                      {
                        nome: nomeParaMsg || undefined,
                        dataNascimento: row?.data_nascimento ? String(row.data_nascimento) : null,
                        continente: continenteDoPais(row?.country_code),
                      },
                      {
                        // nomeCompeticao por segurança: o motor não faz modais de
                        // clássicos, mas se um dia fizer, não pode revelar a cidade.
                        nome: nomeCompeticao(compSemana),
                        nivel: compSemana.nivel,
                        classico: compSemana.classico,
                        idCompeticao: (compSemana as { idCompeticao?: string }).idCompeticao,
                      },
                    );
                    const naoVistos = lista.filter((m) => !modalVisto(m.chave, userId));
                    if (naoVistos.length > 0) setModaisFila(naoVistos);
                  } catch { /* sem mensagem: nenhum modal aparece */ }
                });
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
          (async () => {
              const vistos = await desempenhosVistosConta();
              if (!active) return;
              if (aDecorrer) {
                if (vistos[aDecorrer.idCompeticao]) return;
                // Já vi o ponto de situação ao vivo desta competição (guardado na CONTA)?
                // Então não reaparece automaticamente — fica acessível pela galeria de
                // resumos ("Os meus resumos"). Só aparece sozinho UMA vez.
                if (await aoVivoVistoConta(aDecorrer.idCompeticao)) return;
                if (!active) return;
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
                const dados = construirDesempenho(aDecorrer.idCompeticao, nomeCompeticao(aDecorrer), teamComp, pontos);
                if (dados) {
                  await carregarIdentidadeResumo(aDecorrer.idCompeticao);
                  if (!active) return;
                  // Marca JÁ como visto na CONTA: aparece uma vez automaticamente e não
                  // volta a saltar sozinho — nem ao mudar de aba, nem ao reabrir o app,
                  // nem noutro telemóvel. Fica disponível em "Os meus resumos".
                  await marcarAoVivoVisto(aDecorrer.idCompeticao);
                  if (!active) return;
                  setDesempenhoAoVivo(true);
                  setDesempenho({ dados, team: teamComp });
                  // AO VIVO: NÃO criamos a notificação de resumo aqui — a competição
                  // ainda decorre. A notificação "fizeste X pontos" só sai quando a
                  // competição fecha (ramo dos resultados congelados, abaixo).
                }
                return;
              }
              const cong = await buscarResultadosCongelados();
              if (!active || !cong) return;
              if (vistos[cong.comp]) return;
              const teamComp = await loadSavedCloudFor(cong.comp);
              if (!active || !teamComp || teamComp.ids.length === 0) return;
              try {
                const j = await fetch(`/api/atletas?id=${cong.comp}`).then((r) => r.json());
                const list = Array.isArray(j?.atletas) ? j.atletas : [];
                if (list.length > 0) setAthletePool(list as never);
              } catch {}
              if (!active) return;
              const dados = construirDesempenho(cong.comp, cong.nome, teamComp, cong.pontos);
              if (!dados) return;
              let ex: ResumoExtra | null = null;
              if (userId) ex = await buscarResumoExtra(cong.comp, userId);
              if (!active) return;
              await carregarIdentidadeResumo(cong.comp);
              if (!active) return;
              setDesempenhoAoVivo(false);
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
  // Fecha o modal de evento da frente da fila: marca-o como visto, grava no sino
  // (para não se perder) e avança para o próximo da fila.
  // Nota: os eventos COM push (aniversário, Dia do Judô) já são gravados no sino
  // pelo cron (sino + push), por isso aqui NÃO os duplicamos. Os restantes
  // (competições, fim/começo de ano) não têm push — é o fecho do modal que os
  // guarda no sino.
  function fecharModalEvento() {
    const m = modaisFila[0];
    if (m) {
      marcarModalVisto(m.chave, userIdState);
      if (!m.push) {
        const ehCompeticao = m.tipo === "mundial" || m.tipo === "olimpiada" || m.tipo === "masters" || m.tipo === "continental";
        criarNotificacao({
            tipo: `evento_${m.tipo}`,
            titulo: m.titulo,
            corpo: m.texto,
            link: ehCompeticao ? destinoEscalar : "/inicio",
          }).catch(() => {});
      }
    }
    setModaisFila((fila) => fila.slice(1));
  }
  async function abrirResumoDaGaleria(compEscolhida: string) {
    const cong = await buscarResultadosCongelados(compEscolhida);
    if (!cong) return;
    const teamComp = await loadSavedCloudFor(compEscolhida);
    if (!teamComp || teamComp.ids.length === 0) return;
    try {
      const j = await fetch(`/api/atletas?id=${compEscolhida}`).then((r) => r.json());
      const list = Array.isArray(j?.atletas) ? j.atletas : [];
      if (list.length > 0) setAthletePool(list as never);
    } catch {}
    const dados = construirDesempenho(cong.comp, cong.nome, teamComp, cong.pontos);
    if (!dados) return;
    let ex: ResumoExtra | null = null;
    if (userIdState) ex = await buscarResumoExtra(cong.comp, userIdState);
    await carregarIdentidadeResumo(cong.comp);
    setDesempenhoAoVivo(false);
    setDesempenho({ dados, team: teamComp });
    setExtra(ex);
    setDesempenhoDaGaleria(true);
    setGaleriaAberta(false);
  }
  // Carrega a identidade REAL da conta para a competição do resumo (nome + escudo
    // gravados na tabela `equipas`). Faz merge sobre a identidade local: começa de
  // loadIdentity() e sobrepõe só o que a cloud trouxer, para nenhum campo do tipo
  // Identity ficar em falta. Assim o cartão mostra o nome/escudo certos.
  async function carregarIdentidadeResumo(idComp: string) {
    const base = loadIdentity();
    try {
      const cloud = await loadIdentityCloudFor(idComp);
      if (cloud && (cloud.name || cloud.escudo)) {
        const doEscudo = (cloud.escudo && typeof cloud.escudo === "object") ? (cloud.escudo as Partial<Identity>) : {};
        const merged: Identity = { ...base, ...doEscudo } as Identity;
        if (cloud.name) merged.name = cloud.name;
        setIdentityResumo(merged);
        return;
      }
    } catch {}
    setIdentityResumo(base);
  }
  if (!ready) {
    return (
      <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#7c8a82", fontFamily: FB, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontFamily: FD, fontSize: 13, letterSpacing: "0.14em", textTransform: "uppercase" }}>A carregar…</div>
      </main>
    );
  }
  // Os modais de evento só aparecem fora do tutorial de onboarding e sem outro
  // overlay aberto (resumo da rodada / galeria), para não empilhar pop-ups.
  const modalEvento = modaisFila[0] ?? null;
  const podeMostrarModalEvento = !visitante && phase !== "tutorial" && !desempenho && !galeriaAberta;
  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: FB }}>
    <style>{`@keyframes ilpulse{0%,100%{opacity:1}50%{opacity:.3}} .ilpulse{animation:ilpulse 1.2s ease-in-out infinite} @keyframes iltut{0%,100%{box-shadow:0 0 0 3px rgba(74,144,217,0.75)}50%{box-shadow:0 0 0 9px rgba(74,144,217,0.18)}} .iltut{animation:iltut 1.3s ease-in-out infinite} @keyframes ilentrar{0%,100%{box-shadow:0 0 0 0 rgba(217,164,65,0.0)}50%{box-shadow:0 0 0 6px rgba(217,164,65,0.28)}} .ilentrar{animation:ilentrar 1.5s ease-in-out infinite;border-radius:999px} @keyframes ilmodalin{0%{opacity:0;transform:translateY(10px) scale(0.97)}100%{opacity:1;transform:none}} .ilmodalin{animation:ilmodalin 0.28s cubic-bezier(0.2,0.7,0.3,1)}`}</style>
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
    <a href="/ajuda" aria-label="Fale connosco" style={{ ...iconBtn, textDecoration: "none" }}>
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 11a7 7 0 0 1 14 0" />
    <circle cx="12" cy="8.5" r="2.6" />
    <rect x="3.5" y="10" width="3" height="6.5" rx="1.5" />
    <rect x="17.5" y="10" width="3" height="6.5" rx="1.5" />
    <path d="M19 16.5q0 4-4 4.6l-2.5.2" />
    <circle cx="12.3" cy="21.3" r="1" fill="currentColor" stroke="none" />
    </svg>
    </a>
    <SinoNotificacoes calcOpts={{ temEquipa: temEquipaCompleta }} />
    </div>
    </header>
    {/* Convite para instalar a app (PWA). Só aparece a quem ainda não instalou. */}
    <CartaoInstalarApp />
    {/* EMAIL POR CONFIRMAR. Não bloqueia nada: a pessoa joga na mesma. Mas
      fica visível, e o cron manda um lembrete por dia até confirmar. É o
      equilíbrio que se quis — não perder ninguém no registo, e ainda assim
      acabar com endereços que não existem (havia um "@gamil.com" na base). */}
    {!visitante && emailPorVerificar && <FaixaVerificarEmail />}
    {/* Botão da galeria de resumos (todas as rodadas jogadas). Só para quem tem conta. */}
    {!visitante && (
        <button onClick={() => setGaleriaAberta(true)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", gap: 10, background: "#141a17", border: "1px solid #243029", borderRadius: 12, padding: "11px 14px", marginBottom: 14, cursor: "pointer", fontFamily: FB, color: "#f1ede2", textAlign: "left" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 8, background: "#1c3a2e", flexShrink: 0 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#aee9c9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 3v18h18" /><path d="M7 14l4-4 3 3 5-6" /></svg>
        </span>
        <span>
        <span style={{ display: "block", fontSize: 13.5, fontWeight: 700 }}>Os meus resumos</span>
        <span style={{ display: "block", fontSize: 11, color: "#93a39a" }}>Revê e partilha cada rodada</span>
        </span>
        </span>
        <span style={{ color: GOLD, fontSize: 18 }}>›</span>
        </button>
      )}
    {isProMax ? (
        <a href="/pro-max-central" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: "linear-gradient(135deg,#3f86d6,#7fb8f5)", borderRadius: 14, padding: "13px 14px", marginBottom: 14, textDecoration: "none" }}>
        <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontFamily: FD, fontSize: 15, fontWeight: 700, color: "#0a1622", textTransform: "uppercase" }}>A tua central Pro Max</span>
        <span style={{ background: "#0a1622", color: "#7fb8f5", fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 999, textTransform: "uppercase", letterSpacing: "0.05em" }}>★ Pro Max</span>
        </div>
        <div style={{ fontSize: 11, color: "#0e2236", marginTop: 3 }}>Scout, personalização e as tuas vantagens no máximo</div>
        </div>
        <span style={{ background: "#0a1622", color: "#7fb8f5", fontSize: 11, fontWeight: 700, padding: "7px 12px", borderRadius: 9, whiteSpace: "nowrap" }}>Abrir</span>
        </a>
      ) : isPro ? (
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
    {!visitante && teamInfo ? <TeamBuilt info={teamInfo} fechoTexto={textoFecho(alvo)} faixa={faixaJogo} patrimonio={patrimonio} /> : <TeamCreate corDodo={visitante ? "#efeadd" : corDaFaixa(faixaJogo)} />}
    </div>
    {/* Lembrete de notificações: aparece depois de ter equipa montada. */}
    {!visitante && teamInfo && userIdState && <LembreteNotificacoes userId={userIdState} />}
    <Card>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
    <CardTitle>{ehClassico ? (emAndamento ? "Clássico atual" : "Próximo clássico") : (emAndamento ? "Competição atual" : "Próxima competição")}</CardTitle>
    {ehClassico && (
        <span style={{ display: "flex", alignItems: "center", gap: 4, background: "#3a2f12", color: GOLD, fontSize: 10.5, fontWeight: 700, padding: "3px 9px", borderRadius: 999, whiteSpace: "nowrap", textTransform: "uppercase", letterSpacing: "0.03em" }}>↻ Clássico</span>
      )}
    </div>
    <div style={{ fontSize: 15, fontWeight: 700 }}>{nomeComp}</div>
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
    {emAndamento && (
        <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 9 }}>
        <span className="ilpulse" style={{ width: 8, height: 8, borderRadius: "50%", background: "#e2655a" }} />
        <span style={{ fontFamily: FD, fontSize: 14, fontWeight: 700, textTransform: "uppercase", color: "#e2655a" }}>Ao vivo agora</span>
        </div>
        <div style={{ fontSize: 13, fontWeight: 700 }}>{nomeADecorrer ?? nomeComp}</div>
        <div style={{ fontSize: 12, color: "#93a39a", marginTop: 3, lineHeight: 1.4 }}>
        A competição está a decorrer. Acompanha o chaveamento ao vivo e segue o caminho dos teus atletas na chave.
        </div>
        {/* Botão para a chave ao vivo. Aparece a todos (com competição a
            decorrer), mas com destinos diferentes por nível:
          - visitante → entrar (e voltar à chave);
          - grátis → página de vendas (/ippon-pro);
          - Pro e Pro Max → /chave-atletas. A própria página mostra a versão
          certa: Pro vê congelada + convite Pro Max; Pro Max vê ao vivo. */}
        {(() => {
              const temAcesso = isPro || isProMax;
              const destinoChave = visitante
              ? "/entrar?voltar=/chave-atletas"
              : temAcesso
              ? "/chave-atletas"
              : "/ippon-pro";
              return (
                <a href={destinoChave} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 11, background: "#15110a", border: `1px solid ${GOLD}`, borderRadius: 10, padding: "10px 13px", textDecoration: "none", color: "#f1ede2" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 8, background: "#1c3a2e", flexShrink: 0 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#aee9c9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 3v18h18" /><path d="M7 14l4-4 3 3 5-6" /></svg>
                </span>
                <span style={{ fontSize: 13, fontWeight: 700 }}>Acompanha o chaveamento ao vivo</span>
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }}>
                {!temAcesso && <span style={{ fontSize: 9.5, color: "#3a2a08", background: GOLD, borderRadius: 999, padding: "2px 8px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>Pro</span>}
                <span style={{ color: GOLD, fontSize: 18 }}>›</span>
                </span>
                </a>
              );
            })()}
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
        Não tens nenhuma liga a decorrer. Entra numa liga oficial, cria uma com os teus amigos — ou vê os teus títulos em Resultados.
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
    {/* BLOG DO DÔDO — no fim, de propósito: quem chega aqui já viu a equipa
      e as ligas. É conteúdo para ficar, não para decidir. */}
    <HubCarrossel />
    </div>
        <BarraInferior ativo="inicio" />
    {phase === "tutorial" && <Tutorial step={step} setStep={setStep} onClose={finishOnboarding} name={nomeMostrado || "Campeão"} target={tutTarget} cor={corDaFaixa(faixaJogo)} />}
    {/* Modais de evento (aniversário, grande competição, etc.). Aparecem 1x por
      evento; em sequência quando coincidem; ao fechar vão para o sino. */}
    {podeMostrarModalEvento && modalEvento && (
        <ModalEvento msg={modalEvento} onClose={fecharModalEvento} cor={corDaFaixa(faixaJogo)} />
      )}
    {desempenho && (
        <Desempenho
        dados={desempenho.dados}
        identity={identityResumo}
        team={desempenho.team}
        nome={nomeMostrado || "Campeão"}
        faixa={nomeDaFaixa(faixaJogo)}
        pro={isPro}
        extra={extra}
        daGaleria={desempenhoDaGaleria}
        aoVivo={desempenhoAoVivo}
        userId={userIdState}
        onFechar={() => {
            // O ao vivo já foi marcado como visto na CONTA quando apareceu, por
            // isso aqui só fechamos. Não reaparece sozinho — fica em "Os meus
            // resumos".
            setDesempenho(null);
            setExtra(null);
            setDesempenhoDaGaleria(false);
            setDesempenhoAoVivo(false);
          }}
        onNaoMostrarMais={() => {
            marcarDesempenhoVisto(desempenho.dados.idCompeticao);
            setDesempenho(null);
            setExtra(null);
            setDesempenhoDaGaleria(false);
            setDesempenhoAoVivo(false);
          }}
        />
      )}
    {galeriaAberta && userIdState && (
        <GaleriaResumos
        userId={userIdState}
        onAbrir={(comp) => abrirResumoDaGaleria(comp)}
        onClose={() => setGaleriaAberta(false)}
        />
      )}
    </main>
  );
}
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
// Faixa de "confirma o teu email". Mostra o estado vindo do redirecionamento
// (?email=ok, ?email=expirado...) e deixa reenviar a ligação.
function FaixaVerificarEmail() {
  const [estado, setEstado] = useState<"normal" | "enviando" | "enviado" | "erro">("normal");
  const [msg, setMsg] = useState("");
  async function reenviar() {
    setEstado("enviando"); setMsg("");
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) { setEstado("erro"); setMsg("Entra na tua conta primeiro."); return; }
      const j = await fetch("/api/verificar-email", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }).then((r) => r.json());
      if (j?.jaVerificado) { setEstado("enviado"); setMsg("Já está confirmado!"); return; }
      if (j?.jaEnviado) { setEstado("enviado"); setMsg(String(j.nota || "Acabámos de enviar.")); return; }
      if (!j?.ok) { setEstado("erro"); setMsg("Não conseguimos enviar agora. Tenta daqui a pouco."); return; }
      setEstado("enviado"); setMsg("Enviado! Vê a tua caixa de entrada (e o spam).");
    } catch {
      setEstado("erro"); setMsg("Não conseguimos enviar agora.");
    }
  }
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 11, background: "linear-gradient(160deg,#2a2410,#10160f)", border: "1px solid #5a4a18", borderLeft: `3px solid ${GOLD}`, borderRadius: 12, padding: "11px 13px", marginBottom: 14 }}>
    <span style={{ flexShrink: 0, color: GOLD, marginTop: 1 }}>
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg>
    </span>
    <div style={{ flex: 1, minWidth: 0 }}>
    <div style={{ fontFamily: FD, fontSize: 13, fontWeight: 700, textTransform: "uppercase", color: GOLD }}>Confirma o teu email</div>
    <p style={{ fontSize: 12, color: "#c7d0c9", lineHeight: 1.45, margin: "4px 0 0" }}>
    Enviámos-te uma ligação. Confirmar garante que recebes os avisos das rodadas e que não perdes a conta.
    </p>
    {msg && <p style={{ fontSize: 11.5, color: estado === "erro" ? "#ef8d83" : "#7fd1a3", margin: "6px 0 0" }}>{msg}</p>}
    {estado !== "enviado" && (
        <button onClick={reenviar} disabled={estado === "enviando"}
        style={{ marginTop: 8, background: "transparent", border: "none", color: GOLD, fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: FB, padding: 0, textDecoration: "underline" }}>
        {estado === "enviando" ? "A enviar…" : "Reenviar o email"}
        </button>
      )}
    </div>
    </div>
  );
}
function Card({ children }: { children: React.ReactNode }) {
  return <div style={{ background: "#121815", border: "1px solid #243029", borderRadius: 14, padding: 13, marginBottom: 12 }}>{children}</div>;
}
function CardTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily: FD, fontSize: 14, fontWeight: 700, textTransform: "uppercase" }}>{children}</div>;
}
function TeamCreate({ corDodo = "#efeadd" }: { corDodo?: string }) {
  return (
    <div style={{ border: "1px solid #2a4d3e", borderRadius: 16, overflow: "hidden", marginBottom: 14, background: "repeating-linear-gradient(45deg,#1c3a2e 0 16px,#1a352a 16px 32px)" }}>
    <div style={{ padding: "20px 16px", textAlign: "center" }}>
    <div style={{ width: 64, height: 64, margin: "0 auto 6px" }}>
    <Mascot belt={corDodo} expression="feliz" />
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
// `patrimonio` = users.patrimony_jc, o valor REAL.
//
// Antes calculava-se aqui `100 - valor da equipa`. Isso não é o património: é o
// SALDO que sobra para gastar, e parte sempre de 100 fixo — por isso nunca
// oscilava, por mais que os atletas valorizassem. Alguém com 116,2 JC na base
// via "JC 2,8" no ecrã.
//
// São duas coisas diferentes e a app confundia-as:
// Património = quanto vale ao todo (equipa + saldo). Evolui a cada rodada.
// Saldo = quanto sobra para comprar. É o 100 - valor da equipa.
function TeamBuilt({ info, fechoTexto, faixa, patrimonio }: { info: { name: string; value: string; last: number }; fechoTexto: string; faixa: Faixa; patrimonio: number | null }) {
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
          // Enquanto o património não chega da base, mostra "—" em vez de um
          // número inventado: um valor errado é pior do que um traço.
          const pat = patrimonio !== null ? `JC ${Math.round(patrimonio * 10) / 10}` : "—";
          return [[pat, "Património"], [String(info.last), "Última"], [`JC ${info.value}`, "Valor"]].map(([v, l]) => (
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
function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(6,8,7,0.78)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18, zIndex: 100 }}>
    <div style={{ width: "100%", maxWidth: 320 }}>{children}</div>
    </div>
  );
}
// Modal de evento (estilo tutorial, com o Dôdo). Um botão único; ao fechar, o
// chamador marca como visto, grava no sino e avança para o próximo da fila.
// `cor` = a faixa REAL do jogador. Era fixa em #141110 (quase preto), o que dava
// o mesmo Dôdo a toda a gente — inclusive a um faixa-branca.
function ModalEvento({ msg, onClose, cor }: { msg: MensagemEspecial; onClose: () => void; cor: string }) {
  const expr: React.ComponentProps<typeof Mascot>["expression"] =
  msg.tipo === "aniversario" ? "comemorando"
  : msg.tipo === "fim_de_ano" || msg.tipo === "comeco_de_ano" || msg.tipo === "dia_do_judo" ? "feliz"
  : "indicando";
  return (
    <Overlay>
    <div className="ilmodalin" style={{ background: "#121815", border: `1px solid ${msg.cor}`, borderRadius: 16, padding: 20, textAlign: "center" }}>
    <div style={{ width: 76, height: 76, margin: "0 auto 4px" }}>
    <Mascot belt={cor} expression={expr} />
    </div>
    <div style={{ fontSize: 30, lineHeight: 1, marginBottom: 8 }} aria-hidden="true">{msg.emoji}</div>
    <div style={{ fontFamily: FD, fontSize: 19, fontWeight: 700, textTransform: "uppercase", lineHeight: 1.15, marginBottom: 9, color: msg.cor }}>{msg.titulo}</div>
    <p style={{ fontSize: 13.5, color: "#c7d0c9", lineHeight: 1.55, margin: "0 0 18px" }}>{msg.texto}</p>
    <button onClick={onClose} style={{ width: "100%", background: GOLD, color: "#1b211e", border: "none", fontFamily: FD, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", padding: 14, borderRadius: 12, fontSize: 15, cursor: "pointer", boxSizing: "border-box" }}>
    {msg.botao}
    </button>
    </div>
    </Overlay>
  );
}
// `cor` = a faixa REAL do jogador (ver a nota do ModalEvento).
// CUIDADO: a variável `isPro` aqui dentro é LOCAL e significa "este é o passo do
// Ippon Pro" — não tem nada a ver com a subscrição do utilizador.
function Tutorial({ step, setStep, onClose, name, target, cor }: { step: number; setStep: (s: number) => void; onClose: () => void; name: string; target: TutTarget; cor: string }) {
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
      <div style={{ width: 56, height: 56, flexShrink: 0 }}><Mascot belt={cor} expression="indicando" /></div>
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
        <Mascot belt={cor} expression="comemorando" />
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
        <Mascot belt={cor} expression="sabio" />
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
        <Mascot belt={cor} expression="indicando" />
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
