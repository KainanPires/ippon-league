"use client";

// app/chave-atletas/page.tsx
//
// CHAVE DE ATLETAS (Pro Max) — versão ÁRVORE.
//
// CÉREBRO: o nosso motor. Lê /api/chave-atletas?comp=&cat= (motor + moldura) e
// recebe a chave já RESOLVIDA: pools[A..D].lutas (em ordem: pré → quartos →
// meias do pool → final) + meias/final/repescagens/bronzes, cada luta com
// azul/branco/vencedor/estado/chaveId. A API devolve também a `moldura`
// (pools + byes) para reconstruirmos os ramos.
//
// VISUAL: a árvore da página /chave antiga — caixas ligadas por conectores em
// cotovelo (SVG medido), caixa "Vencedor" destacada, estrela de favoritos e o
// pontinho verde da "próxima luta de cada bloco".
//
// Como ligamos os dois: em vez de adivinhar a árvore pelas rondas (como a /chave
// fazia com o JudoBase), RECONSTRUÍMOS o esqueleto do bracket a partir da moldura
// (a MESMA construção do motor: byes na posição certa) e ligamos cada nó à luta
// resolvida por índice. Assim os ramos saem exatos e os dados vêm do motor.
//
// Pontos Ippon por atleta no cartão: fica para fase seguinte (só país + nome).
//
// Acesso: só Pro Max. Pro normal e grátis são redirecionados.

import {
  useState, useEffect, useCallback, useRef, useMemo, useLayoutEffect,
  createContext, useContext,
} from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { uid } from "@/lib/team";
import { focoMercado } from "@/lib/calendario";

const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";
const LINHA = "#3a4a42";
const VERDE = "#5fd38a";
const FUNDO = "#0c0e0d";

// 14 categorias olímpicas (M em cima, F em baixo).
const CATS_M = ["-60", "-66", "-73", "-81", "-90", "-100", "+100"];
const CATS_F = ["-48", "-52", "-57", "-63", "-70", "-78", "+78"];
const CAT_INICIAL = "-73";

// Espaçamentos da árvore.
const COLGAP = 34;
const ROWGAP = 12;
const CAIXA_W = 184;

// ---- tipos do motor ----
type AcoesLuta = { i: number; w: number; y: number; s: number };
type Lugar = { id: string | null; nome?: string; pais?: string; acoes?: AcoesLuta };
type Luta = {
  fase: string; pool?: string; rotulo: string; chaveId?: string;
  azul: Lugar; branco: Lugar; vencedor: string | null; estado: string; ambigua?: boolean;
};
type Chave = {
  pools: Record<string, { vencedor: string | null; lutas: Luta[] }>;
  meias: Luta[]; final: Luta | null; repescagens: Luta[]; bronzes: Luta[];
  campeao: string | null; vice: string | null; terceiros: string[];
};
type Moldura = { pools: Record<string, string[]>; byes?: Record<string, string[]> | null };

// ---- tipos do desenho (árvore) ----
type Lado = { id: string; nome: string; pais: string; vencedor: boolean; acoes?: AcoesLuta };
type No =
  | { tipo: "luta"; key: string; luta: Luta; filhos: No[] }
  | { tipo: "bye"; key: string; lado: Lado };
type Aresta = { de: string; para: string };
type Arvore = { no: No; vencedor: { key: string; lado: Lado } | null };

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------
function sobrenome(nome?: string): string {
  const t = (nome || "").trim();
  if (!t || t === "—") return "—";
  const p = t.split(/\s+/);
  return p[p.length - 1] || t;
}

function ladoDe(lugar: Lugar | undefined, vencedorId: string | null): Lado {
  const id = lugar?.id || "";
  return { id, nome: lugar?.nome || "—", pais: lugar?.pais || "", vencedor: !!id && id === vencedorId, acoes: lugar?.acoes };
}

// Mapa id -> { nome, pais } a partir de TODAS as lutas (para pódio e byes).
function mapearNomes(chave: Chave): Record<string, { nome: string; pais: string }> {
  const m: Record<string, { nome: string; pais: string }> = {};
  const add = (lg?: Lugar) => { if (lg?.id) m[lg.id] = { nome: lg.nome || "", pais: lg.pais || "" }; };
  for (const p of Object.values(chave.pools)) for (const l of p.lutas) { add(l.azul); add(l.branco); }
  for (const l of [...chave.meias, chave.final, ...chave.repescagens, ...chave.bronzes]) {
    if (l) { add(l.azul); add(l.branco); }
  }
  return m;
}

