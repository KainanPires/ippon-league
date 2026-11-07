// app/api/categorias-estado/route.ts
//
// Estado de cada categoria (naoComecou | aDecorrer | terminada | semChave) de uma
// competição — para o cliente saber onde ainda dá para substituir um atleta que
// saiu. Só devolve o ESTADO, nada sensível, por isso é público.
//
// GET /api/categorias-estado?comp=3169
import { NextResponse } from "next/server";
import { montarChaveDaBase } from "@/lib/montarChave";
import { CATEGORIES } from "@/lib/athletes";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const CATS = [...CATEGORIES.M, ...CATEGORIES.F];

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const comp = (searchParams.get("comp") || "").trim();
  if (!comp) return NextResponse.json({ ok: false, erro: "Falta ?comp=" }, { status: 400 });

  const estados: Record<string, string> = {};
  for (const cat of CATS) {
    try {
      const c = await montarChaveDaBase(comp, cat);
      estados[cat] = c.existeMoldura ? c.estado : "semChave";
    } catch {
      estados[cat] = "erro";
    }
  }
  return NextResponse.json({ ok: true, comp, estados });
}
