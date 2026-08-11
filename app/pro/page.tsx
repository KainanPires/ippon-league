"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Mascot } from "@/components/Mascot";
import { supabase } from "@/lib/supabase";
import { useNivel } from "@/lib/useNivel";
import { ScoutDoTime } from "@/components/ScoutDoTime";
import { marcarAreaProVista } from "@/components/BarraInferior";
import { TutorialBoasVindas } from "@/components/TutorialBoasVindas";
import { deveMostrarTutorial } from "@/lib/tutorials";
import { useFaixa } from "@/lib/useFaixa";
import { useT } from "@/lib/i18n";

const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";
const MAX = "#7fb8f5"; // tom do Pro Max
// NOTA: o cartão da comunidade NÃO vive aqui. Esta é a central do Pro
// simples — um Pro Max nunca chega a esta página, porque o /pro-central o
// encaminha para /pro-max-central. O grupo é um benefício exclusivo do Pro
// Max e o cartão está lá e no /perfil.

export default function DashboardPro() {
  const router = useRouter();
  const t = useT();
  const [estado, setEstado] = useState<"carregando" | "pro">("carregando");
  const [nome, setNome] = useState(t("pro.campeao"));
  const [verBoasVindas, setVerBoasVindas] = useState(true); // caixa de boas-vindas fechável

  // Convite "Sê Pro Max" só aparece a quem NÃO é Pro Max (não fazer propaganda a quem já é Max).
  const [ehProMax, setEhProMax] = useState(false);

  // Acabou de comprar Pro Max? (o checkout devolve ?novo=promax)
  const [acabouDeComprarMax, setAcabouDeComprarMax] = useState(false);

  // BOAS-VINDAS. Aparece uma vez a quem é Pro e ainda não viu — não só a quem
  // acabou de pagar. Quem já era subscritor antes disto existir também merece
  // saber o que tem.
  const [verBoasVindasPro, setVerBoasVindasPro] = useState(false);
  const { cor: corFaixa } = useFaixa();

  // A verdade sobre o nível: lida da tabela `users`, nunca do metadata.
  const { ehPro, ehProMax: ehProMaxReal, pronto: nivelPronto } = useNivel();

  // Chegou aqui: o separador Pro da barra pára de pulsar.
  useEffect(() => {
    marcarAreaProVista();
  }, []);

  // Decide DEPOIS de o nível estar confirmado — nunca antes, senão decidia-se
  // com "gratis" e o tutorial não aparecia a quem devia.
  useEffect(() => {
    if (!nivelPronto || !ehPro) return;
    let vivo = true;
    deveMostrarTutorial("ippon_boasvindas_pro").then((mostrar) => {
      if (vivo && mostrar) setVerBoasVindasPro(true);
    });
    return () => { vivo = false; };
  }, [nivelPronto, ehPro]);

  // Lê o ?novo= da barra de endereço.
  //
  // Feito com window.location e não com useSearchParams de propósito: no App
  // Router o useSearchParams obriga a página inteira a viver dentro de um
  // <Suspense>, e não vale a pena reestruturar a página por causa de um
  // parâmetro que só serve para uma mensagem de boas-vindas.
  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      setAcabouDeComprarMax(p.get("novo") === "promax");
    } catch {
      /* sem parâmetro, sem mensagem */
    }
  }, []);

  // Depois de fechada uma vez, a caixa de boas-vindas fica fechada (no aparelho).
  useEffect(() => {
    try {
      if (localStorage.getItem("ippon_pro_boasvindas_fechada") === "1") setVerBoasVindas(false);
    } catch {}
  }, []);

  function fecharBoasVindas() {
    setVerBoasVindas(false);
    try { localStorage.setItem("ippon_pro_boasvindas_fechada", "1"); } catch {}
  }

  // ---------------------------------------------------------------------------
  // O NÍVEL VEM DO useNivel, NÃO DO user_metadata (corrigido)
  //
  // Esta página lia `user_metadata.is_pro` da sessão e expulsava quem desse
  // falso. Só que o metadata deixou de ser sincronizado quando o trigger parou
  // de o fazer: quem paga fica com is_pro=true na tabela `users` — que é onde o
  // webhook da Stripe escreve — e com o metadata a dizer false para sempre.
  //
  // Resultado: um subscritor pagante entrava aqui e era mandado para a página
  // de VENDAS. Depois de ter pago. E não havia como perceber porquê, porque a
  // base de dados dizia que ele era Pro.
  //
  // O useNivel lê da tabela `users`, a mesma fonte que o servidor usa para
  // bloquear a sério. É esse o único sítio de onde o nível deve vir.
  //
  // Repara que o antigo código tinha uma segunda leitura com getUser() para o
  // caso de o metadata vir "frio" no primeiro instante — um remendo para um
  // problema que a fonte errada criava. Com a fonte certa, deixa de ser preciso:
  // o `pronto` do hook diz quando a resposta chegou.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let active = true;

    // Ainda a saber o nível: não decide nada. Sem isto, expulsava toda a gente
    // no instante em que a página abre.
    if (!nivelPronto) return;
    if (!ehPro) { router.replace("/ippon-pro"); return; }

    (async () => {
      // O nome continua a vir do metadata, e aí não faz mal: é só um cumprimento.
      try {
        const { data } = await supabase.auth.getSession();
        if (!active) return;
        const m = (data.session?.user?.user_metadata || {}) as { nome?: string };
        setNome(String(m.nome || "").trim().split(" ")[0] || t("pro.campeao"));
      } catch { /* fica "Campeão" */ }

      if (active) setEstado("pro");
    })();

    return () => { active = false; };
  }, [router, nivelPronto, ehPro]);

  // Convite "Sê Pro Max" só a quem não é Pro Max — também da fonte certa.
  useEffect(() => {
    if (nivelPronto) setEhProMax(ehProMaxReal);
  }, [nivelPronto, ehProMaxReal]);

  if (estado === "carregando") {
    return (
      <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: FB, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#7c8a82", fontSize: 14 }}>{t("comum.carregando")}</p>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: FB }}>
      {verBoasVindasPro && (
          <TutorialBoasVindas
          percurso="pro"
          cor={corFaixa}
          nome={nome}
          onFechar={() => setVerBoasVindasPro(false)}
          />
        )}
      <div style={{ maxWidth: 460, margin: "0 auto", padding: "14px 16px 48px" }}>

        <header style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 16 }}>
          <a href="/inicio" aria-label={t("comum.voltar")} style={{ width: 34, height: 34, borderRadius: "50%", border: "1px solid #243029", display: "flex", alignItems: "center", justifyContent: "center", color: "#cfd8d2", textDecoration: "none", flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
          </a>
          <h1 style={{ fontFamily: FD, fontSize: 18, fontWeight: 700, textTransform: "uppercase", margin: 0 }}>{t("pro.central")}</h1>
        </header>

        {/* ACABOU DE COMPRAR PRO MAX — mensagem de estreia, uma vez.
            Não é fechável nem guardada: só aparece com ?novo=promax no
            endereço, ou seja, na volta do pagamento. */}
        {acabouDeComprarMax && ehProMax && (
          <section style={{ textAlign: "center", background: "linear-gradient(160deg,#16243a,#0d1116)", border: `1.5px solid ${MAX}`, borderRadius: 18, padding: "20px 18px", marginBottom: 18 }}>
            <div style={{ width: 72, height: 72, margin: "0 auto 6px" }}><Mascot belt="#141110" expression="comemorando" /></div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: MAX }}>★ Ippon Pro Max ★</div>
            <h2 style={{ fontFamily: FD, fontSize: 20, fontWeight: 700, textTransform: "uppercase", margin: "4px 0 8px" }}>{t("pro.bemVindoNome", { nome })}</h2>
            <p style={{ fontSize: 13.5, color: "#dfe6e0", lineHeight: 1.55, margin: 0 }}>
              {t("pro.maxEstreiaCorpo")}
            </p>
          </section>
        )}

        {/* Boas-vindas Pro — fechável (permanente) */}
        {verBoasVindas && !acabouDeComprarMax && (
          <section style={{ position: "relative", textAlign: "center", background: "linear-gradient(160deg,#2a2410,#15110a)", border: `1px solid ${GOLD}`, borderRadius: 18, padding: "20px 18px", marginBottom: 18 }}>
            <button onClick={fecharBoasVindas} aria-label={t("comum.fechar")} style={{ position: "absolute", top: 10, right: 10, width: 26, height: 26, borderRadius: "50%", border: "1px solid #4a3d18", background: "rgba(0,0,0,0.25)", color: "#c9b878", cursor: "pointer", fontSize: 13, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
            <div style={{ width: 72, height: 72, margin: "0 auto 6px" }}><Mascot belt="#141110" expression="comemorando" /></div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: GOLD }}>★ {t("pro.membro")} ★</div>
            <h2 style={{ fontFamily: FD, fontSize: 20, fontWeight: 700, textTransform: "uppercase", margin: "4px 0 6px" }}>{t("pro.olaNome", { nome })}</h2>
            <p style={{ fontSize: 13.5, color: "#dfe6e0", lineHeight: 1.55, margin: 0 }}>{t("pro.centralVantagensCorpo")}</p>
          </section>
        )}

        {/* CHAVE DE ATLETAS — atalho para a chave. O Pro vê a chave congelada
            (início e resultado final) com convite a Pro Max para o ao vivo. */}
        <a href="/chave-atletas" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none", background: "linear-gradient(160deg,#2a2410,#15110a)", border: `1px solid ${GOLD}`, borderRadius: 14, padding: "13px 14px", marginBottom: 14, color: "#f1ede2" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 8, background: "#1c3a2e", flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#aee9c9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 3v18h18" /><path d="M7 14l4-4 3 3 5-6" /></svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: FD, fontSize: 15, fontWeight: 700, textTransform: "uppercase", color: GOLD }}>{t("pro.chaveAtletas")}</div>
            <div style={{ fontSize: 12, color: "#c9b878", marginTop: 1, lineHeight: 1.4 }}>{t("pro.chaveAtletasSub")}</div>
          </div>
          <span style={{ color: GOLD, fontSize: 20, flexShrink: 0 }}>›</span>
        </a>

        {/* CHAMADA "Sê Pro Max" — só a quem AINDA não é Pro Max (sem propaganda a quem já é Max). */}
        {!ehProMax && (
          <a href="/pro-max" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none", background: "linear-gradient(160deg,#16243a,#0d1116)", border: `1.5px solid ${MAX}`, borderRadius: 14, padding: "13px 14px", marginBottom: 18 }}>
            <div style={{ width: 30, height: 30, borderRadius: "50%", background: MAX, color: "#0b1220", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontFamily: FD, fontWeight: 700 }}>★</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: FD, fontSize: 15, fontWeight: 700, textTransform: "uppercase", color: MAX }}>{t("pro.serMax")}</div>
              <div style={{ fontSize: 12, color: "#9fb3cc", marginTop: 1, lineHeight: 1.4 }}>{t("pro.serMaxSub")}</div>
            </div>
            <span style={{ color: MAX, fontSize: 20, flexShrink: 0 }}>›</span>
          </a>
        )}

        {/* SCOUT — componente partilhado (também usado na central Pro Max). */}
        <ScoutDoTime />

        {/* REVER AS BOAS-VINDAS. Quem saltou por engano, ou quem quer relembrar
            o que o plano lhe dá, não tinha como voltar — todos os tutoriais da
            app eram de sentido único. */}
        <button
        onClick={() => setVerBoasVindasPro(true)}
        style={{ display: "block", width: "100%", marginTop: 18, background: "transparent", border: "1px solid #2a3a33", color: "#7c8a82", fontFamily: FD, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", padding: "10px", borderRadius: 10, cursor: "pointer" }}
        >
        {t("pro.rever", { plano: "Pro" })}
        </button>

      </div>
    </main>
  );
}
