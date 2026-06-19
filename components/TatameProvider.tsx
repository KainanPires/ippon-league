"use client";

// components/TatameProvider.tsx
//
// Fornece a cor do tatame a TODA a app (como o JudoguiProvider faz para o judogui),
// para que mudar num sítio (Meu Time ou central Pro Max) se reflita na hora em
// todo o lado. Carrega a preferência do servidor (/api/tatame) uma vez quando há
// sessão. Só Pro Max pode gravar — garantido NO SERVIDOR (a API recusa).

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { TATAME_DEFAULT, tatamePorId, type TatameId } from "@/lib/tatames";

type TatameCtx = {
  tatameId: TatameId;
  isProMax: boolean;
  userId: string | null;
  // Atualiza no servidor (se Pro Max) e no estado global. Devolve true se gravou.
  setTatame: (id: TatameId) => Promise<boolean>;
};

const Ctx = createContext<TatameCtx>({
  tatameId: TATAME_DEFAULT,
  isProMax: false,
  userId: null,
  setTatame: async () => false,
});

export function useTatame() {
  return useContext(Ctx);
}

export function TatameProvider({ children }: { children: React.ReactNode }) {
  const [tatameId, setTatameState] = useState<TatameId>(TATAME_DEFAULT);
  const [isProMax, setIsProMax] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      const uid = data.session?.user?.id ?? null;
      setUserId(uid);
      if (!uid) return;
      fetch(`/api/tatame?user_id=${encodeURIComponent(uid)}`)
        .then((r) => r.json())
        .then((j) => {
          if (!active || !j?.ok) return;
          setTatameState(tatamePorId(j.tatame).id);
          setIsProMax(!!j.is_pro_max);
        })
        .catch(() => {});
    });
    return () => { active = false; };
  }, []);

  const setTatame = useCallback(async (id: TatameId): Promise<boolean> => {
    if (!userId) return false;
    const anterior = tatameId;
    setTatameState(id); // otimista — muda já em todo o lado
    try {
      const r = await fetch("/api/tatame", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, tatame: id }),
      });
      const j = await r.json();
      if (!j?.ok) { setTatameState(anterior); return false; }
      return true;
    } catch {
      setTatameState(anterior);
      return false;
    }
  }, [userId, tatameId]);

  return (
    <Ctx.Provider value={{ tatameId, isProMax, userId, setTatame }}>
      {children}
    </Ctx.Provider>
  );
}
