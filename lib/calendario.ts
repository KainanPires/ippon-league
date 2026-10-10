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
//
// Os 14 clássicos de 2026 saem do BANCO_CLASSICOS (lib/classicos.ts) e estão
// lá marcados com usadoEm:2026 — para não se repetirem nos próximos anos.

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

// ---------------------------------------------------------------------------
// PORQUE O `nome` NÃO TEM A CIDADE (decisão de 29/07/2026)
//
// Um CLÁSSICO é a reposição de uma competição antiga. Se o utilizador souber que
// a rodada é o "Grand Prix The Hague 2018", vai ao JudoBase, lê os resultados de
// 2018 e monta a equipa perfeita. O jogo acaba ali.
//
// Durante semanas tentámos resolver isto escondendo a cidade em cada sítio onde
// o nome aparecia — mercado, criar-equipa, início, ligas, dojo, seletor de
// rodadas... e continuavam a aparecer sítios novos. A pesquisa deu 43 ficheiros
// a tocar em `.nome`. Caçar um a um era garantir que a próxima página voltava a
// abrir o buraco, porque o caminho fácil (`s.nome`) era o inseguro.
//
// Por isso invertemos: agora o caminho fácil é o SEGURO.
//
//   s.nome          -> "Grand Prix 2018 — Clássico"            (sem cidade)
//   s.nomeCompleto  -> "Grand Prix The Hague 2018 — Clássico"  (com cidade)
//   nomeCompeticao(s) -> o completo SE já for seguro; senão, o curto
//
// Quem escrever `s.nome` por distração não revela nada. O pior que acontece é
// um clássico já terminado mostrar o nome curto — cosmético, não uma fuga.
//
// As competições REAIS não têm `nomeCompleto`: o calendário da IJF é público e
// não há nada a esconder.
// ---------------------------------------------------------------------------
export interface SemanaCalendario {
  semana: number;        // 1..52 (semana ISO de 2026)
  idCompeticao: string;  // id_competition no JudoBase
  // NOME SEGURO POR OMISSÃO — ler a nota abaixo antes de mexer.
  // Nos clássicos, este campo NÃO tem a cidade ("Grand Prix 2018 — Clássico").
  // É de propósito: é o que se mostra quando não se sabe se já se pode revelar.
  nome: string;
  // Nome completo, com cidade. SÓ deve chegar ao utilizador através de
  // nomeCompeticao(), que decide se já é seguro mostrá-lo.
  nomeCompleto?: string;
  nivel: Nivel;
  de: string;            // data de início (YYYY/MM/DD) — referência da rodada
  classico: boolean;     // true = competição antiga revivida
  anoOriginal?: number;  // se clássico, o ano real da competição
  // Hora OFICIAL de início do 1º dia de competição, em ISO 8601 COM FUSO
  // (ex.: Tahiti UTC-10 → "2026-06-13T10:00:00-10:00"). Opcional: quando existe,
  // o fecho do mercado e a contagem decrescente passam a ser ao minuto. Quando
  // não existe, a app cai no comportamento por data (ver estadoMercado).
  inicioUTC?: string;
  // MODO ROLLING — só para competições de VÁRIOS DIAS com categorias por dia
  // (Mundial de judô, Olimpíadas). O mercado fica aberto toda a semana e cada
  // CATEGORIA tranca no seu instante (o início do seu dia). Fora deste bloco,
  // tudo funciona com a regra normal (um mercado, fecha 1h antes do início).
  //   fecho: categoria ("-60", "+78", ...) -> instante ISO em que essa categoria
  //          deixa de ser contratável (e os atletas dela ficam bloqueados).
  //   fim:   instante ISO do FIM do evento (após o último dia). Até lá o mercado
  //          está "aberto" e a competição é o foco; depois, é congelada.
  rolling?: {
    fecho: Record<string, string>;
    fim: string;
  };
}

