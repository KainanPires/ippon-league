import { supabase } from "@/lib/supabase";
// Preferências de tutorial guardadas na CONTA (user_metadata), para sobreviverem
// a logins e a troca de dispositivo. O localStorage é só uma cache rápida (este
// aparelho), para decidir logo no primeiro render sem esperar pela rede.
export type TutKey =
  | "ippon_onboarding"
  | "ippon_team_tutorial"
  | "ippon_market_tutorial"
  | "ippon_meutime_tut_edicao"
  | "ippon_meutime_tut_competicao";
// Já foi visto NESTE aparelho? (instantâneo, sem rede)
export function tutorialVistoLocal(key: TutKey): boolean {
  try {
    return !!localStorage.getItem(key);
  } catch {
    return false;
  }
}
// Conjunto de tutoriais já vistos GUARDADOS NA CONTA. Devolve {} se não houver
// sessão ou em caso de erro de rede.
export async function tutoriaisVistosConta(): Promise<Record<string, boolean>> {
  try {
    const { data } = await supabase.auth.getSession();
    const meta = data.session?.user?.user_metadata as { tutoriais?: Record<string, boolean> } | undefined;
    return meta?.tutoriais ?? {};
  } catch {
    return {};
  }
}
// Marca um tutorial como visto: cache local (este aparelho) + conta (todos os
// aparelhos). Para visitantes (sem sessão) fica só o local.
export async function marcarTutorialVisto(key: TutKey): Promise<void> {
  try {
    localStorage.setItem(key, "done");
  } catch {}
  try {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return; // visitante: fica só a cache local
    const meta = (data.session.user?.user_metadata ?? {}) as { tutoriais?: Record<string, boolean> };
    const tutoriais = { ...(meta.tutoriais ?? {}), [key]: true };
    await supabase.auth.updateUser({ data: { tutoriais } });
  } catch {}
}
