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
// Nível da tabela `users` — a MESMA fonte que o servidor usa. Substitui a leitura
// do user_metadata, que podia estar desatualizada.
import { useNivel } from "@/lib/useNivel";
import { useJudogui, type JudoguiCor } from "@/components/JudoguiProvider";
import { TATAMES, tatamePorId, type TatameId } from "@/lib/tatames";
import { ScoutDoTime } from "@/components/ScoutDoTime";
import { marcarAreaProVista } from "@/components/BarraInferior";
import { TutorialBoasVindas } from "@/components/TutorialBoasVindas";
import { deveMostrarTutorial } from "@/lib/tutorials";
import { useFaixa } from "@/lib/useFaixa";
const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const MAX = "#7fb8f5";
const VERDE_WA = "#25D366"; // verde do WhatsApp

// O link da comunidade vem de uma variável de ambiente da Vercel, não do
// código: trocá-lo (spam, reset do grupo, mudança de plataforma) não deve
// obrigar a um deploy.
const LINK_COMUNIDADE = process.env.NEXT_PUBLIC_LINK_COMUNIDADE || "";
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

  // BOAS-VINDAS DO PRO MAX. Chave própria, separada da do Pro: quem sobe de Pro
  // para Pro Max já viu o percurso do Pro e tem de ver o do Max na mesma.
  const [verBoasVindas, setVerBoasVindas] = useState(false);
  const [percurso, setPercurso] = useState<"promax" | "promax_direto">("promax");
  const { cor: corFaixa } = useFaixa();
  const [verBoasVindas, setVerBoasVindas] = useState(true);
  const [verVantagens, setVerVantagens] = useState(true);

  // Chegou à sua área: o separador Pro da barra pára de pulsar.
  useEffect(() => {
    marcarAreaProVista();
  }, []);

  // Qual percurso? Quem NUNCA viu o do Pro veio direto de grátis para Pro Max —
  // e nesse caso mostra-se tudo, Pro e Max juntos. Quem já viu o do Pro só
  // precisa da diferença. Decide-se depois de o nível estar confirmado.
  useEffect(() => {
    if (!pronto || !ehProMax) return;
    let vivo = true;
    (async () => {
      const mostrarMax = await deveMostrarTutorial("ippon_boasvindas_promax");
      if (!vivo || !mostrarMax) return;
      const nuncaViuPro = await deveMostrarTutorial("ippon_boasvindas_pro");
      if (!vivo) return;
      setPercurso(nuncaViuPro ? "promax_direto" : "promax");
      setVerBoasVindas(true);
    })();
    return () => { vivo = false; };
  }, [pronto, ehProMax]);
  useEffect(() => {
      try {
        if (localStorage.getItem("ippon_promax_boasvindas_fechada") === "1") setVerBoasVindas(false);
        if (localStorage.getItem("ippon_promax_vantagens_fechada") === "1") setVerVantagens(false);
      } catch {}
    }, []);
  // Nível da tabela `users`. Substituiu uma dança de duas leituras ao
  // user_metadata (a segunda "fresca", à espera que a primeira estivesse
    // desatualizada) — que só existia porque o metadata não era de confiar.
  const { ehPro, ehProMax, pronto } = useNivel();
  useEffect(() => {
      let active = true;
      (async () => {
          const { data } = await supabase.auth.getSession();
          if (!active) return;
          const u = data.session?.user;
          if (!u) { router.replace("/ippon-pro"); return; }
          // Espera saber o nível antes de decidir. Sem isto, um Pro Max seria
          // expulso desta página no instante em que ela abre.
          if (!pronto) return;
          if (!ehProMax) {
            // Não é Pro Max: Pro -> central Pro; gratuito -> vendas.
            router.replace(ehPro ? "/pro" : "/ippon-pro");
            return;
          }
          const m = u.user_metadata || {};
          setNome(String(m.nome || "").trim().split(" ")[0] || "Campeão");
          setEstado("ok");
        })();
      return () => { active = false; };
    }, [router, pronto, ehPro, ehProMax]);
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
    {verBoasVindas && (
        <TutorialBoasVindas
        percurso={percurso}
        cor={corFaixa}
        nome={nome}
        onFechar={() => setVerBoasVindas(false)}
        />
      )}
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
    {/* COMUNIDADE PRO MAX — grupo de WhatsApp.
        Só aqui: é um benefício exclusivo do Pro Max, e esta é a página onde
        o Pro Max aterra (o /pro-central encaminha-o para cá).

        Fica SEMPRE visível, não só no dia do pagamento: quem não entrou logo
        tem de conseguir voltar a este link mais tarde sem pedir a ninguém.

        O grupo exige aprovação de administrador, por isso avisa-se já que a
        entrada não é imediata — senão parece que o link está partido. */}
    {LINK_COMUNIDADE && (
        <a href={LINK_COMUNIDADE} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none", background: "linear-gradient(160deg,#12291d,#0b1310)", border: `1.5px solid ${VERDE_WA}`, borderRadius: 14, padding: "13px 14px", marginBottom: 18, color: "#f1ede2" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: "50%", background: VERDE_WA, flexShrink: 0 }}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="#0b1310" aria-hidden="true"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm5.8 14.06c-.24.68-1.42 1.31-1.95 1.35-.5.04-.97.22-3.27-.68-2.75-1.08-4.5-3.87-4.64-4.05-.13-.18-1.1-1.47-1.1-2.8s.7-1.99.94-2.26c.25-.27.54-.34.72-.34.18 0 .36 0 .52.01.17.01.39-.06.61.47.24.55.8 1.9.87 2.04.07.14.12.3.02.48-.09.18-.14.3-.27.46-.14.16-.29.36-.41.48-.14.14-.28.28-.12.55.16.27.72 1.18 1.55 1.91 1.06.95 1.96 1.24 2.23 1.38.27.14.43.12.59-.07.16-.18.68-.79.86-1.07.18-.27.36-.22.61-.13.25.09 1.59.75 1.86.89.27.13.45.2.52.31.07.11.07.64-.17 1.32z" /></svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: FD, fontSize: 15, fontWeight: 700, textTransform: "uppercase", color: VERDE_WA }}>Comunidade Pro Max</div>
        <div style={{ fontSize: 12, color: "#9fc9ae", marginTop: 1, lineHeight: 1.4 }}>Grupo de WhatsApp: notícias, rodadas e conversa de judo. A entrada é aprovada por um administrador.</div>
        </div>
        <span style={{ color: VERDE_WA, fontSize: 20, flexShrink: 0 }}>›</span>
        </a>
      )}
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

    {/* REVER AS BOAS-VINDAS — ver a nota na central Pro. */}
    <button
    onClick={() => { setPercurso("promax"); setVerBoasVindas(true); }}
    style={{ display: "block", width: "100%", marginTop: 18, background: "transparent", border: "1px solid #2a3a33", color: "#7c8a82", fontFamily: FD, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", padding: "10px", borderRadius: 10, cursor: "pointer" }}
    >
    Rever o que tenho com o Pro Max
    </button>
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
