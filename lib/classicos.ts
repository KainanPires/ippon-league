// lib/classicos.ts
//
// BANCO DE CLÁSSICOS — Ippon League
// ==================================
// Pool curado de competições ANTIGAS do JudoBase (2015–2025), todas seniores,
// individuais e COM resultados, descobertas via /api/diag (rota de diagnóstico).
// Servem para preencher as semanas do calendário que não têm competição real
// nesse ano (as "rodadas clássicas").
//
// COMO FUNCIONA (regra do Kainan):
//  - Cada ano, as semanas sem competição real são preenchidas com clássicos
//    DESTE banco que ainda NÃO foram usados (usadoEm vazio).
//  - Ao usar um clássico num ano, marca-se `usadoEm: <ano>` — deixa de poder
//    repetir-se nos anos seguintes.
//  - Quando TODOS estiverem usados (banco esgotado), recomeça-se do zero:
//    limpam-se os `usadoEm` e o pool volta a ficar todo disponível.
//  - Preferência de escolha: Grand Slam / Grand Prix > Mundial > Masters >
//    Olimpíada (prioridade 1..4). Misturar recentes e antigas para o jogo
//    ser menos previsível.
//
// São 140 competições — dá para muitos anos antes de reciclar.
//
// NOTA: o calendário (lib/calendario.ts) continua a ser montado à mão a cada
// ano (as competições reais mudam e só a IJF as publica). Este banco existe
// para NÃO termos de refazer a investigação dos clássicos — é a "memória".

export type TipoClassico = "Grand Slam" | "Grand Prix" | "Mundial" | "Masters" | "Olimpiada";

export interface BancoClassico {
  id: string;            // id_competition no JudoBase
  nome: string;          // nome original (limpo) do JudoBase
  tipo: TipoClassico;
  ano: number;           // ano REAL da competição
  prioridade: number;    // 1 GS/GP, 2 Mundial, 3 Masters, 4 Olimpíada
  usadoEm?: number;      // ano da Ippon League em que foi usada (vazio = disponível)
}

// Prioridade por tipo (preferência de escolha).
const P: Record<TipoClassico, number> = {
  "Grand Slam": 1, "Grand Prix": 1, "Mundial": 2, "Masters": 3, "Olimpiada": 4,
};

// Atalho para escrever as entradas de forma compacta.
function c(id: string, nome: string, tipo: TipoClassico, ano: number, usadoEm?: number): BancoClassico {
  return { id, nome, tipo, ano, prioridade: P[tipo], usadoEm };
}

