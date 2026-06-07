// lib/calendario.ts
// Calendário Oficial Ippon League 2026.
//
// Uma competição por semana (52 semanas). Cada semana aponta para uma
// competição do JudoBase pelo seu id_competition. As semanas sem competição
// real de 2026 são preenchidas com um CLÁSSICO (competição antiga revivida),
// claramente marcado para o utilizador.
//
// Esta é a "fonte de verdade" que toda a app consulta para saber qual é a
// competição da semana. O mecanismo de automação (cron) lê daqui.

export type Nivel =
  | "Olimpíada"
  | "Mundial"
  | "Masters"
  | "Grand Slam"
  | "Continental"      // forte: Europeu, Panamericano, Asiático
  | "Grand Prix"
  | "European Open"
  | "European Cup"
  | "Continental fraco" // Oceania, África
  | "Open";             // opens dos outros continentes

export interface SemanaCalendario {
  semana: number;        // 1..52 (semana ISO de 2026)
  idCompeticao: string;  // id_competition no JudoBase
  nome: string;          // nome para mostrar ao utilizador
  nivel: Nivel;
  de: string;            // data de início (YYYY/MM/DD) — referência da rodada
  classico: boolean;     // true = competição antiga revivida
  anoOriginal?: number;  // se clássico, o ano real da competição
}

