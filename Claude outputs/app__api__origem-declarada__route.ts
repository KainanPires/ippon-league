// app/api/origem-declarada/route.ts
//
// Grava o canal DECLARADO pela pessoa no registo ("Como nos conheceste?").
// Cobre o boca-a-boca / eventos / offline que nao trazem link UTM. O painel
// /admin/utm mostra este canal no mesmo funil (registo -> ativou -> pro).
//
// SEGURANCA: a identidade vem do TOKEN da sessao, nunca do corpo (padrao das
// rotas que ja migraram -- /api/atribuicao, /api/reivindicar). O corpo so traz
// o valor escolhido. Escreve com o supabaseAdmin porque a `users` tem RLS.
//
// FIRST-TOUCH: so grava se ainda estiver vazio -- a origem declarada e do
// momento do registo e nao se sobrescreve depois.
//
// POST /api/origem-declarada  { origem: "amigo" | "treinador" | ... }
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Os mesmos slugs estaveis do dropdown no registo. Qualquer outro valor e
// recusado -- assim a coluna nunca enche de lixo.
const VALIDOS = new Set(["amigo", "treinador", "evento", "social", "google", "outro"]);

async function uidDoPedido(req: Request): Promise<string | null> {
  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
    if (!token) return null;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const pub = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
    if (!url || !pub || !supabaseAdmin) return null;
    const sb = createClient(url, pub, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await sb.auth.getUser();
    const uid = data?.user?.id;
    if (error || !uid) return null;
    return uid;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  if (!supabaseAdmin) return NextResponse.json({ ok: false, erro: "Servidor sem ligacao." }, { status: 500 });

  const uid = await uidDoPedido(req);
  if (!uid) return NextResponse.json({ ok: false, erro: "Entra na tua conta." }, { status: 401 });

  let corpo: { origem?: string } = {};
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ ok: false, erro: "Pedido invalido." }, { status: 400 });
  }

  const origem = String(corpo.origem || "").trim().toLowerCase();
  if (!VALIDOS.has(origem)) {
    return NextResponse.json({ ok: false, erro: "Origem desconhecida." }, { status: 400 });
  }

  // First-touch: so escreve se a coluna ainda estiver vazia.
  const { error } = await supabaseAdmin
    .from("users")
    .update({ origem_declarada: origem })
    .eq("id", uid)
    .is("origem_declarada", null);
  if (error) {
    return NextResponse.json({ ok: false, erro: "Nao foi possivel gravar.", detalhe: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
