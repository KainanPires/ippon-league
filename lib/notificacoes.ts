// lib/notificacoes.ts
// Sistema de notificações da Ippon League (Leva 1).
//
// Há DUAS fontes de notificações, e o sino junta as duas:
//
//  1) GUARDADAS — linhas na tabela `notificacoes` do Supabase. São eventos que
//     aconteceram num momento (pedido de liga, apuramento da Copa, etc.) e que o
//     utilizador pode não ter visto. Expiram 30 dias após criadas (ver migração).
//     Nesta Leva 1 deixamos as funções prontas; ligar os eventos é a Leva 2.
//
//  2) CALCULADAS — derivadas do estado atual, sem tocar na BD. Ex.: "o mercado
//     fecha em 5h" (vem do calendário) ou "estás perto do Top 10" (vem do
//     ranking). São recalculadas sempre que o sino abre — nunca ficam "velhas".
//
// O componente do sino chama `listarTudo()` que devolve as duas, já unidas e
// ordenadas, prontas para mostrar.

import { supabase } from "@/lib/supabase";
import { focoMercado, textoFecho, estadoMercado } from "@/lib/calendario";

// Tipos de evento conhecidos (texto livre na BD, mas usamos estes no código).
export type TipoNotificacao =
  | "liga_pedido"
  | "liga_aprovado"
  | "copa_avancou"
  | "copa_eliminado"
  | "copa_campeao"
  | "faixa_subiu"
  | "faixa_desceu"
  | "ranking"
  | "resumo_rodada"
  | "mercado"; // calculada

// Uma notificação tal como o sino a mostra (vinda da BD ou calculada).
export interface Notificacao {
  id: string;
  tipo: TipoNotificacao | string;
  titulo: string;
  corpo?: string | null;
  link?: string | null;
  lida: boolean;
  criadaEm: number;       // epoch ms (para ordenar)
  calculada?: boolean;    // true = não está na BD (não se "marca como lida" na BD)
}

// Forma da linha como vem do Supabase.
interface LinhaNotificacao {
  id: string;
  tipo: string;
  titulo: string;
  corpo: string | null;
  link: string | null;
  lida: boolean;
  criada_em: string;
  expira_em: string;
}

// ---------------------------------------------------------------------------
// GUARDADAS (Supabase)
// ---------------------------------------------------------------------------

/** id do utilizador atual (ou null se deslogado). */
async function userId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return (data.session as { user?: { id?: string } } | null)?.user?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Cria uma notificação guardada para o utilizador atual.
 * Usada (na Leva 2) nos pontos onde os eventos acontecem.
 * Devolve true se gravou. Falha em silêncio (a app não deve partir por causa
 * de uma notificação não gravada).
 */
export async function criarNotificacao(
  n: { tipo: TipoNotificacao | string; titulo: string; corpo?: string; link?: string },
  paraUserId?: string
): Promise<boolean> {
  try {
    const uid = paraUserId ?? (await userId());
    if (!uid) return false;
    const { error } = await supabase.from("notificacoes").insert({
      user_id: uid,
      tipo: n.tipo,
      titulo: n.titulo,
      corpo: n.corpo ?? null,
      link: n.link ?? null,
    });
    return !error;
  } catch {
    return false;
  }
}

/** Lê as notificações guardadas (não expiradas) do utilizador, mais recentes primeiro. */
export async function listarGuardadas(): Promise<Notificacao[]> {
  try {
    const uid = await userId();
    if (!uid) return [];
    const agora = new Date().toISOString();
    const { data, error } = await supabase
      .from("notificacoes")
      .select("id, tipo, titulo, corpo, link, lida, criada_em, expira_em")
      .eq("user_id", uid)
      .gt("expira_em", agora)
      .order("criada_em", { ascending: false })
      .limit(50);
    if (error || !data) return [];
    return (data as LinhaNotificacao[]).map((l) => ({
      id: l.id,
      tipo: l.tipo,
      titulo: l.titulo,
      corpo: l.corpo,
      link: l.link,
      lida: l.lida,
      criadaEm: new Date(l.criada_em).getTime(),
    }));
  } catch {
    return [];
  }
}

/** Marca uma notificação guardada como lida. */
export async function marcarLida(id: string): Promise<void> {
  try {
    await supabase.from("notificacoes").update({ lida: true }).eq("id", id);
  } catch {}
}

/** Marca TODAS as guardadas do utilizador como lidas. */
export async function marcarTodasLidas(): Promise<void> {
  try {
    const uid = await userId();
    if (!uid) return;
    await supabase.from("notificacoes").update({ lida: true }).eq("user_id", uid).eq("lida", false);
  } catch {}
}