// As 52 semanas de 2026. As reais (classico:false) estão confirmadas na lista
// JudoBase de 2026. Os clássicos (classico:true) usam ids de 2023-2024 e
// precisam de confirmação de que trazem inscritos (testar /api/atletas?id=...).
export const CALENDARIO_2026: SemanaCalendario[] = [
  // --- 4 primeiras semanas: pausa de inverno -> CLÁSSICOS ---
  { semana: 1, idCompeticao: "2653", nome: "Jogos Olímpicos Paris 2024 — Clássico", nivel: "Olimpíada", de: "2026/01/01", classico: true, anoOriginal: 2024 },
  { semana: 2, idCompeticao: "2442", nome: "Mundial de Doha 2023 — Clássico", nivel: "Mundial", de: "2026/01/05", classico: true, anoOriginal: 2023 },
  { semana: 3, idCompeticao: "2787", nome: "Mundial de Abu Dhabi 2024 — Clássico", nivel: "Mundial", de: "2026/01/12", classico: true, anoOriginal: 2024 },

  // --- competições reais de 2026 ---
  { semana: 4,  idCompeticao: "3136", nome: "Casablanca African Open",                 nivel: "Open",          de: "2026/01/25", classico: false },
  { semana: 5,  idCompeticao: "3152", nome: "Sofia European Open",                     nivel: "European Open", de: "2026/01/31", classico: false },
  { semana: 6,  idCompeticao: "3131", nome: "Paris Grand Slam 2026",                   nivel: "Grand Slam",    de: "2026/02/07", classico: false },
  { semana: 7,  idCompeticao: "3154", nome: "Ljubljana European Open",                 nivel: "European Open", de: "2026/02/14", classico: false },
  { semana: 8, idCompeticao: "2877", nome: "Mundial da Hungria 2025 — Clássico", nivel: "Mundial", de: "2026/02/21", classico: true, anoOriginal: 2025 },
  { semana: 9,  idCompeticao: "3132", nome: "Tashkent Grand Slam",                     nivel: "Grand Slam",    de: "2026/02/27", classico: false },
  { semana: 10, idCompeticao: "3135", nome: "Grand Prix Upper Austria",               nivel: "Grand Prix",    de: "2026/03/06", classico: false },
  { semana: 11, idCompeticao: "3156", nome: "Warsaw European Open",                    nivel: "European Open", de: "2026/03/14", classico: false },
  { semana: 12, idCompeticao: "3134", nome: "Tbilisi Grand Slam",                      nivel: "Grand Slam",    de: "2026/03/20", classico: false },
  { semana: 13, idCompeticao: "3245", nome: "Dubrovnik Senior European Cup",           nivel: "European Cup",  de: "2026/03/28", classico: false },
  { semana: 14, idCompeticao: "2447", nome: "Hungary Masters 2023 — Clássico", nivel: "Masters", de: "2026/04/04", classico: true, anoOriginal: 2023 },
  { semana: 15, idCompeticao: "2438", nome: "Paris Grand Slam 2023 — Clássico", nivel: "Grand Slam", de: "2026/04/09", classico: true, anoOriginal: 2023 },
  { semana: 16, idCompeticao: "3163", nome: "Campeonato Europeu (Individuais)",        nivel: "Continental",   de: "2026/04/16", classico: false },
  { semana: 17, idCompeticao: "3171", nome: "Campeonato Africano (Individuais)",       nivel: "Continental fraco", de: "2026/04/24", classico: false },
  { semana: 18, idCompeticao: "3138", nome: "Dushanbe Grand Slam",                     nivel: "Grand Slam",    de: "2026/05/01", classico: false },
  { semana: 19, idCompeticao: "3139", nome: "Qazaqstan Barysy Grand Slam",             nivel: "Grand Slam",    de: "2026/05/08", classico: false },
  { semana: 20, idCompeticao: "3158", nome: "La Nucia/Benidorm European Open",         nivel: "European Open", de: "2026/05/16", classico: false },
  { semana: 21, idCompeticao: "3224", nome: "Algiers African Open",                    nivel: "Open",          de: "2026/05/24", classico: false },
  { semana: 22, idCompeticao: "3255", nome: "Sarajevo Senior European Cup",            nivel: "European Cup",  de: "2026/05/30", classico: false },
  { semana: 23, idCompeticao: "3161", nome: "Tallinn European Open",                   nivel: "European Open", de: "2026/06/06", classico: false },
  { semana: 24, idCompeticao: "3295", nome: "Tahiti Oceanian Open",                    nivel: "Open",          de: "2026/06/13", classico: false },
  { semana: 25, idCompeticao: "3149", nome: "Ulaanbaatar Grand Slam",                  nivel: "Grand Slam",    de: "2026/06/19", classico: false },
  { semana: 26, idCompeticao: "3204", nome: "Qingdao Grand Prix",                      nivel: "Grand Prix",    de: "2026/06/26", classico: false },
  { semana: 27, idCompeticao: "2644", nome: "Paris Grand Slam 2024 — Clássico", nivel: "Grand Slam", de: "2026/07/04", classico: true, anoOriginal: 2024 },
  { semana: 28, idCompeticao: "3173", nome: "Taipei Asian Open",                       nivel: "Open",          de: "2026/07/11", classico: false },
  { semana: 29, idCompeticao: "3168", nome: "Sarajevo European Open",                  nivel: "European Open", de: "2026/07/18", classico: false },
  // --- bloco de verão: 3 semanas sem competição -> CLÁSSICOS ---
  { semana: 30, idCompeticao: "2869", nome: "Paris Grand Slam 2025 — Clássico", nivel: "Grand Slam", de: "2026/07/25", classico: true, anoOriginal: 2025 },
  { semana: 31, idCompeticao: "2455", nome: "Tokyo Grand Slam 2023 — Clássico", nivel: "Grand Slam", de: "2026/08/01", classico: true, anoOriginal: 2023 },
  { semana: 32, idCompeticao: "2886", nome: "Tokyo Grand Slam 2025 — Clássico", nivel: "Grand Slam", de: "2026/08/08", classico: true, anoOriginal: 2025 },
  { semana: 33, idCompeticao: "3205", nome: "Lima Grand Prix",                         nivel: "Grand Prix",    de: "2026/08/14", classico: false },
  { semana: 34, idCompeticao: "3335", nome: "Lima Panamerican Open",                   nivel: "Open",          de: "2026/08/18", classico: false },
  { semana: 35, idCompeticao: "3225", nome: "Lausanne Grand Slam",                     nivel: "Grand Slam",    de: "2026/08/28", classico: false },
  { semana: 36, idCompeticao: "3336", nome: "San Salvador Panamerican Open",           nivel: "Open",          de: "2026/09/05", classico: false },
  { semana: 37, idCompeticao: "3155", nome: "Hungary Grand Slam",                      nivel: "Grand Slam",    de: "2026/09/11", classico: false },
  { semana: 38, idCompeticao: "3250", nome: "Skopje Senior European Cup",              nivel: "European Cup",  de: "2026/09/19", classico: false },
  { semana: 39, idCompeticao: "2440", nome: "Tbilisi Grand Slam 2023 — Clássico", nivel: "Grand Slam", de: "2026/09/26", classico: true, anoOriginal: 2023 },
  { semana: 40, idCompeticao: "3151", nome: "Mundial de Baku (Individuais)",           nivel: "Mundial",       de: "2026/10/04", classico: false },
  { semana: 41, idCompeticao: "3251", nome: "Malaga Senior European Cup",              nivel: "European Cup",  de: "2026/10/10", classico: false },
  { semana: 42, idCompeticao: "2441", nome: "Antalya Grand Slam 2023 — Clássico", nivel: "Grand Slam", de: "2026/10/17", classico: true, anoOriginal: 2023 },
  { semana: 43, idCompeticao: "2450", nome: "Baku Grand Slam 2023 — Clássico", nivel: "Grand Slam", de: "2026/10/22", classico: true, anoOriginal: 2023 },
  { semana: 44, idCompeticao: "3157", nome: "Abu Dhabi Grand Slam",                    nivel: "Grand Slam",    de: "2026/10/29", classico: false },
  { semana: 45, idCompeticao: "3169", nome: "Montreal Panamerican Open",               nivel: "Open",          de: "2026/11/07", classico: false },
  { semana: 46, idCompeticao: "3159", nome: "Zagreb Grand Prix",                       nivel: "Grand Prix",    de: "2026/11/13", classico: false },
  { semana: 47, idCompeticao: "3174", nome: "Kowloon Asian Open",                      nivel: "Open",          de: "2026/11/21", classico: false },
  { semana: 48, idCompeticao: "3167", nome: "Rome European Open",                      nivel: "European Open", de: "2026/11/28", classico: false },
  { semana: 49, idCompeticao: "3160", nome: "Tokyo Grand Slam",                        nivel: "Grand Slam",    de: "2026/12/05", classico: false },
  { semana: 50, idCompeticao: "3150", nome: "Dar Es Salaam African Open",              nivel: "Open",          de: "2026/12/13", classico: false },
  { semana: 51, idCompeticao: "3343", nome: "Dushanbe World Judo Masters",             nivel: "Masters",       de: "2026/12/18", classico: false },
  { semana: 52, idCompeticao: "2646", nome: "Tashkent Grand Slam 2024 — Clássico", nivel: "Grand Slam", de: "2026/12/26", classico: true, anoOriginal: 2024 },
];

/** Devolve a semana ISO (1..53) de uma data. */
export function semanaISO(d: Date): number {
  const data = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dia = data.getUTCDay() || 7;
  data.setUTCDate(data.getUTCDate() + 4 - dia);
  const inicioAno = new Date(Date.UTC(data.getUTCFullYear(), 0, 1));
  return Math.ceil((((data.getTime() - inicioAno.getTime()) / 86400000) + 1) / 7);
}

/** A competição da semana atual; se já passou, a próxima a contar. */
export function competicaoDaSemana(hoje: Date = new Date()): SemanaCalendario {
  const wk = semanaISO(hoje);
  const ordenado = [...CALENDARIO_2026].sort((a, b) => a.semana - b.semana);
  // a competição desta semana, ou a primeira semana à frente que exista
  const atualOuProxima = ordenado.find((s) => s.semana >= wk);
  return atualOuProxima || ordenado[ordenado.length - 1];
}

/** Lista só das competições reais (não-clássicas) — útil para o cron. */
export function competicoesReais(): SemanaCalendario[] {
  return CALENDARIO_2026.filter((s) => !s.classico);
}
