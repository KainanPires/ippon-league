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
//   sem edição   — 'preparada' não é devolvida pela rota: ninguém a vê.
//   inscricoes   — inscrições abertas, com contagem decrescente.
//   sorteada     — o sorteio já correu; cada um vê se entrou.
//   a_decorrer   — a chave está a ser jogada.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { NOME_CONTINENTE, continenteDoPais, type Continente } from "@/lib/continentes";
import { useNivel } from "@/lib/useNivel";
import { TrofeuDodo } from "@/components/TrofeuDodo";

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

interface Edicao {
  id: string;
  numero: number;
  ano: number | null;
  estado: string;
  nome: string;
  inscricoes_ate: string | null;
  league_id: string | null;
  // Ainda não vem da rota. Fica aqui para o dia em que vier: assim o botão
  // passa a abrir a chave direto, sem mexer neste ecrã.
  invite_code?: string | null;
}

interface Resposta {
  ok: boolean;
  edicao: Edicao | null;
  nota?: string;
  inscritos?: number;
  porContinente?: Record<string, number>;
  vagasPorContinente?: number;
  totalVagas?: number;
  eu?: EuEstado | null;
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
  const [dados, setDados] = useState<Resposta | null>(null);
  const [aCarregar, setACarregar] = useState(true);
  const [aEnviar, setAEnviar] = useState(false);
  const [erro, setErro] = useState("");
  const [erroEhPro, setErroEhPro] = useState(false);
  const [confirmarSaida, setConfirmarSaida] = useState(false);
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
      setDados({ ok: false, edicao: null });
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
      const t = await tokenDaSessao();
      if (!t) {
        window.location.href = "/entrar?voltar=/dodo";
        return;
      }
      const res = await fetch("/api/dodo", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
        body: JSON.stringify({ acao: qual }),
      });
      const j = (await res.json()) as { ok?: boolean; erro?: string; precisaPro?: boolean };
      if (!j.ok) {
        setErro(j.erro || "Não foi possível concluir.");
        setErroEhPro(!!j.precisaPro);
        setAEnviar(false);
        return;
      }
      await carregar();
    } catch {
      setErro("Falha de ligação. Tenta outra vez.");
    }
    setAEnviar(false);
  }

  const edicao = dados?.edicao ?? null;
  const eu = dados?.eu ?? null;
  const vagasCont = dados?.vagasPorContinente ?? 6;
  const totalVagas = dados?.totalVagas ?? 32;
  const inscritos = dados?.inscritos ?? 0;
  const porContinente = dados?.porContinente ?? {};
  const restam = contagem(edicao?.inscricoes_ate, agora);
  const aberta = edicao?.estado === "inscricoes" && !!restam;

  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: FB }}>
      <div style={{ maxWidth: 460, margin: "0 auto", padding: "14px 14px 84px" }}>

        <header style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <a href="/ligas" aria-label="Voltar às competições" style={{ width: 34, height: 34, borderRadius: "50%", border: "1px solid #243029", display: "flex", alignItems: "center", justifyContent: "center", color: "#cfd8d2", textDecoration: "none", flexShrink: 0 }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
          </a>
          <h1 style={{ fontFamily: FD, fontSize: 19, fontWeight: 700, textTransform: "uppercase", margin: 0 }}>Copa do Dôdo</h1>
        </header>

        {aCarregar ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#7c8a82", fontFamily: FD, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.1em" }}>A carregar…</div>
        ) : !edicao ? (
          <SemEdicao />
        ) : (
          <>
            {/* --- A edição --- */}
            <div style={{ background: "linear-gradient(160deg,#17201b,#111614)", border: `1px solid ${aberta ? "#4a3f18" : "#243029"}`, borderRadius: 16, padding: "20px 16px 18px", marginBottom: 14 }}>
              {/* O troféu é o símbolo da Copa. Aqui aparece grande, com o número
                  da edição gravado na placa. */}
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
                <TrofeuDodo size={108} numero={`${edicao.numero}ª`} titulo={`Troféu da ${edicao.numero}ª Copa do Dôdo`} />
              </div>
              <div style={{ textAlign: "center" }}>
                <Selo estado={edicao.estado} aberta={aberta} />
                <div style={{ fontFamily: FD, fontSize: 17, fontWeight: 700, lineHeight: 1.3, margin: "10px 0 4px", color: "#f1ede2" }}>
                  {edicao.numero}ª Copa do Dôdo
                </div>
                <div style={{ fontSize: 12.5, color: "#93a39a", lineHeight: 1.5 }}>
                  Mata-mata mundial entre continentes · {edicao.ano || new Date().getFullYear()}
                </div>
              </div>

              {aberta && restam && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #243029", display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 10.5, color: "#93a39a", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Inscrições fecham em</div>
                    <div style={{ fontFamily: FD, fontSize: 22, fontWeight: 700, color: GOLD, lineHeight: 1 }}>{restam}</div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontFamily: FD, fontSize: 16, fontWeight: 700, color: "#f1ede2", lineHeight: 1 }}>{inscritos}</div>
                    <div style={{ fontSize: 10, color: "#93a39a", textTransform: "uppercase", marginTop: 3 }}>inscritos · {totalVagas} vagas</div>
                  </div>
                </div>
              )}

              {!aberta && edicao.estado === "inscricoes" && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #243029", fontSize: 12.5, color: "#c7d0c9", lineHeight: 1.5 }}>
                  As inscrições fecharam. O sorteio das {totalVagas} vagas corre a seguir — volta aqui para saber se entraste.
                </div>
              )}
            </div>

            {/* --- O meu estado --- */}
            <MeuEstado
              eu={eu}
              temSessao={temSessao}
              souPro={souPro}
              nivelPronto={nivelPronto}
              estado={edicao.estado}
              aberta={aberta}
              aEnviar={aEnviar}
              inviteCode={edicao.invite_code ?? null}
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

            {/* --- Continentes --- */}
            <Section style={{ marginTop: 20 }}>Onde há mais concorrência</Section>
            <p style={{ fontSize: 12, color: "#7c8a82", margin: "-4px 0 12px", lineHeight: 1.5 }}>
              Cada continente sorteia {vagasCont} vagas entre os seus inscritos. Quem não for sorteado vai à repescagem, onde as vagas que sobraram são disputadas por todos.
            </p>

            {(Object.keys(NOME_CONTINENTE) as Continente[]).map((c) => (
              <LinhaContinente
                key={c}
                nome={NOME_CONTINENTE[c]}
                n={porContinente[c] ?? 0}
                vagas={vagasCont}
                meu={meuContinente === c}
              />
            ))}

            {/* --- Regras --- */}
            <Section style={{ marginTop: 20 }}>Como funciona</Section>
            <div style={{ background: "#121815", border: "1px solid #243029", borderRadius: 14, padding: "14px 15px" }}>
              <Regra n="1" titulo="Inscreves-te durante duas semanas">
                Não é por ordem de chegada. Quem se inscreve no último dia tem exatamente a mesma hipótese de quem se inscreveu no primeiro — o fuso horário não decide nada.
              </Regra>
              <Regra n="2" titulo={`Cada continente sorteia ${vagasCont} vagas`}>
                Europa, América, Ásia, África e Oceânia, as cinco federações da IJF. Concorres pelo continente do país que tens no perfil, e esse continente fica gravado na inscrição: mudar de país depois não te muda de sorteio.
              </Regra>
              <Regra n="3" titulo="O que sobra vai à repescagem">
                Se um continente tiver menos inscritos do que vagas, as vagas por usar juntam-se num sorteio único entre todos os que ficaram de fora. É assim que as {totalVagas} se enchem.
              </Regra>
              <Regra n="4" titulo="A chave é uma potência de 2">
                Com {totalVagas} sorteados joga-se a {totalVagas}; com 24, joga-se a 16. Ninguém recebe uma ronda de vantagem sem a ter ganho.
              </Regra>
              <Regra n="5" titulo="A cada rodada, quem pontua mais avança" ultima>
                Levas a tua equipa para a Copa e ela conta na competição seguinte do calendário. Perdes uma vez, sais.
              </Regra>
            </div>

            <p style={{ fontSize: 11.5, color: "#6f7d76", lineHeight: 1.6, margin: "14px 2px 0" }}>
              A Copa do Dôdo é para membros Ippon Pro. Se cancelares a subscrição, mantens o acesso até ao fim do período pago — e continuas na Copa até lá.
            </p>
          </>
        )}
      </div>

      {/* Confirmação de saída. */}
      {confirmarSaida && (
        <div onClick={() => setConfirmarSaida(false)} style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 360, background: "#121815", border: "1px solid #2a3a33", borderRadius: 16, padding: "20px 18px" }}>
            <div style={{ fontFamily: FD, fontSize: 15, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", color: "#f1ede2", textAlign: "center", marginBottom: 10 }}>Sair da Copa</div>
            <p style={{ fontSize: 13, color: "#c7d0c9", lineHeight: 1.55, textAlign: "center", margin: "0 0 16px" }}>
              Perdes o teu lugar no sorteio. Podes voltar a inscrever-te enquanto as inscrições estiverem abertas.
            </p>
            <div style={{ display: "flex", gap: 9 }}>
              <button onClick={() => setConfirmarSaida(false)} style={{ flex: 1, background: "transparent", border: "1px solid #2a3a33", color: "#cfd8d2", fontFamily: FD, fontWeight: 700, textTransform: "uppercase", fontSize: 12, padding: "11px 0", borderRadius: 10, cursor: "pointer" }}>Ficar</button>
              <button onClick={() => { setConfirmarSaida(false); acao("sair"); }} style={{ flex: 1, background: "#4a2420", border: "1px solid #6d3630", color: "#ef8d83", fontFamily: FD, fontWeight: 700, textTransform: "uppercase", fontSize: 12, padding: "11px 0", borderRadius: 10, cursor: "pointer" }}>Sair</button>
            </div>
          </div>
        </div>
      )}

      <nav style={{ position: "fixed", left: 0, right: 0, bottom: 0, height: 60, background: "#0f1411", borderTop: "1px solid #243029", display: "flex", alignItems: "center", justifyContent: "space-around", zIndex: 50 }}>
        <NavTab label="Início" href="/inicio" icon={<HomeIcon />} />
        <NavTab label="Competições" href="/ligas" icon={<TrophyIcon />} active />
        <NavTab label="Atletas" href="/atletas" icon={<AthletesIcon />} />
        <NavTab label="Pro" href="/pro-central" icon={<BoltIcon />} />
      </nav>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Blocos
