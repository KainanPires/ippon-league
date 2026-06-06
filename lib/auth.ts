"use client";

/**
 * Guarda de ação (passo #6 — "login só ao agir").
 *
 * Ideia: explorar a app é livre. Só quando o utilizador tenta AGIR
 * (contratar, salvar, criar liga, assinar Pro, editar perfil) é que
 * verificamos se há sessão. Se não houver, mandamos ao /entrar guardando
 * o sítio de onde veio, para o trazer de volta depois de entrar.
 */
import { supabase } from "@/lib/supabase";

/** Há sessão iniciada agora? */
export async function temSessao(): Promise<boolean> {
  try {
    const { data } = await supabase.auth.getSession();
    return !!data.session;
  } catch {
    return false;
  }
}

/**
 * Garante que há sessão antes de uma ação.
 *  - Se houver: devolve true (segue a ação).
 *  - Se não houver: leva ao /entrar?voltar=<sítio atual> e devolve false.
 *
 * @param voltarPara sítio para onde regressar depois do login.
 *        Por defeito, a página atual (caminho + query).
 */
export async function exigirSessao(voltarPara?: string): Promise<boolean> {
  if (await temSessao()) return true;

  let destino = voltarPara;
  if (!destino && typeof window !== "undefined") {
    destino = window.location.pathname + window.location.search;
  }
  const qs = destino ? `?voltar=${encodeURIComponent(destino)}` : "";
  if (typeof window !== "undefined") {
    window.location.href = `/entrar${qs}`;
  }
  return false;
}
