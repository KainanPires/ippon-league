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
import { renderNotif, type LinguaNotif } from "@/lib/dicionarioNotif";

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
  const primeiroNome = (nome || "").trim().split(" ")[0] || renderNotif(lingua, "email.confirmarFallbackNome");

  // Textos na língua da pessoa. {marca} = "Ippon League" a negrito (HTML de
  // confiança, não escapado); {nome} = primeiro nome já escapado.
  const saudacao = renderNotif(lingua, "email.confirmarSaudacao", { nome: esc(primeiroNome) });
  const frase = renderNotif(lingua, "email.confirmarFrase", { marca: "<strong>Ippon League</strong>" });
  const rotuloBotao = renderNotif(lingua, "email.confirmarBotao");
  const validade = renderNotif(lingua, "email.confirmarValidade", { horas: VALIDADE_HORAS });
  const ignora = renderNotif(lingua, "email.confirmarIgnora");
  const assunto = renderNotif(lingua, "email.confirmarAssunto");

  const html = `
    <div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.6;color:#111;max-width:520px">
      <p style="margin:0 0 14px">${saudacao}</p>
      <p style="margin:0 0 14px">
        ${frase}
      </p>
      <p style="margin:0 0 20px">
        <a href="${link}" style="display:inline-block;background:#d9a441;color:#1b211e;text-decoration:none;font-weight:700;padding:13px 26px;border-radius:10px">
          ${rotuloBotao}
        </a>
      </p>
      <p style="margin:0 0 14px;color:#666;font-size:13px">
        ${validade}
      </p>
      <p style="margin:0;color:#666;font-size:13px">
        ${ignora}
      </p>
    </div>`;

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
