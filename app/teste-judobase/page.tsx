// Prévia: Calendário REAL do JudoBase (2026) com a nossa cara. Usa lib/ijf.ts.
import { getCompetitions, type IjfCompetition } from "@/lib/ijf";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const FD = "var(--font-geist-mono), ui-monospace, monospace";
const GOLD = "#d9a441";
const YEAR = 2026;

const MONTHS_PT = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const MON_ABBR = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function parseDate(s?: string): Date | null {
  if (!s) return null;
  const d = new Date(s.replace(/\//g, "-"));
  return isNaN(d.getTime()) ? null : d;
}

function fmtRange(a?: string, b?: string): string {
  const da = parseDate(a), db = parseDate(b);
  if (!da) return "";
  const d1 = da.getDate(), m1 = da.getMonth();
  if (!db || (da.getTime() === db.getTime())) return `${d1} ${MON_ABBR[m1]}`;
  const d2 = db.getDate(), m2 = db.getMonth();
  if (m1 === m2) return `${d1}–${d2} ${MON_ABBR[m1]}`;
  return `${d1} ${MON_ABBR[m1]} – ${d2} ${MON_ABBR[m2]}`;
}

const AGE_LABEL: Record<string, string> = { sen: "Sénior", jun: "Júnior", cad: "Cadete", vet: "Veteranos", you: "Juvenil" };
function levels(c: IjfCompetition): string {
  const a = c.ages || [];
  return a.map((x) => AGE_LABEL[x] || x).join(" · ");
}

function typeOf(c: IjfCompetition): string | null {
  const n = (c.name || "").toLowerCase();
  if (n.includes("grand slam")) return "Grand Slam";
  if (n.includes("grand prix")) return "Grand Prix";
  if (n.includes("masters")) return "Masters";
  if (n.includes("world championships") || n.includes("world champ")) return "Mundial";
  if (n.includes("championships")) return "Campeonato";
  if (n.includes("world cup")) return "World Cup";
  if (n.includes("open")) return "Open";
  if (n.includes("training camp")) return "Camp";
  return null;
}

export default async function Calendario() {
  const all = await getCompetitions(YEAR);
  const comps = all
    .filter((c) => c.name)
    .sort((a, b) => (parseDate(a.date_from)?.getTime() || 0) - (parseDate(b.date_from)?.getTime() || 0));

  const today = new Date(); today.setHours(0, 0, 0, 0);

  // Agrupar por mês
  const groups = new Map<number, IjfCompetition[]>();
  for (const c of comps) {
    const d = parseDate(c.date_from);
    const m = d ? d.getMonth() : 12;
    if (!groups.has(m)) groups.set(m, []);
    groups.get(m)!.push(c);
  }
  const monthKeys = [...groups.keys()].sort((a, b) => a - b);

  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: "system-ui, sans-serif", padding: "20px 16px 60px" }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <h1 style={{ fontFamily: FD, fontSize: 21, fontWeight: 700, textTransform: "uppercase", margin: 0 }}>Calendário real · {YEAR}</h1>
        <p style={{ fontSize: 13, color: "#93a39a", lineHeight: 1.5 }}>
          <b style={{ color: "#cfd8d2" }}>{comps.length}</b> competições reais do JudoBase. Ponto dourado = ainda por acontecer. Estas são as candidatas ao <b style={{ color: GOLD }}>Calendário Oficial</b>.
        </p>

        {comps.length === 0 && (
          <div style={{ background: "#1a0f0e", border: "1px solid #5a2f2c", borderRadius: 10, padding: 14, color: "#ef8d83" }}>Não vieram competições.</div>
        )}

        {monthKeys.map((m) => (
          <div key={m} style={{ marginTop: 22 }}>
            <h2 style={{ fontFamily: FD, fontSize: 13, textTransform: "uppercase", color: GOLD, letterSpacing: "0.08em", marginBottom: 8 }}>
              {m < 12 ? `${MONTHS_PT[m]} ${YEAR}` : "Sem data"}
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {groups.get(m)!.map((c) => {
                const d = parseDate(c.date_from);
                const upcoming = d ? d.getTime() >= today.getTime() : false;
                const t = typeOf(c);
                const lv = levels(c);
                return (
                  <div key={c.id_competition} style={{ display: "flex", alignItems: "center", gap: 11, background: "#121815", border: `1px solid ${upcoming ? "#3a4d2e" : "#1a221d"}`, borderRadius: 12, padding: "11px 13px" }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: upcoming ? GOLD : "#3a463f", flexShrink: 0 }} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.2 }}>{c.name}</div>
                      <div style={{ fontSize: 11.5, color: "#93a39a", marginTop: 2 }}>
                        {fmtRange(c.date_from, c.date_to)}{c.city ? ` · ${c.city}` : ""}{c.country_short ? ` (${c.country_short})` : ""}{lv ? ` · ${lv}` : ""}
                      </div>
                    </div>
                    {t && <span style={{ background: "#1b211e", color: GOLD, fontSize: 10, fontWeight: 700, textTransform: "uppercase", padding: "4px 8px", borderRadius: 7, whiteSpace: "nowrap", flexShrink: 0 }}>{t}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        <p style={{ fontSize: 11, color: "#5f6f67", marginTop: 24 }}>Prévia temporária — dados ao vivo do JudoBase.</p>
      </div>
    </main>
  );
}
