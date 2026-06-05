// Proposta de CALENDÁRIO OFICIAL: classifica as competições reais em Major / Regular / Fora.
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

type Tier = "major" | "regular" | "fora";
function classify(c: IjfCompetition): { tier: Tier; tag: string } {
  const n = (c.name || "").toLowerCase();
  const postponed = /postpon|cancel|adiad/.test(n);
  // Fora do jogo
  if (/training camp|\botc\b|\bitc\b| camp\b|kata|world series/.test(n)) return { tier: "fora", tag: "Camp/Kata" };
  if (String(c.is_teams) === "1") return { tier: "fora", tag: "Equipas" };
  if (postponed) return { tier: "fora", tag: "Adiada/Cancelada" };
  // Majors
  if (/olympic|olimp/.test(n)) return { tier: "major", tag: "Jogos" };
  if (/masters/.test(n)) return { tier: "major", tag: "Masters" };
  if (/grand slam/.test(n)) return { tier: "major", tag: "Grand Slam" };
  if (/grand prix/.test(n)) return { tier: "major", tag: "Grand Prix" };
  if (/world championships|world champ|campeonato mundial/.test(n)) return { tier: "major", tag: "Mundial" };
  if (/championships|championship/.test(n)) return { tier: "major", tag: "Continental" }; // Europeu/Pan/Asiático/Africano/Oceania
  // Regulares
  if (/world cup/.test(n)) return { tier: "regular", tag: "World Cup" };
  if (/open|cup|copa/.test(n)) return { tier: "regular", tag: "Open/Cup" };
  return { tier: "regular", tag: "Outro" };
}

export default async function CalendarioOficial() {
  const all = (await getCompetitions(YEAR)).filter((c) => c.name);
  all.sort((a, b) => (parseDate(a.date_from)?.getTime() || 0) - (parseDate(b.date_from)?.getTime() || 0));

  const buckets: Record<Tier, { c: IjfCompetition; tag: string }[]> = { major: [], regular: [], fora: [] };
  for (const c of all) { const { tier, tag } = classify(c); buckets[tier].push({ c, tag }); }

  const Row = ({ c, tag, color }: { c: IjfCompetition; tag: string; color: string }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 11, background: "#121815", border: "1px solid #1a221d", borderRadius: 11, padding: "10px 12px" }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 13.5, lineHeight: 1.2 }}>{c.name}</div>
        <div style={{ fontSize: 11, color: "#93a39a", marginTop: 2 }}>
          {fmtRange(c.date_from, c.date_to)}{c.city ? ` · ${c.city}` : ""}{c.country_short ? ` (${c.country_short})` : ""}{levels(c) ? ` · ${levels(c)}` : ""}
        </div>
      </div>
      <span style={{ background: "#1b211e", color, fontSize: 10, fontWeight: 700, textTransform: "uppercase", padding: "4px 8px", borderRadius: 7, whiteSpace: "nowrap", flexShrink: 0 }}>{tag}</span>
    </div>
  );

  const Section = ({ title, color, items, note }: { title: string; color: string; items: { c: IjfCompetition; tag: string }[]; note: string }) => (
    <div style={{ marginTop: 24 }}>
      <h2 style={{ fontFamily: FD, fontSize: 15, textTransform: "uppercase", color, margin: 0 }}>{title} <span style={{ color: "#5f6f67" }}>· {items.length}</span></h2>
      <p style={{ fontSize: 11.5, color: "#7c8a82", margin: "2px 0 10px" }}>{note}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {items.map((x) => <Row key={x.c.id_competition} c={x.c} tag={x.tag} color={color} />)}
      </div>
    </div>
  );

  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: "system-ui, sans-serif", padding: "20px 16px 60px" }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <h1 style={{ fontFamily: FD, fontSize: 20, fontWeight: 700, textTransform: "uppercase", margin: 0 }}>Proposta · Calendário Oficial {YEAR}</h1>
        <p style={{ fontSize: 13, color: "#93a39a", lineHeight: 1.5 }}>
          Classificação automática das {all.length} competições reais. <b style={{ color: GOLD }}>Majors</b> = grandes momentos. <b style={{ color: MINT }}>Regulares</b> = rodadas semanais. <b style={{ color: "#7c8a82" }}>Fora</b> = não entram. Diz-me o que mudar.
        </p>
        <Section title="Majors" color={GOLD} items={buckets.major} note="Mundiais, Masters, Grand Slams, Continentais — hype máximo, prémios, comunicação grande." />
        <Section title="Regulares" color={MINT} items={buckets.regular} note="Grand Prix, World Cups, Opens, Cups — rodadas mais frequentes para manter o jogo vivo." />
        <Section title="Fora do jogo" color="#93a39a" items={buckets.fora} note="Training camps, kata, eventos de equipas e adiadas — não fazem sentido como rodada." />
        <p style={{ fontSize: 11, color: "#5f6f67", marginTop: 24 }}>Proposta automática — ajustável.</p>
      </div>
    </main>
  );
}
