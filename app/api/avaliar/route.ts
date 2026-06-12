// app/api/avaliar/route.ts
//
// AVALIAÇÃO DO JOGADOR (servidor, chave secreta).
//
// Recebe (POST, JSON): { user_id, nome_time?, estrelas (1-5), comentario?, contexto? }
// Guarda na tabela `avaliacoes`. "Votar" = dar estrelas; o comentário é extra.
//
// Devolve { ok: true } se gravou. Toda a escrita passa pelo servidor por causa
// do RLS (a chave pública não escreve na tabela).
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ ok: false, erro: "Servidor sem ligação." }, { status: 500 });
  }

  let body: { user_id?: string; nome_time?: string; estrelas?: number; comentario?: string; contexto?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, erro: "Pedido inválido." }, { status: 400 });
  }

  const user_id = (body.user_id || "").trim();
  const estrelas = Number(body.estrelas);

  if (!user_id) {
    return NextResponse.json({ ok: false, erro: "Falta o utilizador." }, { status: 400 });
  }
  if (!Number.isInteger(estrelas) || estrelas < 1 || estrelas > 5) {
    return NextResponse.json({ ok: false, erro: "As estrelas têm de ser de 1 a 5." }, { status: 400 });
  }

  const nome_time = (body.nome_time || "").trim() || null;
  const comentario = (body.comentario || "").trim() || null;
  const contexto = (body.contexto || "").trim() || "salvar_time";

  try {
    const { error } = await supabaseAdmin.from("avaliacoes").insert({
      user_id,
      nome_time,
      estrelas,
      comentario,
      contexto,
    });
    if (error) {
      return NextResponse.json({ ok: false, erro: error.message }, { status: 500 });
    }
  } catch (e) {
    return NextResponse.json({ ok: false, erro: String(e) }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
