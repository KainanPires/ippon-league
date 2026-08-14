// lib/desempenho.ts
//
// "O TEU DESEMPENHO NA RODADA" — lógica.
//
// Há DUAS fontes de pontos:
//   - AO VIVO (buscarResultados): durante a competição, de /api/resultados.
//   - CONGELADA (buscarResultadosCongelados): depois da competição fechar, dos
//     dados congelados em resultados_atletas (via /api/ranking-atletas). Persiste
//     e nunca desaparece — é o que faz o resumo continuar disponível entre eventos.
//
// O "visto" fica no Supabase (user_metadata.desempenhos_vistos), como os
// tutoriais — sobrevive a dispositivos.

import { supabase } from "@/lib/supabase";
import { resolve, type TeamState } from "@/lib/team";
import type { Athlete } from "@/lib/athletes";
import { numeroDaRodada } from "@/lib/calendario";

// Tradutor injetado (mesmo tipo do useT). Módulo puro: não usa hooks, recebe o
// `t` de quem o chama (o componente Desempenho tem useT e passa-o). Assim as
// mensagens ficam na língua do utilizador. Ver lib/i18n (chaves des.*).
type Tradutor = (chave: string, vars?: Record<string, string | number>) => string;

export interface DesempenhoRodada {
  idCompeticao: string;
  nomeCompeticao: string;
  numeroRodada: number | null;  // número da rodada no calendário (1..52)
  pontuacaoTotal: number;     // soma dos atletas, capitão a dobrar
  atletas: { atleta: Athlete; pontos: number; capitao: boolean }[];
  melhor: { atleta: Athlete; pontos: number } | null;
  capitao: { atleta: Athlete; pontos: number } | null; // pontos JÁ dobrados
}

// Números extra (bónus) que aparecem só no modal: comparação com os outros.
export interface ResumoExtra {
  media: number;
  posicao: number;
  totalJogadores: number;
  acimaDaMedia: boolean;
  patrimonio: number | null;
  ganho: number;
}

// --- "Visto" no Supabase (uma chave por competição) ---

export async function desempenhosVistosConta(): Promise<Record<string, boolean>> {
  try {
    const { data } = await supabase.auth.getSession();
    const meta = data.session?.user?.user_metadata as { desempenhos_vistos?: Record<string, boolean> } | undefined;
    return meta?.desempenhos_vistos ?? {};
  } catch {
    return {};
  }
}

export async function marcarDesempenhoVisto(idCompeticao: string): Promise<void> {
  try {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return;
    const meta = (data.session.user?.user_metadata ?? {}) as { desempenhos_vistos?: Record<string, boolean> };
    const desempenhos_vistos = { ...(meta.desempenhos_vistos ?? {}), [idCompeticao]: true };
    await supabase.auth.updateUser({ data: { desempenhos_vistos } });
  } catch {
    // se falhar, não bloqueia
  }
}

// --- "Visto" do AO VIVO (chave PRÓPRIA, separada do resumo final) ---
//
// O resumo AO VIVO aparece UMA vez automaticamente por competição e depois nunca
// mais salta sozinho (mesmo ao mudar de aba ou reabrir o app). Para isso, o
// "já vi o ao vivo" é guardado na CONTA, tal como o final — mas com a chave
// PREFIXADA "aovivo-<idComp>", para NÃO se confundir com o "visto" do resumo
// final (que usa a chave "<idComp>"). Assim, ver o ao vivo não esconde o resumo
// final, e vice-versa. Reutiliza o mesmo armazenamento (desempenhos_vistos).
function chaveAoVivo(idCompeticao: string): string {
  return `aovivo-${idCompeticao}`;
}

export async function aoVivoVistoConta(idCompeticao: string): Promise<boolean> {
  const vistos = await desempenhosVistosConta();
  return !!vistos[chaveAoVivo(idCompeticao)];
}

export async function marcarAoVivoVisto(idCompeticao: string): Promise<void> {
  await marcarDesempenhoVisto(chaveAoVivo(idCompeticao));
}

// --- Cálculo do desempenho a partir da equipa + resultados ---

/**
 * Constrói o desempenho de uma rodada a partir da equipa guardada e do mapa de
 * pontos (de /api/resultados OU dos dados congelados). Devolve null se a equipa
 * não resolve (sem atletas).
 */
export function construirDesempenho(
  idCompeticao: string,
  nomeCompeticao: string,
  team: TeamState,
  pontosPorId: Record<string, number>
): DesempenhoRodada | null {
  const atletas = resolve(team.ids);
  if (atletas.length === 0) return null;

  const linhas = atletas.map((atleta) => {
    const base = pontosPorId[atleta.id] ?? 0;
    const capitao = team.captain === atleta.id;
    const pontos = capitao ? base * 2 : base; // capitão dobra (valor para a EQUIPA)
    return { atleta, pontos, capitao, base };
  });

  const pontuacaoTotal = Math.round(linhas.reduce((s, l) => s + l.pontos, 0) * 10) / 10;

  // Melhor atleta: pelos pontos CRUS (base), NÃO os dobrados do capitão. Senão o
  // capitão apareceria sempre como "melhor" só por ter dobrado — dado enganador.
  // O verdadeiro melhor é quem mais pontuou na luta, capitão ou não.
  let melhor: { atleta: Athlete; pontos: number } | null = null;
  for (const l of linhas) {
    if (!melhor || l.base > melhor.pontos) melhor = { atleta: l.atleta, pontos: l.base };
  }

  const capLinha = linhas.find((l) => l.capitao) ?? null;
  const capitao = capLinha ? { atleta: capLinha.atleta, pontos: capLinha.pontos } : null;

  return {
    idCompeticao,
    nomeCompeticao,
    numeroRodada: numeroDaRodada(idCompeticao),
    pontuacaoTotal,
    atletas: linhas.map(({ atleta, pontos, capitao }) => ({ atleta, pontos, capitao })),
    melhor,
    capitao,
  };
}

