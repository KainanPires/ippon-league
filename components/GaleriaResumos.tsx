"use client";

import { useEffect, useState } from "react";
import { Mascot } from "@/components/Mascot";

const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";

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
  const [rodadas, setRodadas] = useState<RodadaGaleria[] | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/minhas-rodadas?user=${userId}`)
      .then((r) => r.json())
      .then((j) => { if (active) setRodadas(Array.isArray(j?.rodadas) ? j.rodadas : []); })
      .catch(() => { if (active) setRodadas([]); });
    return () => { active = false; };
  }, [userId]);

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(6,8,7,0.84)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 120 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 460, background: "#10160f", borderTop: `2px solid ${GOLD}`, borderRadius: "18px 18px 0 0", padding: "18px 16px 28px", maxHeight: "88%", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <h2 style={{ fontFamily: FD, fontSize: 17, fontWeight: 700, textTransform: "uppercase", margin: 0, color: "#f1ede2" }}>Os meus resumos</h2>
          <button onClick={onClose} aria-label="Fechar" style={{ background: "transparent", border: "none", color: "#93a39a", fontSize: 20, cursor: "pointer" }}>✕</button>
        </div>

        {rodadas === null ? (
          <div style={{ textAlign: "center", padding: "30px 16px", color: "#7c8a82", fontFamily: FD, fontSize: 13, letterSpacing: "0.1em", textTransform: "uppercase" }}>A carregar…</div>
        ) : rodadas.length === 0 ? (
          <div style={{ textAlign: "center", padding: "30px 16px" }}>
            <div style={{ width: 72, height: 72, margin: "0 auto 8px" }}><Mascot belt="#efeadd" expression="feliz" /></div>
            <p style={{ fontSize: 13, color: "#c7d0c9", lineHeight: 1.5, margin: 0 }}>
              Ainda não tens rodadas jogadas. Quando uma competição terminar, o resumo aparece aqui — guardado para sempre.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {rodadas.map((r) => {
              const negativo = r.pontos < 0;
              return (
                <button key={r.comp} onClick={() => onAbrir(r.comp)} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", background: "#141a17", border: "1px solid #243029", borderRadius: 14, padding: "12px 13px", cursor: "pointer", fontFamily: FB, textAlign: "left" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#f1ede2", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.nome}</div>
                    <div style={{ fontSize: 11, color: "#93a39a", marginTop: 2 }}>
                      {r.posicao && r.total_jogadores ? `${r.posicao}º de ${r.total_jogadores}` : "—"}
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
      </div>
    </div>
  );
}
