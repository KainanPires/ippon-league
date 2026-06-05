// PROVA END-TO-END: lutas reais (JudoBase) -> pontos de fantasy do NOSSO motor (lib/engine).
import { scoreActions, POINTS, type ActionType } from "@/lib/engine";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const FD = "var(--font-geist-mono), ui-monospace, monospace";
const GOLD = "#d9a441";
const IJF = "https://data.ijf.org/api/get_json";
const COMP = "2653"; // Jogos Olímpicos Paris 2024
const COMP_NAME = "Jogos Olímpicos Paris 2024";

function u(action: string, params: Record<string, string>): string {
  const qs = Object.entries(params).map(([k, v]) => `&params%5B${k}%5D=${encodeURIComponent(v)}`).join("");
  return `${IJF}?access_token=&params%5Baction%5D=${action}${qs}`;
}

async function getJson(url: string): Promise<any> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 16000);
  try {
    const res = await fetch(url, { cache: "no-store", signal: ctrl.signal, headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 (IpponLeague)" } });
    const txt = await res.text();
    clearTimeout(timer);
    return JSON.parse(txt);
  } catch {
    clearTimeout(timer);
    return null;
  }
}

const n = (v: any) => {
  const x = parseInt(String(v ?? "0"), 10);
  return isNaN(x) ? 0 : x;
};

// Converte UM combate, do ponto de vista de um lado, em ações do nosso motor.
function actionsForSide(f: any, me: "b" | "w"): ActionType[] {
  const opp = me === "b" ? "w" : "b";
  const out: ActionType[] = [];
  const push = (a: ActionType, times: number) => { for (let i = 0; i < times; i++) out.push(a); };
  push("ippon_feito", n(f[`ippon_${me}`]));
  push("waza_ari_feito", n(f[`waza_${me}`]));
  push("yuko_feito", n(f[`yuko_${me}`]));
  push("shido_provocado", n(f[`penalty_${opp}`]));   // shidos do adversário = provocados por mim
  push("ippon_sofrido", n(f[`ippon_${opp}`]));
  push("waza_ari_sofrido", n(f[`waza_${opp}`]));
  push("yuko_sofrido", n(f[`yuko_${opp}`]));
  push("shido_recebido", n(f[`penalty_${me}`]));
  return out;
}

type Agg = {
  id: string; points: number; fights: number; wins: number;
  ippon: number; waza: number; yuko: number; shidoFor: number; shidoAgainst: number;
};

export default async function Prova() {
  const data = await getJson(u("competition.contests", { id_competition: COMP }));
  const contests: any[] = data?.contests || [];

  const byPerson = new Map<string, Agg>();
  const ensure = (id: string): Agg => {
    let a = byPerson.get(id);
    if (!a) { a = { id, points: 0, fights: 0, wins: 0, ippon: 0, waza: 0, yuko: 0, shidoFor: 0, shidoAgainst: 0 }; byPerson.set(id, a); }
    return a;
  };

  for (const f of contests) {
    for (const side of ["b", "w"] as const) {
      const id = String(f[side === "b" ? "id_person_blue" : "id_person_white"] || "");
      if (!id || id === "0") continue;
      const acts = actionsForSide(f, side);
      const pts = scoreActions(acts); // <-- NOSSO MOTOR
      const a = ensure(id);
      a.points += pts;
      a.fights += 1;
      if (String(f.id_winner || "") === id) a.wins += 1;
      a.ippon += n(f[`ippon_${side}`]);
      a.waza += n(f[`waza_${side}`]);
      a.yuko += n(f[`yuko_${side}`]);
      a.shidoFor += n(f[side === "b" ? "penalty_w" : "penalty_b"]);
      a.shidoAgainst += n(f[`penalty_${side}`]);
    }
  }

  const ranking = [...byPerson.values()].sort((x, y) => y.points - x.points).slice(0, 16);

  // Resolver nomes só do top 16 (em paralelo)
  const names = new Map<string, string>();
  await Promise.all(ranking.map(async (r) => {
    const info = await getJson(u("competitor.info", { id_person: r.id }));
    if (info && info.family_name) {
      const fam = String(info.family_name || "");
      const giv = String(info.given_name || "");
      const cc = String(info.country_short || "");
      names.set(r.id, `${giv} ${fam}${cc ? ` (${cc})` : ""}`.trim());
    } else {
      names.set(r.id, `#${r.id}`);
    }
  }));

  const top = ranking[0];
  const topFights = top
    ? contests
        .filter((f) => String(f.id_person_blue) === top.id || String(f.id_person_white) === top.id)
        .map((f) => {
          const side = String(f.id_person_blue) === top.id ? "b" : "w";
          const acts = actionsForSide(f, side as "b" | "w");
          return { round: String(f.round_name || f.round || ""), won: String(f.id_winner) === top.id, pts: scoreActions(acts), acts };
        })
    : [];

  const cell: any = { padding: "7px 8px", fontSize: 12, borderBottom: "1px solid #1a221d", whiteSpace: "nowrap" };

  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: "system-ui, sans-serif", padding: "20px 16px 60px" }}>
      <div style={{ maxWidth: 820, margin: "0 auto" }}>
        <h1 style={{ fontFamily: FD, fontSize: 21, fontWeight: 700, textTransform: "uppercase", margin: 0 }}>Prova: dados reais → nosso motor</h1>
        <p style={{ fontSize: 13, color: "#93a39a", lineHeight: 1.5 }}>
          {COMP_NAME} · <b style={{ color: "#cfd8d2" }}>{contests.length}</b> lutas processadas · <b style={{ color: "#cfd8d2" }}>{byPerson.size}</b> atletas ·
          pontuação calculada por <b style={{ color: GOLD }}>lib/engine.ts</b> (ippon {POINTS.ippon_feito}, waza-ari {POINTS.waza_ari_feito}, yuko {POINTS.yuko_feito}, shido provocado {POINTS.shido_provocado}…).
        </p>

        {contests.length === 0 ? (
          <div style={{ background: "#1a0f0e", border: "1px solid #5a2f2c", borderRadius: 10, padding: 14, color: "#ef8d83" }}>Não vieram lutas. Verifica a ligação.</div>
        ) : (
          <>
            <h2 style={{ fontFamily: FD, fontSize: 15, textTransform: "uppercase", color: GOLD, marginTop: 22, marginBottom: 8 }}>Ranking de fantasy (top 16)</h2>
            <div style={{ overflowX: "auto", border: "1px solid #243029", borderRadius: 12 }}>
              <table style={{ borderCollapse: "collapse", width: "100%", background: "#121815" }}>
                <thead>
                  <tr style={{ color: "#93a39a", textAlign: "left" }}>
                    <th style={cell}>#</th><th style={cell}>Atleta</th><th style={cell}>Lutas</th><th style={cell}>V</th>
                    <th style={cell}>Ippon</th><th style={cell}>Waza</th><th style={cell}>Yuko</th><th style={cell}>Shido +/−</th>
                    <th style={{ ...cell, color: GOLD }}>Pontos</th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.map((r, i) => (
                    <tr key={r.id} style={{ background: i === 0 ? "#16201b" : "transparent" }}>
                      <td style={cell}>{i + 1}</td>
                      <td style={{ ...cell, whiteSpace: "normal", fontWeight: 600 }}>{names.get(r.id)}</td>
                      <td style={cell}>{r.fights}</td>
                      <td style={cell}>{r.wins}</td>
                      <td style={cell}>{r.ippon}</td>
                      <td style={cell}>{r.waza}</td>
                      <td style={cell}>{r.yuko}</td>
                      <td style={cell}>{r.shidoFor}/{r.shidoAgainst}</td>
                      <td style={{ ...cell, fontFamily: FD, fontWeight: 700, color: GOLD }}>{r.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {top && (
              <>
                <h2 style={{ fontFamily: FD, fontSize: 15, textTransform: "uppercase", color: GOLD, marginTop: 26, marginBottom: 8 }}>Detalhe luta-a-luta · {names.get(top.id)}</h2>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {topFights.map((ft, idx) => (
                    <div key={idx} style={{ background: "#0f1411", border: "1px solid #243029", borderRadius: 10, padding: "10px 12px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                        <span style={{ fontWeight: 700, fontSize: 13 }}>{ft.round || "—"} · <span style={{ color: ft.won ? "#7fd1a3" : "#ef8d83" }}>{ft.won ? "venceu" : "perdeu"}</span></span>
                        <span style={{ fontFamily: FD, fontWeight: 700, color: GOLD }}>{ft.pts >= 0 ? "+" : ""}{ft.pts} pts</span>
                      </div>
                      <div style={{ fontSize: 11.5, color: "#93a39a", marginTop: 4 }}>
                        {ft.acts.length ? ft.acts.map((a, j) => <span key={j} style={{ marginRight: 8 }}>{a} ({POINTS[a] > 0 ? "+" : ""}{POINTS[a]})</span>) : "sem ações registadas"}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
        <p style={{ fontSize: 11, color: "#5f6f67", marginTop: 24 }}>Página temporária de prova.</p>
      </div>
    </main>
  );
}