// ===========================================================================
// O BANCO. Os 14 marcados `2026` são os que entram no CALENDARIO_2026 (esta é
// a 1ª época). Os restantes ficam disponíveis para 2027, 2028, ...
// ===========================================================================
export const BANCO_CLASSICOS: BancoClassico[] = [
  // ---- Grand Slam ----
  c("2883", "Abu Dhabi Grand Slam 2025", "Grand Slam", 2025),
  c("2879", "Ulaanbaatar Grand Slam 2025", "Grand Slam", 2025),
  c("2876", "Qazaqstan Barysy Grand Slam 2025", "Grand Slam", 2025),
  c("2873", "Dushanbe Grand Slam 2025", "Grand Slam", 2025),
  c("2874", "Tbilisi Grand Slam 2025", "Grand Slam", 2025),
  c("2871", "Tashkent Grand Slam 2025", "Grand Slam", 2025),
  c("2870", "Baku Grand Slam 2025", "Grand Slam", 2025),
  c("2857", "Tokyo Grand Slam 2024", "Grand Slam", 2024),
  c("2657", "Abu Dhabi Grand Slam 2024", "Grand Slam", 2024),
  c("2651", "Qazaqstan Barysy Grand Slam 2024", "Grand Slam", 2024),
  c("2650", "Dushanbe Grand Slam 2024", "Grand Slam", 2024),
  c("2649", "Antalya Grand Slam 2024", "Grand Slam", 2024),
  c("2648", "Tbilisi Grand Slam 2024", "Grand Slam", 2024),
  c("2658", "Baku Grand Slam 2024", "Grand Slam", 2024),
  c("2453", "Abu Dhabi Grand Slam 2023", "Grand Slam", 2023),
  c("2445", "Ulaanbaatar Grand Slam 2023", "Grand Slam", 2023),
  c("2615", "Qazaqstan Barysy Grand Slam 2023", "Grand Slam", 2023),
  c("2461", "Tashkent Grand Slam 2023", "Grand Slam", 2023),
  c("2439", "Tel Aviv Grand Slam 2023", "Grand Slam", 2023),
  c("2315", "Tokyo Grand Slam 2022", "Grand Slam", 2022),
  c("2311", "Baku Grand Slam 2022", "Grand Slam", 2022),
  c("2309", "Abu Dhabi Grand Slam 2022", "Grand Slam", 2022),
  c("2296", "Grand Slam Hungary 2022", "Grand Slam", 2022),
  c("2364", "Ulaanbaatar Grand Slam 2022", "Grand Slam", 2022),
  c("2288", "Tbilisi Grand Slam 2022", "Grand Slam", 2022),
  c("2289", "Antalya Grand Slam 2022", "Grand Slam", 2022),
  c("2284", "Tel Aviv Grand Slam 2022", "Grand Slam", 2022, 2026),
  c("2282", "Paris Grand Slam 2022", "Grand Slam", 2022),
  c("2317", "Abu Dhabi Grand Slam 2021", "Grand Slam", 2021),
  c("2267", "Baku Grand Slam 2021", "Grand Slam", 2021),
  c("2260", "Paris Grand Slam 2021", "Grand Slam", 2021),
  c("2238", "Kazan Grand Slam 2021", "Grand Slam", 2021),
  c("2234", "Antalya Grand Slam 2021", "Grand Slam", 2021),
  c("2233", "Tbilisi Grand Slam 2021", "Grand Slam", 2021),
  c("2230", "Tashkent Grand Slam 2021", "Grand Slam", 2021),
  c("2227", "Tel Aviv Grand Slam 2021", "Grand Slam", 2021),
  c("2034", "Grand Slam Hungary 2020", "Grand Slam", 2020),
  c("2018", "Dusseldorf Grand Slam 2020", "Grand Slam", 2020),
  c("2017", "Paris Grand Slam 2020", "Grand Slam", 2020),
  c("1764", "Osaka Grand Slam 2019", "Grand Slam", 2019),
  c("1758", "Abu Dhabi Grand Slam 2019", "Grand Slam", 2019),
  c("1837", "Brasilia Grand Slam 2019", "Grand Slam", 2019, 2026),
  c("1732", "Baku Grand Slam 2019", "Grand Slam", 2019),
  c("1720", "Ekaterinburg Grand Slam 2019", "Grand Slam", 2019),
  c("1710", "Dusseldorf Grand Slam 2019", "Grand Slam", 2019),
  c("1707", "Paris Grand Slam 2019", "Grand Slam", 2019),
  c("1601", "Osaka Grand Slam 2018", "Grand Slam", 2018, 2026),
  c("1695", "Abu Dhabi Grand Slam 2018", "Grand Slam", 2018),
  c("1571", "Ekaterinburg Grand Slam 2018", "Grand Slam", 2018),
  c("1567", "Dusseldorf Grand Slam 2018", "Grand Slam", 2018),
  c("1564", "Paris Grand Slam 2018", "Grand Slam", 2018),
  c("1470", "Tokyo Grand Slam 2017", "Grand Slam", 2017),
  c("1468", "Abu Dhabi Grand Slam 2017", "Grand Slam", 2017),
  c("1457", "Ekaterinburg Grand Slam 2017", "Grand Slam", 2017, 2026),
  c("1447", "Baku Grand Slam 2017", "Grand Slam", 2017),
  c("1441", "Paris Grand Slam 2017", "Grand Slam", 2017),
  c("1351", "Grand Slam Tokyo 2016", "Grand Slam", 2016),
  c("1347", "Grand Slam Abu Dhabi 2016", "Grand Slam", 2016),
  c("1338", "Grand Slam Tyumen 2016", "Grand Slam", 2016, 2026),
  c("1330", "Grand Slam Baku 2016", "Grand Slam", 2016),
  c("1311", "Grand Slam Paris 2016", "Grand Slam", 2016),
  c("1243", "Grand Slam Tokyo 2015", "Grand Slam", 2015),
  c("1238", "Grand Slam Abu Dhabi 2015", "Grand Slam", 2015),
  c("1236", "Grand Slam Paris 2015", "Grand Slam", 2015),
  c("1229", "Grand Slam Tyumen 2015", "Grand Slam", 2015),
  c("1220", "Grand Slam Baku 2015", "Grand Slam", 2015, 2026),

  // ---- Grand Prix ----
  c("2885", "Zagreb Grand Prix 2025", "Grand Prix", 2025),
  c("3081", "Guadalajara Grand Prix 2025", "Grand Prix", 2025),
  c("3086", "Lima Grand Prix 2025", "Grand Prix", 2025),
  c("3085", "Qingdao Grand Prix 2025", "Grand Prix", 2025),
  c("2872", "Grand Prix Upper Austria 2025", "Grand Prix", 2025),
  c("2656", "Zagreb Grand Prix 2024", "Grand Prix", 2024),
  c("2647", "Grand Prix Upper Austria 2024", "Grand Prix", 2024),
  c("2643", "Grand Prix Portugal 2024", "Grand Prix", 2024),
  c("2466", "Zagreb Grand Prix 2023", "Grand Prix", 2023),
  c("2512", "Dushanbe Grand Prix 2023", "Grand Prix", 2023),
  c("2564", "Grand Prix Upper Austria 2023", "Grand Prix", 2023),
  c("2437", "Grand Prix Portugal 2023", "Grand Prix", 2023),
  c("2306", "Zagreb Grand Prix 2022", "Grand Prix", 2022),
  c("2281", "Grand Prix Portugal 2022", "Grand Prix", 2022),
  c("2253", "Zagreb Grand Prix 2021", "Grand Prix", 2021, 2026),
  c("2016", "Tel Aviv Grand Prix 2020", "Grand Prix", 2020),
  c("1760", "Tashkent Grand Prix 2019", "Grand Prix", 2019),
  c("1748", "Zagreb Grand Prix 2019", "Grand Prix", 2019),
  c("1747", "Budapest Grand Prix 2019", "Grand Prix", 2019),
  c("1746", "Montreal Grand Prix 2019", "Grand Prix", 2019, 2026),
  c("1733", "Hohhot Grand Prix 2019", "Grand Prix", 2019),
  c("1725", "Antalya Grand Prix 2019", "Grand Prix", 2019),
  c("1724", "Tbilisi Grand Prix 2019", "Grand Prix", 2019),
  c("1702", "Marrakech Grand Prix 2019", "Grand Prix", 2019, 2026),
  c("1745", "Tel Aviv Grand Prix 2019", "Grand Prix", 2019),
  c("1598", "The Hague Grand Prix 2018", "Grand Prix", 2018, 2026),
  c("1594", "Tashkent Grand Prix 2018", "Grand Prix", 2018),
  c("1584", "Cancun Grand Prix 2018", "Grand Prix", 2018),
  c("1588", "Budapest Grand Prix 2018", "Grand Prix", 2018),
  c("1587", "Zagreb Grand Prix 2018", "Grand Prix", 2018),
  c("1581", "Hohhot Grand Prix 2018", "Grand Prix", 2018),
  c("1575", "Antalya Grand Prix 2018", "Grand Prix", 2018),
  c("1574", "Tbilisi Grand Prix 2018", "Grand Prix", 2018),
  c("1561", "Agadir Grand Prix 2018", "Grand Prix", 2018),
  c("1560", "Tunis Grand Prix 2018", "Grand Prix", 2018),
  c("1536", "The Hague Grand Prix 2017", "Grand Prix", 2017),
  c("1466", "Tashkent Grand Prix 2017", "Grand Prix", 2017),
  c("1465", "Zagreb Grand Prix 2017", "Grand Prix", 2017),
  c("1460", "Hohhot Grand Prix 2017", "Grand Prix", 2017, 2026),
  c("1540", "Cancun Grand Prix 2017", "Grand Prix", 2017),
  c("1453", "Antalya Grand Prix 2017", "Grand Prix", 2017),
  c("1452", "Tbilisi Grand Prix 2017", "Grand Prix", 2017),
  c("1444", "Dusseldorf Grand Prix 2017", "Grand Prix", 2017),
  c("1349", "Grand Prix Qingdao 2016", "Grand Prix", 2016),
  c("1342", "Grand Prix Tashkent 2016", "Grand Prix", 2016),
  c("1341", "Grand Prix Zagreb 2016", "Grand Prix", 2016),
  c("1336", "Grand Prix Ulaanbaatar 2016", "Grand Prix", 2016),
  c("1335", "Grand Prix Budapest 2016", "Grand Prix", 2016),
  c("1331", "Grand Prix Almaty 2016", "Grand Prix", 2016),
  c("1324", "Grand Prix Samsun 2016", "Grand Prix", 2016),
  c("1323", "Grand Prix Tbilisi 2016", "Grand Prix", 2016),
  c("1315", "Grand Prix Dusseldorf 2016", "Grand Prix", 2016),
  c("1308", "Grand Prix Havana 2016", "Grand Prix", 2016, 2026),
  c("1242", "Grand Prix Jeju 2015", "Grand Prix", 2015),
  c("1241", "Grand Prix Qingdao 2015", "Grand Prix", 2015),
  c("1233", "Grand Prix Tashkent 2015", "Grand Prix", 2015),
  c("1228", "Grand Prix Ulaanbaatar 2015", "Grand Prix", 2015),
  c("1226", "Grand Prix Budapest 2015", "Grand Prix", 2015),
  c("1219", "Grand Prix Zagreb 2015", "Grand Prix", 2015),
  c("1202", "Grand Prix Samsun 2015", "Grand Prix", 2015),
  c("1201", "Grand Prix Tbilisi 2015", "Grand Prix", 2015),
  c("1194", "Grand Prix Dusseldorf 2015", "Grand Prix", 2015, 2026),

  // ---- Mundial ----
  c("1751", "World Championships Seniors 2019", "Mundial", 2019),
  c("1591", "World Championships Seniors Baku 2018", "Mundial", 2018),
  c("1232", "World Championships Seniors 2015", "Mundial", 2015),

  // ---- Masters ----
  c("2316", "Jerusalem Masters 2022", "Masters", 2022),
  c("2180", "Doha Masters 2021", "Masters", 2021),
  c("1765", "Qingdao Masters 2019", "Masters", 2019),
  c("1658", "Guangzhou Masters 2018", "Masters", 2018, 2026),
  c("1653", "St Petersburg Masters 2017", "Masters", 2017),
  c("1332", "Guadalajara Masters 2016", "Masters", 2016),
  c("1222", "Rabat Masters 2015", "Masters", 2015),

  // ---- Olimpiada (último recurso — as mais previsíveis) ----
  c("2035", "Olympic Games Tokyo 2020", "Olimpiada", 2020),
  c("1339", "Olympic Games Rio de Janeiro 2016", "Olimpiada", 2016),
];

