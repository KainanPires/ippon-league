// Cliente Supabase (frontend).
// Usa as variáveis públicas configuradas na Vercel:
//   NEXT_PUBLIC_SUPABASE_URL
//   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY  (chave pública — substitui a antiga "anon")
// A chave secreta (SUPABASE_SECRET_KEY) NUNCA é usada aqui.
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";

export const supabase = createClient(url, key);

/** True se as variáveis de ambiente estão presentes. */
export const supabaseConfigured = Boolean(url && key);
