import { scoreAthlete, type ActionType } from "@/lib/engine";

type Athlete = {
  name: string;
  country: string;
  category: string;
  price: number;
  variation: number; // valorização da rodada em %
  isCaptain?: boolean;
  actions: ActionType[];
};

const TEAM = {
  teamName: "Dojo dos Sonhos",
  belt: "Roxa",
  patrimony: 100,
  balance: 2,
  rankNational: 14,
  roundPosition: 3,
};

const ATHLETES: Athlete[] = [
  { name: "Hifumi Abe", country: "JPN", category: "-66kg", price: 18, variation: 8, isCaptain: true, actions: ["ippon_feito", "waza_ari_feito", "shido_provocado"] },
  { name: "C. Agbegnenou", country: "FRA", category: "-63kg", price: 17, variation: 12, actions: ["ippon_feito", "ippon_feito"] },
  { name: "Teddy Riner", country: "FRA", category: "+100kg", price: 16, variation: -4, actions: ["waza_ari_feito", "shido_provocado"] },
  { name: "Tato Grigalashvili", country: "GEO", category: "-81kg", price: 13, variation: 3, actions: ["ippon_feito"] },
  { name: "Lasha Bekauri", country: "GEO", category: "-90kg", price: 12, variation: 6, actions: ["ippon_feito", "shido_recebido"] },
  { name: "Christa Deguchi", country: "CAN", category: "-57kg", price: 11, variation: 5, actions: ["waza_ari_feito", "yuko_feito"] },
  { name: "D. Krasniqi", country: "KOS", category: "-48kg", price: 6, variation: -2, actions: ["yuko_feito", "shido_provocado"] },
  { name: "Joana Ramos", country: "POR", category: "-52kg", price: 5, variation: 9, actions: ["waza_ari_feito"] },
];

const FONT_DISPLAY = "var(--font-geist-mono), system-ui, sans-serif";
const FONT_BODY = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";

// Cor da faixa do jogador (muda o mascote conforme o nível do mês)
const BELT_HEX: Record<string, string> = {
  Branca: "#efeadd",
  Azul: "#2f6fb3",
  Amarela: "#e6c84f",
  Verde: "#3f8f5a",
  Roxa: "#7a4fa3",
  Marrom: "#6b4226",
  Preta: "#141110",
};

// Mensagem determinada do mascote conforme a posição na rodada
function roundMessage(pos: number): string {
  if (pos <= 1) return "Líder da rodada — segura o topo!";
  if (pos <= 3) return `${pos}º na rodada — vamos ao 1º!`;
  if (pos <= 10) return `${pos}º — bora subir no ranking!`;
  return `${pos}º — recuperação na próxima!`;
}

function KimonoAvatar({ country, captain }: { country: string; captain?: boolean }) {
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "1 / 1",
        borderRadius: 12,
        background: captain ? "rgba(31,66,52,0.55)" : "rgba(12,14,13,0.28)",
        border: captain ? `2px solid ${GOLD}` : "1px solid rgba(0,0,0,0.22)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        padding: 6,
      }}
    >
      <svg viewBox="0 0 100 112" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <path d="M31,29 L11,33 L7,53 L21,57 L32,46 Z" fill="#f6f3ea" stroke="#ccc5b2" strokeWidth="1" strokeLinejoin="round" />
        <path d="M69,29 L89,33 L93,53 L79,57 L68,46 Z" fill="#f6f3ea" stroke="#ccc5b2" strokeWidth="1" strokeLinejoin="round" />
        <path d="M30,27 L70,27 L73,80 L71,101 L29,101 L27,80 Z" fill="#f6f3ea" stroke="#ccc5b2" strokeWidth="1" strokeLinejoin="round" />
        <line x1="50" y1="31" x2="50" y2="68" stroke="#e4dece" strokeWidth="1" />
        <path d="M38,27 Q50,16 62,27 L57,30 Q50,24 43,30 Z" fill="#e8e1d1" stroke="#ccc5b2" strokeWidth="0.8" strokeLinejoin="round" />
        <text x="50" y="51" textAnchor="middle" fontFamily={FONT_DISPLAY} fontWeight="700" fontSize="16" letterSpacing="1.2" fill="#2a2a28">
          {country}
        </text>
        <rect x="24" y="68" width="52" height="12" rx="2" fill="#16130f" />
        <rect x="24" y="68" width="52" height="3" rx="1.5" fill="#2c2620" />
        <rect x="43" y="69" width="14" height="13" rx="2.5" fill="#0d0b09" />
        <line x1="50" y1="70" x2="50" y2="81" stroke="#322b24" strokeWidth="0.8" />
        <rect x="44" y="80" width="4.5" height="20" rx="2" fill="#16130f" />
        <rect x="51.5" y="80" width="4.5" height="20" rx="2" fill="#16130f" />
      </svg>
      {captain && (
        <div
          style={{
            position: "absolute",
            top: 6,
            right: 6,
            width: 22,
            height: 22,
            borderRadius: "50%",
            background: GOLD,
            color: "#1b211e",
            fontFamily: FONT_DISPLAY,
            fontWeight: 700,
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          C
        </div>
      )}
    </div>
  );
}

