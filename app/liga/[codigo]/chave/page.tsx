"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Escudo, DEFAULT_IDENTITY, type Identity } from "@/components/Escudo";

const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";

// ---- Tipos do que a rota /api/copa/chave devolve ----
interface ConfrontoAPI {
  id: string;
  ronda: number;
  ordem: number;
  fase: "normal" | "final" | "bronze";
  jogador_a: string;
  jogador_b: string | null;
  id_competicao: string;
  pontos_a: number | null;
  pontos_b: number | null;
  vencedor: string | null;
  decidido_por: string | null;
  estado: "pendente" | "decidido";
}
interface Identidade { nome_time: string; escudo: Identity | null; }
interface RespostaChave {
  liga: { id: string; name: string; escudo: Identity | null; copa_estado: string };
  confrontos: ConfrontoAPI[];
  identidades: Record<string, Identidade>;
  nInscritos: number;
  totalRondas: number;
  podio: { campeao?: string; vice?: string; terceiro?: string };
}

// Nome da ronda pelo nº de jogadores nela (a última ronda "normal" é a semi).
// Recebemos as rondas em nº (1,2,3...) e o total; convertemos para nomes.
function nomeRonda(ronda: number, totalRondas: number): string {
  // A última ronda (== totalRondas) é a final; a anterior, a semifinal; etc.
  const apartirDoFim = totalRondas - ronda; // 0 = final, 1 = semi, 2 = quartas...
  switch (apartirDoFim) {
    case 0: return "Final";
    case 1: return "Semifinais";
    case 2: return "Quartas de final";
    case 3: return "Oitavas de final";
    case 4: return "Ronda de 32";
    default: return `Ronda ${ronda}`;
  }
}

