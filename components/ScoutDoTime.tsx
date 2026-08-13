"use client";

// components/ScoutDoTime.tsx
//
// Scout do time — extraído da /pro para ser reutilizável (na /pro e na central
// Pro Max). É autossuficiente: carrega sozinho a competição atual, a equipa
// guardada na nuvem e os dossiês de cada atleta. NÃO faz verificação de nível
// nem reencaminhamento — isso é da página que o usa.
//
// Mostra: a dica de capitão (por histórico) + um cartão-resumo por atleta +
// o detalhe completo (dossiê) ao tocar. Mensagem própria quando não há equipa.

import { useEffect, useState } from "react";
import { Mascot } from "@/components/Mascot";
import { loadSavedCloudFor, resolve, setAthletePool, type TeamState } from "@/lib/team";
import { focoMercado, numeroDaRodada } from "@/lib/calendario";
import type { Athlete } from "@/lib/athletes";
import type { Dossie } from "@/lib/scout";
import { useT } from "@/lib/i18n";

const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";
const VERDE = "#7fd1a3";
const VERM = "#ef8d83";

type EstadoDossie = "carregando" | "erro" | Dossie;

export function ScoutDoTime() {
  const t = useT();
  const [compNome, setCompNome] = useState("");
  const [rodadaComp, setRodadaComp] = useState<number | null>(null);
  const [atletas, setAtletas] = useState<Athlete[] | null>(null);
  const [capitao, setCapitao] = useState<string | null>(null);
  const [dossies, setDossies] = useState<Record<string, EstadoDossie>>({});
  const [aberto, setAberto] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const foco = focoMercado();
      const compFoco = foco.aDecorrer ?? foco.alvo;
      const idComp = compFoco.idCompeticao;
      setCompNome(compFoco.nome);
      setRodadaComp(numeroDaRodada(idComp));

      // Lista de atletas da competição (para nome/país/preço dos cartões).
      try {
        const j = await fetch(`/api/atletas?id=${idComp}`).then((r) => r.json());
        const list = Array.isArray(j?.atletas) ? j.atletas : [];
        if (list.length > 0) setAthletePool(list as never);
      } catch {}

      const team: TeamState | null = await loadSavedCloudFor(idComp);
      if (!active) return;
      if (!team || team.ids.length === 0) { setAtletas([]); return; }
      const lista = resolve(team.ids);
      setAtletas(lista);
      setCapitao(team.captain);

      setDossies(Object.fromEntries(lista.map((a) => [a.id, "carregando" as EstadoDossie])));
      for (const a of lista) {
        fetch(`/api/dossie?person=${a.id}&comp=${idComp}`)
          .then((r) => r.json())
          .then((j) => {
            if (!active) return;
            const d = j?.dossie as Dossie | undefined;
            setDossies((prev) => ({ ...prev, [a.id]: d ?? "erro" }));
          })
          .catch(() => { if (active) setDossies((prev) => ({ ...prev, [a.id]: "erro" })); });
      }
    })();
    return () => { active = false; };
  }, []);

  const atletaAberto = atletas?.find((a) => a.id === aberto) ?? null;
  const dossieAberto = aberto ? dossies[aberto] : undefined;

  const info = `${compNome}${rodadaComp ? ` · ${t("pl.rodadaN", { n: rodadaComp })}` : ""}`;

  return (
    <>
      <SectionTitle>{t("sc.oScoutDoTeuTime")}</SectionTitle>
      {compNome && (
        <p style={{ fontSize: 12, color: "#93a39a", margin: "0 0 12px", lineHeight: 1.5 }}>
          {t("sc.introMedia", { info }).split(/(%A%)/).map((s, i) =>
            s === "%A%" ? <strong key={i} style={{ color: "#cfd8d2" }}>{t("sc.noNivel")}</strong> : s
          )}
        </p>
      )}

      {atletas === null ? (
        <p style={{ fontSize: 13, color: "#7c8a82", marginBottom: 22 }}>{t("sc.aCarregarTime")}</p>
      ) : atletas.length === 0 ? (
        <section style={{ background: "#121815", border: `1px solid ${GOLD}`, borderRadius: 16, padding: 16, marginBottom: 22, display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ width: 52, height: 52, flexShrink: 0 }}><Mascot belt="#141110" expression="indicando" /></div>
          <p style={{ fontSize: 13.5, color: "#a9b4ac", lineHeight: 1.55, margin: 0 }}>{t("sc.semEquipa")}</p>
        </section>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 22 }}>
          <DicaCapitao atletas={atletas} dossies={dossies} capitaoAtual={capitao} onAbrir={(id) => setAberto(id)} />
          {atletas.map((a) => (
            <CartaoResumo key={a.id} atleta={a} ehCapitao={a.id === capitao} dossie={dossies[a.id]} onClick={() => setAberto(a.id)} />
          ))}
          <p style={{ fontSize: 11, color: "#7c8a82", lineHeight: 1.5, margin: "6px 0 0", textAlign: "center" }}>
            {t("sc.leiturasHistorico")}
          </p>
        </div>
      )}

      {atletaAberto && (
        <DetalheAtleta atleta={atletaAberto} ehCapitao={atletaAberto.id === capitao} dossie={dossieAberto} onClose={() => setAberto(null)} />
      )}
    </>
  );
}

