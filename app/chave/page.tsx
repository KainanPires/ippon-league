"use client";

// /chave — Chave dos atletas (Pro Max), versão ÁRVORE (estilo JudoBase).
// Lê o quadro real do JudoBase via /api/chave e desenha-o como bracket:
// cada luta é uma caixa, o vencedor avança para a direita ligado por linhas em
// cotovelo. Zonas empilhadas (como "Pool A / Pool B"), mais Repescagem→Bronze e
// Meias→Final. Atualiza ao vivo (botão + auto a cada 60s).
//
// Teste: categoria fixa -48 F do Ulaanbaatar (comp 3149). Aberta a todos por
// agora; o fecho ao Pro Max entra depois de validarmos contra a realidade.

import { useState, useEffect, useCallback, useRef, useMemo, useLayoutEffect, createContext, useContext } from "react";
import type { ReactNode } from "react";
import { uid } from "@/lib/team";

const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";
const LINHA = "#3a4a42";

const COMP = "3149";
const CAT = "-48";

// Espaçamentos da árvore.
const COLGAP = 34; // espaço horizontal entre colunas (onde vivem os cotovelos)
const ROWGAP = 12; // espaço vertical entre lutas irmãs

interface Lado { id: string; nome: string; pais: string; vencedor: boolean; ippon: number; waza: number; yuko: number; shido: number }
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

// Nó da árvore: ou uma luta (com filhos à esquerda) ou um "bye" (folha sem luta).
type No =
  | { tipo: "luta"; key: string; luta: Luta; filhos: No[] }
  | { tipo: "bye"; key: string; lado: Lado };
interface Aresta { de: string; para: string }
interface Arvore { no: No; vencedor: { key: string; lado: Lado } | null }

// "BOUKLI Shirine" -> "BOUKLI". O JudoBase põe o apelido em MAIÚSCULAS primeiro.
function apelido(nome: string): string {
  const t = (nome || "").trim();
  if (!t || t === "—") return "—";
  const maiusc = t.split(/\s+/).filter((w) => w.length > 1 && w === w.toUpperCase());
  return maiusc[0] || t.split(/\s+/)[0] || t;
}

// 1 -> "A", 2 -> "B", ... (para os blocos).
function letraBloco(n: number): string {
  return String.fromCharCode(64 + n); // 65 = "A"
}

// Marcador real do judô deste atleta na luta, escondendo os zeros.
// Ex.: [{rotulo:"Ippon", n:1}, {rotulo:"Waza", n:2}, {rotulo:"Shido", n:1}]
function marcadorDoLado(l: Lado): { rotulo: string; n: number; aviso?: boolean }[] {
  const out: { rotulo: string; n: number; aviso?: boolean }[] = [];
  if (l.ippon > 0) out.push({ rotulo: "Ippon", n: l.ippon });
  if (l.waza > 0) out.push({ rotulo: l.waza > 1 ? "Waza-ari" : "Waza-ari", n: l.waza });
  if (l.yuko > 0) out.push({ rotulo: "Yuko", n: l.yuko });
  if (l.shido > 0) out.push({ rotulo: "Shido", n: l.shido, aviso: true });
  return out;
}

// Constrói a(s) árvore(s) de um bloco de lutas + a lista de arestas (ligações).
function montarBloco(lutas: Luta[], mostrarVencedor: boolean): { arvores: Arvore[]; arestas: Aresta[] } {
  const arestas: Aresta[] = [];
  if (lutas.length === 0) return { arvores: [], arestas };
  const rounds = lutas.map((l) => Number(l.round));
  const roundMax = Math.max(...rounds);
  const roundMin = Math.min(...rounds);
  const raizes = lutas.filter((l) => Number(l.round) === roundMin);

  function construir(luta: Luta): No {
    if (Number(luta.round) >= roundMax) return { tipo: "luta", key: luta.id, luta, filhos: [] };
    const filhos: No[] = [];
    for (const lado of [luta.azul, luta.branco]) {
      let alim: Luta | undefined;
      if (lado.id) {
        alim = lutas.find(
          (l) => l.id !== luta.id && Number(l.round) === Number(luta.round) + 1 &&
            (l.azul.id === lado.id || l.branco.id === lado.id)
        );
      }
      if (alim) {
        const f = construir(alim);
        filhos.push(f);
        arestas.push({ de: f.key, para: luta.id });
      } else {
        const k = `bye-${luta.id}-${lado.id || filhos.length}`;
        filhos.push({ tipo: "bye", key: k, lado });
        arestas.push({ de: k, para: luta.id });
      }
    }
    return { tipo: "luta", key: luta.id, luta, filhos };
  }

  const arvores: Arvore[] = raizes.map((r) => {
    const no = construir(r);
    let vencedor: { key: string; lado: Lado } | null = null;
    if (mostrarVencedor && r.decidida) {
      const v = r.azul.vencedor ? r.azul : r.branco.vencedor ? r.branco : null;
      if (v) {
        const vk = `venc-${r.id}`;
        vencedor = { key: vk, lado: v };
        arestas.push({ de: r.id, para: vk });
      }
    }
    return { no, vencedor };
  });

  return { arvores, arestas };
}

