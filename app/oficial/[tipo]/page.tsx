"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Escudo, DEFAULT_IDENTITY, type Identity } from "@/components/Escudo";
import { focoMercado } from "@/lib/calendario";

const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";

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

export default function PaginaOficial() {
  const params = useParams();
  const tipo = String(params?.tipo || "").toLowerCase(); // "mundial" | "continental"
  const ehMundial = tipo === "mundial";

  const [vista, setVista] = useState<Vista>("rodada");
  const [estado, setEstado] = useState<"a_carregar" | "pronto" | "sem_sessao" | "sem_continente">("a_carregar");
  const [membros, setMembros] = useState<MembroRank[]>([]);
  const [nomeContinente, setNomeContinente] = useState<string | null>(null);
  const [meuId, setMeuId] = useState<string | null>(null);
  const [souPro, setSouPro] = useState(false);

  // A competição da rodada atual (mesma fonte do resto da app).
  const foco = focoMercado();
  const compAtual = foco.aDecorrer ?? foco.atual;
  const idComp = compAtual.idCompeticao;
  const emAndamento = foco.aDecorrer !== null;

  const titulo = ehMundial ? "Liga Mundial" : (nomeContinente ? `Liga ${nomeContinente}` : "Liga Continental");

  useEffect(() => {
    let vivo = true;
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user?.id ?? null;
      const meta = sess.session?.user?.user_metadata as { is_pro?: boolean } | undefined;
      if (!vivo) return;
      setMeuId(uid);
      setSouPro(!!meta?.is_pro);

      if (!uid && !ehMundial) {
        // Continental precisa do utilizador para saber o continente.
        setEstado("sem_sessao");
        return;
      }

      try {
        const params = new URLSearchParams({ tipo: ehMundial ? "mundial" : "continental", comp: idComp });
        if (uid) params.set("user_id", uid);
        const res = await fetch(`/api/liga/oficial?${params.toString()}`);
        const j = await res.json();
        if (!vivo) return;
        if (j.semContinente) {
          setEstado("sem_continente");
          return;
        }
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
              ? "Os melhores do mundo. Concorre aos prémios mundiais da rodada."
              : `Os melhores de ${nomeContinente || "o teu continente"}. Concorre aos prémios continentais.`}
          </div>
          <div style={{ marginTop: 8, fontSize: 11, color: "rgba(255,255,255,0.7)" }}>
            Só membros Pro entram no ranking · {compAtual.nome}
          </div>
        </div>

        {/* Banner Pro para quem não é Pro */}
        {!souPro && estado === "pronto" && (
          <a href="/ippon-pro" style={{ display: "block", textAlign: "center", marginBottom: 14, background: "#2a2410", border: "1px solid #5a4a18", color: GOLD, fontFamily: FD, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", padding: "11px 14px", borderRadius: 10, textDecoration: "none", fontSize: 12.5, lineHeight: 1.4 }}>
            🔒 Estás a ver o ranking dos Pro · passa a Pro para entrares
          </a>
        )}

        {/* Seletor Rodada / Geral */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16, borderBottom: "1px solid #1a221d" }}>
          {(["rodada", "geral"] as Vista[]).map((v) => (
            <button key={v} onClick={() => setVista(v)} style={{ flex: 1, textAlign: "center", background: "transparent", border: "none", borderBottom: `2px solid ${vista === v ? GOLD : "transparent"}`, color: vista === v ? "#f1ede2" : "#7c8a82", fontFamily: FD, fontSize: 13, fontWeight: 700, textTransform: "uppercase", padding: "9px 0", cursor: "pointer" }}>
              {v === "rodada" ? "Líderes da Rodada" : "Ranking Geral"}
            </button>
          ))}
        </div>

        {estado === "a_carregar" && <Aviso>A carregar o ranking…</Aviso>}

        {estado === "sem_sessao" && (
          <div style={{ textAlign: "center", padding: "30px 16px", background: "#121815", border: "1px solid #243029", borderRadius: 16 }}>
            <p style={{ fontSize: 13, color: "#c7d0c9", lineHeight: 1.5, marginBottom: 16 }}>Entra na tua conta para veres a liga do teu continente.</p>
            <a href="/entrar?voltar=/ligas" style={{ display: "inline-block", background: GOLD, color: "#1b211e", fontFamily: FD, fontWeight: 700, textTransform: "uppercase", padding: "12px 22px", borderRadius: 11, textDecoration: "none", fontSize: 14 }}>Entrar</a>
          </div>
        )}

        {estado === "sem_continente" && (
          <div style={{ textAlign: "center", padding: "30px 16px", background: "#121815", border: "1px solid #243029", borderRadius: 16 }}>
            <div style={{ fontSize: 30, marginBottom: 6 }}>🗺️</div>
            <p style={{ fontSize: 13, color: "#c7d0c9", lineHeight: 1.5 }}>Ainda não sabemos o teu continente. Define o teu país no perfil para entrares na liga continental.</p>
          </div>
        )}

        {/* Vista RODADA: o ranking real */}
        {estado === "pronto" && vista === "rodada" && (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontFamily: FD, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#93a39a" }}>Rodada · {compAtual.nome}</span>
              {emAndamento ? (
                <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#e2655a", fontWeight: 700 }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#e2655a", display: "inline-block" }} /> Ao vivo
                </span>
              ) : (
                <span style={{ fontSize: 11, color: "#7fd1a3" }}>Pré-competição</span>
              )}
            </div>

            {membros.length === 0 ? (
              <Aviso>Ainda sem membros Pro nesta rodada.</Aviso>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {membros.map((m) => {
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
                        <div style={{ fontSize: 11, color: m.escalou ? "#7fd1a3" : "#e0894f" }}>{m.escalou ? "Escalou" : "Não escalou"}</div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontFamily: FD, fontSize: 16, fontWeight: 700, color: "#f1ede2" }}>{m.escalou ? (m.pontos >= 0 ? "+" : "") + m.pontos : "—"}</div>
                        <div style={{ fontSize: 9, color: "#93a39a", textTransform: "uppercase" }}>pts</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Vista GERAL: ainda por construir (precisa de histórico acumulado) */}
        {estado === "pronto" && vista === "geral" && (
          <div style={{ textAlign: "center", padding: "44px 16px", color: "#7c8a82" }}>
            <div style={{ fontSize: 30, marginBottom: 8 }}>🏆</div>
            <div style={{ fontFamily: FD, fontSize: 15, fontWeight: 700, textTransform: "uppercase", color: "#cfd8d2", marginBottom: 6 }}>Ranking Geral</div>
            <div style={{ fontSize: 13, lineHeight: 1.5, maxWidth: 320, margin: "0 auto" }}>A classificação acumulada de todas as rodadas do ano aparece aqui. Vai somando os pontos a cada competição.</div>
            <div style={{ marginTop: 12, fontSize: 11, color: "#5f6f67", border: "1px solid #2a3a33", borderRadius: 999, padding: "4px 12px", display: "inline-block" }}>Em breve</div>
          </div>
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
