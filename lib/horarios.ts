// lib/horarios.ts
//
// Carrega os horários manuais (competicao_horarios) e injeta-os no lib/calendario
// (aplicarHorarios), para o SERVIDOR usar a MESMA verdade que a app sobre quando
// cada competição começa (e logo, quando o mercado fecha).
//
// Cache curta em memória: não vai à base a cada pedido. Chamar no topo de
// qualquer rota que decida estado de mercado (ex.: equipa-na-rodada).
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { aplicarHorarios } from "@/lib/calendario";

let ultima = 0;
const TTL_MS = 60 * 1000;

export async function hidratarHorarios(): Promise<void> {
  if (!supabaseAdmin) return;
  const agora = Date.now();
  if (agora - ultima < TTL_MS) return;
  try {
    const { data } = await supabaseAdmin.from("competicao_horarios").select("id_competicao, inicio_utc");
    const map: Record<string, string> = {};
    for (const r of data || []) {
      const id = String((r as { id_competicao?: unknown }).id_competicao || "");
      const iso = String((r as { inicio_utc?: unknown }).inicio_utc || "");
      if (id && iso) map[id] = iso;
    }
    aplicarHorarios(map);
    ultima = agora;
  } catch { /* mantém o que já tinha */ }
}
