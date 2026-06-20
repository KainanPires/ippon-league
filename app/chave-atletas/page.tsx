"use client";

// app/chave-atletas/page.tsx
//
// CHAVE DE ATLETAS (Pro Max) — mostra o quadro de uma categoria, ao vivo.
// Lê /api/chave-atletas?comp=&cat= (que corre o motor) e desenha pools, meias,
// final, repescagens e bronzes. Atualiza sozinha a cada 60s.
//
// Acesso: só Pro Max. Pro normal e grátis são redirecionados.

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { focoMercado } from "@/lib/calendario";

const GOLD = "#d9a441";
const FUNDO = "#0c0e0d";
const VERDE = "#7fd1a3";

// 14 categorias olímpicas (M em cima, F em baixo).
const CATS_M = ["-60", "-66", "-73", "-81", "-90", "-100", "+100"];
const CATS_F = ["-48", "-52", "-57", "-63", "-70", "-78", "+78"];

type Lugar = { id: string | null; nome?: string; pais?: string };
type Luta = {
  fase: string; pool?: string; rotulo: string;
  azul: Lugar; branco: Lugar; vencedor: string | null; estado: string;
};
type Chave = {
  pools: Record<string, { vencedor: string | null; lutas: Luta[] }>;
  meias: Luta[]; final: Luta | null;
  repescagens: Luta[]; bronzes: Luta[];
  campeao: string | null; vice: string | null; terceiros: string[];
};

function Bandeira({ pais }: { pais?: string }) {
  if (!pais) return null;
  return <span style={{ fontSize: 11, opacity: 0.75, fontWeight: 700, letterSpacing: 0.5 }}>{pais}</span>;
}

function sobrenome(nome?: string): string {
  if (!nome) return "—";
  const p = nome.trim().split(/\s+/);
  return p[p.length - 1] || nome;
}

// Um lado de um confronto (azul/branco), com destaque para o vencedor.
function LadoLuta({ lugar, venceu, decidida }: { lugar: Lugar; venceu: boolean; decidida: boolean }) {
  const vazio = !lugar.id;
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      gap: 8, padding: "6px 9px",
      background: venceu ? "rgba(127,209,163,0.14)" : "rgba(255,255,255,0.03)",
      borderLeft: `3px solid ${venceu ? VERDE : "transparent"}`,
      borderRadius: 4, minWidth: 0,
    }}>
      <span style={{
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        fontWeight: venceu ? 700 : 500,
        color: vazio ? "rgba(255,255,255,0.3)" : (decidida && !venceu ? "rgba(255,255,255,0.45)" : "#f3f0ea"),
        fontSize: 13,
      }}>
        {vazio ? "—" : sobrenome(lugar.nome)}
      </span>
      <Bandeira pais={lugar.pais} />
    </div>
  );
}

function CartaoLuta({ luta }: { luta: Luta }) {
  const decidida = luta.estado === "decidida" && !!luta.vencedor;
  const venceuAzul = decidida && luta.vencedor === luta.azul.id;
  const venceuBranco = decidida && luta.vencedor === luta.branco.id;
  return (
    <div style={{
      border: "1px solid rgba(255,255,255,0.08)", borderRadius: 7,
      padding: 4, display: "grid", gap: 3, background: "rgba(255,255,255,0.015)",
    }}>
      <LadoLuta lugar={luta.azul} venceu={venceuAzul} decidida={decidida} />
      <LadoLuta lugar={luta.branco} venceu={venceuBranco} decidida={decidida} />
    </div>
  );
}

function Seccao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{
        fontFamily: "var(--font-geist-mono)", textTransform: "uppercase",
        letterSpacing: 1.5, fontSize: 12, color: GOLD, marginBottom: 8, fontWeight: 600,
      }}>{titulo}</div>
      {children}
    </div>
  );
}

