// lib/limitesLiga.ts
//
// A REGRA DOS LIMITES DE LIGA, NUM SÍTIO SÓ.
//
// ---------------------------------------------------------------------------
// PORQUE ISTO EXISTE
//
// Havia QUATRO caminhos para uma pessoa entrar numa liga — /criar, /entrar,
// /pedir e /decidir — e cada um tinha a sua própria ideia dos limites:
//
//   criar   : 1 criada (free) / 5 (pro), mais 2 participações (free) / 5 (pro)
//   entrar  : 2 (free) / 5 (pro), tudo no mesmo saco
//   pedir   : igual ao entrar
//   decidir : NENHUM — o dono aprovava e a pessoa entrava, ponto final
//
// O último era um buraco a sério: bastava pedir para entrar em dez ligas e ter
// os pedidos aceites para contornar o limite por completo.
//
// Regras iguais espalhadas por vários ficheiros divergem sempre — mais cedo ou
// mais tarde alguém corrige uma e esquece as outras. Por isso vive aqui, e os
// quatro caminhos chamam a mesma função.
// ---------------------------------------------------------------------------
//
// A REGRA (Kainan, 29/07/2026)
//
//   grátis  ->  1 liga  +  1 mata-mata
//   Pro     ->  5       +  5
//   Pro Max -> 10       + 10
//
// Contam-se SEPARADAMENTE: quem tem uma liga pode na mesma ter um mata-mata.
// Criar conta como participar (o criador é sempre membro), por isso não há um
// limite separado para criação — seria uma segunda regra a discordar da primeira.
//
// NÃO CONTAM:
//   • ligas terminadas — já acabaram, não ocupam lugar
//   • ligas oficiais (mundial/continental) — automáticas, e só Pro
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const LIMITES = {
  gratis: { pontos: 1, copa: 1 },
  pro: { pontos: 5, copa: 5 },
  promax: { pontos: 10, copa: 10 },
} as const;

export type NivelUtilizador = keyof typeof LIMITES;

/**
 * Nível do utilizador.
 *
 * Lê da TABELA `users`, nunca do user_metadata. A tabela é a fonte de verdade;
 * o metadata é uma cache do lado do cliente e não serve para decidir limites.
 * Em caso de dúvida devolve "gratis": errar para o lado mais restritivo é
 * preferível a dar de graça o que é pago.
 */
export async function nivelDoUtilizador(user_id: string): Promise<NivelUtilizador> {
  if (!supabaseAdmin || !user_id) return "gratis";
  try {
    const { data } = await supabaseAdmin
      .from("users").select("is_pro, is_pro_max").eq("id", user_id).maybeSingle();
    if (data?.is_pro_max) return "promax";
    if (data?.is_pro) return "pro";
    return "gratis";
  } catch {
    return "gratis";
  }
}

/** A liga já terminou? (a mesma regra do /ligas, /inicio, /mercado e /sair) */
export function ligaTerminada(l: { formato?: unknown; estado?: unknown; copa_estado?: unknown }): boolean {
  if (String(l.formato) === "copa") return String(l.copa_estado) === "terminada";
  return String(l.estado) === "terminada";
}

/**
 * Quantas ligas de amigos ATIVAS este utilizador tem, separadas por formato.
 * Inclui as que criou (é membro delas). Exclui terminadas e oficiais.
 */
export async function contarPorFormato(user_id: string): Promise<{ pontos: number; copa: number }> {
  const zero = { pontos: 0, copa: 0 };
  if (!supabaseAdmin || !user_id) return zero;
  try {
    const { data: filiacoes } = await supabaseAdmin
      .from("league_members")
      .select("league_id")
      .eq("user_id", user_id);
    const ids = (filiacoes || []).map((f) => f.league_id);
    if (ids.length === 0) return zero;
    const { data: ligas } = await supabaseAdmin
      .from("leagues")
      .select("id, formato, estado, copa_estado")
      .in("id", ids)
      .eq("type", "amigos");
    const out = { pontos: 0, copa: 0 };
    for (const l of ligas || []) {
      if (ligaTerminada(l)) continue;
      if (String(l.formato) === "copa") out.copa++;
      else out.pontos++;
    }
    return out;
  } catch {
    return zero;
  }
}

/**
 * Bateu no limite? Devolve a mensagem de erro, ou null se pode entrar.
 *
 * A mensagem diz sempre quantas tem, o que a impede e o que ganha ao subir de
 * nível. Um "não podes" sem explicação é a forma mais rápida de perder alguém —
 * e aqui a explicação é também o argumento de venda.
 */
export async function bloqueioPorLimite(user_id: string, ehCopa: boolean): Promise<string | null> {
  const nivel = await nivelDoUtilizador(user_id);
  const lim = LIMITES[nivel];
  const atual = await contarPorFormato(user_id);
  const usadas = ehCopa ? atual.copa : atual.pontos;
  const maximo = ehCopa ? lim.copa : lim.pontos;
  if (usadas < maximo) return null;

  const oQue = ehCopa
    ? (maximo === 1 ? "num mata-mata" : `em ${maximo} mata-matas`)
    : (maximo === 1 ? "numa liga" : `em ${maximo} ligas`);
  // A saída é diferente conforme o formato — e é isso que faz a mensagem útil.
  const sair = ehCopa
    ? "Um mata-mata não se abandona a meio: espera que este termine para entrares noutro."
    : "Para entrares noutra, sai primeiro da atual.";

  if (nivel === "promax") return `Já estás ${oQue} — é o máximo, mesmo com Pro Max. ${sair}`;
  if (nivel === "pro") {
    const sobe = ehCopa ? `${LIMITES.promax.copa} mata-matas` : `${LIMITES.promax.pontos} ligas`;
    return `Já estás ${oQue}. ${sair} Com o Pro Max sobes até ${sobe}.`;
  }
  const sobe = ehCopa ? `${LIMITES.pro.copa} mata-matas` : `${LIMITES.pro.pontos} ligas`;
  return `Já estás ${oQue}. ${sair} Com o Ippon Pro sobes até ${sobe}.`;
}
