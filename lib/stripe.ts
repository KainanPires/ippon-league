// lib/stripe.ts
//
// LIGAÇÃO À STRIPE — sem biblioteca.
//
// Fala-se com a API REST da Stripe por fetch. Não se usa o pacote `stripe` de
// propósito: o fluxo de trabalho deste projeto é colar ficheiros no GitHub, e
// acrescentar uma dependência obrigaria a mexer no package.json e a arriscar um
// deploy partido por causa de um lockfile desatualizado. A API da Stripe é
// estável e bem documentada; o que se perde em conveniência ganha-se em não ter
// mais nada que possa avariar.
//
// ---------------------------------------------------------------------------
// OS PREÇOS ESTÃO AQUI, NÃO NAS VARIÁVEIS DE AMBIENTE
//
// Um identificador de preço não é um segredo — é público, aparece no ecrã de
// pagamento. Mantê-los aqui reduz a configuração da Vercel a dois segredos e
// deixa-os à vista de quem lê o código.
//
// SE MUDARES UM PREÇO NA STRIPE: não se edita um preço existente, cria-se um
// novo dentro do mesmo produto e arquiva-se o antigo. Depois troca-se aqui o
// identificador. Quem já subscreveu continua no preço antigo, que é o que a lei
// exige e o que as pessoas esperam.
// ---------------------------------------------------------------------------

export const PRECOS = {
  /** Ippon Pro — 7,99 EUR/mês, IVA incluído. */
  pro: "price_1U1pPOL7BDFsSLZGkewypShE",
  /** Ippon Pro Max — 11,99 EUR/mês, IVA incluído. */
  promax: "price_1U25ygL7BDFsSLZGzZDgaxzj",
  /** Subida para Pro Max fora dos 7 dias — 4,99 EUR, cobrança única. */
  subida: "price_1U260fL7BDFsSLZGxrbJLeiv",
} as const;

/** Dias de teste grátis para quem nunca subscreveu. */
export const DIAS_TESTE = 7;

/**
 * Os cupões da promoção de lançamento.
 *
 * O DESCONTO É AUTOMÁTICO — ninguém escreve código nenhum. A sessão de pagamento
 * leva o cupão colado, e quem abre a página vê logo o preço com desconto.
 *
 * Fazer disto um código que a pessoa tem de saber seria transformar uma
 * promoção para todos num enigma para alguns: quem não reparasse pagava o preço
 * cheio e depois escrevia a reclamar, com razão.
 *
 * QUANDO A PROMOÇÃO ACABA: a data limite está na Stripe, no próprio cupão. A
 * partir daí ela recusa o cupão, e a rota do checkout volta a tentar sem ele
 * (ver o comentário lá). Assim a promoção termina sozinha, sem ninguém ter de
 * mudar código — e, sobretudo, sem o risco de a app deixar de vender por causa
 * de uma data esquecida em dois sítios diferentes.
 */
export const CUPOES = {
  pro: "lancamento-pro",
  promax: "lancamento-promax",
} as const;

export type Nivel = "pro" | "promax";

/**
 * Que nível corresponde a um preço.
 *
 * É por aqui que o webhook sabe o que dar a quem paga: a Stripe diz qual o preço
 * da subscrição, e isto traduz para o nível da app. Um preço desconhecido
 * devolve null, e quem trata do webhook ignora em vez de adivinhar — dar o nível
 * errado é pior do que não dar nada.
 */
export function nivelDoPreco(priceId: string | null | undefined): Nivel | null {
  if (!priceId) return null;
  if (priceId === PRECOS.pro) return "pro";
  if (priceId === PRECOS.promax) return "promax";
  return null;
}

/**
 * Codifica um objeto no formato que a Stripe espera: chaves aninhadas com
 * parênteses retos, como `subscription_data[trial_period_days]=7`. A API não
 * aceita JSON nos pedidos — só form-urlencoded.
 */
