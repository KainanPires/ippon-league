// app/api/promo/expirar/route.ts
//
// O CORTE DA PROMOÇÃO DE LANÇAMENTO — o "penhasco".
//
// GET /api/promo/expirar?key=CRON_SECRET   (uma vez por dia)
//
// Rebaixa quem teve Pro Max de promoção (users.promo_lancamento_ate) cuja data
// já passou E que NUNCA subscreveu na Stripe. Quem entretanto subscreveu tem
// stripe_subscription_id e fica protegido — passou a ser cliente a sério.
//
// Fica à parte de /api/subscricoes/expirar de propósito: aquele PROTEGE as
// contas sem subscrição (acesso dado à mão) e por isso não servia para cortar a
// promoção. Aqui é o contrário — é precisamente a promoção sem Stripe que se corta.
//
// CONFIGURAR no cron-job.org (uma vez por dia):
//   URL: https://www.ipponleague.com/api/promo/expirar?key=SEGREDO
//   (com o www., senão dá 308). Só começa a rebaixar a partir de 1/11.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { criarNotificacaoServidor } from "@/lib/notificacoesServidor";
import { sincronizarLigasOficiais } from "@/lib/ligasOficiais";
import { registarCorrida } from "@/lib/cronLog";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const key = (searchParams.get("key") || "").trim();
  if (!process.env.CRON_SECRET || key !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, erro: "Não autorizado." }, { status: 401 });
  }
  const admin = supabaseAdmin;
  if (!admin) {
    return NextResponse.json({ ok: false, erro: "Servidor sem ligação." }, { status: 500 });
  }
  const t0 = Date.now();
  let rebaixados = 0;
  try {
    const agoraIso = new Date().toISOString();
    // Promoções vencidas que NUNCA subscreveram (sem stripe_subscription_id).
    const { data, error } = await admin
      .from("users")
      .select("id, name")
      .not("promo_lancamento_ate", "is", null)
      .lt("promo_lancamento_ate", agoraIso)
      .is("stripe_subscription_id", null)
      .or("is_pro.eq.true,is_pro_max.eq.true");
    if (error) throw new Error(`ler promoções: ${error.message}`);
    const lista = (data || []) as Record<string, unknown>[];

    for (const u of lista) {
      const uid = String(u.id);
      await admin.from("users").update({
          is_pro: false,
          is_pro_max: false,
          promo_lancamento_ate: null,
          renova_automaticamente: false,
        }).eq("id", uid);
      try { await sincronizarLigasOficiais(uid); } catch { /* idem */ }
      rebaixados++;
      // Reaproveita o aviso de "a tua subscrição terminou" (já em 5 línguas) —
      // leva a /ippon-pro, onde está a oferta (Pro Max 6,99 € / Pro 5,99 €).
      try {
        await criarNotificacaoServidor({
            paraUserId: uid,
            tipo: "subscricao_terminou",
            chaveTitulo: "subscricao.terminouTitulo",
            chaveCorpo: "subscricao.terminouCorpo",
            link: "/ippon-pro",
          });
      } catch { /* o corte está feito; o aviso é um extra */ }
    }

    try {
      const msTotal = Date.now() - t0;
      await registarCorrida({
        job: "promo_expirar",
        ms: msTotal,
        iniciadoMs: t0,
        observados: { "promo_expirar.duracao_ms": msTotal },
        resumo: { analisados: lista.length, rebaixados },
      });
    } catch { /* observabilidade nunca bloqueia o cron */ }

    return NextResponse.json({ ok: true, analisados: lista.length, rebaixados });
  } catch (e) {
    try {
      const msTotal = Date.now() - t0;
      await registarCorrida({
        job: "promo_expirar",
        ms: msTotal,
        iniciadoMs: t0,
        observados: { "promo_expirar.duracao_ms": msTotal },
        erro: String(e),
        resumo: { rebaixados },
      });
    } catch { /* idem */ }
    console.error("[promo/expirar] corrida falhou:", e);
    return NextResponse.json({ ok: false, erro: "Falha na corrida." }, { status: 500 });
  }
}
