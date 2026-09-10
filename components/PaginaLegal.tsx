"use client";

// components/PaginaLegal.tsx
//
// Renderiza um documento legal (Termos ou Política) NA LÍNGUA ESCOLHIDA na app.
// Segue o seletor de idioma: o utilizador põe a app em francês, abre os Termos,
// e vê-os em francês. O português é a versão oficial — se a tradução tiver uma
// versão diferente da oficial (ficou para trás num lote de atualização), mostra
// um aviso e um atalho para o português, para nunca aparecer texto velho em
// silêncio.

import { useEffect, useState } from "react";
import { useLingua } from "@/lib/i18n";
import { temSessao } from "@/lib/auth";
import { SeletorLingua } from "@/components/SeletorLingua";
import { VERSAO_OFICIAL, LEGAL_UI, type LegalDoc } from "@/lib/legal";
import type { Lingua } from "@/lib/i18n";

const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";

// Negrito em linha: a frase-fonte usa **texto** para destacar. Divide em ** e
// alterna normal/negrito. Sem dependências de markdown.
function Inline({ texto }: { texto: string }) {
  const partes = texto.split("**");
  return (
    <>
      {partes.map((p, i) =>
        i % 2 === 1 ? <strong key={i} style={{ color: "#e7ede9" }}>{p}</strong> : <span key={i}>{p}</span>
      )}
    </>
  );
}

export function PaginaLegal({ docs }: { docs: Record<Lingua, LegalDoc> }) {
  const { lingua } = useLingua();
  const ui = LEGAL_UI[lingua] ?? LEGAL_UI.pt;
  const oficialPt = docs.pt;
  // A tradução escolhida (ou o português, se faltar de todo).
  const traducao = docs[lingua] ?? oficialPt;
  // Tradução atrasada = não é português E a versão não bate certo com a oficial.
  const desatualizada = lingua !== "pt" && traducao.versao !== VERSAO_OFICIAL;
  // Se estiver atrasada, NÃO mostramos o texto velho: mostramos o português
  // oficial e um aviso por cima. Nunca aparece conteúdo desatualizado em silêncio.
  const doc = desatualizada ? oficialPt : traducao;

  // Mesmo comportamento das páginas antigas: volta ao perfil se houver sessão,
  // senão à entrada. (A janela de registo abre estas páginas num separador novo,
  // onde ainda não há sessão — daí o fallback para "/".)
  const [logado, setLogado] = useState(false);
  useEffect(() => { temSessao().then(setLogado).catch(() => setLogado(false)); }, []);
  const destinoVoltar = logado ? "/perfil" : "/";

  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#c7d0c9", fontFamily: FB }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "14px 18px 56px" }}>
        <header style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 14 }}>
          <a
            href={destinoVoltar}
            aria-label={ui.voltar}
            style={{ width: 36, height: 36, borderRadius: "50%", border: "1px solid #243029", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", color: "#cfd8d2", textDecoration: "none", cursor: "pointer", flexShrink: 0 }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
          </a>
          <div style={{ marginLeft: "auto" }}>
            <SeletorLingua compacto />
          </div>
        </header>

        <h1 style={{ fontFamily: FD, fontSize: 24, fontWeight: 700, textTransform: "uppercase", color: "#f1ede2", lineHeight: 1.2, margin: "0 0 6px" }}>
          {doc.titulo}
        </h1>
        <p style={{ fontSize: 12.5, color: "#7c8a82", margin: "0 0 16px" }}>
          {ui.atualizado}: {doc.atualizado} · {ui.versao} {doc.versao}
        </p>

        {/* Nota "a versão portuguesa prevalece" — está em todas as línguas. */}
        {doc.oficial && (
          <div style={{ background: "#181207", border: `1px solid #4a3a14`, borderRadius: 12, padding: "11px 14px", marginBottom: desatualizada ? 10 : 22, fontSize: 12.5, color: "#dcc9a0", lineHeight: 1.55 }}>
            <Inline texto={doc.oficial} />
          </div>
        )}

        {/* Trava de segurança: se a tradução ficou para trás, avisa e mostra o
            português oficial (o `doc` acima já foi trocado para o PT). */}
        {desatualizada && (
          <div style={{ background: "#2a1a10", border: "1px solid #6d3a1c", borderRadius: 12, padding: "11px 14px", marginBottom: 22, fontSize: 12.5, color: "#f0c4a0", lineHeight: 1.55 }}>
            {ui.desatualizada}
          </div>
        )}

        {doc.seccoes.map((sec, i) => (
          <section key={i} style={{ marginBottom: 22 }}>
            <h2 style={{ fontFamily: FD, fontSize: 15, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.02em", color: GOLD, margin: "0 0 8px" }}>
              {sec.titulo}
            </h2>
            {sec.blocos.map((b, j) =>
              b.tipo === "p" ? (
                <p key={j} style={{ fontSize: 14, lineHeight: 1.65, margin: "0 0 10px" }}>
                  <Inline texto={b.texto} />
                </p>
              ) : (
                <ul key={j} style={{ margin: "0 0 10px", paddingLeft: 20 }}>
                  {b.itens.map((it, k) => (
                    <li key={k} style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 5 }}>
                      <Inline texto={it} />
                    </li>
                  ))}
                </ul>
              )
            )}
          </section>
        ))}
      </div>
    </main>
  );
}
