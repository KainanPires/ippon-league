"use client";

// app/admin/retencao/page.tsx
//
// RETENÇÃO (só admin) — a estrela-guia do lançamento, agora visível.
// Ativação (quem monta equipa), jogadores por competição, e quem volta de uma
// competição para a seguinte. A barreira real é no servidor (/api/admin/retencao).

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

const GOLD = "#d9a441";
const VERDE = "#8bd4b0";
const FUNDO = "#141110";
const CARTAO = "#1e1a17";
const BORDA = "#2c2622";

interface Comp { id: string; nome: string; data_iso: string | null; teste: boolean; jogadores: number }
interface Ret { de_nome: string; para_nome: string; base: number; voltaram: number; pct: number; novos: number; ambas_reais: boolean }
interface Dados {
  ok: boolean;
  erro?: string;
  detalhe?: string;
  total_contas?: number;
  ativaram?: number;
  ativaram_pct?: number;
  competicoes?: Comp[];
  retencao?: Ret[];
  estrela?: Ret | null;
}

export default function RetencaoPage() {
  const [acesso, setAcesso] = useState<"..." | "sim" | "nao">("...");
  const [d, setD] = useState<Dados | null>(null);
  const [aCarregar, setACarregar] = useState(false);

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
      const r = await fetch(`/api/admin/retencao`, { cache: "no-store", headers: { Authorization: `Bearer ${tk}` } });
      setD((await r.json()) as Dados);
    } catch (e) {
      setD({ ok: false, erro: e instanceof Error ? e.message : String(e) });
    } finally {
      setACarregar(false);
    }
  }, [token]);

  useEffect(() => { if (acesso === "sim") void carregar(); }, [acesso, carregar]);

  if (acesso === "...") return <Moldura><p style={{ color: "#9a938c" }}>A carregar...</p></Moldura>;
  if (acesso === "nao") {
    return <Moldura><h1 style={{ color: GOLD, fontSize: 20, margin: 0 }}>Sem acesso</h1><p style={{ color: "#9a938c" }}>Esta página é só para administradores.</p></Moldura>;
  }

  const maxJog = Math.max(1, ...((d?.competicoes || []).map((c) => c.jogadores)));

  return (
    <Moldura>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <h1 style={{ color: GOLD, fontSize: 22, margin: 0 }}>Retenção</h1>
        <button onClick={() => void carregar()} style={{ background: "transparent", color: GOLD, border: `1px solid ${GOLD}`, borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
          {aCarregar ? "A atualizar..." : "Atualizar"}
        </button>
      </div>
      <p style={{ color: "#c8c0b8", marginTop: 4, fontSize: 13, lineHeight: 1.5 }}>
        A nossa <b>estrela-guia</b>: de quem joga uma competição, quantos voltam na seguinte. Tudo o resto alimenta isto.
      </p>

      {d && !d.ok && (
        <div style={caixa}><p style={{ color: "#ef8d83", margin: 0, fontWeight: 700 }}>{d.erro}</p>{d.detalhe && <p style={{ color: "#9a938c", fontSize: 12 }}>{d.detalhe}</p>}</div>
      )}

      {d && d.ok && (
        <>
          {/* ---- Estrela (retenção mais recente entre competições reais) ---- */}
          <div style={{ ...caixa, borderColor: d.estrela ? VERDE : BORDA }}>
            <div style={titulo}>Estrela-guia · retenção</div>
            {d.estrela ? (
              <>
                <div style={{ fontSize: 40, fontWeight: 800, color: VERDE, lineHeight: 1 }}>{d.estrela.pct}%</div>
                <p style={{ color: "#c8c0b8", fontSize: 13, marginTop: 6, marginBottom: 0, lineHeight: 1.5 }}>
                  Dos {d.estrela.base} que jogaram <b style={{ color: "#efeadd" }}>{d.estrela.de_nome}</b>, {d.estrela.voltaram} voltaram em <b style={{ color: "#efeadd" }}>{d.estrela.para_nome}</b>. Entraram {d.estrela.novos} novos.
                </p>
              </>
            ) : (
              <p style={{ color: "#c8c0b8", fontSize: 13, margin: 0, lineHeight: 1.5 }}>
                Ainda não há duas competições reais jogadas para medir. A primeira retenção real aparece quando a competição a seguir ao Mundial for jogada (Marraquexe, 17/10). Até lá, olha para a ativação e os jogadores por competição abaixo.
              </p>
            )}
          </div>

          {/* ---- Ativação ---- */}
          <div style={{ ...caixa, marginTop: 14 }}>
            <div style={titulo}>Ativação</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Stat rot="Contas" val={String(d.total_contas ?? 0)} />
              <Stat rot="Montaram equipa" val={String(d.ativaram ?? 0)} sub={`${d.ativaram_pct ?? 0}%`} cor={VERDE} />
            </div>
            <p style={{ color: "#8b8079", fontSize: 11.5, marginTop: 10, marginBottom: 0, lineHeight: 1.5 }}>
              Quem nunca montou equipa é um registo, não um jogador. Subir esta % é o primeiro trabalho do funil.
            </p>
          </div>

          {/* ---- Jogadores por competição ---- */}
          <div style={{ ...caixa, marginTop: 14 }}>
            <div style={titulo}>Jogadores por competição</div>
            <div style={{ display: "grid", gap: 10 }}>
              {(d.competicoes || []).map((c) => (
                <div key={c.id}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "baseline" }}>
                    <div style={{ fontSize: 12.5, color: "#efeadd", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.nome}
                      {c.teste && <span style={{ color: "#8b8079", fontSize: 10.5, marginLeft: 6 }}>teste</span>}
                      {c.data_iso && <span style={{ color: "#5f5850", fontSize: 10.5, marginLeft: 6 }}>{c.data_iso}</span>}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#efeadd", whiteSpace: "nowrap" }}>{c.jogadores}</div>
                  </div>
                  <div style={{ height: 6, background: "#0e0c0b", borderRadius: 3, marginTop: 4, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${Math.max(4, Math.round((c.jogadores / maxJog) * 100))}%`, background: c.teste ? "#5f5850" : GOLD }} />
                  </div>
                </div>
              ))}
              {(!d.competicoes || d.competicoes.length === 0) && <p style={{ color: "#8b8079", fontSize: 12, margin: 0 }}>Ainda ninguém montou equipa.</p>}
            </div>
          </div>

          {/* ---- Retenção par a par ---- */}
          <div style={{ ...caixa, marginTop: 14 }}>
            <div style={titulo}>Quem voltou (competição a competição)</div>
            <div style={{ display: "grid", gap: 10 }}>
              {(d.retencao || []).map((r, i) => (
                <div key={i} style={{ background: "#0e0c0b", border: `1px solid ${BORDA}`, borderRadius: 10, padding: "10px 12px", opacity: r.ambas_reais ? 1 : 0.6 }}>
                  <div style={{ fontSize: 12.5, color: "#c8c0b8" }}>
                    <b style={{ color: "#efeadd" }}>{r.de_nome}</b> <span style={{ color: "#5f5850" }}>&rarr;</span> <b style={{ color: "#efeadd" }}>{r.para_nome}</b>
                    {!r.ambas_reais && <span style={{ color: "#8b8079", fontSize: 10.5, marginLeft: 6 }}>(inclui teste)</span>}
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "baseline", marginTop: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 22, fontWeight: 800, color: VERDE }}>{r.pct}%</span>
                    <span style={{ fontSize: 12, color: "#8b8079" }}>
                      {r.voltaram} de {r.base} voltaram · {r.novos} novos
                    </span>
                  </div>
                  <div style={{ height: 6, background: "#201b18", borderRadius: 3, marginTop: 6, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${Math.min(100, r.pct)}%`, background: VERDE }} />
                  </div>
                </div>
              ))}
              {(!d.retencao || d.retencao.length === 0) && (
                <p style={{ color: "#8b8079", fontSize: 12, margin: 0, lineHeight: 1.5 }}>Só há uma competição com jogadores. A retenção precisa de duas para comparar; aparece quando a próxima for jogada.</p>
              )}
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
      <div style={{ fontSize: 18, fontWeight: 700, color: cor || "#efeadd" }}>
        {val}{sub ? <span style={{ fontSize: 12, color: "#8b8079", fontWeight: 400 }}> {sub}</span> : null}
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
