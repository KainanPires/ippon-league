"use client";

// components/Chave.tsx
//
// O DESENHO DE UMA CHAVE DE MATA-MATA, UMA VEZ SÓ.
//
// Saiu do /chave-atletas, que já a desenhava bem: colunas da esquerda para a
// direita, linhas em cotovelo ligadas às posições REAIS das caixas no ecrã, e
// blocos separados por fase.
//
// Antes existia noutra estética na Copa do Dôdo. Duas chaves diferentes para a
// mesma ideia obrigam a manter duas coisas e confundem quem usa a app.
//
// ---------------------------------------------------------------------------
// O QUE ESTE FICHEIRO SABE E O QUE NÃO SABE
//
// SABE: como empilhar as colunas, onde passam as linhas, o que é um bye, o que
// é a caixa do vencedor, e como avisar que a chave não cabe no ecrã.
//
// NÃO SABE: o que está dentro de cada caixa. Uma chave de atletas mostra nome,
// país e categoria; a Copa do Dôdo mostra a equipa, o escudo e o continente.
// Por isso cada página passa a sua própria `renderCaixa`.
//
// É essa fronteira que permite os dois usos sem duplicar nada. Se um dia a
// chave melhorar aqui, melhora em todos os ecrãs ao mesmo tempo.
// ---------------------------------------------------------------------------
//
// COMO USAR
//
//   <BlocoChave
//     titulo="Chave principal"
//     arvores={arvores}
//     arestas={arestas}
//     destaque={idDaProximaLuta}
//     renderCaixa={(no) => <AMinhaCaixa no={no} />}
//   />
//
// As `arvores` são a estrutura (cada nó tem filhos, que são as lutas que o
// alimentam). As `arestas` dizem que linha liga que caixa a que caixa — e são
// resolvidas por `key`, não por posição, para o desenho não depender da ordem.

import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  createContext,
  useContext,
  type ReactNode,
} from "react";

// --- Medidas. Mexer aqui muda a chave em toda a app. ---
export const COLGAP = 34;   // espaço entre colunas (onde passam as linhas)
export const ROWGAP = 12;   // espaço entre caixas da mesma coluna
export const CAIXA_W = 184; // largura de cada caixa

const FD = "var(--font-geist-mono), system-ui, sans-serif";
const LINHA = "#3a4a42";
const GOLD = "#d9a441";
const VERDE = "#5fd38a";

// --- A árvore ---
//
// Um nó é uma luta (com os confrontos que a alimentam como filhos) ou um bye
// — alguém que passa sem lutar, porque a chave não era redonda.
export type NoChave =
  | { tipo: "luta"; key: string; dados: unknown; filhos: NoChave[] }
  | { tipo: "bye"; key: string; dados: unknown };

export type Aresta = { de: string; para: string };
export type Arvore = NoChave;

/** Está em destaque? (a próxima luta do bloco). Lido pelas caixas. */
const DestaqueContexto = createContext<string | null>(null);
export function useEmDestaque(key: string | null | undefined): boolean {
  const d = useContext(DestaqueContexto);
  return !!key && d === key;
}

export function BlocoChave({
  titulo,
  arvores,
  arestas,
  destaque = null,
  renderCaixa,
  textoVazio = "Sem lutas nesta fase ainda.",
}: {
  titulo: string;
  arvores: Arvore[];
  arestas: Aresta[];
  /** `key` do nó a marcar como próximo. */
  destaque?: string | null;
  /** Cada página decide o que aparece dentro da caixa. */
  renderCaixa: (no: NoChave) => ReactNode;
  textoVazio?: string;
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

  const setRef = useCallback(
    (key: string) => (el: HTMLElement | null) => {
      const m = refs.current;
      if (el) m.set(key, el);
      else m.delete(key);
    },
    []
  );

  // As linhas são calculadas a partir das posições REAIS das caixas, não de
  // coordenadas fixas. É isso que faz a chave aguentar nomes de comprimentos
  // diferentes e ecrãs de qualquer largura sem nada ficar torto.
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

      // Cotovelo: sai a direito, dobra a meio caminho, entra a direito.
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
      ro = new ResizeObserver(() => {
        calcular();
        medirScroll();
      });
      ro.observe(inner);
    }

    const onR = () => {
      calcular();
      medirScroll();
    };
    window.addEventListener("resize", onR);

    // Um segundo cálculo atrasado: as fontes podem chegar depois da primeira
    // medição e mudar a altura das caixas.
    const t = setTimeout(() => {
      calcular();
      medirScroll();
    }, 80);

    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener("resize", onR);
      clearTimeout(t);
    };
  }, [calcular, medirScroll, arvores]);

  const renderNo = (no: NoChave): ReactNode => {
    if (no.tipo === "bye") {
      return (
        <div key={no.key} ref={setRef(no.key)}>
          {renderCaixa(no)}
        </div>
      );
    }

    return (
      <div key={no.key} style={{ display: "flex", alignItems: "center", gap: COLGAP }}>
        {no.filhos.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: ROWGAP }}>
            {no.filhos.map((f) => renderNo(f))}
          </div>
        )}
        <div ref={setRef(no.key)}>{renderCaixa(no)}</div>
      </div>
    );
  };

  return (
    <DestaqueContexto.Provider value={destaque}>
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
          <div style={{ background: "#0f1411", border: "1px dashed #2a3a33", borderRadius: 12, padding: "18px 14px", textAlign: "center", fontSize: 13, color: "#7c8a82" }}>
            {textoVazio}
          </div>
        ) : (
          <div style={{ position: "relative" }}>
            <div ref={outerRef} className="il-scroll" style={{ overflowX: "auto", paddingBottom: 10 }}>
              <div ref={innerRef} style={{ position: "relative", width: "max-content", display: "flex", flexDirection: "column", gap: 22 }}>
                {/* As linhas por baixo das caixas, sem apanhar cliques. */}
                <svg
                  style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", overflow: "visible" }}
                  aria-hidden="true"
                >
                  {paths.map((d, i) => (
                    <path key={i} d={d} fill="none" stroke={LINHA} strokeWidth={1.5} />
                  ))}
                </svg>

                {arvores.map((a) => renderNo(a))}
              </div>
            </div>
          </div>
        )}
      </section>
    </DestaqueContexto.Provider>
  );
}

