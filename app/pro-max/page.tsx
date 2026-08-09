"use client";
import { useState } from "react";
import { Mascot } from "@/components/Mascot";
import { PRECO } from "@/lib/precos";
import { supabase } from "@/lib/supabase";
import { useNivel } from "@/lib/useNivel";
import { NotaMoeda } from "@/components/NotaMoeda";
const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const MAX = "#7fb8f5"; // tom do Pro Max
// Página dedicada SÓ ao Pro Max. Quem chega aqui já é Pro (vem da central /pro),
// por isso falamos só do upgrade — não repetimos o cartão do Pro. Mostra o preço
// de UPGRADE (parte Max), que para quem já é Pro é +2,90€/mês em promoção.
//
// NOTA (fase de testes): sem prémios; o botão não cobra — alerta "em breve".
const EXTRAS: { t: string; x: string }[] = [
  { t: "Chave ao vivo", x: "Acompanha o chaveamento a decorrer em tempo real, durante a competição. Vês as pontuações e o caminho dos atletas enquanto as lutas acontecem. Disponível nas competições de topo: Mundial, Grand Slam, Grand Prix, Masters e Olimpíadas." },
  { t: "Alerta dos teus favoritos", x: "Avisamos-te quando um atleta que segues é o próximo a entrar no tatame, para não perderes nenhuma luta importante." },
  { t: "Até 10 ligas e copas", x: "O dobro do Pro: cria e joga em até 10 ligas e copas em simultâneo, entre mata-mata e pontos corridos." },
  { t: "Análise da chave", x: "Quando o chaveamento sai, mostramos quais atletas têm mais hipótese de pontuar muito ou chegar longe, com base nos confrontos prováveis e no caminho de cada um na chave. Disponível nas competições de topo: Mundial, Grand Slam, Grand Prix, Masters e Olimpíadas." },
  { t: "Grupo exclusivo", x: "Acesso ao grupo de WhatsApp/Telegram só para membros Pro Max — informação da rodada e conversa com outros jogadores." },
  { t: "Layout e visual exclusivos", x: "Um aspeto próprio e distinto, reservado a quem é Pro Max." },
];
export default function ProMax() {
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
      const t = sess.session?.access_token;
      if (!t) { window.location.href = "/entrar?voltar=/pro-max"; return; }
      const res = await fetch("/api/stripe/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
          body: JSON.stringify({ alvo: "subida" }),
        });
      const j = await res.json();
      // Subida imediata, sem cobrança: recarrega para o nível novo aparecer.
      if (j?.ok && j.imediato) { window.location.href = "/perfil?pagamento=ok"; return; }
      if (j?.ok && j.url) { window.location.href = j.url; return; }
      setErro(j?.erro || "Não foi possível abrir o pagamento.");
    } catch {
      setErro("Falha de ligação. Tenta outra vez.");
    }
    setAEnviar(false);
  }
  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: FB }}>
    <div style={{ maxWidth: 460, margin: "0 auto", padding: "14px 16px 130px" }}>
    <header style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 10 }}>
    <a href="/pro" aria-label="Voltar" style={{ width: 34, height: 34, borderRadius: "50%", border: "1px solid #243029", display: "flex", alignItems: "center", justifyContent: "center", color: "#cfd8d2", textDecoration: "none", flexShrink: 0 }}>
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
    </a>
    <h1 style={{ fontFamily: FD, fontSize: 19, fontWeight: 700, textTransform: "uppercase", margin: 0 }}>Ippon Pro Max</h1>
    </header>
    {/* Hero */}
    <div style={{ textAlign: "center", background: "linear-gradient(160deg,#16243a,#0d1116)", border: `1.5px solid ${MAX}`, borderRadius: 18, padding: "22px 18px", marginBottom: 16 }}>
    <div style={{ width: 88, height: 88, margin: "0 auto 6px" }}><Mascot belt="#141110" expression="comemorando" /></div>
    <div style={{ fontFamily: FD, fontSize: 24, fontWeight: 700, textTransform: "uppercase", lineHeight: 1.1, color: MAX }}>Sobe para Pro Max</div>
    <p style={{ fontSize: 14, color: "#9fb3cc", lineHeight: 1.5, margin: "8px 0 12px" }}>Já és Pro. O Pro Max dá-te tudo o que já tens — e ainda acompanhas a competição ao vivo, com mais ligas, análise da chave e grupo exclusivo.</p>
    <div>
    <span style={{ fontFamily: FD, fontSize: 34, fontWeight: 700, color: MAX }}>{PRECO.upgradeAtual}</span>
    <span style={{ fontSize: 13, color: "#93a39a" }}>{PRECO.periodo}</span>
    </div>
    <div style={{ fontSize: 12, color: "#9fb3cc", marginTop: 2 }}>a mais sobre o teu Pro</div>
    {PRECO.emPromocao && <div style={{ fontSize: 11, color: MAX, marginTop: 6, fontWeight: 700 }}>{PRECO.etiqueta} · {PRECO.duracaoDesconto}</div>}
    {/* A Stripe converte no checkout (Adaptive Pricing). Sem este aviso, quem
        está fora da zona euro lê um valor aqui e vê outro ao pagar. */}
    <NotaMoeda />
    </div>
    {/* Extras do Pro Max */}
    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
    {EXTRAS.map((b) => (
          <div key={b.t} style={{ display: "flex", gap: 11, background: "#121815", border: "1px solid #243029", borderRadius: 14, padding: "13px 14px" }}>
          <div style={{ width: 26, height: 26, borderRadius: "50%", background: "rgba(127,184,245,0.14)", color: MAX, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, flexShrink: 0 }}>✓</div>
          <div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{b.t}</div>
          <div style={{ fontSize: 12, color: "#93a39a", marginTop: 2, lineHeight: 1.5 }}>{b.x}</div>
          </div>
          </div>
        ))}
    </div>
    {/* Nota honesta */}
    <div style={{ background: "#0f1411", border: "1px solid #243029", borderRadius: 14, padding: "13px 14px", marginBottom: 16 }}>
    <div style={{ fontSize: 12.5, color: "#a9b4ac", lineHeight: 1.6 }}>
    O Pro Max <strong style={{ color: "#cfd8d2" }}>não monta o teu time por ti</strong> nem te diz quem vai ganhar. Dá-te mais informação e mais formas de competir — a graça de acertar continua a ser tua.
    </div>
    <div style={{ fontSize: 11.5, color: "#7c8a82", lineHeight: 1.55, marginTop: 10 }}>
    Os Clássicos (competições do passado) não têm chave ao vivo nem análise, por já terem acontecido.
    </div>
    </div>
    </div>
    {/* Barra fixa de assinatura */}
    <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, background: "#0d1116", borderTop: `1px solid #24364a`, padding: "12px 16px" }}>
    <div style={{ maxWidth: 460, margin: "0 auto" }}>
    {erro && <div style={{ fontSize: 12, color: "#ef8d83", marginBottom: 8, textAlign: "center" }}>{erro}</div>}
    {ehProMax ? (
        <a href="/pro-max-central" style={{ display: "block", textAlign: "center", background: MAX, color: "#0b1220", fontFamily: FD, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", padding: 15, borderRadius: 12, fontSize: 16, textDecoration: "none" }}>
        Já és Pro Max · abrir a tua área
        </a>
      ) : ehPro ? (
        <button onClick={subir} disabled={aEnviar} style={{ width: "100%", background: MAX, color: "#0b1220", border: "none", fontFamily: FD, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", padding: 15, borderRadius: 12, fontSize: 16, cursor: aEnviar ? "default" : "pointer", opacity: aEnviar ? 0.7 : 1 }}>
        {aEnviar ? "A abrir…" : `Quero o Pro Max · ${PRECO.upgradeAtualComPeriodo}`}
        </button>
      ) : (
        // Sem Pro não há subida: esta página fala de um upgrade que não se
        // aplica. Manda-se para os planos, onde o Pro Max se compra direto.
        <a href="/ippon-pro" style={{ display: "block", textAlign: "center", background: MAX, color: "#0b1220", fontFamily: FD, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", padding: 15, borderRadius: 12, fontSize: 16, textDecoration: "none" }}>
        Ver os planos
        </a>
      )}
    {/* A taxa única não pode ficar escondida: quem sobe fora dos 7 dias
      paga-a além da diferença mensal, e descobrir isso só no ecrã de
      pagamento é a receita para desistir a meio. */}
    {ehPro && !ehProMax && (
        <div style={{ fontSize: 11, color: "#7c8a82", textAlign: "center", marginTop: 8, lineHeight: 1.5 }}>
        Nos primeiros 7 dias a subida não tem custo extra. Depois disso, tem uma taxa única de {PRECO.subidaTaxa}.
        </div>
      )}
    <a href="/pro" style={{ display: "block", textAlign: "center", marginTop: 8, color: "#93a39a", fontSize: 12, textDecoration: "none", fontFamily: FB }}>Agora não</a>
    </div>
    </div>
    </main>
  );
}
