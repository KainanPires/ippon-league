"use client";

// app/admin/mais-escalados/page.tsx
//
// Painel "Mais escalados" — para a pessoa de social media criar conteúdo.
//
// PORQUÊ ESTA PÁGINA (e não partilhar o link ?key=): o link com ?key leva o
// CRON_SECRET, a senha-mestra de todos os crons — num print ficaria exposta. Aqui
// a barreira é o LOGIN + o papel: quem tiver `is_admin` OU `is_conteudo` na conta
// vê a página; o URL é só /admin/mais-escalados, sem segredos. Para dar acesso a
// alguém, põe-lhe is_conteudo = true (SQL). Para trocar de pessoa, tira a uma e
// dá a outra. A verdadeira barreira é no servidor (a rota /api/admin/mais-escalados
// confirma o papel pelo token); aqui só se mostra/esconde a UI.
//
// Mostra o "time mais escalado" da RODADA, do MÊS e do ANO, com nº de escalações,
// % (ou em quantas competições, no ano/mês) e o capitão mais escolhido. Tem botão
// para copiar uma legenda pronta e para atualizar.

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const GOLD = "#d9a441";
const FUNDO = "#141110";
const CARTAO = "#1e1a17";
const BORDA = "#2c2622";
const VERDE = "#8bd4b0";

type Escopo = "comp" | "mes" | "ano";

interface Linha {
  id: string;
  nome: string;
  pais: string;
  categoria: string;
  escolhas: number;
  pct: number;
  competicoes: number;
  capitao: number;
  capitaoPct: number;
}
interface Agg {
  ok: boolean;
  erro?: string;
  escopo: Escopo;
  rotulo: string;
  total_times: number;
  ranking: Linha[];
  top_capitaes: Linha[];
  atualizado_em: string;
  do_cache?: boolean;
}

const ABAS: { v: Escopo; r: string }[] = [
  { v: "comp", r: "Rodada" },
  { v: "mes", r: "Mês" },
  { v: "ano", r: "Ano" },
];
const TITULO: Record<Escopo, string> = { comp: "Time mais escalado", mes: "Time do mês", ano: "Time do ano" };

