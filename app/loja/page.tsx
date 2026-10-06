"use client";
// app/loja/page.tsx
//
// LOJA DE JUDOCOINS — compra de orçamento extra da temporada.
//
// Quem CREDITA os JC é o webhook, quando a Stripe confirma o pagamento. Esta
// página só leva a pessoa ao ecrã de pagamento e mostra o saldo já creditado.
import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { PACOTES_JC } from "@/lib/planos";
import { useLingua, type Lingua } from "@/lib/i18n";
import { track, aoTerConsentimento } from "@/lib/analytics";

const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";

// Texto local por língua (mesmo padrão da FAQ / legal / janela do mercado), para
// não inflar o lib/i18n com strings de uma página só.
const LOJA: Record<string, {
  titulo: string; intro: string; saldo: string; expira: string; comprar: string;
  aAbrir: string; transpTitulo: string; transp: string;
  sucesso: string; cancelada: string; entrar: string; erro: string; voltar: string;
}> = {
  pt: {
    titulo: "Loja de Judocoins",
    intro: "Judocoins extra para montares a equipa que quiseres. São orçamento da temporada.",
    saldo: "Saldo comprado",
    expira: "Expira a 30 de dezembro",
    comprar: "Comprar",
    aAbrir: "A abrir…",
    transpTitulo: "Antes de comprar",
    transp: "Os Judocoins comprados são orçamento extra da temporada, não dinheiro real nem reembolsável. Servem para contratar atletas — não garantem pontos, e não podes trocar de atleta com o mercado fechado. Expiram a 30 de dezembro.",
    sucesso: "Compra concluída! Os teus Judocoins aparecem aqui assim que o pagamento for confirmado.",
    cancelada: "Compra cancelada. Não foi cobrado nada.",
    entrar: "Entra na tua conta para comprar.",
    erro: "Não foi possível abrir o pagamento. Tenta outra vez.",
    voltar: "Voltar",
  },
  en: {
    titulo: "Judocoins Store",
    intro: "Extra Judocoins to build the team you want. It's season budget.",
    saldo: "Purchased balance",
    expira: "Expires on 30 December",
    comprar: "Buy",
    aAbrir: "Opening…",
    transpTitulo: "Before you buy",
    transp: "Purchased Judocoins are extra season budget, not real or refundable money. They let you sign athletes — they don't guarantee points, and you can't swap an athlete once the market is closed. They expire on 30 December.",
    sucesso: "Purchase complete! Your Judocoins appear here as soon as the payment is confirmed.",
    cancelada: "Purchase cancelled. Nothing was charged.",
    entrar: "Sign in to buy.",
    erro: "We couldn't open the payment. Please try again.",
    voltar: "Back",
  },
  es: {
    titulo: "Tienda de Judocoins",
    intro: "Judocoins extra para montar el equipo que quieras. Es presupuesto de la temporada.",
    saldo: "Saldo comprado",
    expira: "Caduca el 30 de diciembre",
    comprar: "Comprar",
    aAbrir: "Abriendo…",
    transpTitulo: "Antes de comprar",
    transp: "Los Judocoins comprados son presupuesto extra de la temporada, no dinero real ni reembolsable. Sirven para fichar atletas: no garantizan puntos y no puedes cambiar de atleta con el mercado cerrado. Caducan el 30 de diciembre.",
    sucesso: "¡Compra completada! Tus Judocoins aparecen aquí en cuanto se confirme el pago.",
    cancelada: "Compra cancelada. No se cobró nada.",
    entrar: "Inicia sesión para comprar.",
    erro: "No pudimos abrir el pago. Inténtalo de nuevo.",
    voltar: "Volver",
  },
  fr: {
    titulo: "Boutique de Judocoins",
    intro: "Des Judocoins en plus pour composer l'équipe que tu veux. C'est du budget de saison.",
    saldo: "Solde acheté",
    expira: "Expire le 30 décembre",
    comprar: "Acheter",
    aAbrir: "Ouverture…",
    transpTitulo: "Avant d'acheter",
    transp: "Les Judocoins achetés sont un budget de saison supplémentaire, pas de l'argent réel ni remboursable. Ils servent à recruter des athlètes — ils ne garantissent pas de points, et tu ne peux pas changer d'athlète une fois le marché fermé. Ils expirent le 30 décembre.",
    sucesso: "Achat effectué ! Tes Judocoins apparaissent ici dès que le paiement est confirmé.",
    cancelada: "Achat annulé. Rien n'a été débité.",
    entrar: "Connecte-toi pour acheter.",
    erro: "Impossible d'ouvrir le paiement. Réessaie.",
    voltar: "Retour",
  },
  de: {
    titulo: "Judocoins-Shop",
    intro: "Extra-Judocoins, um das Team zu bauen, das du willst. Es ist Saisonbudget.",
    saldo: "Gekauftes Guthaben",
    expira: "Läuft am 30. Dezember ab",
    comprar: "Kaufen",
    aAbrir: "Wird geöffnet…",
    transpTitulo: "Vor dem Kauf",
    transp: "Gekaufte Judocoins sind zusätzliches Saisonbudget, kein echtes oder erstattungsfähiges Geld. Damit verpflichtest du Athleten — sie garantieren keine Punkte, und du kannst keinen Athleten wechseln, sobald der Markt geschlossen ist. Sie laufen am 30. Dezember ab.",
    sucesso: "Kauf abgeschlossen! Deine Judocoins erscheinen hier, sobald die Zahlung bestätigt ist.",
    cancelada: "Kauf abgebrochen. Es wurde nichts berechnet.",
    entrar: "Melde dich an, um zu kaufen.",
    erro: "Zahlung konnte nicht geöffnet werden. Bitte versuche es erneut.",
    voltar: "Zurück",
  },
  ja: {
    titulo: "Judocoinsストア",
    intro: "好きなチームを編成するための追加Judocoins。シーズンの予算です。",
    saldo: "購入した残高",
    expira: "12月30日に期限切れ",
    comprar: "購入する",
    aAbrir: "開いています…",
    transpTitulo: "購入する前に",
    transp: "購入したJudocoinsはシーズンの追加予算で、現金でも払い戻し可能なお金でもありません。選手を獲得するために使えますが、得点を保証するものではなく、マーケットが閉じた後は選手を入れ替えられません。12月30日に期限切れになります。",
    sucesso: "購入が完了しました！支払いが確認され次第、Judocoinsがここに表示されます。",
    cancelada: "購入をキャンセルしました。請求は発生していません。",
    entrar: "購入するにはログインしてください。",
    erro: "支払いを開けませんでした。もう一度お試しください。",
    voltar: "戻る",
  },
  ru: {
    titulo: "Магазин Judocoins",
    intro: "Дополнительные Judocoins, чтобы собрать команду, какую хочешь. Это бюджет сезона.",
    saldo: "Купленный баланс",
    expira: "Истекает 30 декабря",
    comprar: "Купить",
    aAbrir: "Открываем…",
    transpTitulo: "Перед покупкой",
    transp: "Купленные Judocoins — это дополнительный бюджет сезона, а не реальные или возвратные деньги. Они позволяют подписывать атлетов — не гарантируют очков, и ты не можешь поменять атлета после закрытия рынка. Они истекают 30 декабря.",
    sucesso: "Покупка завершена! Твои Judocoins появятся здесь, как только платёж будет подтверждён.",
    cancelada: "Покупка отменена. Ничего не списано.",
    entrar: "Войди, чтобы купить.",
    erro: "Не удалось открыть оплату. Попробуй ещё раз.",
    voltar: "Назад",
  },
};

