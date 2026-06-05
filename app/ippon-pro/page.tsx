"use client";

import { Mascot } from "@/components/Mascot";

const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";

const BENEFITS: { t: string; x: string }[] = [
  { t: "Chave ao vivo", x: "Acompanha cada atleta na competição: adversário, fase, repescagem e resultado." },
  { t: "Alertas ao vivo", x: "Recebe um aviso quando o teu atleta — ou o teu capitão — vai lutar. Não percas nada." },
  { t: "Scout avançado", x: "Vê o histórico completo, tendências e estatísticas de cada atleta." },
  { t: "Valorização esperada", x: "Sabe quanto um atleta pode valorizar antes de escalares." },
  { t: "Mínimo para valorizar", x: "Descobre o que o atleta precisa de fazer para ganhares JC." },
  { t: "Dicas e capitães da rodada", x: "Sugestões de quem escalar e em quem apostar a braçadeira." },
  { t: "Barganhas da rodada", x: "Atletas subvalorizados com boa probabilidade de render." },
  { t: "Ligas e badges exclusivos", x: "Distinções e ligas só para membros Ippon Pro." },
];

export default function IpponPro() {
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
        <div style={{ textAlign: "center", background: "linear-gradient(160deg,#1c3a2e,#10160f)", border: `1px solid ${GOLD}`, borderRadius: 18, padding: "22px 18px", marginBottom: 16 }}>
          <div style={{ width: 92, height: 92, margin: "0 auto 6px" }}><Mascot belt="#141110" expression="sabio" /></div>
          <div style={{ fontFamily: FD, fontSize: 24, fontWeight: 700, textTransform: "uppercase", lineHeight: 1.1 }}>Joga com vantagem</div>
          <p style={{ fontSize: 14, color: "#c7d0c9", lineHeight: 1.5, margin: "8px 0 14px" }}>Descobre atletas subvalorizados, vê a valorização esperada e recebe as dicas da rodada antes de escalares.</p>
          <div>
            <span style={{ fontSize: 15, color: "#7c8a82", textDecoration: "line-through" }}>9,90€</span>{" "}
            <span style={{ fontFamily: FD, fontSize: 36, fontWeight: 700, color: GOLD }}>4,90€</span>
            <span style={{ fontSize: 13, color: "#93a39a" }}>/mês</span>
          </div>
          <div style={{ fontSize: 11, color: GOLD, marginTop: 2 }}>Oferta de lançamento · cancela quando quiseres</div>
        </div>

        {/* Benefícios */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
          {BENEFITS.map((b) => (
            <div key={b.t} style={{ display: "flex", gap: 11, background: "#121815", border: "1px solid #243029", borderRadius: 14, padding: "13px 14px" }}>
              <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#3a2f12", color: GOLD, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, flexShrink: 0 }}>✓</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{b.t}</div>
                <div style={{ fontSize: 12, color: "#93a39a", marginTop: 2, lineHeight: 1.45 }}>{b.x}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 12, color: "#7c8a82", textAlign: "center", marginBottom: 14, lineHeight: 1.5 }}>
          Sem anúncios · prioridade em sorteios e experiências · apoia o crescimento da Ippon League. 🥋
        </div>
      </div>

      {/* Barra fixa de assinatura */}
      <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, background: "#0f1411", borderTop: "1px solid #243029", padding: "12px 16px" }}>
        <div style={{ maxWidth: 460, margin: "0 auto" }}>
          <button onClick={() => alert("Pagamento em breve! Estamos a preparar o Ippon Pro.")} style={{ width: "100%", background: GOLD, color: "#1b211e", border: "none", fontFamily: FD, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", padding: 15, borderRadius: 12, fontSize: 16, cursor: "pointer" }}>
            Assinar por 4,90€/mês
          </button>
          <a href="/inicio" style={{ display: "block", textAlign: "center", marginTop: 8, color: "#93a39a", fontSize: 12, textDecoration: "none", fontFamily: FB }}>Agora não</a>
        </div>
      </div>
    </main>
  );
}
