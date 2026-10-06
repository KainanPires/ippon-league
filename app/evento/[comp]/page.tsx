"use client";

// app/evento/[comp]/page.tsx
//
// A ISCA DO FUNIL — página pública da chave de UMA competição. GENÉRICA: a
// competição vai na URL (/evento/3151 = Mundial), por isso serve qualquer
// competição futura (/evento/3157, etc.) sem código novo.
//
// Fluxo: anúncio/postagem → esta página → vê a PRÉVIA da chave → para ver tudo,
// regista-se grátis (→ ganha Pro Max da promo) → volta aqui desbloqueado → é
// convidado a montar o time para a competição.
//
// Porque PRÉVIA e não muro seco: honra o anúncio (e evita reprovação do Meta por
// "conteúdo não corresponde"). A chave completa + resultados ao vivo ficam na
// página real /chave-atletas, que é Pro — por isso o registo desbloqueia de facto.
//
// Multilíngue (o alvo é internacional): copy de marketing num mapa local por
// língua; o NOME da competição vem do calendário (localizado). Seletor de
// bandeiras no topo, tal como o /comecar.

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useT, useLingua } from "@/lib/i18n";
import { SeletorLingua } from "@/components/SeletorLingua";
import { CALENDARIO_TODAS, nomeCompeticaoPorId, localizarNomeCompeticao, rotuloNivel } from "@/lib/calendario";
// Reaproveita o TUTORIAL de instalação que já existe (passo a passo iPhone/Android),
// só com uma chamada puxada pelo interesse, nesta página do funil.
import { TutorialInstalar } from "@/components/InstalarApp";

const GOLD = "#d9a441";
const BG = "#0c0e0d";
const CARD = "#121815";
const BORDA = "#243029";
const TXT = "#f1ede2";
const DIM = "#93a39a";
const FONT_DISPLAY = "var(--font-geist-mono), system-ui, sans-serif";

const CHAVE_COMPLETA = "/chave-atletas";   // página real da chave (Pro)
const MONTAR_TIME = "/criar-equipa";       // montar equipa

interface AtletaPrev { id: string; nome: string; pais: string }
interface Categoria { cat: string; total: number; pools: Record<string, AtletaPrev[]> }
interface Preview { ok: boolean; pronta?: boolean; categorias?: Categoria[] }

