"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Escudo, DEFAULT_IDENTITY, type Identity } from "@/components/Escudo";
import { competicaoPorId } from "@/lib/copa";

const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";

// Um confronto como vem da rota /api/copa/chave.
interface Confronto {
  id: string;
  ronda: number;
  ordem: number;
  fase: "normal" | "final" | "bronze";
  jogador_a: string | null;
  jogador_b: string | null;
  id_competicao: string | null;
  pontos_a: number | null;
  pontos_b: number | null;
  vencedor: string | null;
  decidido_por: string | null;
  estado: "pendente" | "decidido";
}
interface Identidade { user_id: string; nome_time: string; escudo: Identity | null }
interface ChaveResp {
  liga: { id: string; name: string; escudo: Identity | null; copa_estado: string };
  confrontos: Confronto[];
  identidades: Record<string, Identidade>;
  nInscritos: number;
  totalRondas: number;
  podio: { campeao?: string; vice?: string; terceiro?: string };
}

// Nome de uma ronda conforme quantas faltam até à final.
// ronda atual `r`, total `tot`: a última é Final, a penúltima Semifinais, etc.
function nomeRonda(r: number, tot: number): string {
  const desdeOfim = tot - r; // 0 = final, 1 = meias, 2 = quartos...
  if (desdeOfim === 0) return "Final";
  if (desdeOfim === 1) return "Semifinais";
  if (desdeOfim === 2) return "Quartos de final";
  if (desdeOfim === 3) return "Oitavos de final";
  return `${r}ª Ronda`;
}

function comoFoiDecidido(d: string | null): string {
  if (d === "pontos") return "Decidido pelos pontos da rodada";
  if (d === "capitao") return "Empate na rodada — decidido pelo capitão";
  if (d === "sorteio") return "Empate total — decidido por sorteio";
  if (d === "bye") return "Passou automaticamente (bye)";
  return "";
}

