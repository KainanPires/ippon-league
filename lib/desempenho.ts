// lib/desempenho.ts
//
// "O TEU DESEMPENHO NA RODADA" — lógica (Opção B: nada se guarda; recalcula-se).
//
// O desempenho aparece quando a competição em que a pessoa escalou JÁ TERMINOU
// (tem resultados) e ela ainda não o viu. Os pontos vêm de /api/resultados
// (sempre disponíveis para competições terminadas). O "visto" fica no Supabase
// (user_metadata.desempenhos_vistos), como os tutoriais — sobrevive a dispositivos.

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
 * pontos de /api/resultados. Devolve null se a equipa não resolve (sem atletas).
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
    const pontos = capitao ? base * 2 : base; // capitão dobra
    return { atleta, pontos, capitao, base };
  });

  const pontuacaoTotal = Math.round(linhas.reduce((s, l) => s + l.pontos, 0) * 10) / 10;

  // Melhor atleta: maior pontuação (já com o capitão dobrado).
  let melhor: { atleta: Athlete; pontos: number } | null = null;
  for (const l of linhas) {
    if (!melhor || l.pontos > melhor.pontos) melhor = { atleta: l.atleta, pontos: l.pontos };
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
 * Busca os pontos de uma competição terminada. Devolve null se ainda não há
 * resultados (a competição não terminou ou o JudoBase ainda não publicou).
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

// Mensagem personalizada conforme a pontuação (tom de jogo, sem humilhar).
export function mensagemDesempenho(pontos: number, nome: string): string {
  const n = nome || "Campeão";
  if (pontos >= 60) return `Que rodada, ${n}! A tua equipa esteve imparável. 🔥`;
  if (pontos >= 30) return `Boa rodada, ${n}! A tua estratégia rendeu bons pontos.`;
  if (pontos >= 10) return `Rodada sólida, ${n}. Há margem para subir na próxima!`;
  if (pontos >= 0) return `Rodada difícil, ${n}. Ajusta a equipa e volta mais forte.`;
  return `Rodada para esquecer, ${n}. Na próxima, a reviravolta é tua!`;
}
