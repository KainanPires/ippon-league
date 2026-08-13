// lib/i18nServidor.ts
//
// Tradução de notificações DO LADO DO SERVIDOR.
//
// Junta duas coisas que o servidor precisa para mandar uma notificação na língua
// de quem a recebe:
//   1) descobrir a LÍNGUA do destinatário (rápido, em lote quando são muitos);
//   2) RENDERIZAR uma chave do dicionário nessa língua, com as variáveis.
//
// NUNCA importar num componente de cliente ("use client") — usa supabaseAdmin.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { renderNotif, type LinguaNotif } from "@/lib/dicionarioNotif";

export { renderNotif };
export type { LinguaNotif };

const VALIDAS = ["pt", "en", "es", "fr", "de"];

/** Garante uma língua válida; o que não reconhecer cai em "pt". */
export function normalizarLingua(l: string | null | undefined): LinguaNotif {
  const v = String(l || "").toLowerCase();
  return (VALIDAS.includes(v) ? v : "pt") as LinguaNotif;
}

/**
 * Língua de UM utilizador. Lê a coluna rápida `users.lingua`; se estiver vazia,
 * recorre ao metadata da conta. Devolve "pt" se nada disso resultar.
 */
export async function linguaDeUtilizador(userId: string): Promise<LinguaNotif> {
  if (!supabaseAdmin || !userId) return "pt";
  try {
    const { data } = await supabaseAdmin.from("users").select("lingua").eq("id", userId).maybeSingle();
    if (data?.lingua) return normalizarLingua(data.lingua as string);
    // Recurso: metadata da conta (onde a preferência também vive).
    const { data: au } = await supabaseAdmin.auth.admin.getUserById(userId);
    const meta = au?.user?.user_metadata as { lingua?: string } | undefined;
    return normalizarLingua(meta?.lingua);
  } catch {
    return "pt";
  }
}

/**
 * Língua de MUITOS utilizadores, numa só consulta (para envios em massa). Devolve
 * um mapa id → língua; quem não tiver língua definida fica em "pt".
 */
export async function linguasDeVarios(userIds: string[]): Promise<Record<string, LinguaNotif>> {
  const out: Record<string, LinguaNotif> = {};
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!supabaseAdmin || ids.length === 0) return out;
  try {
    const { data } = await supabaseAdmin.from("users").select("id, lingua").in("id", ids);
    for (const r of data || []) {
      out[String((r as { id: string }).id)] = normalizarLingua((r as { lingua?: string }).lingua);
    }
  } catch {}
  for (const id of ids) if (!out[id]) out[id] = "pt";
  return out;
}

/**
 * Agrupa uma lista de utilizadores pela língua de cada um — útil para renderizar
 * cada texto UMA vez e mandar a todos os que partilham a língua.
 */
export async function agruparPorLingua(userIds: string[]): Promise<Record<LinguaNotif, string[]>> {
  const linguas = await linguasDeVarios(userIds);
  const grupos: Record<string, string[]> = {};
  for (const id of [...new Set(userIds.filter(Boolean))]) {
    const lg = linguas[id] || "pt";
    (grupos[lg] ||= []).push(id);
  }
  return grupos as Record<LinguaNotif, string[]>;
}
