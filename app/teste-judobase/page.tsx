// Página de teste (escondida) para descobrir o acesso ao JudoBase.
// Corre no servidor da Vercel (sem problemas de CORS) e mostra o que cada endpoint devolve.
export const dynamic = "force-dynamic";

const FD = "var(--font-geist-mono), ui-monospace, monospace";
const BASE = "https://data.judobase.org/api/get_json";

type Target = { label: string; url: string };

const TARGETS: Target[] = [
  { label: "1 · Conectividade (atleta id 9194)", url: `${BASE}?access_token=&params[action]=competitor.wrl_current&params[id_person]=9194` },
  { label: "2 · Competição id 2653 (Paris) — competition.get", url: `${BASE}?access_token=&params[action]=competition.get&params[id_competition]=2653` },
  { label: "3 · Competição 2653 — competition.get_info", url: `${BASE}?access_token=&params[action]=competition.get_info&params[id_competition]=2653` },
  { label: "4 · Combates da competição 2653 — contest.find", url: `${BASE}?access_token=&params[action]=contest.find&params[id_competition]=2653` },
  { label: "5 · Procurar atleta — competitor.find (Riner)", url: `${BASE}?access_token=&params[action]=competitor.find&params[family_name]=Riner` },
  { label: "6 · Lista de competições 2024 — competition.get_list", url: `${BASE}?access_token=&params[action]=competition.get_list&params[year]=2024` },
];

type Probe = { ok: boolean; status: number; ctype: string; info: string; preview: string; len: number };

async function probe(url: string): Promise<Probe> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 9000);
  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: ctrl.signal,
      headers: { Accept: "application/json", "User-Agent": "IpponLeague/0.1 (test)" },
    });
    const text = await res.text();
    clearTimeout(timer);
    let info = "";
    try {
      const json = JSON.parse(text);
      if (Array.isArray(json)) info = `JSON array · ${json.length} itens`;
      else info = `JSON · chaves: ${Object.keys(json).join(", ").slice(0, 240)}`;
    } catch {
      info = "Resposta não é JSON (ver bruto abaixo)";
    }
    return { ok: res.ok, status: res.status, ctype: res.headers.get("content-type") || "", info, preview: text.slice(0, 1600), len: text.length };
  } catch (e: any) {
    clearTimeout(timer);
    return { ok: false, status: 0, ctype: "", info: "ERRO: " + (e?.message || String(e)), preview: "", len: 0 };
  }
}

export default async function TesteJudobase() {
  const results = await Promise.all(TARGETS.map(async (tg) => ({ ...tg, r: await probe(tg.url) })));

  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: "system-ui, sans-serif", padding: "20px 16px 60px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <h1 style={{ fontFamily: FD, fontSize: 20, fontWeight: 700, textTransform: "uppercase" }}>Teste JudoBase</h1>
        <p style={{ fontSize: 13, color: "#93a39a", lineHeight: 1.5 }}>
          Testa o acesso à API do JudoBase a partir do servidor. Verde = respondeu (200). Manda-me um print desta página.
        </p>

        {results.map((row) => {
          const good = row.r.ok && row.r.status === 200;
          return (
            <div key={row.label} style={{ border: `1px solid ${good ? "#2f6f4a" : "#5a2f2c"}`, borderRadius: 12, padding: 14, marginTop: 14, background: "#121815" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>{row.label}</span>
                <span style={{ fontFamily: FD, fontSize: 12, fontWeight: 700, color: good ? "#7fd1a3" : "#ef8d83", whiteSpace: "nowrap" }}>
                  {row.r.status === 0 ? "FALHOU" : `HTTP ${row.r.status}`}
                </span>
              </div>
              <div style={{ fontSize: 11, color: "#7c8a82", marginTop: 4, wordBreak: "break-all" }}>{row.url}</div>
              <div style={{ fontSize: 12, color: "#cfd8d2", marginTop: 6 }}>
                {row.r.info} {row.r.len ? `· ${row.r.len} chars · ${row.r.ctype}` : ""}
              </div>
              {row.r.preview && (
                <pre style={{ marginTop: 8, background: "#0c0e0d", border: "1px solid #243029", borderRadius: 8, padding: 10, fontSize: 11, lineHeight: 1.45, color: "#aeb8b1", overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 260, overflowY: "auto" }}>
                  {row.r.preview}
                </pre>
              )}
            </div>
          );
        })}

        <p style={{ fontSize: 11, color: "#5f6f67", marginTop: 20 }}>
          Página temporária de diagnóstico — apagamos depois de descobrirmos o acesso.
        </p>
      </div>
    </main>
  );
}
