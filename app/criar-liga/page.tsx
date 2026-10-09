"use client";

// app/criar-liga/page.tsx
//
// CRIAR LIGA / COPA (reconstruída).
//
// BUG QUE ISTO CORRIGE (09/10/2026): esta rota tinha ficado com uma CÓPIA do
// ecrã de montar equipa (CriarEquipa). Resultado: clicar em "Criar liga" levava
// a pessoa para o Dojo / "o meu time", e ninguém conseguia criar liga nem copa.
// Esta é a verdadeira página de criação de liga: formulário → POST /api/liga/criar
// → ecrã de sucesso com código de convite.
//
// As traduções (cl.*) já existiam no dicionário nas 7 línguas — são as do ecrã
// original, que sobreviveram à cópia acidental.

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useT } from "@/lib/i18n";
import { useNivel } from "@/lib/useNivel";
import { LIMITES } from "@/lib/planos";
import { BarraInferior } from "@/components/BarraInferior";
import {
  Escudo,
  SymbolGlyph,
  SHAPES,
  PATTERNS,
  LEAGUE_SYMBOLS,
  COLORS,
  shapeIsFree,
  patternIsFree,
  symbolIsFree,
  colorIsFree,
  DEFAULT_IDENTITY,
  type Identity,
  type ShapeId,
  type PatternId,
  type SymbolId,
} from "@/components/Escudo";
import { competicoesReais, nomeCompeticao } from "@/lib/calendario";

const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";
const VERDE = "#3f8f5a";
const BASE = "https://www.ipponleague.com";

type Formato = "pontos" | "copa";
type Privacidade = "aberta" | "mediante_pedido" | "fechada";
type FimTipo = "competicao" | "mes";

// "YYYY/MM/DD" -> Date (meia-noite local).
function dataDe(de: string): Date {
  return new Date(`${de.replace(/\//g, "-")}T00:00:00`);
}

interface LigaCriada {
  invite_code: string;
  name: string;
  formato: string;
}

