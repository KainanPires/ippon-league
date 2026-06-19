"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Mascot } from "@/components/Mascot";
import { supabase } from "@/lib/supabase";
import { loadSavedCloudFor, resolve, setAthletePool, type TeamState } from "@/lib/team";
import { focoMercado, numeroDaRodada } from "@/lib/calendario";
import type { Athlete } from "@/lib/athletes";
import type { Dossie } from "@/lib/scout";

const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";
const MAX = "#7fb8f5"; // tom do Pro Max
const VERDE = "#7fd1a3";
const VERM = "#ef8d83";

// Estado do dossiê de cada atleta enquanto carrega.
type EstadoDossie = "carregando" | "erro" | Dossie;

// Vantagens do Pro que ainda vamos construir (o scout já saiu daqui). A primeira
// — o Chaveamento — JÁ está pronta: é a página /chave, exclusiva Pro Max. Por
// isso tem href + selo PRO MAX (em vez de "EM BREVE"). As restantes continuam
// a chegar.
const A_CHEGAR: { t: string; x: string; href?: string; proMax?: boolean }[] = [
  { t: "Chaveamento das competições", x: "As chaves de cada competição, ao vivo, e o caminho dos teus atletas.", href: "/chave", proMax: true },
  { t: "Dicas e capitães da rodada", x: "Sugestões para te ajudar a decidir." },
];