// Mascote ornitorrinco judoca — cores da página inicial, faixa por nível
function Mascot({ belt }: { belt: string }) {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true">
      <ellipse cx="72" cy="72" rx="13" ry="7.5" fill="#39998f" transform="rotate(-18 72 72)" />
      <line x1="65" y1="70" x2="79" y2="73" stroke="#2d7a72" strokeWidth="0.8" transform="rotate(-18 72 72)" />
      <path d="M50,40 C40,40 33,44 32,52 L30,80 C30,85 36,86 50,86 C64,86 70,85 70,80 L68,52 C67,44 60,40 50,40 Z" fill="#f6f3ea" stroke="#d8d1c0" strokeWidth="1" />
      <path d="M33,47 L21,54 L25,63 L35,57 Z" fill="#f6f3ea" stroke="#d8d1c0" strokeWidth="1" strokeLinejoin="round" />
      <path d="M67,47 L79,54 L75,63 L65,57 Z" fill="#f6f3ea" stroke="#d8d1c0" strokeWidth="1" strokeLinejoin="round" />
      <circle cx="23" cy="62" r="4.2" fill="#E65100" />
      <circle cx="77" cy="62" r="4.2" fill="#E65100" />
      <path d="M34,30 C34,18 42,12 50,12 C58,12 66,18 66,30 C66,38 60,43 50,43 C40,43 34,38 34,30 Z" fill="#4DB6AC" stroke="#2f8a80" strokeWidth="1" />
      <path d="M43,41 L50,53 L50,60 L41,51 Z" fill="#ece5d5" stroke="#d8d1c0" strokeWidth="0.6" />
      <path d="M57,41 L50,53 L50,60 L59,51 Z" fill="#e3dccb" stroke="#d8d1c0" strokeWidth="0.6" />
      <rect x="28" y="65" width="44" height="8" rx="2" fill={belt} stroke="rgba(0,0,0,0.25)" strokeWidth="0.6" />
      <rect x="44" y="64" width="12" height="11" rx="2" fill={belt} />
      <rect x="44" y="64" width="12" height="11" rx="2" fill="rgba(0,0,0,0.2)" />
      <rect x="46" y="74" width="3.5" height="10" rx="1.5" fill={belt} />
      <rect x="51" y="74" width="3.5" height="10" rx="1.5" fill={belt} />
      <ellipse cx="43.5" cy="26" rx="3.3" ry="3.8" fill="#fff" />
      <ellipse cx="56.5" cy="26" rx="3.3" ry="3.8" fill="#fff" />
      <circle cx="44.3" cy="27" r="1.9" fill="#1A237E" />
      <circle cx="55.7" cy="27" r="1.9" fill="#1A237E" />
      <line x1="39" y1="20.5" x2="46.5" y2="22.5" stroke="#E65100" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="61" y1="20.5" x2="53.5" y2="22.5" stroke="#E65100" strokeWidth="1.8" strokeLinecap="round" />
      <ellipse cx="50" cy="37" rx="11" ry="4.6" fill="#FF8F00" stroke="#E65100" strokeWidth="0.7" />
      <circle cx="46" cy="35.5" r="0.9" fill="#E65100" />
      <circle cx="54" cy="35.5" r="0.9" fill="#E65100" />
      <path d="M37,84 L46,84 L48,93 L35,93 Z" fill="#FF8F00" />
      <path d="M63,84 L54,84 L52,93 L65,93 Z" fill="#FF8F00" />
    </svg>
  );
}

