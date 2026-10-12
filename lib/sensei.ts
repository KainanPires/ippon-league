// lib/sensei.ts
//
// SELO DE SENSEI (sazonal, semanal).
//
// Dá-se o selo ao CRIADOR de uma liga de AMIGOS cuja liga tenha, na última
// semana, pelo menos MIN_SENSEI membros ATIVOS (que montaram/atualizaram equipa
// nos últimos JANELA_DIAS dias). É sazonal: renova-se semana a semana. Quem não
// chega ao objetivo numa semana perde o selo na seguinte (a data expira).
//
// Guardado em users.sensei_ate (até quando o selo vale). O recálculo vive aqui
// (puro, testável) e é disparado por /api/sensei-semanal, de semana a semana.
//
// Nota: NÃO rebaixa ninguém à mão. Quem deixa de qualificar simplesmente não
// tem a data renovada e o selo expira sozinho (sensei_ate < agora). A validade
// é um pouco maior do que a janela (VALIDADE_DIAS > JANELA_DIAS) para não haver
// intermitência entre duas corridas semanais de quem continua a qualificar.

import type { SupabaseClient } from "@supabase/supabase-js";

/** Nº de membros ativos na semana para a liga contar (objetivo). */
export const MIN_SENSEI = 20;
/** "Esta semana" = equipa montada/atualizada nos últimos N dias. */
export const JANELA_DIAS = 7;
/** Quanto tempo o selo vale depois de ganho (folga sobre a janela semanal). */
export const VALIDADE_DIAS = 8;

export interface ResultadoSensei {
  ligasAnalisadas: number;
  criadoresQualificados: number;
  atualizados: number;
  seco: boolean;
}

// A mesma regra de "liga terminada" do resto do app (lib/limitesLiga).
function ligaTerminada(l: { formato?: unknown; estado?: unknown; copa_estado?: unknown }): boolean {
  if (String(l.formato) === "copa") return String(l.copa_estado) === "terminada";
  return String(l.estado) === "terminada";
}

/**
 * Recalcula o selo de Sensei para todos os criadores de ligas de amigos.
 * @param admin  cliente Supabase com chave de serviço (supabaseAdmin).
 * @param agora  instante de referência (injetável para testes).
 * @param seco   se true, calcula mas NÃO grava nada (ensaio).
 */
export async function recalcularSensei(
  admin: SupabaseClient,
  agora: Date = new Date(),
  seco = false,
): Promise<ResultadoSensei> {
  const desdeIso = new Date(agora.getTime() - JANELA_DIAS * 86400000).toISOString();

  // 1) Membros ATIVOS na janela: montaram/atualizaram equipa nos últimos 7 dias.
  const ativos = new Set<string>();
  {
    const { data, error } = await admin
      .from("equipas")
      .select("user_id")
      .gte("atualizado_em", desdeIso)
      .limit(500000);
    if (error) throw new Error(`ler equipas ativas: ${error.message}`);
    for (const r of (data || []) as { user_id: string | null }[]) {
      if (r.user_id) ativos.add(String(r.user_id));
    }
  }

  // 2) Ligas de amigos ATIVAS e os seus criadores.
  const { data: ligas, error: eLigas } = await admin
    .from("leagues")
    .select("id, created_by, formato, estado, copa_estado")
    .eq("type", "amigos");
  if (eLigas) throw new Error(`ler ligas: ${eLigas.message}`);

  const criadorDaLiga = new Map<string, string>(); // league_id -> created_by
  const idsLigas: string[] = [];
  let ligasAnalisadas = 0;
  for (const l of ligas || []) {
    if (ligaTerminada(l as Record<string, unknown>)) continue;
    const id = String((l as { id: unknown }).id);
    const criador = (l as { created_by?: unknown }).created_by;
    idsLigas.push(id);
    ligasAnalisadas++;
    if (criador) criadorDaLiga.set(id, String(criador));
  }
  if (idsLigas.length === 0) {
    return { ligasAnalisadas: 0, criadoresQualificados: 0, atualizados: 0, seco };
  }

  // 3) Conta, por liga, os membros que estão no conjunto de ativos (em lotes).
  const ativosPorLiga = new Map<string, number>();
  for (let i = 0; i < idsLigas.length; i += 200) {
    const lote = idsLigas.slice(i, i + 200);
    const { data: membros, error } = await admin
      .from("league_members")
      .select("league_id, user_id")
      .in("league_id", lote);
    if (error) throw new Error(`ler membros: ${error.message}`);
    for (const m of (membros || []) as { league_id: string; user_id: string }[]) {
      if (ativos.has(String(m.user_id))) {
        const lid = String(m.league_id);
        ativosPorLiga.set(lid, (ativosPorLiga.get(lid) || 0) + 1);
      }
    }
  }

  // 4) Criadores que qualificam (>= MIN_SENSEI em pelo menos uma das suas ligas).
  const qualificados = new Set<string>();
  for (const [lid, n] of ativosPorLiga) {
    if (n >= MIN_SENSEI) {
      const criador = criadorDaLiga.get(lid);
      if (criador) qualificados.add(criador);
    }
  }

  // 5) Renova o selo (sensei_ate = agora + VALIDADE_DIAS) a cada qualificado.
  let atualizados = 0;
  if (!seco) {
    const ateIso = new Date(agora.getTime() + VALIDADE_DIAS * 86400000).toISOString();
    for (const uid of qualificados) {
      const { error } = await admin.from("users").update({ sensei_ate: ateIso }).eq("id", uid);
      if (!error) atualizados++;
    }
  }

  return { ligasAnalisadas, criadoresQualificados: qualificados.size, atualizados, seco };
}
