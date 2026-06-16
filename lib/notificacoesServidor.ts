// lib/notificacoesServidor.ts
//
// Criar notificações DO LADO DO SERVIDOR (Route Handlers), com a chave secreta.
// NUNCA importar isto em componentes do cliente ("use client") — usa supabaseAdmin.
//
// É a "portaria": permite criar uma notificação para QUALQUER utilizador (ex.: o
// dono de uma liga recebe aviso de um pedido feito por outra pessoa). Como corre
// só no servidor e usa a chave secreta, contorna o RLS de forma controlada — mas
// é sempre o NOSSO código a decidir o quê e para quem, nunca o cliente diretamente.
//
// PRINCÍPIO DE OURO (igual ao do sino): a mensagem é sempre personalizada com os
// dados reais (nome de quem pediu, nome da liga, etc.) — nunca genérica.
//
// PUSH: ao gravar a notificação, dispara TAMBÉM a notificação push para o
// telemóvel (lib/pushServer). Assim, tudo o que cria notificação no servidor
// (Copa, pedidos de liga, etc.) chega automaticamente ao aparelho. O push falha
// em silêncio — nunca parte a ação principal.
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { enviarPushPara } from "@/lib/pushServer";

export interface NotificacaoServidor {
  paraUserId: string;                 // destinatário
  tipo: string;                        // ex: "liga_pedido", "liga_aprovado"
  titulo: string;
  corpo?: string;
  link?: string;
}

/**
 * Cria uma notificação para um utilizador (sino + push). Falha em silêncio
 * (devolve false) — uma notificação que não grava NUNCA deve partir a ação
 * principal (ex.: o pedido de liga tem de funcionar mesmo que a notificação falhe).
 */
export async function criarNotificacaoServidor(n: NotificacaoServidor): Promise<boolean> {
  if (!supabaseAdmin) return false;
  if (!n.paraUserId) return false;
  let gravou = false;
  try {
    const { error } = await supabaseAdmin.from("notificacoes").insert({
      user_id: n.paraUserId,
      tipo: n.tipo,
      titulo: n.titulo,
      corpo: n.corpo ?? null,
      link: n.link ?? null,
    });
    gravou = !error;
  } catch {
    gravou = false;
  }
  // Dispara o push (não bloqueia nem parte se falhar).
  try {
    await enviarPushPara([n.paraUserId], { titulo: n.titulo, corpo: n.corpo, link: n.link });
  } catch {}
  return gravou;
}

/**
 * Busca o nome próprio (user_metadata.nome) de um utilizador, para personalizar
 * mensagens. Devolve "Alguém" se não houver nome — nunca deixa a mensagem vazia.
 */
export async function nomeDoUtilizador(user_id: string): Promise<string> {
  if (!supabaseAdmin) return "Alguém";
  try {
    const { data } = await supabaseAdmin.auth.admin.getUserById(user_id);
    const meta = data?.user?.user_metadata as { nome?: string } | undefined;
    const nome = (meta?.nome || "").trim();
    return nome ? nome.split(" ")[0] : "Alguém";
  } catch {
    return "Alguém";
  }
}

/**
 * Busca o NOME DO TIME de um utilizador (tabela `equipas`, coluna `nome`).
 * Devolve null se não tiver time com nome próprio. Usado para identificar o
 * jogador pelo time (ex: "Kainan (Monstro)"), como ele aparece nas ligas.
 */
export async function nomeDoTime(user_id: string): Promise<string | null> {
  if (!supabaseAdmin) return null;
  try {
    const { data } = await supabaseAdmin
      .from("equipas")
      .select("nome")
      .eq("user_id", user_id)
      .limit(1)
      .maybeSingle();
    const nome = String(data?.nome || "").trim();
    if (!nome || nome.toLowerCase() === "a minha equipa") return null;
    return nome;
  } catch {
    return null;
  }
}

/**
 * Etiqueta de um jogador para mostrar a outros: "Nome (Time)" se tiver time
 * com nome; senão só "Nome". É como ele é reconhecido nas ligas.
 */
export async function etiquetaJogador(user_id: string): Promise<string> {
  const [nome, time] = await Promise.all([nomeDoUtilizador(user_id), nomeDoTime(user_id)]);
  return time ? `${nome} (${time})` : nome;
}
