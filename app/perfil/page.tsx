"use client";

// O perfil da Academy.
//
// Mesma organização do /perfil da Ippon League, pela mesma ordem:
//
//   cápsula com a seta ›   →  toca e abre o que é teu por dentro
//   os meus dados          ·  só com a cápsula aberta
//   a minha caminhada      ·  só com a cápsula aberta
//   IDIOMA                 →  sempre visível, e logo a seguir à cápsula:
//                             a língua decide se se percebe o resto do ecrã
//   judogui + senha        ·  só com a cápsula aberta
//   NOTIFICAÇÕES           →  sempre visível
//   assinatura             ·  só com a cápsula aberta
//   A MINHA EQUIPA         →  sempre visível
//   INFORMAÇÕES E POLÍTICAS
//   sair
//
// Existe porque há quem venha só pela Academy e nunca queira o fantasy:
// mandar essa pessoa ao outro produto só para sair é mandá-la para fora de
// casa. O que é da CONTA (nome, email, senha, plano, escudo) é o mesmo nos
// dois lados. O que é da Academy (Faixa de Estudo, lápis, sequência,
// idioma) vive só aqui.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useLang, useT } from "@/lib/i18n";
import { Mascot } from "@/components/Mascot";
import { SeletorLingua } from "@/components/SeletorLingua";
import { Notificacoes } from "@/components/Notificacoes";
import { FaixaIcone } from "@/components/FaixaIcone";
import { BarraLapis } from "@/components/Lapis";
import { Escudo, loadIdentity, DEFAULT_IDENTITY, type Identity } from "@/components/Escudo";
import { useFaixaEstudo, useUtilizador } from "@/lib/useAcademy";
import { useVidas } from "@/lib/useVidas";

const FD = "var(--font-geist-mono), system-ui, sans-serif";
const AZUL = "#4C8DFF";
const CARTA = "#0f1726";
const LINHA = "#1b2a3f";
const APAGADO = "#7c8ba1";

type JudoguiCor = "branco" | "azul";