type Txt = {
  sub: string; soonTitulo: string; soonSub: string;
  lockTitulo: string; lockSub: string; registarBtn: string; gratisNota: string;
  verChaveBtn: string; montarTimeBtn: string;
  instalarMsg: string; instalarBtn: string;
  campo: string; jaTens: string; entrar: string; rodape: string;
};
const T: Record<string, Txt> = {
  pt: {
    sub: "Vê o sorteio, acompanha cada categoria e os resultados ao vivo.",
    soonTitulo: "A chave sai muito em breve",
    soonSub: "Regista-te grátis e sê o primeiro a ver o sorteio — e monta já o teu time.",
    lockTitulo: "Chave completa bloqueada",
    lockSub: "Regista-te grátis para veres todas as categorias, o sorteio completo e os resultados ao vivo.",
    registarBtn: "Registar grátis e ver tudo",
    gratisNota: "Grátis · inclui Ippon Pro no lançamento",
    verChaveBtn: "Ver a chave completa",
    montarTimeBtn: "Montar o meu time",
    instalarMsg: "Queres ficar por dentro das principais competições internacionais e ter a chave sempre à mão? Instala a Ippon no teu telemóvel.",
    instalarBtn: "Instalar no telemóvel",
    campo: "atletas", jaTens: "Já tens conta?", entrar: "Entrar", rodape: "Ippon League · O jogo oficial dos fãs de judô",
  },
  en: {
    sub: "See the draw, follow every category and live results.",
    soonTitulo: "The bracket is coming very soon",
    soonSub: "Sign up free to be the first to see the draw — and build your team now.",
    lockTitulo: "Full bracket locked",
    lockSub: "Sign up free to see every category, the full draw and live results.",
    registarBtn: "Sign up free and see it all",
    gratisNota: "Free · includes Ippon Pro at launch",
    verChaveBtn: "See the full bracket",
    montarTimeBtn: "Build my team",
    instalarMsg: "Want to stay on top of the biggest international competitions and keep every bracket at your fingertips? Install Ippon on your phone.",
    instalarBtn: "Install on my phone",
    campo: "athletes", jaTens: "Already have an account?", entrar: "Log in", rodape: "Ippon League · The official game for judo fans",
  },
  es: {
    sub: "Mira el sorteo, sigue cada categoría y los resultados en vivo.",
    soonTitulo: "El cuadro sale muy pronto",
    soonSub: "Regístrate gratis y sé el primero en ver el sorteo — y arma ya tu equipo.",
    lockTitulo: "Cuadro completo bloqueado",
    lockSub: "Regístrate gratis para ver todas las categorías, el sorteo completo y los resultados en vivo.",
    registarBtn: "Regístrate gratis y míralo todo",
    gratisNota: "Gratis · incluye Ippon Pro en el lanzamiento",
    verChaveBtn: "Ver el cuadro completo",
    montarTimeBtn: "Armar mi equipo",
    instalarMsg: "¿Quieres estar al día de las principales competiciones internacionales y tener el cuadro siempre a mano? Instala Ippon en tu móvil.",
    instalarBtn: "Instalar en el móvil",
    campo: "atletas", jaTens: "¿Ya tienes cuenta?", entrar: "Entrar", rodape: "Ippon League · El juego oficial de los fans del judo",
  },
  fr: {
    sub: "Découvre le tirage, suis chaque catégorie et les résultats en direct.",
    soonTitulo: "Le tableau arrive très bientôt",
    soonSub: "Inscris-toi gratuitement pour être le premier à voir le tirage — et compose ton équipe dès maintenant.",
    lockTitulo: "Tableau complet verrouillé",
    lockSub: "Inscris-toi gratuitement pour voir toutes les catégories, le tirage complet et les résultats en direct.",
    registarBtn: "S'inscrire gratuitement et tout voir",
    gratisNota: "Gratuit · Ippon Pro inclus au lancement",
    verChaveBtn: "Voir le tableau complet",
    montarTimeBtn: "Composer mon équipe",
    instalarMsg: "Tu veux suivre les grandes compétitions internationales et avoir le tableau toujours à portée de main ? Installe Ippon sur ton téléphone.",
    instalarBtn: "Installer sur mon téléphone",
    campo: "athlètes", jaTens: "Tu as déjà un compte ?", entrar: "Se connecter", rodape: "Ippon League · Le jeu officiel des fans de judo",
  },
  de: {
    sub: "Sieh die Auslosung, verfolge jede Gewichtsklasse und die Live-Ergebnisse.",
    soonTitulo: "Der Turnierbaum kommt sehr bald",
    soonSub: "Melde dich kostenlos an, um die Auslosung als Erster zu sehen — und stell jetzt dein Team auf.",
    lockTitulo: "Vollständiger Baum gesperrt",
    lockSub: "Melde dich kostenlos an, um alle Gewichtsklassen, die komplette Auslosung und Live-Ergebnisse zu sehen.",
    registarBtn: "Kostenlos anmelden und alles sehen",
    gratisNota: "Kostenlos · inkl. Ippon Pro zum Start",
    verChaveBtn: "Kompletten Baum ansehen",
    montarTimeBtn: "Mein Team aufstellen",
    instalarMsg: "Willst du bei den großen internationalen Wettkämpfen am Ball bleiben und den Turnierbaum immer griffbereit haben? Installiere Ippon auf deinem Handy.",
    instalarBtn: "Auf dem Handy installieren",
    campo: "Athleten", jaTens: "Schon ein Konto?", entrar: "Anmelden", rodape: "Ippon League · Das offizielle Spiel für Judo-Fans",
  },
  ja: {
    sub: "抽選を見て、各階級とライブ結果を追いましょう。",
    soonTitulo: "トーナメント表はまもなく公開",
    soonSub: "無料で登録して、抽選をいち早くチェック。今すぐチームも編成しましょう。",
    lockTitulo: "完全なトーナメント表はロック中",
    lockSub: "無料で登録すると、すべての階級、完全な抽選、ライブ結果を見られます。",
    registarBtn: "無料で登録してすべて見る",
    gratisNota: "無料 · ローンチ時にIppon Pro付き",
    verChaveBtn: "完全なトーナメント表を見る",
    montarTimeBtn: "自分のチームを編成する",
    instalarMsg: "主要な国際大会をしっかり追いかけ、トーナメント表をいつでも手元に置きたいですか？Ipponをスマホにインストールしましょう。",
    instalarBtn: "スマホにインストール",
    campo: "選手", jaTens: "すでにアカウントをお持ちですか？", entrar: "ログイン", rodape: "Ippon League · 柔道ファンのための公式ゲーム",
  },
  ru: {
    sub: "Смотри жеребьёвку, следи за каждой весовой категорией и результатами вживую.",
    soonTitulo: "Сетка появится совсем скоро",
    soonSub: "Зарегистрируйся бесплатно и первым увидь жеребьёвку — и собери свою команду прямо сейчас.",
    lockTitulo: "Полная сетка заблокирована",
    lockSub: "Зарегистрируйся бесплатно, чтобы увидеть все весовые категории, полную жеребьёвку и результаты вживую.",
    registarBtn: "Зарегистрироваться бесплатно и увидеть всё",
    gratisNota: "Бесплатно · включает Ippon Pro на старте",
    verChaveBtn: "Смотреть полную сетку",
    montarTimeBtn: "Собрать мою команду",
    instalarMsg: "Хочешь быть в курсе крупнейших международных соревнований и держать каждую сетку под рукой? Установи Ippon на свой телефон.",
    instalarBtn: "Установить на телефон",
    campo: "атлеты", jaTens: "Уже есть аккаунт?", entrar: "Войти", rodape: "Ippon League · Официальная игра для фанатов дзюдо",
  },
};

