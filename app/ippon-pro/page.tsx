"use client";
import { useState } from "react";
import { Mascot } from "@/components/Mascot";
import { PRECO } from "@/lib/precos";
import { supabase } from "@/lib/supabase";
import { NotaMoeda } from "@/components/NotaMoeda";
const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";
const MAX = "#7fb8f5"; // tom do Pro Max, para o distinguir do Pro (dourado)
// O que cada nível dá. Princípio: só informação e ferramentas — nunca decidir o
// time pela pessoa, nunca prometer resultado. (Fase de testes: sem prémios.)
//
// CHAVE: o Pro vê o chaveamento no INÍCIO (quando sai) e no FIM (com resultados),
// e fica guardado até à competição seguinte. O Pro Max vê também o MEIO — a chave
// AO VIVO durante a competição — além dos extras.
const PRO: string[] = [
  // As duas primeiras são as que distinguem o Pro de uma ferramenta de consulta:
  // deixam de ser dados e passam a ser competição a sério.
  //
  // A LINGUAGEM AQUI É DELIBERADA. Nas ligas oficiais a pessoa CONCORRE, porque
  // basta ser Pro e escalar. Na Copa do Dôdo tem a POSSIBILIDADE de entrar,
  // porque as vagas são sorteadas — prometer participação a quem pode não ser
  // sorteado seria vender uma coisa que talvez não receba.
  "Concorres aos prémios das ligas oficiais Mundial e Continental (o ranking é visível para todos, mas só membros Pro concorrem)",
  "Podes inscrever-te na Copa do Dôdo, o mata-mata mundial entre continentes — a entrada é por sorteio entre os inscritos",
  "Scout avançado dos atletas (histórico, forma e como pontuam)",
  "Análise do teu time — o que é forte e onde está o risco",
  "Dica de capitão entre os atletas que tu escolheste",
  "Maior possibilidade de valorização (tendência, não garantia)",
  "Chaveamento da competição — vês a chave quando sai e no fim, com resultados",
  "Acompanhamento ao vivo das pontuações dos teus atletas",
  "Até 5 ligas ativas (mata-mata e pontos corridos)",
  "Design exclusivo Pro",
];
// O Pro Max TEM tudo o que o Pro tem, MAIS estes extras.
const MAX_EXTRA: string[] = [
  "Chave AO VIVO — acompanha a chave a decorrer em tempo real, nas principais competições do circuito mundial",
  "Alerta dos teus atletas favoritos — avisamos quando o teu atleta é o próximo a lutar",
  "Até 10 ligas e copas (o dobro do Pro)",
  "Análise da chave — os atletas com mais hipótese de pontuar muito ou ser campeão, nas principais competições do circuito mundial",
  "Grupo exclusivo (WhatsApp/Telegram) — informação da rodada e conversa com outros Pro Max",
  "Layout e visual exclusivos Pro Max",
];
export default function IpponPro() {
  const [aEnviar, setAEnviar] = useState<"pro" | "promax" | null>(null);
  const [erro, setErro] = useState("");
  // Abre o pagamento. O acesso NÃO é dado aqui nem no regresso: quem o dá é o
  // webhook, quando a Stripe confirmar que o dinheiro entrou. Isto limita-se a
  // levar a pessoa ao ecrã de pagamento.
  async function contratar(alvo: "pro" | "promax") {
    setErro("");
    setAEnviar(alvo);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const t = sess.session?.access_token;
      if (!t) {
        // Sem sessão não há a quem atribuir a subscrição. Manda entrar e volta.
        window.location.href = "/entrar?voltar=/ippon-pro";
        return;
      }
      const res = await fetch("/api/stripe/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
          body: JSON.stringify({ alvo }),
        });
      const j = await res.json();
      if (j?.ok && j.url) { window.location.href = j.url; return; }
      setErro(j?.erro || "Não foi possível abrir o pagamento.");
    } catch {
      setErro("Falha de ligação. Tenta outra vez.");
    }
    setAEnviar(null);
  }
  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: FB }}>
    <div style={{ maxWidth: 460, margin: "0 auto", padding: "14px 16px 40px" }}>
    <header style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 10 }}>
    <a href="/inicio" aria-label="Voltar" style={{ width: 34, height: 34, borderRadius: "50%", border: "1px solid #243029", display: "flex", alignItems: "center", justifyContent: "center", color: "#cfd8d2", textDecoration: "none", flexShrink: 0 }}>
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
    </a>
    <h1 style={{ fontFamily: FD, fontSize: 19, fontWeight: 700, textTransform: "uppercase", margin: 0 }}>Ippon Pro</h1>
    </header>
    {/* Hero */}
    <div style={{ textAlign: "center", background: "linear-gradient(160deg,#1c3a2e,#10160f)", border: `1px solid ${GOLD}`, borderRadius: 18, padding: "20px 18px", marginBottom: 16 }}>
    <div style={{ width: 80, height: 80, margin: "0 auto 6px" }}><Mascot belt="#141110" expression="sabio" /></div>
    <div style={{ fontFamily: FD, fontSize: 23, fontWeight: 700, textTransform: "uppercase", lineHeight: 1.1 }}>Joga com vantagem</div>
    <p style={{ fontSize: 13.5, color: "#c7d0c9", lineHeight: 1.5, margin: "8px 0 0" }}>{PRECO.premios}. A estratégia é sempre tua.</p>
    {PRECO.emPromocao && <div style={{ fontSize: 11.5, color: GOLD, marginTop: 8, fontWeight: 700 }}>{PRECO.etiqueta} · {PRECO.duracaoDesconto} · 7 dias grátis</div>}
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
    <p style={{ fontSize: 12, color: "#93a39a", margin: "0 0 12px" }}>Ferramentas de informação para jogares com mais conhecimento.</p>
    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
    {PRO.map((t) => (
          <li key={t} style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
          <span style={{ color: GOLD, fontWeight: 700, flexShrink: 0 }}>✓</span>
          <span style={{ fontSize: 13, color: "#dfe6e0", lineHeight: 1.45 }}>{t}</span>
          </li>
        ))}
    </ul>
    <button onClick={() => contratar("pro")} disabled={aEnviar !== null} style={{ width: "100%", marginTop: 16, background: GOLD, color: "#1b211e", border: "none", fontFamily: FD, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", padding: 13, borderRadius: 11, fontSize: 14, cursor: "pointer" }}>
    {aEnviar === "pro" ? "A abrir…" : `Contratar Pro · ${PRECO.atualComPeriodo}`}
    </button>
    </div>
    {/* CARTÃO PRO MAX — destacado (é o upsell) */}
    <div style={{ background: "linear-gradient(160deg,#16243a,#0d1116)", border: `1.5px solid ${MAX}`, borderRadius: 18, padding: "18px 16px", marginBottom: 18, position: "relative" }}>
    <div style={{ position: "absolute", top: -10, left: 16, background: MAX, color: "#0b1220", fontFamily: FD, fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", padding: "3px 10px", borderRadius: 6 }}>Mais completo</div>
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4, marginTop: 4 }}>
    <span style={{ fontFamily: FD, fontSize: 20, fontWeight: 700, textTransform: "uppercase", color: MAX }}>Pro Max</span>
    <span>
    {PRECO.emPromocao && <span style={{ fontSize: 14, color: "#7c8a82", textDecoration: "line-through", marginRight: 6 }}>{PRECO.maxNormal}</span>}
    <span style={{ fontFamily: FD, fontSize: 26, fontWeight: 700, color: MAX }}>{PRECO.maxAtual}</span>
    <span style={{ fontSize: 12, color: "#93a39a" }}>{PRECO.periodo}</span>
    </span>
    </div>
    <p style={{ fontSize: 12, color: "#9fb3cc", margin: "0 0 12px" }}>Tudo o que o Pro tem — e ainda acompanhas a competição ao vivo, com mais ligas e análise da chave.</p>
    {/* Linha "tudo o que o Pro tem" */}
    <div style={{ display: "flex", gap: 9, alignItems: "center", background: "rgba(127,184,245,0.08)", border: "1px solid #24364a", borderRadius: 10, padding: "9px 11px", marginBottom: 12 }}>
    <span style={{ color: MAX, fontWeight: 700 }}>★</span>
    <span style={{ fontSize: 12.5, color: "#dfe6e0", fontWeight: 700 }}>Tudo o que o Pro inclui</span>
    </div>
    {/* Extras do Max */}
    <div style={{ fontSize: 11, color: "#9fb3cc", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700, marginBottom: 8 }}>E ainda, só no Pro Max:</div>
    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
    {MAX_EXTRA.map((t) => (
          <li key={t} style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
          <span style={{ color: MAX, fontWeight: 700, flexShrink: 0 }}>✓</span>
          <span style={{ fontSize: 13, color: "#eaf1f8", lineHeight: 1.45 }}>{t}</span>
          </li>
        ))}
    </ul>
    <button onClick={() => contratar("promax")} disabled={aEnviar !== null} style={{ width: "100%", marginTop: 16, background: MAX, color: "#0b1220", border: "none", fontFamily: FD, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", padding: 13, borderRadius: 11, fontSize: 14, cursor: "pointer" }}>
    {aEnviar === "promax" ? "A abrir…" : `Contratar Pro Max · ${PRECO.maxAtualComPeriodo}`}
    </button>
    </div>
    {/* Um aviso só, por baixo dos dois cartões: a Stripe converte no checkout
        (Adaptive Pricing), por isso quem está fora da zona euro lê euros aqui
        e vê a sua moeda ao pagar. */}
    <NotaMoeda style={{ marginBottom: 16 }} />
    {/* Nota honesta: o que o Pro NÃO faz */}
    <div style={{ background: "#0f1411", border: "1px solid #243029", borderRadius: 14, padding: "13px 14px", marginBottom: 16 }}>
    <div style={{ fontSize: 12.5, color: "#a9b4ac", lineHeight: 1.6 }}>
    Nem o Pro nem o Pro Max <strong style={{ color: "#cfd8d2" }}>montam o teu time por ti</strong> ou te dizem quem vai ganhar. Dão-te informação e leituras do histórico — a graça de acertar continua a ser tua.
    </div>
    <div style={{ fontSize: 11.5, color: "#7c8a82", lineHeight: 1.55, marginTop: 10 }}>
    Os Clássicos (competições do passado) não têm chave ao vivo nem análise, por já terem acontecido.
    </div>
    {/* Sobre os prémios: dito à frente e sem letra pequena. Prometer um
      prémio concreto numa página de vendas obriga a entregá-lo, e os
      prémios dependem de patrocinadores que mudam de época para época.
      O que se promete é o direito a concorrer — isso sim é sempre certo. */}
    <div style={{ fontSize: 11.5, color: "#7c8a82", lineHeight: 1.55, marginTop: 10 }}>
    Os prémios são definidos a cada temporada e podem variar — de produtos e equipamento a experiências no mundo do judo. O que a subscrição garante é o direito a concorrer.
    </div>
    {/* A Copa é sorteio, e isso não pode ficar escondido numa linha só. */}
    <div style={{ fontSize: 11.5, color: "#7c8a82", lineHeight: 1.55, marginTop: 10 }}>
    Na Copa do Dôdo há 32 lugares e a entrada é sorteada entre os inscritos de cada continente. Ser Pro dá-te o direito de te inscreveres, não a garantia de saíres sorteado.
    </div>
    </div>
    <div style={{ fontSize: 12, color: "#7c8a82", textAlign: "center", lineHeight: 1.5 }}>
    {erro && <span style={{ display: "block", color: "#ef8d83", marginBottom: 8 }}>{erro}</span>}
    Sem anúncios · subscrição mensal, cancelas quando quiseres · {PRECO.etiqueta.toLowerCase()} ({PRECO.duracaoDesconto}). 🥋
    </div>
    </div>
    </main>
  );
}
