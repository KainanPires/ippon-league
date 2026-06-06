// Cliente Supabase SÓ PARA O SERVIDOR (Route Handlers / Server Components).
// Usa a CHAVE SECRETA — NUNCA importar isto em componentes do cliente ("use client").
// Serve para o servidor escrever no cache de atletas (tabela atletas_cache).
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const secret = process.env.SUPABASE_SECRET_KEY || "";

/** null se faltar configuração — quem usa deve verificar antes de chamar. */
export const supabaseAdmin =
  url && secret
    ? createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } })
    : null;
