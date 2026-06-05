// Diagnóstico JudoBase — descobre os nomes de ação que funcionam.
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const FD = "var(--font-geist-mono), ui-monospace, monospace";
const IJF = "https://data.ijf.org/api/get_json";

function u(action: string, params: Record<string, string>): string {
  const qs = Object.entries(params).map(([k, v]) => `&params%5B${k}%5D=${encodeURIComponent(v)}`).join("");
  return `${IJF}?access_token=&params%5Baction%5D=${action}${qs}`;
}

const COMP = "2653"; // Jogos Olímpicos Paris 2024 (tem resultados)
const PERSON = "9194";

type Target = { label: string; url: string };
const TARGETS: Target[] = [
  { label: "CONTROLO · competition.get_list (2024)", url: u("competition.get_list", { year: "2024" }) },
  // Detalhe de uma competição
  { label: "competition.info", url: u("competition.info", { id_competition: COMP }) },
  { label: "competition.get_info", url: u("competition.get_info", { id_competition: COMP }) },
  { label: "competition.detail", url: u("competition.detail", { id_competition: COMP }) },
  // Combates / resultados de uma competição
  { label: "contest.get_list (comp)", url: u("contest.get_list", { id_competition: COMP }) },
  { label: "contest.find_by_competition", url: u("contest.find_by_competition", { id_competition: COMP }) },
  { label: "competition.contests", url: u("competition.contests", { id_competition: COMP }) },
  { label: "contest.list", url: u("contest.list", { id_competition: COMP }) },
  { label: "competition.get_contests", url: u("competition.get_contests", { id_competition: COMP }) },
  { label: "competition.fights", url: u("competition.fights", { id_competition: COMP }) },
  // Atleta
  { label: "competitor.info", url: u("competitor.info", { id_person: PERSON }) },
  { label: "competitor.get", url: u("competitor.get", { id_person: PERSON }) },
  { label: "competitor.profile", url: u("competitor.profile", { id_person: PERSON }) },
  { label: "competitor.competition_results", url: u("competitor.competition_results", { id_person: PERSON }) },
  { label: "competitor.contests", url: u("competitor.contests", { id_person: PERSON }) },
  { label: "competitor.search (Riner)", url: u("competitor.search", { family_name: "Riner" }) },
];

type Probe = { ok: boolean; status: number; info: string; preview: string; len: number; works: boolean };

async function probe(url: string): Promise<Probe> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch(url, { cache: "no-store", signal: ctrl.signal, redirect: "follow", headers: { Accept: "application/json, */*", "User-Agent": "Mozilla/5.0 (IpponLeague test)", Referer: "https://www.judobase.org/" } });
    const text = await res.text();
    clearTimeout(timer);
    let info = "";
    let isUnknown = text.includes("unknown action");
    try {
      const json = JSON.parse(text);
      if (Array.isArray(json)) info = `JSON array · ${json.length} itens`;
      else info = `JSON · chaves: ${Object.keys(json).join(", ").slice(0, 200)}`;
    } catch { info = "não-JSON"; }
    const works = res.status === 200 && !isUnknown && text.length > 5;
    return { ok: res.ok, status: res.status, info, preview: text.slice(0, 700), len: text.length, works };
  } catch (e: any) {
    clearTimeout(timer);
    return { ok: false, status: 0, info: "ERRO: " + (e?.message || String(e)), preview: "", len: 0, works: false };
  }
}

export default async function TesteJudobase() {
  const results = await Promise.all(TARGETS.map(async (tg) => ({ ...tg, r: await probe(tg.url) })));
  const winners = results.filter((x) => x.r.works);

  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: "system-ui, sans-serif", padding: "20px 16px 60px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <h1 style={{ fontFamily: FD, fontSize: 20, fontWeight: 700, textTransform: "uppercase" }}>Teste JudoBase — ações</h1>
        <p style={{ fontSize: 13, color: "#93a39a", lineHeight: 1.5 }}>
          A descobrir que ações funcionam. As que dão dados aparecem a verde com a amostra. Manda print.
        </p>
        <div style={{ background: "#16201b", border: "1px solid #2f6f4a", borderRadius: 10, padding: 12, marginBottom: 14, fontSize: 13 }}>
          <b style={{ color: "#7fd1a3" }}>Funcionam ({winners.length}):</b> {winners.length ? winners.map((w) => w.label).join("  ·  ") : "—"}
        </div>

        {results.map((row) => (
          <div key={row.label} style={{ border: `1px solid ${row.r.works ? "#2f6f4a" : "#33403a"}`, borderRadius: 10, padding: "10px 12px", marginTop: 8, background: row.r.works ? "#101a14" : "#0f1411" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: row.r.works ? "#7fd1a3" : "#cfd8d2" }}>{row.r.works ? "✓ " : "✗ "}{row.label}</span>
              <span style={{ fontFamily: FD, fontSize: 11, color: row.r.works ? "#7fd1a3" : "#7c8a82", whiteSpace: "nowrap" }}>{row.r.status === 0 ? "FALHOU" : `${row.r.status}`} · {row.r.info}</span>
            </div>
            {row.r.works && row.r.preview && (
              <pre style={{ marginTop: 6, background: "#0c0e0d", border: "1px solid #243029", borderRadius: 6, padding: 8, fontSize: 10.5, lineHeight: 1.4, color: "#aeb8b1", whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 180, overflowY: "auto" }}>{row.r.preview}</pre>
            )}
          </div>
        ))}
        <p style={{ fontSize: 11, color: "#5f6f67", marginTop: 20 }}>Diagnóstico temporário.</p>
      </div>
    </main>
  );
}
