// app/api/contas-inativas/route.ts
//
// CONTAS INATIVAS — avisar, e depois libertar o nome.
//
// ---------------------------------------------------------------------------
// A REGRA
//
//   Conta GRATUITA parada há 1 ANO -> apagada.
//   Conta PAGA -> nunca, por muito tempo que fique parada.
//
// O nome do time é único: uma conta abandonada fica a ocupar um nome que outra
// pessoa pode querer. E não guardar dados de quem já não usa o serviço é boa
// prática (e o que o RGPD favorece).
//
// TRÊS AVISOS ANTES, e nunca uma surpresa:
//   11 meses          -> "faltam 30 dias"
//   11 meses e 3 sem. -> "faltam 7 dias"
//   1 ano             -> apagada
//
// Qualquer entrada na app reinicia a contagem e cancela os avisos.
//
// ---------------------------------------------------------------------------
// PORQUE ISTO CORRE UMA VEZ POR DIA E NÃO A CADA CHAMADA
//
// O cron corre de hora a hora. Sem uma marca, cada pessoa receberia 24 emails
// no dia do aviso — foi exatamente o que aconteceu com as faixas a 1 de agosto.
// A guarda das 20 horas em `aviso_inatividade_em` resolve isso.
//
// E o apagar é irreversível: por isso há um LIMITE por corrida, e um modo de
// simulação (?simular=1) que mostra quem seria apagado sem tocar em nada.
//
// IDIOMA: o email e a notificação do sino saem NA LÍNGUA da pessoa (users.lingua).
// Os textos vivem no dicionário do servidor (lib/dicionarioNotif); o email
// renderiza-se com renderNotif, e o sino passa as chaves a criarNotificacaoServidor
// (que já escolhe a língua de quem recebe). Sem língua definida, cai no português.
// ---------------------------------------------------------------------------
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { criarNotificacaoServidor } from "@/lib/notificacoesServidor";
import { renderNotif, type LinguaNotif } from "@/lib/dicionarioNotif";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DIA = 24 * 3600 * 1000;
/** Ao fim de quanto tempo sem entrar na app a conta gratuita é apagada. */
const DIAS_ATE_APAGAR = 365;
/** Quando avisar, em dias de inatividade. */
const AVISO_30 = 335; // faltam ~30 dias
const AVISO_7 = 358;  // faltam ~7 dias
/** Quantas contas apagar por corrida. Baixo de propósito: é irreversível. */
const MAX_APAGAR = 20;

const MAIL_FROM = process.env.MAIL_FROM || "Ippon League <support@ipponleague.com>";

/** Normaliza o valor de users.lingua para uma das 5 línguas (fallback pt). */
function normLingua(v: unknown): LinguaNotif {
  const s = String(v || "").toLowerCase();
  return (["pt", "en", "es", "fr", "de"].includes(s) ? s : "pt") as LinguaNotif;
}

const E_AMP = String.fromCharCode(38) + "amp;";
const E_LT = String.fromCharCode(38) + "lt;";
const E_GT = String.fromCharCode(38) + "gt;";
function esc(v: string): string {
  return String(v).split("&").join(E_AMP).split("<").join(E_LT).split(">").join(E_GT);
}

async function enviarEmail(para: string, assunto: string, html: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !para) return;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: MAIL_FROM, to: [para], subject: assunto, html }),
    });
  } catch { /* o aviso é extra; a contagem continua */ }
}

