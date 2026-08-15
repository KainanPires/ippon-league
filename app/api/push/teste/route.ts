// app/api/push/teste/route.ts
//
// TESTE + DIAGNÓSTICO de push por LINK (GET). Envia DIRETO (sem passar pelo
// enviarPushPara) para poder DEVOLVER o erro real do serviço da Apple/Google —
// é isso que nos diz se as chaves VAPID formam par ou não.
//
// Uso (abrir no browser):
//   /api/push/teste?key=<CRON_SECRET>&user=<user_id>
import { NextResponse } from "next/server";
import webpush from "web-push";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { enviarPushPara } from "@/lib/pushServer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PUB = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
const PRIV = process.env.VAPID_PRIVATE_KEY || "";
const SUBJECT = process.env.VAPID_SUBJECT || "mailto:support@ipponleague.com";

function autorizado(key: string | null): boolean {
  const a = process.env.CRON_SECRET;
  const b = process.env.LEMBRETE_CRON_SECRET;
  if (!key) return false;
  return (!!a && key === a) || (!!b && key === b);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const key = searchParams.get("key");
  if (!autorizado(key)) {
    const a = process.env.CRON_SECRET;
    const b = process.env.LEMBRETE_CRON_SECRET;
    return NextResponse.json(
      {
        ok: false,
        erro: "Não autorizado.",
        // apenas comprimentos — nunca os valores
        debug: {
          tem_cron_secret: !!a,
          comprimento_cron_secret: a ? a.length : 0,
          tem_lembrete_cron_secret: !!b,
          comprimento_lembrete_cron_secret: b ? b.length : 0,
          comprimento_key_recebida: key ? key.length : 0,
        },
      },
      { status: 401 }
    );
  }
  const user = (searchParams.get("user") || "").trim();
  if (!user) {
    return NextResponse.json({ ok: false, erro: "Falta ?user=<user_id>." }, { status: 400 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ ok: false, erro: "Servidor sem base de dados." }, { status: 500 });
  }

  // VIA REAL: usa a MESMA função que os avisos de atleta favorito usam
  // (criarNotificacaoServidor -> enviarPushPara). Se ?real=1, testamos o caminho
  // de produção exato, não o envio direto. Chega ao telemóvel => favoritos OK.
  if (searchParams.get("real") === "1") {
    const r = await enviarPushPara([user], {
      titulo: "🥋 Teste (via real)",
      corpo: "Se vês isto, o caminho dos avisos de favorito está a funcionar.",
      link: "/chave-atletas",
    });
    return NextResponse.json({ ok: r.enviadas > 0, via: "enviarPushPara", ...r });
  }

  // Estado das chaves VAPID (sem revelar os valores — só se existem e o tamanho).
  const vapid = {
    tem_publica: !!PUB,
    comprimento_publica: PUB.length,
    tem_privada: !!PRIV,
    comprimento_privada: PRIV.length,
    subject: SUBJECT,
  };
  if (!PUB || !PRIV) {
    return NextResponse.json({ ok: false, motivo: "VAPID em falta", vapid });
  }
  try {
    webpush.setVapidDetails(SUBJECT, PUB, PRIV);
  } catch (e) {
    return NextResponse.json({
      ok: false,
      motivo: "setVapidDetails falhou (chaves malformadas)",
      detalhe: String((e as Error).message),
      vapid,
    });
  }

  const { data: subs } = await supabaseAdmin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", user);
  const total = subs?.length || 0;
  if (total === 0) {
    return NextResponse.json({ ok: false, motivo: "Sem subscrições para este user", subs: 0, vapid });
  }

  const payload = JSON.stringify({
    titulo: "Ippon League 🥋",
    corpo: "Push de teste — se vês isto no telemóvel, está a funcionar!",
    link: "/inicio",
  });
  let enviadas = 0;
  const erros: { statusCode?: number; body?: string; message?: string }[] = [];
  for (const s of subs!) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload,
      );
      enviadas++;
    } catch (err: unknown) {
      const e = err as { statusCode?: number; body?: string; message?: string };
      erros.push({
        statusCode: e?.statusCode,
        body: (e?.body || "").toString().slice(0, 300),
        message: e?.message,
      });
    }
  }
  return NextResponse.json({ ok: enviadas > 0, subs: total, enviadas, erros, vapid });
}
