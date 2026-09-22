// app/api/verificar-email/route.ts
//
// VERIFICAÇÃO DE EMAIL — enviar a ligação e confirmar quem clica.
//
// ---------------------------------------------------------------------------
// O DESENHO (decidido com o Kainan)
//
// A pessoa regista-se e joga LOGO. Não há barreira nenhuma no registo — montar
// a equipa é o momento em que ela se entusiasma, e pô-la à espera de um email
// nesse instante é a forma mais rápida de a perder.
//
// Em troca, enquanto não confirmar:
//   • vê uma faixa na app
//   • recebe um lembrete POR DIA (um só — ver o cron)
//
// PORQUE NÃO SE USA A CONFIRMAÇÃO DO SUPABASE: com ela ligada, a pessoa não
// entra até confirmar. É o oposto do que se quer. E com ela desligada, o
// `email_confirmed_at` é preenchido automaticamente a cada registo, o que o
// torna inútil como indicador. Por isso a verificação é nossa, em colunas
// próprias (ver adicionar-verificacao-email.sql).
//
//   GET  /api/verificar-email?token=...      -> confirma e redireciona
//   POST /api/verificar-email  { acao }       -> "enviar" (pedido do próprio)
//        ?cron=1&key=CRON_SECRET              -> lote diário (chamado pelo cron)
//
// IDIOMA: o corpo e o assunto do email saem NA LÍNGUA da pessoa (users.lingua).
// Os textos vivem no dicionário do servidor (lib/dicionarioNotif) e renderizam-se
// com renderNotif — o mesmo caminho das notificações. Se a pessoa não tem língua
// definida, cai no português.
// ---------------------------------------------------------------------------
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { type LinguaNotif } from "@/lib/dicionarioNotif";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Quanto tempo a ligação serve. Curto o bastante para não andar por aí. */
const VALIDADE_HORAS = 72;

const MAIL_FROM = process.env.MAIL_FROM || "Ippon League <support@ipponleague.com>";

/** Normaliza o valor de users.lingua para uma das 5 línguas (fallback pt). */
function normLingua(v: unknown): LinguaNotif {
  const s = String(v || "").toLowerCase();
  return (["pt", "en", "es", "fr", "de"].includes(s) ? s : "pt") as LinguaNotif;
}

