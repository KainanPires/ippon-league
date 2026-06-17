"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Escudo, DEFAULT_IDENTITY, type Identity } from "@/components/Escudo";
import { focoMercado } from "@/lib/calendario";
import { competicaoPorId } from "@/lib/copa";

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

export default function PaginaLiga() {
  const params = useParams();
  const router = useRouter();
  const codigo = String(params?.codigo || "").toUpperCase();

  const [estado, setEstado] = useState<"a_entrar" | "pronto" | "erro" | "sem_sessao" | "pedido_enviado">("a_entrar");
  const [erroMsg, setErroMsg] = useState("");
  const [liga, setLiga] = useState<LigaInfo | null>(null);
  const [membros, setMembros] = useState<Membro[]>([]);
  const [meuId, setMeuId] = useState<string | null>(null);
  const [horaTick, setHoraTick] = useState<string>("");
  const [aRedirecionar, setARedirecionar] = useState(false);

  // Ligas de amigos (pontos corridos): vista atual + ranking geral/JC ao vivo.
  const [vista, setVista] = useState<VistaLiga>("geral");
  const [geral, setGeral] = useState<MembroGeral[]>([]);
  const [geralCarregado, setGeralCarregado] = useState(false);

  // Painel do dono: pedidos pendentes.
  const [souDono, setSouDono] = useState(false);
  const [copaEstado, setCopaEstado] = useState<string | null>(null); // estado da copa, atualizável
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [aDecidir, setADecidir] = useState<string | null>(null);

  // Foco do mercado: a competição que decorre (mercado fechado) ou a de mercado aberto.
  const foco = focoMercado();
  const compAtual = foco.aDecorrer ?? foco.atual;
  const idComp = compAtual.idCompeticao;
  const emAndamento = foco.aDecorrer !== null;
  const mercadoFechado = emAndamento; // só se pode ver o dojo dos outros com mercado fechado

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 1) Ao abrir: resolve o convite (entra na liga) e guarda o id da liga.
  useEffect(() => {
    let vivo = true;
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user?.id ?? null;
      if (!vivo) return;
      setMeuId(uid);

      if (!uid) {
        // Sem sessão: não entra automaticamente. Mostra convite para entrar.
        setEstado("sem_sessao");
        return;
      }

      try {
        // Entrar (ou confirmar que já é membro). Resolve código -> liga.
        const res = await fetch("/api/liga/entrar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: uid, codigo }),
        });
        const j = await res.json();
        if (!vivo) return;
        if (!j.ok) {
          setErroMsg(j.erro || "Não foi possível abrir a liga.");
          setEstado("erro");
          return;
        }
        // Liga "por aprovação": a entrada gerou um pedido pendente, não membro.
        if (j.pedido) {
          if (j.liga) setLiga(j.liga);
          setEstado("pedido_enviado");
          return;
        }
        // Se é uma COPA que já tem chave, vai DIRETO à chave (sem página
        // intermédia). A entrada na liga já foi resolvida acima, por isso quem
        // veio de um convite entra à mesma antes de ser reencaminhado.
        if (j.liga && j.liga.formato === "copa" && copaTemChave(j.liga.copa_estado)) {
          setARedirecionar(true);
          router.replace(`/liga/${codigo}/chave`);
          return;
        }
        setLiga(j.liga);
        setEstado("pronto");
      } catch {
        if (!vivo) return;
        setErroMsg("Falha de ligação.");
        setEstado("erro");
      }
    })();
    return () => { vivo = false; };
  }, [codigo, router]);

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

  // 3) Quando a liga está pronta: descobre se sou o dono e carrega os pedidos.
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
    if (!mercadoFechado) {
      alert("Podes ver a equipa dos teus rivais quando o mercado fechar. 🔒");
      return;
    }
    // Abre o dojo do adversário em modo leitura (a app já tem /meu-time; passamos o user).
    window.location.href = `/meu-time?ver=${m.user_id}&comp=${idComp}`;
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

            {/* Cabeçalho da vista + estado ao vivo */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontFamily: FD, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#93a39a" }}>
                {vista === "geral" ? "Ranking geral · época" : vista === "rodada" ? `Rodada · ${compAtual.nome}` : "Judocoins · património"}
              </span>
              {emAndamento && vista !== "jc" ? (
                <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#e2655a", fontWeight: 700 }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#e2655a", display: "inline-block" }} /> Ao vivo {horaTick && vista === "rodada" && `· ${horaTick}`}
                </span>
              ) : vista === "rodada" ? (
                <span style={{ fontSize: 11, color: "#7fd1a3" }}>Pré-competição</span>
              ) : null}
            </div>

            {/* VISTA RODADA: a tabela original (clicável para ver o dojo). */}
            {vista === "rodada" && (
              membros.length === 0 ? (
                <Aviso>Ainda sem pontos nesta rodada.</Aviso>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {membros.map((m) => {
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
                : mercadoFechado ? "Toca num membro para ver o dojo dele." : "Os dojos dos rivais abrem quando o mercado fechar. 🔒"}
            </div>
            </>
            )}
          </>
        )}
      </div>
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
