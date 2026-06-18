// lib/mensagensEspeciais.ts
//
// MOTOR DE MENSAGENS ESPECIAIS do dashboard (tela inicial).
//
// Dada a data de hoje, os dados do utilizador (nome, data de nascimento,
// continente) e a competição da semana (do calendário), devolve a mensagem
// temática a mostrar — ou null se hoje não é dia especial.
//
// DUAS famílias:
//  (A) DATAS do calendário civil: aniversário, Dia do Judô, fim de ano, começo
//      de ano. Dependem só da data (e do utilizador).
//  (B) GRANDES COMPETIÇÕES (do calendário Ippon): Olimpíada, Mundial, Masters,
//      Continental. Saem da competição da semana — NUNCA de clássicos (regra de
//      ouro: clássicos são do passado). A Continental só aparece a quem é DESSE
//      continente.
//
// Prioridade: aniversário > Dia do Judô > grande competição > fim de ano >
// começo de ano.

import { type Continente, NOME_CONTINENTE } from "./continentes";

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
  push: boolean; // só datas pessoais (aniversário, Dia do Judô) geram push
  cor: string;
}

export interface DadosUtilizador {
  nome?: string | null;
  dataNascimento?: string | null;  // "AAAA-MM-DD"
  continente?: Continente | null;  // EUR | PAN | ASI | AFR | OCE
}

// Subconjunto de SemanaCalendario, para não acoplar ao tipo inteiro.
export interface CompeticaoDaSemana {
  nome: string;
  nivel: string;      // "Mundial" | "Masters" | "Continental" | "Olimpíada" | ...
  classico: boolean;  // ⚠️ true = passado revivido → NUNCA gera mensagem
}

const GOLD = "#d9a441";

// Dia Mundial do Judô. [Kainan vai confirmar; 28/10 é a referência internacional.]
const DIA_DO_JUDO_MMDD = "10-28";

function primeiroNome(nome?: string | null): string {
  const n = (nome || "").trim().split(/\s+/)[0] || "";
  return n ? n.charAt(0).toUpperCase() + n.slice(1) : "";
}

function mmdd(d: Date): string {
  return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
// MOTOR
// ---------------------------------------------------------------------------
export function mensagemEspecialDeHoje(
  hoje: Date,
  user: DadosUtilizador,
  competicaoSemana?: CompeticaoDaSemana | null,
): MensagemEspecial | null {
  const hojeMMDD = mmdd(hoje);
  const ano = hoje.getFullYear();
  const nome = primeiroNome(user.nome);

  // (A1) ANIVERSÁRIO — prioridade máxima.
  if (user.dataNascimento) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(user.dataNascimento);
    if (m && `${m[2]}-${m[3]}` === hojeMMDD) {
      return {
        tipo: "aniversario",
        emoji: "🎉",
        titulo: nome ? `Parabéns, ${nome}!` : "Parabéns!",
        texto: `${nome ? `Parabéns, ${nome}! ` : "Parabéns! "}Hoje é o teu dia. Que tal comemorar com uma vitória no tatame? A Ippon League deseja-te um ano cheio de ippons! 🥋`,
        push: true,
        cor: GOLD,
      };
    }
  }

  // (A2) DIA MUNDIAL DO JUDÔ.
  if (hojeMMDD === DIA_DO_JUDO_MMDD) {
    return {
      tipo: "dia_do_judo",
      emoji: "🥋",
      titulo: "Dia Mundial do Judô",
      texto: `${nome ? `${nome}, hoje` : "Hoje"} é o Dia Mundial do Judô! Parabéns a todos os que amam este desporto. Que tal homenagear a data com uma escalação de respeito?`,
      push: true,
      cor: GOLD,
    };
  }

  // (B) GRANDE COMPETIÇÃO da semana. NUNCA clássicos. Continental filtra continente.
  if (competicaoSemana && !competicaoSemana.classico) {
    const g = mensagemGrandeCompeticao(competicaoSemana, user.continente ?? null);
    if (g) return g;
  }

  // (A3) FIM DE ANO (23 a 31 de dezembro).
  if (hoje.getMonth() === 11 && hoje.getDate() >= 23) {
    return {
      tipo: "fim_de_ano",
      emoji: "🎄",
      titulo: "Boas festas, atleta!",
      texto: `Obrigado por fazeres parte da Ippon League em ${ano}. Que ${ano + 1} traga muitos ippons. 🥋`,
      push: false,
      cor: "#3f8f5a",
    };
  }

  // (A4) COMEÇO DE ANO (1 a 7 de janeiro).
  if (hoje.getMonth() === 0 && hoje.getDate() <= 7) {
    return {
      tipo: "comeco_de_ano",
      emoji: "🎍",
      titulo: "Época nova, tatame limpo!",
      texto: "O ranking recomeça do zero — todos com as mesmas hipóteses. Monta a tua equipa e começa o ano a pontuar.",
      push: false,
      cor: GOLD,
    };
  }

  return null;
}

// Mensagem de uma grande competição (já sabemos que não é clássico). Para a
// Continental, devolve null se o utilizador não for do continente dela.
function mensagemGrandeCompeticao(c: CompeticaoDaSemana, continenteUser: Continente | null): MensagemEspecial | null {
  const nivel = (c.nivel || "").toLowerCase();

  if (nivel.includes("olimp")) {
    return {
      tipo: "olimpiada",
      emoji: "🏅",
      titulo: "É tempo de Jogos Olímpicos!",
      texto: "O judô no maior palco do mundo. Esta é a competição com que todo o judoca sonha — monta a tua melhor equipa.",
      push: false,
      cor: "#c79a3a",
    };
  }

  if (nivel === "mundial") {
    return {
      tipo: "mundial",
      emoji: "🌍",
      titulo: "É a semana do Mundial de Judô!",
      texto: "A competição mais importante do ano. Os melhores do planeta no mesmo tatame — quem vais escalar para o teu time brilhar?",
      push: false,
      cor: "#3f8f5a",
    };
  }

  if (nivel === "masters") {
    return {
      tipo: "masters",
      emoji: "🏆",
      titulo: "É a semana do Masters!",
      texto: "Só os melhores do ranking mundial entram no Masters. Rodada de elite — escolhe a dedo a tua equipa.",
      push: false,
      cor: "#3f8f5a",
    };
  }

  // Continental: só a quem é DESSE continente.
  if (nivel.includes("continental")) {
    const contComp = continenteDaCompeticao(c.nome);
    if (!contComp || !continenteUser || contComp !== continenteUser) return null;
    const nomeCont = NOME_CONTINENTE[contComp];
    return {
      tipo: "continental",
      emoji: "🗺️",
      titulo: `É a semana do Campeonato da ${nomeCont}!`,
      texto: `O título continental está em jogo no teu continente (${nomeCont}). Aproveita a rodada para subir na tua liga continental.`,
      push: false,
      cor: "#2f6fb3",
    };
  }

  return null;
}
