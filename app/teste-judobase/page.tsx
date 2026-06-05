// Mercado real (prévia) + teste da lista de inscritos de uma prova futura.
import { getCompetitions, getCompetitionContests, getCompetitor, type IjfCompetitor } from "@/lib/ijf";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const FD = "var(--font-geist-mono), ui-monospace, monospace";
const GOLD = "#d9a441";
const TATAME = "#1c3a2e";

// Chamada crua para sondar ações ainda não confirmadas (lista de inscritos).
async function rawProbe(action: string, idc: string): Promise<{ action: string; works: boolean; info: string }> {
  const url = `https://data.ijf.org/api/get_json?access_token=&params%5Baction%5D=${action}&params%5Bid_competition%5D=${idc}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch(url, { cache: "no-store", signal: ctrl.signal, headers: { "User-Agent": "Mozilla/5.0 (IpponLeague)" } });
    const txt = await res.text();
    clearTimeout(t);
    if (txt.includes("unknown action")) return { action, works: false, info: "ação desconhecida" };
    let info = `${txt.length} chars`;
    try {
      const j = JSON.parse(txt);
      if (Array.isArray(j)) info = `array · ${j.length} itens`;
      else if (j && typeof j === "object") info = `obj · chaves: ${Object.keys(j).join(",").slice(0, 80)}`;
    } catch { /* */ }
    return { action, works: true, info };
  } catch (e: any) {
    clearTimeout(t);
    return { action, works: false, info: "erro/timeout" };
  }
}

function provPrice(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return 6 + (h % 25) / 2; // 6..18,5
}
const fmt = (n: number) => (Math.round(n * 10) / 10).toString().replace(".", ",");

export default async function MercadoReal() {
  const comps2026 = await getCompetitions(2026);
  const paris = comps2026.find((c) => /paris grand slam/i.test(c.name || ""));

  // --- Mercado real (atletas do Paris Grand Slam 2026) ---
  let athletes: { id: string; info: IjfCompetitor }[] = [];
  let compName = "";
  if (paris) {
    compName = paris.name;
    const contests = await getCompetitionContests(paris.id_competition);
    const seen: string[] = [];
    for (const f of contests) {
      for (const id of [String(f.id_person_blue), String(f.id_person_white)]) {
        if (id && id !== "0" && !seen.includes(id)) seen.push(id);
      }
      if (seen.length >= 16) break;
    }
    const infos = await Promise.all(seen.map((id) => getCompetitor(id)));
    athletes = seen.map((id, i) => ({ id, info: infos[i] })).filter((a) => a.info) as any;
  }

  // --- Teste de inscritos de uma prova futura ---
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const upcoming = comps2026
    .filter((c) => { const d = new Date(String(c.date_from).replace(/\//g, "-")); return !isNaN(d.getTime()) && d.getTime() >= today.getTime() && c.name; })
    .sort((a, b) => new Date(String(a.date_from).replace(/\//g, "-")).getTime() - new Date(String(b.date_from).replace(/\//g, "-")).getTime())[0];

  let probeRows: { action: string; works: boolean; info: string }[] = [];
  let upcomingContests = -1;
  if (upcoming) {
    const ENTRY_ACTIONS = ["competition.competitors", "competition.get_competitors", "competition.entries", "competition.participants", "competition.competitor_list", "competition.draw"];
    probeRows = await Promise.all(ENTRY_ACTIONS.map((a) => rawProbe(a, upcoming.id_competition)));
    upcomingContests = (await getCompetitionContests(upcoming.id_competition)).length;
  }

  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: "system-ui, sans-serif", padding: "20px 16px 60px" }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <h1 style={{ fontFamily: FD, fontSize: 20, fontWeight: 700, textTransform: "uppercase", margin: 0 }}>Mercado real · prévia</h1>
        <p style={{ fontSize: 13, color: "#93a39a", lineHeight: 1.5 }}>
          {compName ? <>Amostra de atletas reais de <b style={{ color: "#cfd8d2" }}>{compName}</b>. Preços de exemplo (serão calculados pelo histórico).</> : "Não encontrei a competição."}
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
          {athletes.map((a) => {
            const cc = (a.info.country_short || "").toUpperCase();
            const name = `${a.info.given_name || ""} ${a.info.family_name || ""}`.trim();
            const gender = a.info.gender === "female" ? "F" : "M";
            const cat = (a.info.categories && a.info.categories[0]) || "";
            return (
              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 12, background: "#121815", border: "1px solid #243029", borderRadius: 12, padding: "10px 12px" }}>
                <div style={{ width: 44, height: 44, borderRadius: 9, background: TATAME, border: "1px solid #2a4d3e", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontFamily: FD, fontSize: 12, fontWeight: 700, color: "#aee9c9" }}>{cc || "—"}</span>
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name || `#${a.id}`}</div>
                  <div style={{ fontSize: 11.5, color: "#93a39a", marginTop: 2 }}>
                    {cc}{cat ? ` · ${cat}` : ""} · <span style={{ color: gender === "F" ? "#e6a3d0" : "#8ab6e6" }}>{gender === "F" ? "Feminino" : "Masculino"}</span>
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontFamily: FD, fontSize: 15, fontWeight: 700, color: GOLD }}>JC {fmt(provPrice(a.id))}</div>
                  <div style={{ fontSize: 9.5, color: "#5f6f67" }}>preço ex.</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Teste de inscritos */}
        <h2 style={{ fontFamily: FD, fontSize: 14, textTransform: "uppercase", color: "#cfd8d2", marginTop: 28 }}>Inscritos de prova futura?</h2>
        <p style={{ fontSize: 12, color: "#93a39a", margin: "2px 0 10px" }}>
          A testar com: <b style={{ color: "#cfd8d2" }}>{upcoming?.name || "—"}</b>. Combates já no sistema (draw): <b style={{ color: upcomingContests > 0 ? "#7fd1a3" : "#ef8d83" }}>{upcomingContests >= 0 ? upcomingContests : "—"}</b>.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {probeRows.map((r) => (
            <div key={r.action} style={{ display: "flex", justifyContent: "space-between", gap: 10, background: r.works ? "#101a14" : "#0f1411", border: `1px solid ${r.works ? "#2f6f4a" : "#1a221d"}`, borderRadius: 9, padding: "8px 11px" }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: r.works ? "#7fd1a3" : "#cfd8d2" }}>{r.works ? "✓ " : "✗ "}{r.action}</span>
              <span style={{ fontSize: 11, color: "#93a39a", whiteSpace: "nowrap" }}>{r.info}</span>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 11, color: "#5f6f67", marginTop: 24 }}>Prévia temporária.</p>
      </div>
    </main>
  );
}