// Construção POSICIONAL dos slots da 1ª ronda — ESPELHA o motor (byes na posição
// certa; empareia lutadores consecutivos). É isto que garante ramos iguais aos
// do quadro real.
function construirSlots(ordem: string[], byes: string[]): Array<{ bye?: string; match?: [string, string] }> {
  const isBye = (id: string) => byes.includes(id);
  const fighters = ordem.filter((id) => !isBye(id));
  const segundos = new Set<string>();
  const matchAt: Record<number, [string, string]> = {};
  for (let k = 0; k < fighters.length; k += 2) {
    const a = fighters[k];
    const b = fighters[k + 1];
    if (b === undefined) continue;
    matchAt[ordem.indexOf(a)] = [a, b];
    segundos.add(b);
  }
  const slots: Array<{ bye?: string; match?: [string, string] }> = [];
  ordem.forEach((id, idx) => {
    if (isBye(id)) slots.push({ bye: id });
    else if (segundos.has(id)) { /* já no match do parceiro */ }
    else if (matchAt[idx]) slots.push({ match: matchAt[idx] });
    else slots.push({ bye: id });
  });
  return slots;
}

// Esqueleto do bracket em ordem de EMISSÃO do motor (pré → quartos → meias → final).
// Cada nó: { left, right } com refs { bye } | { leaf } | { node:idx }.
type Ref = { bye?: string; leaf?: string; node?: number };
type NoFlat = { left: Ref; right: Ref };
function buildSkeleton(ordem: string[], byes: string[]): NoFlat[] {
  const slots = construirSlots(ordem, byes);
  const flat: NoFlat[] = [];
  let nivel: Ref[] = [];
  for (const s of slots) {
    if (s.bye) { nivel.push({ bye: s.bye }); continue; }
    const idx = flat.length;
    flat.push({ left: { leaf: s.match![0] }, right: { leaf: s.match![1] } });
    nivel.push({ node: idx });
  }
  while (nivel.length > 2) {
    const prox: Ref[] = [];
    for (let i = 0; i < nivel.length; i += 2) {
      const a = nivel[i], b = nivel[i + 1];
      const idx = flat.length;
      flat.push({ left: a, right: b });
      prox.push({ node: idx });
    }
    nivel = prox;
  }
  if (nivel.length === 2) flat.push({ left: nivel[0], right: nivel[1] });
  return flat;
}

// Converte um Ref (e a sua sub-árvore) num No, ligando as lutas resolvidas por
// índice e acumulando as arestas (ligações) para o SVG.
function refToNo(
  ref: Ref, flat: NoFlat[], lutas: Luta[], poolKey: string, arestas: Aresta[],
  nomes: Record<string, { nome: string; pais: string }>
): No {
  if (ref.bye) {
    const info = nomes[ref.bye] || { nome: ref.bye, pais: "" };
    return { tipo: "bye", key: `bye-${poolKey}-${ref.bye}`, lado: { id: ref.bye, nome: info.nome, pais: info.pais, vencedor: false } };
  }
  const i = ref.node!;
  const luta = lutas[i];
  const node = flat[i];
  const key = luta?.chaveId || `n-${poolKey}-${i}`;
  const filhos: No[] = [];
  const ehPre = node.left.leaf !== undefined || node.right.leaf !== undefined;
  if (!ehPre) {
    for (const c of [node.left, node.right]) {
      const child = refToNo(c, flat, lutas, poolKey, arestas, nomes);
      filhos.push(child);
      arestas.push({ de: child.key, para: key });
    }
  }
  return { tipo: "luta", key, luta, filhos };
}

function lutaNo(l: Luta, fallbackKey: string, filhos: No[] = []): No {
  return { tipo: "luta", key: l.chaveId || fallbackKey, luta: l, filhos };
}

