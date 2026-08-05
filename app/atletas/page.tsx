"use client";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Mascot } from "@/components/Mascot";
import { type Athlete } from "@/lib/athletes";
import { focoMercado } from "@/lib/calendario";
import { supabase } from "@/lib/supabase";
const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";
const IOC: Record<string, string> = {
  JP: "JPN", FR: "FRA", BR: "BRA", GE: "GEO", KZ: "KAZ", AZ: "AZE", BE: "BEL",
  TR: "TUR", UZ: "UZB", RU: "AIN", DE: "GER", XK: "KOS", IT: "ITA", CA: "CAN",
  SI: "SLO", HR: "CRO", NL: "NED",
};
const code3 = (iso: string) => IOC[iso] || iso;
// Uma linha do ranking. No modo CONGELADO traz também n_lutas/V/D/variação.
type RankRow = {
  id: string;
  name: string;
  countryIso: string;
  category: string;
  gender: "M" | "F" | "";
  pontos: number;
  posicao: number;
  nLutas?: number;
  vitorias?: number;
  derrotas?: number;
  variacaoJc?: number;
  acoes?: Record<string, number>;
};
export default function AtletasPage() {
  return (
    <Suspense fallback={<Carregando />}>
      <Atletas />
    </Suspense>
  );
}
function Atletas() {
  const searchParams = useSearchParams();
  const foco = focoMercado();
  const compParam = searchParams.get("comp");
  // Há competição a DECORRER? Então modo AO VIVO. Senão, modo CONGELADO.
  const aDecorrer = foco.aDecorrer;
  const aoVivo = aDecorrer !== null && !compParam;
  const [rows, setRows] = useState<RankRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [temResultados, setTemResultados] = useState(false);
  const [nomeComp, setNomeComp] = useState<string>(aDecorrer ? aDecorrer.nome : "");
  const [modo, setModo] = useState<"ao-vivo" | "congelado">(aoVivo ? "ao-vivo" : "congelado");
  const [sel, setSel] = useState<RankRow | null>(null);
  // Atletas com perfil VERIFICADO (selo na lista). Uma consulta só, leve.
  const [verificados, setVerificados] = useState<Set<string>>(new Set());
  useEffect(() => {
    let active = true;
    setLoading(true);
    (async () => {
      // ----- MODO AO VIVO (competição a decorrer): cálculo por atleta -----
      if (aoVivo && aDecorrer) {
        const idComp = aDecorrer.idCompeticao;
        let lista: Athlete[] = [];
        try {
          const atl = await fetch(`/api/atletas?id=${idComp}`).then((r) => r.json()).catch(() => null);
          lista = Array.isArray(atl?.atletas) ? atl.atletas : [];
        } catch {}
        if (!active) return;
        const byId = new Map<string, Athlete>();
        for (const a of lista) byId.set(a.id, a);
        const ids = lista.map((a) => a.id).filter(Boolean);
        let pontos: Record<string, number> = {};
        let acoesMapa: Record<string, Record<string, number>> = {};
        let houve = false;
        if (ids.length > 0) {
          try {
            const res = await fetch(`/api/resultados?comp=${idComp}&persons=${encodeURIComponent(ids.join(","))}`)
              .then((r) => r.json()).catch(() => null);
            pontos = res && res.pontos ? res.pontos : {};
            acoesMapa = res && res.acoes ? res.acoes : {};
            houve = !!(res && res.tem_resultados);
          } catch {}
        }
        if (!active) return;
        setTemResultados(houve);
        setNomeComp(aDecorrer.nome);
        setModo("ao-vivo");
        const base = Object.entries(pontos)
          .filter(([, pts]) => typeof pts === "number")
          .map(([id, pts]) => {
            const a = byId.get(id);
            return {
              id,
              name: a?.name ?? `Atleta ${id}`,
              countryIso: a?.countryIso ?? "—",
              category: a?.category ?? "",
              gender: (a?.gender ?? "") as "M" | "F" | "",
              pontos: Math.round((pts as number) * 10) / 10,
              // Ações somadas desta competição (o "como pontuou"), vindas do
              // endpoint no modo por_atleta. Antes faltavam no ao vivo.
              acoes: acoesMapa[id] && typeof acoesMapa[id] === "object" ? acoesMapa[id] : {},
            };
          });
        base.sort((x, y) => (y.pontos - x.pontos) || x.name.localeCompare(y.name));
        const ranked: RankRow[] = base.map((r) => {
          const melhores = base.filter((o) => o.pontos > r.pontos).length;
          return { ...r, posicao: melhores + 1 };
        });
        setRows(ranked);
        setLoading(false);
        return;
      }
      // ----- MODO CONGELADO (sem nada a decorrer): lê resultados_atletas -----
      // Quem já provou ser quem diz. Não bloqueia o ranking se falhar.
      fetch("/api/reivindicar?verificados=1")
        .then((r) => r.json())
        .then((j) => { if (j?.ok && Array.isArray(j.ids)) setVerificados(new Set(j.ids.map(String))); })
        .catch(() => {});
      const url = compParam ? `/api/ranking-atletas?comp=${compParam}` : `/api/ranking-atletas`;
      let j: {
        nome?: string; tem_resultados?: boolean;
        atletas?: Array<{ id: string; nome: string; countryIso: string; category: string; gender: string; pontos: number; n_lutas: number; vitorias: number; derrotas: number; variacao_jc: number; acoes: Record<string, number>; posicao: number }>;
      } | null = null;
      try {
        j = await fetch(url).then((r) => r.json()).catch(() => null);
      } catch {}
      if (!active) return;
      setModo("congelado");
      setNomeComp(j?.nome || "");
      setTemResultados(!!(j && j.tem_resultados));
      const ats = Array.isArray(j?.atletas) ? j!.atletas : [];
      const ranked: RankRow[] = ats.map((a) => ({
        id: a.id,
        name: a.nome,
        countryIso: a.countryIso,
        category: a.category,
        gender: (a.gender || "") as "M" | "F" | "",
        pontos: a.pontos,
        posicao: a.posicao,
        nLutas: a.n_lutas,
        vitorias: a.vitorias,
        derrotas: a.derrotas,
        variacaoJc: a.variacao_jc,
        acoes: a.acoes && typeof a.acoes === "object" ? a.acoes : {},
      }));
      setRows(ranked);
      setLoading(false);
    })();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compParam]);
  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: FB }}>
      <div style={{ maxWidth: 460, margin: "0 auto", padding: "14px 14px 84px" }}>
        <header style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 6 }}>
          <a href="/inicio" aria-label="Voltar" style={{ width: 34, height: 34, borderRadius: "50%", border: "1px solid #243029", display: "flex", alignItems: "center", justifyContent: "center", color: "#cfd8d2", textDecoration: "none", flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
          </a>
          <h1 style={{ fontFamily: FD, fontSize: 19, fontWeight: 700, textTransform: "uppercase", margin: 0 }}>Ranking de Atletas</h1>
        </header>
        <div style={{ fontSize: 12, color: "#93a39a", marginBottom: 16, paddingLeft: 45, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span>Os que mais pontuaram em <span style={{ color: GOLD, fontWeight: 700 }}>{nomeComp || "—"}</span></span>
          {modo === "ao-vivo" && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: "#7fd1a3" }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#7fd1a3" }} />
              Ao vivo
            </span>
          )}
        </div>
        {loading ? (
          <Carregando inline />
        ) : !temResultados || rows.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 16px", background: "#121815", border: "1px solid #243029", borderRadius: 16 }}>
            <div style={{ width: 84, height: 84, margin: "0 auto 8px" }}><Mascot belt="#efeadd" expression="feliz" /></div>
            <div style={{ fontFamily: FD, fontSize: 16, fontWeight: 700, textTransform: "uppercase", margin: "4px 0 8px" }}>Ainda sem pontos</div>
            <p style={{ fontSize: 13, color: "#c7d0c9", lineHeight: 1.5, margin: 0 }}>
              Quando as lutas arrancarem, o ranking dos atletas que mais pontuam aparece aqui — e fica disponível até à próxima competição.
            </p>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 11, color: "#5f6f67", marginBottom: 10 }}>
              {rows.length} atletas com pontos · do melhor ao pior
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {rows.map((r) => <Row key={r.id} r={r} verificado={verificados.has(r.id)} onClick={() => setSel(r)} />)}
            </div>
          </>
        )}
      </div>
      {sel && (
        <Detalhe
          r={sel}
          nomeComp={nomeComp}
          verificado={verificados.has(sel.id)}
          onVerificado={(id) => setVerificados((v) => new Set([...v, id]))}
          onClose={() => setSel(null)}
        />
      )}
      <nav style={{ position: "fixed", left: 0, right: 0, bottom: 0, height: 60, background: "#0f1411", borderTop: "1px solid #243029", display: "flex", alignItems: "center", justifyContent: "space-around", zIndex: 50 }}>
        <NavTab label="Início" href="/inicio" icon={<HomeIcon />} />
        <NavTab label="Competições" href="/ligas" icon={<TrophyIcon />} />
        <NavTab label="Atletas" href="/atletas" icon={<AthletesIcon />} active />
        {/* /pro-central decide o destino conforme o nível (ver
            app/pro-central/page.tsx). Antes apontava sempre para /ippon-pro — a
            página de VENDAS — e um Pro Max que tocasse aqui era convidado a
            comprar o que já tinha. Todas as barras da app usam este destino. */}
        <NavTab label="Pro" href="/pro-central" icon={<BoltIcon />} />
      </nav>
    </main>
  );
}
function Row({ r, verificado, onClick }: { r: RankRow; verificado?: boolean; onClick: () => void }) {
  const medal = r.posicao === 1 ? "#d9a441" : r.posicao === 2 ? "#c0c5cc" : r.posicao === 3 ? "#cd7f4d" : null;
  const negativo = r.pontos < 0;
  return (
    <button onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", background: "#121815", border: `1px solid ${medal ? medal : "#243029"}`, borderRadius: 14, padding: "10px 13px", cursor: "pointer", fontFamily: FB, textAlign: "left" }}>
      <div style={{ width: 30, textAlign: "center", flexShrink: 0 }}>
        <span style={{ fontFamily: FD, fontSize: 16, fontWeight: 700, color: medal ?? "#7c8a82" }}>{r.posicao}</span>
      </div>
      <div style={{ width: 38, height: 42, borderRadius: 7, background: "linear-gradient(160deg,#2a4d3e,#1c3a2e)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <div style={{ background: "#f1ede2", color: "#1b211e", fontFamily: FD, fontWeight: 700, fontSize: 8, padding: "1px 3px", borderRadius: 2 }}>{code3(r.countryIso)}</div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "#f1ede2", display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</span>
          {/* Selo de perfil verificado. É reconhecimento, não vantagem: não muda
              preço nem pontos. Ver a nota em criar-tabela-reivindicacoes.sql. */}
          {verificado && <SeloVerificado />}
        </div>
        <div style={{ fontSize: 11, color: "#93a39a" }}>{code3(r.countryIso)}{r.category ? ` · ${r.category}kg` : ""}{r.gender ? ` · ${r.gender === "F" ? "Fem" : "Masc"}` : ""}</div>
      </div>
      <div style={{ flexShrink: 0, background: negativo ? "#3a2422" : "#1d3a2b", color: negativo ? "#ef8d83" : "#9be3bd", fontFamily: FD, fontWeight: 700, fontSize: 13, padding: "4px 11px", borderRadius: 999 }}>
        {r.pontos >= 0 ? "+" : ""}{r.pontos} pts
      </div>
    </button>
  );
}
// Traduz o objeto de ações agregadas em linhas legíveis (a "razão" do ponto).
// Positivas primeiro, depois as sofridas. Só as que existem.
function linhasDeAcoes(a: Record<string, number>): { label: string; qtd: number; negativo: boolean }[] {
  const def: { chave: string; label: string; negativo: boolean }[] = [
    { chave: "ippon", label: "Ippon", negativo: false },
    { chave: "waza", label: "Waza-ari", negativo: false },
    { chave: "yuko", label: "Yuko", negativo: false },
    { chave: "shido_provocado", label: "Shido provocado", negativo: false },
    { chave: "ippon_sof", label: "Ippon sofrido", negativo: true },
    { chave: "waza_sof", label: "Waza-ari sofrido", negativo: true },
    { chave: "yuko_sof", label: "Yuko sofrido", negativo: true },
    { chave: "shido_sof", label: "Shido sofrido", negativo: true },
  ];
  const out: { label: string; qtd: number; negativo: boolean }[] = [];
  for (const d of def) {
    const q = Number(a[d.chave] || 0);
    if (q > 0) out.push({ label: d.label, qtd: q, negativo: d.negativo });
  }
  return out;
}
// Popup do atleta — SIMPLIFICADO (#2): pontos + nº de lutas e V/D. Sem fases.
function Detalhe({ r, nomeComp, verificado, onVerificado, onClose }: { r: RankRow; nomeComp: string; verificado?: boolean; onVerificado: (id: string) => void; onClose: () => void }) {
  const temLutas = typeof r.nLutas === "number";
  const temVar = typeof r.variacaoJc === "number";
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(6,8,7,0.80)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 100 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 460, background: "#10160f", borderTop: `2px solid ${GOLD}`, borderRadius: "18px 18px 0 0", padding: "16px 16px 28px", maxHeight: "86%", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <div style={{ width: 46, height: 50, borderRadius: 8, background: "linear-gradient(160deg,#2a4d3e,#1c3a2e)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <div style={{ background: "#f1ede2", color: "#1b211e", fontFamily: FD, fontWeight: 700, fontSize: 10, padding: "1px 4px", borderRadius: 3 }}>{code3(r.countryIso)}</div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
              {r.name}{verificado && <SeloVerificado />}
            </div>
            <div style={{ fontSize: 12, color: "#93a39a" }}>{code3(r.countryIso)}{r.category ? ` · ${r.category}kg` : ""}</div>
          </div>
          <button onClick={onClose} aria-label="Fechar" style={{ background: "transparent", border: "none", color: "#93a39a", fontSize: 20, cursor: "pointer" }}>✕</button>
        </div>
        {/* Cartões: Posição + Pontos */}
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <div style={{ flex: 1, background: "#141a17", border: "1px solid #243029", borderRadius: 12, padding: "12px", textAlign: "center" }}>
            <div style={{ fontSize: 10, color: "#93a39a", textTransform: "uppercase" }}>Posição</div>
            <div style={{ fontFamily: FD, fontSize: 22, fontWeight: 700, color: GOLD }}>{r.posicao}º</div>
          </div>
          <div style={{ flex: 1, background: "#16201b", border: `1px solid ${GOLD}`, borderRadius: 12, padding: "12px", textAlign: "center" }}>
            <div style={{ fontSize: 10, color: "#93a39a", textTransform: "uppercase" }}>Pontos na rodada</div>
            <div style={{ fontFamily: FD, fontSize: 22, fontWeight: 700, color: GOLD }}>{r.pontos >= 0 ? "+" : ""}{r.pontos}</div>
          </div>
        </div>
        {/* Cartões: Lutas (V/D) + Valorização — só no modo congelado, que tem estes dados */}
        {(temLutas || temVar) && (
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            {temLutas && (
              <div style={{ flex: 1, background: "#141a17", border: "1px solid #243029", borderRadius: 12, padding: "12px", textAlign: "center" }}>
                <div style={{ fontSize: 10, color: "#93a39a", textTransform: "uppercase" }}>Lutas</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 7, justifyContent: "center", marginTop: 3 }}>
                  <span style={{ fontFamily: FD, fontSize: 18, fontWeight: 700, color: "#f1ede2" }}>{r.nLutas}</span>
                  <span style={{ fontFamily: FD, fontSize: 13, fontWeight: 700, color: "#7fd1a3" }}>{r.vitorias}V</span>
                  <span style={{ fontFamily: FD, fontSize: 13, fontWeight: 700, color: "#ef8d83" }}>{r.derrotas}D</span>
                </div>
              </div>
            )}
            {temVar && (
              <div style={{ flex: 1, background: "#141a17", border: "1px solid #243029", borderRadius: 12, padding: "12px", textAlign: "center" }}>
                <div style={{ fontSize: 10, color: "#93a39a", textTransform: "uppercase" }}>Valorização</div>
                <div style={{ fontFamily: FD, fontSize: 18, fontWeight: 700, color: (r.variacaoJc ?? 0) >= 0 ? "#7fd1a3" : "#ef8d83", marginTop: 3 }}>
                  {(r.variacaoJc ?? 0) >= 0 ? "+" : ""}{r.variacaoJc} JC
                </div>
              </div>
            )}
          </div>
        )}
        <div style={{ fontSize: 11.5, color: "#93a39a", textAlign: "center", lineHeight: 1.5 }}>
          Pontuação em <span style={{ color: "#cfd8d2" }}>{nomeComp}</span>, somada pelas ações nas lutas (ippons, waza-aris, shidos).
        </div>
        {/* REIVINDICAR — o convite ao próprio atleta. Fica no fim: quem chega
            aqui já viu os seus números, que é o argumento. */}
        <Reivindicar r={r} verificado={!!verificado} onVerificado={onVerificado} />
        {/* A "razão" do ponto: resumo agregado das ações na competição (#scout). */}
        {r.acoes && Object.keys(r.acoes).length > 0 && linhasDeAcoes(r.acoes).length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontFamily: FD, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#93a39a", marginBottom: 10 }}>
              Como pontuou
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {linhasDeAcoes(r.acoes).map((l, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#141a17", border: "1px solid #243029", borderRadius: 10, padding: "8px 12px" }}>
                  <span style={{ fontSize: 12.5, color: "#d6ddd6" }}>{l.label}</span>
                  <span style={{ fontFamily: FD, fontSize: 12.5, fontWeight: 700, color: l.negativo ? "#ef8d83" : "#7fd1a3" }}>{l.qtd}×</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
// Selo pequeno de perfil verificado.
function SeloVerificado() {
  return (
    <span title="Perfil verificado" style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", width: 15, height: 15, borderRadius: "50%", background: "#2f6fb3", color: "#fff" }}>
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg>
    </span>
  );
}
// ---------------------------------------------------------------------------
// REIVINDICAR O PERFIL — "és tu? prova-o".
//
// O fluxo, do lado de quem clica:
//   1. Deixa o Instagram.
//   2. Recebe o código por DM (enviado à mão, da conta oficial).
//   3. Introduz o código aqui.
//
// O código NUNCA vem nesta resposta — é isso que faz dele uma prova. Quem o
// introduz recebeu-o naquele contacto.
//
// E o selo não dá vantagem nenhuma no jogo: nem preço, nem pontos, nem acesso.
// Sem vantagem, quem reivindica é só quem quer aparecer — que é exatamente quem
// interessa. Com vantagem, haveria motivo para fingir.
// ---------------------------------------------------------------------------
function Reivindicar({ r, verificado, onVerificado }: { r: RankRow; verificado: boolean; onVerificado: (id: string) => void }) {
  const [aberto, setAberto] = useState(false);
  const [fase, setFase] = useState<"forma" | "aguardar" | "feito">("forma");
  const [contacto, setContacto] = useState("");
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState("");
  const [aEnviar, setAEnviar] = useState(false);
  const [temSessao, setTemSessao] = useState<boolean | null>(null);
  // Código já fora de prazo? Então oferece-se um novo em vez de deixar a pessoa
  // a tentar um que já não serve.
  const [expirado, setExpirado] = useState(false);
  // Estado deste atleta para ESTE utilizador (já pediu? já verificou?).
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!vivo) return;
        setTemSessao(!!token);
        if (!token) return;
        const j = await fetch(`/api/reivindicar?id_person=${encodeURIComponent(r.id)}`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then((x) => x.json());
        if (!vivo || !j?.ok) return;
        if (j.meuEstado === "verificado") setFase("feito");
        else if (j.meuEstado === "pendente") { setFase("aguardar"); setExpirado(!!j.codigoExpirado); }
      } catch { /* fica no estado inicial */ }
    })();
    return () => { vivo = false; };
  }, [r.id]);
  async function chamar(corpo: Record<string, unknown>) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("sem sessão");
    const res = await fetch("/api/reivindicar", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...corpo, id_person: r.id, nome_atleta: r.name }),
    });
    return res.json();
  }
  async function pedir() {
    setErro(""); setAEnviar(true);
    try {
      const j = await chamar({ acao: "pedir", tipo_contacto: "instagram", contacto });
      if (!j?.ok) { setErro(String(j?.erro || "Não foi possível registar o pedido.")); return; }
      setFase("aguardar");
    } catch { setErro("Não foi possível registar o pedido."); }
    finally { setAEnviar(false); }
  }
  async function novoCodigo() {
    setErro(""); setAEnviar(true);
    try {
      const j = await chamar({ acao: "novo-codigo" });
      if (!j?.ok) { setErro(String(j?.erro || "Não foi possível gerar um código novo.")); return; }
      setExpirado(false); setCodigo("");
      setErro("Enviámos um código novo. O anterior deixou de servir.");
    } catch { setErro("Não foi possível gerar um código novo."); }
    finally { setAEnviar(false); }
  }
  async function verificar() {
    setErro(""); setAEnviar(true);
    try {
      const j = await chamar({ acao: "verificar", codigo });
      if (!j?.ok) {
        if (j?.expirado) setExpirado(true);
        setErro(String(j?.erro || "Código errado."));
        return;
      }
      setFase("feito");
      onVerificado(r.id);
    } catch { setErro("Não foi possível verificar."); }
    finally { setAEnviar(false); }
  }
  // Já verificado por alguém: não há nada a pedir.
  if (verificado && fase !== "feito") return null;
  if (fase === "feito") {
    return (
      <div style={{ marginTop: 16, background: "#0f1620", border: "1px solid #2f6fb3", borderRadius: 12, padding: "12px 14px", textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, fontFamily: FD, fontSize: 13, fontWeight: 700, textTransform: "uppercase", color: "#7fb8f5" }}>
          <SeloVerificado /> Perfil verificado
        </div>
        <p style={{ fontSize: 12, color: "#cdd9e6", lineHeight: 1.5, margin: "6px 0 0" }}>
          Este perfil é teu. Falamos contigo em breve.
        </p>
      </div>
    );
  }
  if (!aberto) {
    return (
      <button
        onClick={() => setAberto(true)}
        style={{ width: "100%", marginTop: 16, background: "transparent", border: "1px dashed #2f5478", color: "#7fb8f5", fontFamily: FD, fontSize: 12.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", padding: "11px", borderRadius: 11, cursor: "pointer" }}
      >
        És tu? Reivindica este perfil
      </button>
    );
  }
  return (
    <div style={{ marginTop: 16, background: "#0f1620", border: "1px solid #2f5478", borderRadius: 12, padding: "13px 14px" }}>
      {temSessao === false ? (
        <>
          <p style={{ fontSize: 12.5, color: "#cdd9e6", lineHeight: 1.5, margin: "0 0 12px" }}>
            Para reivindicares este perfil precisas de ter conta na Ippon League.
          </p>
          <a href="/entrar?voltar=/atletas" style={{ display: "block", textAlign: "center", background: "#2f6fb3", color: "#fff", fontFamily: FD, fontSize: 13, fontWeight: 700, textTransform: "uppercase", padding: "10px", borderRadius: 9, textDecoration: "none" }}>Entrar</a>
        </>
      ) : fase === "aguardar" ? (
        <>
          <div style={{ fontFamily: FD, fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "#7fb8f5", marginBottom: 6 }}>Pedido registado</div>
          <p style={{ fontSize: 12.5, color: "#cdd9e6", lineHeight: 1.5, margin: "0 0 12px" }}>
            Vamos enviar-te um código por mensagem direta no Instagram. Quando o receberes, escreve-o aqui.
            <span style={{ color: "#7c8a82" }}> O código serve durante 48 horas.</span>
          </p>
          {expirado && (
            <div style={{ background: "#2a1f1c", border: "1px solid #5a3a36", borderRadius: 9, padding: "9px 11px", marginBottom: 10, fontSize: 12, color: "#ef8d83", lineHeight: 1.45 }}>
              O código que tinhas já expirou. Pede um novo aqui em baixo.
            </div>
          )}
          <input
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.toUpperCase())}
            placeholder="IPPON-XXXX"
            style={{ width: "100%", boxSizing: "border-box", background: "#0c0e0d", border: "1px solid #24364a", borderRadius: 9, padding: "10px 12px", color: "#f1ede2", fontFamily: FD, fontSize: 15, letterSpacing: "0.08em", textAlign: "center", marginBottom: 10 }}
          />
          {erro && <div style={{ fontSize: 12, color: "#ef8d83", marginBottom: 10, lineHeight: 1.45 }}>{erro}</div>}
          <button onClick={verificar} disabled={aEnviar || codigo.length < 4}
            style={{ width: "100%", background: "#2f6fb3", color: "#fff", border: "none", fontFamily: FD, fontSize: 13, fontWeight: 700, textTransform: "uppercase", padding: "11px", borderRadius: 9, cursor: aEnviar ? "default" : "pointer", opacity: aEnviar || codigo.length < 4 ? 0.6 : 1 }}>
            {aEnviar ? "A verificar…" : "Confirmar código"}
          </button>
          <button onClick={novoCodigo} disabled={aEnviar}
            style={{ width: "100%", marginTop: 8, background: "transparent", border: "1px solid #24364a", color: "#7fb8f5", fontFamily: FD, fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", padding: "9px", borderRadius: 9, cursor: aEnviar ? "default" : "pointer" }}>
            Pedir um código novo
          </button>
          <button onClick={() => { setFase("forma"); setErro(""); setExpirado(false); }}
            style={{ width: "100%", marginTop: 8, background: "transparent", border: "none", color: "#7c8a82", fontSize: 11.5, cursor: "pointer", fontFamily: FB }}>
            Mudar o Instagram
          </button>
        </>
      ) : (
        <>
          <p style={{ fontSize: 12.5, color: "#cdd9e6", lineHeight: 1.5, margin: "0 0 12px" }}>
            Deixa o teu Instagram. Enviamos-te um código por mensagem direta para confirmar que és tu — e falamos contigo.
          </p>
          {/* SÓ INSTAGRAM. Um número de telemóvel não prova nada — qualquer
              pessoa escreve um e atende. Uma conta de Instagram de um atleta de
              topo está ligada no perfil da IJF e é verificável a olho. */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#0c0e0d", border: "1px solid #24364a", borderRadius: 9, padding: "0 12px", marginBottom: 10 }}>
            <span style={{ color: "#7fb8f5", flexShrink: 0 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" /></svg>
            </span>
            <input
              value={contacto}
              onChange={(e) => setContacto(e.target.value)}
              placeholder="@oteuinstagram"
              style={{ flex: 1, background: "transparent", border: "none", outline: "none", padding: "10px 0", color: "#f1ede2", fontSize: 14, fontFamily: FB }}
            />
          </div>
          {erro && <div style={{ fontSize: 12, color: "#ef8d83", marginBottom: 10, lineHeight: 1.45 }}>{erro}</div>}
          <button onClick={pedir} disabled={aEnviar || contacto.trim().length < 3}
            style={{ width: "100%", background: "#2f6fb3", color: "#fff", border: "none", fontFamily: FD, fontSize: 13, fontWeight: 700, textTransform: "uppercase", padding: "11px", borderRadius: 9, cursor: aEnviar ? "default" : "pointer", opacity: aEnviar || contacto.trim().length < 3 ? 0.6 : 1 }}>
            {aEnviar ? "A enviar…" : "Enviar pedido"}
          </button>
          <p style={{ fontSize: 10.5, color: "#5f6f67", lineHeight: 1.45, margin: "9px 0 0", textAlign: "center" }}>
            O selo é só reconhecimento — não muda o teu preço nem os teus pontos no jogo.
          </p>
        </>
      )}
    </div>
  );
}
function Carregando({ inline }: { inline?: boolean }) {
  const box = (
    <div style={{ textAlign: "center", padding: "40px 16px", background: inline ? "transparent" : "#0c0e0d", color: "#7c8a82" }}>
      <div style={{ fontFamily: FD, fontSize: 13, letterSpacing: "0.14em", textTransform: "uppercase" }}>A carregar ranking…</div>
    </div>
  );
  if (inline) return box;
  return <main style={{ minHeight: "100vh", background: "#0c0e0d", display: "flex", alignItems: "center", justifyContent: "center" }}>{box}</main>;
}
function NavTab({ label, icon, href, active }: { label: string; icon: React.ReactNode; href?: string; active?: boolean }) {
  const style: React.CSSProperties = { display: "flex", flexDirection: "column", alignItems: "center", gap: 3, color: active ? GOLD : "#6f7d76", textDecoration: "none" };
  const inner = <>{icon}<span style={{ fontSize: 11, fontWeight: active ? 700 : 400 }}>{label}</span></>;
  return href ? <a href={href} style={style}>{inner}</a> : <div style={style}>{inner}</div>;
}
function HomeIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /></svg>;
}
function TrophyIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 4h8v5a4 4 0 0 1-8 0V4z" /><path d="M8 6H5v2a3 3 0 0 0 3 3M16 6h3v2a3 3 0 0 1-3 3M10 17h4M9 21h6M12 13v4" /></svg>;
}
function AthletesIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="8" cy="6" r="3" /><circle cx="17" cy="7" r="2.5" /><path d="M3 20v-1a5 5 0 0 1 10 0v1M14 20v-1a4 4 0 0 1 7-2.6" /></svg>;
}
function BoltIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" /></svg>;
}
