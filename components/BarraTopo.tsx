// ===================================================================
// REPOSITÓRIO DO FANTASY (ippon-league) → components/BarraTopo.tsx
// Substitui por completo o ficheiro 71.
//
// Dois Dôdos lado a lado: o verde é o Fantasy, o azul é a Academy. É a
// mesma app, com duas salas — e a barra existe para se ver isso de
// relance, sem ler nada.
//
// Aqui o Fantasy está aceso. O link da Academy é interno (/academy), no
// mesmo endereço: a sessão é a mesma e não há login pelo meio.
//
// Não depende de nada: sem i18n, sem contextos, sem props.
// ===================================================================

const VERDE = "#4DB6AC";   // o Dôdo do Fantasy
const AZUL  = "#4C8DFF";   // o Dôdo da Academy

/** A cabeça do Dôdo, pintada da cor que se lhe der. */
function Dodo({ cor }: { cor: string }) {
  return (
    <svg viewBox="30 8 40 40" width={26} height={26} aria-hidden="true">
      <path
        d="M34,30 C34,18 42,12 50,12 C58,12 66,18 66,30 C66,38 60,43 50,43 C40,43 34,38 34,30 Z"
        fill={cor} stroke="rgba(0,0,0,.28)" strokeWidth="1" />
      <ellipse cx="43.5" cy="26" rx="3.3" ry="3.8" fill="#fff" />
      <ellipse cx="56.5" cy="26" rx="3.3" ry="3.8" fill="#fff" />
      <circle cx="44.3" cy="27" r="1.9" fill="#1A237E" />
      <circle cx="55.7" cy="27" r="1.9" fill="#1A237E" />
      <ellipse cx="50" cy="37" rx="11" ry="4.6" fill="#FF8F00" stroke="#E65100" strokeWidth="0.7" />
    </svg>
  );
}

const meio = {
  flex: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 7,
  padding: "6px 0",
  borderRadius: 10,
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: .2,
  textDecoration: "none",
};

export function BarraTopo() {
  return (
    <nav style={{
      position: "sticky", top: 0, zIndex: 40,
      display: "flex", gap: 6,
      padding: "6px 12px",
      paddingTop: "calc(6px + env(safe-area-inset-top))",
      background: "#0c0e0d", borderBottom: "1px solid #23262a",
    }}>
      {/* aceso: é onde a pessoa está */}
      <span style={{
        ...meio, color: "#C9A227",
        background: "rgba(201,162,39,.13)", border: "1px solid #3a3320",
      }}>
        <Dodo cor={VERDE} />
        Fantasy
      </span>

      {/* apagado: a outra sala, no mesmo endereço */}
      <a href="/academy" style={{ ...meio, color: "#7c8ba1", opacity: .72 }}>
        <Dodo cor={AZUL} />
        Academy
      </a>
    </nav>
  );
}
