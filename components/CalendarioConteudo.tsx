// Miolo do Calendário 2026 — usado como aba dentro de /ligas.
// Só o conteúdo (explicação + lista das 52 semanas); sem header nem navegação,
// para encaixar em qualquer ecrã. Regra do "clássico cego":
//  - Competição real: mostra nome e nível sempre.
//  - Clássico com mercado ABERTO: "Clássico Nº {rodada}" + nível e ano (sem dizer
//    qual). No DIA (mercado fechado), revela o nome completo com a cidade.
// Estados: passada (cinza), a decorrer (verde), próxima (dourado a pulsar), futura.

import {
  CALENDARIO_2026,
  estadoMercado,
  competicaoFechada,
  focoMercado,
  type SemanaCalendario,
} from "@/lib/calendario";

const FD = "var(--font-geist-mono), system-ui, sans-serif";
const GOLD = "#d9a441";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
function dataCurta(de: string): string {
  const [, m, d] = de.split("/").map((x) => parseInt(x, 10));
  return `${d} ${MESES[(m || 1) - 1]}`;
}
function nomeSemClassico(nome: string): string {
  return nome.replace(/\s*[—-]\s*Cl[áa]ssico\s*$/i, "");
}

type Estado = "passada" | "aDecorrer" | "proxima" | "futura";

export function CalendarioConteudo() {
  const foco = focoMercado();
  const alvoId = foco.alvo.idCompeticao;
  const lista = [...CALENDARIO_2026].sort((a, b) => a.semana - b.semana);

  return (
    <div>
      <style>{`@keyframes pulsoOuro {
        0%,100% { box-shadow: 0 0 0 0 rgba(217,164,65,0.0); }
        50% { box-shadow: 0 0 0 3px rgba(217,164,65,0.22); }
      }`}</style>

      {/* O que é um clássico — explicação fixa no topo. */}
      <div style={{ background: "#181410", border: "1px dashed #3a3320", borderRadius: 14, padding: "13px 14px", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 16 }}>🥋</span>
          <span style={{ fontFamily: FD, fontSize: 12.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "#e6c97a" }}>O que é um clássico?</span>
        </div>
        <p style={{ fontSize: 12.5, color: "#c7d0c9", lineHeight: 1.55, margin: 0 }}>
          Um clássico é uma grande competição dos últimos anos — <strong style={{ color: "#f1ede2" }}>Grand Prix, Grand Slam, Mundiais e Olimpíadas</strong> — que reavivamos nas semanas sem competição oficial. Serve de base à pontuação e relembra grandes momentos do judô, para haver jogo toda a semana. Vês o <strong style={{ color: "#f1ede2" }}>nível e o ano</strong>, mas <strong style={{ color: "#e6c97a" }}>o nome só se revela no dia</strong>.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {lista.map((s) => (
          <CartaoSemana key={s.semana} s={s} alvoId={alvoId} />
        ))}
      </div>
    </div>
  );
}

function CartaoSemana({ s, alvoId }: { s: SemanaCalendario; alvoId: string }) {
  const mkt = estadoMercado(s);
  const estado: Estado = competicaoFechada(s)
    ? "passada"
    : mkt.estado === "fechado"
    ? "aDecorrer"
    : s.idCompeticao === alvoId
    ? "proxima"
    : "futura";

  const cego = s.classico && mkt.estado === "aberto";
  const anoCego = s.anoOriginal ? ` ${s.anoOriginal}` : "";
  const titulo = cego ? `Clássico Nº ${s.semana}` : nomeSemClassico(s.nome);

  const corBorda =
    estado === "passada" ? "#1a221d" :
    estado === "aDecorrer" ? "#2f7d54" :
    estado === "proxima" ? GOLD :
    cego ? "#3a3320" : "#243029";
  const opacidade = estado === "passada" ? 0.5 : 1;
  const corNum =
    estado === "passada" ? "#5f6f67" :
    estado === "aDecorrer" ? "#7fd1a3" :
    estado === "proxima" ? GOLD : "#cfd8d2";
  const corTitulo = estado === "passada" ? "#7c8a82" : cego ? "#e6c97a" : "#f1ede2";

  return (
    <div style={{
      background: estado === "proxima" ? "#15170f" : "#121815",
      border: `1px solid ${corBorda}`,
      borderRadius: 14, display: "flex", alignItems: "center", gap: 12, padding: "12px 13px",
      opacity: opacidade,
      animation: estado === "proxima" ? "pulsoOuro 2.2s ease-in-out infinite" : undefined,
    }}>
      <div style={{ width: 42, flexShrink: 0, textAlign: "center" }}>
        <div style={{ fontSize: 9, color: "#7c8a82", textTransform: "uppercase", letterSpacing: "0.05em" }}>Rodada</div>
        <div style={{ fontFamily: FD, fontSize: 19, fontWeight: 700, color: corNum }}>{s.semana}</div>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: corTitulo }}>{titulo}</span>
          {s.classico && !cego && <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#1b211e", background: GOLD, borderRadius: 999, padding: "1px 7px" }}>Clássico</span>}
          {estado === "proxima" && <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: GOLD }}>· próxima</span>}
          {estado === "aDecorrer" && <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#7fd1a3" }}>· a decorrer</span>}
          {estado === "passada" && <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#5f6f67" }}>· terminada</span>}
        </div>
        <div style={{ fontSize: 11.5, color: estado === "passada" ? "#5f6f67" : "#93a39a", marginTop: 2 }}>
          {dataCurta(s.de)}
          {cego ? <> · {s.nivel}{anoCego}</> : <> · {s.nivel}</>}
        </div>
      </div>
    </div>
  );
}
