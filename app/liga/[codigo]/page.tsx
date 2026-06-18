"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Escudo, DEFAULT_IDENTITY, type Identity } from "@/components/Escudo";
import { focoMercado, CALENDARIO_2026, numeroDaRodada, type SemanaCalendario } from "@/lib/calendario";
import { competicaoPorId } from "@/lib/copa";
import { CartaoCertificado, type PosicaoPodio } from "@/components/CartaoCertificado";

const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";

// De quanto em quanto tempo o ranking se atualiza durante a competição.
const TICK_AO_VIVO_MS = 15000;

interface Membro {
  user_id: string;
  nome_time: string;
  escudo: Identity | null;
  escalou: boolean;
  pontos: number;
  posicao: number;
  is_pro: boolean;
}
// Linha do ranking GERAL / Judocoins (vem de /api/liga/geral).
interface MembroGeral {
  user_id: string;
  nome_time: string;
  escudo: Identity | null;
  pontos_geral: number;
  pontos_rodada: number;
  patrimonio: number;
  escalou: boolean;
  posicao: number;
  is_pro: boolean;
}
// As três vistas das ligas de amigos de pontos corridos.
type VistaLiga = "geral" | "rodada" | "jc";
interface LigaInfo {
  id: string;
  name: string;
  formato: string;
  privacidade: string;
  descricao: string | null;
  escudo: Identity | null;
  invite_code: string;
  copa_estado?: string | null;
  copa_fecho_inscricao?: string | null;
  copa_competicao_inicial?: string | null;
  liga_competicao_inicial?: string | null;
  fim_tipo?: string | null;
  fim_valor?: string | null;
  estado?: string | null;
}
interface Pedido {
  request_id: string;
  user_id: string;
  nome: string;
  time: string | null;
  created_at: string;
}

// Nome amigável do estado de privacidade.
function nomePrivacidade(p: string): string {
  if (p === "aberta") return "Aberta";
  if (p === "mediante_pedido") return "Por aprovação";
  return "Fechada";
}

// A copa já tem CHAVE? (sorteada / a decorrer / terminada). Nesse caso a página
// intermédia não faz sentido — vai-se direto à chave. Só "inscricao" (a angariar)
// é que mostra a sala de espera e o convite.
function copaTemChave(estado: string | null | undefined): boolean {
  return estado === "sorteada" || estado === "a_decorrer" || estado === "terminada";
}

const MESES_PT_INFO = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

// Frase informativa da ÉPOCA de uma liga de pontos corridos, gerada por nós a
// partir do início + fim escolhidos pelo dono. À parte da descrição livre dele.
// Devolve "" se a liga não tem janela definida (ligas antigas) — aí não mostra.
function infoEpoca(liga: { liga_competicao_inicial?: string | null; fim_tipo?: string | null; fim_valor?: string | null; estado?: string | null }): string {
  const compIni = competicaoPorId(String(liga.liga_competicao_inicial || ""));
  if (!compIni) return "";
  const terminada = String(liga.estado || "") === "terminada";
  const prefixo = terminada ? "Esta liga decorreu" : "Esta liga vai";

  if (liga.fim_tipo === "competicao") {
    const compFim = competicaoPorId(String(liga.fim_valor || ""));
    if (!compFim) return "";
    return terminada
      ? `Esta liga decorreu de ${compIni.nome} até ${compFim.nome}.`
      : `${prefixo} de ${compIni.nome} até ${compFim.nome}.`;
  }
  if (liga.fim_tipo === "mes") {
    const m = /^(\d{4})-(\d{2})$/.exec(String(liga.fim_valor || ""));
    if (!m) return "";
    const ano = Number(m[1]);
    const mesNome = MESES_PT_INFO[Number(m[2]) - 1] || "";
    if (!mesNome) return "";
    return terminada
      ? `Esta liga começou em ${compIni.nome} e terminou em ${mesNome} de ${ano}.`
      : `Esta liga começa em ${compIni.nome} e termina em ${mesNome} de ${ano}.`;
  }
  return "";
}

