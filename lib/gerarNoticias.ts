// lib/gerarNoticias.ts
//
// O GERADOR DE NOTÍCIAS DO HUB — transforma dados em frases.
//
// ---------------------------------------------------------------------------
// SEM IA, DE PROPÓSITO
//
// Tudo o que este mural mostra já existe na base: quem foi o melhor da rodada,
// que atleta pontuou mais, quem valorizou, quem foi mais escalado. Não é preciso
// nada a escrever — é preciso ler os dados e montar a frase.
//
// Isso corre de graça, todos os dias, sem depender de um serviço externo, sem
// custo por notícia, e sem o risco de uma frase gerada dizer algo errado sobre
// um jogador. Uma camada editorial com IA pode vir por cima disto mais tarde;
// o esqueleto factual tem de funcionar sozinho.
//
// ---------------------------------------------------------------------------
// A VOZ
//
// É o Blog do Dôdo, não um relatório. As frases são curtas, diretas e com
// alguma vida — "arrasou", "levou a melhor", "ninguém lhe tocou". Mas os NÚMEROS
// são sempre exatos: é sobre pessoas reais, e um número errado destrói a
// confiança mais depressa do que uma frase sem graça.
//
// Nunca se inventa contexto. Se só houve dois participantes, a notícia não diz
// "dominou a rodada" — diz o que aconteceu.
// ---------------------------------------------------------------------------

export interface NoticiaNova {
  tipo: string;
  /** País a que a notícia diz mais respeito ("BR"). Vazio = mundial. */
  pais?: string | null;
  /** Continente ("americas"). Vazio = mundial. Ver a nota sobre ORDENAR. */
  continente?: string | null;
  titulo: string;
  corpo: string;
  resumo: string;
  id_competicao?: string | null;
  nome_competicao?: string | null;
  dados?: Record<string, unknown>;
  destaque?: boolean;
}

