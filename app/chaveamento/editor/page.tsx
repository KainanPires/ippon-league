"use client";

// app/chaveamento/editor/page.tsx
//
// PAINEL DE CHAVEAMENTO — onde o "chaveador" publica a chave (bracket) de cada
// competição. Molde do editor do blog, mas com permissão PRÓPRIA: gate por
// `is_chaveador` (não é o `is_editor` do blog). Assim quem faz chaves não mexe
// no blog, e vice-versa.
//
// Uma chave por competição (não-clássica). A chave são PRINTS (screenshots) com
// legenda e categoria, mais uma nota geral. Publicar dispara a notificação
// "Chave oficial disponível" a todos, na língua de cada um (via /api/chaveamento).

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Mascot } from "@/components/Mascot";
import { useT } from "@/lib/i18n";
import { CALENDARIO_2026, competicaoDaSemana, proximaDepoisDe } from "@/lib/calendario";

const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";

// Só competições REAIS (os clássicos não têm chaveamento), por ordem de semana.
const COMPS = CALENDARIO_2026.filter((s) => !s.classico).sort((a, b) => a.semana - b.semana);

// A competição de arranque: a da semana, ou a próxima real se a atual for clássica.
function compPorOmissao(): string {
  const atual = competicaoDaSemana(new Date());
  if (!atual.classico) return atual.idCompeticao;
  let s = atual;
  for (let i = 0; i < CALENDARIO_2026.length; i++) {
    s = proximaDepoisDe(s);
    if (!s.classico) return s.idCompeticao;
  }
  return COMPS[0]?.idCompeticao || "";
}

interface Print {
  url: string;
  legenda: string;
  categoria: string;
}
interface Form {
  id: string;
  titulo: string;
  nota: string;
  imagens: Print[];
  estado: string; // "rascunho" | "publicado"
}
const VAZIO: Form = { id: "", titulo: "", nota: "", imagens: [], estado: "rascunho" };

interface Item {
  id: string;
  id_competicao: string;
  nome_competicao: string | null;
  estado: string;
  atualizado_em: string;
}

