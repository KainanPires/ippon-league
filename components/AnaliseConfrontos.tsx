"use client";

// components/AnaliseConfrontos.tsx
//
// ANÁLISE DE CONFRONTOS DIRETOS (Pro Max) — quem ganha a quem nesta categoria.
//
// Vive ao lado da chave, em /chave-atletas, porque é aí que a decisão acontece:
// vê-se o quadro e vê-se logo quem tem vantagem sobre quem.
//
// AUTOSSUFICIENTE: trata da sessão, do pedido e de todos os estados (a carregar,
// sem acesso, sem dados, ok). A página só precisa de lhe passar a categoria.
//
// QUE COMPETIÇÃO ANALISA — e porque NÃO é a mesma da chave ao lado.
//
// A chave mostra a competição que tem QUADRO MONTADO (à mão, na tabela
// chave_atletas) — normalmente a que está a decorrer ou a última com moldura.
// A análise responde a outra pergunta: "para quem vou escalar AGORA?". Por isso
// segue a competição de MERCADO ABERTO (focoMercado().alvo).
//
// São perguntas diferentes e as respostas podem ser competições diferentes. Como
// isso confunde se não se disser, o nome da competição analisada aparece sempre
// no topo do bloco — nunca se deixa o utilizador a supor.
//
// ---------------------------------------------------------------------------
// HONESTIDADE DOS NÚMEROS — as regras que este ecrã não pode quebrar
//
// No judô, dois atletas encontram-se uma ou duas vezes. Uma probabilidade tirada
// de 2 confrontos não é uma probabilidade. Por isso:
//
//   • a AMOSTRA aparece sempre ao lado da percentagem. Sem isso, ninguém
//     distingue uma leitura apoiada em 13 confrontos de um palpite apoiado em 0.
//   • sem histórico, dizemos "só por forma" em vez de inventar um número com ar
//     de certeza.
//   • uma casa decimal, nunca duas. A precisão não existe.
//   • nunca "aposta" nem "previsão". O projeto evita deliberadamente a linguagem
//     de apostas — é posicionamento e é risco regulatório.
//
// Um número errado com ar de certeza custa mais confiança do que um número
// ausente.
// ---------------------------------------------------------------------------

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { focoMercado, nomeCompeticao } from "@/lib/calendario";

const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";
const VERDE = "#5fd38a";
const AZUL_PROMAX = "#7fb8f5";
const VERMELHO = "#ef8d83";

interface Relacao { id: string; nome: string; pais: string; v: number; d: number; prob: number }
interface AtletaAnalise {
  id: string;
  nome: string;
  pais: string;
  preco: number;
  expectativa: number;
  probabilidade: number;
  amostra: number;
  confrontos: { adversarios: number; lutas: number; vitorias: number; derrotas: number; taxa: number | null };
  favoraveis: Relacao[];
  desfavoraveis: Relacao[];
}
interface PossivelAdv { id: string; prob: number; nome: string; pais: string; h2h: { v: number; d: number } | null }
interface FaseCaminho { fase: string; possiveis: PossivelAdv[] }
interface CaminhoAtleta {
  pool: string;
  vencePool: number;
  chegaFinal: number;
  venceCategoria: number;
  caminho: FaseCaminho[];
}
interface Resposta {
  ok: boolean;
  acesso?: "ok" | "negado";
  nivel?: "promax" | "pro" | "gratis";
  semDados?: boolean;
  nota?: string;
  compNome?: string | null;
  classico?: boolean;
  ano_base?: number | null;
  atletas?: AtletaAnalise[];
  modelo?: { k_confianca: number; s_forca: number };
  chave?: { existe: boolean; porAtleta?: Record<string, CaminhoAtleta> };
  atualizado_em?: string | null;
}

