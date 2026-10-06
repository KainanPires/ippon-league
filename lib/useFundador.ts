// lib/useFundador.ts
//
// Hook simples: diz se o utilizador ATUAL é Fundador (users.fundador). Lê uma vez
// e guarda em cache de módulo (como os outros hooks de estado da conta), para os
// vários cards de partilha e ecrãs poderem mostrar o selo sem cada um ir à base.
"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

let cache: boolean | null = null;

export function limparCacheFundador() {
  cache = null;
}

export function useFundador(): boolean {
  const [fundador, setFundador] = useState<boolean>(cache ?? false);
  useEffect(() => {
    if (cache !== null) { setFundador(cache); return; }
    let vivo = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const uid = data.session?.user?.id;
        if (!uid) return;
        const { data: row } = await supabase.from("users").select("fundador").eq("id", uid).maybeSingle();
        const val = !!(row as { fundador?: unknown } | null)?.fundador;
        cache = val;
        if (vivo) setFundador(val);
      } catch { /* na dúvida, não mostra o selo */ }
    })();
    return () => { vivo = false; };
  }, []);
  return fundador;
}