function LojaConteudo() {
  const { lingua } = useLingua();
  const txt = LOJA[lingua] ?? LOJA.pt;
  const params = useSearchParams();
  const [saldo, setSaldo] = useState<number | null>(null);
  const [aComprar, setAComprar] = useState<number | null>(null);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);

  // FUNIL DE MONETIZAÇÃO (Judocoins): topo do funil = viu a loja. Espera pelo
  // consentimento e conta uma vez por montagem (igual ao paywall do Pro).
  const lojaVista = useRef(false);
  useEffect(() => {
    if (lojaVista.current) return;
    lojaVista.current = true;
    aoTerConsentimento(() => track("paywall_viewed", { pagina: "loja" }));
  }, []);

  useEffect(() => {
    const c = params.get("compra");
    if (c === "ok") setAviso(txt.sucesso);
    else if (c === "cancelada") setAviso(txt.cancelada);
  }, [params, txt.sucesso, txt.cancelada]);

  // Lê o saldo comprado (só o próprio, pelo token).
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const { data: sess } = await supabase.auth.getSession();
        const tok = sess.session?.access_token;
        if (!tok) { if (vivo) setSaldo(0); return; }
        const r = await fetch("/api/judocoins/saldo", { headers: { Authorization: `Bearer ${tok}` }, cache: "no-store" });
        const j = await r.json();
        if (vivo) setSaldo(j?.ok ? Number(j.saldo) || 0 : 0);
      } catch {
        if (vivo) setSaldo(0);
      }
    })();
    return () => { vivo = false; };
  }, []);

  async function comprar(jc: number) {
    setErro("");
    setAComprar(jc);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const tok = sess.session?.access_token;
      if (!tok) { window.location.href = "/entrar?voltar=/loja"; return; }
      const r = await fetch("/api/judocoins/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
          body: JSON.stringify({ jc }),
        });
      const j = await r.json();
      if (j?.ok && j.url) { track("checkout_started", { tipo: "judocoins", jc }); window.location.href = j.url; return; }
      setErro(j?.erro || txt.erro);
    } catch {
      setErro(txt.erro);
    }
    setAComprar(null);
  }

  // COMPRA DE TESTE (admin): abre o checkout do pacote €0,50 / 1 JC. O botão só
  // aparece com ?teste=1 no endereço, e o servidor só a autoriza a quem é admin.
  // Serve para validar a compra real ponta-a-ponta antes de abrir a loja.
  async function comprarTeste() {
    setErro("");
    setAComprar(-1); // -1 = marcador do botão de teste
    try {
      const { data: sess } = await supabase.auth.getSession();
      const tok = sess.session?.access_token;
      if (!tok) { window.location.href = "/entrar?voltar=/loja?teste=1"; return; }
      const r = await fetch("/api/judocoins/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
          body: JSON.stringify({ teste: true }),
        });
      const j = await r.json();
      if (j?.ok && j.url) { track("checkout_started", { tipo: "judocoins", jc: 1, teste: true }); window.location.href = j.url; return; }
      setErro(j?.erro || txt.erro);
    } catch {
      setErro(txt.erro);
    }
    setAComprar(null);
  }

  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: FB }}>
    <div style={{ maxWidth: 460, margin: "0 auto", padding: "12px 14px 40px" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
    <a href="/inicio" aria-label={txt.voltar} style={{ width: 32, height: 32, borderRadius: "50%", border: "1px solid #243029", display: "flex", alignItems: "center", justifyContent: "center", color: "#cfd8d2", textDecoration: "none" }}>
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
    </a>
    <span style={{ fontFamily: FD, fontSize: 19, fontWeight: 700, textTransform: "uppercase" }}>{txt.titulo}</span>
    </div>

    <p style={{ fontSize: 14, color: "#c7d0c9", lineHeight: 1.55, margin: "0 0 14px" }}>{txt.intro}</p>

    {aviso && (
      <div style={{ background: "#101511", border: "1px solid #2f4a3c", borderRadius: 12, padding: "11px 13px", marginBottom: 14, fontSize: 13, color: "#aee9c9", lineHeight: 1.5 }}>{aviso}</div>
    )}

    {/* Saldo comprado */}
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#121815", border: `1px solid ${GOLD}`, borderRadius: 14, padding: "13px 15px", marginBottom: 8 }}>
    <div>
    <div style={{ fontSize: 11, color: "#93a39a", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: FD, fontWeight: 700 }}>{txt.saldo}</div>
    <div style={{ fontSize: 12, color: "#7c8a82" }}>{txt.expira}</div>
    </div>
    <div style={{ fontFamily: FD, fontSize: 22, fontWeight: 700, color: GOLD }}>
    {saldo == null ? "…" : `JC ${saldo}`}
    </div>
    </div>

    {erro && <div style={{ fontSize: 13, color: "#ef8d83", margin: "8px 2px 0" }}>{erro}</div>}

    {/* Pacotes */}
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14 }}>
    {PACOTES_JC.map((p) => (
      <div key={p.lookupKey} style={{ background: "#0f1411", border: "1px solid #243029", borderRadius: 14, padding: "14px 12px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <div style={{ fontFamily: FD, fontSize: 20, fontWeight: 700, color: "#f1ede2" }}>{p.jc} <span style={{ fontSize: 12, color: GOLD }}>JC</span></div>
      <div style={{ fontSize: 13, color: "#c7d0c9" }}>€{p.euros}</div>
      <button
      onClick={() => comprar(p.jc)}
      disabled={aComprar !== null}
      style={{ width: "100%", background: aComprar === p.jc ? "#2a3a33" : GOLD, color: aComprar === p.jc ? "#cfd8d2" : "#1b211e", fontFamily: FD, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", fontSize: 12.5, padding: "9px 0", borderRadius: 9, border: "none", cursor: aComprar !== null ? "default" : "pointer", opacity: aComprar !== null && aComprar !== p.jc ? 0.5 : 1 }}
      >
      {aComprar === p.jc ? txt.aAbrir : txt.comprar}
      </button>
      </div>
    ))}
    </div>

    {/* Transparência */}
    <div style={{ marginTop: 20, background: "#101511", border: "1px dashed #2f4a3c", borderRadius: 14, padding: "13px 15px" }}>
    <div style={{ fontFamily: FD, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "#8b9a92", marginBottom: 7 }}>{txt.transpTitulo}</div>
    <p style={{ fontSize: 12.5, color: "#c7d0c9", lineHeight: 1.6, margin: 0 }}>{txt.transp}</p>
    </div>

    {/* BOTÃO DE TESTE (admin) — só com ?teste=1 no endereço. O servidor confirma
        que é admin; uma conta normal que chegue aqui leva "Não autorizado". */}
    {params.get("teste") === "1" && (
      <button
      onClick={comprarTeste}
      disabled={aComprar !== null}
      style={{ display: "block", width: "100%", marginTop: 16, background: "transparent", border: "1px dashed #5a3a36", color: "#c9b878", fontFamily: FD, fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.04em", padding: "11px 0", borderRadius: 10, cursor: aComprar !== null ? "default" : "pointer", opacity: aComprar !== null && aComprar !== -1 ? 0.5 : 1 }}
      >
      {aComprar === -1 ? txt.aAbrir : "Teste admin · €0,50 → 1 JC"}
      </button>
    )}
    </div>
    </main>
  );
}

export default function LojaPage() {
  return (
    <Suspense fallback={<main style={{ minHeight: "100vh", background: "#0c0e0d" }} />}>
    <LojaConteudo />
    </Suspense>
  );
}