export default function EventoPage() {
  const params = useParams();
  const comp = String((params?.comp ?? "") || "");
  const t = useT();
  const { lingua } = useLingua();
  const tl = T[lingua] ?? T.pt;

  const [logado, setLogado] = useState<"..." | "sim" | "nao">("...");
  const [prev, setPrev] = useState<Preview | null>(null);
  const [tut, setTut] = useState(false);        // modal do passo a passo (do componente existente)
  const [instalada, setInstalada] = useState(false); // já está como app? então não sugere instalar

  useEffect(() => {
    if (!comp) return;
    let vivo = true;
    try {
      const standalone =
        (typeof window !== "undefined" && window.matchMedia?.("(display-mode: standalone)").matches) ||
        (typeof navigator !== "undefined" && (navigator as unknown as { standalone?: boolean }).standalone === true);
      if (standalone) setInstalada(true);
    } catch { /* ignora */ }
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (vivo) setLogado(data.session ? "sim" : "nao");
    })();
    (async () => {
      try {
        const r = await fetch(`/api/chave-preview?comp=${encodeURIComponent(comp)}`, { cache: "no-store" });
        const j = (await r.json()) as Preview;
        if (vivo) setPrev(j);
      } catch { if (vivo) setPrev({ ok: false }); }
    })();
    return () => { vivo = false; };
  }, [comp]);

  // Nome + nível da competição, do calendário (localizados).
  const entrada = CALENDARIO_TODAS.find((c) => c.idCompeticao === comp);
  const nomeComp = localizarNomeCompeticao(nomeCompeticaoPorId(comp) || "", t) || `#${comp}`;
  const nivel = entrada ? rotuloNivel(entrada.nivel, t) : "";

  const registar = `/comecar?next=/evento/${encodeURIComponent(comp)}`;
  const pronta = !!prev?.pronta && !!prev?.categorias?.length;
  const cats = prev?.categorias ?? [];
  const destaque = cats[0];
  const resto = cats.slice(1, 4);
  const estaLogado = logado === "sim";

  // Convite de instalação puxado pelo interesse. Abre o TUTORIAL já existente
  // (passo a passo iPhone/Android). Não aparece se já estiver instalada.
  const cardInstalar = instalada ? null : (
    <div style={{ background: CARD, border: `1px solid ${BORDA}`, borderRadius: 14, padding: 16, marginTop: 16 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 12 }}>
        <span style={{ fontSize: 22, lineHeight: 1 }}>📲</span>
        <p style={{ margin: 0, fontSize: 13.5, color: TXT, lineHeight: 1.5 }}>{tl.instalarMsg}</p>
      </div>
      <button onClick={() => setTut(true)} style={{ width: "100%", background: GOLD, color: "#1b211e", border: "none", borderRadius: 10, padding: "12px 14px", fontFamily: FONT_DISPLAY, fontSize: 13.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", cursor: "pointer" }}>
        {tl.instalarBtn}
      </button>
    </div>
  );

  return (
    <main style={{ minHeight: "100vh", background: BG, color: TXT, padding: "22px 16px 48px", fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
          <SeletorLingua compacto />
        </div>

        {/* Hero — nome da competição vem do calendário */}
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          {nivel ? <span style={{ display: "inline-block", border: `1px solid ${GOLD}`, color: GOLD, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", padding: "3px 12px", borderRadius: 999, marginBottom: 12 }}>{nivel}</span> : null}
          <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 27, fontWeight: 700, lineHeight: 1.15, margin: "0 0 8px", textTransform: "uppercase" }}>{nomeComp}</h1>
          <p style={{ color: DIM, fontSize: 15, margin: 0, lineHeight: 1.5 }}>{tl.sub}</p>
        </div>

        {/* Estado 1 — chave ainda não montada */}
        {prev && !pronta && (
          <div style={{ ...caixa, textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>🥋</div>
            <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 19, margin: "0 0 8px", textTransform: "uppercase" }}>{tl.soonTitulo}</h2>
            <p style={{ color: DIM, fontSize: 14, lineHeight: 1.6, margin: "0 0 18px" }}>{tl.soonSub}</p>
            {estaLogado
              ? <><a href={MONTAR_TIME} style={botaoOutline}>{tl.montarTimeBtn}</a>{cardInstalar}</>
              : <><a href={registar} style={botaoGold}>{tl.registarBtn}</a><p style={{ color: "#6f7d76", fontSize: 11.5, marginTop: 10 }}>{tl.gratisNota}</p></>}
          </div>
        )}

        {/* Estado 2 — chave montada: prévia (1ª categoria) + muro */}
        {pronta && destaque && (
          <>
            <CategoriaCard c={destaque} campo={tl.campo} />

            {estaLogado ? (
              <div style={{ marginTop: 16 }}>
                <div style={{ display: "grid", gap: 10 }}>
                  <a href={CHAVE_COMPLETA} style={botaoGold}>{tl.verChaveBtn}</a>
                  <a href={MONTAR_TIME} style={botaoOutline}>{tl.montarTimeBtn}</a>
                </div>
                {cardInstalar}
              </div>
            ) : (
              <div style={{ position: "relative", marginTop: 14 }}>
                {/* resto borrado por baixo do muro */}
                <div style={{ filter: "blur(5px)", opacity: 0.5, pointerEvents: "none", userSelect: "none", display: "grid", gap: 12 }} aria-hidden="true">
                  {(resto.length ? resto : [destaque]).map((c, i) => <CategoriaCard key={i} c={c} campo={tl.campo} />)}
                </div>
                {/* overlay do muro */}
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "linear-gradient(180deg, rgba(12,14,13,0.35), rgba(12,14,13,0.92))" }}>
                  <div style={{ ...caixa, maxWidth: 420, width: "100%", textAlign: "center", margin: 0 }}>
                    <div style={{ fontSize: 26, marginBottom: 6 }}>🔒</div>
                    <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 17, margin: "0 0 6px", textTransform: "uppercase" }}>{tl.lockTitulo}</h2>
                    <p style={{ color: DIM, fontSize: 13.5, lineHeight: 1.55, margin: "0 0 16px" }}>{tl.lockSub}</p>
                    <a href={registar} style={botaoGold}>{tl.registarBtn}</a>
                    <p style={{ color: "#6f7d76", fontSize: 11.5, marginTop: 10, marginBottom: 0 }}>{tl.gratisNota}</p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* a carregar */}
        {comp && !prev && <p style={{ color: DIM, textAlign: "center", fontSize: 14 }}>…</p>}

        {!estaLogado && (
          <p style={{ textAlign: "center", color: DIM, fontSize: 13, marginTop: 22 }}>
            {tl.jaTens}{" "}
            <a href="/entrar" style={{ color: TXT, fontWeight: 700, textDecoration: "none", borderBottom: `2px solid ${GOLD}`, paddingBottom: 1 }}>{tl.entrar}</a>
          </p>
        )}
        <p style={{ textAlign: "center", color: "#5f6f67", fontSize: 11, marginTop: 20 }}>{tl.rodape}</p>
      </div>
      {/* Passo a passo de instalação — o teu componente existente. */}
      <TutorialInstalar aberto={tut} onClose={() => setTut(false)} />
    </main>
  );
}

function CategoriaCard({ c, campo }: { c: Categoria; campo: string }) {
  const pools = ["A", "B", "C", "D"].filter((p) => (c.pools[p]?.length ?? 0) > 0);
  return (
    <div style={caixa}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ fontFamily: FONT_DISPLAY, fontSize: 18, fontWeight: 700, color: GOLD }}>{c.cat} kg</span>
        <span style={{ fontSize: 12, color: DIM }}>{c.total} {campo}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
        {pools.map((p) => (
          <div key={p} style={{ background: "#0e1210", border: `1px solid ${BORDA}`, borderRadius: 10, padding: "9px 10px" }}>
            <div style={{ fontSize: 10.5, color: DIM, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Pool {p}</div>
            <div style={{ display: "grid", gap: 4 }}>
              {c.pools[p].map((a) => (
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

const caixa: React.CSSProperties = { background: CARD, border: `1px solid ${BORDA}`, borderRadius: 16, padding: 18 };
const botaoGold: React.CSSProperties = { display: "block", textAlign: "center", padding: "14px 18px", borderRadius: 12, background: GOLD, color: "#1b211e", fontFamily: FONT_DISPLAY, fontSize: 15, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", textDecoration: "none" };
const botaoOutline: React.CSSProperties = { display: "block", textAlign: "center", padding: "13px 18px", borderRadius: 12, background: "transparent", color: TXT, border: `1px solid ${BORDA}`, fontFamily: FONT_DISPLAY, fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", textDecoration: "none" };