// Data (meio-dia, para evitar fronteiras de fuso) de uma competição do calendário.
function dataDaSemana(s: SemanaCalendario): Date {
  return new Date(s.de.replace(/\//g, "-") + "T12:00:00");
}

// Lista de rodadas que ESTA liga disputou: as competições do calendário dentro da
// janela início→fim da liga que JÁ COMEÇARAM (não mostra rodadas futuras nem as
// de antes do arranque). Ordenada da mais recente para a mais antiga (para o
// dropdown começar pelas últimas). Ligas sem janela (antigas) → todas as já
// começadas até hoje. A competição que decorre agora também entra (é "a atual").
function rodadasDaLiga(liga: LigaInfo, idAtual: string): SemanaCalendario[] {
  const ordenado = [...CALENDARIO_2026].sort((a, b) => a.semana - b.semana);

  // Limites da janela (se a liga os tiver).
  const compIni = competicaoPorId(String(liga.liga_competicao_inicial || ""));
  const iniDate = compIni ? dataDaSemana(compIni) : null;

  let fimDate: Date | null = null;
  if (liga.fim_tipo === "competicao") {
    const compFim = competicaoPorId(String(liga.fim_valor || ""));
    if (compFim) fimDate = new Date(compFim.de.replace(/\//g, "-") + "T23:59:59");
  } else if (liga.fim_tipo === "mes") {
    const m = /^(\d{4})-(\d{2})$/.exec(String(liga.fim_valor || ""));
    if (m) fimDate = new Date(Number(m[1]), Number(m[2]), 0, 23, 59, 59); // último dia do mês
  }

  const agora = new Date();
  const out = ordenado.filter((s) => {
    const d = dataDaSemana(s);
    // Já começou? (a competição-alvo atual conta mesmo que ainda não tenha
    // "começado" pela data — é a rodada para que se está a escalar/decorrer.)
    const jaComecou = d.getTime() <= agora.getTime() || s.idCompeticao === idAtual;
    if (!jaComecou) return false;
    if (iniDate && d < iniDate) return false;       // antes do arranque da liga
    if (fimDate && d > fimDate) return false;        // depois do fim da liga
    return true;
  });

  // Garante que a competição atual está na lista (caso o filtro de data a deixe
  // de fora por ser futura mas estar a decorrer/ser o alvo).
  if (!out.some((s) => s.idCompeticao === idAtual)) {
    const atualNoCal = ordenado.find((s) => s.idCompeticao === idAtual);
    if (atualNoCal) out.push(atualNoCal);
  }

  // Mais recente primeiro.
  return out.sort((a, b) => b.semana - a.semana);
}

export default function PaginaLiga() {
  const params = useParams();
  const router = useRouter();
  const codigo = String(params?.codigo || "").toUpperCase();

  const [estado, setEstado] = useState<"a_entrar" | "pronto" | "erro" | "sem_sessao" | "pedido_enviado" | "previsualizar">("a_entrar");
  const [erroMsg, setErroMsg] = useState("");
  const [liga, setLiga] = useState<LigaInfo | null>(null);
  const [membros, setMembros] = useState<Membro[]>([]);
  const [meuId, setMeuId] = useState<string | null>(null);
  const [horaTick, setHoraTick] = useState<string>("");
  const [aRedirecionar, setARedirecionar] = useState(false);

  // Pré-visualização (espreitar antes de entrar): nº de membros e o estado do
  // botão "Entrar" enquanto a inscrição decorre.
  const [nMembros, setNMembros] = useState(0);
  const [aEntrar, setAEntrar] = useState(false);
  // Confirmação "a liga já começou" (pontos corridos): a rodada de arranque vs a
  // de entrada. Só aparece quando o servidor devolve jaComecou.
  const [confirmarComeco, setConfirmarComeco] = useState<{ rodadaInicio: number; rodadaEntrada: number } | null>(null);

  // Ligas de amigos (pontos corridos): vista atual + ranking geral/JC ao vivo.
  const [vista, setVista] = useState<VistaLiga>("geral");
  const [geral, setGeral] = useState<MembroGeral[]>([]);
  const [geralCarregado, setGeralCarregado] = useState(false);

  // Painel do dono: pedidos pendentes.
  const [souDono, setSouDono] = useState(false);
  const [copaEstado, setCopaEstado] = useState<string | null>(null); // estado da copa, atualizável
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [aDecidir, setADecidir] = useState<string | null>(null);

  // Certificado da liga terminada (a posição que o utilizador clicou).
  const [certificado, setCertificado] = useState<PosicaoPodio | null>(null);

  // Overlay "a liga terminou" — salta uma vez (por conta+liga, via localStorage).
  const [mostrarFimLiga, setMostrarFimLiga] = useState(false);

  // Foco do mercado: a competição que decorre (mercado fechado) ou a de mercado aberto.
  const foco = focoMercado();
  const compAtual = foco.aDecorrer ?? foco.atual;
  const idComp = compAtual.idCompeticao;
  const emAndamento = foco.aDecorrer !== null;
  const mercadoFechado = emAndamento; // só se pode ver o dojo dos outros com mercado fechado

  // RODADA ESCOLHIDA no dropdown (vista "Rodada"). Por defeito a atual. Só afeta
  // a vista "Rodada" e o ver-dojo dessa vista — Geral/JC/tick ficam na atual.
  const [rodadaSel, setRodadaSel] = useState<string>(idComp);
  const rodadaEhAtual = rodadaSel === idComp;
  // Os membros mostrados na vista Rodada: se for a atual, usa o ranking ao vivo
  // (membros); se for passada, usa o que vier da rodada escolhida (membrosRodada).
  const [membrosRodada, setMembrosRodada] = useState<Membro[]>([]);
  const [rodadaCarregada, setRodadaCarregada] = useState(false);

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 1) Ao abrir: ESPREITAR a liga (leitura, sem inscrever). Quem já é membro
  //    segue direto; quem não é vê o cartão de pré-visualização e decide.
  useEffect(() => {
    let vivo = true;
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user?.id ?? null;
      if (!vivo) return;
      setMeuId(uid);

      try {
        const params = new URLSearchParams({ codigo });
        if (uid) params.set("user_id", uid);
        const res = await fetch(`/api/liga/espreitar?${params.toString()}`);
        const j = await res.json();
        if (!vivo) return;
        if (!j.ok) {
          setErroMsg(j.erro || "Não foi possível abrir a liga.");
          setEstado("erro");
          return;
        }
        setLiga(j.liga);
        setNMembros(typeof j.nMembros === "number" ? j.nMembros : 0);

        // Já é membro → abre a liga direto (copa com chave vai para a chave).
        if (j.jaMembro) {
          if (j.liga && j.liga.formato === "copa" && copaTemChave(j.liga.copa_estado)) {
            setARedirecionar(true);
            router.replace(`/liga/${codigo}/chave`);
            return;
          }
          setEstado("pronto");
          return;
        }

        // Não é membro → mostra o cartão de pré-visualização (decide se entra).
        setEstado("previsualizar");
      } catch {
        if (!vivo) return;
        setErroMsg("Falha de ligação.");
        setEstado("erro");
      }
    })();
    return () => { vivo = false; };
  }, [codigo, router]);

  // Entrar de facto (a partir do botão do cartão). Mantém toda a lógica do
  // /api/liga/entrar: inscreve, ou cria pedido (por aprovação), ou pede
  // confirmação se a liga já começou, ou avisa se a copa fechou.
  async function entrarAgora(confirmar = false) {
    if (aEntrar) return;
    // Sem sessão: manda entrar na conta e voltar a este link.
    if (!meuId) {
      window.location.href = `/entrar?voltar=/liga/${codigo}`;
      return;
    }
    setAEntrar(true);
    try {
      const res = await fetch("/api/liga/entrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: meuId, codigo, confirmar }),
      });
      const j = await res.json();
      if (!j.ok) {
        // Liga de pontos corridos que já começou: confirma antes de entrar.
        if (j.jaComecou) {
          setConfirmarComeco({
            rodadaInicio: typeof j.rodadaInicio === "number" ? j.rodadaInicio : 0,
            rodadaEntrada: typeof j.rodadaEntrada === "number" ? j.rodadaEntrada : 0,
          });
          setAEntrar(false);
          return;
        }
        setErroMsg(j.erro || "Não foi possível entrar na liga.");
        setEstado("erro");
        return;
      }
      // Por aprovação: ficou pedido pendente.
      if (j.pedido) {
        setEstado("pedido_enviado");
        return;
      }
      // Copa com chave: vai direto à chave.
      if (j.liga && j.liga.formato === "copa" && copaTemChave(j.liga.copa_estado)) {
        setARedirecionar(true);
        router.replace(`/liga/${codigo}/chave`);
        return;
      }
      if (j.liga) setLiga(j.liga);
      setConfirmarComeco(null);
      setEstado("pronto");
    } catch {
      setErroMsg("Falha de ligação.");
      setEstado("erro");
    } finally {
      setAEntrar(false);
    }
  }

  // 2) Quando a liga está pronta: busca o ranking (e mantém ao vivo com tick).
  useEffect(() => {
    if (estado !== "pronto" || !liga) return;
    let vivo = true;

    async function buscarRanking() {
      try {
        const res = await fetch(`/api/liga?id=${liga!.id}&comp=${idComp}`);
        const j = await res.json();
        if (!vivo) return;
        if (Array.isArray(j.membros)) setMembros(j.membros);
        setHoraTick(new Date().toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
      } catch {
        // mantém o que tinha
      }
    }

    buscarRanking();

    // Tick ao vivo só enquanto a competição decorre e a aba está visível.
    function liga_tick() {
      if (tickRef.current) clearInterval(tickRef.current);
      if (!emAndamento) return;
      tickRef.current = setInterval(() => {
        if (!document.hidden) buscarRanking();
      }, TICK_AO_VIVO_MS);
    }
    liga_tick();
    const onVis = () => { if (!document.hidden) buscarRanking(); };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      vivo = false;
      if (tickRef.current) clearInterval(tickRef.current);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [estado, liga, idComp, emAndamento]);

  // 2-rodada) Quando se escolhe uma rodada PASSADA no dropdown, busca a
  // classificação dessa rodada (uma vez; rodadas passadas não mudam). A rodada
  // atual usa o ranking ao vivo do efeito acima, por isso aqui só tratamos as
  // passadas.
  useEffect(() => {
    if (estado !== "pronto" || !liga) return;
    if (rodadaEhAtual) { setRodadaCarregada(true); return; }
    let vivo = true;
    setRodadaCarregada(false);
    (async () => {
      try {
        const res = await fetch(`/api/liga?id=${liga.id}&comp=${rodadaSel}`);
        const j = await res.json();
        if (!vivo) return;
        if (Array.isArray(j.membros)) setMembrosRodada(j.membros);
      } catch {
        if (vivo) setMembrosRodada([]);
      }
      if (vivo) setRodadaCarregada(true);
    })();
    return () => { vivo = false; };
  }, [estado, liga, rodadaSel, rodadaEhAtual]);

  // 2-bis) Ranking GERAL (acumulado ao vivo) + Judocoins — só para ligas de
  // pontos corridos. Uma só chamada a /api/liga/geral alimenta as vistas "Geral"
  // e "Judocoins" (a página ordena por pontos_geral ou por património).
  useEffect(() => {
    if (estado !== "pronto" || !liga || liga.formato === "copa") return;
    let vivo = true;
    let timer: ReturnType<typeof setInterval> | null = null;

    async function buscarGeral() {
      try {
        const res = await fetch(`/api/liga/geral?league=${liga!.id}&comp=${idComp}`);
        const j = await res.json();
        if (!vivo) return;
        if (j.ok && Array.isArray(j.membros)) setGeral(j.membros);
        setGeralCarregado(true);
      } catch {
        if (vivo) setGeralCarregado(true);
      }
    }

    buscarGeral();
    if (emAndamento) {
      timer = setInterval(() => { if (!document.hidden) buscarGeral(); }, TICK_AO_VIVO_MS);
    }
    const onVis = () => { if (!document.hidden) buscarGeral(); };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      vivo = false;
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [estado, liga, idComp, emAndamento]);

  // 2-fim) Overlay "a liga terminou": salta UMA vez por conta+liga. Só quando a
  // liga (pontos corridos) está terminada e o pódio já carregou (geralCarregado).
  // A marca de "já visto" vive no localStorage, isolada por utilizador e liga.
  useEffect(() => {
    if (estado !== "pronto" || !liga || !meuId) return;
    if (liga.formato === "copa") return;
    if (String(liga.estado || "") !== "terminada") return;
    if (!geralCarregado) return;
    const temPodio = geral.some((m) => m.pontos_geral > 0);
    if (!temPodio) return;
    const chave = `ippon_liga_fim_visto__${meuId}__${liga.id}`;
    try {
      if (localStorage.getItem(chave)) return; // já viu antes
      localStorage.setItem(chave, "1");
    } catch {
      // sem localStorage (modo privado, etc.): mostra à mesma, sem persistir.
    }
    setMostrarFimLiga(true);
  }, [estado, liga, meuId, geralCarregado, geral]);


  //    A rota /api/liga/pedidos só devolve ok:true a quem é o dono (valida lá).
  useEffect(() => {
    if (estado !== "pronto" || !liga || !meuId) return;
    let vivo = true;
    (async () => {
      try {
        const res = await fetch(`/api/liga/pedidos?league_id=${liga.id}&user_id=${meuId}`);
        const j = await res.json();
        if (!vivo) return;
        if (j.ok && Array.isArray(j.pedidos)) {
          setSouDono(true);
          setPedidos(j.pedidos);
        } else {
          setSouDono(false);
        }
      } catch {
        if (vivo) setSouDono(false);
      }
    })();
    return () => { vivo = false; };
  }, [estado, liga, meuId]);

  // Gatilho "preguiçoso" do sorteio da copa: se a liga é copa, está em inscrição
  // e o prazo de fecho já passou, pedimos o sorteio ao servidor (idempotente).
  useEffect(() => {
    if (estado !== "pronto" || !liga || liga.formato !== "copa") return;
    const est = liga.copa_estado || "inscricao";
    setCopaEstado(est);
    if (est !== "inscricao") return;
    const fecho = liga.copa_fecho_inscricao ? new Date(liga.copa_fecho_inscricao).getTime() : null;
    if (!fecho || Date.now() < fecho) return; // ainda dentro do prazo
    let vivo = true;
    (async () => {
      try {
        const res = await fetch("/api/copa/sortear", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ league_id: liga.id }),
        });
        const j = await res.json();
        if (!vivo) return;
        if (j.ok && (j.sorteada || j.jaEstava)) {
          // Acabou de sortear -> já tem chave -> vai direto à chave.
          setCopaEstado(j.estado || "sorteada");
          setARedirecionar(true);
          router.replace(`/liga/${codigo}/chave`);
        }
      } catch { /* tenta de novo na próxima abertura */ }
    })();
    return () => { vivo = false; };
  }, [estado, liga, codigo, router]);

  async function decidirPedido(p: Pedido, acao: "aprovar" | "recusar") {
    if (aDecidir || !meuId) return;
    setADecidir(p.request_id);
    try {
      const res = await fetch("/api/liga/decidir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: meuId, request_id: p.request_id, acao }),
      });
      const j = await res.json();
      if (j.ok) {
        // Tira o pedido da lista (foi decidido).
        setPedidos((lista) => lista.filter((x) => x.request_id !== p.request_id));
      }
    } catch {
      // Mantém o pedido na lista para tentar de novo.
    }
    setADecidir(null);
  }

  function partilhar() {
    if (!liga) return;
    const link = `https://www.ipponleague.com/liga/${liga.invite_code}`;
    const texto = `Entra na minha liga "${liga.name}" na Ippon League! Código: ${liga.invite_code}`;
    const navAny = navigator as unknown as { share?: (d: { title?: string; text?: string; url?: string }) => Promise<void> };
    if (navAny.share) {
      navAny.share({ title: "Ippon League", text: texto, url: link }).catch(() => {});
    } else {
      try { navigator.clipboard.writeText(link); alert("Link copiado! Cola no WhatsApp e chama o teu dojo. 🥋"); } catch {}
    }
  }

  function verDojo(m: Membro) {
    // Numa rodada PASSADA (já terminada) as escalações são públicas — abre sempre.
    // Na rodada ATUAL mantém a regra: só com o mercado fechado.
    const passada = !rodadaEhAtual;
    if (!passada && !mercadoFechado) {
      alert("Podes ver a equipa dos teus rivais quando o mercado fechar. 🔒");
      return;
    }
    // Abre o dojo do adversário em modo leitura, na rodada que está a ser vista.
    window.location.href = `/meu-time?ver=${m.user_id}&comp=${rodadaSel}`;
  }

  // Liga de pontos corridos terminada? (mostra o pódio da época + certificado)
  const ligaTerminada = !!liga && liga.formato !== "copa" && String(liga.estado || "") === "terminada";
  // Os 3 primeiros da classificação final (só conta quem pontuou na época).
  const podioFinal = ligaTerminada ? geral.filter((m) => m.pontos_geral > 0).slice(0, 3) : [];
  // Quantos participaram da época (pontuaram). Para o "entre N participantes".
  const nParticipantesEpoca = geral.filter((m) => m.pontos_geral > 0).length;

  // Lista de rodadas para o dropdown (só quando a liga está pronta e é de pontos).
  const listaRodadas: SemanaCalendario[] = (liga && liga.formato !== "copa") ? rodadasDaLiga(liga, idComp) : [];
  // A competição cuja rodada está a ser mostrada (para o cabeçalho/labels).
  const compVista = competicaoPorId(rodadaSel) ?? compAtual;
  // Os membros a mostrar na vista Rodada e o estado de carregamento.
  const membrosVista = rodadaEhAtual ? membros : membrosRodada;
  const rodadaVistaCarregada = rodadaEhAtual ? true : rodadaCarregada;
  // Etiqueta de uma rodada no dropdown: "Rodada 6 · Paris Grand Slam".
  function rotuloRodadaItem(s: SemanaCalendario): string {
    const n = numeroDaRodada(s.idCompeticao);
    const nome = s.classico ? s.nome.replace(/\s*[—-]\s*Cl[áa]ssico\s*$/i, "") : s.nome;
    return `${n ? `Rodada ${n} · ` : ""}${nome}${s.idCompeticao === idComp ? " (atual)" : ""}`;
  }

  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: FB }}>
      <div style={{ maxWidth: 460, margin: "0 auto", padding: "14px 14px 40px" }}>
        <header style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 16 }}>
          <a href="/ligas" aria-label="Voltar" style={{ width: 34, height: 34, borderRadius: "50%", border: "1px solid #243029", display: "flex", alignItems: "center", justifyContent: "center", color: "#cfd8d2", textDecoration: "none", flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
          </a>
          <h1 style={{ fontFamily: FD, fontSize: 19, fontWeight: 700, textTransform: "uppercase", margin: 0 }}>Liga</h1>
        </header>

        {(estado === "a_entrar" || aRedirecionar) && <Aviso>{aRedirecionar ? "A abrir a chave…" : "A abrir a liga…"}</Aviso>}

        {!aRedirecionar && estado === "sem_sessao" && (
          <div style={{ textAlign: "center", padding: "30px 16px", background: "#121815", border: "1px solid #243029", borderRadius: 16 }}>
            <div style={{ fontFamily: FD, fontSize: 16, fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>Convite para uma liga</div>
            <p style={{ fontSize: 13, color: "#c7d0c9", lineHeight: 1.5, marginBottom: 16 }}>Entra na tua conta para te juntares a esta liga e disputar com o teu dojo.</p>
            <a href={`/entrar?voltar=/liga/${codigo}`} style={{ display: "inline-block", background: GOLD, color: "#1b211e", fontFamily: FD, fontWeight: 700, textTransform: "uppercase", padding: "12px 22px", borderRadius: 11, textDecoration: "none", fontSize: 14 }}>Entrar para participar</a>
          </div>
        )}

        {/* CARTÃO DE PRÉ-VISUALIZAÇÃO: quem não é membro espreita a liga e decide
            se entra. A inscrição só acontece ao carregar em "Entrar". */}
        {!aRedirecionar && estado === "previsualizar" && liga && (
          <div>
            <div style={{ background: "#0f1411", border: `1px solid ${GOLD}`, borderRadius: 18, padding: "22px 18px", textAlign: "center", marginBottom: 14 }}>
              <div style={{ display: "inline-block", filter: "drop-shadow(0 6px 14px rgba(0,0,0,0.5))" }}>
                <Escudo config={liga.escudo || DEFAULT_IDENTITY} size={92} />
              </div>
              <div style={{ fontFamily: FD, fontSize: 20, fontWeight: 700, textTransform: "uppercase", marginTop: 10, wordBreak: "break-word" }}>{liga.name}</div>
              <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                <span style={{ background: "#16201b", border: "1px solid #243029", borderRadius: 999, fontSize: 11, fontWeight: 700, color: "#cfd8d2", padding: "4px 11px" }}>{liga.formato === "copa" ? "🏆 Copa Ippon" : "🏅 Pontos corridos"}</span>
                <span style={{ background: "#16201b", border: "1px solid #243029", borderRadius: 999, fontSize: 11, fontWeight: 700, color: "#cfd8d2", padding: "4px 11px" }}>{nomePrivacidade(liga.privacidade)}</span>
                <span style={{ background: "#16201b", border: "1px solid #243029", borderRadius: 999, fontSize: 11, fontWeight: 700, color: "#cfd8d2", padding: "4px 11px" }}>{nMembros} {nMembros === 1 ? "membro" : "membros"}</span>
              </div>
            </div>

            {/* Informativo automático da época (pontos corridos com janela). */}
            {liga.formato !== "copa" && infoEpoca(liga) && (
              <div style={{ background: "#0f1411", border: "1px solid #2a4d3e", borderRadius: 12, padding: "11px 13px", marginBottom: 12, display: "flex", gap: 9, alignItems: "flex-start" }}>
                <span aria-hidden="true" style={{ fontSize: 15, flexShrink: 0 }}>📅</span>
                <span style={{ fontSize: 12.5, color: "#aee9c9", lineHeight: 1.45 }}>{infoEpoca(liga)}</span>
              </div>
            )}

            {liga.descricao && (
              <div style={{ background: "#121815", border: "1px solid #243029", borderRadius: 12, padding: "11px 13px", marginBottom: 14, fontSize: 12.5, color: "#c7d0c9", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{liga.descricao}</div>
            )}

            <button onClick={() => entrarAgora(false)} disabled={aEntrar} style={{ width: "100%", background: GOLD, color: "#1b211e", border: "none", fontFamily: FD, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", padding: 15, borderRadius: 12, fontSize: 16, cursor: aEntrar ? "default" : "pointer", opacity: aEntrar ? 0.7 : 1 }}>
              {aEntrar ? "A entrar…" : meuId ? (liga.privacidade === "mediante_pedido" ? "Pedir para entrar" : "Entrar na liga") : "Entrar para participar"}
            </button>
            {liga.privacidade === "mediante_pedido" && (
              <div style={{ textAlign: "center", fontSize: 11, color: "#7c8a82", marginTop: 8 }}>Esta liga é por aprovação — o dono confirma a tua entrada.</div>
            )}
            <div style={{ textAlign: "center", marginTop: 12 }}>
              <a href="/ligas" style={{ color: "#93a39a", fontSize: 13, fontFamily: FD, fontWeight: 700, textDecoration: "none" }}>← Voltar às ligas</a>
            </div>
          </div>
        )}

        {!aRedirecionar && estado === "pedido_enviado" && (
          <div style={{ textAlign: "center", padding: "30px 16px", background: "#121815", border: `1px solid ${GOLD}`, borderRadius: 16 }}>
            <div style={{ fontSize: 34, marginBottom: 6 }}>✋</div>
            <div style={{ fontFamily: FD, fontSize: 16, fontWeight: 700, textTransform: "uppercase", marginBottom: 8, color: GOLD }}>Pedido enviado</div>
            <p style={{ fontSize: 13, color: "#c7d0c9", lineHeight: 1.55, marginBottom: 4 }}>
              {liga ? <>A liga <strong>{liga.name}</strong> é por aprovação.</> : "Esta liga é por aprovação."}
            </p>
            <p style={{ fontSize: 13, color: "#c7d0c9", lineHeight: 1.55, marginBottom: 16 }}>O dono vai rever o teu pedido. Voltamos a avisar-te assim que decidir.</p>
            <a href="/ligas" style={{ display: "inline-block", color: GOLD, fontSize: 13, textDecoration: "none", fontFamily: FD, fontWeight: 700, textTransform: "uppercase", border: `1px solid ${GOLD}`, padding: "10px 18px", borderRadius: 10 }}>Ver as minhas ligas</a>
          </div>
        )}

        {!aRedirecionar && estado === "erro" && (
          <div style={{ textAlign: "center", padding: "30px 16px", background: "#1a1110", border: "1px solid #3a2420", borderRadius: 16 }}>
            <div style={{ fontFamily: FD, fontSize: 15, fontWeight: 700, textTransform: "uppercase", color: erroMsg.includes("Pro") ? GOLD : "#ef8d83", marginBottom: 8 }}>{erroMsg.includes("Pro") ? "Limite atingido" : "Ups"}</div>
            <p style={{ fontSize: 13, color: "#c7d0c9", lineHeight: 1.5 }}>{erroMsg}</p>
            {erroMsg.includes("Pro") ? (
              <a href="/ippon-pro" style={{ display: "inline-block", marginTop: 12, background: GOLD, color: "#1b211e", fontSize: 13, fontWeight: 700, textDecoration: "none", fontFamily: FD, textTransform: "uppercase", padding: "10px 18px", borderRadius: 10 }}>Conhecer o Ippon Pro</a>
            ) : (
              <a href="/ligas" style={{ display: "inline-block", marginTop: 12, color: GOLD, fontSize: 13, textDecoration: "none", fontFamily: FD, fontWeight: 700 }}>Ver as minhas ligas</a>
            )}
          </div>
        )}

        {!aRedirecionar && estado === "pronto" && liga && (
          <>
            <div style={{ background: "#0f1411", border: "1px solid #243029", borderRadius: 16, padding: 14, display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <div style={{ flexShrink: 0 }}><Escudo config={liga.escudo || DEFAULT_IDENTITY} size={46} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{liga.name}</div>
                <div style={{ fontSize: 11, color: "#93a39a" }}>{nomePrivacidade(liga.privacidade)} · {membros.length} {membros.length === 1 ? "membro" : "membros"}</div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0, marginRight: 4 }}>
                <div style={{ fontSize: 9, color: "#93a39a", textTransform: "uppercase" }}>Código</div>
                <div style={{ fontFamily: FD, fontSize: 14, fontWeight: 700, color: GOLD, letterSpacing: "0.06em" }}>{liga.invite_code}</div>
              </div>
              <button onClick={partilhar} aria-label="Partilhar liga" style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, background: "transparent", border: "1px solid #243029", borderRadius: 10, padding: "7px 10px", cursor: "pointer", color: GOLD }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>
                <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase" }}>Convidar</span>
              </button>
            </div>

            {/* PÓDIO DA ÉPOCA — só liga de pontos corridos TERMINADA. Os 3 primeiros
                por pontos; cada um vê o botão para partilhar o SEU certificado. */}
            {ligaTerminada && podioFinal.length > 0 && (
              <PodioLiga
                podio={podioFinal}
                meuId={meuId}
                onPartilhar={(pos) => setCertificado(pos)}
              />
            )}

            {/* Painel do dono: pedidos de entrada pendentes (só liga "por aprovação"). */}
            {souDono && pedidos.length > 0 && (
              <div style={{ background: "#15110a", border: `1px solid ${GOLD}`, borderRadius: 14, padding: "12px 13px", marginBottom: 14 }}>
                <div style={{ fontFamily: FD, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: GOLD, marginBottom: 10, display: "flex", alignItems: "center", gap: 7 }}>
                  <span>✋ Pedidos para entrar</span>
                  <span style={{ background: GOLD, color: "#1b211e", borderRadius: 999, fontSize: 11, padding: "1px 8px" }}>{pedidos.length}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {pedidos.map((p) => (
                    <div key={p.request_id} style={{ display: "flex", alignItems: "center", gap: 10, background: "#0f1411", border: "1px solid #243029", borderRadius: 11, padding: "9px 11px" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: "#f1ede2", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.nome}{p.time ? ` (${p.time})` : ""}</div>
                        <div style={{ fontSize: 10.5, color: "#7c8a82" }}>quer juntar-se</div>
                      </div>
                      <button onClick={() => decidirPedido(p, "recusar")} disabled={aDecidir === p.request_id} style={{ flexShrink: 0, background: "transparent", border: "1px solid #5a2f2c", color: "#ef8d83", fontFamily: FD, fontWeight: 700, fontSize: 11, textTransform: "uppercase", padding: "7px 11px", borderRadius: 8, cursor: aDecidir === p.request_id ? "default" : "pointer", opacity: aDecidir === p.request_id ? 0.6 : 1 }}>Recusar</button>
                      <button onClick={() => decidirPedido(p, "aprovar")} disabled={aDecidir === p.request_id} style={{ flexShrink: 0, background: "#3f8f5a", border: "none", color: "#06140d", fontFamily: FD, fontWeight: 700, fontSize: 11, textTransform: "uppercase", padding: "7px 13px", borderRadius: 8, cursor: aDecidir === p.request_id ? "default" : "pointer", opacity: aDecidir === p.request_id ? 0.6 : 1 }}>{aDecidir === p.request_id ? "…" : "Aprovar"}</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {liga.formato === "copa" && (
              <CartaoCopa estado={copaEstado || liga.copa_estado || "inscricao"} fecho={liga.copa_fecho_inscricao || null} inscritos={membros} meuId={meuId} codigo={codigo} />
            )}

            {/* Informativo automático da época (só ligas de pontos corridos com janela). */}
            {liga.formato !== "copa" && infoEpoca(liga) && (
              <div style={{ background: "#0f1411", border: "1px solid #2a4d3e", borderRadius: 12, padding: "11px 13px", marginBottom: 14, display: "flex", gap: 9, alignItems: "flex-start" }}>
                <span aria-hidden="true" style={{ fontSize: 15, flexShrink: 0 }}>📅</span>
                <span style={{ fontSize: 12.5, color: "#aee9c9", lineHeight: 1.45 }}>{infoEpoca(liga)}</span>
              </div>
            )}

            {liga.descricao && (
              <div style={{ background: "#121815", border: "1px solid #243029", borderRadius: 12, padding: "11px 13px", marginBottom: 14, fontSize: 12.5, color: "#c7d0c9", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{liga.descricao}</div>
            )}

            {liga.formato !== "copa" && (
            <>
            {/* Seletor das três vistas: Geral (principal), Rodada, Judocoins. */}
            <div style={{ display: "flex", gap: 6, marginBottom: 14, borderBottom: "1px solid #1a221d" }}>
              {([["geral", "Geral"], ["rodada", "Rodada"], ["jc", "Judocoins"]] as [VistaLiga, string][]).map(([v, label]) => (
                <button key={v} onClick={() => setVista(v)} style={{ flex: 1, textAlign: "center", background: "transparent", border: "none", borderBottom: `2px solid ${vista === v ? GOLD : "transparent"}`, color: vista === v ? "#f1ede2" : "#7c8a82", fontFamily: FD, fontSize: 12, fontWeight: 700, textTransform: "uppercase", padding: "8px 0", cursor: "pointer" }}>{label}</button>
              ))}
            </div>

            {/* Dropdown de RODADA (só na vista Rodada): escolher uma rodada passada. */}
            {vista === "rodada" && listaRodadas.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 10.5, color: "#93a39a", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: FD, fontWeight: 700, marginBottom: 6 }}>Escolher rodada</label>
                <div style={{ position: "relative" }}>
                  <select
                    value={rodadaSel}
                    onChange={(e) => setRodadaSel(e.target.value)}
                    style={{ width: "100%", appearance: "none", WebkitAppearance: "none", MozAppearance: "none", background: "#141a17", border: `1px solid ${rodadaEhAtual ? "#243029" : GOLD}`, borderRadius: 10, padding: "11px 38px 11px 13px", color: "#f1ede2", fontSize: 13.5, fontFamily: FB, fontWeight: 700, outline: "none", cursor: "pointer" } as React.CSSProperties}
                  >
                    {listaRodadas.map((s) => (
                      <option key={s.idCompeticao} value={s.idCompeticao} style={{ background: "#141a17", color: "#f1ede2" }}>{rotuloRodadaItem(s)}</option>
                    ))}
                  </select>
                  <span style={{ position: "absolute", right: 13, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: GOLD }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
                  </span>
                </div>
                {!rodadaEhAtual && (
                  <div style={{ fontSize: 11, color: "#7fd1a3", marginTop: 7 }}>A ver uma rodada passada. Toca num membro para ver a equipa que ele escalou.</div>
                )}
              </div>
            )}

            {/* Cabeçalho da vista + estado ao vivo */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontFamily: FD, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#93a39a" }}>
                {vista === "geral" ? "Ranking geral · época" : vista === "rodada" ? `Rodada · ${compVista.nome}` : "Judocoins · património"}
              </span>
              {emAndamento && vista === "rodada" && rodadaEhAtual ? (
                <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#e2655a", fontWeight: 700 }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#e2655a", display: "inline-block" }} /> Ao vivo {horaTick && `· ${horaTick}`}
                </span>
              ) : emAndamento && vista === "geral" ? (
                <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#e2655a", fontWeight: 700 }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#e2655a", display: "inline-block" }} /> Ao vivo
                </span>
              ) : vista === "rodada" && rodadaEhAtual ? (
                <span style={{ fontSize: 11, color: "#7fd1a3" }}>Pré-competição</span>
              ) : null}
            </div>

            {/* VISTA RODADA: classificação da rodada escolhida (clicável para ver o dojo). */}
            {vista === "rodada" && (
              !rodadaVistaCarregada ? (
                <Aviso>A carregar a rodada…</Aviso>
              ) : membrosVista.length === 0 ? (
                <Aviso>{rodadaEhAtual ? "Ainda sem pontos nesta rodada." : "Ninguém escalou nesta rodada."}</Aviso>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {membrosVista.map((m) => {
                    const euMesmo = m.user_id === meuId;
                    const medal = m.posicao === 1 && m.escalou ? GOLD : "#243029";
                    return (
                      <button key={m.user_id} onClick={() => verDojo(m)} style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", background: euMesmo ? "#16201b" : "#121815", border: `1px solid ${euMesmo ? GOLD : medal}`, borderRadius: 12, padding: "11px 12px", cursor: "pointer", textAlign: "left", fontFamily: FB }}>
                        <div style={{ width: 24, textAlign: "center", flexShrink: 0, fontFamily: FD, fontSize: 16, fontWeight: 700, color: m.posicao === 1 && m.escalou ? GOLD : "#7c8a82" }}>{m.escalou ? m.posicao : "—"}</div>
                        <div style={{ flexShrink: 0 }}><Escudo config={m.escudo || DEFAULT_IDENTITY} size={34} /></div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: "#f1ede2", display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", overflow: "hidden" }}>
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{m.nome_time}</span>
                            {m.is_pro && <span style={{ background: "#3a2f12", color: GOLD, fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 999, flexShrink: 0 }}>PRO</span>}
                            {euMesmo && <span style={{ background: "#1c3a2e", color: "#aee9c9", fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 999, flexShrink: 0 }}>TU</span>}
                          </div>
                          <div style={{ fontSize: 11, color: m.escalou ? "#7fd1a3" : "#e0894f" }}>{m.escalou ? "Escalou" : "Não escalou"}</div>
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <div style={{ fontFamily: FD, fontSize: 16, fontWeight: 700, color: "#f1ede2" }}>{m.escalou ? (m.pontos >= 0 ? "+" : "") + m.pontos : "—"}</div>
                          <div style={{ fontSize: 9, color: "#93a39a", textTransform: "uppercase" }}>pts</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )
            )}

            {/* VISTA GERAL: acumulado ao vivo (histórico + rodada atual). */}
            {vista === "geral" && (
              !geralCarregado ? (
                <Aviso>A somar a época…</Aviso>
              ) : geral.length === 0 ? (
                <Aviso>Ainda sem pontos acumulados.</Aviso>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {geral.map((m) => {
                    const euMesmo = m.user_id === meuId;
                    const ouro = m.posicao === 1 && m.pontos_geral > 0;
                    return (
                      <button key={m.user_id} onClick={() => verDojo({ ...m, pontos: m.pontos_rodada } as Membro)} style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", background: euMesmo ? "#16201b" : "#121815", border: `1px solid ${euMesmo ? GOLD : (ouro ? GOLD : "#243029")}`, borderRadius: 12, padding: "11px 12px", cursor: "pointer", textAlign: "left", fontFamily: FB }}>
                        <div style={{ width: 24, textAlign: "center", flexShrink: 0, fontFamily: FD, fontSize: 16, fontWeight: 700, color: ouro ? GOLD : "#7c8a82" }}>{m.posicao}</div>
                        <div style={{ flexShrink: 0 }}><Escudo config={m.escudo || DEFAULT_IDENTITY} size={34} /></div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: "#f1ede2", display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", overflow: "hidden" }}>
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{m.nome_time}</span>
                            {m.is_pro && <span style={{ background: "#3a2f12", color: GOLD, fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 999, flexShrink: 0 }}>PRO</span>}
                            {euMesmo && <span style={{ background: "#1c3a2e", color: "#aee9c9", fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 999, flexShrink: 0 }}>TU</span>}
                          </div>
                          <div style={{ fontSize: 11, color: "#93a39a" }}>{m.escalou ? <span style={{ color: "#7fd1a3" }}>+{m.pontos_rodada} nesta rodada</span> : "Sem escalação nesta rodada"}</div>
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <div style={{ fontFamily: FD, fontSize: 16, fontWeight: 700, color: GOLD }}>{m.pontos_geral}</div>
                          <div style={{ fontSize: 9, color: "#93a39a", textTransform: "uppercase" }}>total</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )
            )}

            {/* VISTA JUDOCOINS: mesma lista, ordenada por património (JC). */}
            {vista === "jc" && (
              !geralCarregado ? (
                <Aviso>A carregar os Judocoins…</Aviso>
              ) : geral.length === 0 ? (
                <Aviso>Ainda sem dados de Judocoins.</Aviso>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {[...geral].sort((a, b) => b.patrimonio - a.patrimonio).map((m, i) => {
                    const euMesmo = m.user_id === meuId;
                    const ouro = i === 0;
                    return (
                      <div key={m.user_id} style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", background: euMesmo ? "#16201b" : "#121815", border: `1px solid ${euMesmo ? GOLD : (ouro ? GOLD : "#243029")}`, borderRadius: 12, padding: "11px 12px" }}>
                        <div style={{ width: 24, textAlign: "center", flexShrink: 0, fontFamily: FD, fontSize: 16, fontWeight: 700, color: ouro ? GOLD : "#7c8a82" }}>{i + 1}</div>
                        <div style={{ flexShrink: 0 }}><Escudo config={m.escudo || DEFAULT_IDENTITY} size={34} /></div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: "#f1ede2", display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", overflow: "hidden" }}>
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{m.nome_time}</span>
                            {m.is_pro && <span style={{ background: "#3a2f12", color: GOLD, fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 999, flexShrink: 0 }}>PRO</span>}
                            {euMesmo && <span style={{ background: "#1c3a2e", color: "#aee9c9", fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 999, flexShrink: 0 }}>TU</span>}
                          </div>
                          <div style={{ fontSize: 11, color: "#93a39a" }}>Património total</div>
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <div style={{ fontFamily: FD, fontSize: 16, fontWeight: 700, color: GOLD }}>JC {m.patrimonio}</div>
                          <div style={{ fontSize: 9, color: "#93a39a", textTransform: "uppercase" }}>saldo</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            )}

            <div style={{ marginTop: 12, fontSize: 11, color: "#5f6f67", textAlign: "center" }}>
              {vista === "jc"
                ? "Quem mais valorizou a equipa ao longo da época lidera os Judocoins."
                : vista === "rodada" && !rodadaEhAtual ? "Estás a ver uma rodada passada. Toca num membro para ver a equipa dele."
                : mercadoFechado ? "Toca num membro para ver o dojo dele." : "Os dojos dos rivais abrem quando o mercado fechar. 🔒"}
            </div>
            </>
            )}
          </>
        )}
      </div>

      {/* Confirmação "a liga já começou" (pontos corridos): só aparece quando o
          servidor devolve jaComecou. Confirmar entra mesmo (começa com 0 pontos). */}
      {confirmarComeco && (
        <div onClick={() => setConfirmarComeco(null)} style={{ position: "fixed", inset: 0, zIndex: 105, background: "rgba(6,8,7,0.82)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 330, background: "#121815", border: `1px solid ${GOLD}`, borderRadius: 16, padding: 22, textAlign: "center" }}>
            <div style={{ fontSize: 30, marginBottom: 6 }}>⏱️</div>
            <h2 style={{ fontFamily: FD, fontSize: 17, fontWeight: 700, textTransform: "uppercase", margin: "0 0 8px" }}>Esta liga já começou</h2>
            <p style={{ fontSize: 13.5, color: "#c7d0c9", lineHeight: 1.5, margin: "0 0 6px" }}>
              A liga arrancou na rodada <strong style={{ color: "#f1ede2" }}>{confirmarComeco.rodadaInicio}</strong> e vais entrar na rodada <strong style={{ color: GOLD }}>{confirmarComeco.rodadaEntrada}</strong>.
            </p>
            <p style={{ fontSize: 12.5, color: "#93a39a", lineHeight: 1.5, margin: "0 0 18px" }}>Começas com <strong>0 pontos</strong> e não recuperas as rodadas já jogadas. Queres entrar à mesma?</p>
            <button onClick={() => entrarAgora(true)} disabled={aEntrar} style={{ width: "100%", padding: 13, borderRadius: 12, border: "none", background: GOLD, color: "#1b211e", fontFamily: FD, fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", cursor: aEntrar ? "default" : "pointer", opacity: aEntrar ? 0.7 : 1 }}>{aEntrar ? "A entrar…" : "Entrar mesmo assim"}</button>
            <button onClick={() => setConfirmarComeco(null)} style={{ marginTop: 10, background: "transparent", border: "none", color: "#93a39a", fontSize: 13, cursor: "pointer", fontFamily: FB }}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Overlay "a liga terminou" — salta uma vez. Mostra o pódio e, se estou
          no top 3, deixa abrir o meu certificado. Por baixo, na página, fica o
          cartão "Classificação final" para rever quando quiser. */}
      {mostrarFimLiga && podioFinal.length > 0 && (() => {
        const minhaIdx = podioFinal.findIndex((m) => m.user_id === meuId);
        const POS: PosicaoPodio[] = ["campeao", "vice", "terceiro"];
        const MEDALHAS = ["🥇", "🥈", "🥉"];
        const CORES = [GOLD, "#c0c0c0", "#c87f43"];
        const LABELS = ["Campeão da época", "Vice-campeão", "3º lugar"];
        const minhaPos: PosicaoPodio | null = minhaIdx >= 0 ? POS[minhaIdx] : null;
        const frase = minhaIdx === 0 ? "Foste campeão! 🥇"
          : minhaIdx === 1 ? "Ficaste em 2º — que época! 🥈"
          : minhaIdx === 2 ? "Subiste ao pódio, 3º lugar! 🥉"
          : "A época chegou ao fim. Obrigado por jogares!";
        return (
          <div onClick={() => setMostrarFimLiga(false)} style={{ position: "fixed", inset: 0, zIndex: 110, background: "rgba(6,8,7,0.86)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }}>
            <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 360, background: "linear-gradient(170deg,#1b1810,#0f1411)", border: `1px solid ${GOLD}`, borderRadius: 18, padding: "22px 18px", maxHeight: "88vh", overflowY: "auto" }}>
              <div style={{ textAlign: "center", fontSize: 38, marginBottom: 4 }}>🏆</div>
              <div style={{ textAlign: "center", fontFamily: FD, fontSize: 20, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: GOLD, marginBottom: 4 }}>A liga terminou!</div>
              <div style={{ textAlign: "center", fontSize: 14, fontWeight: 700, color: "#f1ede2", marginBottom: 4 }}>{liga?.name}</div>
              <div style={{ textAlign: "center", fontSize: 13, color: "#c7d0c9", lineHeight: 1.5, marginBottom: 16 }}>{frase}</div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                {podioFinal.map((m, i) => {
                  const souEu = m.user_id === meuId;
                  return (
                    <div key={m.user_id} style={{ display: "flex", alignItems: "center", gap: 11, background: souEu ? "#16201b" : "#121815", border: `1px solid ${souEu ? GOLD : CORES[i]}`, borderRadius: 12, padding: "10px 12px" }}>
                      <span style={{ fontSize: 22, flexShrink: 0 }}>{MEDALHAS[i]}</span>
                      <div style={{ flexShrink: 0 }}><Escudo config={m.escudo || DEFAULT_IDENTITY} size={32} /></div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: "#f1ede2", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.nome_time}{souEu ? " (tu)" : ""}</div>
                        <div style={{ fontSize: 10.5, color: CORES[i], fontFamily: FD, fontWeight: 700, textTransform: "uppercase" }}>{LABELS[i]}</div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontFamily: FD, fontSize: 16, fontWeight: 700, color: CORES[i] }}>{m.pontos_geral}</div>
                        <div style={{ fontSize: 9, color: "#93a39a", textTransform: "uppercase" }}>pts</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {minhaPos && (
                <button onClick={() => { setMostrarFimLiga(false); setCertificado(minhaPos); }} style={{ width: "100%", padding: 13, borderRadius: 12, border: "none", background: GOLD, color: "#1b211e", fontFamily: FD, fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", cursor: "pointer", marginBottom: 8 }}>Ver o meu certificado</button>
              )}
              <button onClick={() => setMostrarFimLiga(false)} style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #2a3a33", background: "transparent", color: "#cfd8d2", fontFamily: FD, fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", cursor: "pointer" }}>Fechar</button>
            </div>
          </div>
        );
      })()}

      {/* Modal do certificado (liga terminada). A identidade e a contagem saem do
          pódio final acima. */}
      {certificado && (() => {
        const idx = certificado === "campeao" ? 0 : certificado === "vice" ? 1 : 2;
        const m = podioFinal[idx];
        if (!m) return null;
        const ident: Identity = { ...(m.escudo || DEFAULT_IDENTITY), name: m.nome_time };
        return (
          <CartaoCertificado
            posicao={certificado}
            identity={ident}
            nomeCopa={liga?.name || "Liga"}
            nParticipantes={nParticipantesEpoca}
            onClose={() => setCertificado(null)}
          />
        );
      })()}
    </main>
  );
}

function Aviso({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ textAlign: "center", padding: "40px 16px", color: "#7c8a82" }}>
      <div style={{ fontFamily: FD, fontSize: 13, letterSpacing: "0.1em", textTransform: "uppercase" }}>{children}</div>
    </div>
  );
}

// PÓDIO DA ÉPOCA (liga de pontos corridos terminada). Os 3 primeiros por pontos.
// Cada um que seja "eu" vê o botão para partilhar o seu certificado.
function PodioLiga({ podio, meuId, onPartilhar }: {
  podio: MembroGeral[];
  meuId: string | null;
  onPartilhar: (pos: PosicaoPodio) => void;
}) {
  const META: { medalha: string; label: string; cor: string; pos: PosicaoPodio }[] = [
    { medalha: "🥇", label: "Campeão da época", cor: GOLD, pos: "campeao" },
    { medalha: "🥈", label: "Vice-campeão", cor: "#c0c0c0", pos: "vice" },
    { medalha: "🥉", label: "3º lugar", cor: "#c87f43", pos: "terceiro" },
  ];
  return (
    <div style={{ background: "linear-gradient(160deg,#2a2410,#15110a)", border: `1px solid ${GOLD}`, borderRadius: 16, padding: "16px 15px", marginBottom: 16 }}>
      <div style={{ textAlign: "center", fontFamily: FD, fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: GOLD, marginBottom: 4 }}>🏆 Classificação final</div>
      <div style={{ textAlign: "center", fontSize: 11, color: "#cdb86a", marginBottom: 12 }}>A liga terminou. Eis o pódio da época.</div>
      {podio.map((m, i) => {
        const meta = META[i];
        if (!meta) return null;
        const souEu = !!meuId && m.user_id === meuId;
        return (
          <div key={m.user_id} style={{ background: "#121815", border: `1px solid ${meta.cor}`, borderRadius: 12, padding: "10px 12px", marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
              <span style={{ fontSize: 22, flexShrink: 0 }}>{meta.medalha}</span>
              <div style={{ flexShrink: 0 }}><Escudo config={m.escudo || DEFAULT_IDENTITY} size={32} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#f1ede2", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.nome_time}</div>
                <div style={{ fontSize: 10.5, color: meta.cor, fontFamily: FD, fontWeight: 700, textTransform: "uppercase" }}>{meta.label}</div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontFamily: FD, fontSize: 16, fontWeight: 700, color: meta.cor }}>{m.pontos_geral}</div>
                <div style={{ fontSize: 9, color: "#93a39a", textTransform: "uppercase" }}>pts</div>
              </div>
            </div>
            {souEu && (
              <button onClick={() => onPartilhar(meta.pos)} style={{ width: "100%", marginTop: 9, padding: "9px 12px", borderRadius: 9, border: "none", background: meta.cor, color: meta.pos === "vice" ? "#14181a" : "#1b1208", fontFamily: FD, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>
                Partilhar o meu título
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Cartão de estado da Copa Ippon (mata-mata). Em INSCRIÇÃO mostra a "sala de
// espera" (equipas inscritas + data de fecho). Os outros estados (sorteada/
// a decorrer/terminada) já não passam por aqui — a página redireciona à chave.
function CartaoCopa({ estado, fecho, inscritos, meuId, codigo }: { estado: string; fecho: string | null; inscritos: Membro[]; meuId: string | null; codigo: string }) {
  const fechoData = fecho ? new Date(fecho) : null;
  const prazoPassou = fechoData ? Date.now() >= fechoData.getTime() : false;
  const quandoFecha = fechoData
    ? fechoData.toLocaleString("pt-PT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
    : "";
  const n = inscritos.length;

  let icone = "🏆", titulo = "Copa Ippon", texto = "", rodape = "";

  if (estado === "inscricao" && !prazoPassou) {
    icone = "📝";
    titulo = "Inscrições abertas";
    texto = "Esta é uma Copa Ippon (mata-mata). Quem entrar antes do fecho entra na chave. O sorteio é automático e aleatório.";
    rodape = quandoFecha ? `Fecham a ${quandoFecha}` : "";
  } else if (estado === "inscricao") {
    icone = "⏳";
    titulo = "Inscrições fechadas";
    texto = "As inscrições fecharam. A chave vai ser sorteada — abre daqui a pouco para veres o teu primeiro confronto.";
  } else {
    // sorteada / a_decorrer / terminada: a página redireciona à chave; este
    // cartão raramente é visto, mas mantemos um fallback com botão para a chave.
    icone = "⚔️";
    titulo = "Copa em jogo";
    texto = "A chave está formada. A abrir os confrontos…";
  }

  return (
    <div style={{ background: "linear-gradient(160deg,#2a2410,#15110a)", border: `1px solid ${GOLD}`, borderRadius: 14, padding: "14px 15px", marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 5 }}>
        <span style={{ fontSize: 18 }}>{icone}</span>
        <span style={{ fontFamily: FD, fontSize: 13.5, fontWeight: 700, textTransform: "uppercase", color: GOLD }}>{titulo}</span>
      </div>
      <p style={{ fontSize: 12.5, color: "#dfe6e0", lineHeight: 1.55, margin: 0 }}>{texto}</p>

      {/* Sala de espera: lista das equipas inscritas (escudo + nome). */}
      {estado === "inscricao" && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(217,164,65,0.25)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 9 }}>
            <span style={{ fontFamily: FD, fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#cdb86a" }}>
              {n} {n === 1 ? "equipa inscrita" : "equipas inscritas"}
            </span>
            {rodape && <span style={{ fontSize: 11, color: "#a9b4ac", fontFamily: FD }}>{rodape}</span>}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {inscritos.map((m) => {
              const euMesmo = m.user_id === meuId;
              return (
                <div key={m.user_id} style={{ display: "flex", alignItems: "center", gap: 10, background: euMesmo ? "#1b2018" : "rgba(12,14,13,0.5)", border: `1px solid ${euMesmo ? GOLD : "#2f2a18"}`, borderRadius: 10, padding: "8px 10px" }}>
                  <div style={{ flexShrink: 0 }}><Escudo config={m.escudo || DEFAULT_IDENTITY} size={28} /></div>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, color: "#f1ede2", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.nome_time}</span>
                  {m.is_pro && <span style={{ background: "#3a2f12", color: GOLD, fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 999, flexShrink: 0 }}>PRO</span>}
                  {euMesmo && <span style={{ background: "#1c3a2e", color: "#aee9c9", fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 999, flexShrink: 0 }}>TU</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Fallback: se por algum motivo a copa já tem chave e não redirecionou,
          oferece o botão para a chave. */}
      {estado !== "inscricao" && (
        <a href={`/liga/${codigo}/chave`} style={{ display: "block", textAlign: "center", marginTop: 12, background: GOLD, color: "#1b211e", fontFamily: FD, fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", padding: "12px", borderRadius: 11, textDecoration: "none" }}>
          {estado === "terminada" ? "Ver pódio e chave" : "Ver a chave"}
        </a>
      )}
    </div>
  );
}