// Texto do email de confirmação, com tom caloroso, por língua. Mapa local (mesmo
// padrão do resto da app) para não depender do dicionário global. {nome} já vem
// escapado; a frase inclui <strong>Ippon League</strong> (HTML de confiança).
type TxtEmail = {
  assunto: string;
  saud: (nome: string) => string;
  frase: string;
  botao: string;
  validade: (horas: number) => string;
  ignora: string;
  naoResponder: string;
};
const EMAIL: Record<LinguaNotif, TxtEmail> = {
  pt: {
    assunto: "Confirma o teu email — Ippon League",
    saud: (nome) => (nome ? `Olá, ${nome}! Que bom ter-te connosco.` : "Olá! Que bom ter-te connosco."),
    frase: "Estamos muito felizes por te ter na <strong>Ippon League</strong>, o jogo oficial dos fãs de judo. Confirma o teu email para garantires a tua conta e não perderes nada das próximas competições.",
    botao: "Confirmar email",
    validade: (h) => `Esta ligação é válida durante ${h} horas.`,
    ignora: "Se não foste tu a criar esta conta, é só ignorar este email.",
    naoResponder: "Este email é automático — não precisas de responder.",
  },
  en: {
    assunto: "Confirm your email — Ippon League",
    saud: (nome) => (nome ? `Hi ${nome}! Great to have you with us.` : "Hi! Great to have you with us."),
    frase: "We're really happy to have you at <strong>Ippon League</strong>, the official game for judo fans. Confirm your email to secure your account and never miss a thing in the upcoming competitions.",
    botao: "Confirm email",
    validade: (h) => `This link is valid for ${h} hours.`,
    ignora: "If you didn't create this account, just ignore this email.",
    naoResponder: "This is an automated email — no need to reply.",
  },
  es: {
    assunto: "Confirma tu email — Ippon League",
    saud: (nome) => (nome ? `¡Hola, ${nome}! Qué bueno tenerte con nosotros.` : "¡Hola! Qué bueno tenerte con nosotros."),
    frase: "Estamos muy contentos de tenerte en <strong>Ippon League</strong>, el juego oficial de los aficionados al judo. Confirma tu email para asegurar tu cuenta y no perderte nada de las próximas competiciones.",
    botao: "Confirmar email",
    validade: (h) => `Este enlace es válido durante ${h} horas.`,
    ignora: "Si no fuiste tú quien creó esta cuenta, simplemente ignora este email.",
    naoResponder: "Este email es automático — no necesitas responder.",
  },
  fr: {
    assunto: "Confirme ton email — Ippon League",
    saud: (nome) => (nome ? `Salut ${nome} ! Ravis de t'avoir avec nous.` : "Salut ! Ravis de t'avoir avec nous."),
    frase: "Nous sommes très heureux de t'accueillir sur <strong>Ippon League</strong>, le jeu officiel des fans de judo. Confirme ton email pour sécuriser ton compte et ne rien manquer des prochaines compétitions.",
    botao: "Confirmer l'email",
    validade: (h) => `Ce lien est valable pendant ${h} heures.`,
    ignora: "Si tu n'es pas à l'origine de ce compte, ignore simplement cet email.",
    naoResponder: "Cet email est automatique — pas besoin d'y répondre.",
  },
  de: {
    assunto: "Bestätige deine E-Mail — Ippon League",
    saud: (nome) => (nome ? `Hallo ${nome}! Schön, dass du dabei bist.` : "Hallo! Schön, dass du dabei bist."),
    frase: "Wir freuen uns sehr, dich bei <strong>Ippon League</strong> zu haben, dem offiziellen Spiel für Judo-Fans. Bestätige deine E-Mail, um dein Konto zu sichern und bei den nächsten Wettkämpfen nichts zu verpassen.",
    botao: "E-Mail bestätigen",
    validade: (h) => `Dieser Link ist ${h} Stunden gültig.`,
    ignora: "Falls du dieses Konto nicht erstellt hast, ignoriere diese E-Mail einfach.",
    naoResponder: "Diese E-Mail ist automatisch — du musst nicht antworten.",
  },
};

function novoToken(): string {
  // 32 caracteres hexadecimais: impossível de adivinhar, e passa bem num URL.
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");
}

// Escapa texto para HTML.
//
// NOTA sobre a forma como está escrito: as entidades são montadas a partir dos
// seus códigos numéricos em vez de aparecerem literais no código. Parece um
// rodeio, mas tem razão de ser — a versão com "&quot;" escrito à letra já se
// corrompeu uma vez ao passar por um documento Word (ficou como três aspas
// seguidas, sintaxe inválida, e a rota deixou de compilar sem que o deploy
// acusasse nada). Assim o ficheiro sobrevive a qualquer conversão de texto.
const E_AMP = String.fromCharCode(38) + "amp;";
const E_LT = String.fromCharCode(38) + "lt;";
const E_GT = String.fromCharCode(38) + "gt;";
const E_QUOT = String.fromCharCode(38) + "quot;";

function esc(v: string): string {
  return String(v)
    .split("&").join(E_AMP)
    .split("<").join(E_LT)
    .split(">").join(E_GT)
    .split(String.fromCharCode(34)).join(E_QUOT);
}

