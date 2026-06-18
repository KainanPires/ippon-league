"use client";

// CALENDÁRIO OFICIAL IPPON LEAGUE 2026 — só INFORMATIVO da competição.
// Regra do "clássico cego":
//  - Competição real: mostra nome e nível sempre.
//  - Clássico com mercado ABERTO: mostra "Clássico Nº {rodada}" + o NÍVEL e o
//    ANO (ex.: "Grand Slam · 2015"), sem dizer QUAL foi (houve vários nesse ano).
//    No DIA (mercado fechado), revela-se o nome completo com a cidade.
// Estados visuais: passada (cinza), a decorrer (verde), próxima (dourado a pulsar),
// futura (normal). Os atletas não se mostram aqui — aparecem no mercado.
//
// Ao ABRIR, a página faz scroll automático até à competição-alvo (a que está a
// decorrer ou a próxima com mercado aberto — focoMercado().alvo). A lista e a
// ordem ficam iguais; quem subir o scroll vê as competições antigas.

import { useEffect, useRef } from "react";
import {
  CALENDARIO_2026,
  estadoMercado,
  competicaoFechada,
  focoMercado,
  type SemanaCalendario,
} from "@/lib/calendario";

const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
function dataCurta(de: string): string {
  const [, m, d] = de.split("/").map((x) => parseInt(x, 10));
  return `${d} ${MESES[(m || 1) - 1]}`;
}
function nomeSemClassico(nome: string): string {
  return nome.replace(/\s*[—-]\s*Cl[áa]ssico\s*$/i, "");
}

type Estado = "passada" | "aDecorrer" | "proxima" | "futura";

export default function CalendarioPage() {
  const foco = focoMercado();
  const alvoId = foco.alvo.idCompeticao;
  // Para onde levar o scroll ao abrir: a competição A DECORRER se houver uma;
  // senão, a próxima (alvo). O destaque visual "próxima" continua a usar alvoId.
  const scrollId = foco.aDecorrer?.idCompeticao ?? alvoId;
  const lista = [...CALENDARIO_2026].sort((a, b) => a.semana - b.semana);

  // Cartão para onde levar o scroll ao abrir (a decorrer / próxima).
  const alvoRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Leva o scroll até à competição atual/próxima ao ABRIR.
    // Porquê com atraso e repetido: o Next.js faz o seu próprio "scroll para o
    // topo" ao montar a página, e às vezes DEPOIS do nosso — um requestAnimationFrame
    // simples era anulado. Tentamos algumas vezes nos primeiros 600 ms, para o
    // salto cair sempre depois do reset do Next. Cálculo absoluto (idempotente):
    // repetir aterra sempre no mesmo sítio.
    let cancelado = false;
    function irParaAlvo() {
      if (cancelado) return;
      const el = alvoRef.current;
      if (!el) return;
      const y = el.getBoundingClientRect().top + window.scrollY - 12;
      window.scrollTo({ top: y, behavior: "auto" });
    }
    const timers = [60, 200, 450, 700].map((ms) => window.setTimeout(irParaAlvo, ms));
    return () => { cancelado = true; timers.forEach((t) => clearTimeout(t)); };
  }, [scrollId]);

  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: FB }}>
      <style>{`@keyframes pulsoOuro {
        0%,100% { box-shadow: 0 0 0 0 rgba(217,164,65,0.0); }
        50% { box-shadow: 0 0 0 3px rgba(217,164,65,0.22); }
      }`}</style>
      <div style={{ maxWidth: 460, margin: "0 auto", padding: "14px 14px 84px" }}>
        <header style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 12 }}>
          <a href="/ligas" aria-label="Voltar" style={{ width: 34, height: 34, borderRadius: "50%", border: "1px solid #243029", display: "flex", alignItems: "center", justifyContent: "center", color: "#cfd8d2", textDecoration: "none", flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
          </a>
          <h1 style={{ fontFamily: FD, fontSize: 19, fontWeight: 700, textTransform: "uppercase", margin: 0 }}>Calendário 2026</h1>
        </header>

        {/* O que é um clássico — explicação fixa no topo. */}
        <div style={{ background: "#181410", border: "1px dashed #3a3320", borderRadius: 14, padding: "13px 14px", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 16 }}>🥋</span>
            <span style={{ fontFamily: FD, fontSize: 12.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "#e6c97a" }}>O que é um clássico?</span>
          </div>
          <p style={{ fontSize: 12.5, color: "#c7d0c9", lineHeight: 1.55, margin: 0 }}>
            Um clássico é uma grande competição dos últimos anos — <strong style={{ color: "#f1ede2" }}>Grand Prix, Grand Slam, Mundiais e Olimpíadas</strong> — que reavivamos nas semanas sem competição oficial. Serve de base à pontuação e relembra grandes momentos do judô, para haver jogo toda a semana. Vês o <strong style={{ color: "#f1ede2" }}>nível e o ano</strong>, mas <strong style={{ color: "#e6c97a" }}>o nome só se revela no dia</strong>.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {lista.map((s) => (
            <CartaoSemana
              key={s.semana}
              s={s}
              alvoId={alvoId}
              alvoRef={s.idCompeticao === scrollId ? alvoRef : undefined}
            />
          ))}
        </div>
      </div>

      <nav style={{ position: "fixed", left: 0, right: 0, bottom: 0, height: 60, background: "#0f1411", borderTop: "1px solid #243029", display: "flex", alignItems: "center", justifyContent: "space-around", zIndex: 50 }}>
        <NavTab label="Início" href="/inicio" icon={<HomeIcon />} />
        <NavTab label="Competições" href="/ligas" icon={<TrophyIcon />} active />
        <NavTab label="Atletas" href="/atletas" icon={<AthletesIcon />} />
        <NavTab label="Pro" href="/ippon-pro" icon={<BoltIcon />} />
      </nav>
    </main>
  );
}

