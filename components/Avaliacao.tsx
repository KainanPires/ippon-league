"use client";

import { useState, useEffect } from "react";
import { Mascot } from "@/components/Mascot";
import { supabase } from "@/lib/supabase";

const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";

// Chaves de controlo (localStorage).
const K_ULTIMA = "ippon_aval_ultima";  // data (ISO) da última vez que o popup apareceu
const K_VOTOU = "ippon_aval_votou";     // "1" assim que a pessoa dá estrelas (alguma vez)

const SEMANA_MS = 7 * 24 * 3600 * 1000;
const QUATRO_MESES_MS = 120 * 24 * 3600 * 1000; // ~4 meses

/**
 * Decide se o pedido de avaliação deve aparecer AGORA (ao salvar o time).
 * - Quem ainda NÃO votou: aparece no máximo 1x por semana.
 * - Quem JÁ votou: só volta 4 meses depois (para não ser massivo).
 * Chamar isto no momento de salvar; se devolver true, abrir o <Avaliacao/>.
 */
export function devePedirAvaliacao(): boolean {
  try {
    const votou = localStorage.getItem(K_VOTOU) === "1";
    const ultimaRaw = localStorage.getItem(K_ULTIMA);
    const ultima = ultimaRaw ? new Date(ultimaRaw).getTime() : 0;
    const agora = Date.now();
    const intervalo = votou ? QUATRO_MESES_MS : SEMANA_MS;
    return agora - ultima >= intervalo;
  } catch {
    return false;
  }
}

// Marca que o popup apareceu agora (reinicia o contador de frequência).
function marcarApareceu() {
  try { localStorage.setItem(K_ULTIMA, new Date().toISOString()); } catch {}
}

type Fase = "estrelas" | "comentario" | "fim";

export function Avaliacao({ nomeTime, onClose }: { nomeTime?: string; onClose: () => void }) {
  const [fase, setFase] = useState<Fase>("estrelas");
  const [estrelas, setEstrelas] = useState(0);
  const [hover, setHover] = useState(0);
  const [comentario, setComentario] = useState("");
  const [enviando, setEnviando] = useState(false);

  // Regista que o popup foi mostrado (conta para a frequência), uma vez ao abrir.
  useEffect(() => { marcarApareceu(); }, []);

  async function guardar(estrelasFinais: number, texto: string | null) {
    try {
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user?.id;
      if (!uid) return;
      await fetch("/api/avaliar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: uid,
          nome_time: nomeTime ?? null,
          estrelas: estrelasFinais,
          comentario: texto,
          contexto: "salvar_time",
        }),
      });
    } catch {
      // se falhar a gravação, não bloqueia o utilizador
    }
  }

  // Submit das estrelas: guarda já o voto (estrelas é o que conta) e marca "votou".
  async function submeterEstrelas() {
    if (estrelas < 1) return;
    try { localStorage.setItem(K_VOTOU, "1"); } catch {}
    setEnviando(true);
    await guardar(estrelas, null);
    setEnviando(false);
    setFase("comentario");
  }

  // Enviar o comentário (extra): atualiza a avaliação com o texto.
  async function enviarComentario() {
    setEnviando(true);
    if (comentario.trim()) await guardar(estrelas, comentario.trim());
    setEnviando(false);
    setFase("fim");
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(6,8,7,0.82)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18, zIndex: 130 }}>
      <div style={{ width: "100%", maxWidth: 330, background: "#121815", border: `1px solid ${GOLD}`, borderRadius: 18, padding: 22, textAlign: "center" }}>
        <div style={{ width: 76, height: 76, margin: "0 auto 6px" }}>
          <Mascot belt="#141110" expression={fase === "fim" ? "comemorando" : "feliz"} />
        </div>

        {fase === "estrelas" && (
          <>
            <h2 style={{ fontFamily: FD, fontSize: 19, fontWeight: 700, textTransform: "uppercase", margin: "4px 0 6px" }}>Estás a gostar?</h2>
            <p style={{ fontSize: 13.5, color: "#c7d0c9", lineHeight: 1.5, margin: "0 0 16px" }}>Dá a tua avaliação à Ippon League. Ajuda-nos a melhorar o jogo para ti.</p>
            <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 20 }}>
              {[1, 2, 3, 4, 5].map((n) => {
                const ativa = (hover || estrelas) >= n;
                return (
                  <button
                    key={n}
                    onClick={() => setEstrelas(n)}
                    onMouseEnter={() => setHover(n)}
                    onMouseLeave={() => setHover(0)}
                    aria-label={`${n} estrela${n > 1 ? "s" : ""}`}
                    style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 34, lineHeight: 1, color: ativa ? GOLD : "#3c463f", padding: 0, transition: "color 0.1s" }}
                  >
                    ★
                  </button>
                );
              })}
            </div>
            <button
              onClick={submeterEstrelas}
              disabled={estrelas < 1 || enviando}
              style={{
                width: "100%", padding: 13, borderRadius: 12, border: "none",
                background: estrelas < 1 ? "#23291f" : GOLD,
                color: estrelas < 1 ? "#5f6f67" : "#1b211e",
                fontFamily: FD, fontSize: 15, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em",
                cursor: estrelas < 1 ? "default" : "pointer",
              }}
            >
              {enviando ? "A enviar…" : "Enviar"}
            </button>
            <button onClick={onClose} style={{ marginTop: 10, background: "transparent", border: "none", color: "#93a39a", fontSize: 13, cursor: "pointer", fontFamily: FB }}>Agora não</button>
          </>
        )}

        {fase === "comentario" && (
          <>
            <h2 style={{ fontFamily: FD, fontSize: 18, fontWeight: 700, textTransform: "uppercase", margin: "4px 0 6px", color: GOLD }}>Obrigado pela tua avaliação!</h2>
            <p style={{ fontSize: 13.5, color: "#c7d0c9", lineHeight: 1.5, margin: "0 0 14px" }}>Queres contar-nos o que mais gostaste ou o que podemos melhorar? (opcional)</p>
            <textarea
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              placeholder="A tua experiência ou sugestão…"
              rows={4}
              style={{ width: "100%", boxSizing: "border-box", background: "#0f1411", border: "1px solid #243029", borderRadius: 12, padding: 12, color: "#f1ede2", fontSize: 14, fontFamily: FB, resize: "none", outline: "none", marginBottom: 16 }}
            />
            <button
              onClick={enviarComentario}
              disabled={enviando}
              style={{ width: "100%", padding: 13, borderRadius: 12, border: "none", background: GOLD, color: "#1b211e", fontFamily: FD, fontSize: 15, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", cursor: "pointer" }}
            >
              {enviando ? "A enviar…" : comentario.trim() ? "Enviar" : "Saltar"}
            </button>
          </>
        )}

        {fase === "fim" && (
          <>
            <h2 style={{ fontFamily: FD, fontSize: 19, fontWeight: 700, textTransform: "uppercase", margin: "4px 0 6px", color: GOLD }}>Recebido!</h2>
            <p style={{ fontSize: 13.5, color: "#c7d0c9", lineHeight: 1.5, margin: "0 0 18px" }}>A tua opinião conta muito para nós. Bom jogo na próxima rodada!</p>
            <button
              onClick={onClose}
              style={{ width: "100%", padding: 13, borderRadius: 12, border: "none", background: GOLD, color: "#1b211e", fontFamily: FD, fontSize: 15, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", cursor: "pointer" }}
            >
              Fechar
            </button>
          </>
        )}
      </div>
    </div>
  );
}
