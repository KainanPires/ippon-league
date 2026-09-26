// lib/referencias.ts
//
// MODELO DE EXAME — valores de referência da Ippon League.
//
// A ideia (decidida com o Kainan): nenhum número deve aparecer "cru". Cada
// sinal — uma duração, um contador de erros, o tempo desde a última corrida de
// um cron — lê-se como uma linha de exame laboratorial:
//
//     observado   |   esperado (o normal)   |   limite (até onde se tolera)
//
// A partir dos três, o estado sai sozinho:
//   🟢 ok      — dentro do esperado
//   🟡 aviso   — passou o esperado mas ainda dentro do limite
//   🔴 alarme  — passou o limite
//
// Os valores de referência vivem TODOS aqui, num só sítio, para que a app
// inteira fale a mesma língua e qualquer análise ou alerta se explique sozinho.
// Quando um número muda de significado, muda-se aqui — e muda em todo o lado.

export type Estado = "ok" | "aviso" | "alarme";

// Como se lê o número contra a referência:
//   acima_pior    — quanto MAIOR, pior (durações, erros). esperado/limite são tetos.
//   abaixo_pior   — quanto MENOR, pior (ex.: % de sucesso). esperado/limite são mínimos.
//   fora_intervalo — o bom é ficar DENTRO de um intervalo; fora dele piora.
export type Direcao = "acima_pior" | "abaixo_pior" | "fora_intervalo";

export interface DefRef {
  rotulo: string;
  unidade?: string;
  // número único, ou [min, max] quando a direção é "fora_intervalo".
  esperado: number | [number, number];
  limite: number | [number, number];
  direcao: Direcao;
  ajuda?: string; // o que significa / o que fazer quando acende
}

export interface Leitura {
  chave: string;
  rotulo: string;
  observado: number;
  esperado: string; // já formatado ("≤ 5000 ms", "0", "1–3")
  limite: string;
  estado: Estado;
  unidade?: string;
  ajuda?: string;
}

// Contexto que aperta ou alarga uma referência conforme o momento.
// Ex.: durante uma competição AO VIVO, o chave-maestro devia correr de minuto a
// minuto, por isso o "tempo desde a última corrida" é avaliado com mais rigor.
export interface CtxRef {
  aoVivo?: boolean;
}

type FonteRef = DefRef | ((ctx: CtxRef) => DefRef);

// ---------------------------------------------------------------------------
// Núcleo: classificar e formatar.
// ---------------------------------------------------------------------------
function limiteNum(x: number | [number, number], lado: "baixo" | "cima"): number {
  if (Array.isArray(x)) return lado === "baixo" ? x[0] : x[1];
  return x;
}

function classifica(obs: number, def: DefRef): Estado {
  if (def.direcao === "acima_pior") {
    const esp = limiteNum(def.esperado, "cima");
    const lim = limiteNum(def.limite, "cima");
    if (obs <= esp) return "ok";
    if (obs <= lim) return "aviso";
    return "alarme";
  }
  if (def.direcao === "abaixo_pior") {
    const esp = limiteNum(def.esperado, "baixo");
    const lim = limiteNum(def.limite, "baixo");
    if (obs >= esp) return "ok";
    if (obs >= lim) return "aviso";
    return "alarme";
  }
  // fora_intervalo
  const esp = def.esperado as [number, number];
  const lim = def.limite as [number, number];
  if (obs >= esp[0] && obs <= esp[1]) return "ok";
  if (obs >= lim[0] && obs <= lim[1]) return "aviso";
  return "alarme";
}

function sufixo(def: DefRef): string {
  return def.unidade ? ` ${def.unidade}` : "";
}

function descreve(v: number | [number, number], def: DefRef): string {
  if (def.direcao === "fora_intervalo") {
    const par = v as [number, number];
    return `${par[0]}–${par[1]}${sufixo(def)}`;
  }
  const n = limiteNum(v, def.direcao === "abaixo_pior" ? "baixo" : "cima");
  const sinal = def.direcao === "acima_pior" ? "≤" : "≥";
  // Caso especial de leitura: quando esperado é 0 num "acima_pior", "≤ 0" lê-se
  // melhor como "0" (zero erros), mas mantemos o ≤ para não enganar com limites.
  return `${sinal} ${n}${sufixo(def)}`;
}