/**
 * Busca os pontos de uma competição terminada (AO VIVO, de /api/resultados).
 * Devolve null se ainda não há resultados.
 */
export async function buscarResultados(idCompeticao: string): Promise<Record<string, number> | null> {
  try {
    const r = await fetch(`/api/resultados?comp=${idCompeticao}`);
    const j = await r.json();
    if (j && j.tem_resultados && j.pontos && Object.keys(j.pontos).length > 0) {
      return j.pontos as Record<string, number>;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Busca os pontos CONGELADOS de uma competição (de /api/ranking-atletas, que lê
 * resultados_atletas). São os pontos SIMPLES por atleta — o construirDesempenho
 * aplica o capitão a dobrar. Persiste mesmo depois da competição fechar.
 * Devolve { mapa de pontos, idComp, nome } ou null.
 */
export async function buscarResultadosCongelados(
  idCompeticao?: string
): Promise<{ pontos: Record<string, number>; comp: string; nome: string } | null> {
  try {
    const url = idCompeticao ? `/api/ranking-atletas?comp=${idCompeticao}` : `/api/ranking-atletas`;
    const r = await fetch(url);
    const j = await r.json();
    if (!j || !j.tem_resultados || !Array.isArray(j.atletas) || j.atletas.length === 0) return null;
    const pontos: Record<string, number> = {};
    for (const a of j.atletas) pontos[String(a.id)] = Number(a.pontos) || 0;
    return { pontos, comp: String(j.comp), nome: String(j.nome || "") };
  } catch {
    return null;
  }
}

/**
 * Busca os números extra (média, posição, património) de /api/resumo-rodada.
 * Só para mostrar no modal. Devolve null se não houver resumo para o utilizador.
 */
export async function buscarResumoExtra(idCompeticao: string, userId: string): Promise<ResumoExtra | null> {
  try {
    const r = await fetch(`/api/resumo-rodada?comp=${idCompeticao}&user=${userId}`);
    const j = await r.json();
    if (!j || !j.tem_resumo) return null;
    return {
      media: Number(j.media) || 0,
      posicao: Number(j.posicao) || 0,
      totalJogadores: Number(j.total_jogadores) || 0,
      acimaDaMedia: !!j.acima_da_media,
      patrimonio: j.patrimonio != null ? Number(j.patrimonio) : null,
      ganho: Number(j.ganho_patrimonio) || 0,
    };
  } catch {
    return null;
  }
}

// Mensagem personalizada conforme a pontuação (tom de jogo, sem humilhar).
//
// `aoVivo` muda o enquadramento: durante a competição (vários dias) o resultado
// é PARCIAL — nada de tom definitivo ("rodada para esquecer"). É um ponto de
// situação: "vais com X, ainda dá para subir". O tom final só quando fecha.
export function mensagemDesempenho(pontos: number, nome: string, aoVivo = false, t?: Tradutor): string {
  const n = nome || (t ? t("des.campeao") : "Campeão");
  // Caminho traduzido: quando o chamador passa o `t` (ex.: o modal Desempenho,
  // que tem useT), devolvemos a mensagem na língua do utilizador. As chaves e o
  // {n}/{pts} estão em lib/i18n (namespace des.*).
  if (t) {
    if (aoVivo) {
      if (pontos >= 60) return t("des.msgVivo60", { n, pts: pontos });
      if (pontos >= 30) return t("des.msgVivo30", { n, pts: pontos });
      if (pontos >= 10) return t("des.msgVivo10", { n, pts: pontos });
      if (pontos >= 0) return t("des.msgVivo0", { n, pts: pontos });
      return t("des.msgVivoNeg", { n, pts: pontos });
    }
    if (pontos >= 60) return t("des.msg60", { n, pts: pontos });
    if (pontos >= 30) return t("des.msg30", { n, pts: pontos });
    if (pontos >= 10) return t("des.msg10", { n, pts: pontos });
    if (pontos >= 0) return t("des.msg0", { n, pts: pontos });
    return t("des.msgNeg", { n, pts: pontos });
  }
  // Fallback PT: chamadas sem tradutor (ex.: notificação local em app/inicio, que
  // será migrada para passar o `t` na sua própria leva). Mantém o comportamento.
  if (aoVivo) {
    if (pontos >= 60) return `Que arranque, ${n}! Vais com ${pontos} pts e ainda há lutas pela frente. 🔥`;
    if (pontos >= 30) return `Bom ritmo, ${n}! Já levas ${pontos} pts — e a competição ainda vai a meio.`;
    if (pontos >= 10) return `Já tens ${pontos} pts, ${n}. Há muito por decidir — dá para subir!`;
    if (pontos >= 0) return `${pontos} pts até agora, ${n}. A competição ainda vai a meio — há tempo para a reviravolta.`;
    return `Começo difícil (${pontos} pts), ${n}, mas isto ainda vai a meio. Há muitas lutas para virar o jogo!`;
  }
  if (pontos >= 60) return `Que rodada, ${n}! A tua equipa esteve imparável. 🔥`;
  if (pontos >= 30) return `Boa rodada, ${n}! A tua estratégia rendeu bons pontos.`;
  if (pontos >= 10) return `Rodada sólida, ${n}. Há margem para subir na próxima!`;
  if (pontos >= 0) return `Rodada difícil, ${n}. Ajusta a equipa e volta mais forte.`;
  return `Rodada para esquecer, ${n}. Na próxima, a reviravolta é tua!`;
}
