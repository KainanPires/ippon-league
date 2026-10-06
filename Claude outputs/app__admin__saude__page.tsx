"use client";

// app/admin/saude/page.tsx
//
// SAÚDE DO MOTOR AO VIVO (só admin). O ecrã que o fundador abre durante uma
// competição para ver, de relance, se o motor está VIVO, a FLUIR e COMPLETO.
// A verdadeira barreira é no servidor (/api/admin/saude); aqui só escondemos a UI.
// Atualiza sozinho a cada 30s.

import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";

const GOLD = "#d9a441";
const FUNDO = "#141110";
const CARTAO = "#1e1a17";
const BORDA = "#2c2622";

type Estado = "ok" | "aviso" | "alarme";
const COR: Record<Estado, string> = { ok: "#8bd4b0", aviso: "#e5b765", alarme: "#ef8d83" };
const SINAL: Record<Estado, string> = { ok: "🟢", aviso: "🟡", alarme: "🔴" };
const ROTULO: Record<Estado, string> = { ok: "Tudo bem", aviso: "Atenção", alarme: "Alarme" };
const estadoOf = (v: unknown): Estado => (v === "alarme" || v === "aviso" ? v : "ok");

interface Leitura { estado?: string; rotulo?: string; observado?: number; esperado?: string; limite?: string; ajuda?: string }
interface Corrida { job: string; estado?: string | null; terminado_em?: string | null; ms?: number | null; comp?: string | null; ao_vivo?: boolean | null; erro?: string | null }
interface Saude {
  ok: boolean;
  erro?: string;
  agora?: string;
  ao_vivo?: boolean;
  comp?: string | null;
  nome_comp?: string | null;
  estado_geral?: Estado;
  maestro?: { existe?: boolean; estado_corrida?: string | null; minutos_atras?: number | null; frescura?: Leitura; ms?: number | null; erro?: string | null };
  cron?: { existe?: boolean; minutos_atras?: number | null; frescura?: Leitura };
  cursor?: { minutos_atras?: number | null } | null;
  cobertura?: {
    erro_leitura?: string;
    categorias_com_moldura?: number;
    categorias_com_resultado?: number;
    atletas_na_base?: number;
    atletas_que_lutaram?: number;
    atletas_sem_detalhe?: number;
    soma_pontos_visiveis?: number;
    categorias_por_cobrir?: string[];
  } | null;
  alarmes_24h?: { total: number; alertados: number };
  ultimas?: Corrida[];
}

function hhmm(iso?: string | null): string {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" }); } catch { return "—"; }
}
function hMin(m?: number | null): string {
  if (m == null) return "—";
  if (m < 1) return "agora mesmo";
  if (m < 60) return `há ${Math.round(m)} min`;
  const h = Math.floor(m / 60); const r = Math.round(m % 60);
  return `há ${h}h${r ? ` ${r}min` : ""}`;
}

