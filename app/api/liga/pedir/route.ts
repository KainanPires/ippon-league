// app/api/liga/pedir/route.ts
//
// PEDIR ENTRADA NUMA LIGA (servidor, chave secreta).
//
// Recebe (POST): { user_id, codigo, confirmar? }
// Comportamento conforme a privacidade da liga:
//   - "aberta"          → entra já como membro (atalho; igual ao /entrar)
//   - "mediante_pedido" → cria um pedido PENDENTE em league_requests
//   - "fechada"         → não se pede pelo mercado; só por código (esta rota
//                         não deixa pedir uma fechada — devolve erro claro)
// Devolve:
//   { ok:true, entrou:true, liga }        quando entrou direto (aberta)
//   { ok:true, pedido:true }              quando ficou um pedido pendente
//   { ok:true, jaEra:true, liga }         quando já era membro
//   { ok:true, jaPediu:true }             quando já tinha pedido pendente
//   { ok:false, jaComecou:true, … }       liga aberta já começou: pede confirmação
//   { ok:false, erro }                    caso contrário
//
// COPA — INSCRIÇÕES FECHADAS: tal como em /entrar, numa Copa Ippon depois de as
// inscrições fecharem (estado deixa de ser "inscricao" OU passou o prazo
// copa_fecho_inscricao), ninguém novo se inscreve/pede — nem em copa aberta nem
// "por aprovação". Quem JÁ é membro passa antes (passo 2) e continua a ver tudo.
//
// LIGA TERMINADA: mesma correção do /entrar. A regra da copa só olhava para
// copas; uma liga de PONTOS CORRIDOS com estado='terminada' não era verificada
// e alguém podia pedir/entrar numa liga já encerrada. Agora barra-se qualquer
// liga terminada, dos dois formatos. O histórico vive em /ligas → Resultados.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { criarNotificacaoServidor } from "@/lib/notificacoesServidor";
import { focoMercado, numeroDaRodada } from "@/lib/calendario";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

// A liga JÁ TERMINOU? (mesma regra do /entrar, do /mercado, do /ligas e do /inicio)
function ligaTerminada(liga: { formato?: unknown; estado?: unknown; copa_estado?: unknown }): boolean {
  if (String(liga.formato) === "copa") return String(liga.copa_estado) === "terminada";
  return String(liga.estado) === "terminada";
}