/** Número com uma casa decimal, sem ".0" quando é inteiro. */
export function num(n: number): string {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

/**
 * Nome de EQUIPA entre aspas: "Relâmpago Marquinhos".
 *
 * Porquê: nas notícias aparecem lado a lado nomes de equipas (escolhidos pelos
 * jogadores) e nomes de atletas reais. Sem distinção visual, "Relâmpago
 * Marquinhos foi o melhor do mundo" lê-se como se fosse uma pessoa. As aspas
 * dizem, sem explicar nada, que aquilo é o nome de um time.
 */
export function equipa(nome: string): string {
  const n = String(nome || "").trim();
  return n ? `"${n}"` : "";
}

/** Último nome de um atleta, para as frases não ficarem intermináveis. */
export function apelido(nome: string): string {
  const p = String(nome || "").trim().split(/\s+/);
  return p.length > 1 ? p[p.length - 1] : (p[0] || "");
}

// --------------------------------------------------------------------------
// Cada função devolve uma notícia, ou null se não houver nada a dizer.
// Devolver null é uma decisão consciente: mais vale o mural ter três notícias
// verdadeiras do que seis, com metade a encher espaço.
// --------------------------------------------------------------------------

/** O nº1 da rodada (mundial ou de um continente). */
export function noticiaMelhorRodada(d: {
  nomeTime: string; pontos: number; escopo: string; continente: string;
  nParticipantes: number; idComp: string; nomeComp: string;
  /** Número da rodada no calendário (1..52). Sem ele o título fica ambíguo. */
  rodada?: number | null;
}): NoticiaNova | null {
  if (!d.nomeTime || d.pontos <= 0) return null;
  const mundial = d.escopo === "mundial";
  const onde = mundial ? "do mundo" : `de ${d.continente}`;
  const entre = d.nParticipantes > 1 ? ` entre ${d.nParticipantes} treinadores` : "";
  const eq = equipa(d.nomeTime);
  // A RODADA NO TÍTULO.
  //
  // "foi a melhor do mundo" lê-se como se fosse do ano inteiro — e no fim do
  // ano vamos ter mesmo notícias do melhor do ANO. Sem a rodada, as duas
  // confundem-se, e a de uma semana passa por um título anual.
  const naRodada = d.rodada ? ` na Rodada ${d.rodada}` : "";
  return {
    tipo: "melhor_rodada",
    titulo: mundial
      ? `${eq} foi a melhor do mundo${naRodada}`
      : `${eq} foi a melhor de ${d.continente}${naRodada}`,
    corpo: `Com ${num(d.pontos)} pontos em ${d.nomeComp}${d.rodada ? ` (Rodada ${d.rodada})` : ""}, a equipa ${eq} foi a melhor ${onde}${entre}. O certificado já está no perfil.`,
    resumo: `${eq} · ${num(d.pontos)} pts · melhor ${onde}${naRodada}`,
    id_competicao: d.idComp,
    nome_competicao: d.nomeComp,
    dados: { chave: `${d.escopo}-${d.continente}`, pontos: d.pontos, escopo: d.escopo },
    destaque: mundial,
  };
}

/**
 * Conta a história de uma campanha, luta a luta.
 *
 * Os dados existem: a Chave Maestro guarda, para cada atleta, com quem lutou,
 * se ganhou, e que ações fez em cada combate. Um resultado seco ("53 pontos")
 * não conta nada; "cinco lutas, quatro ippons, bateu o campeão nos quartos"
 * conta.
 *
 * Devolve "" quando não há detalhe — nem todas as competições têm moldura
 * montada, e uma frase inventada seria pior do que nenhuma.
 */
export function contarCampanha(
  lutas: { adv: string; venceu: boolean; i: number; w: number; y: number; s: number }[] | null,
  nomeDoAdversario: (id: string) => string,
): string {
  if (!lutas || lutas.length === 0) return "";
  const v = lutas.filter((l) => l.venceu).length;
  const d = lutas.length - v;
  const ippons = lutas.reduce((t, l) => t + (l.i || 0), 0);
  const wazas = lutas.reduce((t, l) => t + (l.w || 0), 0);

  const partes: string[] = [];
  partes.push(`Foram ${lutas.length} ${lutas.length === 1 ? "luta" : "lutas"}: ${v}V–${d}D.`);
  if (ippons > 0) {
    partes.push(ippons === 1 ? "Fechou uma com ippon." : `Fechou ${ippons} com ippon.`);
  } else if (wazas > 0) {
    partes.push(wazas === 1 ? "Marcou um waza-ari." : `Marcou ${wazas} waza-aris.`);
  }
  // Quem bateu: os nomes dão cara à campanha. Três chegam — mais do que isso
  // vira lista e deixa de se ler.
  const batidos = lutas.filter((l) => l.venceu).map((l) => nomeDoAdversario(l.adv)).filter(Boolean).slice(0, 3);
  if (batidos.length > 0) {
    partes.push(`Pelo caminho ficaram ${batidos.join(", ")}.`);
  }
  const perdeu = lutas.find((l) => !l.venceu);
  if (perdeu) {
    const quem = nomeDoAdversario(perdeu.adv);
    if (quem) partes.push(`A única derrota foi contra ${quem}.`);
  }
  return partes.join(" ");
}

/** O atleta que mais pontuou na competição. */
export function noticiaAtletaDestaque(d: {
  nome: string; pais: string; categoria: string; pontos: number;
  idComp: string; nomeComp: string;
  /** A campanha luta a luta, quando existe (ver contarCampanha). */
  campanha?: string;
  rodada?: number | null;
}): NoticiaNova | null {
  if (!d.nome || d.pontos <= 0) return null;
  const detalhe = d.campanha ? ` ${d.campanha}` : "";
  const naRodada = d.rodada ? ` · Rodada ${d.rodada}` : "";
  return {
    tipo: "atleta_destaque",
    titulo: `${apelido(d.nome)} arrasou em ${d.nomeComp}${naRodada}`,
    corpo: `${d.nome} (${d.pais}) somou ${num(d.pontos)} pontos nos ${d.categoria}kg — o melhor de toda a competição.${detalhe} Quem o tinha na equipa agradece.`,
    resumo: `${apelido(d.nome)} (${d.pais}) · ${num(d.pontos)} pts — o melhor da rodada`,
    id_competicao: d.idComp,
    nome_competicao: d.nomeComp,
    dados: { chave: "top", pontos: d.pontos, pais: d.pais },
    destaque: true,
  };
}

/** Quem mais subiu de preço. */
export function noticiaValorizacao(d: {
  nome: string; pais: string; de: number; para: number;
  idComp: string; nomeComp: string;
  campanha?: string;
}): NoticiaNova | null {
  const sub = d.para - d.de;
  if (!d.nome || sub <= 0) return null;
  const pct = d.de > 0 ? Math.round((sub / d.de) * 100) : 0;
  const detalhe = d.campanha ? ` ${d.campanha}` : "";
  return {
    tipo: "valorizacao",
    titulo: `${apelido(d.nome)} valorizou ${pct}%`,
    corpo: `Depois de ${d.nomeComp}, ${d.nome} (${d.pais}) subiu de JC ${num(d.de)} para JC ${num(d.para)}.${detalhe} Quem o tinha antes da rodada fez um bom negócio.`,
    resumo: `${apelido(d.nome)} · JC ${num(d.de)} → ${num(d.para)} (+${pct}%)`,
    id_competicao: d.idComp,
    nome_competicao: d.nomeComp,
    dados: { chave: "sobe", de: d.de, para: d.para },
  };
}

/** Quem mais caiu de preço. */
export function noticiaDesvalorizacao(d: {
  nome: string; pais: string; de: number; para: number;
  idComp: string; nomeComp: string;
  campanha?: string;
}): NoticiaNova | null {
  const queda = d.de - d.para;
  if (!d.nome || queda <= 0) return null;
  const pct = d.de > 0 ? Math.round((queda / d.de) * 100) : 0;
  const detalhe = d.campanha ? ` ${d.campanha}` : "";
  return {
    tipo: "desvalorizacao",
    titulo: `${apelido(d.nome)} caiu ${pct}%`,
    // Sem sarcasmo: é um atleta real, e quem o escalou já perdeu património.
    // A notícia informa, não gozar.
    corpo: `${d.nome} (${d.pais}) desceu de JC ${num(d.de)} para JC ${num(d.para)} depois de ${d.nomeComp}.${detalhe} Fica mais barato para quem acreditar na recuperação.`,
    resumo: `${apelido(d.nome)} · JC ${num(d.de)} → ${num(d.para)} (−${pct}%)`,
    id_competicao: d.idComp,
    nome_competicao: d.nomeComp,
    dados: { chave: "desce", de: d.de, para: d.para },
  };
}

/** O atleta que apareceu em mais equipas. */
export function noticiaMaisEscalado(d: {
  nome: string; pais: string; equipas: number; total: number;
  idComp: string; nomeComp: string;
}): NoticiaNova | null {
  // Com poucas equipas isto não diz nada — "o mais escalado, em 2 equipas" é
  // ruído. A partir de 5 começa a ter significado.
  if (!d.nome || d.total < 5) return null;
  const pct = Math.round((d.equipas / d.total) * 100);
  return {
    tipo: "mais_escalado",
    titulo: `${pct}% das equipas escalaram ${apelido(d.nome)}`,
    corpo: `${d.nome} (${d.pais}) foi o atleta mais escolhido para ${d.nomeComp}: apareceu em ${d.equipas} das ${d.total} equipas. Consenso ou armadilha?`,
    resumo: `${apelido(d.nome)} · em ${d.equipas} de ${d.total} equipas`,
    id_competicao: d.idComp,
    nome_competicao: d.nomeComp,
    dados: { chave: "escalado", equipas: d.equipas, total: d.total },
  };
}

/** Resumo das mudanças de faixa do mês. */
export function noticiaFaixas(d: {
  mes: string; subiram: number; desceram: number; total: number;
  topo: { nome: string; faixa: string } | null;
}): NoticiaNova | null {
  if (d.subiram === 0 && d.desceram === 0) return null;
  const partes: string[] = [];
  if (d.subiram > 0) partes.push(`${d.subiram} ${d.subiram === 1 ? "subiu" : "subiram"}`);
  if (d.desceram > 0) partes.push(`${d.desceram} ${d.desceram === 1 ? "desceu" : "desceram"}`);
  const topo = d.topo ? ` ${equipa(d.topo.nome)} está agora na faixa ${d.topo.faixa}.` : "";
  return {
    tipo: "faixas",
    titulo: "As faixas mudaram",
    corpo: `Fechou o mês e as faixas foram recalculadas: ${partes.join(" e ")} de faixa entre ${d.total} treinadores.${topo} A faixa mede o desempenho do mês — sobe-se e desce-se.`,
    resumo: `${partes.join(" · ")} de faixa este mês`,
    dados: { chave: d.mes, subiram: d.subiram, desceram: d.desceram },
    destaque: true,
  };
}

/** Uma copa que terminou. */
export function noticiaCopaCampeao(d: {
  nomeLiga: string; campeao: string; vice: string | null; participantes: number; ligaId: string;
}): NoticiaNova | null {
  if (!d.campeao) return null;
  const camp = equipa(d.campeao);
  const contra = d.vice ? ` Bateu ${equipa(d.vice)} na final.` : "";
  return {
    tipo: "copa_campeao",
    titulo: `${camp} venceu a ${d.nomeLiga}`,
    corpo: `Acabou o mata-mata da ${d.nomeLiga}, entre ${d.participantes} equipas.${contra} O certificado de campeão já está disponível.`,
    resumo: `${camp} · campeão da ${d.nomeLiga}`,
    dados: { chave: d.ligaId, participantes: d.participantes },
    destaque: true,
  };
}


// ===========================================================================
// NOTÍCIAS DE COMUNIDADE — quem está por cima, e porquê
//
// Estas não falam de uma rodada: falam do ESTADO do jogo. Quem acumulou mais,
// quem tem o maior património, quem vem a subir. São as que dão sentido a
// jogar entre competições — e as que mais alimentam a conversa.
// ===========================================================================

/**
 * O maior património, mundial ou de um continente.
 *
 * Não é o mesmo que "quem pontuou mais": o património vem das valorizações dos
 * atletas, ou seja, de escolher bem antes da rodada. Premeia olho de mercado, e
 * não só sorte na escalação.
 */
export function noticiaMaisRico(d: {
  nomeTime: string; patrimonio: number; escopo: "mundial" | "continental";
  continente?: string; segundo?: { nomeTime: string; patrimonio: number } | null;
  escudo?: unknown;
}): NoticiaNova | null {
  if (!d.nomeTime || d.patrimonio <= 0) return null;
  const mundial = d.escopo === "mundial";
  const onde = mundial ? "do mundo" : `de ${d.continente}`;
  const eq = equipa(d.nomeTime);
  // A distância para o segundo é o que torna isto uma corrida em vez de uma
  // lista. "Lidera por 3 JC" faz querer voltar; "tem 128 JC" não diz nada.
  const dist = d.segundo && d.segundo.patrimonio > 0
    ? ` ${equipa(d.segundo.nomeTime)} vem logo atrás, a ${num(d.patrimonio - d.segundo.patrimonio)} JC.`
    : "";
  return {
    tipo: "mais_rico",
    titulo: mundial ? `${eq} é a equipa mais rica do mundo` : `${eq} lidera o património ${onde}`,
    corpo: `Com JC ${num(d.patrimonio)} de património, ${eq} é a equipa mais valiosa ${onde}.${dist} O património cresce quando os atletas escalados valorizam — é mercado, não só pontos.`,
    resumo: `${eq} · JC ${num(d.patrimonio)} · maior património ${onde}`,
    dados: { chave: `rico-${d.escopo}-${d.continente || "mundo"}`, patrimonio: d.patrimonio, escudo: d.escudo ?? null },
    continente: mundial ? null : (d.continente || null),
    destaque: mundial,
  };
}

/**
 * Quem acumulou mais pontos ao longo do tempo (não numa rodada).
 *
 * É a corrida de fundo: quem aparece sempre. Diferente do "melhor da rodada",
 * que pode ser sorte de um fim de semana.
 */
export function noticiaLiderPontos(d: {
  nomeTime: string; pontos: number; rodadas: number;
  escopo: "mundial" | "continental"; continente?: string;
  segundo?: { nomeTime: string; pontos: number } | null;
  escudo?: unknown;
}): NoticiaNova | null {
  if (!d.nomeTime || d.pontos <= 0) return null;
  const mundial = d.escopo === "mundial";
  const onde = mundial ? "mundial" : d.continente || "";
  const eq = equipa(d.nomeTime);
  const media = d.rodadas > 0 ? num(d.pontos / d.rodadas) : "";
  const porRodada = media ? ` São ${media} pontos por rodada, em ${d.rodadas}.` : "";
  const dist = d.segundo && d.segundo.pontos > 0
    ? ` A vantagem para ${equipa(d.segundo.nomeTime)} é de ${num(d.pontos - d.segundo.pontos)} pontos.`
    : "";
  return {
    tipo: "lider_pontos",
    titulo: mundial ? `${eq} lidera o ranking mundial` : `${eq} manda em ${onde}`,
    corpo: `${eq} soma ${num(d.pontos)} pontos e é quem está por cima ${mundial ? "no mundo" : `em ${onde}`}.${porRodada}${dist}`,
    resumo: `${eq} · ${num(d.pontos)} pts · líder ${mundial ? "mundial" : onde}`,
    dados: { chave: `lider-${d.escopo}-${d.continente || "mundo"}`, pontos: d.pontos, escudo: d.escudo ?? null },
    continente: mundial ? null : (d.continente || null),
    destaque: mundial,
  };
}

/**
 * O percurso de um campeão de mata-mata — por quem passou, ronda a ronda.
 *
 * Só para as ligas OFICIAIS (mundial e continental). Uma copa entre amigos não
 * é notícia para o mural; a mundial é.
 */
export function noticiaPercursoCampeao(d: {
  nomeLiga: string; campeao: string; participantes: number; ligaId: string;
  // Ronda a ronda: quem enfrentou e com que pontuação.
  percurso: { ronda: string; adversario: string; meus: number; dele: number }[];
  escudo?: unknown;
}): NoticiaNova | null {
  if (!d.campeao || d.percurso.length === 0) return null;
  const eq = equipa(d.campeao);
  const linhas = d.percurso.map((p) => `${p.ronda}: bateu ${equipa(p.adversario)} por ${num(p.meus)}–${num(p.dele)}`);
  // A luta mais renhida é a que se conta. Um caminho todo folgado não tem
  // história; uma final por meio ponto tem.
  const maisRenhida = [...d.percurso].sort((a, b) => (a.meus - a.dele) - (b.meus - b.dele))[0];
  const drama = maisRenhida && (maisRenhida.meus - maisRenhida.dele) < 10
    ? ` O momento mais renhido foi ${maisRenhida.ronda.toLowerCase()}, decidido por ${num(maisRenhida.meus - maisRenhida.dele)} pontos.`
    : "";
  return {
    tipo: "percurso_campeao",
    titulo: `O caminho de ${eq} até ao título`,
    corpo: `${eq} venceu a ${d.nomeLiga} entre ${d.participantes} equipas.\n\n${linhas.join("\n")}\n\n${drama.trim()}`,
    resumo: `${eq} · campeão da ${d.nomeLiga} · ${d.percurso.length} rondas`,
    dados: { chave: `percurso-${d.ligaId}`, escudo: d.escudo ?? null },
    destaque: true,
  };
}


// ===========================================================================
// BALANÇO DO ANO — geradas a 1 de janeiro
//
// Estas são as ÚNICAS que podem dizer "do ano" sem ambiguidade. Todas as
// outras têm de trazer a rodada no título, senão confundem-se com estas: uma
// notícia semanal que diga "foi a melhor do mundo" parece um título anual.
// ===========================================================================

/** O campeão do ano — mundial ou de um continente. */
export function noticiaCampeaoAno(d: {
  nomeTime: string; pontos: number; ano: number;
  escopo: "mundial" | "continental"; continente?: string;
  rodadas: number; segundo?: { nomeTime: string; pontos: number } | null;
  escudo?: unknown;
}): NoticiaNova | null {
  if (!d.nomeTime || d.pontos <= 0) return null;
  const mundial = d.escopo === "mundial";
  const onde = mundial ? "do mundo" : `de ${d.continente}`;
  const eq = equipa(d.nomeTime);
  const media = d.rodadas > 0 ? ` Foram ${num(d.pontos / d.rodadas)} pontos por rodada, ao longo de ${d.rodadas}.` : "";
  const dist = d.segundo && d.segundo.pontos > 0
    ? ` ${equipa(d.segundo.nomeTime)} ficou a ${num(d.pontos - d.segundo.pontos)} pontos.`
    : "";
  return {
    tipo: "campeao_ano",
    titulo: mundial
      ? `${eq} é a campeã mundial de ${d.ano}`
      : `${eq} é a campeã de ${d.continente} em ${d.ano}`,
    corpo: `Fechou o ano, e ${eq} termina ${d.ano} como a melhor equipa ${onde}, com ${num(d.pontos)} pontos.${media}${dist} Um ano inteiro no topo — não foi sorte de uma rodada.`,
    resumo: `${eq} · ${num(d.pontos)} pts · campeã ${onde} de ${d.ano}`,
    dados: { chave: `campeao-${d.ano}-${d.escopo}-${d.continente || "mundo"}`, ano: d.ano, escudo: d.escudo ?? null },
    continente: mundial ? null : (d.continente || null),
    destaque: true,
  };
}

/** O maior património no fecho do ano. */
export function noticiaRicoAno(d: {
  nomeTime: string; patrimonio: number; ano: number;
  escopo: "mundial" | "continental"; continente?: string;
  escudo?: unknown;
}): NoticiaNova | null {
  if (!d.nomeTime || d.patrimonio <= 0) return null;
  const mundial = d.escopo === "mundial";
  const onde = mundial ? "do mundo" : `de ${d.continente}`;
  const eq = equipa(d.nomeTime);
  // O património começa em 100 para todos, por isso a diferença para esse valor
  // é a medida real do que se ganhou no mercado ao longo do ano.
  const ganho = d.patrimonio - 100;
  const quanto = ganho > 0
    ? ` Começou o ano com JC 100 e ganhou JC ${num(ganho)} só a comprar e vender bem.`
    : "";
  return {
    tipo: "rico_ano",
    titulo: mundial
      ? `${eq} fecha ${d.ano} como a equipa mais rica do mundo`
      : `${eq} é a mais rica ${onde} em ${d.ano}`,
    corpo: `Com JC ${num(d.patrimonio)}, ${eq} termina ${d.ano} com o maior património ${onde}.${quanto} O património não vem de pontos: vem de escolher os atletas certos antes de eles valorizarem.`,
    resumo: `${eq} · JC ${num(d.patrimonio)} · maior património de ${d.ano}`,
    dados: { chave: `rico-ano-${d.ano}-${d.escopo}-${d.continente || "mundo"}`, ano: d.ano, escudo: d.escudo ?? null },
    continente: mundial ? null : (d.continente || null),
    destaque: true,
  };
}
