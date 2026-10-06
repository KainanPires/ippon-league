"use client";

// components/ChaveLead.tsx
//
// MURO DE CAPTAÇÃO DE LEAD na /chave-atletas — para quem chega DESLOGADO.
//
// Mostra um teaser da chave REAL (o sorteio, borrado) e pede para CRIAR CONTA
// (grátis) ou ENTRAR (quem já tem conta). Depois do registo/login, volta à
// /chave-atletas (via ?next=) já com acesso (o novo registo ganha Pro Max da
// promo de lançamento).
//
// Só é usado no ramo "grátis + deslogado" da /chave-atletas — não toca na chave
// ao vivo que os Pro Max já veem. O teaser usa o endpoint público /api/chave-preview.

import { useEffect, useState } from "react";
import { useT, useLingua } from "@/lib/i18n";
import { CALENDARIO_2026, nomeCompeticaoPorId, localizarNomeCompeticao, rotuloNivel } from "@/lib/calendario";

const GOLD = "#d9a441";
const BG = "#0c0e0d";
const CARD = "#121815";
const BORDA = "#243029";
const TXT = "#f1ede2";
const DIM = "#93a39a";
const FD = "var(--font-geist-mono), system-ui, sans-serif";

// Volta à chave depois de criar conta / entrar.
const CRIAR = "/comecar?next=/chave-atletas";
const ENTRAR = "/entrar?next=/chave-atletas";

interface AtletaPrev { id: string; nome: string; pais: string }
interface Categoria { cat: string; total: number; pools: Record<string, AtletaPrev[]> }

type Tx = {
  sub: string; lockTitulo: string; lockSub: string;
  criarBtn: string; entrarBtn: string; gratis: string; jaTens: string;
};
const T: Record<string, Tx> = {
  pt: {
    sub: "Acompanha o sorteio e os resultados ao vivo, luta a luta.",
    lockTitulo: "Vê a chave completa ao vivo",
    lockSub: "Cria a tua conta grátis para ver todas as categorias, o chaveamento completo e os resultados em tempo real.",
    criarBtn: "Criar conta grátis", entrarBtn: "Entrar",
    gratis: "É grátis — leva menos de 1 minuto.", jaTens: "Já tens conta?",
  },
  en: {
    sub: "Follow the draw and live results, fight by fight.",
    lockTitulo: "See the full live bracket",
    lockSub: "Create your free account to see every category, the full draw and real-time results.",
    criarBtn: "Create free account", entrarBtn: "Log in",
    gratis: "It's free — takes less than a minute.", jaTens: "Already have an account?",
  },
  es: {
    sub: "Sigue el sorteo y los resultados en vivo, combate a combate.",
    lockTitulo: "Mira el cuadro completo en vivo",
    lockSub: "Crea tu cuenta gratis para ver todas las categorías, el cuadro completo y los resultados en tiempo real.",
    criarBtn: "Crear cuenta gratis", entrarBtn: "Entrar",
    gratis: "Es gratis — menos de 1 minuto.", jaTens: "¿Ya tienes cuenta?",
  },
  fr: {
    sub: "Suis le tirage et les résultats en direct, combat par combat.",
    lockTitulo: "Vois le tableau complet en direct",
    lockSub: "Crée ton compte gratuit pour voir toutes les catégories, le tirage complet et les résultats en temps réel.",
    criarBtn: "Créer un compte gratuit", entrarBtn: "Se connecter",
    gratis: "C'est gratuit — moins d'une minute.", jaTens: "Tu as déjà un compte ?",
  },
  de: {
    sub: "Verfolge die Auslosung und Live-Ergebnisse, Kampf für Kampf.",
    lockTitulo: "Sieh den kompletten Baum live",
    lockSub: "Erstelle dein kostenloses Konto, um alle Gewichtsklassen, die komplette Auslosung und Echtzeit-Ergebnisse zu sehen.",
    criarBtn: "Kostenloses Konto erstellen", entrarBtn: "Anmelden",
    gratis: "Kostenlos — in unter einer Minute.", jaTens: "Schon ein Konto?",
  },
  ja: {
    sub: "抽選とライブ結果を、一試合ごとに追いましょう。",
    lockTitulo: "完全なトーナメント表をライブで見る",
    lockSub: "無料アカウントを作成すると、すべての階級、完全な抽選、リアルタイムの結果を見られます。",
    criarBtn: "無料アカウントを作成", entrarBtn: "ログイン",
    gratis: "無料です — 1分もかかりません。", jaTens: "すでにアカウントをお持ちですか？",
  },
  ru: {
    sub: "Следи за жеребьёвкой и результатами вживую, схватка за схваткой.",
    lockTitulo: "Смотри полную сетку вживую",
    lockSub: "Создай бесплатный аккаунт, чтобы увидеть все весовые категории, полную жеребьёвку и результаты в реальном времени.",
    criarBtn: "Создать бесплатный аккаунт", entrarBtn: "Войти",
    gratis: "Это бесплатно — меньше минуты.", jaTens: "Уже есть аккаунт?",
  },
};

