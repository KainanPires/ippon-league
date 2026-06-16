// app/api/mensagens/route.ts
//
// Recebe uma mensagem de Ajuda & Contacto (ou Elogio) e grava na tabela
// `mensagens`. USA APENAS supabaseAdmin (service-role) — a tabela tem RLS sem
// políticas, por isso o cliente nunca lhe acede diretamente.
//
// Funciona com OU sem conta:
//   - com conta: associa user_id e o contexto (faixa/país/pro) da sessão;
//   - sem conta: exige um email para podermos responder.
//
// Elogio: quando o assunto é "Elogio" e o utilizador autoriza, fica marcado
// is_elogio + consentimento_publico (é o que alimenta a Aba de Elogios).

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
    email: email || null,
    assunto,
    corpo,
    faixa: body.faixa ? String(body.faixa) : null,
    pais: body.pais ? String(body.pais) : null,
    is_pro: !!body.is_pro,
    is_elogio: isElogio,
    consentimento_publico: consentimento,
    estado: "novo",
  });

  if (error) {
    return NextResponse.json({ ok: false, erro: "Não foi possível enviar. Tenta de novo." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
