// app/api/liga/entrar/route.ts
//
// ENTRAR NUMA LIGA por código de convite (servidor, chave secreta).
//
// Recebe (POST): { user_id, codigo, confirmar? }
// Comportamento conforme a privacidade da liga:
//   - "aberta"  e  "fechada"  → entra já como membro (o código é o convite)
//   - "mediante_pedido"       → NÃO entra direto; cria um pedido pendente
//                               (o dono tem de aprovar)
// Devolve:
//   { ok:true, liga }               entrou como membro
//   { ok:true, jaEra:true, liga }   já era membro
//   { ok:true, pedido:true }        ficou um pedido pendente (mediante_pedido)
//   { ok:true, jaPediu:true }       já tinha pedido pendente
//   { ok:false, jaComecou:true, … } liga já começou: precisa de confirmação
//   { ok:false, erro }              caso contrário
//
// COPA — INSCRIÇÕES FECHADAS: numa Copa Ippon (formato "copa"), assim que as
// inscrições fecham (estado deixa de ser "inscricao", OU passou o prazo
// copa_fecho_inscricao), NINGUÉM novo se inscreve — nem em copa aberta nem
// fechada. Quem JÁ é membro passa antes (passo 2) e continua a ver tudo; só
// barramos quem chega tarde a tentar entrar a meio. (Regra do Kainan.)
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { focoMercado, numeroDaRodada } from "@/lib/calendario";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function contarLigasAmigos(user_id: string): Promise<number> {
  if (!supabaseAdmin) return 0;
  try {
    const { data: filiacoes } = await supabaseAdmin
      .from("league_members")
      .select("league_id")
      .eq("user_id", user_id);
    const ids = (filiacoes || []).map((f) => f.league_id);
    if (ids.length === 0) return 0;
    const { count } = await supabaseAdmin
      .from("leagues")
      .select("id", { count: "exact", head: true })
      .in("id", ids)
      .eq("type", "amigos");
    return count ?? 0;
  } catch {
    return 0;
  }
}
async function ehPro(user_id: string): Promise<boolean> {
  if (!supabaseAdmin) return false;
  try {
    const { data } = await supabaseAdmin.auth.admin.getUserById(user_id);
    const meta = data?.user?.user_metadata as { is_pro?: boolean } | undefined;
    return !!meta?.is_pro;
  } catch {
    return false;
  }
}

// As inscrições desta COPA já fecharam? Fechado = estado já não é "inscricao"
// (já foi sorteada / a decorrer / terminada) OU o prazo de fecho já passou.
// Para ligas de pontos corridos devolve sempre false (não há fecho de inscrição).
function copaInscricoesFechadas(liga: { formato?: unknown; copa_estado?: unknown; copa_fecho_inscricao?: unknown }): boolean {
  if (String(liga.formato) !== "copa") return false;
  const estado = String(liga.copa_estado ?? "inscricao");
  if (estado !== "inscricao") return true; // já sorteada / a decorrer / terminada
  const fecho = liga.copa_fecho_inscricao ? new Date(String(liga.copa_fecho_inscricao)).getTime() : null;
  if (fecho && Date.now() >= fecho) return true; // prazo passou
  return false;
}

const LIMITE_PARTICIPAR_FREE = 2;
const LIMITE_PARTICIPAR_PRO = 5;

