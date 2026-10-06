// app/api/promo/emails/route.ts
//
// SEQUÊNCIA DE E-MAILS DA OFERTA DE LANÇAMENTO (Fundador) — SÓ SERVIDOR.
//
//   GET /api/promo/emails?key=CRON_SECRET          -> corrida real (envia)
//   GET /api/promo/emails?key=CRON_SECRET&seco=1   -> ensaio (só conta, não envia)
//
// Envia, na língua de cada pessoa, os e-mails automáticos da conversão à volta do
// penhasco de 1 de janeiro de 2027 (decisão 06/10/2026 — Pro Max grátis para toda
// a base até ao início do ano; ver claude/sequencia-emails-oferta.md e
// claude/estrategia-unicornio.md). O molde é o partilhado (lib/email -> emailHtmlBase),
// o mesmo da verificação e do reengajamento.
//
// QUEM RECEBE (todos os tipos): Fundadores (users.fundador = true, selo permanente
// que resiste ao penhasco), que NUNCA subscreveram na Stripe (stripe_subscription_id
// nulo -> ainda não pagam) e que deram consentimento de marketing explícito
// (aceita_email_marketing = true, RGPD). Quem entretanto subscreveu fica de fora.
//
// QUANDO (janelas em UTC, guiadas pelo penhasco de 01/01/2027):
//   promo_e1  Bem-vindo ao Pro Max (Fundador)  — ~1 dia após o registo, até ao penhasco
//   promo_e3  Faltam 7 dias                     — 25/12 a 29/12
//   promo_e4  Faltam 2 dias                     — 30/12 a 31/12
//   promo_e5  A tua experiência terminou        — 01/01 em diante (janela de 9 dias)
//
// IDEMPOTÊNCIA: reserva primeiro em promo_emails_enviados (PK user_id+tipo). Se já
// existe, salta; se o envio falha, apaga a reserva para tentar na corrida seguinte.
// Assim cada pessoa recebe cada e-mail uma só vez, mesmo com o cron de hora a hora.
//
// MOMENTO DE LIGAR O CRON (cron-job.org, 1x/dia): só é preciso perto de meados de
// dezembro (o primeiro envio por data fixa é a 25/12). Antes disso, a única janela
// ativa é a do promo_e1 (boas-vindas a quem se registou há ~1 dia). Para testar sem
// enviar nada, usar ?seco=1.
//
// NOTA (copy do promo_e1): o texto refere o Mundial (contexto de outubro). Para
// Fundadores que se registem muito depois do Mundial, o Kainan pode querer ajustar
// essa copy — está toda neste ficheiro, no mapa EMAILS.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { enviarEmailResend, emailHtmlBase, escHtml } from "@/lib/email";
import { registarCorrida } from "@/lib/cronLog";
import { type LinguaNotif } from "@/lib/dicionarioNotif";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SITE = "https://www.ipponleague.com";

// O penhasco (fim do acesso grátis). Guia as janelas dos e-mails por data fixa.
const PENHASCO_ISO = "2027-01-01T00:00:00Z";

// Para onde leva o botão de cada e-mail.
const LINK: Record<string, string> = {
  promo_e1: `${SITE}/criar-equipa`,
  promo_e3: `${SITE}/ippon-pro`,
  promo_e4: `${SITE}/ippon-pro`,
  promo_e5: `${SITE}/ippon-pro`,
};

const TIPOS = ["promo_e1", "promo_e3", "promo_e4", "promo_e5"] as const;
type Tipo = (typeof TIPOS)[number];

function normLingua(v: unknown): LinguaNotif {
  const s = String(v || "").toLowerCase();
  return (["pt", "en", "es", "fr", "de", "ja", "ru"].includes(s) ? s : "pt") as LinguaNotif;
}

// Palavra para substituir {nome} quando a pessoa não tem nome definido.
const FALLBACK_NOME: Record<LinguaNotif, string> = {
  pt: "campeão", en: "champion", es: "campeón", fr: "champion", de: "Champion", ja: "チャンピオン", ru: "чемпион",
};

