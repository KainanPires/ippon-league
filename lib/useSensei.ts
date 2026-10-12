// lib/useSensei.ts
//
// Hook simples: diz se o utilizador ATUAL tem o selo de Sensei ATIVO
// (users.sensei_ate no futuro). Lê uma vez e guarda em cache de módulo, como o
// useFundador. Defensivo: se a coluna ainda não existir, devolve false (sem selo)
// em vez de rebentar.
"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

let cache: boolean | null = null;

export function limparCacheSensei() {
  cache = null;
}

export function useSensei(): boolean {
  const [sensei, setSensei] = useState<boolean>(cache ?? false);
  useEffect(() => {
    if (cache !== null) { setSensei(cache); return; }
    let vivo = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const uid = data.session?.user?.id;
        if (!uid) return;
        const { data: row } = await supabase.from("users").select("sensei_ate").eq("id", uid).maybeSingle();
        const ate = (row as { sensei_ate?: string | null } | null)?.sensei_ate;
        const val = !!ate && Date.parse(String(ate)) > Date.now();
        cache = val;
        if (vivo) setSensei(val);
      } catch { /* coluna ainda não existe, ou sem ligação: não mostra o selo */ }
    })();
    return () => { vivo = false; };
  }, []);
  return sensei;
}
