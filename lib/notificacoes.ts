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
// O componente do sino chama `listarTudo(opts, t)` que devolve as duas, já
// unidas e ordenadas, prontas para mostrar.
//
// IDIOMA: as calculadas são construídas AQUI, no cliente, por isso recebem o
// tradutor `t` (de useT) e saem já na língua da pessoa. As GUARDADAS vêm da BD
// como texto (a tradução delas é de uma fase posterior).

import { supabase } from "@/lib/supabase";
import { focoMercado, estadoMercado, formatarContagem } from "@/lib/calendario";

// O tradutor tal como useT() o devolve. As calculadas recebem-no por parâmetro
// porque estas funções não são componentes React (não podem chamar hooks).
type Tradutor = (chave: string, vars?: Record<string, string | number>) => string;

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

// Rótulo da faixa na língua da pessoa. As chaves da BD/estado guardam o VALOR
// canónico ("Roxa"); aqui traduz-se só para mostrar.
const FAIXA_KEY: Record<string, string> = {
  Branca: "faixa.branca", Azul: "faixa.azul", Amarela: "faixa.amarela",
  Verde: "faixa.verde", Roxa: "faixa.roxa", Marrom: "faixa.marrom", Preta: "faixa.preta",
};
function rotuloFaixa(f: string, t: Tradutor): string {
  const k = FAIXA_KEY[f];
  return k ? t(k) : f;
}

/**
 * Gera as notificações calculadas do momento (mercado + faixa/ranking), já na
 * língua da pessoa (via `t`).
 *
 * ── PRINCÍPIO DE OURO (vale para TODA notificação, calculada ou guardada) ──
 * Uma notificação NUNCA é genérica. Antes de gerar o texto, verifica-se o estado
 * REAL do utilizador e a mensagem é ajustada a ele. Exemplos:
 *   • mercado a fechar → COM equipa: "confere a tua equipa"; SEM equipa: "escala já!"
 *   • o destino (link) também muda conforme o estado (/meu-time vs /criar-equipa).
 *
 * `opts` traz o que se sabe do utilizador neste momento. Quanto mais completo,
 * mais personalizadas as notificações. Tudo é opcional: o que faltar, não gera
 * a notificação correspondente (em vez de gerar uma genérica).
 *
 * As CHAVES de deduplicação ("vistas") continuam a usar valores/ids — não texto —
 * por isso não dependem da língua: mudar de idioma não "desmarca" notificações.
 */