// Rodapé partilhado: nota de marketing (opt-out) + linha de "e-mail automático".
// __PERFIL__ é trocado pelo link do perfil no render. Como o consentimento é
// opt-in explícito (aceita_email_marketing), a gestão de preferências vive no perfil.
const RODAPE: Record<LinguaNotif, { optout: string; naoResponder: string }> = {
  pt: {
    optout: `Recebes este e-mail porque ativaste as novidades da Ippon League. Podes gerir as tuas preferências no teu <a href="__PERFIL__" style="color:#6c766d">perfil</a>.`,
    naoResponder: "Este e-mail é automático, não precisas de responder.",
  },
  en: {
    optout: `You are getting this email because you turned on Ippon League updates. You can manage your preferences in your <a href="__PERFIL__" style="color:#6c766d">profile</a>.`,
    naoResponder: "This is an automated email, no need to reply.",
  },
  es: {
    optout: `Recibes este e-mail porque activaste las novedades de Ippon League. Puedes gestionar tus preferencias en tu <a href="__PERFIL__" style="color:#6c766d">perfil</a>.`,
    naoResponder: "Este e-mail es automático, no necesitas responder.",
  },
  fr: {
    optout: `Tu reçois cet e-mail parce que tu as activé les nouveautés d'Ippon League. Tu peux gérer tes préférences dans ton <a href="__PERFIL__" style="color:#6c766d">profil</a>.`,
    naoResponder: "Cet e-mail est automatique, pas besoin d'y répondre.",
  },
  de: {
    optout: `Du erhältst diese E-Mail, weil du die Neuigkeiten der Ippon League aktiviert hast. Deine Einstellungen kannst du in deinem <a href="__PERFIL__" style="color:#6c766d">Profil</a> verwalten.`,
    naoResponder: "Diese E-Mail ist automatisch, du musst nicht antworten.",
  },
  ja: {
    optout: `このメールは、Ippon Leagueのお知らせを有効にしているためお届けしています。設定は<a href="__PERFIL__" style="color:#6c766d">プロフィール</a>で管理できます。`,
    naoResponder: "これは自動送信メールです。返信は不要です。",
  },
  ru: {
    optout: `Ты получаешь это письмо, потому что включил новости Ippon League. Настройки можно изменить в своём <a href="__PERFIL__" style="color:#6c766d">профиле</a>.`,
    naoResponder: "Это автоматическое письмо, отвечать не нужно.",
  },
};