// Árvore de um POOL (raiz = final do pool).
function arvorePool(
  poolKey: string, pool: { vencedor: string | null; lutas: Luta[] },
  ordem: string[], byes: string[], nomes: Record<string, { nome: string; pais: string }>
): { arvores: Arvore[]; arestas: Aresta[] } {
  const arestas: Aresta[] = [];
  const lutas = pool?.lutas || [];
  if (!ordem || ordem.length === 0 || lutas.length === 0) return { arvores: [], arestas };
  const flat = buildSkeleton(ordem, byes || []);
  if (flat.length !== lutas.length) {
    // segurança: se desalinhar, mostra as lutas empilhadas (sem árvore) em vez de partir.
    const arv: Arvore[] = lutas.map((l, i) => ({ no: lutaNo(l, `f-${poolKey}-${i}`), vencedor: null }));
    return { arvores: arv, arestas };
  }
  const no = refToNo({ node: flat.length - 1 }, flat, lutas, poolKey, arestas, nomes);
  const finalLuta = lutas[lutas.length - 1];
  let vencedor: Arvore["vencedor"] = null;
  if (finalLuta?.vencedor) {
    const venc = finalLuta.vencedor;
    const lg = finalLuta.azul.id === venc ? finalLuta.azul : finalLuta.branco;
    const vk = `venc-pool-${poolKey}`;
    vencedor = { key: vk, lado: ladoDe(lg, venc) };
    arestas.push({ de: no.key, para: vk });
  }
  return { arvores: [{ no, vencedor }], arestas };
}

// Árvore Meias + Final (raiz = final; filhos = as 2 meias).
function arvoreMeiasFinal(chave: Chave): { arvores: Arvore[]; arestas: Aresta[] } {
  const arestas: Aresta[] = [];
  const meias = chave.meias || [];
  const meiaNos = meias.map((m, i) => lutaNo(m, `SF${i + 1}`));
  if (!chave.final) return { arvores: meiaNos.map((no) => ({ no, vencedor: null })), arestas };
  const finalNo = lutaNo(chave.final, "FINAL", meiaNos);
  for (const mn of meiaNos) arestas.push({ de: mn.key, para: finalNo.key });
  let vencedor: Arvore["vencedor"] = null;
  if (chave.final.vencedor) {
    const venc = chave.final.vencedor;
    const lg = chave.final.azul.id === venc ? chave.final.azul : chave.final.branco;
    const vk = "venc-final";
    vencedor = { key: vk, lado: ladoDe(lg, venc) };
    arestas.push({ de: finalNo.key, para: vk });
  }
  return { arvores: [{ no: finalNo, vencedor }], arestas };
}

// Árvores Repescagem → Bronze (cada bronze tem a sua repescagem como filho;
// o semifinalista perdedor aparece como nome dentro da caixa do bronze).
function arvoreRepBronze(chave: Chave): { arvores: Arvore[]; arestas: Aresta[] } {
  const arestas: Aresta[] = [];
  const reps = chave.repescagens || [];
  const bronzes = chave.bronzes || [];
  const arvores: Arvore[] = [];
  for (let i = 0; i < bronzes.length; i++) {
    const b = bronzes[i];
    const rep = reps[i];
    const filhos: No[] = rep ? [lutaNo(rep, `R${i + 1}`)] : [];
    const bNo = lutaNo(b, `B${i + 1}`, filhos);
    for (const f of filhos) arestas.push({ de: f.key, para: bNo.key });
    let vencedor: Arvore["vencedor"] = null;
    if (b.vencedor) {
      const venc = b.vencedor;
      const lg = b.azul.id === venc ? b.azul : b.branco;
      const vk = `venc-bronze-${i}`;
      vencedor = { key: vk, lado: ladoDe(lg, venc) };
      arestas.push({ de: bNo.key, para: vk });
    }
    arvores.push({ no: bNo, vencedor });
  }
  return { arvores, arestas };
}

// A próxima luta de um conjunto: a primeira "agendada" (ambos os lados definidos,
// ainda por decidir), em ordem de bracket. Devolve o chaveId, ou null.
function proximaLutaId(lutas: (Luta | null | undefined)[]): string | null {
  const c = lutas.filter((l): l is Luta => !!l && l.estado === "agendada" && !!l.azul.id && !!l.branco.id);
  if (c.length === 0) return null;
  return c[0].chaveId || null;
}

