"use client";

// app/resolver-ligas/page.tsx
//
// ECRÃ OBRIGATÓRIO quando alguém desce de nível e fica ACIMA do limite de ligas
// de amigos. Duas saídas:
//   1) VOLTAR AO PRO/PRO MAX (botão em destaque) — o limite sobe outra vez e a
//      pessoa não perde NADA. É a opção que queremos.
//   2) ESCOLHER quais ligas manter — sai das restantes (via /api/liga/resolver).
//
// O bloqueio real é no /inicio, que manda para cá quem está acima do limite.
// Quem cá chega sem estar acima é reenviado para /inicio.

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useNivel } from "@/lib/useNivel";
import { useLingua, type Lingua } from "@/lib/i18n";
import { LIMITES } from "@/lib/planos";

const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";
const MAX = "#7fb8f5";

type LigaAmiga = { id: string; name: string; formato: string; ehCopa: boolean };

type Txt = {
  titulo: string; intro: string;
  voltar: string; voltarSub: string;
  ou: string;
  pontos: string; copas: string; manterAte: string;
  confirmar: string; aGuardar: string; erro: string; jaOk: string;
};
const TXT: Record<Lingua, Txt> = {
  pt: {
    titulo: "Resolve as tuas ligas", intro: "O teu plano mudou e ficaste acima do limite de ligas de amigos. Tens duas opções.",
    voltar: "Voltar ao Ippon Pro", voltarSub: "Mantém tudo — nada é removido. Vê os planos e promoções.",
    ou: "ou escolhe quais manter (sais das restantes)",
    pontos: "Ligas de pontos corridos", copas: "Mata-matas (Copas)", manterAte: "Mantém até {n}",
    confirmar: "Confirmar e sair das restantes", aGuardar: "A guardar…", erro: "Não foi possível guardar. Tenta de novo.", jaOk: "Está tudo em ordem.",
  },
  en: {
    titulo: "Sort out your leagues", intro: "Your plan changed and you're over the friend-league limit. You have two options.",
    voltar: "Go back to Ippon Pro", voltarSub: "Keep everything — nothing is removed. See plans and offers.",
    ou: "or choose which to keep (you leave the rest)",
    pontos: "Points leagues", copas: "Knockouts (Cups)", manterAte: "Keep up to {n}",
    confirmar: "Confirm and leave the rest", aGuardar: "Saving…", erro: "Couldn't save. Try again.", jaOk: "Everything's in order.",
  },
  es: {
    titulo: "Resuelve tus ligas", intro: "Tu plan cambió y estás por encima del límite de ligas de amigos. Tienes dos opciones.",
    voltar: "Volver a Ippon Pro", voltarSub: "Mantén todo — no se elimina nada. Mira los planes y promociones.",
    ou: "o elige cuáles mantener (sales de las demás)",
    pontos: "Ligas de puntos", copas: "Eliminatorias (Copas)", manterAte: "Mantén hasta {n}",
    confirmar: "Confirmar y salir de las demás", aGuardar: "Guardando…", erro: "No se pudo guardar. Inténtalo de nuevo.", jaOk: "Todo en orden.",
  },
  fr: {
    titulo: "Règle tes ligues", intro: "Ton offre a changé et tu dépasses la limite de ligues d'amis. Tu as deux options.",
    voltar: "Revenir à Ippon Pro", voltarSub: "Garde tout — rien n'est supprimé. Vois les offres et promotions.",
    ou: "ou choisis lesquelles garder (tu quittes les autres)",
    pontos: "Ligues à points", copas: "Éliminations directes (Coupes)", manterAte: "Garde jusqu'à {n}",
    confirmar: "Confirmer et quitter les autres", aGuardar: "Enregistrement…", erro: "Impossible d'enregistrer. Réessaie.", jaOk: "Tout est en ordre.",
  },
  de: {
    titulo: "Ordne deine Ligen", intro: "Dein Tarif hat sich geändert und du bist über dem Limit für Freundesligen. Du hast zwei Möglichkeiten.",
    voltar: "Zurück zu Ippon Pro", voltarSub: "Behalte alles — nichts wird entfernt. Sieh dir Tarife und Angebote an.",
    ou: "oder wähle, welche du behältst (die anderen verlässt du)",
    pontos: "Punkteligen", copas: "K.-o.-Turniere (Cups)", manterAte: "Behalte bis zu {n}",
    confirmar: "Bestätigen und die anderen verlassen", aGuardar: "Speichern…", erro: "Konnte nicht speichern. Versuch es erneut.", jaOk: "Alles in Ordnung.",
  },
};