export default function ChaveCopa() {
  const params = useParams();
  const codigo = String(params?.codigo || "");
  const [data, setData] = useState<ChaveResp | null>(null);
  const [estado, setEstado] = useState<"carregar" | "pronto" | "erro" | "vazia">("carregar");
  const [detalhe, setDetalhe] = useState<Confronto | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        // A rota da chave aceita o código da liga diretamente e resolve o resto.
        const res = await fetch(`/api/copa/chave?codigo=${encodeURIComponent(codigo)}`);
        const j: ChaveResp = await res.json();
        if (!vivo) return;
        if (!j || !j.liga) { setEstado("erro"); return; }
        setData(j);
        setEstado(j.confrontos.length === 0 ? "vazia" : "pronto");
      } catch {
        if (vivo) setEstado("erro");
      }
    })();
    return () => { vivo = false; };
  }, [codigo]);

  const idn = (uid: string | null): Identidade | null => {
    if (!uid || !data) return null;
    return data.identidades[uid] || { user_id: uid, nome_time: "Equipa", escudo: null };
  };

  // Agrupa confrontos por ronda.
  const porRonda: Record<number, Confronto[]> = {};
  if (data) for (const c of data.confrontos) (porRonda[c.ronda] ||= []).push(c);
  const rondasComDados = Object.keys(porRonda).map(Number).sort((a, b) => a - b);
  const ultimaRondaComDados = rondasComDados.length ? Math.max(...rondasComDados) : 0;
  const totalRondas = data?.totalRondas || ultimaRondaComDados;

  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: FB }}>
      <div style={{ maxWidth: 460, margin: "0 auto", padding: "14px 16px 48px" }}>
        <header style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 16 }}>
          <a href={`/liga/${codigo}`} aria-label="Voltar à liga" style={{ width: 36, height: 36, borderRadius: "50%", border: "1px solid #243029", display: "flex", alignItems: "center", justifyContent: "center", color: "#cfd8d2", textDecoration: "none", flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
          </a>
          <h1 style={{ fontFamily: FD, fontSize: 18, fontWeight: 700, textTransform: "uppercase", margin: 0, flex: 1 }}>Chave da Copa</h1>
        </header>

        {estado === "carregar" && (
          <div style={{ textAlign: "center", padding: "50px 16px", color: "#7c8a82", fontFamily: FD, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.1em" }}>A carregar a chave…</div>
        )}

        {estado === "erro" && (
          <div style={{ background: "#121815", border: "1px solid #243029", borderRadius: 16, padding: 22, textAlign: "center", fontSize: 14, color: "#c7d0c9" }}>
            Não foi possível abrir a chave. Volta à liga e tenta de novo.
          </div>
        )}

        {estado === "vazia" && (
          <div style={{ background: "#121815", border: "1px solid #243029", borderRadius: 16, padding: 22, textAlign: "center" }}>
            <div style={{ fontSize: 30, marginBottom: 8 }}>🥋</div>
            <div style={{ fontFamily: FD, fontSize: 15, fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>A chave ainda não foi sorteada</div>
            <p style={{ fontSize: 13, color: "#c7d0c9", lineHeight: 1.5, margin: 0 }}>Quando as inscrições fecharem, o sorteio acontece e os confrontos aparecem aqui.</p>
          </div>
        )}

        {estado === "pronto" && data && (
          <>
            {/* Pódio (quando terminada) */}
            {data.liga.copa_estado === "terminada" && (
              <Podio data={data} idn={idn} />
            )}

            {/* Rondas empilhadas (com dados) */}
            {rondasComDados.map((r) => (
              <section key={r} style={{ marginBottom: 18 }}>
                <RondaTitulo nome={nomeRonda(r, totalRondas)} comp={porRonda[r][0]?.id_competicao} />
                <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                  {porRonda[r].map((c) => (
                    <ConfrontoCard key={c.id} c={c} idn={idn} onClick={() => c.estado === "decidido" && c.jogador_b ? setDetalhe(c) : undefined} />
                  ))}
                </div>
              </section>
            ))}

            {/* Rondas futuras "a aguardar" (estrutura prevista, ainda sem dados) */}
            {Array.from({ length: Math.max(0, totalRondas - ultimaRondaComDados) }).map((_, i) => {
              const r = ultimaRondaComDados + i + 1;
              return (
                <section key={`f${r}`} style={{ marginBottom: 18, opacity: 0.5 }}>
                  <RondaTitulo nome={nomeRonda(r, totalRondas)} comp={null} />
                  <div style={{ background: "#10140f", border: "1px dashed #243029", borderRadius: 12, padding: "16px", textAlign: "center", fontSize: 12.5, color: "#7c8a82", fontFamily: FD, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    A aguardar os apurados
                  </div>
                </section>
              );
            })}
          </>
        )}
      </div>

      {/* Detalhe do confronto */}
      {detalhe && (
        <DetalheConfronto c={detalhe} idn={idn} onClose={() => setDetalhe(null)} />
      )}
    </main>
  );
}

function RondaTitulo({ nome, comp }: { nome: string; comp: string | null | undefined }) {
  const nomeComp = comp ? competicaoPorId(comp)?.nome : null;
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 9 }}>
      <span style={{ fontFamily: FD, fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: GOLD }}>{nome}</span>
      {nomeComp && <span style={{ fontSize: 10.5, color: "#7c8a82", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "60%" }}>{nomeComp}</span>}
    </div>
  );
}

function ConfrontoCard({ c, idn, onClick }: { c: Confronto; idn: (u: string | null) => Identidade | null; onClick?: () => void }) {
  const a = idn(c.jogador_a);
  const b = idn(c.jogador_b);
  const bye = !c.jogador_b;
  const clicavel = c.estado === "decidido" && !bye;
  const fase = c.fase === "final" ? "🏆 Final" : c.fase === "bronze" ? "🥉 Disputa de 3º" : null;

  return (
    <button
      onClick={onClick}
      disabled={!clicavel}
      style={{ display: "block", width: "100%", textAlign: "left", background: "#121815", border: `1px solid ${c.fase === "final" ? GOLD : "#243029"}`, borderRadius: 12, padding: "10px 12px", cursor: clicavel ? "pointer" : "default", fontFamily: FB }}
    >
      {fase && <div style={{ fontSize: 10, fontWeight: 700, color: c.fase === "final" ? GOLD : "#cb9a5a", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 7 }}>{fase}</div>}
      <LinhaJogador ident={a} pontos={c.pontos_a} venceu={c.vencedor === c.jogador_a} decidido={c.estado === "decidido"} />
      {bye ? (
        <div style={{ fontSize: 11, color: "#7c8a82", padding: "6px 0 2px", fontFamily: FD, textTransform: "uppercase", letterSpacing: "0.06em" }}>Passou automaticamente</div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "3px 0" }}>
            <div style={{ flex: 1, height: 1, background: "#1c241f" }} />
            <span style={{ fontSize: 9, color: "#5f6f67", fontFamily: FD }}>VS</span>
            <div style={{ flex: 1, height: 1, background: "#1c241f" }} />
          </div>
          <LinhaJogador ident={b} pontos={c.pontos_b} venceu={c.vencedor === c.jogador_b} decidido={c.estado === "decidido"} />
        </>
      )}
      {clicavel && (
        <div style={{ fontSize: 10, color: "#5f6f67", marginTop: 7, fontFamily: FD }}>Toca para ver o detalhe →</div>
      )}
    </button>
  );
}

function LinhaJogador({ ident, pontos, venceu, decidido }: { ident: Identidade | null; pontos: number | null; venceu: boolean; decidido: boolean }) {
  if (!ident) {
    return <div style={{ fontSize: 13, color: "#5f6f67", padding: "4px 0" }}>A aguardar…</div>;
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 0" }}>
      <div style={{ flexShrink: 0, opacity: decidido && !venceu ? 0.5 : 1 }}><Escudo config={ident.escudo || DEFAULT_IDENTITY} size={28} /></div>
      <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 700, color: venceu ? GOLD : "#f1ede2", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", opacity: decidido && !venceu ? 0.6 : 1 }}>
        {ident.nome_time}
      </span>
      {venceu && decidido && <span style={{ fontSize: 13, flexShrink: 0 }}>✓</span>}
      {decidido && pontos !== null && (
        <span style={{ fontFamily: FD, fontSize: 14, fontWeight: 700, color: venceu ? GOLD : "#93a39a", flexShrink: 0 }}>{pontos}</span>
      )}
    </div>
  );
}

function Podio({ data, idn }: { data: ChaveResp; idn: (u: string | null) => Identidade | null }) {
  const campeao = idn(data.podio.campeao || null);
  const vice = idn(data.podio.vice || null);
  const terceiro = idn(data.podio.terceiro || null);
  return (
    <div style={{ background: "linear-gradient(160deg,#2a2410,#15110a)", border: `1px solid ${GOLD}`, borderRadius: 16, padding: "18px 16px", marginBottom: 22, textAlign: "center" }}>
      <div style={{ fontSize: 30, marginBottom: 4 }}>🏆</div>
      <div style={{ fontFamily: FD, fontSize: 15, fontWeight: 700, textTransform: "uppercase", color: GOLD, marginBottom: 14, letterSpacing: "0.04em" }}>Copa terminada</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <PodioLinha medalha="🥇" titulo="Campeão" ident={campeao} destaque />
        {vice && <PodioLinha medalha="🥈" titulo="Vice-campeão" ident={vice} />}
        {terceiro && <PodioLinha medalha="🥉" titulo="3º lugar" ident={terceiro} />}
      </div>
    </div>
  );
}

function PodioLinha({ medalha, titulo, ident, destaque }: { medalha: string; titulo: string; ident: Identidade | null; destaque?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 11, background: destaque ? "rgba(217,164,65,0.12)" : "rgba(12,14,13,0.5)", border: `1px solid ${destaque ? GOLD : "#2f2a18"}`, borderRadius: 12, padding: "10px 12px" }}>
      <span style={{ fontSize: 22, flexShrink: 0 }}>{medalha}</span>
      <div style={{ flexShrink: 0 }}><Escudo config={ident?.escudo || DEFAULT_IDENTITY} size={34} /></div>
      <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: destaque ? GOLD : "#f1ede2", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ident?.nome_time || "—"}</div>
        <div style={{ fontSize: 10.5, color: "#93a39a", textTransform: "uppercase", letterSpacing: "0.05em" }}>{titulo}</div>
      </div>
    </div>
  );
}

