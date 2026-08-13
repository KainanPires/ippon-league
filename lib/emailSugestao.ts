// lib/emailSugestao.ts
//
// "Quis dizer @gmail.com?" — deteção de erros de escrita no domínio do email.
//
// ---------------------------------------------------------------------------
// PORQUE ISTO EXISTE
//
// Havia uma conta na base com o email `...@gamil.com` — "gamil", não "gmail".
// Endereço que não existe, e que ninguém apanhou até construirmos a verificação
// por email. A pessoa nunca receberia nada: nem avisos de rodada, nem recuperação
// de senha, nem recibo nenhum quando começarmos a cobrar.
//
// O QUE ISTO NÃO FAZ (e não pode fazer):
//
// Não verifica se o email EXISTE. Isso não é possível do lado do cliente — nem
// o Google publica essa informação, porque seria uma porta aberta a quem procura
// endereços válidos. A única prova real é a que já temos: quem não confirma a
// ligação, não tem email válido.
//
// Também NÃO limita a domínios conhecidos. Chegou a ser considerado ("só Gmail,
// Hotmail, Yahoo") e seria um erro: atletas e federações usam email do próprio
// domínio — @fpj.pt, @ijf.org, @cbj.com.br. Bloquear esses seria bloquear
// precisamente quem mais interessa atrair.
//
// O que faz é apanhar erros de ESCRITA: quando o que foi escrito está a um ou
// dois caracteres de um domínio muito comum, sugere-se a correção. Nunca
// bloqueia — a pessoa pode ter mesmo um email nesse domínio.
//
// IDIOMA: a mensagem sai na língua da pessoa. Como este é um módulo puro (não é
// componente, não pode chamar hooks), recebe o tradutor `t` — o mesmo de useT —
// por parâmetro. O ecrã que chama passa o seu `t`.
// ---------------------------------------------------------------------------

// O tradutor, tal como useT() o devolve.
export type Tradutor = (chave: string, vars?: Record<string, string | number>) => string;

/** Domínios comuns o suficiente para valer a pena comparar. */
const DOMINIOS_COMUNS = [
  "gmail.com", "hotmail.com", "outlook.com", "outlook.pt", "hotmail.pt",
  "yahoo.com", "yahoo.com.br", "icloud.com", "me.com", "live.com",
  "sapo.pt", "protonmail.com", "proton.me", "aol.com", "bol.com.br",
  "uol.com.br", "terra.com.br", "globo.com", "msn.com", "mail.com",
];

/**
 * Serviços de email descartável — existem para contornar verificações.
 * Numa app com subscrição, uma conta destas nunca receberá um recibo.
 */
const DESCARTAVEIS = [
  "tempmail.com", "temp-mail.org", "10minutemail.com", "guerrillamail.com",
  "mailinator.com", "throwawaymail.com", "yopmail.com", "trashmail.com",
  "sharklasers.com", "getnada.com", "maildrop.cc", "fakeinbox.com",
];

/**
 * Distância de edição entre duas palavras (quantas alterações são precisas para
 * transformar uma na outra). "gamil" -> "gmail" são 2: uma troca de posição.
 *
 * Implementação clássica, curta de propósito: são domínios de 10-15 letras, não
 * vale a pena optimizar nada.
 */
function distancia(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let anterior = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const atual = [i];
    for (let j = 1; j <= n; j++) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1;
      atual[j] = Math.min(atual[j - 1] + 1, anterior[j] + 1, anterior[j - 1] + custo);
    }
    anterior = atual;
  }
  return anterior[n];
}

export interface AvisoEmail {
  /** "sugestao" = provável erro de escrita; "descartavel" = email temporário. */
  tipo: "sugestao" | "descartavel";
  /** Texto para mostrar ao utilizador. */
  mensagem: string;
  /** Só em "sugestao": o email já corrigido, para o botão "Sim, corrigir". */
  corrigido?: string;
}

/**
 * Analisa um email e devolve um aviso, ou null se não houver nada a dizer.
 *
 * Nunca devolve "inválido": a validação de formato é outra coisa, e continua a
 * ser feita onde já era. Isto é só um alerta amigável. `t` traduz a mensagem
 * para a língua da pessoa.
 */
export function avisoDoEmail(email: string, t: Tradutor): AvisoEmail | null {
  const limpo = (email || "").trim().toLowerCase();
  const arroba = limpo.lastIndexOf("@");
  if (arroba < 1) return null;
  const dominio = limpo.slice(arroba + 1);
  const utilizador = limpo.slice(0, arroba);
  if (!dominio.includes(".")) return null;

  if (DESCARTAVEIS.includes(dominio)) {
    return {
      tipo: "descartavel",
      mensagem: t("email.avisoDescartavel"),
    };
  }

  // Exatamente igual a um domínio comum: nada a dizer.
  if (DOMINIOS_COMUNS.includes(dominio)) return null;

  // A um ou dois caracteres de um domínio comum? Provável erro de escrita.
  // Dois é o suficiente para apanhar "gamil" (troca de letras) e "hotmial",
  // sem sugerir disparates a quem tem um domínio próprio parecido.
  let melhor: { dominio: string; d: number } | null = null;
  for (const c of DOMINIOS_COMUNS) {
    const d = distancia(dominio, c);
    if (d > 0 && d <= 2 && (!melhor || d < melhor.d)) melhor = { dominio: c, d };
  }
  if (!melhor) return null;

  return {
    tipo: "sugestao",
    mensagem: t("email.avisoSugestao", { dominio: melhor.dominio }),
    corrigido: `${utilizador}@${melhor.dominio}`,
  };
}