function escolherCapitao(
  atletas: Athlete[],
  dossies: Record<string, EstadoDossie>
): { pronto: boolean; atleta: Athlete | null; pts: number | null; rotulo: string } {
  const todosResolvidos = atletas.every((a) => {
    const d = dossies[a.id];
    return d !== undefined && d !== "carregando";
  });
  if (!todosResolvidos) return { pronto: false, atleta: null, pts: null, rotulo: "" };

  let melhor: Athlete | null = null;
  let melhorPts = -Infinity;
  let melhorRot = "";
  for (const a of atletas) {
    const d = dossies[a.id];
    if (!d || d === "carregando" || d === "erro") continue;
    const s = sinalDoNivel(d);
    if (s.estado !== "ok" || s.pts === null) continue;
    if (s.pts > melhorPts) {
      melhorPts = s.pts;
      melhor = a;
      melhorRot = s.rotulo;
    }
  }
  if (!melhor) return { pronto: true, atleta: null, pts: null, rotulo: "" };
  return { pronto: true, atleta: melhor, pts: melhorPts, rotulo: melhorRot };
}

function DicaCapitao({ atletas, dossies, capitaoAtual, onAbrir }: { atletas: Athlete[]; dossies: Record<string, EstadoDossie>; capitaoAtual: string | null; onAbrir: (id: string) => void }) {
  const t = useT();
  const r = escolherCapitao(atletas, dossies);

  // Ainda a carregar dossiês.
  if (!r.pronto) {
    return (
      <div style={{ background: "#121815", border: "1px solid #243029", borderRadius: 14, padding: "13px 14px", display: "flex", alignItems: "center", gap: 11 }}>
        <CrownIcon cor="#5f6f67" />
        <span style={{ fontSize: 12.5, color: "#7c8a82" }}>{t("sc.aAnalisarDica")}</span>
      </div>
    );
  }

  // Sem dados suficientes em nenhum atleta.
  if (!r.atleta || r.pts === null) {
    return (
      <div style={{ background: "#121815", border: "1px solid #243029", borderRadius: 14, padding: "13px 14px", display: "flex", alignItems: "center", gap: 11 }}>
        <CrownIcon cor="#7c8a82" />
        <span style={{ fontSize: 12.5, color: "#a9b4ac", lineHeight: 1.5 }}>{t("sc.semHistoricoDica")}</span>
      </div>
    );
  }

  const positivo = r.pts >= 0;
  const jaECapitao = r.atleta.id === capitaoAtual;
  const onde = r.rotulo === "neste nível" ? t("sc.noNivel") : t("sc.ondeForma");
  const nome = sobrenome(r.atleta.name);
  const pts = fmtPts(r.pts);

  // Tom honesto: confiante se positivo; alerta se ninguém tem histórico forte.
  let texto: string;
  if (positivo) {
    texto = jaECapitao
      ? t("sc.dicaJaCapitao", { nome, pts, onde })
      : t("sc.dicaCandidato", { nome, pts, onde });
  } else {
    texto = t("sc.dicaNegativa", { nome, pts, onde });
  }

  return (
    <button
      onClick={() => onAbrir(r.atleta!.id)}
      style={{
        width: "100%", textAlign: "left", cursor: "pointer", color: "#f1ede2",
        background: positivo ? "linear-gradient(160deg,#2a2410,#15110a)" : "#121815",
        border: `1px solid ${positivo ? GOLD : "#5a4a2c"}`, borderRadius: 14, padding: "13px 14px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
        <CrownIcon cor={positivo ? GOLD : "#c0a050"} />
        <span style={{ fontFamily: FD, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: positivo ? GOLD : "#c0a050" }}>{t("sc.dicaCapitao")}</span>
      </div>
      <p style={{ fontSize: 13, color: "#dfe6e0", lineHeight: 1.55, margin: 0 }}>{texto}</p>
      <div style={{ fontSize: 10.5, color: "#7c8a82", marginTop: 8, lineHeight: 1.45 }}>
        {t("sc.dicaDisclaimer")}
      </div>
    </button>
  );
}

function CrownIcon({ cor }: { cor: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={cor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M3 8l4 4 5-7 5 7 4-4v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8z" />
    </svg>
  );
}

function sobrenome(nome: string): string {
  return nome.split(" ").slice(-1)[0] || nome;
}

/* =========================================================================
 * CARTÃO-RESUMO (um por atleta)
 * ========================================================================= */

function CartaoResumo({ atleta, ehCapitao, dossie, onClick }: { atleta: Athlete; ehCapitao: boolean; dossie: EstadoDossie | undefined; onClick: () => void }) {
  const t = useT();
  const sinal = sinalDoNivel(dossie);
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 11, width: "100%", textAlign: "left", cursor: "pointer",
        background: "#121815", border: `1px solid ${ehCapitao ? GOLD : "#243029"}`, borderRadius: 14, padding: "11px 13px", color: "#f1ede2",
      }}
    >
      {/* Avatar com sigla do país */}
      <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#1c3a2e", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontFamily: FD, fontSize: 12, fontWeight: 700, color: "#aee9c9" }}>
        {atleta.countryIso}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 14, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{atleta.name}</span>
          {ehCapitao && <span style={{ flexShrink: 0, fontSize: 9, fontWeight: 700, color: "#3a2a08", background: GOLD, padding: "1px 6px", borderRadius: 999, textTransform: "uppercase" }}>{t("sc.cap")}</span>}
        </div>
        <div style={{ fontSize: 11.5, color: "#93a39a", marginTop: 1 }}>{atleta.category}kg · JC {atleta.priceJc}</div>
      </div>
      {/* Sinal: média no nível desta competição */}
      <div style={{ textAlign: "right", flexShrink: 0, minWidth: 64 }}>
        {sinal.estado === "carregando" ? (
          <span style={{ fontSize: 11, color: "#5f6f67" }}>{t("sc.aAnalisar")}</span>
        ) : sinal.estado === "erro" ? (
          <span style={{ fontSize: 11, color: "#5f6f67" }}>—</span>
        ) : sinal.pts === null ? (
          <>
            <div style={{ fontFamily: FD, fontSize: 15, fontWeight: 700, color: "#7c8a82" }}>—</div>
            <div style={{ fontSize: 9.5, color: "#5f6f67" }}>{t("sc.semDados")}</div>
          </>
        ) : (
          <>
            <div style={{ fontFamily: FD, fontSize: 17, fontWeight: 700, color: corPts(sinal.pts) }}>{fmtPts(sinal.pts)}</div>
            <div style={{ fontSize: 9.5, color: "#7c8a82" }}>{sinal.rotulo === "neste nível" ? t("sc.nesteNivel") : t("sc.formaRecente")}</div>
          </>
        )}
      </div>
    </button>
  );
}

