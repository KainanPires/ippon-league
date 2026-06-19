"use client";

// /chave — Chave dos atletas (Pro Max), 1ª versão.
// Lê o quadro REAL do JudoBase via /api/chave e desenha-o agrupado em 4 zonas,
// mais meias, final e os blocos de repescagem/bronze. Atualiza ao vivo: há um
// botão "Atualizar" e recarrega sozinho a cada 60s enquanto a página está aberta.
//
// Teste: categoria fixa -48 F do Ulaanbaatar (comp 3149). Aberta a todos por
// agora; o fecho ao Pro Max entra depois de validarmos contra a realidade.

import { useState, useEffect, useCallback } from "react";

const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";

// Competição e categoria do teste (fixas nesta 1ª versão).
const COMP = "3149";
const CAT = "-48";

interface Lado { id: string; nome: string; pais: string; vencedor: boolean }
interface Luta {
  id: string; fase: string; round: number; zona: number; ordem: number;
  azul: Lado; branco: Lado; decidida: boolean;
}
interface Zona { zona: number; lutas: Luta[] }
interface ChaveResp {
  ok: boolean; comp: string; categoria: string; nome_competicao: string;
  zonas: Zona[]; meias: Luta[]; final: Luta | null; bronzes: Luta[];
  vazio?: boolean; atualizado_em: string; erro?: string;
}

// Nome curto: "BOUKLI Shirine" -> "BOUKLI". Mantém legível em cartões estreitos.
function apelido(nome: string): string {
  const t = (nome || "").trim();
  if (!t || t === "—") return "—";
  // No JudoBase o apelido vem em MAIÚSCULAS primeiro; ficamos com a parte em
  // maiúsculas se a houver, senão a primeira palavra.
  const maiusc = t.split(/\s+/).filter((w) => w.length > 1 && w === w.toUpperCase());
  return (maiusc[0] || t.split(/\s+/)[0] || t);
}