// As 52 semanas de 2026. As reais (classico:false) estão confirmadas na lista
// JudoBase de 2026. Os clássicos (classico:true) usam ids antigos (2015-2022)
// confirmados via /api/diag e registados no BANCO_CLASSICOS.
export const CALENDARIO_2026: SemanaCalendario[] = [
  // --- 3 primeiras semanas: pausa de inverno -> CLÁSSICOS ---
  { semana: 1, idCompeticao: "1194", nome: "Grand Prix 2015 — Clássico", nomeCompleto: "Grand Prix Dusseldorf 2015 — Clássico", nivel: "Grand Prix", de: "2026/01/01", classico: true, anoOriginal: 2015 },
  { semana: 2, idCompeticao: "1220", nome: "Grand Slam 2015 — Clássico", nomeCompleto: "Grand Slam Baku 2015 — Clássico", nivel: "Grand Slam", de: "2026/01/05", classico: true, anoOriginal: 2015 },
  { semana: 3, idCompeticao: "1308", nome: "Grand Prix 2016 — Clássico", nomeCompleto: "Grand Prix Havana 2016 — Clássico", nivel: "Grand Prix", de: "2026/01/12", classico: true, anoOriginal: 2016 },

  // --- competições reais de 2026 ---
  { semana: 4,  idCompeticao: "3136", nome: "Casablanca African Open",                 nivel: "Open",          de: "2026/01/25", classico: false },
  { semana: 5,  idCompeticao: "3152", nome: "Sofia European Open",                     nivel: "European Open", de: "2026/01/31", classico: false },
  { semana: 6,  idCompeticao: "3131", nome: "Paris Grand Slam 2026",                   nivel: "Grand Slam",    de: "2026/02/07", classico: false },
  { semana: 7,  idCompeticao: "3154", nome: "Ljubljana European Open",                 nivel: "European Open", de: "2026/02/14", classico: false },
  { semana: 8, idCompeticao: "1338", nome: "Grand Slam 2016 — Clássico", nomeCompleto: "Grand Slam Tyumen 2016 — Clássico", nivel: "Grand Slam", de: "2026/02/21", classico: true, anoOriginal: 2016 },
  { semana: 9,  idCompeticao: "3132", nome: "Tashkent Grand Slam",                     nivel: "Grand Slam",    de: "2026/02/27", classico: false },
  { semana: 10, idCompeticao: "3135", nome: "Grand Prix Upper Austria",               nivel: "Grand Prix",    de: "2026/03/06", classico: false },
  { semana: 11, idCompeticao: "3156", nome: "Warsaw European Open",                    nivel: "European Open", de: "2026/03/14", classico: false },
  { semana: 12, idCompeticao: "3134", nome: "Tbilisi Grand Slam",                      nivel: "Grand Slam",    de: "2026/03/20", classico: false },
  { semana: 13, idCompeticao: "3245", nome: "Dubrovnik Senior European Cup",           nivel: "European Cup",  de: "2026/03/28", classico: false },
  { semana: 14, idCompeticao: "1658", nome: "Masters 2018 — Clássico", nomeCompleto: "Guangzhou Masters 2018 — Clássico", nivel: "Masters", de: "2026/04/04", classico: true, anoOriginal: 2018 },
  { semana: 15, idCompeticao: "1457", nome: "Grand Slam 2017 — Clássico", nomeCompleto: "Grand Slam Ekaterinburg 2017 — Clássico", nivel: "Grand Slam", de: "2026/04/09", classico: true, anoOriginal: 2017 },
  { semana: 16, idCompeticao: "3163", nome: "Campeonato Europeu (Individuais)",        nivel: "Continental",   de: "2026/04/16", classico: false },
  { semana: 17, idCompeticao: "3171", nome: "Campeonato Africano (Individuais)",       nivel: "Continental fraco", de: "2026/04/24", classico: false },
  { semana: 18, idCompeticao: "3138", nome: "Dushanbe Grand Slam",                     nivel: "Grand Slam",    de: "2026/05/01", classico: false },
  { semana: 19, idCompeticao: "3139", nome: "Qazaqstan Barysy Grand Slam",             nivel: "Grand Slam",    de: "2026/05/08", classico: false },
  { semana: 20, idCompeticao: "3158", nome: "La Nucia/Benidorm European Open",         nivel: "European Open", de: "2026/05/16", classico: false },
  { semana: 21, idCompeticao: "3224", nome: "Algiers African Open",                    nivel: "Open",          de: "2026/05/24", classico: false },
  { semana: 22, idCompeticao: "3255", nome: "Sarajevo Senior European Cup",            nivel: "European Cup",  de: "2026/05/30", classico: false },
  { semana: 23, idCompeticao: "3161", nome: "Tallinn European Open",                   nivel: "European Open", de: "2026/06/06", classico: false },
  // Tahiti UTC-10. Sem hora oficial confirmada, usamos um DEFAULT SEGURO: 09:00 locais
  // de início (as competições quase nunca começam antes das 9h). Com a regra "fecho =
  // início - 1h", o mercado fecha às 08:00 locais — fecha cedo de propósito, para nunca
  // ficar aberto depois do início real. Confirmar com o outline da IJF e corrigir só esta
  // string. Apagar "inicioUTC" → volta ao comportamento por data.
  { semana: 24, idCompeticao: "3295", nome: "Tahiti Oceanian Open",                    nivel: "Open",          de: "2026/06/13", classico: false, inicioUTC: "2026-06-13T09:00:00-10:00" },
  { semana: 25, idCompeticao: "3149", nome: "Ulaanbaatar Grand Slam",                  nivel: "Grand Slam",    de: "2026/06/19", classico: false },
  { semana: 26, idCompeticao: "3204", nome: "Qingdao Grand Prix",                      nivel: "Grand Prix",    de: "2026/06/26", classico: false },
  { semana: 27, idCompeticao: "1460", nome: "Grand Prix 2017 — Clássico", nomeCompleto: "Grand Prix Hohhot 2017 — Clássico", nivel: "Grand Prix", de: "2026/07/04", classico: true, anoOriginal: 2017 },
  { semana: 28, idCompeticao: "3173", nome: "Taipei Asian Open",                       nivel: "Open",          de: "2026/07/11", classico: false },
  { semana: 29, idCompeticao: "3168", nome: "Sarajevo European Open",                  nivel: "European Open", de: "2026/07/18", classico: false },
  // --- bloco de verão: 3 semanas sem competição -> CLÁSSICOS ---
  { semana: 30, idCompeticao: "1601", nome: "Grand Slam 2018 — Clássico", nomeCompleto: "Grand Slam Osaka 2018 — Clássico", nivel: "Grand Slam", de: "2026/07/25", classico: true, anoOriginal: 2018 },
  { semana: 31, idCompeticao: "1598", nome: "Grand Prix 2018 — Clássico", nomeCompleto: "Grand Prix The Hague 2018 — Clássico", nivel: "Grand Prix", de: "2026/08/01", classico: true, anoOriginal: 2018 },
  { semana: 32, idCompeticao: "1746", nome: "Grand Prix 2019 — Clássico", nomeCompleto: "Grand Prix Montreal 2019 — Clássico", nivel: "Grand Prix", de: "2026/08/08", classico: true, anoOriginal: 2019 },
  { semana: 33, idCompeticao: "3205", nome: "Lima Grand Prix",                         nivel: "Grand Prix",    de: "2026/08/14", classico: false, inicioUTC: "2026-08-14T11:00:00-05:00" },
  { semana: 34, idCompeticao: "3335", nome: "Lima Panamerican Open",                   nivel: "Open",          de: "2026/08/18", classico: false },
  { semana: 35, idCompeticao: "3225", nome: "Lausanne Grand Slam",                     nivel: "Grand Slam",    de: "2026/08/28", classico: false },
  { semana: 36, idCompeticao: "3336", nome: "San Salvador Panamerican Open",           nivel: "Open",          de: "2026/09/05", classico: false },
  { semana: 37, idCompeticao: "3155", nome: "Hungary Grand Slam",                      nivel: "Grand Slam",    de: "2026/09/11", classico: false },
  { semana: 38, idCompeticao: "3250", nome: "Skopje Senior European Cup",              nivel: "European Cup",  de: "2026/09/19", classico: false },
  { semana: 39, idCompeticao: "1837", nome: "Grand Slam 2019 — Clássico", nomeCompleto: "Grand Slam Brasília 2019 — Clássico", nivel: "Grand Slam", de: "2026/09/26", classico: true, anoOriginal: 2019 },
  // MUNDIAL DE BAKU — evento de 7 dias (4→10/10), MODO ROLLING. Cada categoria
  // tranca às 09:00 de Baku (AZT, UTC+4 = 05:00 UTC) do seu dia. Ocupa as semanas
  // 40 e 41; a Malaga European Cup (que era a semana 41) saiu deste ciclo — o
  // Mundial é dono da semana e a seguinte é o clássico de Marraquexe (17/10).
  { semana: 40, idCompeticao: "3151", nome: "Mundial de Baku (Individuais)",           nivel: "Mundial",       de: "2026/10/04", classico: false,
    rolling: {
      fecho: {
        "-60": "2026-10-04T05:00:00Z", "-48": "2026-10-04T05:00:00Z",
        "-66": "2026-10-05T05:00:00Z", "-52": "2026-10-05T05:00:00Z",
        "-73": "2026-10-06T05:00:00Z", "-57": "2026-10-06T05:00:00Z",
        "-81": "2026-10-07T05:00:00Z", "-63": "2026-10-07T05:00:00Z",
        "-90": "2026-10-08T05:00:00Z", "-70": "2026-10-08T05:00:00Z",
        "-100": "2026-10-09T05:00:00Z", "-78": "2026-10-09T05:00:00Z",
        "+100": "2026-10-10T05:00:00Z", "+78": "2026-10-10T05:00:00Z",
      },
      fim: "2026-10-11T00:00:00Z",
    } },
  { semana: 42, idCompeticao: "1702", nome: "Grand Prix 2019 — Clássico", nomeCompleto: "Grand Prix Marrakech 2019 — Clássico", nivel: "Grand Prix", de: "2026/10/17", classico: true, anoOriginal: 2019 },
  { semana: 43, idCompeticao: "2253", nome: "Grand Prix 2021 — Clássico", nomeCompleto: "Grand Prix Zagreb 2021 — Clássico", nivel: "Grand Prix", de: "2026/10/22", classico: true, anoOriginal: 2021 },
  { semana: 44, idCompeticao: "3157", nome: "Abu Dhabi Grand Slam",                    nivel: "Grand Slam",    de: "2026/10/29", classico: false },
  { semana: 45, idCompeticao: "3169", nome: "Montreal Panamerican Open",               nivel: "Open",          de: "2026/11/07", classico: false },
  { semana: 46, idCompeticao: "3159", nome: "Zagreb Grand Prix",                       nivel: "Grand Prix",    de: "2026/11/13", classico: false },
  { semana: 47, idCompeticao: "3174", nome: "Kowloon Asian Open",                      nivel: "Open",          de: "2026/11/21", classico: false },
  { semana: 48, idCompeticao: "3167", nome: "Rome European Open",                      nivel: "European Open", de: "2026/11/28", classico: false },
  { semana: 49, idCompeticao: "3160", nome: "Tokyo Grand Slam",                        nivel: "Grand Slam",    de: "2026/12/05", classico: false },
  { semana: 50, idCompeticao: "3150", nome: "Dar Es Salaam African Open",              nivel: "Open",          de: "2026/12/13", classico: false },
  { semana: 51, idCompeticao: "3343", nome: "Dushanbe World Judo Masters",             nivel: "Masters",       de: "2026/12/18", classico: false },
  { semana: 52, idCompeticao: "2284", nome: "Grand Slam 2022 — Clássico", nomeCompleto: "Grand Slam Tel Aviv 2022 — Clássico", nivel: "Grand Slam", de: "2026/12/26", classico: true, anoOriginal: 2022 },
];

