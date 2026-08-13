"use client";

import { useEffect, useState, useMemo } from "react";
import { Mascot } from "@/components/Mascot";
import { numeroDaRodada } from "@/lib/calendario";
import { useT, useNomeDoMes } from "@/lib/i18n";

const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";

// Tira acentos e maiúsculas para a busca por nome ser tolerante (igual ao resto da app).
function normalizar(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

export interface RodadaGaleria {
  comp: string;
  nome: string;
  pontos: number;
  ganho_patrimonio: number;
  posicao: number | null;
  total_jogadores: number | null;
  data: string | null;
}

// Galeria de resumos: lista todas as rodadas do utilizador. Tocar numa rodada
// chama onAbrir(comp), que (no Início) monta o <Desempenho> completo dessa rodada.
export function GaleriaResumos({ userId, onAbrir, onClose }: { userId: string; onAbrir: (comp: string) => void; onClose: () => void }) {
  const t = useT();
  const nomeMes = useNomeDoMes();
  const [rodadas, setRodadas] = useState<RodadaGaleria[] | null>(null);
  const [busca, setBusca] = useState("");     // lupa: nome da competição OU nº da rodada
  const [mes, setMes] = useState("");          // "" = todos os meses; senão "01".."12"

  useEffect(() => {
    let active = true;
    fetch(`/api/minhas-rodadas?user=${userId}`)
      .then((r) => r.json())
      .then((j) => { if (active) setRodadas(Array.isArray(j?.rodadas) ? j.rodadas : []); })
      .catch(() => { if (active) setRodadas([]); });
    return () => { active = false; };
  }, [userId]);

  // Aplica os dois filtros (lupa + mês) sobre a lista já carregada. Tudo no cliente.
  const filtradas = useMemo(() => {
    if (!rodadas) return null;
    const q = normalizar(busca);
    return rodadas.filter((r) => {
      // Filtro de mês: a data vem como AAAA-MM-DD; comparamos o pedaço do mês.
      if (mes) {
        const mesDaRodada = r.data ? r.data.split("-")[1] : "";
        if (mesDaRodada !== mes) return false;
      }
      // Lupa: casa se o texto está no nome OU corresponde ao nº da rodada.
      if (q) {
        const nRodada = numeroDaRodada(r.comp);
        const bateNome = normalizar(r.nome).includes(q);
        const bateRodada = nRodada != null && String(nRodada).includes(q);
        if (!bateNome && !bateRodada) return false;
      }
      return true;
    });
  }, [rodadas, busca, mes]);

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(6,8,7,0.84)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 120 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 460, background: "#10160f", borderTop: `2px solid ${GOLD}`, borderRadius: "18px 18px 0 0", padding: "18px 16px 28px", maxHeight: "88%", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <h2 style={{ fontFamily: FD, fontSize: 17, fontWeight: 700, textTransform: "uppercase", margin: 0, color: "#f1ede2" }}>{t("gr.titulo")}</h2>
          <button onClick={onClose} aria-label={t("comum.fechar")} style={{ background: "transparent", border: "none", color: "#93a39a", fontSize: 20, cursor: "pointer" }}>✕</button>
        </div>

        {rodadas === null ? (
          <div style={{ textAlign: "center", padding: "30px 16px", color: "#7c8a82", fontFamily: FD, fontSize: 13, letterSpacing: "0.1em", textTransform: "uppercase" }}>{t("comum.carregando")}</div>
        ) : rodadas.length === 0 ? (
          <div style={{ textAlign: "center", padding: "30px 16px" }}>
            <div style={{ width: 72, height: 72, margin: "0 auto 8px" }}><Mascot belt="#efeadd" expression="feliz" /></div>
            <p style={{ fontSize: 13, color: "#c7d0c9", lineHeight: 1.5, margin: 0 }}>
              {t("gr.vazio")}
            </p>
          </div>
        ) : (
          <>
            {/* Barra de busca: lupa (nome ou nº da rodada) + seletor de mês. Só aparece
                quando há rodadas suficientes para valer a pena filtrar. */}
            {rodadas.length > 3 && (
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, background: "#141a17", border: "1px solid #243029", borderRadius: 11, padding: "0 11px" }}>
                  <span aria-hidden="true" style={{ color: "#5f6f67", fontSize: 14, flexShrink: 0 }}>🔍</span>
                  <input
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder={t("gr.buscaPh")}
                    style={{ flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none", color: "#f1ede2", fontFamily: FB, fontSize: 13, padding: "10px 0" }}
                  />
                  {busca && (
                    <button onClick={() => setBusca("")} aria-label={t("gr.limparBusca")} style={{ background: "transparent", border: "none", color: "#7c8a82", fontSize: 15, cursor: "pointer", flexShrink: 0, padding: 0 }}>✕</button>
                  )}
                </div>
                <select
                  value={mes}
                  onChange={(e) => setMes(e.target.value)}
                  aria-label={t("gr.filtrarMes")}
                  style={{ flexShrink: 0, background: "#141a17", border: "1px solid #243029", borderRadius: 11, color: mes ? "#f1ede2" : "#93a39a", fontFamily: FB, fontSize: 13, padding: "0 8px", outline: "none", cursor: "pointer", maxWidth: 116 }}
                >
                  <option value="">{t("gr.mes")}</option>
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i} value={String(i + 1).padStart(2, "0")}>{nomeMes(i + 1, true)}</option>
                  ))}
                </select>
              </div>
            )}

            {filtradas && filtradas.length === 0 ? (
              <div style={{ textAlign: "center", padding: "26px 16px" }}>
                <p style={{ fontSize: 13, color: "#93a39a", lineHeight: 1.5, margin: "0 0 12px" }}>
                  {t("gr.semResultados")}
                </p>
                <button onClick={() => { setBusca(""); setMes(""); }} style={{ background: "transparent", border: `1px solid ${GOLD}`, color: GOLD, fontFamily: FD, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", padding: "7px 14px", borderRadius: 9, cursor: "pointer" }}>
                  {t("gr.limparFiltros")}
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {(filtradas || []).map((r) => {
                  const negativo = r.pontos < 0;
                  const nRodada = numeroDaRodada(r.comp);
                  return (
                    <button key={r.comp} onClick={() => onAbrir(r.comp)} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", background: "#141a17", border: "1px solid #243029", borderRadius: 14, padding: "12px 13px", cursor: "pointer", fontFamily: FB, textAlign: "left" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {nRodada && <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: GOLD, marginBottom: 2 }}>{t("pl.rodadaN", { n: nRodada })}</div>}
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#f1ede2", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.nome}</div>
                        <div style={{ fontSize: 11, color: "#93a39a", marginTop: 2 }}>
                          {r.posicao && r.total_jogadores ? t("gr.posDe", { p: r.posicao, total: r.total_jogadores }) : "—"}
                          {r.data ? ` · ${r.data.split("-").reverse().join("/")}` : ""}
                          {r.ganho_patrimonio !== 0 ? ` · ${r.ganho_patrimonio >= 0 ? "+" : ""}${r.ganho_patrimonio} JC` : ""}
                        </div>
                      </div>
                      <div style={{ flexShrink: 0, background: negativo ? "#3a2422" : "#1d3a2b", color: negativo ? "#ef8d83" : "#9be3bd", fontFamily: FD, fontWeight: 700, fontSize: 14, padding: "5px 12px", borderRadius: 999 }}>
                        {r.pontos >= 0 ? "+" : ""}{r.pontos}
                      </div>
                      <span style={{ color: "#5f6f67", fontSize: 18, flexShrink: 0 }}>›</span>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