export default function PaginaChave() {
  const params = useParams();
  const codigo = String(params?.codigo || "").toUpperCase();

  const [dados, setDados] = useState<RespostaChave | null>(null);
  const [estado, setEstado] = useState<"carregando" | "ok" | "erro">("carregando");
  const [erro, setErro] = useState("");
  const [tutorial, setTutorial] = useState(false);
  // Modal "ver equipa de uma pessoa naquela ronda": guarda o user + competição
  // do confronto clicado. A equipa é a daquela competição (fixa) — sem risco de
  // mostrar a equipa nova que o jogador montou para a competição seguinte.
  const [verEquipa, setVerEquipa] = useState<{ uid: string; comp: string } | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const res = await fetch(`/api/copa/chave?codigo=${encodeURIComponent(codigo)}`);
        const j = await res.json();
        if (!vivo) return;
        if (j.erro) { setErro(j.erro); setEstado("erro"); return; }
        setDados(j as RespostaChave);
        setEstado("ok");
      } catch {
        if (!vivo) return;
        setErro("Não foi possível carregar a chave.");
        setEstado("erro");
      }
    })();
    return () => { vivo = false; };
  }, [codigo]);

  const nome = (uid: string | null): string => {
    if (!uid) return "—";
    return dados?.identidades[uid]?.nome_time ?? "Equipa";
  };
  const escudoDe = (uid: string | null): Identity =>
    (uid && dados?.identidades[uid]?.escudo) || DEFAULT_IDENTITY;

  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: FB }}>
      <div style={{ maxWidth: 460, margin: "0 auto", padding: "14px 14px 60px" }}>
        <header style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 16 }}>
          {/* Voltar vai para /ligas (as competições). NÃO para /liga/[codigo],
              porque essa página redireciona de volta para a chave (loop). */}
          <a href="/ligas" aria-label="Voltar às competições" style={{ width: 34, height: 34, borderRadius: "50%", border: "1px solid #243029", display: "flex", alignItems: "center", justifyContent: "center", color: "#cfd8d2", textDecoration: "none", flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
          </a>
          <h1 style={{ fontFamily: FD, fontSize: 19, fontWeight: 700, textTransform: "uppercase", margin: 0, flex: 1 }}>Chave da Copa</h1>
          <button onClick={() => setTutorial(true)} aria-label="Como funciona a chave" style={{ width: 34, height: 34, borderRadius: "50%", border: "1px solid #243029", background: "transparent", color: "#93a39a", fontSize: 16, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>?</button>
        </header>

        {estado === "carregando" && (
          <div style={{ textAlign: "center", padding: "50px 16px", color: "#7c8a82", fontFamily: FD, fontSize: 13, textTransform: "uppercase", letterSpacing: "0.1em" }}>A carregar a chave…</div>
        )}

        {estado === "erro" && (
          <div style={{ textAlign: "center", padding: "40px 16px", background: "#1a1110", border: "1px solid #3a2420", borderRadius: 16 }}>
            <div style={{ fontFamily: FD, fontSize: 15, fontWeight: 700, textTransform: "uppercase", color: "#ef8d83", marginBottom: 8 }}>Ups</div>
            <p style={{ fontSize: 13, color: "#c7d0c9", lineHeight: 1.5 }}>{erro}</p>
            <a href="/ligas" style={{ display: "inline-block", marginTop: 12, color: GOLD, fontSize: 13, textDecoration: "none", fontFamily: FD, fontWeight: 700 }}>Voltar às competições</a>
          </div>
        )}

        {estado === "ok" && dados && (
          <ChaveConteudo dados={dados} nome={nome} escudoDe={escudoDe} onAbrirTutorial={() => setTutorial(true)} onVerEquipa={(uid, comp) => setVerEquipa({ uid, comp })} />
        )}
      </div>

      {tutorial && <TutorialChave onClose={() => setTutorial(false)} />}
      {verEquipa && (
        <ModalEquipaRodada uid={verEquipa.uid} comp={verEquipa.comp} nome={nome} onClose={() => setVerEquipa(null)} />
      )}
    </main>
  );
}

function ChaveConteudo({ dados, nome, escudoDe, onAbrirTutorial, onVerEquipa }: {
  dados: RespostaChave;
  nome: (uid: string | null) => string;
  escudoDe: (uid: string | null) => Identity;
  onAbrirTutorial: () => void;
  onVerEquipa: (uid: string, comp: string) => void;
}) {
  const { confrontos, totalRondas, podio, liga, nInscritos } = dados;
  const terminada = liga.copa_estado === "terminada";
  const chaveGrande = nInscritos >= 8; // repescagem em cadeia só com 8+

  // Agrupa os confrontos por ronda. A final e o bronze estão na última ronda.
  const rondas = Array.from(new Set(confrontos.map((c) => c.ronda))).sort((a, b) => a - b);

  return (
    <>
      {/* Pódio (no topo) quando a copa terminou. */}
      {terminada && (podio.campeao || podio.vice || podio.terceiro) && (
        <Podio podio={podio} nome={nome} escudoDe={escudoDe} />
      )}

      {/* Cabeçalho da liga + nº de inscritos. */}
      <div style={{ display: "flex", alignItems: "center", gap: 11, background: "#0f1411", border: "1px solid #243029", borderRadius: 14, padding: "11px 13px", marginBottom: 14 }}>
        <div style={{ flexShrink: 0 }}><Escudo config={liga.escudo || DEFAULT_IDENTITY} size={38} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{liga.name}</div>
          <div style={{ fontSize: 11, color: "#93a39a" }}>{nInscritos} {nInscritos === 1 ? "equipa" : "equipas"} · {chaveGrande ? "com repescagem" : "mata-mata simples"}</div>
        </div>
        <button onClick={onAbrirTutorial} style={{ flexShrink: 0, background: "transparent", border: `1px solid ${GOLD}`, color: GOLD, fontFamily: FD, fontWeight: 700, fontSize: 10.5, textTransform: "uppercase", padding: "7px 11px", borderRadius: 9, cursor: "pointer" }}>Como funciona</button>
      </div>

      {/* Eliminação principal: uma secção por ronda. */}
      {rondas.map((r) => {
        const daRonda = confrontos.filter((c) => c.ronda === r).sort((a, b) => a.ordem - b.ordem);
        const normais = daRonda.filter((c) => c.fase === "normal");
        const final = daRonda.find((c) => c.fase === "final");
        const bronze = daRonda.find((c) => c.fase === "bronze");

        return (
          <div key={r} style={{ marginBottom: 18 }}>
            <SecaoTitulo>{nomeRonda(r, totalRondas)}</SecaoTitulo>

            {/* Confrontos normais da ronda. */}
            {normais.map((c) => (
              <CartaoConfronto key={c.id} c={c} nome={nome} escudoDe={escudoDe} onVerEquipa={onVerEquipa} />
            ))}

            {/* Na última ronda: a final em destaque + o bronze. */}
            {final && (
              <CartaoConfronto c={final} nome={nome} escudoDe={escudoDe} destaque="final" onVerEquipa={onVerEquipa} />
            )}
            {bronze && (
              <CartaoConfronto c={bronze} nome={nome} escudoDe={escudoDe} destaque="bronze" onVerEquipa={onVerEquipa} />
            )}
          </div>
        );
      })}

      {/* Zona de repescagem — só faz sentido com chave grande (8+). Como o motor
          que a gera ainda não está ligado, mostramos a estrutura PREVISTA, de
          forma explicativa, para o jogador entender o que aí vem. */}
      {chaveGrande && (
        <div style={{ marginBottom: 18 }}>
          <SecaoTitulo>Repescagem e bronze</SecaoTitulo>
          <div style={{ background: "#101511", border: "1px dashed #2f4a3c", borderRadius: 14, padding: "14px 15px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 17 }}>🥋</span>
              <span style={{ fontFamily: FD, fontSize: 12.5, fontWeight: 700, textTransform: "uppercase", color: "#aee9c9" }}>Há sempre uma segunda chance</span>
            </div>
            <p style={{ fontSize: 12.5, color: "#c7d0c9", lineHeight: 1.55, margin: "0 0 8px" }}>
              No judô, quem perde para um semifinalista entra na <strong style={{ color: "#f1ede2" }}>repescagem</strong>. Os derrotados de cada semifinalista lutam em cadeia até sair um campeão de repescagem, que depois disputa o <strong style={{ color: GOLD }}>bronze</strong>. São <strong style={{ color: "#f1ede2" }}>dois bronzes</strong> — tal como numa competição real.
            </p>
            <button onClick={onAbrirTutorial} style={{ background: "transparent", border: "none", color: GOLD, fontFamily: FD, fontSize: 12, fontWeight: 700, textTransform: "uppercase", cursor: "pointer", padding: 0 }}>Ver como funciona →</button>
          </div>
        </div>
      )}

      <div style={{ marginTop: 8, fontSize: 11, color: "#5f6f67", textAlign: "center", lineHeight: 1.5 }}>
        Cada ronda é uma competição real. Os pontos do confronto são os pontos da tua equipa nessa competição (capitão a dobrar).
      </div>
    </>
  );
}

// Um cartão de confronto: dois jogadores, escudo + nome + pontos, vencedor
// destacado. `destaque` muda a moldura (final dourada, bronze acobreado).
function CartaoConfronto({ c, nome, escudoDe, destaque, onVerEquipa }: {
  c: ConfrontoAPI;
  nome: (uid: string | null) => string;
  escudoDe: (uid: string | null) => Identity;
  destaque?: "final" | "bronze";
  onVerEquipa: (uid: string, comp: string) => void;
}) {
  const decidido = c.estado === "decidido";
  const bye = c.jogador_b === null;
  const venceuA = decidido && c.vencedor === c.jogador_a;
  const venceuB = decidido && c.vencedor === c.jogador_b;

  const cor = destaque === "final" ? GOLD : destaque === "bronze" ? "#c87f43" : "#243029";
  const etiqueta = destaque === "final" ? "Final" : destaque === "bronze" ? "Disputa de bronze" : null;

  return (
    <div style={{ background: "#121815", border: `1px solid ${cor}`, borderRadius: 13, padding: "10px 12px", marginBottom: 9 }}>
      {etiqueta && (
        <div style={{ fontFamily: FD, fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: cor, marginBottom: 7 }}>{etiqueta}</div>
      )}
      <LinhaJogador uid={c.jogador_a} pontos={c.pontos_a} venceu={venceuA} perdeu={decidido && !venceuA} nome={nome} escudoDe={escudoDe} onVerEquipa={() => c.jogador_a && onVerEquipa(c.jogador_a, c.id_competicao)} />
      {bye ? (
        <div style={{ fontSize: 11, color: "#7c8a82", textAlign: "center", padding: "4px 0", fontFamily: FD, textTransform: "uppercase", letterSpacing: "0.05em" }}>passou (sem adversário)</div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "2px 0" }}>
            <div style={{ flex: 1, height: 1, background: "#1a221d" }} />
            <span style={{ fontSize: 9.5, color: "#5f6f67", fontFamily: FD, fontWeight: 700 }}>{estadoLabel(c)}</span>
            <div style={{ flex: 1, height: 1, background: "#1a221d" }} />
          </div>
          <LinhaJogador uid={c.jogador_b} pontos={c.pontos_b} venceu={venceuB} perdeu={decidido && !venceuB} nome={nome} escudoDe={escudoDe} onVerEquipa={() => c.jogador_b && onVerEquipa(c.jogador_b, c.id_competicao)} />
        </>
      )}
    </div>
  );
}

function estadoLabel(c: ConfrontoAPI): string {
  if (c.estado === "decidido") {
    if (c.decidido_por === "sorteio") return "decidido por sorteio";
    if (c.decidido_por === "capitao") return "decidido pelo capitão";
    return "decidido";
  }
  return "a aguardar";
}

function LinhaJogador({ uid, pontos, venceu, perdeu, nome, escudoDe, onVerEquipa }: {
  uid: string | null;
  pontos: number | null;
  venceu: boolean;
  perdeu: boolean;
  nome: (uid: string | null) => string;
  escudoDe: (uid: string | null) => Identity;
  onVerEquipa?: () => void;
}) {
  const clicavel = !!uid && !!onVerEquipa;
  return (
    <button
      onClick={() => { if (clicavel) onVerEquipa!(); }}
      disabled={!clicavel}
      style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0", opacity: perdeu ? 0.5 : 1, width: "100%", background: "transparent", border: "none", cursor: clicavel ? "pointer" : "default", textAlign: "left", fontFamily: FB }}
    >
      <div style={{ flexShrink: 0 }}><Escudo config={escudoDe(uid)} size={28} /></div>
      <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 700, color: venceu ? GOLD : "#f1ede2", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {nome(uid)}
        {venceu && <span style={{ marginLeft: 6, fontSize: 11 }}>✓</span>}
      </span>
      {clicavel && <span style={{ flexShrink: 0, fontSize: 10, color: "#5f6f67", fontFamily: FD }}>ver equipa ›</span>}
      <span style={{ flexShrink: 0, fontFamily: FD, fontSize: 15, fontWeight: 700, color: venceu ? GOLD : "#93a39a" }}>
        {pontos !== null && pontos !== undefined ? (pontos >= 0 ? "+" : "") + pontos : "—"}
      </span>
    </button>
  );
}

function Podio({ podio, nome, escudoDe }: {
  podio: { campeao?: string; vice?: string; terceiro?: string };
  nome: (uid: string | null) => string;
  escudoDe: (uid: string | null) => Identity;
}) {
  const linha = (uid: string | undefined, medalha: string, label: string, cor: string) => {
    if (!uid) return null;
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 11, background: "#121815", border: `1px solid ${cor}`, borderRadius: 12, padding: "10px 12px", marginBottom: 8 }}>
        <span style={{ fontSize: 22, flexShrink: 0 }}>{medalha}</span>
        <div style={{ flexShrink: 0 }}><Escudo config={escudoDe(uid)} size={32} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#f1ede2", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nome(uid)}</div>
          <div style={{ fontSize: 10.5, color: cor, fontFamily: FD, fontWeight: 700, textTransform: "uppercase" }}>{label}</div>
        </div>
      </div>
    );
  };
  return (
    <div style={{ background: "linear-gradient(160deg,#2a2410,#15110a)", border: `1px solid ${GOLD}`, borderRadius: 16, padding: "16px 15px", marginBottom: 16 }}>
      <div style={{ textAlign: "center", fontFamily: FD, fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: GOLD, marginBottom: 12 }}>🏆 Pódio da Copa</div>
      {linha(podio.campeao, "🥇", "Campeão", GOLD)}
      {linha(podio.vice, "🥈", "Vice-campeão", "#c0c0c0")}
      {linha(podio.terceiro, "🥉", "3º lugar", "#c87f43")}
    </div>
  );
}

