"use client";

// lib/cicloMercado.ts
//
// QUEM PODE MONTAR AGORA (cliente).
//
// Regra (Kainan, 9/11/2026): quem tem equipa numa competição só monta a seguinte
// DEPOIS de os Judocoins dessa competição estarem calculados — assim ninguém
// monta com o valor antigo. Quem NÃO jogou essa competição monta à vontade.
//
// "Competição do ciclo" = a que está a decorrer; ou, se já passou das 60h, a
// anterior à que tem o mercado aberto (enquanto o cálculo não acaba).
import { useEffect, useState } from "react";
import { CALENDARIO_TODAS, competicaoFechada, type FocoMercado, type SemanaCalendario } from "@/lib/calendario";
import { loadSavedCloudFor, loadSavedFor } from "@/lib/team";

/** A competição que pode ainda não ter os Judocoins calculados. */
export function competicaoDoCiclo(foco: FocoMercado, agora: Date = new Date()): SemanaCalendario | null {
  if (foco.aDecorrer) return foco.aDecorrer;
  const i = CALENDARIO_TODAS.findIndex((c) => c.idCompeticao === foco.alvo.idCompeticao);
  const ant = i > 0 ? CALENDARIO_TODAS[i - 1] : null;
  if (!ant || !competicaoFechada(ant, agora)) return null;
  // Só interessa a anterior recente (o cálculo acontece nas horas seguintes).
  const inicio = Date.parse(ant.de.replace(/\//g, "-") + "T00:00:00Z");
  if (Number.isFinite(inicio) && agora.getTime() - inicio > 10 * 24 * 3600 * 1000) return null;
  return ant;
}

export interface BloqueioCiclo {
  /** Competição do ciclo (a decorrer ou à espera do cálculo), se houver. */
  comp: SemanaCalendario | null;
  /** O utilizador tem equipa nela. null = a verificar. */
  temEquipa: boolean | null;
  /** Já tem os Judocoins calculados. null = a verificar. */
  congelada: boolean | null;
  /** Tem equipa E ainda não está calculada: não monta a próxima. null = a verificar. */
  bloqueado: boolean | null;
}

export function useBloqueioCiclo(foco: FocoMercado): BloqueioCiclo {
  const comp = competicaoDoCiclo(foco);
  const id = comp?.idCompeticao ?? null;
  const [estado, setEstado] = useState<{ id: string | null; temEquipa: boolean | null; congelada: boolean | null }>({ id: null, temEquipa: null, congelada: null });
  useEffect(() => {
    if (!id) { setEstado({ id: null, temEquipa: false, congelada: null }); return; }
    let vivo = true;
    (async () => {
      const cloud = await loadSavedCloudFor(id).catch(() => null);
      const temEquipa = (cloud?.ids.length ?? 0) > 0 || loadSavedFor(id).ids.length > 0;
      if (!temEquipa) { if (vivo) setEstado({ id, temEquipa: false, congelada: null }); return; }
      let congelada: boolean | null = null;
      try {
        const r = await fetch(`/api/rodada-congelada?comp=${encodeURIComponent(id)}`, { cache: "no-store" });
        const j = await r.json();
        if (j?.ok) congelada = !!j.congelada;
      } catch { /* na dúvida, trata como não calculada */ }
      if (vivo) setEstado({ id, temEquipa: true, congelada: congelada ?? false });
    })();
    return () => { vivo = false; };
  }, [id]);
  const atual = estado.id === id ? estado : { temEquipa: null, congelada: null };
  const bloqueado = !id ? false
    : atual.temEquipa === null ? null
    : atual.temEquipa === false ? false
    : atual.congelada === null ? null
    : !atual.congelada;
  return { comp, temEquipa: id ? atual.temEquipa : false, congelada: atual.congelada, bloqueado };
}