// Corpo do email de aviso, na língua da pessoa. O nome do time (se houver) entra
// como HTML de confiança em {time}; o nome próprio da pessoa vai escapado.
function corpoAviso(nome: string, dias: number, nomeTime: string | null, lingua: LinguaNotif): string {
  const primeiro = (nome || "").trim().split(" ")[0] || renderNotif(lingua, "email.confirmarFallbackNome");
  const time = nomeTime ? ` <strong>${esc(nomeTime)}</strong>` : "";
  const saudacao = renderNotif(lingua, "email.confirmarSaudacao", { nome: esc(primeiro) });
  const frase1 = renderNotif(lingua, "inativa.emailFrase1", { time, dias });
  const frase2 = renderNotif(lingua, "inativa.emailFrase2");
  const botao = renderNotif(lingua, "inativa.emailBotao");
  const rodape = renderNotif(lingua, "inativa.emailRodape");
  return `
    <div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.6;color:#111;max-width:520px">
      <p style="margin:0 0 14px">${saudacao}</p>
      <p style="margin:0 0 14px">
        ${frase1}
      </p>
      <p style="margin:0 0 14px">
        ${frase2}
      </p>
      <p style="margin:0 0 20px">
        <a href="https://www.ipponleague.com/inicio" style="display:inline-block;background:#d9a441;color:#1b211e;text-decoration:none;font-weight:700;padding:13px 26px;border-radius:10px">
          ${botao}
        </a>
      </p>
      <p style="margin:0;color:#666;font-size:13px">
        ${rodape}
      </p>
    </div>`;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const key = (searchParams.get("key") || "").trim();
  if (!process.env.CRON_SECRET || key !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, erro: "Não autorizado." }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ ok: false, erro: "Servidor sem ligação." }, { status: 500 });
  }
  // ?simular=1 -> mostra o que FARIA, sem tocar em nada. Convém correr isto
  // antes de deixar o modo real ligado: apagar contas não se desfaz.
  const simular = (searchParams.get("simular") || "").trim() === "1";

  const agora = Date.now();
  const corte = (dias: number) => new Date(agora - dias * DIA).toISOString();
  const limiteAviso = new Date(agora - 20 * 3600 * 1000).toISOString();

  const avisados: { email: string; dias: number }[] = [];
  const apagados: { email: string; nome: string | null }[] = [];

  // --- AVISOS ---
  // Duas janelas: quem passou os 335 dias (faltam 30) e quem passou os 358
  // (faltam 7). A guarda `aviso_inatividade_em` garante um por dia.
  for (const [diasInativo, faltam] of [[AVISO_30, 30], [AVISO_7, 7]] as const) {
    const { data } = await supabaseAdmin
      .from("users")
      .select("id, email, name, lingua, ultima_atividade, avisos_inatividade")
      .eq("is_pro", false).eq("is_pro_max", false)
      .lt("ultima_atividade", corte(diasInativo))
      .or(`aviso_inatividade_em.is.null,aviso_inatividade_em.lt.${limiteAviso}`)
      .limit(100);

    for (const u of data || []) {
      // Quem já passou dos 358 não deve receber o aviso dos 30 — a segunda
      // volta do ciclo trata dele com o texto certo.
      if (diasInativo === AVISO_30) {
        const inativoHa = (agora - Date.parse(String(u.ultima_atividade))) / DIA;
        if (inativoHa >= AVISO_7) continue;
      }
      if (!simular) {
        const lingua = normLingua(u.lingua);
        // Nome do time, para o email ser concreto: "a tua conta Relâmpago
        // Marquinhos". Um aviso vago é fácil de ignorar.
        let nomeTime: string | null = null;
        try {
          const { data: eq } = await supabaseAdmin
            .from("equipas").select("nome").eq("user_id", u.id)
            .order("id_competicao", { ascending: false }).limit(1).maybeSingle();
          nomeTime = eq?.nome ? String(eq.nome) : null;
        } catch { /* sem nome: o email fica genérico */ }

        const assunto = renderNotif(lingua, "inativa.emailAssunto", { dias: faltam });
        await enviarEmail(String(u.email || ""), assunto, corpoAviso(String(u.name || ""), faltam, nomeTime, lingua));
        // Notificação no sino também: quem não lê email pode abrir a app. Sai na
        // língua de quem recebe (chaves + vars; o serviço trata da tradução).
        await criarNotificacaoServidor({
          paraUserId: String(u.id),
          tipo: "conta_inativa",
          chaveTitulo: "inativa.emailAssunto",
          chaveCorpo: "inativa.sinoCorpo",
          vars: { dias: faltam },
          link: "/inicio",
        }).catch(() => {});
        await supabaseAdmin
          .from("users")
          .update({ aviso_inatividade_em: new Date().toISOString(), avisos_inatividade: Number(u.avisos_inatividade || 0) + 1 })
          .eq("id", u.id);
      }
      avisados.push({ email: String(u.email || ""), dias: faltam });
    }
  }

  // --- APAGAR ---
  // Só quem passou o ano E já foi avisado pelo menos uma vez. Sem esse segundo
  // critério, uma conta criada antes desta funcionalidade existir seria apagada
  // sem nunca ter recebido aviso nenhum.
  const { data: paraApagar } = await supabaseAdmin
    .from("users")
    .select("id, email, name, avisos_inatividade")
    .eq("is_pro", false).eq("is_pro_max", false)
    .lt("ultima_atividade", corte(DIAS_ATE_APAGAR))
    .gt("avisos_inatividade", 0)
    .limit(MAX_APAGAR);

  for (const u of paraApagar || []) {
    if (!simular) {
      try {
        // Anonimiza o histórico partilhado e apaga o resto (ver a função SQL).
        await supabaseAdmin.rpc("ippon_apagar_conta_inativa", { p_user: u.id });
        // E a conta de autenticação.
        await supabaseAdmin.auth.admin.deleteUser(String(u.id));
      } catch { continue; }
    }
    apagados.push({ email: String(u.email || ""), nome: u.name ? String(u.name) : null });
  }

  return NextResponse.json({
    ok: true,
    simulacao: simular,
    avisados: avisados.length,
    apagados: apagados.length,
    detalhe: { avisados, apagados },
  });
}
