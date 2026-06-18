// lib/mensagensEspeciais.ts
//
// MOTOR DE MENSAGENS ESPECIAIS do dashboard (tela inicial).
//
// Dada a data de hoje, os dados do utilizador (nome, data de nascimento,
// continente) e a competição da semana (do calendário), devolve a FILA de
// modais a mostrar — ou uma fila vazia se hoje não é dia especial.
//
// DUAS famílias:
//  (A) DATAS do calendário civil: aniversário, Dia do Judô, fim de ano, começo
//      de ano. Dependem só da data (e do utilizador).
//  (B) GRANDES COMPETIÇÕES (do calendário Ippon): Olimpíada, Mundial, Masters,
//      Continental. Saem da competição da semana — NUNCA de clássicos (regra de
//      ouro: clássicos são do passado). A Continental só aparece a quem é DESSE
//      continente.
//
// Modais: aparecem 1x por evento (campo `chave`), em SEQUÊNCIA quando coincidem
// (ex: aniversário + grande competição → mostra os dois, aniversário primeiro).
// Ordem da fila: aniversário > Dia do Judô > grande competição > fim de ano >
// começo de ano. A fila é limitada a 2 modais (decisão "2 em sequência").
//
// Textos das grandes competições + aniversário: APROVADOS (rascunho-textos-modais).
// Textos de Dia do Judô / fim de ano / começo de ano: reaproveitados do cartão
// que já estava em produção (não havia versão de modal aprovada para estes).

import { type Continente } from "./continentes";

export type TipoMensagem =
  | "aniversario"
  | "dia_do_judo"
  | "olimpiada"
  | "mundial"
  | "masters"
  | "continental"
  | "fim_de_ano"
  | "comeco_de_ano";

export interface MensagemEspecial {
  tipo: TipoMensagem;
  emoji: string;
  titulo: string;
  texto: string;
  botao: string; // rótulo do botão do modal
  chave: string; // chave de "visto" (1x por evento): comp-<id>, aniversario-<ano>, ...
  push: boolean; // só datas pessoais (aniversário, Dia do Judô) geram push
  cor: string;
}

export interface DadosUtilizador {
  nome?: string | null;
  dataNascimento?: string | null; // "AAAA-MM-DD"
  continente?: Continente | null; // EUR | PAN | ASI | AFR | OCE
}

// Subconjunto de SemanaCalendario, para não acoplar ao tipo inteiro.
export interface CompeticaoDaSemana {
  nome: string;
  nivel: string; // "Mundial" | "Masters" | "Continental" | "Olimpíada" | ...
  classico: boolean; // ⚠️ true = passado revivido → NUNCA gera mensagem
  idCompeticao?: string; // usado como chave de "visto"; fallback = slug do nome
}

const GOLD = "#d9a441";
const VERDE = "#3f8f5a";
const AZUL = "#2f6fb3";
const OURO_OLIMP = "#c79a3a";

// Dia Mundial do Judô. [Kainan vai confirmar; 28/10 é a referência internacional.]
const DIA_DO_JUDO_MMDD = "10-28";

function primeiroNome(nome?: string | null): string {
  const n = (nome || "").trim().split(/\s+/)[0] || "";
  return n ? n.charAt(0).toUpperCase() + n.slice(1) : "";
}

