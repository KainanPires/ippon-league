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
//                  As REGRAS aparecem à mesma: quem chega aqui entre edições
//                  tem de perceber o que é a Copa e o que precisa para entrar,
//                  senão a página só diz "volta depois" e não convence ninguém.
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

  const insc = dados?.inscricoes ?? null;
  const jogo = dados?.aDecorrer ?? null;
  const eu = insc?.eu ?? null;
  const vagasCont = dados?.vagasPorContinente ?? 6;
  const totalVagas = dados?.totalVagas ?? 32;
  const restam = contagem(insc?.inscricoes_ate, agora);
  const aberta = !!insc?.aberta && !!restam;

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
                      Mata-mata mundial entre continentes · {insc.ano || new Date().getFullYear()}
                    </div>
                  </div>

                  {aberta && restam && (
                    <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #243029", display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
                      <div>
                        <div style={{ fontSize: 10.5, color: "#93a39a", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Inscrições fecham em</div>
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
                      As inscrições fecharam. O sorteio corre a seguir — volta aqui para saber se entraste.
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

            {/* ---- Continentes: só faz sentido com inscrições a contar ---- */}
            {insc && (
              <>
                <Section style={{ marginTop: 20 }}>Onde há mais concorrência</Section>
                <p style={{ fontSize: 12, color: "#7c8a82", margin: "-4px 0 12px", lineHeight: 1.5 }}>
                  Cada continente sorteia {vagasCont} vagas entre os seus inscritos. Quem não for sorteado entra no sorteio das vagas que sobraram.
                </p>

                {(Object.keys(NOME_CONTINENTE) as Continente[]).map((c) => (
                  <LinhaContinente
                    key={c}
                    nome={NOME_CONTINENTE[c]}
                    n={insc.porContinente?.[c] ?? 0}
                    vagas={vagasCont}
                    meu={meuContinente === c}
                  />
                ))}
              </>
            )}

          </>
        )}

        {/* --- REGRAS --- Fora do ramo da edição de propósito: quem chega aqui
            entre Copas tem de sair a saber o que é, quem pode entrar e como se
            joga. Uma página que só diz "não há edição" não angaria ninguém. */}
        {!aCarregar && <Regras vagasCont={vagasCont} totalVagas={totalVagas} />}
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
//
// `abreEm` ainda não vem da rota. Quando vier, esta caixa passa sozinha a
// mostrar a data e a contagem para a abertura das inscrições.
function SemEdicao({ abreEm, agora }: { abreEm: string | null; agora: number }) {
  const falta = contagem(abreEm, agora);
  return (
    <div style={{ background: "#121815", border: "1px dashed #2a3a33", borderRadius: 16, padding: "26px 18px", textAlign: "center" }}>
      {/* O troféu fica à vista mesmo sem Copa aberta: é o símbolo, não um prémio
          que só existe quando há edição. */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 14, opacity: 0.5 }}>
        <TrofeuDodo size={92} />
      </div>
      <div style={{ fontFamily: FD, fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "#cfd8d2", marginBottom: 8 }}>
        {falta ? "As inscrições abrem em breve" : "Ainda não há Copa aberta"}
      </div>

      {falta && abreEm ? (
        <>
          <div style={{ fontFamily: FD, fontSize: 24, fontWeight: 700, color: GOLD, lineHeight: 1, margin: "6px 0 6px" }}>{falta}</div>
          <p style={{ fontSize: 12.5, color: "#93a39a", lineHeight: 1.55, margin: "0 0 16px" }}>
            Abrem a {dataCurta(abreEm)}. Lê as regras aqui em baixo para chegares preparado.
          </p>
        </>
      ) : (
        <p style={{ fontSize: 13, color: "#93a39a", lineHeight: 1.55, margin: "0 0 16px" }}>
          A próxima edição abre inscrições antes da competição que a inicia, e avisamos-te por notificação. Entretanto, as regras estão todas aqui em baixo — vale a pena saber o que é preciso antes de abrir.
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
  return (
    <>
      {/* Quem pode entrar. Uma caixa só, e curta: é a condição que faz a pessoa
          perceber num segundo se isto é para ela. */}
      <Section style={{ marginTop: 22 }}>Quem pode entrar</Section>
      <div style={{ background: "#2a2410", border: "1px solid #5a4a18", borderRadius: 14, padding: "14px 15px" }}>
        <div style={{ fontFamily: FD, fontSize: 13, fontWeight: 700, color: GOLD, marginBottom: 7 }}>Só membros Ippon Pro e Pro Max</div>
        <p style={{ fontSize: 12.5, color: "#c7b98f", lineHeight: 1.55, margin: "0 0 9px" }}>
          A subscrição é anual. Se cancelares a meio, continuas a jogar até ao fim do ano que pagaste — a Copa incluída.
        </p>
        <p style={{ fontSize: 12.5, color: "#c7b98f", lineHeight: 1.55, margin: 0 }}>
          Se a subscrição chegar mesmo ao fim durante a Copa, sais dela e o teu adversário dessa ronda avança.
        </p>
      </div>

      <Section style={{ marginTop: 20 }}>As vagas e o sorteio</Section>
      <div style={{ background: "#121815", border: "1px solid #243029", borderRadius: 14, padding: "14px 15px" }}>
        <Regra n="1" titulo={`Cinco continentes, ${vagasCont} vagas cada`}>
          Europa, América, Ásia, África e Oceânia — as cinco federações da IJF. Cada uma tem {vagasCont} lugares reservados.
        </Regra>
        <Regra n="2" titulo="Concorres pelo continente do teu perfil">
          Fica gravado na inscrição. Mudar de país depois não te muda de continente.
        </Regra>
        <Regra n="3" titulo="As vagas que sobram são redistribuídas">
          Se um continente não encher as suas, as que ficaram por usar juntam-se e são sorteadas entre todos os que não foram sorteados, seja qual for o continente deles. É assim que se completam os {totalVagas} lugares.
        </Regra>
        <Regra n="4" titulo="A entrada é por sorteio" ultima>
          Entre os inscritos de cada continente, quando as inscrições fecham. Não é por ordem de chegada: inscreveres-te no primeiro dia ou no último dá exatamente a mesma hipótese.
        </Regra>
      </div>

      <Section style={{ marginTop: 20 }}>Como se joga o mata-mata</Section>
      <div style={{ background: "#121815", border: "1px solid #243029", borderRadius: 14, padding: "14px 15px" }}>
        <Regra n="5" titulo="Cada ronda é uma competição real do calendário">
          Depois do sorteio ficas com um adversário. Escalas a tua equipa para a competição seguinte do calendário, e a pontuação dessa competição é o resultado do vosso confronto.
        </Regra>
        <Regra n="6" titulo="Quem pontua mais avança">
          Quem pontua menos sai. Em caso de empate, decide quem fez mais pontos com o capitão; se ainda assim empatar, vai a sorteio. Quem não escalar conta como zero — não escalar é perder.
        </Regra>
        <Regra n="7" titulo="Joga-se com quem estiver inscrito">
          Ninguém é excluído por o número não ser redondo. Quando os inscritos não chegam para encher a chave, alguns recebem passagem automática na primeira ronda, por sorteio, como acontece numa competição de judô.
        </Regra>
        <Regra n="8" titulo="Há repescagem e dois terceiros">
          Como numa chave internacional. Quem perde para um semifinalista volta a jogar na repescagem, e cruza com o perdedor da meia-final do lado oposto. Saem dois medalhados de bronze, não um.
        </Regra>
        <Regra n="9" titulo="A final soma-se até ao fim" ultima>
          Os dois finalistas acumulam a pontuação desde a meia-final até ao dia em que se disputam os bronzes. Ganha a Copa quem tiver mais no total. Quem terminar no pódio recebe um certificado digital para partilhar, guardado na aba Resultados.
        </Regra>
      </div>

      <p style={{ fontSize: 11.5, color: "#6f7d76", lineHeight: 1.6, margin: "14px 2px 0" }}>
        As regras podem ser ajustadas entre edições. Qualquer alteração é anunciada antes de as inscrições abrirem, nunca com uma Copa a decorrer.
      </p>
    </>
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

// O cartão da Copa que está a ser jogada. Quando há inscrições abertas em cima,
// vem em versão compacta — nesse ecrã a ação principal é inscrever-se, e um
// segundo cartão do mesmo tamanho competia com ela pela atenção.
function CopaADecorrer({ jogo, compacta }: { jogo: EdicaoDecorrer; compacta: boolean }) {
  const destino = jogo.invite_code ? `/liga/${jogo.invite_code}` : "/ligas";
  const sub = jogo.naChave
    ? "Estás nesta chave"
    : jogo.estado === "sorteada" ? "Sorteio feito · à espera da primeira ronda" : "A decorrer";

  if (compacta) {
    return (
      <a href={destino} style={{ textDecoration: "none", display: "block", marginTop: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, background: "#121815", border: "1px solid #243029", borderRadius: 14, padding: "11px 13px" }}>
          <div style={{ flexShrink: 0, display: "flex", width: 34, justifyContent: "center" }}>
            <TrofeuDodo size={32} base={false} titulo="Copa a decorrer" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: "#f1ede2" }}>{jogo.numero}ª Copa · a decorrer</div>
            <div style={{ fontSize: 11, color: jogo.naChave ? GOLD : "#93a39a" }}>{sub}</div>
          </div>
          <span style={{ background: "#e67e22", color: "#1b0f06", fontFamily: FD, fontWeight: 700, textTransform: "uppercase", fontSize: 11, padding: "7px 12px", borderRadius: 8, whiteSpace: "nowrap" }}>Ver a chave</span>
        </div>
      </a>
    );
  }

  return (
    <div style={{ background: "linear-gradient(160deg,#17201b,#111614)", border: "1px solid #4a3f18", borderRadius: 16, padding: "20px 16px 18px" }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
        <TrofeuDodo size={108} numero={`${jogo.numero}ª`} titulo={`Troféu da ${jogo.numero}ª Copa do Dôdo`} />
      </div>
      <div style={{ textAlign: "center" }}>
        <span style={{ display: "inline-block", background: "#2a2410", border: "1px solid #5a4a18", color: GOLD, fontFamily: FD, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", padding: "4px 9px", borderRadius: 999 }}>A decorrer</span>
        <div style={{ fontFamily: FD, fontSize: 17, fontWeight: 700, lineHeight: 1.3, margin: "10px 0 4px", color: "#f1ede2" }}>
          {jogo.numero}ª Copa do Dôdo
        </div>
        <div style={{ fontSize: 12.5, color: jogo.naChave ? GOLD : "#93a39a", lineHeight: 1.5 }}>
          {jogo.naChave
            ? "Estás nesta chave. Cada rodada elimina metade."
            : "Esta edição já arrancou. As inscrições da seguinte abrem mais para a frente."}
        </div>
      </div>
      <a href={destino} style={botaoPrimario}>Ver a chave</a>
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
        </Cartao>
      );
    }
    if (eu.sorteada === false) {
      return (
        <Cartao>
          <Titulo cor="#cfd8d2">A tua vaga não saiu</Titulo>
          <Texto>Foram mais inscritos do que vagas e o sorteio decidiu. A próxima edição volta a abrir com todas as vagas em jogo.</Texto>
        </Cartao>
      );
    }
    // sorteada === null: à espera do sorteio. Não há aqui botão de inscrição
    // nenhum, de propósito — uma pessoa, uma inscrição.
    return (
      <Cartao borda="#2c4a36" fundo="#131c17">
        <Titulo cor="#7fd39b">✓ Já fizeste a tua inscrição</Titulo>
        <Texto>
          {aberta
            ? `Está registada e não é preciso fazer mais nada. O sorteio${dataSorteio ? ` sai a ${dataCurta(dataSorteio)}` : " sai quando as inscrições fecharem"} e avisamos-te aqui e no sininho. Obrigado, e boa sorte!`
            : "As inscrições fecharam. Assim que o sorteio correr, ficas a saber aqui se entraste. Boa sorte!"}
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
        <Texto>Inscreves-te agora e entras no sorteio{dataSorteio ? `, que sai a ${dataCurta(dataSorteio)}` : ""}. Não há corrida ao relógio — o dia em que te inscreves não muda nada.</Texto>
        <button onClick={onInscrever} disabled={aEnviar} style={{ ...botaoPrimario, cursor: aEnviar ? "default" : "pointer", opacity: aEnviar ? 0.6 : 1 }}>
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
      <Titulo cor="#cfd8d2">As inscrições já fecharam</Titulo>
      <Texto>{eu.motivo || "Podes acompanhar a chave e inscrever-te na próxima edição."}</Texto>
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
