"use client";

import { useState, useEffect } from "react";
import { Escudo, DEFAULT_IDENTITY, type Identity } from "@/components/Escudo";
import { supabase } from "@/lib/supabase";

const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";

type Tab = "ativas" | "mercado" | "resultados";

function esc(p: Partial<Identity>): Identity { return { ...DEFAULT_IDENTITY, ...p }; }

const OFICIAIS = [
  { id: "mundial", name: "Liga Mundial", sub: "Concorre aos prémios mundiais", cfg: esc({ bg1: "#1c3a2e", bg2: "#102a20", border: GOLD, symbol: "mundo" }) },
  { id: "continental", name: "Continental", sub: "Concorre aos prémios do teu continente", cfg: esc({ bg1: "#2f6fb3", bg2: "#25588f", border: "#eaf2fd", symbol: "mapa-europa" }) },
];

interface MinhaLiga {
  id: string;
  name: string;
  formato: string;
  privacidade: string;
  escudo: Identity | null;
  invite_code: string;
  membros: number;
  sou_dono: boolean;
}

export default function Ligas() {
  const [tab, setTab] = useState<Tab>("ativas");
  const [mine, setMine] = useState<MinhaLiga[]>([]);
  const [aCarregar, setACarregar] = useState(true);
  const [codigo, setCodigo] = useState("");
  const [aEntrar, setAEntrar] = useState(false);
  const [erroEntrar, setErroEntrar] = useState("");
  const [souPro, setSouPro] = useState(false);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user?.id;
      const meta = sess.session?.user?.user_metadata as { is_pro?: boolean } | undefined;
      if (vivo) setSouPro(!!meta?.is_pro);
      if (!uid) { if (vivo) { setMine([]); setACarregar(false); } return; }
      try {
        const res = await fetch(`/api/liga/minhas?user_id=${uid}`);
        const j = await res.json();
        if (vivo && Array.isArray(j.ligas)) setMine(j.ligas);
      } catch {}
      if (vivo) setACarregar(false);
    })();
    return () => { vivo = false; };
  }, []);

  async function entrarPorCodigo() {
    const c = codigo.trim().toUpperCase();
    if (c.length < 4) { setErroEntrar("Código demasiado curto."); return; }
    setErroEntrar("");
    setAEntrar(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user?.id;
      if (!uid) { window.location.href = `/entrar?voltar=/ligas`; return; }
      const res = await fetch("/api/liga/entrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: uid, codigo: c }),
      });
      const j = await res.json();
      if (!j.ok) {
        setErroEntrar(j.erro || "Não encontrámos essa liga.");
        setAEntrar(false);
        return;
      }
      // Entrou: vai direto para a liga.
      window.location.href = `/liga/${j.liga.invite_code}`;
    } catch {
      setErroEntrar("Falha de ligação.");
      setAEntrar(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: FB }}>
      <div style={{ maxWidth: 460, margin: "0 auto", padding: "14px 14px 84px" }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <a href="/inicio" aria-label="Voltar" style={{ width: 34, height: 34, borderRadius: "50%", border: "1px solid #243029", display: "flex", alignItems: "center", justifyContent: "center", color: "#cfd8d2", textDecoration: "none" }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
            </a>
            <h1 style={{ fontFamily: FD, fontSize: 19, fontWeight: 700, textTransform: "uppercase", margin: 0 }}>Ligas</h1>
          </div>
          <a href="/criar-liga" aria-label="Criar liga" style={{ width: 36, height: 36, borderRadius: "50%", background: GOLD, color: "#1b211e", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          </a>
        </header>

        <div style={{ display: "flex", gap: 8, marginBottom: 16, borderBottom: "1px solid #1a221d" }}>
          {(["ativas", "mercado", "resultados"] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)} style={{ flex: 1, textAlign: "center", background: "transparent", border: "none", borderBottom: `2px solid ${tab === t ? GOLD : "transparent"}`, color: tab === t ? "#f1ede2" : "#7c8a82", fontFamily: FD, fontSize: 14, fontWeight: 700, textTransform: "uppercase", padding: "8px 0", cursor: "pointer" }}>
              {t === "ativas" ? "Ativas" : t === "mercado" ? "Mercado" : "Resultados"}
            </button>
          ))}
        </div>

        {tab === "ativas" && (
          <>
            <Section>Ligas oficiais · prémios</Section>
            {OFICIAIS.map((l) => (
              <OficialRow key={l.id} cfg={l.cfg} name={l.name} sub={l.sub} pro={souPro} />
            ))}
            {!souPro && (
              <a href="/ippon-pro" style={{ display: "block", textAlign: "center", marginTop: 2, marginBottom: 4, background: "#2a2410", border: "1px solid #5a4a18", color: GOLD, fontFamily: FD, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", padding: "11px 14px", borderRadius: 10, textDecoration: "none", fontSize: 12.5, lineHeight: 1.4 }}>
                🔒 Só membros Pro concorrem aos prémios · passa a Pro
              </a>
            )}

            <Section style={{ marginTop: 18 }}>Ligas de amigos</Section>
            {aCarregar ? (
              <div style={{ textAlign: "center", padding: "20px", color: "#7c8a82", fontFamily: FD, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.1em" }}>A carregar…</div>
            ) : mine.length > 0 ? (
              <>
                {mine.map((l) => (
                  <a key={l.id} href={`/liga/${l.invite_code}`} style={{ textDecoration: "none" }}>
                    <LeagueRow cfg={l.escudo || DEFAULT_IDENTITY} name={l.name} sub={`${l.formato === "copa" ? "Copa Ippon" : "Pontos corridos"} · ${l.membros} ${l.membros === 1 ? "membro" : "membros"}`} right={<ActionBtn kind="ver">Abrir</ActionBtn>} />
                  </a>
                ))}
                <a href="/criar-liga" style={{ display: "block", textAlign: "center", marginTop: 10, background: "transparent", border: "1px solid #2a3a33", color: "#cfd8d2", fontFamily: FD, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", padding: "11px 20px", borderRadius: 10, textDecoration: "none", fontSize: 13 }}>+ Criar outra liga</a>
              </>
            ) : (
              <div style={{ background: "#121815", border: "1px dashed #2a3a33", borderRadius: 14, padding: "18px 14px", textAlign: "center" }}>
                <div style={{ fontSize: 13, color: "#c7d0c9", marginBottom: 12, lineHeight: 1.5 }}>Ainda não tens ligas de amigos.<br />Cria uma e desafia o teu dojo!</div>
                <a href="/criar-liga" style={{ display: "inline-block", background: "#3f8f5a", color: "#06140d", fontFamily: FD, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", padding: "11px 20px", borderRadius: 10, textDecoration: "none", fontSize: 14 }}>Criar liga</a>
              </div>
            )}

            <Section style={{ marginTop: 18 }}>Entrar com código</Section>
            <div style={{ display: "flex", gap: 8 }}>
              <input value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} placeholder="Código de convite" maxLength={8} style={{ flex: 1, background: "#141a17", border: "1px solid #243029", borderRadius: 10, padding: "11px 13px", color: "#f1ede2", fontSize: 15, fontFamily: FD, letterSpacing: "0.1em", outline: "none", textTransform: "uppercase" }} />
              <button onClick={entrarPorCodigo} disabled={aEntrar} style={{ background: GOLD, color: "#1b211e", border: "none", fontFamily: FD, fontWeight: 700, textTransform: "uppercase", fontSize: 12, padding: "0 18px", borderRadius: 10, cursor: "pointer", whiteSpace: "nowrap" }}>{aEntrar ? "…" : "Entrar"}</button>
            </div>
            {erroEntrar && (
              erroEntrar.includes("Pro") ? (
                <a href="/ippon-pro" style={{ display: "block", fontSize: 12.5, color: GOLD, marginTop: 8, textDecoration: "none", background: "#2a2410", border: "1px solid #5a4a18", borderRadius: 10, padding: "10px 12px", lineHeight: 1.4 }}>{erroEntrar} →</a>
              ) : (
                <div style={{ fontSize: 12, color: "#ef8d83", marginTop: 8 }}>{erroEntrar}</div>
              )
            )}
          </>
        )}

        {tab === "mercado" && (
          <div style={{ textAlign: "center", padding: "50px 16px", color: "#7c8a82" }}>
            <div style={{ fontFamily: FD, fontSize: 15, fontWeight: 700, textTransform: "uppercase", color: "#cfd8d2", marginBottom: 6 }}>Mercado de ligas</div>
            <div style={{ fontSize: 13, lineHeight: 1.5 }}>As ligas públicas abertas vão aparecer aqui para qualquer um entrar.</div>
            <div style={{ marginTop: 12, fontSize: 11, color: "#5f6f67", border: "1px solid #2a3a33", borderRadius: 999, padding: "4px 12px", display: "inline-block" }}>Em breve</div>
          </div>
        )}

        {tab === "resultados" && (
          <div style={{ textAlign: "center", padding: "50px 16px", color: "#7c8a82" }}>
            <div style={{ fontFamily: FD, fontSize: 15, fontWeight: 700, textTransform: "uppercase", color: "#cfd8d2", marginBottom: 6 }}>Resultados</div>
            <div style={{ fontSize: 13, lineHeight: 1.5 }}>As classificações de cada rodada aparecem aqui depois de cada competição.</div>
            <div style={{ marginTop: 12, fontSize: 11, color: "#5f6f67", border: "1px solid #2a3a33", borderRadius: 999, padding: "4px 12px", display: "inline-block" }}>Em breve</div>
          </div>
        )}
      </div>

      <nav style={{ position: "fixed", left: 0, right: 0, bottom: 0, height: 60, background: "#0f1411", borderTop: "1px solid #243029", display: "flex", alignItems: "center", justifyContent: "space-around", zIndex: 50 }}>
        <NavTab label="Início" href="/inicio" icon={<HomeIcon />} />
        <NavTab label="Competições" href="/ligas" icon={<TrophyIcon />} active />
        <NavTab label="Atletas" href="/atletas" icon={<AthletesIcon />} />
        <NavTab label="Pro" icon={<BoltIcon />} href="/ippon-pro" />
      </nav>
    </main>
  );
}

function NavTab({ label, icon, href, active }: { label: string; icon: React.ReactNode; href?: string; active?: boolean }) {
  const style: React.CSSProperties = { display: "flex", flexDirection: "column", alignItems: "center", gap: 3, color: active ? GOLD : "#6f7d76", textDecoration: "none" };
  const inner = <>{icon}<span style={{ fontSize: 11, fontWeight: active ? 700 : 400 }}>{label}</span></>;
  return href ? <a href={href} style={style}>{inner}</a> : <div style={style}>{inner}</div>;
}
function HomeIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /></svg>; }
function TrophyIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 4h8v5a4 4 0 0 1-8 0V4z" /><path d="M8 6H5v2a3 3 0 0 0 3 3M16 6h3v2a3 3 0 0 1-3 3M10 17h4M9 21h6M12 13v4" /></svg>; }
function AthletesIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="8" cy="6" r="3" /><circle cx="17" cy="7" r="2.5" /><path d="M3 20v-1a5 5 0 0 1 10 0v1M14 20v-1a4 4 0 0 1 7-2.6" /></svg>; }
function BoltIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" /></svg>; }

function Section({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ fontFamily: FD, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#93a39a", margin: "4px 0 10px", ...style }}>{children}</div>;
}
function LeagueRow({ cfg, name, sub, right }: { cfg: Identity; name: string; sub: string; right: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, background: "#121815", border: "1px solid #243029", borderRadius: 14, padding: "11px 13px", marginBottom: 9 }}>
      <div style={{ flexShrink: 0, display: "flex" }}><Escudo config={cfg} size={34} /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "#f1ede2" }}>{name}</div>
        <div style={{ fontSize: 11, color: "#93a39a" }}>{sub}</div>
      </div>
      {right}
    </div>
  );
}

function OficialRow({ cfg, name, sub, pro }: { cfg: Identity; name: string; sub: string; pro: boolean }) {
  const conteudo = (
    <div style={{ display: "flex", alignItems: "center", gap: 12, background: "#121815", border: `1px solid ${pro ? "#243029" : "#2a2410"}`, borderRadius: 14, padding: "11px 13px", marginBottom: 9, opacity: pro ? 1 : 0.92 }}>
      <div style={{ flexShrink: 0, display: "flex", position: "relative" }}>
        <Escudo config={cfg} size={34} />
        {!pro && <span style={{ position: "absolute", right: -4, bottom: -4, width: 18, height: 18, borderRadius: "50%", background: "#2a2410", border: "1px solid #5a4a18", color: GOLD, fontSize: 9, display: "flex", alignItems: "center", justifyContent: "center" }}>🔒</span>}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#f1ede2", display: "flex", alignItems: "center", gap: 6 }}>{name}</div>
        <div style={{ fontSize: 11, color: "#93a39a" }}>{sub}</div>
      </div>
      {pro ? (
        <span style={{ fontFamily: FD, fontWeight: 700, color: GOLD, fontSize: 12 }}>Ativa</span>
      ) : (
        <span style={{ background: "#3a2f12", color: GOLD, fontSize: 10, fontWeight: 700, padding: "5px 10px", borderRadius: 999, whiteSpace: "nowrap" }}>PRO</span>
      )}
    </div>
  );
  return pro ? conteudo : <a href="/ippon-pro" style={{ textDecoration: "none", display: "block" }}>{conteudo}</a>;
}

function ActionBtn({ kind, children }: { kind: "ver" | "solicitar"; children: React.ReactNode }) {
  const ver = kind === "ver";
  return <span style={{ background: ver ? "#e67e22" : "#3f8f5a", color: ver ? "#1b0f06" : "#06140d", border: "none", fontFamily: FD, fontWeight: 700, textTransform: "uppercase", fontSize: 11, padding: "7px 12px", borderRadius: 8, whiteSpace: "nowrap", display: "inline-block" }}>{children}</span>;
}
