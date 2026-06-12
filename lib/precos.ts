// lib/precos.ts
//
// FONTE ÚNICA DE VERDADE para o preço do Ippon Pro.
//
// Todos os sítios que mostram o preço (tela inicial, página /ippon-pro, Dojo,
// ligas, tutorial...) devem importar DAQUI, em vez de escrever o preço à mão.
// Assim, quando o preço mudar, muda-se SÓ neste ficheiro e muda em todo o lado.
//
// Uso típico:
//   import { PRECO } from "@/lib/precos";
//   PRECO.promo        -> "4,90€"      (o preço a cobrar agora)
//   PRECO.normal       -> "9,90€"      (o preço cheio, riscado)
//   PRECO.periodo      -> "/mês"
//   PRECO.emPromocao   -> true         (se false, esconde-se o riscado)
//   PRECO.etiqueta     -> "Promoção"   (texto da etiqueta de promoção)
//   PRECO.promoComPeriodo -> "4,90€/mês"

export const PRECO = {
  // Está em promoção de lançamento? Quando acabar a promoção, pôr false:
  // o preço passa a mostrar só o normal, sem riscado nem etiqueta.
  emPromocao: true,

  // Valores (texto pronto a mostrar, com vírgula decimal à europeia).
  promo: "4,90€",   // preço a cobrar agora
  normal: "9,90€",  // preço cheio (riscado quando em promoção)
  periodo: "/mês",

  // Atalhos prontos.
  etiqueta: "Promoção",
  promoComPeriodo: "4,90€/mês",
  normalComPeriodo: "9,90€/mês",

  // O preço "em vigor" (o que a pessoa paga): promo se houver promoção, senão normal.
  get atual(): string {
    return this.emPromocao ? this.promo : this.normal;
  },
  get atualComPeriodo(): string {
    return this.emPromocao ? this.promoComPeriodo : this.normalComPeriodo;
  },

  // Mensagem de valor a mostrar junto do Pro, em todo o lado.
  premios: "Sendo PRO concorra a prémios todas as rodadas",
} as const;
