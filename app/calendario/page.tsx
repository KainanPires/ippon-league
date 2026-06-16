"use client";

// CALENDÁRIO OFICIAL IPPON LEAGUE 2026.
// Lista as 52 semanas/competições do ano. Regra do "clássico cego":
//  - Competição real (classico:false): mostra nome e nível sempre.
//  - Clássico (classico:true): enquanto o mercado está ABERTO, esconde-se tudo o
//    que denuncie a competição — aparece só "Clássico Nº {rodada}" + os atletas
//    (ao expandir). No DIA (mercado fechado), revela-se o nome real e o ano.
// Os atletas de cada competição carregam só quando o cartão é expandido
// (/api/atletas?id=...), para não puxar as 52 de uma vez.

import { useState } from "react";
import {
  CALENDARIO_2026,
  estadoMercado,
  competicaoDaSemana,
  type SemanaCalendario,
} from "@/lib/calendario";
import { type Athlete } from "@/lib/athletes";

const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";

const IOC: Record<string, string> = {
  JP: "JPN", FR: "FRA", BR: "BRA", GE: "GEO", KZ: "KAZ", AZ: "AZE", BE: "BEL",
  TR: "TUR", UZ: "UZB", RU: "AIN", DE: "GER", XK: "KOS", IT: "ITA", CA: "CAN",
  SI: "SLO", HR: "CRO", NL: "NED",
};
const code3 = (iso: string) => IOC[iso] || iso;

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
function dataCurta(de: string): string {
  const [, m, d] = de.split("/").map((x) => parseInt(x, 10));
  return `${d} ${MESES[(m || 1) - 1]}`;
}

export default function CalendarioPage() {
  const atual = competicaoDaSemana();
  const lista = [...CALENDARIO_2026].sort((a, b) => a.semana - b.semana);

  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: FB }}>
      <div style={{ maxWidth: 460, margin: "0 auto", padding: "14px 14px 84px" }}>
        <header style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 6 }}>
          <a href="/ligas" aria-label="Voltar" style={{ width: 34, height: 34, borderRadius: "50%", border: "1px solid #243029", display: "flex", alignItems: "center", justifyContent: "center", color: "#cfd8d2", textDecoration: "none", flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
          </a>
          <h1 style={{ fontFamily: FD, fontSize: 19, fontWeight: 700, textTransform: "uppercase", margin: 0 }}>Calendário 2026</h1>
        </header>
        <p style={{ fontSize: 12, color: "#93a39a", margin: "0 0 16px", paddingLeft: 45, lineHeight: 1.5 }}>
          Uma competição por semana. Os <span style={{ color: GOLD, fontWeight: 700 }}>clássicos</span> só se revelam no dia — até lá, montas às cegas, pelos atletas.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {lista.map((s) => (
            <CartaoSemana key={s.semana} s={s} ehAtual={s.idCompeticao === atual.idCompeticao} />
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

function CartaoSemana({ s, ehAtual }: { s: SemanaCalendario; ehAtual: boolean }) {
  const mkt = estadoMercado(s);
  // Clássico fica "cego" enquanto o mercado está aberto. Reais e clássicos já
  // iniciados mostram tudo.
  const cego = s.classico && mkt.estado === "aberto";

  const [aberto, setAberto] = useState(false);
  const [atletas, setAtletas] = useState<Athlete[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function alternar() {
    const novo = !aberto;
    setAberto(novo);
    if (novo && atletas === null) {
      setLoading(true);
      try {
        const r = await fetch(`/api/atletas?id=${s.idCompeticao}`).then((x) => x.json()).catch(() => null);
        setAtletas(Array.isArray(r?.atletas) ? r.atletas : []);
      } catch {
        setAtletas([]);
      }
      setLoading(false);
    }
  }

  const titulo = cego ? `Clássico Nº ${s.semana}` : s.nome;
  const corBorda = ehAtual ? GOLD : cego ? "#3a3320" : "#243029";

  return (
    <div style={{ background: "#121815", border: `1px solid ${corBorda}`, borderRadius: 14, overflow: "hidden" }}>
      <button
        onClick={alternar}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, background: "transparent", border: "none", padding: "12px 13px", cursor: "pointer", fontFamily: FB, textAlign: "left" }}
      >
        {/* Selo da rodada */}
        <div style={{ width: 42, flexShrink: 0, textAlign: "center" }}>
          <div style={{ fontSize: 9, color: "#7c8a82", textTransform: "uppercase", letterSpacing: "0.05em" }}>Rodada</div>
          <div style={{ fontFamily: FD, fontSize: 19, fontWeight: 700, color: ehAtual ? GOLD : "#cfd8d2" }}>{s.semana}</div>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: cego ? "#e6c97a" : "#f1ede2" }}>{titulo}</span>
            {cego && <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#1b211e", background: GOLD, borderRadius: 999, padding: "1px 7px" }}>Clássico</span>}
            {ehAtual && <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#7fd1a3" }}>· esta semana</span>}
          </div>
          <div style={{ fontSize: 11.5, color: "#93a39a", marginTop: 2 }}>
            {dataCurta(s.de)}
            {!cego && <> · {s.nivel}</>}
            {cego && <> · competição surpresa</>}
          </div>
        </div>

        {/* Seta expandir */}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7c8a82" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, transform: aberto ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}><path d="M6 9l6 6 6-6" /></svg>
      </button>

      {aberto && (
        <div style={{ borderTop: "1px solid #1a221d", padding: "11px 13px 13px" }}>
          {cego && (
            <div style={{ fontSize: 11.5, color: "#c7d0c9", lineHeight: 1.5, marginBottom: 10, background: "#181410", border: "1px dashed #3a3320", borderRadius: 10, padding: "9px 11px" }}>
              🥋 Esta é uma competição <strong style={{ color: "#e6c97a" }}>clássica</strong> — só se revela no dia. Espreita os atletas e monta a tua estratégia às cegas.
            </div>
          )}
          {loading ? (
            <div style={{ fontFamily: FD, fontSize: 12, color: "#7c8a82", textTransform: "uppercase", letterSpacing: "0.08em", padding: "8px 0" }}>A carregar atletas…</div>
          ) : atletas && atletas.length > 0 ? (
            <>
              <div style={{ fontSize: 10.5, color: "#7c8a82", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>{atletas.length} atletas {cego ? "neste clássico" : "inscritos"}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {atletas.map((a) => (
                  <span key={a.id} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#16201b", border: "1px solid #243029", borderRadius: 999, padding: "3px 9px 3px 4px", fontSize: 11.5 }}>
                    <span style={{ background: "#f1ede2", color: "#1b211e", fontFamily: FD, fontWeight: 700, fontSize: 8, padding: "1px 3px", borderRadius: 2 }}>{code3(a.countryIso)}</span>
                    <span style={{ color: "#d6ddd6" }}>{a.name}{a.category ? ` · ${a.category}kg` : ""}</span>
                  </span>
                ))}
              </div>
            </>
          ) : (
            <div style={{ fontSize: 12.5, color: "#7c8a82", padding: "6px 0" }}>Lista de atletas ainda não disponível para esta competição.</div>
          )}
        </div>
      )}
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
