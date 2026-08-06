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
}): NoticiaNova | null {
  if (!d.nomeTime || d.pontos <= 0) return null;
  const mundial = d.escopo === "mundial";
  const onde = mundial ? "do mundo" : `de ${d.continente}`;
  const entre = d.nParticipantes > 1 ? ` entre ${d.nParticipantes} treinadores` : "";
  return {
    tipo: "melhor_rodada",
    titulo: mundial ? `${d.nomeTime} foi o melhor do mundo` : `${d.nomeTime} lidera ${d.continente}`,
    corpo: `Com ${num(d.pontos)} pontos em ${d.nomeComp}, ${d.nomeTime} foi a melhor equipa ${onde}${entre}. O certificado já está no perfil.`,
    resumo: `${d.nomeTime} · ${num(d.pontos)} pts · melhor ${onde}`,
    id_competicao: d.idComp,
    nome_competicao: d.nomeComp,
    dados: { chave: `${d.escopo}-${d.continente}`, pontos: d.pontos, escopo: d.escopo },
    destaque: mundial,
  };
}

/** O atleta que mais pontuou na competição. */
export function noticiaAtletaDestaque(d: {
  nome: string; pais: string; categoria: string; pontos: number;
  idComp: string; nomeComp: string;
}): NoticiaNova | null {
  if (!d.nome || d.pontos <= 0) return null;
  return {
    tipo: "atleta_destaque",
    titulo: `${apelido(d.nome)} arrasou em ${d.nomeComp}`,
    corpo: `${d.nome} (${d.pais}) somou ${num(d.pontos)} pontos nos ${d.categoria}kg — o melhor de toda a competição. Quem o tinha na equipa agradece.`,
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
}): NoticiaNova | null {
  const sub = d.para - d.de;
  if (!d.nome || sub <= 0) return null;
  const pct = d.de > 0 ? Math.round((sub / d.de) * 100) : 0;
  return {
    tipo: "valorizacao",
    titulo: `${apelido(d.nome)} valorizou ${pct}%`,
    corpo: `Depois de ${d.nomeComp}, ${d.nome} (${d.pais}) subiu de JC ${num(d.de)} para JC ${num(d.para)}. Quem o tinha antes da rodada fez um bom negócio.`,
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
}): NoticiaNova | null {
  const queda = d.de - d.para;
  if (!d.nome || queda <= 0) return null;
  const pct = d.de > 0 ? Math.round((queda / d.de) * 100) : 0;
  return {
    tipo: "desvalorizacao",
    titulo: `${apelido(d.nome)} caiu ${pct}%`,
    // Sem sarcasmo: é um atleta real, e quem o escalou já perdeu património.
    // A notícia informa, não gozar.
    corpo: `${d.nome} (${d.pais}) desceu de JC ${num(d.de)} para JC ${num(d.para)} depois de ${d.nomeComp}. Fica mais barato para quem acreditar na recuperação.`,
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
  const topo = d.topo ? ` ${d.topo.nome} está agora na faixa ${d.topo.faixa}.` : "";
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
  const contra = d.vice ? ` Bateu ${d.vice} na final.` : "";
  return {
    tipo: "copa_campeao",
    titulo: `${d.campeao} venceu a ${d.nomeLiga}`,
    corpo: `Acabou o mata-mata da ${d.nomeLiga}, entre ${d.participantes} equipas.${contra} O certificado de campeão já está disponível.`,
    resumo: `${d.campeao} · campeão da ${d.nomeLiga}`,
    dados: { chave: d.ligaId, participantes: d.participantes },
    destaque: true,
  };
}