function AthleteInfo({ name, category, price, variation, score }: { name: string; category: string; price: number; variation: number; score: number }) {
  const up = variation >= 0;
  return (
    <div
      style={{
        background: "rgba(8,10,8,0.82)",
        border: "1px solid rgba(0,0,0,0.35)",
        borderRadius: 10,
        padding: "6px 4px",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 700, color: "#ffffff", lineHeight: 1.15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {name}
      </div>
      <div style={{ fontSize: 11, color: "#b6c0b9" }}>{category}</div>
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 6, marginTop: 3 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#f2c84b" }}>JC {price}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: up ? "#6fd49b" : "#ef8d83" }}>
          {up ? "▲" : "▼"} {Math.abs(variation)}%
        </span>
      </div>
      <div style={{ marginTop: 4 }}>
        <span style={{ background: "#1d3a2b", color: "#9be3bd", fontWeight: 700, fontSize: 11, padding: "2px 9px", borderRadius: 999 }}>
          {score >= 0 ? "+" : ""}
          {score} pts
        </span>
      </div>
    </div>
  );
}

export default function MeuTime() {
  const cards = ATHLETES.map((a) => ({ ...a, score: scoreAthlete(a.actions, a.isCaptain) }));
  const totalScore = cards.reduce((s, c) => s + c.score, 0);
  const beltColor = BELT_HEX[TEAM.belt] ?? "#7a4fa3";

  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: FONT_BODY }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "20px 16px 40px" }}>
        {/* Top bar */}
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
          <div>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 24, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.02em" }}>
              {TEAM.teamName}
            </div>
            <div style={{ fontSize: 13, color: "#93a39a", marginTop: 2 }}>
              Faixa {TEAM.belt} · #{TEAM.rankNational} Portugal
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Stat label="Patrimônio" value={`JC ${TEAM.patrimony}`} />
            <Stat label="Saldo" value={`JC ${TEAM.balance}`} />
          </div>
        </header>

        {/* Tatame — área de competição */}
        <section style={{ background: "#2f6fb3", border: "1px solid #25588f", borderRadius: 16, padding: 22 }}>
          <div style={{ background: "#e6b422", border: "3px solid #f0cf6a", borderRadius: 4, padding: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
              {cards.map((c) => (
                <div key={c.name} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <KimonoAvatar country={c.country} captain={c.isCaptain} />
                  <AthleteInfo name={c.name} category={c.category} price={c.price} variation={c.variation} score={c.score} />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Footer — pontuação + mascote */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 18,
            padding: "12px 16px",
            background: "#141a17",
            border: "1px solid #243029",
            borderRadius: 14,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 66, height: 66, flexShrink: 0 }}>
              <Mascot belt={beltColor} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#93a39a" }}>Pontuação da rodada</div>
              <div style={{ fontSize: 13, color: "#f2c84b", fontWeight: 700, marginTop: 2 }}>
                {roundMessage(TEAM.roundPosition)}
              </div>
            </div>
          </div>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 28, fontWeight: 700, color: GOLD }}>{totalScore} pts</div>
        </div>

        <p style={{ fontSize: 11, color: "#5f6f67", textAlign: "center", marginTop: 14 }}>
          Dados de exemplo · pontuação calculada pelo motor do jogo
        </p>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "#141a17", border: "1px solid #243029", borderRadius: 12, padding: "8px 12px", textAlign: "right" }}>
      <div style={{ fontSize: 10, color: "#93a39a", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: GOLD }}>{value}</div>
    </div>
  );
}
