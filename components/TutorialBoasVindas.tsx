"use client";

// components/TutorialBoasVindas.tsx
//
// O QUE É
// O percurso de boas-vindas de quem acabou de subscrever. Aparece uma vez, na
// central respetiva, logo depois do pagamento.
//
// PORQUE EXISTE
// Alguém que paga e não percebe o que comprou cancela ao fim de um mês. O
// momento a seguir ao pagamento é aquele em que a pessoa está mais disponível
// para aprender — e era o momento em que não lhe dizíamos nada.
//
// ---------------------------------------------------------------------------
// TRÊS PERCURSOS, NÃO UM
//
//   gratis -> pro       : mostra tudo o que o Pro dá
//   pro    -> promax    : mostra SÓ A DIFERENÇA (ele já conhece o Pro)
//   gratis -> promax    : mostra tudo, Pro e Pro Max juntos
//
// A distinção importa: repetir a um Pro tudo o que ele já usa há semanas faz o
// tutorial parecer ruído, e a parte nova — a que ele acabou de pagar — perde-se
// no meio.
// ---------------------------------------------------------------------------
//
// COMO NAVEGA
// NÃO leva a pessoa de página em página. Um tutorial que navega perde o passo
// em que ia, e obriga cada página a saber que está a meio de um percurso.
//
// Em vez disso: cada passo tem um botão que ABRE o sítio de que fala. Quem
// quiser ir, vai (e o tutorial fica marcado como visto); quem não quiser,
// continua. O destino abre no mesmo separador, como qualquer link da app.
//
// ONDE FICA GUARDADO
// No lib/tutorials.ts, que grava no user_metadata — sobrevive a logins e a
// troca de telemóvel. É a mesma casa dos outros tutoriais da app.
//
// (O nível de subscrição é que NUNCA vem do metadata. Preferências, sim.)

import { useEffect, useState } from "react";
import { Mascot } from "@/components/Mascot";
import { marcarTutorialVisto, type TutKey } from "@/lib/tutorials";

const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";
const MAX = "#7fb8f5";

export type PercursoTutorial = "pro" | "promax" | "promax_direto";

interface Passo {
  titulo: string;
  texto: string;
  /** Para onde este passo leva, se a pessoa quiser ver. */
  href?: string;
  rotulo?: string;
}

// ---------------------------------------------------------------------------
// OS PASSOS
//
// Cada um responde a "o que ganhei com isto", não "onde fica o botão". A pessoa
// acabou de pagar: o que ela quer saber é o que mudou na vida dela.
// ---------------------------------------------------------------------------

const PASSOS_PRO: Passo[] = [
  {
    titulo: "Bem-vindo ao Ippon Pro",
    texto:
      "Deixaste de jogar às escuras. A partir de agora tens a análise da tua equipa, o histórico de cada atleta e a dica de capitão antes de cada rodada.",
  },
  {
    titulo: "O scout da tua equipa",
    texto:
      "Vê a média de cada um dos teus 8 atletas ao nível desta competição, e o dossiê completo de qualquer um deles. É o que separa uma escalação por instinto de uma escalação por dados.",
    href: "/pro",
    rotulo: "Ver o meu scout",
  },
  {
    titulo: "A chave das competições",
    texto:
      "O quadro de lutas de cada categoria, com o caminho de cada atleta até à final. Dá para perceber quem apanha um percurso fácil e quem vai ter de passar pelos favoritos.",
    href: "/chave-atletas",
    rotulo: "Ver a chave",
  },
  {
    titulo: "As ligas oficiais",
    texto:
      "Entraste automaticamente na Liga Mundial e na liga do teu continente. Não precisas de fazer nada: os pontos das tuas rodadas já lá contam.",
    href: "/oficial/mundial",
    rotulo: "Ver a Liga Mundial",
  },
  {
    titulo: "Até 5 ligas",
    texto:
      "Podes criar e disputar até cinco ligas de amigos ao mesmo tempo, e outras tantas copas de mata-mata. Cada uma com o seu ranking.",
    href: "/ligas",
    rotulo: "Ver as minhas ligas",
  },
];

const PASSOS_PROMAX: Passo[] = [
  {
    titulo: "Bem-vindo ao Pro Max",
    texto:
      "Tens tudo o que o Pro dá — e mais quatro coisas que só existem aqui. Vamos a elas.",
  },
  {
    titulo: "A chave AO VIVO",
    texto:
      "No Pro a chave está congelada: vês como começou e como acabou. Aqui vês o que está a acontecer agora, luta a luta, enquanto a competição decorre.",
    href: "/chave-atletas",
    rotulo: "Ver a chave ao vivo",
  },
  {
    titulo: "Aviso quando o teu atleta vai lutar",
    texto:
      "Marcas os teus favoritos e recebes um aviso no telemóvel pouco antes de cada um entrar no tatame. Deixas de perder as lutas que te interessam.",
    href: "/atletas",
    rotulo: "Escolher favoritos",
  },
  {
    titulo: "A Copa do Dôdo",
    texto:
      "O mata-mata mundial entre continentes. Seis vagas por continente, entrada por sorteio, e só quem é Pro ou Pro Max pode disputar. Representas o teu país.",
    href: "/dodo",
    rotulo: "Ver a Copa",
  },
  {
    titulo: "A comunidade",
    texto:
      "Um grupo de WhatsApp só para membros Pro Max: notícias, conversa sobre as rodadas e o sítio onde as tuas ideias chegam primeiro. A entrada é aprovada por um administrador.",
    href: "/pro-max-central",
    rotulo: "Entrar no grupo",
  },
  {
    titulo: "E o dobro de tudo",
    texto:
      "Até 10 ligas e 10 copas, o dobro do Pro. Mais a cor do tatame e a cor do judogui do teu Dôdo — só tu tens.",
    href: "/pro-max-central",
    rotulo: "Personalizar",
  },
];