export async function POST(req: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ ok: false, erro: "Servidor sem ligação à base de dados." }, { status: 500 });
  }
  let corpo: { user_id?: string; codigo?: string; confirmar?: boolean };
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ ok: false, erro: "Pedido inválido." }, { status: 400 });
  }
  const user_id = (corpo.user_id || "").trim();
  const codigo = (corpo.codigo || "").trim().toUpperCase();
  const confirmar = corpo.confirmar === true;
  if (!user_id) return NextResponse.json({ ok: false, erro: "Entra para te juntares a uma liga." }, { status: 401 });
  if (codigo.length < 4) return NextResponse.json({ ok: false, erro: "Código inválido." }, { status: 400 });

  // 1) Encontra a liga pelo código. Inclui os campos da COPA (copa_estado,
  //    copa_fecho_inscricao, copa_competicao_inicial) para a página da liga
  //    saber o estado da copa — sem eles, o cartão fica sempre em "inscrição"
  //    e o sorteio automático nunca dispara.
  const { data: liga, error: erroLiga } = await supabaseAdmin
    .from("leagues")
    .select("id, name, type, formato, privacidade, descricao, escudo, invite_code, copa_estado, copa_fecho_inscricao, copa_competicao_inicial, liga_competicao_inicial, fim_tipo, fim_valor, estado")
    .eq("invite_code", codigo)
    .maybeSingle();
  if (erroLiga || !liga) {
    return NextResponse.json({ ok: false, erro: "Não encontrámos nenhuma liga com esse código." }, { status: 404 });
  }

  // 2) Já é membro? Então não duplica — devolve sucesso na mesma.
  //    (IMPORTANTE: vem ANTES do portão da copa, para que quem já se inscreveu a
  //    tempo continue a entrar/ver a copa mesmo depois de as inscrições fecharem.)
  const { data: jaMembro } = await supabaseAdmin
    .from("league_members")
    .select("id")
    .eq("league_id", liga.id)
    .eq("user_id", user_id)
    .maybeSingle();
  if (jaMembro) {
    return NextResponse.json({ ok: true, jaEra: true, liga });
  }

  // 2-bis) COPA com inscrições FECHADAS: barra quem chega tarde (não é membro).
  //    Vale para copa aberta E fechada — depois de fechar, ninguém novo entra.
  //    Quem já era membro nunca chega aqui (passou no passo 2).
  if (copaInscricoesFechadas(liga)) {
    return NextResponse.json({
      ok: false,
      copaFechada: true,
      erro: "As inscrições desta Copa já fecharam — não dá para entrar a meio. Fica atento à próxima!",
    }, { status: 403 });
  }

  // 3) Se a liga é MEDIANTE PEDIDO, não entra direto: cria um pedido pendente.
  //    (Mesmo entrando pelo código, o dono tem de aprovar.)
  if (String(liga.privacidade) === "mediante_pedido") {
    const { data: pedidoExistente } = await supabaseAdmin
      .from("league_requests")
      .select("id, estado")
      .eq("league_id", liga.id)
      .eq("user_id", user_id)
      .maybeSingle();
    if (pedidoExistente) {
      if (pedidoExistente.estado === "pendente") {
        return NextResponse.json({ ok: true, pedido: true, jaPediu: true });
      }
      if (pedidoExistente.estado === "recusado") {
        await supabaseAdmin
          .from("league_requests")
          .update({ estado: "pendente", created_at: new Date().toISOString(), decided_at: null })
          .eq("id", pedidoExistente.id);
        return NextResponse.json({ ok: true, pedido: true });
      }
    }
    const { error: erroPedido } = await supabaseAdmin
      .from("league_requests")
      .insert({ league_id: liga.id, user_id, estado: "pendente" });
    if (erroPedido) {
      return NextResponse.json({ ok: false, erro: "Não foi possível enviar o teu pedido." }, { status: 500 });
    }
    return NextResponse.json({ ok: true, pedido: true });
  }

  // 4) Liga "aberta" ou "fechada": o código é o convite, entra direto.
  //    Limite de participação (só ligas de amigos): 2 (free) / 5 (pro).
  if (liga.type === "amigos") {
    const pro = await ehPro(user_id);
    const limite = pro ? LIMITE_PARTICIPAR_PRO : LIMITE_PARTICIPAR_FREE;
    const quantas = await contarLigasAmigos(user_id);
    if (quantas >= limite) {
      return NextResponse.json({
        ok: false,
        limite: true,
        erro: pro
          ? "Já estás em 5 ligas de amigos — é o máximo, mesmo com Ippon Pro."
          : "Já estás em 2 ligas de amigos. Passa a Ippon Pro para entrares em até 5.",
      }, { status: 403 });
    }
  }

  // 4-bis) A liga (pontos corridos) JÁ COMEÇOU? Se a rodada onde este novo membro
  //   entraria (a competição-alvo de agora) é POSTERIOR à rodada em que a liga
  //   arrancou, ele perde as rodadas já jogadas e começa com 0 pontos. Avisamos
  //   e só inserimos quando vier confirmar:true. Se for a MESMA rodada, ninguém
  //   perdeu nada — entra na linha de partida e não há aviso.
  //   (Copas não passam por aqui: em "inscricao" ainda não começaram; depois de
  //   fechar inscrições já foram barradas no passo 2-bis. E sem
  //   liga_competicao_inicial preenchido não bloqueamos — comporta-se como antes.)
  const alvoAtual = focoMercado().alvo;
  if (String(liga.formato) !== "copa" && !confirmar) {
    const rodadaInicio = numeroDaRodada(String(liga.liga_competicao_inicial ?? ""));
    const rodadaEntrada = numeroDaRodada(String(alvoAtual.idCompeticao));
    if (rodadaInicio !== null && rodadaEntrada !== null && rodadaEntrada > rodadaInicio) {
      return NextResponse.json({
        ok: false,
        jaComecou: true,
        liga,
        rodadaInicio,
        rodadaEntrada,
      });
    }
  }

  // 5) Adiciona como membro.
  //    entrou_competicao = a competição-alvo de agora (a 1ª que este membro pode
  //    jogar). É o ponto a partir do qual o ranking geral conta os pontos dele —
  //    quem entra a meio NÃO herda as rodadas anteriores. (Membros antigos ficam
  //    com este campo a NULL e continuam a contar desde o início da liga.)
  const entrouCompeticao = alvoAtual.idCompeticao;
  const { error: erroMembro } = await supabaseAdmin
    .from("league_members")
    .insert({ league_id: liga.id, user_id, score: 0, position: 0, entrou_competicao: entrouCompeticao });
  if (erroMembro) {
    return NextResponse.json({ ok: false, erro: "Não foi possível entrar na liga.", detalhe: erroMembro.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, liga });
}
