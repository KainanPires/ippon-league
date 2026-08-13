"use client";
import { useEffect, useState } from "react";
import { Mascot } from "@/components/Mascot";
import { temSessao } from "@/lib/auth";
// Nível da tabela `users` — a mesma fonte que o servidor usa.
import { useNivel } from "@/lib/useNivel";
import { useT } from "@/lib/i18n";
const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";
const APP_URL = "https://www.ipponleague.com/inicio";
const FAIXAS: { key: string; cor: string }[] = [
  { key: "faixa.branca", cor: "#d7dcd6" },
  { key: "faixa.azul", cor: "#3f86d6" },
  { key: "faixa.amarela", cor: "#e6b422" },
  { key: "faixa.verde", cor: "#3f9f5a" },
  { key: "faixa.roxa", cor: "#9b6cc9" },
  { key: "faixa.marrom", cor: "#a06a3a" },
  { key: "faixa.preta", cor: "#141110" },
];
const PONTOS: { acao: string; aplica: string; sofre: string }[] = [
  { acao: "Ippon", aplica: "+10", sofre: "−5" },
  { acao: "Waza-ari", aplica: "+4", sofre: "−2" },
  { acao: "Yuko", aplica: "+2", sofre: "−1" },
  { acao: "Shido", aplica: "+1 *", sofre: "−2 **" },
  { acao: "Hansoku-make direto", aplica: "—", sofre: "−10" },
];
export default function ComoJogar() {
  const t = useT();
  const [logado, setLogado] = useState(false);
  const { ehPro: isPro } = useNivel();
  const [podePartilhar, setPodePartilhar] = useState(false);
  useEffect(() => {
    temSessao().then(setLogado).catch(() => setLogado(false));
    // O estado Pro vem do useNivel() (tabela `users`), não do metadata.
    try {
      const nav = navigator as Navigator & { share?: unknown };
      setPodePartilhar(typeof nav.share === "function");
    } catch { setPodePartilhar(false); }
  }, []);
  async function partilhar() {
    const texto = t("cj.partilhaTexto");
    try {
      const nav = navigator as Navigator & { share?: (d: { title?: string; text?: string; url?: string }) => Promise<void> };
      if (nav.share) {
        await nav.share({ title: t("cj.heroTitulo"), text: texto, url: APP_URL });
        return;
      }
    } catch { /* cancelado */ }
    try {
      await navigator.clipboard.writeText(`${texto} ${APP_URL}`);
      alert(t("cj.linkCopiado"));
    } catch { /* ignora */ }
  }
  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: FB }}>
      <div style={{ maxWidth: 460, margin: "0 auto", padding: "14px 16px 48px" }}>
        <header style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 16 }}>
          <a href={logado ? "/perfil" : "/"} aria-label={t("comum.voltar")} style={{ width: 34, height: 34, borderRadius: "50%", border: "1px solid #243029", display: "flex", alignItems: "center", justifyContent: "center", color: "#cfd8d2", textDecoration: "none", flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
          </a>
          <h1 style={{ fontFamily: FD, fontSize: 19, fontWeight: 700, textTransform: "uppercase", margin: 0 }}>{t("cj.titulo")}</h1>
          {podePartilhar && (
            <button onClick={partilhar} aria-label={t("comum.partilhar")} style={{ marginLeft: "auto", width: 34, height: 34, borderRadius: "50%", border: `1px solid ${GOLD}`, background: "transparent", color: GOLD, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" /></svg>
            </button>
          )}
        </header>
        <section style={{ textAlign: "center", background: "linear-gradient(160deg,#1c3a2e,#10160f)", border: `1px solid ${GOLD}`, borderRadius: 18, padding: "22px 18px", marginBottom: 16 }}>
          <div style={{ width: 92, height: 92, margin: "0 auto 6px" }}><Mascot belt="#141110" expression="feliz" /></div>
          <div style={{ fontSize: 11, color: "#93a39a", textTransform: "uppercase", letterSpacing: "0.1em" }}>{t("cj.heroKicker")}</div>
          <h2 style={{ fontFamily: FD, fontSize: 22, fontWeight: 700, textTransform: "uppercase", margin: "4px 0 8px", lineHeight: 1.1 }}>{t("cj.heroTitulo")}</h2>
          <p style={{ fontSize: 14, color: "#c7d0c9", lineHeight: 1.55, margin: 0 }}>{t("cj.heroSub")}</p>
        </section>
        <Secao expr="indicando" titulo={t("cj.s1titulo")}>
          {t("cj.s1corpo").split(/(%A%)/).map((s, i) =>
            s === "%A%" ? <strong key={i} style={{ color: GOLD }}>100 Judocoins (JC)</strong> : s
          )}
        </Secao>
        <section style={cardStyle}>
          <Cabecalho expr="determinado" titulo={t("cj.s2titulo")} />
          <p style={pStyle}>
            {t("cj.s2corpo").split(/(%A%)/).map((s, i) =>
              s === "%A%" ? <strong key={i}>{t("cj.s2A")}</strong> : s
            )}
          </p>
          <div style={{ display: "flex", gap: 10, margin: "14px 0" }}>
            <div style={{ flex: 1, background: "rgba(127,209,163,0.10)", border: "1px solid #1f5e44", borderRadius: 12, padding: "12px 8px", textAlign: "center" }}>
              <div style={{ width: 56, height: 56, margin: "0 auto 4px" }}><Mascot belt={GOLD} expression="comemorando" /></div>
              <div style={{ fontSize: 11, color: "#7fd1a3", fontWeight: 700 }}>{t("cj.aplicaIppon")}</div>
              <div style={{ fontFamily: FD, fontSize: 20, fontWeight: 700, color: "#7fd1a3" }}>+10</div>
            </div>
            <div style={{ flex: 1, background: "rgba(239,141,131,0.10)", border: "1px solid #5a2f2c", borderRadius: 12, padding: "12px 8px", textAlign: "center" }}>
              <div style={{ width: 56, height: 56, margin: "0 auto 4px" }}><Mascot belt="#5a2f2c" expression="determinado" /></div>
              <div style={{ fontSize: 11, color: "#ef8d83", fontWeight: 700 }}>{t("cj.sofreIppon")}</div>
              <div style={{ fontFamily: FD, fontSize: 20, fontWeight: 700, color: "#ef8d83" }}>−5</div>
            </div>
          </div>
          <div style={{ fontSize: 11, color: "#7c8a82", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>{t("cj.tabelaTitulo")}</div>
          <table style={{ width: "100%", fontSize: 13.5, borderCollapse: "collapse" }}>
            <tbody>
              <tr style={{ borderBottom: "1px solid #2a3a33" }}>
                <td style={{ padding: "7px 0", color: "#93a39a" }}>{t("cj.colAcao")}</td>
                <td style={{ padding: "7px 0", textAlign: "center", color: "#7fd1a3" }}>{t("cj.colAplica")}</td>
                <td style={{ padding: "7px 0", textAlign: "center", color: "#ef8d83" }}>{t("cj.colSofre")}</td>
              </tr>
              {PONTOS.map((p) => (
                <tr key={p.acao} style={{ borderBottom: "1px solid #1a221d" }}>
                  <td style={{ padding: "7px 0" }}>{p.acao === "Hansoku-make direto" ? t("cj.hansokuDireto") : p.acao}</td>
                  <td style={{ padding: "7px 0", textAlign: "center", color: p.aplica === "—" ? "#5f6f67" : "#7fd1a3", fontFamily: FD }}>{p.aplica}</td>
                  <td style={{ padding: "7px 0", textAlign: "center", color: p.sofre === "—" ? "#5f6f67" : "#ef8d83", fontFamily: FD }}>{p.sofre}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ background: "#0f1411", border: "1px solid #243029", borderRadius: 12, padding: "12px 14px", marginTop: 14 }}>
            <div style={{ fontSize: 12.5, color: "#7fd1a3", fontWeight: 700, marginBottom: 3 }}>{t("cj.shidoFavorTitulo")}</div>
            <p style={{ fontSize: 12.5, color: "#a9b4ac", lineHeight: 1.55, margin: "0 0 10px" }}>
              {t("cj.shidoFavorCorpo").split(/(%[AB]%)/).map((s, i) =>
                s === "%A%" ? <strong key={i} style={{ color: "#f1ede2" }}>{t("cj.shidoFavorA")}</strong>
                : s === "%B%" ? <strong key={i} style={{ color: "#7fd1a3" }}>+6</strong>
                : s
              )}
            </p>
            <div style={{ fontSize: 12.5, color: "#ef8d83", fontWeight: 700, marginBottom: 3 }}>{t("cj.shidoContraTitulo")}</div>
            <p style={{ fontSize: 12.5, color: "#a9b4ac", lineHeight: 1.55, margin: 0 }}>
              {t("cj.shidoContraCorpo").split(/(%[ABCD]%)/).map((s, i) =>
                s === "%A%" ? <strong key={i} style={{ color: "#f1ede2" }}>−2</strong>
                : s === "%B%" ? <strong key={i} style={{ color: "#f1ede2" }}>−3</strong>
                : s === "%C%" ? <strong key={i} style={{ color: "#f1ede2" }}>−4</strong>
                : s === "%D%" ? <strong key={i} style={{ color: "#ef8d83" }}>−9</strong>
                : s
              )}
            </p>
          </div>
        </section>
        <Secao expr="determinado" titulo={t("cj.s3titulo")} destaque>
          {t("cj.s3corpo").split(/(%A%)/).map((s, i) =>
            s === "%A%" ? <strong key={i} style={{ color: GOLD }}>{t("cj.s3A")}</strong> : s
          )}
        </Secao>
        <section style={cardStyle}>
          <Cabecalho expr="sabio" titulo={t("cj.s4titulo")} />
          <p style={pStyle}>
            {t("cj.s4corpo").split(/(%A%)/).map((s, i) =>
              s === "%A%" ? <strong key={i}>{t("cj.s4A")}</strong> : s
            )}
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, margin: "14px 0" }}>
            {FAIXAS.map((f) => {
              const ehPreta = f.key === "faixa.preta";
              return (
                <div key={f.key} style={{ textAlign: "center" }}>
                  <div style={{ width: 48, height: 48, margin: "0 auto" }}><Mascot belt={f.cor} expression="feliz" /></div>
                  <div style={{ height: 5, background: f.cor, borderRadius: 3, margin: "3px 8px", border: ehPreta ? "1px solid #4a5550" : "none", boxSizing: "border-box" }} />
                  <div style={{ fontSize: 10, color: "#93a39a" }}>{t(f.key)}</div>
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1, background: "rgba(127,209,163,0.08)", border: "1px solid #1f5e44", borderRadius: 12, padding: 12 }}>
              <div style={{ fontSize: 12.5, color: "#7fd1a3", fontWeight: 700, marginBottom: 4 }}>{t("cj.comoSubirTit")}</div>
              <p style={{ fontSize: 12, color: "#a9b4ac", lineHeight: 1.5, margin: 0 }}>{t("cj.comoSubirCorpo")}</p>
            </div>
            <div style={{ flex: 1, background: "rgba(239,141,131,0.08)", border: "1px solid #5a2f2c", borderRadius: 12, padding: 12 }}>
              <div style={{ fontSize: 12.5, color: "#ef8d83", fontWeight: 700, marginBottom: 4 }}>{t("cj.comoDescerTit")}</div>
              <p style={{ fontSize: 12, color: "#a9b4ac", lineHeight: 1.5, margin: 0 }}>{t("cj.comoDescerCorpo")}</p>
            </div>
          </div>
        </section>
        <Secao expr="indicando" titulo={t("cj.s5titulo")}>
          {t("cj.s5corpo").split(/(%A%)/).map((s, i) =>
            s === "%A%" ? <strong key={i} style={{ color: GOLD }}>{t("cj.s5A")}</strong> : s
          )}
        </Secao>
        <Secao expr="determinado" titulo={t("cj.s6titulo")}>
          {t("cj.s6corpo")}
        </Secao>
        <Secao expr="feliz" titulo={t("cj.s7titulo")}>
          {t("cj.s7corpo").split(/(%A%)/).map((s, i) =>
            s === "%A%" ? <strong key={i}>Copa Ippon</strong> : s
          )}
        </Secao>
        {!isPro && (
          <section style={{ background: "linear-gradient(160deg,#2a2410,#15110a)", border: `1px solid ${GOLD}`, borderRadius: 18, padding: "20px 18px", textAlign: "center", marginBottom: 14 }}>
            <div style={{ width: 64, height: 64, margin: "0 auto 6px" }}><Mascot belt="#141110" expression="sabio" /></div>
            <div style={{ fontFamily: FD, fontSize: 18, fontWeight: 700, textTransform: "uppercase", color: GOLD }}>{t("cj.proTitulo")}</div>
            <p style={{ fontSize: 13, color: "#c7d0c9", lineHeight: 1.55, margin: "6px 0 4px" }}>{t("cj.proCorpo")}</p>
            <p style={{ fontSize: 13, color: GOLD, fontWeight: 700, margin: "0 0 14px" }}>{t("precos.premios")}.</p>
            <a href="/ippon-pro" style={{ display: "block", padding: 13, borderRadius: 12, background: GOLD, color: "#1b211e", fontFamily: FD, fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", textDecoration: "none" }}>
              {t("cj.proCta")}
            </a>
          </section>
        )}
        <section style={{ background: "#121815", border: `2px solid ${GOLD}`, borderRadius: 18, padding: "22px 18px", textAlign: "center" }}>
          <div style={{ width: 72, height: 72, margin: "0 auto 6px" }}><Mascot belt="#141110" expression="comemorando" /></div>
          <h2 style={{ fontFamily: FD, fontSize: 18, fontWeight: 700, textTransform: "uppercase", margin: "0 0 6px" }}>{t("cj.ctaTitulo")}</h2>
          <p style={{ fontSize: 13.5, color: "#c7d0c9", lineHeight: 1.55, margin: "0 0 14px" }}>{t("cj.ctaSub")}</p>
          <a href={logado ? "/meu-time" : "/entrar"} style={{ display: "block", padding: 14, borderRadius: 12, background: GOLD, color: "#1b211e", fontFamily: FD, fontSize: 15, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", textDecoration: "none" }}>
            {logado ? t("sobre.ctaLogado") : t("cj.ctaDeslogado")}
          </a>
          {podePartilhar && (
            <button onClick={partilhar} style={{ marginTop: 10, background: "transparent", border: "none", color: GOLD, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: FB }}>
              {t("cj.partilharGuia")}
            </button>
          )}
          <div style={{ fontSize: 11, color: "#5f6f67", marginTop: 10 }}>www.ipponleague.com</div>
        </section>
      </div>
    </main>
  );
}
const cardStyle: React.CSSProperties = {
  background: "#121815", border: "1px solid #243029", borderRadius: 16, padding: 18, marginBottom: 14,
};
const pStyle: React.CSSProperties = {
  fontSize: 14, color: "#c7d0c9", lineHeight: 1.6, margin: 0,
};
function Cabecalho({ expr, titulo }: { expr: string; titulo: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
      <div style={{ width: 44, height: 44, flexShrink: 0 }}><Mascot belt="#141110" expression={expr as never} /></div>
      <div style={{ fontFamily: FD, fontSize: 16, fontWeight: 700, textTransform: "uppercase" }}>{titulo}</div>
    </div>
  );
}
function Secao({ expr, titulo, children, destaque }: { expr: string; titulo: string; children: React.ReactNode; destaque?: boolean }) {
  return (
    <section style={{ ...cardStyle, border: destaque ? `1px solid ${GOLD}` : "1px solid #243029" }}>
      <Cabecalho expr={expr} titulo={titulo} />
      <p style={pStyle}>{children}</p>
    </section>
  );
}