// ===========================================================================
// CALENDÁRIO 2027 — construído a partir do calendário oficial da IJF (PDF de
// 29/09/2026). A IJF ainda só publicou os grandes eventos (Grand Slams, Grand
// Prix e o Mundial de Astana); as restantes semanas são CLÁSSICOS do banco
// (usadoEm:2027). Quando a IJF acrescentar provas ao longo do ano, substituem-se
// os clássicos pelas reais (re-busca no calendário da IJF).
// ===========================================================================
export const CALENDARIO_2027: SemanaCalendario[] = [
  { semana: 1, idCompeticao: "2883", nome: "Grand Slam 2025 — Clássico", nomeCompleto: "Abu Dhabi Grand Slam 2025 — Clássico", nivel: "Grand Slam", de: "2027/01/09", classico: true, anoOriginal: 2025 },
  { semana: 2, idCompeticao: "2879", nome: "Grand Slam 2025 — Clássico", nomeCompleto: "Ulaanbaatar Grand Slam 2025 — Clássico", nivel: "Grand Slam", de: "2027/01/16", classico: true, anoOriginal: 2025 },
  { semana: 3, idCompeticao: "2876", nome: "Grand Slam 2025 — Clássico", nomeCompleto: "Qazaqstan Barysy Grand Slam 2025 — Clássico", nivel: "Grand Slam", de: "2027/01/23", classico: true, anoOriginal: 2025 },
  { semana: 4, idCompeticao: "2873", nome: "Grand Slam 2025 — Clássico", nomeCompleto: "Dushanbe Grand Slam 2025 — Clássico", nivel: "Grand Slam", de: "2027/01/30", classico: true, anoOriginal: 2025 },
  { semana: 5, idCompeticao: "3376", nome: "Paris Grand Slam 2027", nivel: "Grand Slam", de: "2027/02/05", classico: false },
  { semana: 6, idCompeticao: "2874", nome: "Grand Slam 2025 — Clássico", nomeCompleto: "Tbilisi Grand Slam 2025 — Clássico", nivel: "Grand Slam", de: "2027/02/13", classico: true, anoOriginal: 2025 },
  { semana: 7, idCompeticao: "3378", nome: "Baku Grand Slam 2027", nivel: "Grand Slam", de: "2027/02/19", classico: false },
  { semana: 8, idCompeticao: "2871", nome: "Grand Slam 2025 — Clássico", nomeCompleto: "Tashkent Grand Slam 2025 — Clássico", nivel: "Grand Slam", de: "2027/02/27", classico: true, anoOriginal: 2025 },
  { semana: 9, idCompeticao: "3377", nome: "Tashkent Grand Slam 2027", nivel: "Grand Slam", de: "2027/03/05", classico: false },
  { semana: 10, idCompeticao: "3379", nome: "Grand Prix Upper Austria 2027", nivel: "Grand Prix", de: "2027/03/12", classico: false },
  { semana: 11, idCompeticao: "2870", nome: "Grand Slam 2025 — Clássico", nomeCompleto: "Baku Grand Slam 2025 — Clássico", nivel: "Grand Slam", de: "2027/03/20", classico: true, anoOriginal: 2025 },
  { semana: 12, idCompeticao: "3380", nome: "Tbilisi Grand Slam 2027", nivel: "Grand Slam", de: "2027/03/26", classico: false },
  { semana: 13, idCompeticao: "2885", nome: "Grand Prix 2025 — Clássico", nomeCompleto: "Zagreb Grand Prix 2025 — Clássico", nivel: "Grand Prix", de: "2027/04/03", classico: true, anoOriginal: 2025 },
  { semana: 14, idCompeticao: "3081", nome: "Grand Prix 2025 — Clássico", nomeCompleto: "Guadalajara Grand Prix 2025 — Clássico", nivel: "Grand Prix", de: "2027/04/10", classico: true, anoOriginal: 2025 },
  { semana: 15, idCompeticao: "3086", nome: "Grand Prix 2025 — Clássico", nomeCompleto: "Lima Grand Prix 2025 — Clássico", nivel: "Grand Prix", de: "2027/04/17", classico: true, anoOriginal: 2025 },
  { semana: 16, idCompeticao: "3085", nome: "Grand Prix 2025 — Clássico", nomeCompleto: "Qingdao Grand Prix 2025 — Clássico", nivel: "Grand Prix", de: "2027/04/24", classico: true, anoOriginal: 2025 },
  { semana: 17, idCompeticao: "3381", nome: "Dushanbe Grand Slam 2027", nivel: "Grand Slam", de: "2027/04/30", classico: false },
  { semana: 18, idCompeticao: "2872", nome: "Grand Prix 2025 — Clássico", nomeCompleto: "Grand Prix Upper Austria 2025 — Clássico", nivel: "Grand Prix", de: "2027/05/08", classico: true, anoOriginal: 2025 },
  { semana: 19, idCompeticao: "2857", nome: "Grand Slam 2024 — Clássico", nomeCompleto: "Tokyo Grand Slam 2024 — Clássico", nivel: "Grand Slam", de: "2027/05/15", classico: true, anoOriginal: 2024 },
  { semana: 20, idCompeticao: "2657", nome: "Grand Slam 2024 — Clássico", nomeCompleto: "Abu Dhabi Grand Slam 2024 — Clássico", nivel: "Grand Slam", de: "2027/05/22", classico: true, anoOriginal: 2024 },
  { semana: 21, idCompeticao: "2651", nome: "Grand Slam 2024 — Clássico", nomeCompleto: "Qazaqstan Barysy Grand Slam 2024 — Clássico", nivel: "Grand Slam", de: "2027/05/29", classico: true, anoOriginal: 2024 },
  { semana: 22, idCompeticao: "2650", nome: "Grand Slam 2024 — Clássico", nomeCompleto: "Dushanbe Grand Slam 2024 — Clássico", nivel: "Grand Slam", de: "2027/06/05", classico: true, anoOriginal: 2024 },
  { semana: 23, idCompeticao: "3390", nome: "Mundial de Astana (Individuais)",         nivel: "Mundial",       de: "2027/06/07", classico: false,
    rolling: {
      // ESTIMATIVA: a IJF ainda não publicou que categoria luta em cada dia. Padrão do
      // Baku 2026 (2 categorias/dia, da mais leve à mais pesada), fecho ~09:00 de Astana
      // (UTC+5 = 04:00Z). A AFINAR quando sair o horário oficial por categoria.
      fecho: {
        "-60": "2027-06-07T04:00:00Z", "-48": "2027-06-07T04:00:00Z",
        "-66": "2027-06-08T04:00:00Z", "-52": "2027-06-08T04:00:00Z",
        "-73": "2027-06-09T04:00:00Z", "-57": "2027-06-09T04:00:00Z",
        "-81": "2027-06-10T04:00:00Z", "-63": "2027-06-10T04:00:00Z",
        "-90": "2027-06-11T04:00:00Z", "-70": "2027-06-11T04:00:00Z",
        "-100": "2027-06-12T04:00:00Z", "-78": "2027-06-12T04:00:00Z",
        "+100": "2027-06-13T04:00:00Z", "+78": "2027-06-13T04:00:00Z",
      },
      fim: "2027-06-14T00:00:00Z",
    } },
  { semana: 25, idCompeticao: "3382", nome: "Ulaanbaatar Grand Slam 2027", nivel: "Grand Slam", de: "2027/06/25", classico: false },
  { semana: 26, idCompeticao: "3383", nome: "Qingdao Grand Prix 2027", nivel: "Grand Prix", de: "2027/07/02", classico: false },
  { semana: 27, idCompeticao: "2649", nome: "Grand Slam 2024 — Clássico", nomeCompleto: "Antalya Grand Slam 2024 — Clássico", nivel: "Grand Slam", de: "2027/07/10", classico: true, anoOriginal: 2024 },
  { semana: 28, idCompeticao: "2648", nome: "Grand Slam 2024 — Clássico", nomeCompleto: "Tbilisi Grand Slam 2024 — Clássico", nivel: "Grand Slam", de: "2027/07/17", classico: true, anoOriginal: 2024 },
  { semana: 29, idCompeticao: "2658", nome: "Grand Slam 2024 — Clássico", nomeCompleto: "Baku Grand Slam 2024 — Clássico", nivel: "Grand Slam", de: "2027/07/24", classico: true, anoOriginal: 2024 },
  { semana: 30, idCompeticao: "2656", nome: "Grand Prix 2024 — Clássico", nomeCompleto: "Zagreb Grand Prix 2024 — Clássico", nivel: "Grand Prix", de: "2027/07/31", classico: true, anoOriginal: 2024 },
  { semana: 31, idCompeticao: "2647", nome: "Grand Prix 2024 — Clássico", nomeCompleto: "Grand Prix Upper Austria 2024 — Clássico", nivel: "Grand Prix", de: "2027/08/07", classico: true, anoOriginal: 2024 },
  { semana: 32, idCompeticao: "2643", nome: "Grand Prix 2024 — Clássico", nomeCompleto: "Grand Prix Portugal 2024 — Clássico", nivel: "Grand Prix", de: "2027/08/14", classico: true, anoOriginal: 2024 },
  { semana: 33, idCompeticao: "2453", nome: "Grand Slam 2023 — Clássico", nomeCompleto: "Abu Dhabi Grand Slam 2023 — Clássico", nivel: "Grand Slam", de: "2027/08/21", classico: true, anoOriginal: 2023 },
  { semana: 34, idCompeticao: "3384", nome: "Lausanne Grand Slam 2027", nivel: "Grand Slam", de: "2027/08/27", classico: false },
  { semana: 35, idCompeticao: "2445", nome: "Grand Slam 2023 — Clássico", nomeCompleto: "Ulaanbaatar Grand Slam 2023 — Clássico", nivel: "Grand Slam", de: "2027/09/04", classico: true, anoOriginal: 2023 },
  { semana: 36, idCompeticao: "2615", nome: "Grand Slam 2023 — Clássico", nomeCompleto: "Qazaqstan Barysy Grand Slam 2023 — Clássico", nivel: "Grand Slam", de: "2027/09/11", classico: true, anoOriginal: 2023 },
  { semana: 37, idCompeticao: "3386", nome: "Lima Grand Prix 2027", nivel: "Grand Prix", de: "2027/09/17", classico: false },
  { semana: 38, idCompeticao: "2461", nome: "Grand Slam 2023 — Clássico", nomeCompleto: "Tashkent Grand Slam 2023 — Clássico", nivel: "Grand Slam", de: "2027/09/25", classico: true, anoOriginal: 2023 },
  { semana: 39, idCompeticao: "3385", nome: "Hungary Grand Slam 2027", nivel: "Grand Slam", de: "2027/10/01", classico: false },
  { semana: 40, idCompeticao: "2439", nome: "Grand Slam 2023 — Clássico", nomeCompleto: "Tel Aviv Grand Slam 2023 — Clássico", nivel: "Grand Slam", de: "2027/10/09", classico: true, anoOriginal: 2023 },
  { semana: 41, idCompeticao: "2466", nome: "Grand Prix 2023 — Clássico", nomeCompleto: "Zagreb Grand Prix 2023 — Clássico", nivel: "Grand Prix", de: "2027/10/16", classico: true, anoOriginal: 2023 },
  { semana: 42, idCompeticao: "3387", nome: "Abu Dhabi Grand Slam 2027", nivel: "Grand Slam", de: "2027/10/22", classico: false },
  { semana: 43, idCompeticao: "2512", nome: "Grand Prix 2023 — Clássico", nomeCompleto: "Dushanbe Grand Prix 2023 — Clássico", nivel: "Grand Prix", de: "2027/10/30", classico: true, anoOriginal: 2023 },
  { semana: 44, idCompeticao: "2564", nome: "Grand Prix 2023 — Clássico", nomeCompleto: "Grand Prix Upper Austria 2023 — Clássico", nivel: "Grand Prix", de: "2027/11/06", classico: true, anoOriginal: 2023 },
  { semana: 45, idCompeticao: "3388", nome: "Zagreb Grand Prix 2027", nivel: "Grand Prix", de: "2027/11/12", classico: false },
  { semana: 46, idCompeticao: "2437", nome: "Grand Prix 2023 — Clássico", nomeCompleto: "Grand Prix Portugal 2023 — Clássico", nivel: "Grand Prix", de: "2027/11/20", classico: true, anoOriginal: 2023 },
  { semana: 47, idCompeticao: "2315", nome: "Grand Slam 2022 — Clássico", nomeCompleto: "Tokyo Grand Slam 2022 — Clássico", nivel: "Grand Slam", de: "2027/11/27", classico: true, anoOriginal: 2022 },
  { semana: 48, idCompeticao: "3389", nome: "Tokyo Grand Slam 2027", nivel: "Grand Slam", de: "2027/12/04", classico: false },
  { semana: 49, idCompeticao: "2311", nome: "Grand Slam 2022 — Clássico", nomeCompleto: "Baku Grand Slam 2022 — Clássico", nivel: "Grand Slam", de: "2027/12/11", classico: true, anoOriginal: 2022 },
  { semana: 50, idCompeticao: "2309", nome: "Grand Slam 2022 — Clássico", nomeCompleto: "Abu Dhabi Grand Slam 2022 — Clássico", nivel: "Grand Slam", de: "2027/12/18", classico: true, anoOriginal: 2022 },
  { semana: 51, idCompeticao: "2296", nome: "Grand Slam 2022 — Clássico", nomeCompleto: "Grand Slam Hungary 2022 — Clássico", nivel: "Grand Slam", de: "2027/12/25", classico: true, anoOriginal: 2022 },
  { semana: 52, idCompeticao: "2364", nome: "Grand Slam 2022 — Clássico", nomeCompleto: "Ulaanbaatar Grand Slam 2022 — Clássico", nivel: "Grand Slam", de: "2027/12/31", classico: true, anoOriginal: 2022 },
];

