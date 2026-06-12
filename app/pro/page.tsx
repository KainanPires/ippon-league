"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Mascot } from "@/components/Mascot";
import { supabase } from "@/lib/supabase";
import { loadSavedCloudFor, setAthletePool, type TeamState } from "@/lib/team";
import { focoMercado } from "@/lib/calendario";
import { analisarTime, type AnaliseTime } from "@/lib/analiseTime";

const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";

// Vantagens do Pro que ainda vamos construir (aparecem como "a chegar").
const A_CHEGAR: { t: string; x: string }[] = [
  { t: "Scout avançado", x: "Histórico completo e tendências de cada atleta." },
  { t: "Recomendações da rodada", x: "Possíveis campeões e maiores pontuadores, a partir do chaveamento." },
  { t: "Chaveamento das competições", x: "As chaves de cada competição e o caminho dos teus atletas." },
  { t: "Dicas e capitães da rodada", x: "Sugestões para te ajudar a decidir." },
];

export default function DashboardPro() {
  const router = useRouter();
  const [estado, setEstado] = useState<"carregando" | "naoPro" | "pro">("carregando");
  const [nome, setNome] = useState("Campeão");
  const [analise, setAnalise] = useState<AnaliseTime | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      const u = data.session?.user;
      const m = u?.user_metadata || {};
      const isPro = Boolean(m.is_pro);
      setNome(String(m.nome || "").trim().split(" ")[0] || "Campeão");

      if (!isPro) {
        // Saída 1: quem não é Pro vai para a página de vendas.
        router.replace("/ippon-pro");
        return;
      }
      setEstado("pro");

      // Saída 2 (Pro): carrega a equipa atual e analisa-a.
      const foco = focoMercado();
      const idComp = (foco.aDecorrer ?? foco.alvo).idCompeticao;
      try {
        const j = await fetch(`/api/atletas?id=${idComp}`).then((r) => r.json());
        const list = Array.isArray(j?.atletas) ? j.atletas : [];
        if (list.length > 0) setAthletePool(list as never);
      } catch {}
      const team: TeamState | null = await loadSavedCloudFor(idComp);
      if (!active) return;
      if (team && team.ids.length > 0) setAnalise(analisarTime(team));
      else setAnalise(null);
    })();
    return () => { active = false; };
  }, [router]);

  if (estado === "carregando") {
    return (
      <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: FB, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#7c8a82", fontSize: 14 }}>A carregar…</p>
      </main>
    );
  }
  if (estado === "naoPro") return null; // já redirecionou

  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: FB }}>
      <div style={{ maxWidth: 460, margin: "0 auto", padding: "14px 16px 48px" }}>
        {/* Cabeçalho */}
        <header style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 16 }}>
          <a href="/inicio" aria-label="Voltar" style={{ width: 34, height: 34, borderRadius: "50%", border: "1px solid #243029", display: "flex", alignItems: "center", justifyContent: "center", color: "#cfd8d2", textDecoration: "none", flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
          </a>
          <h1 style={{ fontFamily: FD, fontSize: 18, fontWeight: 700, textTransform: "uppercase", margin: 0 }}>A minha central Pro</h1>
        </header>

        {/* Boas-vindas Pro */}
        <section style={{ textAlign: "center", background: "linear-gradient(160deg,#2a2410,#15110a)", border: `1px solid ${GOLD}`, borderRadius: 18, padding: "20px 18px", marginBottom: 18 }}>
          <div style={{ width: 72, height: 72, margin: "0 auto 6px" }}><Mascot belt="#141110" expression="comemorando" /></div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: GOLD }}>★ Membro Ippon Pro ★</div>
          <h2 style={{ fontFamily: FD, fontSize: 20, fontWeight: 700, textTransform: "uppercase", margin: "4px 0 6px" }}>Olá, {nome}!</h2>
          <p style={{ fontSize: 13.5, color: "#dfe6e0", lineHeight: 1.55, margin: 0 }}>Esta é a tua central de vantagens. És dos primeiros a ter o Pro — vais ver as ferramentas a nascer aqui, rodada após rodada.</p>
        </section>

        {/* Ferramenta REAL: Análise do teu time */}
        <SectionTitle>Análise do teu time</SectionTitle>
        <section style={{ background: "#121815", border: `1px solid ${GOLD}`, borderRadius: 16, padding: 16, marginBottom: 22 }}>
          {analise === null ? (
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <div style={{ width: 52, height: 52, flexShrink: 0 }}><Mascot belt="#141110" expression="indicando" /></div>
              <p style={{ fontSize: 13.5, color: "#a9b4ac", lineHeight: 1.55, margin: 0 }}>Ainda não tens uma equipa guardada para esta competição. Monta a tua equipa e volta aqui para a minha análise.</p>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 14 }}>
                <div style={{ width: 52, height: 52, flexShrink: 0 }}><Mascot belt="#141110" expression="sabio" /></div>
                <p style={{ fontSize: 14, color: "#dfe6e0", lineHeight: 1.55, margin: 0 }}>{analise.resumo}</p>
              </div>

              {/* Números rápidos */}
              <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                <NumBox label="Gasto" valor={`JC ${analise.gastoTotal}`} />
                <NumBox label="Saldo" valor={`JC ${analise.saldo}`} ouro={analise.saldo >= 0} />
              </div>

              {/* Observações */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {analise.observacoes.map((o, i) => (
                  <div key={i} style={{ background: "#0f1411", border: `1px solid ${corTom(o.tom)}`, borderRadius: 10, padding: "11px 13px" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: corTexto(o.tom), marginBottom: 2 }}>{o.titulo}</div>
                    <div style={{ fontSize: 12.5, color: "#a9b4ac", lineHeight: 1.5 }}>{o.texto}</div>
                  </div>
                ))}
              </div>

              <p style={{ fontSize: 11, color: "#7c8a82", lineHeight: 1.5, margin: "14px 0 0", textAlign: "center" }}>São apenas leituras para te ajudar — a decisão é sempre tua.</p>
            </>
          )}
        </section>

        {/* A chegar */}
        <SectionTitle>A chegar à tua central</SectionTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {A_CHEGAR.map((v) => (
            <div key={v.t} style={{ display: "flex", gap: 11, background: "#121815", border: "1px solid #243029", borderRadius: 14, padding: "13px 14px", opacity: 0.92 }}>
              <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#23291f", color: "#7c8a82", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{v.t}</div>
                <div style={{ fontSize: 12.5, color: "#93a39a", marginTop: 2, lineHeight: 1.5 }}>{v.x}</div>
              </div>
              <span style={{ flexShrink: 0, alignSelf: "center", fontSize: 10, color: GOLD, border: `1px solid ${GOLD}`, borderRadius: 999, padding: "2px 8px", fontWeight: 700 }}>EM BREVE</span>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily: FD, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#93a39a", marginBottom: 10 }}>{children}</div>;
}

function NumBox({ label, valor, ouro }: { label: string; valor: string; ouro?: boolean }) {
  return (
    <div style={{ flex: 1, background: "#0f1411", border: "1px solid #243029", borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
      <div style={{ fontSize: 10.5, color: "#7c8a82", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div style={{ fontFamily: FD, fontSize: 17, fontWeight: 700, color: ouro ? GOLD : "#f1ede2", marginTop: 2 }}>{valor}</div>
    </div>
  );
}

function corTom(tom: string): string {
  if (tom === "bom") return "#1f5e44";
  if (tom === "atencao") return "#5a4a2c";
  return "#243029";
}
function corTexto(tom: string): string {
  if (tom === "bom") return "#7fd1a3";
  if (tom === "atencao") return GOLD;
  return "#cfd8d2";
}