export default function ChavePage() {
  const [dados, setDados] = useState<ChaveResp | null>(null);
  const [aCarregar, setACarregar] = useState(true);
  const [erro, setErro] = useState("");
  const [quando, setQuando] = useState<string>("");

  const carregar = useCallback(async () => {
    try {
      const r = await fetch(`/api/chave?comp=${COMP}&cat=${encodeURIComponent(CAT)}`, { cache: "no-store" });
      const j: ChaveResp = await r.json();
      if (!j.ok) { setErro(j.erro || "Não foi possível carregar a chave."); setACarregar(false); return; }
      setDados(j);
      setErro("");
      setQuando(new Date().toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" }));
    } catch {
      setErro("Falha de ligação ao carregar a chave.");
    }
    setACarregar(false);
  }, []);

  useEffect(() => {
    carregar();
    const t = setInterval(carregar, 60000); // atualiza ao vivo a cada 60s
    return () => clearInterval(t);
  }, [carregar]);

  // Separa os blocos de bronze pela ronda: round 1 = repescagem (acesso ao
  // bronze), round 0 = bronze decisivo. (A confirmar contra a realidade: nalgumas
  // categorias o formato pode diferir.)
  const repescagem = (dados?.bronzes || []).filter((l) => l.round === 1);
  const bronzeFinal = (dados?.bronzes || []).filter((l) => l.round === 0);

  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: FB }}>
      <style>{`
        @keyframes ilpulse{0%,100%{opacity:1}50%{opacity:.35}}
        .ilpulse{animation:ilpulse 1.2s ease-in-out infinite}
        .chave-scroll::-webkit-scrollbar{height:8px}
        .chave-scroll::-webkit-scrollbar-thumb{background:#243029;border-radius:8px}
      `}</style>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "16px 14px 60px" }}>
        {/* Cabeçalho */}
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <a href="/inicio" aria-label="Voltar" style={{ width: 34, height: 34, borderRadius: "50%", border: "1px solid #243029", display: "flex", alignItems: "center", justifyContent: "center", color: "#cfd8d2", textDecoration: "none", flexShrink: 0 }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
            </a>
            <div>
              <h1 style={{ fontFamily: FD, fontSize: 19, fontWeight: 700, textTransform: "uppercase", margin: 0, lineHeight: 1.05 }}>Chave da competição</h1>
              <div style={{ fontSize: 12, color: "#93a39a", marginTop: 1 }}>
                {dados?.nome_competicao || "Ulaanbaatar Grand Slam"} · -48 kg feminino
              </div>
            </div>
          </div>
          <button onClick={() => { setACarregar(true); carregar(); }} style={{ background: "#141a17", border: `1px solid ${GOLD}`, color: GOLD, fontFamily: FD, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", padding: "8px 13px", borderRadius: 9, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
            Atualizar
          </button>
        </header>

        {/* Selo ao vivo + hora da última atualização */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "10px 0 18px" }}>
          <span className="ilpulse" style={{ width: 8, height: 8, borderRadius: "50%", background: "#e2655a" }} />
          <span style={{ fontFamily: FD, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#e2655a" }}>Ao vivo</span>
          {quando && <span style={{ fontSize: 11, color: "#7c8a82" }}>· atualizado às {quando}</span>}
        </div>

        {aCarregar && !dados ? (
          <Estado texto="A carregar a chave…" />
        ) : erro ? (
          <Estado texto={erro} />
        ) : dados?.vazio ? (
          <Estado texto="Ainda não há lutas registadas nesta categoria. Volta quando a competição começar." />
        ) : (
          <>
            {/* As 4 zonas, lado a lado (scroll horizontal no telemóvel) */}
            <SecTitulo>As quatro zonas</SecTitulo>
            <div className="chave-scroll" style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8, marginBottom: 22 }}>
              {(dados?.zonas || []).map((z) => (
                <div key={z.zona} style={{ flex: "1 0 240px", minWidth: 240, background: "#0f1411", border: "1px solid #1a221d", borderRadius: 14, padding: 12 }}>
                  <div style={{ fontFamily: FD, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: GOLD, marginBottom: 10 }}>
                    Zona {z.zona}
                  </div>
                  {z.lutas.length === 0 ? (
                    <div style={{ fontSize: 12, color: "#5f6f67", padding: "8px 0" }}>Sem lutas ainda.</div>
                  ) : (
                    z.lutas.map((l) => <CartaoLuta key={l.id} luta={l} etiqueta={l.fase} />)
                  )}
                </div>
              ))}
            </div>

            {/* Meias + Final */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 18, marginBottom: 22 }}>
              <div>
                <SecTitulo>Meias-finais</SecTitulo>
                {(dados?.meias || []).length === 0 ? (
                  <Vazio texto="As meias-finais aparecem quando as zonas estiverem decididas." />
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10 }}>
                    {dados!.meias.map((l) => <CartaoLuta key={l.id} luta={l} />)}
                  </div>
                )}
              </div>

              <div>
                <SecTitulo>Final</SecTitulo>
                {dados?.final ? (
                  <div style={{ maxWidth: 360 }}>
                    <CartaoLuta luta={dados.final} dourado />
                  </div>
                ) : (
                  <Vazio texto="A final aparece quando as meias estiverem decididas." />
                )}
              </div>
            </div>

            {/* Repescagem + Bronze */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 18 }}>
              <div>
                <SecTitulo>Repescagem</SecTitulo>
                {repescagem.length === 0 ? (
                  <Vazio texto="Sem combates de repescagem ainda." />
                ) : (
                  repescagem.map((l) => <CartaoLuta key={l.id} luta={l} />)
                )}
              </div>
              <div>
                <SecTitulo>Bronze</SecTitulo>
                {bronzeFinal.length === 0 ? (
                  <Vazio texto="Os bronzes aparecem no fim do dia da categoria." />
                ) : (
                  bronzeFinal.map((l) => <CartaoLuta key={l.id} luta={l} bronze />)
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function SecTitulo({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: FD, fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#cfd8d2", margin: "0 0 10px" }}>
      {children}
    </div>
  );
}

function Estado({ texto }: { texto: string }) {
  return (
    <div style={{ textAlign: "center", padding: "48px 18px", color: "#7c8a82", fontFamily: FD, fontSize: 13, letterSpacing: "0.04em", lineHeight: 1.6 }}>
      {texto}
    </div>
  );
}

function Vazio({ texto }: { texto: string }) {
  return (
    <div style={{ background: "#0f1411", border: "1px dashed #2a3a33", borderRadius: 12, padding: "14px 14px", fontSize: 12.5, color: "#7c8a82", lineHeight: 1.5 }}>
      {texto}
    </div>
  );
}

// Cartão de uma luta: dois lados, vencedor a dourado/destacado.
function CartaoLuta({ luta, etiqueta, dourado, bronze }: { luta: Luta; etiqueta?: string; dourado?: boolean; bronze?: boolean }) {
  const borda = dourado ? GOLD : bronze ? "#9a6b3a" : "#243029";
  return (
    <div style={{ background: "#121815", border: `1px solid ${borda}`, borderRadius: 12, padding: "8px 10px", marginBottom: 8 }}>
      {etiqueta && (
        <div style={{ fontSize: 9.5, color: "#5f6f67", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>{etiqueta}</div>
      )}
      <LinhaLado lado={luta.azul} />
      <div style={{ height: 1, background: "#1a221d", margin: "5px 0" }} />
      <LinhaLado lado={luta.branco} />
    </div>
  );
}

function LinhaLado({ lado }: { lado: Lado }) {
  const venceu = lado.vencedor;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontFamily: FD, fontSize: 10, fontWeight: 700, color: venceu ? GOLD : "#7c8a82", width: 30, flexShrink: 0, letterSpacing: "0.04em" }}>
        {lado.pais}
      </span>
      <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: venceu ? 700 : 400, color: venceu ? "#f1ede2" : "#a9b4ac", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {apelido(lado.nome)}
      </span>
      {venceu && (
        <span aria-label="venceu" style={{ color: GOLD, fontSize: 13, flexShrink: 0 }}>✓</span>
      )}
    </div>
  );
}
