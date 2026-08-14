"use client";

import { useState } from "react";
import { Mascot } from "@/components/Mascot";
import { CartaoDesempenho } from "@/components/CartaoDesempenho";
import type { Identity } from "@/components/Escudo";
import type { TeamState } from "@/lib/team";
import { type DesempenhoRodada, type ResumoExtra, mensagemDesempenho } from "@/lib/desempenho";
import { useT } from "@/lib/i18n";

const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";

const code3 = (iso: string) => iso;
const sobrenome = (nome: string) => nome.split(" ").slice(-1)[0] || nome;

export function Desempenho({
  dados,
  identity,
  team,
  nome,
  faixa = "Branca",
  pro = false,
  extra,
  daGaleria = false,
  aoVivo = false,
  userId,
  onFechar,
  onNaoMostrarMais,
}: {
  dados: DesempenhoRodada;
  identity: Identity;
  team: TeamState;
  nome: string;
  faixa?: string;
  pro?: boolean;
  extra?: ResumoExtra | null;
  daGaleria?: boolean;
  aoVivo?: boolean;
  userId?: string | null;
  onFechar: () => void;
  onNaoMostrarMais?: () => void;
}) {
  const t = useT();
  const [partilhar, setPartilhar] = useState(false);
  const total = dados.pontuacaoTotal;
  const positivo = total >= 0;

  // Link para rever a MINHA equipa desta rodada (modo visita, só-leitura). Abre o
  // dojo com ?ver=<o meu próprio id>&comp=<competição da rodada>: o meu-time mostra
  // a escalação FIXA daquele dia (grelha de tatame, pontos, detalhe luta-a-luta).
  // Só faz sentido quando sabemos quem sou (userId) e qual a competição.
  const podeVerEquipa = !!userId && !!dados.idCompeticao;
  function verEquipaDaRodada() {
    if (!podeVerEquipa) return;
    window.location.href = `/meu-time?ver=${encodeURIComponent(userId!)}&comp=${encodeURIComponent(dados.idCompeticao)}`;
  }

  // AO VIVO: a competição ainda decorre, os pontos são PARCIAIS. Muda o
  // enquadramento (título, rótulo, mensagem) para não parecer um resultado final.
  const rotuloTopo = aoVivo
    ? (dados.numeroRodada ? t("des.aoVivoRodada", { n: dados.numeroRodada }) : t("des.aoVivo"))
    : (dados.numeroRodada ? t("des.rodadaDesempenho", { n: dados.numeroRodada }) : t("des.teuDesempenho"));
  const rotuloPontos = aoVivo ? t("des.pontosAteAgora") : t("cd.pontosNaRodada");

  return (
    <>
      <div style={{ position: "fixed", inset: 0, background: "rgba(6,8,7,0.86)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18, zIndex: 125, overflowY: "auto" }}>
        <div style={{ width: "100%", maxWidth: 360, background: "#121815", border: `1px solid ${GOLD}`, borderRadius: 20, padding: 22, textAlign: "center", margin: "auto" }}>
          {/* Cabeçalho com Dôdo + competição */}
          <div style={{ width: 80, height: 80, margin: "0 auto 6px" }}>
            <Mascot belt="#141110" expression={total >= 30 ? "comemorando" : "feliz"} />
          </div>
          {/* Ao vivo: selo "a decorrer" com ponto pulsante; senão, o rótulo normal. */}
          {aoVivo ? (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#e2655a" }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#e2655a", display: "inline-block" }} />
              {rotuloTopo}
            </div>
          ) : (
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#93a39a" }}>
              {rotuloTopo}
            </div>
          )}
          <h2 style={{ fontFamily: FD, fontSize: 19, fontWeight: 700, textTransform: "uppercase", margin: "4px 0 2px", lineHeight: 1.1 }}>{dados.nomeCompeticao}</h2>

          {/* Pontuação grande */}
          <div style={{ margin: "16px 0 6px" }}>
            <div style={{ fontFamily: FD, fontSize: 52, fontWeight: 700, color: positivo ? GOLD : "#ef8d83", lineHeight: 1 }}>
              {positivo ? "+" : ""}{total}
            </div>
            <div style={{ fontSize: 11, color: "#93a39a", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 2 }}>{rotuloPontos}</div>
          </div>

          <p style={{ fontSize: 13.5, color: "#c7d0c9", lineHeight: 1.5, margin: "10px 0 18px" }}>{mensagemDesempenho(total, nome, aoVivo, t)}</p>

          {/* BÓNUS: posição na rodada + comparação com a média. Só no resumo FINAL —
              ao vivo a média/posição ainda estão a mexer, não as mostramos. */}
          {!aoVivo && extra && extra.totalJogadores > 0 && (
            <div style={{ background: "#0f1411", border: "1px solid #243029", borderRadius: 14, padding: "12px 14px", marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-around", alignItems: "center" }}>
                <div>
                  <div style={{ fontFamily: FD, fontSize: 22, fontWeight: 700, color: GOLD }}>{extra.posicao}º</div>
                  <div style={{ fontSize: 9.5, color: "#93a39a", textTransform: "uppercase", letterSpacing: "0.05em" }}>{t("des.deN", { n: extra.totalJogadores })}</div>
                </div>
                <div style={{ width: 1, height: 34, background: "#243029" }} />
                <div>
                  <div style={{ fontFamily: FD, fontSize: 22, fontWeight: 700, color: "#cfd8d2" }}>{extra.media}</div>
                  <div style={{ fontSize: 9.5, color: "#93a39a", textTransform: "uppercase", letterSpacing: "0.05em" }}>{t("des.mediaGeral")}</div>
                </div>
                {extra.patrimonio != null && (
                  <>
                    <div style={{ width: 1, height: 34, background: "#243029" }} />
                    <div>
                      <div style={{ fontFamily: FD, fontSize: 22, fontWeight: 700, color: extra.ganho >= 0 ? "#7fd1a3" : "#ef8d83" }}>
                        {extra.ganho >= 0 ? "+" : ""}{extra.ganho}
                      </div>
                      <div style={{ fontSize: 9.5, color: "#93a39a", textTransform: "uppercase", letterSpacing: "0.05em" }}>{t("des.jcRodada")}</div>
                    </div>
                  </>
                )}
              </div>
              <div style={{ fontSize: 12, color: extra.acimaDaMedia ? "#7fd1a3" : "#d9a441", marginTop: 10, fontWeight: 700 }}>
                {extra.acimaDaMedia ? t("des.acimaMedia") : t("des.abaixoMedia")}
              </div>
              {extra.patrimonio != null && (
                <div style={{ fontSize: 11, color: "#7c8a82", marginTop: 4 }}>
                  {t("des.patrimonioLabel")} <span style={{ color: GOLD, fontWeight: 700 }}>JC {extra.patrimonio}</span>
                </div>
              )}
            </div>
          )}

          {/* Capitão + melhor atleta */}
          <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
            {dados.capitao && (
              <DestaqueCard
                rotulo={t("des.teuCapitao")}
                nome={sobrenome(dados.capitao.atleta.name)}
                pais={code3(dados.capitao.atleta.countryIso)}
                pontos={dados.capitao.pontos}
                dourado
              />
            )}
            {dados.melhor && (
              <DestaqueCard
                rotulo={t("cd.melhorAtleta")}
                nome={sobrenome(dados.melhor.atleta.name)}
                pais={code3(dados.melhor.atleta.countryIso)}
                pontos={dados.melhor.pontos}
              />
            )}
          </div>

          <button onClick={() => setPartilhar(true)} style={{ width: "100%", padding: 13, borderRadius: 12, border: "none", background: GOLD, color: "#1b211e", fontFamily: FD, fontSize: 15, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", cursor: "pointer" }}>
            {aoVivo ? t("des.partilharParcial") : t("cd.partilharDesempenho")}
          </button>

          {/* Rever a equipa que escalei nesta rodada (só-leitura). */}
          {podeVerEquipa && (
            <button onClick={verEquipaDaRodada} style={{ width: "100%", marginTop: 10, padding: 12, borderRadius: 12, border: "1px solid #2a4d3e", background: "transparent", color: "#aee9c9", fontFamily: FD, fontSize: 13.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", cursor: "pointer" }}>
              {t("des.verEquipaRodada")}
            </button>
          )}

          {/* AO VIVO: só "Fechar" (sem "Não mostrar mais", para não queimar o
              resumo FINAL que aparece quando a competição fechar).
              FINAL da galeria: só "Fechar".
              FINAL automático: "Não mostrar mais" + "Fechar (ver mais tarde)". */}
          {aoVivo ? (
            <button onClick={onFechar} style={{ marginTop: 10, background: "transparent", border: "none", color: "#93a39a", fontSize: 13, cursor: "pointer", fontFamily: FB }}>{t("comum.fechar")}</button>
          ) : daGaleria ? (
            <button onClick={onFechar} style={{ marginTop: 10, background: "transparent", border: "none", color: "#93a39a", fontSize: 13, cursor: "pointer", fontFamily: FB }}>{t("comum.fechar")}</button>
          ) : (
            <>
              {onNaoMostrarMais && (
                <button onClick={onNaoMostrarMais} style={{ width: "100%", marginTop: 10, padding: 12, borderRadius: 12, border: "1px solid #243029", background: "transparent", color: "#cfd8d2", fontFamily: FB, fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>
                  {t("des.naoMostrarMais")}
                </button>
              )}
              <button onClick={onFechar} style={{ marginTop: 10, background: "transparent", border: "none", color: "#93a39a", fontSize: 13, cursor: "pointer", fontFamily: FB }}>{t("des.fecharVerMaisTarde")}</button>
            </>
          )}
        </div>
      </div>

      {partilhar && (
        <CartaoDesempenho
          identity={identity}
          faixa={faixa}
          dados={dados}
          pro={pro}
          onClose={() => setPartilhar(false)}
        />
      )}
    </>
  );
}

function DestaqueCard({ rotulo, nome, pais, pontos, dourado }: { rotulo: string; nome: string; pais: string; pontos: number; dourado?: boolean }) {
  return (
    <div style={{ flex: 1, background: "#0f1411", border: `1px solid ${dourado ? GOLD : "#243029"}`, borderRadius: 12, padding: "11px 8px" }}>
      <div style={{ fontSize: 9.5, color: dourado ? GOLD : "#93a39a", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700, marginBottom: 4 }}>{rotulo}</div>
      <div style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nome}</div>
      <div style={{ fontSize: 10, color: "#7c8a82", marginTop: 1 }}>{pais}</div>
      <div style={{ fontFamily: FD, fontSize: 18, fontWeight: 700, color: pontos >= 0 ? "#7fd1a3" : "#ef8d83", marginTop: 4 }}>{pontos >= 0 ? "+" : ""}{pontos}</div>
    </div>
  );
}
