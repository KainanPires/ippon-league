// lib/precos.ts
//
// FONTE ÚNICA DE VERDADE para os preços do Ippon Pro e Ippon Pro Max.
//
// Todos os sítios que mostram preço importam DAQUI, em vez de escrever à mão.
// Quando o preço mudar, muda-se SÓ neste ficheiro.
//
// ---------------------------------------------------------------------------
// ESTES NÚMEROS TÊM DE BATER CERTO COM A STRIPE
//
// O que está aqui é a montra; quem cobra é a Stripe, pelos preços em
// lib/stripe.ts. Se divergirem, a página anuncia um valor e o cartão é
// debitado noutro — e isso dá direito a reclamação mesmo quando o cobrado é o
// mais baixo.
//
// Ao mudar um preço: cria-se um preço NOVO na Stripe (nunca se edita um
  // existente, senão mexe-se em quem já subscreveu), troca-se o identificador em
// lib/stripe.ts, e só depois se muda o texto aqui. Os três passos, sempre.
//
// ---------------------------------------------------------------------------
// O MODELO: MENSAL, NÃO ANUAL
//
// A subscrição é mensal e renova-se sozinha até ser cancelada. Quem cancela
// mantém o acesso até ao fim do mês já pago e não é cobrado outra vez.
//
// Isto foi decidido depois de o projeto ter começado com a ideia de plano
// anual — se encontrares algum texto a falar em ano, está desatualizado.
//
// ---------------------------------------------------------------------------
// A PROMOÇÃO DE LANÇAMENTO
//
// Duas coisas diferentes, e convém não as trocar:
//
// • JANELA — os primeiros 90 dias após o lançamento. É o prazo para entrar.
// Fecha sozinha: os cupões na Stripe têm data limite de resgate.
//
// • DURAÇÃO — 6 meses de desconto para cada pessoa, a contar de quando ela
// subscreveu. Também acaba sozinho, e o preço sobe ao cheio sem ninguém
// ter de migrar nada.
//
// Quem entrar no dia 89 tem os mesmos 6 meses de quem entrou no dia 1.
//
// Quando a janela fechar, pôr emPromocao:false — a montra passa a mostrar só o
// preço cheio. Os cupões já não são resgatáveis, mas quem os apanhou continua a
// contar os seus 6 meses.
//
// ---------------------------------------------------------------------------
// SUBIR DE PRO PARA PRO MAX
//
// Dentro dos 7 dias de teste: troca-se o preço da subscrição e não se cobra
// nada de extra — ainda não houve primeira cobrança. É o prémio de decidir cedo.
//
// Depois dos 7 dias: paga-se UMA VEZ a taxa de subida, e daí em diante a pessoa
// paga o Pro Max normal. Não é uma diferença recorrente: quem subiu tarde e
// quem comprou Pro Max direto acabam a pagar exatamente o mesmo por mês.
// ---------------------------------------------------------------------------
// A MOEDA
//
// Os valores aqui estao em EUROS, porque e em euros que se recebe: a Stripe
// converte para a moeda do comprador no checkout (Adaptive Pricing ligado) e
// deposita em euros na conta.
//
// Isso quer dizer que um brasileiro le "7,99€" nesta montra e ve "R$ 49,90" no
// pagamento. E o mesmo valor, mas a surpresa cai no pior momento possivel - o
// de decidir pagar. Dai o `notaMoeda`: uma linha por baixo dos precos a avisar
// que o valor sai na moeda local.
//
// A solucao completa seria a montra pedir os precos convertidos a Stripe. Fica
// para quando houver gente fora da zona euro que justifique a chamada extra.
// ---------------------------------------------------------------------------
const PRO_PROMO = "4,99€";
const PRO_CHEIO = "7,99€";
const MAX_PROMO = "7,99€";
const MAX_CHEIO = "11,99€";
const PERIODO = "/mês";
/** Meses de desconto por pessoa, a contar da subscrição. */
const MESES_DESCONTO = 6;
/** Dias em que a promoção pode ser apanhada, a contar do lançamento. */
const DIAS_JANELA = 90;
export const PRECO = {
  // Está em promoção de lançamento?
  emPromocao: true,
  periodo: PERIODO,
  etiqueta: "Promoção de lançamento",
  // Quanto tempo dura, para os textos não terem números escritos à mão.
  mesesDesconto: MESES_DESCONTO,
  diasJanela: DIAS_JANELA,
  /** Ex.: "6 meses com desconto" — para as linhas de rodapé e etiquetas. */
  duracaoDesconto: `${MESES_DESCONTO} meses com desconto`,
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
  // --- Subir de Pro para Pro Max ---
  // A DIFERENÇA mensal entre os dois níveis: é o que passa a pagar a mais por
  // mês quem sobe. Promoção: 7,99 - 4,99. Cheio: 11,99 - 7,99.
  upgradePromo: "+3,00€",
  upgradeNormal: "+4,00€",
  upgradePromoComPeriodo: "+3,00€" + PERIODO,
  get upgradeAtual(): string { return this.emPromocao ? "+3,00€" : "+4,00€"; },
  get upgradeAtualComPeriodo(): string { return (this.emPromocao ? "+3,00€" : "+4,00€") + PERIODO; },
  /**
  * A taxa ÚNICA de quem sobe depois dos 7 dias de teste.
  *
  * Não é mensal e não se soma à mensalidade: paga-se uma vez, e a partir daí a
  * pessoa paga o Pro Max normal, igual a quem o comprou direto.
  */
  subidaTaxa: "4,99€",
  /**
  * Aviso da moeda, para pôr por baixo de qualquer preço.
  *
  * Usar através do <NotaMoeda /> (components/NotaMoeda.tsx) em vez de escrever
  * a frase à mão — assim muda-se num sítio só, como os preços.
  */
  notaMoeda: "Valor cobrado na tua moeda local, à taxa de câmbio do dia.",

  // Mensagem de valor (fase de testes: sem prémios — foco em informação/competição).
  premios: "Joga com mais informação e compete pelo topo do ranking",
} as const;