// UNIÃO DE TODOS OS ANOS — usada nas buscas por ID (nome, nº da rodada, fuso,
// pontos visíveis, rolling). Assim uma competição de qualquer ano é encontrada.
export const CALENDARIO_TODAS: SemanaCalendario[] = [...CALENDARIO_2026, ...CALENDARIO_2027];

/**
 * A lista do ANO pedido. 2026 e 2027 têm calendário próprio; anos posteriores
 * reutilizam o de 2027 até alguém montar o seu (tal como antes de 2027 existir).
 */
export function calendarioDoAno(ano: number): SemanaCalendario[] {
  return ano <= 2026 ? CALENDARIO_2026 : CALENDARIO_2027;
}

/** Devolve a semana ISO (1..53) de uma data. */
export function semanaISO(d: Date): number {
  const data = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dia = data.getUTCDay() || 7;
  data.setUTCDate(data.getUTCDate() + 4 - dia);
  const inicioAno = new Date(Date.UTC(data.getUTCFullYear(), 0, 1));
  return Math.ceil((((data.getTime() - inicioAno.getTime()) / 86400000) + 1) / 7);
}

/** A competição da semana atual; se já passou, a próxima a contar. CONSCIENTE DO
 *  ANO: usa o calendário do ano de `hoje`; na última semana do ano salta para a
 *  1ª do ano seguinte, para uma liga/mata-mata não parar na viragem do ano. */
