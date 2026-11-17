// app/api/admin/anuncio/route.ts
//
// AVISO PONTUAL A TODOS (push + sino), na língua de cada utilizador.
// Ferramenta manual para avisos de produto (ex.: mudança de rodada). NÃO é um
// cron — corre só quando alguém abre o link, de propósito.
//
//   GET /api/admin/anuncio?key=<CRON_SECRET|LEMBRETE_CRON_SECRET>[&seco=1][&link=/mercado]
//     • ?seco=1 -> ENSAIO: diz quantos receberiam e o texto por língua, SEM enviar.
//     • sem seco -> envia o push a todos os utilizadores com subscrição e grava
//                   o aviso no sino (tabela notificacoes).
//
// Destinatários: todos os user_id distintos em push_subscriptions (quem pode
// receber push). O texto está fixo aqui em baixo (pt/en/es/fr/de; outras línguas
// caem em inglês). NÃO revela a cidade do clássico — a surpresa fica para a
// revelação normal da rodada.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { enviarPushPara } from "@/lib/pushServer";
import { agruparPorLingua } from "@/lib/i18nServidor";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function autorizado(key: string | null): boolean {
  const a = process.env.CRON_SECRET;
  const b = process.env.LEMBRETE_CRON_SECRET;
  if (!key) return false;
  return (!!a && key === a) || (!!b && key === b);
}

type Txt = { titulo: string; corpo: string };

const MENSAGEM: Record<string, Txt> = {
  pt: {
    titulo: "📅 Mudança na rodada deste fim de semana",
    corpo: "O Asian Open saiu do calendário oficial da IJF. No seu lugar entra uma Rodada Clássica: um Grand Slam lendário. O mercado já está aberto — monta a tua equipa! 🥋",
  },
  en: {
    titulo: "📅 This weekend's round has changed",
    corpo: "The Asian Open was dropped from the official IJF calendar. In its place, a Classic Round: a legendary Grand Slam. The market is open — build your team! 🥋",
  },
  es: {
    titulo: "📅 Cambio en la ronda de este fin de semana",
    corpo: "El Asian Open salió del calendario oficial de la IJF. En su lugar, una Ronda Clásica: un Grand Slam legendario. El mercado ya está abierto: ¡arma tu equipo! 🥋",
  },
  fr: {
    titulo: "📅 Changement pour la manche de ce week-end",
    corpo: "L'Asian Open a été retiré du calendrier officiel de l'IJF. À la place, une Manche Classique : un Grand Slam légendaire. Le marché est ouvert — compose ton équipe ! 🥋",
  },
  de: {
    titulo: "📅 Änderung für die Runde an diesem Wochenende",
    corpo: "Der Asian Open wurde aus dem offiziellen IJF-Kalender gestrichen. Stattdessen gibt es eine Klassik-Runde: ein legendärer Grand Slam. Der Markt ist offen – stell dein Team auf! 🥋",
  },
};

const textoDe = (lg: string): Txt => MENSAGEM[lg] || MENSAGEM.en;

export async function GET(req: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ ok: false, erro: "Servidor sem ligação." }, { status: 500 });
  }
  const { searchParams } = new URL(req.url);
  if (!autorizado(searchParams.get("key"))) {
    return NextResponse.json({ ok: false, erro: "Não autorizado." }, { status: 401 });
  }
  const seco = searchParams.get("seco") === "1";
  const link = (searchParams.get("link") || "/mercado").trim();

  // Destinatários = todos os user_id distintos com subscrição push.
  const { data: subs } = await supabaseAdmin.from("push_subscriptions").select("user_id");
  const ids = [...new Set((subs || []).map((r) => String((r as { user_id: string }).user_id)).filter(Boolean))];

  if (ids.length === 0) {
    return NextResponse.json({ ok: true, totalUtilizadores: 0, enviadas: 0, removidas: 0, nota: "Ninguém com subscrição push." });
  }

  const grupos = await agruparPorLingua(ids);

  if (seco) {
    const plano = Object.entries(grupos).map(([lingua, us]) => {
      const t = textoDe(lingua);
      return { lingua, utilizadores: us.length, titulo: t.titulo, corpo: t.corpo };
    });
    return NextResponse.json({ ok: true, seco: true, totalUtilizadores: ids.length, link, plano });
  }

  let enviadas = 0;
  let removidas = 0;
  const sino: { user_id: string; tipo: string; titulo: string; corpo: string; link: string }[] = [];

  for (const [lingua, us] of Object.entries(grupos)) {
    const t = textoDe(lingua);
    const r = await enviarPushPara(us, { titulo: t.titulo, corpo: t.corpo, link });
    enviadas += r.enviadas;
    removidas += r.removidas;
    for (const u of us) sino.push({ user_id: u, tipo: "anuncio", titulo: t.titulo, corpo: t.corpo, link });
  }

  if (sino.length > 0) {
    try { await supabaseAdmin.from("notificacoes").insert(sino); } catch { /* o push já foi; o sino é extra */ }
  }

  return NextResponse.json({ ok: true, totalUtilizadores: ids.length, enviadas, removidas });
}
