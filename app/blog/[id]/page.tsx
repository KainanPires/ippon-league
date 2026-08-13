"use client";

// app/blog/[id]/page.tsx
//
// UMA NOTÍCIA — a página de destino de quem toca no carrossel.

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Mascot } from "@/components/Mascot";
import { useFaixa } from "@/lib/useFaixa";
import { Escudo, type Identity } from "@/components/Escudo";
import { useT } from "@/lib/i18n";

const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";

const ESTILO: Record<string, { icone: string; cor: string; etiquetaK: string }> = {
  melhor_rodada: { icone: "🥇", cor: GOLD, etiquetaK: "cc.melhorRodada" },
  atleta_destaque: { icone: "🔥", cor: "#e2655a", etiquetaK: "bl.etDestaque" },
  valorizacao: { icone: "📈", cor: "#7fd1a3", etiquetaK: "bl.etMercado" },
  desvalorizacao: { icone: "📉", cor: "#ef8d83", etiquetaK: "bl.etMercado" },
  mais_escalado: { icone: "👥", cor: "#7fb8f5", etiquetaK: "bl.etEscalacoes" },
  faixas: { icone: "🥋", cor: "#b79be0", etiquetaK: "bl.etFaixas" },
  copa_campeao: { icone: "🏆", cor: GOLD, etiquetaK: "bl.etCopa" },
  mais_rico: { icone: "💰", cor: GOLD, etiquetaK: "bl.etPatrimonio" },
  lider_pontos: { icone: "👑", cor: GOLD, etiquetaK: "bl.etRanking" },
  percurso_campeao: { icone: "🏆", cor: GOLD, etiquetaK: "bl.etCopa" },
  campeao_ano: { icone: "🏅", cor: GOLD, etiquetaK: "bl.etCampeaoAno" },
  rico_ano: { icone: "💎", cor: GOLD, etiquetaK: "bl.etBalancoAno" },
  curiosidade: { icone: "💡", cor: "#aee9c9", etiquetaK: "bl.etCuriosidade" },
};

interface Noticia {
  id: string;
  tipo: string;
  titulo: string;
  corpo: string;
  id_competicao: string | null;
  nome_competicao: string | null;
  criada_em: string;
  autor_nome: string | null;
  imagem_url: string | null;
  imagem_credito: string | null;
  link_instagram: string | null;
  link_tiktok: string | null;
  link_youtube: string | null;
  dados: { escudo?: Identity | null } | null;
}

