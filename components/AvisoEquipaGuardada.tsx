"use client";

// components/AvisoEquipaGuardada.tsx
//
// O QUE ACONTECE A SEGUIR — aviso mostrado logo depois de guardar a equipa.
//
// PORQUÊ: feedback real de quem testou. A pessoa montava os 8 atletas, escolhia
// o capitão, guardava... e ficava parada, sem saber o que fazer a seguir. O jogo
// não lhe dizia que agora é esperar pela competição do fim de semana, nem que na
// segunda-feira vai ver os pontos e comparar-se com os amigos. Sem isso, o fim
// da montagem é um beco — e é justamente o momento em que a pessoa está mais
// disponível para se entusiasmar.
//
// Aparece uma vez e tem "Não mostrar mais", guardado NA CONTA (não só neste
// aparelho): quem já percebeu o ciclo não precisa de o rever noutro telemóvel.
//
// O Dôdo aparece com a FAIXA REAL do jogador (useFaixa), como em todo o lado.
//
// Uso:
//   const [aviso, setAviso] = useState(false);
//   // depois de guardar com sucesso:
//   if (await deveMostrarTutorial("ippon_aviso_pos_guardar")) setAviso(true);
//   ...
//   {aviso && <AvisoEquipaGuardada nomeCompeticao={nomeAlvo} rodada={rodadaAlvo}
//                                  onFechar={() => { setAviso(false); router.push("/meu-time"); }} />}

import { Mascot } from "@/components/Mascot";
import { useFaixa } from "@/lib/useFaixa";
import { marcarTutorialVisto } from "@/lib/tutorials";

const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";

export function AvisoEquipaGuardada({
  nomeCompeticao,
  rodada,
  onFechar,
}: {
  /** Nome a mostrar da competição para a qual escalou (já com a cidade escondida, se for clássico). */
  nomeCompeticao?: string | null;
  /** Número da rodada no calendário (1..52), se conhecido. */
  rodada?: number | null;
  /** Fechar o aviso. O chamador decide para onde vai a seguir. */
  onFechar: () => void;
}) {
  const { cor } = useFaixa();

  const alvo = rodada
    ? `a Rodada ${rodada}${nomeCompeticao ? ` · ${nomeCompeticao}` : ""}`
    : (nomeCompeticao || "a próxima rodada");

  async function naoMostrarMais() {
    await marcarTutorialVisto("ippon_aviso_pos_guardar");
    onFechar();
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(6,8,7,0.82)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18, zIndex: 120 }}>
      <div style={{ width: "100%", maxWidth: 340, background: "#121815", border: `1px solid ${GOLD}`, borderRadius: 16, padding: "20px 18px", fontFamily: FB }}>
        <div style={{ width: 84, height: 84, margin: "0 auto 4px" }}>
          <Mascot belt={cor} expression="comemorando" />
        </div>

        <h2 style={{ fontFamily: FD, fontSize: 20, fontWeight: 700, textTransform: "uppercase", textAlign: "center", margin: "4px 0 12px", color: GOLD }}>
          Equipa guardada! E agora?
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 11, marginBottom: 18 }}>
          <Passo n="1" titulo="Agora é aguardar">
            A tua equipa está escalada para <strong style={{ color: "#f1ede2" }}>{alvo}</strong>. A competição é ao fim de semana — até lá não tens de fazer nada.
          </Passo>
          <Passo n="2" titulo="Os teus atletas pontuam">
            Cada <strong style={{ color: "#f1ede2" }}>ippon</strong>, <strong style={{ color: "#f1ede2" }}>waza-ari</strong> e <strong style={{ color: "#f1ede2" }}>shido provocado</strong> conta para ti. O teu capitão pontua a dobrar.
          </Passo>
          <Passo n="3" titulo="Depois, a contagem">
            Quando a competição acabar vês quantos pontos fizeste, se o teu património subiu, e como ficaste face aos teus amigos e ao ranking mundial.
          </Passo>
        </div>

        <p style={{ fontSize: 12, color: "#93a39a", lineHeight: 1.5, textAlign: "center", margin: "0 0 16px" }}>
          Podes voltar e mudar a equipa até o mercado fechar.
        </p>

        <button
          onClick={onFechar}
          style={{ width: "100%", padding: 13, borderRadius: 12, border: "none", background: GOLD, color: "#1b211e", fontFamily: FD, fontSize: 15, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", cursor: "pointer" }}
        >
          Entendi
        </button>
        <button
          onClick={naoMostrarMais}
          style={{ display: "block", width: "100%", marginTop: 10, background: "transparent", border: "none", color: "#93a39a", fontSize: 12, cursor: "pointer", fontFamily: FB }}
        >
          Não mostrar mais
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
