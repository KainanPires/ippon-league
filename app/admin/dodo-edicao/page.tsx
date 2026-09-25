"use client";

// app/admin/dodo-edicao/page.tsx
//
// Painel de admin (so Kainan) para ABRIR a 1a edicao da Copa do Dodo.
// A verdadeira barreira e no servidor (users.is_admin); aqui so escondemos a UI.

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

const GOLD = "#d9a441";
const FUNDO = "#141110";
const CARTAO = "#1e1a17";
const BORDA = "#2c2622";

interface Edicao {
  id: string;
  numero: number;
  ano: number | null;
  estado: string;
  inscricoes_de?: string | null;
  inscricoes_ate: string | null;
  league_id?: string | null;
}
interface Preview {
  ok: boolean;
  edicoes?: Edicao[];
  proximoNumero?: number;
  jaHaAberta?: { numero: number; inscricoes_ate: string | null } | null;
}
interface Resultado {
  ok: boolean;
  erro?: string;
  detalhe?: string;
  jaAberta?: boolean;
  edicao?: Edicao;
  nota?: string;
}

export default function DodoEdicaoPage() {
  const [acesso, setAcesso] = useState<"..." | "sim" | "nao">("...");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [numero, setNumero] = useState<string>("1");
  const [ate, setAte] = useState<string>("2026-10-28T12:00");
  const [forcar, setForcar] = useState(false);
  const [aCriar, setACriar] = useState(false);
  const [res, setRes] = useState<Resultado | null>(null);

  const token = useCallback(async (): Promise<string> => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || "";
  }, []);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user?.id;
      if (!uid) { if (vivo) setAcesso("nao"); return; }
      const { data: u } = await supabase.from("users").select("is_admin").eq("id", uid).maybeSingle();
      if (!vivo) return;
      if (!u?.is_admin) { setAcesso("nao"); return; }
      setAcesso("sim");
      try {
        const tk = data.session?.access_token || "";
        const r = await fetch("/api/admin/dodo-edicao", { cache: "no-store", headers: { Authorization: `Bearer ${tk}` } });
        const j = await r.json();
        if (vivo && j?.ok) {
          setPreview(j as Preview);
          if (j.proximoNumero) setNumero(String(j.proximoNumero));
        }
      } catch { /* segue sem pre-visualizacao */ }
    })();
    return () => { vivo = false; };
  }, []);

  async function criar() {
    setACriar(true);
    setRes(null);
    try {
      const tk = await token();
      const r = await fetch("/api/admin/dodo-edicao", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tk}` },
        body: JSON.stringify({ inscricoes_ate: ate, numero: Number(numero), forcar }),
      });
      const j = (await r.json()) as Resultado;
      setRes(j);
    } catch (e) {
      setRes({ ok: false, erro: "Falha de rede.", detalhe: e instanceof Error ? e.message : String(e) });
    } finally {
      setACriar(false);
    }
  }

  if (acesso === "...") return <Moldura><p style={{ color: "#9a938c" }}>A carregar...</p></Moldura>;
  if (acesso === "nao") {
    return (
      <Moldura>
        <h1 style={{ color: GOLD, fontSize: 20, margin: 0 }}>Sem acesso</h1>
        <p style={{ color: "#9a938c" }}>Esta pagina e so para administradores.</p>
      </Moldura>
    );
  }

  return (
    <Moldura>
      <h1 style={{ color: GOLD, fontSize: 22, margin: "0 0 4px" }}>Abrir edicao do Dodo</h1>
      <p style={{ color: "#c8c0b8", marginTop: 0, fontSize: 14, lineHeight: 1.5 }}>
        Cria a edicao da Copa do Dodo com as inscricoes abertas ja. As seguintes abrem sozinhas depois
        de cada sorteio; so a primeira e manual. A competicao de arranque nao se escolhe aqui: o sorteio
        (quando as inscricoes fecharem) usa a competicao cujo mercado estiver em foco nesse momento.
      </p>

      {preview && (
        <div style={caixa}>
          <Linha rotulo="Proximo numero sugerido" valor={String(preview.proximoNumero ?? "-")} />
          <Linha rotulo="Edicoes existentes" valor={String((preview.edicoes || []).length)} />
          {preview.jaHaAberta && (
            <p style={{ color: GOLD, fontSize: 13, margin: "8px 0 0" }}>
              Ja existe a {preview.jaHaAberta.numero}a edicao com inscricoes abertas (fecha {curta(preview.jaHaAberta.inscricoes_ate)}).
              Marca &quot;forcar&quot; so se souberes o que estas a fazer.
            </p>
          )}
          {(preview.edicoes || []).length > 0 && (
            <div style={{ marginTop: 10, borderTop: `1px solid ${BORDA}`, paddingTop: 10 }}>
              {(preview.edicoes || []).map((e) => (
                <div key={e.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "#9a938c", padding: "3px 0" }}>
                  <span>{e.numero}a - {e.estado}</span>
                  <span>{curta(e.inscricoes_ate)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ ...caixa, display: "grid", gap: 12 }}>
        <label style={campo}>
          <span style={rot}>Numero da edicao</span>
          <input value={numero} onChange={(e) => setNumero(e.target.value)} inputMode="numeric" style={input} />
        </label>
        <label style={campo}>
          <span style={rot}>Fecho das inscricoes (o sorteio corre a seguir)</span>
          <input type="datetime-local" value={ate} onChange={(e) => setAte(e.target.value)} style={input} />
          <span style={{ fontSize: 11.5, color: "#8b8079", marginTop: 4 }}>
            Poe na vespera da competicao de arranque (ex.: 28/10 para arrancar no Abu Dhabi de 29/10), com o mercado ainda aberto.
          </span>
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, color: "#c8c0b8", fontSize: 14 }}>
          <input type="checkbox" checked={forcar} onChange={(e) => setForcar(e.target.checked)} />
          Criar mesmo que ja exista uma edicao aberta (forcar)
        </label>
      </div>

      <button
        onClick={criar}
        disabled={aCriar}
        style={{ background: aCriar ? "#6b5a2c" : GOLD, color: "#141110", border: "none", borderRadius: 10, padding: "12px 18px", fontWeight: 700, fontSize: 15, cursor: aCriar ? "default" : "pointer" }}
      >
        {aCriar ? "A abrir..." : "Abrir edicao"}
      </button>

      {res && (
        <div style={{ ...caixa, marginTop: 18, borderColor: res.ok ? "#2f5d3f" : "#6b2f2f" }}>
          {!res.ok && (
            <>
              <p style={{ color: "#ef8d83", margin: 0, fontWeight: 700 }}>{res.erro}</p>
              {res.detalhe && <p style={{ color: "#9a938c", fontSize: 12 }}>{res.detalhe}</p>}
            </>
          )}
          {res.ok && res.edicao && (
            <>
              <p style={{ color: "#7fd1a3", margin: 0, fontWeight: 700 }}>{res.edicao.numero}a Copa do Dodo aberta!</p>
              <Linha rotulo="Estado" valor={res.edicao.estado} />
              <Linha rotulo="Inscricoes fecham" valor={curta(res.edicao.inscricoes_ate)} />
              <Linha rotulo="Ano" valor={String(res.edicao.ano ?? "-")} />
              {res.nota && <p style={{ color: "#9a938c", fontSize: 12, marginTop: 8 }}>{res.nota}</p>}
              <a href="/dodo" style={{ display: "inline-block", marginTop: 10, color: GOLD, border: `1px solid ${GOLD}`, borderRadius: 8, padding: "8px 14px", textDecoration: "none", fontWeight: 600, fontSize: 14 }}>
                Ver a pagina do Dodo
              </a>
            </>
          )}
        </div>
      )}
    </Moldura>
  );
}

function curta(iso: string | null | undefined): string {
  if (!iso) return "-";
  const t = Date.parse(String(iso));
  if (!Number.isFinite(t)) return "-";
  return new Date(t).toLocaleString("pt-PT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "4px 0", fontSize: 14 }}>
      <span style={{ color: "#9a938c" }}>{rotulo}</span>
      <span style={{ color: "#efeadd", fontWeight: 600, textAlign: "right" }}>{valor}</span>
    </div>
  );
}
function Moldura({ children }: { children: React.ReactNode }) {
  return (
    <main style={{ minHeight: "100vh", background: FUNDO, padding: "28px 16px" }}>
      <div style={{ maxWidth: 620, margin: "0 auto" }}>{children}</div>
    </main>
  );
}

const caixa: React.CSSProperties = { background: CARTAO, border: `1px solid ${BORDA}`, borderRadius: 12, padding: 16, marginTop: 14 };
const campo: React.CSSProperties = { display: "flex", flexDirection: "column" };
const rot: React.CSSProperties = { fontSize: 12.5, color: "#9a938c", marginBottom: 5 };
const input: React.CSSProperties = { background: "#0e0c0b", border: `1px solid ${BORDA}`, borderRadius: 8, padding: "10px 12px", color: "#efeadd", fontSize: 15 };
