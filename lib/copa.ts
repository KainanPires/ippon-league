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
