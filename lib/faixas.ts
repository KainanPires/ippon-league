// lib/faixas.ts
//
// Faixas do JOGO (a identidade oficial na Ippon League — calculada por desempenho
// mensal, guardada em users.belt). NÃO confundir com a faixa do judô real que o
// utilizador declarou no registo (user_metadata.faixa), que é só informativa.
//
// Aqui ficam: a ordem das faixas, a cor (hex) de cada uma (para o Mascot e adornos)
// e o nome bonito para mostrar. E um helper para ler a faixa do jogo de um user.

import { supabase } from "@/lib/supabase";

// Chaves tal como estão guardadas em users.belt (minúsculas, como a constraint exige).
export type Faixa = "branca" | "azul" | "amarela" | "verde" | "roxa" | "marrom" | "preta";

// Ordem da mais baixa para a mais alta (progressão).
export const ORDEM_FAIXAS: Faixa[] = ["branca", "azul", "amarela", "verde", "roxa", "marrom", "preta"];

// Cor principal de cada faixa (usada no Mascot belt={hex} e em adornos).
export const COR_FAIXA: Record<Faixa, string> = {
  branca: "#efeadd",
  azul: "#3b6fb5",
  amarela: "#e8c84b",
  verde: "#3f8f5a",
  roxa: "#7a4fa3",
  marrom: "#6b4a2f",
  preta: "#1a1a1a",
};

// Nome para mostrar (capitalizado).
export const NOME_FAIXA: Record<Faixa, string> = {
  branca: "Branca",
  azul: "Azul",
  amarela: "Amarela",
  verde: "Verde",
  roxa: "Roxa",
  marrom: "Marrom",
  preta: "Preta",
};

// Normaliza qualquer string para uma Faixa válida (cai em "branca" se não bater).
export function normalizarFaixa(v: string | null | undefined): Faixa {
  const s = String(v || "").trim().toLowerCase();
  return (ORDEM_FAIXAS as string[]).includes(s) ? (s as Faixa) : "branca";
}

// Cor e nome a partir de qualquer valor.
export function corDaFaixa(v: string | null | undefined): string {
  return COR_FAIXA[normalizarFaixa(v)];
}
export function nomeDaFaixa(v: string | null | undefined): string {
  return NOME_FAIXA[normalizarFaixa(v)];
}

// Índice na progressão (0 = branca ... 6 = preta). Útil para saber se subiu/desceu.
export function nivelDaFaixa(v: string | null | undefined): number {
  return ORDEM_FAIXAS.indexOf(normalizarFaixa(v));
}

// Lê a faixa do JOGO de um utilizador (users.belt). Devolve "branca" por defeito.
// Lê direto do cliente — a tabela users tem RLS de leitura para autenticados.
export async function lerFaixaDoJogo(userId: string): Promise<Faixa> {
  try {
    const { data } = await supabase.from("users").select("belt").eq("id", userId).maybeSingle();
    return normalizarFaixa(data?.belt);
  } catch {
    return "branca";
  }
}
