// lib/sorteioDodo.ts
//
// O SORTEIO DO MATA-MATA DO DÔDO — 32 vagas, 4 por continente.
//
// ---------------------------------------------------------------------------
// PORQUE SORTEIO E NÃO ORDEM DE CHEGADA
//
// Por ordem, as 4 vagas da Europa desapareciam nos primeiros minutos, e quem
// vive noutro fuso horário nunca entrava. O sorteio torna as duas semanas de
// inscrição reais em vez de uma corrida ao relógio — quem se inscreve no último
// dia tem exatamente a mesma hipótese de quem se inscreveu no primeiro.
//
// ---------------------------------------------------------------------------
// AS DUAS VOLTAS
//
// 1ª volta — cada continente sorteia as SUAS 6 vagas entre os seus inscritos.
//            Um continente com 3 inscritos leva os 3 e deixa 3 vagas por usar.
//
// 2ª volta — as vagas que sobraram juntam-se e são sorteadas entre TODOS os que
//            ficaram de fora, de qualquer continente. Assim as 32 vagas
//            preenchem-se sempre, se houver gente suficiente.
//
// A segunda volta não distribui "igualmente pelos outros continentes" à letra:
// um sorteio único entre todos os excedentes dá o mesmo resultado sem a
// complicação de repartir 3 vagas por 7 continentes — e não deixa vagas por
// usar quando um continente também não tem excedentes.
// ---------------------------------------------------------------------------

/**
 * Vagas reservadas a cada continente.
 *
 * São CINCO continentes (as federações da IJF: Europa, América, Ásia, África,
 * Oceânia), não oito. 5 × 6 = 30 lugares reservados; as 2 restantes até às 32
 * saem da redistribuição, tal como as que um continente não preencher.
 */
export const VAGAS_POR_CONTINENTE = 6;

/**
 * Teto de lugares. A chave real é sempre uma POTÊNCIA DE 2 — com 32 inscritos
 * joga-se a 32, com 24 joga-se a 16 (ver tamanhoDaChave).
 */
export const TOTAL_VAGAS = 32;

export interface InscricaoSorteio {
  id: string;
  user_id: string;
  continente: string;
}

export interface ResultadoSorteio {
  /** Quem entrou, e como. */
  sorteados: { id: string; user_id: string; continente: string; porRedistribuicao: boolean }[];
  /** Quem ficou de fora. */
  excluidos: { id: string; user_id: string; continente: string }[];
  /** Para explicar o que aconteceu: quantos por continente, quantas sobraram. */
  resumo: {
    porContinente: Record<string, { inscritos: number; entraram: number }>;
    vagasRedistribuidas: number;
    vagasPorPreencher: number;
  };
}

/**
 * Baralha uma lista, sem alterar a original.
 *
 * Fisher-Yates com Math.random: chega de sobra aqui. Não é aleatoriedade
 * criptográfica, mas ninguém tem como prever nem influenciar o resultado — e o
 * sorteio corre no servidor, não no browser de um interessado.
 */
function baralhar<T>(lista: T[]): T[] {
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Sorteia as 32 vagas entre os inscritos.
 *
 * @param inscricoes todas as inscrições da edição
 * @param continentes a lista de continentes que contam (normalmente 8)
 */
export function sortearVagas(
  inscricoes: InscricaoSorteio[],
  continentes: string[],
): ResultadoSorteio {
  const sorteados: ResultadoSorteio["sorteados"] = [];
  const sobraram: InscricaoSorteio[] = [];
  const porContinente: Record<string, { inscritos: number; entraram: number }> = {};

  // --- 1ª volta: cada continente sorteia as suas 4 vagas ---
  let vagasLivres = 0;
  for (const cont of continentes) {
    const doCont = inscricoes.filter((i) => i.continente === cont);
    porContinente[cont] = { inscritos: doCont.length, entraram: 0 };
    if (doCont.length === 0) {
      vagasLivres += VAGAS_POR_CONTINENTE;
      continue;
    }
    const baralhados = baralhar(doCont);
    const entram = baralhados.slice(0, VAGAS_POR_CONTINENTE);
    const ficam = baralhados.slice(VAGAS_POR_CONTINENTE);
    for (const i of entram) {
      sorteados.push({ id: i.id, user_id: i.user_id, continente: i.continente, porRedistribuicao: false });
    }
    porContinente[cont].entraram = entram.length;
    // O que este continente não usou volta ao bolo comum.
    vagasLivres += VAGAS_POR_CONTINENTE - entram.length;
    sobraram.push(...ficam);
  }

  // --- 2ª volta: as vagas que sobraram, entre todos os excedentes ---
  // Às vagas que os continentes não usaram juntam-se as que faltam para o teto
  // (5 × 6 = 30, e o teto é 32). Assim as 32 enchem-se sempre que houver gente.
  const porAtingirOTeto = Math.max(0, TOTAL_VAGAS - continentes.length * VAGAS_POR_CONTINENTE);
  const vagasRedistribuidas = Math.min(vagasLivres + porAtingirOTeto, sobraram.length);
  const repescados = baralhar(sobraram).slice(0, vagasRedistribuidas);
  for (const i of repescados) {
    sorteados.push({ id: i.id, user_id: i.user_id, continente: i.continente, porRedistribuicao: true });
    if (porContinente[i.continente]) porContinente[i.continente].entraram++;
  }

  const entraramIds = new Set(sorteados.map((s) => s.id));
  const excluidos = inscricoes
    .filter((i) => !entraramIds.has(i.id))
    .map((i) => ({ id: i.id, user_id: i.user_id, continente: i.continente }));

  return {
    sorteados,
    excluidos,
    resumo: {
      porContinente,
      vagasRedistribuidas,
      // Se nem com a redistribuição se enchem as 32, a chave fica mais pequena.
      // É melhor do que adiar: uma edição com 24 acontece; uma adiada não.
      vagasPorPreencher: TOTAL_VAGAS - sorteados.length,
    },
  };
}

/**
 * Tamanho de chave possível a partir do número de participantes.
 *
 * O mata-mata precisa de uma potência de 2. Com 24 inscritos, joga-se com 16 e
 * os outros 8 ficam de fora — melhor do que inventar byes que dariam a uns
 * jogadores uma ronda de vantagem sem terem feito nada por isso.
 */
export function tamanhoDaChave(n: number): number {
  if (n < 2) return 0;
  let t = 2;
  while (t * 2 <= n && t < TOTAL_VAGAS) t *= 2;
  return t;
}