// ---------------------------------------------------------------------------
// TEXTOS por e-mail e por língua (copy aprovada em claude/sequencia-emails-oferta.md).
// saud e corpo trazem {nome} (substituído, já escapado); corpo pode ter HTML de
// confiança. Sem travessões (regra do projeto). Delimitados por backticks porque
// alguns corpos têm aspas " a sério (ex.: "valoriza a partir de X pts").
// ---------------------------------------------------------------------------
type Txt = { assunto: string; saud: string; corpo: string; botao: string };
const EMAILS: Record<Tipo, Record<LinguaNotif, Txt>> = {
  promo_e1: {
    pt: {
      assunto: `Tens o Pro Max desbloqueado, joga o Mundial com tudo 🥋`,
      saud: `Olá, {nome}!`,
      corpo: `Como Fundador da Ippon League, tens o Pro Max grátis até 1 de janeiro, sem pagar nada. Isso é a chave ao vivo, ver quem vai valorizar, as probabilidades da chave e o confronto direto entre atletas, já a partir do Mundial. Monta a tua equipa e sente o jogo por dentro. A tua experiência de Fundador vai até 1 de janeiro, e o selo de Fundador fica contigo para sempre.`,
      botao: `Montar a minha equipa`,
    },
    en: {
      assunto: `Your Pro Max is unlocked, play the Worlds with everything 🥋`,
      saud: `Hi {nome}!`,
      corpo: `As a Founder of Ippon League, you have Pro Max free until January 1, at no cost. That means the live bracket, seeing who is about to rise in value, the bracket odds and head to head between athletes, starting right at the Worlds. Build your team and feel the game from the inside. Your Founder experience runs until January 1, and the Founder badge is yours forever.`,
      botao: `Build my team`,
    },
    es: {
      assunto: `Tienes el Pro Max desbloqueado, juega el Mundial con todo 🥋`,
      saud: `¡Hola, {nome}!`,
      corpo: `Como Fundador de Ippon League, tienes el Pro Max gratis hasta el 1 de enero, sin pagar nada. Eso es el cuadro en vivo, ver quién va a subir de valor, las probabilidades del cuadro y el enfrentamiento directo entre atletas, ya desde el Mundial. Arma tu equipo y siente el juego por dentro. Tu experiencia de Fundador va hasta el 1 de enero, y el sello de Fundador se queda contigo para siempre.`,
      botao: `Armar mi equipo`,
    },
    fr: {
      assunto: `Ton Pro Max est débloqué, joue les Mondiaux avec tout 🥋`,
      saud: `Salut {nome} !`,
      corpo: `En tant que Fondateur d'Ippon League, tu as le Pro Max gratuit jusqu'au 1 janvier, sans rien payer. C'est le tableau en direct, voir qui va prendre de la valeur, les probabilités du tableau et le duel direct entre athlètes, dès les Mondiaux. Compose ton équipe et vis le jeu de l'intérieur. Ton expérience de Fondateur dure jusqu'au 1 janvier, et le badge de Fondateur reste à toi pour toujours.`,
      botao: `Composer mon équipe`,
    },
    de: {
      assunto: `Dein Pro Max ist freigeschaltet, spiel die WM mit allem 🥋`,
      saud: `Hallo {nome}!`,
      corpo: `Als Gründer der Ippon League hast du Pro Max gratis bis zum 1. Januar, ohne etwas zu zahlen. Das heißt der Live-Baum, sehen wer gleich im Wert steigt, die Baum-Wahrscheinlichkeiten und das direkte Duell zwischen Athleten, schon ab der WM. Stell dein Team auf und erlebe das Spiel von innen. Deine Gründer-Erfahrung läuft bis zum 1. Januar, und das Gründer-Abzeichen bleibt für immer deins.`,
      botao: `Mein Team aufstellen`,
    },
    ja: {
      assunto: `Pro Maxが解放されました。世界選手権をフル装備で 🥋`,
      saud: `こんにちは、{nome}さん！`,
      corpo: `Ippon Leagueの創設メンバーとして、1月1日までPro Maxを無料で使えます。費用はかかりません。ライブの組み合わせ、誰が価値を上げるか、組み合わせの勝率、選手同士の直接対決が、世界選手権からすぐに使えます。チームを組んで、ゲームを内側から感じよう。あなたの創設メンバー体験は1月1日まで、創設メンバーのバッジはずっとあなたのものです。`,
      botao: `チームを組む`,
    },
    ru: {
      assunto: `Твой Pro Max открыт — играй чемпионат мира на полную 🥋`,
      saud: `Привет, {nome}!`,
      corpo: `Как Основатель Ippon League, ты получаешь Pro Max бесплатно до 1 января, без оплаты. Это живая сетка, возможность видеть, кто вот-вот вырастет в цене, вероятности по сетке и очные сравнения атлетов — уже с чемпионата мира. Собери команду и почувствуй игру изнутри. Твой опыт Основателя длится до 1 января, а значок Основателя остаётся твоим навсегда.`,
      botao: `Собрать команду`,
    },
  },
  promo_e3: {
    pt: {
      assunto: `Faltam 7 dias do teu Pro Max de Fundador`,
      saud: `Olá, {nome}!`,
      corpo: `O teu acesso grátis ao Pro Max termina a 1 de janeiro. Se quiseres manter a vantagem, a chave ao vivo, a leitura de valorização e as probabilidades da chave, fica com o preço de lançamento: Pro Max por 6,99 € em vez de 9,99 €, ou Pro por 5,99 €. Trava já o teu preço de Fundador.`,
      botao: `Ver a minha oferta`,
    },
    en: {
      assunto: `7 days left of your Founder Pro Max`,
      saud: `Hi {nome}!`,
      corpo: `Your free access to Pro Max ends on January 1. If you want to keep the edge, the live bracket, the value reading and the bracket odds, take the launch price: Pro Max for 6.99 € instead of 9.99 €, or Pro for 5.99 €. Lock in your Founder price now.`,
      botao: `See my offer`,
    },
    es: {
      assunto: `Quedan 7 días de tu Pro Max de Fundador`,
      saud: `¡Hola, {nome}!`,
      corpo: `Tu acceso gratis al Pro Max termina el 1 de enero. Si quieres mantener la ventaja, el cuadro en vivo, la lectura de valorización y las probabilidades del cuadro, quédate con el precio de lanzamiento: Pro Max por 6,99 € en vez de 9,99 €, o Pro por 5,99 €. Asegura ya tu precio de Fundador.`,
      botao: `Ver mi oferta`,
    },
    fr: {
      assunto: `Il reste 7 jours de ton Pro Max de Fondateur`,
      saud: `Salut {nome} !`,
      corpo: `Ton accès gratuit au Pro Max se termine le 1 janvier. Si tu veux garder l'avantage, le tableau en direct, la lecture de la valeur et les probabilités du tableau, prends le prix de lancement: Pro Max à 6,99 € au lieu de 9,99 €, ou Pro à 5,99 €. Verrouille ton prix de Fondateur maintenant.`,
      botao: `Voir mon offre`,
    },
    de: {
      assunto: `Noch 7 Tage deines Gründer-Pro-Max`,
      saud: `Hallo {nome}!`,
      corpo: `Dein kostenloser Zugang zu Pro Max endet am 1. Januar. Wenn du den Vorteil behalten willst, den Live-Baum, die Wert-Lesart und die Baum-Wahrscheinlichkeiten, nimm den Startpreis: Pro Max für 6,99 € statt 9,99 €, oder Pro für 5,99 €. Sichere dir jetzt deinen Gründer-Preis.`,
      botao: `Mein Angebot ansehen`,
    },
    ja: {
      assunto: `創設メンバーのPro Maxは残り7日`,
      saud: `こんにちは、{nome}さん！`,
      corpo: `Pro Maxの無料アクセスは1月1日で終了します。優位性、ライブの組み合わせ、価値上昇の読み、組み合わせの勝率を維持したいなら、ローンチ価格をどうぞ：Pro Maxは9,99 €のところ6,99 €、またはProが5,99 €。今すぐ創設メンバー価格を確保しよう。`,
      botao: `自分のオファーを見る`,
    },
    ru: {
      assunto: `Остаётся 7 дней твоего Pro Max Основателя`,
      saud: `Привет, {nome}!`,
      corpo: `Бесплатный доступ к Pro Max заканчивается 1 января. Если хочешь сохранить преимущество — живую сетку, чтение роста цены и вероятности по сетке — возьми цену запуска: Pro Max за 6,99 € вместо 9,99 €, или Pro за 5,99 €. Зафиксируй свою цену Основателя прямо сейчас.`,
      botao: `Посмотреть моё предложение`,
    },
  },
  promo_e4: {
    pt: {
      assunto: `Faltam 2 dias, é isto que vais deixar de ter`,
      saud: `Olá, {nome}!`,
      corpo: `A 1 de janeiro o teu Pro Max de Fundador termina. Sem ele deixas de ter a chave ao vivo, o "valoriza a partir de X pts", o conteúdo de valorização da rodada, as probabilidades da chave e o confronto direto, e as tuas ligas passam a caber só uma. Mantém tudo por 6,99 €, ou fica com o essencial por 5,99 €, sempre com o preço de lançamento.`,
      botao: `Manter a minha vantagem`,
    },
    en: {
      assunto: `2 days left, here is what you will lose`,
      saud: `Hi {nome}!`,
      corpo: `On January 1 your Founder Pro Max ends. Without it you lose the live bracket, the "rises in value from X pts", the round value content, the bracket odds and the head to head, and your leagues drop to just one. Keep everything for 6.99 €, or keep the essentials for 5.99 €, always at the launch price.`,
      botao: `Keep my edge`,
    },
    es: {
      assunto: `Quedan 2 días, esto es lo que vas a dejar de tener`,
      saud: `¡Hola, {nome}!`,
      corpo: `El 1 de enero termina tu Pro Max de Fundador. Sin él dejas de tener el cuadro en vivo, el "sube de valor desde X pts", el contenido de valorización de la ronda, las probabilidades del cuadro y el enfrentamiento directo, y tus ligas pasan a ser solo una. Mantén todo por 6,99 €, o quédate con lo esencial por 5,99 €, siempre con el precio de lanzamiento.`,
      botao: `Mantener mi ventaja`,
    },
    fr: {
      assunto: `Il reste 2 jours, voici ce que tu vas perdre`,
      saud: `Salut {nome} !`,
      corpo: `Le 1 janvier ton Pro Max de Fondateur se termine. Sans lui tu perds le tableau en direct, le "prend de la valeur à partir de X pts", le contenu de valeur du tour, les probabilités du tableau et le duel direct, et tes ligues tombent à une seule. Garde tout pour 6,99 €, ou garde l'essentiel pour 5,99 €, toujours au prix de lancement.`,
      botao: `Garder mon avantage`,
    },
    de: {
      assunto: `Noch 2 Tage, das verlierst du`,
      saud: `Hallo {nome}!`,
      corpo: `Am 1. Januar endet dein Gründer-Pro-Max. Ohne ihn verlierst du den Live-Baum, das "steigt im Wert ab X Punkten", die Wert-Inhalte der Runde, die Baum-Wahrscheinlichkeiten und das direkte Duell, und deine Ligen fallen auf nur eine. Behalte alles für 6,99 €, oder behalte das Wesentliche für 5,99 €, immer zum Startpreis.`,
      botao: `Meinen Vorteil behalten`,
    },
    ja: {
      assunto: `残り2日。これが使えなくなります`,
      saud: `こんにちは、{nome}さん！`,
      corpo: `1月1日に創設メンバーのPro Maxが終了します。それがないと、ライブの組み合わせ、「Xポイントから価値が上がる」、ラウンドの価値上昇コンテンツ、組み合わせの勝率、直接対決が使えなくなり、リーグは1つだけになります。すべてを6,99 €で維持、または基本を5,99 €で、どちらもローンチ価格です。`,
      botao: `優位性を維持する`,
    },
    ru: {
      assunto: `Остаётся 2 дня — вот что ты потеряешь`,
      saud: `Привет, {nome}!`,
      corpo: `1 января твой Pro Max Основателя закончится. Без него ты теряешь живую сетку, «растёт в цене от X очк.», контент о росте цены за тур, вероятности по сетке и очное сравнение, а твои лиги сократятся до одной. Сохрани всё за 6,99 € или оставь главное за 5,99 €, всегда по цене запуска.`,
      botao: `Сохранить преимущество`,
    },
  },
  promo_e5: {
    pt: {
      assunto: `A tua experiência de Fundador terminou 🥋`,
      saud: `Olá, {nome}!`,
      corpo: `Obrigado por teres estado connosco desde o início, o teu selo de Fundador fica contigo para sempre. O acesso grátis ao Pro Max terminou, mas o teu preço de lançamento ainda está de pé: Pro Max 6,99 € ou Pro 5,99 €. A tua equipa continua aqui à tua espera, volta à vantagem quando quiseres.`,
      botao: `Recuperar o Pro Max`,
    },
    en: {
      assunto: `Your Founder experience has ended 🥋`,
      saud: `Hi {nome}!`,
      corpo: `Thank you for being with us from the start, your Founder badge is yours forever. Free access to Pro Max has ended, but your launch price still stands: Pro Max 6.99 € or Pro 5.99 €. Your team is still here waiting for you, come back to the edge whenever you want.`,
      botao: `Get Pro Max back`,
    },
    es: {
      assunto: `Tu experiencia de Fundador ha terminado 🥋`,
      saud: `¡Hola, {nome}!`,
      corpo: `Gracias por estar con nosotros desde el principio, tu sello de Fundador se queda contigo para siempre. El acceso gratis al Pro Max terminó, pero tu precio de lanzamiento sigue en pie: Pro Max 6,99 € o Pro 5,99 €. Tu equipo sigue aquí esperándote, vuelve a la ventaja cuando quieras.`,
      botao: `Recuperar el Pro Max`,
    },
    fr: {
      assunto: `Ton expérience de Fondateur est terminée 🥋`,
      saud: `Salut {nome} !`,
      corpo: `Merci d'avoir été avec nous depuis le début, ton badge de Fondateur reste à toi pour toujours. L'accès gratuit au Pro Max est terminé, mais ton prix de lancement tient toujours: Pro Max 6,99 € ou Pro 5,99 €. Ton équipe est encore là à t'attendre, reviens à l'avantage quand tu veux.`,
      botao: `Récupérer le Pro Max`,
    },
    de: {
      assunto: `Deine Gründer-Erfahrung ist zu Ende 🥋`,
      saud: `Hallo {nome}!`,
      corpo: `Danke, dass du von Anfang an dabei warst, dein Gründer-Abzeichen bleibt für immer deins. Der kostenlose Zugang zu Pro Max ist zu Ende, aber dein Startpreis steht weiter: Pro Max 6,99 € oder Pro 5,99 €. Dein Team wartet hier weiter auf dich, komm zurück zum Vorteil, wann immer du willst.`,
      botao: `Pro Max zurückholen`,
    },
    ja: {
      assunto: `創設メンバー体験が終了しました 🥋`,
      saud: `こんにちは、{nome}さん！`,
      corpo: `最初から一緒にいてくれてありがとう。創設メンバーのバッジはずっとあなたのものです。Pro Maxの無料アクセスは終了しましたが、あなたのローンチ価格はまだ有効です：Pro Max 6,99 € または Pro 5,99 €。あなたのチームはここで待っています。いつでも優位性に戻ってこられます。`,
      botao: `Pro Maxを取り戻す`,
    },
    ru: {
      assunto: `Твой опыт Основателя завершился 🥋`,
      saud: `Привет, {nome}!`,
      corpo: `Спасибо, что был с нами с самого начала — твой значок Основателя остаётся твоим навсегда. Бесплатный доступ к Pro Max закончился, но твоя цена запуска всё ещё в силе: Pro Max 6,99 € или Pro 5,99 €. Твоя команда по-прежнему ждёт тебя — вернись к преимуществу, когда захочешь.`,
      botao: `Вернуть Pro Max`,
    },
  },
};

