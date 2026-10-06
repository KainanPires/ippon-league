"use client";

// app/admin/retencao/page.tsx
//
// RETENÇÃO (só admin) — a estrela-guia, agora com COMPARADOR.
// Escolhes as competições que quiseres (duas ou mais), vês os jogadores de cada
// uma contra o total de registos num gráfico limpo, e a retenção entre as
// selecionadas (quem voltou, quem é novo). A barreira real é no servidor.

import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";

const GOLD = "#d9a441";
const VERDE = "#8bd4b0";
const CINZA = "#6b645c"; // competições de teste
const FUNDO = "#141110";
const CARTAO = "#1e1a17";
const BORDA = "#2c2622";
const INK = "#efeadd";
const INK2 = "#9a938c";

interface Comp { id: string; nome: string; data_iso: string | null; teste: boolean; jogadores: number; jogadores_ids: string[] }
interface Ret { de_nome: string; para_nome: string; base: number; voltaram: number; pct: number; novos: number; ambas_reais: boolean }
interface Dados {
  ok: boolean; erro?: string; detalhe?: string;
  total_contas?: number; ativaram?: number; ativaram_pct?: number;
  competicoes?: Comp[]; estrela?: Ret | null;
}

export default function RetencaoPage() {
  const [acesso, setAcesso] = useState<"..." | "sim" | "nao">("...");
  const [d, setD] = useState<Dados | null>(null);
  const [aCarregar, setACarregar] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [inicializou, setInicializou] = useState(false);

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

  // Seleção inicial: todas as competições reais (não-teste). Se não houver reais,
  // seleciona todas. Só corre uma vez, quando os dados chegam.
  useEffect(() => {
    if (inicializou || !d?.ok || !d.competicoes) return;
    const reais = d.competicoes.filter((c) => !c.teste).map((c) => c.id);
    const base = reais.length > 0 ? reais : d.competicoes.map((c) => c.id);
    setSel(new Set(base));
    setInicializou(true);
  }, [d, inicializou]);

  const comps = useMemo(() => d?.competicoes || [], [d]);
  const selecionadas = useMemo(() => comps.filter((c) => sel.has(c.id)), [comps, sel]);
  const totalContas = d?.total_contas ?? 0;

  // Retenção entre as competições SELECIONADAS (consecutivas, por ordem de data).
  const retSel = useMemo(() => {
    const out: { a: string; b: string; base: number; voltaram: number; pct: number; novos: number }[] = [];
    for (let i = 1; i < selecionadas.length; i++) {
      const A = new Set(selecionadas[i - 1].jogadores_ids);
      const B = new Set(selecionadas[i].jogadores_ids);
      let voltaram = 0;
      for (const u of A) if (B.has(u)) voltaram++;
      out.push({
        a: selecionadas[i - 1].nome, b: selecionadas[i].nome,
        base: A.size, voltaram, pct: A.size ? Math.round((voltaram / A.size) * 100) : 0,
        novos: B.size - voltaram,
      });
    }
    return out;
  }, [selecionadas]);

  // Caso especial de 2 selecionadas: repartição clara.
  const par = useMemo(() => {
    if (selecionadas.length !== 2) return null;
    const A = new Set(selecionadas[0].jogadores_ids);
    const B = new Set(selecionadas[1].jogadores_ids);
    let ambas = 0; for (const u of A) if (B.has(u)) ambas++;
    return { aNome: selecionadas[0].nome, bNome: selecionadas[1].nome, ambas, soA: A.size - ambas, soB: B.size - ambas };
  }, [selecionadas]);

  function toggle(id: string) {
    setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }

  if (acesso === "...") return <Moldura><p style={{ color: INK2 }}>A carregar...</p></Moldura>;
  if (acesso === "nao") {
    return <Moldura><h1 style={{ color: GOLD, fontSize: 20, margin: 0 }}>Sem acesso</h1><p style={{ color: INK2 }}>Esta página é só para administradores.</p></Moldura>;
  }

  return (
    <Moldura>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <h1 style={{ color: GOLD, fontSize: 22, margin: 0 }}>Retenção</h1>
        <button onClick={() => void carregar()} style={botaoGhost}>{aCarregar ? "A atualizar..." : "Atualizar"}</button>
      </div>
      <p style={{ color: "#c8c0b8", marginTop: 4, fontSize: 13, lineHeight: 1.5 }}>
        A nossa <b>estrela-guia</b>: de quem joga uma competição, quantos voltam na seguinte. Escolhe as competições em baixo para comparar.
      </p>

      {d && !d.ok && (
        <div style={caixa}><p style={{ color: "#ef8d83", margin: 0, fontWeight: 700 }}>{d.erro}</p>{d.detalhe && <p style={{ color: INK2, fontSize: 12 }}>{d.detalhe}</p>}</div>
      )}

      {d && d.ok && (
        <>
          {/* ---- Estrela + ativação (visão rápida) ---- */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div style={{ ...caixa, flex: "1 1 200px", marginTop: 14, borderColor: d.estrela ? VERDE : BORDA }}>
              <div style={subtitulo}>Estrela · última retenção real</div>
              {d.estrela
                ? <div style={{ fontSize: 30, fontWeight: 800, color: VERDE }}>{d.estrela.pct}%</div>
                : <div style={{ fontSize: 13, color: "#c8c0b8", lineHeight: 1.5 }}>Aparece quando houver uma 2ª competição real jogada (Marraquexe, 17/10).</div>}
              {d.estrela && <div style={{ fontSize: 12, color: INK2, marginTop: 4 }}>{d.estrela.voltaram}/{d.estrela.base} voltaram em {d.estrela.para_nome}</div>}
            </div>
            <div style={{ ...caixa, flex: "1 1 200px", marginTop: 14 }}>
              <div style={subtitulo}>Ativação</div>
              <div style={{ fontSize: 30, fontWeight: 800, color: VERDE }}>{d.ativaram_pct ?? 0}%</div>
              <div style={{ fontSize: 12, color: INK2, marginTop: 4 }}>{d.ativaram ?? 0} de {totalContas} contas montaram equipa</div>
            </div>
          </div>

          {/* ---- Seletor de competições ---- */}
          <div style={{ ...caixa, marginTop: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <div style={titulo}>Escolhe competições para comparar</div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => setSel(new Set(comps.filter((c) => !c.teste).map((c) => c.id)))} style={botaoMini}>Só reais</button>
                <button onClick={() => setSel(new Set(comps.map((c) => c.id)))} style={botaoMini}>Todas</button>
                <button onClick={() => setSel(new Set())} style={botaoMini}>Limpar</button>
              </div>
            </div>
            <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
              {comps.map((c) => {
                const on = sel.has(c.id);
                return (
                  <button key={c.id} onClick={() => toggle(c.id)} style={{
                    display: "grid", gridTemplateColumns: "20px 1fr auto", gap: 10, alignItems: "center",
                    background: on ? "#231d18" : "#0e0c0b", border: `1px solid ${on ? GOLD : BORDA}`,
                    borderRadius: 8, padding: "9px 11px", cursor: "pointer", textAlign: "left", width: "100%",
                  }}>
                    <span style={{ width: 16, height: 16, borderRadius: 4, border: `1.5px solid ${on ? GOLD : "#5f5850"}`, background: on ? GOLD : "transparent", color: FUNDO, fontSize: 12, fontWeight: 900, lineHeight: "14px", textAlign: "center" }}>{on ? "✓" : ""}</span>
                    <span style={{ color: INK, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.nome}
                      {c.teste && <span style={{ color: INK2, fontSize: 10.5, marginLeft: 6 }}>teste</span>}
                      {c.data_iso && <span style={{ color: "#5f5850", fontSize: 10.5, marginLeft: 6 }}>{c.data_iso}</span>}
                    </span>
                    <span style={{ color: INK, fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{c.jogadores}</span>
                  </button>
                );
              })}
              {comps.length === 0 && <p style={{ color: INK2, fontSize: 12, margin: 0 }}>Ainda ninguém montou equipa.</p>}
            </div>
          </div>

          {/* ---- Gráfico: jogadores por competição vs registos ---- */}
          {selecionadas.length >= 1 && (
            <div style={{ ...caixa, marginTop: 14 }}>
              <div style={titulo}>Jogadores por competição vs registos</div>
              <GraficoBarras itens={selecionadas} registos={totalContas} />
              <p style={{ color: "#8b8079", fontSize: 11.5, marginTop: 8, marginBottom: 0, lineHeight: 1.5 }}>
                Cada barra é quem montou equipa nessa competição. A linha tracejada é o total de registos ({totalContas}). A % em cima de cada barra é a fatia dos registos que jogou. Cinzento = competição de teste.
              </p>
            </div>
          )}

          {/* ---- Retenção da seleção ---- */}
          {selecionadas.length >= 2 && (
            <div style={{ ...caixa, marginTop: 14 }}>
              <div style={titulo}>Quem voltou, entre as selecionadas</div>
              {par && (
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
                  <Stat rot={`Só ${par.aNome}`} val={String(par.soA)} />
                  <Stat rot="Jogaram as duas" val={String(par.ambas)} cor={VERDE} />
                  <Stat rot={`Só ${par.bNome}`} val={String(par.soB)} />
                </div>
              )}
              <div style={{ display: "grid", gap: 10 }}>
                {retSel.map((r, i) => (
                  <div key={i} style={{ background: "#0e0c0b", border: `1px solid ${BORDA}`, borderRadius: 10, padding: "10px 12px" }}>
                    <div style={{ fontSize: 12.5, color: "#c8c0b8" }}>
                      <b style={{ color: INK }}>{r.a}</b> <span style={{ color: "#5f5850" }}>&rarr;</span> <b style={{ color: INK }}>{r.b}</b>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "baseline", marginTop: 6, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 22, fontWeight: 800, color: VERDE, fontVariantNumeric: "tabular-nums" }}>{r.pct}%</span>
                      <span style={{ fontSize: 12, color: INK2 }}>{r.voltaram} de {r.base} voltaram · {r.novos} novos</span>
                    </div>
                    <div style={{ height: 6, background: "#201b18", borderRadius: 3, marginTop: 6, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${Math.min(100, r.pct)}%`, background: VERDE, borderRadius: 3 }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {selecionadas.length < 2 && (
            <p style={{ color: INK2, fontSize: 12, marginTop: 14, lineHeight: 1.5 }}>Escolhe pelo menos duas competições para ver a retenção entre elas.</p>
          )}
        </>
      )}
    </Moldura>
  );
}

// ---------------------------------------------------------------------------
// GRÁFICO DE BARRAS (SVG) — série única (jogadores), com linha de referência nos
// registos. Rótulos diretos em cada barra; sem legenda (o título nomeia a série).
// Escala em viewBox, largura 100% — responsivo no telemóvel.
// ---------------------------------------------------------------------------
function GraficoBarras({ itens, registos }: { itens: Comp[]; registos: number }) {
  const W = 640, H = 300;
  const mL = 40, mR = 16, mT = 30, mB = 54;
  const pw = W - mL - mR, ph = H - mT - mB;
  const n = Math.max(1, itens.length);
  const maxVal = Math.max(registos, ...itens.map((i) => i.jogadores), 1);
  // "folga" no topo para o rótulo não colar.
  const topo = maxVal * 1.12;
  const y = (v: number) => mT + ph * (1 - v / topo);
  const faixa = pw / n;
  const bw = Math.min(64, faixa * 0.56);
  const yReg = y(registos);

  // 3 linhas de grelha discretas.
  const ticks = [0, Math.round(topo / 2), Math.round(topo)];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", fontVariantNumeric: "tabular-nums" }} role="img" aria-label="Jogadores por competição comparado ao total de registos">
      {/* grelha + eixo Y */}
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={mL} y1={y(t)} x2={W - mR} y2={y(t)} stroke={BORDA} strokeWidth={1} />
          <text x={mL - 6} y={y(t) + 3} textAnchor="end" fontSize={10} fill={INK2}>{t}</text>
        </g>
      ))}

      {/* barras */}
      {itens.map((c, i) => {
        const cx = mL + faixa * i + faixa / 2;
        const yTop = y(c.jogadores);
        const altura = (mT + ph) - yTop;
        const cor = c.teste ? CINZA : GOLD;
        const pct = registos > 0 ? Math.round((c.jogadores / registos) * 100) : 0;
        const nomeCurto = c.nome.length > 16 ? c.nome.slice(0, 15) + "…" : c.nome;
        return (
          <g key={c.id}>
            <rect x={cx - bw / 2} y={yTop} width={bw} height={Math.max(2, altura)} rx={4} fill={cor} />
            {/* valor + % em cima */}
            <text x={cx} y={yTop - 12} textAnchor="middle" fontSize={13} fontWeight={700} fill={INK}>{c.jogadores}</text>
            <text x={cx} y={yTop - 1} textAnchor="middle" fontSize={10} fill={INK2}>{pct}%</text>
            {/* rótulo da competição */}
            <text x={cx} y={mT + ph + 16} textAnchor="middle" fontSize={10.5} fill={INK}>{nomeCurto}</text>
            {c.data_iso && <text x={cx} y={mT + ph + 30} textAnchor="middle" fontSize={9.5} fill="#5f5850">{c.data_iso}</text>}
          </g>
        );
      })}

      {/* linha de referência: registos */}
      {registos > 0 && (
        <g>
          <line x1={mL} y1={yReg} x2={W - mR} y2={yReg} stroke="#c8c0b8" strokeWidth={1.5} strokeDasharray="5 4" />
          <text x={W - mR} y={yReg - 5} textAnchor="end" fontSize={10.5} fill="#c8c0b8">Registos {registos}</text>
        </g>
      )}
    </svg>
  );
}

function Stat({ rot, val, sub, cor }: { rot: string; val: string; sub?: string; cor?: string }) {
  return (
    <div style={{ background: "#0e0c0b", border: `1px solid ${BORDA}`, borderRadius: 10, padding: "8px 12px", minWidth: 96 }}>
      <div style={{ fontSize: 18, fontWeight: 700, color: cor || INK, fontVariantNumeric: "tabular-nums" }}>
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
const titulo: React.CSSProperties = { fontFamily: "var(--font-geist-mono), monospace", fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: GOLD, marginBottom: 4 };
const subtitulo: React.CSSProperties = { fontFamily: "var(--font-geist-mono), monospace", fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "#8b9a92", marginBottom: 8 };
const botaoGhost: React.CSSProperties = { background: "transparent", color: GOLD, border: `1px solid ${GOLD}`, borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" };
const botaoMini: React.CSSProperties = { background: "transparent", color: GOLD, border: `1px solid ${BORDA}`, borderRadius: 7, padding: "4px 9px", fontSize: 11, fontWeight: 700, cursor: "pointer" };