// ---------------------------------------------------------------------------
// CALCULADAS (sem BD) — derivadas do estado atual
// ---------------------------------------------------------------------------

// Estas notificações não se guardam. São recalculadas cada vez que o sino abre.
// Para o "ponto vermelho" de não lidas não chatear para sempre, lembramo-nos
// (no aparelho) de quais já foram vistas, por uma chave estável do conteúdo.
const VISTAS_KEY = "ippon_notif_calc_vistas";

function vistasCalculadas(): Record<string, true> {
  try {
    return JSON.parse(localStorage.getItem(VISTAS_KEY) || "{}");
  } catch {
    return {};
  }
}
function marcarCalculadaVista(chave: string) {
  try {
    const v = vistasCalculadas();
    v[chave] = true;
    localStorage.setItem(VISTAS_KEY, JSON.stringify(v));
  } catch {}
}

/**
 * Gera as notificações calculadas do momento (mercado + faixa/ranking).
 *
 * ── PRINCÍPIO DE OURO (vale para TODA notificação, calculada ou guardada) ──
 * Uma notificação NUNCA é genérica. Antes de gerar o texto, verifica-se o estado
 * REAL do utilizador e a mensagem é ajustada a ele. Exemplos:
 *   • mercado a fechar → COM equipa: "confere a tua equipa"; SEM equipa: "escala já!"
 *   • o destino (link) também muda conforme o estado (/meu-time vs /criar-equipa).
 * Ao adicionar QUALQUER notificação nova (aqui ou na Leva 2), passa pelos dados
 * do utilizador (tem equipa? que faixa? que posição?) e personaliza título, corpo
 * e link. Nada de mensagens iguais para toda a gente.
 *
 * `opts` traz o que se sabe do utilizador neste momento. Quanto mais completo,
 * mais personalizadas as notificações. Tudo é opcional: o que faltar, não gera
 * a notificação correspondente (em vez de gerar uma genérica).
 */