export default function Perfil() {
  const [lang] = useLang();
  const t = useT(lang);
  const router = useRouter();
  const uid = useUtilizador();
  const { faixa, feitas, aRever } = useFaixaEstudo(lang);
  const { vidas } = useVidas();

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [aberto, setAberto] = useState(false);
  const [aSair, setASair] = useState(false);
  const [confirmaSaida, setConfirmaSaida] = useState(false);
  const [resumo, setResumo] = useState<{ streak_atual: number; pontos_total: number } | null>(null);
  const [seguinte, setSeguinte] = useState<{ nome: string; licoes_exigidas: number } | null>(null);
  const [escudo, setEscudo] = useState<Identity>(DEFAULT_IDENTITY);

  useEffect(() => {
    supabase().auth.getSession().then(({ data }) => {
      const u = data.session?.user;
      if (!u) return;
      const meta = u.user_metadata as { nome?: string } | undefined;
      if (meta?.nome) setNome(meta.nome);
      if (u.email) setEmail(u.email);
    });
    setEscudo(loadIdentity());
  }, []);

  useEffect(() => {
    supabase().rpc("aca_meu_resumo").then(({ data }) => {
      const r = Array.isArray(data) ? data[0] : data;
      if (r) setResumo(r as { streak_atual: number; pontos_total: number });
    });
  }, []);

  // A faixa a seguir à actual — é dela que se mede a barra de progresso.
  useEffect(() => {
    if (!faixa) return;
    (async () => {
      const sb = supabase();
      const { data: g } = await sb.from("aca_faixas")
        .select("id, licoes_exigidas").eq("ordem", faixa.ordem + 1).limit(1);
      const grau = (g ?? [])[0] as { id: string; licoes_exigidas: number } | undefined;
      if (!grau) { setSeguinte(null); return; }
      const { data: n } = await sb.from("aca_faixas_i18n")
        .select("nome").eq("lang", lang).eq("faixa_id", grau.id).limit(1);
      const nomeGrau = ((n ?? [])[0] as { nome?: string } | undefined)?.nome ?? grau.id;
      setSeguinte({ nome: nomeGrau, licoes_exigidas: grau.licoes_exigidas });
    })();
  }, [faixa, lang]);

  // Quem não tem sessão não tem perfil para ver.
  useEffect(() => {
    if (uid === null) router.replace("/login");
  }, [uid, router]);

  async function sair() {
    setASair(true);
    try { await supabase().auth.signOut(); } catch { /* sai na mesma */ }
    router.replace("/login");
  }

  const corFaixa = faixa?.cor_hex || "#d7dcd6";
  const nivel = vidas?.nivel ?? "gratuito";
  const nomePlano =
    nivel === "promax" ? "Ippon Pro Max" : nivel === "pro" ? "Ippon Pro" : t("planoGratuito");

  return (
    <>
      <header style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 16 }}>
        <Link href="/" aria-label={t("voltarInicio")} style={{
          width: 36, height: 36, borderRadius: "50%", border: `1px solid ${LINHA}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#cfd8d2", textDecoration: "none", flexShrink: 0,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <h1 style={{
          fontFamily: FD, fontSize: 19, fontWeight: 700, textTransform: "uppercase", margin: 0,
        }}>
          {t("perfilTitulo")}
        </h1>
      </header>

      {/* ---- A cápsula: o Dôdo pequeno, o nome, a faixa e a seta ---- */}
      <button onClick={() => setAberto((v) => !v)} style={{
        display: "flex", alignItems: "center", gap: 12, width: "100%",
        background: CARTA, border: `1px solid ${LINHA}`, borderRadius: 16,
        padding: 12, cursor: "pointer", color: "#f1ede2", textAlign: "left",
      }}>
        <div style={{
          width: 52, height: 52, borderRadius: "50%", background: "#12294a",
          overflow: "hidden", flexShrink: 0, border: `2px solid ${corFaixa}`,
        }}>
          <Mascot belt={corFaixa} expression="sabio" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: FD, fontSize: 17, fontWeight: 700, textTransform: "uppercase" }}>
            {nome || t("campeao")}
          </div>
          <div style={{
            display: "flex", alignItems: "center", gap: 6, fontSize: 12.5,
            color: AZUL, marginTop: 2,
          }}>
            <FaixaIcone cor={corFaixa} ponta={faixa?.cor_ponta_hex ?? null} size={22} />
            {faixa?.nome || t("faixaEstudo")}
          </div>
          <div style={{ fontSize: 11, color: APAGADO, marginTop: 3 }}>
            {aberto ? t("tocaFechar") : t("tocaVer")}
          </div>
        </div>
        <span style={{
          color: APAGADO, fontSize: 20, flexShrink: 0,
          transform: aberto ? "rotate(90deg)" : "none", transition: "transform .15s",
        }}>›</span>
      </button>

      {aberto && (
        <div style={{ marginTop: 12 }}>
          <MeusDados t={t} />
        </div>
      )}

      {/* ---- A caminhada: o percurso da faixa ---- */}
      {aberto && (
        <>
          <Titulo>{t("minhaCaminhada")}</Titulo>
          <Bloco>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <FaixaIcone cor={corFaixa} ponta={faixa?.cor_ponta_hex ?? null} size={48} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>
                  {faixa?.nome || t("faixaEstudo")}
                </div>
                {seguinte ? (
                  <>
                    <div style={{ fontSize: 11.5, color: APAGADO, margin: "3px 0 5px" }}>
                      {t("proximaFaixa")}: {seguinte.nome} ·{" "}
                      {t("faltamLicoes", { n: Math.max(seguinte.licoes_exigidas - feitas, 0) })}
                    </div>
                    <Barra feito={feitas} total={seguinte.licoes_exigidas} />
                  </>
                ) : (
                  <div style={{ fontSize: 11.5, color: APAGADO, marginTop: 3 }}>
                    {t("semMaisFaixas")}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <Numero valor={resumo?.streak_atual ?? 0} rotulo={t("sequencia")} cor="#EE7900" />
              <Numero valor={resumo?.pontos_total ?? 0} rotulo={t("pontos")} cor={AZUL} />
              <Numero valor={feitas} rotulo={t("licoesFeitas")} cor={AZUL} />
              <Numero valor={aRever} rotulo={t("aRever")} cor={APAGADO} />
            </div>

            {/* Os lápis DESENHADOS, como no quiz: acesos os que ainda tens,
                apagados os gastos, e a conta para o próximo. Um número não
                diz o mesmo — a fila de lápis vê-se de relance. */}
            {vidas && (
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                gap: 10, padding: "10px 12px", borderRadius: 12, background: "#131c2c",
                border: `1px solid ${LINHA}`, marginBottom: 12,
              }}>
                <span style={{ fontSize: 12.5, color: APAGADO }}>{t("lapis")}</span>
                <BarraLapis v={vidas} />
              </div>
            )}

            <Link href="/faixa" className="botao">{t("verFaixa")}</Link>
          </Bloco>
        </>
      )}

      {/* ---- IDIOMA — sempre visível, e logo a seguir à cápsula ----
          A língua não é um enfeite: é o que decide se a pessoa percebe o resto
          do ecrã. Quem chega aqui à procura dela não devia ter de abrir nada. */}
      <Titulo>{t("lingua")}</Titulo>
      <Bloco>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 10, flexWrap: "wrap",
        }}>
          <SeletorLingua />
          <span style={{ fontSize: 13, fontWeight: 700, color: AZUL, whiteSpace: "nowrap" }}>
            {NOME_LINGUA[lang]}
          </span>
        </div>
      </Bloco>

      {aberto && (
        <>
          <Titulo>{t("judoguiDodo")}</Titulo>
          <Judogui t={t} uid={uid ?? null} corFaixa={corFaixa} />

          <Titulo>{t("seguranca")}</Titulo>
          <AlterarSenha t={t} email={email} />
        </>
      )}

      {/* ---- NOTIFICAÇÕES — sempre visível ---- */}
      <Titulo>{t("notificacoes")}</Titulo>
      <Notificacoes />

      {aberto && (
        <>
          <Titulo>{t("assinatura")}</Titulo>
          <Bloco>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
            }}>
              <div>
                <div style={{ fontSize: 11, color: APAGADO }}>{t("oTeuPlano")}</div>
                <div style={{
                  fontFamily: FD, fontSize: 17, fontWeight: 700, textTransform: "uppercase",
                }}>
                  {nomePlano}
                </div>
              </div>
              <div style={{ textAlign: "right", fontSize: 12, color: APAGADO }}>
                {vidas?.ilimitado
                  ? t("lapisSemFim")
                  : vidas ? `${vidas.maximo} ${t("lapis").toLowerCase()}` : ""}
              </div>
            </div>
            <a href="/ippon-pro" style={{
              display: "block", textAlign: "center", marginTop: 12, background: AZUL,
              color: "#06101f", fontFamily: FD, fontSize: 14, fontWeight: 700,
              textTransform: "uppercase", letterSpacing: "0.04em", padding: 12,
              borderRadius: 12, textDecoration: "none",
            }}>
              {t("verPlanos")}
            </a>
          </Bloco>
        </>
      )}

      {/* ---- A MINHA EQUIPA ----
          O escudo não é uma cópia do que está no fantasy: é o mesmo. Está
          guardado neste endereço, e os dois produtos passaram a partilhá-lo.
          Mudá-lo abre o editor da Academy, que grava nos mesmos dois sítios
          que o Fantasy usa — e avisa antes de o fazer. */}
      <Titulo>{t("aMinhaEquipa")}</Titulo>
      <Bloco>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Escudo config={escudo} size={54} />
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontFamily: FD, fontSize: 15, fontWeight: 700, textTransform: "uppercase",
            }}>
              {escudo.name}
            </div>
            <div style={{ fontSize: 12, color: APAGADO, marginTop: 2 }}>{t("escudoNome")}</div>
          </div>
        </div>
        <Link href="/escudo" style={{
          display: "block", textAlign: "center", marginTop: 14, background: AZUL,
          color: "#06101f", fontFamily: FD, fontSize: 14, fontWeight: 700,
          textTransform: "uppercase", letterSpacing: "0.04em", padding: 12,
          borderRadius: 12, textDecoration: "none",
        }}>
          {t("mudarEscudo")}
        </Link>
      </Bloco>

      {/* ---- INFORMAÇÕES E POLÍTICAS ---- */}
      <Titulo>{t("infoPoliticas")}</Titulo>
      <Bloco>
        {[
          { texto: t("infoSobre"), href: "/sobre" },
          { texto: t("infoFaq"), href: "/faq" },
          { texto: t("infoTermos"), href: "/termos" },
          { texto: t("infoPrivacidade"), href: "/privacidade" },
          { texto: t("infoAjuda"), href: "/ajuda" },
        ].map((it) => (
          <a key={it.href} href={it.href} style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "11px 0", borderBottom: `1px solid ${LINHA}`,
            color: "#f1ede2", textDecoration: "none", fontSize: 14,
          }}>
            {it.texto}
            <span style={{ color: AZUL, fontSize: 18 }}>›</span>
          </a>
        ))}
      </Bloco>

      {/* Sair pede confirmação: é um clique de arrependimento fácil, ainda por
          cima ao lado de uma lista de links. */}
      {!confirmaSaida ? (
        <button onClick={() => setConfirmaSaida(true)} style={{
          width: "100%", marginTop: 18, background: "transparent",
          border: "1px solid #5a2a28", color: "#ef8d83", fontFamily: FD, fontSize: 14,
          fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em",
          padding: 13, borderRadius: 12, cursor: "pointer",
        }}>
          {t("sair")}
        </button>
      ) : (
        <div style={{
          marginTop: 18, background: CARTA, border: "1px solid #5a2a28",
          borderRadius: 12, padding: 14, textAlign: "center",
        }}>
          <div style={{ fontSize: 14, marginBottom: 12 }}>{t("confirmarSair")}</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setConfirmaSaida(false)} style={{
              flex: 1, background: "transparent", border: `1px solid ${LINHA}`,
              color: "#f1ede2", fontSize: 13, fontWeight: 700, padding: 11,
              borderRadius: 10, cursor: "pointer",
            }}>
              {t("cancelar")}
            </button>
            <button onClick={sair} disabled={aSair} style={{
              flex: 1, background: "#5a2a28", border: 0, color: "#ffd9d5",
              fontSize: 13, fontWeight: 700, padding: 11, borderRadius: 10,
              cursor: aSair ? "default" : "pointer",
            }}>
              {aSair ? t("aSair") : t("simSair")}
            </button>
          </div>
        </div>
      )}

      <p style={{ fontSize: 11, color: "#5f6f7f", textAlign: "center", marginTop: 22 }}>
        Ippon League Academy · {t("versaoTestes")}
      </p>
    </>
  );
}

// O nome da língua escrito ao lado das bandeiras: no Windows as bandeiras
// aparecem como "PT GB ES FR DE" e sem isto não se percebe qual está escolhida.
const NOME_LINGUA: Record<string, string> = {
  pt: "Português", en: "English", es: "Español", fr: "Français", de: "Deutsch",
};

/* ------------------------------------------------------------------ */

function Titulo({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: FD, fontSize: 11, fontWeight: 700, textTransform: "uppercase",
      letterSpacing: "0.06em", color: APAGADO, margin: "20px 0 8px",
    }}>
      {children}
    </div>
  );
}

function Barra({ feito, total }: { feito: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((feito / total) * 100)) : 0;
  return (
    <div style={{ height: 6, borderRadius: 99, background: "#131c2c", overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: AZUL }} />
    </div>
  );
}

function Bloco({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: CARTA, border: `1px solid ${LINHA}`, borderRadius: 16, padding: 16,
    }}>
      {children}
    </div>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", gap: 12,
      padding: "9px 0", borderBottom: `1px solid ${LINHA}`, fontSize: 13.5,
    }}>
      <span style={{ color: APAGADO }}>{rotulo}</span>
      <span style={{ fontWeight: 700, textAlign: "right", wordBreak: "break-all" }}>{valor}</span>
    </div>
  );
}

function Numero({ valor, rotulo, cor }: { valor: number | string; rotulo: string; cor: string }) {
  return (
    <div style={{ flex: 1, textAlign: "center" }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: cor }}>{valor}</div>
      <div style={{ fontSize: 11, color: APAGADO }}>{rotulo}</div>
    </div>
  );
}

/* ---- Os meus dados --------------------------------------------------
   Edita-se AQUI, na Academy, e não noutro produto. Escreve no mesmo sítio
   onde o Fantasy escreve — os dados da conta (auth.updateUser) — por isso
   não há duas verdades: há um formulário de cada lado a mexer no mesmo
   registo, e quem muda num vê mudado no outro.

   O email é o caso especial: mudar exige confirmação no endereço novo, e
   até lá a pessoa continua a entrar com o antigo. */
function MeusDados({ t }: { t: ReturnType<typeof useT> }) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [emailOriginal, setEmailOriginal] = useState("");
  const [telefone, setTelefone] = useState("");
  const [editando, setEditando] = useState(false);
  const [aGuardar, setAGuardar] = useState(false);
  const [aviso, setAviso] = useState("");
  const [pendente, setPendente] = useState("");
  const [ok, setOk] = useState(false);
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    supabase().auth.getSession().then(({ data }) => {
      const u = data.session?.user;
      if (u) {
        const meta = (u.user_metadata ?? {}) as { nome?: string; telefone?: string };
        setNome(meta.nome ?? "");
        setTelefone(meta.telefone ?? "");
        setEmail(u.email ?? "");
        setEmailOriginal(u.email ?? "");
      }
      setPronto(true);
    });
  }, []);

  async function guardar() {
    if (aGuardar) return;
    setAGuardar(true);
    setAviso("");
    setPendente("");
    setOk(false);

    const sb = supabase();
    const { error } = await sb.auth.updateUser({
      data: { nome: nome.trim(), telefone: telefone.trim() },
    });
    if (error) { setAviso(t("erroGuardar")); setAGuardar(false); return; }

    const novo = email.trim();
    const mudou = !!novo && novo.toLowerCase() !== emailOriginal.toLowerCase();
    if (mudou) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(novo)) {
        setAviso(t("emailInvalido")); setAGuardar(false); return;
      }
      const { error: eEmail } = await sb.auth.updateUser({ email: novo });
      if (eEmail) {
        const m = eEmail.message || "";
        setAviso(/already|registered|exists/i.test(m) ? t("emailJaExiste") : t("erroEmail"));
        setAGuardar(false);
        return;
      }
      setPendente(novo);
    }

    setAGuardar(false);
    setOk(true);
    // Com email por confirmar, o painel fica aberto para o aviso se ler.
    if (!mudou) setEditando(false);
  }

  const campo: React.CSSProperties = {
    width: "100%", boxSizing: "border-box", background: "#131c2c",
    border: `1px solid ${LINHA}`, borderRadius: 12, padding: "12px 14px",
    color: "#f1ede2", fontSize: 15, outline: "none", marginBottom: 10,
  };

  if (!pronto) {
    return <Bloco><span style={{ fontSize: 13, color: APAGADO }}>{t("aCarregar")}</span></Bloco>;
  }

  if (!editando) {
    return (
      <Bloco>
        <Linha rotulo={t("nome")} valor={nome || "\u2014"} />
        <Linha rotulo={t("emailLabel")} valor={emailOriginal || "\u2014"} />
        <Linha rotulo={t("telefone")} valor={telefone || "\u2014"} />

        {ok && (
          <p style={{ fontSize: 12, color: "#7fd1a3", margin: "10px 0 0" }}>
            {pendente ? t("emailPendente").replace("%E%", pendente) : t("guardado")}
          </p>
        )}

        <p style={{ fontSize: 11.5, color: APAGADO, lineHeight: 1.45, margin: "10px 0 0" }}>
          {t("dadosPartilhados")} {t("paisNoFantasy")}
        </p>

        <button onClick={() => { setEditando(true); setOk(false); }} style={{
          display: "block", width: "100%", textAlign: "center", marginTop: 10,
          background: "transparent", border: `1px solid ${AZUL}`, color: AZUL,
          fontFamily: FD, fontSize: 13, fontWeight: 700, textTransform: "uppercase",
          letterSpacing: "0.04em", padding: 11, borderRadius: 12, cursor: "pointer",
        }}>
          {t("editarNaIppon")}
        </button>
      </Bloco>
    );
  }

  return (
    <Bloco>
      <Etiqueta>{t("nome")}</Etiqueta>
      <input value={nome} onChange={(e) => setNome(e.target.value)}
             placeholder={t("phNome")} style={campo} />

      <Etiqueta>{t("emailLabel")}</Etiqueta>
      <input value={email} onChange={(e) => setEmail(e.target.value)}
             inputMode="email" autoComplete="email"
             placeholder={t("placeholderEmail")} style={campo} />
      <p style={{ fontSize: 11.5, color: APAGADO, lineHeight: 1.45, margin: "-2px 0 12px" }}>
        {t("emailAviso")}
      </p>

      <Etiqueta>{t("telefoneOpcional")}</Etiqueta>
      <input value={telefone} onChange={(e) => setTelefone(e.target.value)}
             inputMode="tel" placeholder={t("phNumero")} style={campo} />

      {aviso && <div style={{ fontSize: 12, color: "#ef8d83", margin: "4px 0 8px" }}>{aviso}</div>}
      {pendente && (
        <div style={{ fontSize: 12, color: "#7fd1a3", margin: "4px 0 8px", lineHeight: 1.45 }}>
          {t("emailPendente").replace("%E%", pendente)}
        </div>
      )}

      <button onClick={guardar} disabled={aGuardar} className="botao" style={{ marginTop: 6 }}>
        {aGuardar ? t("aGuardar") : t("guardar")}
      </button>
      <button onClick={() => { setEditando(false); setAviso(""); }} style={{
        display: "block", width: "100%", marginTop: 8, background: "transparent",
        border: 0, color: APAGADO, fontSize: 13, cursor: "pointer", padding: 6,
      }}>
        {t("cancelar")}
      </button>
    </Bloco>
  );
}

/* ---- Alterar a senha ------------------------------------------------
   A senha atual é confirmada a entrar outra vez com ela. Sem isso, quem
   apanhasse um telemóvel destrancado mudava a senha sem a saber. */
function AlterarSenha({ t, email }: { t: ReturnType<typeof useT>; email: string }) {
  const [aberto, setAberto] = useState(false);
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [confirma, setConfirma] = useState("");
  const [verSenha, setVerSenha] = useState(false);
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState(false);
  const [aGuardar, setAGuardar] = useState(false);

  async function alterar() {
    if (aGuardar) return;
    if (!atual) { setErro(t("errSenhaAtual")); return; }
    if (nova.length < 6) { setErro(t("errNovaCurta")); return; }
    if (nova !== confirma) { setErro(t("errNaoCoincidem")); return; }
    if (nova === atual) { setErro(t("errIgual")); return; }
    setErro("");
    setAGuardar(true);

    const sb = supabase();
    const { error: eLogin } = await sb.auth.signInWithPassword({ email, password: atual });
    if (eLogin) { setErro(t("errAtualIncorreta")); setAGuardar(false); return; }

    const { error } = await sb.auth.updateUser({ password: nova });
    setAGuardar(false);
    if (error) {
      const m = error.message || "";
      if (/different from the old|should be different/i.test(m)) setErro(t("errIgual"));
      else setErro(t("errAlterarSenha"));
      return;
    }
    setOk(true);
    setAtual(""); setNova(""); setConfirma("");
    setAberto(false);
  }

  const campo: React.CSSProperties = {
    width: "100%", boxSizing: "border-box", background: "#131c2c",
    border: `1px solid ${LINHA}`, borderRadius: 12, padding: "12px 14px",
    color: "#f1ede2", fontSize: 15, outline: "none", marginBottom: 10,
  };

  return (
    <Bloco>
      <button onClick={() => { setAberto((v) => !v); setOk(false); }} style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        width: "100%", background: "transparent", border: 0, color: "#f1ede2",
        fontSize: 14, cursor: "pointer", padding: 0,
      }}>
        <span>{t("alterarSenha")}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {ok && <span style={{ fontSize: 11.5, color: "#7fd1a3" }}>{t("senhaAlterada")}</span>}
          <span style={{ color: AZUL, fontSize: 18 }}>{aberto ? "⌄" : "›"}</span>
        </span>
      </button>

      {aberto && (
        <div style={{ marginTop: 14 }}>
          <Etiqueta>{t("senhaAtual")}</Etiqueta>
          <input value={atual} onChange={(e) => { setAtual(e.target.value); setErro(""); }}
                 type={verSenha ? "text" : "password"} placeholder="••••••••" style={campo} />

          <Etiqueta>{t("novaSenha")}</Etiqueta>
          <input value={nova} onChange={(e) => { setNova(e.target.value); setErro(""); }}
                 type={verSenha ? "text" : "password"} placeholder={t("phMinimo")} style={campo} />

          <Etiqueta>{t("confirmarSenha")}</Etiqueta>
          <input value={confirma} onChange={(e) => { setConfirma(e.target.value); setErro(""); }}
                 type={verSenha ? "text" : "password"} placeholder={t("phMinimo")} style={campo} />

          <button onClick={() => setVerSenha((v) => !v)} style={{
            background: "transparent", border: 0, color: APAGADO, fontSize: 12,
            cursor: "pointer", padding: 0,
          }}>
            {verSenha ? t("esconderSenha") : t("mostrarSenha")}
          </button>

          {erro && <div style={{ fontSize: 12, color: "#ef8d83", margin: "8px 0 0" }}>{erro}</div>}

          <button onClick={alterar} disabled={aGuardar} className="botao" style={{ marginTop: 14 }}>
            {aGuardar ? t("aAlterar") : t("alterarSenha")}
          </button>
        </div>
      )}
    </Bloco>
  );
}

function Etiqueta({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: FD, fontSize: 11, fontWeight: 700, textTransform: "uppercase",
      letterSpacing: "0.05em", color: APAGADO, margin: "0 0 6px",
    }}>
      {children}
    </div>
  );
}

/* ---- O judogui do Dôdo ----------------------------------------------
   Vai buscar e gravar à MESMA API da Ippon League (/api/judogui). Agora que
   os dois vivem no mesmo endereço, isto funciona sem nada de novo — e a cor
   escolhida num lado aparece no outro, que é como deve ser: é o mesmo Dôdo.
   Quem pode mudar é decidido no servidor, nunca aqui. */
function Judogui({
  t, uid, corFaixa,
}: { t: ReturnType<typeof useT>; uid: string | null; corFaixa: string }) {
  const [cor, setCor] = useState<JudoguiCor>("branco");
  const [pode, setPode] = useState(false);
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    if (!uid) return;
    fetch(`/api/judogui?user_id=${encodeURIComponent(uid)}`)
      .then((r) => r.json())
      .then((j) => {
        if (!j?.ok) return;
        if (j.judogui === "azul" || j.judogui === "branco") setCor(j.judogui);
        setPode(!!j.pode);
      })
      .catch(() => { /* fica o branco */ })
      .finally(() => setPronto(true));
  }, [uid]);

  const escolher = useCallback(async (nova: JudoguiCor) => {
    if (!uid || !pode) return;
    const anterior = cor;
    setCor(nova);                       // muda já; se falhar, volta atrás
    try {
      const r = await fetch("/api/judogui", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: uid, judogui: nova }),
      });
      const j = await r.json();
      if (!j?.ok) setCor(anterior);
    } catch {
      setCor(anterior);
    }
  }, [uid, pode, cor]);

  const opcao = (valor: JudoguiCor, rotulo: string) => (
    <button
      key={valor}
      onClick={() => escolher(valor)}
      disabled={!pode}
      style={{
        flex: 1, background: cor === valor ? "#12294a" : "transparent",
        border: `1px solid ${cor === valor ? AZUL : LINHA}`, borderRadius: 12,
        padding: "10px 6px", color: "#f1ede2", fontSize: 13, fontWeight: 700,
        cursor: pode ? "pointer" : "default", opacity: pode ? 1 : .5,
      }}>
      {rotulo}
    </button>
  );

  return (
    <Bloco>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 64, height: 64, flexShrink: 0 }}>
          <Mascot belt={corFaixa} expression="sabio" judogui={cor} />
        </div>
        <div style={{ flex: 1, display: "flex", gap: 8 }}>
          {opcao("branco", t("judoguiBranco"))}
          {opcao("azul", t("judoguiAzul"))}
        </div>
      </div>

      {pronto && !pode && (
        <>
          <p style={{ fontSize: 12, color: APAGADO, lineHeight: 1.45, margin: "12px 0 0" }}>
            {t("judoguiPro")}
          </p>
          <a href="/ippon-pro" style={{
            display: "block", textAlign: "center", marginTop: 10, background: AZUL,
            color: "#06101f", fontFamily: FD, fontSize: 13, fontWeight: 700,
            textTransform: "uppercase", letterSpacing: "0.04em", padding: 11,
            borderRadius: 10, textDecoration: "none",
          }}>
            {t("desbloquearPro")}
          </a>
        </>
      )}
    </Bloco>
  );
}
