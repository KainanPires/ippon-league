"use client";

// app/chaveamento/[comp]/page.tsx
//
// PÁGINA DEDICADA do chaveamento de uma competição — com URL própria, para se
// PARTILHAR (WhatsApp, Instagram, grupos de judô). Mostra os prints com a
// categoria e a legenda, mais a nota geral. Público: quem recebe o link vê,
// mesmo sem conta (a RLS deixa ler os publicados).

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useT } from "@/lib/i18n";
import { nomeCompeticaoPorId } from "@/lib/calendario";

const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";

interface Print { url: string; legenda?: string; categoria?: string }
interface Chave {
  id_competicao: string;
  nome_competicao: string | null;
  titulo: string | null;
  nota: string | null;
  imagens: Print[];
}

export default function ChaveamentoComp() {
  const t = useT();
  const params = useParams<{ comp: string }>();
  const comp = String(params?.comp || "");
  const [estado, setEstado] = useState<"a-ver" | "ok" | "vazio">("a-ver");
  const [chave, setChave] = useState<Chave | null>(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const { data } = await supabase
        .from("hub_chaveamentos")
        .select("id_competicao, nome_competicao, titulo, nota, imagens")
        .eq("id_competicao", comp)
        .eq("estado", "publicado")
        .maybeSingle();
      if (!vivo) return;
      if (data) {
        const d = data as Record<string, unknown>;
        setChave({
          id_competicao: String(d.id_competicao),
          nome_competicao: d.nome_competicao ? String(d.nome_competicao) : null,
          titulo: d.titulo ? String(d.titulo) : null,
          nota: d.nota ? String(d.nota) : null,
          imagens: Array.isArray(d.imagens) ? (d.imagens as Print[]) : [],
        });
        setEstado("ok");
      } else {
        setEstado("vazio");
      }
    })();
    return () => { vivo = false; };
  }, [comp]);

  const nomeComp = nomeCompeticaoPorId(comp) || chave?.nome_competicao || comp;

  async function partilhar() {
    try {
      const url = typeof window !== "undefined" ? window.location.href : "";
      if (navigator.share) { await navigator.share({ title: `${t("chv.edTitulo")} · ${nomeComp}`, url }); return; }
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch { /* o utilizador cancelou a partilha: nada a fazer */ }
  }

  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: FB }}>
      <div style={{ maxWidth: 620, margin: "0 auto", padding: "14px 14px 60px" }}>
        <header style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 16 }}>
          <a href="/inicio" aria-label={t("comum.voltar")} style={{ width: 34, height: 34, borderRadius: "50%", border: "1px solid #243029", display: "flex", alignItems: "center", justifyContent: "center", color: "#cfd8d2", textDecoration: "none", flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
          </a>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontFamily: FD, fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: GOLD }}>{t("chv.oficial")}</span>
            </div>
            <h1 style={{ fontFamily: FD, fontSize: 18, fontWeight: 700, textTransform: "uppercase", margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis" }}>{nomeComp}</h1>
          </div>
        </header>

        {estado === "a-ver" && (
          <div style={{ fontSize: 13, color: "#7c8a82", textAlign: "center", padding: "30px 0", fontFamily: FD, letterSpacing: "0.08em", textTransform: "uppercase" }}>{t("comum.carregando")}</div>
        )}

        {estado === "vazio" && (
          <div style={{ fontSize: 14, color: "#93a39a", lineHeight: 1.6, textAlign: "center", padding: "24px 10px", background: "#121815", border: "1px solid #243029", borderRadius: 12 }}>
            {t("chv.semChave")}
          </div>
        )}

        {estado === "ok" && chave && (
          <>
            {chave.titulo && (
              <h2 style={{ fontFamily: FD, fontSize: 15, fontWeight: 700, margin: "0 0 8px", color: "#f1ede2" }}>{chave.titulo}</h2>
            )}
            {chave.nota && (
              <p style={{ fontSize: 13.5, color: "#c7d0c9", lineHeight: 1.6, margin: "0 0 16px", whiteSpace: "pre-wrap", background: "#121815", border: "1px solid #243029", borderRadius: 12, padding: "12px 14px" }}>
                {chave.nota}
              </p>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {chave.imagens.map((im, i) => (
                <figure key={i} style={{ margin: 0 }}>
                  {im.categoria && (
                    <figcaption style={{ fontFamily: FD, fontSize: 12.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", color: GOLD, marginBottom: 6 }}>{im.categoria}</figcaption>
                  )}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={im.url} alt={im.categoria || im.legenda || ""} style={{ width: "100%", borderRadius: 11, display: "block", border: "1px solid #1a221d" }} />
                  {im.legenda && (
                    <figcaption style={{ fontSize: 12.5, color: "#93a39a", lineHeight: 1.5, marginTop: 6 }}>{im.legenda}</figcaption>
                  )}
                </figure>
              ))}
            </div>

            <button onClick={partilhar} style={{ width: "100%", marginTop: 20, padding: 12, borderRadius: 11, border: "none", background: copiado ? "#1c3a2e" : GOLD, color: copiado ? "#7fd1a3" : "#1b211e", fontFamily: FD, fontSize: 13.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", cursor: "pointer" }}>
              {copiado ? t("bi.ligacaoCopiada") : t("chv.partilhar")}
            </button>
          </>
        )}
      </div>
    </main>
  );
}
