"use client";

// app/admin/utm/page.tsx
//
// Painel de admin (so admin): construtor de links UTM + "de onde vem".
// A verdadeira barreira e no servidor; aqui so escondemos a UI.
//
// CONVENCAO (decidida com o Kainan, 01/10/2026): SEGMENTAR SEMPRE A ACAO.
//   utm_source = <acao>-<rede>   (ex.: bio-ig, story-ig, dm-ig, ads-tiktok, bio-yt)
//   utm_content = assunto/criativo (ex.: apresentacao-app, favoritos)  [opcional]
//   utm_campaign = fase atual (agora: lancamento)
//   destino = sempre /criar-equipa
// Assim, em "Por fonte", cada linha e uma ACAO por rede e da para ver qual rende mais.

import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

const GOLD = "#d9a441";
const FUNDO = "#141110";
const CARTAO = "#1e1a17";
const BORDA = "#2c2622";
const BASE = "https://www.ipponleague.com";

// Acao = O QUE voce fez. Rede = ONDE. Juntas formam o utm_source (bio-ig, etc.).
const ACOES: { v: string; r: string }[] = [
  { v: "bio", r: "Bio (link fixo do perfil)" },
  { v: "story", r: "Story" },
  { v: "post", r: "Post / conteudo do feed" },
  { v: "reels", r: "Reels / video curto" },
  { v: "dm", r: "Inbox / DM (automacao)" },
  { v: "ads", r: "Trafego pago" },
  { v: "perfil", r: "Perfil (generico)" },
];
const REDES: { v: string; r: string }[] = [
  { v: "ig", r: "Instagram" },
  { v: "tiktok", r: "TikTok" },
  { v: "yt", r: "YouTube" },
  { v: "x", r: "X (Twitter)" },
  { v: "wpp", r: "WhatsApp" },
  { v: "", r: "(sem rede especifica)" },
];

interface Item { chave: string; registos: number; ativaram: number; pro: number }
interface Aquisicao {
  ok: boolean;
  erro?: string;
  detalhe?: string;
  dica?: string;
  total?: number;
  resumo?: { diretos: number; comReferrer: number; comReferral: number; ativaram?: number; pro?: number; ativarPct?: number; proPct?: number };
  porFonte?: Item[];
  porCampanha?: Item[];
  porFonteCampanha?: Item[];
  porConteudo?: Item[];
  porDeclarada?: Item[] | null;
}

