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
//
// LIGA TERMINADA: e a competição que JÁ ACABOU? Havia aqui um buraco: a regra
// acima só olha para copas. Uma liga de PONTOS CORRIDOS com estado='terminada'
// não era verificada em lado nenhum, e alguém podia mesmo entrar numa liga
// encerrada — ficava membro de uma coisa acabada, sem ranking nem sentido.
// Agora barra-se qualquer liga terminada, dos dois formatos. Quem participou
// continua a vê-la em /ligas → Resultados, com o pódio e o certificado.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { focoMercado, numeroDaRodada } from "@/lib/calendario";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Quantas ligas de amigos ATIVAS este utilizador tem, separadas por formato.
// As terminadas ficam de fora (já não ocupam lugar) e as oficiais também
// (mundial/continental são automáticas).
async function contarPorFormato(user_id: string): Promise<{ pontos: number; copa: number }> {
  const zero = { pontos: 0, copa: 0 };
  if (!supabaseAdmin) return zero;
  try {
    const { data: filiacoes } = await supabaseAdmin
      .from("league_members")
      .select("league_id")
      .eq("user_id", user_id);
    const ids = (filiacoes || []).map((f) => f.league_id);
    if (ids.length === 0) return zero;
    const { data: ligas } = await supabaseAdmin
      .from("leagues")
      .select("id, formato, estado, copa_estado")
      .in("id", ids)
      .eq("type", "amigos");
    const out = { pontos: 0, copa: 0 };
    for (const l of ligas || []) {
      if (ligaTerminada(l)) continue; // acabou: não ocupa lugar
      if (String(l.formato) === "copa") out.copa++;
      else out.pontos++;
    }
    return out;
  } catch {
    return zero;
  }
}
// Nível do utilizador. Lê da TABELA `users`, não do user_metadata: a tabela é a
// fonte de verdade (o metadata é uma cache do lado do cliente e não serve para
// decidir limites). Em caso de dúvida, trata como grátis — errar para o lado
// mais restritivo é preferível a dar acesso a quem não pagou.
async function nivelDoUtilizador(user_id: string): Promise<NivelUtilizador> {
  if (!supabaseAdmin) return "gratis";
  try {
    const { data } = await supabaseAdmin
      .from("users").select("is_pro, is_pro_max").eq("id", user_id).maybeSingle();
    if (data?.is_pro_max) return "promax";
    if (data?.is_pro) return "pro";
    return "gratis";
  } catch {
    return "gratis";
  }
}

