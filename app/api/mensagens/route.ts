// app/api/mensagens/route.ts
//
// Recebe uma mensagem de Ajuda & Contacto (ou Elogio):
//   1) grava sempre na tabela `mensagens` (fonte de verdade, para dashboards);
//   2) envia um email de aviso para o suporte (se o Resend estiver configurado).
//
// USA supabaseAdmin (service-role) — a tabela tem RLS sem políticas.
// O email NÃO faz falhar o pedido: se o envio falhar, a mensagem já está
// guardada e devolvemos ok:true na mesma.
//
// ANEXO (print): a página pode mandar uma imagem (campo `anexo`: { nome, tipo,
// dados_base64 }). Essa imagem NÃO é guardada na tabela — vai apenas ANEXADA ao
// email de aviso, para o suporte ver o mesmo ecrã que o utilizador. Limites:
// só imagens, até ~4 MB.
//
// Configuração do email (variáveis de ambiente na Vercel):
//   RESEND_API_KEY  -> chave da conta Resend (obrigatória para enviar email)
//   MAIL_TO         -> destino dos avisos (por omissão: support@ipponleague.com)
//   MAIL_FROM       -> remetente verificado (por omissão: Ippon League <support@ipponleague.com>)
// Sem RESEND_API_KEY, tudo funciona — só não envia email (a mensagem fica na tabela).

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const ASSUNTOS = [
  "Dúvida",
  "Problema técnico",
  "Sugestão",
  "Elogio",
  "Conta e pagamento",
  "Parcerias",
  "Outro",
];

const MAX_CORPO = 4000;
const MIN_CORPO = 15; // exige uma mensagem com algum contexto, não só "teste"
// Limite do anexo: ~4 MB já em base64 (um print normal fica bem abaixo disto).
const MAX_ANEXO_B64 = 4 * 1024 * 1024;
const TIPOS_IMAGEM = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif", "image/heic"];

const MAIL_TO = process.env.MAIL_TO || "support@ipponleague.com";
const MAIL_FROM = process.env.MAIL_FROM || "Ippon League <support@ipponleague.com>";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

type AnexoLimpo = { nome: string; conteudo_b64: string } | null;

