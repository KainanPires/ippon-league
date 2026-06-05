// Calendário Oficial contínuo: rodadas reais + Retrô (não oficial, surpresa) nos buracos.
import { getCompetitions, type IjfCompetition } from "@/lib/ijf";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const FD = "var(--font-geist-mono), ui-monospace, monospace";
const GOLD = "#d9a441";
const MINT = "#7fd1a3";
const PURPLE = "#b48ad6";
const YEAR = 2026;
const MON_ABBR = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function parseDate(s?: string): Date | null {
  if (!s) return null;
  const d = new Date(String(s).replace(/\//g, "-"));
  return isNaN(d.getTime()) ? null : d;
}
const fmtOne = (d: Date) => `${d.getDate()} ${MON_ABBR[d.getMonth()]}`;
function fmtRange(a?: string, b?: string): string {
  const da = parseDate(a), db = parseDate(b);
  if (!da) return "";
  if (!db || da.getTime() === db.getTime()) return fmtOne(da);
  const d1 = da.getDate(), m1 = da.getMonth(), d2 = db.getDate(), m2 = db.getMonth();
  return m1 === m2 ? `${d1}–${d2} ${MON_ABBR[m1]}` : `${d1} ${MON_ABBR[m1]} – ${d2} ${MON_ABBR[m2]}`;
}
const AGE_LABEL: Record<string, string> = { sen: "Sénior", jun: "Júnior", cad: "Cadete", vet: "Veteranos", you: "Juvenil" };
const levels = (c: IjfCompetition) => (c.ages || []).map((x) => AGE_LABEL[x] || x).join(" · ");

function isoWeekKey(d: Date): string {
  const dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (dt.getUTCDay() + 6) % 7;
  dt.setUTCDate(dt.getUTCDate() - dayNum + 3);
  const firstThu = new Date(Date.UTC(dt.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round((dt.getTime() - firstThu.getTime()) / (7 * 864e5));
  return `${dt.getUTCFullYear()}-${String(week).padStart(2, "0")}`;
}
function mondayOf(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  return x;
}

type Tier = "major" | "regular" | "fora";
function classify(c: IjfCompetition): { tier: Tier; tag: string } {
  const n = (c.name || "").toLowerCase();
  if (/postpon|cancel|adiad/.test(n)) return { tier: "fora", tag: "Adiada" };
  if (/training camp|\botc\b|\bitc\b| camp\b|kata|world series/.test(n)) return { tier: "fora", tag: "Camp/Kata" };
  if (String(c.is_teams) === "1") return { tier: "fora", tag: "Equipas" };
  if (/olympic|olimp/.test(n)) return { tier: "major", tag: "Jogos" };
  if (/masters/.test(n)) return { tier: "major", tag: "Masters" };
  if (/grand slam/.test(n)) return { tier: "major", tag: "Grand Slam" };
  if (/grand prix/.test(n)) return { tier: "major", tag: "Grand Prix" };
  if (/world championships|world champ|campeonato mundial/.test(n)) return { tier: "major", tag: "Mundial" };
  if (/championships|championship/.test(n)) return { tier: "major", tag: "Continental" };
  if (/world cup/.test(n)) return { tier: "regular", tag: "World Cup" };
  if (/open|cup|copa/.test(n)) return { tier: "regular", tag: "Open/Cup" };
  return { tier: "regular", tag: "Outro" };
}
const regularRank = (tag: string) => (tag === "World Cup" ? 3 : tag === "Open/Cup" ? 2 : 1);

type Item =
  | { kind: "major" | "gap"; date: Date; name: string; tag: string; c: IjfCompetition }
  | { kind: "retro"; date: Date; name: string; tag: string };

export default async function CalendarioOficial() {
  const all = (await getCompetitions(YEAR)).filter((c) => c.name && parseDate(c.date_from));
  all.sort((a, b) => parseDate(a.date_from)!.getTime() - parseDate(b.date_from)!.getTime());

  const weeks = new Map<string, { majors: { c: IjfCompetition; tag: string }[]; regs: { c: IjfCompetition; tag: string }[] }>();
  for (const c of all) {
    const { tier, tag } = classify(c);
    if (tier === "fora") continue;
    const wk = isoWeekKey(parseDate(c.date_from)!);
    if (!weeks.has(wk)) weeks.set(wk, { majors: [], regs: [] });
    const w = weeks.get(wk)!;
    if (tier === "major") w.majors.push({ c, tag }); else w.regs.push({ c, tag });
  }

  const official: Item[] = [];
  for (const { majors, regs } of weeks.values()) {
    if (majors.length) {
      for (const m of majors) official.push({ kind: "major", date: parseDate(m.c.date_from)!, name: m.c.name, tag: m.tag, c: m.c });
    } else if (regs.length) {
      const best = [...regs].sort((a, b) => regularRank(b.tag) - regularRank(a.tag))[0];
      official.push({ kind: "gap", date: parseDate(best.c.date_from)!, name: best.c.name, tag: best.tag, c: best.c });
    }
  }

  // Preencher semanas vazias da época com Retrô (não oficial)
  const officialWeeks = new Set(official.map((o) => isoWeekKey(o.date)));
  const times = official.map((o) => o.date.getTime());
  const seasonStart = mondayOf(new Date(Math.min(...times)));
  const seasonEnd = mondayOf(new Date(Math.max(...times)));
  const retros: Item[] = [];
  for (let w = new Date(seasonStart); w.getTime() <= seasonEnd.getTime(); w = new Date(w.getTime() + 7 * 864e5)) {
    if (!officialWeeks.has(isoWeekKey(w))) retros.push({ kind: "retro", date: new Date(w), name: "Retrô — competição surpresa", tag: "Retrô" });
  }

  const timeline = [...official, ...retros].sort((a, b) => a.date.getTime() - b.date.getTime());
  const oCount = official.length, rCount = retros.length;

  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: "system-ui, sans-serif", padding: "20px 16px 60px" }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <h1 style={{ fontFamily: FD, fontSize: 20, fontWeight: 700, textTransform: "uppercase", margin: 0 }}>Calendário Oficial · {YEAR}</h1>
        <p style={{ fontSize: 13, color: "#93a39a", lineHeight: 1.5 }}>
          <b style={{ color: GOLD }}>{oCount} rodadas oficiais</b> + <b style={{ color: PURPLE }}>{rCount} Retrô</b> nos buracos. O Retrô é <b style={{ color: PURPLE }}>só diversão</b> (não conta para ranking/faixa) e a competição é <b>surpresa</b>, revelada só no dia — sem tempo para pesquisar.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 16 }}>
          {timeline.map((it, i) => {
            const color = it.kind === "retro" ? PURPLE : it.kind === "major" ? GOLD : MINT;
            const tagText = it.kind === "retro" ? "Retrô" : it.kind === "major" ? it.tag : "Preenche";
            const sub =
              it.kind === "retro"
                ? `Semana de ${fmtOne(it.date)} · surpresa · não oficial`
                : `${fmtRange(it.c.date_from, it.c.date_to)}${it.c.country_short ? ` · ${it.c.country_short}` : ""}${levels(it.c) ? ` · ${levels(it.c)}` : ""}`;
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 11, background: it.kind === "retro" ? "#15101c" : "#121815", border: `1px solid ${it.kind === "retro" ? "#3a2d4d" : it.kind === "major" ? "#3a2f12" : "#1a221d"}`, borderLeft: `3px solid ${color}`, borderRadius: 11, padding: "10px 12px", borderStyle: it.kind === "retro" ? "dashed" : "solid" }}>
                <span style={{ fontFamily: FD, fontSize: 12, color: "#5f6f67", width: 22, flexShrink: 0 }}>{i + 1}</span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 13.5, lineHeight: 1.2, color: it.kind === "retro" ? "#cdbfe0" : "#f1ede2" }}>{it.name}</div>
                  <div style={{ fontSize: 11, color: "#93a39a", marginTop: 2 }}>{sub}</div>
                </div>
                <span style={{ background: "#1b211e", color, fontSize: 10, fontWeight: 700, textTransform: "uppercase", padding: "4px 8px", borderRadius: 7, whiteSpace: "nowrap", flexShrink: 0 }}>{tagText}</span>
              </div>
            );
          })}
        </div>
        <p style={{ fontSize: 11, color: "#5f6f67", marginTop: 24 }}>Proposta automática — ajustável. Oficiais a dourado/verde, Retrô a roxo (tracejado).</p>
      </div>
    </main>
  );
}