// ----------------------------------------------------------------------------
// Contextos (favoritos + próxima luta), iguais à /chave.
// ----------------------------------------------------------------------------
interface FavCtx {
  favoritos: Set<string>;
  pendentes: Set<string>;
  alternar: (lado: Lado) => void;
  ativo: boolean;
}
const FavoritosContexto = createContext<FavCtx | null>(null);
const ProximaContexto = createContext<string | null>(null);

// Pontos Ippon por atleta (id -> { pontos, nLutas }), para o badge no cartão.
type InfoAtleta = { pontos: number; nLutas: number };
const PontosContexto = createContext<Record<string, InfoAtleta> | null>(null);

// ----------------------------------------------------------------------------
// Página
// ----------------------------------------------------------------------------
export default function ChaveAtletasPage() {
  const router = useRouter();
  const [acesso, setAcesso] = useState<"verificar" | "ok" | "negado">("verificar");

  const foco = useMemo(() => focoMercado(), []);
  const compInicial = foco.aDecorrer?.idCompeticao || foco.atual?.idCompeticao || (foco as { alvo?: { idCompeticao?: string } }).alvo?.idCompeticao || "";
  const [comp] = useState<string>(String(compInicial));
  const [cat, setCat] = useState<string>(CAT_INICIAL);

  const [chave, setChave] = useState<Chave | null>(null);
  const [infos, setInfos] = useState<Record<string, InfoAtleta>>({});
  const [moldura, setMoldura] = useState<Moldura | null>(null);
  const [existeMoldura, setExisteMoldura] = useState<boolean | null>(null);
  const [aCarregar, setACarregar] = useState(false);
  const [quando, setQuando] = useState("");

  // Favoritos do utilizador (id_person).
  const [favoritos, setFavoritos] = useState<Set<string>>(new Set());
  const [pendentes, setPendentes] = useState<Set<string>>(new Set());
  const [userId, setUserId] = useState<string>("anon");

  // Acesso só Pro Max.
  useEffect(() => {
    let vivo = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!vivo) return;
      const meta = (data.user?.user_metadata || {}) as Record<string, unknown>;
      if (Boolean(meta.is_pro_max)) { setAcesso("ok"); return; }
      setAcesso("negado");
      router.replace(Boolean(meta.is_pro) ? "/pro" : "/ippon-pro");
    });
    return () => { vivo = false; };
  }, [router]);

  // Carregar favoritos.
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
      } catch { /* segue sem favoritos */ }
    })();
  }, []);

  const alternar = useCallback((lado: Lado) => {
    const u = userId;
    if (u === "anon" || !lado.id) return;
    const id = lado.id;
    setPendentes((p) => { const n = new Set(p); n.add(id); return n; });
    setFavoritos((f) => { const n = new Set(f); if (n.has(id)) n.delete(id); else n.add(id); return n; });
    (async () => {
      try {
        const r = await fetch("/api/favoritos", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: u, id_person: id, nome: lado.nome, country_code: lado.pais }),
        });
        const j = await r.json();
        if (j.ok) {
          setFavoritos((f) => { const n = new Set(f); if (j.favorito) n.add(id); else n.delete(id); return n; });
        } else {
          setFavoritos((f) => { const n = new Set(f); if (n.has(id)) n.delete(id); else n.add(id); return n; });
        }
      } catch {
        setFavoritos((f) => { const n = new Set(f); if (n.has(id)) n.delete(id); else n.add(id); return n; });
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
    setACarregar(true);
    try {
      const r = await fetch(`/api/chave-atletas?comp=${encodeURIComponent(comp)}&cat=${encodeURIComponent(cat)}`, { cache: "no-store" });
      const j = await r.json();
      if (j?.ok) {
        setExisteMoldura(!!j.existeMoldura);
        setChave(j.chave || null);
        setInfos(j.infos || {});
        setMoldura(j.moldura || null);
        setQuando(new Date().toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" }));
      }
    } catch { /* silencioso */ }
    setACarregar(false);
  }, [comp, cat]);

  useEffect(() => {
    if (acesso !== "ok") return;
    setChave(null); setMoldura(null); setExisteMoldura(null);
    carregar();
    const t = setInterval(carregar, 60000);
    return () => clearInterval(t);
  }, [acesso, carregar]);

  const nomes = useMemo(() => (chave ? mapearNomes(chave) : {}), [chave]);
  const nomeDe = useCallback((id: string | null) => (id && nomes[id] ? sobrenome(nomes[id].nome) : "—"), [nomes]);

  if (acesso === "verificar") return <Tela texto="A verificar acesso…" />;
  if (acesso === "negado") return <Tela texto="A redirecionar…" />;

  const generoCat = CATS_M.includes(cat) ? "masc." : "fem.";

  return (
    <FavoritosContexto.Provider value={favCtx}>
    <PontosContexto.Provider value={infos}>
    <main style={{ minHeight: "100vh", background: FUNDO, color: "#f1ede2", fontFamily: FB }}>
      <style>{`
        @keyframes ilpulse{0%,100%{opacity:1}50%{opacity:.35}}
        .ilpulse{animation:ilpulse 1.2s ease-in-out infinite}
        @keyframes ilpontopulse{0%{box-shadow:0 0 0 0 rgba(95,211,138,0.55)}70%{box-shadow:0 0 0 6px rgba(95,211,138,0)}100%{box-shadow:0 0 0 0 rgba(95,211,138,0)}}
        .ilponto{animation:ilpontopulse 1.4s ease-out infinite}
        @media (prefers-reduced-motion: reduce){.ilpulse{animation:none}.ilponto{animation:none}.ildesliza{animation:none}}
        .il-scroll::-webkit-scrollbar{height:10px}
        .il-scroll::-webkit-scrollbar-track{background:#11160f;border-radius:8px}
        .il-scroll::-webkit-scrollbar-thumb{background:#3a4a42;border-radius:8px}
        .il-scroll::-webkit-scrollbar-thumb:hover{background:#4c5f55}
        .il-scroll{scrollbar-color:#3a4a42 #11160f}
        @keyframes ildeslizax{0%,100%{transform:translateX(0)}50%{transform:translateX(4px)}}
        .ildesliza{animation:ildeslizax 1.6s ease-in-out infinite;display:inline-block}
      `}</style>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "16px 14px 60px" }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <a href="/inicio" aria-label="Voltar" style={{ width: 34, height: 34, borderRadius: "50%", border: "1px solid #243029", display: "flex", alignItems: "center", justifyContent: "center", color: "#cfd8d2", textDecoration: "none", flexShrink: 0 }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
            </a>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <h1 style={{ fontFamily: FD, fontSize: 19, fontWeight: 700, textTransform: "uppercase", margin: 0, lineHeight: 1.05 }}>Chave ao vivo</h1>
                <span style={{ fontSize: 10, fontWeight: 700, color: "#7fb8f5", border: "1px solid #7fb8f5", borderRadius: 4, padding: "1px 6px", letterSpacing: 0.5 }}>PRO MAX</span>
              </div>
              <div style={{ fontSize: 12, color: "#93a39a", marginTop: 1 }}>O quadro monta-se sozinho conforme os resultados chegam · {cat} kg {generoCat}</div>
            </div>
          </div>
          <button onClick={carregar} style={{ background: "#141a17", border: `1px solid ${GOLD}`, color: GOLD, fontFamily: FD, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", padding: "8px 13px", borderRadius: 9, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
            Atualizar
          </button>
        </header>

        {/* Seletor: 2 filas (M em cima, F em baixo), 7 colunas. */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, marginTop: 14 }}>
          {CATS_M.map((c) => <BotaoCat key={c} c={c} g="masc." ativo={c === cat} onClick={() => setCat(c)} />)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, marginTop: 6 }}>
          {CATS_F.map((c) => <BotaoCat key={c} c={c} g="fem." ativo={c === cat} onClick={() => setCat(c)} />)}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "14px 0 8px", flexWrap: "wrap" }}>
          <span className="ilpulse" style={{ width: 8, height: 8, borderRadius: "50%", background: "#e2655a" }} />
          <span style={{ fontFamily: FD, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#e2655a" }}>Ao vivo</span>
          {quando && <span style={{ fontSize: 11, color: "#7c8a82" }}>· atualizado às {quando}</span>}
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, marginLeft: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: VERDE, flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: "#7c8a82" }}>próxima luta de cada bloco</span>
          </span>
        </div>

        {existeMoldura === false ? (
          <Tela texto="A chave desta categoria ainda não está disponível." />
        ) : !chave ? (
          <Tela texto="A carregar a chave…" />
        ) : (
          <>
            {/* Pódio (se houver) */}
            {(chave.campeao || chave.vice || chave.terceiros.length > 0) && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 8, marginBottom: 6, padding: "10px 12px", borderRadius: 10, background: "rgba(217,164,65,0.08)", border: `1px solid ${GOLD}` }}>
                {chave.campeao && <Medalha cor={GOLD} txt="1º" nome={nomeDe(chave.campeao)} />}
                {chave.vice && <Medalha cor="#c8ccd2" txt="2º" nome={nomeDe(chave.vice)} />}
                {chave.terceiros.map((t, i) => <Medalha key={i} cor="#cd7f32" txt="3º" nome={nomeDe(t)} />)}
              </div>
            )}

            {/* Pools A–D */}
            {(["A", "B", "C", "D"] as const).map((p) => {
              const ordem = moldura?.pools?.[p] || [];
              const byes = moldura?.byes?.[p] || [];
              const { arvores, arestas } = arvorePool(p, chave.pools[p] || { vencedor: null, lutas: [] }, ordem, byes, nomes);
              const proxima = proximaLutaId(chave.pools[p]?.lutas || []);
              return <Bloco key={p} titulo={`Pool ${p}`} arvores={arvores} arestas={arestas} proxima={proxima} rotuloVencedor="Vence o pool" />;
            })}

            {/* Repescagem + Bronze (antes da final) */}
            {(() => {
              const { arvores, arestas } = arvoreRepBronze(chave);
              const proxima = proximaLutaId([...(chave.repescagens || []), ...(chave.bronzes || [])]);
              return <Bloco titulo="Repescagem e Bronzes" arvores={arvores} arestas={arestas} proxima={proxima} rotuloVencedor="🥉 Bronze" />;
            })()}

            {/* Meias + Final (a final é a última luta da categoria) */}
            {(() => {
              const { arvores, arestas } = arvoreMeiasFinal(chave);
              const proxima = proximaLutaId([...(chave.meias || []), chave.final]);
              return <Bloco titulo="Meias-finais e Final" arvores={arvores} arestas={arestas} proxima={proxima} rotuloVencedor="🥇 Campeão" />;
            })()}
          </>
        )}
      </div>
    </main>
    </PontosContexto.Provider>
    </FavoritosContexto.Provider>
  );
}

