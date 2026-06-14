// lib/estado-atleta.ts
//
// ESTADO DE PARTICIPAÇÃO de um atleta numa rodada (competição).
// Lógica PURA e ISOLADA: não sabe de onde vêm os dados (API, cache, etc.).
// Recebe dois factos simples e decide o estado. Assim, se um dia mudarmos a
// fonte de dados, mexemos só em quem CHAMA esta função — nunca na UI nem aqui.
//
// Os dois factos que decidem tudo:
//   nLutas  -> quantas lutas o atleta teve nesta competição (de /api/atleta-rodada)
//   place   -> a colocação final do atleta nesta competição (de competitor.results)
//              "tp" = "participações" (ainda a decorrer / sem lugar final)
//              "1","2","3","5","7"... = lugar final (a participação dele ACABOU)
//              null/"" = sem registo (tratamos como ainda a decorrer)
//
// Porque o `place` e não as lutas? Porque é a declaração OFICIAL da IJF de que a
// participação do atleta terminou. Não depende de nomes de ronda (que a API por
// vezes erra), resolve competições divididas por dias (cada atleta tem o seu
// place, independente) e cobre o caso raro do campeão-sem-luta (place "1").

export type EstadoAtleta =
  | "competiu"        // teve lutas — mostra os pontos normalmente
  | "a_aguardar"      // ainda não lutou e a participação não terminou (pode pontuar)
  | "nao_competiu"    // a participação terminou e não entrou em combate (0 lutas)
  | "campeao_sem_luta"; // 0 lutas mas terminou em 1.º (categoria de 1 atleta) — raro

// Um `place` conta como FINAL (participação terminada) quando é um número >= 1.
// "tp" (participações) e vazio NÃO são finais — a participação ainda decorre.
export function placeEhFinal(place: string | null | undefined): boolean {
  if (place == null) return false;
  const s = String(place).trim().toLowerCase();
  if (s === "" || s === "tp") return false;
  const n = parseInt(s, 10);
  return !isNaN(n) && n >= 1;
}

// Decide o estado a partir dos dois factos. Função pura, sem efeitos.
export function estadoDoAtleta(nLutas: number, place: string | null | undefined): EstadoAtleta {
  if (nLutas > 0) return "competiu";
  // 0 lutas a partir daqui.
  if (!placeEhFinal(place)) return "a_aguardar"; // participação não terminou
  // 0 lutas + lugar final: terminou sem combater.
  const n = parseInt(String(place).trim(), 10);
  if (n === 1) return "campeao_sem_luta"; // raro: era o único na categoria
  return "nao_competiu";
}

// Texto curto e amigável para mostrar na UI, por estado. (A UI pode usar este
// texto ou só o estado — fica aqui para a mensagem ser consistente em toda a app.)
export function textoEstado(estado: EstadoAtleta): string {
  switch (estado) {
    case "competiu": return "Competiu nesta rodada.";
    case "a_aguardar": return "Ainda não lutou — a participação dele nesta competição não terminou.";
    case "nao_competiu": return "Estava inscrito mas não entrou em combate nesta competição.";
    case "campeao_sem_luta": return "Foi campeão da categoria sem precisar de combater.";
  }
}
