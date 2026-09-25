"use client";

// app/admin/copa-teste/page.tsx
//
// Painel de admin (só para o Kainan) para montar uma COPA IPPON de teste com as
// contas Pro que já existem. Chama /api/admin/copa-teste com o token da sessão.
// A verdadeira barreira é no servidor (users.is_admin); aqui só escondemos a UI
// de quem não é admin.

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

const GOLD = "#d9a441";
const FUNDO = "#141110";
const CARTAO = "#1e1a17";
const BORDA = "#2c2622";

interface RelEquipa {
  comp: string;
  criadas: number;
  jaTinham: number;
  semPlantel?: boolean;
}
interface Resultado {
  ok: boolean;
  erro?: string;
  detalhe?: string;
  jaExistia?: boolean;
  nota?: string;
  league_id?: string;
  invite_code?: string;
  link?: string;
  participantes?: number;
  total_pros?: number;
  comps_da_chave?: string[];
  confrontos?: number;
  equipas?: RelEquipa[];
  passos?: string[];
  copa_estado?: string;
}
interface Preview {
  ok: boolean;
  total_pros?: number;
  participantes_no_teste?: number;
  max?: number;
  comps_da_chave?: string[];
  ligaExistente?: { id: string; invite_code: string; copa_estado: string } | null;
}

