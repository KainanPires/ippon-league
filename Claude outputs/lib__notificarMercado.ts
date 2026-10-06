// lib/notificarMercado.ts
//
// Notificações de MERCADO (Grupo B), chamadas pelo cron 1x/dia.
//  - ABERTO: uma vez por competição, a todos, a convidar a montar (com prazo).
//  - VÉSPERA DO FECHO: uma vez por competição, SÓ a quem JÁ montou, a lembrar
//    que ainda dá para conferir/ajustar a equipa antes de fechar (~1 dia antes).
//  - FECHADO: uma vez por competição, personalizado — quem montou ("está em
//    jogo") vs quem não montou ("ficaste de fora, prepara a próxima").
//
// Idempotente via `eventos_notificados`: o cron corre todos os dias, mas cada
// aviso sai UMA vez por competição. USAR APENAS NO SERVIDOR.
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { enviarPushPara } from "@/lib/pushServer";
import { focoMercado, estadoMercado, formatarContagem } from "@/lib/calendario";
import { renderNotif, agruparPorLingua, type LinguaNotif } from "@/lib/i18nServidor";
import { criarNotificacaoServidor } from "@/lib/notificacoesServidor";
import { jcCompradosValidosEmLote } from "@/lib/carteira";
import { reengajarNaoMontaram } from "@/lib/reengajarEmail";

const round1 = (n: number): number => Math.round(n * 10) / 10;
// Folga de arredondamento na verificação de orçamento — igual à da A2
// (lib/congelar): 0.05 JC nunca marca "acima" por um resto de arredondamento.
const FOLGA_ORCAMENTO = 0.05;

// Janela do lembrete de véspera: dispara quando falta ISTO ou menos para o
// fecho (e ainda há tempo > 0). 28h (e não 24h) dá folga: como o cron corre
// 1x/dia, garante que apanhamos o dia anterior mesmo que a hora do cron e a
// hora do fecho não estejam perfeitamente alinhadas.
const VESPERA_MS = 28 * 60 * 60 * 1000;

// Reserva um evento (idempotência). true = ainda não tinha sido notificado.
async function reservarEvento(chave: string): Promise<boolean> {
  if (!supabaseAdmin) return false;
  try {
    const { error } = await supabaseAdmin.from("eventos_notificados").insert({ chave });
    return !error; // erro = chave já existia = já notificado
  } catch {
    return false;
  }
}

// Todos os utilizadores registados (ids).
async function todosOsUtilizadores(): Promise<string[]> {
  if (!supabaseAdmin) return [];
  const { data } = await supabaseAdmin.from("users").select("id");
  return (data || []).map((u) => String(u.id)).filter(Boolean);
}

// Utilizadores que montaram equipa para uma competição (ids únicos).
async function quemMontou(idComp: string): Promise<string[]> {
  if (!supabaseAdmin) return [];
  const { data } = await supabaseAdmin.from("equipas").select("user_id").eq("id_competicao", idComp);
  return [...new Set((data || []).map((e) => String(e.user_id)).filter(Boolean))];
}

// Quem tem a equipa guardada ACIMA do orçamento efetivo para uma competição —
// devolve um mapa user_id -> quanto está acima (JC). MESMO critério da A2
// (lib/congelar -> pontuarUtilizadoresDaCompeticao): a equipa fica inativa no
// fecho se o valor de compra exceder o orçamento efetivo
// (orcamento − orcamento_comprado + comprados_agora). Só entra quem TEM o
// orçamento e os preços de compra de todos os atletas gravados — na dúvida NÃO
// se avisa (e no fecho também não se penaliza). Como o cliente bloqueia guardar
// acima e o carry-over não grava sozinho, na prática isto só apanha o caso do
// REEMBOLSO de JC comprados — que é exatamente quem arrisca ficar inativo.
async function quemAcimaDoOrcamento(idComp: string): Promise<Map<string, number>> {
  const fora = new Map<string, number>();
  if (!supabaseAdmin) return fora;
  const { data } = await supabaseAdmin
    .from("equipas")
    .select("user_id, atletas, precos, orcamento, orcamento_comprado")
    .eq("id_competicao", idComp);
  const lista = data || [];
  if (lista.length === 0) return fora;
  const compradosAgora = await jcCompradosValidosEmLote(lista.map((e) => String(e.user_id)));
  for (const e of lista) {
    const orcamento = (e as { orcamento?: unknown }).orcamento;
    const orcamentoComprado = (e as { orcamento_comprado?: unknown }).orcamento_comprado;
    const precos = (e as { precos?: unknown }).precos;
    if (orcamento == null || !Number.isFinite(Number(orcamento))) continue;
    if (orcamentoComprado == null || !Number.isFinite(Number(orcamentoComprado))) continue;
    if (!precos || typeof precos !== "object") continue;
    const ids = Array.isArray((e as { atletas?: unknown }).atletas)
      ? ((e as { atletas: unknown[] }).atletas as unknown[]).map(String)
      : [];
    if (ids.length === 0) continue;
    const mapa = precos as Record<string, unknown>;
    if (!ids.every((id) => Number.isFinite(Number(mapa[id])))) continue;
    const valorEquipa = round1(ids.reduce((s, id) => s + Number(mapa[id]), 0));
    const compradoAgora = compradosAgora.get(String(e.user_id)) ?? 0;
    const orcamentoEfetivo = round1(Number(orcamento) - Number(orcamentoComprado) + compradoAgora);
    if (valorEquipa > orcamentoEfetivo + FOLGA_ORCAMENTO) {
      fora.set(String(e.user_id), round1(valorEquipa - orcamentoEfetivo));
    }
  }
  return fora;
}

