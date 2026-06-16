// app/api/push/subscrever/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!supabaseAdmin) return NextResponse.json({ ok: false, erro: "Servidor indisponível." }, { status: 500 });
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }

  const user_id = String(b.user_id ?? "");
  const endpoint = String(b.endpoint ?? "");
  const p256dh = String(b.p256dh ?? "");
  const auth = String(b.auth ?? "");
  if (!user_id || !endpoint || !p256dh || !auth) {
    return NextResponse.json({ ok: false, erro: "Dados em falta." }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("push_subscriptions").upsert({
    user_id,
    endpoint,
    p256dh,
    auth,
    user_agent: b.userAgent ? String(b.userAgent).slice(0, 300) : null,
  }, { onConflict: "endpoint" });

  if (error) return NextResponse.json({ ok: false, erro: "Falha ao guardar." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
