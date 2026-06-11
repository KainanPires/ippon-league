"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Mascot } from "@/components/Mascot";
import { type Athlete } from "@/lib/athletes";
import { focoMercado } from "@/lib/calendario";

const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";

const IOC: Record<string, string> = {
  JP: "JPN", FR: "FRA", BR: "BRA", GE: "GEO", KZ: "KAZ", AZ: "AZE", BE: "BEL",
  TR: "TUR", UZ: "UZB", RU: "AIN", DE: "GER", XK: "KOS", IT: "ITA", CA: "CAN",
  SI: "SLO", HR: "CRO", NL: "NED",
};
const code3 = (iso: string) => IOC[iso] || iso;

// Uma linha do ranking: dados do atleta (nome/país/categoria) + pontos da rodada.
type RankRow = {
  id: string;
  name: string;
  countryIso: string;
  category: string;
  gender: "M" | "F" | "";
  pontos: number;
  posicao: number; // 1 = primeiro; empates partilham posição
};

// O componente real está dentro de Suspense porque usa useSearchParams.
export default function AtletasPage() {
  return (
    <Suspense fallback={<Carregando />}>
      <Atletas />
    </Suspense>
  );
}

function Atletas() {
  const searchParams = useSearchParams();
  // Competição: ?comp=XXXX tem prioridade (para testar); senão, a do calendário.
  // A "competição da rodada" é a que está a decorrer, ou — se nenhuma decorre — a
  // última de mercado aberto (assim, fora de competição, mostra o evento mais próximo).
  const foco = focoMercado();
  const compParam = searchParams.get("comp");
  const compAtual = foco.aDecorrer ?? foco.atual;
  const idComp = compParam || compAtual.idCompeticao;
  const nomeComp = compParam ? `Competição ${compParam}` : compAtual.nome;

  const [rows, setRows] = useState<RankRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [temResultados, setTemResultados] = useState(false);
  const [sel, setSel] = useState<RankRow | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    // Duas fontes: pontos (resultados) + identidade do atleta (atletas).
    Promise.all([
      fetch(`/api/resultados?comp=${idComp}`).then((r) => r.json()).catch(() => null),
      fetch(`/api/atletas?id=${idComp}`).then((r) => r.json()).catch(() => null),
    ]).then(([res, atl]) => {
      if (!active) return;

      const pontos: Record<string, number> = res && res.pontos ? res.pontos : {};
      setTemResultados(!!(res && res.tem_resultados));

      // Mapa id_person -> dados do atleta (nome, país, categoria).
      const lista: Athlete[] = Array.isArray(atl?.atletas) ? atl.atletas : [];
      const byId = new Map<string, Athlete>();
      for (const a of lista) byId.set(a.id, a);

      // Constrói as linhas a partir de QUEM PONTUOU (chaves do mapa de pontos).
      const base = Object.entries(pontos).map(([id, pts]) => {
        const a = byId.get(id);
        return {
          id,
          name: a?.name ?? `Atleta ${id}`,
          countryIso: a?.countryIso ?? "—",
          category: a?.category ?? "",
          gender: (a?.gender ?? "") as "M" | "F" | "",
          pontos: Math.round((pts as number) * 10) / 10,
        };
      });

      // Ordena por pontos desc; em empate, por nome para ser estável.
      base.sort((x, y) => (y.pontos - x.pontos) || x.name.localeCompare(y.name));

      // Atribui posição com empates a partilhar lugar (1,2,2,4...).
      const ranked: RankRow[] = base.map((r) => {
        const melhores = base.filter((o) => o.pontos > r.pontos).length;
        return { ...r, posicao: melhores + 1 };
      });

      setRows(ranked);
      setLoading(false);
    });
    return () => { active = false; };
  }, [idComp]);

  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: FB }}>
      <div style={{ maxWidth: 460, margin: "0 auto", padding: "14px 14px 84px" }}>
        <header style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 6 }}>
          <a href="/inicio" aria-label="Voltar" style={{ width: 34, height: 34, borderRadius: "50%", border: "1px solid #243029", display: "flex", alignItems: "center", justifyContent: "center", color: "#cfd8d2", textDecoration: "none", flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
          </a>
          <h1 style={{ fontFamily: FD, fontSize: 19, fontWeight: 700, textTransform: "uppercase", margin: 0 }}>Ranking de Atletas</h1>
        </header>
        <div style={{ fontSize: 12, color: "#93a39a", marginBottom: 16, paddingLeft: 45 }}>
          Os que mais pontuaram em <span style={{ color: GOLD, fontWeight: 700 }}>{nomeComp}</span>
        </div>

        {loading ? (
          <Carregando inline />
        ) : !temResultados || rows.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 16px", background: "#121815", border: "1px solid #243029", borderRadius: 16 }}>
            <div style={{ width: 84, height: 84, margin: "0 auto 8px" }}><Mascot belt="#efeadd" expression="feliz" /></div>
            <div style={{ fontFamily: FD, fontSize: 16, fontWeight: 700, textTransform: "uppercase", margin: "4px 0 8px" }}>Ainda sem pontos</div>
            <p style={{ fontSize: 13, color: "#c7d0c9", lineHeight: 1.5, margin: 0 }}>
              Esta competição ainda não começou. Quando as lutas arrancarem, o ranking dos atletas que mais pontuam aparece aqui — atualizado durante a rodada.
            </p>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 11, color: "#5f6f67", marginBottom: 10 }}>
              {rows.length} atletas com pontos · do melhor ao pior
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {rows.map((r) => <Row key={r.id} r={r} onClick={() => setSel(r)} />)}
            </div>
          </>
        )}
      </div>

      {sel && <Detalhe r={sel} nomeComp={nomeComp} onClose={() => setSel(null)} />}

      <nav style={{ position: "fixed", left: 0, right: 0, bottom: 0, height: 60, background: "#0f1411", borderTop: "1px solid #243029", display: "flex", alignItems: "center", justifyContent: "space-around", zIndex: 50 }}>
        <NavTab label="Início" href="/inicio" icon={<HomeIcon />} />
        <NavTab label="Competições" href="/ligas" icon={<TrophyIcon />} />
        <NavTab label="Atletas" href="/atletas" icon={<AthletesIcon />} active />
        <NavTab label="Pro" href="/ippon-pro" icon={<BoltIcon />} />
      </nav>
    </main>
  );
}

