// app/api/rodada-congelada/route.ts
//
// GET ?comp=<id> -> { ok, congelada }
//
// Os Judocoins desta competição já foram calculados? Usado pelo mercado: quem
// jogou uma competição só monta a seguinte DEPOIS do cálculo, para montar já com
// o valor certo (decidido com o Kainan a 9/11/2026). Dado público, sem conta.
import { NextResponse } from "next/server";
import { rodadaJaCongelada, todasAsChavesTerminadas } from "@/lib/fechoAntecipado";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const comp = (new URL(req.url).searchParams.get("comp") || "").trim();
  if (!/^\d{1,8}$/.test(comp)) return NextResponse.json({ ok: false, erro: "comp inválida" }, { status: 400 });
  const congelada = await rodadaJaCongelada(comp);
  // ?chaves=1 -> diagnóstico (só leitura): as chaves estão todas completas?
  if (new URL(req.url).searchParams.get("chaves") === "1") {
    const chaves = await todasAsChavesTerminadas(comp);
    return NextResponse.json({ ok: true, congelada, chaves }, { headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json({ ok: true, congelada }, { headers: { "Cache-Control": "no-store" } });
}
