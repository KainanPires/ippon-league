"use client";

// components/AvisoEquipaGuardada.tsx
//
// O QUE ACONTECE A SEGUIR — aviso mostrado logo depois de guardar a equipa.
//
// PORQUÊ: feedback real de quem testou. A pessoa montava os 8 atletas, escolhia
// o capitão, guardava... e ficava parada, sem saber o que fazer a seguir. O jogo
// não lhe dizia quando é a competição, nem que depois vai ver os pontos e
// comparar-se com os amigos. Sem isso, o fim da montagem é um beco — e é
// justamente o momento em que a pessoa está mais disponível para se entusiasmar.
//
// É também o melhor momento para CONVIDAR alguém: acabou de investir tempo a
// montar a equipa, e um fantasy game sem adversários conhecidos é metade do
// jogo. Por isso o botão de convite vive aqui, e não escondido num menu.
//
// AUTOSSUFICIENTE: descobre sozinho a competição-alvo (focoMercado().alvo), o
// número da rodada e quantos dias faltam. Quem o usa não tem de calcular nada —
// basta `<AvisoEquipaGuardada onFechar={...} />`. As props existem só para casos
// em que se queira forçar outra competição.
//
// Aparece uma vez e tem "Não mostrar mais", guardado NA CONTA (não só neste
// aparelho): quem já percebeu o ciclo não precisa de o rever noutro telemóvel.
//
// Uso:
//   const [aviso, setAviso] = useState(false);
//   // depois de guardar com sucesso:
//   if (await deveMostrarTutorial("ippon_aviso_pos_guardar")) setAviso(true);
//   ...
//   {aviso && <AvisoEquipaGuardada onFechar={() => { setAviso(false); router.push("/meu-time"); }} />}

import { useState } from "react";
import { Mascot } from "@/components/Mascot";
import { useFaixa } from "@/lib/useFaixa";
import { marcarTutorialVisto } from "@/lib/tutorials";
import { focoMercado, nomeCompeticao, numeroDaRodada, CALENDARIO_2026, type SemanaCalendario } from "@/lib/calendario";
import { useT } from "@/lib/i18n";

const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";
const VERDE = "#3f8f5a";

