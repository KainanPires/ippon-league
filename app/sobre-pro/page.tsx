"use client";
import { useEffect, useState } from "react";
import { Mascot } from "@/components/Mascot";
import { PRECO } from "@/lib/precos";
import { temSessao } from "@/lib/auth";
import { NotaMoeda } from "@/components/NotaMoeda";
import { useNivel } from "@/lib/useNivel";
import { useT } from "@/lib/i18n";
const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";
const MAX = "#7fb8f5"; // tom do Pro Max
// Extras que o Pro Max dá a mais (além de tudo o que o Pro tem). A chave ao vivo
// e a análise existem só nas competições de topo (Mundial, Grand Slam, Grand
// Prix, Masters, Olimpíadas) — dito de forma explícita, para não prometer chave
// em competições onde ela não vai existir.
//
// Arrays de módulo: guardam CHAVES (título + descrição), traduzidas no render.
// Os extras do Pro Max reaproveitam as chaves da página /pro-max (pro.ex*).
const MAX_EXTRA: { tit: string; desc: string }[] = [
  { tit: "pro.exChaveAoVivoT", desc: "pro.exChaveAoVivoD" },
  { tit: "pro.exAlertaT", desc: "pro.exAlertaD" },
  { tit: "pro.exLigasT", desc: "pro.exLigasD" },
  { tit: "pro.exAnaliseT", desc: "pro.exAnaliseD" },
  { tit: "pro.exGrupoT", desc: "pro.exGrupoD" },
  { tit: "pro.exLayoutT", desc: "pro.exLayoutD" },
];
// O que tens com o Pro. Só o que é REAL ou fundamentado na análise. Nada que
// entregue a decisão do jogador (quem montar / quem é o melhor da rodada).
// NOTA (fase de testes): não prometemos prémios — o foco é a vantagem de
// informação e a competição. Prémios/experiências ficam para quando o jogo
// estiver validado.
const VANTAGENS: { tit: string; desc: string }[] = [
  { tit: "pro.vaScoutT", desc: "pro.vaScoutD" },
  { tit: "pro.vaTimeT", desc: "pro.vaTimeD" },
  { tit: "pro.vaCapitaoT", desc: "pro.vaCapitaoD" },
  { tit: "pro.vaValorizacaoT", desc: "pro.vaValorizacaoD" },
  { tit: "pro.vaChaveamentoT", desc: "pro.vaChaveamentoD" },
  { tit: "pro.vaAoVivoT", desc: "pro.vaAoVivoD" },
  { tit: "pro.va5LigasT", desc: "pro.va5LigasD" },
  { tit: "pro.vaDesignT", desc: "pro.vaDesignD" },
];
export default function SobrePro() {
  const t = useT();
  const [logado, setLogado] = useState(false);

  // O NÍVEL VEM DO useNivel (tabela `users`), NÃO DO user_metadata.
  //
  // Esta página lia `user_metadata.is_pro` para decidir entre o botão de compra
  // e a mensagem "És membro Ippon Pro". Como o metadata deixou de ser
  // sincronizado quando o is_pro saiu do trigger, um subscritor que pagou via o
  // botão a vender-lhe o que já tinha. É a mesma família de bugs do /pro, do
  // /criar-liga e do /api/liga.
  //
  // Pro Max entra no mesmo saco: quem tem Max tem Pro.
  const { ehPro, ehProMax } = useNivel();
  const isPro = ehPro || ehProMax;

  useEffect(() => {
      temSessao().then(setLogado).catch(() => setLogado(false));
    }, []);
  // Frases com destaque a negrito no meio: a frase inteira vive numa chave, com
  // marcadores (%P%/%M%, %D%, %A%/%B%) onde entram os negritos, e dividimos aqui.
  // Sobrevive à tradução — noutras línguas a ordem das palavras muda.
  const intro = t("pro.sobreIntro").split(/%P%|%M%/);
  const maxInclui = t("pro.sobreMaxInclui").split("%D%");
  const naoFaz = t("pro.sobreNaoFazCorpo").split(/%A%|%B%/);
  const transp2 = t("pro.sobreTransp2").split("%D%");
  const transp3 = t("pro.sobreTransp3").split("%D%");
  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: FB }}>
    <div style={{ maxWidth: 460, margin: "0 auto", padding: "14px 16px 48px" }}>
    {/* Cabeçalho */}
    <header style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 16 }}>
    <a href={logado ? "/perfil" : "/"} aria-label={t("comum.voltar")} style={{ width: 34, height: 34, borderRadius: "50%", border: "1px solid #243029", display: "flex", alignItems: "center", justifyContent: "center", color: "#cfd8d2", textDecoration: "none", flexShrink: 0 }}>
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
    </a>
    <h1 style={{ fontFamily: FD, fontSize: 19, fontWeight: 700, textTransform: "uppercase", margin: 0 }}>Ippon Pro</h1>
    </header>
    {/* Intro */}
    <section style={{ textAlign: "center", background: "linear-gradient(160deg,#2a2410,#15110a)", border: `1px solid ${GOLD}`, borderRadius: 18, padding: "24px 18px", marginBottom: 18 }}>
    <div style={{ width: 88, height: 88, margin: "0 auto 8px" }}><Mascot belt="#141110" expression="sabio" /></div>
    <h2 style={{ fontFamily: FD, fontSize: 22, fontWeight: 700, textTransform: "uppercase", margin: "4px 0 8px", lineHeight: 1.1, color: GOLD }}>{t("pro.sobreTitulo")}</h2>
    <p style={{ fontSize: 14, color: "#dfe6e0", lineHeight: 1.6, margin: 0 }}>{intro[0]}<strong style={{ color: GOLD }}>Pro</strong>{intro[1]}<strong style={{ color: MAX }}>Pro Max</strong>{intro[2]}</p>
    </section>
    {/* O que tens */}
    <SectionTitle>{t("pro.sobreQueTens")}</SectionTitle>
    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 22 }}>
    {VANTAGENS.map((v) => (
          <div key={v.tit} style={{ display: "flex", gap: 11, background: "#121815", border: "1px solid #243029", borderRadius: 14, padding: "13px 14px" }}>
          <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#3a2f12", color: GOLD, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, flexShrink: 0 }}>✓</div>
          <div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{t(v.tit)}</div>
          <div style={{ fontSize: 12.5, color: "#93a39a", marginTop: 2, lineHeight: 1.5 }}>{t(v.desc)}</div>
          </div>
          </div>
        ))}
    </div>
    {/* O QUE O PRO MAX ACRESCENTA — secção própria, tom azul (MAX) */}
    <SectionTitle>{t("pro.sobreMaxAcrescenta")}</SectionTitle>
    <p style={{ fontSize: 12.5, color: "#93a39a", margin: "0 0 12px", lineHeight: 1.55 }}>
    {maxInclui[0]}<strong style={{ color: "#cfd8d2" }}>{t("pro.sobreMaxIncluiDestaque")}</strong>{maxInclui[1]}
    </p>
    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 22 }}>
    {MAX_EXTRA.map((v) => (
          <div key={v.tit} style={{ display: "flex", gap: 11, background: "#121815", border: `1px solid #24364a`, borderRadius: 14, padding: "13px 14px" }}>
          <div style={{ width: 26, height: 26, borderRadius: "50%", background: "rgba(127,184,245,0.14)", color: MAX, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, flexShrink: 0 }}>✓</div>
          <div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{t(v.tit)}</div>
          <div style={{ fontSize: 12.5, color: "#93a39a", marginTop: 2, lineHeight: 1.5 }}>{t(v.desc)}</div>
          </div>
          </div>
        ))}
    </div>
    <p style={{ fontSize: 11.5, color: "#7c8a82", lineHeight: 1.55, margin: "0 2px 22px" }}>
    {t("pro.notaClassicos")}
    </p>
    {/* O que o Pro NÃO faz — protege o jogo e a confiança */}
    <SectionTitle>{t("pro.sobreNaoFaz")}</SectionTitle>
    <div style={{ background: "#0f1411", border: "1px solid #243029", borderRadius: 16, padding: 16, marginBottom: 22 }}>
    <p style={{ fontSize: 13, color: "#c7d0c9", lineHeight: 1.6, margin: 0 }}>
    {naoFaz[0]}<strong style={{ color: "#cfd8d2" }}>{t("pro.sobreNaoFazA")}</strong>{naoFaz[1]}<strong style={{ color: "#cfd8d2" }}>{t("pro.sobreNaoFazB")}</strong>{naoFaz[2]}
    </p>
    </div>
    {/* Assinatura */}
    <SectionTitle>{t("pro.sobreAssinatura")}</SectionTitle>
    <div style={{ background: "#121815", border: "1px solid #243029", borderRadius: 16, padding: 16, marginBottom: 22 }}>
    <LinhaInfo titulo={t("pro.seteDiasGratis")} texto={t("pro.sobre7diasD")} />
    <LinhaInfo titulo={t("pro.sobreMensalT")} texto={t("pro.sobreMensalD")} />
    <LinhaInfo titulo={t("pro.sobreCancelarT")} texto={t("pro.sobreCancelarD")} ultimo />
    </div>
    {/* Transparência — o mais importante */}
    <SectionTitle>{t("pro.sobreTransparencia")}</SectionTitle>
    <div style={{ background: "#0f1411", border: `1px solid ${GOLD}`, borderRadius: 16, padding: "16px 16px 18px", marginBottom: 22 }}>
    <div style={{ display: "flex", gap: 11, alignItems: "flex-start", marginBottom: 10 }}>
    <div style={{ width: 40, height: 40, flexShrink: 0 }}><Mascot belt="#141110" expression="indicando" /></div>
    <p style={{ fontSize: 13.5, color: "#dfe6e0", lineHeight: 1.6, margin: 0 }}>{t("pro.sobreTransp1")}</p>
    </div>
    <p style={{ fontSize: 13, color: "#c7d0c9", lineHeight: 1.6, margin: "0 0 10px" }}>{transp2[0]}<strong>{t("pro.sobreTransp2Destaque")}</strong>{transp2[1]}</p>
    <p style={{ fontSize: 13, color: "#c7d0c9", lineHeight: 1.6, margin: 0 }}>{transp3[0]}<strong style={{ color: GOLD }}>{t("pro.sobreTransp3Destaque")}</strong>{transp3[1]}</p>
    </div>
    {/* Link discreto para vendas — só para quem NÃO é Pro */}
    {!isPro && (
        <>
        <a href="/ippon-pro" style={{ display: "block", textAlign: "center", background: GOLD, color: "#1b211e", fontFamily: FD, fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", padding: "13px", borderRadius: 12, textDecoration: "none" }}>
        {t("pro.sobreVerPro")} · {PRECO.atual}{t("precos.porMes")}
        </a>
        {/* A Stripe converte no checkout: quem está fora da zona euro lê euros
            aqui e vê a sua moeda ao pagar. */}
        <NotaMoeda />
        </>
      )}
    {isPro && (
        <div style={{ textAlign: "center", background: "#121815", border: `1px solid ${GOLD}`, borderRadius: 12, padding: "13px", fontSize: 13, color: GOLD, fontWeight: 700 }}>
        {t("pro.sobreEsMembro")} ★
        </div>
      )}
    </div>
    </main>
  );
}
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily: FD, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#93a39a", marginBottom: 10 }}>{children}</div>;
}
function LinhaInfo({ titulo, texto, ultimo }: { titulo: string; texto: string; ultimo?: boolean }) {
  return (
    <div style={{ borderBottom: ultimo ? "none" : "1px solid #1a221d", paddingBottom: ultimo ? 0 : 12, marginBottom: ultimo ? 0 : 12 }}>
    <div style={{ fontSize: 14, fontWeight: 700, color: GOLD, marginBottom: 2 }}>{titulo}</div>
    <p style={{ fontSize: 12.5, color: "#a9b4ac", lineHeight: 1.55, margin: 0 }}>{texto}</p>
    </div>
  );
}
