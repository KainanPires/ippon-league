// app/api/judocoins/saldo/route.ts
//
// SALDO DE JUDOCOINS COMPRADOS (válido, não expirado) do próprio utilizador.
//
// GET (com Authorization: Bearer <token>) -> { ok: true, saldo: number }
//
// Identidade pelo token (nunca pelo corpo): a pessoa só vê o SEU saldo.
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { jcCompradosValidos } from "@/lib/carteira";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

export async function GET(req: Request) {
  const uid = await uidDoPedido(req);
  if (!uid) return NextResponse.json({ ok: false, saldo: 0 }, { status: 401 });
  const saldo = await jcCompradosValidos(uid);
  return NextResponse.json({ ok: true, saldo });
}
