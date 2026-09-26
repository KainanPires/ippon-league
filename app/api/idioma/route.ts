// app/api/idioma/route.ts
//
// GRAVA A LÍNGUA DO UTILIZADOR NA COLUNA RÁPIDA `users.lingua` — de forma
// GARANTIDA (chave de serviço), sem depender do RLS da tabela `users`.
//
// PORQUÊ: as notificações/push nascem no SERVIDOR na língua de `users.lingua`
// (ver lib/i18nServidor -> linguaDeUtilizador / linguasDeVarios). O cliente
// escrevia essa coluna diretamente (supabase.from("users").update(...)), o que
// depende do RLS deixar — e quando não deixa, falha em silêncio e a coluna fica
// desatualizada, fazendo o servidor mandar avisos na língua errada. Esta rota
// escreve com o supabaseAdmin, por isso a preferência CHEGA sempre ao servidor.
//
// Identidade pelo token (cada um só grava a SUA língua). Corpo: { lingua }.
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VALIDAS = ["pt", "en", "es", "fr", "de"];

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

export async function POST(req: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ ok: false, erro: "Servidor sem ligação." }, { status: 500 });
  }
  const uid = await uidDoPedido(req);
  if (!uid) return NextResponse.json({ ok: false, erro: "Sem sessão." }, { status: 401 });

  let corpo: { lingua?: string };
  try { corpo = await req.json(); } catch {
    return NextResponse.json({ ok: false, erro: "Pedido inválido." }, { status: 400 });
  }
  const lingua = String(corpo.lingua || "").toLowerCase();
  if (!VALIDAS.includes(lingua)) {
    return NextResponse.json({ ok: false, erro: "Língua desconhecida." }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("users").update({ lingua }).eq("id", uid);
  if (error) {
    console.error("[api/idioma]", error.message);
    return NextResponse.json({ ok: false, erro: "Não foi possível gravar." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, lingua });
}