export function competicaoDaSemana(hoje: Date = new Date()): SemanaCalendario {
  const wk = semanaISO(hoje);
  const ano = hoje.getFullYear();
  const ordenado = [...calendarioDoAno(ano)].sort((a, b) => a.semana - b.semana);
  // a competição desta semana, ou a primeira semana à frente que exista
  const atualOuProxima = ordenado.find((s) => s.semana >= wk);
  if (atualOuProxima) return atualOuProxima;
  // já passou a última semana deste ano -> a 1ª competição do ano seguinte.
  const proxAno = [...calendarioDoAno(ano + 1)].sort((a, b) => a.semana - b.semana);
  return proxAno[0] || ordenado[ordenado.length - 1];
}

/** A competição seguinte a uma dada (a próxima no tempo). Ordena por data (`de`),
 *  por isso ATRAVESSA O ANO: a seguir à última de 2026 vem a 1ª de 2027. */
export function proximaDepoisDe(atual: SemanaCalendario): SemanaCalendario {
  const ordenado = [...CALENDARIO_TODAS].sort((a, b) => a.de.localeCompare(b.de));
  const i = ordenado.findIndex((s) => s.idCompeticao === atual.idCompeticao && s.de === atual.de);
  if (i >= 0 && ordenado[i + 1]) return ordenado[i + 1];
  return ordenado[0]; // se for a última de tudo, volta ao início
}

/** Lista das competições reais (não-clássicas) de TODOS os anos, ordenada por
 *  data. Quem precisa de um ano específico filtra por `de` (ex.: a liga oficial
 *  anual). Inclui 2026 e 2027. */
export function competicoesReais(): SemanaCalendario[] {
  return [...CALENDARIO_TODAS].filter((s) => !s.classico).sort((a, b) => a.de.localeCompare(b.de));
}

// NÚMERO DA RODADA — cada competição do ano é uma rodada numerada, do início de
// janeiro ao fim de dezembro. Como há uma competição por semana, o número da
// rodada é o número da semana (1..52). Conta TODAS as competições, clássicos
// incluídos. Devolve null se o id não estiver no calendário.
export function numeroDaRodada(idCompeticao: string): number | null {
  const s = CALENDARIO_TODAS.find((c) => c.idCompeticao === String(idCompeticao));
  return s ? s.semana : null;
}

// Texto pronto para mostrar: "Rodada 6" (ou "" se não houver número).
export function rotuloRodada(idCompeticao: string): string {
  const n = numeroDaRodada(idCompeticao);
  return n ? `Rodada ${n}` : "";
}

// ---------------------------------------------------------------------------
// LOCALIZAÇÃO DOS TEXTOS DO CALENDÁRIO (nível + nome da competição).
//
// Os nomes das competições vêm da IJF e são quase todos em inglês por convenção
// (Grand Slam, Grand Prix, Open, Masters) — mantêm-se iguais em todas as línguas.
// Só se traduzem as partes DESCRITIVAS em português: o nível "Mundial", o nome
// "Mundial de Baku", o sufixo "— Clássico" e "(Individuais)".
//
// Recebem o tradutor `t` (de useT, no cliente) para não importar o i18n aqui.
// ---------------------------------------------------------------------------

/** Nível da competição traduzido (só o que não é nome próprio internacional). */
export function rotuloNivel(nivel: string, t: (k: string) => string): string {
  if (nivel === "Mundial") return t("nivel.mundial");
  if (nivel === "Continental" || nivel === "Continental fraco") return t("nivel.continental");
  return nivel; // Grand Slam, Grand Prix, Open, Masters, European Open/Cup: universais
}

/** Nome da competição com as partes em português traduzidas. */
export function localizarNomeCompeticao(nome: string, t: (k: string) => string): string {
  let s = nome;
  if (s.includes("Mundial de Baku")) s = s.replace("Mundial de Baku", t("comp.mundialBaku"));
  s = s.replace(/\(Individuais\)/g, t("comp.individuais"));
  s = s.replace(/—\s*Clássico/g, "— " + t("comp.classicoSufixo"));
  return s;
}

// ---------------------------------------------------------------------------
// FECHO DE MERCADO + CONTAGEM (Live Round, passos 1a + 1b)
// ---------------------------------------------------------------------------

// O mercado fecha 1 HORA antes do início oficial da competição.
export const FECHO_ANTES_MS = 60 * 60 * 1000;

export interface EstadoMercado {
  estado: "aberto" | "fechado"; // aberto = pode montar/editar; fechado = trancado
  temHora: boolean;             // true se a competição tem hora oficial (inicioUTC)
  inicio: Date | null;          // instante de início oficial (se houver hora)
  fecho: Date | null;           // instante de fecho do mercado = início - 1h (se houver hora)
  msAteFecho: number | null;    // ms até ao fecho (>0 aberto); null se só houver data
}

/**
 * Estado do mercado de uma competição num dado instante.
 * - Com hora oficial (inicioUTC): fecho = início - 1h, ao minuto.
 * - Sem hora oficial: cai no comportamento por data (aberto até ao dia do início).
 */
