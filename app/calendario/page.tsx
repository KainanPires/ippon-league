"use client";
// CALENDÁRIO OFICIAL IPPON LEAGUE 2026 — só INFORMATIVO da competição.
// Regra do "clássico cego":
// - Competição real: mostra nome e nível sempre.
// - Clássico com mercado ABERTO: mostra "Clássico Nº {rodada}" + o NÍVEL e o
// ANO (ex.: "Grand Slam · 2015"), sem dizer QUAL foi (houve vários nesse ano).
// No DIA (mercado fechado), revela-se o nome completo com a cidade.
// Estados visuais: passada (cinza), a decorrer (verde), próxima (dourado a pulsar),
// futura (normal). Os atletas não se mostram aqui — aparecem no mercado.
//
// Ao ABRIR, a página faz scroll automático até à competição-alvo (a que está a
// decorrer ou a próxima com mercado aberto — focoMercado().alvo).
import { useEffect, useRef } from "react";
import {
  CALENDARIO_2026,
  estadoMercado,
  competicaoFechada,
  focoMercado,
  type SemanaCalendario,
} from "@/lib/calendario";

// A barra inferior deixou de estar copiada em cada página. Vive uma vez em
// components/BarraInferior.tsx, e é lá que o separador Pro pulsa a dourado
// para quem tem Pro e ainda não visitou a área.
import { BarraInferior } from "@/components/BarraInferior";
import { useT, useLingua } from "@/lib/i18n";
const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";
// Data curta LOCALIZADA: dia + mês abreviado na língua da pessoa (via Intl).
// `de` vem no formato "AAAA/MM/DD"; o ano não entra no texto, só o dia e o mês.
function dataCurta(de: string, lingua: string): string {
  const [, m, d] = de.split("/").map((x) => parseInt(x, 10));
  return new Date(2000, (m || 1) - 1, d || 1).toLocaleDateString(lingua, { day: "numeric", month: "short" });
}
function nomeSemClassico(nome: string): string {
  return nome.replace(/\s*[—-]\s*Cl[áa]ssico\s*$/i, "");
}
type Estado = "passada" | "aDecorrer" | "proxima" | "futura";
export default function CalendarioPage() {
  const t = useT();
  const foco = focoMercado();
  const alvoId = foco.alvo.idCompeticao;
  const lista = [...CALENDARIO_2026].sort((a, b) => a.semana - b.semana);
  // Cartão-alvo do scroll: o PRIMEIRO que ainda não terminou (em ordem
  // cronológica = o que está a decorrer ou o próximo). Se já tudo terminou, o último.
  let idxAlvo = lista.findIndex((s) => !competicaoFechada(s));
  if (idxAlvo < 0) idxAlvo = lista.length - 1;
  const alvoRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
      // Leva o scroll até à competição atual/próxima ao ABRIR. Repetimos nos
      // primeiros ~1,2 s: o Next.js faz o seu próprio scroll ao montar, às vezes
      // depois do nosso. Repetir vence ambos.
      let cancelado = false;
      const delays = [50, 150, 300, 500, 800, 1200];
      const timers = delays.map((ms) => window.setTimeout(() => {
            if (cancelado) return;
            alvoRef.current?.scrollIntoView({ block: "start", behavior: "auto" });
          }, ms));
      return () => { cancelado = true; timers.forEach((id) => clearTimeout(id)); };
    }, [idxAlvo]);
  // Frase com três destaques a negrito: a frase inteira numa chave, com os
  // marcadores %A%/%B%/%C% onde entram os negritos, dividida aqui.
  const cls = t("cal.classicoTexto").split(/%A%|%B%|%C%/);
  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: FB }}>
    <style>{`@keyframes pulsoOuro {
        0%,100% { box-shadow: 0 0 0 0 rgba(217,164,65,0.0); }
        50% { box-shadow: 0 0 0 3px rgba(217,164,65,0.22); }
      }`}</style>
    <div style={{ maxWidth: 460, margin: "0 auto", padding: "14px 14px 84px" }}>
    <header style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 12 }}>
    <a href="/ligas" aria-label={t("comum.voltar")} style={{ width: 34, height: 34, borderRadius: "50%", border: "1px solid #243029", display: "flex", alignItems: "center", justifyContent: "center", color: "#cfd8d2", textDecoration: "none", flexShrink: 0 }}>
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
    </a>
    <h1 style={{ fontFamily: FD, fontSize: 19, fontWeight: 700, textTransform: "uppercase", margin: 0 }}>{t("cal.titulo")}</h1>
    </header>
    {/* O que é um clássico — explicação fixa no topo. */}
    <div style={{ background: "#181410", border: "1px dashed #3a3320", borderRadius: 14, padding: "13px 14px", marginBottom: 16 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
    <span style={{ fontSize: 16 }}>🥋</span>
    <span style={{ fontFamily: FD, fontSize: 12.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "#e6c97a" }}>{t("cal.oQueClassico")}</span>
    </div>
    <p style={{ fontSize: 12.5, color: "#c7d0c9", lineHeight: 1.55, margin: 0 }}>
    {cls[0]}<strong style={{ color: "#f1ede2" }}>{t("cal.classicoA")}</strong>{cls[1]}<strong style={{ color: "#f1ede2" }}>{t("cal.classicoB")}</strong>{cls[2]}<strong style={{ color: "#e6c97a" }}>{t("cal.classicoC")}</strong>{cls[3]}
    </p>
    </div>
    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
    {lista.map((s, i) => (
          <CartaoSemana
          key={s.semana}
          s={s}
          alvoId={alvoId}
          alvoRef={i === idxAlvo ? alvoRef : undefined}
          />
        ))}
    </div>
    </div>
      <BarraInferior ativo="ligas" />
    </main>
  );
}
function CartaoSemana({ s, alvoId, alvoRef }: { s: SemanaCalendario; alvoId: string; alvoRef?: React.RefObject<HTMLDivElement | null> }) {
  const t = useT();
  const { lingua } = useLingua();
  const mkt = estadoMercado(s);
  const estado: Estado = competicaoFechada(s)
  ? "passada"
  : mkt.estado === "fechado"
  ? "aDecorrer"
  : s.idCompeticao === alvoId
  ? "proxima"
  : "futura";
  // Clássico fica "cego" enquanto o mercado está aberto (próxima ou futura).
  const cego = s.classico && mkt.estado === "aberto";
  const anoCego = s.anoOriginal ? ` ${s.anoOriginal}` : "";
  const titulo = cego ? t("cal.classicoN", { n: s.semana }) : nomeSemClassico(s.nome);
  const corBorda =
  estado === "passada" ? "#1a221d" :
  estado === "aDecorrer" ? "#2f7d54" :
  estado === "proxima" ? GOLD :
  cego ? "#3a3320" : "#243029";
  const opacidade = estado === "passada" ? 0.5 : 1;
  const corNum =
  estado === "passada" ? "#5f6f67" :
  estado === "aDecorrer" ? "#7fd1a3" :
  estado === "proxima" ? GOLD : "#cfd8d2";
  const corTitulo = estado === "passada" ? "#7c8a82" : cego ? "#e6c97a" : "#f1ede2";
  return (
    <div ref={alvoRef} style={{
        background: estado === "proxima" ? "#15170f" : "#121815",
        border: `1px solid ${corBorda}`,
        borderRadius: 14, display: "flex", alignItems: "center", gap: 12, padding: "12px 13px",
        opacity: opacidade,
        // Margem ao saltar para este cartão: não cola ao topo do ecrã.
        scrollMarginTop: 16,
        animation: estado === "proxima" ? "pulsoOuro 2.2s ease-in-out infinite" : undefined,
      }}>
    {/* Selo da rodada */}
    <div style={{ width: 42, flexShrink: 0, textAlign: "center" }}>
    <div style={{ fontSize: 9, color: "#7c8a82", textTransform: "uppercase", letterSpacing: "0.05em" }}>{t("cal.rodada")}</div>
    <div style={{ fontFamily: FD, fontSize: 19, fontWeight: 700, color: corNum }}>{s.semana}</div>
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
    <span style={{ fontSize: 14, fontWeight: 700, color: corTitulo }}>{titulo}</span>
    {s.classico && !cego && <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#1b211e", background: GOLD, borderRadius: 999, padding: "1px 7px" }}>{t("cal.classicoBadge")}</span>}
    {estado === "proxima" && <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: GOLD }}>· {t("cal.proxima")}</span>}
    {estado === "aDecorrer" && <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#7fd1a3" }}>· {t("cal.aDecorrer")}</span>}
    {estado === "passada" && <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#5f6f67" }}>· {t("cal.terminada")}</span>}
    </div>
    <div style={{ fontSize: 11.5, color: estado === "passada" ? "#5f6f67" : "#93a39a", marginTop: 2 }}>
    {dataCurta(s.de, lingua)}
    {cego ? <> · {s.nivel}{anoCego}</> : <> · {s.nivel}</>}
    </div>
    </div>
    </div>
  );
}