// ----- Helpers de leitura -----

/** Clássicos ainda DISPONÍVEIS (nunca usados). */
export function classicosDisponiveis(): BancoClassico[] {
  return BANCO_CLASSICOS.filter((x) => !x.usadoEm);
}

/** Clássicos JÁ usados (com o ano em que entraram). */
export function classicosUsados(): BancoClassico[] {
  return BANCO_CLASSICOS.filter((x) => !!x.usadoEm);
}

/** Resumo rápido do estado do banco. */
export function estatisticasBanco(): { total: number; disponiveis: number; usados: number } {
  const usados = classicosUsados().length;
  return { total: BANCO_CLASSICOS.length, disponiveis: BANCO_CLASSICOS.length - usados, usados };
}

/**
 * Sugere os PRÓXIMOS n clássicos a usar, por preferência (GS/GP > Mundial >
 * Masters > Olimpíada) e mesclando anos. Se não houver n disponíveis (banco
 * a esgotar), avisa via `reciclar: true` — nesse ponto deve-se limpar os
 * `usadoEm` e recomeçar. Esta função é uma AJUDA para montar o próximo ano
 * (corre-se à parte; não é consumida automaticamente pela app).
 */
export function sugerirProximos(n: number): { sugeridos: BancoClassico[]; reciclar: boolean } {
  const disp = classicosDisponiveis();
  const ordenados = [...disp].sort((a, b) => (a.prioridade - b.prioridade) || (b.ano - a.ano));
  if (ordenados.length >= n) return { sugeridos: ordenados.slice(0, n), reciclar: false };
  return { sugeridos: ordenados, reciclar: true };
}