function baseUrl(req: Request): string {
  try {
    const u = new URL(req.url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return "https://www.ipponleague.com";
  }
}

/**
 * Envia (ou reenvia) a ligação de confirmação.
 * Gera sempre um token novo: o anterior deixa de servir, e assim uma ligação
 * antiga esquecida numa caixa de correio não fica válida para sempre.
 */
async function enviarLigacao(uid: string, email: string, nome: string, base: string, lingua: LinguaNotif): Promise<boolean> {
  if (!supabaseAdmin) return false;
  const apiKey = process.env.RESEND_API_KEY;
  const token = novoToken();
  const expira = new Date(Date.now() + VALIDADE_HORAS * 3600 * 1000).toISOString();

  const { error } = await supabaseAdmin
    .from("users")
    .update({ token_verificacao: token, token_expira_em: expira, ultimo_lembrete_email: new Date().toISOString() })
    .eq("id", uid);
  if (error) return false;
  if (!apiKey || !email) return false;

  const link = `${base}/api/verificar-email?token=${token}`;
  const primeiroNome = esc((nome || "").trim().split(" ")[0]);

  // Textos do email na língua da pessoa (mapa EMAIL, no topo do ficheiro).
  const txt = EMAIL[lingua];
  const saudacao = txt.saud(primeiroNome);
  const frase = txt.frase;
  const rotuloBotao = txt.botao;
  const validade = txt.validade(VALIDADE_HORAS);
  const ignora = txt.ignora;
  const naoResponder = txt.naoResponder;
  const assunto = txt.assunto;

  // Email com a cara da Ippon League. Layout em tabelas + estilos inline (é o que
  // os clientes de email — sobretudo o Outlook — renderizam de forma fiável). A
  // imagem do topo vem de um endereço público (o ícone da app). Os textos
  // (${...}) continuam a vir do dicionário, na língua da pessoa.
  const html = `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f1ea;margin:0;padding:24px 0">
    <tr><td align="center">
      <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e6e1d5">
        <tr><td align="center" style="background:#0c0e0d;padding:24px">
          <img src="https://www.ipponleague.com/icon-192.png" width="54" height="54" alt="Ippon League" style="display:block;border-radius:12px;margin:0 auto 10px">
          <div style="font-family:'IBM Plex Mono',Menlo,Consolas,monospace;font-size:17px;font-weight:700;letter-spacing:3px;color:#d9a441">IPPON LEAGUE</div>
        </td></tr>
        <tr><td style="padding:28px 28px 8px;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:15px;line-height:1.6;color:#1b211e">
          <p style="margin:0 0 14px">${saudacao}</p>
          <p style="margin:0 0 24px">${frase}</p>
          <table role="presentation" align="center" cellpadding="0" cellspacing="0" style="margin:0 auto 24px">
            <tr><td align="center" bgcolor="#d9a441" style="border-radius:10px">
              <a href="${link}" style="display:inline-block;padding:14px 34px;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:15px;font-weight:700;color:#1b211e;text-decoration:none;border-radius:10px">${rotuloBotao}</a>
            </td></tr>
          </table>
          <p style="margin:0 0 12px;color:#6c766d;font-size:13px">${validade}</p>
          <p style="margin:0 0 12px;color:#6c766d;font-size:13px">${ignora}</p>
          <p style="margin:0;color:#9aa39a;font-size:12px">${naoResponder}</p>
        </td></tr>
        <tr><td style="padding:18px 28px 24px;border-top:1px solid #eee;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:11px;line-height:1.5;color:#9aa39a">
          Ippon League 🥋
        </td></tr>
      </table>
    </td></tr>
  </table>`;

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: MAIL_FROM, to: [email], subject: assunto, html }),
    });
    return true;
  } catch {
    return false;
  }
}

