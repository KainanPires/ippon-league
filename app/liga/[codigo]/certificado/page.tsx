"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Mascot } from "@/components/Mascot";
import { Escudo, DEFAULT_IDENTITY, type Identity } from "@/components/Escudo";

const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";

interface Posicao {
  user_id: string;
  nome_time: string;
  escudo: Identity | null;
  is_pro: boolean;
  pontos_total: number;
  rondas_jogadas: number;
  media: number;
}
interface PodioResp {
  ok: boolean;
  terminada: boolean;
  copa_estado?: string;
  liga?: { id: string; name: string };
  participantes?: number;
  dataFim?: string | null;
  podio?: { campeao: Posicao | null; vice: Posicao | null; terceiro: Posicao | null };
}

// Tema de cada posição do pódio.
const TEMAS = {
  1: { cor: "#d9a441", corSuave: "rgba(217,164,65,0.12)", medalha: "🥇", titulo: "Campeão", frase: "Campeão da Copa Ippon", grad: "linear-gradient(160deg,#2a2410,#15110a)" },
  2: { cor: "#c5ccd6", corSuave: "rgba(197,204,214,0.12)", medalha: "🥈", titulo: "Vice-campeão", frase: "Ficou em segundo lugar na Copa Ippon", grad: "linear-gradient(160deg,#20242a,#121418)" },
  3: { cor: "#cd8b5e", corSuave: "rgba(205,139,94,0.12)", medalha: "🥉", titulo: "3º lugar", frase: "Ficou em terceiro lugar na Copa Ippon", grad: "linear-gradient(160deg,#2a1d12,#160f08)" },
} as const;

function dataPt(iso: string | null | undefined): string {
  if (!iso) return "";
  const [a, m, d] = iso.split("/");
  const meses = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  const mi = parseInt(m, 10) - 1;
  if (isNaN(mi) || !meses[mi]) return iso;
  return `${parseInt(d, 10)} de ${meses[mi]} de ${a}`;
}

