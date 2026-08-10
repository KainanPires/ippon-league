"use client";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Escudo, DEFAULT_IDENTITY, type Identity } from "@/components/Escudo";
import { focoMercado, numeroDaRodada, rotuloRodada } from "@/lib/calendario";
import { CartaoCertificado, type PosicaoPodio } from "@/components/CartaoCertificado";
import {
  BlocoChave,
  CaixaConfronto,
  CaixaBye,
  type NoChave,
  type Aresta,
  type LadoCaixa,
} from "@/components/Chave";
const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";
// ---- Tipos do que a rota /api/copa/chave devolve ----
interface ConfrontoAPI {
  id: string;
  ronda: number;
  ordem: number;
  fase: "normal" | "final" | "bronze" | "repescagem";
  jogador_a: string;
  jogador_b: string | null;
  id_competicao: string;
  pontos_a: number | null;
  pontos_b: number | null;
  vencedor: string | null;
  decidido_por: string | null;
  estado: "pendente" | "decidido";
  metade?: "cima" | "baixo" | null;
}
interface Identidade { nome_time: string; escudo: Identity | null; }
interface RespostaChave {
  liga: { id: string; name: string; escudo: Identity | null; copa_estado: string };
  confrontos: ConfrontoAPI[];
  identidades: Record<string, Identidade>;
  nInscritos: number;
  nNaChave?: number; // quantos saíram no sorteio (pode ser < nInscritos)
  nParticiparam: number;
  totalRondas: number;
  podio: { campeao?: string; vice?: string; terceiro?: string };
}
// Ordem cronológica de uma competição (semana do calendário). 0 se desconhecida.
function ordemComp(id: string): number {
  return numeroDaRodada(String(id)) ?? 0;
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
// Abre o DOJO de um jogador NAQUELA ronda (competição). Reutiliza a mesma página
// do "Meu Time" em modo visita (grelha de tatame, pontos e detalhe luta-a-luta),
// tal como o "ver dojo" da liga — uma única experiência para ver equipas alheias.
// Como cada ronda é uma competição própria (id_competicao), passamos o comp da
// ronda: o modo visita mostra a escalação FIXA daquela rodada.
function abrirDojo(uid: string, comp: string) {
  window.location.href = `/meu-time?ver=${encodeURIComponent(uid)}&comp=${encodeURIComponent(comp)}`;
}
// PORTÃO ANTI-CÓPIA (igual à liga): só se pode espreitar a equipa de um confronto
// quando NÃO há nada a copiar — ou seja, a ronda já passou (confronto decidido)
// OU é a ronda que decorre agora com o MERCADO JÁ FECHADO. Enquanto o mercado da
// ronda estiver aberto (ou for uma ronda futura), fica trancado: ver a escalação
// e o capitão do rival antes do fecho permitiria copiá-los.
function podeVerEquipa(c: ConfrontoAPI, idADecorrer: string | null): boolean {
  if (c.estado === "decidido") return true; // ronda já decidida (passada)
  if (idADecorrer && c.id_competicao === idADecorrer) return true; // a decorrer, mercado fechado
  return false; // mercado aberto / ronda futura -> trancado
}
export default function PaginaChave() {
  const params = useParams();
  const codigo = String(params?.codigo || "").toUpperCase();
  const [dados, setDados] = useState<RespostaChave | null>(null);
  const [estado, setEstado] = useState<"carregando" | "ok" | "erro">("carregando");
  const [erro, setErro] = useState("");
  const [tutorial, setTutorial] = useState(false);
  const [meuId, setMeuId] = useState<string | null>(null);
  useEffect(() => {
      let vivo = true;
      (async () => {
          // Quem sou eu? (para mostrar o botão de certificado só ao próprio do pódio)
          try {
            const { supabase } = await import("@/lib/supabase");
            const { data: sess } = await supabase.auth.getSession();
            if (vivo) setMeuId(sess.session?.user?.id ?? null);
          } catch { /* sem sessão: ninguém é "eu" */ }
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
        <ChaveConteudo dados={dados} nome={nome} escudoDe={escudoDe} meuId={meuId} onAbrirTutorial={() => setTutorial(true)} onVerEquipa={abrirDojo} />
      )}
    </div>
    {tutorial && <TutorialChave onClose={() => setTutorial(false)} />}
    </main>
  );
}
function ChaveConteudo({ dados, nome, escudoDe, meuId, onAbrirTutorial, onVerEquipa }: {
    dados: RespostaChave;
    nome: (uid: string | null) => string;
    escudoDe: (uid: string | null) => Identity;
    meuId: string | null;
    onAbrirTutorial: () => void;
    onVerEquipa: (uid: string, comp: string) => void;
  }) {
  const { confrontos, totalRondas, podio, liga, nInscritos, nParticiparam } = dados;
  const terminada = liga.copa_estado === "terminada";
  // Quem está REALMENTE na chave. Quem entrou na liga depois do sorteio conta
  // como inscrito mas não disputa — o tamanho da chave é o dos sorteados.
  const naChave = dados.nNaChave ?? nInscritos;
  const chaveGrande = naChave >= 8; // repescagem em cadeia só com 8+
  // Já existem confrontos de repescagem gerados pelo motor? Se sim, mostram-se
  // nas rondas (a sério); se não (início da copa), mostra-se a nota explicativa.
  const temRepescagemReal = confrontos.some((c) => c.fase === "repescagem");
  // Competição a decorrer agora (mercado fechado). Confrontos desta competição
  // podem ser espreitados; os de uma ronda com mercado ainda aberto, não.
  const idADecorrer = focoMercado().aDecorrer?.idCompeticao ?? null;

  // O confronto aberto em detalhe. A caixa na árvore é estreita por
  // necessidade; tudo o resto (estado, "ver equipa", nota da janela da final)
  // vive aqui, ao toque.
  const [aberto, setAberto] = useState<ConfrontoAPI | null>(null);
  // Agrupa os confrontos por ronda. A final e o bronze estão na última ronda.
  // JANELA DO ACUMULADO DA FINAL. Os finalistas ficam conhecidos antes de a
  // repescagem acabar; durante essa espera continuam a somar pontos. A janela
  // vai da competição da final (inclusive) até à última competição usada por
  // qualquer confronto da copa — a mesma conta que o /api/copa/apurar faz.
  const confrontoFinal = confrontos.find((c) => c.fase === "final") || null;
  let janelaFinal: string[] = [];
  if (confrontoFinal) {
    const ordFinal = ordemComp(confrontoFinal.id_competicao);
    janelaFinal = Array.from(new Set(confrontos.map((c) => c.id_competicao).filter(Boolean)))
    .filter((id) => ordemComp(id) >= ordFinal)
    .sort((a, b) => ordemComp(a) - ordemComp(b));
  }
  return (
    <>
    {/* Pódio (no topo) quando a copa terminou. */}
    {terminada && (podio.campeao || podio.vice || podio.terceiro) && (
        <Podio podio={podio} nome={nome} escudoDe={escudoDe} meuId={meuId} nomeCopa={liga.name} nParticipantes={nParticiparam} />
      )}
    {/* Cabeçalho da liga + nº de equipas na chave. */}
    <div style={{ display: "flex", alignItems: "center", gap: 11, background: "#0f1411", border: "1px solid #243029", borderRadius: 14, padding: "11px 13px", marginBottom: 14 }}>
    <div style={{ flexShrink: 0 }}><Escudo config={liga.escudo || DEFAULT_IDENTITY} size={38} /></div>
    <div style={{ flex: 1, minWidth: 0 }}>
    <div style={{ fontSize: 14, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{liga.name}</div>
    <div style={{ fontSize: 11, color: "#93a39a" }}>{naChave} {naChave === 1 ? "equipa" : "equipas"} · {chaveGrande ? "com repescagem" : "mata-mata simples"}</div>
    </div>
    <button onClick={onAbrirTutorial} style={{ flexShrink: 0, background: "transparent", border: `1px solid ${GOLD}`, color: GOLD, fontFamily: FD, fontWeight: 700, fontSize: 10.5, textTransform: "uppercase", padding: "7px 11px", borderRadius: 9, cursor: "pointer" }}>Como funciona</button>
    </div>
    {/* Aviso: entraram na liga depois do sorteio e não disputam esta copa. */}
    {nInscritos > naChave && (
        <div style={{ background: "#101511", border: "1px dashed #2f4a3c", borderRadius: 12, padding: "10px 12px", marginBottom: 14, fontSize: 12, color: "#a9b4ac", lineHeight: 1.5 }}>
        {nInscritos - naChave} {nInscritos - naChave === 1 ? "equipa entrou" : "equipas entraram"} na liga depois do sorteio, por isso não {nInscritos - naChave === 1 ? "está" : "estão"} nesta chave. {nInscritos - naChave === 1 ? "Entra" : "Entram"} na próxima copa.
        </div>
      )}
    {/* --- A CHAVE, EM ÁRVORE ---
      Era uma lista vertical, uma secção por ronda, com cartões largos. Lia-se
      como um relatório, não como uma chave: não se via quem vinha de onde, nem
      o caminho de alguém até à final.

      Agora usa o components/Chave.tsx, o mesmo do /chave-atletas e do /dodo.
      As caixas são estreitas de propósito — é o que permite pôr as rondas lado
      a lado com as linhas a ligá-las.

      O que não cabe numa caixa de 184px (o estado, o "ver equipa", a nota da
      janela da final) não se perde: TOCAR numa caixa abre o cartão completo,
      que é o mesmo CartaoConfronto de antes. Nada foi deitado fora. */}
    {(() => {
          // A árvore constrói-se DE CIMA PARA BAIXO: o confronto (r, o) é
          // alimentado por (r-1, 2o) e (r-1, 2o+1). Os lugares que ainda não
          // existem na base de dados desenham-se vazios — é o afunilamento que
          // dá forma à chave.
          const montar = (lista: ConfrontoAPI[], rondas: number) => {
            const porRO = new Map<string, ConfrontoAPI>();
            for (const c of lista) porRO.set(`${c.ronda}:${c.ordem}`, c);
            const arestas: Aresta[] = [];
            const topo = Math.max(rondas, 0, ...lista.map((c) => c.ronda));

            const no = (r: number, o: number): NoChave => {
              const e = porRO.get(`${r}:${o}`);
              const key = e ? e.id : `vazio:${r}:${o}`;
              if (e && !e.jogador_b && e.decidido_por === "bye") {
                return { tipo: "bye", key, dados: e };
              }
              const filhos: NoChave[] = [];
              if (r > 1) {
                for (const oi of [o * 2, o * 2 + 1]) {
                  const f = no(r - 1, oi);
                  filhos.push(f);
                  arestas.push({ de: f.key, para: key });
                }
              }
              return { tipo: "luta", key, dados: e ?? null, filhos };
            };

            return topo >= 1 ? { arvores: [no(topo, 0)], arestas } : { arvores: [], arestas };
          };

          const principais = confrontos.filter((c) => c.fase === "normal" || c.fase === "final");
          const laterais = confrontos.filter((c) => c.fase === "repescagem" || c.fase === "bronze");

          const b1 = montar(principais, totalRondas);
          const b2 = laterais.length > 0 ? montar(laterais, 0) : null;

          // A caixa: escudo, nome e pontos. O resto vive no cartão que abre ao toque.
          const ladoDe = (uid: string | null, pts: number | null, venceu: boolean): LadoCaixa => {
            if (!uid) return { titulo: "—", vazio: true };
            return {
              titulo: nome(uid),
              resultado: pts == null ? null : String(pts),
              vencedor: venceu,
              marca: <Escudo config={escudoDe(uid)} size={18} />,
            };
          };

          const Caixa = ({ no }: { no: NoChave }) => {
            const c = no.dados as ConfrontoAPI | null;
            if (!c) return <CaixaConfronto a={{ titulo: "—", vazio: true }} b={{ titulo: "—", vazio: true }} />;
            if (no.tipo === "bye") return <CaixaBye lado={ladoDe(c.jogador_a, null, false)} />;
            return (
              <div onClick={() => setAberto(c)} style={{ cursor: "pointer" }} role="button" tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter") setAberto(c); }}
                title="Ver o confronto">
              <CaixaConfronto
              a={ladoDe(c.jogador_a, c.pontos_a, c.vencedor === c.jogador_a)}
              b={ladoDe(c.jogador_b, c.pontos_b, c.vencedor === c.jogador_b)}
              decidida={c.estado === "decidido" && !!c.vencedor}
              />
              </div>
            );
          };

          const proximo = confrontos.find((c) => c.estado === "pendente")?.id ?? null;

          return (
            <>
            <BlocoChave
            titulo={
              // O nome da ronda mais adiantada que ainda está por decidir — é o
              // que diz em que ponto a Copa vai. Com tudo decidido, o título é
              // o da final.
              nomeRonda(
                confrontos.find((c) => c.estado === "pendente" && c.fase !== "repescagem" && c.fase !== "bronze")?.ronda
                  ?? totalRondas,
                totalRondas
              )
            }
            arvores={b1.arvores}
            arestas={b1.arestas}
            destaque={proximo}
            renderCaixa={(no) => <Caixa no={no} />}
            textoVazio="A chave aparece quando o sorteio correr."
            />
            {b2 && (
                <BlocoChave
                titulo="Repescagem e bronzes"
                arvores={b2.arvores}
                arestas={b2.arestas}
                destaque={proximo}
                renderCaixa={(no) => <Caixa no={no} />}
                />
              )}
            </>
          );
        })()}
    {/* --- O CONFRONTO EM DETALHE ---
      O mesmo CartaoConfronto de sempre, agora dentro de uma janela. Nada foi
      reescrito: a caixa da árvore é o resumo, isto é a versão completa. */}
    {aberto && (
        <div
        onClick={() => setAberto(null)}
        style={{ position: "fixed", inset: 0, zIndex: 120, background: "rgba(0,0,0,0.72)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, overflowY: "auto" }}
        >
        <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
        <button
        onClick={() => setAberto(null)}
        aria-label="Fechar"
        style={{ width: 30, height: 30, borderRadius: "50%", border: "1px solid #2a3a33", background: "#0f1411", color: "#cfd8d2", cursor: "pointer", fontSize: 14, lineHeight: 1 }}
        >
        ✕
        </button>
        </div>
        <CartaoConfronto
        c={aberto}
        nome={nome}
        escudoDe={escudoDe}
        destaque={aberto.fase === "final" ? "final" : aberto.fase === "bronze" ? "bronze" : aberto.fase === "repescagem" ? "repescagem" : undefined}
        idADecorrer={idADecorrer}
        onVerEquipa={onVerEquipa}
        janelaFinal={aberto.fase === "final" ? janelaFinal : undefined}
        />
        </div>
        </div>
      )}

    {/* Nota explicativa da repescagem — só ENQUANTO ela ainda não foi gerada
      (início da copa, antes das semis). Quando os confrontos reais existem,
      aparecem nas rondas acima e esta nota desaparece. */}
    {chaveGrande && !temRepescagemReal && (
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
    Cada ronda é uma competição real. Os pontos do confronto são os pontos da tua equipa nessa competição (capitão a dobrar). Na <strong style={{ color: "#8b9a92" }}>final</strong> somam-se as rodadas desde que chegaste a ela até ao dia do bronze.
    </div>
    </>
  );
}
// Um cartão de confronto: dois jogadores, escudo + nome + pontos, vencedor
// destacado. `destaque` muda a moldura (final dourada, bronze acobreado).
// `janelaFinal` (só na final) diz que rodadas entraram na soma — sem isto, um
// "+70" ao lado de uma equipa que fez -59 naquela competição parece um erro.
function CartaoConfronto({ c, nome, escudoDe, destaque, idADecorrer, onVerEquipa, janelaFinal }: {
    c: ConfrontoAPI;
    nome: (uid: string | null) => string;
    escudoDe: (uid: string | null) => Identity;
    destaque?: "final" | "bronze" | "repescagem";
    idADecorrer: string | null;
    onVerEquipa: (uid: string, comp: string) => void;
    janelaFinal?: string[];
  }) {
  const decidido = c.estado === "decidido";
  const bye = c.jogador_b === null;
  const venceuA = decidido && c.vencedor === c.jogador_a;
  const venceuB = decidido && c.vencedor === c.jogador_b;
  // Trancado enquanto o mercado desta ronda não fechar (anti-cópia).
  const trancado = !podeVerEquipa(c, idADecorrer);
  const cor = destaque === "final" ? GOLD : destaque === "bronze" ? "#c87f43" : destaque === "repescagem" ? "#5b8f73" : "#243029";
  const etiqueta = destaque === "final" ? "Final" : destaque === "bronze" ? "Disputa de bronze" : null;
  // Texto da janela do acumulado (só na final e só quando há pontos a explicar).
  let notaJanela: string | null = null;
  if (destaque === "final" && janelaFinal && janelaFinal.length > 0 && !bye) {
    const de = rotuloRodada(janelaFinal[0]);
    const ate = rotuloRodada(janelaFinal[janelaFinal.length - 1]);
    if (janelaFinal.length > 1 && de && ate) {
      notaJanela = `Soma de ${de} a ${ate} — os finalistas continuam a pontuar enquanto a repescagem decorre.`;
    } else if (de) {
      notaJanela = `Pontos de ${de}.`;
    }
  }
  return (
    <div style={{ background: "#121815", border: `1px solid ${cor}`, borderRadius: 13, padding: "10px 12px", marginBottom: 9 }}>
    {etiqueta && (
        <div style={{ fontFamily: FD, fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: cor, marginBottom: 7 }}>{etiqueta}</div>
      )}
    <LinhaJogador uid={c.jogador_a} pontos={c.pontos_a} venceu={venceuA} perdeu={decidido && !venceuA} trancado={trancado} nome={nome} escudoDe={escudoDe} onVerEquipa={() => c.jogador_a && onVerEquipa(c.jogador_a, c.id_competicao)} />
    {bye ? (
        <div style={{ fontSize: 11, color: "#7c8a82", textAlign: "center", padding: "4px 0", fontFamily: FD, textTransform: "uppercase", letterSpacing: "0.05em" }}>passou (sem adversário)</div>
      ) : (
        <>
        <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "2px 0" }}>
        <div style={{ flex: 1, height: 1, background: "#1a221d" }} />
        <span style={{ fontSize: 9.5, color: "#5f6f67", fontFamily: FD, fontWeight: 700 }}>{estadoLabel(c)}</span>
        <div style={{ flex: 1, height: 1, background: "#1a221d" }} />
        </div>
        <LinhaJogador uid={c.jogador_b} pontos={c.pontos_b} venceu={venceuB} perdeu={decidido && !venceuB} trancado={trancado} nome={nome} escudoDe={escudoDe} onVerEquipa={() => c.jogador_b && onVerEquipa(c.jogador_b, c.id_competicao)} />
        </>
      )}
    {notaJanela && (
        <div style={{ marginTop: 8, paddingTop: 7, borderTop: "1px solid #1a221d", fontSize: 10.5, color: "#8b9a92", lineHeight: 1.45 }}>
        {notaJanela}
        </div>
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
function LinhaJogador({ uid, pontos, venceu, perdeu, trancado, nome, escudoDe, onVerEquipa }: {
    uid: string | null;
    pontos: number | null;
    venceu: boolean;
    perdeu: boolean;
    trancado: boolean;
    nome: (uid: string | null) => string;
    escudoDe: (uid: string | null) => Identity;
    onVerEquipa?: () => void;
  }) {
  const temJogador = !!uid;
  // Clicável quando há jogador. Se estiver trancado (mercado aberto), o clique
  // explica que abre ao fechar — não navega, para não revelar a escalação.
  const acaoClique = () => {
    if (!temJogador || !onVerEquipa) return;
    if (trancado) { alert("As equipas desta ronda abrem quando o mercado fechar. 🔒"); return; }
    onVerEquipa();
  };
  return (
    <button
    onClick={acaoClique}
    disabled={!temJogador}
    style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0", opacity: perdeu ? 0.5 : 1, width: "100%", background: "transparent", border: "none", cursor: temJogador ? "pointer" : "default", textAlign: "left", fontFamily: FB }}
    >
    <div style={{ flexShrink: 0 }}><Escudo config={escudoDe(uid)} size={28} /></div>
    <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 700, color: venceu ? GOLD : "#f1ede2", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
    {nome(uid)}
    {venceu && <span style={{ marginLeft: 6, fontSize: 11 }}>✓</span>}
    </span>
    {temJogador && (
        <span style={{ flexShrink: 0, fontSize: 10, color: "#5f6f67", fontFamily: FD }}>{trancado ? "🔒" : "ver equipa ›"}</span>
      )}
    <span style={{ flexShrink: 0, fontFamily: FD, fontSize: 15, fontWeight: 700, color: venceu ? GOLD : "#93a39a" }}>
    {pontos !== null && pontos !== undefined ? (pontos >= 0 ? "+" : "") + pontos : "—"}
    </span>
    </button>
  );
}
function Podio({ podio, nome, escudoDe, meuId, nomeCopa, nParticipantes }: {
    podio: { campeao?: string; vice?: string; terceiro?: string };
    nome: (uid: string | null) => string;
    escudoDe: (uid: string | null) => Identity;
    meuId: string | null;
    nomeCopa: string;
    nParticipantes: number;
  }) {
  // Certificado aberto (a posição que o utilizador clicou para partilhar).
  const [certificado, setCertificado] = useState<PosicaoPodio | null>(null);
  const linha = (uid: string | undefined, medalha: string, label: string, cor: string, pos: PosicaoPodio) => {
    if (!uid) return null;
    const souEu = !!meuId && uid === meuId;
    return (
      <div style={{ background: "#121815", border: `1px solid ${cor}`, borderRadius: 12, padding: "10px 12px", marginBottom: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
      <span style={{ fontSize: 22, flexShrink: 0 }}>{medalha}</span>
      <div style={{ flexShrink: 0 }}><Escudo config={escudoDe(uid)} size={32} /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: "#f1ede2", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nome(uid)}</div>
      <div style={{ fontSize: 10.5, color: cor, fontFamily: FD, fontWeight: 700, textTransform: "uppercase" }}>{label}</div>
      </div>
      </div>
      {/* Só o próprio (cada um do pódio) vê o botão de partilhar o SEU título. */}
      {souEu && (
          <button onClick={() => setCertificado(pos)} style={{ width: "100%", marginTop: 9, padding: "9px 12px", borderRadius: 9, border: "none", background: cor, color: pos === "vice" ? "#14181a" : "#1b1208", fontFamily: FD, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>
          Partilhar o meu título
          </button>
        )}
      </div>
    );
  };
  // Identidade do utilizador para o certificado (nome do time + escudo do pódio).
  const idDe = (uid: string | undefined): Identity => {
    const base = escudoDe(uid ?? null);
    return { ...base, name: nome(uid ?? null) };
  };
  const uidDaPos = (pos: PosicaoPodio): string | undefined =>
  pos === "campeao" ? podio.campeao : pos === "vice" ? podio.vice : podio.terceiro;
  return (
    <div style={{ background: "linear-gradient(160deg,#2a2410,#15110a)", border: `1px solid ${GOLD}`, borderRadius: 16, padding: "16px 15px", marginBottom: 16 }}>
    <div style={{ textAlign: "center", fontFamily: FD, fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: GOLD, marginBottom: 12 }}>🏆 Pódio da Copa</div>
    {linha(podio.campeao, "🥇", "Campeão", GOLD, "campeao")}
    {linha(podio.vice, "🥈", "Vice-campeão", "#c0c0c0", "vice")}
    {linha(podio.terceiro, "🥉", "3º lugar", "#c87f43", "terceiro")}
    {certificado && (
        <CartaoCertificado
        posicao={certificado}
        identity={idDe(uidDaPos(certificado))}
        nomeCopa={nomeCopa}
        nParticipantes={nParticipantes}
        onClose={() => setCertificado(null)}
        />
      )}
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
      t: "Esqueceste-te de escalar?",
      x: "Não ficas a zeros: mantens a última equipa que guardaste, e continuas com ela até salvares uma nova. Só pontuam os atletas dessa equipa que lutaram na competição da ronda.",
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
      x: "Os dois finalistas não decidem o título numa só competição: acumulam pontos a partir do momento em que chegam à final, até ao dia do bronze. O que fizeram nas rondas anteriores não conta — a contagem começa do zero na final. Quem somar mais é o campeão.",
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