// A liga JÁ TERMINOU? Mesma regra do ecrã /ligas, do cartão do /inicio e do
// /api/liga/mercado — os quatro têm de concordar sempre.
//   • pontos corridos → estado = 'terminada'
//   • copa            → copa_estado = 'terminada'
function ligaTerminada(liga: { formato?: unknown; estado?: unknown; copa_estado?: unknown }): boolean {
  if (String(liga.formato) === "copa") return String(liga.copa_estado) === "terminada";
  return String(liga.estado) === "terminada";
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

// ---------------------------------------------------------------------------
// LIMITES DE PARTICIPAÇÃO (regra do Kainan, 29/07/2026)
//
// Contam-se SEPARADAMENTE as ligas de pontos corridos e as copas: um jogador
// grátis pode ter uma de cada, não uma no total. Antes o código somava tudo num
// só saco de 2 — o que ao mesmo tempo dava ligas a mais ao grátis (2 em vez de
// 1) e o impedia de ter uma liga E um mata-mata ao mesmo tempo.
//
// Ligas TERMINADAS não contam: já acabaram, não devem bloquear ninguém.
// Ligas OFICIAIS (mundial/continental) também não — são automáticas e só Pro.
//
//   grátis  -> 1 liga + 1 mata-mata   (para trocar, tem de sair da atual)
//   Pro     -> 5 + 5
//   Pro Max -> 10 + 10
// ---------------------------------------------------------------------------
const LIMITES = {
  gratis: { pontos: 1, copa: 1 },
  pro: { pontos: 5, copa: 5 },
  promax: { pontos: 10, copa: 10 },
} as const;
type NivelUtilizador = keyof typeof LIMITES;

// Bateu no limite? Devolve a mensagem de erro, ou null se pode entrar.
// A mensagem diz sempre QUANTAS tem, QUAL é o limite e o que ganha ao subir de
// nível — um "não podes" sem explicação é a forma mais rápida de perder alguém.
async function bloqueioPorLimite(user_id: string, ehCopa: boolean): Promise<string | null> {
  const nivel = await nivelDoUtilizador(user_id);
  const lim = LIMITES[nivel];
  const atual = await contarPorFormato(user_id);
  const usadas = ehCopa ? atual.copa : atual.pontos;
  const maximo = ehCopa ? lim.copa : lim.pontos;
  if (usadas < maximo) return null;
  const oQue = ehCopa ? (maximo === 1 ? "num mata-mata" : `em ${maximo} mata-matas`) : (maximo === 1 ? "numa liga" : `em ${maximo} ligas`);
  const sair = ehCopa
    ? "Um mata-mata não se abandona a meio: espera que este termine para entrares noutro."
    : "Para entrares noutra, sai primeiro da atual.";
  if (nivel === "promax") return `Já estás ${oQue} — é o máximo, mesmo com Pro Max. ${sair}`;
  if (nivel === "pro") return `Já estás ${oQue}. ${sair} Com o Pro Max sobes até ${ehCopa ? LIMITES.promax.copa + " mata-matas" : LIMITES.promax.pontos + " ligas"}.`;
  return `Já estás ${oQue}. ${sair} Com o Ippon Pro sobes até ${ehCopa ? LIMITES.pro.copa + " mata-matas" : LIMITES.pro.pontos + " ligas"}.`;
}


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
  //    (IMPORTANTE: vem ANTES dos portões, para que quem já se inscreveu a
  //    tempo continue a entrar/ver a liga mesmo depois de ela fechar/terminar.)
  const { data: jaMembro } = await supabaseAdmin
    .from("league_members")
    .select("id")
    .eq("league_id", liga.id)
    .eq("user_id", user_id)
    .maybeSingle();
  if (jaMembro) {
    return NextResponse.json({ ok: true, jaEra: true, liga });
  }

  // 2-bis) LIGA TERMINADA: acabou, não se entra. Vale para os dois formatos.
  //    Quem já era membro nunca chega aqui (passou no passo 2).
  if (ligaTerminada(liga)) {
    return NextResponse.json({
      ok: false,
      ligaTerminada: true,
      erro: String(liga.formato) === "copa"
        ? "Esta Copa já terminou e tem campeão. Fica atento à próxima!"
        : "Esta liga já terminou. Fica atento à próxima — ou cria a tua!",
    }, { status: 403 });
  }

  // 2-ter) COPA com inscrições FECHADAS: barra quem chega tarde (não é membro).
  //    Vale para copa aberta E fechada — depois de fechar, ninguém novo entra.
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
  //    Limite de participação, contado SEPARADAMENTE por formato (ver LIMITES).
  if (liga.type === "amigos") {
    const bloqueio = await bloqueioPorLimite(user_id, String(liga.formato) === "copa");
    if (bloqueio) {
      return NextResponse.json({ ok: false, limite: true, erro: bloqueio }, { status: 403 });
    }
  }

  // 4-bis) A liga (pontos corridos) JÁ COMEÇOU? Se a rodada onde este novo membro
  //   entraria (a competição-alvo de agora) é POSTERIOR à rodada em que a liga
  //   arrancou, ele perde as rodadas já jogadas e começa com 0 pontos. Avisamos
  //   e só inserimos quando vier confirmar:true. Se for a MESMA rodada, ninguém
  //   perdeu nada — entra na linha de partida e não há aviso.
  //   (Copas não passam por aqui: em "inscricao" ainda não começaram; depois de
  //   fechar inscrições já foram barradas acima. E sem
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
