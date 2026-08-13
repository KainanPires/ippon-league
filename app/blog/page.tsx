"use client";

// app/blog/page.tsx
//
// O BLOG DO DÔDO — todas as notícias do jogo, num sítio só.

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Mascot } from "@/components/Mascot";
import { useFaixa } from "@/lib/useFaixa";
import { Escudo, type Identity } from "@/components/Escudo";
// As notícias da região do leitor aparecem primeiro. Nenhuma é escondida — ver
// a nota em lib/ordenarNoticias.
import { ordenarPorRegiao } from "@/lib/ordenarNoticias";
import { noticiaNaLingua, type CamposTraduzidos } from "@/lib/noticiaLingua";
import { useT, useLingua } from "@/lib/i18n";

const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";

// O rótulo de cada tipo vem por chave (etiquetaK), traduzido ao mostrar.
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
  nome_competicao: string | null;
  criada_em: string;
  imagem_url: string | null;
  autor_nome: string | null;
  pais: string | null;
  continente: string | null;
  dados: { escudo?: Identity | null } | null;
  estado: string;
  traducoes: Record<string, CamposTraduzidos> | null;
}

const FAMILIA: Record<string, "rodada" | "mercado" | "comunidade" | "artigos"> = {
  melhor_rodada: "rodada",
  atleta_destaque: "rodada",
  mais_escalado: "rodada",
  valorizacao: "mercado",
  desvalorizacao: "mercado",
  mais_rico: "mercado",
  rico_ano: "mercado",
  faixas: "comunidade",
  copa_campeao: "comunidade",
  percurso_campeao: "comunidade",
  lider_pontos: "comunidade",
  campeao_ano: "comunidade",
  editorial: "artigos",
  entrevista: "artigos",
  antevisao: "artigos",
  analise: "artigos",
  curiosidade: "artigos",
};

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