export function AnaliseConfrontos({ comp: compProp, cat }: { comp?: string; cat: string }) {
  // Por omissão, a competição para a qual se escala agora. `comp` só se passa
  // para forçar outra (útil em testes).
  const alvo = focoMercado().alvo;
  const comp = compProp || alvo.idCompeticao;
  const nomeAlvo = compProp ? null : nomeCompeticao(alvo);
  const [dados, setDados] = useState<Resposta | null>(null);
  const [aCarregar, setACarregar] = useState(true);
  const [aberto, setAberto] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!comp || !cat) return;
    setACarregar(true);
    try {
      // O paywall está no SERVIDOR: sem este token não sai um único dado.
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const r = await fetch(
        `/api/confrontos?comp=${encodeURIComponent(comp)}&cat=${encodeURIComponent(cat)}`,
        { cache: "no-store", headers }
      );
      const j = (await r.json()) as Resposta;
      setDados(j);
    } catch {
      setDados({ ok: false });
    } finally {
      setACarregar(false);
    }
  }, [comp, cat]);

  useEffect(() => { void carregar(); }, [carregar]);

  if (aCarregar) return <Aviso texto="A analisar os confrontos…" />;
  if (!dados || !dados.ok) return <Aviso texto="Não foi possível carregar a análise agora." />;

  // ---- Sem acesso: convite diferente para quem já é Pro e para quem não paga ----
  if (dados.acesso === "negado") {
    const ehPro = dados.nivel === "pro";
    return (
      <div style={{ background: "#0f1620", border: `1px solid ${AZUL_PROMAX}`, borderRadius: 14, padding: "18px 16px", textAlign: "center" }}>
        <div style={{ fontSize: 26, marginBottom: 6 }}>🔍</div>
        <div style={{ fontFamily: FD, fontSize: 15, fontWeight: 700, textTransform: "uppercase", color: AZUL_PROMAX, marginBottom: 8 }}>
          Confrontos diretos
        </div>
        <p style={{ fontSize: 13, color: "#cdd9e6", lineHeight: 1.55, margin: "0 0 16px" }}>
          {ehPro
            ? "Já és Pro — esta é a camada seguinte. Vê quem já ganhou a quem entre os inscritos desta categoria, e a probabilidade de cada um chegar ao topo."
            : "Descobre quem já ganhou a quem entre os inscritos desta categoria, e a probabilidade de cada um chegar ao topo — antes de escalares."}
        </p>
        <a href="/pro-max" style={{ display: "inline-block", background: AZUL_PROMAX, color: "#0a1828", fontFamily: FD, fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", padding: "11px 22px", borderRadius: 10, textDecoration: "none" }}>
          {ehPro ? "Subir a Pro Max" : "Conhecer o Pro Max"}
        </a>
      </div>
    );
  }

  if (dados.semDados) {
    return (
      <Aviso texto={`Ainda não há análise para ${cat} kg${nomeAlvo ? ` em ${nomeAlvo}` : ""}. Assim que os preços desta categoria forem recalculados, aparece aqui.`} />
    );
  }

  const atletas = dados.atletas || [];
  if (atletas.length === 0) return <Aviso texto="Sem atletas nesta categoria." />;

  // CAMADA 2: há quadro montado? Se sim, a probabilidade que MANDA é a da chave
  // — tem em conta quem apanha quem, e é isso que decide quem escalar. A da
  // camada 1 (só força relativa) passa a ser a leitura de fundo.
  const chave = dados.chave;
  const temChave = !!chave?.existe && !!chave.porAtleta;
  const comChave = (id: string): CaminhoAtleta | null => (temChave ? chave!.porAtleta![id] ?? null : null);
  // Com quadro, ordenamos pela probabilidade REAL de ser campeão.
  const ordenados = temChave
    ? [...atletas].sort((a, b) => (comChave(b.id)?.venceCategoria ?? -1) - (comChave(a.id)?.venceCategoria ?? -1))
    : atletas;

  // Total de confrontos conhecidos — dá a medida de quanto peso tem a análise.
  const totalLutas = atletas.reduce((s, a) => s + a.confrontos.lutas, 0) / 2; // cada luta conta 2x
  const comHistorico = atletas.filter((a) => a.confrontos.lutas > 0).length;

  return (
    <div>
      {/* Cabeçalho: de onde vêm os números. Aparece SEMPRE — é o que separa uma
          análise honesta de um oráculo. */}
      <div style={{ background: "#101511", border: "1px dashed #2f4a3c", borderRadius: 12, padding: "10px 13px", marginBottom: 12 }}>
        {/* QUAL competição está a ser analisada. Aparece sempre: pode não ser a
            mesma que a aba da Chave mostra, e supor qual é seria pior do que
            perguntar. */}
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: GOLD, marginBottom: 4 }}>
          A escalar para{dados.compNome || nomeAlvo ? ` · ${dados.compNome || nomeAlvo}` : ""}
        </div>
        <div style={{ fontSize: 12, color: "#aee9c9", lineHeight: 1.5 }}>
          <strong style={{ color: "#f1ede2" }}>{Math.round(totalLutas)} confrontos</strong> conhecidos entre os{" "}
          {atletas.length} inscritos ({comHistorico} com histórico).
          {dados.classico && dados.ano_base ? (
            <> Só contam lutas até ao fim de <strong style={{ color: GOLD }}>{dados.ano_base}</strong> — é um clássico desse ano.</>
          ) : null}
        </div>
        {/* A moldura só se monta depois da pesagem (as chaves da IJF saem 10-12h
            antes). Dizemos em que estado estamos, para a ausência do caminho não
            parecer uma falha. */}
        <div style={{ fontSize: 11, color: temChave ? VERDE : "#7c8a82", marginTop: 6 }}>
          {temChave
            ? "✓ Quadro montado — as probabilidades já contam com quem apanha quem."
            : "Quadro ainda não montado. As chaves saem depois da pesagem; até lá, a leitura é só por força e histórico."}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {ordenados.map((a, i) => {
          const expandido = aberto === a.id;
          const semHistorico = a.confrontos.lutas === 0;
          return (
            <div key={a.id} style={{ background: "#121815", border: `1px solid ${i === 0 ? GOLD : "#243029"}`, borderRadius: 12, overflow: "hidden" }}>
              <button
                onClick={() => setAberto(expandido ? null : a.id)}
                style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", padding: "11px 13px", background: "transparent", border: "none", cursor: "pointer", textAlign: "left", fontFamily: FB, color: "#f1ede2" }}
              >
                <span style={{ flexShrink: 0, width: 22, fontFamily: FD, fontSize: 13, fontWeight: 700, color: i === 0 ? GOLD : "#5f6f67" }}>{i + 1}</span>
                <span style={{ flexShrink: 0, background: "#f1ede2", color: "#1b211e", fontFamily: FD, fontWeight: 700, fontSize: 9, padding: "2px 5px", borderRadius: 3 }}>{a.pais}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.nome}</span>
                  <span style={{ display: "block", fontSize: 11, color: "#93a39a" }}>
                    JC {a.preco.toFixed(1)}
                    {semHistorico ? " · sem confrontos conhecidos" : ` · ${a.confrontos.vitorias}V–${a.confrontos.derrotas}D com ${a.confrontos.adversarios} inscritos`}
                  </span>
                </span>
                <span style={{ flexShrink: 0, textAlign: "right" }}>
                  <span style={{ display: "block", fontFamily: FD, fontSize: 16, fontWeight: 700, color: i === 0 ? GOLD : "#cfd8d2" }}>
                    {comChave(a.id) ? comChave(a.id)!.venceCategoria : a.probabilidade}%
                  </span>
                  {/* A AMOSTRA nunca é escondida. É o que distingue uma leitura
                      sólida de um palpite — e é ela que torna o número honesto. */}
                  <span style={{ display: "block", fontSize: 9.5, color: semHistorico ? "#7c8a82" : "#5f6f67" }}>
                    {semHistorico ? "só por forma" : `${a.amostra} lutas`}
                  </span>
                </span>
                <span style={{ flexShrink: 0, color: "#5f6f67", transform: expandido ? "rotate(90deg)" : "none", transition: "transform .18s" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6" /></svg>
                </span>
              </button>

              {expandido && (
                <div style={{ padding: "0 13px 12px", borderTop: "1px solid #1a221d" }}>
                  {semHistorico ? (
                    <p style={{ fontSize: 12, color: "#7c8a82", lineHeight: 1.5, margin: "10px 0 0" }}>
                      Nunca enfrentou nenhum dos outros inscritos. A percentagem acima vem apenas da forma recente — trata-a como uma estimativa larga.
                    </p>
                  ) : (
                    <>
                      <Bloco titulo="Leva vantagem" cor={VERDE} linhas={a.favoraveis} />
                      <Bloco titulo="Costuma sofrer" cor={VERMELHO} linhas={a.desfavoraveis} />
                      <Caminho dados={comChave(a.id)} />
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Rodapé: explicar o modelo em duas linhas. Quem percebe de onde vem o
          número confia nele; quem não percebe, desconfia — e tem razão. */}
      <p style={{ fontSize: 10.5, color: "#5f6f67", lineHeight: 1.5, textAlign: "center", marginTop: 14 }}>
        A percentagem combina a forma recente com o histórico direto entre os inscritos.
        Quantos mais confrontos existirem, mais peso tem o histórico. É uma estimativa, não uma previsão.
      </p>
    </div>
  );
}

// Lista de relações (leva vantagem / costuma sofrer). Mostra sempre o V–D, para
// a percentagem nunca aparecer sozinha e sem contexto.
function Bloco({ titulo, cor, linhas }: { titulo: string; cor: string; linhas: Relacao[] }) {
  if (!linhas || linhas.length === 0) return null;
  return (
    <div style={{ marginTop: 11 }}>
      <div style={{ fontFamily: FD, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: cor, marginBottom: 6 }}>{titulo}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {linhas.map((l) => (
          <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <span style={{ flexShrink: 0, background: "#243029", color: "#cfd8d2", fontFamily: FD, fontWeight: 700, fontSize: 8.5, padding: "2px 5px", borderRadius: 3 }}>{l.pais}</span>
            <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "#d6ddd6" }}>{l.nome}</span>
            <span style={{ flexShrink: 0, fontFamily: FD, fontSize: 12, fontWeight: 700, color: "#93a39a" }}>{l.v}–{l.d}</span>
            <span style={{ flexShrink: 0, fontFamily: FD, fontSize: 12.5, fontWeight: 700, color: cor, width: 46, textAlign: "right" }}>{l.prob}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// CAMINHO NA CHAVE — só aparece quando há moldura montada.
// Mostra, fase a fase, quem pode aparecer do outro lado e com que hipótese de lá
// chegar. Ao lado de cada nome vai o histórico direto, quando existe: é o que
// transforma "podes apanhar o Kukolj" em "podes apanhar o Kukolj, e estás 0-2".
function Caminho({ dados }: { dados: CaminhoAtleta | null }) {
  if (!dados) return null;
  return (
    <div style={{ marginTop: 13, paddingTop: 11, borderTop: "1px solid #1a221d" }}>
      <div style={{ fontFamily: FD, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: AZUL_PROMAX, marginBottom: 8 }}>
        Caminho na chave · Pool {dados.pool}
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <Marco rotulo="Vence o pool" valor={dados.vencePool} />
        <Marco rotulo="Chega à final" valor={dados.chegaFinal} />
        <Marco rotulo="Campeão" valor={dados.venceCategoria} destaque />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {dados.caminho.map((f, i) => (
          <div key={i}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: "#93a39a", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 3 }}>{f.fase}</div>
            {f.possiveis.length === 0 ? (
              <div style={{ fontSize: 11.5, color: "#5f6f67", fontStyle: "italic" }}>Passa sem adversário.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {f.possiveis.map((o) => (
                  <div key={o.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ flexShrink: 0, background: "#243029", color: "#cfd8d2", fontFamily: FD, fontWeight: 700, fontSize: 8.5, padding: "2px 5px", borderRadius: 3 }}>{o.pais}</span>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "#d6ddd6" }}>{o.nome}</span>
                    {o.h2h && (
                      <span style={{ flexShrink: 0, fontFamily: FD, fontSize: 11, fontWeight: 700, color: o.h2h.v > o.h2h.d ? VERDE : o.h2h.v < o.h2h.d ? VERMELHO : "#93a39a" }}>
                        {o.h2h.v}–{o.h2h.d}
                      </span>
                    )}
                    <span style={{ flexShrink: 0, fontFamily: FD, fontSize: 11, color: "#7c8a82", width: 44, textAlign: "right" }}>{o.prob}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <p style={{ fontSize: 10, color: "#5f6f67", lineHeight: 1.45, marginTop: 9, marginBottom: 0 }}>
        A percentagem ao lado de cada nome é a hipótese de ELE chegar a essa fase. O V–D é o histórico direto entre os dois.
      </p>
    </div>
  );
}

function Marco({ rotulo, valor, destaque }: { rotulo: string; valor: number; destaque?: boolean }) {
  return (
    <div style={{ flex: 1, background: destaque ? "rgba(217,164,65,0.08)" : "#141a17", border: `1px solid ${destaque ? GOLD : "#243029"}`, borderRadius: 9, padding: "7px 8px", textAlign: "center" }}>
      <div style={{ fontFamily: FD, fontSize: 15, fontWeight: 700, color: destaque ? GOLD : "#cfd8d2" }}>{valor}%</div>
      <div style={{ fontSize: 9, color: "#7c8a82", textTransform: "uppercase", letterSpacing: "0.03em", marginTop: 1 }}>{rotulo}</div>
    </div>
  );
}

function Aviso({ texto }: { texto: string }) {
  return (
    <div style={{ background: "#121815", border: "1px dashed #2a3a33", borderRadius: 12, padding: "20px 14px", textAlign: "center", fontSize: 12.5, color: "#7c8a82", lineHeight: 1.5 }}>
      {texto}
    </div>
  );
}
