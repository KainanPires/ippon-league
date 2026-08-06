// lib/ordenarNoticias.ts
//
// AS NOTÍCIAS DA MINHA REGIÃO PRIMEIRO.
//
// ---------------------------------------------------------------------------
// ORDENAR, NÃO ESCONDER
//
// Uma notícia sobre o Pan-Americano interessa mais a quem é do Brasil. Mas
// esconder as das outras regiões criaria buracos: um português a viver no
// Brasil deixaria de ver o que lhe diz respeito, e ninguém percebe porquê
// quando lhe falta algo que o vizinho vê.
//
// Por isso: as da minha região vêm primeiro, as outras a seguir. Ninguém perde
// nada, e cada um vê primeiro o que lhe é próximo.
//
// A ordem final:
//   1. do meu PAÍS          (o mais próximo)
//   2. do meu CONTINENTE
//   3. MUNDIAIS             (sem região: são de todos)
//   4. de outras regiões    (interessa menos, mas continua lá)
//
// Dentro de cada grupo, mantém-se a ordem original (destaque, depois recentes).
// ---------------------------------------------------------------------------

/**
 * O país da notícia vem em código OLÍMPICO (BRA, POR, JPN) — é assim que o
 * JudoBase o dá. O do utilizador vem em ISO (BR, PT, JP), que é o que o registo
 * guarda. Nunca batem sem tradução, e sem isto uma notícia sobre um brasileiro
 * aparecia a um brasileiro como "de outra região".
 *
 * Só precisamos dos países com atletas no circuito. Um que falte cai no fim da
 * lista, o que é inofensivo — nunca faz uma notícia desaparecer.
 */
const ISO_DE_OLIMPICO: Record<string, string> = {
  BRA: "BR", POR: "PT", JPN: "JP", FRA: "FR", GEO: "GE", KAZ: "KZ", AZE: "AZ",
  BEL: "BE", TUR: "TR", UZB: "UZ", GER: "DE", KOS: "XK", ITA: "IT", CAN: "CA",
  SLO: "SI", CRO: "HR", NED: "NL", ESP: "ES", GBR: "GB", USA: "US", RUS: "RU",
  UKR: "UA", POL: "PL", HUN: "HU", AUT: "AT", SUI: "CH", SWE: "SE", NOR: "NO",
  DEN: "DK", FIN: "FI", GRE: "GR", ROU: "RO", BUL: "BG", SRB: "RS", MNE: "ME",
  MDA: "MD", ISR: "IL", MGL: "MN", KOR: "KR", CHN: "CN", TPE: "TW", IND: "IN",
  IRI: "IR", UAE: "AE", KSA: "SA", EGY: "EG", MAR: "MA", TUN: "TN", ALG: "DZ",
  RSA: "ZA", ANG: "AO", CPV: "CV", MOZ: "MZ", ARG: "AR", CHI: "CL", COL: "CO",
  VEN: "VE", PER: "PE", URU: "UY", PAR: "PY", ECU: "EC", MEX: "MX", CUB: "CU",
  DOM: "DO", PAN: "PA", AUS: "AU", NZL: "NZ", CZE: "CZ", SVK: "SK", LTU: "LT",
  LAT: "LV", EST: "EE", BLR: "BY", ARM: "AM", TJK: "TJ", KGZ: "KG", TKM: "TM",
};

/** Normaliza um código de país para ISO de duas letras. */
function paraIso(codigo: string): string {
  const c = (codigo || "").trim().toUpperCase();
  if (c.length === 2) return c;
  return ISO_DE_OLIMPICO[c] || c;
}

export interface ComRegiao {
  pais?: string | null;
  continente?: string | null;
}

/** Quanto vale esta notícia para quem é deste país/continente. Menor = mais acima. */
export function prioridade(n: ComRegiao, meuPais: string | null, meuContinente: string | null): number {
  // Traduz os dois lados para ISO antes de comparar (ver ISO_DE_OLIMPICO).
  const p = paraIso(n.pais || "");
  const c = (n.continente || "").toLowerCase();
  if (p && meuPais && p === paraIso(meuPais)) return 0;
  if (c && meuContinente && c === meuContinente.toLowerCase()) return 1;
  if (!p && !c) return 2;  // mundial
  return 3;                 // de outra região
}

/**
 * Ordena mantendo a ordem original dentro de cada grupo.
 *
 * O `sort` do JavaScript é estável, por isso comparar só a prioridade preserva
 * o que já vinha ordenado da base (destaque primeiro, depois as mais recentes).
 */
export function ordenarPorRegiao<T extends ComRegiao>(
  noticias: T[], meuPais: string | null, meuContinente: string | null,
): T[] {
  if (!meuPais && !meuContinente) return noticias; // sem região: fica como está
  return [...noticias].sort(
    (a, b) => prioridade(a, meuPais, meuContinente) - prioridade(b, meuPais, meuContinente)
  );
}