// ---------------------------------------------------------------------------
// HORÁRIOS MANUAIS (override) — postos pelo responsável e guardados na base
// (competicao_horarios). A app (components/CarregarHorarios) e o servidor
// (lib/horarios) injetam-nos aqui UMA vez; a partir daí toda a lógica de mercado
// os usa. Passam à frente do `inicioUTC` do calendário e da estimativa por fuso.
// ---------------------------------------------------------------------------
const OVERRIDES: Record<string, string> = {};

/** Injeta/atualiza horários manuais. iso vazio/null remove o override. */
export function aplicarHorarios(map: Record<string, string | null | undefined>): void {
  for (const [id, iso] of Object.entries(map || {})) {
    if (iso) OVERRIDES[String(id)] = String(iso);
    else delete OVERRIDES[String(id)];
  }
}

/** O início efetivo (override manual, senão o do calendário). undefined se nenhum. */
export function horarioEfetivo(idCompeticao: string): string | undefined {
  const s = CALENDARIO_TODAS.find((c) => c.idCompeticao === String(idCompeticao));
  return OVERRIDES[String(idCompeticao)] || s?.inicioUTC;
}

// Melhor estimativa do INÍCIO oficial (em UTC), por ordem de confiança:
//   1) `inicioUTC` confirmado (preciso);
//   2) 9h LOCAIS do dia `de`, no fuso da cidade (FUSO_POR_CIDADE) — a política
//      acordada quando não há horário: "começa às 9h locais";
//   3) meia-noite UTC do dia `de` (último recurso, cidade desconhecida).
// É a MESMA verdade usada pelo fecho do mercado E pela regra das 60h.
function inicioEstimado(s: SemanaCalendario): { inicio: Date; preciso: boolean } {
  const manual = OVERRIDES[s.idCompeticao] || s.inicioUTC;
  if (manual) return { inicio: new Date(manual), preciso: true };
  const [ano, mes, dia] = s.de.split("/").map((x) => parseInt(x, 10));
  const fuso = FUSO_POR_CIDADE[chaveCidade(s.nome)];
  if (fuso !== undefined) return { inicio: new Date(Date.UTC(ano, mes - 1, dia, 9 - fuso, 0, 0)), preciso: false };
  return { inicio: new Date(Date.UTC(ano, mes - 1, dia, 0, 0, 0)), preciso: false };
}

export function estadoMercado(s: SemanaCalendario, agora: Date = new Date()): EstadoMercado {
  // MODO ROLLING: o mercado do evento inteiro fica "aberto" até ao `fim` — o
  // fecho real é POR CATEGORIA (ver categoriaTrancada / o ecrã do mercado). Sem
  // isto, a competição de vários dias ficaria "fechada" logo no 1º dia.
  if (s.rolling) {
    const fim = new Date(s.rolling.fim);
    const msAteFecho = fim.getTime() - agora.getTime();
    const { inicio } = inicioEstimado(s);
    return { estado: msAteFecho > 0 ? "aberto" : "fechado", temHora: true, inicio, fecho: fim, msAteFecho };
  }
  // Fecho = 1h antes do INÍCIO ESTIMADO. Antes, sem `inicioUTC`, fechava à
  // meia-noite UTC do dia `de` — ignorava o fuso e podia fechar o mercado muitas
  // horas antes do início real (ex.: Lima, UTC-5, fechava de madrugada quando a
  // competição só começava à tarde em UTC). Agora usa o fuso da cidade.
  const { inicio, preciso } = inicioEstimado(s);
  const fecho = new Date(inicio.getTime() - FECHO_ANTES_MS);
  const msAteFecho = fecho.getTime() - agora.getTime();
  return {
    estado: msAteFecho > 0 ? "aberto" : "fechado",
    temHora: preciso,
    inicio,
    fecho,
    msAteFecho,
  };
}

/** Formata uma duração em ms como "5d 3h", "3h 20min" ou "12min". */
export function formatarContagem(ms: number): string {
  if (ms <= 0) return "fechado";
  const totalMin = Math.floor(ms / 60000);
  const dias = Math.floor(totalMin / (60 * 24));
  const horas = Math.floor((totalMin % (60 * 24)) / 60);
  const min = totalMin % 60;
  if (dias > 0) return `${dias}d ${horas}h`;
  if (horas > 0) return `${horas}h ${min}min`;
  return `${min}min`;
}

// ---------------------------------------------------------------------------
// FOCO DO MERCADO — a regra única usada por todas as telas.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// MODO ROLLING — funções de apoio.
// ---------------------------------------------------------------------------

/** Está `agora` dentro da janela de um evento rolling? (do dia de início ao fim). */
function dentroJanelaRolling(s: SemanaCalendario, agora: Date): boolean {
  if (!s.rolling) return false;
  const { inicio } = inicioEstimado(s);      // ~meia-noite do dia `de`
  const fim = Date.parse(s.rolling.fim);
  return agora.getTime() >= inicio.getTime() && agora.getTime() < fim;
}

/** O evento rolling ATIVO neste instante (o Mundial durante a sua semana), se houver. */
export function competicaoRollingAtiva(agora: Date = new Date()): SemanaCalendario | null {
  return CALENDARIO_TODAS.find((s) => dentroJanelaRolling(s, agora)) || null;
}

/**
 * Numa competição rolling, esta CATEGORIA já trancou? (o seu dia já começou).
 * Numa competição normal, nunca tranca por categoria (devolve false).
 */
export function categoriaTrancada(s: SemanaCalendario, categoria: string, agora: Date = new Date()): boolean {
  if (!s.rolling) return false;
  const iso = s.rolling.fecho[categoria];
  if (!iso) return false;                     // categoria sem fecho definido: livre
  return agora.getTime() >= Date.parse(iso);
}

/** O próximo instante (ms) em que uma categoria tranca; null se já trancaram todas. */
function proximoFechoRolling(s: SemanaCalendario, agora: Date): number | null {
  if (!s.rolling) return null;
  let prox: number | null = null;
  for (const iso of Object.values(s.rolling.fecho)) {
    const t = Date.parse(iso);
    if (t > agora.getTime() && (prox === null || t < prox)) prox = t;
  }
  return prox;
}

export interface FocoMercado {
  atual: SemanaCalendario;             // competição da semana
  alvo: SemanaCalendario;              // competição de mercado ABERTO (onde se monta)
  aDecorrer: SemanaCalendario | null;  // competição a decorrer (mercado fechado), se houver
  estadoAtual: EstadoMercado;          // estado do mercado da "atual"
  estadoAlvo: EstadoMercado;           // estado do mercado da "alvo" (p/ contagem)
}

/**
 * Decide, num dado instante, qual a competição de mercado aberto (alvo) e qual
 * está a decorrer (aDecorrer). Regra: se o mercado da competição da semana já
 * fechou (início - 1h), escala-se para a próxima.
 */
