// Rodadas válidas: Majors sempre contam; Regulares só preenchem semanas livres (fora dos Majors).
import { getCompetitions, type IjfCompetition } from "@/lib/ijf";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const FD = "var(--font-geist-mono), ui-monospace, monospace";
const GOLD = "#d9a441";
const MINT = "#7fd1a3";
const YEAR = 2026;
const MON_ABBR = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function parseDate(s?: string): Date | null {
  if (!s) return null;
  const d = new Date(String(s).replace(/\//g, "-"));
  return isNaN(d.getTime()) ? null : d;
}
function fmtRange(a?: string, b?: string): string {
  const da = parseDate(a), db = parseDate(b);
  if (!da) return "";
  const d1 = da.getDate(), m1 = da.getMonth();
  if (!db || da.getTime() === db.getTime()) return `${d1} ${MON_ABBR[m1]}`;
  const d2 = db.getDate(), m2 = db.getMonth();
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

type Round = { c: IjfCompetition; tag: string; kind: "major" | "gap" };

export default async function Rodadas() {
  const all = (await getCompetitions(YEAR)).filter((c) => c.name && parseDate(c.date_from));
  all.sort((a, b) => (parseDate(a.date_from)!.getTime()) - (parseDate(b.date_from)!.getTime()));

  // Agrupar por semana ISO
  const weeks = new Map<string, { majors: { c: IjfCompetition; tag: string }[]; regs: { c: IjfCompetition; tag: string }[] }>();
  for (const c of all) {
    const { tier, tag } = classify(c);
    if (tier === "fora") continue;
    const wk = isoWeekKey(parseDate(c.date_from)!);
    if (!weeks.has(wk)) weeks.set(wk, { majors: [], regs: [] });
    const w = weeks.get(wk)!;
    if (tier === "major") w.majors.push({ c, tag }); else w.regs.push({ c, tag });
  }

  const rounds: Round[] = [];
  const covered: { c: IjfCompetition; tag: string; why: string }[] = [];
  for (const { majors, regs } of weeks.values()) {
    if (majors.length) {
      for (const m of majors) rounds.push({ c: m.c, tag: m.tag, kind: "major" });
      for (const r of regs) covered.push({ ...r, why: "semana de Major" });
    } else if (regs.length) {
      const sorted = [...regs].sort((a, b) => regularRank(b.tag) - regularRank(a.tag));
      rounds.push({ c: sorted[0].c, tag: sorted[0].tag, kind: "gap" });
      for (const r of sorted.slice(1)) covered.push({ ...r, why: "mesma semana" });
    }
  }
  rounds.sort((a, b) => parseDate(a.c.date_from)!.getTime() - parseDate(b.c.date_from)!.getTime());

  const majorCount = rounds.filter((r) => r.kind === "major").length;
  const gapCount = rounds.filter((r) => r.kind === "gap").length;

  // Maior buraco entre rodadas
  let maxGap = 0, gapA = "", gapB = "";
  for (let i = 1; i < rounds.length; i++) {
    const prev = parseDate(rounds[i - 1].c.date_from)!, cur = parseDate(rounds[i].c.date_from)!;
    const wks = Math.round((cur.getTime() - prev.getTime()) / (7 * 864e5));
    if (wks > maxGap) { maxGap = wks; gapA = rounds[i - 1].c.name; gapB = rounds[i].c.name; }
  }

  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: "system-ui, sans-serif", padding: "20px 16px 60px" }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <h1 style={{ fontFamily: FD, fontSize: 20, fontWeight: 700, textTransform: "uppercase", margin: 0 }}>Rodadas válidas · {YEAR}</h1>
        <p style={{ fontSize: 13, color: "#93a39a", lineHeight: 1.5 }}>
          <b style={{ color: GOLD }}>{rounds.length} rodadas</b> ({majorCount} Majors + {gapCount} Regulares de preenchimento). Os Regulares só entram em semanas livres, fora dos Majors.
        </p>
        {maxGap > 0 && (
          <div style={{ background: "#1b150c", border: "1px solid #5a4a12", borderRadius: 10, padding: "10px 12px", fontSize: 12, color: "#e6c84f", marginBottom: 4 }}>
            Maior buraco: <b>{maxGap} semanas</b> (entre {gapA} e {gapB}) — é aqui que entram os desafios/Retrô.
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 16 }}>
          {rounds.map((r, i) => {
            const isMajor = r.kind === "major";
            const color = isMajor ? GOLD : MINT;
            return (
              <div key={r.c.id_competition} style={{ display: "flex", alignItems: "center", gap: 11, background: "#121815", border: `1px solid ${isMajor ? "#3a2f12" : "#1a221d"}`, borderLeft: `3px solid ${color}`, borderRadius: 11, padding: "10px 12px" }}>
                <span style={{ fontFamily: FD, fontSize: 12, color: "#5f6f67", width: 24, flexShrink: 0 }}>{i + 1}</span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 13.5, lineHeight: 1.2 }}>{r.c.name}</div>
                  <div style={{ fontSize: 11, color: "#93a39a", marginTop: 2 }}>
                    {fmtRange(r.c.date_from, r.c.date_to)}{r.c.country_short ? ` · ${r.c.country_short}` : ""}{levels(r.c) ? ` · ${levels(r.c)}` : ""}
                  </div>
                </div>
                <span style={{ background: "#1b211e", color, fontSize: 10, fontWeight: 700, textTransform: "uppercase", padding: "4px 8px", borderRadius: 7, whiteSpace: "nowrap", flexShrink: 0 }}>{isMajor ? r.tag : "Preenche"}</span>
              </div>
            );
          })}
        </div>

        <h2 style={{ fontFamily: FD, fontSize: 13, textTransform: "uppercase", color: "#93a39a", marginTop: 26 }}>Regulares que não contam · {covered.length}</h2>
        <p style={{ fontSize: 11.5, color: "#7c8a82", margin: "2px 0 8px" }}>Caíram na semana de um Major (ou outra regular já escolhida).</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {covered.map((x) => (
            <div key={x.c.id_competition} style={{ display: "flex", justifyContent: "space-between", gap: 10, background: "#0f1411", border: "1px solid #1a221d", borderRadius: 9, padding: "8px 11px" }}>
              <span style={{ fontSize: 12.5, color: "#cfd8d2", minWidth: 0 }}>{x.c.name} <span style={{ color: "#5f6f67" }}>· {fmtRange(x.c.date_from, x.c.date_to)}</span></span>
              <span style={{ fontSize: 10.5, color: "#7c8a82", whiteSpace: "nowrap" }}>{x.why}</span>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 11, color: "#5f6f67", marginTop: 24 }}>Proposta automática — ajustável.</p>
      </div>
    </main>
  );
}