// ----------------------------------------------------------------------------
// Bloco — desenha as árvores com conectores em cotovelo (SVG medido).
// ----------------------------------------------------------------------------
function Bloco({ titulo, arvores, arestas, proxima, rotuloVencedor }: {
  titulo: string; arvores: Arvore[]; arestas: Aresta[]; proxima: string | null; rotuloVencedor: string;
}) {
  const innerRef = useRef<HTMLDivElement | null>(null);
  const outerRef = useRef<HTMLDivElement | null>(null);
  const refs = useRef<Map<string, HTMLElement>>(new Map());
  const [paths, setPaths] = useState<string[]>([]);
  const [temScroll, setTemScroll] = useState(false);

  const medirScroll = useCallback(() => {
    const o = outerRef.current;
    if (o) setTemScroll(o.scrollWidth > o.clientWidth + 4);
  }, []);

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
    medirScroll();
    const inner = innerRef.current;
    let ro: ResizeObserver | null = null;
    if (inner && typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => { calcular(); medirScroll(); });
      ro.observe(inner);
    }
    const onR = () => { calcular(); medirScroll(); };
    window.addEventListener("resize", onR);
    const t = setTimeout(() => { calcular(); medirScroll(); }, 80);
    return () => { if (ro) ro.disconnect(); window.removeEventListener("resize", onR); clearTimeout(t); };
  }, [calcular, medirScroll, arvores]);

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
    <ProximaContexto.Provider value={proxima}>
    <section style={{ marginTop: 26 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <span style={{ fontFamily: FD, fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#cfd8d2" }}>
          {titulo}
        </span>
        {temScroll && (
          <span style={{ fontFamily: FD, fontSize: 10, color: "#7c8a82", letterSpacing: "0.04em", display: "inline-flex", alignItems: "center", gap: 4 }}>
            <span className="ildesliza">→</span> deslize para ver toda a chave
          </span>
        )}
      </div>
      {arvores.length === 0 ? (
        <Vazio texto="Sem lutas nesta fase ainda." />
      ) : (
        <div style={{ position: "relative" }}>
          <div ref={outerRef} className="il-scroll" style={{ overflowX: "auto", paddingBottom: 10 }}>
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
          {temScroll && (
            <div aria-hidden="true" style={{ position: "absolute", top: 0, right: 0, bottom: 10, width: 52, pointerEvents: "none", background: `linear-gradient(to right, rgba(12,14,13,0), ${FUNDO})` }} />
          )}
        </div>
      )}
    </section>
    </ProximaContexto.Provider>
  );
}

// ----------------------------------------------------------------------------
// Caixas e linhas
// ----------------------------------------------------------------------------
function CaixaLuta({ luta }: { luta: Luta }) {
  const proxima = useContext(ProximaContexto);
  const ehProxima = !!luta.chaveId && proxima === luta.chaveId;
  const decidida = luta.estado === "decidida" && !!luta.vencedor;
  const azul = ladoDe(luta.azul, luta.vencedor);
  const branco = ladoDe(luta.branco, luta.vencedor);
  return (
    <div style={{ position: "relative", width: CAIXA_W, background: "#121815", border: `1px solid ${ehProxima ? VERDE : "#243029"}`, borderRadius: 10, overflow: "hidden" }}>
      {ehProxima && (
        <span className="ilponto" aria-label="Próxima luta" title="Próxima luta deste bloco"
          style={{ position: "absolute", top: -5, right: -5, width: 11, height: 11, borderRadius: "50%", background: VERDE, border: "2px solid #0c0e0d", zIndex: 2 }} />
      )}
      <LinhaLado lado={azul} decidida={decidida} />
      <div style={{ height: 1, background: "#1a221d" }} />
      <LinhaLado lado={branco} decidida={decidida} />
    </div>
  );
}

function CaixaBye({ lado }: { lado: Lado }) {
  return (
    <div style={{ width: CAIXA_W, background: "#0f1411", border: "1px dashed #2a3a33", borderRadius: 10 }}>
      <LinhaLado lado={{ ...lado, vencedor: false }} esmaecido />
    </div>
  );
}

function CaixaVencedor({ lado, rotulo }: { lado: Lado; rotulo: string }) {
  const dourado = rotulo.includes("Campeão");
  const borda = dourado ? GOLD : rotulo.includes("Bronze") ? "#9a6b3a" : "#2f3d35";
  return (
    <div style={{ width: CAIXA_W, background: "#141a17", border: `1px solid ${borda}`, borderRadius: 10, overflow: "hidden" }}>
      <div style={{ fontSize: 9, color: "#7c8a82", textTransform: "uppercase", letterSpacing: "0.07em", padding: "4px 9px 0" }}>{rotulo}</div>
      <LinhaLado lado={{ ...lado, vencedor: true }} semEstrela />
    </div>
  );
}

function LinhaLado({ lado, esmaecido, decidida, semEstrela }: { lado: Lado; esmaecido?: boolean; decidida?: boolean; semEstrela?: boolean }) {
  const venceu = lado.vencedor;
  const vazio = !lado.id;
  const cor = vazio ? "#5a665e" : esmaecido ? "#6b7a72" : venceu ? "#f1ede2" : decidida ? "#7c8a82" : "#a9b4ac";
  const destaque = venceu && !semEstrela; // contorno dourado só nas lutas reais
  const fav = useContext(FavoritosContexto);
  const mostraEstrela = !semEstrela && !esmaecido && !!fav?.ativo && !!lado.id;
  const ehFavorito = mostraEstrela && fav!.favoritos.has(lado.id);
  const aGravar = mostraEstrela && fav!.pendentes.has(lado.id);
  // Selos das ações DESTA luta (por baixo do nome). Só quando há ações.
  const ac = !esmaecido ? lado.acoes : undefined;
  const selos: Array<{ t: string; cor: string }> = [];
  if (ac) {
    if (ac.i > 0) selos.push({ t: `I:${ac.i}`, cor: GOLD });
    if (ac.w > 0) selos.push({ t: `W:${ac.w}`, cor: "#5fd38a" });
    if (ac.y > 0) selos.push({ t: `Y:${ac.y}`, cor: "#5fd38a" });
    if (ac.s > 0) selos.push({ t: `S:-${ac.s}`, cor: "#e0796d" });
  }
  return (
    <div style={{
      padding: "7px 9px", margin: destaque ? 3 : 0, borderRadius: destaque ? 8 : 0,
      border: destaque ? `1px solid ${GOLD}` : "1px solid transparent",
      background: destaque ? "rgba(217,164,65,0.10)" : "transparent",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontFamily: FD, fontSize: 10, fontWeight: 700, color: venceu ? GOLD : "#7c8a82", width: 30, flexShrink: 0, letterSpacing: "0.03em" }}>
          {lado.pais || ""}
        </span>
        <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: venceu ? 700 : 400, color: cor, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {vazio ? "—" : sobrenome(lado.nome)}
        </span>
        {venceu && <span aria-label="venceu" style={{ color: GOLD, fontSize: 12, flexShrink: 0 }}>▸</span>}
        {mostraEstrela && (
          <button type="button" onClick={() => fav!.alternar(lado)} disabled={aGravar}
            aria-label={ehFavorito ? "Remover dos favoritos" : "Adicionar aos favoritos"} aria-pressed={ehFavorito}
            title={ehFavorito ? "Nos teus atletas" : "Seguir este atleta"}
            style={{ background: "transparent", border: "none", cursor: aGravar ? "default" : "pointer", padding: 0, marginLeft: 2, flexShrink: 0, lineHeight: 1, fontSize: 14, color: ehFavorito ? GOLD : "#5f6f67", opacity: aGravar ? 0.5 : 1, transition: "color .15s" }}>
            {ehFavorito ? "★" : "☆"}
          </button>
        )}
      </div>
      {selos.length > 0 && (
        <div style={{ display: "flex", gap: 4, marginLeft: 38, marginTop: 3, flexWrap: "wrap" }}>
          {selos.map((s, i) => (
            <span key={i} style={{
              fontFamily: FD, fontSize: 9.5, fontWeight: 700, lineHeight: 1.2,
              color: s.cor, background: `${s.cor}14`, border: `1px solid ${s.cor}40`,
              borderRadius: 4, padding: "0px 4px", letterSpacing: "0.04em",
            }}>
              {s.t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Auxiliares de UI
// ----------------------------------------------------------------------------
function BotaoCat({ c, g, ativo, onClick }: { c: string; g: string; ativo: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-pressed={ativo} style={{
      display: "flex", flexDirection: "column", alignItems: "center", gap: 1,
      padding: "7px 0", borderRadius: 8, cursor: "pointer", fontFamily: FD, lineHeight: 1.1,
      background: ativo ? GOLD : "#141a17", border: `1px solid ${ativo ? GOLD : "#243029"}`,
      color: ativo ? "#1b211e" : "#cfd8d2",
    }}>
      <span style={{ fontSize: 13, fontWeight: 700 }}>{c}</span>
      <span style={{ fontSize: 8.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: ativo ? "#5c4410" : "#7c8a82" }}>{g}</span>
    </button>
  );
}

function Medalha({ cor, txt, nome }: { cor: string; txt: string; nome: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ width: 22, height: 22, borderRadius: "50%", background: cor, color: "#0c0e0d", display: "grid", placeItems: "center", fontSize: 11, fontWeight: 800 }}>{txt}</span>
      <span style={{ fontWeight: 700, fontSize: 14 }}>{nome}</span>
    </div>
  );
}

function Tela({ texto }: { texto: string }) {
  return (
    <div style={{ minHeight: "40vh", display: "grid", placeItems: "center", padding: "48px 18px", color: "#7c8a82", fontFamily: FD, fontSize: 13, letterSpacing: "0.04em", textAlign: "center", lineHeight: 1.6 }}>
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