export default function CopaTestePage() {
  const [acesso, setAcesso] = useState<"..." | "sim" | "nao">("...");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [res, setRes] = useState<Resultado | null>(null);
  const [aCriar, setACriar] = useState(false);
  const [recriar, setRecriar] = useState(false);
  const [chave, setChave] = useState<string>("");
  const [aEspreitar, setAEspreitar] = useState(false);

  const token = useCallback(async (): Promise<string> => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || "";
  }, []);

  async function espreitar() {
    setAEspreitar(true);
    setChave("");
    try {
      const tk = await token();
      const r = await fetch("/api/admin/copa-teste?debug=confrontos", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${tk}` },
      });
      const j = await r.json();
      setChave(JSON.stringify(j, null, 2));
    } catch (e) {
      setChave("Falha: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setAEspreitar(false);
    }
  }

  // 1) Confirma admin e carrega a pré-visualização.
  useEffect(() => {
    let vivo = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user?.id;
      if (!uid) {
        if (vivo) setAcesso("nao");
        return;
      }
      const { data: u } = await supabase.from("users").select("is_admin").eq("id", uid).maybeSingle();
      if (!vivo) return;
      if (!u?.is_admin) {
        setAcesso("nao");
        return;
      }
      setAcesso("sim");
      try {
        const tk = data.session?.access_token || "";
        const r = await fetch("/api/admin/copa-teste", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${tk}` },
        });
        const j = await r.json();
        if (vivo && j?.ok) setPreview(j as Preview);
      } catch {
        /* segue sem pré-visualização */
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  async function criar() {
    setACriar(true);
    setRes(null);
    try {
      const tk = await token();
      const r = await fetch("/api/admin/copa-teste", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tk}` },
        body: JSON.stringify({ recriar }),
      });
      const j = (await r.json()) as Resultado;
      setRes(j);
    } catch (e) {
      setRes({ ok: false, erro: "Falha de rede.", detalhe: e instanceof Error ? e.message : String(e) });
    } finally {
      setACriar(false);
    }
  }

  if (acesso === "...") {
    return <Moldura><p style={{ color: "#9a938c" }}>A carregar…</p></Moldura>;
  }
  if (acesso === "nao") {
    return (
      <Moldura>
        <h1 style={{ color: GOLD, fontSize: 20, margin: 0 }}>Sem acesso</h1>
        <p style={{ color: "#9a938c" }}>Esta página é só para administradores.</p>
      </Moldura>
    );
  }

  return (
    <Moldura>
      <h1 style={{ color: GOLD, fontSize: 22, margin: "0 0 4px" }}>Copa de teste</h1>
      <p style={{ color: "#c8c0b8", marginTop: 0, fontSize: 14, lineHeight: 1.5 }}>
        Monta uma Copa Ippon completa com as contas Pro que já existem, nos clássicos com dados reais
        (Osaka → Haia → Montreal). Escreve numa liga <b>COPA TESTE</b> nova, mete essas contas como
        membros, monta-lhes uma equipa em cada clássico (sem tocar em equipas já guardadas) e faz o
        sorteio. Depois é só congelar e apurar.
      </p>

      {preview && (
        <div style={caixa}>
          <Linha rotulo="Contas Pro encontradas" valor={String(preview.total_pros ?? "—")} />
          <Linha rotulo="Vão entrar no teste" valor={String(preview.participantes_no_teste ?? "—")} />
          <Linha rotulo="Clássicos da chave" valor={(preview.comps_da_chave || []).join(" → ") || "—"} />
          {preview.ligaExistente && (
            <p style={{ color: GOLD, fontSize: 13, margin: "8px 0 0" }}>
              Já existe uma COPA TESTE por terminar (estado: {preview.ligaExistente.copa_estado}). Marca
              &quot;recriar&quot; para fazer outra.
            </p>
          )}
        </div>
      )}

      <label style={{ display: "flex", alignItems: "center", gap: 8, margin: "14px 0", color: "#c8c0b8", fontSize: 14 }}>
        <input type="checkbox" checked={recriar} onChange={(e) => setRecriar(e.target.checked)} />
        Criar uma nova mesmo que já exista uma por terminar (recriar)
      </label>

      <button
        onClick={criar}
        disabled={aCriar}
        style={{
          background: aCriar ? "#6b5a2c" : GOLD,
          color: "#141110",
          border: "none",
          borderRadius: 10,
          padding: "12px 18px",
          fontWeight: 700,
          fontSize: 15,
          cursor: aCriar ? "default" : "pointer",
        }}
      >
        {aCriar ? "A montar a copa…" : "Criar copa de teste"}
      </button>

      <button
        onClick={espreitar}
        disabled={aEspreitar}
        style={{
          marginLeft: 10,
          background: "transparent",
          color: GOLD,
          border: `1px solid ${GOLD}`,
          borderRadius: 10,
          padding: "12px 18px",
          fontWeight: 600,
          fontSize: 15,
          cursor: aEspreitar ? "default" : "pointer",
        }}
      >
        {aEspreitar ? "A ler…" : "Espreitar chave"}
      </button>

      {chave && (
        <pre
          style={{
            ...caixa,
            marginTop: 16,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            fontSize: 11,
            color: "#c8c0b8",
            maxHeight: 420,
            overflow: "auto",
          }}
        >
          {chave}
        </pre>
      )}

      {res && (
        <div style={{ ...caixa, marginTop: 18, borderColor: res.ok ? "#2f5d3f" : "#6b2f2f" }}>
          {!res.ok && (
            <>
              <p style={{ color: "#ef8d83", margin: 0, fontWeight: 700 }}>{res.erro}</p>
              {res.detalhe && <p style={{ color: "#9a938c", fontSize: 12 }}>{res.detalhe}</p>}
            </>
          )}
          {res.ok && res.jaExistia && (
            <>
              <p style={{ color: GOLD, margin: 0, fontWeight: 700 }}>Já existia uma COPA TESTE.</p>
              <p style={{ color: "#c8c0b8", fontSize: 13 }}>{res.nota}</p>
              {res.invite_code && <LinkLiga code={res.invite_code} />}
            </>
          )}
          {res.ok && !res.jaExistia && (
            <>
              <p style={{ color: "#7fd1a3", margin: 0, fontWeight: 700 }}>Copa de teste criada!</p>
              <Linha rotulo="Participantes" valor={`${res.participantes} (de ${res.total_pros} Pro)`} />
              <Linha rotulo="Confrontos na 1ª ronda" valor={String(res.confrontos ?? "—")} />
              <Linha rotulo="Clássicos da chave" valor={(res.comps_da_chave || []).join(" → ")} />
              {(res.equipas || []).map((e) => (
                <Linha
                  key={e.comp}
                  rotulo={`Equipas em ${e.comp}`}
                  valor={
                    e.semPlantel
                      ? "sem plantel guardado"
                      : `${e.criadas} criadas · ${e.jaTinham} já tinham`
                  }
                />
              ))}
              {res.invite_code && <LinkLiga code={res.invite_code} />}

              <div style={{ marginTop: 12, borderTop: `1px solid ${BORDA}`, paddingTop: 12 }}>
                <p style={{ color: GOLD, fontWeight: 700, margin: "0 0 6px", fontSize: 14 }}>Passos para levar até ao campeão</p>
                <ol style={{ color: "#c8c0b8", fontSize: 13, lineHeight: 1.6, paddingLeft: 18, margin: 0 }}>
                  <li>
                    Congela cada clássico da chave (uma vez cada):{" "}
                    {(res.comps_da_chave || []).map((c, i) => (
                      <code key={c} style={codigo}>
                        /api/cron?key=SEGREDO&amp;recongelar={c}
                        {i < (res.comps_da_chave || []).length - 1 ? " · " : ""}
                      </code>
                    ))}
                  </li>
                  <li>
                    Apura ronda a ronda:{" "}
                    <code style={codigo}>/api/cron?key=SEGREDO&amp;apurar={res.league_id}</code> — uma
                    vez por ronda, à medida que cada clássico fica congelado. (Ou abre a página da liga:
                    ela apura sozinha ao carregar.)
                  </li>
                </ol>
                <p style={{ color: "#9a938c", fontSize: 12, marginTop: 8 }}>
                  Troca <b>SEGREDO</b> pela tua CRON_SECRET. Os três clássicos são consecutivos, por isso
                  a ronda 2 e a 3 prendem-se automaticamente a Haia e Montreal.
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </Moldura>
  );
}

function LinkLiga({ code }: { code: string }) {
  return (
    <a
      href={`/liga/${code}`}
      style={{
        display: "inline-block",
        marginTop: 10,
        color: GOLD,
        border: `1px solid ${GOLD}`,
        borderRadius: 8,
        padding: "8px 14px",
        textDecoration: "none",
        fontWeight: 600,
        fontSize: 14,
      }}
    >
      Abrir a liga da copa →
    </a>
  );
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

const caixa: React.CSSProperties = {
  background: CARTAO,
  border: `1px solid ${BORDA}`,
  borderRadius: 12,
  padding: 16,
  marginTop: 14,
};
const codigo: React.CSSProperties = {
  background: "#0e0c0b",
  border: `1px solid ${BORDA}`,
  borderRadius: 6,
  padding: "1px 6px",
  color: "#c8c0b8",
  fontSize: 12,
  wordBreak: "break-all",
};