export default function ResolverLigas() {
  const { lingua } = useLingua();
  const { ehPro, ehProMax, pronto: nivelPronto } = useNivel();
  const tx = TXT[lingua] ?? TXT.pt;

  const [ligas, setLigas] = useState<LigaAmiga[] | null>(null);
  const [manter, setManter] = useState<Set<string>>(new Set());
  const [aGuardar, setAGuardar] = useState(false);
  const [erro, setErro] = useState("");

  const nivel: "gratis" | "pro" | "promax" = ehProMax ? "promax" : ehPro ? "pro" : "gratis";
  const lim = LIMITES[nivel];

  const carregar = useCallback(async () => {
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user?.id;
    if (!uid) { window.location.href = "/entrar?voltar=/resolver-ligas"; return; }
    try {
      const r = await fetch(`/api/liga/minhas?user_id=${uid}`, { cache: "no-store" });
      const j = await r.json();
      const brutas = Array.isArray(j?.ligas) ? j.ligas : [];
      const amigas: LigaAmiga[] = brutas
        .filter((l: Record<string, unknown>) => String(l.type) === "amigos")
        .filter((l: Record<string, unknown>) =>
          String(l.formato) === "copa" ? String(l.copa_estado) !== "terminada" : String(l.estado) !== "terminada")
        .map((l: Record<string, unknown>) => ({
          id: String(l.id), name: String(l.name || "Liga"),
          formato: String(l.formato || "pontos"), ehCopa: String(l.formato) === "copa",
        }));
      setLigas(amigas);
    } catch {
      setLigas([]);
    }
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);

  const nPontos = (ligas || []).filter((l) => !l.ehCopa).length;
  const nCopa = (ligas || []).filter((l) => l.ehCopa).length;
  const acima = nivelPronto && ligas !== null && (nPontos > lim.pontos || nCopa > lim.copa);

  // Quem cá chega sem estar acima do limite (ou já resolveu): volta ao início.
  useEffect(() => {
    if (nivelPronto && ligas !== null && !(nPontos > lim.pontos || nCopa > lim.copa)) {
      window.location.href = "/inicio";
    }
  }, [nivelPronto, ligas, nPontos, nCopa, lim.pontos, lim.copa]);

  function alternar(id: string, ehCopa: boolean) {
    setManter((prev) => {
      const n = new Set(prev);
      if (n.has(id)) { n.delete(id); return n; }
      const jaTem = (ligas || []).filter((l) => l.ehCopa === ehCopa && n.has(l.id)).length;
      const teto = ehCopa ? lim.copa : lim.pontos;
      if (jaTem >= teto) return n; // não deixa manter mais do que o limite
      n.add(id); return n;
    });
  }

  async function confirmar() {
    if (aGuardar) return;
    setAGuardar(true); setErro("");
    try {
      const { data: sess } = await supabase.auth.getSession();
      const tk = sess.session?.access_token;
      if (!tk) { window.location.href = "/entrar?voltar=/resolver-ligas"; return; }
      const r = await fetch("/api/liga/resolver", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tk}` },
        body: JSON.stringify({ manter: Array.from(manter) }),
      });
      const j = await r.json();
      if (!j?.ok) { setErro(j?.erro || tx.erro); setAGuardar(false); return; }
      window.location.href = "/inicio";
    } catch {
      setErro(tx.erro); setAGuardar(false);
    }
  }

  const Moldura = ({ children }: { children: React.ReactNode }) => (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: FB, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "28px 16px" }}>
      <div style={{ width: "100%", maxWidth: 460 }}>{children}</div>
    </main>
  );

  if (!nivelPronto || ligas === null) {
    return <Moldura><p style={{ color: "#93a39a" }}>…</p></Moldura>;
  }
  if (!acima) {
    return <Moldura><p style={{ color: "#93a39a" }}>{tx.jaOk}</p></Moldura>;
  }

  const grupos: { ehCopa: boolean; titulo: string; teto: number; itens: LigaAmiga[] }[] = [
    { ehCopa: false, titulo: tx.pontos, teto: lim.pontos, itens: (ligas || []).filter((l) => !l.ehCopa) },
    { ehCopa: true, titulo: tx.copas, teto: lim.copa, itens: (ligas || []).filter((l) => l.ehCopa) },
  ].filter((g) => g.itens.length > 0);

  return (
    <Moldura>
      <h1 style={{ fontFamily: FD, fontSize: 22, fontWeight: 700, textTransform: "uppercase", margin: "0 0 8px" }}>{tx.titulo}</h1>
      <p style={{ fontSize: 14, color: "#c7d0c9", lineHeight: 1.55, margin: "0 0 18px" }}>{tx.intro}</p>

      {/* Saída 1: voltar ao Pro — em destaque. Mantém tudo. */}
      <a href="/ippon-pro" style={{ display: "block", background: GOLD, color: "#1b211e", borderRadius: 14, padding: "15px 16px", textDecoration: "none", marginBottom: 8 }}>
        <div style={{ fontFamily: FD, fontSize: 15, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em" }}>{ehPro && !ehProMax ? tx.voltar.replace("Pro", "Pro Max") : tx.voltar}</div>
        <div style={{ fontSize: 12.5, opacity: 0.85, marginTop: 3 }}>{tx.voltarSub}</div>
      </a>
      <div style={{ textAlign: "center", color: "#5f6f67", fontSize: 12.5, margin: "12px 0" }}>{tx.ou}</div>

      {/* Saída 2: escolher quais manter. */}
      {grupos.map((g) => (
        <div key={String(g.ehCopa)} style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: FD, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: g.ehCopa ? MAX : GOLD, marginBottom: 8 }}>
            {g.titulo} · {tx.manterAte.replace("{n}", String(g.teto))}
          </div>
          <div style={{ display: "grid", gap: 7 }}>
            {g.itens.map((l) => {
              const escolhida = manter.has(l.id);
              return (
                <button key={l.id} onClick={() => alternar(l.id, g.ehCopa)}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, textAlign: "left",
                    background: escolhida ? "#14251b" : "#121815", border: `1px solid ${escolhida ? "#3f8f5a" : "#243029"}`,
                    borderRadius: 11, padding: "12px 14px", cursor: "pointer", color: "#f1ede2" }}>
                  <span style={{ fontSize: 14, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.name}</span>
                  <span style={{ flexShrink: 0, fontFamily: FD, fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: escolhida ? "#8bd4b0" : "#5f6f67" }}>
                    {escolhida ? "✓" : "○"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {erro && <p style={{ color: "#ef8d83", fontSize: 13, margin: "0 0 10px" }}>{erro}</p>}
      <button onClick={confirmar} disabled={aGuardar}
        style={{ width: "100%", background: "#4a2420", border: "1px solid #6d3630", color: "#ef8d83", fontFamily: FD, fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", padding: "13px", borderRadius: 12, cursor: aGuardar ? "default" : "pointer", opacity: aGuardar ? 0.7 : 1 }}>
        {aGuardar ? tx.aGuardar : tx.confirmar}
      </button>
    </Moldura>
  );
}