export default function CriarLigaPage() {
  const t = useT();
  const router = useRouter();
  const { nivel } = useNivel();

  const [sessaoOk, setSessaoOk] = useState<boolean | null>(null);

  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [formato, setFormato] = useState<Formato>("pontos");
  const [privacidade, setPrivacidade] = useState<Privacidade>("fechada");

  const [arranque, setArranque] = useState("");
  const [fimTipo, setFimTipo] = useState<FimTipo>("competicao");
  const [fimComp, setFimComp] = useState("");
  const [fimMes, setFimMes] = useState(""); // "AAAA-MM"

  const [ident, setIdent] = useState<Identity>({ ...DEFAULT_IDENTITY, name: "" });

  const [aCriar, setACriar] = useState(false);
  const [erro, setErro] = useState("");
  const [criada, setCriada] = useState<LigaCriada | null>(null);
  const [copiado, setCopiado] = useState(false);

  // Sessão: criar liga exige conta.
  useEffect(() => {
    let vivo = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!vivo) return;
      if (!data.session) { router.replace(`/entrar?voltar=/criar-liga`); return; }
      setSessaoOk(true);
    })();
    return () => { vivo = false; };
  }, [router]);

  // Competições do calendário (reais, sem clássicos), da mais próxima no tempo.
  const comps = useMemo(() => competicoesReais(), []);
  // Arranque: as que ainda não começaram (de >= hoje). Se nenhuma, cai em todas.
  const compsArranque = useMemo(() => {
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const futuras = comps.filter((c) => dataDe(c.de) >= hoje);
    return futuras.length > 0 ? futuras : comps;
  }, [comps]);

  // Primeira sugestão de arranque.
  useEffect(() => {
    if (!arranque && compsArranque.length > 0) setArranque(compsArranque[0].idCompeticao);
  }, [compsArranque, arranque]);

  // Fim por competição: as que começam DEPOIS do arranque, dentro de 1 ano.
  const compsFim = useMemo(() => {
    const ini = comps.find((c) => c.idCompeticao === arranque);
    if (!ini) return [];
    const dIni = dataDe(ini.de);
    const limite = new Date(); limite.setFullYear(limite.getFullYear() + 1);
    return comps.filter((c) => { const d = dataDe(c.de); return d > dIni && d <= limite; });
  }, [comps, arranque]);

  const souPro = nivel !== "gratis";

  // Listas do editor de escudo: Pro vê tudo; grátis vê só as peças livres.
  const shapesLista = useMemo(() => (souPro ? SHAPES : SHAPES.filter(shapeIsFree)), [souPro]);
  const patternsLista = useMemo(() => (souPro ? PATTERNS : PATTERNS.filter((p) => patternIsFree(p.id))), [souPro]);
  const symbolsLista = useMemo(() => {
    const base: { id: SymbolId; label: string }[] = [{ id: "none", label: "—" }, ...LEAGUE_SYMBOLS];
    return souPro ? base : base.filter((s) => symbolIsFree(s.id));
  }, [souPro]);
  const coresLista = useMemo(() => (souPro ? COLORS : COLORS.filter(colorIsFree)), [souPro]);

  const setEscudo = (patch: Partial<Identity>) => setIdent((prev) => ({ ...prev, ...patch }));

  const nomeOk = nome.trim().length >= 2;

  // Mensagem de limite na língua da pessoa (os números vêm de LIMITES, iguais
  // aos que o servidor aplica).
  const msgLimite = useCallback((fmt: Formato): string => {
    const campo = fmt === "copa" ? "copa" : "pontos";
    if (nivel === "promax") return t("cl.limMax", { maximo: LIMITES.promax[campo] });
    if (nivel === "pro") return t("cl.limPro", { maximo: LIMITES.pro[campo], promax: LIMITES.promax[campo] });
    return t("cl.limGratis", { maximo: LIMITES.gratis[campo], pro: LIMITES.pro[campo], promax: LIMITES.promax[campo] });
  }, [nivel, t]);

  async function criar() {
    setErro("");
    if (!nomeOk) { setErro(t("cl.daNomeLiga")); return; }
    if (!arranque) { setErro(t("cl.escolheArranque")); return; }
    if (formato === "pontos") {
      if (fimTipo === "competicao" && !fimComp) { setErro(t("cl.escolheFim")); return; }
      if (fimTipo === "mes" && !/^\d{4}-\d{2}$/.test(fimMes)) { setErro(t("cl.escolheFim")); return; }
    }
    setACriar(true);
    try {
      const { data } = await supabase.auth.getSession();
      const tok = data.session?.access_token;
      if (!tok) { router.replace(`/entrar?voltar=/criar-liga`); return; }

      const corpo: Record<string, unknown> = {
        nome: nome.trim(),
        descricao: descricao.trim(),
        formato,
        privacidade,
        escudo: { ...ident, name: nome.trim() },
      };
      if (formato === "copa") {
        corpo.copa_competicao_inicial = arranque;
      } else {
        corpo.liga_competicao_inicial = arranque;
        corpo.fim_tipo = fimTipo;
        corpo.fim_valor = fimTipo === "competicao" ? fimComp : fimMes;
      }

      const r = await fetch("/api/liga/criar", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
        body: JSON.stringify(corpo),
      });
      const j = await r.json();

      if (!r.ok || !j.ok) {
        if (j?.limite) { setErro(msgLimite(formato)); }
        else { setErro(j?.erro || t("cl.erroCriar")); }
        return;
      }
      setCriada({ invite_code: j.liga.invite_code, name: j.liga.name, formato: j.liga.formato });
    } catch {
      setErro(t("cl.falhaLigacao"));
    } finally {
      setACriar(false);
    }
  }

  // ---- Ecrã de sucesso ----
  if (criada) {
    const link = `${BASE}/liga/${criada.invite_code}`;
    const texto = t("cl.partilharTexto", { nome: criada.name, codigo: criada.invite_code });
    const copiar = async (valor: string) => {
      try { await navigator.clipboard.writeText(valor); setCopiado(true); setTimeout(() => setCopiado(false), 1600); } catch {}
    };
    const partilhar = async () => {
      try {
        if (navigator.share) await navigator.share({ title: criada.name, text: texto, url: link });
        else await copiar(`${texto} ${link}`);
      } catch {}
    };
    return (
      <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: FB }}>
        <div style={{ maxWidth: 460, margin: "0 auto", padding: "22px 16px 100px", textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center", marginTop: 14 }}><Escudo config={{ ...ident, name: criada.name }} size={92} /></div>
          <h1 style={{ fontFamily: FD, fontSize: 20, fontWeight: 800, color: GOLD, margin: "16px 0 6px", textTransform: "uppercase", letterSpacing: "0.03em" }}>{criada.name}</h1>
          <p style={{ color: "#c8d2cb", fontSize: 14, lineHeight: 1.5, margin: "0 0 18px" }}>{t("cl.ligaCriada")}</p>

          <div style={{ background: "#121815", border: `1px solid #243029`, borderRadius: 14, padding: "14px 16px", textAlign: "left" }}>
            <div style={{ fontFamily: FD, fontSize: 11, fontWeight: 700, color: "#93a39a", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>{t("cl.codigoConvite")}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "space-between" }}>
              <span style={{ fontFamily: FD, fontSize: 26, fontWeight: 800, color: "#f1ede2", letterSpacing: "0.18em" }}>{criada.invite_code}</span>
              <button onClick={() => copiar(criada.invite_code)} style={{ background: "transparent", border: `1px solid ${GOLD}`, color: GOLD, fontFamily: FD, fontWeight: 700, textTransform: "uppercase", fontSize: 11, padding: "8px 14px", borderRadius: 9, cursor: "pointer" }}>{copiado ? "✓" : t("cl.copiar")}</button>
            </div>
          </div>

          <div style={{ display: "grid", gap: 9, marginTop: 14 }}>
            <button onClick={partilhar} style={{ background: GOLD, color: "#1b211e", border: "none", fontFamily: FD, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", padding: "13px", borderRadius: 11, cursor: "pointer", fontSize: 14 }}>{t("cl.partilharLink")}</button>
            <button onClick={() => copiar(link)} style={{ background: "transparent", border: "1px solid #2a3a33", color: "#cfd8d2", fontFamily: FD, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", padding: "12px", borderRadius: 11, cursor: "pointer", fontSize: 13 }}>{t("cl.copiarLink")}</button>
            <a href={`/liga/${criada.invite_code}`} style={{ display: "block", background: VERDE, color: "#06140d", fontFamily: FD, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", padding: "13px", borderRadius: 11, textDecoration: "none", fontSize: 14 }}>{t("cl.concluir")}</a>
          </div>
        </div>
        <BarraInferior ativo="ligas" />
      </main>
    );
  }

  // ---- Carregamento da sessão ----
  if (sessaoOk === null) {
    return <main aria-busy="true" style={{ minHeight: "100vh", background: "#0c0e0d" }} />;
  }

  // ---- Formulário ----
  const compIni = comps.find((c) => c.idCompeticao === arranque);
  const compFimSel = comps.find((c) => c.idCompeticao === fimComp);
  const infoLinha = (() => {
    if (formato !== "pontos" || !compIni) return "";
    const ini = nomeCompeticao(compIni);
    if (fimTipo === "competicao" && compFimSel) return t("cl.infoAte", { ini, fim: nomeCompeticao(compFimSel) });
    if (fimTipo === "mes" && /^\d{4}-\d{2}$/.test(fimMes)) {
      const [y, m] = fimMes.split("-").map(Number);
      const nomeMes = new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
      return t("cl.infoMes", { ini, mesFim: nomeMes });
    }
    return "";
  })();

  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: FB }}>
      <div style={{ maxWidth: 460, margin: "0 auto", padding: "14px 14px 96px" }}>
        {/* Topo */}
        <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 16 }}>
          <a href="/ligas" aria-label={t("cl.voltarLigas")} style={{ width: 34, height: 34, borderRadius: "50%", border: "1px solid #243029", display: "flex", alignItems: "center", justifyContent: "center", color: "#cfd8d2", textDecoration: "none", flexShrink: 0 }}>←</a>
          <h1 style={{ fontFamily: FD, fontSize: 18, fontWeight: 800, color: GOLD, margin: 0, textTransform: "uppercase", letterSpacing: "0.03em" }}>{t("cl.criarLiga")}</h1>
        </div>

        {/* Pré-visualização do escudo */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, background: "#121815", border: "1px solid #243029", borderRadius: 16, padding: "14px 16px", marginBottom: 14 }}>
          <Escudo config={{ ...ident, name: nome || DEFAULT_IDENTITY.name }} size={62} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: nome ? "#f1ede2" : "#6b7d73", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nome || t("cl.phNomeLiga")}</div>
            <div style={{ fontSize: 12, color: "#93a39a" }}>{formato === "copa" ? "Copa Ippon" : t("cl.pontosTitulo")}</div>
          </div>
        </div>

        {/* Nome */}
        <Rotulo>{t("cl.nomeLiga")}</Rotulo>
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value.slice(0, 40))}
          placeholder={t("cl.phNomeLiga")}
          style={inputEstilo}
        />

        {/* Editor de escudo (compacto) */}
        <div style={{ marginTop: 14, background: "#101512", border: "1px solid #243029", borderRadius: 14, padding: "12px 13px" }}>
          <EditorLinha titulo={t("cl.forma")}>
            {shapesLista.map((s) => (
              <BotaoEscudo key={s} ativo={ident.shape === s} onClick={() => setEscudo({ shape: s as ShapeId })}>
                <Escudo config={{ ...ident, shape: s as ShapeId, symbol: "none" }} size={30} />
              </BotaoEscudo>
            ))}
          </EditorLinha>
          <EditorLinha titulo={t("cl.estampa")}>
            {patternsLista.map((p) => (
              <BotaoEscudo key={p.id} ativo={ident.pattern === p.id} onClick={() => setEscudo({ pattern: p.id as PatternId })}>
                <Escudo config={{ ...ident, pattern: p.id as PatternId, symbol: "none" }} size={30} />
              </BotaoEscudo>
            ))}
          </EditorLinha>
          <EditorLinha titulo={t("cl.adorno")}>
            {symbolsLista.map((s) => (
              <BotaoEscudo key={s.id} ativo={ident.symbol === s.id} onClick={() => setEscudo({ symbol: s.id })}>
                {s.id === "none"
                  ? <span style={{ color: "#6b7d73", fontSize: 18, fontWeight: 700 }}>—</span>
                  : <svg viewBox="0 0 24 24" width={26} height={26}><SymbolGlyph id={s.id} color="#f1ede2" /></svg>}
              </BotaoEscudo>
            ))}
          </EditorLinha>
          <EditorLinha titulo={t("cl.cores")}>
            {coresLista.map((c) => {
              const ativo = ident.bg1 === c;
              return (
                <button
                  key={`bg1-${c}`}
                  onClick={() => setEscudo({ bg1: c, border: c })}
                  aria-label={`fundo ${c}`}
                  style={{ width: 30, height: 30, borderRadius: 8, background: c, border: `2px solid ${ativo ? "#fff" : "rgba(255,255,255,0.18)"}`, cursor: "pointer", flexShrink: 0 }}
                />
              );
            })}
          </EditorLinha>
          <EditorLinha titulo={t("cl.cores")}>
            {coresLista.map((c) => {
              const ativo = ident.bg2 === c;
              return (
                <button
                  key={`bg2-${c}`}
                  onClick={() => setEscudo({ bg2: c, stamp1: c })}
                  aria-label={`detalhe ${c}`}
                  style={{ width: 30, height: 30, borderRadius: 8, background: c, border: `2px solid ${ativo ? "#fff" : "rgba(255,255,255,0.18)"}`, cursor: "pointer", flexShrink: 0 }}
                />
              );
            })}
          </EditorLinha>
          {!souPro && (
            <a href="/ippon-pro" style={{ display: "block", marginTop: 4, fontSize: 11.5, color: GOLD, textDecoration: "none" }}>★ {t("cl.criarLiga")} · Pro →</a>
          )}
        </div>

        {/* Formato */}
        <Rotulo style={{ marginTop: 18 }}>{t("cl.formato")}</Rotulo>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
          <CartaoOpcao ativo={formato === "pontos"} onClick={() => setFormato("pontos")} titulo={t("cl.pontosTitulo")} desc={t("cl.pontosDesc")} />
          <CartaoOpcao ativo={formato === "copa"} onClick={() => setFormato("copa")} titulo="Copa Ippon" desc={t("cl.copaDesc")} />
        </div>

        {/* Competição de arranque */}
        <Rotulo style={{ marginTop: 18 }}>{t("cl.compArranque")}</Rotulo>
        {comps.length === 0 ? (
          <p style={{ color: "#e0894f", fontSize: 13 }}>{t("cl.semComps")}</p>
        ) : (
          <select value={arranque} onChange={(e) => { setArranque(e.target.value); setFimComp(""); }} style={inputEstilo}>
            {compsArranque.map((c) => (
              <option key={c.idCompeticao} value={c.idCompeticao}>{nomeCompeticao(c)}</option>
            ))}
          </select>
        )}
        <Ajuda>{formato === "copa" ? t("cl.copaHelp") : t("cl.pontosHelp")}</Ajuda>

        {/* Fim da liga — só pontos corridos */}
        {formato === "pontos" && (
          <>
            <Rotulo style={{ marginTop: 18 }}>{t("cl.fimLiga")}</Rotulo>
            <div style={{ display: "flex", gap: 8, marginBottom: 9 }}>
              <PequenoTab ativo={fimTipo === "competicao"} onClick={() => setFimTipo("competicao")}>{t("cl.porCompeticao")}</PequenoTab>
              <PequenoTab ativo={fimTipo === "mes"} onClick={() => setFimTipo("mes")}>{t("cl.porMes")}</PequenoTab>
            </div>
            {fimTipo === "competicao" ? (
              compsFim.length === 0 ? (
                <p style={{ color: "#e0894f", fontSize: 12.5, lineHeight: 1.5 }}>
                  {t("cl.semCompsFim").replace("%D%", t("cl.semCompsFimDestaque"))}
                </p>
              ) : (
                <select value={fimComp} onChange={(e) => setFimComp(e.target.value)} style={inputEstilo}>
                  <option value="">{t("cl.escolheFim")}</option>
                  {compsFim.map((c) => (
                    <option key={c.idCompeticao} value={c.idCompeticao}>{nomeCompeticao(c)}</option>
                  ))}
                </select>
              )
            ) : (
              <input type="month" value={fimMes} onChange={(e) => setFimMes(e.target.value)} style={inputEstilo} aria-label={t("cl.mesDeFim")} />
            )}
            <Ajuda>{t("cl.fimHelp")}</Ajuda>
            {infoLinha && <p style={{ color: VERDE, fontSize: 12.5, marginTop: 6, lineHeight: 1.5 }}>{infoLinha}</p>}
          </>
        )}

        {/* Privacidade */}
        <Rotulo style={{ marginTop: 18 }}>{t("cl.privacidade")}</Rotulo>
        <div style={{ display: "grid", gap: 8 }}>
          <CartaoLinha ativo={privacidade === "fechada"} onClick={() => setPrivacidade("fechada")} titulo={t("cl.fechada")} desc={t("cl.fechadaDesc")} />
          <CartaoLinha ativo={privacidade === "mediante_pedido"} onClick={() => setPrivacidade("mediante_pedido")} titulo={t("cl.porAprovacao")} desc={t("cl.porAprovacaoDesc")} />
          <CartaoLinha ativo={privacidade === "aberta"} onClick={() => setPrivacidade("aberta")} titulo={t("cl.aberta")} desc={t("cl.abertaDesc")} />
        </div>

        {/* Descrição */}
        <Rotulo style={{ marginTop: 18 }}>{t("cl.descricao")}</Rotulo>
        <textarea
          value={descricao}
          onChange={(e) => setDescricao(e.target.value.slice(0, 400))}
          placeholder={t("cl.phDescricao")}
          rows={3}
          style={{ ...inputEstilo, resize: "vertical", lineHeight: 1.5 }}
        />

        {erro && (
          <div style={{ marginTop: 14, background: "#2a1f1c", border: "1px solid #5a3a36", borderRadius: 12, padding: "11px 13px", color: "#f0b7b1", fontSize: 13, lineHeight: 1.5 }}>{erro}</div>
        )}

        <button
          onClick={criar}
          disabled={aCriar || !nomeOk}
          style={{ width: "100%", marginTop: 16, background: !nomeOk ? "#2a3a33" : VERDE, color: !nomeOk ? "#6b7d73" : "#06140d", border: "none", fontFamily: FD, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", padding: "14px", borderRadius: 12, cursor: aCriar || !nomeOk ? "default" : "pointer", fontSize: 15, opacity: aCriar ? 0.75 : 1 }}
        >
          {aCriar ? t("cl.aCriar") : t("cl.criarLiga")}
        </button>
      </div>
      <BarraInferior ativo="ligas" />
    </main>
  );
}