function DetalheConfronto({ c, idn, onClose }: { c: Confronto; idn: (u: string | null) => Identidade | null; onClose: () => void }) {
  const a = idn(c.jogador_a);
  const b = idn(c.jogador_b);
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(6,8,7,0.82)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 100 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 460, background: "#10160f", borderTop: `2px solid ${GOLD}`, borderRadius: "18px 18px 0 0", padding: "18px 16px 26px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <span style={{ fontFamily: FD, fontSize: 14, fontWeight: 700, textTransform: "uppercase" }}>Detalhe do confronto</span>
          <button onClick={onClose} aria-label="Fechar" style={{ background: "transparent", border: "none", color: "#93a39a", fontSize: 20, cursor: "pointer" }}>✕</button>
        </div>

        <LadoDetalhe ident={a} pontos={c.pontos_a} venceu={c.vencedor === c.jogador_a} />
        <div style={{ textAlign: "center", fontFamily: FD, fontSize: 11, color: "#5f6f67", margin: "8px 0" }}>VS</div>
        <LadoDetalhe ident={b} pontos={c.pontos_b} venceu={c.vencedor === c.jogador_b} />

        <div style={{ marginTop: 16, padding: "11px 13px", background: "#16201b", border: "1px solid #2a4d3e", borderRadius: 12, fontSize: 12.5, color: "#aee9c9", textAlign: "center" }}>
          {comoFoiDecidido(c.decidido_por)}
        </div>
      </div>
    </div>
  );
}

function LadoDetalhe({ ident, pontos, venceu }: { ident: Identidade | null; pontos: number | null; venceu: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, background: venceu ? "rgba(217,164,65,0.10)" : "#121815", border: `1px solid ${venceu ? GOLD : "#243029"}`, borderRadius: 12, padding: "12px 14px" }}>
      <div style={{ flexShrink: 0 }}><Escudo config={ident?.escudo || DEFAULT_IDENTITY} size={40} /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: venceu ? GOLD : "#f1ede2", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ident?.nome_time || "—"}</div>
        {venceu && <div style={{ fontSize: 11, color: GOLD, fontWeight: 700, textTransform: "uppercase", marginTop: 2 }}>Avançou ✓</div>}
      </div>
      <div style={{ fontFamily: FD, fontSize: 22, fontWeight: 700, color: venceu ? GOLD : "#93a39a", flexShrink: 0 }}>{pontos ?? "—"}</div>
    </div>
  );
}
