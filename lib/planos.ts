// lib/planos.ts
//
// OS LIMITES DE CADA PLANO — o número, e só o número.
//
// Este ficheiro NÃO importa nada. É de propósito: assim pode ser usado tanto no
// servidor (lib/limitesLiga.ts) como no browser (o ecrã /ligas, que mostra
// "1/1" ao utilizador). Se a constante vivesse no limitesLiga, o browser
// arrastaria com ela o supabaseAdmin — que é código de servidor e não deve ir
// para o cliente.
//
// PORQUE EXISTE: a regra dos limites chegou a estar escrita em CINCO sítios
// (criar, entrar, pedir, decidir e o ecrã /ligas), com números diferentes em
// cada um. O ecrã dizia ao utilizador "2 ligas" enquanto o servidor recusava a
// segunda. Um número que o utilizador vê e um que o servidor aplica têm de ser
// literalmente o mesmo — e é isso que este ficheiro garante.

/** Ligas de amigos por nível, contadas SEPARADAMENTE por formato. */
export const LIMITES = {
  gratis: { pontos: 1, copa: 1 },
  pro: { pontos: 5, copa: 5 },
  promax: { pontos: 10, copa: 10 },
} as const;

export type NivelUtilizador = keyof typeof LIMITES;

/** Nome do plano para mostrar (nas mensagens de limite). */
export const NOME_PLANO: Record<NivelUtilizador, string> = {
  gratis: "conta gratuita",
  pro: "Ippon Pro",
  promax: "Ippon Pro Max",
};

// ---------------------------------------------------------------------------
// PACOTES DE JUDOCOINS (compra) — orçamento EXTRA da temporada.
// ---------------------------------------------------------------------------
// Cada pacote é um preço de PAGAMENTO ÚNICO na Stripe, encontrado pela chave de
// pesquisa (lookup key) `jc_<quantidade>` — a MESMA em teste e em produção, para
// o código não depender de identificadores que mudam entre os dois modos.
//
// O `euros` aqui é só para MOSTRAR na loja; o valor realmente cobrado é o que
// está na Stripe. A quantidade de JC a creditar vem da metadata `jc` do preço
// (à prova de enganos), com este catálogo como rede de segurança.
//
// ⚠️ REGRA DO JOGO: os JC comprados são orçamento extra que EXPIRA a 30 de
// dezembro (reset anual) e NUNCA permitem trocar de atleta com o mercado
// fechado. Comprar dá capital para contratar, não pontos — o mérito é que manda.
// (Sem imports de propósito: este ficheiro é usado no browser E no servidor.)
export const PACOTES_JC = [
  { jc: 10, euros: 20, lookupKey: "jc_10" },
  { jc: 20, euros: 30, lookupKey: "jc_20" },
  { jc: 30, euros: 35, lookupKey: "jc_30" },
  { jc: 40, euros: 40, lookupKey: "jc_40" },
  { jc: 50, euros: 45, lookupKey: "jc_50" },
  { jc: 60, euros: 50, lookupKey: "jc_60" },
  { jc: 70, euros: 55, lookupKey: "jc_70" },
  { jc: 80, euros: 60, lookupKey: "jc_80" },
  { jc: 90, euros: 65, lookupKey: "jc_90" },
  { jc: 100, euros: 70, lookupKey: "jc_100" },
] as const;

export type PacoteJC = (typeof PACOTES_JC)[number];

/** Um pacote pela quantidade de JC (ex.: 50). undefined se não existir. */
export function pacotePorJc(jc: number): PacoteJC | undefined {
  return PACOTES_JC.find((p) => p.jc === jc);
}

/** Um pacote pela chave de pesquisa da Stripe (ex.: "jc_50"). */
export function pacotePorLookup(key: string): PacoteJC | undefined {
  return PACOTES_JC.find((p) => p.lookupKey === key);
}
