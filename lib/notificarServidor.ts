// lib/notificarServidor.ts
// A "ponte" das notificações (lado do servidor):
//  - grava a notificação na tabela `notificacoes` (para aparecer no sino), e
//  - dispara a push para o telemóvel.
// Usar nos processos de servidor onde os eventos acontecem (fecho de rodada,
// copa, ranking, faixas...). Falha em silêncio: uma notificação nunca deve
// partir o processo principal.
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { enviarPushPara } from "@/lib/pushServer";

export type NotificacaoServidor = {
  tipo: string;
  titulo: string;
  corpo?: string;
  link?: string;
};

// Notifica UM utilizador (sino + push).
export async function notificarEEnviar(userId: string, n: NotificacaoServidor): Promise<void> {
  if (!supabaseAdmin || !userId) return;
  try {
    await supabaseAdmin.from("notificacoes").insert({
      user_id: userId,
      tipo: n.tipo,
      titulo: n.titulo,
      corpo: n.corpo ?? null,
      link: n.link ?? null,
    });
  } catch {}
  try {
    await enviarPushPara([userId], { titulo: n.titulo, corpo: n.corpo, link: n.link });
  } catch {}
}

// Notifica VÁRIOS utilizadores com a MESMA mensagem (ex.: "mercado aberto").
export async function notificarVarios(userIds: string[], n: NotificacaoServidor): Promise<void> {
  if (!supabaseAdmin) return;
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return;
  try {
    const linhas = ids.map((user_id) => ({
      user_id,
      tipo: n.tipo,
      titulo: n.titulo,
      corpo: n.corpo ?? null,
      link: n.link ?? null,
    }));
    await supabaseAdmin.from("notificacoes").insert(linhas);
  } catch {}
  try {
    await enviarPushPara(ids, { titulo: n.titulo, corpo: n.corpo, link: n.link });
  } catch {}
}
