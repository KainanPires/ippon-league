// ===================================================================
// REPOSITÓRIO DO FANTASY (ippon-league) → components/BarraTopo.tsx
//
// É o espelho da barra que a Academy tem: dois separadores, um para cada
// produto. Aqui o "Fantasy" está aceso e o "Academy" é o link.
//
// Como a sessão vive no cookie de .ipponleague.com, quem salta de um lado
// para o outro já vai lá dentro autenticado. Para quem usa, é uma app com
// duas secções.
//
// As cores seguem o preto do Fantasy (#0c0e0d), não o azul da Academy.
//
// Não depende de nada: sem i18n, sem contextos, sem props. Se um dia
// quiseres traduzir os rótulos, são as duas palavras lá em baixo.
// ===================================================================

const ACADEMY = "https://academy.ipponleague.com";

export function BarraTopo() {
  const base = {
    flex: 1,
    textAlign: "center" as const,
    padding: "7px 0",
    borderRadius: 9,
    fontSize: 13,
    fontWeight: 700,
    textDecoration: "none",
    letterSpacing: .2,
  };

  return (
    <nav style={{
      position: "sticky", top: 0, zIndex: 40,
      display: "flex", gap: 6,
      padding: "8px 12px",
      paddingTop: "calc(8px + env(safe-area-inset-top))",
      background: "#0c0e0d", borderBottom: "1px solid #23262a",
    }}>
      {/* aceso: é onde a pessoa está */}
      <span style={{ ...base, background: "#C9A227", color: "#141110" }}>
        Fantasy
      </span>
      {/* apagado: o outro lado */}
      <a href={ACADEMY} style={{ ...base, color: "#4C8DFF", border: "1px solid #23262a" }}>
        Academy
      </a>
    </nav>
  );
}
