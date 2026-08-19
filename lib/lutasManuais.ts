// lib/lutasManuais.ts
//
// RESULTADOS MANUAIS da chave — o que o chaveador insere quando o JudoBase não
// leu uma luta (a chave ficaria presa sem o vencedor). Guardados na tabela
// `lutas_manuais`, SEPARADOS da resultados_atletas (que o cron reescreve do
// JudoBase e apagaria qualquer edição manual).
//
// São FUNDIDOS na leitura da chave (lib/montarChave -> fundirManuaisNaChave):
//   • acrescentam o head-to-head (vencedor venceu perdedor) -> o motor avança;
//   • somam os pontos e as ações da luta, com as MESMAS regras do motor;
//   • se o JudoBase já tiver lido a luta (o confronto já existe), a fusão ignora
//     a manual — nunca duplica.
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { scoreActions, scoreShidosSofridos, scoreShidosProvocados, type ActionType } from "@/lib/engine";

export interface AcoesLado { i: number; w: number; y: number; s: number } // s = shidos SOFRIDOS

export interface LutaManual {
  id: string;
  comp: string;
  cat: string;
  a: string;          // id_person do lado A
  b: string;          // id_person do lado B
  vencedor: string;   // = a ou b
  aAcoes: AcoesLado;
  bAcoes: AcoesLado;
}

const num = (v: unknown): number => { const x = parseInt(String(v ?? "0"), 10); return isNaN(x) ? 0 : x; };

/** Lê as lutas manuais de uma competição (opcionalmente de uma categoria). */
export async function lerLutasManuais(comp: string, cat?: string): Promise<LutaManual[]> {
  if (!supabaseAdmin || !comp) return [];
  let q = supabaseAdmin
    .from("lutas_manuais")
    .select("id, id_competicao, weight_category, id_person_a, id_person_b, id_vencedor, a_ippon, a_waza, a_yuko, a_shido, b_ippon, b_waza, b_yuko, b_shido")
    .eq("id_competicao", comp);
  if (cat) q = q.eq("weight_category", cat);
  const { data } = await q;
  return (data || []).map((r) => ({
    id: String(r.id),
    comp: String(r.id_competicao),
    cat: String(r.weight_category),
    a: String(r.id_person_a),
    b: String(r.id_person_b),
    vencedor: String(r.id_vencedor),
    aAcoes: { i: num(r.a_ippon), w: num(r.a_waza), y: num(r.a_yuko), s: num(r.a_shido) },
    bAcoes: { i: num(r.b_ippon), w: num(r.b_waza), y: num(r.b_yuko), s: num(r.b_shido) },
  }));
}

/**
 * Pontos de UM lado de uma luta, com as MESMAS regras do motor (scoreContestSide):
 *   + ações feitas (ippon/waza/yuko)
 *   − ações sofridas (as feitas pelo adversário)
 *   − shidos sofridos (crescente: -2,-3,-4)
 *   + shidos provocados no adversário (crescente: +1,+2,+3)
 * Não há ippon-fantasma de hansoku: o chaveador insere as ações reais.
 */
export function pontosLadoManual(propria: AcoesLado, adversario: AcoesLado): number {
  const acts: ActionType[] = [];
  for (let k = 0; k < propria.i; k++) acts.push("ippon_feito");
  for (let k = 0; k < propria.w; k++) acts.push("waza_ari_feito");
  for (let k = 0; k < propria.y; k++) acts.push("yuko_feito");
  for (let k = 0; k < adversario.i; k++) acts.push("ippon_sofrido");
  for (let k = 0; k < adversario.w; k++) acts.push("waza_ari_sofrido");
  for (let k = 0; k < adversario.y; k++) acts.push("yuko_sofrido");
  let total = scoreActions(acts);
  total += scoreShidosSofridos(propria.s);        // shidos que ESTE lado sofreu
  total += scoreShidosProvocados(adversario.s);   // shidos do adversário = provocados por este lado
  return total;
}

type MovId = { vitorias: number; derrotas: number; vencidos: string[] };
type InfoId = { pontos: number; nLutas: number; acoes: unknown };
type SelosPar = Record<string, { i: number; w: number; y: number; s: number }>;

/**
 * Funde as lutas manuais nos mapas que a montarChaveDaBase já construiu, ANTES
 * de correr o motor. Muta os mapas recebidos (movimento, infos e selos por par).
 * Ignora uma luta manual se o confronto já existe (o JudoBase apanhou-a) — assim
 * não duplica quando os dados oficiais chegam.
 */
export function fundirManuaisNaChave(
  manuais: LutaManual[],
  resultados: Record<string, MovId>,
  infos: Record<string, InfoId>,
  selosPar: SelosPar,
): void {
  const garante = (id: string): MovId => (resultados[id] ||= { vitorias: 0, derrotas: 0, vencidos: [] });
  const garanteInfo = (id: string): InfoId => (infos[id] ||= { pontos: 0, nLutas: 0, acoes: null });

  for (const m of manuais) {
    if (!m.a || !m.b || !m.vencedor) continue;
    // Já lida pelo JudoBase (em qualquer sentido)? Então não mexemos.
    const jaLida =
      (resultados[m.a]?.vencidos?.includes(m.b) ?? false) ||
      (resultados[m.b]?.vencidos?.includes(m.a) ?? false);
    if (jaLida) continue;

    const perdedor = m.vencedor === m.a ? m.b : m.a;

    // Movimento: o vencedor venceu o perdedor -> o motor avança a chave.
    const rv = garante(m.vencedor);
    const rp = garante(perdedor);
    if (!rv.vencidos.includes(perdedor)) {
      rv.vencidos.push(perdedor);
      rv.vitorias += 1;
      rp.derrotas += 1;
    }

    // Pontos + nº de lutas (para o cartão da chave).
    garanteInfo(m.a).pontos += pontosLadoManual(m.aAcoes, m.bAcoes);
    garanteInfo(m.a).nLutas += 1;
    garanteInfo(m.b).pontos += pontosLadoManual(m.bAcoes, m.aAcoes);
    garanteInfo(m.b).nLutas += 1;

    // Selos deste confronto (ippon/waza/yuko/shido de cada lado).
    selosPar[`${m.a}->${m.b}`] = { i: m.aAcoes.i, w: m.aAcoes.w, y: m.aAcoes.y, s: m.aAcoes.s };
    selosPar[`${m.b}->${m.a}`] = { i: m.bAcoes.i, w: m.bAcoes.w, y: m.bAcoes.y, s: m.bAcoes.s };
  }
}
