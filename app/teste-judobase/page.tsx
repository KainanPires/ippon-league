// Página de teste (escondida) para descobrir o acesso ao JudoBase.
// Corre no servidor da Vercel. Mostra o que cada endpoint devolve.
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const FD = "var(--font-geist-mono), ui-monospace, monospace";

// Parênteses codificados (%5B = [  %5D = ]) para evitar problemas no pedido.
const A = "%5Baction%5D";
const P = (k: string) => `%5B${k}%5D`;

type Target = { label: string; url: string };

const TARGETS: Target[] = [
  { label: "0 · SANIDADE (a Vercel sai para a net?)", url: "https://api.github.com/zen" },
  { label: "1 · data.ijf.org — competição 2653 (Paris)", url: `https://data.ijf.org/api/get_json?access_token=&params${A}=competition.get&params${P("id_competition")}=2653` },
  { label: "2 · data.judobase.org — competição 2653", url: `https://data.judobase.org/api/get_json?access_token=&params${A}=competition.get&params${P("id_competition")}=2653` },
  { label: "3 · data.ijf.org — atleta id 9194 (wrl_current)", url: `https://data.ijf.org/api/get_json?access_token=&params${A}=competitor.wrl_current&params${P("id_person")}=9194` },
  { label: "4 · data.ijf.org — procurar atleta (Riner)", url: `https://data.ijf.org/api/get_json?access_token=&params${A}=competitor.find&params${P("family_name")}=Riner` },
  { label: "5 · data.ijf.org — lista competições 2024", url: `https://data.ijf.org/api/get_json?access_token=&params${A}=competition.get_list&params${P("year")}=2024` },
];

type Probe = { ok: boolean; status: number; ctype: string; info: string; preview: string; len: number; ms: number };

async function probe(url: string): Promise<Probe> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 14000);
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: ctrl.signal,
      redirect: "follow",
      headers: {
        Accept: "application/json, text/plain, */*",
        "User-Agent": "Mozilla/5.0 (IpponLeague test)",
        Referer: "https://www.judobase.org/",
      },
    });
    const text = await res.text();
    clearTimeout(timer);
    const ms = Date.now() - t0;
    let info = "";
    try {
      const json = JSON.parse(text);
      if (Array.isArray(json)) info = `JSON array · ${json.length} itens`;
      else info = `JSON · chaves: ${Object.keys(json).join(", ").slice(0, 240)}`;
    } catch {
      info = "Não é JSON (ver bruto abaixo)";
    }
    return { ok: res.ok, status: res.status, ctype: res.headers.get("content-type") || "", info, preview: text.slice(0, 1600), len: text.length, ms };
  } catch (e: any) {
    clearTimeout(timer);
    return { ok: false, status: 0, ctype: "", info: "ERRO: " + (e?.message || String(e)), preview: "", len: 0, ms: Date.now() - t0 };
  }
}

export default async function TesteJudobase() {
  const results = await Promise.all(TARGETS.map(async (tg) => ({ ...tg, r: await probe(tg.url) })));

  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: "system-ui, sans-serif", padding: "20px 16px 60px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <h1 style={{ fontFamily: FD, fontSize: 20, fontWeight: 700, textTransform: "uppercase" }}>Teste JudoBase</h1>
        <p style={{ fontSize: 13, color: "#93a39a", lineHeight: 1.5 }}>
          Verde = respondeu (200). O teste 0 confirma se a Vercel consegue sair para a internet. Manda-me um print.
        </p>

        {results.map((row) => {
          const good = row.r.ok && row.r.status === 200;
          return (
            <div key={row.label} style={{ border: `1px solid ${good ? "#2f6f4a" : "#5a2f2c"}`, borderRadius: 12, padding: 14, marginTop: 14, background: "#121815" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>{row.label}</span>
                <span style={{ fontFamily: FD, fontSize: 12, fontWeight: 700, color: good ? "#7fd1a3" : "#ef8d83", whiteSpace: "nowrap" }}>
                  {row.r.status === 0 ? "FALHOU" : `HTTP ${row.r.status}`} · {row.r.ms}ms
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

        <p style={{ fontSize: 11, color: "#5f6f67", marginTop: 20 }}>Página temporária de diagnóstico.</p>
      </div>
    </main>
  );
}