/** Botão para o vídeo desta notícia numa rede social. */
function Rede({ href, nome, cor }: { href: string; nome: string; cor: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      style={{ display: "inline-flex", alignItems: "center", gap: 6, background: cor, color: "#fff", fontFamily: FD, fontSize: 12.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.02em", padding: "10px 16px", borderRadius: 9, textDecoration: "none" }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
      {nome}
    </a>
  );
}

function quando(iso: string, t: ReturnType<typeof useT>): string {
  const ts = Date.parse(iso);
  if (!ts) return "";
  const min = Math.floor((Date.now() - ts) / 60000);
  if (min < 2) return t("bl.agoraMesmo");
  if (min < 60) return t("bl.haMin", { min });
  const h = Math.floor(min / 60);
  if (h < 24) return t("sino.hH", { h });
  const d = Math.floor(h / 24);
  if (d === 1) return t("bl.ontem");
  if (d < 30) return t("bl.haDias", { d });
  return new Date(ts).toLocaleDateString("pt-PT");
}

export default function NoticiaPagina() {
  const t = useT();
  const params = useParams();
  const id = String(params?.id || "");
  const [n, setN] = useState<Noticia | null | "nao-existe">(null);
  const [relacionadas, setRelacionadas] = useState<Noticia[]>([]);
  const [copiado, setCopiado] = useState(false);
  const { cor: corFaixa } = useFaixa();

  useEffect(() => {
    let vivo = true;
    (async () => {
      if (!id) return;
      const { data } = await supabase
        .from("hub_noticias")
        .select("id, tipo, titulo, corpo, id_competicao, nome_competicao, criada_em, autor_nome, imagem_url, imagem_credito, link_instagram, link_tiktok, link_youtube, dados")
        .eq("id", id).maybeSingle();
      if (!vivo) return;
      if (!data) { setN("nao-existe"); return; }
      const noticia = data as Noticia;
      setN(noticia);

      if (noticia.id_competicao) {
        const { data: outras } = await supabase
          .from("hub_noticias")
          .select("id, tipo, titulo, corpo, id_competicao, nome_competicao, criada_em, autor_nome, imagem_url, imagem_credito, link_instagram, link_tiktok, link_youtube, dados")
          .eq("id_competicao", noticia.id_competicao)
          .neq("id", noticia.id)
          .limit(5);
        if (vivo && outras) setRelacionadas(outras as Noticia[]);
      }
    })();
    return () => { vivo = false; };
  }, [id]);

  async function partilhar() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const texto = n && n !== "nao-existe" ? n.titulo : "Ippon League";
    try {
      const nav = navigator as Navigator & { share?: (d: { title?: string; text?: string; url?: string }) => Promise<void> };
      if (nav.share) { await nav.share({ title: "Ippon League", text: texto, url }); return; }
    } catch { return; }
    try {
      await navigator.clipboard.writeText(`${texto} ${url}`);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch { /* sem área de transferência: o botão não reage */ }
  }

  const e = n && n !== "nao-existe" ? (ESTILO[n.tipo] || ESTILO.curiosidade) : ESTILO.curiosidade;

  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: FB }}>
      <div style={{ maxWidth: 460, margin: "0 auto", padding: "14px 14px 40px" }}>
        <header style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 16 }}>
          <a href="/blog" aria-label={t("bi.voltarBlog")} style={{ width: 34, height: 34, borderRadius: "50%", border: "1px solid #243029", display: "flex", alignItems: "center", justifyContent: "center", color: "#cfd8d2", textDecoration: "none", flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
          </a>
          <span style={{ fontFamily: FD, fontSize: 17, fontWeight: 700, textTransform: "uppercase", flex: 1 }}>{t("hub.blogTitulo")}</span>
        </header>

        {n === null ? (
          <div style={{ textAlign: "center", padding: "40px 16px", color: "#7c8a82", fontFamily: FD, fontSize: 12.5, textTransform: "uppercase", letterSpacing: "0.1em" }}>{t("comum.carregando")}</div>
        ) : n === "nao-existe" ? (
          <div style={{ background: "#121815", border: "1px dashed #2a3a33", borderRadius: 14, padding: "26px 16px", textAlign: "center" }}>
            <div style={{ width: 76, height: 76, margin: "0 auto 10px" }}><Mascot belt={corFaixa} expression="indicando" /></div>
            <p style={{ fontSize: 13.5, color: "#c7d0c9", lineHeight: 1.55, margin: "0 0 14px" }}>{t("bi.naoExiste")}</p>
            <a href="/blog" style={{ display: "inline-block", background: GOLD, color: "#1b211e", fontFamily: FD, fontSize: 13, fontWeight: 700, textTransform: "uppercase", padding: "10px 20px", borderRadius: 10, textDecoration: "none" }}>{t("bi.verTodas")}</a>
          </div>
        ) : (
          <>
            <article>
              {!n.imagem_url && n.dados?.escudo && (
                <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 20px" }}>
                  <Escudo config={n.dados.escudo} size={128} />
                </div>
              )}
              {n.imagem_url && (
                <div style={{ margin: "0 -14px 16px" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={n.imagem_url} alt="" style={{ width: "100%", display: "block", maxHeight: 260, objectFit: "cover" }} />
                  {n.imagem_credito && (
                    <div style={{ fontSize: 10.5, color: "#5f6f67", padding: "6px 14px 0" }}>{n.imagem_credito}</div>
                  )}
                </div>
              )}
              <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <span style={{ fontFamily: FD, fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: e.cor, borderLeft: `2px solid ${e.cor}`, paddingLeft: 8 }}>{t(e.etiquetaK)}</span>
                <span style={{ flex: 1 }} />
                <span style={{ fontSize: 11, color: "#5f6f67" }}>{quando(n.criada_em, t)}</span>
              </div>

              <h1 style={{ fontSize: 25, fontWeight: 700, color: "#f1ede2", lineHeight: 1.22, margin: "0 0 14px", letterSpacing: "-0.01em" }}>{n.titulo}</h1>
              <p style={{ fontSize: 16, color: "#cfd8d2", lineHeight: 1.75, margin: 0, whiteSpace: "pre-wrap" }}>{n.corpo}</p>

              {(n.nome_competicao || n.autor_nome) && (
                <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #1a221d", fontSize: 12, color: "#93a39a", display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <span>{n.nome_competicao || ""}</span>
                  {n.autor_nome && <span style={{ flexShrink: 0 }}>{t("bl.equipaIppon")}</span>}
                </div>
              )}

              {(n.link_instagram || n.link_tiktok || n.link_youtube) && (
                <div style={{ marginTop: 20, background: "#101511", border: `1px solid ${e.cor}44`, borderRadius: 13, padding: "15px 14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 4 }}>
                    <span style={{ fontSize: 19 }} aria-hidden="true">🎬</span>
                    <span style={{ fontFamily: FD, fontSize: 14.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.02em", color: "#f1ede2" }}>
                      {t("bi.historiaVideo")}
                    </span>
                  </div>
                  <p style={{ fontSize: 12.5, color: "#93a39a", lineHeight: 1.5, margin: "0 0 12px" }}>
                    {t("bi.videoConvite")}
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {n.link_instagram && <Rede href={n.link_instagram} nome="Instagram" cor="#e1306c" />}
                    {n.link_tiktok && <Rede href={n.link_tiktok} nome="TikTok" cor="#69c9d0" />}
                    {n.link_youtube && <Rede href={n.link_youtube} nome="YouTube" cor="#ff4a3d" />}
                  </div>
                </div>
              )}
              </div>
            </article>

            <button onClick={partilhar} style={{ width: "100%", marginTop: 12, padding: 12, borderRadius: 11, border: "none", background: copiado ? "#1c3a2e" : GOLD, color: copiado ? "#aee9c9" : "#1b211e", fontFamily: FD, fontSize: 13.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              {copiado ? t("bi.ligacaoCopiada") : (
                <>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" /></svg>
                  {t("comum.partilhar")}
                </>
              )}
            </button>

            {relacionadas.length > 0 && (
              <div style={{ marginTop: 22 }}>
                <div style={{ fontFamily: FD, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#93a39a", marginBottom: 10 }}>
                  {t("bi.maisDestaRodada")}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {relacionadas.map((r) => {
                    const er = ESTILO[r.tipo] || ESTILO.curiosidade;
                    return (
                      <a key={r.id} href={`/blog/${r.id}`} style={{ display: "flex", alignItems: "flex-start", gap: 10, background: "#121815", border: "1px solid #243029", borderRadius: 11, padding: "11px 12px", textDecoration: "none", color: "inherit" }}>
                        <span style={{ fontSize: 15, flexShrink: 0 }} aria-hidden="true">{er.icone}</span>
                        <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, color: "#d6ddd6", lineHeight: 1.35 }}>{r.titulo}</span>
                        <span style={{ color: "#5f6f67", flexShrink: 0 }}>›</span>
                      </a>
                    );
                  })}
                </div>
              </div>
            )}

            <a href="/blog" style={{ display: "block", textAlign: "center", marginTop: 18, color: GOLD, fontSize: 12.5, fontWeight: 700, textDecoration: "none", fontFamily: FD, textTransform: "uppercase" }}>
              {t("bi.verTodasNoticias")}
            </a>
          </>
        )}
      </div>
    </main>
  );
}