// ---------------------------------------------------------------------------

// Sem edição visível. A rota esconde de propósito as edições 'preparada' — por
// isso este é o estado normal entre Copas, não uma avaria.
function SemEdicao() {
  return (
    <div style={{ background: "#121815", border: "1px dashed #2a3a33", borderRadius: 16, padding: "26px 18px", textAlign: "center" }}>
      {/* O troféu fica à vista mesmo sem Copa aberta: é o símbolo, não um prémio
          que só existe quando há edição. */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 14, opacity: 0.45 }}>
        <TrofeuDodo size={88} />
      </div>
      <div style={{ fontFamily: FD, fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "#cfd8d2", marginBottom: 8 }}>Ainda não há Copa aberta</div>
      <p style={{ fontSize: 13, color: "#93a39a", lineHeight: 1.55, margin: "0 0 16px" }}>
        A próxima edição abre inscrições antes da competição que a inicia. Avisamos-te por notificação — não é preciso andar a espreitar.
      </p>
      <a href="/ligas" style={{ display: "inline-block", background: VERDE, color: "#06140d", fontFamily: FD, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", padding: "11px 20px", borderRadius: 10, textDecoration: "none", fontSize: 13 }}>Ver competições</a>
    </div>
  );
}

function Selo({ estado, aberta }: { estado: string; aberta: boolean }) {
  let texto = "Inscrições";
  let cor = GOLD;
  let fundo = "#2a2410";
  let borda = "#5a4a18";
  if (estado === "inscricoes" && aberta) {
    texto = "Inscrições abertas";
    cor = "#7fd39b";
    fundo = "#15271c";
    borda = "#2c4a36";
  } else if (estado === "inscricoes") {
    texto = "Inscrições fechadas";
    cor = "#93a39a";
    fundo = "#161c19";
    borda = "#243029";
  } else if (estado === "sorteada") {
    texto = "Sorteio feito";
  } else if (estado === "a_decorrer") {
    texto = "A decorrer";
  }
  return (
    <span style={{ display: "inline-block", background: fundo, border: `1px solid ${borda}`, color: cor, fontFamily: FD, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", padding: "4px 9px", borderRadius: 999 }}>{texto}</span>
  );
}

function MeuEstado({
  eu, temSessao, souPro, nivelPronto, estado, aberta, aEnviar, inviteCode, onInscrever, onSair,
}: {
  eu: EuEstado | null;
  temSessao: boolean | null;
  souPro: boolean;
  nivelPronto: boolean;
  estado: string;
  aberta: boolean;
  aEnviar: boolean;
  inviteCode: string | null;
  onInscrever: () => void;
  onSair: () => void;
}) {
  // Sem sessão: convida a entrar, e volta para aqui.
  if (!temSessao || !eu) {
    return (
      <Cartao>
        <Titulo>Entra para te inscreveres</Titulo>
        <Texto>A Copa é disputada com a tua equipa, por isso precisas da tua conta.</Texto>
        <a href="/entrar?voltar=/dodo" style={botaoPrimario}>Entrar na conta</a>
      </Cartao>
    );
  }

  // Já inscrito.
  if (eu.inscrito) {
    if (eu.sorteada === true) {
      return (
        <Cartao borda="#4a3f18" fundo="#1c1a10">
          <Titulo cor={GOLD}>Estás na chave</Titulo>
          <Texto>A tua vaga saiu no sorteio. A partir da próxima competição do calendário, cada rodada elimina metade dos que sobram.</Texto>
          <a href={inviteCode ? `/liga/${inviteCode}` : "/ligas"} style={botaoPrimario}>Ver a chave</a>
        </Cartao>
      );
    }
    if (eu.sorteada === false) {
      return (
        <Cartao>
          <Titulo cor="#cfd8d2">A tua vaga não saiu</Titulo>
          <Texto>Foram mais inscritos do que vagas e o sorteio decidiu. A próxima edição volta a abrir com todas as vagas em jogo — e podes acompanhar esta chave na mesma.</Texto>
          <a href="/ligas" style={botaoSecundario}>Ver competições</a>
        </Cartao>
      );
    }
    // sorteada === null: à espera do sorteio.
    return (
      <Cartao borda="#2c4a36" fundo="#131c17">
        <Titulo cor="#7fd39b">Inscrição registada</Titulo>
        <Texto>
          {aberta
            ? "Estás no sorteio. A tua hipótese é a mesma de quem se inscrever no último minuto."
            : "As inscrições fecharam. Assim que o sorteio correr, ficas a saber aqui se entraste."}
        </Texto>
        {aberta && (
          <button onClick={onSair} disabled={aEnviar} style={{ ...botaoSecundario, cursor: aEnviar ? "default" : "pointer", opacity: aEnviar ? 0.6 : 1 }}>
            {aEnviar ? "…" : "Sair da Copa"}
          </button>
        )}
      </Cartao>
    );
  }

  // Não inscrito, e o servidor deixa inscrever.
  if (eu.podeInscrever) {
    return (
      <Cartao borda="#4a3f18" fundo="#1c1a10">
        <Titulo cor={GOLD}>A tua vaga está em jogo</Titulo>
        <Texto>Inscreves-te agora e entras no sorteio. Não há corrida ao relógio — o dia em que te inscreves não muda nada.</Texto>
        <button onClick={onInscrever} disabled={aEnviar} style={{ ...botaoPrimario, border: "none", width: "100%", cursor: aEnviar ? "default" : "pointer", opacity: aEnviar ? 0.6 : 1 }}>
          {aEnviar ? "A inscrever…" : "Inscrever-me na Copa"}
        </button>
      </Cartao>
    );
  }

  // Não pode: falta o Pro, ou o prazo já passou. O motivo vem do servidor.
  const faltaPro = !nivelPronto ? false : !souPro;
  if (faltaPro) {
    return (
      <Cartao borda="#5a4a18" fundo="#2a2410">
        <Titulo cor={GOLD}>A Copa é para membros Pro</Titulo>
        <Texto>Um mata-mata mundial só funciona se cada lugar for levado a sério até ao fim. O Ippon Pro dá-te a entrada.</Texto>
        <a href="/ippon-pro" style={botaoPrimario}>Conhecer o Ippon Pro</a>
      </Cartao>
    );
  }

  return (
    <Cartao>
      <Titulo cor="#cfd8d2">
        {estado === "inscricoes" ? "As inscrições já fecharam" : "Esta edição já arrancou"}
      </Titulo>
      <Texto>{eu.motivo || "Podes acompanhar a chave e inscrever-te na próxima edição."}</Texto>
      <a href="/ligas" style={botaoSecundario}>Ver competições</a>
    </Cartao>
  );
}

function LinhaContinente({ nome, n, vagas, meu }: { nome: string; n: number; vagas: number; meu: boolean }) {
  const pct = vagas > 0 ? Math.min(100, (n / vagas) * 100) : 0;
  const excedente = Math.max(0, n - vagas);
  return (
    <div style={{ background: "#121815", border: `1px solid ${meu ? GOLD : "#243029"}`, borderRadius: 12, padding: "10px 13px", marginBottom: 8 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 7 }}>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: "#f1ede2" }}>
          {nome}
          {meu && <span style={{ fontFamily: FD, fontSize: 9.5, fontWeight: 700, color: GOLD, textTransform: "uppercase", letterSpacing: "0.06em", marginLeft: 7 }}>o teu</span>}
        </span>
        <span style={{ fontFamily: FD, fontSize: 11.5, fontWeight: 700, color: n >= vagas ? "#e0894f" : "#7c8a82", whiteSpace: "nowrap" }}>
          {n} / {vagas}
        </span>
      </div>
      <div style={{ height: 5, borderRadius: 999, background: "#1a221d", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", borderRadius: 999, background: n >= vagas ? "#e0894f" : VERDE }} />
      </div>
      {excedente > 0 && (
        <div style={{ fontSize: 10.5, color: "#93a39a", marginTop: 6 }}>
          {excedente} {excedente === 1 ? "inscrito vai" : "inscritos vão"} à repescagem
        </div>
      )}
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

function NavTab({ label, icon, href, active }: { label: string; icon: React.ReactNode; href?: string; active?: boolean }) {
  const style: React.CSSProperties = { display: "flex", flexDirection: "column", alignItems: "center", gap: 3, color: active ? GOLD : "#6f7d76", textDecoration: "none" };
  const inner = <>{icon}<span style={{ fontSize: 11, fontWeight: active ? 700 : 400 }}>{label}</span></>;
  return href ? <a href={href} style={style}>{inner}</a> : <div style={style}>{inner}</div>;
}

function HomeIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /></svg>; }
function TrophyIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 4h8v5a4 4 0 0 1-8 0V4z" /><path d="M8 6H5v2a3 3 0 0 0 3 3M16 6h3v2a3 3 0 0 1-3 3M10 17h4M9 21h6M12 13v4" /></svg>; }
function AthletesIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="8" cy="6" r="3" /><circle cx="17" cy="7" r="2.5" /><path d="M3 20v-1a5 5 0 0 1 10 0v1M14 20v-1a4 4 0 0 1 7-2.6" /></svg>; }
function BoltIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" /></svg>; }