export function ChaveLead() {
  const t = useT();
  const { lingua } = useLingua();
  const tl = T[lingua] ?? T.pt;
  const [comp, setComp] = useState("");
  const [cats, setCats] = useState<Categoria[]>([]);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const r = await fetch("/api/chave-preview", { cache: "no-store" });
        const j = await r.json();
        if (!vivo) return;
        setComp(String(j?.comp || ""));
        setCats(Array.isArray(j?.categorias) ? j.categorias : []);
      } catch { /* teaser é opcional */ }
    })();
    return () => { vivo = false; };
  }, []);

  const entrada = CALENDARIO_2026.find((c) => c.idCompeticao === comp);
  const nomeComp = comp ? (localizarNomeCompeticao(nomeCompeticaoPorId(comp) || "", t) || "") : "";
  const nivel = entrada ? rotuloNivel(entrada.nivel, t) : "";
  const teaser = cats.slice(0, 2);

  return (
    <main style={{ minHeight: "100vh", background: BG, color: TXT, fontFamily: "var(--font-geist-sans), system-ui, sans-serif", padding: "26px 16px 40px" }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        {/* Hero */}
        <div style={{ textAlign: "center", marginBottom: 18 }}>
          {nivel ? <span style={{ display: "inline-block", border: `1px solid ${GOLD}`, color: GOLD, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", padding: "3px 12px", borderRadius: 999, marginBottom: 10 }}>{nivel}</span> : null}
          <h1 style={{ fontFamily: FD, fontSize: 25, fontWeight: 700, lineHeight: 1.15, margin: "0 0 8px", textTransform: "uppercase" }}>{nomeComp || "Ippon League"}</h1>
          <p style={{ color: DIM, fontSize: 14.5, margin: 0, lineHeight: 1.5 }}>{tl.sub}</p>
        </div>

        {/* Teaser da chave (borrado) + muro */}
        <div style={{ position: "relative" }}>
          <div style={{ filter: "blur(5px)", opacity: 0.45, pointerEvents: "none", userSelect: "none", display: "grid", gap: 12 }} aria-hidden="true">
            {(teaser.length ? teaser : [{ cat: "-60", total: 0, pools: {} }]).map((c, i) => (
              <CategoriaMini key={i} c={c} />
            ))}
          </div>

          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 8, background: "linear-gradient(180deg, rgba(12,14,13,0.4), rgba(12,14,13,0.95))" }}>
            <div style={{ width: "100%", maxWidth: 420, background: CARD, border: `1px solid ${BORDA}`, borderRadius: 16, padding: 20, textAlign: "center" }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>🔒</div>
              <h2 style={{ fontFamily: FD, fontSize: 18, margin: "0 0 8px", textTransform: "uppercase" }}>{tl.lockTitulo}</h2>
              <p style={{ color: DIM, fontSize: 13.5, lineHeight: 1.55, margin: "0 0 16px" }}>{tl.lockSub}</p>
              <a href={CRIAR} style={{ display: "block", textAlign: "center", padding: "14px 18px", borderRadius: 12, background: GOLD, color: "#10130f", fontFamily: FD, fontSize: 14.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", textDecoration: "none" }}>
                {tl.criarBtn}
              </a>
              <p style={{ color: "#6f7d76", fontSize: 11.5, margin: "10px 0 0" }}>{tl.gratis}</p>
              <p style={{ color: DIM, fontSize: 13, margin: "14px 0 0" }}>
                {tl.jaTens}{" "}
                <a href={ENTRAR} style={{ color: TXT, fontWeight: 700, textDecoration: "none", borderBottom: `2px solid ${GOLD}`, paddingBottom: 1 }}>{tl.entrarBtn}</a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function CategoriaMini({ c }: { c: Categoria }) {
  const pools = ["A", "B", "C", "D"].filter((p) => (c.pools[p]?.length ?? 0) > 0);
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDA}`, borderRadius: 14, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ fontFamily: FD, fontSize: 17, fontWeight: 700, color: GOLD }}>{c.cat} kg</span>
        <span style={{ fontSize: 12, color: DIM }}>{c.total}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
        {(pools.length ? pools : ["A", "B"]).map((p) => (
          <div key={p} style={{ background: "#0e1210", border: `1px solid ${BORDA}`, borderRadius: 10, padding: "9px 10px" }}>
            <div style={{ fontSize: 10.5, color: DIM, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Pool {p}</div>
            <div style={{ display: "grid", gap: 4 }}>
              {(c.pools[p] || [{ id: "1", nome: "—", pais: "" }, { id: "2", nome: "—", pais: "" }, { id: "3", nome: "—", pais: "" }]).map((a) => (
                <div key={a.id} style={{ fontSize: 12.5, color: TXT, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {a.pais ? <span style={{ color: DIM, fontSize: 11 }}>{a.pais} </span> : null}{a.nome}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
