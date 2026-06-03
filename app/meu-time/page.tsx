import { scoreAthlete, type ActionType } from "@/lib/engine";

type Athlete = {
  name: string;
  country: string;
  category: string;
  price: number;
  isCaptain?: boolean;
  actions: ActionType[];
};

const TEAM = {
  teamName: "Dojo dos Sonhos",
  belt: "Roxa",
  patrimony: 100,
  balance: 2,
  rankNational: 14,
};

const ATHLETES: Athlete[] = [
  { name: "Hifumi Abe", country: "JPN", category: "-66kg", price: 18, isCaptain: true, actions: ["ippon_feito", "waza_ari_feito", "shido_provocado"] },
  { name: "C. Agbegnenou", country: "FRA", category: "-63kg", price: 17, actions: ["ippon_feito", "ippon_feito"] },
  { name: "Teddy Riner", country: "FRA", category: "+100kg", price: 16, actions: ["waza_ari_feito", "shido_provocado"] },
  { name: "Tato Grigalashvili", country: "GEO", category: "-81kg", price: 13, actions: ["ippon_feito"] },
  { name: "Lasha Bekauri", country: "GEO", category: "-90kg", price: 12, actions: ["ippon_feito", "shido_recebido"] },
  { name: "Christa Deguchi", country: "CAN", category: "-57kg", price: 11, actions: ["waza_ari_feito", "yuko_feito"] },
  { name: "D. Krasniqi", country: "KOS", category: "-48kg", price: 6, actions: ["yuko_feito", "shido_provocado"] },
  { name: "Joana Ramos", country: "POR", category: "-52kg", price: 5, actions: ["waza_ari_feito"] },
];

const FONT_DISPLAY = "var(--font-geist-mono), system-ui, sans-serif";
const FONT_BODY = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";

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
        {/* mangas */}
        <path d="M31,29 L11,33 L7,53 L21,57 L32,46 Z" fill="#f6f3ea" stroke="#ccc5b2" strokeWidth="1" strokeLinejoin="round" />
        <path d="M69,29 L89,33 L93,53 L79,57 L68,46 Z" fill="#f6f3ea" stroke="#ccc5b2" strokeWidth="1" strokeLinejoin="round" />
        {/* corpo do judogi */}
        <path d="M30,27 L70,27 L73,80 L71,101 L29,101 L27,80 Z" fill="#f6f3ea" stroke="#ccc5b2" strokeWidth="1" strokeLinejoin="round" />
        {/* costura central */}
        <line x1="50" y1="31" x2="50" y2="68" stroke="#e4dece" strokeWidth="1" />
        {/* gola */}
        <path d="M38,27 Q50,16 62,27 L57,30 Q50,24 43,30 Z" fill="#e8e1d1" stroke="#ccc5b2" strokeWidth="0.8" strokeLinejoin="round" />
        {/* número nas costas (sigla do país) */}
        <text x="50" y="51" textAnchor="middle" fontFamily={FONT_DISPLAY} fontWeight="700" fontSize="16" letterSpacing="1.2" fill="#2a2a28">
          {country}
        </text>
        {/* faixa preta */}
        <rect x="24" y="68" width="52" height="12" rx="2" fill="#16130f" />
        <rect x="24" y="68" width="52" height="3" rx="1.5" fill="#2c2620" />
        {/* nó da faixa */}
        <rect x="43" y="69" width="14" height="13" rx="2.5" fill="#0d0b09" />
        <line x1="50" y1="70" x2="50" y2="81" stroke="#322b24" strokeWidth="0.8" />
        {/* pontas da faixa */}
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

export default function MeuTime() {
  const cards = ATHLETES.map((a) => ({ ...a, score: scoreAthlete(a.actions, a.isCaptain) }));
  const totalScore = cards.reduce((s, c) => s + c.score, 0);

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
        <section
          style={{
            background: "#2f6fb3",
            border: "1px solid #25588f",
            borderRadius: 16,
            padding: 22,
          }}
        >
          <div
            style={{
              background: "#e6b422",
              border: "3px solid #f0cf6a",
              borderRadius: 4,
              padding: 16,
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
              {cards.map((c) => (
                <div key={c.name} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <KimonoAvatar country={c.country} captain={c.isCaptain} />
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.15, color: "#f1ede2", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {c.name}
                    </div>
                    <div style={{ fontSize: 11, color: "#93a39a" }}>{c.category}</div>
                    <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 4 }}>
                      <span style={{ fontSize: 11, color: GOLD, fontWeight: 700 }}>JC {c.price}</span>
                      <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: c.score >= 0 ? "#7fd1a3" : "#e88",
                      }}
                    >
                      {c.score >= 0 ? "+" : ""}
                      {c.score} pts
                    </span>
                  </div>
                </div>
              </div>
              ))}
            </div>
          </div>
        </section>

        {/* Footer total */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 18,
            padding: "14px 16px",
            background: "#141a17",
            border: "1px solid #243029",
            borderRadius: 14,
          }}
        >
          <div style={{ fontSize: 13, color: "#93a39a" }}>Pontuação da rodada</div>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 28, fontWeight: 700, color: GOLD }}>
            {totalScore} pts
          </div>
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
