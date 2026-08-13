"use client";

// components/ChaveamentoSecao.tsx
//
// SECÇÃO "Chaveamento" para embutir na página de uma competição/liga.
//
// Dá o `idCompeticao` e ela mostra um cartão compacto com o primeiro print e um
// botão que leva à página dedicada (/chaveamento/[id]). Se ainda NÃO houver
// chave publicada para essa competição, não mostra nada (render null) — para não
// encher a página de competições sem chave.
//
// Uso:
//   <ChaveamentoSecao idCompeticao={comp.idCompeticao} />

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useT } from "@/lib/i18n";

const FD = "var(--font-geist-mono), system-ui, sans-serif";
const GOLD = "#d9a441";

interface Print { url: string; categoria?: string; legenda?: string }

export function ChaveamentoSecao({ idCompeticao }: { idCompeticao: string }) {
  const t = useT();
  const [capa, setCapa] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [temChave, setTemChave] = useState(false);

  useEffect(() => {
    let vivo = true;
    (async () => {
      if (!idCompeticao) return;
      const { data } = await supabase
        .from("hub_chaveamentos")
        .select("imagens")
        .eq("id_competicao", idCompeticao)
        .eq("estado", "publicado")
        .maybeSingle();
      if (!vivo || !data) return;
      const imgs = Array.isArray((data as { imagens?: unknown }).imagens) ? ((data as { imagens: Print[] }).imagens) : [];
      setCapa(imgs[0]?.url || null);
      setTotal(imgs.length);
      setTemChave(true);
    })();
    return () => { vivo = false; };
  }, [idCompeticao]);

  if (!temChave) return null;

  return (
    <a
      href={`/chaveamento/${encodeURIComponent(idCompeticao)}`}
      style={{ display: "block", textDecoration: "none", background: "#121815", border: "1px solid #243029", borderRadius: 13, overflow: "hidden", marginTop: 12 }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 13px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span aria-hidden="true" style={{ fontSize: 16 }}>🥋</span>
          <div>
            <div style={{ fontFamily: FD, fontSize: 13, fontWeight: 700, textTransform: "uppercase", color: "#f1ede2" }}>{t("chv.edTitulo")}</div>
            <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: GOLD }}>{t("chv.oficial")}</div>
          </div>
        </div>
        <span style={{ fontFamily: FD, fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", color: GOLD }}>{t("chv.verChave")} →</span>
      </div>
      {capa && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={capa} alt="" style={{ width: "100%", maxHeight: 220, objectFit: "cover", display: "block", borderTop: "1px solid #1a221d", opacity: 0.96 }} />
      )}
      {total > 1 && (
        <div style={{ fontSize: 11, color: "#7c8a82", padding: "7px 13px" }}>+{total - 1}</div>
      )}
    </a>
  );
}
