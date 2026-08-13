// lib/dicionarioNotif.ts
//
// DICIONÁRIO DAS NOTIFICAÇÕES (templates), nas 5 línguas.
//
// É um módulo PURO: sem React, sem Supabase, sem hooks. Por isso pode ser
// importado tanto no cliente como no servidor. Aqui vivem só os textos FIXOS das
// notificações guardadas/push — mercado, faixa, liga, copa, Dôdo, fim de
// competição — que são sempre a mesma frase com variáveis ({nome}, {liga}, …).
//
// As notícias do Blog (texto livre) NÃO vêm aqui: essas traduzem-se por IA e a
// tradução vive em hub_noticias.traducoes (ver lib/traduzirNoticia.ts).
//
// Cada leva da Fase 3 acrescenta a este objeto as chaves da sua fonte. O
// servidor (lib/i18nServidor.ts) usa `renderNotif` para escolher a língua de
// quem recebe e preencher as variáveis.

export type LinguaNotif = "pt" | "en" | "es" | "fr" | "de";
export const LINGUAS_NOTIF: LinguaNotif[] = ["pt", "en", "es", "fr", "de"];

// Cada chave traz as 5 traduções. Termos de judô (ippon, waza-ari…) e nomes
// próprios (Ippon League, Copa do Dôdo, Judocoins…) ficam iguais em todas.
type Entrada = Record<LinguaNotif, string>;

export const NOTIF: Record<string, Entrada> = {
  // Preenchido leva a leva (liga → copa → competição → mercado → Dôdo).
  // Exemplo da forma (fica aqui como referência viva; pode ficar em uso):
  // "liga.pedidoTitulo": {
  //   pt: "Novo pedido na tua liga",
  //   en: "New request in your league",
  //   es: "Nueva solicitud en tu liga",
  //   fr: "Nouvelle demande dans ta ligue",
  //   de: "Neue Anfrage in deiner Liga",
  // },
};

/** Substitui {var} pelos valores dados. */
function preencher(texto: string, vars?: Record<string, string | number>): string {
  if (!vars) return texto;
  let out = texto;
  for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v));
  return out;
}

/**
 * Devolve o texto de uma chave na língua pedida, com recurso ao português e, em
 * último caso, à própria chave (nunca devolve vazio). `vars` preenche os {campos}.
 */
export function renderNotif(
  lingua: LinguaNotif,
  chave: string,
  vars?: Record<string, string | number>
): string {
  const e = NOTIF[chave];
  const texto = (e && (e[lingua] || e.pt)) || chave;
  return preencher(texto, vars);
}