export function focoMercado(agora: Date = new Date()): FocoMercado {
  // MODO ROLLING primeiro: um evento de vários dias (Mundial) atravessa duas
  // semanas ISO. Durante a sua janela é SEMPRE o foco e o alvo (onde se monta),
  // mesmo que a semana ISO já tenha avançado. Nunca fica "a decorrer" no sentido
  // de bloquear o ecrã — o mercado continua aberto e tranca por categoria.
  const rolling = competicaoRollingAtiva(agora);
  if (rolling) {
    const est = estadoMercado(rolling, agora);
    // FASE FINAL DO ROLLING (Kainan, 10/10/2026): enquanto AINDA há categorias por
    // trancar, o alvo é o próprio evento — monta-se nele e cada categoria tranca no
    // seu instante. Mas no ÚLTIMO dia, quando a última categoria já trancou (ex.: o
    // peso pesado do Mundial), já NÃO dá para montar nada neste evento: quem chega
    // novo ficava sem conseguir montar equipa nenhuma. Nesse caso o mercado de
    // MONTAGEM passa para a próxima competição (o clássico, mercado aberto), mas o
    // evento continua A DECORRER (a ser pontuado e visto no "meu time") até ao fim.
    //   • alvo      -> próxima competição (onde se monta agora)
    //   • aDecorrer -> o evento rolling (ainda a jogar-se)
    // Nota: com aDecorrer preenchido, o notificarMercado NÃO anuncia "mercado
    // aberto" da seguinte (é guardado por !aDecorrer) — logo não há blast.
    const aindaAbre = proximoFechoRolling(rolling, agora) !== null;
    if (aindaAbre) {
      return { atual: rolling, alvo: rolling, aDecorrer: null, estadoAtual: est, estadoAlvo: est };
    }
    const alvoProx = proximaDepoisDe(rolling);
    return { atual: rolling, alvo: alvoProx, aDecorrer: rolling, estadoAtual: est, estadoAlvo: estadoMercado(alvoProx, agora) };
  }
  const atual = competicaoDaSemana(agora);
  const estadoAtual = estadoMercado(atual, agora);
  const fechado = estadoAtual.estado === "fechado";
  // A competição da semana já TERMINOU (passaram as 60h do início)? Se sim, deixa
  // de estar "a decorrer" e o foco avança para a próxima — mesmo dentro da mesma
  // semana. Sem isto, uma competição ficava presa em "a decorrer" o resto da
  // semana (mercado fechado mas a seguinte ainda não tinha começado), o que
  // impedia o congelamento de a apanhar (o caso do clássico de Osaka).
  const terminada = competicaoFechada(atual, agora);
  const alvo = (fechado || terminada) ? proximaDepoisDe(atual) : atual;
  // "A decorrer" só enquanto o mercado fechou E ainda não passaram as 60h.
  const aDecorrer = (fechado && !terminada) ? atual : null;
  const estadoAlvo = estadoMercado(alvo, agora);
  return { atual, alvo, aDecorrer, estadoAtual, estadoAlvo };
}

/**
 * Texto pronto para mostrar o prazo do mercado de uma competição.
 * Usa a hora real (ao minuto) se houver `inicioUTC`; senão, conta por dias.
 */
type Tradutor = (chave: string, vars?: Record<string, string | number>) => string;
// textoFecho aceita um tradutor OPCIONAL: quem tem useT (ex.: /inicio) passa o
// `t` e o texto sai na língua do utilizador; sem ele, mantém o PT (fallback para
// chamadas ainda por migrar). Chaves em lib/i18n (cal.*).
export function textoFecho(s: SemanaCalendario, t?: Tradutor, agora: Date = new Date()): string {
  // MODO ROLLING: o mercado do evento fica aberto a semana toda, por isso mostrar
  // "fecha em 12d" (o fim do evento) engana. Mostra-se a PRÓXIMA categoria a fechar.
  if (s.rolling) {
    const prox = proximoFechoRolling(s, agora);
    if (prox != null) {
      const tempo = formatarContagem(prox - agora.getTime());
      return t ? t("cal.rollingContagem", { t: tempo }) : `Fecha por categoria · próxima em ${tempo}`;
    }
    return t ? t("cal.rollingADecorrer") : "Mundial a decorrer";
  }
  const e = estadoMercado(s, agora);
  if (e.estado === "fechado") return t ? t("cal.mercadoFechado") : "Mercado fechado";
  if (e.temHora && e.msAteFecho !== null) return t ? t("cal.fechaEm", { t: formatarContagem(e.msAteFecho) }) : `Mercado fecha em ${formatarContagem(e.msAteFecho)}`;
  // Sem hora confirmada: conta os dias até ao fecho estimado (1h antes do início local).
  const alvo = e.fecho ? e.fecho.getTime() : agora.getTime();
  const dias = Math.max(0, Math.ceil((alvo - agora.getTime()) / 86400000));
  if (dias <= 1) return t ? t("cal.fecha1Dia") : "Mercado fecha em 1 dia";
  return t ? t("cal.fechaNDias", { n: dias }) : `Mercado fecha em ${dias} dias`;
}

// ===========================================================================
// COMPETIÇÃO TERMINADA — regra das 60 HORAS (para a Copa, e no futuro ranking
// e valorização). Uma competição de judô dura tipicamente 1-2 dias; algumas
// dividem-se em dois dias (dia 1 pesos leves, dia 2 o resto). Por isso NÃO
// podemos considerar "terminada" só porque já houve lutas (o dia 1 pode ter
// acabado mas o dia 2 ainda vem). Regra robusta: a competição só se considera
// terminada 60 HORAS após o seu início — cobre com folga os 2 dias e absorve
// erros de fuso/horário de verão (temos ~12h de margem sobre as ~48h reais).
//
// Início usado:
//   1) Se a competição tem `inicioUTC` (hora oficial confirmada) → usa-o. Preciso.
//   2) Senão → assume que começa às 9h LOCAIS do dia `de`, no fuso da cidade
//      (derivado do nome). É a política acordada: "se não houver horário, a
//      competição começa às 9h do horário local".
//   3) Se a cidade não estiver na tabela de fusos → fallback seguro: conta a
//      partir da meia-noite UTC do dia `de` e usa 72h (margem extra), para
//      NUNCA fechar cedo demais. (Sinal de que falta confirmar o inicioUTC.)
// ===========================================================================

export const HORAS_ATE_FECHO_COPA = 60;

// Fuso horário (offset base em horas vs UTC) das cidades do CALENDARIO_2026.
// Offsets-BASE (sem horário de verão): a margem de 60h absorve a diferença de
// DST, por isso não precisamos de precisão ao minuto aqui. A chave é a 1ª
// palavra do nome da competição (a cidade). Confirmados por pesquisa.
//
// NOTA sobre clássicos: a maioria começa por "Grand" (Grand Slam/Prix X), pelo
// que cai na chave "Grand" (+1). Como são competições revividas sem lutas reais
// ao vivo, o fuso exato é irrelevante — a margem de 60h cobre qualquer desvio.
const FUSO_POR_CIDADE: Record<string, number> = {
  // Américas
  Lima: -5,
  Montreal: -5,
  San: -6,        // "San Salvador"
  // Europa / África do Norte (offsets base; no verão a Europa fica +1, coberto pela margem)
  Casablanca: 1,
  Sofia: 2,
  Paris: 1,
  Ljubljana: 1,
  Warsaw: 1,
  Dubrovnik: 1,
  Sarajevo: 1,
  Tallinn: 2,
  Lausanne: 1,
  Hungary: 1,     // Budapeste
  Skopje: 1,
  Malaga: 1,
  Rome: 1,
  Zagreb: 1,
  Grand: 1,       // "Grand Prix/Slam ..." (clássicos e Upper Austria) — Europa Central, +1
  La: 1,          // "La Nucia/Benidorm" — Espanha, +1
  Campeonato: 1,  // "Campeonato Europeu/Africano" — assume Europa Central; confirmar inicioUTC
  // Médio Oriente / Cáucaso / Ásia Central
  Tbilisi: 4,
  Abu: 4,         // "Abu Dhabi"
  Baku: 4,
  Tashkent: 5,
  Dushanbe: 5,
  Qazaqstan: 6,   // Astana / Cazaquistão
  // Ásia Oriental
  Ulaanbaatar: 8,
  Qingdao: 8,
  Taipei: 8,
  Kowloon: 8,     // Hong Kong
  Tokyo: 9,
  Guangzhou: 8,   // clássico Masters 2018
  // África subsariana
  Algiers: 1,
  Dar: 3,         // "Dar Es Salaam"
  // Oceania
  Tahiti: -10,
};

