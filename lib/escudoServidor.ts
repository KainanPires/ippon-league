// lib/escudoServidor.ts
//
// REVERTER O ESCUDO PARA A VERSÃO GRÁTIS quando alguém perde o Pro.
// USAR APENAS NO SERVIDOR (usa supabaseAdmin). Chamado pelos dois pontos onde o
// acesso Pro é retirado: o webhook da Stripe (cancelamento) e o cron de
// expiração (api/subscricoes/expirar). Em ambos é "best-effort": nunca lança,
// nunca pode partir o fluxo de pagamento.
//
// O escudo (um objeto Identity em jsonb) vive na coluna `equipas.escudo`,
// replicado em TODAS as linhas de equipa da conta (ver lib/team ->
// atualizarIdentidadeCloud). Por isso lê-se de uma linha, limpa-se, e grava-se
// em todas as linhas da conta de uma vez.
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sanitizarEscudoParaGratis } from "@/lib/escudoDados";
import { criarNotificacaoServidor } from "@/lib/notificacoesServidor";

export async function reverterEscudoParaGratis(uid: string): Promise<{ mudou: boolean }> {
  if (!supabaseAdmin || !uid) return { mudou: false };
  try {
    // Lê o escudo atual de qualquer equipa da conta (é igual em todas).
    const { data } = await supabaseAdmin
      .from("equipas")
      .select("escudo")
      .eq("user_id", uid)
      .not("escudo", "is", null)
      .limit(1)
      .maybeSingle();
    const escudoAtual = (data as { escudo?: unknown } | null)?.escudo;
    if (!escudoAtual || typeof escudoAtual !== "object" || Array.isArray(escudoAtual)) {
      return { mudou: false };
    }

    const { escudo, mudou } = sanitizarEscudoParaGratis(escudoAtual as Record<string, unknown>);
    // Já era tudo gratuito: nada a gravar, nada a avisar.
    if (!mudou) return { mudou: false };

    // Grava o escudo limpo em todas as linhas de equipa da conta.
    const { error } = await supabaseAdmin
      .from("equipas")
      .update({ escudo })
      .eq("user_id", uid);
    if (error) return { mudou: false };

    // Avisa a pessoa (na língua dela). O aviso é um extra: se falhar, a reversão
    // já está feita.
    try {
      await criarNotificacaoServidor({
        paraUserId: uid,
        tipo: "escudo_revertido",
        chaveTitulo: "escudo.revertidoTitulo",
        chaveCorpo: "escudo.revertidoCorpo",
        link: "/escudo",
      });
    } catch { /* o aviso é conveniência; a reversão é o que importa */ }

    return { mudou: true };
  } catch {
    // Best-effort: um problema aqui nunca pode afetar o rebaixamento/pagamento.
    return { mudou: false };
  }
}
