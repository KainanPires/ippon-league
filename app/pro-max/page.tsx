"use client";
import { useState } from "react";
import { Mascot } from "@/components/Mascot";
import { PRECO } from "@/lib/precos";
import { supabase } from "@/lib/supabase";
import { useNivel } from "@/lib/useNivel";
import { NotaMoeda } from "@/components/NotaMoeda";
import { useT } from "@/lib/i18n";
const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const MAX = "#7fb8f5"; // tom do Pro Max
// Página dedicada SÓ ao Pro Max. Quem chega aqui já é Pro (vem da central /pro),
// por isso falamos só do upgrade — não repetimos o cartão do Pro. Mostra o preço
// de UPGRADE (parte Max), que para quem já é Pro é +2,90€/mês em promoção.
//
// NOTA (fase de testes): sem prémios; o botão não cobra — alerta "em breve".
//
// Array de módulo: avaliado antes de o `t` existir, por isso guarda CHAVES (uma
// para o título, outra para a descrição). A tradução acontece no render.
const EXTRAS: { titulo: string; desc: string }[] = [
  { titulo: "pro.exChaveAoVivoT", desc: "pro.exChaveAoVivoD" },
  { titulo: "pro.exAlertaT", desc: "pro.exAlertaD" },
  { titulo: "pro.exLigasT", desc: "pro.exLigasD" },
  { titulo: "pro.exAnaliseT", desc: "pro.exAnaliseD" },
  { titulo: "pro.exGrupoT", desc: "pro.exGrupoD" },
  { titulo: "pro.exLayoutT", desc: "pro.exLayoutD" },
];
export default function ProMax() {
  const t = useT();
  const [aEnviar, setAEnviar] = useState(false);
  const [erro, setErro] = useState("");
  const { ehPro, ehProMax } = useNivel();
  // A SUBIDA PARA PRO MAX.
  //
  // A rota decide sozinha o que fazer, porque só ela sabe o estado real da
  // subscrição na Stripe:
  //
  // • Dentro dos 7 dias de teste — troca-se o preço da subscrição e não se
  // cobra nada. É o prémio de decidir cedo. A rota responde {imediato:true}
  // e não há para onde navegar: o nível muda ali mesmo.
  //
  // • Fora dos 7 dias — abre-se um pagamento único com a taxa de subida.
  // A rota responde com um url e mandamos a pessoa para lá.
  //
  // • Quem não tem Pro — a rota recusa. Aqui nem chegamos a esse ponto:
  // o botão leva à página dos planos.
  async function subir() {
    setErro("");
    setAEnviar(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const tok = sess.session?.access_token;
      if (!tok) { window.location.href = "/entrar?voltar=/pro-max"; return; }
      const res = await fetch("/api/stripe/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
          body: JSON.stringify({ alvo: "subida" }),
        });
      const j = await res.json();
      // Subida imediata, sem cobrança: recarrega para o nível novo aparecer.
      if (j?.ok && j.imediato) { window.location.href = "/perfil?pagamento=ok"; return; }
      if (j?.ok && j.url) { window.location.href = j.url; return; }
      setErro(j?.erro || t("pro.erroAbrirPagamento"));
    } catch {
      setErro(t("dd.falhaLigacao"));
    }
    setAEnviar(false);
  }
  // Frase com destaque a negrito no meio: frase inteira numa chave, com o
  // marcador %D% onde entra o negrito, dividida aqui — sobrevive à tradução.
  const partesHonesto = t("pro.mxHonesto").split("%D%");
  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: FB }}>
    <div style={{ maxWidth: 460, margin: "0 auto", padding: "14px 16px 130px" }}>
    <header style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 10 }}>
    <a href="/pro" aria-label={t("comum.voltar")} style={{ width: 34, height: 34, borderRadius: "50%", border: "1px solid #243029", display: "flex", alignItems: "center", justifyContent: "center", color: "#cfd8d2", textDecoration: "none", flexShrink: 0 }}>
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
    </a>
    <h1 style={{ fontFamily: FD, fontSize: 19, fontWeight: 700, textTransform: "uppercase", margin: 0 }}>Ippon Pro Max</h1>
    </header>
    {/* Hero */}
    <div style={{ textAlign: "center", background: "linear-gradient(160deg,#16243a,#0d1116)", border: `1.5px solid ${MAX}`, borderRadius: 18, padding: "22px 18px", marginBottom: 16 }}>
    <div style={{ width: 88, height: 88, margin: "0 auto 6px" }}><Mascot belt="#141110" expression="comemorando" /></div>
    <div style={{ fontFamily: FD, fontSize: 24, fontWeight: 700, textTransform: "uppercase", lineHeight: 1.1, color: MAX }}>{t("pro.mxSobe")}</div>
    <p style={{ fontSize: 14, color: "#9fb3cc", lineHeight: 1.5, margin: "8px 0 12px" }}>{t("pro.mxHeroSub")}</p>
    <div>
    <span style={{ fontFamily: FD, fontSize: 34, fontWeight: 700, color: MAX }}>{PRECO.upgradeAtual}</span>
    <span style={{ fontSize: 13, color: "#93a39a" }}>{t("precos.porMes")}</span>
    </div>
    <div style={{ fontSize: 12, color: "#9fb3cc", marginTop: 2 }}>{t("pro.mxAMais")}</div>
    {PRECO.emPromocao && <div style={{ fontSize: 11, color: MAX, marginTop: 6, fontWeight: 700 }}>{t("precos.etiqueta")} · {t("precos.duracaoDesconto", { meses: PRECO.mesesDesconto })}</div>}
    {/* A Stripe converte no checkout (Adaptive Pricing). Sem este aviso, quem
        está fora da zona euro lê um valor aqui e vê outro ao pagar. */}
    <NotaMoeda />
    </div>
    {/* Extras do Pro Max */}
    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
    {EXTRAS.map((b) => (
          <div key={b.titulo} style={{ display: "flex", gap: 11, background: "#121815", border: "1px solid #243029", borderRadius: 14, padding: "13px 14px" }}>
          <div style={{ width: 26, height: 26, borderRadius: "50%", background: "rgba(127,184,245,0.14)", color: MAX, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, flexShrink: 0 }}>✓</div>
          <div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{t(b.titulo)}</div>
          <div style={{ fontSize: 12, color: "#93a39a", marginTop: 2, lineHeight: 1.5 }}>{t(b.desc)}</div>
          </div>
          </div>
        ))}
    </div>
    {/* Nota honesta */}
    <div style={{ background: "#0f1411", border: "1px solid #243029", borderRadius: 14, padding: "13px 14px", marginBottom: 16 }}>
    <div style={{ fontSize: 12.5, color: "#a9b4ac", lineHeight: 1.6 }}>
    {partesHonesto[0]}<strong style={{ color: "#cfd8d2" }}>{t("pro.mxHonestoDestaque")}</strong>{partesHonesto[1]}
    </div>
    <div style={{ fontSize: 11.5, color: "#7c8a82", lineHeight: 1.55, marginTop: 10 }}>
    {t("pro.notaClassicos")}
    </div>
    </div>
    </div>
    {/* Barra fixa de assinatura */}
    <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, background: "#0d1116", borderTop: `1px solid #24364a`, padding: "12px 16px" }}>
    <div style={{ maxWidth: 460, margin: "0 auto" }}>
    {erro && <div style={{ fontSize: 12, color: "#ef8d83", marginBottom: 8, textAlign: "center" }}>{erro}</div>}
    {ehProMax ? (
        <a href="/pro-max-central" style={{ display: "block", textAlign: "center", background: MAX, color: "#0b1220", fontFamily: FD, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", padding: 15, borderRadius: 12, fontSize: 16, textDecoration: "none" }}>
        {t("pro.mxJaEs")}
        </a>
      ) : ehPro ? (
        <button onClick={subir} disabled={aEnviar} style={{ width: "100%", background: MAX, color: "#0b1220", border: "none", fontFamily: FD, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", padding: 15, borderRadius: 12, fontSize: 16, cursor: aEnviar ? "default" : "pointer", opacity: aEnviar ? 0.7 : 1 }}>
        {aEnviar ? t("precos.aAbrir") : `${t("pro.mxQuero")} · ${PRECO.upgradeAtual}${t("precos.porMes")}`}
        </button>
      ) : (
        // Sem Pro não há subida: esta página fala de um upgrade que não se
        // aplica. Manda-se para os planos, onde o Pro Max se compra direto.
        <a href="/ippon-pro" style={{ display: "block", textAlign: "center", background: MAX, color: "#0b1220", fontFamily: FD, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", padding: 15, borderRadius: 12, fontSize: 16, textDecoration: "none" }}>
        {t("pro.mxVerPlanos")}
        </a>
      )}
    {/* A taxa única não pode ficar escondida: quem sobe fora dos 7 dias
      paga-a além da diferença mensal, e descobrir isso só no ecrã de
      pagamento é a receita para desistir a meio. */}
    {ehPro && !ehProMax && (
        <div style={{ fontSize: 11, color: "#7c8a82", textAlign: "center", marginTop: 8, lineHeight: 1.5 }}>
        {t("pro.mxTaxa", { taxa: PRECO.subidaTaxa })}
        </div>
      )}
    <a href="/pro" style={{ display: "block", textAlign: "center", marginTop: 8, color: "#93a39a", fontSize: 12, textDecoration: "none", fontFamily: FB }}>{t("pro.mxAgoraNao")}</a>
    </div>
    </div>
    </main>
  );
}