export default function Blog() {
  const t = useT();
  const { lingua } = useLingua();
  const [noticias, setNoticias] = useState<Noticia[] | null>(null);
  const { cor: corFaixa } = useFaixa();
  const [aba, setAba] = useState<"tudo" | "rodada" | "mercado" | "comunidade" | "artigos">("tudo");
  const [procura, setProcura] = useState("");

  useEffect(() => {
    let vivo = true;
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user?.id;
      let meuPais: string | null = null;
      let meuCont: string | null = null;
      if (uid) {
        const { data: u } = await supabase.from("users").select("country_code, continente").eq("id", uid).maybeSingle();
        meuPais = u?.country_code ? String(u.country_code) : null;
        meuCont = u?.continente ? String(u.continente) : null;
      }
      await supabase
      .from("hub_noticias")
      .select("id, tipo, titulo, corpo, nome_competicao, criada_em, imagem_url, autor_nome, dados, pais, continente, estado, traducoes")
      .order("criada_em", { ascending: false })
      .limit(60)
      .then(({ data }) => {
        if (!vivo) return;
        setNoticias(ordenarPorRegiao((data as Noticia[]) || [], meuPais, meuCont));
      });
    })();
    return () => { vivo = false; };
  }, []);

  const visiveis = (noticias || []).filter((n) => {
    if (aba !== "tudo" && FAMILIA[n.tipo] !== aba) return false;
    if (procura.trim()) {
      const q = procura.trim().toLowerCase();
      // Procura no texto que a pessoa vê (já na língua dela), não no original.
      const loc = noticiaNaLingua(n, lingua);
      if (!loc.titulo.toLowerCase().includes(q) && !loc.corpo.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: FB }}>
      <div style={{ maxWidth: 460, margin: "0 auto", padding: "14px 14px 40px" }}>
        <header style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 16 }}>
          <a href="/inicio" aria-label={t("comum.voltar")} style={{ width: 34, height: 34, borderRadius: "50%", border: "1px solid #243029", display: "flex", alignItems: "center", justifyContent: "center", color: "#cfd8d2", textDecoration: "none", flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
          </a>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontFamily: FD, fontSize: 19, fontWeight: 700, textTransform: "uppercase", margin: 0 }}>{t("hub.blogTitulo")}</h1>
            <div style={{ fontSize: 11.5, color: "#93a39a" }}>{t("bl.subtitulo")}</div>
          </div>
          <div style={{ width: 38, height: 38, flexShrink: 0 }}><Mascot belt={corFaixa} expression="sabio" /></div>
        </header>

        {noticias !== null && noticias.length > 4 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, marginBottom: 8 }}>
              {([
                ["tudo", "bl.abaTudo"],
                ["rodada", "bl.abaRodadas"],
                ["mercado", "bl.abaMercado"],
                ["comunidade", "bl.abaComunidade"],
                ["artigos", "bl.abaArtigos"],
              ] as const).map(([id, nomeK]) => (
                <button key={id} onClick={() => setAba(id)}
                  style={{ flexShrink: 0, background: aba === id ? GOLD : "transparent", border: `1px solid ${aba === id ? GOLD : "#2a3a33"}`, color: aba === id ? "#1b211e" : "#93a39a", fontFamily: FD, fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", padding: "7px 13px", borderRadius: 999, cursor: "pointer", whiteSpace: "nowrap" }}>
                  {t(nomeK)}
                </button>
              ))}
            </div>
            <input
              value={procura}
              onChange={(e) => setProcura(e.target.value)}
              placeholder={t("bl.procurar")}
              style={{ width: "100%", boxSizing: "border-box", background: "#121815", border: "1px solid #243029", borderRadius: 9, padding: "9px 12px", color: "#f1ede2", fontSize: 13.5, fontFamily: FB, outline: "none" }}
            />
          </div>
        )}

        {noticias === null ? (
          <div style={{ textAlign: "center", padding: "40px 16px", color: "#7c8a82", fontFamily: FD, fontSize: 12.5, textTransform: "uppercase", letterSpacing: "0.1em" }}>
            {t("comum.carregando")}
          </div>
        ) : visiveis.length === 0 ? (
          <div style={{ background: "#121815", border: "1px dashed #2a3a33", borderRadius: 14, padding: "26px 16px", textAlign: "center" }}>
            <div style={{ width: 76, height: 76, margin: "0 auto 10px" }}><Mascot belt={corFaixa} expression="feliz" /></div>
            <p style={{ fontSize: 13.5, color: "#c7d0c9", lineHeight: 1.55, margin: 0 }}>
              {noticias.length === 0 ? t("bl.semNoticias") : t("bl.semResultados")}
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {visiveis.map((n) => {
              const e = ESTILO[n.tipo] || ESTILO.curiosidade;
              const loc = noticiaNaLingua(n, lingua);
              return (
                <a key={n.id} href={`/blog/${n.id}`} style={{ display: "block", background: "#121815", border: "1px solid #243029", borderLeft: `3px solid ${e.cor}`, borderRadius: 13, padding: "13px 14px", textDecoration: "none", color: "inherit" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
                    <span style={{ fontSize: 15 }} aria-hidden="true">{e.icone}</span>
                    {n.estado && n.estado !== "publicada" && (
                      <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", padding: "2px 6px", borderRadius: 4, background: "#2a1f1c", color: "#ef8d83" }}>
                        {n.estado === "revisao" ? t("hub.aRever") : n.estado === "agendada" ? t("hub.agendada") : t("hub.rascunho")}
                      </span>
                    )}
                    <span style={{ fontFamily: FD, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: e.cor }}>{t(e.etiquetaK)}</span>
                    <span style={{ flex: 1 }} />
                    <span style={{ fontSize: 10.5, color: "#5f6f67" }}>{quando(n.criada_em, t)}</span>
                  </div>
                  <h2 style={{ fontSize: 15, fontWeight: 700, color: "#f1ede2", lineHeight: 1.3, margin: "0 0 6px" }}>{loc.titulo}</h2>
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    {n.imagem_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={n.imagem_url} alt="" style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8, flexShrink: 0 }} />
                    ) : n.dados?.escudo ? (
                      <span style={{ flexShrink: 0, display: "flex" }}><Escudo config={n.dados.escudo} size={56} /></span>
                    ) : null}
                    <p style={{ fontSize: 13, color: "#c7d0c9", lineHeight: 1.55, margin: 0, flex: 1, minWidth: 0, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{loc.corpo}</p>
                  </div>
                  {(n.nome_competicao || n.autor_nome) && (
                    <div style={{ fontSize: 11, color: "#7c8a82", marginTop: 8 }}>
                      {[n.nome_competicao, n.autor_nome ? t("bl.equipaIppon") : ""].filter(Boolean).join(" · ")}
                    </div>
                  )}
                </a>
              );
            })}
          </div>
        )}

        <p style={{ fontSize: 11, color: "#5f6f67", textAlign: "center", marginTop: 18, lineHeight: 1.5 }}>
          {t("bl.rodape")}
        </p>
      </div>
    </main>
  );
}