function SecaoTitulo({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
      <span style={{ fontFamily: FD, fontSize: 12.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#cdb86a" }}>{children}</span>
      <div style={{ flex: 1, height: 1, background: "#1a221d" }} />
    </div>
  );
}

// Modal que mostra a EQUIPA de um jogador NAQUELA competição (ronda), buscada à
// rota /api/equipa-na-rodada. Só leitura: nome do atleta + país + categoria +
// pontos simples daquela rodada, capitão destacado, e o total da equipa.
interface AtletaRodada { id: string; nome: string; pais: string; categoria: string; pontos: number; capitao: boolean }
interface RespostaEquipaRodada {
  ok: boolean;
  tem_equipa?: boolean;
  nome_time?: string;
  escudo?: Identity | null;
  competicao?: { id: string; nome: string };
  atletas?: AtletaRodada[];
  total?: number;
}

const IOC_CHAVE: Record<string, string> = {
  JP: "JPN", FR: "FRA", BR: "BRA", GE: "GEO", KZ: "KAZ", AZ: "AZE", BE: "BEL",
  TR: "TUR", UZ: "UZB", RU: "AIN", DE: "GER", XK: "KOS", IT: "ITA", CA: "CAN",
  SI: "SLO", HR: "CRO", NL: "NED",
};
const cod3 = (iso: string) => IOC_CHAVE[iso] || iso;

function ModalEquipaRodada({ uid, comp, nome, onClose }: { uid: string; comp: string; nome: (uid: string | null) => string; onClose: () => void }) {
  const [dados, setDados] = useState<RespostaEquipaRodada | null>(null);
  const [estado, setEstado] = useState<"carregando" | "ok" | "vazio" | "erro">("carregando");

  useEffect(() => {
    let vivo = true;
    fetch(`/api/equipa-na-rodada?user=${encodeURIComponent(uid)}&comp=${encodeURIComponent(comp)}`)
      .then((r) => r.json())
      .then((j: RespostaEquipaRodada) => {
        if (!vivo) return;
        if (!j || !j.ok) { setEstado("erro"); return; }
        if (!j.tem_equipa) { setDados(j); setEstado("vazio"); return; }
        setDados(j);
        setEstado("ok");
      })
      .catch(() => { if (vivo) setEstado("erro"); });
    return () => { vivo = false; };
  }, [uid, comp]);

  const tituloTime = dados?.nome_time || nome(uid);

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(6,8,7,0.82)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 120 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 460, background: "#10160f", borderTop: `2px solid ${GOLD}`, borderRadius: "18px 18px 0 0", padding: "16px 16px 26px", maxHeight: "86%", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
          <div style={{ flexShrink: 0 }}><Escudo config={dados?.escudo || DEFAULT_IDENTITY} size={40} /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#f1ede2", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tituloTime}</div>
            <div style={{ fontSize: 11, color: "#93a39a" }}>{dados?.competicao?.nome || ""}</div>
          </div>
          <button onClick={onClose} aria-label="Fechar" style={{ background: "transparent", border: "none", color: "#93a39a", fontSize: 20, cursor: "pointer", flexShrink: 0 }}>✕</button>
        </div>

        {estado === "carregando" && (
          <div style={{ textAlign: "center", padding: "30px 16px", color: "#7c8a82", fontFamily: FD, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.1em" }}>A carregar a equipa…</div>
        )}
        {estado === "erro" && (
          <div style={{ textAlign: "center", padding: "26px 16px", color: "#ef8d83", fontSize: 13 }}>Não foi possível carregar a equipa desta rodada.</div>
        )}
        {estado === "vazio" && (
          <div style={{ textAlign: "center", padding: "26px 16px", color: "#c7d0c9", fontSize: 13, lineHeight: 1.5 }}>
            Este jogador não tinha equipa escalada nesta competição.
          </div>
        )}

        {estado === "ok" && dados && dados.atletas && (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 8 }}>
              {dados.atletas.map((a) => (
                <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "#141a17", border: `1px solid ${a.capitao ? "#FF8F00" : "#243029"}`, borderRadius: 11, padding: "9px 11px" }}>
                  <div style={{ width: 30, height: 34, borderRadius: 6, background: "linear-gradient(160deg,#2a4d3e,#1c3a2e)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <div style={{ background: "#f1ede2", color: "#1b211e", fontFamily: FD, fontWeight: 700, fontSize: 8, padding: "1px 3px", borderRadius: 2 }}>{cod3(a.pais)}</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: "#f1ede2", display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", overflow: "hidden" }}>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{a.nome}</span>
                      {a.capitao && <span style={{ background: "#FF8F00", color: "#1b1208", fontFamily: FD, fontWeight: 700, fontSize: 9, padding: "1px 6px", borderRadius: 5, flexShrink: 0 }}>CAP</span>}
                    </div>
                    <div style={{ fontSize: 10.5, color: "#93a39a" }}>{cod3(a.pais)}{a.categoria ? ` · ${a.categoria}kg` : ""}</div>
                  </div>
                  <div style={{ flexShrink: 0, textAlign: "right" }}>
                    <span style={{ fontFamily: FD, fontSize: 15, fontWeight: 700, color: a.pontos >= 0 ? "#7fd1a3" : "#ef8d83" }}>{a.pontos >= 0 ? "+" : ""}{a.pontos}</span>
                    <div style={{ fontSize: 8.5, color: "#5f6f67", textTransform: "uppercase" }}>pts</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12, padding: "11px 13px", background: "#16201b", border: `1px solid ${GOLD}`, borderRadius: 12 }}>
              <span style={{ fontFamily: FD, fontSize: 12.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#f1ede2" }}>Total da equipa</span>
              <span style={{ fontFamily: FD, fontSize: 20, fontWeight: 700, color: GOLD }}>{(dados.total ?? 0) >= 0 ? "+" : ""}{dados.total ?? 0} pts</span>
            </div>
            <div style={{ fontSize: 10.5, color: "#5f6f67", textAlign: "center", marginTop: 8, lineHeight: 1.4 }}>
              Pontos de cada atleta nesta competição. O capitão (CAP) conta a dobrar no total.
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Tutorial DIDÁTICO da chave — explica o formato do mata-mata de judô.
function TutorialChave({ onClose }: { onClose: () => void }) {
  const [passo, setPasso] = useState(0);
  const passos = [
    {
      t: "Mata-mata por competições",
      x: "Cada ronda da Copa é uma competição real. Os pontos do teu confronto são os pontos da tua equipa nessa competição (com o capitão a dobrar), tal como no ranking. Quem pontuar mais, avança.",
    },
    {
      t: "Eliminação até às meias",
      x: "Vais avançando enquanto venceres. Em caso de empate, decide quem teve o capitão com mais pontos; se ainda empatar, sorteio. Chega às semifinais quem vencer todos os confrontos do seu lado da chave.",
    },
    {
      t: "A repescagem (8+ equipas)",
      x: "No judô, quem perde para um semifinalista não está fora! Os derrotados de cada semifinalista lutam entre si, em cadeia, até sair um campeão de repescagem. É a tua segunda chance.",
    },
    {
      t: "Os dois bronzes",
      x: "Os campeões de repescagem de cada metade disputam o bronze cruzando com o semifinalista perdedor do outro lado. Por isso há DOIS bronzes — e quem perdeu a semifinal ainda tem de os disputar (não recebe a medalha de borla).",
    },
    {
      t: "A final é por pontos",
      x: "Os dois finalistas não decidem o título numa só competição: acumulam pontos a partir do momento em que chegam à final, até ao dia do bronze. Quem somar mais é o campeão. Assim o título não se decide pela sorte de uma rodada.",
    },
  ];
  const s = passos[passo];
  const ultimo = passo === passos.length - 1;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(6,8,7,0.85)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18, zIndex: 100 }}>
      <div style={{ width: "100%", maxWidth: 340, background: "#121815", border: `1px solid ${GOLD}`, borderRadius: 16, padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12 }}>
          <span style={{ fontSize: 22 }}>🥋</span>
          <span style={{ fontFamily: FD, fontSize: 15, fontWeight: 700, textTransform: "uppercase", color: GOLD }}>{s.t}</span>
        </div>
        <p style={{ fontSize: 13.5, color: "#dfe6e0", lineHeight: 1.6, margin: "0 0 18px" }}>{s.x}</p>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button onClick={() => (passo > 0 ? setPasso(passo - 1) : onClose())} style={{ background: "transparent", border: "none", color: "#93a39a", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: FB }}>{passo > 0 ? "Anterior" : "Fechar"}</button>
          <span style={{ fontSize: 11, color: "#5f6f67" }}>{passo + 1} de {passos.length}</span>
          <button onClick={() => (ultimo ? onClose() : setPasso(passo + 1))} style={{ background: GOLD, border: "none", color: "#1b211e", padding: "8px 18px", borderRadius: 9, fontFamily: FD, fontSize: 13, fontWeight: 700, textTransform: "uppercase", cursor: "pointer" }}>{ultimo ? "Entendi" : "Seguinte"}</button>
        </div>
      </div>
    </div>
  );
}