// Quem vai direto de grátis para Pro Max leva os dois, sem a introdução do Pro
// Max (que fala em "tudo o que o Pro dá" a quem nunca foi Pro).
const PASSOS_PROMAX_DIRETO: Passo[] = [
  {
    titulo: "Bem-vindo ao Ippon Pro Max",
    texto:
      "Foste direto ao pacote completo. Tens tudo: os dados que o Pro dá e as vantagens exclusivas do Max. Vamos ver o que mudou.",
  },
  ...PASSOS_PRO.slice(1),
  ...PASSOS_PROMAX.slice(1),
];

function passosDe(percurso: PercursoTutorial): Passo[] {
  if (percurso === "pro") return PASSOS_PRO;
  if (percurso === "promax") return PASSOS_PROMAX;
  return PASSOS_PROMAX_DIRETO;
}

function chaveDe(percurso: PercursoTutorial): TutKey {
  return percurso === "pro" ? "ippon_boasvindas_pro" : "ippon_boasvindas_promax";
}

// ---------------------------------------------------------------------------

export function TutorialBoasVindas({
  percurso,
  cor,
  nome,
  onFechar,
}: {
  percurso: PercursoTutorial;
  /** Cor da faixa do jogador, para o Dôdo aparecer com a faixa certa. */
  cor: string;
  /** Nome próprio, para o primeiro passo cumprimentar. */
  nome?: string;
  onFechar: () => void;
}) {
  const passos = passosDe(percurso);
  const [passo, setPasso] = useState(0);
  const total = passos.length;
  const s = passos[passo];
  const ultimo = passo === total - 1;
  const cimo = percurso === "pro" ? GOLD : MAX;

  // Escape fecha, como em qualquer janela da app.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") fechar(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function fechar() {
    // Marca como visto ao FECHAR, seja por concluir, por saltar ou por sair
    // num passo do meio. Quem viu metade não quer ver a primeira metade outra
    // vez — e pode sempre reabrir a partir da área Pro.
    marcarTutorialVisto(chaveDe(percurso));
    onFechar();
  }

  return (
    <div
      onClick={fechar}
      style={{ position: "fixed", inset: 0, zIndex: 130, background: "rgba(0,0,0,0.78)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 420, background: "#121815", border: `1.5px solid ${cimo}`, borderRadius: 18, padding: "16px 16px 18px" }}
      >
        {/* Barra de progresso: quantos passos faltam, de relance. */}
        <div style={{ display: "flex", gap: 5, marginBottom: 14 }}>
          {passos.map((_, i) => (
            <div key={i} style={{ flex: 1, height: 3, borderRadius: 999, background: i <= passo ? cimo : "#2a3a33" }} />
          ))}
        </div>

        <div style={{ textAlign: "right", marginTop: -6, marginBottom: 2 }}>
          <button
            onClick={fechar}
            style={{ background: "transparent", border: "none", color: "#7c8a82", fontSize: 11.5, cursor: "pointer", fontFamily: FB }}
          >
            Não mostrar mais ✕
          </button>
        </div>

        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <div style={{ width: 62, height: 62, flexShrink: 0 }}>
            <Mascot belt={cor} expression={passo === 0 ? "comemorando" : "indicando"} />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: FD, fontSize: 15, fontWeight: 700, textTransform: "uppercase", color: cimo, lineHeight: 1.25, marginBottom: 6 }}>
              {passo === 0 && nome ? `${s.titulo}, ${nome}!` : s.titulo}
            </div>
            <p style={{ fontSize: 13, color: "#c7d0c9", lineHeight: 1.55, margin: 0 }}>{s.texto}</p>
          </div>
        </div>

        {/* O passo LEVA lá, se a pessoa quiser. Não é o tutorial que navega:
            é ela que decide. Ao tocar, fica visto — já viu o que interessava. */}
        {s.href && (
          <a
            href={s.href}
            onClick={() => marcarTutorialVisto(chaveDe(percurso))}
            style={{ display: "block", textAlign: "center", marginTop: 14, background: "transparent", border: `1px solid ${cimo}`, color: cimo, fontFamily: FD, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", padding: "10px", borderRadius: 10, textDecoration: "none" }}
          >
            {s.rotulo || "Ver"} →
          </a>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16 }}>
          <button
            onClick={() => passo > 0 && setPasso(passo - 1)}
            disabled={passo === 0}
            style={{ background: "transparent", border: "none", color: passo === 0 ? "#3c463f" : "#93a39a", fontSize: 13, fontWeight: 700, cursor: passo === 0 ? "default" : "pointer", fontFamily: FB }}
          >
            Anterior
          </button>

          <span style={{ fontSize: 11, color: "#5f6f67" }}>{passo + 1} de {total}</span>

          <button
            onClick={() => (ultimo ? fechar() : setPasso(passo + 1))}
            style={{ background: cimo, border: "none", color: "#0b1220", padding: "9px 20px", borderRadius: 10, fontFamily: FD, fontSize: 13, fontWeight: 700, textTransform: "uppercase", cursor: "pointer" }}
          >
            {ultimo ? "Começar" : "Seguinte"}
          </button>
        </div>
      </div>
    </div>
  );
}
