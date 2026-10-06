// app/api/orcamento/route.ts
//
// O ORÇAMENTO DE MONTAR EQUIPA — a fonte única (servidor).
//
// GET (Authorization: Bearer <token>) -> { ok, base, patrimonio, comprados }
//
// `base` é com quanto o utilizador monta equipa AGORA:
//     base = património atual (users.patrimony_jc) + Judocoins comprados válidos
//
// Isto é a Fase A da economia (estilo Cartola): o orçamento deixou de ser 100
// fixos e passou a ser o teu património, que sobe e desce com o teu desempenho.
// Quem nunca jogou fica nos 100 (patrimony_jc a null -> 100). Os JC comprados
// somam-se por cima (Fase B) e são geridos pela carteira (razão + reembolsos).
//
// Identidade pelo token: cada um só vê o SEU orçamento.
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { jcCompradosValidos } from "@/lib/carteira";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Base da época quando ainda não há património registado (novo utilizador). */
const BASE_INICIAL = 100;

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
  if (!uid) return NextResponse.json({ ok: false, base: BASE_INICIAL }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ ok: false, base: BASE_INICIAL }, { status: 500 });

  // Património atual. Null/inválido (nunca jogou) -> 100. Um valor baixo (jogou
  // e perdeu) é válido e mantém-se — é esse o ponto da economia.
  let patrimonio = BASE_INICIAL;
  try {
    const { data } = await supabaseAdmin
      .from("users")
      .select("patrimony_jc")
      .eq("id", uid)
      .maybeSingle();
    const raw = data?.patrimony_jc;
    if (raw != null && Number.isFinite(Number(raw))) patrimonio = Number(raw);
  } catch {
    /* na dúvida, fica na base inicial */
  }

  const comprados = await jcCompradosValidos(uid);
  const base = Math.round((patrimonio + comprados) * 10) / 10;
  return NextResponse.json({ ok: true, base, patrimonio, comprados });
}
