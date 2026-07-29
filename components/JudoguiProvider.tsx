"use client";
// components/JudoguiProvider.tsx
//
// Fornece a cor do judogui do Dôdo a TODA a app, sem ter de passar prop em cada
// sítio. Carrega a preferência do servidor (/api/judogui) uma vez quando há
// sessão; o Mascot lê via useJudogui(). O seletor (no perfil) chama setJudogui()
// para mudar na hora em todo o lado.
//
// Só quem tem Pro (ou Pro Max — os níveis são cumulativos) pode gravar, e isso
// é garantido no SERVIDOR: a API recusa. Aqui guardamos `pode`, que é a resposta
// dela, só para o seletor saber se mostra desbloqueado ou com cadeado.
//
// Repare que este campo se chama `pode` e não `isProMax`: a interface não tem de
// saber QUE nível é preciso — só se este utilizador consegue ou não. Assim, mudar
// a regra (como aconteceu: era Pro Max, passou a Pro) muda-se num sítio só, no
// servidor, e nada aqui precisa de tocar.
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
export type JudoguiCor = "branco" | "azul";
type JudoguiCtx = {
  judogui: JudoguiCor;
  /** Este utilizador pode mudar a cor? (decidido pelo servidor) */
  pode: boolean;
  userId: string | null;
  // Atualiza no servidor (se Pro Max) e no estado global. Devolve true se gravou.
  setJudogui: (cor: JudoguiCor) => Promise<boolean>;
};
const Ctx = createContext<JudoguiCtx>({
  judogui: "branco",
  pode: false,
  userId: null,
  setJudogui: async () => false,
});
export function useJudogui() {
  return useContext(Ctx);
}
export function JudoguiProvider({ children }: { children: React.ReactNode }) {
  const [judogui, setJudoguiState] = useState<JudoguiCor>("branco");
  const [pode, setPode] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      const uid = data.session?.user?.id ?? null;
      setUserId(uid);
      if (!uid) return;
      fetch(`/api/judogui?user_id=${encodeURIComponent(uid)}`)
        .then((r) => r.json())
        .then((j) => {
          if (!active || !j?.ok) return;
          if (j.judogui === "azul" || j.judogui === "branco") setJudoguiState(j.judogui);
          setPode(!!j.pode);
        })
        .catch(() => {});
    });
    return () => { active = false; };
  }, []);
  const setJudogui = useCallback(async (cor: JudoguiCor): Promise<boolean> => {
    if (!userId) return false;
    const anterior = judogui;
    setJudoguiState(cor); // otimista — muda já em todo o lado
    try {
      const r = await fetch("/api/judogui", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, judogui: cor }),
      });
      const j = await r.json();
      if (!j?.ok) { setJudoguiState(anterior); return false; }
      return true;
    } catch {
      setJudoguiState(anterior);
      return false;
    }
  }, [userId, judogui]);
  return (
    <Ctx.Provider value={{ judogui, pode, userId, setJudogui }}>
      {children}
    </Ctx.Provider>
  );
}