/** Quem está a pedir, a partir do token de sessão. */
async function uidDoPedido(req: Request): Promise<string | null> {
  try {
    const auth = req.headers.get("authorization") || "";
    const t = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
    if (!t) return null;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const pub = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
    if (!url || !pub) return null;
    const sb = createClient(url, pub, {
      global: { headers: { Authorization: `Bearer ${t}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await sb.auth.getUser();
    if (error) return null;
    return data?.user?.id ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// GET — o clique na ligação do email.
//
// Redireciona sempre para a app (nunca mostra JSON): quem clica num email espera
// voltar ao produto, não ver um objeto técnico.
// ---------------------------------------------------------------------------
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = (searchParams.get("token") || "").trim();
  const base = baseUrl(req);
  if (!token || !supabaseAdmin) {
    return NextResponse.redirect(`${base}/inicio?email=erro`);
  }

  const { data: u } = await supabaseAdmin
    .from("users")
    .select("id, token_expira_em, email_verificado_em")
    .eq("token_verificacao", token)
    .maybeSingle();

  if (!u) return NextResponse.redirect(`${base}/inicio?email=invalido`);
  if (u.email_verificado_em) return NextResponse.redirect(`${base}/inicio?email=ja`);

  const expira = u.token_expira_em ? Date.parse(String(u.token_expira_em)) : 0;
  if (expira > 0 && Date.now() > expira) {
    return NextResponse.redirect(`${base}/inicio?email=expirado`);
  }

  // Confirmado. Limpamos o token: serve uma vez só.
  await supabaseAdmin
    .from("users")
    .update({ email_verificado_em: new Date().toISOString(), token_verificacao: null, token_expira_em: null })
    .eq("id", u.id);

  return NextResponse.redirect(`${base}/inicio?email=ok`);
}

// ---------------------------------------------------------------------------
// POST — pedir o email (o próprio), ou o lote diário (o cron).
// ---------------------------------------------------------------------------
export async function POST(req: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ ok: false, erro: "Servidor sem ligação." }, { status: 500 });
  }
  const { searchParams } = new URL(req.url);
  const base = baseUrl(req);

  // --- LOTE DIÁRIO (cron) ---
  // Um lembrete por dia a quem ainda não confirmou. A guarda das 20 horas é o
  // que garante o "um por dia" mesmo com o cron a correr de hora a hora — foi
  // exatamente assim que as faixas mandaram 24 notificações no mesmo dia.
  if (searchParams.get("cron") === "1") {
    const key = (searchParams.get("key") || "").trim();
    if (!process.env.CRON_SECRET || key !== process.env.CRON_SECRET) {
      return NextResponse.json({ ok: false, erro: "Não autorizado." }, { status: 401 });
    }
    const limite = new Date(Date.now() - 20 * 3600 * 1000).toISOString();
    const { data: porVerificar } = await supabaseAdmin
      .from("users")
      .select("id, email, name, lingua, ultimo_lembrete_email")
      .is("email_verificado_em", null)
      .or(`ultimo_lembrete_email.is.null,ultimo_lembrete_email.lt.${limite}`)
      .limit(100);

    let enviados = 0;
    for (const u of porVerificar || []) {
      const ok = await enviarLigacao(String(u.id), String(u.email || ""), String(u.name || ""), base, normLingua(u.lingua));
      if (ok) enviados++;
    }
    return NextResponse.json({ ok: true, candidatos: (porVerificar || []).length, enviados });
  }

  // --- PEDIDO DO PRÓPRIO ("reenviar-me o email") ---
  const uid = await uidDoPedido(req);
  if (!uid) return NextResponse.json({ ok: false, erro: "Entra na tua conta." }, { status: 401 });

  const { data: u } = await supabaseAdmin
    .from("users")
    .select("email, name, lingua, email_verificado_em, ultimo_lembrete_email")
    .eq("id", uid).maybeSingle();
  if (!u) return NextResponse.json({ ok: false, erro: "Conta não encontrada." }, { status: 404 });
  if (u.email_verificado_em) return NextResponse.json({ ok: true, jaVerificado: true });

  // Travão simples contra cliques repetidos: 2 minutos entre envios.
  const ultimo = u.ultimo_lembrete_email ? Date.parse(String(u.ultimo_lembrete_email)) : 0;
  if (ultimo > 0 && Date.now() - ultimo < 2 * 60 * 1000) {
    return NextResponse.json({ ok: true, jaEnviado: true, nota: "Acabámos de enviar. Vê a tua caixa de entrada (e o spam)." });
  }

  const ok = await enviarLigacao(uid, String(u.email || ""), String(u.name || ""), base, normLingua(u.lingua));
  return NextResponse.json({ ok, enviado: ok });
}
