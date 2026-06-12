// lib/copa.ts
//
// Lógica PURA da Copa Ippon (mata-mata). Sem base de dados, sem rede — só
// raciocínio, para ser testável. A rota /api/copa/sortear usa estas funções.
//
// Mecanismo: eliminação simples 1v1 por ronda + disputa de 3º lugar.
// - Qualquer número de jogadores; byes por sorteio puro até à potência de 2.
// - Forma A: geramos só a 1ª ronda; as seguintes nascem no apuramento (Fase C).
// - Desempate (na Fase C): pontos da rodada → pontos do capitão → sorteio.

import { proximaDepoisDe, CALENDARIO_2026, type SemanaCalendario } from "@/lib/calendario";

// Um confronto da 1ª ronda, pronto para gravar em copa_confrontos.
export interface ConfrontoInicial {
  ronda: number;        // 1
  ordem: number;        // 0,1,2... posição na ronda
  fase: "normal";       // a final/bronze só aparecem nas últimas rondas (Fase C)
  jogador_a: string;    // user_id
  jogador_b: string | null;  // null = bye (jogador_a passa sozinho)
  id_competicao: string;     // competição desta ronda
  estado: "pendente";
}

// Embaralha uma lista (Fisher-Yates). Recebe a função aleatória para ser testável.
export function embaralhar<T>(lista: T[], rnd: () => number = Math.random): T[] {
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Potência de 2 igual ou acima de n. Ex.: 6 -> 8; 4 -> 4; 9 -> 16.
export function tamanhoChave(n: number): number {
  if (n <= 1) return 1;
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

// Quantas rondas tem uma chave de `tamanho` jogadores. Ex.: 8 -> 3 (quartos,
// meias, final). 4 -> 2. 2 -> 1.
export function numeroDeRondas(tamanho: number): number {
  let r = 0;
  let p = tamanho;
  while (p > 1) { p /= 2; r++; }
  return r;
}

/**
 * Gera os confrontos da 1ª RONDA a partir dos inscritos.
 *
 * Como funcionam os byes (sorteio puro): embaralhamos os jogadores; os primeiros
 * `byes` da lista embaralhada passam direto (jogador_b = null); os restantes
 * emparelham-se dois a dois.
 *
 * @param inscritos  user_ids dos inscritos
 * @param idCompeticaoInicial  competição da 1ª ronda (escolhida pelo admin)
 * @param rnd  função aleatória (default Math.random; injetável para testes)
 */
export function gerarPrimeiraRonda(
  inscritos: string[],
  idCompeticaoInicial: string,
  rnd: () => number = Math.random
): ConfrontoInicial[] {
  const n = inscritos.length;
  if (n < 2) return []; // precisa de pelo menos 2 para haver chave

  const baralhados = embaralhar(inscritos, rnd);
  const tamanho = tamanhoChave(n);
  const byes = tamanho - n; // quantas passagens automáticas

  // Os primeiros `byes` recebem passagem automática.
  const comBye = baralhados.slice(0, byes);
  const aJogar = baralhados.slice(byes); // estes emparelham-se 2 a 2 (nº par garantido)

  const confrontos: ConfrontoInicial[] = [];
  let ordem = 0;

  // 1) Os byes entram como confrontos "a passar" (jogador_b = null).
  for (const jogador of comBye) {
    confrontos.push({
      ronda: 1,
      ordem: ordem++,
      fase: "normal",
      jogador_a: jogador,
      jogador_b: null,
      id_competicao: idCompeticaoInicial,
      estado: "pendente",
    });
  }

  // 2) Os restantes emparelham-se dois a dois.
  for (let i = 0; i < aJogar.length; i += 2) {
    confrontos.push({
      ronda: 1,
      ordem: ordem++,
      fase: "normal",
      jogador_a: aJogar[i],
      jogador_b: aJogar[i + 1],
      id_competicao: idCompeticaoInicial,
      estado: "pendente",
    });
  }

  return confrontos;
}

// Encontra a competição inicial no calendário pelo id. (Para validar e encadear.)
export function competicaoPorId(id: string): SemanaCalendario | null {
  return CALENDARIO_2026.find((s) => s.idCompeticao === id) ?? null;
}

// Dado o id de uma competição, devolve o id da SEGUINTE (para a próxima ronda).
// Usado na Fase C, mas vive aqui porque é lógica de copa.
export function idCompeticaoSeguinte(idAtual: string): string | null {
  const atual = competicaoPorId(idAtual);
  if (!atual) return null;
  return proximaDepoisDe(atual).idCompeticao;
}

// ===========================================================================
// FASE C — apuramento por ronda (lógica pura, testável)
// ===========================================================================

// Os pontos de um jogador num confronto: o total da equipa e o do capitão (base),
// para o desempate em cascata. Quem não escalou vem com escalou=false.
export interface PontosJogador {
  total: number;       // pontos da equipa (capitão já dobrado), como no ranking
  capitao: number;     // pontos BASE do capitão (sem dobrar), para desempate
  escalou: boolean;    // tinha equipa nesta competição?
}

export type DecididoPor = "pontos" | "capitao" | "sorteio" | "bye";

export interface ResultadoConfronto {
  vencedor: string;
  decidido_por: DecididoPor;
  pontos_a: number;
  pontos_b: number;
}

/**
 * Decide um confronto 1v1 com o desempate EM CASCATA:
 *   1º mais pontos da rodada → 2º mais pontos do capitão → 3º sorteio.
 * Quem não escalou conta como 0 e perde para quem escalou; se ambos não
 * escalaram (0=0 e capitão 0=0), vai a sorteio. Nunca empata de verdade.
 *
 * @param rnd  função aleatória (default Math.random; injetável para testes)
 */
export function decidirConfronto(
  jogadorA: string,
  jogadorB: string,
  pa: PontosJogador,
  pb: PontosJogador,
  rnd: () => number = Math.random
): ResultadoConfronto {
  const base = { pontos_a: pa.total, pontos_b: pb.total };

  // 1) Pontos da rodada.
  if (pa.total !== pb.total) {
    return { ...base, vencedor: pa.total > pb.total ? jogadorA : jogadorB, decidido_por: "pontos" };
  }
  // 2) Pontos do capitão (base).
  if (pa.capitao !== pb.capitao) {
    return { ...base, vencedor: pa.capitao > pb.capitao ? jogadorA : jogadorB, decidido_por: "capitao" };
  }
  // 3) Sorteio (moeda ao ar).
  return { ...base, vencedor: rnd() < 0.5 ? jogadorA : jogadorB, decidido_por: "sorteio" };
}

// Um confronto vindo da base de dados (o que precisamos para apurar/gerar).
export interface ConfrontoDB {
  ronda: number;
  ordem: number;
  fase: "normal" | "final" | "bronze";
  jogador_a: string;
  jogador_b: string | null;
  vencedor: string | null;
  estado: "pendente" | "decidido";
}

// Uma linha pronta a gravar para a ronda seguinte.
export interface ConfrontoNovo {
  ronda: number;
  ordem: number;
  fase: "normal" | "final" | "bronze";
  jogador_a: string;
  jogador_b: string | null;
  id_competicao: string;
  estado: "pendente";
}

/**
 * Gera a ronda SEGUINTE a partir dos confrontos JÁ DECIDIDOS de uma ronda.
 *
 * Regras:
 * - Emparelha os vencedores 2 a 2, pela ordem (0&1, 2&3, ...).
 * - Quando a ronda decidida tem exatamente 2 confrontos (= semifinais), a ronda
 *   seguinte gera DOIS jogos na MESMA competição: a FINAL (os 2 vencedores) e o
 *   BRONZE (os 2 perdedores).
 * - Caso normal: todos os jogos são "normal".
 *
 * @param confrontosDecididos  confrontos da ronda terminada (todos com vencedor)
 * @param idCompeticaoSeguinte  competição da próxima ronda
 * @returns confrontos da ronda seguinte (vazio se já era a final → copa acabou)
 */
export function gerarRondaSeguinte(
  confrontosDecididos: ConfrontoDB[],
  idCompeticaoProxima: string
): ConfrontoNovo[] {
  // Se a ronda já era a final, não há ronda seguinte (a copa termina).
  if (confrontosDecididos.some((c) => c.fase === "final")) return [];

  // Ordena por ordem para emparelhar de forma estável.
  const ordenados = [...confrontosDecididos].sort((a, b) => a.ordem - b.ordem);
  const rondaAtual = ordenados[0]?.ronda ?? 1;
  const proximaRonda = rondaAtual + 1;

  const vencedores = ordenados.map((c) => c.vencedor!).filter(Boolean);

  // CASO SEMIFINAIS: exatamente 2 confrontos → final + bronze na mesma competição.
  if (ordenados.length === 2) {
    const perdedores = ordenados.map((c) =>
      c.vencedor === c.jogador_a ? c.jogador_b : c.jogador_a
    ).filter((x): x is string => !!x);

    const novos: ConfrontoNovo[] = [
      {
        ronda: proximaRonda, ordem: 0, fase: "final",
        jogador_a: vencedores[0], jogador_b: vencedores[1] ?? null,
        id_competicao: idCompeticaoProxima, estado: "pendente",
      },
    ];
    // Bronze só se houver mesmo 2 perdedores (não houve bye nas semis).
    if (perdedores.length === 2) {
      novos.push({
        ronda: proximaRonda, ordem: 1, fase: "bronze",
        jogador_a: perdedores[0], jogador_b: perdedores[1],
        id_competicao: idCompeticaoProxima, estado: "pendente",
      });
    }
    return novos;
  }

  // CASO NORMAL: emparelha vencedores 2 a 2.
  const novos: ConfrontoNovo[] = [];
  let ordem = 0;
  for (let i = 0; i < vencedores.length; i += 2) {
    novos.push({
      ronda: proximaRonda,
      ordem: ordem++,
      fase: "normal",
      jogador_a: vencedores[i],
      jogador_b: vencedores[i + 1] ?? null, // ímpar → bye (raro, mas seguro)
      id_competicao: idCompeticaoProxima,
      estado: "pendente",
    });
  }
  return novos;
}