// ---------------------------------------------------------------------------
// avaliar — transforma um número observado numa Leitura de exame.
// ---------------------------------------------------------------------------
export function avaliar(chave: string, observado: number, ctx: CtxRef = {}): Leitura {
  const fonte = REFERENCIAS[chave];
  const def = typeof fonte === "function" ? fonte(ctx) : fonte;
  if (!def) {
    // Sem referência definida: devolve a leitura sem julgar (mostra o número,
    // não inventa um estado). Serve de rede — nunca rebenta por chave nova.
    return { chave, rotulo: chave, observado, esperado: "—", limite: "—", estado: "ok" };
  }
  return {
    chave,
    rotulo: def.rotulo,
    observado,
    esperado: descreve(def.esperado, def),
    limite: descreve(def.limite, def),
    estado: classifica(observado, def),
    unidade: def.unidade,
    ajuda: def.ajuda,
  };
}

export function avaliarVarias(obs: Record<string, number>, ctx: CtxRef = {}): Leitura[] {
  return Object.entries(obs).map(([k, v]) => avaliar(k, v, ctx));
}

// O estado geral de um conjunto é o PIOR de todos (um 🔴 pinta tudo de 🔴).
// Aceita qualquer coisa com um campo `estado` (Leitura, ou só { estado }).
export function piorEstado(itens: Array<{ estado: Estado }>): Estado {
  if (itens.some((l) => l.estado === "alarme")) return "alarme";
  if (itens.some((l) => l.estado === "aviso")) return "aviso";
  return "ok";
}

export const SINAL: Record<Estado, string> = { ok: "🟢", aviso: "🟡", alarme: "🔴" };
export const ROTULO_ESTADO: Record<Estado, string> = { ok: "OK", aviso: "Aviso", alarme: "Alarme" };

