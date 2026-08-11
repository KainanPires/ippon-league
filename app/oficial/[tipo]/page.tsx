"use client";
import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Escudo, DEFAULT_IDENTITY, type Identity } from "@/components/Escudo";
import { focoMercado, competicoesReais } from "@/lib/calendario";
import { useNivel } from "@/lib/useNivel";
import { useT } from "@/lib/i18n";
const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";
// Atualização ao vivo do ranking enquanto a competição decorre.
const TICK_AO_VIVO_MS = 15000;
// Descobre a ÚLTIMA competição real de um ano (a que fecha a época anual da liga
  // oficial). competicoesReais() vem ordenada por data; filtramos as do ano e
// ficamos com a última. Devolve null se não houver competições nesse ano.
function ultimaCompeticaoDoAno(ano: number): { idCompeticao: string; nome: string } | null {
  const doAno = competicoesReais().filter((s) => parseInt(String(s.de).slice(0, 4), 10) === ano);
  if (doAno.length === 0) return null;
  const ultima = doAno[doAno.length - 1];
  return { idCompeticao: ultima.idCompeticao, nome: ultima.nome };
}
type Vista = "rodada" | "geral";
interface MembroRank {
  user_id: string;
  nome_time: string;
  escudo: Identity | null;
  escalou: boolean;
  pontos: number;
  posicao: number;
  is_pro: boolean;
}
// Linha do ranking GERAL (vem de /api/liga/geral).
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
export default function PaginaOficial() {
  const t = useT();
  const params = useParams();
  const tipo = String(params?.tipo || "").toLowerCase(); // "mundial" | "continental"
  const ehMundial = tipo === "mundial";
  const [vista, setVista] = useState<Vista>("geral"); // o GERAL é a vista principal
  const [estado, setEstado] = useState<"a_carregar" | "pronto" | "sem_sessao" | "sem_continente">("a_carregar");
  const [membros, setMembros] = useState<MembroRank[]>([]);
  const [geral, setGeral] = useState<MembroGeral[]>([]);
  const [geralCarregado, setGeralCarregado] = useState(false);
  const [nomeContinente, setNomeContinente] = useState<string | null>(null);
  const [meuId, setMeuId] = useState<string | null>(null);
  // O NÍVEL VEM DO useNivel (tabela `users`), NÃO DO user_metadata.
  //
  // O `souPro` decide entre mostrar o cartão com a MINHA posição no ranking
  // oficial ou o aviso "Estás a ver o ranking dos Pro · passa a Pro para
  // entrares". Como se lia do metadata — que deixou de ser sincronizado — um
  // subscritor que pagou via o aviso a mandá-lo comprar o que já tinha, e não
  // via a sua própria posição na liga em que está inscrito.
  //
  // Pro Max entra no mesmo saco: quem tem Max tem Pro.
  const { ehPro, ehProMax } = useNivel();
  const souPro = ehPro || ehProMax;
  const [pesquisa, setPesquisa] = useState("");
  // A competição da rodada atual (mesma fonte do resto da app).
  const foco = focoMercado();
  const compAtual = foco.aDecorrer ?? foco.atual;
  const idComp = compAtual.idCompeticao;
  const emAndamento = foco.aDecorrer !== null;
  // Época anual: qual a última competição do ano corrente, e a atual já é essa?
  const anoCorrente = new Date().getFullYear();
  const ultimaDoAno = ultimaCompeticaoDoAno(anoCorrente);
  const atualEhUltimaDoAno = !!ultimaDoAno && ultimaDoAno.idCompeticao === idComp;
  const titulo = ehMundial ? "Liga Mundial" : (nomeContinente ? `Liga ${nomeContinente}` : "Liga Continental");
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Filtragem da lista pela pesquisa: aceita nome do time OU número de posição.
  const termo = pesquisa.trim().toLowerCase();
  const ehNumero = termo !== "" && /^\d+$/.test(termo);
  function filtrar<T extends { nome_time: string; posicao: number; escalou?: boolean }>(lista: T[]): T[] {
    if (termo === "") return lista;
    return lista.filter((m) => {
        if (ehNumero) return m.posicao === Number(termo);
        return (m.nome_time || "").toLowerCase().includes(termo);
    });
  }
  const membrosVisiveis = filtrar(membros);
  const geralVisivel = filtrar(geral);
  // A MINHA posição em cada vista (para o destaque fixo no topo). Procuro-me na
  // lista completa (não na filtrada), para o destaque não desaparecer ao pesquisar.
  const euGeral = meuId ? geral.find((m) => m.user_id === meuId) : undefined;
  const euRodada = meuId ? membros.find((m) => m.user_id === meuId) : undefined;
  const minhaPosGeral = euGeral && euGeral.pontos_geral > 0 ? euGeral.posicao : null;
  const minhaPosRodada = euRodada && euRodada.escalou ? euRodada.posicao : null;
  const totalGeral = geral.length;
  const totalRodada = membros.filter((m) => m.escalou).length;
  // 1) Ranking da RODADA (ao vivo do IJF, via /api/liga/oficial).
useEffect(() => {
    let vivo = true;
    (async () => {
        const { data: sess } = await supabase.auth.getSession();
        const uid = sess.session?.user?.id ?? null;
        if (!vivo) return;
        setMeuId(uid);
        if (!uid && !ehMundial) {
          setEstado("sem_sessao");
          return;
        }
        try {
          const p = new URLSearchParams({ tipo: ehMundial ? "mundial" : "continental", comp: idComp });
          if (uid) p.set("user_id", uid);
          const res = await fetch(`/api/liga/oficial?${p.toString()}`);
          const j = await res.json();
          if (!vivo) return;
          if (j.semContinente) { setEstado("sem_continente"); return; }
          if (j.ok) {
            setMembros(Array.isArray(j.membros) ? j.membros : []);
            setNomeContinente(j.nomeContinente ?? null);
            setEstado("pronto");
          } else {
            setMembros([]);
            setEstado("pronto");
          }
        } catch {
          if (vivo) { setMembros([]); setEstado("pronto"); }
        }
    })();
    return () => { vivo = false; };
  }, [tipo, ehMundial, idComp]);
// 2) Ranking GERAL (acumulado ao vivo, via /api/liga/geral). Atualiza sozinho
// enquanto a competição decorre.
useEffect(() => {
    if (estado !== "pronto") return;
    let vivo = true;
    async function buscarGeral() {
      try {
        const p = new URLSearchParams({ tipo: ehMundial ? "mundial" : "continental", comp: idComp });
        if (meuId) p.set("user_id", meuId);
        const res = await fetch(`/api/liga/geral?${p.toString()}`);
        const j = await res.json();
        if (!vivo) return;
        if (j.ok && Array.isArray(j.membros)) setGeral(j.membros);
        setGeralCarregado(true);
      } catch {
        if (vivo) setGeralCarregado(true);
      }
    }
    buscarGeral();
    if (tickRef.current) clearInterval(tickRef.current);
    if (emAndamento) {
      tickRef.current = setInterval(() => { if (!document.hidden) buscarGeral(); }, TICK_AO_VIVO_MS);
    }
    const onVis = () => { if (!document.hidden) buscarGeral(); };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      vivo = false;
      if (tickRef.current) clearInterval(tickRef.current);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [estado, ehMundial, idComp, meuId, emAndamento]);
// Dados do destaque conforme a vista ativa.
const minhaPos = vista === "geral" ? minhaPosGeral : minhaPosRodada;
const totalVista = vista === "geral" ? totalGeral : totalRodada;
return (
  <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: FB }}>
  <div style={{ maxWidth: 460, margin: "0 auto", padding: "14px 14px 40px" }}>
  <header style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 16 }}>
  <a href="/ligas" aria-label="Voltar" style={{ width: 34, height: 34, borderRadius: "50%", border: "1px solid #243029", display: "flex", alignItems: "center", justifyContent: "center", color: "#cfd8d2", textDecoration: "none", flexShrink: 0 }}>
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
  </a>
  <h1 style={{ fontFamily: FD, fontSize: 19, fontWeight: 700, textTransform: "uppercase", margin: 0 }}>{titulo}</h1>
  </header>
  {/* Cartão de cabeçalho */}
  <div style={{ background: ehMundial ? "linear-gradient(160deg,#1c3a2e,#102a20)" : "linear-gradient(160deg,#2f6fb3,#1e4a78)", border: `1px solid ${GOLD}`, borderRadius: 16, padding: "16px 16px", marginBottom: 14 }}>
  <div style={{ fontFamily: FD, fontSize: 16, fontWeight: 700, textTransform: "uppercase", color: "#fff", marginBottom: 4 }}>
  {ehMundial ? "🌍 " : "🗺️ "}{titulo}
  </div>
  <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.85)", lineHeight: 1.5 }}>
  {ehMundial
    ? t("of.melhoresMundo")
    : `Os melhores de ${nomeContinente || t("of.teuContinente")}. Concorre aos prémios continentais.`}
  </div>
  <div style={{ marginTop: 8, fontSize: 11, color: "rgba(255,255,255,0.7)" }}>
  Só membros Pro entram no ranking · {compAtual.nome}
  </div>
  </div>
  {/* Informativo de ÉPOCA ANUAL (Mundial e Continental). A época vai de
    janeiro à última competição do ano; depois recomeça do zero. Quando a
    competição atual já é a última do ano, muda para o texto de fecho. */}
  {estado === "pronto" && (
      <div style={{ background: "#0f1411", border: `1px solid ${atualEhUltimaDoAno ? GOLD : "#2a4d3e"}`, borderRadius: 12, padding: "11px 13px", marginBottom: 14, display: "flex", gap: 9, alignItems: "flex-start" }}>
      <span aria-hidden="true" style={{ fontSize: 15, flexShrink: 0 }}>{atualEhUltimaDoAno ? "🏁" : "📅"}</span>
      <span style={{ fontSize: 12.5, color: atualEhUltimaDoAno ? "#f0d79a" : "#aee9c9", lineHeight: 1.45 }}>
      {atualEhUltimaDoAno
        ? t("of.ultimaDoAno", { ano: anoCorrente, proximo: anoCorrente + 1 })
        : t("of.ligaAnual", { ano: anoCorrente })}
      </span>
      </div>
  )}
  {/* Banner Pro para quem não é Pro */}
  {!souPro && estado === "pronto" && (
      <a href="/ippon-pro" style={{ display: "block", textAlign: "center", marginBottom: 14, background: "#2a2410", border: "1px solid #5a4a18", color: GOLD, fontFamily: FD, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", padding: "11px 14px", borderRadius: 10, textDecoration: "none", fontSize: 12.5, lineHeight: 1.4 }}>
      🔒 Estás a ver o ranking dos Pro · passa a Pro para entrares
      </a>
  )}
  {/* Seletor Geral / Rodada (Geral é a vista principal) */}
  <div style={{ display: "flex", gap: 8, marginBottom: 16, borderBottom: "1px solid #1a221d" }}>
  {(["geral", "rodada"] as Vista[]).map((v) => (
        <button key={v} onClick={() => setVista(v)} style={{ flex: 1, textAlign: "center", background: "transparent", border: "none", borderBottom: `2px solid ${vista === v ? GOLD : "transparent"}`, color: vista === v ? "#f1ede2" : "#7c8a82", fontFamily: FD, fontSize: 13, fontWeight: 700, textTransform: "uppercase", padding: "9px 0", cursor: "pointer" }}>
        {v === "geral" ? "Ranking Geral" : t("of.lideresRodada")}
        </button>
  ))}
  </div>
  {/* Destaque FIXO da minha posição (na vista ativa). Sempre visível, para
    saber onde estou sem ter de procurar na lista. Só Pro e se estou no
    ranking; senão, um convite suave a escalar / ser Pro. */}
  {estado === "pronto" && souPro && (
      <div style={{ display: "flex", alignItems: "center", gap: 12, background: "#16201b", border: `1px solid ${GOLD}`, borderRadius: 12, padding: "11px 14px", marginBottom: 13 }}>
      <div style={{ flexShrink: 0, width: 40, textAlign: "center" }}>
      {minhaPos !== null ? (
          <div style={{ fontFamily: FD, fontSize: 22, fontWeight: 700, color: GOLD, lineHeight: 1 }}>{`${minhaPos}º`}</div>
        ) : (
          <div style={{ fontFamily: FD, fontSize: 20, color: "#7c8a82", lineHeight: 1 }}>—</div>
      )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontFamily: FD, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#aee9c9" }}>{t("of.tuaPosicao")}</div>
      <div style={{ fontSize: 12, color: "#c7d0c9", marginTop: 2 }}>
      {minhaPos !== null
        ? <>{vista === "geral" ? t("of.rankingAno") : "Nesta rodada"} · entre {totalVista} {totalVista === 1 ? "jogador" : "jogadores"}</>
        : (vista === "geral" ? t("of.semPontosAno") : t("of.naoEscalasteRodada"))}
      </div>
      </div>
      </div>
  )}
  {estado === "a_carregar" && <Aviso>{t("of.aCarregarRanking")}</Aviso>}
  {estado === "sem_sessao" && (
      <div style={{ textAlign: "center", padding: "30px 16px", background: "#121815", border: "1px solid #243029", borderRadius: 16 }}>
      <p style={{ fontSize: 13, color: "#c7d0c9", lineHeight: 1.5, marginBottom: 16 }}>{t("of.entraParaVer")}</p>
      <a href="/entrar?voltar=/ligas" style={{ display: "inline-block", background: GOLD, color: "#1b211e", fontFamily: FD, fontWeight: 700, textTransform: "uppercase", padding: "12px 22px", borderRadius: 11, textDecoration: "none", fontSize: 14 }}>{t("of.entrar")}</a>
      </div>
  )}
  {estado === "sem_continente" && (
      <div style={{ textAlign: "center", padding: "30px 16px", background: "#121815", border: "1px solid #243029", borderRadius: 16 }}>
      <div style={{ fontSize: 30, marginBottom: 6 }}>🗺️</div>
      <p style={{ fontSize: 13, color: "#c7d0c9", lineHeight: 1.5 }}>Ainda não sabemos o teu continente. Define o teu país no perfil para entrares na liga continental.</p>
      </div>
  )}
  {/* Barra de pesquisa partilhada pelas duas vistas */}
  {estado === "pronto" && (membros.length > 0 || geral.length > 0) && (
      <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#141a17", border: "1px solid #243029", borderRadius: 10, padding: "9px 12px", marginBottom: 11 }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7c8a82" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
      <input
      value={pesquisa}
      onChange={(e) => setPesquisa(e.target.value)}
      placeholder={t("of.procurarTime")}
      inputMode="text"
      style={{ flex: 1, background: "transparent", border: "none", color: "#f1ede2", fontSize: 14, fontFamily: FB, outline: "none" }}
      />
      {pesquisa && (
          <button onClick={() => setPesquisa("")} aria-label="Limpar" style={{ background: "transparent", border: "none", color: "#7c8a82", cursor: "pointer", fontSize: 16, lineHeight: 1, padding: 0 }}>×</button>
      )}
      </div>
  )}
  {/* Vista GERAL: acumulado ao vivo */}
  {estado === "pronto" && vista === "geral" && (
      <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
      <span style={{ fontFamily: FD, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#93a39a" }}>{t("pl.rankingGeral")}</span>
      {emAndamento && (
          <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#e2655a", fontWeight: 700 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#e2655a", display: "inline-block" }} /> Ao vivo
          </span>
      )}
      </div>
      {!geralCarregado ? (
          <Aviso>{t("pl.aSomarEpoca")}</Aviso>
        ) : geral.length === 0 ? (
          <Aviso>{t("pl.semPontosAcumulados")}</Aviso>
        ) : geralVisivel.length === 0 ? (
          <Aviso>Sem resultados para &quot;{pesquisa}&quot;.</Aviso>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {geralVisivel.map((m) => {
                const euMesmo = m.user_id === meuId;
                const ouro = m.posicao === 1 && m.pontos_geral > 0;
                return (
                  <div key={m.user_id} style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", background: euMesmo ? "#16201b" : "#121815", border: `1px solid ${euMesmo ? GOLD : (ouro ? GOLD : "#243029")}`, borderRadius: 12, padding: "11px 12px" }}>
                  <div style={{ width: 24, textAlign: "center", flexShrink: 0, fontFamily: FD, fontSize: 16, fontWeight: 700, color: ouro ? GOLD : "#7c8a82" }}>{m.posicao}</div>
                  <div style={{ flexShrink: 0 }}><Escudo config={m.escudo || DEFAULT_IDENTITY} size={34} /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#f1ede2", display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", overflow: "hidden" }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{m.nome_time}</span>
                  <span style={{ background: "#3a2f12", color: GOLD, fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 999, flexShrink: 0 }}>PRO</span>
                  {euMesmo && <span style={{ background: "#1c3a2e", color: "#aee9c9", fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 999, flexShrink: 0 }}>TU</span>}
                  </div>
                  <div style={{ fontSize: 11, color: "#93a39a" }}>{m.escalou ? <span style={{ color: "#7fd1a3" }}>+{m.pontos_rodada} nesta rodada</span> : t("pl.semEscalacao")}</div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontFamily: FD, fontSize: 16, fontWeight: 700, color: GOLD }}>{m.pontos_geral}</div>
                  <div style={{ fontSize: 9, color: "#93a39a", textTransform: "uppercase" }}>{t("pl.total")}</div>
                  </div>
                  </div>
                );
          })}
          </div>
      )}
      </>
  )}
  {/* Vista RODADA: o ranking só da rodada atual */}
  {estado === "pronto" && vista === "rodada" && (
      <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
      <span style={{ fontFamily: FD, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#93a39a" }}>Rodada · {compAtual.nome}</span>
      {emAndamento ? (
          <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#e2655a", fontWeight: 700 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#e2655a", display: "inline-block" }} /> Ao vivo
          </span>
        ) : (
          <span style={{ fontSize: 11, color: "#7fd1a3" }}>{t("pl.preCompeticao")}</span>
      )}
      </div>
      {membros.length === 0 ? (
          <Aviso>{t("of.semMembrosPro")}</Aviso>
        ) : membrosVisiveis.length === 0 ? (
          <Aviso>Sem resultados para &quot;{pesquisa}&quot;.</Aviso>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {membrosVisiveis.map((m) => {
                const euMesmo = m.user_id === meuId;
                const ouro = m.posicao === 1 && m.escalou;
                return (
                  <div key={m.user_id} style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", background: euMesmo ? "#16201b" : "#121815", border: `1px solid ${euMesmo ? GOLD : (ouro ? GOLD : "#243029")}`, borderRadius: 12, padding: "11px 12px" }}>
                  <div style={{ width: 24, textAlign: "center", flexShrink: 0, fontFamily: FD, fontSize: 16, fontWeight: 700, color: ouro ? GOLD : "#7c8a82" }}>{m.escalou ? m.posicao : "—"}</div>
                  <div style={{ flexShrink: 0 }}><Escudo config={m.escudo || DEFAULT_IDENTITY} size={34} /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#f1ede2", display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", overflow: "hidden" }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{m.nome_time}</span>
                  <span style={{ background: "#3a2f12", color: GOLD, fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 999, flexShrink: 0 }}>PRO</span>
                  {euMesmo && <span style={{ background: "#1c3a2e", color: "#aee9c9", fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 999, flexShrink: 0 }}>TU</span>}
                  </div>
                  <div style={{ fontSize: 11, color: m.escalou ? "#7fd1a3" : "#e0894f" }}>{m.escalou ? "Escalou" : t("pl.naoEscalou")}</div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontFamily: FD, fontSize: 16, fontWeight: 700, color: "#f1ede2" }}>{m.escalou ? (m.pontos >= 0 ? "+" : "") + m.pontos : "—"}</div>
                  <div style={{ fontSize: 9, color: "#93a39a", textTransform: "uppercase" }}>{t("comum.pts")}</div>
                  </div>
                  </div>
                );
          })}
          </div>
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
