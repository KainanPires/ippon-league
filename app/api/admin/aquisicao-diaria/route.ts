// app/api/admin/aquisicao-diaria/route.ts
//
// FERRAMENTA DE ADMIN (so admin): REGISTOS POR DIA (meta diaria).
//
// Complementa /api/admin/aquisicao (que agrega por origem). Aqui agregamos por
// DIA, para o Kainan ver, dia a dia:
//   REGISTOS  -> contas criadas nesse dia
//   ATIVARAM  -> dessas, quantas montaram equipa (tem linha em `equipas`)
//   PRO       -> dessas, quantas sao Pro (users.is_pro)
//   FONTES    -> de que acoes-rede (utm_source) vieram os registos desse dia
//
// Serve para bater com a META: dias abaixo do alvo, e periodos secos ("do dia X
// ao dia Y nao entrou ninguem -> tenho de fazer algo"). A meta em si (numero/dia
// e alvo total) vive no cliente (localStorage) -- aqui so devolvemos os numeros.
//
// DIA LOCAL: o cliente envia `tz` = minutos a ESTE de UTC (-getTimezoneOffset()),
// para o "dia" bater com o relogio de quem olha o painel. Preenchemos TODOS os
// dias do intervalo (mesmo com 0 registos) -- as secas so se veem assim.
//
// So-leitura: nao escreve nada.
// GET /api/admin/aquisicao-diaria?dias=30&tz=60
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function ehAdmin(req: Request): Promise<boolean> {
  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
    if (!token) return false;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const pub = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
    if (!url || !pub || !supabaseAdmin) return false;
    const sb = createClient(url, pub, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await sb.auth.getUser();
    const uid = data?.user?.id;
    if (error || !uid) return false;
    const { data: row } = await supabaseAdmin.from("users").select("is_admin").eq("id", uid).maybeSingle();
    return !!row?.is_admin;
  } catch {
    return false;
  }
}

type LinhaDia = {
  id: string;
  first_seen_at: string | null;
  first_utm_source: string | null;
  first_referrer: string | null;
  is_pro: boolean | null;
};

type DiaAcc = {
  registos: number;
  ativaram: number;
  pro: number;
  fontes: Map<string, number>;
};

const norm = (v: string | null): string => (v && String(v).trim() ? String(v).trim().toLowerCase() : "");

// Data (UTC ISO) -> "YYYY-MM-DD" no fuso local pedido (minutos a este de UTC).
function diaLocal(iso: string, tzMin: number): string {
  const d = new Date(new Date(iso).getTime() + tzMin * 60000);
  return d.toISOString().slice(0, 10);
}

// "YYYY-MM-DD" de hoje no fuso local pedido.
function hojeLocal(tzMin: number): string {
  return new Date(Date.now() + tzMin * 60000).toISOString().slice(0, 10);
}

// Soma n dias a uma data "YYYY-MM-DD" (aritmetica em UTC a meio-dia, imune a DST).
function somaDias(dia: string, n: number): string {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export async function GET(req: Request) {
  if (!supabaseAdmin) return NextResponse.json({ ok: false, erro: "Servidor sem ligacao." }, { status: 500 });
  if (!(await ehAdmin(req))) return NextResponse.json({ ok: false, erro: "Nao autorizado." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const dias = Math.min(366, Math.max(1, Math.floor(Number(searchParams.get("dias") || "30")) || 30));
  const tzMin = Math.max(-840, Math.min(840, Math.floor(Number(searchParams.get("tz") || "0")) || 0));

  const hoje = hojeLocal(tzMin);
  const diaInicio = somaDias(hoje, -(dias - 1)); // inclui hoje -> dias no total
  // Margem de 2 dias no filtro UTC para nao perder registos nas pontas por causa do fuso.
  const desdeUtc = new Date(new Date(`${diaInicio}T00:00:00Z`).getTime() - 2 * 86400000).toISOString();

  // 1) Registos no intervalo (+ origem + is_pro).
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id, first_seen_at, first_utm_source, first_referrer, is_pro")
    .gte("first_seen_at", desdeUtc)
    .limit(200000);
  if (error) {
    return NextResponse.json({
      ok: false,
      erro: "Nao consegui ler os registos por dia da tabela users.",
      detalhe: error.message,
      dica: "Confirma as colunas first_seen_at, first_utm_source, first_referrer, is_pro.",
    }, { status: 500 });
  }
  const linhas = (data || []) as LinhaDia[];

  // 2b) Total GERAL de registos (todos os tempos) -- para a meta-alvo total.
  let totalGeral = 0;
  try {
    const { count } = await supabaseAdmin.from("users").select("id", { count: "exact", head: true });
    totalGeral = Number(count) || 0;
  } catch { /* sem contagem: fica 0 */ }

  // 2) Quem ativou (tem equipa).
  const ativos = new Set<string>();
  try {
    const { data: eq } = await supabaseAdmin.from("equipas").select("user_id").limit(500000);
    for (const r of (eq || []) as { user_id: string | null }[]) if (r.user_id) ativos.add(String(r.user_id));
  } catch { /* sem equipas: ativaram fica 0 */ }

  // 3) Esqueleto com TODOS os dias do intervalo (para as secas aparecerem).
  const acc = new Map<string, DiaAcc>();
  for (let i = 0; i < dias; i++) {
    acc.set(somaDias(diaInicio, i), { registos: 0, ativaram: 0, pro: 0, fontes: new Map() });
  }

  // 4) Preenche.
  let totalReg = 0, totalAtv = 0, totalPro = 0;
  for (const l of linhas) {
    if (!l.first_seen_at) continue;
    const dia = diaLocal(l.first_seen_at, tzMin);
    const d = acc.get(dia);
    if (!d) continue; // fora do intervalo (margem)
    d.registos += 1;
    totalReg += 1;
    if (ativos.has(String(l.id))) { d.ativaram += 1; totalAtv += 1; }
    if (l.is_pro) { d.pro += 1; totalPro += 1; }

    const src = norm(l.first_utm_source);
    const ref = norm(l.first_referrer);
    const chave = src ? src : ref ? `(referrer) ${ref}` : "(direto)";
    d.fontes.set(chave, (d.fontes.get(chave) || 0) + 1);
  }

  // 5) Serializa por dia (ascendente), com as 4 maiores fontes de cada dia.
  const porDia = Array.from(acc.entries())
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([dia, d]) => ({
      dia,
      registos: d.registos,
      ativaram: d.ativaram,
      pro: d.pro,
      fontes: Array.from(d.fontes.entries())
        .map(([chave, n]) => ({ chave, n }))
        .sort((a, b) => b.n - a.n)
        .slice(0, 4),
    }));

  return NextResponse.json({
    ok: true,
    dias,
    tz: tzMin,
    hoje,
    inicio: diaInicio,
    total: { registos: totalReg, ativaram: totalAtv, pro: totalPro },
    totalGeral,
    porDia,
  });
}
