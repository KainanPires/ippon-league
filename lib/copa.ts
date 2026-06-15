// lib/copa.ts
//
// Lógica PURA da Copa Ippon (mata-mata). Sem base de dados, sem rede — só
// raciocínio, para ser testável. A rota /api/copa/sortear usa estas funções.
//
// Mecanismo (ATUAL, em produção): eliminação simples 1v1 por ronda + disputa de
// 3º lugar. Mantido INTACTO para o /api/copa/apurar continuar a funcionar.
//
// Mecanismo (NOVO, secção "MOTOR COMPLETO" no fim): modelo validado com o Kainan
// — eliminação + repescagem em cadeia (4 cadeias) + cruzamento diagonal + 2
// bronzes + final por pontos ACUMULADOS. Funções puras, prontas para o apurar
// ser migrado para este modelo (Fase 3). NÃO removem nem alteram o que está acima.

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
  metade: "cima" | "baixo";  // metade da chave (para a repescagem/cruzamento)
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
      metade: "cima", // provisório; definido a seguir pela posição na chave
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
      metade: "cima", // provisório; definido a seguir pela posição na chave
    });
  }

  // 3) METADE da chave: os confrontos da 1ª ronda são sempre tamanho/2 (par).
  // A primeira metade deles é a metade de CIMA (semifinal de cima); a segunda,
  // a de BAIXO. É a divisão que a repescagem/cruzamento diagonal precisam. Os
  // byes vêm primeiro na lista, mas isso não desequilibra: a contagem é sempre
  // metade-metade (validado por simulação para 8/4/3/6/5 inscritos).
  const totalConfrontos = confrontos.length;
  confrontos.forEach((c, idx) => {
    c.metade = idx < totalConfrontos / 2 ? "cima" : "baixo";
  });

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
    // Bronze conforme o nº de perdedores REAIS (byes não geram perdedor):
    //  - 2 perdedores (chave de 4-7): disputam o bronze entre si.
    //  - 1 perdedor (chave de 3): fica 3º DIRETO, sem disputa (jogador_b null).
    //  - 0 perdedores (chave de 2): sem bronze.
    if (perdedores.length === 2) {
      novos.push({
        ronda: proximaRonda, ordem: 1, fase: "bronze",
        jogador_a: perdedores[0], jogador_b: perdedores[1],
        id_competicao: idCompeticaoProxima, estado: "pendente",
      });
    } else if (perdedores.length === 1) {
      novos.push({
        ronda: proximaRonda, ordem: 1, fase: "bronze",
        jogador_a: perdedores[0], jogador_b: null, // 3º direto, sem adversário
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

// ===========================================================================
// ===========================================================================
// MOTOR COMPLETO (modelo validado com o Kainan) — repescagem em cadeia,
// cruzamento diagonal, 2 bronzes e final por pontos ACUMULADOS.
//
// Esta secção é NOVA e INDEPENDENTE do que está acima. Lógica pura, validada por
// simulação numérica (8, 4, 3, 2 jogadores). Ainda NÃO está ligada ao apurar —
// fica pronta para a migração (Fase 3). Não toca em nada do mecanismo atual.
//
// Modelo (chave de 8+):
//  - Eliminação até às semis (vencedores avançam por pontos da competição).
//  - 4 semifinalistas: A,B (metade de cima), C,D (metade de baixo).
//  - REPESCAGEM, 1 cadeia por semifinalista: quem ele venceu ANTES da semi luta
//    em cadeia (1º vs 2º, vencedor vs 3º...) -> campeão de repescagem dele.
//  - Campeões de repescagem da MESMA metade enfrentam-se (A×B, C×D).
//  - CRUZAMENTO DIAGONAL: campeão rep. cima × semi-perdedor de baixo -> bronze 1;
//    campeão rep. baixo × semi-perdedor de cima -> bronze 2.
//  - FINAL: os 2 finalistas ACUMULAM pontos desde a semi (chegada à final) até
//    ao dia do bronze. Maior soma = campeão.
//  - <8: sem repescagem; os 2 semi-perdedores disputam 1 bronze (3 -> 3º direto).
// ===========================================================================

export type Metade = "cima" | "baixo";

// Decide um confronto 1v1 só por pontos (com fallback determinístico no empate).
// Versão simples para o motor completo; o desempate em cascata fica no apurar
// (que tem os pontos do capitão). Aqui `b` null = bye (passa `a`).
export function vencedorPorPontos(
  a: string,
  b: string | null,
  pontos: Record<string, number>
): string {
  if (b == null) return a;
  const pa = pontos[a] ?? 0;
  const pb = pontos[b] ?? 0;
  if (pa !== pb) return pa > pb ? a : b;
  return a; // empate: fallback determinístico (no apurar usa-se a cascata real)
}

// Nome da ronda da chave principal pelo nº de jogadores nessa ronda.
export function nomeRondaPorTamanho(jogadoresNaRonda: number): string {
  switch (jogadoresNaRonda) {
    case 2: return "Final";
    case 4: return "Semifinal";
    case 8: return "Quartas de final";
    case 16: return "Oitavas de final";
    case 32: return "Ronda de 32";
    case 64: return "Ronda de 64";
    default: return `Ronda de ${jogadoresNaRonda}`;
  }
}

// Um par a disputar (b null = bye).
export interface ParChave { a: string; b: string | null; }

// Constrói os pares da 1ª ronda com byes (os primeiros `byes` da lista passam).
export function paresPrimeiraRonda(inscritosBaralhados: string[]): ParChave[] {
  const tamanho = tamanhoChave(inscritosBaralhados.length);
  const byes = tamanho - inscritosBaralhados.length;
  const comBye = inscritosBaralhados.slice(0, byes);
  const aJogar = inscritosBaralhados.slice(byes);
  const pares: ParChave[] = [];
  for (const j of comBye) pares.push({ a: j, b: null });
  for (let i = 0; i < aJogar.length; i += 2) pares.push({ a: aJogar[i], b: aJogar[i + 1] ?? null });
  return pares;
}

// Resultado completo de uma Copa simulada/calculada com o motor completo.
export interface ResultadoCopa {
  campeao: string | null;
  vice: string | null;
  bronzes: string[];          // 0, 1 ou 2 medalhistas de bronze
  finalistas: string[];
  acumuladoFinal: Record<string, number>; // pontos acumulados de cada finalista
}

// Função de pontos por ronda: dado o índice da competição (0,1,2...), devolve o
// mapa { jogador: pontos } dessa competição. No apuramento real, isto é a
// pontuação da equipa de cada jogador na competição dessa ronda.
export type PontosPorRonda = (indiceCompeticao: number) => Record<string, number>;

/**
 * Calcula uma Copa COMPLETA do início ao fim, dado o sorteio (já baralhado) e a
 * função de pontos por ronda. PURA e determinística (o vencedorFn é injetável).
 *
 * É a versão "tudo de uma vez" — útil para testes e para a chave visual projetar
 * o desfecho. No apuramento real (dinâmico), o apurar fará isto ronda a ronda,
 * reutilizando as mesmas regras (cadeias, cruzamento, acumulação).
 *
 * @param inscritosBaralhados  ordem de sorteio (use embaralhar() antes)
 * @param pontosPorRonda       pontos de cada jogador por competição (índice)
 * @param vencedorFn           como decidir um par (default: por pontos)
 */
export function calcularCopaCompleta(
  inscritosBaralhados: string[],
  pontosPorRonda: PontosPorRonda,
  vencedorFn: (a: string, b: string | null, pontos: Record<string, number>) => string = vencedorPorPontos
): ResultadoCopa {
  const inscritos = inscritosBaralhados;
  if (inscritos.length < 2) {
    return { campeao: inscritos[0] ?? null, vice: null, bronzes: [], finalistas: inscritos.slice(0, 1), acumuladoFinal: {} };
  }

  const tamanho = tamanhoChave(inscritos.length);
  const chavePequena = inscritos.length < 8;

  // caminho[v] = quem v venceu ANTES da semifinal (para as cadeias de repescagem)
  const caminho: Record<string, string[]> = {};
  for (const j of inscritos) caminho[j] = [];
  const metade: Record<string, Metade> = {};
  const derrotaRonda: Record<string, number> = {}; // perdedor -> tamanho da ronda

  let rondaPares = paresPrimeiraRonda(inscritos);
  let jogadoresNaRonda = tamanho;
  let compIdx = 0;
  let primeira = true;

  while (jogadoresNaRonda > 2) {
    const pontos = pontosPorRonda(compIdx);
    const vencedores: string[] = [];
    rondaPares.forEach((par, idxPar) => {
      if (primeira) {
        const m: Metade = idxPar < rondaPares.length / 2 ? "cima" : "baixo";
        if (par.a) metade[par.a] = m;
        if (par.b) metade[par.b] = m;
      }
      const v = vencedorFn(par.a, par.b, pontos);
      if (par.b != null) {
        const perd = v === par.a ? par.b : par.a;
        // A cadeia inclui só vitórias ANTES da semi (jogadoresNaRonda > 4).
        if (jogadoresNaRonda > 4) caminho[v].push(perd);
        derrotaRonda[perd] = jogadoresNaRonda;
        if (metade[perd] === undefined && metade[v] !== undefined) metade[perd] = metade[v];
      }
      vencedores.push(v);
    });
    rondaPares = [];
    for (let i = 0; i < vencedores.length; i += 2) {
      rondaPares.push({ a: vencedores[i], b: vencedores[i + 1] ?? null });
    }
    jogadoresNaRonda /= 2;
    compIdx++;
    primeira = false;
  }

  const finalistas = [rondaPares[0].a, rondaPares[0].b].filter(Boolean) as string[];
  const compChegadaFinal = compIdx;

  // Semifinalistas perdedores (perderam na ronda de tamanho 4), por metade.
  const semiPerdedores = Object.keys(derrotaRonda).filter((p) => derrotaRonda[p] === 4);
  const semiPerdCima = semiPerdedores.find((p) => metade[p] === "cima") ?? null;
  const semiPerdBaixo = semiPerdedores.find((p) => metade[p] === "baixo") ?? null;

  let bronzes: string[] = [];

  if (chavePequena) {
    // <8: sem repescagem. Os 2 semi-perdedores disputam 1 bronze (3 -> 3º direto).
    if (semiPerdedores.length >= 2) {
      const pts = pontosPorRonda(compIdx);
      bronzes = [vencedorFn(semiPerdedores[0], semiPerdedores[1], pts)];
      compIdx++;
    } else if (semiPerdedores.length === 1) {
      bronzes = [semiPerdedores[0]];
    }
  } else {
    const semifinalistas = [...finalistas, ...semiPerdedores];

    // Corre a cadeia de um semifinalista (quem ele venceu, em cadeia).
    const cadeia = (sf: string): string | null => {
      const venceu = caminho[sf] ?? [];
      if (venceu.length === 0) return null;
      let atual = venceu[0];
      for (let i = 1; i < venceu.length; i++) {
        const pts = pontosPorRonda(compIdx);
        atual = vencedorFn(atual, venceu[i], pts);
        compIdx++;
      }
      return atual;
    };

    const sfCima = semifinalistas.filter((s) => metade[s] === "cima");
    const sfBaixo = semifinalistas.filter((s) => metade[s] === "baixo");

    const repA = sfCima[0] ? cadeia(sfCima[0]) : null;
    const repB = sfCima[1] ? cadeia(sfCima[1]) : null;
    const repC = sfBaixo[0] ? cadeia(sfBaixo[0]) : null;
    const repD = sfBaixo[1] ? cadeia(sfBaixo[1]) : null;

    // Campeões de repescagem da mesma metade enfrentam-se (A×B, C×D).
    const confronto = (x: string | null, y: string | null): string | null => {
      if (!x) return y; if (!y) return x;
      const pts = pontosPorRonda(compIdx);
      const v = vencedorFn(x, y, pts);
      compIdx++;
      return v;
    };
    const repCima = confronto(repA, repB);
    const repBaixo = confronto(repC, repD);

    // Cruzamento diagonal -> 2 bronzes.
    if (repCima || semiPerdBaixo) {
      const pts = pontosPorRonda(compIdx);
      bronzes.push(vencedorFn((repCima ?? semiPerdBaixo)!, semiPerdBaixo ?? repCima, pts));
    }
    if (repBaixo || semiPerdCima) {
      const pts = pontosPorRonda(compIdx);
      bronzes.push(vencedorFn((repBaixo ?? semiPerdCima)!, semiPerdCima ?? repBaixo, pts));
    }
    compIdx++;
  }

  // FINAL: acumula pontos dos finalistas desde a semi (chegada à final) até agora.
  const acumuladoFinal: Record<string, number> = {};
  for (const f of finalistas) acumuladoFinal[f] = 0;
  const inicioAcum = Math.max(0, compChegadaFinal - 1);
  for (let c = inicioAcum; c < compIdx; c++) {
    const pts = pontosPorRonda(c);
    for (const f of finalistas) acumuladoFinal[f] += (pts[f] ?? 0);
  }

  const [fa, fb] = finalistas;
  const campeao = fb == null ? fa : (acumuladoFinal[fa] >= acumuladoFinal[fb] ? fa : fb);
  const vice = fb == null ? null : (campeao === fa ? fb : fa);

  return { campeao: campeao ?? null, vice: vice ?? null, bronzes, finalistas, acumuladoFinal };
}

// ===========================================================================
// FASE 1 — GERAÇÃO RONDA-A-RONDA COM REPESCAGEM EM PARALELO (NOVA)
// ===========================================================================
// O `calcularCopaCompleta` (acima) decide a Copa toda de uma vez — útil para
// testes/projeção, mas a Copa real desenrola-se ronda a ronda, ao longo de
// semanas. Esta função é a peça que o apurar (Fase 2) vai usar: dada UMA ronda
// JÁ DECIDIDA, devolve os confrontos da ronda seguinte, aplicando o modelo:
//
//  - Quartos decididos (4 vencedores) -> gera, NA MESMA competição seguinte,
//    as 2 SEMIFINAIS e a 1ª ronda de REPESCAGEM (os perdedores dos quartos,
//    agrupados por metade). É o "em paralelo" que encurta a Copa numa ronda.
//  - Semis+repescagem decididas -> gera o BLOCO FINAL: a FINAL (2 vencedores das
//    semis) e os 2 BRONZES por CRUZAMENTO diagonal (repescado de cima × semi-
//    perdedor de baixo; repescado de baixo × semi-perdedor de cima).
//  - Chave pequena (semis sem repescagem prévia, 2 vencedores) -> final + 1
//    bronze (modelo simples), porque não há quem repescar.
//  - Ronda intermédia de chave grande (>4 vencedores) -> avança a eliminação
//    normal. NOTA: a cadeia LONGA de repescagem das chaves de 16+ (vários
//    perdedores por semifinalista) ainda NÃO é gerada aqui — fica para um passo
//    seguinte; até 8 jogadores a repescagem está completa e validada.
//
// A FASE 1 NÃO liga isto a nada. É pura e testável; o apurar continua a usar
// gerarRondaSeguinte (eliminação simples) até a Fase 2 fazer a troca.

// Confronto de uma ronda, como vem da BD (inclui `metade` e a fase "repescagem").
export interface ConfrontoRonda {
  ronda: number;
  ordem: number;
  fase: "normal" | "final" | "bronze" | "repescagem";
  jogador_a: string;
  jogador_b: string | null;
  vencedor: string | null;
  estado: "pendente" | "decidido";
  metade?: "cima" | "baixo" | null;
}

// Linha pronta a gravar para a ronda seguinte (modelo com repescagem).
export interface ConfrontoNovoRep {
  ronda: number;
  ordem: number;
  fase: "normal" | "final" | "bronze" | "repescagem";
  jogador_a: string;
  jogador_b: string | null;
  id_competicao: string;
  estado: "pendente";
  metade: "cima" | "baixo" | null;
}

export function gerarRondaSeguinteComRepescagem(
  confrontosDaRonda: ConfrontoRonda[],
  idCompProxima: string
): ConfrontoNovoRep[] {
  // Se a ronda já era a final, a Copa terminou.
  if (confrontosDaRonda.some((c) => c.fase === "final")) return [];

  const ord = [...confrontosDaRonda].sort((a, b) => a.ordem - b.ordem);
  const proxima = (ord[0]?.ronda ?? 1) + 1;
  const venc = (c: ConfrontoRonda) => c.vencedor;
  const perd = (c: ConfrontoRonda): string | null =>
    c.jogador_b == null ? null : (c.vencedor === c.jogador_a ? c.jogador_b : c.jogador_a);

  const repescagens = ord.filter((c) => c.fase === "repescagem");
  const normais = ord.filter((c) => c.fase === "normal");

  // CASO B: semis + repescagem -> BLOCO FINAL (final + 2 bronzes cruzados).
  if (repescagens.length > 0) {
    const vencSemi = normais.map(venc).filter((x): x is string => !!x);
    const perdSemiCima = normais.filter((c) => c.metade === "cima").map(perd).filter((x): x is string => !!x);
    const perdSemiBaixo = normais.filter((c) => c.metade === "baixo").map(perd).filter((x): x is string => !!x);
    const repCima = repescagens.filter((c) => c.metade === "cima").map(venc).filter((x): x is string => !!x);
    const repBaixo = repescagens.filter((c) => c.metade === "baixo").map(venc).filter((x): x is string => !!x);

    const novos: ConfrontoNovoRep[] = [];
    let ordem = 0;
    novos.push({ ronda: proxima, ordem: ordem++, fase: "final", jogador_a: vencSemi[0], jogador_b: vencSemi[1] ?? null, id_competicao: idCompProxima, estado: "pendente", metade: null });
    // Bronze 1 (cruzado): repescado de cima × semi-perdedor de baixo.
    const b1a = repCima[0] ?? null, b1b = perdSemiBaixo[0] ?? null;
    if (b1a || b1b) novos.push({ ronda: proxima, ordem: ordem++, fase: "bronze", jogador_a: (b1a ?? b1b)!, jogador_b: (b1a && b1b) ? b1b : null, id_competicao: idCompProxima, estado: "pendente", metade: null });
    // Bronze 2 (cruzado): repescado de baixo × semi-perdedor de cima.
    const b2a = repBaixo[0] ?? null, b2b = perdSemiCima[0] ?? null;
    if (b2a || b2b) novos.push({ ronda: proxima, ordem: ordem++, fase: "bronze", jogador_a: (b2a ?? b2b)!, jogador_b: (b2a && b2b) ? b2b : null, id_competicao: idCompProxima, estado: "pendente", metade: null });
    return novos;
  }

  const vencedores = normais.map(venc).filter((x): x is string => !!x);

  // CASO A: eram os QUARTOS (4 vencedores) -> semis + 1ª ronda de repescagem.
  if (vencedores.length === 4) {
    const normCima = normais.filter((c) => c.metade === "cima");
    const normBaixo = normais.filter((c) => c.metade === "baixo");
    const vencCima = normCima.map(venc).filter((x): x is string => !!x);
    const vencBaixo = normBaixo.map(venc).filter((x): x is string => !!x);
    const perdCima = normCima.map(perd).filter((x): x is string => !!x);
    const perdBaixo = normBaixo.map(perd).filter((x): x is string => !!x);

    const novos: ConfrontoNovoRep[] = [];
    let ordem = 0;
    novos.push({ ronda: proxima, ordem: ordem++, fase: "normal", jogador_a: vencCima[0], jogador_b: vencCima[1] ?? null, id_competicao: idCompProxima, estado: "pendente", metade: "cima" });
    novos.push({ ronda: proxima, ordem: ordem++, fase: "normal", jogador_a: vencBaixo[0], jogador_b: vencBaixo[1] ?? null, id_competicao: idCompProxima, estado: "pendente", metade: "baixo" });
    if (perdCima.length > 0) novos.push({ ronda: proxima, ordem: ordem++, fase: "repescagem", jogador_a: perdCima[0], jogador_b: perdCima[1] ?? null, id_competicao: idCompProxima, estado: "pendente", metade: "cima" });
    if (perdBaixo.length > 0) novos.push({ ronda: proxima, ordem: ordem++, fase: "repescagem", jogador_a: perdBaixo[0], jogador_b: perdBaixo[1] ?? null, id_competicao: idCompProxima, estado: "pendente", metade: "baixo" });
    return novos;
  }

  // CASO pequeno: 2 vencedores -> eram as semis de uma chave <=4 (sem
  // repescagem possível) -> final + bronze simples.
  if (vencedores.length === 2) {
    const perdedores = normais.map(perd).filter((x): x is string => !!x);
    const novos: ConfrontoNovoRep[] = [
      { ronda: proxima, ordem: 0, fase: "final", jogador_a: vencedores[0], jogador_b: vencedores[1] ?? null, id_competicao: idCompProxima, estado: "pendente", metade: null },
    ];
    if (perdedores.length === 2) novos.push({ ronda: proxima, ordem: 1, fase: "bronze", jogador_a: perdedores[0], jogador_b: perdedores[1], id_competicao: idCompProxima, estado: "pendente", metade: null });
    else if (perdedores.length === 1) novos.push({ ronda: proxima, ordem: 1, fase: "bronze", jogador_a: perdedores[0], jogador_b: null, id_competicao: idCompProxima, estado: "pendente", metade: null });
    return novos;
  }

  // CASO C: ronda intermédia de chave grande (>4 vencedores). Eliminação normal,
  // herdando a metade. (A cadeia longa de repescagem de 16+ entra num passo futuro.)
  const novos: ConfrontoNovoRep[] = [];
  let ordem = 0;
  for (let i = 0; i < vencedores.length; i += 2) {
    const cDoVenc = normais.find((c) => c.vencedor === vencedores[i]);
    novos.push({ ronda: proxima, ordem: ordem++, fase: "normal", jogador_a: vencedores[i], jogador_b: vencedores[i + 1] ?? null, id_competicao: idCompProxima, estado: "pendente", metade: cDoVenc?.metade ?? null });
  }
  return novos;
}
