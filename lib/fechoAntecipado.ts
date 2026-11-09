// lib/fechoAntecipado.ts
//
// FECHO ANTECIPADO DA RODADA (só servidor).
//
// Decidido com o Kainan (9/11/2026): os Judocoins de uma competição passam a ser
// calculados ASSIM QUE TODAS AS CHAVES ESTÃO COMPLETAS (campeão decidido em todas
// as categorias, bronzes incluídos) + uma FOLGA de 2 horas — em vez de esperar
// sempre pelas 60h desde o início. As 60h continuam como rede de segurança
// (lib/calendario → competicaoFechada): se a chave nunca chegar a ficar completa
// (falha da IJF, categoria sem moldura), o cálculo corre na mesma às 60h.
//
// PORQUÊ A FOLGA: o congelamento é DEFINITIVO (o preço de cada atleta parte do
// anterior; repetir duplicaria a variação). A IJF às vezes corrige um resultado
// pouco depois da final — as 2 horas dão margem para isso chegar antes.
//
// A MARCA DO "COMPLETO DESDE": guarda-se em `eventos_notificados` (tabela que já
// existe, chave única) como `chaves_completas:<comp>:<ISO>` — o instante em que
// se viu pela primeira vez tudo completo. Sem tabela nova.
//
// NÃO MEXE nos cálculos: só decide QUANDO o motor de sempre (lib/congelar) corre.
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { montarChaveDaBase, type ChaveMontada } from "@/lib/montarChave";

export const FOLGA_FECHO_MS = 2 * 60 * 60 * 1000;
const PREFIXO = "chaves_completas:";

/** A rodada desta competição já foi calculada (há resultados por utilizador)? */
export async function rodadaJaCongelada(comp: string): Promise<boolean> {
  if (!supabaseAdmin) return false;
  const { count, error } = await supabaseAdmin
    .from("resultados_rodada")
    .select("user_id", { count: "exact", head: true })
    .eq("id_competicao", comp);
  return !error && (count ?? 0) > 0;
}

/** Categoria terminada: há campeão e nenhum bronze ficou por lutar. */
function categoriaTerminada(m: ChaveMontada): boolean {
  const c = m.chave;
  if (!c || !c.campeao) return false;
  for (const b of c.bronzes) {
    if (!b || b.vencedor) continue;
    // Os dois lados conhecidos e ainda sem vencedor: o bronze ainda vai lutar-se.
    if (b.azul?.id && b.branco?.id) return false;
    // Um lado vazio com a final já decidida: não há bronze desse lado (categoria
    // pequena / walkover). Não impede o fecho.
  }
  return true;
}

/** Todas as categorias inscritas têm a chave completa? */
export async function todasAsChavesTerminadas(comp: string): Promise<{ completa: boolean; total: number; faltam: string[] }> {
  if (!supabaseAdmin) return { completa: false, total: 0, faltam: [] };
  // Categorias dos inscritos (cache da competição). Sem lista, não há certeza.
  const { data: cacheRow } = await supabaseAdmin
    .from("atletas_cache").select("atletas").eq("id_competition", comp).maybeSingle();
  const lista = Array.isArray(cacheRow?.atletas) ? (cacheRow!.atletas as Array<{ category?: unknown }>) : [];
  const categorias = Array.from(new Set(lista.map((a) => (a?.category != null ? String(a.category) : "")).filter(Boolean)));
  if (categorias.length === 0) return { completa: false, total: 0, faltam: [] };

  const faltam: string[] = [];
  for (const cat of categorias) {
    const m = await montarChaveDaBase(comp, cat);
    // Sem moldura não se sabe se acabou: fica para as 60h.
    if (!m.existeMoldura || !categoriaTerminada(m)) faltam.push(cat);
  }
  return { completa: faltam.length === 0, total: categorias.length, faltam };
}

/**
 * Pode calcular-se já esta competição (antes das 60h)?
 * Só se ainda não foi calculada, todas as chaves estão completas e já passou a
 * folga desde que se viu tudo completo pela primeira vez.
 */
export async function prontaParaFechoAntecipado(comp: string, agora: number = Date.now()): Promise<{ pronta: boolean; motivo: string }> {
  if (!supabaseAdmin) return { pronta: false, motivo: "sem_base" };
  if (await rodadaJaCongelada(comp)) return { pronta: false, motivo: "ja_calculada" };

  const r = await todasAsChavesTerminadas(comp);
  if (!r.completa) return { pronta: false, motivo: `chaves_por_terminar:${r.faltam.length}/${r.total}` };

  // Desde quando está tudo completo?
  const base = `${PREFIXO}${comp}:`;
  let desde = agora;
  try {
    const { data } = await supabaseAdmin
      .from("eventos_notificados").select("chave").like("chave", `${base}%`).limit(1);
    const existente = data && data[0] ? String(data[0].chave) : null;
    if (existente) {
      const t = Date.parse(existente.slice(base.length));
      if (Number.isFinite(t)) desde = t;
    } else {
      await supabaseAdmin.from("eventos_notificados").insert({ chave: `${base}${new Date(agora).toISOString()}` });
    }
  } catch {
    return { pronta: false, motivo: "marca_falhou" };
  }
  const passou = agora - desde;
  if (passou < FOLGA_FECHO_MS) {
    return { pronta: false, motivo: `folga:${Math.ceil((FOLGA_FECHO_MS - passou) / 60000)}min` };
  }
  return { pronta: true, motivo: "chaves_completas" };
}