// As inscrições desta COPA já fecharam? (mesma regra de /entrar)
// Fechado = estado já não é "inscricao" OU o prazo de fecho já passou.
// Para ligas de pontos corridos devolve sempre false.
function copaInscricoesFechadas(liga: { formato?: unknown; copa_estado?: unknown; copa_fecho_inscricao?: unknown }): boolean {
  if (String(liga.formato) !== "copa") return false;
  const estado = String(liga.copa_estado ?? "inscricao");
  if (estado !== "inscricao") return true;
  const fecho = liga.copa_fecho_inscricao ? new Date(String(liga.copa_fecho_inscricao)).getTime() : null;
  if (fecho && Date.now() >= fecho) return true;
  return false;
}

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

  // 1) Encontra a liga pelo código. (created_by para notificar o dono;
  //    copa_estado + copa_fecho_inscricao para o portão da copa fechada;
  //    estado para o portão da liga terminada;
  //    liga_competicao_inicial para o aviso de "liga já começou".)
  const { data: liga, error: erroLiga } = await supabaseAdmin
    .from("leagues")
    .select("id, name, type, formato, privacidade, descricao, escudo, invite_code, created_by, copa_estado, copa_fecho_inscricao, liga_competicao_inicial, estado")
    .eq("invite_code", codigo)
    .maybeSingle();
  if (erroLiga || !liga) {
    return NextResponse.json({ ok: false, erro: "Não encontrámos nenhuma liga com esse código." }, { status: 404 });
  }

  // 2) Já é membro? Não duplica. (Vem ANTES dos portões, para que quem já
  //    se inscreveu a tempo continue a entrar/ver mesmo depois de fechar.)
  const { data: jaMembro } = await supabaseAdmin
    .from("league_members")
    .select("id")
    .eq("league_id", liga.id)
    .eq("user_id", user_id)
    .maybeSingle();
  if (jaMembro) {
    return NextResponse.json({ ok: true, jaEra: true, liga });
  }

  // 2-bis) LIGA TERMINADA: acabou, não se entra nem se pede. Dois formatos.
  if (ligaTerminada(liga)) {
    return NextResponse.json({
      ok: false,
      ligaTerminada: true,
      erro: String(liga.formato) === "copa"
        ? "Esta Copa já terminou e tem campeão. Fica atento à próxima!"
        : "Esta liga já terminou. Fica atento à próxima — ou cria a tua!",
    }, { status: 403 });
  }

  // 2-ter) COPA com inscrições FECHADAS: barra quem chega tarde (não é membro),
  //    seja a copa "aberta" ou "por aprovação". Mesma regra de /entrar.
  if (copaInscricoesFechadas(liga)) {
    return NextResponse.json({
      ok: false,
      copaFechada: true,
      erro: "As inscrições desta Copa já fecharam — não dá para entrar a meio. Fica atento à próxima!",
    }, { status: 403 });
  }

  // 3) Decide conforme a privacidade.
  const priv = String(liga.privacidade || "fechada");

  // 3a) ABERTA → entra direto (com verificação de limite).
  if (priv === "aberta") {
    if (liga.type === "amigos") {
      const bloqueio = await bloqueioPorLimite(user_id, String(liga.formato) === "copa");
      if (bloqueio) return NextResponse.json({ ok: false, limite: true, erro: bloqueio }, { status: 403 });
    }

    // 3a-bis) A liga (pontos corridos) JÁ COMEÇOU? Se a rodada de entrada (alvo de
    //   agora) é posterior à rodada de arranque da liga, este novo membro começa
    //   com 0 pontos e não recupera as rodadas já jogadas. Avisamos e só entramos
    //   com confirmar:true. Mesma regra de /entrar; copas não passam por aqui.
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

    // entrou_competicao = competição-alvo de agora (1ª que este membro joga).
    // Tal como em /entrar: quem entra a meio NÃO herda as rodadas anteriores.
    const { error: erroMembro } = await supabaseAdmin
      .from("league_members")
      .insert({ league_id: liga.id, user_id, score: 0, position: 0, entrou_competicao: alvoAtual.idCompeticao });
    if (erroMembro) {
      return NextResponse.json({ ok: false, erro: "Não foi possível entrar na liga." }, { status: 500 });
    }
    return NextResponse.json({ ok: true, entrou: true, liga });
  }

  // 3b) MEDIANTE PEDIDO → cria (ou confirma) um pedido pendente.
  if (priv === "mediante_pedido") {
    // Já tem pedido? Vê em que estado está.
    const { data: pedidoExistente } = await supabaseAdmin
      .from("league_requests")
      .select("id, estado")
      .eq("league_id", liga.id)
      .eq("user_id", user_id)
      .maybeSingle();

    if (pedidoExistente) {
      if (pedidoExistente.estado === "pendente") {
        return NextResponse.json({ ok: true, jaPediu: true });
      }
      if (pedidoExistente.estado === "recusado") {
        // Foi recusado antes: reabre o pedido (volta a pendente).
        await supabaseAdmin
          .from("league_requests")
          .update({ estado: "pendente", created_at: new Date().toISOString(), decided_at: null })
          .eq("id", pedidoExistente.id);
        // Notifica o dono do (re)pedido.
        await notificarDonoDoPedido(liga.created_by, user_id, liga.name, liga.id);
        return NextResponse.json({ ok: true, pedido: true });
      }
      // estado "aprovado" mas não é membro (caso raro): deixa pedir de novo.
    }

    const { error: erroPedido } = await supabaseAdmin
      .from("league_requests")
      .insert({ league_id: liga.id, user_id, estado: "pendente" });
    if (erroPedido) {
      return NextResponse.json({ ok: false, erro: "Não foi possível enviar o teu pedido." }, { status: 500 });
    }
    // Notifica o dono: "Fulano quer entrar na tua liga X". Personalizado com o
    // nome real de quem pediu e o nome da liga. Não bloqueia se a notificação falhar.
    await notificarDonoDoPedido(liga.created_by, user_id, liga.name, liga.id);
    return NextResponse.json({ ok: true, pedido: true });
  }

  // 3c) FECHADA → não se entra/pede pelo mercado.
  return NextResponse.json({ ok: false, erro: "Esta liga é fechada." }, { status: 403 });
}

// Cria a notificação para o DONO da liga sobre um novo pedido de entrada.
// Mantém-se simples (sem nome/time): só puxa o dono à app. O detalhe de quem
// pediu (nome + time) vê-se na tela de pedidos da liga.
async function notificarDonoDoPedido(
  donoId: string | null | undefined,
  quemPediu: string,
  nomeLiga: string,
  ligaId: string
) {
  if (!donoId || donoId === quemPediu) return; // sem dono, ou o próprio dono — não notifica
  await criarNotificacaoServidor({
    paraUserId: donoId,
    tipo: "liga_pedido",
    titulo: "Novo pedido na tua liga",
    corpo: `Alguém quer entrar na liga "${nomeLiga}". Vê os pedidos para aprovar ou recusar.`,
    link: "/ligas",
  });
}