// Extrai o sinal-chave: média no nível desta competição (ou forma recente em fallback).
// rotulo é o VALOR canónico ("neste nível" / "forma recente") — usado na lógica; traduzido só ao mostrar.
function sinalDoNivel(d: EstadoDossie | undefined): { estado: "carregando" | "erro" | "ok"; pts: number | null; rotulo: string } {
  if (d === undefined || d === "carregando") return { estado: "carregando", pts: null, rotulo: "" };
  if (d === "erro") return { estado: "erro", pts: null, rotulo: "" };
  const nivel = d.desempenhoPorNivel.find((n) => n.ehNivelDestaCompeticao);
  if (nivel && nivel.pontosMedios !== null) return { estado: "ok", pts: nivel.pontosMedios, rotulo: "neste nível" };
  if (d.formaRecente.pontosMedios !== null) return { estado: "ok", pts: d.formaRecente.pontosMedios, rotulo: "forma recente" };
  return { estado: "ok", pts: null, rotulo: "" };
}

/* =========================================================================
 * DETALHE DO ATLETA (dossiê completo)
 * ========================================================================= */

function DetalheAtleta({ atleta, ehCapitao, dossie, onClose }: { atleta: Athlete; ehCapitao: boolean; dossie: EstadoDossie | undefined; onClose: () => void }) {
  const t = useT();
  const pronto = dossie && dossie !== "carregando" && dossie !== "erro";
  const d = pronto ? (dossie as Dossie) : null;

  // Separa títulos grandes dos "Pequenos Estados" (honestidade — combinado com o Kainan).
  const grandes = d ? d.conquistas.filter((c) => !c.pequenosEstados) : [];
  const pequenos = d ? d.conquistas.filter((c) => c.pequenosEstados) : [];
  const contChampTemPE = !!d && d.conquistas.some((c) => c.nivel === "cont_champ" && c.pequenosEstados);

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(6,8,7,0.82)", zIndex: 120, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 460, maxHeight: "92vh", overflowY: "auto", background: "#0c0e0d", borderTop: `1px solid ${GOLD}`, borderRadius: "18px 18px 0 0", padding: "16px 16px 40px" }}
      >
        {/* Cabeçalho do atleta */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
            <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#1c3a2e", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontFamily: FD, fontSize: 12, fontWeight: 700, color: "#aee9c9" }}>
              {atleta.countryIso}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <span style={{ fontSize: 16, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{atleta.name}</span>
                {ehCapitao && <span style={{ fontSize: 9, fontWeight: 700, color: "#3a2a08", background: GOLD, padding: "1px 6px", borderRadius: 999, textTransform: "uppercase" }}>{t("sc.cap")}</span>}
              </div>
              <div style={{ fontSize: 12, color: "#93a39a", marginTop: 1 }}>
                {d?.perfil.paisNome ?? ""} · {atleta.category}kg
              </div>
            </div>
          </div>
          <button onClick={onClose} aria-label={t("comum.fechar")} style={{ width: 32, height: 32, borderRadius: "50%", border: "1px solid #243029", background: "transparent", color: "#cfd8d2", cursor: "pointer", flexShrink: 0, fontSize: 16 }}>✕</button>
        </div>

        {!pronto ? (
          <p style={{ fontSize: 13, color: dossie === "erro" ? VERM : "#7c8a82", padding: "20px 0", textAlign: "center" }}>
            {dossie === "erro" ? t("sc.erroDossie") : t("sc.aCarregarDossie")}
          </p>
        ) : (
          <>
            {/* Perfil */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
              {d!.perfil.faixa && <Etiqueta titulo={t("sc.faixaLabel")} valor={traduzirFaixa(d!.perfil.faixa, t)} />}
              {d!.perfil.tecnica && <Etiqueta titulo={t("sc.tecnica")} valor={d!.perfil.tecnica} />}
              {d!.perfil.treinador && <Etiqueta titulo={t("sc.treinador")} valor={d!.perfil.treinador} />}
              {d!.perfil.idade !== null && <Etiqueta titulo={t("sc.idade")} valor={`${d!.perfil.idade}`} />}
            </div>

            {/* Destaque: nível desta competição */}
            <SectionTitle>{t("sc.nestaCompeticao")}</SectionTitle>
            <BlocoNivelAlvo dossie={d!} />

            {/* Números de experiência */}
            <SectionTitle>{t("sc.carreira")}</SectionTitle>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <NumBox label={t("sc.lutas")} valor={`${d!.experiencia.lutas}`} />
              <NumBox label={t("sc.vitorias")} valor={`${Math.round(d!.experiencia.taxaVitoria * 100)}%`} />
              <NumBox label={t("sc.comps")} valor={`${d!.experiencia.competicoes}`} />
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
              <NumBox label={t("sc.ouro")} valor={`${d!.medalhas.ouro}`} ouro={d!.medalhas.ouro > 0} />
              <NumBox label={t("sc.prata")} valor={`${d!.medalhas.prata}`} />
              <NumBox label={t("sc.bronze")} valor={`${d!.medalhas.bronze}`} />
            </div>

            {/* Títulos grandes */}
            <SectionTitle>{t("sc.titulosDePeso")}</SectionTitle>
            {grandes.length === 0 ? (
              <p style={{ fontSize: 12.5, color: "#7c8a82", margin: "0 0 16px", lineHeight: 1.5 }}>{t("sc.semPodiosTopo")}</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 16 }}>
                {grandes.map((c, i) => <LinhaConquista key={i} c={c} />)}
              </div>
            )}

            {/* Pequenos Estados — separados, com aviso de contexto */}
            {pequenos.length > 0 && (
              <>
                <SectionTitle>{t("sc.pequenosEstados")}</SectionTitle>
                <p style={{ fontSize: 11.5, color: "#7c8a82", margin: "0 0 8px", lineHeight: 1.5 }}>
                  {t("sc.pequenosNota")}
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 16 }}>
                  {pequenos.map((c, i) => <LinhaConquista key={i} c={c} />)}
                </div>
              </>
            )}

            {/* Forma recente */}
            <SectionTitle>{t("sc.formaRecente")}</SectionTitle>
            {d!.formaRecente.competicoes.length === 0 ? (
              <p style={{ fontSize: 12.5, color: "#7c8a82", margin: "0 0 16px" }}>{t("sc.semCompsRecentes")}</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
                {d!.formaRecente.competicoes.map((r) => (
                  <div key={r.idCompeticao} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: "#0f1411", border: "1px solid #243029", borderRadius: 10, padding: "9px 12px" }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.nome}</div>
                      <div style={{ fontSize: 11, color: "#93a39a" }}>{r.colocacao}{r.ano ? ` · ${r.ano}` : ""}</div>
                    </div>
                    {r.pontosNossos !== null && (
                      <span style={{ fontFamily: FD, fontSize: 14, fontWeight: 700, color: corPts(r.pontosNossos), flexShrink: 0 }}>{fmtPts(r.pontosNossos)}</span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Desempenho por nível */}
            <SectionTitle>{t("sc.desempenhoPorNivel")}</SectionTitle>
            <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 6 }}>
              {d!.desempenhoPorNivel.map((n) => (
                <div key={n.nivel} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, background: n.ehNivelDestaCompeticao ? "#15110a" : "#0f1411", border: `1px solid ${n.ehNivelDestaCompeticao ? GOLD : "#243029"}`, borderRadius: 10, padding: "9px 12px" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600 }}>
                      {n.nivelLabel}
                      {n.nivel === "cont_champ" && contChampTemPE && <span style={{ color: "#7c8a82", fontWeight: 400 }}> *</span>}
                    </div>
                    <div style={{ fontSize: 11, color: "#93a39a" }}>
                      {n.participacoes === 1 ? t("sc.participacaoSing", { n: n.participacoes }) : t("sc.participacaoPlur", { n: n.participacoes })}
                      {n.podios > 0 ? ` · ${n.podios === 1 ? t("sc.podioSing", { n: n.podios }) : t("sc.podioPlur", { n: n.podios })}` : ""}
                      {n.melhorColocacao !== "—" ? ` · ${t("sc.melhorPrefixo")}: ${n.melhorColocacao}` : ""}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    {n.pontosMedios === null ? (
                      <span style={{ fontSize: 11, color: "#5f6f67" }}>—</span>
                    ) : (
                      <span style={{ fontFamily: FD, fontSize: 14, fontWeight: 700, color: corPts(n.pontosMedios) }}>{fmtPts(n.pontosMedios)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {contChampTemPE && (
              <p style={{ fontSize: 10.5, color: "#7c8a82", margin: "0 0 14px", lineHeight: 1.5 }}>{t("sc.contChampNota")}</p>
            )}

            {d!.avisos.length > 0 && (
              <p style={{ fontSize: 10.5, color: "#5f6f67", lineHeight: 1.5, margin: "8px 0 0" }}>{d!.avisos.join(" ")}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Bloco de destaque: a linha do nível desta competição (ou fallback de forma recente).
function BlocoNivelAlvo({ dossie }: { dossie: Dossie }) {
  const t = useT();
  const nivel = dossie.desempenhoPorNivel.find((n) => n.ehNivelDestaCompeticao);
  if (nivel) {
    return (
      <div style={{ background: "#15110a", border: `1px solid ${GOLD}`, borderRadius: 12, padding: "13px 14px", marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 700 }}>{nivel.nivelLabel}</div>
            <div style={{ fontSize: 11.5, color: "#93a39a", marginTop: 2 }}>
              {nivel.participacoes === 1 ? t("sc.participacaoSing", { n: nivel.participacoes }) : t("sc.participacaoPlur", { n: nivel.participacoes })}
              {nivel.podios > 0 ? ` · ${nivel.podios === 1 ? t("sc.podioSing", { n: nivel.podios }) : t("sc.podioPlur", { n: nivel.podios })}` : ` · ${t("sc.semPodios")}`}
            </div>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            {nivel.pontosMedios === null ? (
              <span style={{ fontSize: 12, color: "#7c8a82" }}>{t("sc.semDados")}</span>
            ) : (
              <>
                <div style={{ fontFamily: FD, fontSize: 22, fontWeight: 700, color: corPts(nivel.pontosMedios) }}>{fmtPts(nivel.pontosMedios)}</div>
                <div style={{ fontSize: 10, color: "#7c8a82" }}>{t("sc.mediaPontos")}</div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }
  // Sem nível inferido: usa a forma recente.
  return (
    <div style={{ background: "#0f1411", border: "1px solid #243029", borderRadius: 12, padding: "13px 14px", marginBottom: 18 }}>
      <div style={{ fontSize: 12.5, color: "#a9b4ac", lineHeight: 1.5 }}>
        {t("sc.nivelFallback").split(/(%A%)/).map((s, i) =>
          s === "%A%"
            ? (dossie.formaRecente.pontosMedios === null
                ? <span key={i}>{t("sc.semDadosParenteses")}</span>
                : <strong key={i} style={{ color: corPts(dossie.formaRecente.pontosMedios) }}>{fmtPts(dossie.formaRecente.pontosMedios)} pts</strong>)
            : s
        )}
      </div>
    </div>
  );
}

function LinhaConquista({ c }: { c: Dossie["conquistas"][number] }) {
  const t = useT();
  const cor = c.medalha === "ouro" ? GOLD : c.medalha === "prata" ? "#cfd8d2" : "#c08a5a";
  const rotulo = c.medalha === "ouro" ? t("sc.ouro") : c.medalha === "prata" ? t("sc.prata") : t("sc.bronze");
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#0f1411", border: "1px solid #243029", borderRadius: 10, padding: "9px 12px" }}>
      <span style={{ width: 9, height: 9, borderRadius: "50%", background: cor, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.nome}</div>
        <div style={{ fontSize: 11, color: "#93a39a" }}>{rotulo} · {c.nivelLabel}{c.ano ? ` · ${c.ano}` : ""}</div>
      </div>
    </div>
  );
}

/* =========================================================================
 * HELPERS DE UI
 * ========================================================================= */

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily: FD, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#93a39a", marginBottom: 10 }}>{children}</div>;
}

function NumBox({ label, valor, ouro }: { label: string; valor: string; ouro?: boolean }) {
  return (
    <div style={{ flex: 1, background: "#0f1411", border: "1px solid #243029", borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
      <div style={{ fontSize: 10.5, color: "#7c8a82", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div style={{ fontFamily: FD, fontSize: 17, fontWeight: 700, color: ouro ? GOLD : "#f1ede2", marginTop: 2 }}>{valor}</div>
    </div>
  );
}

function Etiqueta({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div style={{ background: "#0f1411", border: "1px solid #243029", borderRadius: 9, padding: "6px 10px" }}>
      <div style={{ fontSize: 9.5, color: "#7c8a82", textTransform: "uppercase", letterSpacing: "0.05em" }}>{titulo}</div>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: "#e7ede8", marginTop: 1 }}>{valor}</div>
    </div>
  );
}

function fmtPts(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}
function corPts(n: number): string {
  if (n > 0) return VERDE;
  if (n < 0) return VERM;
  return "#cfd8d2";
}

// "Black belt - II DAN" -> "Preta II Dan" (simplifica o que a API dá).
function traduzirFaixa(belt: string, t: ReturnType<typeof useT>): string {
  const b = belt.toLowerCase();
  let cor = belt;
  if (b.includes("black")) cor = t("faixa.preta");
  else if (b.includes("brown")) cor = t("faixa.marrom");
  else if (b.includes("blue")) cor = t("faixa.azul");
  const dan = belt.match(/([IVX]+)\s*DAN/i);
  return dan ? `${cor} ${dan[1].toUpperCase()} Dan` : cor;
}