// ---------------- peças ----------------
const inputEstilo: React.CSSProperties = {
  width: "100%", background: "#141a17", border: "1px solid #243029", borderRadius: 10,
  padding: "12px 13px", color: "#f1ede2", fontSize: 15, fontFamily: FB, outline: "none",
};

function Rotulo({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ fontFamily: FD, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#93a39a", margin: "0 0 8px", ...style }}>{children}</div>;
}
function Ajuda({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 11.5, color: "#7c8a82", margin: "7px 0 0", lineHeight: 1.5 }}>{children}</p>;
}
function EditorLinha({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10.5, color: "#7c8a82", fontFamily: FD, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 5 }}>{titulo}</div>
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>{children}</div>
    </div>
  );
}
function BotaoEscudo({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{ width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", background: ativo ? "#1b2420" : "transparent", border: `1px solid ${ativo ? GOLD : "#243029"}`, borderRadius: 9, cursor: "pointer", flexShrink: 0, padding: 0 }}>
      {children}
    </button>
  );
}
function CartaoOpcao({ ativo, onClick, titulo, desc }: { ativo: boolean; onClick: () => void; titulo: string; desc: string }) {
  return (
    <button onClick={onClick} style={{ textAlign: "left", background: ativo ? "#15241c" : "#121815", border: `1.5px solid ${ativo ? VERDE : "#243029"}`, borderRadius: 12, padding: "11px 12px", cursor: "pointer" }}>
      <div style={{ fontFamily: FD, fontSize: 13, fontWeight: 700, color: ativo ? "#dff2e6" : "#f1ede2", textTransform: "uppercase", letterSpacing: "0.02em", marginBottom: 4 }}>{titulo}</div>
      <div style={{ fontSize: 11.5, color: "#93a39a", lineHeight: 1.45 }}>{desc}</div>
    </button>
  );
}
function CartaoLinha({ ativo, onClick, titulo, desc }: { ativo: boolean; onClick: () => void; titulo: string; desc: string }) {
  return (
    <button onClick={onClick} style={{ textAlign: "left", display: "flex", alignItems: "flex-start", gap: 11, background: ativo ? "#15241c" : "#121815", border: `1.5px solid ${ativo ? VERDE : "#243029"}`, borderRadius: 12, padding: "11px 13px", cursor: "pointer", width: "100%" }}>
      <span style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${ativo ? VERDE : "#3a4a42"}`, background: ativo ? VERDE : "transparent", marginTop: 2, flexShrink: 0 }} />
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "block", fontFamily: FD, fontSize: 13, fontWeight: 700, color: "#f1ede2", textTransform: "uppercase", letterSpacing: "0.02em", marginBottom: 3 }}>{titulo}</span>
        <span style={{ display: "block", fontSize: 11.5, color: "#93a39a", lineHeight: 1.45 }}>{desc}</span>
      </span>
    </button>
  );
}
function PequenoTab({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{ flex: 1, background: ativo ? GOLD : "transparent", color: ativo ? "#1b211e" : "#cfd8d2", border: `1px solid ${ativo ? GOLD : "#243029"}`, fontFamily: FD, fontWeight: 700, textTransform: "uppercase", fontSize: 11.5, padding: "9px 0", borderRadius: 9, cursor: "pointer" }}>{children}</button>
  );
}
