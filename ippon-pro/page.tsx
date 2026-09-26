"use client";
import { useEffect, useRef, useState } from "react";
import { Mascot } from "@/components/Mascot";
import { PRECO } from "@/lib/precos";
import { supabase } from "@/lib/supabase";
import { NotaMoeda } from "@/components/NotaMoeda";
import { useT, useLingua, type Lingua } from "@/lib/i18n";
import { track, aoTerConsentimento } from "@/lib/analytics";
const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";
const MAX = "#7fb8f5"; // tom do Pro Max, para o distinguir do Pro (dourado)

// Texto do consentimento no checkout — mapa por língua (mesmo padrão do resto
// da app para conteúdo multilíngue que não vive no dicionário global).
type TextoTermo = { antes: string; link: string; depois: string; erro: string };
const TERMO: Record<Lingua, TextoTermo> = {
  pt: { antes: "Li e aceito o ", link: "Termo de Entrega e Consentimento", depois: " do Ippon Pro.", erro: "Para continuares, marca que leste e aceitas o termo." },
  en: { antes: "I have read and accept the ", link: "Delivery and Consent Terms", depois: " of Ippon Pro.", erro: "To continue, please tick that you have read and accept the terms." },
  es: { antes: "He leído y acepto los ", link: "Términos de Entrega y Consentimiento", depois: " de Ippon Pro.", erro: "Para continuar, marca que has leído y aceptas los términos." },
  fr: { antes: "J'ai lu et j'accepte les ", link: "Conditions de livraison et de consentement", depois: " d'Ippon Pro.", erro: "Pour continuer, cochez que vous avez lu et accepté les conditions." },
  de: { antes: "Ich habe die ", link: "Liefer- und Einwilligungsbedingungen", depois: " von Ippon Pro gelesen und akzeptiere sie.", erro: "Um fortzufahren, bestätige, dass du die Bedingungen gelesen und akzeptiert hast." },
};
// Honestidade no momento de subscrever: o que acontece se um dia parares. Mapa
// local por língua (mesmo padrão do TERMO).
const AO_PARAR: Record<Lingua, { titulo: string; corpo: string }> = {
  pt: { titulo: "Enquanto Pro — e se um dia parares", corpo: "Enquanto és Pro, acumulas pontos nas ligas Mundial e Continental e podes disputar a Copa do Dôdo. Se deixares de ser Pro, essa pontuação zera e sais dessas ligas, sais da Copa em curso, e se tiveres mais ligas de amigos do que o limite gratuito terás de escolher quais manter. A tua conta, equipa e histórico ficam sempre guardados." },
  en: { titulo: "While Pro — and if you ever stop", corpo: "While you're Pro, you build up points in the World and Continental leagues and can play the Copa do Dôdo. If you stop being Pro, those points reset and you leave those leagues, you're out of any ongoing Copa, and if you have more friend leagues than the free limit you'll choose which to keep. Your account, team and history are always kept." },
  es: { titulo: "Mientras eres Pro — y si un día paras", corpo: "Mientras eres Pro, acumulas puntos en las ligas Mundial y Continental y puedes disputar la Copa do Dôdo. Si dejas de ser Pro, esa puntuación se pone a cero y sales de esas ligas, sales de la Copa en curso, y si tienes más ligas de amigos que el límite gratuito tendrás que elegir cuáles mantener. Tu cuenta, equipo e historial quedan siempre guardados." },
  fr: { titulo: "En tant que Pro — et si un jour tu arrêtes", corpo: "Tant que tu es Pro, tu accumules des points dans les ligues Mondiale et Continentale et tu peux disputer la Copa do Dôdo. Si tu cesses d'être Pro, ces points sont remis à zéro et tu sors de ces ligues, tu sors de la Copa en cours, et si tu as plus de ligues d'amis que la limite gratuite tu devras choisir lesquelles garder. Ton compte, ton équipe et ton historique sont toujours conservés." },
  de: { titulo: "Als Pro — und falls du irgendwann aufhörst", corpo: "Solange du Pro bist, sammelst du Punkte in der Welt- und Kontinentalliga und kannst die Copa do Dôdo spielen. Hörst du auf, Pro zu sein, werden diese Punkte auf null gesetzt und du verlässt diese Ligen, du bist raus aus einer laufenden Copa, und wenn du mehr Freundesligen als das Gratis-Limit hast, wählst du, welche du behältst. Dein Konto, Team und Verlauf bleiben immer erhalten." },
};
// LOJA DE JUDOCOINS na página do Pro. IMPORTANTE: os Judocoins NÃO são o Pro nem
// dão vantagem competitiva — são orçamento da temporada, à venda para todos. Esta
// nota deixa a distinção clara na página de venda do Pro (mapa local por língua).
const LOJA_PRO: Record<Lingua, { titulo: string; corpo: string; botao: string }> = {
  pt: { titulo: "Judocoins não são o Pro", corpo: "Os Judocoins são orçamento para montares a equipa — à venda para toda a gente, Pro ou não. Não dão pontos nem vantagem: só te deixam contratar os atletas que quiseres.", botao: "Ir à loja" },
  en: { titulo: "Judocoins aren't Pro", corpo: "Judocoins are budget to build your team — on sale to everyone, Pro or not. They give no points and no advantage: they just let you sign the athletes you want.", botao: "Go to store" },
  es: { titulo: "Los Judocoins no son el Pro", corpo: "Los Judocoins son presupuesto para montar tu equipo — a la venta para todos, Pro o no. No dan puntos ni ventaja: solo te dejan fichar a los atletas que quieras.", botao: "Ir a la tienda" },
  fr: { titulo: "Les Judocoins ne sont pas le Pro", corpo: "Les Judocoins sont du budget pour composer ton équipe — en vente pour tous, Pro ou non. Ils ne donnent ni points ni avantage : ils te laissent juste recruter les athlètes que tu veux.", botao: "Aller à la boutique" },
  de: { titulo: "Judocoins sind nicht Pro", corpo: "Judocoins sind Budget, um dein Team zu bauen — für alle erhältlich, Pro oder nicht. Sie geben keine Punkte und keinen Vorteil: sie lassen dich nur die gewünschten Athleten verpflichten.", botao: "Zum Shop" },
};
// O que cada nível dá. Princípio: só informação e ferramentas — nunca decidir o
// time pela pessoa, nunca prometer resultado. (Fase de testes: sem prémios.)
//
// CHAVE: o Pro vê o chaveamento no INÍCIO (quando sai) e no FIM (com resultados),
// e fica guardado até à competição seguinte. O Pro Max vê também o MEIO — a chave
// AO VIVO durante a competição — além dos extras.
//
// Estes arrays são avaliados no ARRANQUE do módulo, quando o `t` ainda não
// existe — por isso guardam CHAVES, não frases. A tradução acontece no render,
// com {t(chave)}. (Regra de estrutura do guião.)
const PRO: string[] = [
  // As duas primeiras são as que distinguem o Pro de uma ferramenta de consulta:
  // deixam de ser dados e passam a ser competição a sério.
  //
  // A LINGUAGEM AQUI É DELIBERADA. Nas ligas oficiais a pessoa CONCORRE, porque
  // basta ser Pro e escalar. Na Copa do Dôdo tem a POSSIBILIDADE de entrar,
  // porque as vagas são sorteadas — prometer participação a quem pode não ser
  // sorteado seria vender uma coisa que talvez não receba.
  "pro.bLigasOficiais",
  "pro.bCopa",
  "pro.bScout",
  "pro.bAnaliseTime",
  "pro.bCapitao",
  "pro.bValorizacao",
  "pro.bChaveamento",
  "pro.bAoVivo",
  "pro.b5Ligas",
  "pro.bDesign",
];
// O Pro Max TEM tudo o que o Pro tem, MAIS estes extras.
const MAX_EXTRA: string[] = [
  "pro.mChaveAoVivo",
  "pro.mAlerta",
  "pro.m10Ligas",
  "pro.mAnaliseChave",
  "pro.mGrupo",
  "pro.mLayout",
];
export default function IpponPro() {
  const t = useT();
  const { lingua } = useLingua();
  const [aEnviar, setAEnviar] = useState<"pro" | "promax" | null>(null);
  const [erro, setErro] = useState("");
  const [aceito, setAceito] = useState(false); // consentimento obrigatório

  // Analytics: viu a oferta. Espera pelo consentimento (como os eventos de
  // entrada) e conta uma vez só por montagem.
  const paywallContado = useRef(false);
  useEffect(() => {
    if (paywallContado.current) return;
    paywallContado.current = true;
    aoTerConsentimento(() => track("paywall_viewed", { pagina: "ippon-pro" }));
  }, []);
  // Abre o pagamento. O acesso NÃO é dado aqui nem no regresso: quem o dá é o
  // webhook, quando a Stripe confirmar que o dinheiro entrou. Isto limita-se a
  // levar a pessoa ao ecrã de pagamento.
  async function contratar(alvo: "pro" | "promax") {
    setErro("");
    if (!aceito) { setErro(TERMO[lingua].erro); return; } // sem aceitar, não avança
    setAEnviar(alvo);
    track("plan_selected", { plano: alvo }); // escolheu um plano
    try {
      const { data: sess } = await supabase.auth.getSession();
      const tok = sess.session?.access_token;
      if (!tok) {
        // Sem sessão não há a quem atribuir a subscrição. Manda entrar e volta.
        window.location.href = "/entrar?voltar=/ippon-pro";
        return;
      }
      const res = await fetch("/api/stripe/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
          body: JSON.stringify({ alvo }),
        });
      const j = await res.json();
      if (j?.ok && j.url) { track("checkout_started", { plano: alvo }); window.location.href = j.url; return; }
      setErro(j?.erro || t("pro.erroAbrirPagamento"));
    } catch {
      setErro(t("dd.falhaLigacao"));
    }
    setAEnviar(null);
  }
  // Frase com destaque a negrito no meio. Partir a frase em pedaços não sobrevive
  // à tradução (noutras línguas a ordem muda); por isso a frase inteira vive numa
  // chave, com o marcador %D% onde entra o negrito, e dividimos aqui.
  const partesHonesto = t("pro.honestoMontam").split("%D%");
  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: FB }}>
    <div style={{ maxWidth: 460, margin: "0 auto", padding: "14px 16px 40px" }}>
    <header style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 10 }}>
    <a href="/inicio" aria-label={t("comum.voltar")} style={{ width: 34, height: 34, borderRadius: "50%", border: "1px solid #243029", display: "flex", alignItems: "center", justifyContent: "center", color: "#cfd8d2", textDecoration: "none", flexShrink: 0 }}>
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
    </a>
    <h1 style={{ fontFamily: FD, fontSize: 19, fontWeight: 700, textTransform: "uppercase", margin: 0 }}>Ippon Pro</h1>
    </header>
    {/* Hero */}
    <div style={{ textAlign: "center", background: "linear-gradient(160deg,#1c3a2e,#10160f)", border: `1px solid ${GOLD}`, borderRadius: 18, padding: "20px 18px", marginBottom: 16 }}>
    <div style={{ width: 80, height: 80, margin: "0 auto 6px" }}><Mascot belt="#141110" expression="sabio" /></div>
    <div style={{ fontFamily: FD, fontSize: 23, fontWeight: 700, textTransform: "uppercase", lineHeight: 1.1 }}>{t("pro.heroTitulo")}</div>
    <p style={{ fontSize: 13.5, color: "#c7d0c9", lineHeight: 1.5, margin: "8px 0 0" }}>{PRECO.premios}. {t("pro.estrategiaTua")}</p>
    {PRECO.emPromocao && <div style={{ fontSize: 11.5, color: GOLD, marginTop: 8, fontWeight: 700 }}>{PRECO.etiqueta} · {PRECO.duracaoDesconto} · {t("pro.seteDiasGratis")}</div>}
    </div>
    {/* CARTÃO PRO */}
    <div style={{ background: "#121815", border: `1px solid ${GOLD}`, borderRadius: 18, padding: "18px 16px", marginBottom: 14 }}>
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4 }}>
    <span style={{ fontFamily: FD, fontSize: 20, fontWeight: 700, textTransform: "uppercase", color: GOLD }}>Pro</span>
    <span>
    {PRECO.emPromocao && <span style={{ fontSize: 14, color: "#7c8a82", textDecoration: "line-through", marginRight: 6 }}>{PRECO.normal}</span>}
    <span style={{ fontFamily: FD, fontSize: 26, fontWeight: 700, color: GOLD }}>{PRECO.atual}</span>
    <span style={{ fontSize: 12, color: "#93a39a" }}>{PRECO.periodo}</span>
    </span>
    </div>
    <p style={{ fontSize: 12, color: "#93a39a", margin: "0 0 12px" }}>{t("pro.proDesc")}</p>
    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
    {PRO.map((chave) => (
          <li key={chave} style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
          <span style={{ color: GOLD, fontWeight: 700, flexShrink: 0 }}>✓</span>
          <span style={{ fontSize: 13, color: "#dfe6e0", lineHeight: 1.45 }}>{t(chave)}</span>
          </li>
        ))}
    </ul>
    <button onClick={() => contratar("pro")} disabled={aEnviar !== null} style={{ width: "100%", marginTop: 16, background: GOLD, color: "#1b211e", border: "none", fontFamily: FD, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", padding: 13, borderRadius: 11, fontSize: 14, cursor: "pointer" }}>
    {aEnviar === "pro" ? t("precos.aAbrir") : `${t("precos.contratar", { plano: "Pro" })} · ${PRECO.atualComPeriodo}`}
    </button>
    </div>
    {/* CARTÃO PRO MAX — destacado (é o upsell) */}
    <div style={{ background: "linear-gradient(160deg,#16243a,#0d1116)", border: `1.5px solid ${MAX}`, borderRadius: 18, padding: "18px 16px", marginBottom: 18, position: "relative" }}>
    <div style={{ position: "absolute", top: -10, left: 16, background: MAX, color: "#0b1220", fontFamily: FD, fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", padding: "3px 10px", borderRadius: 6 }}>{t("pro.maisCompleto")}</div>
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4, marginTop: 4 }}>
    <span style={{ fontFamily: FD, fontSize: 20, fontWeight: 700, textTransform: "uppercase", color: MAX }}>Pro Max</span>
    <span>
    {PRECO.emPromocao && <span style={{ fontSize: 14, color: "#7c8a82", textDecoration: "line-through", marginRight: 6 }}>{PRECO.maxNormal}</span>}
    <span style={{ fontFamily: FD, fontSize: 26, fontWeight: 700, color: MAX }}>{PRECO.maxAtual}</span>
    <span style={{ fontSize: 12, color: "#93a39a" }}>{PRECO.periodo}</span>
    </span>
    </div>
    <p style={{ fontSize: 12, color: "#9fb3cc", margin: "0 0 12px" }}>{t("pro.maxDesc")}</p>
    {/* Linha "tudo o que o Pro tem" */}
    <div style={{ display: "flex", gap: 9, alignItems: "center", background: "rgba(127,184,245,0.08)", border: "1px solid #24364a", borderRadius: 10, padding: "9px 11px", marginBottom: 12 }}>
    <span style={{ color: MAX, fontWeight: 700 }}>★</span>
    <span style={{ fontSize: 12.5, color: "#dfe6e0", fontWeight: 700 }}>{t("pro.tudoDoProInclui")}</span>
    </div>
    {/* Extras do Max */}
    <div style={{ fontSize: 11, color: "#9fb3cc", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700, marginBottom: 8 }}>{t("pro.eAindaSoMax")}</div>
    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
    {MAX_EXTRA.map((chave) => (
          <li key={chave} style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
          <span style={{ color: MAX, fontWeight: 700, flexShrink: 0 }}>✓</span>
          <span style={{ fontSize: 13, color: "#eaf1f8", lineHeight: 1.45 }}>{t(chave)}</span>
          </li>
        ))}
    </ul>
    <button onClick={() => contratar("promax")} disabled={aEnviar !== null} style={{ width: "100%", marginTop: 16, background: MAX, color: "#0b1220", border: "none", fontFamily: FD, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", padding: 13, borderRadius: 11, fontSize: 14, cursor: "pointer" }}>
    {aEnviar === "promax" ? t("precos.aAbrir") : `${t("precos.contratar", { plano: "Pro Max" })} · ${PRECO.maxAtualComPeriodo}`}
    </button>
    </div>
    {/* Um aviso só, por baixo dos dois cartões: a Stripe converte no checkout
        (Adaptive Pricing), por isso quem está fora da zona euro lê euros aqui
        e vê a sua moeda ao pagar. */}
    {/* Honestidade: o que acontece se um dia parares (ligas oficiais, Copa, ligas de amigos). */}
    <div style={{ background: "#0f1411", border: "1px solid #243029", borderRadius: 14, padding: "13px 14px", marginBottom: 16 }}>
    <div style={{ fontFamily: FD, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "#a9b4ac", marginBottom: 6 }}>{AO_PARAR[lingua].titulo}</div>
    <div style={{ fontSize: 12, color: "#7c8a82", lineHeight: 1.55 }}>{AO_PARAR[lingua].corpo}</div>
    </div>
    {/* CONSENTIMENTO obrigatório antes de assinar (aplica-se aos dois planos). */}
    <label style={{ display: "flex", gap: 9, alignItems: "flex-start", cursor: "pointer", margin: "0 0 14px", fontSize: 12.5, color: "#a9b4ac", lineHeight: 1.5 }}>
    <input type="checkbox" checked={aceito} onChange={(e) => { setAceito(e.target.checked); if (e.target.checked) setErro(""); }} style={{ marginTop: 2, width: 16, height: 16, accentColor: GOLD, flexShrink: 0 }} />
    <span>{TERMO[lingua].antes}<a href="/termos-pro" target="_blank" rel="noopener noreferrer" style={{ color: GOLD, textDecoration: "underline" }}>{TERMO[lingua].link}</a>{TERMO[lingua].depois}</span>
    </label>
    <NotaMoeda style={{ marginBottom: 16 }} />
    {/* Nota honesta: o que o Pro NÃO faz */}
    <div style={{ background: "#0f1411", border: "1px solid #243029", borderRadius: 14, padding: "13px 14px", marginBottom: 16 }}>
    <div style={{ fontSize: 12.5, color: "#a9b4ac", lineHeight: 1.6 }}>
    {partesHonesto[0]}<strong style={{ color: "#cfd8d2" }}>{t("pro.honestoMontamDestaque")}</strong>{partesHonesto[1]}
    </div>
    <div style={{ fontSize: 11.5, color: "#7c8a82", lineHeight: 1.55, marginTop: 10 }}>
    {t("pro.notaClassicos")}
    </div>
    {/* Sobre os prémios: dito à frente e sem letra pequena. Prometer um
      prémio concreto numa página de vendas obriga a entregá-lo, e os
      prémios dependem de patrocinadores que mudam de época para época.
      O que se promete é o direito a concorrer — isso sim é sempre certo. */}
    <div style={{ fontSize: 11.5, color: "#7c8a82", lineHeight: 1.55, marginTop: 10 }}>
    {t("pro.notaPremios")}
    </div>
    {/* A Copa é sorteio, e isso não pode ficar escondido numa linha só. */}
    <div style={{ fontSize: 11.5, color: "#7c8a82", lineHeight: 1.55, marginTop: 10 }}>
    {t("pro.notaCopaSorteio")}
    </div>
    </div>
    {/* Loja de Judocoins — orçamento, NÃO é o Pro (sem vantagem competitiva). */}
    <a href="/loja" style={{ display: "flex", alignItems: "flex-start", gap: 11, background: "#0f1411", border: `1px solid ${GOLD}`, borderRadius: 14, padding: "13px 14px", marginBottom: 16, textDecoration: "none" }}>
    <span style={{ width: 30, height: 30, borderRadius: "50%", background: GOLD, color: "#1b211e", fontFamily: FD, fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>JC</span>
    <span style={{ flex: 1, minWidth: 0 }}>
    <span style={{ display: "block", fontFamily: FD, fontSize: 13, fontWeight: 700, color: "#f1ede2", textTransform: "uppercase" }}>{LOJA_PRO[lingua]?.titulo ?? LOJA_PRO.pt.titulo}</span>
    <span style={{ display: "block", fontSize: 12, color: "#a9b4ac", lineHeight: 1.55, marginTop: 4 }}>{LOJA_PRO[lingua]?.corpo ?? LOJA_PRO.pt.corpo}</span>
    <span style={{ display: "inline-block", marginTop: 9, color: GOLD, fontFamily: FD, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em" }}>{LOJA_PRO[lingua]?.botao ?? LOJA_PRO.pt.botao} ›</span>
    </span>
    </a>
    <div style={{ fontSize: 12, color: "#7c8a82", textAlign: "center", lineHeight: 1.5 }}>
    {erro && <span style={{ display: "block", color: "#ef8d83", marginBottom: 8 }}>{erro}</span>}
    {t("pro.rodape")} · {PRECO.etiqueta.toLowerCase()} ({PRECO.duracaoDesconto}). 🥋
    </div>
    </div>
    </main>
  );
}
