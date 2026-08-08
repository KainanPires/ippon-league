// app/api/subscricoes/expirar/route.ts
//
// A REDE DE SEGURANÇA DAS SUBSCRIÇÕES.
//
// GET /api/subscricoes/expirar?key=CRON_SECRET
//
// Corre uma vez por dia e retira o acesso a quem já não devia tê-lo.
//
// ---------------------------------------------------------------------------
// PORQUE EXISTE, SE O WEBHOOK JÁ FAZ ISTO
//
// Faz — quando chega. Um webhook pode falhar: a Vercel esteve em baixo, o
// Supabase recusou a escrita, o evento perdeu-se. A Stripe reenvia durante três
// dias, mas se falhar sempre, desiste. Aí ficava alguém com Pro para sempre sem
// nunca mais pagar, e ninguém daria por isso.
//
// Esta rota compara o que a base de dados diz com o que a Stripe diz, e a Stripe
// ganha sempre. É a diferença entre um sistema que depende de todas as mensagens
// chegarem e um que se corrige sozinho.
//
// ---------------------------------------------------------------------------
// DOIS DIAS DE FOLGA, E PERGUNTAR ANTES DE CORTAR
//
// Só se olha para quem expirou há mais de dois dias. E, mesmo aí, pergunta-se à
// Stripe como está a subscrição antes de mexer.
//
// A razão é simples: quando um cartão falha, a Stripe volta a tentar durante
// vários dias e a maioria dessas cobranças acaba por passar. Se cortássemos no
// minuto em que a data expira, tirávamos o Pro a quem só teve um problema
// passageiro com o banco — e a essa pessoa é preciso devolver o acesso e pedir
// desculpa, o que é muito pior do que ter esperado.
//
// Errar para o lado de deixar alguém com acesso a mais dois dias custa cêntimos.
// Errar para o outro lado custa um cliente.
//
// ---------------------------------------------------------------------------
// CONFIGURAR NO cron-job.org
//
// Frequência: uma vez por dia
// URL: https://www.ipponleague.com/api/subscricoes/expirar?key=SEGREDO
// (com o www., senão dá 308 — como os outros)
//
// Fica fora do /api/cron de propósito: aquele ficheiro já orquestra meio
// projeto, e uma tarefa que mexe em dinheiro não deve partilhar destino com o
// congelamento de rodadas. Se um rebentar, o outro continua.
// ---------------------------------------------------------------------------
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { stripeFetch, nivelDoPreco, fimDoPeriodo } from "@/lib/stripe";
import { criarNotificacaoServidor } from "@/lib/notificacoesServidor";
import { sincronizarLigasOficiais } from "@/lib/ligasOficiais";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/** Dias de folga depois da data de expiração antes de sequer olhar para a conta. */
const FOLGA_DIAS = 2;
interface Assinatura {
  id: string;
  status: string;
  current_period_end?: number;
  cancel_at_period_end?: boolean;
  items?: { data: { price?: { id?: string }; current_period_end?: number | null }[] };
}
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const key = (searchParams.get("key") || "").trim();
  if (!process.env.CRON_SECRET || key !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, erro: "Não autorizado." }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ ok: false, erro: "Servidor sem ligação." }, { status: 500 });
  }
  const limite = new Date(Date.now() - FOLGA_DIAS * 24 * 60 * 60 * 1000).toISOString();
  // Quem tem acesso na base de dados mas cuja data já passou há mais de dois dias.
  const { data: candidatos } = await supabaseAdmin
  .from("users")
  .select("id, name, is_pro, is_pro_max, stripe_subscription_id, pro_expira_em")
  .or("is_pro.eq.true,is_pro_max.eq.true")
  .not("pro_expira_em", "is", null)
  .lt("pro_expira_em", limite);
  const lista = (candidatos || []) as Record<string, unknown>[];
  let rebaixados = 0;
  let renovados = 0;
  let semSubscricao = 0;
  for (const u of lista) {
    const uid = String(u.id);
    const subId = u.stripe_subscription_id ? String(u.stripe_subscription_id) : "";
    // Tem acesso mas nunca teve subscrição na Stripe? É acesso dado à mão — uma
    // conta de teste, um convite, uma oferta. NÃO se mexe: tirar o Pro a uma
    // conta que tu próprio marcaste seria o pior erro possível desta rota.
    if (!subId) {
      semSubscricao++;
      continue;
    }
    try {
      const sub = await stripeFetch<Assinatura>(`subscriptions/${subId}`);
      // Ainda ativa: a data na base de dados é que estava velha (webhook perdido).
      // Atualiza-se e segue. É este ramo que corrige as falhas silenciosas.
      if (["active", "trialing", "past_due"].includes(sub.status)) {
        const nivel = nivelDoPreco(sub.items?.data?.[0]?.price?.id);
        await supabaseAdmin.from("users").update({
            pro_expira_em: fimDoPeriodo(sub)
            ? new Date(fimDoPeriodo(sub)! * 1000).toISOString()
            : null,
            renova_automaticamente: !sub.cancel_at_period_end,
            ...(nivel ? { is_pro: true, is_pro_max: nivel === "promax" } : {}),
          }).eq("id", uid);
        await sincronizarLigasOficiais(uid);
        renovados++;
        continue;
      }
      // Acabou mesmo: cancelada, não paga, ou incompleta.
      await supabaseAdmin.from("users").update({
          is_pro: false,
          is_pro_max: false,
          renova_automaticamente: false,
        }).eq("id", uid);
      await sincronizarLigasOficiais(uid);
      rebaixados++;
      try {
        await criarNotificacaoServidor({
            paraUserId: uid,
            tipo: "subscricao_terminou",
            titulo: "A tua subscrição terminou",
            corpo: "O acesso às funcionalidades Pro acabou. A tua conta, a tua equipa e o teu histórico ficam todos guardados — se voltares, está tudo onde deixaste.",
            link: "/ippon-pro",
          });
      } catch { /* o rebaixamento está feito; o aviso é um extra */ }
    } catch (e) {
      // Falha a falar com a Stripe: NÃO se rebaixa. Sem resposta dela não há
      // como saber se a pessoa pagou, e na dúvida fica com acesso. A rota corre
      // outra vez amanhã.
      console.error("[expirar]", uid, e);
    }
  }
  return NextResponse.json({
      ok: true,
      analisados: lista.length,
      rebaixados,
      renovados,
      semSubscricao,
    });
}
