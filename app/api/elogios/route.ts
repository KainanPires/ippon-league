// app/api/elogios/route.ts
//
// Devolve os ELOGIOS PÚBLICOS para a Aba de Elogios. Lê de `mensagens` só os
// que são elogio E têm consentimento público. Usa supabaseAdmin (a tabela tem
// RLS sem políticas). NUNCA devolve o email — só o que o utilizador autorizou
// a tornar público (nome de utilizador, nome de time, faixa, país, texto).

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  if (!supabaseAdmin) {
    return NextResponse.json({ ok: false, elogios: [] }, { status: 500 });
  }

  const { data, error } = await supabaseAdmin
    .from("mensagens")
    .select("id, nome, nome_time, faixa, pais, corpo, criado_em")
    .eq("is_elogio", true)
    .eq("consentimento_publico", true)
    .order("criado_em", { ascending: false })
    .limit(60);

  if (error) {
    return NextResponse.json({ ok: false, elogios: [] }, { status: 500 });
  }

  const elogios = (data || []).map((m) => ({
    id: String(m.id),
    nome: m.nome ? String(m.nome) : "",
    nome_time: m.nome_time ? String(m.nome_time) : "",
    faixa: m.faixa ? String(m.faixa) : "",
    pais: m.pais ? String(m.pais) : "",
    corpo: String(m.corpo ?? ""),
    criado_em: m.criado_em ? String(m.criado_em) : null,
  }));

  return NextResponse.json({ ok: true, elogios });
}