export default function MaisEscaladosPage() {
  const [acesso, setAcesso] = useState<"..." | "sim" | "nao">("...");
  const [escopo, setEscopo] = useState<Escopo>("comp");
  const [dados, setDados] = useState<Agg | null>(null);
  const [aCarregar, setACarregar] = useState(false);
  const [copiado, setCopiado] = useState(false);

  // Verifica sessão + papel (is_admin OU is_conteudo).
  useEffect(() => {
    let vivo = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user?.id;
      if (!uid) { if (vivo) setAcesso("nao"); return; }
      const { data: u } = await supabase.from("users").select("is_admin, is_conteudo").eq("id", uid).maybeSingle();
      if (!vivo) return;
      setAcesso(u?.is_admin || u?.is_conteudo ? "sim" : "nao");
    })();
    return () => { vivo = false; };
  }, []);

  const carregar = useCallback(async (e: Escopo) => {
    setACarregar(true);
    try {
      const { data } = await supabase.auth.getSession();
      const tk = data.session?.access_token || "";
      const r = await fetch(`/api/admin/mais-escalados?escopo=${e}`, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${tk}` },
      });
      const j = (await r.json()) as Agg;
      setDados(j);
    } catch {
      setDados({ ok: false, erro: "Falha de rede.", escopo: e, rotulo: "", total_times: 0, ranking: [], top_capitaes: [], atualizado_em: "" });
    } finally {
      setACarregar(false);
    }
  }, []);

  useEffect(() => {
    if (acesso === "sim") void carregar(escopo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acesso, escopo]);

  const porAno = escopo !== "comp"; // ano/mês mostram "competições" em vez de %

  function legenda(): string {
    if (!dados || !dados.ok) return "";
    const top = dados.ranking.slice(0, 8);
    const linhas = top.map((l, i) => {
      const extra = porAno ? `${l.escolhas} escalações` : `${l.escolhas} escalações (${l.pct}%)`;
      return `${i + 1}. ${l.nome}${l.pais ? ` (${l.pais})` : ""} — ${extra}`;
    });
    const cap = dados.top_capitaes[0];
    const capLinha = cap ? `\n\n⭐ Capitão mais escolhido: ${cap.nome}${cap.pais ? ` (${cap.pais})` : ""}` : "";
    return `🥋 ${TITULO[escopo]} — ${dados.rotulo}\n\n${linhas.join("\n")}${capLinha}`;
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(legenda());
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1600);
    } catch { /* sem clipboard */ }
  }

  if (acesso === "...") return <Moldura><p style={{ color: "#9a938c" }}>A carregar…</p></Moldura>;
  if (acesso === "nao") {
    return (
      <Moldura>
        <h1 style={{ color: GOLD, fontSize: 20, margin: 0 }}>Sem acesso</h1>
        <p style={{ color: "#9a938c", lineHeight: 1.6 }}>
          Esta página é para a equipa de conteúdo. Pede ao administrador para ativar o teu acesso
          (precisas de ter sessão iniciada na tua conta Ippon League).
        </p>
      </Moldura>
    );
  }

  const quando = dados?.atualizado_em ? new Date(dados.atualizado_em) : null;
  const quandoTxt = quando && !isNaN(quando.getTime())
    ? quando.toLocaleString("pt-PT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
    : "";

  return (
    <Moldura>
      <h1 style={{ color: GOLD, fontSize: 22, margin: "0 0 4px" }}>Mais escalados</h1>
      <p style={{ color: "#c8c0b8", marginTop: 0, fontSize: 14, lineHeight: 1.5 }}>
        Os atletas que a malta mais pôs na equipa — os 8 primeiros são o “{TITULO[escopo].toLowerCase()}”.
        Troca entre <b>rodada</b>, <b>mês</b> e <b>ano</b>. Tira print ou copia a legenda pronta.
      </p>

      {/* Abas */}
      <div style={{ display: "flex", gap: 8, margin: "14px 0", flexWrap: "wrap" }}>
        {ABAS.map((a) => (
          <button key={a.v} onClick={() => setEscopo(a.v)}
            style={{ background: escopo === a.v ? GOLD : "transparent", color: escopo === a.v ? "#141110" : GOLD, border: `1px solid ${GOLD}`, borderRadius: 999, padding: "7px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            {a.r}
          </button>
        ))}
        <button onClick={() => void carregar(escopo)}
          style={{ background: "transparent", color: "#9a938c", border: `1px solid ${BORDA}`, borderRadius: 999, padding: "7px 14px", fontSize: 13, cursor: "pointer" }}>
          ↻ atualizar
        </button>
      </div>

      <div style={caixa}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div style={titulo}>{TITULO[escopo]} · {dados?.rotulo || "…"}</div>
          <div style={{ fontSize: 11.5, color: "#8b8079" }}>
            {dados ? `${dados.total_times} escalação(ões)` : ""}{quandoTxt ? ` · ${quandoTxt}` : ""}
          </div>
        </div>

        {aCarregar && <p style={{ color: "#9a938c", fontSize: 13 }}>A carregar…</p>}
        {dados && !dados.ok && <p style={{ color: "#ef8d83", fontSize: 13 }}>{dados.erro || "Não foi possível carregar."}</p>}
        {dados && dados.ok && dados.total_times === 0 && (
          <p style={{ color: "#9a938c", fontSize: 13 }}>Ainda ninguém escalou neste período.</p>
        )}

        {dados && dados.ok && dados.total_times > 0 && (
          <>
            <button onClick={copiar}
              style={{ margin: "12px 0", background: GOLD, color: "#141110", border: "none", borderRadius: 10, padding: "10px 16px", fontWeight: 700, fontSize: 13.5, cursor: "pointer" }}>
              {copiado ? "Legenda copiada!" : "Copiar legenda para post"}
            </button>

            {/* Ranking */}
            <div style={{ display: "grid", gap: 2 }}>
              <Cabecalho porAno={porAno} />
              {dados.ranking.map((l, i) => (
                <LinhaRank key={l.id} l={l} i={i} porAno={porAno} top8={i < 8} />
              ))}
            </div>

            {/* Capitães */}
            {dados.top_capitaes.length > 0 && (
              <>
                <div style={{ ...titulo, marginTop: 20 }}>Capitães mais escolhidos</div>
                <div style={{ display: "grid", gap: 2 }}>
                  {dados.top_capitaes.map((l, i) => (
                    <div key={l.id} style={{ display: "grid", gridTemplateColumns: "26px 1fr auto", gap: 8, alignItems: "baseline", padding: "7px 2px", borderBottom: `1px solid ${BORDA}` }}>
                      <span style={{ color: "#8b8079", fontSize: 12, textAlign: "center" }}>{i + 1}</span>
                      <span style={{ color: "#efeadd", fontSize: 13.5 }}>
                        {l.nome}{l.pais ? <span style={{ color: "#8b8079", fontSize: 11 }}> {l.pais}</span> : null}
                      </span>
                      <span style={{ color: GOLD, fontSize: 13.5, fontWeight: 700, whiteSpace: "nowrap" }}>{l.capitao}×</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>

      <p style={{ fontSize: 11.5, color: "#8b8079", marginTop: 14, lineHeight: 1.6 }}>
        “{porAno ? "Comp." : "%"}” {porAno ? "= em quantas competições o atleta foi escalado." : "= percentagem de equipas que o escalaram nesta rodada."}
        {" "}Os dados atualizam sozinhos de hora a hora.
      </p>
    </Moldura>
  );
}

function Cabecalho({ porAno }: { porAno: boolean }) {
  const st: React.CSSProperties = { fontSize: 10.5, color: "#8b9a92", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 700 };
  return (
    <div style={{ display: "grid", gridTemplateColumns: "26px 1fr auto auto auto", gap: 8, padding: "0 2px 6px", borderBottom: `1px solid ${BORDA}` }}>
      <span style={{ ...st, textAlign: "center" }}>#</span>
      <span style={st}>Atleta</span>
      <span style={{ ...st, textAlign: "right" }}>Escal.</span>
      <span style={{ ...st, textAlign: "right" }}>{porAno ? "Comp." : "%"}</span>
      <span style={{ ...st, textAlign: "right" }}>Cap.</span>
    </div>
  );
}

function LinhaRank({ l, i, porAno, top8 }: { l: Linha; i: number; porAno: boolean; top8: boolean }) {
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "26px 1fr auto auto auto", gap: 8, alignItems: "baseline",
      padding: "8px 4px", borderBottom: `1px solid ${BORDA}`,
      background: top8 ? "rgba(217,164,65,.07)" : "transparent", borderRadius: top8 ? 6 : 0,
    }}>
      <span style={{ color: "#8b8079", fontSize: 12, textAlign: "center" }}>{i + 1}</span>
      <span style={{ color: "#efeadd", fontSize: 13.5, fontWeight: top8 ? 700 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {l.nome}
        {l.pais ? <span style={{ color: "#8b8079", fontSize: 11, fontWeight: 400 }}> {l.pais}</span> : null}
        {l.categoria ? <span style={{ color: "#6b625a", fontSize: 11, fontWeight: 400 }}> · {l.categoria}</span> : null}
      </span>
      <span style={{ color: "#efeadd", fontSize: 13.5, textAlign: "right", fontWeight: 700, whiteSpace: "nowrap" }}>{l.escolhas}</span>
      <span style={{ color: GOLD, fontSize: 13, textAlign: "right", fontWeight: 700, whiteSpace: "nowrap" }}>
        {porAno ? l.competicoes : `${l.pct}%`}
      </span>
      <span style={{ color: l.capitao ? VERDE : "#4f4842", fontSize: 12.5, textAlign: "right", whiteSpace: "nowrap" }}>
        {l.capitao ? `${l.capitao}×` : "—"}
      </span>
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
const caixa: React.CSSProperties = { background: CARTAO, border: `1px solid ${BORDA}`, borderRadius: 12, padding: 16, marginTop: 4 };
const titulo: React.CSSProperties = { fontFamily: "var(--font-geist-mono), monospace", fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: GOLD };
