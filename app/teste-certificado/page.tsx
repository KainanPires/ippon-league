"use client";

// PÁGINA DE TESTE TEMPORÁRIA — /teste-certificado
// Mostra os 3 certificados com dados FIXOS de exemplo, para confirmar o visual
// e testar o download como imagem (snapdom). APAGAR esta página depois do teste.

import { useState, useRef } from "react";
import { snapdom } from "@zumer/snapdom";
import { Mascot } from "@/components/Mascot";
import { Escudo, DEFAULT_IDENTITY, type Identity } from "@/components/Escudo";

const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";

interface Posicao {
  nome_time: string;
  escudo: Identity | null;
  is_pro: boolean;
  pontos_total: number;
  rondas_jogadas: number;
  media: number;
}

const TEMAS = {
  1: { cor: "#d9a441", medalha: "🥇", titulo: "Campeão", frase: "Campeão da Copa Ippon", grad: "linear-gradient(160deg,#2a2410,#15110a)" },
  2: { cor: "#c5ccd6", medalha: "🥈", titulo: "Vice-campeão", frase: "Ficou em segundo lugar na Copa Ippon", grad: "linear-gradient(160deg,#20242a,#121418)" },
  3: { cor: "#cd8b5e", medalha: "🥉", titulo: "3º lugar", frase: "Ficou em terceiro lugar na Copa Ippon", grad: "linear-gradient(160deg,#2a1d12,#160f08)" },
} as const;

// Dados de exemplo (campeão Pro; vice e 3º não-Pro, para testares o selo).
const EXEMPLO: Record<1 | 2 | 3, Posicao> = {
  1: { nome_time: "Relâmpago FC", escudo: null, is_pro: true, pontos_total: 214, rondas_jogadas: 4, media: 53.5 },
  2: { nome_time: "Dragões de Aço", escudo: null, is_pro: false, pontos_total: 188, rondas_jogadas: 4, media: 47 },
  3: { nome_time: "Samurais do Norte", escudo: null, is_pro: false, pontos_total: 165, rondas_jogadas: 3, media: 55 },
};

function dataPt(iso: string): string {
  const [a, m, d] = iso.split("/");
  const meses = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  return `${parseInt(d, 10)} de ${meses[parseInt(m, 10) - 1]} de ${a}`;
}

export default function TesteCertificado() {
  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: FB }}>
      <div style={{ maxWidth: 460, margin: "0 auto", padding: "20px 16px 48px" }}>
        <h1 style={{ fontFamily: FD, fontSize: 16, fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>Teste de Certificados</h1>
        <p style={{ fontSize: 12.5, color: "#93a39a", marginBottom: 22 }}>Página temporária com dados de exemplo. Testa o visual e o botão de descarregar. Apagar depois.</p>
        <Certificado pos={1} d={EXEMPLO[1]} liga="Vamos de Mata a Mata" participantes={8} dataFim="2026/06/13" />
        <Certificado pos={2} d={EXEMPLO[2]} liga="Vamos de Mata a Mata" participantes={8} dataFim="2026/06/13" />
        <Certificado pos={3} d={EXEMPLO[3]} liga="Vamos de Mata a Mata" participantes={8} dataFim="2026/06/13" />
      </div>
    </main>
  );
}