// Contexto dos favoritos: evita passar props por todos os níveis da árvore.
// favoritos = conjunto de id_person marcados; alternar = marca/desmarca.
interface FavCtx {
  favoritos: Set<string>;
  pendentes: Set<string>;            // a meio de gravar (evita duplo-clique)
  alternar: (lado: Lado) => void;
  ativo: boolean;                    // há sessão? (sem sessão, escondemos a estrela)
}
const FavoritosContexto = createContext<FavCtx | null>(null);

export default function ChavePage() {
  const [dados, setDados] = useState<ChaveResp | null>(null);
  const [aCarregar, setACarregar] = useState(true);
  const [erro, setErro] = useState("");
  const [quando, setQuando] = useState("");

  // Favoritos do utilizador (id_person). Carregados da conta ao abrir.
  const [favoritos, setFavoritos] = useState<Set<string>>(new Set());
  const [pendentes, setPendentes] = useState<Set<string>>(new Set());
  const [userId, setUserId] = useState<string>("anon");

  useEffect(() => {
    const u = uid();
    setUserId(u);
    if (u === "anon") return;
    (async () => {
      try {
        const r = await fetch(`/api/favoritos?user_id=${encodeURIComponent(u)}`, { cache: "no-store" });
        const j = await r.json();
        if (j.ok && Array.isArray(j.favoritos)) {
          setFavoritos(new Set(j.favoritos.map((f: { id_person: string }) => String(f.id_person))));
        }
      } catch { /* sem favoritos: segue */ }
    })();
  }, []);

  // Alterna um favorito (otimista: muda já no ecrã, confirma com o servidor).
  const alternar = useCallback((lado: Lado) => {
    const u = userId;
    if (u === "anon" || !lado.id) return;
    const id = lado.id;
    setPendentes((p) => { const n = new Set(p); n.add(id); return n; });
    // Atualização otimista.
    setFavoritos((f) => {
      const n = new Set(f);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
    (async () => {
      try {
        const r = await fetch("/api/favoritos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: u, id_person: id, nome: lado.nome, country_code: lado.pais }),
        });
        const j = await r.json();
        // Reconcilia com o estado real que o servidor devolveu.
        if (j.ok) {
          setFavoritos((f) => {
            const n = new Set(f);
            if (j.favorito) n.add(id); else n.delete(id);
            return n;
          });
        } else {
          // Falhou: desfaz a mudança otimista.
          setFavoritos((f) => {
            const n = new Set(f);
            if (n.has(id)) n.delete(id); else n.add(id);
            return n;
          });
        }
      } catch {
        setFavoritos((f) => {
          const n = new Set(f);
          if (n.has(id)) n.delete(id); else n.add(id);
          return n;
        });
      } finally {
        setPendentes((p) => { const n = new Set(p); n.delete(id); return n; });
      }
    })();
  }, [userId]);

  const favCtx: FavCtx = useMemo(
    () => ({ favoritos, pendentes, alternar, ativo: userId !== "anon" }),
    [favoritos, pendentes, alternar, userId]
  );

  const carregar = useCallback(async () => {
    try {
      const r = await fetch(`/api/chave?comp=${COMP}&cat=${encodeURIComponent(CAT)}`, { cache: "no-store" });
      const j: ChaveResp = await r.json();
      if (!j.ok) { setErro(j.erro || "Não foi possível carregar a chave."); setACarregar(false); return; }
      setDados(j); setErro("");
      setQuando(new Date().toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" }));
    } catch {
      setErro("Falha de ligação ao carregar a chave.");
    }
    setACarregar(false);
  }, []);

  useEffect(() => {
    carregar();
    const t = setInterval(carregar, 60000);
    return () => clearInterval(t);
  }, [carregar]);

  const semisEFinal = useMemo(() => {
    const m = dados?.meias || [];
    return dados?.final ? [...m, dados.final] : m;
  }, [dados]);

  return (
    <FavoritosContexto.Provider value={favCtx}>
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: FB }}>
      <style>{`
        @keyframes ilpulse{0%,100%{opacity:1}50%{opacity:.35}}
        .ilpulse{animation:ilpulse 1.2s ease-in-out infinite}
        @media (prefers-reduced-motion: reduce){.ilpulse{animation:none}}
        .il-scroll::-webkit-scrollbar{height:8px}
        .il-scroll::-webkit-scrollbar-thumb{background:#243029;border-radius:8px}
      `}</style>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "16px 14px 60px" }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
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

        <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "10px 0 8px" }}>
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
            {(dados?.zonas || []).map((z) => (
              <Bloco key={z.zona} titulo={`Bloco ${letraBloco(z.zona)}`} lutas={z.lutas} mostrarVencedor rotuloVencedor="Vencedora" />
            ))}
            <Bloco titulo="Repescagem e Bronze" lutas={dados?.bronzes || []} mostrarVencedor rotuloVencedor="🥉 Bronze" />
            <Bloco titulo="Meias-finais e Final" lutas={semisEFinal} mostrarVencedor rotuloVencedor="🥇 Campeã" />
          </>
        )}
      </div>
    </main>
    </FavoritosContexto.Provider>
  );
}