export default function EditorChaveamento() {
  const t = useT();
  const [acesso, setAcesso] = useState<"a-ver" | "sim" | "nao">("a-ver");
  const [meuNome, setMeuNome] = useState("");
  const [comp, setComp] = useState<string>(compPorOmissao());
  const [f, setF] = useState<Form>(VAZIO);
  const [lista, setLista] = useState<Item[]>([]);
  const [aGravar, setAGravar] = useState(false);
  const [aCarregarImg, setACarregarImg] = useState(false);
  const [msg, setMsg] = useState("");
  const [erro, setErro] = useState("");

  // Acesso: só quem tem is_chaveador.
  useEffect(() => {
    let vivo = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user?.id;
      if (!uid) { if (vivo) setAcesso("nao"); return; }
      const { data: u } = await supabase.from("users").select("is_chaveador, name").eq("id", uid).maybeSingle();
      if (!vivo) return;
      if (!u?.is_chaveador) { setAcesso("nao"); return; }
      setMeuNome(String(u.name || ""));
      setAcesso("sim");
    })();
    return () => { vivo = false; };
  }, []);

  // Carrega a chave existente da competição escolhida (para editar), ou limpa.
  const carregarChave = useCallback(async (idc: string) => {
    const { data } = await supabase.from("hub_chaveamentos").select("*").eq("id_competicao", idc).maybeSingle();
    if (data) {
      const d = data as Record<string, unknown>;
      setF({
        id: String(d.id),
        titulo: String(d.titulo || ""),
        nota: String(d.nota || ""),
        imagens: Array.isArray(d.imagens) ? (d.imagens as Print[]) : [],
        estado: String(d.estado || "rascunho"),
      });
    } else {
      setF(VAZIO);
    }
    setMsg(""); setErro("");
  }, []);

  const carregarLista = useCallback(async () => {
    const { data } = await supabase
      .from("hub_chaveamentos")
      .select("id, id_competicao, nome_competicao, estado, atualizado_em")
      .order("atualizado_em", { ascending: false })
      .limit(60);
    setLista((data as Item[]) || []);
  }, []);

  useEffect(() => { if (acesso === "sim") void carregarChave(comp); }, [acesso, comp, carregarChave]);
  useEffect(() => { if (acesso === "sim") void carregarLista(); }, [acesso, carregarLista]);

  async function adicionarPrint(file: File) {
    setErro(""); setMsg(""); setACarregarImg(true);
    try {
      if (file.size > 45 * 1024 * 1024) {
        setErro(t("be.imgGrande", { mb: (file.size / 1024 / 1024).toFixed(1) }));
        return;
      }
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const nome = `${comp}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) { setErro(t("be.sessaoExpirou")); return; }
      const { error } = await supabase.storage.from("chaveamentos").upload(nome, file, { upsert: false });
      if (error) {
        const e = error as { message?: string };
        setErro(e.message ? t("be.imgErro", { msg: e.message }) : t("be.imgFalha"));
        return;
      }
      const { data } = supabase.storage.from("chaveamentos").getPublicUrl(nome);
      if (!data?.publicUrl) { setErro(t("be.imgSemUrl")); return; }
      setF((x) => ({ ...x, imagens: [...x.imagens, { url: data.publicUrl, legenda: "", categoria: "" }] }));
    } catch (e) {
      const m = e instanceof Error ? e.message : "";
      setErro(t("be.imgFalha") + (m ? ` (${m})` : ""));
    } finally {
      setACarregarImg(false);
    }
  }

  function mudarPrint(i: number, campo: "legenda" | "categoria", valor: string) {
    setF((x) => ({ ...x, imagens: x.imagens.map((im, j) => (j === i ? { ...im, [campo]: valor } : im)) }));
  }
  function removerPrint(i: number) {
    setF((x) => ({ ...x, imagens: x.imagens.filter((_, j) => j !== i) }));
  }

  // Guarda a chave (upsert por competição). Se `publicar`, chama a rota que
  // marca publicado e dispara a notificação a todos (na língua de cada um).
  async function guardar(publicar: boolean) {
    setErro(""); setMsg("");
    if (!comp) { setErro(t("chv.faltaComp")); return; }
    if (f.imagens.length === 0) { setErro(t("chv.faltaPrint")); return; }
    setAGravar(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user?.id;
      const s = CALENDARIO_2026.find((c) => c.idCompeticao === comp);
      const linha = {
        id_competicao: comp,
        nome_competicao: s ? s.nome : comp,
        titulo: f.titulo.trim() || null,
        nota: f.nota.trim() || null,
        imagens: f.imagens,
        autor_id: uid,
        autor_nome: meuNome || null,
        atualizado_em: new Date().toISOString(),
      };
      const { data: up, error } = await supabase
        .from("hub_chaveamentos")
        .upsert(linha, { onConflict: "id_competicao" })
        .select("id, estado")
        .single();
      if (error) { setErro(t("chv.naoGuardar")); return; }
      const id = up?.id ? String(up.id) : f.id;

      if (publicar) {
        const token = sess.session?.access_token;
        const r = await fetch("/api/chaveamento", {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
          body: JSON.stringify({ id }),
        });
        const j = await r.json().catch(() => null);
        if (!j?.ok) { setErro(t("chv.naoPublicar")); return; }
        setMsg(t("chv.publicado"));
      } else {
        setMsg(t("chv.guardado"));
      }
      await carregarChave(comp);
      await carregarLista();
    } catch {
      setErro(t("chv.naoGuardar"));
    } finally {
      setAGravar(false);
    }
  }

  async function despublicar() {
    if (!f.id) return;
    await supabase.from("hub_chaveamentos").update({ estado: "rascunho", atualizado_em: new Date().toISOString() }).eq("id", f.id);
    setMsg(t("chv.despublicado"));
    await carregarChave(comp);
    await carregarLista();
  }

  async function apagar(id: string, idc: string) {
    if (!confirm(t("chv.confirmApagar"))) return;
    await supabase.from("hub_chaveamentos").delete().eq("id", id);
    if (idc === comp) setF(VAZIO);
    await carregarLista();
  }

  if (acesso === "a-ver") return <Centro texto={t("be.aVerificar")} />;
  if (acesso === "nao") return <SemAcesso />;

  const publicado = f.estado === "publicado";

  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: FB }}>
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "14px 14px 60px" }}>
        <header style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 18 }}>
          <a href="/inicio" aria-label={t("comum.voltar")} style={{ width: 34, height: 34, borderRadius: "50%", border: "1px solid #243029", display: "flex", alignItems: "center", justifyContent: "center", color: "#cfd8d2", textDecoration: "none", flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
          </a>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontFamily: FD, fontSize: 18, fontWeight: 700, textTransform: "uppercase", margin: 0 }}>{t("chv.edTitulo")}</h1>
            <div style={{ fontSize: 11.5, color: "#93a39a" }}>{t("chv.edSub")}</div>
          </div>
        </header>

        {/* ---------- FORMULÁRIO ---------- */}
        <div style={{ background: "#121815", border: "1px solid #243029", borderRadius: 14, padding: 15, marginBottom: 22 }}>
          <Campo label={t("chv.labelComp")}>
            <select value={comp} onChange={(e) => setComp(e.target.value)} style={{ ...inp, appearance: "auto" }}>
              <option value="" disabled>{t("chv.compPlaceholder")}</option>
              {COMPS.map((s) => (
                <option key={s.idCompeticao} value={s.idCompeticao}>{s.nome}</option>
              ))}
            </select>
          </Campo>

          <Campo label={t("chv.labelTitulo")}>
            <input value={f.titulo} onChange={(e) => setF((x) => ({ ...x, titulo: e.target.value }))}
              placeholder={t("chv.phTitulo")} style={inp} />
          </Campo>

          <Campo label={t("chv.labelNota")} ajuda={t("chv.ajudaNota")}>
            <textarea value={f.nota} onChange={(e) => setF((x) => ({ ...x, nota: e.target.value }))}
              placeholder={t("chv.phNota")} rows={4} style={{ ...inp, resize: "vertical", lineHeight: 1.6 }} />
          </Campo>

          <Campo label={t("chv.labelPrints")} ajuda={t("chv.ajudaPrints")}>
            {f.imagens.length === 0 && (
              <div style={{ fontSize: 12, color: "#5f6f67", marginBottom: 8 }}>{t("chv.semPrints")}</div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {f.imagens.map((im, i) => (
                <div key={i} style={{ background: "#0c0e0d", border: "1px solid #243029", borderRadius: 10, padding: 10 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={im.url} alt="" style={{ width: "100%", borderRadius: 8, display: "block", marginBottom: 8 }} />
                  <input value={im.categoria} onChange={(e) => mudarPrint(i, "categoria", e.target.value)}
                    placeholder={t("chv.phCategoria")} style={{ ...inp, marginBottom: 6 }} />
                  <input value={im.legenda} onChange={(e) => mudarPrint(i, "legenda", e.target.value)}
                    placeholder={t("chv.phLegenda")} style={inp} />
                  <button onClick={() => removerPrint(i)}
                    style={{ marginTop: 7, background: "transparent", border: "none", color: "#ef8d83", fontSize: 12, cursor: "pointer", fontFamily: FB, padding: 0, textDecoration: "underline" }}>
                    {t("chv.removerPrint")}
                  </button>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 10 }}>
              <input type="file" accept="image/jpeg,image/png,image/webp" disabled={aCarregarImg}
                onChange={(e) => { const fi = e.target.files?.[0]; if (fi) void adicionarPrint(fi); e.target.value = ""; }}
                style={{ ...inp, padding: 9 }} />
              {aCarregarImg && <div style={{ fontSize: 12, color: GOLD, marginTop: 6, fontWeight: 700 }}>{t("be.aCarregarImg")}</div>}
            </div>
          </Campo>

          {erro && <Aviso cor="#ef8d83" texto={erro} />}
          {msg && <Aviso cor="#7fd1a3" texto={msg} />}

          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            {publicado ? (
              <>
                <button onClick={() => guardar(false)} disabled={aGravar} style={btnPri}>
                  {aGravar ? t("be.aGuardarPub") : t("chv.btnAtualizar")}
                </button>
                <button onClick={despublicar} disabled={aGravar} style={btnSec}>{t("chv.btnDespublicar")}</button>
              </>
            ) : (
              <>
                <button onClick={() => guardar(false)} disabled={aGravar} style={btnSec}>{t("chv.btnRascunho")}</button>
                <button onClick={() => guardar(true)} disabled={aGravar} style={btnPri}>
                  {aGravar ? t("be.aGuardarPub") : t("chv.btnPublicar")}
                </button>
              </>
            )}
          </div>
        </div>

        {/* ---------- LISTA ---------- */}
        <div style={{ fontFamily: FD, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#93a39a", marginBottom: 10 }}>
          {t("chv.listaTitulo")}
        </div>
        {lista.length === 0 ? (
          <div style={{ fontSize: 13, color: "#5f6f67", textAlign: "center", padding: "20px 0" }}>{t("chv.semLista")}</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {lista.map((it) => (
              <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "#121815", border: "1px solid #243029", borderRadius: 11, padding: "10px 12px" }}>
                <span style={{ flexShrink: 0, fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", padding: "3px 7px", borderRadius: 5,
                  background: it.estado === "publicado" ? "#13301f" : "#1a2028",
                  color: it.estado === "publicado" ? "#7fd1a3" : "#7c8a82" }}>
                  {it.estado === "publicado" ? t("be.badgeNoAr") : t("chv.badgeRascunho")}
                </span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: "#d6ddd6", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {it.nome_competicao || it.id_competicao}
                </span>
                <button onClick={() => setComp(it.id_competicao)} style={btnMini}>{t("be.editar")}</button>
                <button onClick={() => apagar(it.id, it.id_competicao)} style={{ ...btnMini, color: "#ef8d83", borderColor: "#5a2f2c" }}>{t("be.apagar")}</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function Campo({ label, ajuda, children }: { label: string; ajuda?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontFamily: FD, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#93a39a", marginBottom: 5 }}>{label}</div>
      {children}
      {ajuda && <div style={{ fontSize: 11, color: "#5f6f67", marginTop: 4, lineHeight: 1.4 }}>{ajuda}</div>}
    </div>
  );
}

function Aviso({ cor, texto }: { cor: string; texto: string }) {
  return <div style={{ fontSize: 12.5, color: cor, marginBottom: 10, lineHeight: 1.45 }}>{texto}</div>;
}

function SemAcesso() {
  const t = useT();
  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: FB, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ maxWidth: 320, textAlign: "center" }}>
        <div style={{ position: "relative", width: 130, height: 130, margin: "0 auto 6px" }}>
          <Mascot belt="#efeadd" expression="indicando" />
          <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 52 }} aria-hidden="true">🙅</span>
        </div>
        <h1 style={{ fontFamily: FD, fontSize: 19, fontWeight: 700, textTransform: "uppercase", margin: "6px 0 10px" }}>{t("be.porAquiNao")}</h1>
        <p style={{ fontSize: 14, color: "#93a39a", lineHeight: 1.6, margin: "0 0 20px" }}>{t("chv.semAcessoCorpo")}</p>
        <a href="/inicio" style={{ display: "inline-block", background: GOLD, color: "#1b211e", fontFamily: FD, fontSize: 13.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", padding: "12px 24px", borderRadius: 11, textDecoration: "none" }}>{t("chv.irInicio")}</a>
      </div>
    </main>
  );
}

function Centro({ texto }: { texto: string }) {
  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#7c8a82", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FD, fontSize: 13, letterSpacing: "0.1em", textTransform: "uppercase", padding: 20, textAlign: "center" }}>
      {texto}
    </main>
  );
}

const inp: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", background: "#0c0e0d", border: "1px solid #24364a",
  borderRadius: 9, padding: "10px 12px", color: "#f1ede2", fontSize: 14, fontFamily: FB, outline: "none",
};
const btnPri: React.CSSProperties = {
  flex: 1, background: GOLD, color: "#1b211e", border: "none", fontFamily: FD, fontSize: 13.5,
  fontWeight: 700, textTransform: "uppercase", padding: "12px", borderRadius: 10, cursor: "pointer",
};
const btnSec: React.CSSProperties = {
  background: "transparent", color: "#cfd8d2", border: "1px solid #2a3a33", fontFamily: FD, fontSize: 12.5,
  fontWeight: 700, textTransform: "uppercase", padding: "12px 14px", borderRadius: 10, cursor: "pointer",
};
const btnMini: React.CSSProperties = {
  flexShrink: 0, background: "transparent", border: "1px solid #2a3a33", color: "#93a39a",
  fontSize: 11, fontWeight: 700, padding: "5px 9px", borderRadius: 7, cursor: "pointer", fontFamily: FB,
};