// Notifica muitos utilizadores de uma vez (sino em massa + push em massa).
//
// Pode receber texto PRONTO (titulo/corpo) — o modo antigo — ou uma CHAVE
// (chaveTitulo/chaveCorpo + vars). Por chave, agrupa os destinatários por língua
// e renderiza cada texto UMA vez por grupo: assim uma notificação para todos sai
// na língua de cada um sem uma chamada por pessoa.
async function notificarMuitos(
  userIds: string[],
  n: {
    tipo: string;
    titulo?: string;
    corpo?: string;
    link?: string;
    chaveTitulo?: string;
    chaveCorpo?: string;
    vars?: Record<string, string | number>;
  }
): Promise<void> {
  if (!supabaseAdmin) return;
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return;

  // --- Por CHAVE: um texto por língua, cada grupo recebe o seu. ---
  if (n.chaveTitulo) {
    const grupos = await agruparPorLingua(ids);
    for (const [lg, gids] of Object.entries(grupos)) {
      if (!gids.length) continue;
      const titulo = renderNotif(lg as LinguaNotif, n.chaveTitulo, n.vars);
      const corpo = n.chaveCorpo ? renderNotif(lg as LinguaNotif, n.chaveCorpo, n.vars) : undefined;
      try {
        await supabaseAdmin.from("notificacoes").insert(
          gids.map((user_id) => ({ user_id, tipo: n.tipo, titulo, corpo: corpo ?? null, link: n.link ?? null }))
        );
      } catch {}
      try {
        await enviarPushPara(gids, { titulo, corpo, link: n.link });
      } catch {}
    }
    return;
  }

  // --- Legado: texto pronto, igual para todos. ---
  const titulo = n.titulo ?? "";
  try {
    const linhas = ids.map((user_id) => ({
      user_id,
      tipo: n.tipo,
      titulo,
      corpo: n.corpo ?? null,
      link: n.link ?? null,
    }));
    await supabaseAdmin.from("notificacoes").insert(linhas);
  } catch {}
  try {
    await enviarPushPara(ids, { titulo, corpo: n.corpo, link: n.link });
  } catch {}
}

/**
 * Verifica o estado do mercado e envia as notificações de aberto/véspera/fechado.
 * Idempotente: cada aviso sai uma vez por competição.
 */