function CartaoSemana({ s, alvoId, alvoRef }: { s: SemanaCalendario; alvoId: string; alvoRef?: React.RefObject<HTMLDivElement | null> }) {
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
  const titulo = cego ? `Clássico Nº ${s.semana}` : nomeSemClassico(s.nome);

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
        <div style={{ fontSize: 9, color: "#7c8a82", textTransform: "uppercase", letterSpacing: "0.05em" }}>Rodada</div>
        <div style={{ fontFamily: FD, fontSize: 19, fontWeight: 700, color: corNum }}>{s.semana}</div>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: corTitulo }}>{titulo}</span>
          {s.classico && !cego && <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#1b211e", background: GOLD, borderRadius: 999, padding: "1px 7px" }}>Clássico</span>}
          {estado === "proxima" && <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: GOLD }}>· próxima</span>}
          {estado === "aDecorrer" && <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#7fd1a3" }}>· a decorrer</span>}
          {estado === "passada" && <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#5f6f67" }}>· terminada</span>}
        </div>
        <div style={{ fontSize: 11.5, color: estado === "passada" ? "#5f6f67" : "#93a39a", marginTop: 2 }}>
          {dataCurta(s.de)}
          {cego ? <> · {s.nivel}{anoCego}</> : <> · {s.nivel}</>}
        </div>
      </div>
    </div>
  );
}

function NavTab({ label, icon, href, active }: { label: string; icon: React.ReactNode; href?: string; active?: boolean }) {
  const style: React.CSSProperties = { display: "flex", flexDirection: "column", alignItems: "center", gap: 3, color: active ? GOLD : "#6f7d76", textDecoration: "none" };
  const inner = <>{icon}<span style={{ fontSize: 11, fontWeight: active ? 700 : 400 }}>{label}</span></>;
  return href ? <a href={href} style={style}>{inner}</a> : <div style={style}>{inner}</div>;
}
function HomeIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /></svg>;
}
function TrophyIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 4h8v5a4 4 0 0 1-8 0V4z" /><path d="M8 6H5v2a3 3 0 0 0 3 3M16 6h3v2a3 3 0 0 1-3 3M10 17h4M9 21h6M12 13v4" /></svg>;
}
function AthletesIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="8" cy="6" r="3" /><circle cx="17" cy="7" r="2.5" /><path d="M3 20v-1a5 5 0 0 1 10 0v1M14 20v-1a4 4 0 0 1 7-2.6" /></svg>;
}
function BoltIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" /></svg>;
}