export default function Certificados() {
  const params = useParams();
  const codigo = String(params?.codigo || "");
  const [data, setData] = useState<PodioResp | null>(null);
  const [estado, setEstado] = useState<"carregar" | "pronto" | "erro" | "naoterminada">("carregar");

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const res = await fetch(`/api/copa/podio?codigo=${encodeURIComponent(codigo)}`);
        const j: PodioResp = await res.json();
        if (!vivo) return;
        if (!j || !j.ok) { setEstado("erro"); return; }
        if (!j.terminada) { setEstado("naoterminada"); return; }
        setData(j);
        setEstado("pronto");
      } catch {
        if (vivo) setEstado("erro");
      }
    })();
    return () => { vivo = false; };
  }, [codigo]);

  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: FB }}>
      <div style={{ maxWidth: 460, margin: "0 auto", padding: "14px 16px 48px" }}>
        <header style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 18 }}>
          <a href={`/liga/${codigo}/chave`} aria-label="Voltar à chave" style={{ width: 36, height: 36, borderRadius: "50%", border: "1px solid #243029", display: "flex", alignItems: "center", justifyContent: "center", color: "#cfd8d2", textDecoration: "none", flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
          </a>
          <h1 style={{ fontFamily: FD, fontSize: 18, fontWeight: 700, textTransform: "uppercase", margin: 0, flex: 1 }}>Certificados</h1>
        </header>

        {estado === "carregar" && (
          <div style={{ textAlign: "center", padding: "50px 16px", color: "#7c8a82", fontFamily: FD, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.1em" }}>A preparar os certificados…</div>
        )}

        {estado === "naoterminada" && (
          <div style={{ background: "#121815", border: "1px solid #243029", borderRadius: 16, padding: 22, textAlign: "center" }}>
            <div style={{ fontSize: 30, marginBottom: 8 }}>🏆</div>
            <div style={{ fontFamily: FD, fontSize: 15, fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>A copa ainda não terminou</div>
            <p style={{ fontSize: 13, color: "#c7d0c9", lineHeight: 1.5, margin: 0 }}>Os certificados do pódio aparecem aqui quando a final estiver decidida.</p>
          </div>
        )}

        {estado === "erro" && (
          <div style={{ background: "#121815", border: "1px solid #243029", borderRadius: 16, padding: 22, textAlign: "center", fontSize: 14, color: "#c7d0c9" }}>
            Não foi possível carregar os certificados. Volta à liga e tenta de novo.
          </div>
        )}

        {estado === "pronto" && data && data.podio && (
          <>
            {data.podio.campeao && (
              <Certificado pos={1} d={data.podio.campeao} liga={data.liga!.name} participantes={data.participantes!} dataFim={data.dataFim} />
            )}
            {data.podio.vice && (
              <Certificado pos={2} d={data.podio.vice} liga={data.liga!.name} participantes={data.participantes!} dataFim={data.dataFim} />
            )}
            {data.podio.terceiro && (
              <Certificado pos={3} d={data.podio.terceiro} liga={data.liga!.name} participantes={data.participantes!} dataFim={data.dataFim} />
            )}
          </>
        )}
      </div>
    </main>
  );
}

function Certificado({ pos, d, liga, participantes, dataFim }: { pos: 1 | 2 | 3; d: Posicao; liga: string; participantes: number; dataFim: string | null | undefined }) {
  const t = TEMAS[pos];
  const beltHex = pos === 1 ? "#efeadd" : pos === 2 ? "#c5ccd6" : "#cd8b5e";
  return (
    <div style={{ background: t.grad, border: `2px solid ${t.cor}`, borderRadius: 16, padding: "26px 20px", textAlign: "center", position: "relative", overflow: "hidden", marginBottom: 22 }}>
      {/* Cantos ornamentados */}
      <div style={{ position: "absolute", top: 9, left: 9, width: 24, height: 24, borderTop: `2px solid ${t.cor}`, borderLeft: `2px solid ${t.cor}`, borderRadius: "5px 0 0 0" }} />
      <div style={{ position: "absolute", top: 9, right: 9, width: 24, height: 24, borderTop: `2px solid ${t.cor}`, borderRight: `2px solid ${t.cor}`, borderRadius: "0 5px 0 0" }} />
      <div style={{ position: "absolute", bottom: 9, left: 9, width: 24, height: 24, borderBottom: `2px solid ${t.cor}`, borderLeft: `2px solid ${t.cor}`, borderRadius: "0 0 0 5px" }} />
      <div style={{ position: "absolute", bottom: 9, right: 9, width: 24, height: 24, borderBottom: `2px solid ${t.cor}`, borderRight: `2px solid ${t.cor}`, borderRadius: "0 0 5px 0" }} />

      {/* Mascote no canto superior esquerdo, feliz */}
      <div style={{ position: "absolute", top: 14, left: 16, width: 40, height: 40 }}>
        <Mascot belt={beltHex} expression="feliz" />
      </div>

      <div style={{ fontFamily: FD, fontSize: 10, letterSpacing: "0.18em", color: "#93a39a", textTransform: "uppercase", marginBottom: 4 }}>Ippon League</div>
      <div style={{ fontSize: 36, lineHeight: 1, margin: "8px 0 6px" }}>{t.medalha}</div>
      <div style={{ fontFamily: FD, fontSize: 12.5, letterSpacing: "0.1em", color: t.cor, textTransform: "uppercase", fontWeight: 700 }}>Certificado de {t.titulo}</div>

      <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${t.cor}, transparent)`, margin: "16px 0" }} />

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

      <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${t.cor}, transparent)`, margin: "18px 0 12px" }} />

      {dataFim && (
        <div style={{ fontFamily: FD, fontSize: 10.5, color: "#93a39a", letterSpacing: "0.05em" }}>Copa concluída a {dataPt(dataFim)}</div>
      )}
      <div style={{ fontFamily: FD, fontSize: 9.5, color: "#5f6f67", letterSpacing: "0.06em", marginTop: 5 }}>ipponleague.com</div>
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
