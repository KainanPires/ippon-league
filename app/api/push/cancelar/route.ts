// app/api/push/cancelar/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!supabaseAdmin) return NextResponse.json({ ok: false }, { status: 500 });
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  const endpoint = String(b.endpoint ?? "");
  if (!endpoint) return NextResponse.json({ ok: false }, { status: 400 });
  await supabaseAdmin.from("push_subscriptions").delete().eq("endpoint", endpoint);
  return NextResponse.json({ ok: true });
}