export function gerarCalculadas(
  t: Tradutor,
  opts?: {
    temEquipa?: boolean;        // já tem equipa COMPLETA escalada para a competição-alvo?
    faixaAtual?: string;
    faixaAnterior?: string;
    posicaoAtual?: number;
    posicaoAnterior?: number;
    distanciaTop10?: number; // pontos até ao Top 10, se conhecido
  }
): Notificacao[] {
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
      const comp = foco.aDecorrer.nome;
      push("mercado_a_decorrer:" + foco.aDecorrer.idCompeticao, {
        tipo: "mercado",
        titulo: temEquipa ? t("notif.emJogoTitulo") : t("notif.aDecorrerTitulo"),
        corpo: temEquipa ? t("notif.emJogoCorpo", { comp }) : t("notif.aDecorrerCorpo", { comp }),
        link: temEquipa ? "/meu-time" : "/inicio",
      });
    } else {
      const est = estadoMercado(foco.alvo);
      if (est.estado === "aberto") {
        const urgente = est.msAteFecho !== null && est.msAteFecho <= 24 * 60 * 60 * 1000;
        const comp = foco.alvo.nome;
        // Tempo até fechar, traduzível: ao minuto se há hora oficial; senão, em dias.
        let tempo: string;
        if (est.temHora && est.msAteFecho !== null) {
          tempo = formatarContagem(est.msAteFecho); // ex.: "4h 12min"
        } else {
          const inicioDia = new Date(foco.alvo.de.replace(/\//g, "-") + "T00:00:00");
          const dias = Math.max(0, Math.ceil((inicioDia.getTime() - Date.now()) / 86400000));
          tempo = dias <= 1 ? t("notif.umDia") : t("notif.nDias", { n: dias });
        }
        // Chave distinta por estado+urgência+equipa, para o "visto" não se confundir.
        const chave = `mercado_${temEquipa ? "tem" : "sem"}_${urgente ? "urg" : "calmo"}:${foco.alvo.idCompeticao}`;
        if (temEquipa) {
          // JÁ TEM equipa: lembra de conferir, sem pressão de montar.
          push(chave, {
            tipo: "mercado",
            titulo: urgente ? t("notif.ajustarTitulo") : t("notif.prontaTitulo"),
            corpo: urgente ? t("notif.ajustarCorpo", { tempo, comp }) : t("notif.prontaCorpo", { comp, tempo }),
            link: "/meu-time",
          });
        } else {
          // NÃO TEM equipa: incentiva a escalar; urgência se falta pouco.
          push(chave, {
            tipo: "mercado",
            titulo: urgente ? t("notif.escalaJaTitulo") : t("notif.montaEquipaTitulo"),
            corpo: urgente ? t("notif.escalaJaCorpo", { tempo, comp }) : t("notif.montaEquipaCorpo", { comp, tempo }),
            link: "/criar-equipa",
          });
        }
      }
    }
  } catch {}

  // --- FAIXA (subiu/desceu) ---
  if (opts?.faixaAtual && opts?.faixaAnterior && opts.faixaAtual !== opts.faixaAnterior) {
    const subiu = ordemFaixa(opts.faixaAtual) > ordemFaixa(opts.faixaAnterior);
    const faixa = rotuloFaixa(opts.faixaAtual, t);
    push(`faixa_${opts.faixaAtual}`, {
      tipo: subiu ? "faixa_subiu" : "faixa_desceu",
      titulo: subiu ? t("notif.faixaSubiuTitulo", { faixa }) : t("notif.faixaDesceuTitulo", { faixa }),
      corpo: subiu ? t("notif.faixaSubiuCorpo") : t("notif.faixaDesceuCorpo"),
      link: "/perfil",
    });
  }

  // --- RANKING (perto do Top 10 / variação de posição) ---
  if (typeof opts?.distanciaTop10 === "number" && opts.distanciaTop10 > 0) {
    push(`ranking_top10:${opts.distanciaTop10}`, {
      tipo: "ranking",
      titulo: t("notif.top10Titulo"),
      corpo: t("notif.top10Corpo", { n: opts.distanciaTop10 }),
      link: "/ligas",
    });
  }
  if (typeof opts?.posicaoAtual === "number" && typeof opts?.posicaoAnterior === "number" && opts.posicaoAtual < opts.posicaoAnterior) {
    const subiu = opts.posicaoAnterior - opts.posicaoAtual;
    push(`ranking_subiu:${opts.posicaoAtual}`, {
      tipo: "ranking",
      titulo: subiu === 1 ? t("notif.subiuRankSing", { n: subiu }) : t("notif.subiuRankPlur", { n: subiu }),
      corpo: t("notif.subiuRankCorpo", { pos: opts.posicaoAtual }),
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

// Opções das calculadas (para o sino tipar o `calcOpts` sem repetir a forma).
export type OpcoesCalculadas = Parameters<typeof gerarCalculadas>[1];

// ---------------------------------------------------------------------------
// UNIÃO — o que o sino consome
// ---------------------------------------------------------------------------

/**
 * Devolve TODAS as notificações (guardadas + calculadas), ordenadas das mais
 * recentes para as mais antigas, prontas para o sino mostrar.
 */
export async function listarTudo(t: Tradutor, opts?: OpcoesCalculadas): Promise<Notificacao[]> {
  const [guardadas, calculadas] = [await listarGuardadas(), gerarCalculadas(t, opts)];
  // Calculadas aparecem no topo (são "do momento"), seguidas das guardadas por data.
  return [...calculadas, ...guardadas].sort((a, b) => {
    // não lidas primeiro; dentro disso, mais recentes primeiro
    if (a.lida !== b.lida) return a.lida ? 1 : -1;
    return b.criadaEm - a.criadaEm;
  });
}

/** Quantas não lidas há (para o ponto vermelho do sino). */
export async function contarNaoLidas(t: Tradutor, opts?: OpcoesCalculadas): Promise<number> {
  const todas = await listarTudo(t, opts);
  return todas.filter((n) => !n.lida).length;
}
