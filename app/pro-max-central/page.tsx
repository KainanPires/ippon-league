"use client";
// app/pro-max-central/page.tsx
//
// Central do Pro Max — onde quem é Pro Max cai ao tocar na sua aba. NÃO é vendas:
// sem preços, sem patrocínios, sem "torna-te". Mostra o estado, as vantagens
// (fecháveis), a personalização (tatame + judogui, que mudam em tudo na hora via
// os providers), e um atalho para o scout do time (vive na /pro).
//
// Acesso: só Pro Max. Se chegar um Pro -> /pro; um gratuito -> /ippon-pro. Segue
// o padrão seguro da /pro (confirma com getUser antes de reencaminhar, para o
// metadata "frio" do primeiro instante não expulsar um Pro Max por engano).
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Mascot } from "@/components/Mascot";
import { supabase } from "@/lib/supabase";
import { useTatame } from "@/components/TatameProvider";
import { useJudogui, type JudoguiCor } from "@/components/JudoguiProvider";
import { TATAMES, tatamePorId, type TatameId } from "@/lib/tatames";
import { ScoutDoTime } from "@/components/ScoutDoTime";
const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const MAX = "#7fb8f5";
const VANTAGENS: string[] = [
  "Chave ao vivo nas competições de topo (Mundial, Grand Slam, Grand Prix, Masters, Olimpíadas)",
  "Análise da chave — quem tem mais hipótese de pontuar muito ou ser campeão",
  "Alerta dos teus favoritos — quando o teu atleta é o próximo a lutar",
  "Até 10 ligas e copas (o dobro do Pro)",
  "Grupo exclusivo (WhatsApp/Telegram) só para Pro Max",
  "Layout e visual exclusivos Pro Max",
  "Tudo o que o Pro já te dá (scout, análise do time, dica de capitão)",
];
export default function ProMaxCentral() {
  const router = useRouter();
  const [estado, setEstado] = useState<"carregando" | "ok">("carregando");
  const [nome, setNome] = useState("Campeão");
  const [verBoasVindas, setVerBoasVindas] = useState(true);
  const [verVantagens, setVerVantagens] = useState(true);
  useEffect(() => {
    try {
      if (localStorage.getItem("ippon_promax_boasvindas_fechada") === "1") setVerBoasVindas(false);
      if (localStorage.getItem("ippon_promax_vantagens_fechada") === "1") setVerVantagens(false);
    } catch {}
  }, []);
  function lerProMax(u: { user_metadata?: { is_pro?: boolean; is_pro_max?: boolean } } | null | undefined): { max: boolean; pro: boolean } {
    const m = u?.user_metadata || {};
    return { max: Boolean(m.is_pro_max), pro: Boolean(m.is_pro) };
  }
  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      const u = data.session?.user;
      if (!u) { router.replace("/ippon-pro"); return; }
      let { max, pro } = lerProMax(u);
      // Confirmação com metadata fresco se a 1ª leitura não disser Pro Max.
      if (!max) {
        try {
          const { data: fresco } = await supabase.auth.getUser();
          if (!active) return;
          const r = lerProMax(fresco?.user);
          max = r.max; pro = r.pro;
        } catch { /* mantém a 1ª leitura */ }
      }
      if (!active) return;
      if (!max) {
        // Não é Pro Max: Pro -> central Pro; gratuito -> vendas.
        router.replace(pro ? "/pro" : "/ippon-pro");
        return;
      }
      const m = u.user_metadata || {};
      setNome(String(m.nome || "").trim().split(" ")[0] || "Campeão");
      setEstado("ok");
    })();
    return () => { active = false; };
  }, [router]);
  function fecharBoasVindas() {
    setVerBoasVindas(false);
    try { localStorage.setItem("ippon_promax_boasvindas_fechada", "1"); } catch {}
  }
  function fecharVantagens() {
    setVerVantagens(false);
    try { localStorage.setItem("ippon_promax_vantagens_fechada", "1"); } catch {}
  }
  if (estado === "carregando") {
    return (
      <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: FB, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#7c8a82", fontSize: 14 }}>A carregar…</p>
      </main>
    );
  }
  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: FB }}>
      <div style={{ maxWidth: 460, margin: "0 auto", padding: "14px 16px 48px" }}>
        <header style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 16 }}>
          <a href="/inicio" aria-label="Voltar" style={{ width: 34, height: 34, borderRadius: "50%", border: "1px solid #24364a", display: "flex", alignItems: "center", justifyContent: "center", color: "#9fb3cc", textDecoration: "none", flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
          </a>
          <h1 style={{ fontFamily: FD, fontSize: 18, fontWeight: 700, textTransform: "uppercase", margin: 0 }}>A minha central Pro Max</h1>
        </header>
        {/* Boas-vindas Pro Max — fechável (permanente) */}
        {verBoasVindas && (
          <section style={{ position: "relative", textAlign: "center", background: "linear-gradient(160deg,#16243a,#0d1116)", border: `1.5px solid ${MAX}`, borderRadius: 18, padding: "20px 18px", marginBottom: 18 }}>
            <button onClick={fecharBoasVindas} aria-label="Fechar" style={{ position: "absolute", top: 10, right: 10, width: 26, height: 26, borderRadius: "50%", border: "1px solid #2f5478", background: "rgba(0,0,0,0.25)", color: MAX, cursor: "pointer", fontSize: 13, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
            <div style={{ width: 72, height: 72, margin: "0 auto 6px" }}><Mascot belt="#141110" expression="comemorando" /></div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: MAX }}>★ Membro Pro Max ★</div>
            <h2 style={{ fontFamily: FD, fontSize: 20, fontWeight: 700, textTransform: "uppercase", margin: "4px 0 6px" }}>Olá, {nome}!</h2>
            <p style={{ fontSize: 13.5, color: "#9fb3cc", lineHeight: 1.55, margin: 0 }}>Tens o pacote completo da Ippon League ativo. Sem anúncios, sem limites do Pro.</p>
          </section>
        )}
        {/* CHAVE DE ATLETAS — atalho para a chave ao vivo (Pro Max vê tudo em direto). */}
        <a href="/chave-atletas" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none", background: "linear-gradient(160deg,#16243a,#0d1116)", border: `1.5px solid ${MAX}`, borderRadius: 14, padding: "13px 14px", marginBottom: 18, color: "#f1ede2" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 8, background: "#1c3a2e", flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#aee9c9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 3v18h18" /><path d="M7 14l4-4 3 3 5-6" /></svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: FD, fontSize: 15, fontWeight: 700, textTransform: "uppercase", color: MAX }}>Chave ao vivo</div>
            <div style={{ fontSize: 12, color: "#9fb3cc", marginTop: 1, lineHeight: 1.4 }}>Acompanha cada categoria em direto e segue os teus favoritos.</div>
          </div>
          <span style={{ color: MAX, fontSize: 20, flexShrink: 0 }}>›</span>
        </a>
        {/* Vantagens — fecháveis (permanente) */}
        {verVantagens && (
          <section style={{ position: "relative", background: "#101722", border: "1px solid #24364a", borderRadius: 16, padding: "16px 16px 14px", marginBottom: 18 }}>
            <button onClick={fecharVantagens} aria-label="Fechar" style={{ position: "absolute", top: 10, right: 10, width: 24, height: 24, borderRadius: "50%", border: "1px solid #2f5478", background: "transparent", color: "#9fb3cc", cursor: "pointer", fontSize: 12, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
            <div style={{ fontFamily: FD, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: MAX, marginBottom: 12 }}>As tuas vantagens (ativas)</div>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 9 }}>
              {VANTAGENS.map((v) => (
                <li key={v} style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
                  <span style={{ color: "#7fd1a3", fontWeight: 700, flexShrink: 0 }}>✓</span>
                  <span style={{ fontSize: 13, color: "#eaf1f8", lineHeight: 1.45 }}>{v}</span>
                </li>
              ))}
            </ul>
            <p style={{ fontSize: 11, color: "#6f8194", lineHeight: 1.5, margin: "12px 2px 0" }}>
              Os Clássicos (competições do passado) não têm chave ao vivo nem análise, por já terem acontecido.
            </p>
          </section>
        )}
        {/* PERSONALIZAÇÃO */}
        <div style={{ fontFamily: FD, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: MAX, marginBottom: 10 }}>Personalização</div>
        <SeletorTatameCentral />
        <SeletorJudoguiCentral />
        {/* SCOUT do time — o mesmo componente da /pro, aqui dentro (sem sair). */}
        <ScoutDoTime />
      </div>
    </main>
  );
}
// Seletor de tatame na central — usa o MESMO provider do Meu Time, por isso
// mudar aqui muda em todo o lado na hora.
function SeletorTatameCentral() {
  const { tatameId, isProMax, setTatame } = useTatame();
  const [aberto, setAberto] = useState(false);
  const atualTema = tatamePorId(tatameId);
  return (
    <div style={{ marginBottom: 12 }}>
      <button onClick={() => setAberto((v) => !v)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", background: "#101722", border: "1px solid #24364a", borderRadius: 12, padding: "12px 14px", cursor: "pointer", color: "#f1ede2", fontFamily: FB }}>
        <span style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <span style={{ display: "flex", gap: 3 }}>
            <span style={{ width: 12, height: 14, borderRadius: 3, background: atualTema.foraBg, border: `1px solid ${atualTema.foraBorda}` }} />
            <span style={{ width: 12, height: 14, borderRadius: 3, background: atualTema.dentroBg, border: `1px solid ${atualTema.dentroBorda}` }} />
          </span>
          <span style={{ fontSize: 13, fontWeight: 700 }}>Cor do tatame</span>
        </span>
        <span style={{ color: "#9fb3cc", transform: aberto ? "rotate(90deg)" : "none", transition: "transform 0.2s" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6" /></svg>
        </span>
      </button>
      {aberto && (
        <div style={{ marginTop: 8, background: "#101722", border: "1px solid #24364a", borderRadius: 12, padding: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10 }}>
            {TATAMES.map((t) => {
              const escolhido = isProMax && t.id === tatameId;
              return (
                <button key={t.id} onClick={() => { if (isProMax) void setTatame(t.id as TatameId); }} style={{ position: "relative", display: "flex", flexDirection: "column", gap: 6, background: "transparent", border: `2px solid ${escolhido ? "#7fd1a3" : "#24364a"}`, borderRadius: 12, padding: 7, cursor: "pointer" }}>
                  <div style={{ border: `2px solid ${t.foraBorda}`, background: t.foraBg, borderRadius: 9, padding: 5 }}>
                    <div style={{ border: `2px solid ${t.dentroBorda}`, background: t.dentroBg, borderRadius: 6, height: 30 }} />
                  </div>
                  <span style={{ fontSize: 11, color: escolhido ? "#7fd1a3" : "#cfd8d2", fontWeight: 700, textAlign: "center" }}>{t.nome}</span>
                  {escolhido && (
                    <span style={{ position: "absolute", top: -8, right: -7, background: "#7fd1a3", color: "#0c1a12", borderRadius: "50%", width: 19, height: 19, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
// Seletor de judogui na central — usa o MESMO provider do perfil/Dôdo.
function SeletorJudoguiCentral() {
  // `pode` (e não `isProMax`): o judogui passou a ser PRO — o servidor decide, a
  // interface só quer saber se este utilizador consegue. Nesta página é sempre
  // true, porque só o Pro Max cá chega; mas o nome tem de bater com o contexto.
  //
  // NOTA: o seletor de TATAME acima continua com `isProMax` de propósito — esse
  // é mesmo exclusivo do Pro Max. São duas personalizações diferentes.
  const { judogui, pode, setJudogui } = useJudogui();
  const [aberto, setAberto] = useState(false);
  const opcoes: { id: JudoguiCor; nome: string }[] = [
    { id: "branco", nome: "Branco" },
    { id: "azul", nome: "Azul" },
  ];
  return (
    <div style={{ marginBottom: 18 }}>
      <button onClick={() => setAberto((v) => !v)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", background: "#101722", border: "1px solid #24364a", borderRadius: 12, padding: "12px 14px", cursor: "pointer", color: "#f1ede2", fontFamily: FB }}>
        <span style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <span style={{ width: 28, height: 28, flexShrink: 0 }}><Mascot belt="#141110" expression="feliz" judogui={judogui} /></span>
          <span style={{ fontSize: 13, fontWeight: 700 }}>Cor do judogui</span>
        </span>
        <span style={{ color: "#9fb3cc", transform: aberto ? "rotate(90deg)" : "none", transition: "transform 0.2s" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6" /></svg>
        </span>
      </button>
      {aberto && (
        <div style={{ marginTop: 8, background: "#101722", border: "1px solid #24364a", borderRadius: 12, padding: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10 }}>
            {opcoes.map((o) => {
              const escolhido = judogui === o.id;
              return (
                <button key={o.id} onClick={() => { if (pode) void setJudogui(o.id); }} style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, background: "#0c0e0d", border: `2px solid ${escolhido ? "#7fd1a3" : "#24364a"}`, borderRadius: 12, padding: "12px 8px", cursor: "pointer" }}>
                  <span style={{ width: 56, height: 56 }}><Mascot belt="#141110" expression="feliz" judogui={o.id} /></span>
                  <span style={{ fontSize: 12, color: escolhido ? "#7fd1a3" : "#cfd8d2", fontWeight: 700 }}>{o.nome}</span>
                  {escolhido && (
                    <span style={{ position: "absolute", top: -8, right: -7, background: "#7fd1a3", color: "#0c1a12", borderRadius: "50%", width: 19, height: 19, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
