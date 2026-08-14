// app/api/horarios/route.ts
//
// GET público: devolve o mapa { id_competicao: inicioUTC } dos horários manuais.
// Usado pela app (components/CarregarHorarios) ao arrancar, e pelo editor para
// pré-preencher. Não é sensível — é sobre QUANDO a competição começa.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const horarios: Record<string, string> = {};
  if (!supabaseAdmin) return NextResponse.json({ ok: true, horarios });
  try {
    const { data } = await supabaseAdmin.from("competicao_horarios").select("id_competicao, inicio_utc");
    for (const r of data || []) {
      const id = String((r as { id_competicao?: unknown }).id_competicao || "");
      const iso = String((r as { inicio_utc?: unknown }).inicio_utc || "");
      if (id && iso) horarios[id] = iso;
    }
  } catch { /* devolve o que houver */ }
  return NextResponse.json({ ok: true, horarios });
}
