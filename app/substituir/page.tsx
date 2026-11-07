"use client";

// Página de SUBSTITUIÇÃO pós-fecho. Para quem recebeu o aviso "um atleta teu
// saiu". Mostra os atletas da equipa que já não estão no mercado (desistiram) e,
// para cada um, deixa escolher um substituto de uma categoria que AINDA NÃO
// começou. Toda a validação real é feita no servidor (/api/equipa/substituir);
// aqui só facilitamos a escolha.
import { useEffect, useState, useCallback, type CSSProperties } from "react";
import { supabase } from "@/lib/supabase";
import { loadSavedCloudFor, loadPrecosCloudFor } from "@/lib/team";
import { focoMercado } from "@/lib/calendario";
import type { Athlete } from "@/lib/athletes";

export default function SubstituirPage() {
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [comp, setComp] = useState<string>("");
  const [nomeComp, setNomeComp] = useState<string>("");
  const [market, setMarket] = useState<Athlete[]>([]);
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const [precos, setPrecos] = useState<Record<string, number>>({});
  const [estados, setEstados] = useState<Record<string, string>>({});
  const [aberto, setAberto] = useState<string | null>(null); // saiId cujo picker está aberto
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const foco = focoMercado();
      const aDecorrer = foco.aDecorrer;
      if (!aDecorrer) {
        setErro("Não há nenhuma competição a decorrer agora.");
        setLoading(false);
        return;
      }
      const c = String(aDecorrer.idCompeticao);
      setComp(c);
      setNomeComp(String(aDecorrer.nome || ""));
      const [mRes, team, pr, eRes] = await Promise.all([
        fetch(`/api/atletas?id=${c}`).then((r) => r.json()).catch(() => null),
        loadSavedCloudFor(c),
        loadPrecosCloudFor(c),
        fetch(`/api/categorias-estado?comp=${c}`).then((r) => r.json()).catch(() => null),
      ]);
      setMarket(Array.isArray(mRes?.atletas) ? (mRes.atletas as Athlete[]) : []);
      setTeamIds(team?.ids ?? []);
      setPrecos(pr || {});
      setEstados((eRes?.estados as Record<string, string>) || {});
    } catch {
      setErro("Não foi possível carregar a tua equipa.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const porId = new Map<string, Athlete>(market.map((a) => [a.id, a]));
  const naEquipa = new Set(teamIds);
  const indisponiveis = teamIds.filter((id) => !porId.has(id));

  function generoEmFalta(): "M" | "F" | null {
    let m = 0;
    let f = 0;
    for (const id of teamIds) {
      const a = porId.get(id);
      if (!a) continue;
      if (a.gender === "M") m++;
      else if (a.gender === "F") f++;
    }
    if (m < 4) return "M";
    if (f < 4) return "F";
    return null;
  }

  function elegiveis(saiId: string): Athlete[] {
    const precoSai = precos[saiId];
    const gen = generoEmFalta();
    const catsUsadas = new Set<string>();
    for (const id of teamIds) {
      const a = porId.get(id);
      if (a && a.gender === gen) catsUsadas.add(a.category);
    }
    return market
      .filter(
        (a) =>
          !naEquipa.has(a.id) &&
          (gen ? a.gender === gen : true) &&
          estados[a.category] === "naoComecou" &&
          !catsUsadas.has(a.category) &&
          (typeof precoSai !== "number" || a.priceJc <= precoSai + 1e-9)
      )
      .sort((a, b) => b.priceJc - a.priceJc);
  }

  async function substituir(saiId: string, entraId: string) {
    setBusy(true);
    setMsg(null);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        setMsg("Precisas de iniciar sessão para substituir.");
        setBusy(false);
        return;
      }
      const res = await fetch("/api/equipa/substituir", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ comp, saiId, entraId }),
      });
      const j = await res.json();
      if (!j?.ok) {
        setMsg(j?.erro || "Não foi possível substituir.");
        setBusy(false);
        return;
      }
      setMsg("Substituído! A tua equipa foi atualizada. ✅");
      setAberto(null);
      await carregar();
    } catch {
      setMsg("Erro de rede. Tenta de novo.");
    }
    setBusy(false);
  }

  return (
    <main style={S.main}>
      <div style={S.wrap}>
        <h1 style={S.h1}>Substituir atletas 🥋</h1>
        <p style={S.sub}>
          {nomeComp ? `${nomeComp} — ` : ""}
          Alguns atletas teus saíram da competição. Troca-os enquanto a categoria do
          substituto ainda não começou.
        </p>

        {msg && <div style={S.msg}>{msg}</div>}

        {loading && <div style={S.info}>A carregar a tua equipa…</div>}
        {!loading && erro && <div style={S.info}>{erro}</div>}

        {!loading && !erro && indisponiveis.length === 0 && (
          <div style={S.info}>
            Nenhum atleta teu saiu da competição. A tua equipa está completa. ✅
          </div>
        )}

        {!loading &&
          !erro &&
          indisponiveis.map((saiId) => {
            const opcoes = elegiveis(saiId);
            const estaAberto = aberto === saiId;
            return (
              <div key={saiId} style={S.card}>
                <div style={S.cardTop}>
                  <div>
                    <div style={S.saiuTag}>SAIU DA COMPETIÇÃO</div>
                    <div style={S.saiuNome}>Atleta indisponível</div>
                    <div style={S.saiuSub}>
                      Preço de compra:{" "}
                      {typeof precos[saiId] === "number" ? `JC ${precos[saiId]}` : "—"}
                    </div>
                  </div>
                  <button
                    style={S.btn}
                    disabled={busy}
                    onClick={() => setAberto(estaAberto ? null : saiId)}
                  >
                    {estaAberto ? "Fechar" : "Substituir"}
                  </button>
                </div>

                {estaAberto && (
                  <div style={S.lista}>
                    {opcoes.length === 0 && (
                      <div style={S.vazio}>
                        Sem substitutos disponíveis (categorias já começaram ou acima do
                        orçamento).
                      </div>
                    )}
                    {opcoes.map((a) => (
                      <div key={a.id} style={S.opcao}>
                        <div>
                          <span style={S.pais}>{a.countryIso}</span>{" "}
                          <span style={S.nome}>{a.name}</span>
                          <div style={S.meta}>
                            {a.category} · JC {a.priceJc}
                          </div>
                        </div>
                        <button
                          style={S.btnMini}
                          disabled={busy}
                          onClick={() => substituir(saiId, a.id)}
                        >
                          Escolher
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

        <a href="/meu-time" style={S.voltar}>
          ← Voltar ao Meu Time
        </a>
      </div>
    </main>
  );
}

const S: Record<string, CSSProperties> = {
  main: { minHeight: "100vh", background: "#0f1115", color: "#f3efe6", padding: "24px 16px" },
  wrap: { maxWidth: 560, margin: "0 auto" },
  h1: { fontSize: 24, fontWeight: 800, margin: "4px 0 6px" },
  sub: { fontSize: 14, color: "#b9b2a4", lineHeight: 1.5, margin: "0 0 16px" },
  msg: {
    background: "#1d2a1f",
    border: "1px solid #3a7a4a",
    color: "#cfe9d6",
    borderRadius: 10,
    padding: "10px 12px",
    fontSize: 14,
    marginBottom: 14,
  },
  info: { background: "#171a20", border: "1px solid #2a2f3a", borderRadius: 12, padding: 16, fontSize: 14, color: "#c9c3b6" },
  card: { background: "#171a20", border: "1px solid #2a2f3a", borderRadius: 14, padding: 14, marginBottom: 12 },
  cardTop: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 },
  saiuTag: { fontSize: 10, letterSpacing: 1, color: "#ef8d83", fontWeight: 700 },
  saiuNome: { fontSize: 16, fontWeight: 700, marginTop: 2 },
  saiuSub: { fontSize: 12, color: "#8f897c", marginTop: 2 },
  btn: {
    background: "#d9a441",
    color: "#1a1206",
    border: "none",
    borderRadius: 10,
    padding: "10px 16px",
    fontWeight: 800,
    fontSize: 14,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  lista: { marginTop: 12, borderTop: "1px solid #2a2f3a", paddingTop: 10, display: "flex", flexDirection: "column", gap: 8 },
  vazio: { fontSize: 13, color: "#8f897c", padding: "6px 0" },
  opcao: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    background: "#12151b",
    border: "1px solid #262b35",
    borderRadius: 10,
    padding: "8px 10px",
  },
  pais: { fontSize: 11, fontWeight: 800, color: "#d9a441", background: "#241d0e", padding: "2px 6px", borderRadius: 6 },
  nome: { fontSize: 14, fontWeight: 600 },
  meta: { fontSize: 12, color: "#8f897c", marginTop: 2 },
  btnMini: {
    background: "#2a3140",
    color: "#f3efe6",
    border: "1px solid #3a4150",
    borderRadius: 8,
    padding: "7px 12px",
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer",
  },
  voltar: { display: "inline-block", marginTop: 16, color: "#8f897c", fontSize: 14, textDecoration: "none" },
};