export default function SaudePage() {
  const [acesso, setAcesso] = useState<"..." | "sim" | "nao">("...");
  const [s, setS] = useState<Saude | null>(null);
  const [aCarregar, setACarregar] = useState(false);
  const [ultimaBusca, setUltimaBusca] = useState<string>("");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const token = useCallback(async (): Promise<string> => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || "";
  }, []);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user?.id;
      if (!uid) { if (vivo) setAcesso("nao"); return; }
      const { data: u } = await supabase.from("users").select("is_admin").eq("id", uid).maybeSingle();
      if (!vivo) return;
      setAcesso(u?.is_admin ? "sim" : "nao");
    })();
    return () => { vivo = false; };
  }, []);

  const carregar = useCallback(async () => {
    setACarregar(true);
    try {
      const tk = await token();
      const r = await fetch(`/api/admin/saude`, { cache: "no-store", headers: { Authorization: `Bearer ${tk}` } });
      const j = (await r.json()) as Saude;
      setS(j);
      setUltimaBusca(new Date().toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    } catch (e) {
      setS({ ok: false, erro: e instanceof Error ? e.message : String(e) });
    } finally {
      setACarregar(false);
    }
  }, [token]);

  // Carrega ao entrar e, a seguir, de 30 em 30 segundos.
  useEffect(() => {
    if (acesso !== "sim") return;
    void carregar();
    timer.current = setInterval(() => { void carregar(); }, 30_000);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [acesso, carregar]);

  if (acesso === "...") return <Moldura><p style={{ color: "#9a938c" }}>A carregar...</p></Moldura>;
  if (acesso === "nao") {
    return <Moldura><h1 style={{ color: GOLD, fontSize: 20, margin: 0 }}>Sem acesso</h1><p style={{ color: "#9a938c" }}>Esta página é só para administradores.</p></Moldura>;
  }

  const ger = estadoOf(s?.estado_geral);
  const mFres = estadoOf(s?.maestro?.frescura?.estado);
  const cob = s?.cobertura;

  return (
    <Moldura>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <h1 style={{ color: GOLD, fontSize: 22, margin: 0 }}>Saúde do motor</h1>
        <button onClick={() => void carregar()} style={{ background: "transparent", color: GOLD, border: `1px solid ${GOLD}`, borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
          {aCarregar ? "A atualizar..." : "Atualizar"}
        </button>
      </div>
      <p style={{ color: "#8b8079", marginTop: 4, fontSize: 12 }}>
        Atualiza sozinho a cada 30s{ultimaBusca ? ` · última leitura ${ultimaBusca}` : ""}.
      </p>

      {s && !s.ok && (
        <div style={caixa}><p style={{ color: COR.alarme, margin: 0, fontWeight: 700 }}>Falha a ler: {s.erro}</p></div>
      )}

      {s && s.ok && (
        <>
          {/* ---- Estado geral ---- */}
          <div style={{ ...caixa, borderColor: COR[ger], display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ fontSize: 40, lineHeight: 1 }}>{SINAL[ger]}</div>
            <div>
              <div style={{ color: COR[ger], fontSize: 20, fontWeight: 800 }}>{ROTULO[ger]}</div>
              <div style={{ color: "#c8c0b8", fontSize: 13, marginTop: 2 }}>
                {s.ao_vivo
                  ? <>Competição a decorrer: <b style={{ color: "#efeadd" }}>{s.nome_comp}</b></>
                  : "Nenhuma competição a decorrer agora (o motor ao vivo descansa)."}
              </div>
            </div>
          </div>

          {/* ---- Maestro (a pontuação ao vivo) ---- */}
          <div style={{ ...caixa, marginTop: 14 }}>
            <div style={titulo}>Maestro · pontuação ao vivo</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Stat rot="Estado" val={`${SINAL[mFres]} ${ROTULO[mFres]}`} cor={COR[mFres]} />
              <Stat rot="Última corrida" val={hMin(s.maestro?.minutos_atras)} />
              <Stat rot="Duração" val={s.maestro?.ms != null ? `${(s.maestro.ms / 1000).toFixed(1)}s` : "—"} />
            </div>
            {s.maestro?.erro && <p style={{ color: COR.alarme, fontSize: 12.5, marginTop: 10, marginBottom: 0 }}>Erro na última corrida: {s.maestro.erro}</p>}
            {s.maestro?.frescura?.ajuda && mFres !== "ok" && (
              <p style={{ color: "#c8c0b8", fontSize: 12, marginTop: 10, marginBottom: 0, lineHeight: 1.5 }}>{s.maestro.frescura.ajuda}</p>
            )}
            {!s.ao_vivo && <p style={{ color: "#8b8079", fontSize: 12, marginTop: 10, marginBottom: 0 }}>Fora de competição é normal o maestro não correr.</p>}
          </div>

          {/* ---- Cobertura (fluxo de dados real) ---- */}
          {s.ao_vivo && cob && !cob.erro_leitura && (
            <div style={{ ...caixa, marginTop: 14 }}>
              <div style={titulo}>Cobertura da competição</div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Stat rot="Categorias com resultado" val={`${cob.categorias_com_resultado ?? 0}/${cob.categorias_com_moldura ?? 0}`} />
                <Stat rot="Atletas que já lutaram" val={`${cob.atletas_que_lutaram ?? 0}`} sub={`de ${cob.atletas_na_base ?? 0}`} />
                <Stat rot="Pontos a somar" val={`${cob.soma_pontos_visiveis ?? 0}`} />
                <Stat rot="Sem detalhe" val={`${cob.atletas_sem_detalhe ?? 0}`} cor={(cob.atletas_sem_detalhe ?? 0) > 0 ? COR.aviso : undefined} />
              </div>
              {Array.isArray(cob.categorias_por_cobrir) && cob.categorias_por_cobrir.length > 0 && (
                <p style={{ color: "#c8c0b8", fontSize: 12, marginTop: 10, marginBottom: 0, lineHeight: 1.5 }}>
                  Categorias ainda sem resultados: <b style={{ color: "#efeadd" }}>{cob.categorias_por_cobrir.join(", ")}</b>
                  <span style={{ color: "#8b8079" }}> (normal se o dia dessas categorias ainda não chegou).</span>
                </p>
              )}
              {(cob.atletas_sem_detalhe ?? 0) > 0 && (
                <p style={{ color: COR.aviso, fontSize: 12, marginTop: 8, marginBottom: 0, lineHeight: 1.5 }}>
                  {cob.atletas_sem_detalhe} atleta(s) marcam lutas mas sem detalhe gravado. Costuma ser falha pontual do JudoBase e recupera na corrida seguinte; se ficar preso, ver o maestro.
                </p>
              )}
            </div>
          )}

          {/* ---- Linha de apoio (cron principal + cursor + alarmes) ---- */}
          <div style={{ ...caixa, marginTop: 14 }}>
            <div style={titulo}>Apoio</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Stat rot="Cron principal" val={hMin(s.cron?.minutos_atras)} />
              <Stat rot="Última volta do maestro" val={hMin(s.cursor?.minutos_atras)} />
              <Stat rot="Alarmes 24h" val={`${s.alarmes_24h?.total ?? 0}`} cor={(s.alarmes_24h?.total ?? 0) > 0 ? COR.alarme : undefined} sub={(s.alarmes_24h?.total ?? 0) > 0 ? `${s.alarmes_24h?.alertados ?? 0} por email` : undefined} />
            </div>
          </div>

          {/* ---- Linha do tempo ---- */}
          <div style={{ ...caixa, marginTop: 14 }}>
            <div style={titulo}>Últimas corridas</div>
            <div style={{ display: "grid", gap: 6 }}>
              {(s.ultimas || []).map((r, i) => {
                const e = estadoOf(r.estado);
                return (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 8, alignItems: "center", fontSize: 12.5, borderBottom: `1px solid ${BORDA}`, paddingBottom: 5 }}>
                    <span>{SINAL[e]}</span>
                    <span style={{ color: "#efeadd", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      <b>{r.job}</b>
                      {r.ao_vivo ? <span style={{ color: GOLD, fontSize: 10, marginLeft: 6 }}>AO VIVO</span> : null}
                      {r.erro ? <span style={{ color: COR.alarme }}> · {r.erro}</span> : null}
                    </span>
                    <span style={{ color: "#8b8079", whiteSpace: "nowrap" }}>
                      {hhmm(r.terminado_em)}{r.ms != null ? ` · ${(r.ms / 1000).toFixed(1)}s` : ""}
                    </span>
                  </div>
                );
              })}
              {(!s.ultimas || s.ultimas.length === 0) && <p style={{ color: "#8b8079", fontSize: 12, margin: 0 }}>Sem corridas registadas ainda.</p>}
            </div>
          </div>
        </>
      )}
    </Moldura>
  );
}

function Stat({ rot, val, sub, cor }: { rot: string; val: string; sub?: string; cor?: string }) {
  return (
    <div style={{ background: "#0e0c0b", border: `1px solid ${BORDA}`, borderRadius: 10, padding: "8px 12px", minWidth: 96 }}>
      <div style={{ fontSize: 17, fontWeight: 700, color: cor || "#efeadd" }}>
        {val}{sub ? <span style={{ fontSize: 11, color: "#8b8079", fontWeight: 400 }}> {sub}</span> : null}
      </div>
      <div style={{ fontSize: 11, color: "#8b8079", marginTop: 2 }}>{rot}</div>
    </div>
  );
}
function Moldura({ children }: { children: React.ReactNode }) {
  return (
    <main style={{ minHeight: "100vh", background: FUNDO, padding: "28px 16px" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>{children}</div>
    </main>
  );
}
const caixa: React.CSSProperties = { background: CARTAO, border: `1px solid ${BORDA}`, borderRadius: 12, padding: 16, marginTop: 14 };
const titulo: React.CSSProperties = { fontFamily: "var(--font-geist-mono), monospace", fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: GOLD, marginBottom: 12 };
