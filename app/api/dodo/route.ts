// app/api/dodo/route.ts
//
// MATA-MATA DO DÔDO — inscrições e sorteio.
//
//   GET  /api/dodo                        -> a edição atual e o meu estado
//   POST /api/dodo  { acao: "inscrever" } -> inscreve-me
//   POST /api/dodo  { acao: "sair" }      -> retira a minha inscrição
//   GET  /api/dodo?sortear=1&key=SEGREDO  -> faz o sorteio (cron ou à mão)
//
// ---------------------------------------------------------------------------
// SÓ PRO E PRO MAX
//
// Verificado no SERVIDOR, lendo a tabela `users` — a mesma fonte que o resto da
// app usa para decidir acessos. E os níveis são cumulativos: quem tem Pro Max
// tem tudo o que o Pro tem, por isso a condição é `is_pro OU is_pro_max`, nunca
// só `is_pro`.
//
// ---------------------------------------------------------------------------
// O CONTINENTE FICA GRAVADO NA INSCRIÇÃO
//
// E não é lido outra vez no sorteio. Se alguém mudar o país no perfil entre a
// inscrição e o sorteio, concorre pelo continente com que se inscreveu — senão,
// mudar o país seria uma forma de saltar para um continente com menos
// concorrência na véspera do sorteio.
//
// ---------------------------------------------------------------------------
// A CHAVE É GERADA AQUI, NO FIM DO SORTEIO  (corrigido)
//
// Antes, esta rota criava a liga da Copa e ficava por aí. A liga nascia com
// copa_estado='inscricao' e SEM copa_fecho_inscricao — e:
//
//   • o /api/copa/sortear recusa sortear sem copa_fecho_inscricao (erro 400);
//   • o disparo desse sortear é "preguiçoso", feito pela página da liga, e a
//     liga da Copa não tem invite_code, por isso não há página que o dispare;
//   • o cron só apura copas em 'sorteada' ou 'a_decorrer', nunca em 'inscricao'.
//
// Resultado: a Copa nascia com os 32 lá dentro e ficava parada para sempre.
//
// Agora a chave é gerada aqui mesmo, logo a seguir ao sorteio das vagas. Faz
// sentido: neste ponto já sabemos exatamente quem entrou, e não há nada por que
// esperar. A copa_fecho_inscricao fica gravada na mesma, para o /api/copa/sortear
// continuar coerente se alguém o chamar (devolve jaEstava e não faz nada).
//
// ---------------------------------------------------------------------------
// NOTIFICAÇÕES
//
// Três momentos, no sininho:
//   1. inscrição aceite  — confirma e diz QUANDO sai o sorteio
//   2. sorteado          — parabéns, e o que fazer a seguir
//   3. não sorteado      — sem rodeios, e sem deixar a pessoa sem próximo passo
//
// Nenhuma delas bloqueia: uma notificação falhada não pode desfazer um sorteio.
// A idempotência vem de graça — a inscrição só entra uma vez (índice único) e o
// sorteio só corre uma vez por edição (a edição muda de estado no fim).
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sortearVagas, tamanhoDaChave, VAGAS_POR_CONTINENTE, TOTAL_VAGAS } from "@/lib/sorteioDodo";
// São CINCO continentes (as federações da IJF), e as chaves de NOME_CONTINENTE
// são a lista deles. Não há uma constante CONTINENTES separada — usar as chaves
// evita ter duas listas a poder divergir.
import { NOME_CONTINENTE, type Continente } from "@/lib/continentes";
import { focoMercado } from "@/lib/calendario";
import { gerarPrimeiraRonda } from "@/lib/copa";
import { criarNotificacaoServidor } from "@/lib/notificacoesServidor";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Data por extenso, para o texto das notificações. */
function dataPT(iso: string | null | undefined): string {
  if (!iso) return "em breve";
  const t = Date.parse(String(iso));
  if (!Number.isFinite(t)) return "em breve";
  return new Date(t).toLocaleDateString("pt-PT", { day: "2-digit", month: "long" });
}