/** Extrai a chave de cidade (1ª palavra do nome) para procurar o fuso. */
function chaveCidade(nome: string): string {
  return (nome || "").trim().split(/\s+/)[0] || "";
}

/**
 * A competição já se considera TERMINADA neste instante?
 * Regra das 60h a partir do início (ver explicação acima).
 */
export function competicaoFechada(s: SemanaCalendario, agora: Date = new Date()): boolean {
  // MODO ROLLING: um evento de vários dias só termina no seu `fim` (após o
  // último dia). A regra das 60h a partir do início daria o Mundial como
  // terminado a meio (ex.: 6/10), congelando cedo demais.
  if (s.rolling) return agora.getTime() >= Date.parse(s.rolling.fim);
  // Início estimado + 60h. Uma competição de judô dura 1-2 dias; 60h cobre com
  // folga e absorve desvios de fuso/horário de verão. Usa a MESMA estimativa do
  // fecho do mercado (inicioEstimado), para haver uma só verdade sobre o início.
  const { inicio } = inicioEstimado(s);
  const fim = inicio.getTime() + HORAS_ATE_FECHO_COPA * 3600 * 1000;
  return agora.getTime() >= fim;
}

// ===========================================================================
// NOME A MOSTRAR — esconde a CIDADE dos clássicos até à hora certa.
//
// PORQUÊ: um clássico é uma competição antiga revivida. Se o utilizador vir
// "Grand Prix The Hague 2018" antes de escalar, vai ao JudoBase buscar os
// resultados reais e monta a equipa perfeita. O jogo morre.
//
// REGRA (decidida com o Kainan): a cidade só aparece quando já não há nada a
// ganhar em procurá-la —
//   (a) a competição JÁ TERMINOU (regra das 60h), ou
//   (b) é a que está a decorrer e o MERCADO JÁ FECHOU.
// Nos clássicos FUTUROS e no atual com mercado ainda aberto, a cidade esconde-se.
//
// COMO: nada de recortar a cidade da string — seria frágil ("The Hague" e
// "Tel Aviv" têm duas palavras, e "Guangzhou Masters" tem a cidade à frente do
// tipo). O nome escondido é MONTADO a partir dos campos estruturados que já
// temos: `nivel` + `anoOriginal`. Zero parsing, zero surpresas.
//
//   "Grand Prix The Hague 2018 — Clássico"  ->  "Grand Prix 2018 — Clássico"
//   "Guangzhou Masters 2018 — Clássico"     ->  "Masters 2018 — Clássico"
//
// As competições REAIS (classico:false) nunca são tocadas: o calendário da IJF
// é público, não há nada a esconder.
//
// USAR ISTO EM TODO O LADO onde se mostra o nome de uma competição ao
// utilizador (montar equipa, mercado, ligas oficiais, início, calendário).
// Mostrar `s.nome` cru revela a cidade.
// ===========================================================================

/**
 * Nome a MOSTRAR de uma competição.
 *
 * Devolve o nome COMPLETO (com cidade) só quando já não há nada a ganhar em
 * procurá-la: a competição terminou, ou é a que decorre e o mercado já fechou.
 * Caso contrário devolve `s.nome`, que já vem sem cidade.
 *
 * Repare na inversão face ao que isto era antes: agora esta função ACRESCENTA
 * informação em vez de a esconder. Quem se esquecer de a chamar fica com o nome
 * curto — inofensivo. Antes, quem se esquecesse revelava a cidade.
 */
export function nomeCompeticao(s: SemanaCalendario, agora: Date = new Date()): string {
  if (!s.classico) return s.nome;                 // competição real: nada a esconder
  if (!s.nomeCompleto) return s.nome;             // sem versão longa: fica o curto
  const terminada = competicaoFechada(s, agora);                       // (a) já acabou
  const mercadoFechado = estadoMercado(s, agora).estado === "fechado";  // (b) mercado fechado
  return (terminada || mercadoFechado) ? s.nomeCompleto : s.nome;
}

/** O mesmo, mas a partir do id da competição. "" se o id não estiver no calendário. */
export function nomeCompeticaoPorId(idCompeticao: string, agora: Date = new Date()): string {
  const s = CALENDARIO_TODAS.find((c) => c.idCompeticao === String(idCompeticao));
  return s ? nomeCompeticao(s, agora) : "";
}

/** A cidade desta competição ainda está escondida? (para avisos na interface) */
export function cidadeEscondida(s: SemanaCalendario, agora: Date = new Date()): boolean {
  if (!s.classico || !s.nomeCompleto) return false;
  return nomeCompeticao(s, agora) === s.nome;
}

/**
 * Os RESULTADOS desta competição já podem ser mostrados ao utilizador?
 *
 * PORTÃO ANTI-ESPREITADELA. Só depois de o mercado FECHAR. É crítico nos
 * clássicos: as lutas de 2018 já existem todas no JudoBase, por isso a API
 * devolve pontos mesmo antes da rodada "começar" no jogo. Sem este portão,
 * bastava escalar um atleta, tocar nele e ver quanto fez — e trocar se fosse
 * mau. O jogo deixava de ter mérito.
 *
 * A mesma regra do /api/equipa-na-rodada (que devolve `bloqueado`) e do
 * podeVerEquipa da chave da Copa. Aqui fica a versão partilhada.
 */
export function pontosVisiveis(s: SemanaCalendario, agora: Date = new Date()): boolean {
  // MODO ROLLING: os pontos são visíveis AO VIVO durante o evento. Não há
  // espreitadela a explorar, porque cada categoria tranca no INÍCIO do seu dia
  // (antes de ter lutas) — quem já tem o atleta não o pode trocar depois de ver.
  if (s.rolling) return true;
  return estadoMercado(s, agora).estado === "fechado";
}

/** O mesmo, pelo id da competição. Desconhecida => false (fecha por omissão). */
export function pontosVisiveisPorId(idCompeticao: string, agora: Date = new Date()): boolean {
  const s = CALENDARIO_TODAS.find((c) => c.idCompeticao === String(idCompeticao));
  return s ? pontosVisiveis(s, agora) : false;
}

/**
 * O fuso horário (offset base vs UTC) da cidade de uma competição, deduzido do
 * nome (mesma tabela da regra das 60h). null se a cidade não estiver na tabela.
 * Serve o editor de horários: a cidade -> fuso é automática.
 */
export function fusoDaCompeticao(idCompeticao: string): number | null {
  const s = CALENDARIO_TODAS.find((c) => c.idCompeticao === String(idCompeticao));
  if (!s) return null;
  const f = FUSO_POR_CIDADE[chaveCidade(s.nome)];
  return f === undefined ? null : f;
}
