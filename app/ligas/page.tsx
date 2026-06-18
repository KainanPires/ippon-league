"use client";

import { useState, useEffect } from "react";
import { Escudo, DEFAULT_IDENTITY, type Identity } from "@/components/Escudo";
import { supabase } from "@/lib/supabase";
import { focoMercado } from "@/lib/calendario";
import { nomeContinenteDoPais } from "@/lib/continentes";
import { CalendarioConteudo } from "@/components/CalendarioConteudo";

const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";

// Limites por plano (espelho do servidor; a regra real está nas rotas).
const LIM_CRIAR_FREE = 1, LIM_CRIAR_PRO = 5;
const LIM_PART_FREE = 2, LIM_PART_PRO = 5;

type Tab = "ativas" | "mercado" | "calendario" | "resultados";

function esc(p: Partial<Identity>): Identity { return { ...DEFAULT_IDENTITY, ...p }; }

interface MinhaLiga {
  id: string;
  name: string;
  formato: string;
  privacidade: string;
  escudo: Identity | null;
  invite_code: string;
  membros: number;
  sou_dono: boolean;
  estado?: string | null;
  copa_estado?: string | null;
}

// Uma liga/copa está terminada? Pontos corridos: estado='terminada'.
// Copa: copa_estado='terminada'. As restantes contam como ativas.
function ligaTerminada(l: MinhaLiga): boolean {
  if (l.formato === "copa") return l.copa_estado === "terminada";
  return l.estado === "terminada";
}

interface LigaMercado {
  id: string;
  name: string;
  formato: string;
  privacidade: string;
  escudo: Identity | null;
  invite_code: string;
  membros: number;
  sou_membro: boolean;
  sou_dono: boolean;
}

// Estado da posição do utilizador numa liga oficial (para o cartão).
interface PosOficial {
  posicao: number | null;  // null = não está no ranking (não-Pro ou não escalou)
  escalou: boolean;
  total: number;           // total de membros no ranking
}