type LinhaUser = { id: string; email: string | null; name: string | null; lingua: string | null; first_seen_at: string | null };

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const key = (searchParams.get("key") || "").trim();
  if (!process.env.CRON_SECRET || key !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, erro: "Não autorizado." }, { status: 401 });
  }
  const admin = supabaseAdmin;
  if (!admin) {
    return NextResponse.json({ ok: false, erro: "Servidor sem ligação." }, { status: 500 });
  }
  const seco = searchParams.get("seco") === "1"; // ensaio: não envia nem reserva
  const t0 = Date.now();
  const nowMs = t0;

  // Que e-mails estão na janela de envio hoje (UTC).
  function naJanela(tipo: Tipo): boolean {
    const penhasco = Date.parse(PENHASCO_ISO);
    if (tipo === "promo_e1") return nowMs < penhasco;
    if (tipo === "promo_e3") return nowMs >= Date.parse("2026-12-25T00:00:00Z") && nowMs < Date.parse("2026-12-30T00:00:00Z");
    if (tipo === "promo_e4") return nowMs >= Date.parse("2026-12-30T00:00:00Z") && nowMs < penhasco;
    if (tipo === "promo_e5") return nowMs >= penhasco && nowMs < Date.parse("2027-01-10T00:00:00Z");
    return false;
  }

  // Candidatos a um tipo: Fundadores, sem Stripe, com consentimento e e-mail.
  // promo_e1 ainda restringe a quem se registou há ~1 dia (janela de 7 dias a 20h).
  // `db` chega já verificado (não-nulo) de quem chama, para o TS não perder a
  // narrowing dentro desta função aninhada.
  async function candidatos(db: NonNullable<typeof supabaseAdmin>, tipo: Tipo): Promise<LinhaUser[]> {
    let q = db
      .from("users")
      .select("id, email, name, lingua, first_seen_at")
      .eq("fundador", true)
      .is("stripe_subscription_id", null)
      .eq("aceita_email_marketing", true)
      .not("email", "is", null)
      .limit(1000);
    if (tipo === "promo_e1") {
      const lo = new Date(nowMs - 7 * 24 * 3600 * 1000).toISOString();
      const hi = new Date(nowMs - 20 * 3600 * 1000).toISOString();
      q = q.gte("first_seen_at", lo).lte("first_seen_at", hi);
    }
    const { data } = await q;
    return (data || []) as LinhaUser[];
  }

  // Monta e envia um e-mail a uma pessoa. Devolve o id do Resend (ou null).
  async function enviarUm(tipo: Tipo, u: LinhaUser): Promise<string | null> {
    const lingua = normLingua(u.lingua);
    const txt = EMAILS[tipo][lingua];
    const primeiro = escHtml(String(u.name || "").trim().split(" ")[0] || FALLBACK_NOME[lingua]);
    const subst = (s: string) => s.split("{nome}").join(primeiro);
    const rod = RODAPE[lingua];
    const html = emailHtmlBase({
      saudacao: subst(txt.saud),
      corpo: subst(txt.corpo),
      botaoTexto: txt.botao,
      botaoLink: LINK[tipo],
      notas: [rod.optout.split("__PERFIL__").join(`${SITE}/perfil`)],
      naoResponder: rod.naoResponder,
    });
    const r = await enviarEmailResend({
      to: String(u.email),
      subject: txt.assunto,
      html,
      tags: { tipo, user_id: String(u.id) },
    });
    return r.ok ? (r.id || "sem-id") : null;
  }

  const resumo: Record<string, { candidatos: number; enviados: number; falhas: number; janela: boolean }> = {};
  // Resumo achatado (só números) para registarCorrida — a mesma forma que o
  // promo/expirar usa (Record<string, number>). O detalhe rico vai só na resposta.
  function resumoFlat(): Record<string, number> {
    const f: Record<string, number> = { seco: seco ? 1 : 0 };
    for (const tipo of TIPOS) {
      const r = resumo[tipo];
      if (!r) continue;
      f[`${tipo}.candidatos`] = r.candidatos;
      f[`${tipo}.enviados`] = r.enviados;
      f[`${tipo}.falhas`] = r.falhas;
    }
    return f;
  }
  try {
    for (const tipo of TIPOS) {
      const janela = naJanela(tipo);
      if (!janela) { resumo[tipo] = { candidatos: 0, enviados: 0, falhas: 0, janela: false }; continue; }
      const lista = await candidatos(admin, tipo);
      let enviados = 0;
      let falhas = 0;
      for (const u of lista) {
        if (seco) { enviados++; continue; } // ensaio: conta como "enviaria"
        // RESERVA PRIMEIRO: se a PK (user_id, tipo) já existe, já foi enviado -> salta.
        const { error: resErr } = await admin.from("promo_emails_enviados").insert({ user_id: u.id, tipo });
        if (resErr) continue;
        const id = await enviarUm(tipo, u);
        if (id) {
          enviados++;
          try { await admin.from("promo_emails_enviados").update({ resend_id: id }).eq("user_id", u.id).eq("tipo", tipo); } catch { /* o id é só para cruzar com webhooks */ }
        } else {
          // envio falhou: desfaz a reserva para tentar na próxima corrida.
          try { await admin.from("promo_emails_enviados").delete().eq("user_id", u.id).eq("tipo", tipo); } catch { /* idem */ }
          falhas++;
        }
      }
      resumo[tipo] = { candidatos: lista.length, enviados, falhas, janela: true };
    }

    try {
      const ms = Date.now() - t0;
      await registarCorrida({
        job: "promo_emails",
        ms,
        iniciadoMs: t0,
        observados: { "promo_emails.duracao_ms": ms },
        resumo: resumoFlat(),
      });
    } catch { /* observabilidade nunca bloqueia o cron */ }

    return NextResponse.json({ ok: true, seco, resumo });
  } catch (e) {
    try {
      const ms = Date.now() - t0;
      await registarCorrida({
        job: "promo_emails",
        ms,
        iniciadoMs: t0,
        observados: { "promo_emails.duracao_ms": ms },
        erro: String(e),
        resumo: resumoFlat(),
      });
    } catch { /* idem */ }
    console.error("[promo/emails] corrida falhou:", e);
    return NextResponse.json({ ok: false, erro: "Falha na corrida." }, { status: 500 });
  }
}
