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

// Campos OPCIONAIS de propósito: é a forma do ResultadosPorId do motorChave
// (vitorias?/derrotas?/vencidos?). Garantimos os valores dentro do garante().
type MovId = { vitorias?: number; derrotas?: number; vencidos?: string[] };
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
  // Devolve sempre um registo com os três campos preenchidos (o tipo de entrada
  // tem-nos opcionais). Muta o mapa recebido.
  const garante = (id: string): Required<MovId> => {
    const cur = resultados[id] ?? (resultados[id] = { vitorias: 0, derrotas: 0, vencidos: [] });
    cur.vitorias ??= 0;
    cur.derrotas ??= 0;
    cur.vencidos ??= [];
    return cur as Required<MovId>;
  };
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

// ---------------------------------------------------------------------------
// FASE 3B — propagar as lutas manuais para os PONTOS dos utilizadores.
//
// Os crons (chave-viva / chave-maestro) e o congelamento (lib/congelar) calculam
// cada atleta a partir do JudoBase. Aqui fundimos as lutas manuais no MESMO
// cálculo, para que os pontos de uma luta não lida contem no ranking, no mercado
// e no património — não só na chave. Se o JudoBase já leu o confronto (o
// adversário já aparece nas lutas do atleta), a manual é ignorada: nunca duplica.
// ---------------------------------------------------------------------------

export type AcoesAgregadas = {
  ippon: number; waza: number; yuko: number; shido_provocado: number;
  ippon_sof: number; waza_sof: number; yuko_sof: number; shido_sof: number;
};

// Forma do resultado por atleta que os crons produzem (vivoDoAtleta).
export interface VivoAtleta {
  vitorias: number;
  derrotas: number;
  nLutas: number;
  pontos: number;
  vencidos: string[];
  acoes: AcoesAgregadas;
  lutas: Array<{ adv: string; venceu: boolean; i: number; w: number; y: number; s: number }>;
}

/** Indexa as lutas manuais por atleta (aparece nas duas pontas do confronto). */
export function indexarManuaisPorAtleta(manuais: LutaManual[]): Map<string, LutaManual[]> {
  const idx = new Map<string, LutaManual[]>();
  const add = (id: string, m: LutaManual) => {
    const arr = idx.get(id);
    if (arr) arr.push(m); else idx.set(id, [m]);
  };
  for (const m of manuais) { if (m.a) add(m.a, m); if (m.b) add(m.b, m); }
  return idx;
}

/**
 * Funde as lutas manuais de UM atleta no resultado "ao vivo" (crons). Muta e
 * devolve `v`. Ignora um confronto que o JudoBase já leu (adversário já em
 * v.lutas). Reproduz a contabilidade do vivoDoAtleta: V/D, vencidos, nLutas,
 * pontos (com pontosLadoManual) e o agregado de ações.
 */
export function aplicarManuaisAoVivo(v: VivoAtleta, manuaisDoAtleta: LutaManual[], idPerson: string): VivoAtleta {
  if (!manuaisDoAtleta.length) return v;
  const advsLidos = new Set(v.lutas.map((l) => l.adv));
  for (const m of manuaisDoAtleta) {
    const souA = m.a === idPerson;
    const opp = souA ? m.b : m.a;
    if (!opp || opp === idPerson || advsLidos.has(opp)) continue;
    const minhas = souA ? m.aAcoes : m.bAcoes;
    const dele = souA ? m.bAcoes : m.aAcoes;
    const venceu = m.vencedor === idPerson;
    if (venceu) { v.vitorias += 1; if (!v.vencidos.includes(opp)) v.vencidos.push(opp); }
    else v.derrotas += 1;
    v.nLutas += 1;
    v.pontos += pontosLadoManual(minhas, dele);
    v.acoes.ippon += minhas.i; v.acoes.waza += minhas.w; v.acoes.yuko += minhas.y;
    v.acoes.ippon_sof += dele.i; v.acoes.waza_sof += dele.w; v.acoes.yuko_sof += dele.y;
    v.acoes.shido_provocado += dele.s; v.acoes.shido_sof += minhas.s;
    v.lutas.push({ adv: opp, venceu, i: minhas.i, w: minhas.w, y: minhas.y, s: minhas.s });
    advsLidos.add(opp);
  }
  v.pontos = Math.round(v.pontos * 10) / 10;
  return v;
}

/**
 * Funde as lutas manuais de UM atleta no CONGELAMENTO (lib/congelar). Muta o
 * agregado de ações `acc` e devolve os deltas a somar (pontos, V/D, nº de lutas).
 * `advsLidos` = adversários que o JudoBase já deu para este atleta (evita
 * duplicar); a função acrescenta-lhe os que for aplicando.
 */
export function aplicarManuaisNoCongelamento(
  acc: AcoesAgregadas,
  manuaisDoAtleta: LutaManual[],
  idPerson: string,
  advsLidos: Set<string>,
): { pontos: number; vitorias: number; derrotas: number; nLutas: number } {
  const delta = { pontos: 0, vitorias: 0, derrotas: 0, nLutas: 0 };
  for (const m of manuaisDoAtleta) {
    const souA = m.a === idPerson;
    const opp = souA ? m.b : m.a;
    if (!opp || opp === idPerson || advsLidos.has(opp)) continue;
    const minhas = souA ? m.aAcoes : m.bAcoes;
    const dele = souA ? m.bAcoes : m.aAcoes;
    delta.pontos += pontosLadoManual(minhas, dele);
    if (m.vencedor === idPerson) delta.vitorias += 1; else delta.derrotas += 1;
    delta.nLutas += 1;
    acc.ippon += minhas.i; acc.waza += minhas.w; acc.yuko += minhas.y;
    acc.ippon_sof += dele.i; acc.waza_sof += dele.w; acc.yuko_sof += dele.y;
    acc.shido_provocado += dele.s; acc.shido_sof += minhas.s;
    advsLidos.add(opp);
  }
  return delta;
}
