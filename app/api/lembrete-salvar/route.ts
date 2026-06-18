// app/api/lembrete-salvar/route.ts
//
// LEMBRETE "esqueceste de salvar o teu time" — agendar / cancelar (servidor).
//
// O ecrã de montar (cliente) chama esta rota em dois momentos:
//   • 'agendar' — quando o utilizador SAI do ecrã (troca de aba/app) com
//     alterações por salvar (dirty). Agenda um lembrete para daqui a 3 minutos.
//   • 'cancelar' — quando salva, ou volta ao time original (deixa de ter dirty).
//
// Um agendador externo (ping de 1 em 1 min em /api/lembrete-cron) envia depois
// os lembretes pendentes que já venceram.
//
// Recebe (POST, JSON): { user_id, id_competicao, acao: 'agendar' | 'cancelar' }
// Devolve: { ok } ou { ok:false, erro }
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { competicaoPorId } from "@/lib/copa";
import { estadoMercado } from "@/lib/calendario";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Quantos minutos depois de sair (com alterações por salvar) o lembrete dispara.
const MINUTOS_ESPERA = 3;

export async function POST(req: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ ok: false, erro: "Servidor sem ligação." }, { status: 500 });
  }

  let corpo: { user_id?: string; id_competicao?: string; acao?: string };
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ ok: false, erro: "Pedido inválido." }, { status: 400 });
  }

  const user_id = (corpo.user_id || "").trim();
  const id_competicao = (corpo.id_competicao || "").trim();
  const acao = (corpo.acao || "").trim();

  if (!user_id || !id_competicao) {
    return NextResponse.json({ ok: false, erro: "Faltam dados." }, { status: 400 });
  }

  // CANCELAR: marca os lembretes pendentes deste user+competição como cancelados.
  if (acao === "cancelar") {
    await supabaseAdmin
      .from("lembretes_salvar")
      .update({ estado: "cancelado", atualizado_em: new Date().toISOString() })
      .eq("user_id", user_id)
      .eq("id_competicao", id_competicao)
      .eq("estado", "pendente");
    return NextResponse.json({ ok: true, acao: "cancelado" });
  }

  // AGENDAR: só faz sentido com MERCADO ABERTO (com o mercado fechado já não dá
  // para salvar, logo não há nada a lembrar). O servidor é a barreira real.
  if (acao === "agendar") {
    const comp = competicaoPorId(id_competicao);
    if (!comp) {
      return NextResponse.json({ ok: false, erro: "Competição desconhecida." }, { status: 400 });
    }
    const est = estadoMercado(comp);
    if (est.estado !== "aberto") {
      // Mercado fechado: não agenda (e por segurança limpa qualquer pendente).
      await supabaseAdmin
        .from("lembretes_salvar")
        .update({ estado: "cancelado", atualizado_em: new Date().toISOString() })
        .eq("user_id", user_id)
        .eq("id_competicao", id_competicao)
        .eq("estado", "pendente");
      return NextResponse.json({ ok: true, acao: "ignorado_mercado_fechado" });
    }

    const agora = new Date();
    const agendado_para = new Date(agora.getTime() + MINUTOS_ESPERA * 60 * 1000).toISOString();

    // Upsert por (user_id, id_competicao): re-sair rearma o MESMO lembrete (o
    // índice único garante que não se acumulam vários). Volta a 'pendente'.
    await supabaseAdmin
      .from("lembretes_salvar")
      .upsert(
        {
          user_id,
          id_competicao,
          agendado_para,
          estado: "pendente",
          atualizado_em: agora.toISOString(),
        },
        { onConflict: "user_id,id_competicao" }
      );

    return NextResponse.json({ ok: true, acao: "agendado", agendado_para });
  }

  return NextResponse.json({ ok: false, erro: "Ação inválida." }, { status: 400 });
}