export default function DashboardPro() {
  const router = useRouter();
  const [estado, setEstado] = useState<"carregando" | "pro">("carregando");
  const [nome, setNome] = useState("Campeão");
  const [compNome, setCompNome] = useState("");
  const [rodadaComp, setRodadaComp] = useState<number | null>(null); // nº da rodada no calendário (1..52)
  const [atletas, setAtletas] = useState<Athlete[] | null>(null);
  const [capitao, setCapitao] = useState<string | null>(null);
  const [dossies, setDossies] = useState<Record<string, EstadoDossie>>({});
  const [aberto, setAberto] = useState<string | null>(null); // id do atleta com detalhe aberto
  const [verBoasVindas, setVerBoasVindas] = useState(true); // caixa de boas-vindas fechável

  useEffect(() => {
    let active = true;

    // Lê is_pro da sessão. PROBLEMA conhecido: no PRIMEIRO instante após abrir a
    // aba, o getSession() pode devolver a sessão com o user_metadata ainda não
    // totalmente hidratado, e is_pro vir undefined → Boolean(undefined)=false →
    // expulsava um Pro para a página de vendas. Por isso NÃO reencaminhamos só
    // com a 1ª leitura: se a sessão disser "não Pro", CONFIRMAMOS com getUser()
    // (vai ao servidor, traz o metadata fresco) antes de reencaminhar.
    function lerIsPro(u: { user_metadata?: { is_pro?: boolean } } | null | undefined): boolean {
      return Boolean(u?.user_metadata?.is_pro);
    }

    // Arranca a central Pro (só chamada quando temos a CERTEZA de que é Pro).
    async function arrancarCentral(u: { user_metadata?: { nome?: string; is_pro?: boolean } } | null | undefined) {
      if (!active) return;
      const m = u?.user_metadata || {};
      setNome(String(m.nome || "").trim().split(" ")[0] || "Campeão");
      setEstado("pro");

      const foco = focoMercado();
      const compFoco = foco.aDecorrer ?? foco.alvo;
      const idComp = compFoco.idCompeticao;
      setCompNome(compFoco.nome);
      setRodadaComp(numeroDaRodada(idComp));

      // Lista de atletas da competição (para nome/país/preço dos cartões).
      try {
        const j = await fetch(`/api/atletas?id=${idComp}`).then((r) => r.json());
        const list = Array.isArray(j?.atletas) ? j.atletas : [];
        if (list.length > 0) setAthletePool(list as never);
      } catch {}

      const team: TeamState | null = await loadSavedCloudFor(idComp);
      if (!active) return;
      if (!team || team.ids.length === 0) {
        setAtletas([]);
        return;
      }
      const lista = resolve(team.ids);
      setAtletas(lista);
      setCapitao(team.captain);

      // Marca todos como "a carregar" e vai buscar o dossiê de cada um, em paralelo.
      setDossies(Object.fromEntries(lista.map((a) => [a.id, "carregando" as EstadoDossie])));
      for (const a of lista) {
        fetch(`/api/dossie?person=${a.id}&comp=${idComp}`)
          .then((r) => r.json())
          .then((j) => {
            if (!active) return;
            const d = j?.dossie as Dossie | undefined;
            setDossies((prev) => ({ ...prev, [a.id]: d ?? "erro" }));
          })
          .catch(() => {
            if (active) setDossies((prev) => ({ ...prev, [a.id]: "erro" }));
          });
      }
    }

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      const u = data.session?.user;

      // Sem sessão de todo → página de vendas (não é o caso do bug; é mesmo deslogado).
      if (!u) {
        router.replace("/ippon-pro");
        return;
      }

      // 1ª leitura diz que é Pro → arranca já, sem hesitar.
      if (lerIsPro(u)) {
        await arrancarCentral(u);
        return;
      }

      // 1ª leitura diz que NÃO é Pro → pode ser o falso-negativo do primeiro
      // instante. CONFIRMA com getUser() (servidor, metadata fresco) antes de
      // expulsar para vendas.
      try {
        const { data: fresco } = await supabase.auth.getUser();
        if (!active) return;
        if (lerIsPro(fresco?.user)) {
          await arrancarCentral(fresco?.user);
          return;
        }
      } catch { /* se a confirmação falhar, tratamos como não-Pro abaixo */ }

      // Confirmado: não é Pro → página de vendas.
      if (active) router.replace("/ippon-pro");
    })();

    // Rede de segurança: se a sessão for atualizada logo a seguir (hidratação
    // tardia do metadata), e ainda estivermos "a carregar", relê e arranca a
    // central se afinal for Pro — sem reencaminhar.
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      if (!active) return;
      const u = session?.user;
      if (u && lerIsPro(u)) {
        setEstado((e) => {
          if (e === "carregando") { void arrancarCentral(u); }
          return e;
        });
      }
    });

    return () => { active = false; sub?.subscription?.unsubscribe?.(); };
  }, [router]);

  if (estado === "carregando") {
    return (
      <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: FB, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#7c8a82", fontSize: 14 }}>A carregar…</p>
      </main>
    );
  }

  const atletaAberto = atletas?.find((a) => a.id === aberto) ?? null;
  const dossieAberto = aberto ? dossies[aberto] : undefined;

  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: FB }}>
      <div style={{ maxWidth: 460, margin: "0 auto", padding: "14px 16px 48px" }}>
        {/* Cabeçalho */}
        <header style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 16 }}>
          <a href="/inicio" aria-label="Voltar" style={{ width: 34, height: 34, borderRadius: "50%", border: "1px solid #243029", display: "flex", alignItems: "center", justifyContent: "center", color: "#cfd8d2", textDecoration: "none", flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
          </a>
          <h1 style={{ fontFamily: FD, fontSize: 18, fontWeight: 700, textTransform: "uppercase", margin: 0 }}>A minha central Pro</h1>
        </header>

        {/* Boas-vindas Pro — fechável (ocupa espaço; depois de vista, pode esconder-se) */}
        {verBoasVindas && (
          <section style={{ position: "relative", textAlign: "center", background: "linear-gradient(160deg,#2a2410,#15110a)", border: `1px solid ${GOLD}`, borderRadius: 18, padding: "20px 18px", marginBottom: 18 }}>
            <button onClick={() => setVerBoasVindas(false)} aria-label="Fechar" style={{ position: "absolute", top: 10, right: 10, width: 26, height: 26, borderRadius: "50%", border: "1px solid #4a3d18", background: "rgba(0,0,0,0.25)", color: "#c9b878", cursor: "pointer", fontSize: 13, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
            <div style={{ width: 72, height: 72, margin: "0 auto 6px" }}><Mascot belt="#141110" expression="comemorando" /></div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: GOLD }}>★ Membro Ippon Pro ★</div>
            <h2 style={{ fontFamily: FD, fontSize: 20, fontWeight: 700, textTransform: "uppercase", margin: "4px 0 6px" }}>Olá, {nome}!</h2>
            <p style={{ fontSize: 13.5, color: "#dfe6e0", lineHeight: 1.55, margin: 0 }}>Esta é a tua central de vantagens. Toca em cada atleta para veres a análise profunda do scout.</p>
          </section>
        )}

        {/* CHAMADA PARA AÇÃO: SÊ PRO MAX — compacta. Os detalhes vivem na página
            de vendas (/ippon-pro), para não duplicar a lista aqui. */}
        <a href="/ippon-pro" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none", background: "linear-gradient(160deg,#16243a,#0d1116)", border: `1.5px solid ${MAX}`, borderRadius: 14, padding: "13px 14px", marginBottom: 18 }}>
          <div style={{ width: 30, height: 30, borderRadius: "50%", background: MAX, color: "#0b1220", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontFamily: FD, fontWeight: 700 }}>★</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: FD, fontSize: 15, fontWeight: 700, textTransform: "uppercase", color: MAX }}>Sê Pro Max</div>
            <div style={{ fontSize: 12, color: "#9fb3cc", marginTop: 1, lineHeight: 1.4 }}>Chave ao vivo, alerta de favoritos, mais ligas, análise da chave e grupo exclusivo.</div>
          </div>
          <span style={{ color: MAX, fontSize: 20, flexShrink: 0 }}>›</span>
        </a>

        {/* SCOUT — o teu time nesta competição */}
        <SectionTitle>O scout do teu time</SectionTitle>
        {compNome && (
          <p style={{ fontSize: 12, color: "#93a39a", margin: "0 0 12px", lineHeight: 1.5 }}>
            Média de pontos de cada atleta <strong style={{ color: "#cfd8d2" }}>no nível desta competição</strong> ({compNome}{rodadaComp ? ` · Rodada ${rodadaComp}` : ""}). Toca para o dossiê completo.
          </p>
        )}

        {atletas === null ? (
          <p style={{ fontSize: 13, color: "#7c8a82", marginBottom: 22 }}>A carregar o teu time…</p>
        ) : atletas.length === 0 ? (
          <section style={{ background: "#121815", border: `1px solid ${GOLD}`, borderRadius: 16, padding: 16, marginBottom: 22, display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{ width: 52, height: 52, flexShrink: 0 }}><Mascot belt="#141110" expression="indicando" /></div>
            <p style={{ fontSize: 13.5, color: "#a9b4ac", lineHeight: 1.55, margin: 0 }}>Ainda não tens uma equipa guardada para esta competição. Monta a tua equipa e volta para o scout.</p>
          </section>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 22 }}>
            <DicaCapitao atletas={atletas} dossies={dossies} capitaoAtual={capitao} onAbrir={(id) => setAberto(id)} />
            {atletas.map((a) => (
              <CartaoResumo
                key={a.id}
                atleta={a}
                ehCapitao={a.id === capitao}
                dossie={dossies[a.id]}
                onClick={() => setAberto(a.id)}
              />
            ))}
            <p style={{ fontSize: 11, color: "#7c8a82", lineHeight: 1.5, margin: "6px 0 0", textAlign: "center" }}>
              São leituras de histórico para te ajudar — possibilidades, não garantias. A decisão é sempre tua.
            </p>
          </div>
        )}

        {/* A chegar / já disponível em Pro Max */}
        <SectionTitle>A chegar à tua central</SectionTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {A_CHEGAR.map((v) => {
            const conteudo = (
              <>
                <div style={{ width: 26, height: 26, borderRadius: "50%", background: v.href ? "#1c3a2e" : "#23291f", color: v.href ? "#aee9c9" : "#7c8a82", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {v.href ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 3v18h18" /><path d="M7 14l4-4 3 3 5-6" /></svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{v.t}</div>
                  <div style={{ fontSize: 12.5, color: "#93a39a", marginTop: 2, lineHeight: 1.5 }}>{v.x}</div>
                </div>
                {v.href ? (
                  <span style={{ flexShrink: 0, alignSelf: "center", display: "flex", alignItems: "center", gap: 6 }}>
                    {v.proMax && <span style={{ fontSize: 9.5, color: "#3a2a08", background: GOLD, borderRadius: 999, padding: "2px 8px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>Pro Max</span>}
                    <span style={{ color: GOLD, fontSize: 18 }}>›</span>
                  </span>
                ) : (
                  <span style={{ flexShrink: 0, alignSelf: "center", fontSize: 10, color: GOLD, border: `1px solid ${GOLD}`, borderRadius: 999, padding: "2px 8px", fontWeight: 700 }}>EM BREVE</span>
                )}
              </>
            );
            const estiloBase: React.CSSProperties = {
              display: "flex", gap: 11, background: "#121815", border: "1px solid #243029",
              borderRadius: 14, padding: "13px 14px",
            };
            return v.href ? (
              <a key={v.t} href={v.href} style={{ ...estiloBase, textDecoration: "none", color: "#f1ede2" }}>{conteudo}</a>
            ) : (
              <div key={v.t} style={{ ...estiloBase, opacity: 0.92 }}>{conteudo}</div>
            );
          })}
        </div>
      </div>

      {/* Detalhe do atleta */}
      {atletaAberto && (
        <DetalheAtleta
          atleta={atletaAberto}
          ehCapitao={atletaAberto.id === capitao}
          dossie={dossieAberto}
          onClose={() => setAberto(null)}
        />
      )}
    </main>
  );
}

/* =========================================================================
 * DICA DE CAPITÃO (sempre UM atleta, escolhido entre os 8 do time)
 * ========================================================================= */

// Escolhe o melhor candidato a capitão por HISTÓRICO: maior média no nível desta
// competição (forma recente como desempate/fallback). Só decide quando todos os
// dossiês estiverem resolvidos, para não piscar uma escolha errada a meio.
//
// [FASE 2 — depois da chave de sábado]: aqui entrará a camada do chaveamento —
// ponderar o caminho de cada atleta na chave (adversários fáceis/difíceis) por
// cima desta média de histórico. Por agora é só histórico.
function escolherCapitao(
  atletas: Athlete[],
  dossies: Record<string, EstadoDossie>
): { pronto: boolean; atleta: Athlete | null; pts: number | null; rotulo: string } {
  const todosResolvidos = atletas.every((a) => {
    const d = dossies[a.id];
    return d !== undefined && d !== "carregando";
  });
  if (!todosResolvidos) return { pronto: false, atleta: null, pts: null, rotulo: "" };

  let melhor: Athlete | null = null;
  let melhorPts = -Infinity;
  let melhorRot = "";
  for (const a of atletas) {
    const d = dossies[a.id];
    if (!d || d === "carregando" || d === "erro") continue;
    const s = sinalDoNivel(d);
    if (s.estado !== "ok" || s.pts === null) continue;
    if (s.pts > melhorPts) {
      melhorPts = s.pts;
      melhor = a;
      melhorRot = s.rotulo;
    }
  }
  if (!melhor) return { pronto: true, atleta: null, pts: null, rotulo: "" };
  return { pronto: true, atleta: melhor, pts: melhorPts, rotulo: melhorRot };
}

function DicaCapitao({ atletas, dossies, capitaoAtual, onAbrir }: { atletas: Athlete[]; dossies: Record<string, EstadoDossie>; capitaoAtual: string | null; onAbrir: (id: string) => void }) {
  const r = escolherCapitao(atletas, dossies);

  // Ainda a carregar dossiês.
  if (!r.pronto) {
    return (
      <div style={{ background: "#121815", border: "1px solid #243029", borderRadius: 14, padding: "13px 14px", display: "flex", alignItems: "center", gap: 11 }}>
        <CrownIcon cor="#5f6f67" />
        <span style={{ fontSize: 12.5, color: "#7c8a82" }}>A analisar o teu time para a dica de capitão…</span>
      </div>
    );
  }

  // Sem dados suficientes em nenhum atleta.
  if (!r.atleta || r.pts === null) {
    return (
      <div style={{ background: "#121815", border: "1px solid #243029", borderRadius: 14, padding: "13px 14px", display: "flex", alignItems: "center", gap: 11 }}>
        <CrownIcon cor="#7c8a82" />
        <span style={{ fontSize: 12.5, color: "#a9b4ac", lineHeight: 1.5 }}>Ainda não há histórico suficiente para uma dica de capitão nesta rodada.</span>
      </div>
    );
  }

  const positivo = r.pts >= 0;
  const jaECapitao = r.atleta.id === capitaoAtual;
  const onde = r.rotulo === "neste nível" ? "no nível desta competição" : "na forma recente";

  // Tom honesto: confiante se positivo; alerta se ninguém tem histórico forte.
  let texto: string;
  if (positivo) {
    texto = jaECapitao
      ? `Por histórico, ${sobrenome(r.atleta.name)} é o teu melhor candidato a capitão — média de ${fmtPts(r.pts)} ${onde}. E é precisamente o que já tens como capitão. Boa escolha.`
      : `Por histórico, o teu melhor candidato a capitão é ${sobrenome(r.atleta.name)} — média de ${fmtPts(r.pts)} ${onde}.`;
  } else {
    texto = `Nenhum do teu time tem histórico forte ${onde}. O menos arriscado seria ${sobrenome(r.atleta.name)} (${fmtPts(r.pts)}), mas é uma rodada difícil para a tua equipa — escolhe com cuidado.`;
  }

  return (
    <button
      onClick={() => onAbrir(r.atleta!.id)}
      style={{
        width: "100%", textAlign: "left", cursor: "pointer", color: "#f1ede2",
        background: positivo ? "linear-gradient(160deg,#2a2410,#15110a)" : "#121815",
        border: `1px solid ${positivo ? GOLD : "#5a4a2c"}`, borderRadius: 14, padding: "13px 14px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
        <CrownIcon cor={positivo ? GOLD : "#c0a050"} />
        <span style={{ fontFamily: FD, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: positivo ? GOLD : "#c0a050" }}>Dica de capitão</span>
      </div>
      <p style={{ fontSize: 13, color: "#dfe6e0", lineHeight: 1.55, margin: 0 }}>{texto}</p>
      <div style={{ fontSize: 10.5, color: "#7c8a82", marginTop: 8, lineHeight: 1.45 }}>
        Por histórico, ainda sem os confrontos da chave. Possibilidade, não garantia. Toca para ver o dossiê.
      </div>
    </button>
  );
}

function CrownIcon({ cor }: { cor: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={cor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M3 8l4 4 5-7 5 7 4-4v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8z" />
    </svg>
  );
}

function sobrenome(nome: string): string {
  return nome.split(" ").slice(-1)[0] || nome;
}

/* =========================================================================
 * CARTÃO-RESUMO (um por atleta)
 * ========================================================================= */

function CartaoResumo({ atleta, ehCapitao, dossie, onClick }: { atleta: Athlete; ehCapitao: boolean; dossie: EstadoDossie | undefined; onClick: () => void }) {
  const sinal = sinalDoNivel(dossie);
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 11, width: "100%", textAlign: "left", cursor: "pointer",
        background: "#121815", border: `1px solid ${ehCapitao ? GOLD : "#243029"}`, borderRadius: 14, padding: "11px 13px", color: "#f1ede2",
      }}
    >
      {/* Avatar com sigla do país */}
      <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#1c3a2e", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontFamily: FD, fontSize: 12, fontWeight: 700, color: "#aee9c9" }}>
        {atleta.countryIso}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 14, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{atleta.name}</span>
          {ehCapitao && <span style={{ flexShrink: 0, fontSize: 9, fontWeight: 700, color: "#3a2a08", background: GOLD, padding: "1px 6px", borderRadius: 999, textTransform: "uppercase" }}>Cap.</span>}
        </div>
        <div style={{ fontSize: 11.5, color: "#93a39a", marginTop: 1 }}>{atleta.category}kg · JC {atleta.priceJc}</div>
      </div>
      {/* Sinal: média no nível desta competição */}
      <div style={{ textAlign: "right", flexShrink: 0, minWidth: 64 }}>
        {sinal.estado === "carregando" ? (
          <span style={{ fontSize: 11, color: "#5f6f67" }}>a analisar…</span>
        ) : sinal.estado === "erro" ? (
          <span style={{ fontSize: 11, color: "#5f6f67" }}>—</span>
        ) : sinal.pts === null ? (
          <>
            <div style={{ fontFamily: FD, fontSize: 15, fontWeight: 700, color: "#7c8a82" }}>—</div>
            <div style={{ fontSize: 9.5, color: "#5f6f67" }}>sem dados</div>
          </>
        ) : (
          <>
            <div style={{ fontFamily: FD, fontSize: 17, fontWeight: 700, color: corPts(sinal.pts) }}>{fmtPts(sinal.pts)}</div>
            <div style={{ fontSize: 9.5, color: "#7c8a82" }}>{sinal.rotulo}</div>
          </>
        )}
      </div>
    </button>
  );
}

// Extrai o sinal-chave: média no nível desta competição (ou forma recente em fallback).
function sinalDoNivel(d: EstadoDossie | undefined): { estado: "carregando" | "erro" | "ok"; pts: number | null; rotulo: string } {
  if (d === undefined || d === "carregando") return { estado: "carregando", pts: null, rotulo: "" };
  if (d === "erro") return { estado: "erro", pts: null, rotulo: "" };
  const nivel = d.desempenhoPorNivel.find((n) => n.ehNivelDestaCompeticao);
  if (nivel && nivel.pontosMedios !== null) return { estado: "ok", pts: nivel.pontosMedios, rotulo: "neste nível" };
  if (d.formaRecente.pontosMedios !== null) return { estado: "ok", pts: d.formaRecente.pontosMedios, rotulo: "forma recente" };
  return { estado: "ok", pts: null, rotulo: "" };
}

/* =========================================================================
 * DETALHE DO ATLETA (dossiê completo)
 * ========================================================================= */

function DetalheAtleta({ atleta, ehCapitao, dossie, onClose }: { atleta: Athlete; ehCapitao: boolean; dossie: EstadoDossie | undefined; onClose: () => void }) {
  const pronto = dossie && dossie !== "carregando" && dossie !== "erro";
  const d = pronto ? (dossie as Dossie) : null;

  // Separa títulos grandes dos "Pequenos Estados" (honestidade — combinado com o Kainan).
  const grandes = d ? d.conquistas.filter((c) => !c.pequenosEstados) : [];
  const pequenos = d ? d.conquistas.filter((c) => c.pequenosEstados) : [];
  const contChampTemPE = !!d && d.conquistas.some((c) => c.nivel === "cont_champ" && c.pequenosEstados);

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(6,8,7,0.82)", zIndex: 120, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 460, maxHeight: "92vh", overflowY: "auto", background: "#0c0e0d", borderTop: `1px solid ${GOLD}`, borderRadius: "18px 18px 0 0", padding: "16px 16px 40px" }}
      >
        {/* Cabeçalho do atleta */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
            <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#1c3a2e", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontFamily: FD, fontSize: 12, fontWeight: 700, color: "#aee9c9" }}>
              {atleta.countryIso}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <span style={{ fontSize: 16, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{atleta.name}</span>
                {ehCapitao && <span style={{ fontSize: 9, fontWeight: 700, color: "#3a2a08", background: GOLD, padding: "1px 6px", borderRadius: 999, textTransform: "uppercase" }}>Cap.</span>}
              </div>
              <div style={{ fontSize: 12, color: "#93a39a", marginTop: 1 }}>
                {d?.perfil.paisNome ?? ""} · {atleta.category}kg
              </div>
            </div>
          </div>
          <button onClick={onClose} aria-label="Fechar" style={{ width: 32, height: 32, borderRadius: "50%", border: "1px solid #243029", background: "transparent", color: "#cfd8d2", cursor: "pointer", flexShrink: 0, fontSize: 16 }}>✕</button>
        </div>

        {!pronto ? (
          <p style={{ fontSize: 13, color: dossie === "erro" ? VERM : "#7c8a82", padding: "20px 0", textAlign: "center" }}>
            {dossie === "erro" ? "Não consegui carregar o dossiê deste atleta. Tenta de novo mais tarde." : "A carregar o dossiê…"}
          </p>
        ) : (
          <>
            {/* Perfil */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
              {d!.perfil.faixa && <Etiqueta titulo="Faixa" valor={traduzirFaixa(d!.perfil.faixa)} />}
              {d!.perfil.tecnica && <Etiqueta titulo="Técnica" valor={d!.perfil.tecnica} />}
              {d!.perfil.treinador && <Etiqueta titulo="Treinador" valor={d!.perfil.treinador} />}
              {d!.perfil.idade !== null && <Etiqueta titulo="Idade" valor={`${d!.perfil.idade}`} />}
            </div>

            {/* Destaque: nível desta competição */}
            <SectionTitle>Nesta competição</SectionTitle>
            <BlocoNivelAlvo dossie={d!} />

            {/* Números de experiência */}
            <SectionTitle>Carreira</SectionTitle>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <NumBox label="Lutas" valor={`${d!.experiencia.lutas}`} />
              <NumBox label="Vitórias" valor={`${Math.round(d!.experiencia.taxaVitoria * 100)}%`} />
              <NumBox label="Comps." valor={`${d!.experiencia.competicoes}`} />
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
              <NumBox label="Ouro" valor={`${d!.medalhas.ouro}`} ouro={d!.medalhas.ouro > 0} />
              <NumBox label="Prata" valor={`${d!.medalhas.prata}`} />
              <NumBox label="Bronze" valor={`${d!.medalhas.bronze}`} />
            </div>

            {/* Títulos grandes */}
            <SectionTitle>Títulos de peso</SectionTitle>
            {grandes.length === 0 ? (
              <p style={{ fontSize: 12.5, color: "#7c8a82", margin: "0 0 16px", lineHeight: 1.5 }}>Sem pódios em competições de topo (Mundial, Grand Slam, Grand Prix, Continental pleno).</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 16 }}>
                {grandes.map((c, i) => <LinhaConquista key={i} c={c} />)}
              </div>
            )}

            {/* Pequenos Estados — separados, com aviso de contexto */}
            {pequenos.length > 0 && (
              <>
                <SectionTitle>Pequenos Estados</SectionTitle>
                <p style={{ fontSize: 11.5, color: "#7c8a82", margin: "0 0 8px", lineHeight: 1.5 }}>
                  Campeonatos continentais de baixa concorrência. Contam, mas não comparam com os de topo.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 16 }}>
                  {pequenos.map((c, i) => <LinhaConquista key={i} c={c} />)}
                </div>
              </>
            )}

            {/* Forma recente */}
            <SectionTitle>Forma recente</SectionTitle>
            {d!.formaRecente.competicoes.length === 0 ? (
              <p style={{ fontSize: 12.5, color: "#7c8a82", margin: "0 0 16px" }}>Sem competições recentes.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
                {d!.formaRecente.competicoes.map((r) => (
                  <div key={r.idCompeticao} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: "#0f1411", border: "1px solid #243029", borderRadius: 10, padding: "9px 12px" }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.nome}</div>
                      <div style={{ fontSize: 11, color: "#93a39a" }}>{r.colocacao}{r.ano ? ` · ${r.ano}` : ""}</div>
                    </div>
                    {r.pontosNossos !== null && (
                      <span style={{ fontFamily: FD, fontSize: 14, fontWeight: 700, color: corPts(r.pontosNossos), flexShrink: 0 }}>{fmtPts(r.pontosNossos)}</span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Desempenho por nível */}
            <SectionTitle>Desempenho por nível</SectionTitle>
            <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 6 }}>
              {d!.desempenhoPorNivel.map((n) => (
                <div key={n.nivel} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, background: n.ehNivelDestaCompeticao ? "#15110a" : "#0f1411", border: `1px solid ${n.ehNivelDestaCompeticao ? GOLD : "#243029"}`, borderRadius: 10, padding: "9px 12px" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600 }}>
                      {n.nivelLabel}
                      {n.nivel === "cont_champ" && contChampTemPE && <span style={{ color: "#7c8a82", fontWeight: 400 }}> *</span>}
                    </div>
                    <div style={{ fontSize: 11, color: "#93a39a" }}>
                      {n.participacoes} {n.participacoes === 1 ? "participação" : "participações"}
                      {n.podios > 0 ? ` · ${n.podios} pódio${n.podios > 1 ? "s" : ""}` : ""}
                      {n.melhorColocacao !== "—" ? ` · melhor: ${n.melhorColocacao}` : ""}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    {n.pontosMedios === null ? (
                      <span style={{ fontSize: 11, color: "#5f6f67" }}>—</span>
                    ) : (
                      <span style={{ fontFamily: FD, fontSize: 14, fontWeight: 700, color: corPts(n.pontosMedios) }}>{fmtPts(n.pontosMedios)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {contChampTemPE && (
              <p style={{ fontSize: 10.5, color: "#7c8a82", margin: "0 0 14px", lineHeight: 1.5 }}>* inclui campeonatos dos Pequenos Estados — a média sobe por isso.</p>
            )}

            {d!.avisos.length > 0 && (
              <p style={{ fontSize: 10.5, color: "#5f6f67", lineHeight: 1.5, margin: "8px 0 0" }}>{d!.avisos.join(" ")}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Bloco de destaque: a linha do nível desta competição (ou fallback de forma recente).
function BlocoNivelAlvo({ dossie }: { dossie: Dossie }) {
  const nivel = dossie.desempenhoPorNivel.find((n) => n.ehNivelDestaCompeticao);
  if (nivel) {
    return (
      <div style={{ background: "#15110a", border: `1px solid ${GOLD}`, borderRadius: 12, padding: "13px 14px", marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 700 }}>{nivel.nivelLabel}</div>
            <div style={{ fontSize: 11.5, color: "#93a39a", marginTop: 2 }}>
              {nivel.participacoes} {nivel.participacoes === 1 ? "participação" : "participações"}
              {nivel.podios > 0 ? ` · ${nivel.podios} pódio${nivel.podios > 1 ? "s" : ""}` : " · sem pódios"}
            </div>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            {nivel.pontosMedios === null ? (
              <span style={{ fontSize: 12, color: "#7c8a82" }}>sem dados</span>
            ) : (
              <>
                <div style={{ fontFamily: FD, fontSize: 22, fontWeight: 700, color: corPts(nivel.pontosMedios) }}>{fmtPts(nivel.pontosMedios)}</div>
                <div style={{ fontSize: 10, color: "#7c8a82" }}>média de pontos</div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }
  // Sem nível inferido: usa a forma recente.
  return (
    <div style={{ background: "#0f1411", border: "1px solid #243029", borderRadius: 12, padding: "13px 14px", marginBottom: 18 }}>
      <div style={{ fontSize: 12.5, color: "#a9b4ac", lineHeight: 1.5 }}>
        Não foi possível identificar o nível desta competição. Como referência, a média deste atleta nas últimas competições foi{" "}
        {dossie.formaRecente.pontosMedios === null ? "— (sem dados)" : <strong style={{ color: corPts(dossie.formaRecente.pontosMedios) }}>{fmtPts(dossie.formaRecente.pontosMedios)} pts</strong>}.
      </div>
    </div>
  );
}

function LinhaConquista({ c }: { c: Dossie["conquistas"][number] }) {
  const cor = c.medalha === "ouro" ? GOLD : c.medalha === "prata" ? "#cfd8d2" : "#c08a5a";
  const rotulo = c.medalha === "ouro" ? "Ouro" : c.medalha === "prata" ? "Prata" : "Bronze";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#0f1411", border: "1px solid #243029", borderRadius: 10, padding: "9px 12px" }}>
      <span style={{ width: 9, height: 9, borderRadius: "50%", background: cor, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.nome}</div>
        <div style={{ fontSize: 11, color: "#93a39a" }}>{rotulo} · {c.nivelLabel}{c.ano ? ` · ${c.ano}` : ""}</div>
      </div>
    </div>
  );
}

/* =========================================================================
 * HELPERS DE UI
 * ========================================================================= */

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily: FD, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#93a39a", marginBottom: 10 }}>{children}</div>;
}

function NumBox({ label, valor, ouro }: { label: string; valor: string; ouro?: boolean }) {
  return (
    <div style={{ flex: 1, background: "#0f1411", border: "1px solid #243029", borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
      <div style={{ fontSize: 10.5, color: "#7c8a82", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div style={{ fontFamily: FD, fontSize: 17, fontWeight: 700, color: ouro ? GOLD : "#f1ede2", marginTop: 2 }}>{valor}</div>
    </div>
  );
}

function Etiqueta({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div style={{ background: "#0f1411", border: "1px solid #243029", borderRadius: 9, padding: "6px 10px" }}>
      <div style={{ fontSize: 9.5, color: "#7c8a82", textTransform: "uppercase", letterSpacing: "0.05em" }}>{titulo}</div>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: "#e7ede8", marginTop: 1 }}>{valor}</div>
    </div>
  );
}

function fmtPts(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}
function corPts(n: number): string {
  if (n > 0) return VERDE;
  if (n < 0) return VERM;
  return "#cfd8d2";
}

// "Black belt - II DAN" -> "Preta II Dan" (simplifica o que a API dá).
function traduzirFaixa(belt: string): string {
  const b = belt.toLowerCase();
  let cor = belt;
  if (b.includes("black")) cor = "Preta";
  else if (b.includes("brown")) cor = "Castanha";
  else if (b.includes("blue")) cor = "Azul";
  const dan = belt.match(/([IVX]+)\s*DAN/i);
  return dan ? `${cor} ${dan[1].toUpperCase()} Dan` : cor;
}
