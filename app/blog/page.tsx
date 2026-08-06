"use client";

// app/blog/page.tsx
//
// O BLOG DO DÔDO — todas as notícias do jogo, num sítio só.
//
// Destino do "Ver tudo" do carrossel do ecrã inicial.
//
// ---------------------------------------------------------------------------
// ABERTO A TODA A GENTE, MESMO SEM CONTA
//
// A tabela `hub_noticias` tem leitura pública (ver hub-noticias.sql), e é de
// propósito: este blog é também uma montra. Alguém que chegue por uma ligação
// partilhada vê o que se passa no jogo antes de decidir criar conta — e é
// exatamente aí que o convite faz sentido.
// ---------------------------------------------------------------------------

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Mascot } from "@/components/Mascot";
import { useFaixa } from "@/lib/useFaixa";

const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";

const ESTILO: Record<string, { icone: string; cor: string; etiqueta: string }> = {
  melhor_rodada: { icone: "🥇", cor: GOLD, etiqueta: "Melhor da Rodada" },
  atleta_destaque: { icone: "🔥", cor: "#e2655a", etiqueta: "Destaque" },
  valorizacao: { icone: "📈", cor: "#7fd1a3", etiqueta: "Mercado" },
  desvalorizacao: { icone: "📉", cor: "#ef8d83", etiqueta: "Mercado" },
  mais_escalado: { icone: "👥", cor: "#7fb8f5", etiqueta: "Escalações" },
  faixas: { icone: "🥋", cor: "#b79be0", etiqueta: "Faixas" },
  copa_campeao: { icone: "🏆", cor: GOLD, etiqueta: "Copa" },
  curiosidade: { icone: "💡", cor: "#aee9c9", etiqueta: "Curiosidade" },
};

interface Noticia {
  id: string;
  tipo: string;
  titulo: string;
  corpo: string;
  nome_competicao: string | null;
  criada_em: string;
}

/** "há 2 horas", "ontem", "há 3 dias" — mais legível que uma data seca. */
function quando(iso: string): string {
  const t = Date.parse(iso);
  if (!t) return "";
  const min = Math.floor((Date.now() - t) / 60000);
  if (min < 2) return "agora mesmo";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  if (d === 1) return "ontem";
  if (d < 30) return `há ${d} dias`;
  return new Date(t).toLocaleDateString("pt-PT");
}

export default function Blog() {
  const [noticias, setNoticias] = useState<Noticia[] | null>(null);
  const { cor: corFaixa } = useFaixa();

  useEffect(() => {
    let vivo = true;
    supabase
      .from("hub_noticias")
      .select("id, tipo, titulo, corpo, nome_competicao, criada_em")
      .order("criada_em", { ascending: false })
      .limit(60)
      .then(({ data }) => {
        if (!vivo) return;
        setNoticias((data as Noticia[]) || []);
      });
    return () => { vivo = false; };
  }, []);

  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: FB }}>
      <div style={{ maxWidth: 460, margin: "0 auto", padding: "14px 14px 40px" }}>
        <header style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 16 }}>
          <a href="/inicio" aria-label="Voltar" style={{ width: 34, height: 34, borderRadius: "50%", border: "1px solid #243029", display: "flex", alignItems: "center", justifyContent: "center", color: "#cfd8d2", textDecoration: "none", flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
          </a>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontFamily: FD, fontSize: 19, fontWeight: 700, textTransform: "uppercase", margin: 0 }}>Blog do Dôdo</h1>
            <div style={{ fontSize: 11.5, color: "#93a39a" }}>O que se passa na Ippon League</div>
          </div>
          <div style={{ width: 38, height: 38, flexShrink: 0 }}><Mascot belt={corFaixa} expression="sabio" /></div>
        </header>

        {noticias === null ? (
          <div style={{ textAlign: "center", padding: "40px 16px", color: "#7c8a82", fontFamily: FD, fontSize: 12.5, textTransform: "uppercase", letterSpacing: "0.1em" }}>
            A carregar…
          </div>
        ) : noticias.length === 0 ? (
          <div style={{ background: "#121815", border: "1px dashed #2a3a33", borderRadius: 14, padding: "26px 16px", textAlign: "center" }}>
            <div style={{ width: 76, height: 76, margin: "0 auto 10px" }}><Mascot belt={corFaixa} expression="feliz" /></div>
            <p style={{ fontSize: 13.5, color: "#c7d0c9", lineHeight: 1.55, margin: 0 }}>
              Ainda não há notícias.<br />
              Assim que a próxima competição terminar, conto-te tudo o que aconteceu.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {noticias.map((n) => {
              const e = ESTILO[n.tipo] || ESTILO.curiosidade;
              return (
                <article key={n.id} style={{ background: "#121815", border: "1px solid #243029", borderLeft: `3px solid ${e.cor}`, borderRadius: 13, padding: "13px 14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
                    <span style={{ fontSize: 15 }} aria-hidden="true">{e.icone}</span>
                    <span style={{ fontFamily: FD, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: e.cor }}>{e.etiqueta}</span>
                    <span style={{ flex: 1 }} />
                    <span style={{ fontSize: 10.5, color: "#5f6f67" }}>{quando(n.criada_em)}</span>
                  </div>
                  <h2 style={{ fontSize: 15, fontWeight: 700, color: "#f1ede2", lineHeight: 1.3, margin: "0 0 6px" }}>{n.titulo}</h2>
                  <p style={{ fontSize: 13, color: "#c7d0c9", lineHeight: 1.55, margin: 0 }}>{n.corpo}</p>
                  {n.nome_competicao && (
                    <div style={{ fontSize: 11, color: "#7c8a82", marginTop: 8 }}>{n.nome_competicao}</div>
                  )}
                </article>
              );
            })}
          </div>
        )}

        <p style={{ fontSize: 11, color: "#5f6f67", textAlign: "center", marginTop: 18, lineHeight: 1.5 }}>
          As notícias são feitas a partir do que acontece no jogo, depois de cada competição.
        </p>
      </div>
    </main>
  );
}
