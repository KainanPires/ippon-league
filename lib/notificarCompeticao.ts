// lib/notificarCompeticao.ts
//
// Notificação de FIM DE COMPETIÇÃO (resultado da rodada). USAR NO SERVIDOR.
//
// Sai quando uma competição congela. UMA notificação por utilizador, conforme a
// posição dele nessa competição. Idempotente via reservarEvento (chamado pelo
// congelar.ts uma vez por competição).
//
// CELEBRAÇÃO POR NÍVEL:
//   - Competição GRANDE (Mundial / Continental): pódio 1/2/3 com textos ESPECIAIS
//     e celebrativos (estar no pódio de um Mundial é enorme). O 1º tem a coroa.
//     Estas são CONQUISTAS ("melhor da rodada" mundial/continental) → levam à
//     aba de RESULTADOS (onde ficam os títulos).
//   - Competição normal: pódio 1/2/3 com textos bonitos mas mais sóbrios → liga.
//   - Fora do pódio: resultado simples, leva à liga.
//
// NOTA: a HIPER-MEGA notificação do 1/2/3 da LIGA TODA (acumulado, fim do ano)
// é OUTRA coisa, e fica para a frente "fim das ligas" (ver plano). Aqui é só o
// resultado de CADA competição/rodada.
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { criarNotificacaoServidor } from "@/lib/notificacoesServidor";
import { CALENDARIO_2026, rotuloRodada, type Nivel } from "@/lib/calendario";

// Idempotência: marca o evento "fim_competicao:<id>" para não repetir.
async function reservarEvento(chave: string): Promise<boolean> {
  if (!supabaseAdmin) return false;
  try {
    const { error } = await supabaseAdmin.from("eventos_notificados").insert({ chave });
    return !error;
  } catch {
    return false;
  }
}

export async function notificarFimDeCompeticao(idComp: string): Promise<void> {
  if (!supabaseAdmin) return;

  // Só uma vez por competição.
  if (!(await reservarEvento(`fim_competicao:${idComp}`))) return;

  // Dados da competição (nome + nível) a partir do calendário.
  const sem = CALENDARIO_2026.find((c) => c.idCompeticao === String(idComp));
  const nomeComp = sem?.nome || "a competição";
  const nivel: Nivel | null = sem?.nivel ?? null;
  const rotulo = rotuloRodada(idComp) || "rodada";

  // Resultados desta competição, ordenados (maior pontuação primeiro).
  const { data: rodadas } = await supabaseAdmin
    .from("resultados_rodada")
    .select("user_id, pontos_rodada")
    .eq("id_competicao", idComp)
    .order("pontos_rodada", { ascending: false });
  const lista = rodadas || [];
  if (lista.length === 0) return;

  const ehGrande = nivel === "Mundial" || nivel === "Continental";
  // Destino das CONQUISTAS (pódio mundial/continental): a aba de Resultados, onde
  // ficam guardados os títulos. O resto (resumo da rodada) continua a ir à liga.
  const linkResultados = "/ligas?aba=resultados";

  // Notifica cada utilizador o seu resultado (UMA notificação, agregada).
  for (let i = 0; i < lista.length; i++) {
    const r = lista[i];
    const posicao = i + 1; // posição nesta competição
    const pontos = Number(r.pontos_rodada) || 0;

    // Escolhe as CHAVES (traduzidas na língua de quem recebe); as variáveis
    // (nome da competição, nível, pontos, rótulo da rodada) vão à parte.
    let chaveTitulo: string;
    let chaveCorpo: string;
    let tipo = "resumo_rodada";
    let link = "/ligas";

    if (ehGrande && posicao <= 3) {
      // ---- PÓDIO de competição GRANDE (Mundial / Continental): especial ----
      // É uma conquista → vai para a aba de Resultados.
      tipo = "campeao_mundial";
      link = linkResultados;
      if (posicao === 1) {
        chaveTitulo = "comp.mundial1Titulo";
        chaveCorpo = "comp.mundial1Corpo";
      } else if (posicao === 2) {
        chaveTitulo = "comp.mundial2Titulo";
        chaveCorpo = "comp.mundial2Corpo";
      } else {
        chaveTitulo = "comp.mundial3Titulo";
        chaveCorpo = "comp.mundial3Corpo";
      }
    } else if (posicao === 1) {
      chaveTitulo = "comp.venceu1Titulo";
      chaveCorpo = "comp.venceu1Corpo";
    } else if (posicao === 2) {
      chaveTitulo = "comp.lugar2Titulo";
      chaveCorpo = "comp.lugar2Corpo";
    } else if (posicao === 3) {
      chaveTitulo = "comp.lugar3Titulo";
      chaveCorpo = "comp.lugar3Corpo";
    } else {
      // Fora do pódio: resultado simples, sem alarido. Leva à liga.
      chaveTitulo = "comp.resultadoTitulo";
      chaveCorpo = "comp.resultadoCorpo";
    }

    await criarNotificacaoServidor({
      paraUserId: String(r.user_id),
      tipo,
      chaveTitulo,
      chaveCorpo,
      vars: { comp: nomeComp, nivel: String(nivel ?? ""), pontos, rotulo },
      link,
    });
  }
}
