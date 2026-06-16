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

const MAIL_TO = process.env.MAIL_TO || "support@ipponleague.com";
const MAIL_FROM = process.env.MAIL_FROM || "Ippon League <support@ipponleague.com>";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Envia o email de aviso via Resend. Devolve true/false; nunca lança.
async function enviarAviso(dados: {
  assunto: string; corpo: string; nome: string; email: string;
  nomeTime: string; faixa: string; pais: string; isPro: boolean; isElogio: boolean;
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

  if (!ASSUNTOS.includes(assunto)) {
    return NextResponse.json({ ok: false, erro: "Escolhe um assunto." }, { status: 400 });
  }
  if (corpo.length < 5) {
    return NextResponse.json({ ok: false, erro: "Escreve a tua mensagem (um pouco mais longa)." }, { status: 400 });
  }
  if (!userId && !email) {
    return NextResponse.json({ ok: false, erro: "Deixa um email para te podermos responder." }, { status: 400 });
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

  // Aviso por email (não bloqueia: a mensagem já está guardada).
  await enviarAviso({ assunto, corpo, nome, email, nomeTime, faixa, pais, isPro, isElogio });

  return NextResponse.json({ ok: true });
}