export default function ChaveAtletasPage() {
  const router = useRouter();
  const [estado, setEstado] = useState<"verificar" | "ok" | "negado">("verificar");
  const foco = focoMercado();
  // Competição a decorrer (se houver) ou a da semana.
  const compInicial = foco.aDecorrer?.idCompeticao || foco.atual.idCompeticao;
  const [comp] = useState(compInicial);
  const [cat, setCat] = useState("-73");
  const [chave, setChave] = useState<Chave | null>(null);
  const [existeMoldura, setExisteMoldura] = useState<boolean | null>(null);
  const [aCarregar, setACarregar] = useState(false);

  // Verificação de acesso (só Pro Max).
  useEffect(() => {
    let vivo = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!vivo) return;
      const meta = (data.user?.user_metadata || {}) as Record<string, unknown>;
      const ehProMax = Boolean(meta.is_pro_max);
      if (ehProMax) { setEstado("ok"); return; }
      // Sem Pro Max: manda para a página certa conforme o nível.
      const ehPro = Boolean(meta.is_pro);
      setEstado("negado");
      router.replace(ehPro ? "/pro" : "/ippon-pro");
    });
    return () => { vivo = false; };
  }, [router]);

  const carregar = useCallback(async () => {
    setACarregar(true);
    try {
      const r = await fetch(`/api/chave-atletas?comp=${encodeURIComponent(comp)}&cat=${encodeURIComponent(cat)}`, { cache: "no-store" });
      const j = await r.json();
      if (j?.ok) {
        setExisteMoldura(!!j.existeMoldura);
        setChave(j.chave || null);
      }
    } catch { /* silencioso */ }
    setACarregar(false);
  }, [comp, cat]);

  useEffect(() => {
    if (estado !== "ok") return;
    setChave(null);
    setExisteMoldura(null);
    carregar();
    const t = setInterval(carregar, 60000); // auto-refresh 60s
    return () => clearInterval(t);
  }, [estado, carregar]);

  if (estado === "verificar") {
    return <div style={{ padding: 24, color: "rgba(255,255,255,0.6)" }}>A verificar acesso…</div>;
  }
  if (estado === "negado") {
    return <div style={{ padding: 24, color: "rgba(255,255,255,0.6)" }}>A redirecionar…</div>;
  }

  const nome = (id: string | null) => {
    if (!id || !chave) return "—";
    // procura a identidade nas lutas
    for (const p of Object.values(chave.pools)) for (const l of p.lutas) {
      if (l.azul.id === id) return sobrenome(l.azul.nome);
      if (l.branco.id === id) return sobrenome(l.branco.nome);
    }
    for (const l of [...chave.meias, chave.final, ...chave.repescagens, ...chave.bronzes]) {
      if (!l) continue;
      if (l.azul.id === id) return sobrenome(l.azul.nome);
      if (l.branco.id === id) return sobrenome(l.branco.nome);
    }
    return id;
  };

  return (
    <div style={{ background: FUNDO, minHeight: "100vh", color: "#f3f0ea", padding: "16px 14px 60px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <h1 style={{ fontFamily: "var(--font-geist-mono)", fontSize: 22, margin: 0, letterSpacing: 0.5 }}>
            Chave ao vivo
          </h1>
          <span style={{
            fontSize: 10, fontWeight: 700, color: "#7fb8f5", border: "1px solid #7fb8f5",
            borderRadius: 4, padding: "1px 6px", letterSpacing: 0.5,
          }}>PRO MAX</span>
        </div>
        <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 13, marginTop: 0, marginBottom: 14 }}>
          O quadro monta-se sozinho conforme os resultados chegam.{aCarregar ? " A atualizar…" : ""}
        </p>

        {/* Seletor de categorias: 2 filas (M em cima, F em baixo), 7 colunas */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 5, marginBottom: 6 }}>
          {CATS_M.map((c) => <BotaoCat key={c} c={c} ativo={c === cat} onClick={() => setCat(c)} />)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 5, marginBottom: 20 }}>
          {CATS_F.map((c) => <BotaoCat key={c} c={c} ativo={c === cat} onClick={() => setCat(c)} />)}
        </div>

        {existeMoldura === false && (
          <div style={{
            padding: 20, textAlign: "center", color: "rgba(255,255,255,0.5)",
            border: "1px dashed rgba(255,255,255,0.15)", borderRadius: 8,
          }}>
            A chave desta categoria ainda não está disponível.
          </div>
        )}

        {chave && existeMoldura && (
          <>
            {/* Pódio (se houver) */}
            {(chave.campeao || chave.vice || chave.terceiros.length > 0) && (
              <div style={{
                display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 20,
                padding: "10px 12px", borderRadius: 8,
                background: "rgba(217,164,65,0.08)", border: `1px solid ${GOLD}`,
              }}>
                {chave.campeao && <Medalha cor={GOLD} txt="1º" nome={nome(chave.campeao)} />}
                {chave.vice && <Medalha cor="#c8ccd2" txt="2º" nome={nome(chave.vice)} />}
                {chave.terceiros.map((t, i) => <Medalha key={i} cor="#cd7f32" txt="3º" nome={nome(t)} />)}
              </div>
            )}

            {/* Pools */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, marginBottom: 6 }}>
              {(["A", "B", "C", "D"] as const).map((p) => (
                <div key={p}>
                  <div style={{
                    fontFamily: "var(--font-geist-mono)", fontSize: 12, color: "rgba(255,255,255,0.6)",
                    marginBottom: 6, letterSpacing: 1,
                  }}>
                    POOL {p}{chave.pools[p]?.vencedor ? ` · ${nome(chave.pools[p].vencedor)}` : ""}
                  </div>
                  <div style={{ display: "grid", gap: 5 }}>
                    {(chave.pools[p]?.lutas || []).map((l, i) => <CartaoLuta key={i} luta={l} />)}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ height: 14 }} />

            <Seccao titulo="Meias-finais">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
                {chave.meias.map((l, i) => <CartaoLuta key={i} luta={l} />)}
              </div>
            </Seccao>

            {chave.final && (
              <Seccao titulo="Final">
                <div style={{ maxWidth: 280 }}><CartaoLuta luta={chave.final} /></div>
              </Seccao>
            )}

            <Seccao titulo="Repescagem">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
                {chave.repescagens.map((l, i) => <CartaoLuta key={i} luta={l} />)}
              </div>
            </Seccao>

            <Seccao titulo="Bronzes">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
                {chave.bronzes.map((l, i) => <CartaoLuta key={i} luta={l} />)}
              </div>
            </Seccao>
          </>
        )}
      </div>
    </div>
  );
}

function BotaoCat({ c, ativo, onClick }: { c: string; ativo: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: "7px 0", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer",
      fontFamily: "var(--font-geist-mono)",
      background: ativo ? GOLD : "rgba(255,255,255,0.05)",
      color: ativo ? "#0c0e0d" : "rgba(255,255,255,0.7)",
      border: `1px solid ${ativo ? GOLD : "rgba(255,255,255,0.1)"}`,
    }}>{c}</button>
  );
}

function Medalha({ cor, txt, nome }: { cor: string; txt: string; nome: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{
        width: 22, height: 22, borderRadius: "50%", background: cor, color: "#0c0e0d",
        display: "grid", placeItems: "center", fontSize: 11, fontWeight: 800,
      }}>{txt}</span>
      <span style={{ fontWeight: 700, fontSize: 14 }}>{nome}</span>
    </div>
  );
}
