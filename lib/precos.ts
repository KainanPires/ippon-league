// lib/precos.ts
//
// FONTE ÚNICA DE VERDADE para os preços do Ippon Pro e Ippon Pro Max.
//
// Todos os sítios que mostram preço devem importar DAQUI, em vez de escrever à
// mão. Quando o preço mudar, muda-se SÓ neste ficheiro.
//
// PROMOÇÃO DE LANÇAMENTO: tudo a metade do preço futuro (cheio). Quando a
// promoção acabar, pôr emPromocao:false — passa a mostrar só o cheio.
//
// NÍVEIS:
//   • Pro     — 4,90€/mês promo (9,90€ cheio).
//   • Pro Max — 7,80€/mês promo (Pro 4,90 + parte Max 2,90). Cheio 14,80€
//               (Pro 9,90 + parte Max 4,90).
//
// NOTA (mecânica fina por implementar com o pagamento real): quem já é Pro tem
// uma JANELA DE 7 DIAS, em cada contratação/renovação, para subir a Pro Max
// pagando só metade da parte Max (+2,90/mês); passada a janela, paga a parte
// Max cheia (+4,90/mês). Isto NÃO está nesta vitrina — entra quando o pagamento
// for ligado, porque só aí pode ser acionado e testado.

const PRO_PROMO = "4,90€";
const PRO_CHEIO = "9,90€";
const MAX_PROMO = "7,80€";   // 4,90 (Pro) + 2,90 (metade da parte Max)
const MAX_CHEIO = "14,80€";  // 9,90 (Pro) + 4,90 (parte Max cheia)
const PERIODO = "/mês";

export const PRECO = {
  // Está em promoção de lançamento?
  emPromocao: true,
  periodo: PERIODO,
  etiqueta: "Promoção de lançamento",

  // --- Pro ---
  promo: PRO_PROMO,
  normal: PRO_CHEIO,
  promoComPeriodo: PRO_PROMO + PERIODO,
  normalComPeriodo: PRO_CHEIO + PERIODO,
  get atual(): string { return this.emPromocao ? PRO_PROMO : PRO_CHEIO; },
  get atualComPeriodo(): string { return (this.emPromocao ? PRO_PROMO : PRO_CHEIO) + PERIODO; },

  // --- Pro Max ---
  maxPromo: MAX_PROMO,
  maxNormal: MAX_CHEIO,
  maxPromoComPeriodo: MAX_PROMO + PERIODO,
  maxNormalComPeriodo: MAX_CHEIO + PERIODO,
  get maxAtual(): string { return this.emPromocao ? MAX_PROMO : MAX_CHEIO; },
  get maxAtualComPeriodo(): string { return (this.emPromocao ? MAX_PROMO : MAX_CHEIO) + PERIODO; },

  // Mensagem de valor (fase de testes: sem prémios — foco em informação/competição).
  premios: "Joga com mais informação e compete pelo topo do ranking",
} as const;