// Envia o email de aviso via Resend. Devolve true/false; nunca lança.
async function enviarAviso(dados: {
  assunto: string; corpo: string; nome: string; email: string;
  nomeTime: string; faixa: string; pais: string; isPro: boolean; isElogio: boolean;
  anexo: AnexoLimpo;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;

  const subject = `[Ippon League] ${dados.assunto}${dados.isElogio ? " · elogio" : ""}`;
  const linhas: string[] = [
    `<p style="margin:0 0 4px"><strong>Assunto:</strong> ${escapeHtml(dados.assunto)}</p>`,
    dados.nome ? `<p style="margin:0 0 4px"><strong>Nome:</strong> ${escapeHtml(dados.nome)}</p>` : "",
    dados.nomeTime ? `<p style="margin:0 0 4px"><strong>Time:</strong> ${escapeHtml(dados.nomeTime)}</p>` : "",
    dados.email ? `<p style="margin:0 0 4px"><strong>Email:</strong> ${escapeHtml(dados.email)}</p>` : "",
    dados.faixa ? `<p style="margin:0 0 4px"><strong>Faixa:</strong> ${escapeHtml(dados.faixa)}</p>` : "",
    dados.pais ? `<p style="margin:0 0 4px"><strong>País:</strong> ${escapeHtml(dados.pais)}</p>` : "",
    `<p style="margin:0 0 4px"><strong>Pro:</strong> ${dados.isPro ? "sim" : "não"}</p>`,
    dados.anexo ? `<p style="margin:0 0 4px"><strong>Anexo:</strong> ${escapeHtml(dados.anexo.nome)} (em anexo)</p>` : "",
    `<hr style="border:none;border-top:1px solid #ddd;margin:12px 0" />`,
    `<p style="white-space:pre-wrap;margin:0">${escapeHtml(dados.corpo)}</p>`,
  ].filter(Boolean);
  const html = `<div style="font-family:system-ui,sans-serif;font-size:14px;line-height:1.5;color:#111">${linhas.join("")}</div>`;

  const payload: Record<string, unknown> = {
    from: MAIL_FROM,
    to: [MAIL_TO],
    subject,
    html,
  };
  // Responder ao email do remetente cai diretamente no utilizador.
  if (dados.email) payload.reply_to = dados.email;
  // Anexo (print): o Resend aceita anexos com conteúdo em base64.
  if (dados.anexo) {
    payload.attachments = [{ filename: dados.anexo.nome, content: dados.anexo.conteudo_b64 }];
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Valida e limpa o anexo recebido. Devolve null se não houver, ou se for
// inválido (tipo não-imagem ou demasiado grande) — nunca lança.
function limparAnexo(bruto: unknown): AnexoLimpo {
  if (!bruto || typeof bruto !== "object") return null;
  const a = bruto as { nome?: unknown; tipo?: unknown; dados_base64?: unknown };
  const tipo = String(a.tipo ?? "").toLowerCase();
  let dados = String(a.dados_base64 ?? "");
  if (!dados) return null;
  // Aceita também "data:image/png;base64,XXXX" — fica só com o XXXX.
  const virgula = dados.indexOf(",");
  if (dados.startsWith("data:") && virgula !== -1) dados = dados.slice(virgula + 1);
  if (!TIPOS_IMAGEM.includes(tipo)) return null;
  if (dados.length > MAX_ANEXO_B64) return null;

  // Nome seguro com a extensão certa.
  const ext = tipo === "image/jpeg" || tipo === "image/jpg" ? "jpg" : tipo.split("/")[1] || "png";
  let nome = String(a.nome ?? "").trim().replace(/[^\w.\-]/g, "_").slice(0, 60);
  if (!nome) nome = `print.${ext}`;
  else if (!nome.includes(".")) nome = `${nome}.${ext}`;

  return { nome, conteudo_b64: dados };
}

export async function POST(req: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json({ ok: false, erro: "Servidor indisponível de momento." }, { status: 500 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, erro: "Pedido inválido." }, { status: 400 });
  }

  const assunto = String(body.assunto ?? "").trim();
  const corpo = String(body.corpo ?? "").trim().slice(0, MAX_CORPO);
  const email = String(body.email ?? "").trim();
  const nome = String(body.nome ?? "").trim();
  const nomeTime = String(body.nome_time ?? "").trim();
  const faixa = body.faixa ? String(body.faixa) : "";
  const pais = body.pais ? String(body.pais) : "";
  const isPro = !!body.is_pro;
  const userId = body.user_id ? String(body.user_id) : null;
  const anexo = limparAnexo(body.anexo);

  if (!ASSUNTOS.includes(assunto)) {
    return NextResponse.json({ ok: false, erro: "Escolhe um assunto." }, { status: 400 });
  }
  if (corpo.length < MIN_CORPO) {
    return NextResponse.json({ ok: false, erro: "Descreve o problema com algum detalhe (pelo menos uma frase)." }, { status: 400 });
  }
  if (!userId) {
    return NextResponse.json({ ok: false, erro: "Precisas de conta para enviar pela app." }, { status: 401 });
  }

  const isElogio = assunto === "Elogio";
  const consentimento = isElogio && !!body.consentimento_publico;

  const { error } = await supabaseAdmin.from("mensagens").insert({
    user_id: userId,
    nome: nome || null,
    nome_time: nomeTime || null,
    email: email || null,
    assunto,
    corpo,
    faixa: faixa || null,
    pais: pais || null,
    is_pro: isPro,
    is_elogio: isElogio,
    consentimento_publico: consentimento,
    estado: "novo",
  });

  if (error) {
    return NextResponse.json({ ok: false, erro: "Não foi possível enviar. Tenta de novo." }, { status: 500 });
  }

  // Aviso por email (não bloqueia: a mensagem já está guardada). O print, se
  // houver, vai anexado a este email.
  await enviarAviso({ assunto, corpo, nome, email, nomeTime, faixa, pais, isPro, isElogio, anexo });

  return NextResponse.json({ ok: true });
}