function Row({ r, onClick }: { r: RankRow; onClick: () => void }) {
  // Medalhas para o pódio.
  const medal = r.posicao === 1 ? "#d9a441" : r.posicao === 2 ? "#c0c5cc" : r.posicao === 3 ? "#cd7f4d" : null;
  const negativo = r.pontos < 0;
  return (
    <button onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", background: "#121815", border: `1px solid ${medal ? medal : "#243029"}`, borderRadius: 14, padding: "10px 13px", cursor: "pointer", fontFamily: FB, textAlign: "left" }}>
      <div style={{ width: 30, textAlign: "center", flexShrink: 0 }}>
        <span style={{ fontFamily: FD, fontSize: 16, fontWeight: 700, color: medal ?? "#7c8a82" }}>{r.posicao}</span>
      </div>
      <div style={{ width: 38, height: 42, borderRadius: 7, background: "linear-gradient(160deg,#2a4d3e,#1c3a2e)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <div style={{ background: "#f1ede2", color: "#1b211e", fontFamily: FD, fontWeight: 700, fontSize: 8, padding: "1px 3px", borderRadius: 2 }}>{code3(r.countryIso)}</div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "#f1ede2" }}>{r.name}</div>
        <div style={{ fontSize: 11, color: "#93a39a" }}>{code3(r.countryIso)}{r.category ? ` · ${r.category}kg` : ""}{r.gender ? ` · ${r.gender === "F" ? "Fem" : "Masc"}` : ""}</div>
      </div>
      <div style={{ flexShrink: 0, background: negativo ? "#3a2422" : "#1d3a2b", color: negativo ? "#ef8d83" : "#9be3bd", fontFamily: FD, fontWeight: 700, fontSize: 13, padding: "4px 11px", borderRadius: 999 }}>
        {r.pontos >= 0 ? "+" : ""}{r.pontos} pts
      </div>
    </button>
  );
}

function Detalhe({ r, nomeComp, onClose }: { r: RankRow; nomeComp: string; onClose: () => void }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(6,8,7,0.80)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 100 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 460, background: "#10160f", borderTop: `2px solid ${GOLD}`, borderRadius: "18px 18px 0 0", padding: "16px 16px 28px", maxHeight: "86%", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <div style={{ width: 46, height: 50, borderRadius: 8, background: "linear-gradient(160deg,#2a4d3e,#1c3a2e)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <div style={{ background: "#f1ede2", color: "#1b211e", fontFamily: FD, fontWeight: 700, fontSize: 10, padding: "1px 4px", borderRadius: 3 }}>{code3(r.countryIso)}</div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{r.name}</div>
            <div style={{ fontSize: 12, color: "#93a39a" }}>{code3(r.countryIso)}{r.category ? ` · ${r.category}kg` : ""}</div>
          </div>
          <button onClick={onClose} aria-label="Fechar" style={{ background: "transparent", border: "none", color: "#93a39a", fontSize: 20, cursor: "pointer" }}>✕</button>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <div style={{ flex: 1, background: "#141a17", border: "1px solid #243029", borderRadius: 12, padding: "12px", textAlign: "center" }}>
            <div style={{ fontSize: 10, color: "#93a39a", textTransform: "uppercase" }}>Posição</div>
            <div style={{ fontFamily: FD, fontSize: 22, fontWeight: 700, color: GOLD }}>{r.posicao}º</div>
          </div>
          <div style={{ flex: 1, background: "#16201b", border: `1px solid ${GOLD}`, borderRadius: 12, padding: "12px", textAlign: "center" }}>
            <div style={{ fontSize: 10, color: "#93a39a", textTransform: "uppercase" }}>Pontos na rodada</div>
            <div style={{ fontFamily: FD, fontSize: 22, fontWeight: 700, color: GOLD }}>{r.pontos >= 0 ? "+" : ""}{r.pontos}</div>
          </div>
        </div>

        <div style={{ fontSize: 11.5, color: "#93a39a", textAlign: "center", lineHeight: 1.5, marginBottom: 4 }}>
          Em <span style={{ color: "#cfd8d2" }}>{nomeComp}</span>.
        </div>
        <div style={{ background: "#141a17", border: "1px solid #243029", borderRadius: 12, padding: "14px", textAlign: "center", fontSize: 12.5, color: "#93a39a" }}>
          O detalhe luta a luta — ippons, waza-aris, shidos — liga-se em breve, para veres exatamente o que ele fez para chegar a estes pontos.
        </div>
      </div>
    </div>
  );
}

function Carregando({ inline }: { inline?: boolean }) {
  const box = (
    <div style={{ textAlign: "center", padding: "40px 16px", background: inline ? "transparent" : "#0c0e0d", color: "#7c8a82" }}>
      <div style={{ fontFamily: FD, fontSize: 13, letterSpacing: "0.14em", textTransform: "uppercase" }}>A carregar ranking…</div>
    </div>
  );
  if (inline) return box;
  return <main style={{ minHeight: "100vh", background: "#0c0e0d", display: "flex", alignItems: "center", justifyContent: "center" }}>{box}</main>;
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
  // Dois judocas estilizados (silhueta simples).
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="8" cy="6" r="3" /><circle cx="17" cy="7" r="2.5" /><path d="M3 20v-1a5 5 0 0 1 10 0v1M14 20v-1a4 4 0 0 1 7-2.6" /></svg>;
}
function BoltIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" /></svg>;
}
