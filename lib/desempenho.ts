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

export interface DesempenhoRodada {
  idCompeticao: string;
  nomeCompeticao: string;
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
export function mensagemDesempenho(pontos: number, nome: string): string {
  const n = nome || "Campeão";
  if (pontos >= 60) return `Que rodada, ${n}! A tua equipa esteve imparável. 🔥`;
  if (pontos >= 30) return `Boa rodada, ${n}! A tua estratégia rendeu bons pontos.`;
  if (pontos >= 10) return `Rodada sólida, ${n}. Há margem para subir na próxima!`;
  if (pontos >= 0) return `Rodada difícil, ${n}. Ajusta a equipa e volta mais forte.`;
  return `Rodada para esquecer, ${n}. Na próxima, a reviravolta é tua!`;
}