/** Quem está a pedir, a partir do token da sessão. */
async function uidDoPedido(req: Request): Promise<string | null> {
  try {
    const auth = req.headers.get("authorization") || "";
    const t = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
    if (!t) return null;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const pub = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
    if (!url || !pub) return null;
    const sb = createClient(url, pub, {
      global: { headers: { Authorization: `Bearer ${t}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await sb.auth.getUser();
    if (error) return null;
    return data?.user?.id ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// GET — a edição atual, ou o sorteio.
// ---------------------------------------------------------------------------
export async function GET(req: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ ok: false, erro: "Servidor sem ligação." }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);

  // --- SORTEIO (cron ou disparo manual) ---
  if (searchParams.get("sortear") === "1") {
    const key = (searchParams.get("key") || "").trim();
    if (!process.env.CRON_SECRET || key !== process.env.CRON_SECRET) {
      return NextResponse.json({ ok: false, erro: "Não autorizado." }, { status: 401 });
    }
    return sortear(searchParams.get("simular") === "1");
  }

  // --- Estado atual ---
  // NOTA: 'preparada' fica de fora de propósito. Uma edição preparada existe
  // mas ninguém a vê — serve para deixar tudo pronto e só abrir as inscrições
  // quando houver publicidade a acompanhar. Abrir sem ninguém saber daria uma
  // Copa com três inscritos.
  const { data: edicao } = await supabaseAdmin
    .from("dodo_edicoes")
    .select("*")
    .in("estado", ["inscricoes", "sorteada", "a_decorrer"])
    .order("numero", { ascending: false })
    .maybeSingle();

  if (!edicao) {
    // Não há edição visível — mas se houver uma PREPARADA com data de abertura,
    // dizemos QUANDO abre. A página mostra a contagem; a edição continua
    // invisível em tudo o resto (nome, número, inscrições). Saber que abre a 12
    // de março não é o mesmo que poder entrar hoje.
    let abre_em: string | null = null;
    try {
      const { data: prep } = await supabaseAdmin
        .from("dodo_edicoes")
        .select("*")
        .eq("estado", "preparada")
        .order("numero", { ascending: true })
        .maybeSingle();
      // Coluna opcional: se ainda não existir na tabela, fica null e a página
      // volta ao texto genérico. Nada rebenta por causa disto.
      const d = (prep as Record<string, unknown> | null)?.inscricoes_de;
      if (d) abre_em = String(d);
    } catch { /* sem data: a página diz apenas "em breve" */ }

    return NextResponse.json({ ok: true, edicao: null, abre_em, nota: "Não há edição a decorrer." });
  }

  // Quantos por continente, para a página mostrar onde há mais concorrência.
  const { data: inscritos } = await supabaseAdmin
    .from("dodo_inscricoes")
    .select("continente, sorteada")
    .eq("edicao_id", edicao.id);

  const porContinente: Record<string, number> = {};
  for (const i of inscritos || []) {
    const c = String(i.continente);
    porContinente[c] = (porContinente[c] ?? 0) + 1;
  }

  // O código de convite da liga da Copa, para a página abrir a chave direto.
  let invite_code: string | null = null;
  if (edicao.league_id) {
    try {
      const { data: lg } = await supabaseAdmin
        .from("leagues").select("invite_code").eq("id", edicao.league_id).maybeSingle();
      if (lg?.invite_code) invite_code = String(lg.invite_code);
    } catch { /* sem código: a página cai em /ligas */ }
  }

  // O meu estado, se houver sessão.
  const uid = await uidDoPedido(req);
  let eu: { inscrito: boolean; sorteada: boolean | null; podeInscrever: boolean; motivo?: string } | null = null;
  if (uid) {
    const { data: u } = await supabaseAdmin
      .from("users").select("is_pro, is_pro_max, continente").eq("id", uid).maybeSingle();
    const ehPro = !!u?.is_pro || !!u?.is_pro_max;

    const { data: minha } = await supabaseAdmin
      .from("dodo_inscricoes").select("sorteada").eq("edicao_id", edicao.id).eq("user_id", uid).maybeSingle();

    const aberto = String(edicao.estado) === "inscricoes"
      && !!edicao.inscricoes_ate
      && Date.now() < Date.parse(String(edicao.inscricoes_ate));

    eu = {
      inscrito: !!minha,
      sorteada: minha ? (minha.sorteada as boolean | null) : null,
      podeInscrever: ehPro && aberto && !minha,
      motivo: !ehPro
        ? "O Mata-Mata do Dôdo é para membros Ippon Pro."
        : !aberto ? "As inscrições já fecharam." : undefined,
    };
  }

  return NextResponse.json({
    ok: true,
    edicao: {
      id: edicao.id, numero: edicao.numero, ano: edicao.ano, estado: edicao.estado,
      nome: `${edicao.numero}ª Copa do Dôdo entre Continentes · ${edicao.ano || new Date().getFullYear()}`,
      inscricoes_ate: edicao.inscricoes_ate, league_id: edicao.league_id, invite_code,
    },
    inscritos: (inscritos || []).length,
    porContinente,
    vagasPorContinente: VAGAS_POR_CONTINENTE,
    totalVagas: TOTAL_VAGAS,
    eu,
  });
}

// ---------------------------------------------------------------------------
// O SORTEIO
// ---------------------------------------------------------------------------
async function sortear(simular: boolean) {
  if (!supabaseAdmin) return NextResponse.json({ ok: false }, { status: 500 });

  const { data: edicao } = await supabaseAdmin
    .from("dodo_edicoes").select("*").eq("estado", "inscricoes")
    .order("numero", { ascending: false }).maybeSingle();

  if (!edicao) return NextResponse.json({ ok: true, nada: "Nenhuma edição com inscrições abertas." });

  // Ainda dentro do prazo? O sorteio só acontece depois de fecharem.
  if (!edicao.inscricoes_ate || Date.now() < Date.parse(String(edicao.inscricoes_ate))) {
    return NextResponse.json({ ok: true, aguarda: true, inscricoes_ate: edicao.inscricoes_ate });
  }

  const { data: inscricoes } = await supabaseAdmin
    .from("dodo_inscricoes").select("id, user_id, continente").eq("edicao_id", edicao.id);

  const lista: { id: string; user_id: string; continente: string }[] =
    (inscricoes || []).map((i) => ({
      id: String(i.id), user_id: String(i.user_id), continente: String(i.continente),
    }));

  // Com menos de 2, não há mata-mata. A edição fica à espera em vez de arrancar
  // vazia — e o prazo pode ser estendido à mão.
  if (lista.length < 2) {
    return NextResponse.json({ ok: true, poucos: true, inscritos: lista.length });
  }

  const r = sortearVagas(lista, Object.keys(NOME_CONTINENTE));

  // A chave tem de ser potência de 2. Com 24 sorteados joga-se com 16 — melhor
  // do que inventar byes que dariam vantagem a uns sem eles fazerem nada.
  const tamanho = tamanhoDaChave(r.sorteados.length);
  const entram = r.sorteados.slice(0, tamanho);

  if (simular) {
    return NextResponse.json({
      ok: true, simulacao: true, edicao: edicao.numero,
      inscritos: lista.length, sorteados: r.sorteados.length,
      tamanhoChave: tamanho, resumo: r.resumo,
    });
  }

  // Marca quem entrou e quem não.
  const idsEntram = new Set(entram.map((e) => e.id));
  for (const s of r.sorteados) {
    await supabaseAdmin.from("dodo_inscricoes")
      .update({ sorteada: idsEntram.has(s.id), por_redistribuicao: s.porRedistribuicao })
      .eq("id", s.id);
  }
  for (const e of r.excluidos) {
    await supabaseAdmin.from("dodo_inscricoes").update({ sorteada: false }).eq("id", e.id);
  }

  // Cria a liga que vai gerir a chave. Reaproveita toda a máquina de mata-mata
  // que já existe — confrontos, apuramento, herança de equipa, desempates.
  const alvo = focoMercado().alvo;
  const { data: liga } = await supabaseAdmin.from("leagues").insert({
    // O nome oficial da edição. Contínuo desde sempre (1.ª, 2.ª, 3.ª...), com o
    // ano à parte: a 15.ª Copa vale mais como marca do que "a 3.ª de 2029".
    name: `${edicao.numero}ª Copa do Dôdo entre Continentes · ${edicao.ano || new Date().getFullYear()}`,
    type: "oficial",
    formato: "copa",
    privacidade: "fechada",
    copa_estado: "inscricao",
    copa_competicao_inicial: alvo.idCompeticao,
    // GRAVADO AGORA (era o que faltava): sem esta data o /api/copa/sortear
    // recusa-se a sortear. Fica com o instante em que as inscrições fecharam,
    // que é a verdade — foi mesmo aí que a inscrição acabou.
    copa_fecho_inscricao: edicao.inscricoes_ate,
    estado: "ativa",
  }).select("id, invite_code").maybeSingle();

  let confrontosCriados = 0;

  if (liga?.id) {
    for (const e of entram) {
      await supabaseAdmin.from("league_members").insert({
        league_id: liga.id, user_id: e.user_id, score: 0, position: 0,
        entrou_competicao: alvo.idCompeticao,
      });
    }

    // --- A CHAVE ---
    // Gerada já. Não há motivo para esperar: os participantes estão decididos.
    try {
      const confrontos = gerarPrimeiraRonda(entram.map((e) => e.user_id), alvo.idCompeticao);
      const linhas = confrontos.map((c) => ({
        league_id: liga.id,
        ronda: c.ronda,
        ordem: c.ordem,
        fase: c.fase,
        jogador_a: c.jogador_a,
        jogador_b: c.jogador_b,
        id_competicao: c.id_competicao,
        estado: c.estado,
        metade: c.metade,
        // Confrontos com bye já vêm decididos (o jogador passa sozinho).
        ...(c.jogador_b === null
          ? { vencedor: c.jogador_a, decidido_por: "bye", estado: "decidido" }
          : {}),
      }));
      if (linhas.length > 0) {
        const { error: erroChave } = await supabaseAdmin.from("copa_confrontos").insert(linhas);
        if (!erroChave) {
          confrontosCriados = linhas.length;
          // Só passa a 'sorteada' se a chave GRAVOU. Uma copa marcada como
          // sorteada sem confrontos seria pior do que uma por sortear: o cron
          // passava a apurá-la e não encontrava nada para decidir.
          await supabaseAdmin.from("leagues")
            .update({ copa_estado: "sorteada" }).eq("id", liga.id);
        }
      }
    } catch { /* a chave falhou: a liga fica em 'inscricao' e pode ser sorteada à mão */ }

    await supabaseAdmin.from("dodo_edicoes")
      .update({ estado: "sorteada", league_id: liga.id, competicao_inicial: alvo.idCompeticao })
      .eq("id", edicao.id);
  }

  // --- Avisar toda a gente ---
  // Depois de tudo gravado. Uma notificação que falhe não desfaz um sorteio.
  const linkChave = liga?.invite_code ? `/liga/${liga.invite_code}` : "/dodo";
  const nEntraram = entram.length;

  for (const e of entram) {
    try {
      await criarNotificacaoServidor({
        paraUserId: e.user_id,
        tipo: "dodo_sorteado",
        titulo: `🏆 Entraste na ${edicao.numero}ª Copa do Dôdo!`,
        corpo: `Parabéns — a tua vaga saiu no sorteio. És um dos ${nEntraram} em prova e, a partir de agora, cada rodada elimina metade. Fica atento às competições seguintes: os pontos da tua equipa contam a sério e não há segunda hipótese. Vais representar o teu país e o teu continente. Boa sorte, campeão!`,
        link: linkChave,
      });
    } catch { /* um push falhado não bloqueia os outros */ }
  }

  const idsQueEntraram = new Set(entram.map((e) => e.user_id));
  const foraIds = lista.map((i) => i.user_id).filter((u) => !idsQueEntraram.has(u));
  for (const u of foraIds) {
    try {
      await criarNotificacaoServidor({
        paraUserId: u,
        tipo: "dodo_nao_sorteado",
        titulo: "A tua vaga não saiu no sorteio",
        corpo: `Houve mais inscritos do que lugares na ${edicao.numero}ª Copa do Dôdo e o sorteio decidiu. Não teve nada a ver com o teu desempenho — foi mesmo sorte. A próxima edição volta a abrir com todas as vagas em jogo, e podes acompanhar esta Copa na mesma. Até lá, há as ligas Mundial e Continental a correr.`,
        link: "/dodo",
      });
    } catch { /* idem */ }
  }

  return NextResponse.json({
    ok: true, edicao: edicao.numero, league_id: liga?.id ?? null,
    inscritos: lista.length, entraram: entram.length,
    tamanhoChave: tamanho, confrontos: confrontosCriados, resumo: r.resumo,
  });
}

// ---------------------------------------------------------------------------
// POST — inscrever-me, ou sair.
// ---------------------------------------------------------------------------
export async function POST(req: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ ok: false, erro: "Servidor sem ligação." }, { status: 500 });
  }

  const uid = await uidDoPedido(req);
  if (!uid) return NextResponse.json({ ok: false, erro: "Entra na tua conta." }, { status: 401 });

  let corpo: { acao?: string };
  try { corpo = await req.json(); } catch {
    return NextResponse.json({ ok: false, erro: "Pedido inválido." }, { status: 400 });
  }

  const { data: edicao } = await supabaseAdmin
    .from("dodo_edicoes").select("id, numero, estado, inscricoes_ate")
    .eq("estado", "inscricoes").order("numero", { ascending: false }).maybeSingle();

  if (!edicao) {
    return NextResponse.json({ ok: false, erro: "Não há inscrições abertas." }, { status: 409 });
  }
  if (!edicao.inscricoes_ate || Date.now() >= Date.parse(String(edicao.inscricoes_ate))) {
    return NextResponse.json({ ok: false, erro: "As inscrições já fecharam." }, { status: 409 });
  }

  if (corpo.acao === "sair") {
    await supabaseAdmin.from("dodo_inscricoes").delete()
      .eq("edicao_id", edicao.id).eq("user_id", uid);
    return NextResponse.json({ ok: true, saiu: true });
  }

  if (corpo.acao !== "inscrever") {
    return NextResponse.json({ ok: false, erro: "Ação desconhecida." }, { status: 400 });
  }

  // O plano: Pro OU Pro Max (níveis cumulativos).
  const { data: u } = await supabaseAdmin
    .from("users").select("is_pro, is_pro_max, continente, country_code").eq("id", uid).maybeSingle();

  if (!u?.is_pro && !u?.is_pro_max) {
    return NextResponse.json({
      ok: false, precisaPro: true,
      erro: "O Mata-Mata do Dôdo é para membros Ippon Pro.",
    }, { status: 403 });
  }

  const continente = String(u?.continente || "");
  if (!continente) {
    return NextResponse.json({
      ok: false,
      erro: "Falta o teu país no perfil — é ele que define por que continente concorres.",
    }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("dodo_inscricoes").insert({
    edicao_id: edicao.id, user_id: uid,
    // Gravado agora, e não lido no sorteio: ver a nota no topo.
    continente, pais: u?.country_code ? String(u.country_code) : null,
  });

  if (error) {
    // O índice único apanha a segunda inscrição da mesma pessoa. Não notifica
    // outra vez — é exatamente por isso que a notificação vive DEPOIS do insert
    // e não antes: uma pessoa, uma inscrição, uma mensagem.
    return NextResponse.json({ ok: true, jaEstava: true });
  }

  const nomeCont = NOME_CONTINENTE[continente as Continente] || continente;

  // Confirmação no sininho. Diz o que interessa: está feito, e QUANDO se sabe.
  try {
    await criarNotificacaoServidor({
      paraUserId: uid,
      tipo: "dodo_inscricao",
      titulo: `Inscrição feita na ${edicao.numero}ª Copa do Dôdo`,
      corpo: `Estás no sorteio, a concorrer pelas vagas d${nomeCont === "Ásia" || nomeCont === "África" || nomeCont === "América" ? "a" : "o"} ${nomeCont}. O sorteio sai a ${dataPT(edicao.inscricoes_ate)}, na véspera da competição que abre a Copa, e avisamos-te aqui no momento. Não é por ordem de chegada: teres-te inscrito hoje ou no último dia dá exatamente a mesma hipótese.`,
      link: "/dodo",
    });
  } catch { /* a inscrição está feita; o aviso é um extra */ }

  return NextResponse.json({
    ok: true, inscrito: true,
    continente, nomeContinente: nomeCont,
  });
}