function Certificado({ pos, d, liga, participantes, dataFim }: { pos: 1 | 2 | 3; d: Posicao; liga: string; participantes: number; dataFim: string }) {
  const t = TEMAS[pos];
  const beltHex = pos === 1 ? "#efeadd" : pos === 2 ? "#c5ccd6" : "#cd8b5e";
  const cartaoRef = useRef<HTMLDivElement>(null);
  const [aGerar, setAGerar] = useState(false);

  async function descarregar() {
    if (!cartaoRef.current || aGerar) return;
    setAGerar(true);
    try {
      const img = await snapdom.toPng(cartaoRef.current, { scale: 2, embedFonts: true, backgroundColor: "#0c0e0d" });
      const nomeFicheiro = `certificado-${t.titulo.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-ippon-league.png`;
      const a = document.createElement("a");
      a.href = img.src;
      a.download = nomeFicheiro;
      a.click();
    } catch {
      /* tenta de novo */
    } finally {
      setAGerar(false);
    }
  }

  return (
    <div style={{ marginBottom: 22 }}>
      <div ref={cartaoRef} style={{ background: t.grad, border: `2px solid ${t.cor}`, borderRadius: 16, padding: "26px 20px", textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 9, left: 9, width: 24, height: 24, borderTop: `2px solid ${t.cor}`, borderLeft: `2px solid ${t.cor}`, borderRadius: "5px 0 0 0" }} />
        <div style={{ position: "absolute", top: 9, right: 9, width: 24, height: 24, borderTop: `2px solid ${t.cor}`, borderRight: `2px solid ${t.cor}`, borderRadius: "0 5px 0 0" }} />
        <div style={{ position: "absolute", bottom: 9, left: 9, width: 24, height: 24, borderBottom: `2px solid ${t.cor}`, borderLeft: `2px solid ${t.cor}`, borderRadius: "0 0 0 5px" }} />
        <div style={{ position: "absolute", bottom: 9, right: 9, width: 24, height: 24, borderBottom: `2px solid ${t.cor}`, borderRight: `2px solid ${t.cor}`, borderRadius: "0 0 5px 0" }} />

        <div style={{ position: "absolute", top: 14, left: 16, width: 40, height: 40 }}>
          <Mascot belt={beltHex} expression="feliz" />
        </div>

        <div style={{ fontFamily: FD, fontSize: 10, letterSpacing: "0.18em", color: "#93a39a", textTransform: "uppercase", marginBottom: 4 }}>Ippon League</div>
        <div style={{ fontSize: 36, lineHeight: 1, margin: "8px 0 6px" }}>{t.medalha}</div>
        <div style={{ fontFamily: FD, fontSize: 15, letterSpacing: "0.08em", color: t.cor, textTransform: "uppercase", fontWeight: 700, textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}>Certificado de {t.titulo}</div>

        <div style={{ height: 2, background: t.cor, opacity: 0.55, borderRadius: 2, margin: "16px auto", width: "70%" }} />

        <div style={{ fontSize: 11, color: "#93a39a", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 11, lineHeight: 1.4 }}>{t.frase}<br /><span style={{ color: "#cfd8d2", fontWeight: 700 }}>{liga}</span></div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
          <div style={{ flexShrink: 0 }}><Escudo config={d.escudo || DEFAULT_IDENTITY} size={50} /></div>
          <div style={{ textAlign: "left" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <div style={{ fontSize: 21, fontWeight: 700, color: "#f1ede2", lineHeight: 1.1 }}>{d.nome_time}</div>
              {d.is_pro && <span style={{ background: t.cor, color: "#1b211e", fontFamily: FD, fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, letterSpacing: "0.04em" }}>PRO</span>}
            </div>
          </div>
        </div>

        <div style={{ height: 1, background: "#243029", margin: "18px 0 14px" }} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9, textAlign: "left" }}>
          <CampoCert label="Participantes" valor={`${participantes} equipas`} />
          <CampoCert label="Rondas jogadas" valor={`${d.rondas_jogadas}`} />
          <CampoCert label="Pontos na copa" valor={`${d.pontos_total}`} cor={t.cor} grande />
          <CampoCert label="Média por rodada" valor={`${d.media}`} grande />
        </div>

        <div style={{ height: 2, background: t.cor, opacity: 0.55, borderRadius: 2, margin: "18px auto 12px", width: "70%" }} />

        <div style={{ fontFamily: FD, fontSize: 10.5, color: "#93a39a", letterSpacing: "0.05em" }}>Copa concluída a {dataPt(dataFim)}</div>
        <div style={{ fontFamily: FD, fontSize: 9.5, color: "#5f6f67", letterSpacing: "0.06em", marginTop: 5 }}>ipponleague.com</div>
      </div>

      <button onClick={descarregar} disabled={aGerar} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", marginTop: 10, background: "transparent", border: `1px solid ${t.cor}`, color: t.cor, fontFamily: FD, fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", padding: "11px", borderRadius: 11, cursor: aGerar ? "default" : "pointer", opacity: aGerar ? 0.7 : 1 }}>
        {aGerar ? "A gerar imagem…" : "↓ Descarregar certificado"}
      </button>
    </div>
  );
}

function CampoCert({ label, valor, cor, grande }: { label: string; valor: string; cor?: string; grande?: boolean }) {
  return (
    <div style={{ background: "#121815", border: `1px solid ${cor ? cor : "#243029"}`, borderRadius: 10, padding: "9px 11px" }}>
      <div style={{ fontSize: 9.5, color: "#93a39a", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
      <div style={{ fontSize: grande ? 18 : 13, fontWeight: 700, color: cor ? cor : "#f1ede2", marginTop: 2 }}>
        {valor}{grande && <span style={{ fontSize: 11, color: "#93a39a", fontWeight: 400 }}> pts</span>}
      </div>
    </div>
  );
}