function mmdd(d: Date): string {
  return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function slug(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Deduz o continente de uma competição continental a partir do NOME (o calendário
// não tem campo de continente). Null se não der para deduzir.
function continenteDaCompeticao(nome: string): Continente | null {
  const n = (nome || "").toLowerCase();
  if (/europ/.test(n)) return "EUR";
  if (/afric|áfric/.test(n)) return "AFR";
  if (/panameric|pan-americ|americ|améric/.test(n)) return "PAN";
  if (/asia|ásia|asian/.test(n)) return "ASI";
  if (/ocean|oceân/.test(n)) return "OCE";
  return null;
}

// ---------------------------------------------------------------------------
// MOTOR — fila de modais de hoje (no máximo 2, na ordem certa).
// ---------------------------------------------------------------------------
export function mensagensModaisDeHoje(
  hoje: Date,
  user: DadosUtilizador,
  competicaoSemana?: CompeticaoDaSemana | null,
): MensagemEspecial[] {
  const fila: MensagemEspecial[] = [];
  const hojeMMDD = mmdd(hoje);
  const ano = hoje.getFullYear();
  const nome = primeiroNome(user.nome);

  // (A1) ANIVERSÁRIO — prioridade máxima.
  if (user.dataNascimento) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(user.dataNascimento);
    if (m && `${m[2]}-${m[3]}` === hojeMMDD) {
      fila.push({
        tipo: "aniversario",
        emoji: "🎉",
        titulo: nome ? `Parabéns, ${nome}!` : "Parabéns!",
        texto:
          "Hoje é o teu dia, e nós cá da Ippon League queremos celebrá-lo contigo! 🥋 Estamos muito felizes por fazeres parte desta comunidade de apaixonados pelo judô. Que este novo ano te traga muitas alegrias, conquistas no tatame e fora dele — e que continues a crescer e a divertir-te connosco. Um grande abraço, e parabéns! 🎂",
        botao: "Obrigado! 🙏",
        chave: `aniversario-${ano}`,
        push: true,
        cor: GOLD,
      });
    }
  }

  // (A2) DIA MUNDIAL DO JUDÔ.
  if (hojeMMDD === DIA_DO_JUDO_MMDD) {
    fila.push({
      tipo: "dia_do_judo",
      emoji: "🥋",
      titulo: "Dia Mundial do Judô",
      texto: `${nome ? `${nome}, hoje` : "Hoje"} é o Dia Mundial do Judô! Parabéns a todos os que amam este desporto. Que tal homenagear a data com uma escalação de respeito?`,
      botao: "Bora homenagear! 🥋",
      chave: `dia_do_judo-${ano}`,
      push: true,
      cor: GOLD,
    });
  }

  // (B) GRANDE COMPETIÇÃO da semana. NUNCA clássicos. Continental filtra continente.
  if (competicaoSemana && !competicaoSemana.classico) {
    const g = mensagemGrandeCompeticao(competicaoSemana, user.continente ?? null, ano);
    if (g) fila.push(g);
  }

  // (A3) FIM DE ANO (23 a 31 de dezembro).
  if (hoje.getMonth() === 11 && hoje.getDate() >= 23) {
    fila.push({
      tipo: "fim_de_ano",
      emoji: "🎄",
      titulo: "Boas festas, atleta!",
      texto: `Obrigado por fazeres parte da Ippon League em ${ano}. Que ${ano + 1} traga muitos ippons. 🥋`,
      botao: "Boas festas! 🎄",
      chave: `fim_de_ano-${ano}`,
      push: false,
      cor: VERDE,
    });
  }

  // (A4) COMEÇO DE ANO (1 a 7 de janeiro).
  if (hoje.getMonth() === 0 && hoje.getDate() <= 7) {
    fila.push({
      tipo: "comeco_de_ano",
      emoji: "🎍",
      titulo: "Época nova, tatame limpo!",
      texto: "O ranking recomeça do zero — todos com as mesmas hipóteses. Monta a tua equipa e começa o ano a pontuar.",
      botao: "Começar a pontuar! 🥋",
      chave: `comeco_de_ano-${ano}`,
      push: false,
      cor: GOLD,
    });
  }

  return fila.slice(0, 2);
}

// Compatibilidade: devolve só a mensagem de maior prioridade (ou null). Mantida
// para qualquer chamador antigo / futuro motor de push. Uma única fonte de texto.
export function mensagemEspecialDeHoje(
  hoje: Date,
  user: DadosUtilizador,
  competicaoSemana?: CompeticaoDaSemana | null,
): MensagemEspecial | null {
  return mensagensModaisDeHoje(hoje, user, competicaoSemana)[0] ?? null;
}

// Mensagem de uma grande competição (já sabemos que não é clássico). Para a
// Continental, devolve null se o utilizador não for do continente dela.
function mensagemGrandeCompeticao(
  c: CompeticaoDaSemana,
  continenteUser: Continente | null,
  ano: number,
): MensagemEspecial | null {
  const nivel = (c.nivel || "").toLowerCase();
  const chave = `comp-${c.idCompeticao || slug(c.nome)}`;

  if (nivel.includes("olimp")) {
    return {
      tipo: "olimpiada",
      emoji: "🏅",
      titulo: "É tempo de Jogos Olímpicos!",
      texto:
        "O maior palco do desporto mundial abriu as portas ao judô! 🏅 Só os melhores entre os melhores chegam aqui — os medalhistas olímpicos entram para a história. É o sonho de todo o judoca, e tu vais viver isto connosco. Prepara a tua equipa dos sonhos e entra nesta rodada histórica!",
      botao: "Vamos a isto! 🔥",
      chave,
      push: false,
      cor: OURO_OLIMP,
    };
  }

  if (nivel === "mundial") {
    return {
      tipo: "mundial",
      emoji: "🌍",
      titulo: "É a semana do Mundial!",
      texto: `Atenção, atleta: chegou a competição mais importante do ano! 🌍 O Mundial de Judô reúne os melhores do planeta no mesmo tatame — é aqui que se consagram os campeões do mundo de ${ano}. Uma rodada destas não se repete. Monta a tua melhor equipa, escolhe bem o capitão e não percas esta!`,
      botao: "Bora escalar! 🥋",
      chave,
      push: false,
      cor: VERDE,
    };
  }

  if (nivel === "masters") {
    return {
      tipo: "masters",
      emoji: "🏆",
      titulo: "É a semana do Masters!",
      texto:
        "O Masters é só para a elite: entram apenas os melhores do ranking mundial de cada categoria. 🏆 Cada luta é entre feras — pontos não vão faltar para quem escalar com sabedoria. Esta é uma rodada de respeito. Escolhe a dedo o teu time e mostra o que vales!",
      botao: "Montar o meu time! 🥋",
      chave,
      push: false,
      cor: VERDE,
    };
  }

  // Continental: só a quem é DESSE continente.
  if (nivel.includes("continental")) {
    const contComp = continenteDaCompeticao(c.nome);
    if (!contComp || !continenteUser || contComp !== continenteUser) return null;
    return continentalModal(contComp, chave);
  }

  return null;
}

function continentalModal(cont: Continente, chave: string): MensagemEspecial {
  const M: Record<Continente, { emoji: string; titulo: string; texto: string }> = {
    EUR: {
      emoji: "🇪🇺",
      titulo: "É a semana do Campeonato da Europa!",
      texto:
        "O título continental está em jogo, e é no teu continente! 🇪🇺 Os melhores da Europa vão medir forças — uma grande oportunidade para fazeres pontos e subires na tua liga continental. Não deixes passar a tua rodada!",
    },
    PAN: {
      emoji: "🌎",
      titulo: "É a semana do Campeonato Pan-Americano!",
      texto:
        "O título continental está em jogo, e é no teu continente! 🌎 Os melhores da América vão à luta — aproveita para fazer pontos e brilhar na tua liga continental. A tua rodada é agora!",
    },
    ASI: {
      emoji: "🌏",
      titulo: "É a semana do Campeonato Asiático!",
      texto:
        "O título continental está em jogo, e é no teu continente! 🌏 Os melhores da Ásia entram no tatame — uma grande oportunidade para pontuares e subires na tua liga continental. Não percas a tua rodada!",
    },
    AFR: {
      emoji: "🌍",
      titulo: "É a semana do Campeonato Africano!",
      texto:
        "O título continental está em jogo, e é no teu continente! 🌍 Os melhores de África vão medir forças — aproveita para fazer pontos e brilhar na tua liga continental. A tua rodada chegou!",
    },
    OCE: {
      emoji: "🌏",
      titulo: "É a semana do Campeonato da Oceânia!",
      texto:
        "O título continental está em jogo, e é no teu continente! 🌏 Os melhores da Oceânia entram em ação — uma boa altura para pontuares e subires na tua liga continental. Não deixes escapar a tua rodada!",
    },
  };
  const x = M[cont];
  return {
    tipo: "continental",
    emoji: x.emoji,
    titulo: x.titulo,
    texto: x.texto,
    botao: "Bora competir! 🥋",
    chave,
    push: false,
    cor: AZUL,
  };
}
