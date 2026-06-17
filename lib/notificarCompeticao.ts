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
//   - Competição normal: pódio 1/2/3 com textos bonitos mas mais sóbrios.
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

  // Notifica cada utilizador o seu resultado (UMA notificação, agregada).
  for (let i = 0; i < lista.length; i++) {
    const r = lista[i];
    const posicao = i + 1; // posição nesta competição
    const pontos = Number(r.pontos_rodada) || 0;

    let titulo: string;
    let corpo: string;
    let tipo = "resumo_rodada";

    if (ehGrande && posicao <= 3) {
      // ---- PÓDIO de competição GRANDE (Mundial / Continental): especial ----
      tipo = "campeao_mundial";
      if (posicao === 1) {
        titulo = `👑 És o nº1 do ${nomeComp}!`;
        corpo = `Ficaste em 1º lugar numa competição de nível ${nivel}, com ${pontos} pts. Estás entre os melhores do mundo na Ippon League. Que feito histórico!`;
      } else if (posicao === 2) {
        titulo = `🥈 Vice-campeão do ${nomeComp}!`;
        corpo = `Que feito! Ficaste em 2º lugar numa competição de nível ${nivel}, com ${pontos} pts. Estás no pódio dos melhores do mundo — falta tão pouco para o topo!`;
      } else {
        titulo = `🥉 No pódio do ${nomeComp}!`;
        corpo = `Brilhante! 3º lugar numa competição de nível ${nivel}, com ${pontos} pts. Subiste ao pódio mundial da Ippon League — orgulha-te disso!`;
      }
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
      tipo,
      titulo,
      corpo,
      link: "/ligas",
    });
  }
}
