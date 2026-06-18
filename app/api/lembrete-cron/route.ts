// app/api/lembrete-cron/route.ts
//
// AGENDADOR dos lembretes "esqueceste de salvar o teu time".
//
// Um serviço externo (ping de 1 em 1 min, ex.: cron-job.org) chama este endpoint
// com o segredo. Aqui:
//   1) lê os lembretes 'pendente' que já venceram (agendado_para <= agora);
//   2) para cada um, REVALIDA que o mercado AINDA está aberto (se fechou, não
//      envia — marca 'cancelado');
//   3) envia a notificação push + lista (criarNotificacaoServidor);
//   4) marca o lembrete como 'enviado'.
//
// Idempotente: um lembrete enviado/cancelado não volta a ser apanhado.
//
// Autorização (igual ao cron principal): ?key=<CRON_SECRET> OU
// cabeçalho "Authorization: Bearer <CRON_SECRET>".
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { competicaoPorId } from "@/lib/copa";
import { estadoMercado } from "@/lib/calendario";
import { criarNotificacaoServidor } from "@/lib/notificacoesServidor";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// Quantos lembretes processar por chamada (folga para o ping de 1 em 1 min).
const LOTE = 200;

function autorizado(req: Request, key: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  if (key && key === secret) return true;
  const auth = req.headers.get("authorization") || "";
  return auth === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const key = searchParams.get("key");
  if (!autorizado(req, key)) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ erro: "Servidor sem ligação." }, { status: 500 });
  }

  const agora = new Date();
  const agoraIso = agora.toISOString();

  // 1) Lembretes pendentes já vencidos.
  const { data: pendentes } = await supabaseAdmin
    .from("lembretes_salvar")
    .select("id, user_id, id_competicao, agendado_para")
    .eq("estado", "pendente")
    .lte("agendado_para", agoraIso)
    .order("agendado_para", { ascending: true })
    .limit(LOTE);

  const lista = pendentes || [];
  let enviados = 0;
  let cancelados = 0;

  // Memória curta: estado do mercado por competição (não revalidar a mesma 2x).
  const mercadoAberto = new Map<string, boolean>();
  function aindaAberto(idComp: string): boolean {
    if (mercadoAberto.has(idComp)) return mercadoAberto.get(idComp) as boolean;
    const comp = competicaoPorId(idComp);
    const aberto = !!comp && estadoMercado(comp, agora).estado === "aberto";
    mercadoAberto.set(idComp, aberto);
    return aberto;
  }

  for (const lem of lista) {
    const idComp = String(lem.id_competicao);
    // 2) Mercado já fechou? Não faz sentido lembrar de salvar — cancela.
    if (!aindaAberto(idComp)) {
      await supabaseAdmin
        .from("lembretes_salvar")
        .update({ estado: "cancelado", atualizado_em: agoraIso })
        .eq("id", lem.id);
      cancelados++;
      continue;
    }

    // 3) Texto da notificação (Peça 5). Nome da competição se o tivermos.
    const comp = competicaoPorId(idComp);
    const nomeComp = comp?.nome || "a próxima competição";
    await criarNotificacaoServidor({
      paraUserId: String(lem.user_id),
      tipo: "lembrete_salvar",
      titulo: "Esqueceste-te de salvar o teu time 🥋",
      corpo: `Tens alterações por guardar para ${nomeComp}. Volta e guarda a tua equipa antes do mercado fechar!`,
      link: "/meu-time",
    });

    // 4) Marca como enviado (não volta a ser apanhado).
    await supabaseAdmin
      .from("lembretes_salvar")
      .update({ estado: "enviado", atualizado_em: agoraIso })
      .eq("id", lem.id);
    enviados++;
  }

  return NextResponse.json({
    ok: true,
    vistos: lista.length,
    enviados,
    cancelados,
    ms: Date.now() - agora.getTime(),
  });
}
