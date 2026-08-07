"use client";
// Conteúdo da aba "Resultados" (dentro de /ligas).
// Duas secções:
//   • Resultados positivos — onde ficaste em 1º/2º/3º, com certificado para
//     partilhar. Junta: copas, ligas de amigos (pontos corridos), campeão do
//     ano (Mundial/Continental) e Melhor da Rodada (Mundial/Continental).
//   • Resultados — do 4º para baixo (ou eliminação em copa). Só registo, sem
//     certificado, para a aba dar a sensação de histórico sem poluir.
//
// Tudo é montado a partir dos endpoints que JÁ existem (mesmos números do resto
// da app): /api/liga/minhas, /api/copa/chave, /api/liga/geral, /api/liga/campeoes
// e /api/liga/melhores-rodada?historico=1.
//
// DOIS TIPOS DE TÍTULO — não confundir:
//   • RODADA (variante "rodada") — foste o nº1 do mundo (ou do teu continente)
//     NUMA competição. Sai a cada rodada. O certificado tem de dizer QUAL rodada
//     e QUAL competição, senão não se distingue do título de época.
//   • ANO   (variante "anual" vinda de /api/liga/campeoes) — foste campeão da
//     ÉPOCA inteira. Só existe depois de 31 de dezembro, quando o cron corre o
//     fecharAnoOficial. Ver TRAVA DO ANO na secção 2.
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Escudo, DEFAULT_IDENTITY, type Identity } from "@/components/Escudo";
import { focoMercado, rotuloRodada } from "@/lib/calendario";
import { CartaoCertificado, type PosicaoPodio } from "@/components/CartaoCertificado";
const FD = "var(--font-geist-mono), system-ui, sans-serif";
const GOLD = "#d9a441";
// Um certificado partilhável (1º/2º/3º ou Melhor da Rodada).
interface Positivo {
  chave: string;
  // Como abrir o certificado:
  variante: "anual" | "rodada";
  posicao: PosicaoPodio;        // anual: campeao/vice/terceiro; rodada: sempre "campeao"
  tituloRodada?: string;        // só na variante rodada (ex. "Mundial + Europa")
  identity: Identity;
  nomeCertificado: string;      // nome que aparece no certificado (liga/copa/competição)
  nParticipantes: number;
  // Para o cartão da lista:
  medalha: string;
  cor: string;
  rotulo: string;               // ex. "Campeão", "3º lugar", "Rodada 24 · Mundial + Europa"
  contexto: string;             // ex. "Copa do Dojo", "Liga Mundial 2026", nome da competição
  pontos: number | null;
}
// Um resultado sem pódio (4º+ ou eliminado). Só registo, sem certificado.
interface Outro {
  chave: string;
  identity: Identity;
  contexto: string;             // nome da liga/copa
  detalhe: string;              // "5º de 12" / "Eliminado" / "Pontos corridos · terminada"
}
interface MinhaLiga {
  id: string;
  name: string;
  formato: string;
  invite_code: string;
  escudo: Identity | null;
  estado?: string | null;
  copa_estado?: string | null;
}
function ident(escudo: Identity | null | undefined, nome: string): Identity {
  return { ...DEFAULT_IDENTITY, ...(escudo || {}), name: nome };
}
function metaPosicao(pos: PosicaoPodio): { medalha: string; cor: string; rotulo: string } {
  if (pos === "campeao") return { medalha: "🥇", cor: GOLD, rotulo: "Campeão" };
  if (pos === "vice") return { medalha: "🥈", cor: "#c8ccd2", rotulo: "Vice-campeão" };
  return { medalha: "🥉", cor: "#c87f43", rotulo: "3º lugar" };
}
function posicaoDePodio(n: number): PosicaoPodio | null {
  return n === 1 ? "campeao" : n === 2 ? "vice" : n === 3 ? "terceiro" : null;
}
export function ResultadosConteudo() {
  const [aCarregar, setACarregar] = useState(true);
  const [semSessao, setSemSessao] = useState(false);
  const [positivos, setPositivos] = useState<Positivo[]>([]);
  const [outros, setOutros] = useState<Outro[]>([]);
  const [cert, setCert] = useState<Positivo | null>(null);
  const [aba, setAba] = useState<"titulos" | "participacoes">("titulos");
  const idComp = (focoMercado().aDecorrer ?? focoMercado().atual).idCompeticao;
  useEffect(() => {
    let vivo = true;
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user?.id;
      if (!uid) { if (vivo) { setSemSessao(true); setACarregar(false); } return; }
      const pos: Positivo[] = [];
      const out: Outro[] = [];
      // Helper de fetch tolerante a falhas.
      async function getJSON(url: string): Promise<Record<string, unknown> | null> {
        try { const r = await fetch(url); return await r.json(); } catch { return null; }
      }
      // 1) MELHOR DA RODADA (histórico): cada vitória de rodada é um certificado.
      //    O certificado TEM de identificar a rodada e a competição — senão
      //    confunde-se com o título de época. O número da rodada sai do
      //    calendário (rotuloRodada), pelo id_competicao; não há nada a guardar
      //    na base de dados por causa disto.
      const mr = await getJSON(`/api/liga/melhores-rodada?historico=1&user_id=${uid}`);
      if (mr && Array.isArray(mr.historico)) {
        for (const r of mr.historico as Array<Record<string, unknown>>) {
          const nomeComp = String(r.nome_competicao || "");
          const rodada = rotuloRodada(String(r.id_competicao));       // "Rodada 24" ou ""
          const escopo = String(r.rotulo || "Melhor da Rodada");      // "Mundial + Europa"
          // No CERTIFICADO: rodada + competição (o que o Kainan pediu).
          const nomeNoCertificado = rodada ? `${rodada} · ${nomeComp}` : nomeComp;
          // No CARTÃO da lista: a rodada vai na linha pequena, com o âmbito, e o
          // nome da competição fica na linha grande (não corta com reticências).
          const rotuloCartao = rodada ? `${rodada} · ${escopo}` : escopo;
          pos.push({
            chave: `rod-${String(r.id_competicao)}-${String(r.escopo)}-${String(r.continente)}`,
            variante: "rodada",
            posicao: "campeao",
            tituloRodada: escopo,
            identity: ident(r.escudo as Identity | null, String(r.nome_time || "Equipa")),
            nomeCertificado: nomeNoCertificado,
            nParticipantes: Number(r.n_participantes || 0),
            medalha: "🥇",
            cor: GOLD,
            rotulo: rotuloCartao,
            contexto: nomeComp,
            pontos: Number(r.pontos || 0),
          });
        }
      }
      // 2) CAMPEÃO DO ANO (Mundial e Continental). Só entra se estiver no top 3.
      //    O nº de participantes vem do ranking do ano (geral) — uma chamada por
      //    âmbito, só quando há de facto um título a mostrar.
      //
      //    TRAVA DO ANO: o título de campeão da época só existe depois de a época
      //    FECHAR. O cron grava o pódio anual no fecharAnoOficial, a 1 de janeiro,
      //    sempre para o ano ANTERIOR (e recusa fechar o ano em curso). Por isso
      //    aqui só mostramos anos JÁ TERMINADOS: ano < ano atual. Enquanto 2026
      //    decorre, ninguém é "Campeão 2026" — a posição em curso vê-se no ranking
      //    da liga oficial, não num certificado. A partir de 1/jan/2027 o título de
      //    2026 aparece aqui sozinho.
      const anoAtual = new Date().getFullYear();
      for (const tipo of ["mundial", "continental"] as const) {
        const c = await getJSON(`/api/liga/campeoes?tipo=${tipo}&user_id=${uid}`);
        if (!c || !c.ok || !Array.isArray(c.podio)) continue;
        const ano = c.ano != null ? Number(c.ano) : null;
        // Sem ano conhecido não conseguimos provar que a época fechou: não mostra.
        if (ano == null || !Number.isFinite(ano) || ano >= anoAtual) continue;
        const eu = (c.podio as Array<Record<string, unknown>>).find((p) => String(p.user_id) === uid);
        if (!eu) continue;
        const posPodio = posicaoDePodio(Number(eu.posicao));
        if (!posPodio) continue;
        // Contagem de participantes do ano (aprox.: ranking atual desse âmbito).
        let nPart = 0;
        const g = await getJSON(`/api/liga/geral?tipo=${tipo}&comp=${idComp}&user_id=${uid}`);
        if (g && Array.isArray(g.membros)) nPart = (g.membros as unknown[]).length;
        const m = metaPosicao(posPodio);
        const nomeLiga = tipo === "mundial"
          ? `Liga Mundial ${ano}`
          : `Liga Continental ${ano}`;
        pos.push({
          chave: `ano-${tipo}-${ano}`,
          variante: "anual",
          posicao: posPodio,
          identity: ident(eu.escudo as Identity | null, String(eu.nome_time || "Equipa")),
          nomeCertificado: `${nomeLiga} · Época completa`,
          nParticipantes: nPart,
          medalha: m.medalha,
          cor: m.cor,
          rotulo: `${m.rotulo} do ano`,
          contexto: nomeLiga,
          pontos: Number(eu.pontos || 0),
        });
      }
      // 3) AS MINHAS LIGAS/COPAS TERMINADAS.
      const minhasJ = await getJSON(`/api/liga/minhas?user_id=${uid}`);
      const minhas: MinhaLiga[] = (minhasJ && Array.isArray(minhasJ.ligas) ? minhasJ.ligas : []) as MinhaLiga[];
      for (const l of minhas) {
        const ehCopa = l.formato === "copa";
        const terminada = ehCopa ? l.copa_estado === "terminada" : l.estado === "terminada";
        if (!terminada) continue;
        if (ehCopa) {
          // COPA: pódio (campeao/vice/terceiro) via /api/copa/chave.
          const ch = await getJSON(`/api/copa/chave?id=${l.id}`);
          const podio = (ch && (ch.podio as Record<string, unknown> | undefined)) || {};
          const ids = (ch && (ch.identidades as Record<string, { nome_time?: string; escudo?: unknown }> | undefined)) || {};
          const meuIdent = ids[uid] || {};
          const nPart = ch ? Number(ch.nParticiparam || 0) : 0;
          // DOIS TERCEIROS. A copa produz dois medalhistas de bronze (cruzamento
          // diagonal da repescagem), e a rota devolve-os em `podio.terceiros`.
          // Ler só `podio.terceiro` deixava o segundo sem certificado — tinha a
          // medalha no jogo e nada na app.
          //
          // O campo antigo fica no fim como recurso, para copas terminadas antes
          // da alteração, cujo pódio ainda foi gravado no formato singular.
          const terceiros = Array.isArray(podio.terceiros)
            ? (podio.terceiros as unknown[]).map((t) => String(t))
            : podio.terceiro != null ? [String(podio.terceiro)] : [];

          const minhaPos: PosicaoPodio | null =
            String(podio.campeao) === uid ? "campeao" :
            String(podio.vice) === uid ? "vice" :
            terceiros.includes(uid) ? "terceiro" : null;
          if (minhaPos) {
            const m = metaPosicao(minhaPos);
            pos.push({
              chave: `copa-${l.id}`,
              variante: "anual",
              posicao: minhaPos,
              identity: ident((meuIdent.escudo as Identity | null) ?? l.escudo, String(meuIdent.nome_time || l.name)),
              nomeCertificado: l.name,
              nParticipantes: nPart,
              medalha: m.medalha,
              cor: m.cor,
              rotulo: m.rotulo,
              contexto: `${l.name} · Copa Ippon`,
              pontos: null,
            });
          } else {
            out.push({
              chave: `copa-${l.id}`,
              identity: ident((meuIdent.escudo as Identity | null) ?? l.escudo, String(meuIdent.nome_time || l.name)),
              contexto: l.name,
              detalhe: "Copa Ippon · eliminado",
            });
          }
        } else {
          // PONTOS CORRIDOS: posição final via /api/liga/geral?league=.
          const g = await getJSON(`/api/liga/geral?league=${l.id}&comp=${idComp}&user_id=${uid}`);
          const membros = (g && Array.isArray(g.membros) ? g.membros : []) as Array<Record<string, unknown>>;
          const eu = membros.find((m) => String(m.user_id) === uid);
          const total = membros.length;
          const minhaPos = eu ? Number(eu.posicao) : 0;
          const posPodio = posicaoDePodio(minhaPos);
          if (eu && posPodio) {
            const m = metaPosicao(posPodio);
            pos.push({
              chave: `liga-${l.id}`,
              variante: "anual",
              posicao: posPodio,
              identity: ident((eu.escudo as Identity | null) ?? l.escudo, String(eu.nome_time || l.name)),
              nomeCertificado: l.name,
              nParticipantes: total,
              medalha: m.medalha,
              cor: m.cor,
              rotulo: m.rotulo,
              contexto: `${l.name} · Pontos corridos`,
              pontos: eu.pontos_geral != null ? Number(eu.pontos_geral) : null,
            });
          } else {
            out.push({
              chave: `liga-${l.id}`,
              identity: ident((eu?.escudo as Identity | null) ?? l.escudo, String(eu?.nome_time || l.name)),
              contexto: l.name,
              detalhe: eu && minhaPos > 0 ? `Pontos corridos · ${minhaPos}º de ${total}` : "Pontos corridos · terminada",
            });
          }
        }
      }
      if (!vivo) return;
      setPositivos(pos);
      setOutros(out);
      setACarregar(false);
    })();
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (aCarregar) {
    return <div style={{ textAlign: "center", padding: "20px", color: "#7c8a82", fontFamily: FD, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.1em" }}>A carregar…</div>;
  }
  if (semSessao) {
    return (
      <div style={{ background: "#121815", border: "1px dashed #2a3a33", borderRadius: 14, padding: "20px 14px", textAlign: "center" }}>
        <div style={{ fontSize: 13, color: "#c7d0c9", lineHeight: 1.5, marginBottom: 12 }}>Entra na tua conta para veres os teus resultados e certificados.</div>
        <a href="/entrar?voltar=/ligas" style={{ display: "inline-block", background: GOLD, color: "#1b211e", fontFamily: FD, fontWeight: 700, textTransform: "uppercase", padding: "11px 20px", borderRadius: 10, textDecoration: "none", fontSize: 14 }}>Entrar</a>
      </div>
    );
  }
  if (positivos.length === 0 && outros.length === 0) {
    return (
      <div style={{ background: "#121815", border: "1px dashed #2a3a33", borderRadius: 14, padding: "20px 14px", textAlign: "center" }}>
        <div style={{ fontSize: 13, color: "#c7d0c9", lineHeight: 1.5 }}>Ainda não tens resultados.<br />Quando ficares no pódio de uma liga, copa ou rodada, o teu certificado aparece aqui.</div>
      </div>
    );
  }
  return (
    <>
      {/* Sub-abas: Títulos (conquistas, com certificado) vs Participações (4º+). */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, borderBottom: "1px solid #1a221d" }}>
        {([
          ["titulos", `Títulos${positivos.length ? ` (${positivos.length})` : ""}`],
          ["participacoes", `Participações${outros.length ? ` (${outros.length})` : ""}`],
        ] as const).map(([k, label]) => (
          <button key={k} onClick={() => setAba(k)} style={{ flex: 1, textAlign: "center", background: "transparent", border: "none", borderBottom: `2px solid ${aba === k ? GOLD : "transparent"}`, color: aba === k ? "#f1ede2" : "#7c8a82", fontFamily: FD, fontSize: 12, fontWeight: 700, textTransform: "uppercase", padding: "8px 0", cursor: "pointer" }}>{label}</button>
        ))}
      </div>
      {/* SUB-ABA "TÍTULOS" — conquistas com certificado (1º/2º/3º e Melhor da Rodada). */}
      {aba === "titulos" && (
        positivos.length === 0 ? (
          <div style={{ background: "#121815", border: "1px dashed #2a3a33", borderRadius: 14, padding: "20px 14px", textAlign: "center" }}>
            <div style={{ fontSize: 13, color: "#c7d0c9", lineHeight: 1.5 }}>Ainda não tens títulos.<br />Fica no top 3 de uma liga, copa ou rodada para ganhares o teu certificado.</div>
          </div>
        ) : (
          <>
            <p style={{ fontSize: 12, color: "#7c8a82", margin: "-2px 0 12px", lineHeight: 1.5 }}>As tuas conquistas — pódios de copa e liga, Campeão do ano e Melhor da Rodada. Toca para ver e partilhar o certificado.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {positivos.map((p) => (
                <div key={p.chave} style={{ background: "#121815", border: `1px solid ${p.cor}`, borderRadius: 12, padding: "10px 12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                    <span style={{ fontSize: 22, flexShrink: 0 }}>{p.medalha}</span>
                    <div style={{ flexShrink: 0 }}><Escudo config={p.identity} size={32} /></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: "#f1ede2", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.contexto}</div>
                      <div style={{ fontSize: 10.5, color: p.cor, fontFamily: FD, fontWeight: 700, textTransform: "uppercase" }}>{p.rotulo}</div>
                    </div>
                    {p.pontos !== null && (
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontFamily: FD, fontSize: 15, fontWeight: 700, color: p.cor }}>{p.pontos}</div>
                        <div style={{ fontSize: 9, color: "#93a39a", textTransform: "uppercase" }}>pts</div>
                      </div>
                    )}
                  </div>
                  <button onClick={() => setCert(p)} style={{ width: "100%", marginTop: 9, padding: "9px 12px", borderRadius: 9, border: "none", background: p.cor, color: p.posicao === "vice" ? "#14181a" : "#1b1208", fontFamily: FD, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>
                    Ver / partilhar certificado
                  </button>
                </div>
              ))}
            </div>
          </>
        )
      )}
      {/* SUB-ABA "PARTICIPAÇÕES" — 4º+ / eliminado, só registo (sem certificado). */}
      {aba === "participacoes" && (
        outros.length === 0 ? (
          <div style={{ background: "#121815", border: "1px dashed #2a3a33", borderRadius: 14, padding: "20px 14px", textAlign: "center" }}>
            <div style={{ fontSize: 13, color: "#c7d0c9", lineHeight: 1.5 }}>Sem participações por aqui.<br />As ligas e copas em que jogaste sem subir ao pódio aparecem nesta lista.</div>
          </div>
        ) : (
          <>
            <p style={{ fontSize: 12, color: "#7c8a82", margin: "-2px 0 12px", lineHeight: 1.5 }}>Ligas e copas em que participaste e não subiste ao pódio. Fazem parte do teu histórico.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {outros.map((o) => (
                <div key={o.chave} style={{ display: "flex", alignItems: "center", gap: 11, background: "#10140f", border: "1px solid #1f2a23", borderRadius: 12, padding: "10px 12px" }}>
                  <div style={{ flexShrink: 0, opacity: 0.85 }}><Escudo config={o.identity} size={30} /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#cfd8d2", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{o.contexto}</div>
                    <div style={{ fontSize: 11, color: "#7c8a82" }}>{o.detalhe}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )
      )}
      {/* Modal do certificado escolhido */}
      {cert && (
        <CartaoCertificado
          posicao={cert.posicao}
          variante={cert.variante}
          tituloRodada={cert.tituloRodada}
          identity={cert.identity}
          nomeCopa={cert.nomeCertificado}
          nParticipantes={cert.nParticipantes}
          onClose={() => setCert(null)}
        />
      )}
    </>
  );
}
