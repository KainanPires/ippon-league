// lib/notificarCompeticao.ts
//
// Notificações automáticas do FIM de uma competição (Grupo A), chamadas pelo
// motor de congelamento (lib/congelar) quando uma competição fica completa.
//
// REGRAS (decididas com o Kainan):
//  - NUNCA repete: cada bloco é idempotente via tabela `eventos_notificados`.
//    O cron reprocessa todos os dias, mas a notificação sai UMA vez por competição.
//  - AGREGADA: cada utilizador recebe UMA notificação de resultado (pódio +
//    variação de posição juntos), nunca uma por liga/competição. Link -> /ligas.
//  - HIPER NOTIFICAÇÃO: o 1º lugar de uma competição de nível "Mundial" ou
//    "Continental" recebe uma mensagem especial de estatuto.
//
// USAR APENAS NO SERVIDOR (supabaseAdmin).
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { criarNotificacaoServidor } from "@/lib/notificacoesServidor";
import { CALENDARIO_2026, numeroDaRodada } from "@/lib/calendario";

// Marca um evento como notificado (idempotência). Devolve true se conseguiu
// "reservar" (ou seja, ainda não tinha sido notificado). Se já existia, false.
async function reservarEvento(chave: string): Promise<boolean> {
  if (!supabaseAdmin) return false;
  try {
    const { error } = await supabaseAdmin.from("eventos_notificados").insert({ chave });
    // Conflito de chave primária (já existia) -> error. Logo, já foi notificado.
    return !error;
  } catch {
    return false;
  }
}

// Nome legível e nível da competição (do calendário).
function infoCompeticao(idComp: string): { nome: string; nivel: string } | null {
  const s = CALENDARIO_2026.find((c) => c.idCompeticao === String(idComp));
  if (!s) return null;
  return { nome: s.nome, nivel: s.nivel };
}

/**
 * Notifica o fim de uma competição: resultado de cada utilizador (pódio +
 * variação de posição) e a hiper notificação do campeão (Mundial/Continental).
 * Idempotente: só envia uma vez por competição.
 */
export async function notificarFimDeCompeticao(idComp: string): Promise<void> {
  if (!supabaseAdmin) return;

  // Idempotência: se já notificámos esta competição, sai.
  const reservou = await reservarEvento(`fim_competicao:${idComp}`);
  if (!reservou) return;

  const info = infoCompeticao(idComp);
  const nomeComp = info?.nome ?? "a competição";
  const nivel = info?.nivel ?? "";
  const rodada = numeroDaRodada(idComp);
  const rotulo = rodada ? `Rodada ${rodada}` : nomeComp;

  // Classificação desta competição (por pontos da rodada).
  const { data: rodadas } = await supabaseAdmin
    .from("resultados_rodada")
    .select("user_id, pontos_rodada")
    .eq("id_competicao", idComp)
    .order("pontos_rodada", { ascending: false });
  const lista = rodadas || [];
  if (lista.length === 0) return;

  const ehGrande = nivel === "Mundial" || nivel === "Continental";

  // Notifica cada utilizador o seu resultado (UMA notificação, agregada).
  for (let i = 0; i < lista.length; i++) {
    const r = lista[i];
    const posicao = i + 1; // posição nesta competição
    const pontos = Number(r.pontos_rodada) || 0;

    let titulo: string;
    let corpo: string;

    if (posicao === 1 && ehGrande) {
      // HIPER NOTIFICAÇÃO — campeão de Mundial / Continental.
      titulo = `👑 És o nº1 do ${nomeComp}!`;
      corpo = `Ficaste em 1º lugar numa competição de nível ${nivel}, com ${pontos} pts. Estás entre os melhores do mundo na Ippon League. Que feito histórico!`;
    } else if (posicao === 1) {
      titulo = `🥇 Venceste a ${rotulo}!`;
      corpo = `Ficaste em 1º lugar no ${nomeComp} com ${pontos} pts. Que rodada! Vê como ficou a tua liga.`;
    } else if (posicao === 2) {
      titulo = `🥈 2º lugar na ${rotulo}!`;
      corpo = `Grande rodada no ${nomeComp}: ${pontos} pts e o vice-pódio. Vê a tua liga.`;
    } else if (posicao === 3) {
      titulo = `🥉 3º lugar na ${rotulo}!`;
      corpo = `Subiste ao pódio no ${nomeComp} com ${pontos} pts. Vê a tua liga.`;
    } else {
      // Fora do pódio: resultado simples, sem alarido. Leva à liga.
      titulo = `Resultado da ${rotulo}`;
      corpo = `O ${nomeComp} terminou. Fizeste ${pontos} pts — vê a tua posição na liga.`;
    }

    await criarNotificacaoServidor({
      paraUserId: String(r.user_id),
      tipo: posicao === 1 && ehGrande ? "campeao_mundial" : "resumo_rodada",
      titulo,
      corpo,
      link: "/ligas",
    });
  }
}
