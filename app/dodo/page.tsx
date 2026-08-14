"use client";
// app/dodo/page.tsx
//
// A COPA DO DÔDO — regras, contagem por continente, inscrição.
//
// ---------------------------------------------------------------------------
// A VERDADE VEM DO SERVIDOR
//
// Quem pode inscrever-se é decidido em /api/dodo, que lê a tabela `users`. Este
// ecrã limita-se a desenhar o que o servidor respondeu em `eu` — nunca decide
// por conta própria que alguém pode inscrever-se. O useNivel só serve para
// escolher o convite certo (não mostrar "passa a Pro" a quem já é Pro).
//
// ---------------------------------------------------------------------------
// O GET PRECISA DO TOKEN
//
// Sem o cabeçalho Authorization, a rota devolve `eu: null` e o ecrã fica sem
// saber se a pessoa já se inscreveu. É por isso que se busca a sessão antes de
// cada pedido, no GET e no POST.
//
// ---------------------------------------------------------------------------
// ESTADOS QUE ESTA PÁGINA MOSTRA
//
// sem edição — 'preparada' não é devolvida pela rota: ninguém a vê.
// As REGRAS aparecem à mesma: quem chega aqui entre edições
// tem de perceber o que é a Copa e o que precisa para entrar,
// senão a página só diz "volta depois" e não convence ninguém.
// inscricoes — inscrições abertas, com contagem decrescente.
// sorteada — o sorteio já correu; cada um vê se entrou.
// a_decorrer — a chave está a ser jogada.
// ---------------------------------------------------------------------------
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { NOME_CONTINENTE, continenteDoPais, type Continente } from "@/lib/continentes";
import { useNivel } from "@/lib/useNivel";
import { TrofeuDodo } from "@/components/TrofeuDodo";
// A barra inferior deixou de estar copiada em cada página. Vive uma vez em
// components/BarraInferior.tsx, e é lá que o separador Pro pulsa a dourado
// para quem tem Pro e ainda não visitou a área.
import { BarraInferior } from "@/components/BarraInferior";
import {
  BlocoChave,
  CaixaConfronto,
  CaixaBye,
  useEmDestaque,
  type NoChave,
  type Aresta,
  type LadoCaixa,
} from "@/components/Chave";
import { useT } from "@/lib/i18n";
const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";
const VERDE = "#3f8f5a";
interface EuEstado {
  inscrito: boolean;
  sorteada: boolean | null;
  podeInscrever: boolean;
  motivo?: string;
}
/** A edição que está a RECEBER INSCRIÇÕES. */
interface EdicaoInscricoes {
  id: string;
  numero: number;
  ano: number | null;
  estado: string;
  nome: string;
  inscricoes_ate: string | null;
  aberta: boolean;
  inscritos: number;
  porContinente: Record<string, number>;
  eu: EuEstado | null;
}
/** A edição que está a SER JOGADA. */
interface EdicaoDecorrer {
  id: string;
  numero: number;
  ano: number | null;
  estado: string;
  nome: string;
  league_id: string | null;
  invite_code: string | null;
  /** Fui sorteado para esta chave? */
  naChave: boolean;
}
interface Resposta {
  ok: boolean;
  // As duas edições podem coexistir: uma a jogar-se e outra a receber inscritos.
  aDecorrer?: EdicaoDecorrer | null;
  inscricoes?: EdicaoInscricoes | null;
  // Quando não há nenhuma visível, a data em que a próxima abre (se conhecida).
  abre_em?: string | null;
  vagasPorContinente?: number;
  totalVagas?: number;
  nota?: string;
}
function dois(n: number): string {
  return String(n).padStart(2, "0");
}
/** Tempo que falta até fecharem as inscrições. null quando já fechou. */
function contagem(ate: string | null | undefined, agora: number): string | null {
  if (!ate) return null;
  const ms = Date.parse(String(ate)) - agora;
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const seg = s % 60;
  if (d > 0) return `${d}d ${dois(h)}h ${dois(m)}m`;
  return `${dois(h)}:${dois(m)}:${dois(seg)}`;
}
function dataCurta(iso: string | null | undefined): string {
  if (!iso) return "";
  const t = Date.parse(String(iso));
  if (!Number.isFinite(t)) return "";
  return new Date(t).toLocaleDateString("pt-PT", { day: "2-digit", month: "long" });
}
async function tokenDaSessao(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}
export default function Dodo() {
  const t = useT();
  const [dados, setDados] = useState<Resposta | null>(null);
  const [aCarregar, setACarregar] = useState(true);
  const [aEnviar, setAEnviar] = useState(false);
  const [erro, setErro] = useState("");
  const [erroEhPro, setErroEhPro] = useState(false);
  const [confirmarSaida, setConfirmarSaida] = useState(false);
  // Com uma chave no ecrã, as regras deixam de estar abertas por baixo dela:
  // são doze parágrafos que empurram a chave para o fundo da página e fazem o
  // ecrã parecer um folheto. Ficam atrás de um link, e quem quiser abre.
  const [verComoFunciona, setVerComoFunciona] = useState(false);
  const [verContinentes, setVerContinentes] = useState(false);
  // Escape fecha a janela. Numa janela que cobre o ecrã inteiro, não ter saída
  // pelo teclado é das coisas que mais irrita.
  useEffect(() => {
      if (!verComoFunciona) return;
      const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setVerComoFunciona(false); };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, [verComoFunciona]);
  const [temSessao, setTemSessao] = useState<boolean | null>(null);
  const [meuContinente, setMeuContinente] = useState<Continente | null>(null);
  const [agora, setAgora] = useState(() => Date.now());
  // ehPro é true para Pro E Pro Max (níveis cumulativos).
  const { ehPro: souPro, pronto: nivelPronto } = useNivel();
  // O relógio da contagem decrescente.
  useEffect(() => {
      const id = setInterval(() => setAgora(Date.now()), 1000);
      return () => clearInterval(id);
    }, []);
  const carregar = useCallback(async () => {
      try {
        const t = await tokenDaSessao();
        setTemSessao(!!t);
        const res = await fetch("/api/dodo", {
            cache: "no-store",
            headers: t ? { Authorization: `Bearer ${t}` } : {},
        });
        const j = (await res.json()) as Resposta;
        setDados(j);
      } catch {
        setDados({ ok: false, aDecorrer: null, inscricoes: null });
      }
      setACarregar(false);
    }, []);
  useEffect(() => {
      carregar();
      // O continente vem do país gravado no registo — o mesmo caminho que a
      // página de ligas usa para a liga continental.
      (async () => {
          try {
            const { data } = await supabase.auth.getSession();
            const meta = data.session?.user?.user_metadata as { pais_iso?: string } | undefined;
            setMeuContinente(continenteDoPais(meta?.pais_iso));
          } catch {}
      })();
    }, [carregar]);
  async function acao(qual: "inscrever" | "sair") {
    setErro("");
    setErroEhPro(false);
    setAEnviar(true);
    try {
      const tok = await tokenDaSessao();
      if (!tok) {
        window.location.href = "/entrar?voltar=/dodo";
        return;
      }
      const res = await fetch("/api/dodo", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
          body: JSON.stringify({ acao: qual }),
      });
      const j = (await res.json()) as { ok?: boolean; erro?: string; precisaPro?: boolean };
      if (!j.ok) {
        setErro(j.erro || t("dd.naoConcluir"));
        setErroEhPro(!!j.precisaPro);
        setAEnviar(false);
        return;
      }
      await carregar();
    } catch {
      setErro(t("dd.falhaLigacao"));
    }
    setAEnviar(false);
  }
  const insc = dados?.inscricoes ?? null;
  const jogo = dados?.aDecorrer ?? null;
  const eu = insc?.eu ?? null;
  const vagasCont = dados?.vagasPorContinente ?? 6;
  const totalVagas = dados?.totalVagas ?? 32;
  const restam = contagem(insc?.inscricoes_ate, agora);
  // O continente com mais inscritos. É a régua das barras: cada uma mede-se
  // contra a maior, não contra o número de vagas. Uma barra que enchia até 6
  // dizia "restam 4 lugares" — a ideia de corrida que o sorteio existe para
  // eliminar. Aqui a barra responde à pergunta certa: onde é mais disputado.
  const maiorContinente = Math.max(1, ...Object.values(insc?.porContinente ?? {}).map((v) => Number(v) || 0));
  const aberta = !!insc?.aberta && !!restam;
  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: FB }}>
    <div style={{ maxWidth: 460, margin: "0 auto", padding: "14px 14px 84px" }}>
    <header style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
    <a href="/ligas" aria-label={t("dd.voltarCompeticoes")} style={{ width: 34, height: 34, borderRadius: "50%", border: "1px solid #243029", display: "flex", alignItems: "center", justifyContent: "center", color: "#cfd8d2", textDecoration: "none", flexShrink: 0 }}>
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
    </a>
    <h1 style={{ fontFamily: FD, fontSize: 19, fontWeight: 700, textTransform: "uppercase", margin: 0 }}>{t("dd.titulo")}</h1>
    </header>
    {aCarregar ? (
        <div style={{ textAlign: "center", padding: "40px 0", color: "#7c8a82", fontFamily: FD, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.1em" }}>{t("comum.carregando")}</div>
      ) : !insc && !jogo ? (
        <SemEdicao abreEm={dados?.abre_em ?? null} agora={agora} />
      ) : (
        <>
        {/* ---- A EDIÇÃO ABERTA A INSCRIÇÕES ----
          Vem em primeiro porque é a que pede uma ação. A Copa que está a
          decorrer fica logo a seguir: quem já está a jogar sabe onde ela
          está, quem chega de novo precisa de ver primeiro como entrar. */}
        {insc && (
            <>
            <div style={{ background: "linear-gradient(160deg,#17201b,#111614)", border: `1px solid ${aberta ? "#4a3f18" : "#243029"}`, borderRadius: 16, padding: "20px 16px 18px", marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
            <TrofeuDodo size={108} numero={`${insc.numero}ª`} titulo={`Troféu da ${insc.numero}ª Copa do Dôdo`} />
            </div>
            <div style={{ textAlign: "center" }}>
            <Selo estado={insc.estado} aberta={aberta} />
            <div style={{ fontFamily: FD, fontSize: 17, fontWeight: 700, lineHeight: 1.3, margin: "10px 0 4px", color: "#f1ede2" }}>
            {insc.numero}ª Copa do Dôdo
            </div>
            <div style={{ fontSize: 12.5, color: "#93a39a", lineHeight: 1.5 }}>
            {t("dd.subtituloMundial", { ano: insc.ano || new Date().getFullYear() })}
            </div>
            </div>
            {aberta && restam && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #243029", display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
                <div>
                <div style={{ fontSize: 10.5, color: "#93a39a", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>{t("dd.inscricoesFechamEm")}</div>
                <div style={{ fontFamily: FD, fontSize: 22, fontWeight: 700, color: GOLD, lineHeight: 1 }}>{restam}</div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontFamily: FD, fontSize: 16, fontWeight: 700, color: "#f1ede2", lineHeight: 1 }}>{insc.inscritos}</div>
                <div style={{ fontSize: 10, color: "#93a39a", textTransform: "uppercase", marginTop: 3 }}>inscritos · {totalVagas} vagas</div>
                </div>
                </div>
            )}
            {!aberta && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #243029", fontSize: 12.5, color: "#c7d0c9", lineHeight: 1.5 }}>
                {t("dd.sorteioCorreASeguir")}
                </div>
            )}
            </div>
            <MeuEstado
            eu={eu}
            temSessao={temSessao}
            souPro={souPro}
            nivelPronto={nivelPronto}
            aberta={aberta}
            aEnviar={aEnviar}
            dataSorteio={insc.inscricoes_ate}
            onInscrever={() => acao("inscrever")}
            onSair={() => setConfirmarSaida(true)}
            />
            {erro && (
                erroEhPro ? (
                  <a href="/ippon-pro" style={{ display: "block", fontSize: 12.5, color: GOLD, marginTop: 10, textDecoration: "none", background: "#2a2410", border: "1px solid #5a4a18", borderRadius: 10, padding: "10px 12px", lineHeight: 1.4 }}>{erro} →</a>
                ) : (
                  <div style={{ fontSize: 12, color: "#ef8d83", marginTop: 10 }}>{erro}</div>
                )
            )}
            </>
        )}
        {/* ---- A COPA QUE ESTÁ A DECORRER ---- */}
        {jogo && <CopaADecorrer jogo={jogo} compacta={!!insc} />}
        {/* ---- Continentes: acordeão, não uma lista sempre aberta ----
          Cinco linhas de estatística entre a inscrição e a chave afastam uma
          da outra. Quem quer saber onde a vaga está mais disputada abre; quem
          vem ver a chave não tropeça nisto. */}
        {insc && (
            <>
            <button
            onClick={() => setVerContinentes((v) => !v)}
            style={{ width: "100%", marginTop: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: "#121815", border: "1px solid #243029", borderRadius: 12, padding: "12px 14px", cursor: "pointer", textAlign: "left" }}
            >
            <span>
            <span style={{ display: "block", fontFamily: FD, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#cfd8d2" }}>
            {t("dd.ondeConcorrencia")}
            </span>
            <span style={{ display: "block", fontSize: 11, color: "#7c8a82", marginTop: 2 }}>
            {t("dd.inscritosVagas", { i: insc.inscritos, v: vagasCont })}
            </span>
            </span>
            <span style={{ flexShrink: 0, color: "#7c8a82", fontSize: 16, transform: verContinentes ? "rotate(180deg)" : "none", transition: "transform .15s" }}>⌄</span>
            </button>
            {verContinentes && (
                <div style={{ marginTop: 10 }}>
                <p style={{ fontSize: 12, color: "#7c8a82", margin: "0 0 12px", lineHeight: 1.5 }}>
                {t("dd.deCadaContinente", { v: vagasCont })}
                </p>
                {(Object.keys(NOME_CONTINENTE) as Continente[]).map((c) => {
                      const n = insc.porContinente?.[c] ?? 0;
                      return (
                        <LinhaContinente
                        key={c}
                        nome={t("cont." + c)}
                        n={n}
                        maior={maiorContinente}
                        meu={meuContinente === c}
                        />
                      );
                })}
                </div>
            )}
            </>
        )}
        </>
    )}
    {/* --- A CHAVE ---
      Aparece assim que o sorteio corre, e é visível a TODA A GENTE: quem não
      é Pro não pode disputar, mas vê quem enfrenta quem. É a melhor angariação
      que a página tem — ver a chave dá vontade de estar nela.
      Desenhada pelo components/Chave.tsx, o mesmo do /chave-atletas. Uma
      chave deve ter sempre o mesmo aspeto, seja de atletas ou de equipas. */}
    {/* O botão das regras existe SEMPRE, mesmo sem edição a decorrer: quem
      chega aqui entre Copas tem de sair a saber o que isto é. Antes as
      regras estavam sempre abertas por baixo; agora estão a um toque. */}
    {!aCarregar && !jogo?.league_id && (
        <button
        onClick={() => setVerComoFunciona(true)}
        style={{ marginTop: 20, background: "transparent", border: "1px solid #2a3a33", color: "#9fb0a7", fontFamily: FD, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", padding: "9px 14px", borderRadius: 999, cursor: "pointer" }}
        >
        {t("dd.comoFuncionaCopa")}
        </button>
    )}
    {!aCarregar && jogo?.league_id && (
        <>
        {/* DOIS BOTÕES, por cima da chave.
          O primeiro abre as regras, que deixaram de estar empilhadas por
          baixo — com uma chave no ecrã, doze parágrafos empurram-na para o
          fundo da página.
          O segundo inscreve na edição SEGUINTE, e só aparece a quem
          realmente pode: o `podeInscrever` vem do servidor. Quem está a
          disputar esta Copa está bloqueado da seguinte por desenho (o ciclo
            faz saltar uma edição a quem joga), e a esses mostra-se o motivo em
          vez de um botão que ia ser recusado. Prometer o que não se cumpre é
          pior do que não oferecer. */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 9, marginTop: 20, alignItems: "center" }}>
        <button
        onClick={() => setVerComoFunciona(true)}
        style={{ background: "transparent", border: "1px solid #2a3a33", color: "#9fb0a7", fontFamily: FD, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", padding: "9px 14px", borderRadius: 999, cursor: "pointer" }}
        >
        {t("dd.comoFuncionaCopa")}
        </button>
        {insc && aberta && eu?.podeInscrever && !eu?.inscrito && (
            <button
            onClick={() => acao("inscrever")}
            disabled={aEnviar}
            style={{ background: GOLD, border: "none", color: "#1b211e", fontFamily: FD, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", padding: "9px 16px", borderRadius: 999, cursor: aEnviar ? "default" : "pointer", opacity: aEnviar ? 0.6 : 1 }}
            >
            {aEnviar ? t("dd.aInscrever") : t("dd.inscreverMeNa", { n: insc.numero })}
            </button>
        )}
        {insc && aberta && eu?.inscrito && (
            <span style={{ fontFamily: FD, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: VERDE, padding: "9px 4px" }}>
            {t("dd.inscritoNa", { n: insc.numero })}
            </span>
        )}
        {insc && aberta && eu && !eu.podeInscrever && !eu.inscrito && eu.motivo && (
            <span style={{ fontSize: 11.5, color: "#7c8a82", lineHeight: 1.45, padding: "4px 2px", flexBasis: "100%" }}>
            {eu.motivo}
            </span>
        )}
        </div>
        <ChaveDaCopa leagueId={jogo.league_id} numero={jogo.numero} />
        </>
    )}
    {/* --- REGRAS --- Fora do ramo da edição de propósito: quem chega aqui
      entre Copas tem de sair a saber o que é, quem pode entrar e como se
      joga. Uma página que só diz t("dd.semEdicao") não angaria ninguém.
      MAS com uma chave sorteada no ecrã, a ação principal passa a ser vê-la.
      Aí as regras recolhem-se para trás do "Como funciona", logo por cima da
      chave, e só aparecem a quem as pedir. */}
    </div>
    {/* Confirmação de saída. */}
    {confirmarSaida && (
        <div onClick={() => setConfirmarSaida(false)} style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }}>
        <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 360, background: "#121815", border: "1px solid #2a3a33", borderRadius: 16, padding: "20px 18px" }}>
        <div style={{ fontFamily: FD, fontSize: 15, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", color: "#f1ede2", textAlign: "center", marginBottom: 10 }}>{t("dd.sairDaCopa")}</div>
        <p style={{ fontSize: 13, color: "#c7d0c9", lineHeight: 1.55, textAlign: "center", margin: "0 0 16px" }}>
        {t("dd.perdesLugar")}
        </p>
        <div style={{ display: "flex", gap: 9 }}>
        <button onClick={() => setConfirmarSaida(false)} style={{ flex: 1, background: "transparent", border: "1px solid #2a3a33", color: "#cfd8d2", fontFamily: FD, fontWeight: 700, textTransform: "uppercase", fontSize: 12, padding: "11px 0", borderRadius: 10, cursor: "pointer" }}>{t("dd.ficar")}</button>
        <button onClick={() => { setConfirmarSaida(false); acao("sair"); }} style={{ flex: 1, background: "#4a2420", border: "1px solid #6d3630", color: "#ef8d83", fontFamily: FD, fontWeight: 700, textTransform: "uppercase", fontSize: 12, padding: "11px 0", borderRadius: 10, cursor: "pointer" }}>{t("dd.sair")}</button>
        </div>
        </div>
        </div>
    )}
    {/* --- COMO FUNCIONA: JANELA AO CENTRO ---
      Estava por baixo da chave, no fluxo da página. Com uma chave de 32 isso
      significa abrir um texto que fica a três ecrãs de distância de quem
      carregou no botão — ou seja, não abrir nada.
      Ao centro, por cima de tudo, a resposta aparece onde a pergunta foi
      feita. Fecha-se no X, no fundo escuro ou com Escape. */}
    {verComoFunciona && (
        <div
        onClick={() => setVerComoFunciona(false)}
        style={{ position: "fixed", inset: 0, zIndex: 120, background: "rgba(0,0,0,0.72)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "24px 14px", overflowY: "auto" }}
        >
        <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 460, background: "#0f1411", border: "1px solid #2a3a33", borderRadius: 16, padding: "16px 16px 22px", margin: "auto 0" }}
        >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 6, position: "sticky", top: 0, background: "#0f1411", paddingBottom: 8 }}>
        <span style={{ fontFamily: FD, fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#f1ede2" }}>
        {t("dd.comoFuncionaCopa")}
        </span>
        <button
        onClick={() => setVerComoFunciona(false)}
        aria-label="Fechar"
        style={{ flexShrink: 0, width: 30, height: 30, borderRadius: "50%", border: "1px solid #2a3a33", background: "transparent", color: "#cfd8d2", cursor: "pointer", fontSize: 14, lineHeight: 1 }}
        >
        ✕
        </button>
        </div>
        <Regras vagasCont={vagasCont} totalVagas={totalVagas} />
        </div>
        </div>
    )}
    <BarraInferior ativo="ligas" />
    </main>
  );
}
// ---------------------------------------------------------------------------
// Blocos
// ---------------------------------------------------------------------------
// Sem edição visível. A rota esconde de propósito as edições 'preparada' — por
// isso este é o estado normal entre Copas, não uma avaria.
//
// `abreEm` ainda não vem da rota. Quando vier, esta caixa passa sozinha a
// mostrar a data e a contagem para a abertura das inscrições.
function SemEdicao({ abreEm, agora }: { abreEm: string | null; agora: number }) {
  const t = useT();
  const falta = contagem(abreEm, agora);
  return (
    <div style={{ background: "#121815", border: "1px dashed #2a3a33", borderRadius: 16, padding: "26px 18px", textAlign: "center" }}>
    {/* O troféu fica à vista mesmo sem Copa aberta: é o símbolo, não um prémio
      que só existe quando há edição. */}
    <div style={{ display: "flex", justifyContent: "center", marginBottom: 14, opacity: 0.5 }}>
    <TrofeuDodo size={92} />
    </div>
    <div style={{ fontFamily: FD, fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "#cfd8d2", marginBottom: 8 }}>
    {falta ? t("dd.inscricoesAbremBreve") : t("dd.semCopaAberta")}
    </div>
    {falta && abreEm ? (
        <>
        <div style={{ fontFamily: FD, fontSize: 24, fontWeight: 700, color: GOLD, lineHeight: 1, margin: "6px 0 6px" }}>{falta}</div>
        <p style={{ fontSize: 12.5, color: "#93a39a", lineHeight: 1.55, margin: "0 0 16px" }}>
        {t("dd.abremA", { data: dataCurta(abreEm) })}
        </p>
        </>
      ) : (
        <p style={{ fontSize: 13, color: "#93a39a", lineHeight: 1.55, margin: "0 0 16px" }}>
        {t("dd.proximaEdicaoInscricoes")}
        </p>
    )}
    </div>
  );
}
// As regras completas. Aparecem SEMPRE, com ou sem edição aberta.
//
// Descrevem o que o código faz HOJE: eliminação simples, um bronze. O modelo com
// repescagem em cadeia e dois bronzes existe em lib/copa.ts mas ainda não está
// ligado ao apuramento — quando estiver, os pontos 6 e 7 têm de ser reescritos.
function Regras({ vagasCont, totalVagas }: { vagasCont: number; totalVagas: number }) {
  const t = useT();
  return (
    <>
    {/* Quem pode entrar. Uma caixa só, e curta: é a condição que faz a pessoa
      perceber num segundo se isto é para ela. */}
    <Section style={{ marginTop: 22 }}>{t("dd.quemPodeEntrar")}</Section>
    <div style={{ background: "#2a2410", border: "1px solid #5a4a18", borderRadius: 14, padding: "14px 15px" }}>
    <div style={{ fontFamily: FD, fontSize: 13, fontWeight: 700, color: GOLD, marginBottom: 7 }}>{t("dd.soMembrosPro")}</div>
    <p style={{ fontSize: 12.5, color: "#c7b98f", lineHeight: 1.55, margin: "0 0 9px" }}>
    {t("dd.regraPro1")}
    </p>
    <p style={{ fontSize: 12.5, color: "#c7b98f", lineHeight: 1.55, margin: 0 }}>
    {t("dd.regraPro2", { totalVagas })}
    </p>
    </div>
    {/* Curto e em vermelho, porque com subscrição mensal isto deixou de ser
      uma hipótese remota: basta alguém cancelar depois do primeiro mês para
      sair a meio de uma Copa que ainda vai a meio. */}
    <div style={{ background: "#241614", border: "1px solid #5c332c", borderRadius: 14, padding: "12px 15px", marginTop: 9 }}>
    <div style={{ fontFamily: FD, fontSize: 12, fontWeight: 700, color: "#ef8d83", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 6 }}>{t("dd.seSubscricaoAcabar")}</div>
    <p style={{ fontSize: 12.5, color: "#d6b3ad", lineHeight: 1.55, margin: 0 }}>
    {t("dd.regraSubAcaba")}
    </p>
    </div>
    <Section style={{ marginTop: 20 }}>{t("dd.vagasSorteio")}</Section>
    <div style={{ background: "#121815", border: "1px solid #243029", borderRadius: 14, padding: "14px 15px" }}>
    <Regra n="1" titulo={t("dd.regra1Titulo", { v: vagasCont })}>
    {t("dd.regra1", { v: vagasCont })}
    </Regra>
    <Regra n="2" titulo={t("dd.concorresPeloContinente")}>
    {t("dd.regra2")}
    </Regra>
    <Regra n="3" titulo={t("dd.vagasRedistribuidas")}>
    {t("dd.regra3", { totalVagas })}
    </Regra>
    <Regra n="4" titulo={t("dd.entradaPorSorteio")} ultima>
    {t("dd.regra4")}
    </Regra>
    </div>
    <Section style={{ marginTop: 20 }}>{t("dd.comoSeJoga")}</Section>
    <div style={{ background: "#121815", border: "1px solid #243029", borderRadius: 14, padding: "14px 15px" }}>
    <Regra n="5" titulo={t("dd.cadaRondaCompeticao")}>
    {t("dd.regra5")}
    </Regra>
    <Regra n="6" titulo={t("dd.quemPontuaAvanca")}>
    {t("dd.regra6")}
    </Regra>
    <Regra n="7" titulo={t("dd.jogaSeComQuemEstiver")}>
    {t("dd.regra7")}
    </Regra>
    <Regra n="8" titulo={t("dd.repescagemDoisTerceiros")}>
    {t("dd.regra8")}
    </Regra>
    <Regra n="9" titulo={t("dd.finalSomaAteFim")} ultima>
    {t("dd.regra9")}
    </Regra>
    </div>
    <p style={{ fontSize: 11.5, color: "#6f7d76", lineHeight: 1.6, margin: "14px 2px 0" }}>
    {t("dd.regrasAjustadas")}
    </p>
    </>
  );
}
function Selo({ estado, aberta }: { estado: string; aberta: boolean }) {
  const t = useT();
  let texto = t("dd.inscricoes");
  let cor = GOLD;
  let fundo = "#2a2410";
  let borda = "#5a4a18";
  if (estado === "inscricoes" && aberta) {
    texto = t("pl.inscricoesAbertas");
    cor = "#7fd39b";
    fundo = "#15271c";
    borda = "#2c4a36";
  } else if (estado === "inscricoes") {
    texto = t("pl.inscricoesFechadas");
    cor = "#93a39a";
    fundo = "#161c19";
    borda = "#243029";
  } else if (estado === "sorteada") {
    texto = t("dd.sorteioFeito");
  } else if (estado === "a_decorrer") {
    texto = t("dd.aDecorrer");
  }
  return (
    <span style={{ display: "inline-block", background: fundo, border: `1px solid ${borda}`, color: cor, fontFamily: FD, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", padding: "4px 9px", borderRadius: 999 }}>{texto}</span>
  );
}
// ---------------------------------------------------------------------------
// A CHAVE DA COPA
//
// Vai buscar os confrontos a /api/copa/chave e desenha-os com o mesmo
// componente do /chave-atletas. Visível a toda a gente, inclusive a quem não
// pode disputar: ver a chave é o melhor convite que esta página tem.
//
// A ÁRVORE. Os confrontos vêm em lista, com `ronda` e `ordem`. A regra de
// reconstrução é a de qualquer mata-mata: o confronto (r, o) é alimentado
// pelos confrontos (r-1, 2o) e (r-1, 2o+1). A partir daí, as ligações saem
// sozinhas e o desenho trata do resto.
//
// Um confronto sem `jogador_b` é uma passagem automática — acontece quando os
// inscritos não enchem a chave.
// ---------------------------------------------------------------------------
interface IdentidadeChave {
  user_id: string;
  nome_time: string;
  escudo: unknown;
  continente: string | null;
  pais: string | null;
}
interface ConfrontoChave {
  id: string;
  ronda: number;
  ordem: number;
  fase: string;
  jogador_a: string | null;
  jogador_b: string | null;
  pontos_a: number | null;
  pontos_b: number | null;
  vencedor: string | null;
  decidido_por: string | null;
  estado: string;
}
function ChaveDaCopa({ leagueId, numero }: { leagueId: string; numero: number }) {
  const t = useT();
  const [confrontos, setConfrontos] = useState<ConfrontoChave[]>([]);
  const [identidades, setIdentidades] = useState<Record<string, IdentidadeChave>>({});
  const [totalRondas, setTotalRondas] = useState(0);
  const [aLer, setALer] = useState(true);
  useEffect(() => {
      let vivo = true;
      (async () => {
          try {
            const res = await fetch(`/api/copa/chave?id=${encodeURIComponent(leagueId)}`);
            const j = await res.json();
            if (!vivo) return;
            setConfrontos(Array.isArray(j.confrontos) ? j.confrontos : []);
            setIdentidades(j.identidades || {});
            setTotalRondas(Number(j.totalRondas) || 0);
          } catch {
            /* sem chave: a secção não aparece */
          } finally {
            if (vivo) setALer(false);
          }
      })();
      return () => { vivo = false; };
    }, [leagueId]);
  if (aLer || confrontos.length === 0) return null;
  // Constrói a árvore a partir de (ronda, ordem).
  //
  // DE CIMA PARA BAIXO, e não a partir do que existe. Uma chave só parece uma
  // chave quando se vê o caminho todo até à final — mesmo antes de os
  // confrontos das rondas seguintes serem criados.
  //
  // A base de dados só grava um confronto quando os dois lados são conhecidos.
  // Por isso, os lugares que ainda não existem são desenhados na mesma, vazios:
  // é o afunilamento que dá forma à árvore.
  function montar(lista: ConfrontoChave[], rondas: number): { arvores: NoChave[]; arestas: Aresta[] } {
    const porRondaOrdem = new Map<string, ConfrontoChave>();
    for (const c of lista) porRondaOrdem.set(`${c.ronda}:${c.ordem}`, c);
    const arestas: Aresta[] = [];
    const topo = Math.max(rondas, ...lista.map((c) => c.ronda));
    function no(r: number, o: number): NoChave {
      const existente = porRondaOrdem.get(`${r}:${o}`);
      const key = existente ? existente.id : `vazio:${r}:${o}`;
      // Passagem automática: um lado só, sem nada a alimentá-la.
      if (existente && !existente.jogador_b && existente.decidido_por === "bye") {
        return { tipo: "bye", key, dados: existente };
      }
      // A primeira ronda é o fim da descida: ninguém a alimenta.
      const filhos: NoChave[] = [];
      if (r > 1) {
        for (const oi of [o * 2, o * 2 + 1]) {
          const f = no(r - 1, oi);
          filhos.push(f);
          arestas.push({ de: f.key, para: key });
        }
      }
      return { tipo: "luta", key, dados: existente ?? null, filhos };
    }
    // O topo tem um confronto (a final). Cada ronda abaixo tem o dobro.
    const nRaizes = topo >= 1 ? 1 : 0;
    const raizes: NoChave[] = [];
    for (let i = 0; i < nRaizes; i++) raizes.push(no(topo, i));
    return { arvores: raizes, arestas };
  }
  // A chave principal e a repescagem são blocos separados, como no judo.
  const principais = confrontos.filter((c) => c.fase === "normal");
  const outros = confrontos.filter((c) => c.fase !== "normal");
  const bloco1 = montar(principais, totalRondas);
  const bloco2 = outros.length > 0 ? montar(outros, 0) : null;
  // O próximo confronto por decidir: é o que ganha o ponto verde.
  const proximo = confrontos.find((c) => c.estado !== "decidido")?.id ?? null;
  function ladoDe(uid: string | null, pts: number | null, venceu: boolean): LadoCaixa {
    if (!uid) return { titulo: "—", vazio: true };
    const i = identidades[uid];
    return {
      titulo: i?.nome_time || t("res.equipa"),
      // O continente é o que dá sentido a uma Copa "entre continentes".
      subtitulo: [i?.continente, i?.pais].filter(Boolean).join(" · ") || null,
      resultado: pts == null ? null : String(pts),
      vencedor: venceu,
    };
  }
  function Caixa({ no }: { no: NoChave }) {
    const c = no.dados as ConfrontoChave | null;
    const emDestaque = useEmDestaque(no.key);
    // Lugar por preencher: a ronda ainda não chegou aqui. Desenha-se na mesma,
    // porque é o que mostra o caminho que falta até à final.
    if (!c) {
      return <CaixaConfronto a={{ titulo: "—", vazio: true }} b={{ titulo: "—", vazio: true }} />;
    }
    const decidida = c.estado === "decidido" && !!c.vencedor;
    if (no.tipo === "bye") {
      return <CaixaBye lado={ladoDe(c.jogador_a, null, false)} />;
    }
    return (
      <CaixaConfronto
      a={ladoDe(c.jogador_a, c.pontos_a, c.vencedor === c.jogador_a)}
      b={ladoDe(c.jogador_b, c.pontos_b, c.vencedor === c.jogador_b)}
      decidida={decidida}
      emDestaque={emDestaque}
      />
    );
  }
  return (
    <div style={{ marginTop: 22 }}>
    <div style={{ fontFamily: FD, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: GOLD }}>
    {numero}ª Copa do Dôdo · {t("dd.aChave")}
    </div>
    <BlocoChave
    titulo={t("chave.principal")}
    arvores={bloco1.arvores}
    arestas={bloco1.arestas}
    destaque={proximo}
    renderCaixa={(no) => <Caixa no={no} />}
    textoVazio={t("dd.chaveSorteadaQuando")}
    />
    {bloco2 && (
        <BlocoChave
        titulo={t("chave.repescagem")}
        arvores={bloco2.arvores}
        arestas={bloco2.arestas}
        destaque={proximo}
        renderCaixa={(no) => <Caixa no={no} />}
        />
    )}
    </div>
  );
}
// O cartão da Copa que está a ser jogada. Quando há inscrições abertas em cima,
// vem em versão compacta — nesse ecrã a ação principal é inscrever-se, e um
// segundo cartão do mesmo tamanho competia com ela pela atenção.
//
// SEM BOTÃO "VER A CHAVE". Ele existia de quando a chave vivia noutra página.
// Hoje a chave está logo aqui em baixo — mandar a pessoa a outro sítio ver o
// que já está no ecrã são dois caminhos para a mesma coisa, e o segundo leva a
// uma página com outro desenho. Isto agora é um rótulo, não uma ligação.
function CopaADecorrer({ jogo, compacta }: { jogo: EdicaoDecorrer; compacta: boolean }) {
  const t = useT();
  const sub = jogo.naChave
  ? t("dd.estasNestaChave")
  : jogo.estado === "sorteada" ? t("dd.sorteioFeito") : t("dd.aDecorrer");
  if (compacta) {
    return (
      <div style={{ marginTop: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, background: "#121815", border: "1px solid #243029", borderRadius: 14, padding: "11px 13px" }}>
      <div style={{ flexShrink: 0, display: "flex", width: 34, justifyContent: "center" }}>
      <TrofeuDodo size={32} base={false} titulo={t("dd.copaEmCurso")} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 13.5, fontWeight: 700, color: "#f1ede2" }}>{t("lg.copaADecorrer", { n: jogo.numero })}</div>
      <div style={{ fontSize: 11, color: jogo.naChave ? GOLD : "#93a39a" }}>{sub}</div>
      </div>
      </div>
      </div>
    );
  }
  return (
    <div style={{ background: "linear-gradient(160deg,#17201b,#111614)", border: "1px solid #4a3f18", borderRadius: 16, padding: "20px 16px 18px" }}>
    <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
    <TrofeuDodo size={108} numero={`${jogo.numero}ª`} titulo={t("dd.trofeuCopa", { n: jogo.numero })} />
    </div>
    <div style={{ textAlign: "center" }}>
    <span style={{ display: "inline-block", background: "#2a2410", border: "1px solid #5a4a18", color: GOLD, fontFamily: FD, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", padding: "4px 9px", borderRadius: 999 }}>{t("dd.aDecorrer")}</span>
    <div style={{ fontFamily: FD, fontSize: 17, fontWeight: 700, lineHeight: 1.3, margin: "10px 0 4px", color: "#f1ede2" }}>
    {jogo.numero}ª Copa do Dôdo
    </div>
    <div style={{ fontSize: 12.5, color: jogo.naChave ? GOLD : "#93a39a", lineHeight: 1.5 }}>
    {jogo.naChave
      ? t("dd.cadaRodadaElimina")
      : t("dd.edicaoJaArrancou")}
    </div>
    </div>
    </div>
  );
}
function MeuEstado({
    eu, temSessao, souPro, nivelPronto, aberta, aEnviar, dataSorteio, onInscrever, onSair,
  }: {
    eu: EuEstado | null;
    temSessao: boolean | null;
    souPro: boolean;
    nivelPronto: boolean;
    aberta: boolean;
    aEnviar: boolean;
    dataSorteio: string | null;
    onInscrever: () => void;
    onSair: () => void;
}) {
  const t = useT();
  // Sem sessão: convida a entrar, e volta para aqui.
  if (!temSessao || !eu) {
    return (
      <Cartao>
      <Titulo>{t("dd.entraParaInscrever")}</Titulo>
      <Texto>{t("dd.precisaConta")}</Texto>
      <a href="/entrar?voltar=/dodo" style={botaoPrimario}>{t("dd.entrarNaConta")}</a>
      </Cartao>
    );
  }
  // Já inscrito.
  if (eu.inscrito) {
    if (eu.sorteada === true) {
      return (
        <Cartao borda="#4a3f18" fundo="#1c1a10">
        <Titulo cor={GOLD}>{t("dd.estasNaChave")}</Titulo>
        <Texto>{t("dd.vagaSaiuTexto")}</Texto>
        </Cartao>
      );
    }
    if (eu.sorteada === false) {
      return (
        <Cartao>
        <Titulo cor="#cfd8d2">{t("dd.vagaNaoSaiu")}</Titulo>
        <Texto>{t("dd.vagaNaoSaiuTexto")}</Texto>
        </Cartao>
      );
    }
    // sorteada === null: à espera do sorteio. Não há aqui botão de inscrição
    // nenhum, de propósito — uma pessoa, uma inscrição.
    return (
      <Cartao borda="#2c4a36" fundo="#131c17">
      <Titulo cor="#7fd39b">{t("dd.jaInscrito")}</Titulo>
      <Texto>
      {aberta
        ? (dataSorteio ? t("dd.inscritaRegistadaData", { data: dataCurta(dataSorteio) }) : t("dd.inscritaRegistadaSemData"))
        : t("dd.inscricoesFecharamAviso")}
      </Texto>
      {aberta && (
          <button onClick={onSair} disabled={aEnviar} style={{ ...botaoSecundario, cursor: aEnviar ? "default" : "pointer", opacity: aEnviar ? 0.6 : 1 }}>
          {aEnviar ? "…" : t("dd.sairDaCopa")}
          </button>
      )}
      </Cartao>
    );
  }
  // Não inscrito, e o servidor deixa inscrever.
  if (eu.podeInscrever) {
    return (
      <Cartao borda="#4a3f18" fundo="#1c1a10">
      <Titulo cor={GOLD}>{t("dd.vagaEmJogo")}</Titulo>
      <Texto>{dataSorteio ? t("dd.inscreveTextoData", { data: dataCurta(dataSorteio) }) : t("dd.inscreveTextoSemData")}</Texto>
      <button onClick={onInscrever} disabled={aEnviar} style={{ ...botaoPrimario, cursor: aEnviar ? "default" : "pointer", opacity: aEnviar ? 0.6 : 1 }}>
      {aEnviar ? t("dd.aInscrever") : t("dd.inscreverMe")}
      </button>
      </Cartao>
    );
  }
  // Não pode: falta o Pro, ou o prazo já passou. O motivo vem do servidor.
  const faltaPro = !nivelPronto ? false : !souPro;
  if (faltaPro) {
    return (
      <Cartao borda="#5a4a18" fundo="#2a2410">
      <Titulo cor={GOLD}>{t("dd.copaParaPro")}</Titulo>
      <Texto>{t("dd.copaParaProTexto")}</Texto>
      <a href="/ippon-pro" style={botaoPrimario}>{t("lg.conhecerPro")}</a>
      </Cartao>
    );
  }
  return (
    <Cartao>
    <Titulo cor="#cfd8d2">{t("dd.jaFecharam")}</Titulo>
    <Texto>{eu.motivo || t("dd.podesAcompanhar")}</Texto>
    </Cartao>
  );
}
function LinhaContinente({ nome, n, maior, meu }: { nome: string; n: number; maior: number; meu: boolean }) {
  const t = useT();
  const pct = n > 0 ? Math.max(6, (n / maior) * 100) : 0;
  // O mais disputado ganha destaque de cor. Não é um aviso — é informação:
  // quem está nele sabe que a sua vaga é mais difícil, e pode ser o empurrão
  // para se inscrever cedo em vez de deixar para depois.
  const oMaior = n > 0 && n === maior;
  return (
    <div style={{ background: "#121815", border: `1px solid ${meu ? GOLD : "#243029"}`, borderRadius: 12, padding: "10px 13px", marginBottom: 8 }}>
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 7 }}>
    <span style={{ fontSize: 13.5, fontWeight: 700, color: "#f1ede2" }}>
    {nome}
    {meu && <span style={{ fontFamily: FD, fontSize: 9.5, fontWeight: 700, color: GOLD, textTransform: "uppercase", letterSpacing: "0.06em", marginLeft: 7 }}>{t("dd.oTeu")}</span>}
    </span>
    <span style={{ fontFamily: FD, fontSize: 11.5, fontWeight: 700, color: oMaior ? "#e0894f" : "#7c8a82", whiteSpace: "nowrap" }}>
    {n === 1 ? t("dd.nInscrito", { n }) : t("dd.nInscritos", { n })}
    </span>
    </div>
    <div style={{ height: 5, borderRadius: 999, background: "#1a221d", overflow: "hidden" }}>
    <div style={{ width: `${pct}%`, height: "100%", borderRadius: 999, background: oMaior ? "#e0894f" : VERDE }} />
    </div>
    </div>
  );
}
function Regra({ n, titulo, children, ultima }: { n: string; titulo: string; children: React.ReactNode; ultima?: boolean }) {
  return (
    <div style={{ display: "flex", gap: 11, paddingBottom: ultima ? 0 : 13, marginBottom: ultima ? 0 : 13, borderBottom: ultima ? "none" : "1px solid #1a221d" }}>
    <span style={{ flexShrink: 0, width: 21, height: 21, borderRadius: "50%", border: `1px solid ${GOLD}`, color: GOLD, fontFamily: FD, fontSize: 10.5, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{n}</span>
    <div style={{ minWidth: 0 }}>
    <div style={{ fontSize: 13, fontWeight: 700, color: "#f1ede2", marginBottom: 3 }}>{titulo}</div>
    <p style={{ fontSize: 12.5, color: "#a9b4ac", lineHeight: 1.55, margin: 0 }}>{children}</p>
    </div>
    </div>
  );
}
// ---------------------------------------------------------------------------
// Peças pequenas
// ---------------------------------------------------------------------------
const botaoPrimario: React.CSSProperties = {
  display: "block", textAlign: "center", background: GOLD, color: "#1b211e",
  fontFamily: FD, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em",
  fontSize: 13, padding: "12px 18px", borderRadius: 10, textDecoration: "none",
  marginTop: 14, border: "none", width: "100%", cursor: "pointer",
};
const botaoSecundario: React.CSSProperties = {
  display: "block", textAlign: "center", background: "transparent", border: "1px solid #2a3a33",
  color: "#cfd8d2", fontFamily: FD, fontWeight: 700, textTransform: "uppercase",
  letterSpacing: "0.04em", fontSize: 12.5, padding: "11px 18px", borderRadius: 10,
  textDecoration: "none", marginTop: 14, width: "100%", cursor: "pointer",
};
function Cartao({ children, borda, fundo }: { children: React.ReactNode; borda?: string; fundo?: string }) {
  return (
    <div style={{ background: fundo || "#121815", border: `1px solid ${borda || "#243029"}`, borderRadius: 16, padding: "16px 15px" }}>
    {children}
    </div>
  );
}
function Titulo({ children, cor }: { children: React.ReactNode; cor?: string }) {
  return <div style={{ fontFamily: FD, fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", color: cor || "#f1ede2", marginBottom: 7 }}>{children}</div>;
}
function Texto({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 13, color: "#a9b4ac", lineHeight: 1.55, margin: 0 }}>{children}</p>;
}
function Section({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ fontFamily: FD, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#93a39a", margin: "4px 0 10px", ...style }}>{children}</div>;
}