// ---------------------------------------------------------------------------
// PEÇAS PRONTAS PARA AS CAIXAS
//
// Não são obrigatórias — uma página pode desenhar as suas de raiz. Mas usá-las
// é o que faz a chave dos atletas e a da Copa parecerem a mesma coisa.
// ---------------------------------------------------------------------------

/** Um lado do confronto: quem é, o que se sabe dele, e como correu. */
export type LadoCaixa = {
  titulo: string;
  /** País, categoria, continente… o que a página quiser. */
  subtitulo?: string | null;
  /** Pontos, ippon, waza-ari. Aparece à direita. */
  resultado?: string | null;
  vencedor?: boolean;
  /** Um escudo, uma bandeira, um avatar. */
  marca?: ReactNode;
  vazio?: boolean;
};

export function LinhaLado({ lado, decidida, esmaecido }: { lado: LadoCaixa; decidida?: boolean; esmaecido?: boolean }) {
  // Quem perdeu esmaece; quem ganhou fica a dourado. Numa chave é isto que
  // deixa perceber o caminho de alguém num relance, sem ler tudo.
  const perdeu = decidida && !lado.vencedor && !lado.vazio;
  const cor = lado.vazio ? "#4a5852" : perdeu ? "#6f7d76" : lado.vencedor ? GOLD : "#e6ebe7";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 9px", opacity: esmaecido || perdeu ? 0.62 : 1, minWidth: 0 }}>
      {lado.marca && <span style={{ flexShrink: 0, display: "flex", alignItems: "center" }}>{lado.marca}</span>}

      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 12.5, fontWeight: lado.vencedor ? 700 : 500, color: cor, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {lado.vazio ? "—" : lado.titulo}
        </span>
        {lado.subtitulo && !lado.vazio && (
          <span style={{ display: "block", fontSize: 10, color: "#7c8a82", letterSpacing: "0.03em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {lado.subtitulo}
          </span>
        )}
      </span>

      {lado.resultado != null && lado.resultado !== "" && (
        <span style={{ flexShrink: 0, fontFamily: FD, fontSize: 12, fontWeight: 700, color: lado.vencedor ? GOLD : "#93a39a" }}>
          {lado.resultado}
        </span>
      )}
    </div>
  );
}

/** Caixa de um confronto: dois lados separados por uma linha. */
export function CaixaConfronto({
  a,
  b,
  decidida,
  emDestaque,
}: {
  a: LadoCaixa;
  b: LadoCaixa;
  decidida?: boolean;
  emDestaque?: boolean;
}) {
  return (
    <div style={{ position: "relative", width: CAIXA_W, background: "#121815", border: `1px solid ${emDestaque ? VERDE : "#243029"}`, borderRadius: 10, overflow: "hidden" }}>
      {emDestaque && (
        <span
          className="ilponto"
          aria-label="Próximo confronto"
          title="Próximo confronto deste bloco"
          style={{ position: "absolute", top: -5, right: -5, width: 11, height: 11, borderRadius: "50%", background: VERDE, border: "2px solid #0c0e0d", zIndex: 2 }}
        />
      )}
      <LinhaLado lado={a} decidida={decidida} />
      <div style={{ height: 1, background: "#1a221d" }} />
      <LinhaLado lado={b} decidida={decidida} />
    </div>
  );
}

/** Passagem automática: ninguém do outro lado. Traço a tracejado. */
export function CaixaBye({ lado }: { lado: LadoCaixa }) {
  return (
    <div style={{ width: CAIXA_W, background: "#0f1411", border: "1px dashed #2a3a33", borderRadius: 10 }}>
      <LinhaLado lado={{ ...lado, vencedor: false }} esmaecido />
    </div>
  );
}

/** Caixa de pódio: campeão a dourado, bronze a castanho. */
export function CaixaVencedor({ lado, rotulo }: { lado: LadoCaixa; rotulo: string }) {
  const dourado = rotulo.includes("Campeã") || rotulo.includes("Campeão");
  const borda = dourado ? GOLD : rotulo.includes("Bronze") ? "#9a6b3a" : "#2f3d35";

  return (
    <div style={{ width: CAIXA_W, background: "#141a17", border: `1px solid ${borda}`, borderRadius: 10, overflow: "hidden" }}>
      <div style={{ fontSize: 9, color: "#7c8a82", textTransform: "uppercase", letterSpacing: "0.07em", padding: "4px 9px 0" }}>
        {rotulo}
      </div>
      <LinhaLado lado={lado} />
    </div>
  );
}
