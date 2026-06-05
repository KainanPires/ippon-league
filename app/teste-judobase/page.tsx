// Mercado real com PREÇOS calculados pelo histórico (motor: 70% 12m + 30% últimas 3).
import { getCompetitions, getCompetitionContests, getCompetitor, getCompetitorContests, contestActionsForPerson, type IjfCompetitor } from "@/lib/ijf";
import { scoreActions, expectedPerformance, MIN_PRICE } from "@/lib/engine";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

const FD = "var(--font-geist-mono), ui-monospace, monospace";
const GOLD = "#d9a441";
const TATAME = "#1c3a2e";
const MAX_ATHLETES = 10;

function parseDate(s?: string): Date | null {
  if (!s) return null;
  const d = new Date(String(s).replace(/\//g, "-"));
  return isNaN(d.getTime()) ? null : d;
}
const fmt = (n: number) => (Math.round(n * 10) / 10).toString().replace(".", ",");

// Mapeamento provisório expectativa -> preço (bandas do documento). Entra no motor depois.
function priceFromExpected(expected: number): number {
  const raw = 2.5 + expected * 0.55;
  const clamped = Math.max(MIN_PRICE, Math.min(20, raw));
  return Math.round(clamped * 2) / 2; // passo 0,5
}

// Calcula expectativa (avg12m, avgLast3) a partir do histórico de lutas do atleta.
function expectedFromHistory(history: any[], idPerson: string): { expected: number; comps: number; avg: number } {
  const byComp = new Map<string, { date: Date | null; score: number }>();
  for (const f of history) {
    const pts = scoreActions(contestActionsForPerson(f, idPerson));
    const key = String(f.id_competition || f.competition_name || Math.random());
    const prev = byComp.get(key);
    const date = parseDate(f.competition_date);
    if (prev) prev.score += pts;
    else byComp.set(key, { date, score: pts });
  }
  const comps = [...byComp.values()].sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));
  if (comps.length === 0) return { expected: 0, comps: 0, avg: 0 };
  const last3 = comps.slice(0, 3);
  const avgLast3 = last3.reduce((s, c) => s + c.score, 0) / last3.length;
  const cutoff = new Date(); cutoff.setFullYear(cutoff.getFullYear() - 1);
  const recent = comps.filter((c) => c.date && c.date.getTime() >= cutoff.getTime());
  const pool = recent.length ? recent : comps;
  const avg12m = pool.reduce((s, c) => s + c.score, 0) / pool.length;
  return { expected: expectedPerformance(avg12m, avgLast3), comps: comps.length, avg: Math.round(avg12m * 10) / 10 };
}

export default async function MercadoPrecos() {
  const comps2026 = await getCompetitions(2026);
  const paris = comps2026.find((c) => /paris grand slam/i.test(c.name || ""));
  let compName = paris?.name || "";

  let cards: { id: string; info: IjfCompetitor; price: number; avg: number; comps: number }[] = [];
  if (paris) {
    const contests = await getCompetitionContests(paris.id_competition);
    const seen: string[] = [];
    for (const f of contests) {
      for (const id of [String(f.id_person_blue), String(f.id_person_white)]) {
        if (id && id !== "0" && !seen.includes(id)) seen.push(id);
      }
      if (seen.length >= MAX_ATHLETES) break;
    }
    const results = await Promise.all(
      seen.map(async (id) => {
        const [info, history] = await Promise.all([getCompetitor(id), getCompetitorContests(id)]);
        if (!info) return null;
        const { expected, comps, avg } = expectedFromHistory(history, id);
        return { id, info, price: priceFromExpected(expected), avg, comps };
      })
    );
    cards = results.filter(Boolean) as any;
    cards.sort((a, b) => b.price - a.price);
  }

  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: "system-ui, sans-serif", padding: "20px 16px 60px" }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <h1 style={{ fontFamily: FD, fontSize: 20, fontWeight: 700, textTransform: "uppercase", margin: 0 }}>Mercado real · preços do histórico</h1>
        <p style={{ fontSize: 13, color: "#93a39a", lineHeight: 1.5 }}>
          Atletas de <b style={{ color: "#cfd8d2" }}>{compName}</b>. Preço calculado pelo nosso motor a partir do <b style={{ color: GOLD }}>histórico real</b> (70% últimos 12 meses + 30% últimas 3 competições).
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
          {cards.map((a) => {
            const cc = (a.info.country_short || "").toUpperCase();
            const name = `${a.info.given_name || ""} ${a.info.family_name || ""}`.trim();
            const gender = a.info.gender === "female" ? "Feminino" : "Masculino";
            const cat = (a.info.categories && a.info.categories[0]) || "";
            return (
              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 12, background: "#121815", border: "1px solid #243029", borderRadius: 12, padding: "10px 12px" }}>
                <div style={{ width: 44, height: 44, borderRadius: 9, background: TATAME, border: "1px solid #2a4d3e", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontFamily: FD, fontSize: 12, fontWeight: 700, color: "#aee9c9" }}>{cc || "—"}</span>
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name || `#${a.id}`}</div>
                  <div style={{ fontSize: 11.5, color: "#93a39a", marginTop: 2 }}>
                    {cc}{cat ? ` · ${cat}` : ""} · {gender} · <span style={{ color: "#7c8a82" }}>média {fmt(a.avg)} pts · {a.comps} comp.</span>
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontFamily: FD, fontSize: 15, fontWeight: 700, color: GOLD }}>JC {fmt(a.price)}</div>
                </div>
              </div>
            );
          })}
        </div>
        <p style={{ fontSize: 11, color: "#5f6f67", marginTop: 20 }}>
          Prévia. Preço real do motor: quem tem histórico mais forte vale mais. O ajuste fino das bandas faz-se com dados a sério.
        </p>
      </div>
    </main>
  );
}
