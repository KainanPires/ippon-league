import { supabase } from "@/lib/supabase";
// Preferências de tutorial guardadas na CONTA (user_metadata), para sobreviverem
// a logins e a troca de dispositivo. O localStorage é só uma cache rápida (este
// aparelho), para decidir logo no primeiro render sem esperar pela rede.
export type TutKey =
  | "ippon_onboarding"
  | "ippon_team_tutorial"
  | "ippon_market_tutorial"
  | "ippon_meutime_tut_edicao"
  | "ippon_meutime_tut_competicao"
  // Aviso que aparece LOGO A SEGUIR a guardar a equipa, a explicar o que vem
  // agora (aguardar a competição do fim de semana, ver os pontos, comparar com
  // os amigos). Nasceu de um feedback real: as pessoas guardavam a equipa e
  // ficavam com "e agora?" — não havia nada a dizer-lhes o que esperar.
  // Tem "não mostrar mais", por isso é uma preferência como as outras.
  | "ippon_aviso_pos_guardar";
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

// Ainda se deve MOSTRAR este aviso/tutorial? Verifica as DUAS fontes: a cache
// deste aparelho e a preferência guardada na conta (que vale em qualquer
// aparelho). Se a conta já o tem mas o local não, alinha a cache local para não
// voltar a ir à rede da próxima vez.
//
// É o helper que faltava: sem ele, cada ecrã repetia a mesma dança de duas
// fontes à mão — e foi assim que nasceram bugs de tutoriais a reaparecer.
export async function deveMostrarTutorial(key: TutKey): Promise<boolean> {
  if (tutorialVistoLocal(key)) return false;
  const vistos = await tutoriaisVistosConta();
  if (vistos[key]) {
    try { localStorage.setItem(key, "done"); } catch {}
    return false;
  }
  return true;
}
