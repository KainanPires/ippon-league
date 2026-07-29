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