export function paraFormulario(obj: Record<string, unknown>, prefixo = ""): string {
  const partes: string[] = [];

  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const chave = prefixo ? `${prefixo}[${k}]` : k;

    if (Array.isArray(v)) {
      v.forEach((item, i) => {
        if (item !== null && typeof item === "object") {
          partes.push(paraFormulario(item as Record<string, unknown>, `${chave}[${i}]`));
        } else {
          partes.push(`${encodeURIComponent(`${chave}[${i}]`)}=${encodeURIComponent(String(item))}`);
        }
      });
    } else if (typeof v === "object") {
      partes.push(paraFormulario(v as Record<string, unknown>, chave));
    } else {
      partes.push(`${encodeURIComponent(chave)}=${encodeURIComponent(String(v))}`);
    }
  }

  return partes.filter(Boolean).join("&");
}

/**
 * Um pedido à API da Stripe.
 *
 * Lança em caso de erro, com a mensagem que a Stripe devolveu — que costuma ser
 * clara e vale mais do que um "falhou" genérico nos registos.
 */
export async function stripeFetch<T = Record<string, unknown>>(
  caminho: string,
  metodo: "GET" | "POST" = "GET",
  corpo?: Record<string, unknown>,
): Promise<T> {
  const chave = process.env.STRIPE_SECRET_KEY;
  if (!chave) throw new Error("Falta a STRIPE_SECRET_KEY.");

  const opcoes: RequestInit = {
    method: metodo,
    headers: {
      Authorization: `Bearer ${chave}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  };
  if (corpo && metodo === "POST") opcoes.body = paraFormulario(corpo);

  const res = await fetch(`https://api.stripe.com/v1/${caminho}`, opcoes);
  const dados = await res.json();

  if (!res.ok) {
    const msg = (dados as { error?: { message?: string } })?.error?.message || `Stripe respondeu ${res.status}`;
    throw new Error(msg);
  }
  return dados as T;
}

/**
 * Confirma que um webhook veio mesmo da Stripe.
 *
 * SEM ISTO, QUALQUER PESSOA PODIA DAR-SE PRO A SI PRÓPRIA. O endereço do webhook
 * é público; sem verificar a assinatura, bastava enviar-lhe um pedido a fingir
 * um pagamento. É a verificação mais importante de toda a integração.
 *
 * A Stripe assina o corpo EXATO do pedido com o segredo do webhook. Por isso o
 * corpo tem de ser lido como texto puro (req.text()) e nunca como JSON: bastava
 * o JSON.parse reordenar uma chave para a assinatura deixar de bater certo.
 *
 * @param corpoTexto o corpo em bruto, tal como chegou
 * @param assinatura o cabeçalho `stripe-signature`
 * @param segredo    o whsec_... da configuração do webhook
 * @param toleranciaSegundos janela aceite, para travar reenvios de pedidos
 *                   antigos capturados por terceiros
 */
export async function verificarAssinatura(
  corpoTexto: string,
  assinatura: string | null,
  segredo: string | undefined,
  toleranciaSegundos = 300,
): Promise<boolean> {
  if (!assinatura || !segredo) return false;

  // O cabeçalho é do género: t=1692000000,v1=abc123,v0=...
  let t = "";
  const v1: string[] = [];
  for (const parte of assinatura.split(",")) {
    const [k, valor] = parte.split("=");
    if (k?.trim() === "t") t = (valor || "").trim();
    if (k?.trim() === "v1") v1.push((valor || "").trim());
  }
  if (!t || v1.length === 0) return false;

  // Pedido demasiado antigo: recusa. Protege contra alguém que tenha capturado
  // um webhook legítimo e o reenvie mais tarde.
  const idade = Math.abs(Math.floor(Date.now() / 1000) - Number(t));
  if (!Number.isFinite(idade) || idade > toleranciaSegundos) return false;

  const { createHmac, timingSafeEqual } = await import("crypto");
  const esperado = createHmac("sha256", segredo).update(`${t}.${corpoTexto}`).digest("hex");

  // Comparação de tempo constante: uma comparação normal demora mais quanto
  // mais caracteres coincidirem, e isso deixa adivinhar a assinatura byte a byte.
  return v1.some((assin) => {
    try {
      const a = Buffer.from(assin, "hex");
      const b = Buffer.from(esperado, "hex");
      return a.length === b.length && timingSafeEqual(a, b);
    } catch {
      return false;
    }
  });
}