// Um bloco = uma ou mais árvores empilhadas, com conectores em cotovelo medidos.
function Bloco({ titulo, lutas, mostrarVencedor, rotuloVencedor }: { titulo: string; lutas: Luta[]; mostrarVencedor: boolean; rotuloVencedor: string }) {
  const { arvores, arestas } = useMemo(() => montarBloco(lutas, mostrarVencedor), [lutas, mostrarVencedor]);
  const innerRef = useRef<HTMLDivElement | null>(null);
  const refs = useRef<Map<string, HTMLElement>>(new Map());
  const [paths, setPaths] = useState<string[]>([]);

  const setRef = useCallback((key: string) => (el: HTMLElement | null) => {
    const m = refs.current;
    if (el) m.set(key, el); else m.delete(key);
  }, []);

  const calcular = useCallback(() => {
    const inner = innerRef.current;
    if (!inner) return;
    const ir = inner.getBoundingClientRect();
    const novos: string[] = [];
    for (const a of arestas) {
      const de = refs.current.get(a.de);
      const para = refs.current.get(a.para);
      if (!de || !para) continue;
      const dr = de.getBoundingClientRect();
      const pr = para.getBoundingClientRect();
      const x1 = dr.right - ir.left;
      const y1 = dr.top - ir.top + dr.height / 2;
      const x2 = pr.left - ir.left;
      const y2 = pr.top - ir.top + pr.height / 2;
      const xm = (x1 + x2) / 2;
      novos.push(`M ${x1} ${y1} H ${xm} V ${y2} H ${x2}`);
    }
    setPaths(novos);
  }, [arestas]);

  useLayoutEffect(() => {
    calcular();
    const inner = innerRef.current;
    let ro: ResizeObserver | null = null;
    if (inner && typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => calcular());
      ro.observe(inner);
    }
    const onR = () => calcular();
    window.addEventListener("resize", onR);
    const t = setTimeout(calcular, 80); // re-medir após fontes/layout assentarem
    return () => { if (ro) ro.disconnect(); window.removeEventListener("resize", onR); clearTimeout(t); };
  }, [calcular, lutas]);

  // Render recursivo: filhos à esquerda (coluna centrada), caixa à direita.
  const renderNo = (no: No): ReactNode => {
    if (no.tipo === "bye") {
      return <div key={no.key} ref={setRef(no.key)}><CaixaBye lado={no.lado} /></div>;
    }
    return (
      <div key={no.key} style={{ display: "flex", alignItems: "center", gap: COLGAP }}>
        {no.filhos.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: ROWGAP }}>
            {no.filhos.map((f) => renderNo(f))}
          </div>
        )}
        <div ref={setRef(no.key)}><CaixaLuta luta={no.luta} /></div>
      </div>
    );
  };

  return (
    <section style={{ marginTop: 26 }}>
      <div style={{ fontFamily: FD, fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#cfd8d2", marginBottom: 12 }}>
        {titulo}
      </div>
      {arvores.length === 0 ? (
        <Vazio texto="Sem lutas nesta fase ainda." />
      ) : (
        <div className="il-scroll" style={{ overflowX: "auto", paddingBottom: 8 }}>
          <div ref={innerRef} style={{ position: "relative", width: "max-content", display: "flex", flexDirection: "column", gap: 22 }}>
            <svg style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", overflow: "visible" }} aria-hidden="true">
              {paths.map((d, i) => <path key={i} d={d} fill="none" stroke={LINHA} strokeWidth={1.5} />)}
            </svg>
            {arvores.map((a, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: COLGAP, position: "relative" }}>
                {renderNo(a.no)}
                {a.vencedor && (
                  <div ref={setRef(a.vencedor.key)}>
                    <CaixaVencedor lado={a.vencedor.lado} rotulo={rotuloVencedor} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
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
    <div style={{ background: "#0f1411", border: "1px dashed #2a3a33", borderRadius: 12, padding: "14px", fontSize: 12.5, color: "#7c8a82", lineHeight: 1.5, width: "max-content", maxWidth: "100%" }}>
      {texto}
    </div>
  );
}

const CAIXA_W = 184;

function CaixaLuta({ luta }: { luta: Luta }) {
  return (
    <div style={{ width: CAIXA_W, background: "#121815", border: "1px solid #243029", borderRadius: 10, overflow: "hidden" }}>
      <LinhaLado lado={luta.azul} />
      <div style={{ height: 1, background: "#1a221d" }} />
      <LinhaLado lado={luta.branco} />
    </div>
  );
}

// Bye: a atleta que entrou direto (isenta na 1ª ronda). Uma só linha, neutra.
function CaixaBye({ lado }: { lado: Lado }) {
  return (
    <div style={{ width: CAIXA_W, background: "#0f1411", border: "1px dashed #2a3a33", borderRadius: 10 }}>
      <LinhaLado lado={{ ...lado, vencedor: false }} esmaecido semMarcador />
    </div>
  );
}

function CaixaVencedor({ lado, rotulo }: { lado: Lado; rotulo: string }) {
  const dourado = rotulo.includes("Campeã");
  const borda = dourado ? GOLD : rotulo.includes("Bronze") ? "#9a6b3a" : "#2f3d35";
  return (
    <div style={{ width: CAIXA_W, background: "#141a17", border: `1px solid ${borda}`, borderRadius: 10, overflow: "hidden" }}>
      <div style={{ fontSize: 9, color: "#7c8a82", textTransform: "uppercase", letterSpacing: "0.07em", padding: "4px 9px 0" }}>{rotulo}</div>
      <LinhaLado lado={{ ...lado, vencedor: true }} semMarcador />
    </div>
  );
}

function LinhaLado({ lado, esmaecido, semMarcador }: { lado: Lado; esmaecido?: boolean; semMarcador?: boolean }) {
  const venceu = lado.vencedor;
  const cor = esmaecido ? "#6b7a72" : venceu ? "#f1ede2" : "#a9b4ac";
  const acoes = semMarcador ? [] : marcadorDoLado(lado);
  // Contorno dourado a destacar o vencedor — só nas lutas reais (não na caixa do
  // vencedor da fase nem no bye, que já têm destaque próprio).
  const destaque = venceu && !semMarcador;
  // Favoritos: só nas lutas reais, com sessão e com atleta identificado.
  const fav = useContext(FavoritosContexto);
  const mostraEstrela = !semMarcador && !esmaecido && !!fav?.ativo && !!lado.id;
  const ehFavorito = mostraEstrela && fav!.favoritos.has(lado.id);
  const aGravar = mostraEstrela && fav!.pendentes.has(lado.id);
  return (
    <div style={{
      padding: "7px 9px",
      margin: destaque ? 3 : 0,
      borderRadius: destaque ? 8 : 0,
      border: destaque ? `1px solid ${GOLD}` : "1px solid transparent",
      background: destaque ? "rgba(217,164,65,0.10)" : "transparent",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontFamily: FD, fontSize: 10, fontWeight: 700, color: venceu ? GOLD : "#7c8a82", width: 28, flexShrink: 0, letterSpacing: "0.03em" }}>
          {lado.pais}
        </span>
        <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: venceu ? 700 : 400, color: cor, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {apelido(lado.nome)}
        </span>
        {venceu && <span aria-label="venceu" style={{ color: GOLD, fontSize: 12, flexShrink: 0 }}>▸</span>}
        {mostraEstrela && (
          <button
            type="button"
            onClick={() => fav!.alternar(lado)}
            disabled={aGravar}
            aria-label={ehFavorito ? "Remover dos favoritos" : "Adicionar aos favoritos"}
            aria-pressed={ehFavorito}
            title={ehFavorito ? "Nos teus atletas" : "Seguir este atleta"}
            style={{
              background: "transparent", border: "none", cursor: aGravar ? "default" : "pointer",
              padding: 0, marginLeft: 2, flexShrink: 0, lineHeight: 1,
              fontSize: 14, color: ehFavorito ? GOLD : "#5f6f67",
              opacity: aGravar ? 0.5 : 1, transition: "color .15s",
            }}
          >
            {ehFavorito ? "★" : "☆"}
          </button>
        )}
      </div>
      {acoes.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4, paddingLeft: 36 }}>
          {acoes.map((a, i) => (
            <span key={i} style={{
              fontFamily: FD, fontSize: 9, fontWeight: 700, letterSpacing: "0.02em",
              color: a.aviso ? "#e0a96d" : "#9fb0a6",
              background: a.aviso ? "rgba(224,169,109,0.12)" : "rgba(159,176,166,0.10)",
              border: `1px solid ${a.aviso ? "rgba(224,169,109,0.35)" : "rgba(159,176,166,0.22)"}`,
              borderRadius: 5, padding: "1px 5px", whiteSpace: "nowrap",
            }}>
              {a.n > 1 ? `${a.n} ` : ""}{a.rotulo}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