export async function notificarMercado(hoje: Date = new Date()): Promise<{ aberto: string | null; vespera: string | null; fechado: string | null }> {
  if (!supabaseAdmin) return { aberto: null, vespera: null, fechado: null };
  const foco = focoMercado(hoje);
  let aberto: string | null = null;
  let vespera: string | null = null;
  let fechado: string | null = null;

  // --- MERCADO ABERTO (competição alvo) ---
  // REGRA: o mercado da PRÓXIMA competição só "abre" depois de a competição que
  // está a decorrer terminar. Enquanto houver uma competição a decorrer
  // (foco.aDecorrer), NÃO anunciamos o mercado aberto da seguinte — senão sai
  // cedo demais (ex.: anunciar o Qingdao enquanto o Ulaanbaatar ainda joga).
  // A verificação do aDecorrer vem ANTES da reserva do evento, para não "queimar"
  // a chave: assim, quando a competição atual terminar, o anúncio ainda pode sair.
  if (foco.alvo && !foco.aDecorrer && estadoMercado(foco.alvo, hoje).estado === "aberto") {
    if (await reservarEvento(`mercado_aberto:${foco.alvo.idCompeticao}`)) {
      const ids = await todosOsUtilizadores();
      // Prazo até fechar, em formato NEUTRO de língua (ex.: "5d 3h", "3h 20min"),
      // para o texto sair traduzido sem "vazar" português no meio da frase.
      const est = estadoMercado(foco.alvo, hoje);
      let msAteFecho: number | null = est.msAteFecho;
      if (msAteFecho === null) {
        const inicioDia = new Date(foco.alvo.de.replace(/\//g, "-") + "T00:00:00").getTime();
        msAteFecho = inicioDia - hoje.getTime();
      }
      const tempo = formatarContagem(Math.max(0, msAteFecho));
      await notificarMuitos(ids, {
        tipo: "mercado",
        chaveTitulo: "mercado.abertoTitulo",
        chaveCorpo: "mercado.abertoCorpo",
        vars: { comp: foco.alvo.nome, tempo },
        link: "/inicio",
      });
      aberto = foco.alvo.idCompeticao;
    }
  }

  // --- VÉSPERA DO FECHO (competição alvo, mercado ainda aberto) ---
  // Dispara quando falta ~1 dia para o mercado fechar e SÓ para quem JÁ montou —
  // um empurrão para conferir/ajustar a equipa antes do fecho. Quem ainda não
  // montou NÃO recebe este (a regra pedida foi só para quem montou). Uma vez por
  // competição (chave mercado_vespera:<id>).
  // Também aqui só faz sentido se NÃO houver competição a decorrer (a véspera é
  // do fecho do mercado da próxima — não enquanto outra ainda joga).
  if (foco.alvo && !foco.aDecorrer) {
    const est = estadoMercado(foco.alvo, hoje);
    // "Falta cerca de 1 dia": com hora oficial usamos msAteFecho; sem hora,
    // calculamos os ms até à meia-noite do dia de início (quando o mercado fecha).
    let msAteFecho: number | null = est.msAteFecho;
    if (msAteFecho === null) {
      const inicioDia = new Date(foco.alvo.de.replace(/\//g, "-") + "T00:00:00").getTime();
      msAteFecho = inicioDia - hoje.getTime();
    }
    const naJanela = msAteFecho !== null && msAteFecho > 0 && msAteFecho <= VESPERA_MS;
    if (naJanela && (await reservarEvento(`mercado_vespera:${foco.alvo.idCompeticao}`))) {
      const montaram = await quemMontou(foco.alvo.idCompeticao);
      const restante = formatarContagem(msAteFecho); // ex.: "23h 10min" ou "1d 0h"
      if (montaram.length > 0) {
        // ACIMA DO ORÇAMENTO: quem tem a equipa guardada a valer mais do que o
        // orçamento (ver A2) recebe um aviso ESPECÍFICO — arrisca ficar inativo
        // se não vender antes do fecho. Os restantes recebem o lembrete normal.
        const acima = await quemAcimaDoOrcamento(foco.alvo.idCompeticao);
        const resto = montaram.filter((id) => !acima.has(id));
        if (resto.length > 0) {
          await notificarMuitos(resto, {
            tipo: "mercado",
            chaveTitulo: "mercado.ajustarTitulo",
            chaveCorpo: "mercado.ajustarCorpo",
            vars: { comp: foco.alvo.nome, tempo: restante },
            link: "/meu-time",
          });
        }
        // Aviso de orçamento por utilizador (o {jc} acima é diferente para cada
        // um). O conjunto é pequeno (na prática, só reembolsos), por isso um a um
        // é seguro. `criarNotificacaoServidor` traduz na língua de cada um.
        for (const [uid, jcAcima] of acima) {
          await criarNotificacaoServidor({
            paraUserId: uid,
            tipo: "mercado",
            chaveTitulo: "mercado.orcamentoTitulo",
            chaveCorpo: "mercado.orcamentoCorpo",
            vars: { comp: foco.alvo.nome, tempo: restante, jc: jcAcima },
            link: "/meu-time",
          });
        }
      }
      // REENGAJAMENTO por email: a quem NÃO montou (todos, decisão do Kainan),
      // a puxá-lo a montar antes do fecho. Best-effort; não bloqueia o resto.
      try { await reengajarNaoMontaram(foco.alvo.idCompeticao, foco.alvo.nome, restante, montaram); } catch {}
      vespera = foco.alvo.idCompeticao;
    }
  }

  // --- MERCADO FECHADO (competição a decorrer) ---
  if (foco.aDecorrer && (await reservarEvento(`mercado_fechado:${foco.aDecorrer.idCompeticao}`))) {
    const comp = foco.aDecorrer;
    const montaram = await quemMontou(comp.idCompeticao);
    const setMont = new Set(montaram);
    const todos = await todosOsUtilizadores();
    const naoMontaram = todos.filter((id) => !setMont.has(id));

    // Quem montou: a equipa está em jogo.
    await notificarMuitos(montaram, {
      tipo: "mercado",
      chaveTitulo: "mercado.fechadoJogoTitulo",
      chaveCorpo: "mercado.fechadoJogoCorpo",
      vars: { comp: comp.nome },
      link: "/meu-time",
    });

    // Quem não montou: ficou de fora — incentivo para a próxima.
    await notificarMuitos(naoMontaram, {
      tipo: "mercado",
      chaveTitulo: "mercado.fechadoForaTitulo",
      chaveCorpo: "mercado.fechadoForaCorpo",
      vars: { comp: comp.nome },
      link: "/inicio",
    });

    fechado = comp.idCompeticao;
  }

  return { aberto, vespera, fechado };
}