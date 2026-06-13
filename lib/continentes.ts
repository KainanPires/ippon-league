// lib/continentes.ts
//
// Mapa país (iso2) → continente, no modelo das 5 confederações do judô (IJF):
//   EUR (Europa), PAN (Pan-América), ASI (Ásia), AFR (África), OCE (Oceânia).
// Cada utilizador disputa a liga continental do SEU continente, e o nome
// mostrado é o do continente (ex: "Europa", "América"), não "Continental".
//
// O continente vem do user_metadata.pais_iso (gravado no registo, ex: "PT").

export type Continente = "EUR" | "PAN" | "ASI" | "AFR" | "OCE";

// Nome a mostrar na app para cada continente (a "América" cobre toda a Pan-América).
export const NOME_CONTINENTE: Record<Continente, string> = {
  EUR: "Europa",
  PAN: "América",
  ASI: "Ásia",
  AFR: "África",
  OCE: "Oceânia",
};

// iso2 → continente. Lista alinhada com COUNTRIES em lib/countries.ts.
const MAPA: Record<string, Continente> = {
  // --- Europa ---
  AL: "EUR", AD: "EUR", AT: "EUR", BY: "EUR", BE: "EUR", BA: "EUR", BG: "EUR",
  HR: "EUR", CY: "EUR", CZ: "EUR", DK: "EUR", EE: "EUR", FO: "EUR", FI: "EUR",
  FR: "EUR", DE: "EUR", GI: "EUR", GR: "EUR", HU: "EUR", IS: "EUR", IE: "EUR",
  IT: "EUR", XK: "EUR", LV: "EUR", LI: "EUR", LT: "EUR", LU: "EUR", MT: "EUR",
  MD: "EUR", MC: "EUR", ME: "EUR", NL: "EUR", MK: "EUR", NO: "EUR", PL: "EUR",
  PT: "EUR", RO: "EUR", RU: "EUR", SM: "EUR", RS: "EUR", SK: "EUR", SI: "EUR",
  ES: "EUR", SE: "EUR", CH: "EUR", UA: "EUR", GB: "EUR", VA: "EUR",
  // Transcontinentais que a IJF coloca na Europa:
  AM: "EUR", AZ: "EUR", GE: "EUR", TR: "EUR", IL: "EUR",

  // --- Pan-América (América do Norte, Central, Sul e Caraíbas) ---
  AI: "PAN", AG: "PAN", AR: "PAN", AW: "PAN", BS: "PAN", BB: "PAN", BZ: "PAN",
  BM: "PAN", BO: "PAN", BR: "PAN", CA: "PAN", KY: "PAN", CL: "PAN", CO: "PAN",
  CR: "PAN", CU: "PAN", CW: "PAN", DM: "PAN", DO: "PAN", EC: "PAN", SV: "PAN",
  GL: "PAN", GD: "PAN", GP: "PAN", GT: "PAN", GY: "PAN", GF: "PAN", HT: "PAN",
  HN: "PAN", JM: "PAN", MX: "PAN", NI: "PAN", PA: "PAN", PY: "PAN", PE: "PAN",
  PR: "PAN", KN: "PAN", LC: "PAN", VC: "PAN", SR: "PAN", TT: "PAN", US: "PAN",
  UY: "PAN", VE: "PAN", VG: "PAN",

  // --- Ásia ---
  AF: "ASI", SA: "ASI", BH: "ASI", BD: "ASI", BN: "ASI", BT: "ASI", KH: "ASI",
  QA: "ASI", KZ: "ASI", CN: "ASI", KP: "ASI", KR: "ASI", AE: "ASI", PH: "ASI",
  HK: "ASI", YE: "ASI", IN: "ASI", ID: "ASI", IR: "ASI", IQ: "ASI", JP: "ASI",
  JO: "ASI", KW: "ASI", LA: "ASI", LB: "ASI", MO: "ASI", MY: "ASI", MV: "ASI",
  MN: "ASI", MM: "ASI", NP: "ASI", OM: "ASI", PK: "ASI", PS: "ASI", KG: "ASI",
  SG: "ASI", SY: "ASI", LK: "ASI", TW: "ASI", TJ: "ASI", TH: "ASI", TL: "ASI",
  TM: "ASI", UZ: "ASI", VN: "ASI",

  // --- África ---
  ZA: "AFR", DZ: "AFR", AO: "AFR", BJ: "AFR", BW: "AFR", BF: "AFR", BI: "AFR",
  CV: "AFR", CM: "AFR", TD: "AFR", KM: "AFR", CG: "AFR", CD: "AFR", CI: "AFR",
  EG: "AFR", ER: "AFR", SZ: "AFR", ET: "AFR", GA: "AFR", GM: "AFR", GH: "AFR",
  GN: "AFR", GQ: "AFR", GW: "AFR", KE: "AFR", LS: "AFR", LR: "AFR", LY: "AFR",
  MG: "AFR", MW: "AFR", ML: "AFR", MA: "AFR", MU: "AFR", MR: "AFR", MZ: "AFR",
  NA: "AFR", NE: "AFR", NG: "AFR", RW: "AFR", ST: "AFR", SN: "AFR", SC: "AFR",
  SL: "AFR", SO: "AFR", SD: "AFR", SS: "AFR", TZ: "AFR", TG: "AFR", TN: "AFR",
  UG: "AFR", ZM: "AFR", ZW: "AFR", CF: "AFR",

  // --- Oceânia ---
  AU: "OCE", FJ: "OCE", GU: "OCE", MH: "OCE", FM: "OCE", NR: "OCE", NC: "OCE",
  NZ: "OCE", PW: "OCE", PG: "OCE", PF: "OCE", WS: "OCE", SB: "OCE", TO: "OCE",
  TV: "OCE", VU: "OCE", KI: "OCE",
};

/** Continente de um país (iso2). Devolve null se desconhecido. */
export function continenteDoPais(iso2: string | null | undefined): Continente | null {
  if (!iso2) return null;
  return MAPA[iso2.toUpperCase()] ?? null;
}

/** Nome a mostrar do continente de um país (ex: "PT" → "Europa"). */
export function nomeContinenteDoPais(iso2: string | null | undefined): string | null {
  const c = continenteDoPais(iso2);
  return c ? NOME_CONTINENTE[c] : null;
}