// Quantos dias faltam até a competição COMEÇAR. 0 = é hoje.
// Usa a hora oficial quando existe (inicioUTC); senão, o dia do calendário.
function diasAteInicio(s: SemanaCalendario): number {
  const inicio = s.inicioUTC
    ? new Date(s.inicioUTC)
    : new Date(s.de.replace(/\//g, "-") + "T00:00:00");
  const ms = inicio.getTime() - Date.now();
  if (ms <= 0) return 0;
  return Math.ceil(ms / 86400000);
}

export function AvisoEquipaGuardada({
  nomeCompeticao: nomeProp,
  rodada: rodadaProp,
  idCompeticao,
  onFechar,
}: {
  /** Nome a mostrar (já com a cidade escondida, se for clássico). Opcional. */
  nomeCompeticao?: string | null;
  /** Número da rodada no calendário (1..52). Opcional. */
  rodada?: number | null;
  /** Forçar outra competição que não a alvo do momento. Opcional. */
  idCompeticao?: string | null;
  /** Fechar o aviso. O chamador decide para onde vai a seguir. */
  onFechar: () => void;
}) {
  const t = useT();
  const { cor } = useFaixa();
  const [copiado, setCopiado] = useState(false);

  // Competição para a qual se acabou de escalar. Por omissão, a alvo do momento.
  const alvo = idCompeticao
    ? (CALENDARIO_2026.find((c) => c.idCompeticao === String(idCompeticao)) ?? focoMercado().alvo)
    : focoMercado().alvo;

  const nome = nomeProp ?? nomeCompeticao(alvo);
  const rodada = rodadaProp ?? numeroDaRodada(alvo.idCompeticao);
  const dias = diasAteInicio(alvo);

  // "é já hoje" / "é já amanhã" / "é daqui a 4 dias" — linguagem natural, que
  // é o que a pessoa quer saber ("quando é que vejo os meus pontos?").
  const quando = dias <= 0 ? t("aeg.hoje") : dias === 1 ? t("aeg.amanha") : t("aeg.emDias", { dias });

  const rotuloAlvo = rodada
    ? t("aeg.rodadaN", { n: rodada }) + (nome ? ` · ${nome}` : "")
    : (nome || t("aeg.proximaRodada"));

  async function naoMostrarMais() {
    await marcarTutorialVisto("ippon_aviso_pos_guardar");
    onFechar();
  }

  // CONVIDAR: usa a partilha nativa do telemóvel quando existe (WhatsApp,
  // Instagram, o que a pessoa tiver); no computador, copia para a área de
  // transferência e diz que copiou. Nunca deixa o utilizador sem saída.
  async function convidar() {
    const url = typeof window !== "undefined" ? window.location.origin : "https://ipponleague.com";
    const onde = nome ? t("aeg.emComp", { nome }) : "";
    const texto = t("aeg.partilhaTexto", { onde });
    try {
      const nav = navigator as Navigator & { share?: (d: { title?: string; text?: string; url?: string }) => Promise<void> };
      if (nav.share) {
        await nav.share({ title: "Ippon League", text: texto, url });
        return;
      }
    } catch {
      return; // cancelou a partilha: não faz mais nada
    }
    try {
      await navigator.clipboard.writeText(`${texto} ${url}`);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch { /* sem área de transferência: o botão apenas não reage */ }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(6,8,7,0.82)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18, zIndex: 120 }}>
      <div style={{ width: "100%", maxWidth: 340, maxHeight: "92vh", overflowY: "auto", background: "#121815", border: `1px solid ${GOLD}`, borderRadius: 16, padding: "20px 18px", fontFamily: FB }}>
        <div style={{ width: 84, height: 84, margin: "0 auto 4px" }}>
          <Mascot belt={cor} expression="comemorando" />
        </div>

        <h2 style={{ fontFamily: FD, fontSize: 20, fontWeight: 700, textTransform: "uppercase", textAlign: "center", margin: "4px 0 12px", color: GOLD }}>
          {t("aeg.titulo")}
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 11, marginBottom: 16 }}>
          <Passo n="1" titulo={dias <= 1 ? t("aeg.jaASeguir") : t("aeg.faltamDias", { dias })}>
            {t("aeg.passo1").split(/(%[AB]%)/).map((s, i) =>
              s === "%A%" ? <strong key={i} style={{ color: "#f1ede2" }}>{rotuloAlvo}</strong>
              : s === "%B%" ? <strong key={i} style={{ color: GOLD }}>{quando}</strong>
              : s
            )}
          </Passo>
          <Passo n="2" titulo={t("aeg.passo2Tit")}>
            {t("aeg.passo2").split(/(%[ABC]%)/).map((s, i) =>
              s === "%A%" ? <strong key={i} style={{ color: "#f1ede2" }}>ippon</strong>
              : s === "%B%" ? <strong key={i} style={{ color: "#f1ede2" }}>waza-ari</strong>
              : s === "%C%" ? <strong key={i} style={{ color: "#f1ede2" }}>{t("aeg.shidoProvocado")}</strong>
              : s
            )}
          </Passo>
          <Passo n="3" titulo={t("aeg.passo3Tit")}>
            {t("aeg.passo3")}
          </Passo>
        </div>

        {/* CONVITE — o momento certo para chamar alguém: a pessoa acabou de
            montar a equipa e ainda não tem com quem competir. */}
        <div style={{ background: "#101511", border: "1px dashed #2f4a3c", borderRadius: 12, padding: "12px 13px", marginBottom: 16 }}>
          <div style={{ fontFamily: FD, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", color: "#aee9c9", marginBottom: 4 }}>
            {t("aeg.maisDivertido")}
          </div>
          <p style={{ fontSize: 12.5, color: "#c7d0c9", lineHeight: 1.5, margin: "0 0 10px" }}>
            {t("aeg.conviteCorpo")}
          </p>
          <button
            onClick={convidar}
            style={{ width: "100%", padding: 11, borderRadius: 10, border: "none", background: copiado ? "#1c3a2e" : VERDE, color: copiado ? "#aee9c9" : "#06140d", fontFamily: FD, fontSize: 13.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
          >
            {copiado ? (
              <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg>
                {t("aeg.conviteCopiado")}
              </>
            ) : (
              <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" /></svg>
                {t("aeg.convidarAmigo")}
              </>
            )}
          </button>
        </div>

        <p style={{ fontSize: 12, color: "#93a39a", lineHeight: 1.5, textAlign: "center", margin: "0 0 14px" }}>
          {t("aeg.podesVoltar")}
        </p>

        <button
          onClick={onFechar}
          style={{ width: "100%", padding: 13, borderRadius: 12, border: "none", background: GOLD, color: "#1b211e", fontFamily: FD, fontSize: 15, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", cursor: "pointer" }}
        >
          {t("aeg.entendi")}
        </button>
        <button
          onClick={naoMostrarMais}
          style={{ display: "block", width: "100%", marginTop: 10, background: "transparent", border: "none", color: "#93a39a", fontSize: 12, cursor: "pointer", fontFamily: FB }}
        >
          {t("aeg.naoMostrarMais")}
        </button>
      </div>
    </div>
  );
}

function Passo({ n, titulo, children }: { n: string; titulo: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 11, alignItems: "flex-start" }}>
      <span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: "50%", background: "#1c3a2e", color: "#aee9c9", fontFamily: FD, fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", marginTop: 1 }}>
        {n}
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: FD, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", color: "#aee9c9", marginBottom: 2 }}>{titulo}</div>
        <p style={{ fontSize: 12.5, color: "#c7d0c9", lineHeight: 1.5, margin: 0 }}>{children}</p>
      </div>
    </div>
  );
}