export default function Ligas() {
  const [tab, setTab] = useState<Tab>("ativas");
  const [mine, setMine] = useState<MinhaLiga[]>([]);
  const [aCarregar, setACarregar] = useState(true);
  const [codigo, setCodigo] = useState("");
  const [aEntrar, setAEntrar] = useState(false);
  const [erroEntrar, setErroEntrar] = useState("");
  const [souPro, setSouPro] = useState(false);

  // Ligas oficiais: nome do continente + posição do utilizador em cada uma.
  const [nomeContinente, setNomeContinente] = useState<string | null>(null);
  const [posMundial, setPosMundial] = useState<PosOficial | null>(null);
  const [posContinental, setPosContinental] = useState<PosOficial | null>(null);

  // Mercado de ligas (carrega só quando se abre a aba).
  const [mercado, setMercado] = useState<LigaMercado[] | null>(null);
  const [aCarregarMercado, setACarregarMercado] = useState(false);
  const [aEntrarId, setAEntrarId] = useState<string | null>(null);
  const [erroMercado, setErroMercado] = useState("");
  const [pedidoEnviado, setPedidoEnviado] = useState<Record<string, boolean>>({});

  // Competição da rodada atual (para calcular os rankings oficiais).
  const foco = focoMercado();
  const idComp = (foco.aDecorrer ?? foco.atual).idCompeticao;

  useEffect(() => {
    let vivo = true;
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user?.id;
      const meta = sess.session?.user?.user_metadata as { is_pro?: boolean; pais_iso?: string } | undefined;
      if (vivo) {
        setSouPro(!!meta?.is_pro);
        setNomeContinente(nomeContinenteDoPais(meta?.pais_iso));
      }
      if (!uid) { if (vivo) { setMine([]); setACarregar(false); } return; }
      try {
        const res = await fetch(`/api/liga/minhas?user_id=${uid}`);
        const j = await res.json();
        if (vivo && Array.isArray(j.ligas)) setMine(j.ligas);
      } catch {}
      if (vivo) setACarregar(false);

      // Posição nas ligas oficiais (calcula o ranking das duas).
      carregarPosicaoOficial("mundial", uid, vivo, setPosMundial);
      carregarPosicaoOficial("continental", uid, vivo, setPosContinental);
    })();
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Busca o ranking de uma liga oficial e extrai a posição do próprio utilizador.
  async function carregarPosicaoOficial(
    tipo: "mundial" | "continental",
    uid: string,
    vivo: boolean,
    set: (p: PosOficial) => void
  ) {
    try {
      // Posição no RANKING DO ANO (liga oficial anual), da mesma fonte que o
      // interior da liga: /api/liga/geral com tipo oficial (recorta o ano).
      const params = new URLSearchParams({ tipo, comp: idComp, user_id: uid });
      const res = await fetch(`/api/liga/geral?${params.toString()}`);
      const j = await res.json();
      if (!vivo || !j.ok || !Array.isArray(j.membros)) return;
      const eu = j.membros.find((m: { user_id: string }) => m.user_id === uid);
      // "No ranking" = tem pontos acumulados no ano (pontos_geral > 0).
      const noRanking = !!(eu && eu.pontos_geral > 0);
      set({
        posicao: noRanking ? eu.posicao : null,
        escalou: noRanking,
        total: j.membros.length,
      });
    } catch { /* o cartão mostra o estado neutro */ }
  }

  // Carrega o mercado (uma vez). Chamado ao abrir a aba "mercado".
  async function carregarMercado() {
    if (mercado !== null || aCarregarMercado) return;
    setACarregarMercado(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user?.id || "";
      const res = await fetch(`/api/liga/mercado?user_id=${uid}`);
      const j = await res.json();
      setMercado(Array.isArray(j.ligas) ? j.ligas : []);
    } catch {
      setMercado([]);
    }
    setACarregarMercado(false);
  }

  function mudarTab(t: Tab) {
    setTab(t);
    if (t === "mercado") carregarMercado();
  }

  async function entrarPorCodigo() {
    const c = codigo.trim().toUpperCase();
    if (c.length < 4) { setErroEntrar("Código demasiado curto."); return; }
    setErroEntrar("");
    setAEntrar(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user?.id;
      if (!uid) { window.location.href = `/entrar?voltar=/ligas`; return; }
      const res = await fetch("/api/liga/entrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: uid, codigo: c }),
      });
      const j = await res.json();
      if (!j.ok) {
        setErroEntrar(j.erro || "Não encontrámos essa liga.");
        setAEntrar(false);
        return;
      }
      window.location.href = `/liga/${j.liga.invite_code}`;
    } catch {
      setErroEntrar("Falha de ligação.");
      setAEntrar(false);
    }
  }

  // Ação no mercado: liga "aberta" entra direto; "por aprovação" envia pedido.
  async function acaoMercado(liga: LigaMercado) {
    setErroMercado("");
    setAEntrarId(liga.id);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user?.id;
      if (!uid) { window.location.href = `/entrar?voltar=/ligas`; return; }
      const res = await fetch("/api/liga/pedir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: uid, codigo: liga.invite_code }),
      });
      const j = await res.json();
      if (!j.ok) {
        setErroMercado(j.erro || "Não foi possível concluir.");
        setAEntrarId(null);
        return;
      }
      if (j.entrou || j.jaEra) {
        window.location.href = `/liga/${liga.invite_code}`;
        return;
      }
      if (j.pedido || j.jaPediu) {
        setPedidoEnviado((prev) => ({ ...prev, [liga.id]: true }));
        setAEntrarId(null);
        return;
      }
      window.location.href = `/liga/${liga.invite_code}`;
    } catch {
      setErroMercado("Falha de ligação.");
      setAEntrarId(null);
    }
  }

  // Separa as minhas ligas em ativas (lista principal). As terminadas e os
  // certificados vivem agora na aba Resultados (componente ResultadosConteudo).
  const ativas = mine.filter((l) => !ligaTerminada(l));

  // Contagens para os avisos de limite (só ligas de amigos; mine já é só amigos).
  // Conta SÓ as ativas — as terminadas já não ocupam lugar prático.
  const nCriadas = ativas.filter((l) => l.sou_dono).length;
  const nParticipa = ativas.length;
  const limCriar = souPro ? LIM_CRIAR_PRO : LIM_CRIAR_FREE;
  const limPart = souPro ? LIM_PART_PRO : LIM_PART_FREE;
  const noLimiteCriar = nCriadas >= limCriar;
  const noLimitePart = nParticipa >= limPart;

  // Configuração visual dos dois cartões oficiais.
  const cfgMundial = esc({ bg1: "#1c3a2e", bg2: "#102a20", border: GOLD, symbol: "mundo" });
  const cfgContinental = esc({ bg1: "#2f6fb3", bg2: "#25588f", border: "#eaf2fd", symbol: "mapa-europa" });

  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: FB }}>
      <div style={{ maxWidth: 460, margin: "0 auto", padding: "14px 14px 84px" }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <a href="/inicio" aria-label="Voltar" style={{ width: 34, height: 34, borderRadius: "50%", border: "1px solid #243029", display: "flex", alignItems: "center", justifyContent: "center", color: "#cfd8d2", textDecoration: "none" }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
            </a>
            <h1 style={{ fontFamily: FD, fontSize: 19, fontWeight: 700, textTransform: "uppercase", margin: 0 }}>Ligas</h1>
          </div>
          <a href="/criar-liga" aria-label="Criar liga" style={{ width: 36, height: 36, borderRadius: "50%", background: GOLD, color: "#1b211e", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          </a>
        </header>

        <div style={{ display: "flex", gap: 4, marginBottom: 16, borderBottom: "1px solid #1a221d" }}>
          {(["ativas", "mercado", "calendario", "resultados"] as Tab[]).map((t) => (
            <button key={t} onClick={() => mudarTab(t)} style={{ flex: 1, textAlign: "center", background: "transparent", border: "none", borderBottom: `2px solid ${tab === t ? GOLD : "transparent"}`, color: tab === t ? "#f1ede2" : "#7c8a82", fontFamily: FD, fontSize: 12, fontWeight: 700, textTransform: "uppercase", padding: "8px 0", cursor: "pointer" }}>
              {t === "ativas" ? "Ativas" : t === "mercado" ? "Mercado" : t === "calendario" ? "Calendário" : "Resultados"}
            </button>
          ))}
        </div>

        {tab === "ativas" && (
          <>
            <Section>Ligas oficiais · prémios</Section>

            {/* Mundial — abre para todos; mostra a posição se estiver no ranking. */}
            <OficialRow
              cfg={cfgMundial}
              name="Liga Mundial"
              sub="Concorre aos prémios mundiais"
              href="/oficial/mundial"
              pos={posMundial}
              souPro={souPro}
            />

            {/* Continental — nome do continente real; abre para todos. */}
            <OficialRow
              cfg={cfgContinental}
              name={nomeContinente ? `Liga ${nomeContinente}` : "Liga Continental"}
              sub="Concorre aos prémios do teu continente"
              href="/oficial/continental"
              pos={posContinental}
              souPro={souPro}
            />

            {!souPro && (
              <a href="/ippon-pro" style={{ display: "block", textAlign: "center", marginTop: 2, marginBottom: 4, background: "#2a2410", border: "1px solid #5a4a18", color: GOLD, fontFamily: FD, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", padding: "11px 14px", borderRadius: 10, textDecoration: "none", fontSize: 12.5, lineHeight: 1.4 }}>
                🔒 Vês o ranking, mas só Pro concorre aos prémios · passa a Pro
              </a>
            )}

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 18, marginBottom: 10 }}>
              <span style={{ fontFamily: FD, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#93a39a" }}>Ligas de amigos</span>
              {!aCarregar && <span style={{ fontFamily: FD, fontSize: 11, fontWeight: 700, color: noLimitePart ? "#e0894f" : "#7c8a82" }}>{nParticipa}/{limPart}</span>}
            </div>
            {aCarregar ? (
              <div style={{ textAlign: "center", padding: "20px", color: "#7c8a82", fontFamily: FD, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.1em" }}>A carregar…</div>
            ) : ativas.length > 0 ? (
              <>
                {ativas.map((l) => (
                  <a key={l.id} href={`/liga/${l.invite_code}`} style={{ textDecoration: "none" }}>
                    <LeagueRow cfg={l.escudo || DEFAULT_IDENTITY} name={l.name} sub={`${l.formato === "copa" ? "Copa Ippon" : "Pontos corridos"} · ${l.membros} ${l.membros === 1 ? "membro" : "membros"}`} right={<ActionBtn kind="ver">Abrir</ActionBtn>} />
                  </a>
                ))}
                {noLimiteCriar ? (
                  <LimiteCard
                    souPro={souPro}
                    titulo={souPro ? "Atingiste o máximo de ligas criadas" : "Já criaste a tua liga"}
                    texto={souPro
                      ? "Com o Ippon Pro podes criar até 5 ligas — e já lá estás."
                      : "Com a conta gratuita podes criar 1 liga. Passa a Ippon Pro para criares até 5."}
                  />
                ) : (
                  <a href="/criar-liga" style={{ display: "block", textAlign: "center", marginTop: 10, background: "transparent", border: "1px solid #2a3a33", color: "#cfd8d2", fontFamily: FD, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", padding: "11px 20px", borderRadius: 10, textDecoration: "none", fontSize: 13 }}>+ Criar outra liga</a>
                )}
              </>
            ) : (
              <div style={{ background: "#121815", border: "1px dashed #2a3a33", borderRadius: 14, padding: "18px 14px", textAlign: "center" }}>
                <div style={{ fontSize: 13, color: "#c7d0c9", marginBottom: 12, lineHeight: 1.5 }}>Ainda não tens ligas de amigos.<br />Cria uma e desafia o teu dojo!</div>
                <a href="/criar-liga" style={{ display: "inline-block", background: "#3f8f5a", color: "#06140d", fontFamily: FD, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", padding: "11px 20px", borderRadius: 10, textDecoration: "none", fontSize: 14 }}>Criar liga</a>
              </div>
            )}

            <Section style={{ marginTop: 18 }}>Entrar com código</Section>
            {noLimitePart ? (
              <LimiteCard
                souPro={souPro}
                titulo={souPro ? "Estás no máximo de ligas" : "Estás em 2 ligas de amigos"}
                texto={souPro
                  ? "Com o Ippon Pro participas em até 5 ligas de amigos — e já lá estás."
                  : "Com a conta gratuita participas em 2 ligas de amigos. Passa a Ippon Pro para entrares em até 5."}
              />
            ) : (
              <>
                <div style={{ display: "flex", gap: 8 }}>
                  <input value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} placeholder="Código de convite" maxLength={8} style={{ flex: 1, background: "#141a17", border: "1px solid #243029", borderRadius: 10, padding: "11px 13px", color: "#f1ede2", fontSize: 15, fontFamily: FD, letterSpacing: "0.1em", outline: "none", textTransform: "uppercase" }} />
                  <button onClick={entrarPorCodigo} disabled={aEntrar} style={{ background: GOLD, color: "#1b211e", border: "none", fontFamily: FD, fontWeight: 700, textTransform: "uppercase", fontSize: 12, padding: "0 18px", borderRadius: 10, cursor: "pointer", whiteSpace: "nowrap" }}>{aEntrar ? "…" : "Entrar"}</button>
                </div>
                {erroEntrar && (
                  erroEntrar.includes("Pro") ? (
                    <a href="/ippon-pro" style={{ display: "block", fontSize: 12.5, color: GOLD, marginTop: 8, textDecoration: "none", background: "#2a2410", border: "1px solid #5a4a18", borderRadius: 10, padding: "10px 12px", lineHeight: 1.4 }}>{erroEntrar} →</a>
                  ) : (
                    <div style={{ fontSize: 12, color: "#ef8d83", marginTop: 8 }}>{erroEntrar}</div>
                  )
                )}
              </>
            )}
          </>
        )}

        {tab === "mercado" && (
          <>
            <Section>Ligas abertas</Section>
            <p style={{ fontSize: 12, color: "#7c8a82", margin: "-4px 0 12px", lineHeight: 1.5 }}>Ligas públicas. Nas abertas entras já; nas "por aprovação" o dono aceita o teu pedido. As fechadas não aparecem aqui — só por código.</p>

            {mercado === null || aCarregarMercado ? (
              <div style={{ textAlign: "center", padding: "20px", color: "#7c8a82", fontFamily: FD, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.1em" }}>A carregar…</div>
            ) : mercado.length === 0 ? (
              <div style={{ background: "#121815", border: "1px dashed #2a3a33", borderRadius: 14, padding: "20px 14px", textAlign: "center" }}>
                <div style={{ fontSize: 13, color: "#c7d0c9", marginBottom: 12, lineHeight: 1.5 }}>Ainda não há ligas abertas.<br />Cria a tua e deixa-a <strong>aberta</strong> para todos entrarem!</div>
                <a href="/criar-liga" style={{ display: "inline-block", background: "#3f8f5a", color: "#06140d", fontFamily: FD, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", padding: "11px 20px", borderRadius: 10, textDecoration: "none", fontSize: 14 }}>Criar liga</a>
              </div>
            ) : (
              <>
                {mercado.map((l) => (
                  <LeagueRow
                    key={l.id}
                    cfg={l.escudo || DEFAULT_IDENTITY}
                    name={l.name}
                    sub={`${l.formato === "copa" ? "Copa Ippon" : "Pontos corridos"} · ${l.membros} ${l.membros === 1 ? "membro" : "membros"}`}
                    right={
                      l.sou_membro ? (
                        <a href={`/liga/${l.invite_code}`} style={{ textDecoration: "none" }}><ActionBtn kind="ver">Abrir</ActionBtn></a>
                      ) : pedidoEnviado[l.id] ? (
                        <span style={{ background: "#23291f", color: "#93a39a", fontFamily: FD, fontWeight: 700, textTransform: "uppercase", fontSize: 10.5, padding: "7px 11px", borderRadius: 8, whiteSpace: "nowrap" }}>Pedido enviado</span>
                      ) : (
                        <button onClick={() => acaoMercado(l)} disabled={aEntrarId === l.id} style={{ background: l.privacidade === "mediante_pedido" ? "#3a2f12" : "#3f8f5a", color: l.privacidade === "mediante_pedido" ? GOLD : "#06140d", border: "none", fontFamily: FD, fontWeight: 700, textTransform: "uppercase", fontSize: 11, padding: "7px 14px", borderRadius: 8, whiteSpace: "nowrap", cursor: aEntrarId === l.id ? "default" : "pointer", opacity: aEntrarId === l.id ? 0.7 : 1 }}>{aEntrarId === l.id ? "…" : l.privacidade === "mediante_pedido" ? "Solicitar" : "Entrar"}</button>
                      )
                    }
                  />
                ))}
                {erroMercado && (
                  erroMercado.includes("Pro") ? (
                    <a href="/ippon-pro" style={{ display: "block", fontSize: 12.5, color: GOLD, marginTop: 8, textDecoration: "none", background: "#2a2410", border: "1px solid #5a4a18", borderRadius: 10, padding: "10px 12px", lineHeight: 1.4 }}>{erroMercado} →</a>
                  ) : (
                    <div style={{ fontSize: 12, color: "#ef8d83", marginTop: 8 }}>{erroMercado}</div>
                  )
                )}
              </>
            )}
          </>
        )}

        {tab === "calendario" && <CalendarioConteudo />}

        {tab === "resultados" && <ResultadosConteudo />}
      </div>

      <nav style={{ position: "fixed", left: 0, right: 0, bottom: 0, height: 60, background: "#0f1411", borderTop: "1px solid #243029", display: "flex", alignItems: "center", justifyContent: "space-around", zIndex: 50 }}>
        <NavTab label="Início" href="/inicio" icon={<HomeIcon />} />
        <NavTab label="Competições" href="/ligas" icon={<TrophyIcon />} active />
        <NavTab label="Atletas" href="/atletas" icon={<AthletesIcon />} />
        <NavTab label="Pro" icon={<BoltIcon />} href="/ippon-pro" />
      </nav>
    </main>
  );
}

function NavTab({ label, icon, href, active }: { label: string; icon: React.ReactNode; href?: string; active?: boolean }) {
  const style: React.CSSProperties = { display: "flex", flexDirection: "column", alignItems: "center", gap: 3, color: active ? GOLD : "#6f7d76", textDecoration: "none" };
  const inner = <>{icon}<span style={{ fontSize: 11, fontWeight: active ? 700 : 400 }}>{label}</span></>;
  return href ? <a href={href} style={style}>{inner}</a> : <div style={style}>{inner}</div>;
}
function HomeIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /></svg>; }
function TrophyIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 4h8v5a4 4 0 0 1-8 0V4z" /><path d="M8 6H5v2a3 3 0 0 0 3 3M16 6h3v2a3 3 0 0 1-3 3M10 17h4M9 21h6M12 13v4" /></svg>; }
function AthletesIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="8" cy="6" r="3" /><circle cx="17" cy="7" r="2.5" /><path d="M3 20v-1a5 5 0 0 1 10 0v1M14 20v-1a4 4 0 0 1 7-2.6" /></svg>; }
function BoltIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" /></svg>; }

function Section({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ fontFamily: FD, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#93a39a", margin: "4px 0 10px", ...style }}>{children}</div>;
}
function LeagueRow({ cfg, name, sub, right }: { cfg: Identity; name: string; sub: string; right: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, background: "#121815", border: "1px solid #243029", borderRadius: 14, padding: "11px 13px", marginBottom: 9 }}>
      <div style={{ flexShrink: 0, display: "flex" }}><Escudo config={cfg} size={34} /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "#f1ede2" }}>{name}</div>
        <div style={{ fontSize: 11, color: "#93a39a" }}>{sub}</div>
      </div>
      {right}
    </div>
  );
}

// Cartão de liga oficial. Abre a página de ranking (para todos). À direita mostra
// a posição do utilizador (se estiver no ranking) ou um convite a ver/ser Pro.
function OficialRow({ cfg, name, sub, href, pos, souPro }: { cfg: Identity; name: string; sub: string; href: string; pos: PosOficial | null; souPro: boolean }) {
  let right: React.ReactNode;
  if (pos && pos.posicao !== null) {
    // Está no ranking: mostra a posição em destaque.
    right = (
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontFamily: FD, fontSize: 18, fontWeight: 700, color: GOLD, lineHeight: 1 }}>{`#${pos.posicao.toLocaleString("pt-PT")}º`}</div>
        <div style={{ fontSize: 9, color: "#93a39a", textTransform: "uppercase", marginTop: 2 }}>a tua posição</div>
      </div>
    );
  } else if (souPro) {
    // É Pro mas ainda não escalou nesta rodada.
    right = <span style={{ fontFamily: FD, fontWeight: 700, color: "#7c8a82", fontSize: 11, textTransform: "uppercase", whiteSpace: "nowrap" }}>Escala para entrar</span>;
  } else {
    // Não-Pro: vê o ranking, mas não concorre.
    right = <ActionBtn kind="ver">Ver ranking</ActionBtn>;
  }
  return (
    <a href={href} style={{ textDecoration: "none", display: "block" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, background: "#121815", border: "1px solid #243029", borderRadius: 14, padding: "11px 13px", marginBottom: 9 }}>
        <div style={{ flexShrink: 0, display: "flex" }}><Escudo config={cfg} size={34} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#f1ede2", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</div>
          <div style={{ fontSize: 11, color: "#93a39a" }}>{sub}</div>
        </div>
        {right}
      </div>
    </a>
  );
}

function ActionBtn({ kind, children }: { kind: "ver" | "solicitar"; children: React.ReactNode }) {
  const ver = kind === "ver";
  return <span style={{ background: ver ? "#e67e22" : "#3f8f5a", color: ver ? "#1b0f06" : "#06140d", border: "none", fontFamily: FD, fontWeight: 700, textTransform: "uppercase", fontSize: 11, padding: "7px 12px", borderRadius: 8, whiteSpace: "nowrap", display: "inline-block" }}>{children}</span>;
}

// Cartão de limite atingido. Para free, convida ao Pro; para Pro, só informa.
function LimiteCard({ souPro, titulo, texto }: { souPro: boolean; titulo: string; texto: string }) {
  return (
    <div style={{ background: souPro ? "#121815" : "#2a2410", border: `1px solid ${souPro ? "#243029" : "#5a4a18"}`, borderRadius: 14, padding: "13px 15px", marginTop: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
        <span style={{ fontSize: 14 }}>{souPro ? "✓" : "🔒"}</span>
        <span style={{ fontFamily: FD, fontSize: 12.5, fontWeight: 700, color: souPro ? "#cfd8d2" : GOLD }}>{titulo}</span>
      </div>
      <p style={{ fontSize: 12.5, color: "#a9b4ac", lineHeight: 1.5, margin: souPro ? 0 : "0 0 10px" }}>{texto}</p>
      {!souPro && (
        <a href="/ippon-pro" style={{ display: "inline-block", background: GOLD, color: "#1b211e", fontFamily: FD, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", fontSize: 12, padding: "9px 16px", borderRadius: 9, textDecoration: "none" }}>Conhecer o Ippon Pro</a>
      )}
    </div>
  );
}