// minusculas + so letras/numeros, palavras separadas por hifen (convencao para
// dados limpos). Acentos/espacos/simbolos viram hifen.
function limpa(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export default function UtmPage() {
  const [acesso, setAcesso] = useState<"..." | "sim" | "nao">("...");

  // Construtor: acao + rede montam a fonte; o campo da fonte fica editavel
  // (para casos especiais como nome de atleta, ou -dodo no fim).
  const [acao, setAcao] = useState("bio");
  const [rede, setRede] = useState("ig");
  const [fonte, setFonte] = useState("bio-ig");
  const [campanha, setCampanha] = useState("lancamento");
  const [conteudo, setConteudo] = useState("");
  const [destino, setDestino] = useState("/criar-equipa");
  const [copiado, setCopiado] = useState(false);

  const [dias, setDias] = useState(30);
  const [aq, setAq] = useState<Aquisicao | null>(null);
  const [aCarregar, setACarregar] = useState(false);

  // Quando acao/rede mudam, recompoe a fonte sugerida (acao-rede).
  useEffect(() => {
    const sugestao = limpa(acao) + (rede ? `-${limpa(rede)}` : "");
    setFonte(sugestao);
  }, [acao, rede]);

  const token = useCallback(async (): Promise<string> => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || "";
  }, []);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user?.id;
      if (!uid) { if (vivo) setAcesso("nao"); return; }
      const { data: u } = await supabase.from("users").select("is_admin").eq("id", uid).maybeSingle();
      if (!vivo) return;
      setAcesso(u?.is_admin ? "sim" : "nao");
    })();
    return () => { vivo = false; };
  }, []);

  const carregarAquisicao = useCallback(async (d: number) => {
    setACarregar(true);
    try {
      const tk = await token();
      const r = await fetch(`/api/admin/aquisicao?dias=${d}`, { cache: "no-store", headers: { Authorization: `Bearer ${tk}` } });
      const j = await r.json();
      setAq(j as Aquisicao);
    } catch (e) {
      setAq({ ok: false, erro: "Falha de rede.", detalhe: e instanceof Error ? e.message : String(e) });
    } finally {
      setACarregar(false);
    }
  }, [token]);

  useEffect(() => {
    if (acesso === "sim") void carregarAquisicao(dias);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acesso]);

  // O utm_medium acompanha a acao (decorativo; o painel nao le o medium, mas
  // deixa o link arrumado para outras ferramentas, como o Meta/GA).
  const link = useMemo(() => {
    const path = destino.startsWith("/") ? destino : `/${destino}`;
    const p = new URLSearchParams();
    if (fonte) p.set("utm_source", limpa(fonte));
    if (acao) p.set("utm_medium", limpa(acao));
    if (campanha) p.set("utm_campaign", limpa(campanha));
    if (conteudo) p.set("utm_content", limpa(conteudo));
    const qs = p.toString();
    return `${BASE}${path === "/" ? "/" : path}${qs ? `?${qs}` : ""}`;
  }, [fonte, acao, campanha, conteudo, destino]);

  async function copiar() {
    try { await navigator.clipboard.writeText(link); setCopiado(true); setTimeout(() => setCopiado(false), 1500); } catch { /* sem clipboard */ }
  }

  if (acesso === "...") return <Moldura><p style={{ color: "#9a938c" }}>A carregar...</p></Moldura>;
  if (acesso === "nao") {
    return <Moldura><h1 style={{ color: GOLD, fontSize: 20, margin: 0 }}>Sem acesso</h1><p style={{ color: "#9a938c" }}>Esta pagina e so para administradores.</p></Moldura>;
  }

  return (
    <Moldura>
      <h1 style={{ color: GOLD, fontSize: 22, margin: "0 0 4px" }}>Links de marketing (UTM)</h1>
      <p style={{ color: "#c8c0b8", marginTop: 0, fontSize: 14, lineHeight: 1.5 }}>
        Cada link marca uma <b>acao</b> (bio, story, dm, trafego pago...) numa <b>rede</b>. Quando alguem cria
        conta por ele, a app grava de onde veio, e la em baixo ves qual acao trouxe mais gente.
      </p>

      {/* ---- Construtor ---- */}
      <div style={caixa}>
        <div style={titulo}>Construtor de links</div>
        <div style={{ display: "grid", gap: 12 }}>
          <Campo rot="Acao (o que voce fez)">
            <select value={acao} onChange={(e) => setAcao(e.target.value)} style={input}>
              {ACOES.map((a) => <option key={a.v} value={a.v}>{a.r}</option>)}
            </select>
          </Campo>
          <Campo rot="Rede (onde)">
            <select value={rede} onChange={(e) => setRede(e.target.value)} style={input}>
              {REDES.map((r) => <option key={r.v} value={r.v}>{r.r}</option>)}
            </select>
          </Campo>
          <Campo rot="Fonte final (utm_source) -- editavel: p/ atleta use o nome, p/ Dodo acrescente -dodo">
            <input value={fonte} onChange={(e) => setFonte(e.target.value)} style={input} />
          </Campo>
          <Campo rot="Assunto/criativo (utm_content) -- ex.: apresentacao-app, favoritos (opcional)">
            <input value={conteudo} onChange={(e) => setConteudo(e.target.value)} style={input} />
          </Campo>
          <Campo rot="Campanha (utm_campaign) -- a fase atual">
            <input value={campanha} onChange={(e) => setCampanha(e.target.value)} style={input} />
          </Campo>
          <Campo rot="Destino (para onde o link leva)">
            <select value={destino} onChange={(e) => setDestino(e.target.value)} style={input}>
              <option value="/criar-equipa">Montar equipa (/criar-equipa)</option>
              <option value="/inicio">Inicio / entrada suave (/inicio)</option>
              <option value="/">Raiz (/)</option>
              <option value="/dodo">Copa do Dodo (/dodo)</option>
              <option value="/comecar">Comecar (/comecar)</option>
              <option value="/ippon-pro">Ippon Pro (/ippon-pro)</option>
            </select>
          </Campo>
        </div>

        <div style={{ marginTop: 14, background: "#0e0c0b", border: `1px solid ${BORDA}`, borderRadius: 8, padding: "10px 12px", fontSize: 12.5, color: "#c8c0b8", wordBreak: "break-all" }}>
          {link}
        </div>
        <button onClick={copiar} style={{ marginTop: 10, background: GOLD, color: "#141110", border: "none", borderRadius: 10, padding: "11px 18px", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
          {copiado ? "Copiado!" : "Copiar link"}
        </button>
        <p style={{ fontSize: 11.5, color: "#8b8079", marginTop: 10, lineHeight: 1.5 }}>
          Regra: a <b>acao</b> + a <b>rede</b> montam a fonte (ex.: <b>bio-ig</b>, <b>story-ig</b>, <b>dm-ig</b>, <b>ads-tiktok</b>).
          O mesmo <b>utm_campaign</b> para a mesma fase (agora: <b>lancamento</b>). O <b>utm_content</b> so para separar o assunto do criativo.
          Tudo em minusculas, sem acentos nem espacos (o construtor ja limpa).
        </p>
      </div>

      {/* ---- Legenda ---- */}
      <div style={{ ...caixa, marginTop: 18 }}>
        <div style={titulo}>Como ler o relatorio</div>
        <div style={{ display: "grid", gap: 8, fontSize: 12.5, color: "#c8c0b8", lineHeight: 1.5 }}>
          <Leg termo="Registos (R)" txt="Contas criadas no periodo." />
          <Leg termo="Ativaram (A)" txt="Dessas, quantas montaram equipa. A % e sobre os registos daquela origem." />
          <Leg termo="Pro (P)" txt="Dessas, quantas viraram Pro." />
          <Leg termo="Diretas" txt="Chegaram SEM etiqueta: sem link UTM e sem site de origem. Inclui quem digitou o endereco, quem abriu pelo icone no telemovel, E boa parte do trafego de redes sociais/WhatsApp (o navegador interno delas apaga o rastro). Diretas alto normalmente e social sem etiqueta. Por isso usa-se sempre links UTM." />
          <Leg termo="Indicacao" txt="Vieram por convite de amigo (sistema de indicacao interno)." />
          <Leg termo="(referrer) ..." txt="Vieram de um site externo que linkou, mas sem UTM." />
          <Leg termo="Por fonte" txt="Agrupa por acao-rede (bio-ig, story-ig, ads-ig...). E aqui que ves qual ACAO rende mais." />
          <Leg termo="Por mensagem" txt="Quebra a fonte pelo assunto do criativo (fonte / utm_content)." />
          <Leg termo="Canal declarado" txt="O que a pessoa respondeu no 'Como nos conheceste?' ao criar a conta." />
        </div>
      </div>

      {/* ---- De onde vem ---- */}
      <div style={{ ...caixa, marginTop: 18 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div style={titulo}>Funil por origem (registo &rarr; ativou &rarr; pro)</div>
          <div style={{ display: "flex", gap: 6 }}>
            {[7, 30, 0].map((d) => (
              <button key={d} onClick={() => { setDias(d); void carregarAquisicao(d); }}
                style={{ background: dias === d ? GOLD : "transparent", color: dias === d ? "#141110" : GOLD, border: `1px solid ${GOLD}`, borderRadius: 8, padding: "6px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                {d === 0 ? "Sempre" : `${d}d`}
              </button>
            ))}
          </div>
        </div>

        {aCarregar && <p style={{ color: "#9a938c", fontSize: 13 }}>A carregar...</p>}
        {aq && !aq.ok && (
          <div style={{ marginTop: 10 }}>
            <p style={{ color: "#ef8d83", margin: 0, fontWeight: 700 }}>{aq.erro}</p>
            {aq.detalhe && <p style={{ color: "#9a938c", fontSize: 12 }}>{aq.detalhe}</p>}
            {aq.dica && <p style={{ color: "#9a938c", fontSize: 12 }}>{aq.dica}</p>}
          </div>
        )}
        {aq && aq.ok && (
          <div style={{ marginTop: 10 }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
              <Stat rot="Registos" val={String(aq.total ?? 0)} />
              <Stat rot="Ativaram" val={String(aq.resumo?.ativaram ?? 0)} sub={`${aq.resumo?.ativarPct ?? 0}%`} />
              <Stat rot="Pro" val={String(aq.resumo?.pro ?? 0)} sub={`${aq.resumo?.proPct ?? 0}%`} />
              <Stat rot="Diretas" val={String(aq.resumo?.diretos ?? 0)} />
              <Stat rot="Indicacao" val={String(aq.resumo?.comReferral ?? 0)} />
            </div>
            <p style={{ fontSize: 11, color: "#8b8079", margin: "0 0 4px", lineHeight: 1.5 }}>
              Cada linha: <b style={{ color: "#efeadd" }}>R</b> registos &rarr; <b style={{ color: "#8bd4b0" }}>A</b> ativaram (montaram equipa) &rarr; <b style={{ color: GOLD }}>P</b> pro. A % e sobre os registos dessa origem.
            </p>
            <Tabela titulo="Por fonte (acao-rede)" itens={aq.porFonte || []} />
            <Tabela titulo="Por campanha (utm_campaign)" itens={aq.porCampanha || []} />
            <Tabela titulo="Por fonte + campanha" itens={aq.porFonteCampanha || []} />
            <Tabela titulo="Por mensagem (fonte + utm_content)" itens={aq.porConteudo || []} />
            {aq.porDeclarada && aq.porDeclarada.length > 0 && (
              <Tabela titulo="Canal declarado (como nos conheceste)" itens={aq.porDeclarada} />
            )}
          </div>
        )}
      </div>
    </Moldura>
  );
}

const VERDE = "#8bd4b0";
function Tabela({ titulo, itens }: { titulo: string; itens: Item[] }) {
  if (itens.length === 0) return null;
  const max = Math.max(1, ...itens.map((i) => i.registos));
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 12, color: "#8b9a92", fontFamily: "var(--font-geist-mono), monospace", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 7 }}>{titulo}</div>
      <div style={{ display: "grid", gap: 8 }}>
        {itens.map((i) => {
          const pa = i.registos > 0 ? Math.round((i.ativaram / i.registos) * 100) : 0;
          const pp = i.registos > 0 ? Math.round((i.pro / i.registos) * 100) : 0;
          return (
            <div key={i.chave}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "baseline" }}>
                <div style={{ fontSize: 12.5, color: "#efeadd", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{i.chave}</div>
                <div style={{ fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>
                  <span style={{ color: "#efeadd" }}>{i.registos}R</span>
                  <span style={{ color: "#5f5850", fontWeight: 400 }}> &middot; </span>
                  <span style={{ color: VERDE }}>{i.ativaram}A</span>
                  <span style={{ color: "#6b7d73", fontWeight: 400, fontSize: 11 }}>({pa}%)</span>
                  <span style={{ color: "#5f5850", fontWeight: 400 }}> &middot; </span>
                  <span style={{ color: GOLD }}>{i.pro}P</span>
                  <span style={{ color: "#8b7a52", fontWeight: 400, fontSize: 11 }}>({pp}%)</span>
                </div>
              </div>
              {/* Barra empilhada: registos (base) com ativaram e pro por cima. */}
              <div style={{ position: "relative", height: 6, background: "#0e0c0b", borderRadius: 3, marginTop: 4, overflow: "hidden", width: `${Math.max(6, Math.round((i.registos / max) * 100))}%` }}>
                <div style={{ position: "absolute", inset: 0, background: "#2c2622" }} />
                <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: `${pa}%`, background: VERDE, opacity: 0.55 }} />
                <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: `${pp}%`, background: GOLD }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
function Stat({ rot, val, sub }: { rot: string; val: string; sub?: string }) {
  return (
    <div style={{ background: "#0e0c0b", border: `1px solid ${BORDA}`, borderRadius: 10, padding: "8px 12px", minWidth: 72 }}>
      <div style={{ fontSize: 18, fontWeight: 700, color: "#efeadd" }}>
        {val}{sub ? <span style={{ fontSize: 12, color: "#8b8079", fontWeight: 400 }}> {sub}</span> : null}
      </div>
      <div style={{ fontSize: 11, color: "#8b8079" }}>{rot}</div>
    </div>
  );
}
function Leg({ termo, txt }: { termo: string; txt: string }) {
  return (
    <div>
      <b style={{ color: "#efeadd" }}>{termo}:</b> {txt}
    </div>
  );
}
function Campo({ rot, children }: { rot: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column" }}>
      <span style={{ fontSize: 12.5, color: "#9a938c", marginBottom: 5 }}>{rot}</span>
      {children}
    </label>
  );
}
function Moldura({ children }: { children: React.ReactNode }) {
  return (
    <main style={{ minHeight: "100vh", background: FUNDO, padding: "28px 16px" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>{children}</div>
    </main>
  );
}
const caixa: React.CSSProperties = { background: CARTAO, border: `1px solid ${BORDA}`, borderRadius: 12, padding: 16, marginTop: 14 };
const titulo: React.CSSProperties = { fontFamily: "var(--font-geist-mono), monospace", fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: GOLD, marginBottom: 12 };
const input: React.CSSProperties = { background: "#0e0c0b", border: `1px solid ${BORDA}`, borderRadius: 8, padding: "10px 12px", color: "#efeadd", fontSize: 15, width: "100%" };
