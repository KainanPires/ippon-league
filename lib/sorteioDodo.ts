// lib/sorteioDodo.ts
//
// O SORTEIO DA COPA DO DÔDO — 32 lugares, 6 por continente.
//
// ---------------------------------------------------------------------------
// PORQUE SORTEIO E NÃO ORDEM DE CHEGADA
//
// Por ordem, as vagas da Europa desapareciam nos primeiros minutos, e quem vive
// noutro fuso horário nunca entrava. O sorteio torna as semanas de inscrição
// reais em vez de uma corrida ao relógio — quem se inscreve no último dia tem
// exatamente a mesma hipótese de quem se inscreveu no primeiro.
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
// complicação de repartir vagas por continentes — e não deixa vagas por usar
// quando um continente também não tem excedentes.
// ---------------------------------------------------------------------------

/**
 * Vagas reservadas a cada continente.
 *
 * São CINCO continentes (as federações da IJF: Europa, América, Ásia, África,
 * Oceânia). 5 × 6 = 30 lugares reservados; os 2 restantes até aos 32 saem da
 * redistribuição, tal como os que um continente não preencher.
 */
export const VAGAS_POR_CONTINENTE = 6;

/**
 * Teto de lugares na Copa.
 *
 * NÃO é o tamanho da chave. Quem for sorteado joga, seja qual for o número: com
 * 21 sorteados joga-se uma chave de 32 com 11 passagens automáticas, e não uma
 * chave de 16 com 5 pessoas cortadas. Quem monta a chave é o
 * `gerarPrimeiraRonda` em lib/copa, que arredonda PARA CIMA.
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
 * Sorteia os 32 lugares entre os inscritos.
 *
 * @param inscricoes todas as inscrições da edição
 * @param continentes a lista de continentes que contam — são CINCO, e vêm das
 *                    chaves de NOME_CONTINENTE em lib/continentes
 */
export function sortearVagas(
  inscricoes: InscricaoSorteio[],
  continentes: string[],
): ResultadoSorteio {
  const sorteados: ResultadoSorteio["sorteados"] = [];
  const sobraram: InscricaoSorteio[] = [];
  const porContinente: Record<string, { inscritos: number; entraram: number }> = {};

  // --- 1ª volta: cada continente sorteia as suas vagas ---
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
  // (5 × 6 = 30, e o teto é 32). Assim os 32 enchem-se sempre que houver gente.
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
      // Se nem com a redistribuição se enchem os 32, joga-se com menos. É melhor
      // do que adiar: uma edição com 24 acontece; uma adiada não.
      vagasPorPreencher: TOTAL_VAGAS - sorteados.length,
    },
  };
}

/**
 * ATENÇÃO — NÃO USAR PARA MONTAR A CHAVE DA COPA.
 *
 * Esta função arredonda PARA BAIXO: com 21 devolve 16. Era assim que o sorteio
 * funcionava antes, e cortava cinco pessoas que já tinham sido sorteadas e já
 * sabiam que tinham entrado.
 *
 * A regra mudou: joga-se com quem estiver inscrito, e o excedente até à potência
 * de 2 seguinte vira passagens automáticas na primeira ronda. Quem faz essa
 * conta é o `tamanhoChave` em lib/copa, que arredonda PARA CIMA.
 *
 * Fica aqui porque pode haver código antigo a importá-la, mas se procurares o
 * tamanho de uma chave, a função certa é a outra. Os dois nomes são parecidos de
 * mais para o bem que fazem — se um dia confirmares que ninguém a usa, apaga-a.
 */
export function tamanhoDaChave(n: number): number {
  if (n < 2) return 0;
  let t = 2;
  while (t * 2 <= n && t < TOTAL_VAGAS) t *= 2;
  return t;
}