export function gerarCalculadas(opts?: {
  temEquipa?: boolean;        // já tem equipa COMPLETA escalada para a competição-alvo?
  faixaAtual?: string;
  faixaAnterior?: string;
  posicaoAtual?: number;
  posicaoAnterior?: number;
  distanciaTop10?: number; // pontos até ao Top 10, se conhecido
}): Notificacao[] {
  const out: Notificacao[] = [];
  const vistas = vistasCalculadas();
  const push = (chave: string, n: Omit<Notificacao, "id" | "lida" | "criadaEm" | "calculada">) => {
    out.push({ id: "calc:" + chave, lida: !!vistas[chave], criadaEm: Date.now(), calculada: true, ...n });
  };

  // --- MERCADO (a partir do calendário, AJUSTADO ao estado do utilizador) ---
  try {
    const foco = focoMercado();
    const temEquipa = !!opts?.temEquipa;
    if (foco.aDecorrer) {
      // A decorrer: a mensagem muda conforme escalou ou não.
      // IMPORTANTE: enquanto HÁ competição a decorrer, NÃO se anuncia o mercado da
      // próxima competição (ele ainda não abriu de verdade — só abre quando esta
      // terminar). Por isso este ramo gera apenas a notificação "em jogo" e mais
      // nada de mercado.
      push("mercado_a_decorrer:" + foco.aDecorrer.idCompeticao, {
        tipo: "mercado",
        titulo: temEquipa ? "A tua equipa está em jogo" : "Competição a decorrer",
        corpo: temEquipa
          ? `${foco.aDecorrer.nome} está a decorrer. Acompanha os pontos da tua equipa ao vivo.`
          : `${foco.aDecorrer.nome} está a decorrer. Não escalaste a tempo — prepara-te para a próxima.`,
        link: temEquipa ? "/meu-time" : "/inicio",
      });
    } else {
      const est = estadoMercado(foco.alvo);
      if (est.estado === "aberto") {
        const urgente = est.msAteFecho !== null && est.msAteFecho <= 24 * 60 * 60 * 1000;
        const fecho = textoFecho(foco.alvo); // ex: "Mercado fecha em 4h 12min"
        // Chave distinta por estado+urgência+equipa, para o "visto" não se confundir.
        const chave = `mercado_${temEquipa ? "tem" : "sem"}_${urgente ? "urg" : "calmo"}:${foco.alvo.idCompeticao}`;
        if (temEquipa) {
          // JÁ TEM equipa: lembra de conferir, sem pressão de montar.
          push(chave, {
            tipo: "mercado",
            titulo: urgente ? `Última hora para ajustar a equipa` : `A tua equipa está pronta`,
            corpo: urgente
              ? `${fecho} para ${foco.alvo.nome}. Confere o teu capitão e os teus atletas antes de fechar.`
              : `${foco.alvo.nome} — ${fecho}. Podes ainda trocar atletas ou o capitão.`,
            link: "/meu-time",
          });
        } else {
          // NÃO TEM equipa: incentiva a escalar; urgência se falta pouco.
          push(chave, {
            tipo: "mercado",
            titulo: urgente ? `Escala já! O mercado está a fechar` : `Monta a tua equipa`,
            corpo: urgente
              ? `${fecho} para ${foco.alvo.nome}. Escala a tua equipa rápido para entrares nesta rodada!`
              : `${foco.alvo.nome} — ${fecho}. Monta os teus 8 atletas e escolhe o capitão.`,
            link: "/criar-equipa",
          });
        }
      }
    }
  } catch {}

  // --- FAIXA (subiu/desceu) ---
  if (opts?.faixaAtual && opts?.faixaAnterior && opts.faixaAtual !== opts.faixaAnterior) {
    const subiu = ordemFaixa(opts.faixaAtual) > ordemFaixa(opts.faixaAnterior);
    push(`faixa_${opts.faixaAtual}`, {
      tipo: subiu ? "faixa_subiu" : "faixa_desceu",
      titulo: subiu ? `Subiste para a Faixa ${opts.faixaAtual}!` : `Desceste para a Faixa ${opts.faixaAtual}`,
      corpo: subiu ? "Parabéns pela evolução. Continua assim!" : "Recupera a tua posição na próxima rodada.",
      link: "/perfil",
    });
  }

  // --- RANKING (perto do Top 10 / variação de posição) ---
  if (typeof opts?.distanciaTop10 === "number" && opts.distanciaTop10 > 0) {
    push(`ranking_top10:${opts.distanciaTop10}`, {
      tipo: "ranking",
      titulo: `Estás perto do Top 10`,
      corpo: `Faltam ${opts.distanciaTop10} pontos para entrares no Top 10.`,
      link: "/ligas",
    });
  }
  if (typeof opts?.posicaoAtual === "number" && typeof opts?.posicaoAnterior === "number" && opts.posicaoAtual < opts.posicaoAnterior) {
    const subiu = opts.posicaoAnterior - opts.posicaoAtual;
    push(`ranking_subiu:${opts.posicaoAtual}`, {
      tipo: "ranking",
      titulo: `Subiste ${subiu} ${subiu === 1 ? "posição" : "posições"} no ranking`,
      corpo: `Estás agora em #${opts.posicaoAtual}.`,
      link: "/ligas",
    });
  }

  return out;
}

// Ordem das faixas para saber se subiu ou desceu (índice maior = mais alta).
const ORDEM_FAIXAS = ["Branca", "Azul", "Amarela", "Verde", "Roxa", "Marrom", "Preta"];
function ordemFaixa(f: string): number {
  const i = ORDEM_FAIXAS.indexOf(f);
  return i < 0 ? 0 : i;
}

/** Marca uma notificação calculada como vista (tira o destaque de não lida). */
export function marcarCalculadaLida(n: Notificacao) {
  if (n.calculada) marcarCalculadaVista(n.id.replace(/^calc:/, ""));
}

// ---------------------------------------------------------------------------
// UNIÃO — o que o sino consome
// ---------------------------------------------------------------------------

/**
 * Devolve TODAS as notificações (guardadas + calculadas), ordenadas das mais
 * recentes para as mais antigas, prontas para o sino mostrar.
 */
export async function listarTudo(opts?: Parameters<typeof gerarCalculadas>[0]): Promise<Notificacao[]> {
  const [guardadas, calculadas] = [await listarGuardadas(), gerarCalculadas(opts)];
  // Calculadas aparecem no topo (são "do momento"), seguidas das guardadas por data.
  return [...calculadas, ...guardadas].sort((a, b) => {
    // não lidas primeiro; dentro disso, mais recentes primeiro
    if (a.lida !== b.lida) return a.lida ? 1 : -1;
    return b.criadaEm - a.criadaEm;
  });
}

/** Quantas não lidas há (para o ponto vermelho do sino). */
export async function contarNaoLidas(opts?: Parameters<typeof gerarCalculadas>[0]): Promise<number> {
  const todas = await listarTudo(opts);
  return todas.filter((n) => !n.lida).length;
}