// ===========================================================================
// CATÁLOGO DE REFERÊNCIAS — os "valores normais" do exame da Ippon League.
// Uma linha por sinal. Mexe aqui para recalibrar; muda em todo o lado.
// ===========================================================================
export const REFERENCIAS: Record<string, FonteRef> = {
  // --- CRON PRINCIPAL (/api/cron) — corre de hora a hora -------------------
  "cron.duracao_ms": {
    rotulo: "Duração da corrida",
    unidade: "ms",
    esperado: 240_000, // MS_ORCAMENTO: trabalha até aqui e guarda folga
    limite: 300_000, // maxDuration da função na Vercel
    direcao: "acima_pior",
    ajuda: "Passou o orçamento: alguma etapa arrastou-se. Ver 'passos' e congelamentos.",
  },
  "cron.intervalo_min": {
    rotulo: "Tempo desde a última corrida",
    unidade: "min",
    esperado: 75, // corre a cada 60 min; 75 dá margem
    limite: 180, // 3 falhas seguidas = investigar
    direcao: "acima_pior",
    ajuda: "O cron principal pode ter parado. Confirmar o agendador (cron-job.org / Vercel).",
  },
  "cron.congelar_erros": {
    rotulo: "Erros a gravar (congelamento)",
    esperado: 0,
    limite: 0, // qualquer erro de escrita é grave: pontos/preços/património
    direcao: "acima_pior",
    ajuda: "Atletas que a base de dados recusou. Pontos e preços podem ficar errados.",
  },
  "cron.marcas_falhadas": {
    rotulo: "Marcas de 'uma vez' que não gravaram",
    esperado: 0,
    limite: 0,
    direcao: "acima_pior",
    ajuda: "Uma tarefa periódica (faixas, fecho de ano) pode repetir-se e re-notificar.",
  },
  "cron.precos_categorias_falhadas": {
    rotulo: "Categorias de preços por gravar",
    esperado: 0,
    limite: 3, // o JudoBase falha uma ou outra; a corrida seguinte recupera
    direcao: "acima_pior",
    ajuda: "Preços atrasados algumas horas. Só é grave se persistir várias corridas.",
  },
  "cron.congelamento_parou_por_tempo": {
    rotulo: "Congelamento interrompido por tempo",
    esperado: 0,
    limite: 1, // acontece em competições grandes; retoma na próxima corrida
    direcao: "acima_pior",
    ajuda: "Normal em competições grandes — desde que a corrida seguinte termine o resto.",
  },

  // --- CHAVE-MAESTRO (/api/chave-maestro) — ao vivo, de minuto a minuto -----
  "maestro.duracao_ms": {
    rotulo: "Duração do maestro",
    unidade: "ms",
    esperado: 5_000, // ORCAMENTO_MS
    limite: 10_000, // teto de função no plano Hobby
    direcao: "acima_pior",
    ajuda: "Perto de 10s rebenta no Hobby. Baixar o LOTE_ATLETAS ou o orçamento.",
  },
  "maestro.intervalo_min": (ctx) => ({
    rotulo: "Tempo desde a última corrida do maestro",
    unidade: "min",
    // Ao vivo, tem de correr de minuto a minuto — é o que dá pontuação em tempo
    // real. Fora de competição, uma falha esporádica não faz mal.
    esperado: ctx.aoVivo ? 3 : 10,
    limite: ctx.aoVivo ? 10 : 30,
    direcao: "acima_pior",
    ajuda: "Durante uma competição, a pontuação ao vivo pára se o maestro parar.",
  }),
  "maestro.categorias_falhadas": {
    rotulo: "Categorias que falharam (maestro)",
    esperado: 0,
    limite: 2,
    direcao: "acima_pior",
    ajuda: "Molduras ou API em falta nessas categorias. Se persistir, verificar chave_atletas.",
  },
  "maestro.atletas_falhas": {
    rotulo: "Atletas sem leitura ao vivo",
    esperado: 0,
    limite: 10, // o JudoBase ao vivo falha pedidos avulsos
    direcao: "acima_pior",
    ajuda: "Falhas pontuais de rede ao JudoBase. Recupera na corrida seguinte.",
  },

  // --- CHAVE-VIVA (/api/chave-viva) — ao vivo, de 2 em 2 minutos -----------
  "chaveviva.duracao_ms": {
    rotulo: "Duração do chave-viva",
    unidade: "ms",
    esperado: 22_000, // MS_ORCAMENTO
    limite: 30_000, // o cron-job.org corta aqui
    direcao: "acima_pior",
    ajuda: "Perto de 30s o cron-job.org corta a corrida. Baixar categorias por corrida.",
  },
  "chaveviva.intervalo_min": (ctx) => ({
    rotulo: "Tempo desde a última corrida do chave-viva",
    unidade: "min",
    esperado: ctx.aoVivo ? 6 : 15,
    limite: ctx.aoVivo ? 15 : 40,
    direcao: "acima_pior",
    ajuda: "Alimenta a chave ao vivo. Se parar durante a competição, a chave deixa de atualizar.",
  }),
  "chaveviva.falhas_judobase": {
    rotulo: "Atletas sem leitura (chave-viva)",
    esperado: 0,
    limite: 10,
    direcao: "acima_pior",
    ajuda: "Falhas pontuais ao JudoBase; recupera no ciclo seguinte.",
  },

  // --- CONGELAR (lib/congelar, dentro do cron principal) -------------------
  "congelar.erros_gravacao": {
    rotulo: "Erros a gravar por competição",
    esperado: 0,
    limite: 0,
    direcao: "acima_pior",
    ajuda: "A competição não fecha e é tentada de novo. Se persistir, ver a base de dados.",
  },
  "congelar.patrimonio_falhados": {
    rotulo: "Utilizadores sem património gravado",
    esperado: 0,
    limite: 0,
    direcao: "acima_pior",
    ajuda: "O património é recalculado do zero; se o mesmo número persistir, há algo preso.",
  },

  // --- EXPIRAR (/api/subscricoes/expirar) — corre uma vez por dia -----------
  // A rede de segurança das subscrições: corta o Pro a quem já não paga. Corre
  // silenciosa e mexe em dinheiro/acesso, por isso vale a pena vê-la de longe.
  "expirar.duracao_ms": {
    rotulo: "Duração da corrida (expirar)",
    unidade: "ms",
    // Cada candidato leva um pedido à Stripe; com muitos lapsos de uma vez a
    // corrida alonga-se. Folgado de propósito — é diária, não ao vivo.
    esperado: 30_000,
    limite: 60_000,
    direcao: "acima_pior",
    ajuda: "Muitos candidatos ou a Stripe lenta. Se persistir, paginar a leitura de candidatos.",
  },
  "expirar.stripe_falhas": {
    rotulo: "Utilizadores sem resposta da Stripe",
    esperado: 0,
    // Uma falha avulsa à Stripe recupera amanhã; um pico significa que os
    // rebaixamentos pararam — há quem fique com Pro sem pagar.
    limite: 3,
    direcao: "acima_pior",
    ajuda: "Falhas a consultar a Stripe. Um pico = os cortes pararam; confirmar chave/estado da Stripe.",
  },
};
