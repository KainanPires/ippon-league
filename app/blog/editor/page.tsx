"use client";

// app/blog/editor/page.tsx
//
// PAINEL DE EDIÇÃO — onde se escrevem as notícias do Blog do Dôdo.

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Mascot } from "@/components/Mascot";
import { useT } from "@/lib/i18n";

const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";

/** Os tipos que uma pessoa escreve. Os outros são gerados pelo motor. */
const TIPOS = [
  { id: "editorial", nomeK: "be.tEditorial" },
  { id: "entrevista", nomeK: "be.tEntrevista" },
  { id: "antevisao", nomeK: "be.tAntevisao" },
  { id: "analise", nomeK: "be.tAnalise" },
  { id: "curiosidade", nomeK: "be.tCuriosidade" },
] as const;

interface Rascunho {
  id?: string;
  tipo: string;
  titulo: string;
  resumo: string;
  corpo: string;
  imagem_url: string;
  imagem_credito: string;
  link_instagram: string;
  link_tiktok: string;
  link_youtube: string;
  estado: string;
  publicar_em: string;
  destaque: boolean;
}

const VAZIO: Rascunho = {
  tipo: "editorial", titulo: "", resumo: "", corpo: "",
  imagem_url: "", imagem_credito: "",
  link_instagram: "", link_tiktok: "", link_youtube: "",
  estado: "rascunho", publicar_em: "", destaque: false,
};

interface Item {
  id: string; tipo: string; titulo: string; estado: string;
  publicar_em: string | null; publicar_auto_em: string | null;
  criada_em: string; autor_nome: string | null;
  autor_id: string | null;   // null = gerada pelo motor
}

export default function EditorBlog() {
  const t = useT();
  const [acesso, setAcesso] = useState<"a-ver" | "sim" | "nao">("a-ver");
  const [meuNome, setMeuNome] = useState("");
  const [lista, setLista] = useState<Item[]>([]);
  const [f, setF] = useState<Rascunho>(VAZIO);
  const [dadosOriginais, setDadosOriginais] = useState<Record<string, unknown>>({});
  const [aGravar, setAGravar] = useState(false);
  const [aCarregarImg, setACarregarImg] = useState(false);
  const [msg, setMsg] = useState("");
  const [erro, setErro] = useState("");
  const [procura, setProcura] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<"todos" | "revisao" | "publicada" | "rascunho">("todos");

  useEffect(() => {
    let vivo = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user?.id;
      if (!uid) { if (vivo) setAcesso("nao"); return; }
      const { data: u } = await supabase.from("users").select("is_editor, name").eq("id", uid).maybeSingle();
      if (!vivo) return;
      if (!u?.is_editor) { setAcesso("nao"); return; }
      setMeuNome(String(u.name || ""));
      setAcesso("sim");
    })();
    return () => { vivo = false; };
  }, []);

  const carregarLista = useCallback(async () => {
    const { data } = await supabase
      .from("hub_noticias")
      .select("id, tipo, titulo, estado, publicar_em, publicar_auto_em, criada_em, autor_nome, autor_id")
      .order("criada_em", { ascending: false })
      .limit(60);
    const todas = (data as Item[]) || [];
    const ordem: Record<string, number> = { revisao: 0, rascunho: 1, agendada: 2, publicada: 3 };
    setLista([...todas].sort((a, b) => (ordem[a.estado] ?? 9) - (ordem[b.estado] ?? 9)));
  }, []);

  useEffect(() => { if (acesso === "sim") void carregarLista(); }, [acesso, carregarLista]);

  async function escolherImagem(ficheiro: File) {
    setErro(""); setMsg(""); setACarregarImg(true);
    try {
      if (ficheiro.size > 45 * 1024 * 1024) {
        setErro(t("be.imgGrande", { mb: (ficheiro.size / 1024 / 1024).toFixed(1) }));
        return;
      }
      const ext = (ficheiro.name.split(".").pop() || "jpg").toLowerCase();
      const nome = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        setErro(t("be.sessaoExpirou"));
        return;
      }
      const { error } = await supabase.storage.from("blog").upload(nome, ficheiro, { upsert: false });
      if (error) {
        const e = error as { message?: string };
        setErro(e.message ? t("be.imgErro", { msg: e.message }) : t("be.imgFalha"));
        return;
      }
      const { data } = supabase.storage.from("blog").getPublicUrl(nome);
      if (!data?.publicUrl) {
        setErro(t("be.imgSemUrl"));
        return;
      }
      setF((x) => ({ ...x, imagem_url: data.publicUrl }));
      setMsg(t("be.imgCarregada"));
    } catch (e) {
      const m = e instanceof Error ? e.message : "";
      setErro(t("be.imgFalha") + (m ? ` (${m})` : ""));
    } finally {
      setACarregarImg(false);
    }
  }

  async function guardar(estado: "rascunho" | "agendada" | "publicada") {
    setErro(""); setMsg("");
    if (!f.titulo.trim()) { setErro(t("be.faltaTitulo")); return; }
    if (!f.corpo.trim()) { setErro(t("be.faltaTexto")); return; }
    if (estado === "agendada" && !f.publicar_em) { setErro(t("be.faltaData")); return; }
    setAGravar(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user?.id;
      const linha = {
        tipo: f.tipo,
        titulo: f.titulo.trim(),
        resumo: f.resumo.trim() || f.corpo.trim().slice(0, 120),
        corpo: f.corpo.trim(),
        imagem_url: f.imagem_url || null,
        imagem_credito: f.imagem_credito.trim() || null,
        link_instagram: f.link_instagram.trim() || null,
        link_tiktok: f.link_tiktok.trim() || null,
        link_youtube: f.link_youtube.trim() || null,
        estado,
        publicar_em: estado === "agendada" ? new Date(f.publicar_em).toISOString() : null,
        publicar_auto_em: null,
        destaque: f.destaque,
        destaque_ate: f.destaque ? new Date(Date.now() + 48 * 3600 * 1000).toISOString() : null,
        autor_id: uid,
        autor_nome: meuNome || null,
        dados: dadosOriginais,
      };
      const res = f.id
        ? await supabase.from("hub_noticias").update(linha).eq("id", f.id)
        : await supabase.from("hub_noticias").insert(linha);
      if (res.error) {
        const e = res.error as { message?: string; details?: string; hint?: string; code?: string };
        const partes = [e.message, e.details, e.hint, e.code ? t("be.codigo", { code: e.code }) : ""].filter(Boolean);
        setErro(partes.join(" · ") || t("be.naoGuardar"));
        return;
      }
      setMsg(estado === "publicada" ? t("be.publicada") : estado === "agendada" ? t("be.agendadaMsg") : t("be.rascunhoGuardado"));
      setF(VAZIO);
      setDadosOriginais({});
      await carregarLista();
    } catch {
      setErro(t("be.naoGuardar"));
    } finally {
      setAGravar(false);
    }
  }

  async function editar(id: string) {
    const { data } = await supabase.from("hub_noticias").select("*").eq("id", id).maybeSingle();
    if (!data) return;
    const d = data as Record<string, unknown>;
    setDadosOriginais((d.dados && typeof d.dados === "object" ? d.dados : {}) as Record<string, unknown>);
    setF({
      id: String(d.id),
      tipo: String(d.tipo || "editorial"),
      titulo: String(d.titulo || ""),
      resumo: String(d.resumo || ""),
      corpo: String(d.corpo || ""),
      imagem_url: String(d.imagem_url || ""),
      imagem_credito: String(d.imagem_credito || ""),
      link_instagram: String(d.link_instagram || ""),
      link_tiktok: String(d.link_tiktok || ""),
      link_youtube: String(d.link_youtube || ""),
      estado: String(d.estado || "rascunho"),
      publicar_em: d.publicar_em ? new Date(String(d.publicar_em)).toISOString().slice(0, 16) : "",
      destaque: !!d.destaque,
    });
    setMsg(""); setErro("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function publicarJa(id: string) {
    await supabase.from("hub_noticias")
      .update({ estado: "publicada", publicar_auto_em: null }).eq("id", id);
    await carregarLista();
  }

  async function despublicar(id: string) {
    await supabase.from("hub_noticias")
      .update({ estado: "rascunho", publicar_em: null, publicar_auto_em: null }).eq("id", id);
    await carregarLista();
  }

  async function apagar(id: string) {
    if (!confirm(t("be.confirmApagar"))) return;
    await supabase.from("hub_noticias").delete().eq("id", id);
    await carregarLista();
  }

  const visiveis = lista.filter((it) => {
    if (filtroEstado !== "todos" && it.estado !== filtroEstado) return false;
    if (procura.trim() && !it.titulo.toLowerCase().includes(procura.trim().toLowerCase())) return false;
    return true;
  });

  if (acesso === "a-ver") {
    return <Centro texto={t("be.aVerificar")} />;
  }
  if (acesso === "nao") {
    return <SemAcesso />;
  }

  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: FB }}>
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "14px 14px 60px" }}>
        <header style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 18 }}>
          <a href="/blog" aria-label={t("be.verBlog")} style={{ width: 34, height: 34, borderRadius: "50%", border: "1px solid #243029", display: "flex", alignItems: "center", justifyContent: "center", color: "#cfd8d2", textDecoration: "none", flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
          </a>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontFamily: FD, fontSize: 18, fontWeight: 700, textTransform: "uppercase", margin: 0 }}>{t("be.escrever")}</h1>
            <div style={{ fontSize: 11.5, color: "#93a39a" }}>
              {meuNome ? t("be.publicaComo", { nome: meuNome }) : t("bl.equipaIppon")}
            </div>
          </div>
        </header>

        {/* ---------- FORMULÁRIO ---------- */}
        <div style={{ background: "#121815", border: "1px solid #243029", borderRadius: 14, padding: 15, marginBottom: 22 }}>
          <Campo label={t("be.labelTipo")}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {TIPOS.map((tp) => (
                <button key={tp.id} onClick={() => setF((x) => ({ ...x, tipo: tp.id }))}
                  style={{ background: f.tipo === tp.id ? GOLD : "transparent", border: `1px solid ${f.tipo === tp.id ? GOLD : "#2a3a33"}`, color: f.tipo === tp.id ? "#1b211e" : "#93a39a", fontFamily: FD, fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", padding: "7px 12px", borderRadius: 8, cursor: "pointer" }}>
                  {t(tp.nomeK)}
                </button>
              ))}
            </div>
          </Campo>

          <Campo label={t("be.labelTitulo")}>
            <input value={f.titulo} onChange={(e) => setF((x) => ({ ...x, titulo: e.target.value }))}
              placeholder={t("be.phTitulo")} style={inp} />
          </Campo>

          <Campo label={t("be.labelResumo")} ajuda={t("be.ajudaResumo")}>
            <input value={f.resumo} onChange={(e) => setF((x) => ({ ...x, resumo: e.target.value }))}
              placeholder={t("be.phResumo")} style={inp} />
          </Campo>

          <Campo label={t("be.labelTexto")}>
            <textarea value={f.corpo} onChange={(e) => setF((x) => ({ ...x, corpo: e.target.value }))}
              placeholder={t("be.phTexto")} rows={9} style={{ ...inp, resize: "vertical", lineHeight: 1.6 }} />
          </Campo>

          <Campo label={t("be.labelImagem")} ajuda={t("be.ajudaImagem")}>
            {f.imagem_url ? (
              <div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.imagem_url} alt="" style={{ width: "100%", borderRadius: 10, display: "block", marginBottom: 8 }} />
                <button onClick={() => setF((x) => ({ ...x, imagem_url: "" }))}
                  style={{ background: "transparent", border: "none", color: "#ef8d83", fontSize: 12, cursor: "pointer", fontFamily: FB, padding: 0, textDecoration: "underline" }}>
                  {t("be.trocarImagem")}
                </button>
              </div>
            ) : (
              <input type="file" accept="image/jpeg,image/png,image/webp" disabled={aCarregarImg}
                onChange={(e) => { const fi = e.target.files?.[0]; if (fi) void escolherImagem(fi); }}
                style={{ ...inp, padding: 9 }} />
            )}
            {aCarregarImg && (
              <div style={{ fontSize: 12, color: GOLD, marginTop: 6, fontWeight: 700 }}>{t("be.aCarregarImg")}</div>
            )}
            {!aCarregarImg && !f.imagem_url && (
              <div style={{ fontSize: 11, color: "#5f6f67", marginTop: 5 }}>
                {t("be.imgDica")}
              </div>
            )}
          </Campo>

          {f.imagem_url && (
            <Campo label={t("be.labelCredito")} ajuda={t("be.ajudaCredito")}>
              <input value={f.imagem_credito} onChange={(e) => setF((x) => ({ ...x, imagem_credito: e.target.value }))}
                placeholder={t("be.phCredito")} style={inp} />
            </Campo>
          )}

          <Campo label={t("be.labelVideo")} ajuda={t("be.ajudaVideo")}>
            <input value={f.link_instagram} onChange={(e) => setF((x) => ({ ...x, link_instagram: e.target.value }))}
              placeholder="Instagram" style={{ ...inp, marginBottom: 7 }} />
            <input value={f.link_tiktok} onChange={(e) => setF((x) => ({ ...x, link_tiktok: e.target.value }))}
              placeholder="TikTok" style={{ ...inp, marginBottom: 7 }} />
            <input value={f.link_youtube} onChange={(e) => setF((x) => ({ ...x, link_youtube: e.target.value }))}
              placeholder="YouTube" style={inp} />
          </Campo>

          <Campo label={t("be.labelAgendar")} ajuda={t("be.ajudaAgendar")}>
            <input type="datetime-local" value={f.publicar_em}
              onChange={(e) => setF((x) => ({ ...x, publicar_em: e.target.value }))} style={inp} />
          </Campo>

          <label style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer", marginBottom: 14 }}>
            <input type="checkbox" checked={f.destaque} onChange={(e) => setF((x) => ({ ...x, destaque: e.target.checked }))}
              style={{ width: 17, height: 17, accentColor: GOLD }} />
            <span style={{ fontSize: 13, color: "#c7d0c9" }}>
              {t("be.destacar")} <span style={{ color: "#7c8a82" }}>{t("be.destacarNota")}</span>
            </span>
          </label>

          {erro && <Aviso cor="#ef8d83" texto={erro} />}
          {msg && <Aviso cor="#7fd1a3" texto={msg} />}

          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button onClick={() => guardar("rascunho")} disabled={aGravar} style={btnSec}>{t("be.btnRascunho")}</button>
            {f.publicar_em && <button onClick={() => guardar("agendada")} disabled={aGravar} style={btnSec}>{t("be.btnAgendar")}</button>}
            <button onClick={() => guardar("publicada")} disabled={aGravar} style={btnPri}>
              {aGravar ? t("be.aGuardarPub") : f.id ? t("be.atualizar") : t("be.publicar")}
            </button>
          </div>
          {f.id && (
            <button onClick={() => { setF(VAZIO); setDadosOriginais({}); setMsg(""); setErro(""); }}
              style={{ width: "100%", marginTop: 9, background: "transparent", border: "none", color: "#7c8a82", fontSize: 12, cursor: "pointer", fontFamily: FB }}>
              {t("be.cancelarEdicao")}
            </button>
          )}
        </div>

        {/* ---------- TODAS AS NOTÍCIAS ---------- */}
        <div style={{ fontFamily: FD, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#93a39a", marginBottom: 10 }}>
          {visiveis.length !== lista.length ? t("be.noticiasCountDe", { n: visiveis.length, total: lista.length }) : t("be.noticiasCount", { n: visiveis.length })}
        </div>

        <input
          value={procura}
          onChange={(e) => setProcura(e.target.value)}
          placeholder={t("be.phProcura")}
          style={{ ...inp, marginBottom: 8 }}
        />
        <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
          {([
            ["todos", "be.filtroTodas"],
            ["revisao", "be.filtroRever"],
            ["publicada", "be.filtroNoAr"],
            ["rascunho", "be.filtroRascunhos"],
          ] as const).map(([id, nomeK]) => (
            <button key={id} onClick={() => setFiltroEstado(id)}
              style={{ background: filtroEstado === id ? GOLD : "transparent", border: `1px solid ${filtroEstado === id ? GOLD : "#2a3a33"}`, color: filtroEstado === id ? "#1b211e" : "#93a39a", fontFamily: FD, fontSize: 11, fontWeight: 700, textTransform: "uppercase", padding: "6px 11px", borderRadius: 8, cursor: "pointer" }}>
              {t(nomeK)}
            </button>
          ))}
        </div>
        {visiveis.length === 0 ? (
          <div style={{ fontSize: 13, color: "#5f6f67", textAlign: "center", padding: "20px 0" }}>
            {lista.length === 0 ? t("be.semNoticias") : t("be.semResultados")}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {visiveis.map((it) => (
              <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "#121815", border: "1px solid #243029", borderRadius: 11, padding: "10px 12px" }}>
                <span style={{ flexShrink: 0, fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", padding: "3px 7px", borderRadius: 5,
                  background: it.estado === "publicada" ? "#13301f" : it.estado === "revisao" ? "#2a1f1c" : it.estado === "agendada" ? "#2a2410" : "#1a2028",
                  color: it.estado === "publicada" ? "#7fd1a3" : it.estado === "revisao" ? "#ef8d83" : it.estado === "agendada" ? GOLD : "#7c8a82" }}>
                  {it.estado === "publicada" ? t("be.badgeNoAr") : it.estado === "revisao" ? t("hub.aRever") : it.estado === "agendada" ? t("hub.agendada") : t("hub.rascunho")}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 13, color: "#d6ddd6", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.titulo}</span>
                  {it.estado === "revisao" && it.publicar_auto_em && (
                    <span style={{ display: "block", fontSize: 10, color: "#7c8a82", marginTop: 1 }}>
                      {faltamHoras(it.publicar_auto_em, t)}
                    </span>
                  )}
                  {!it.autor_id && (
                    <span style={{ display: "block", fontSize: 10, color: "#5f6f67", marginTop: 1 }}>{t("be.geradaAuto")}</span>
                  )}
                </span>
                {it.estado === "revisao" && (
                  <button onClick={() => publicarJa(it.id)} style={{ ...btnMini, color: "#7fd1a3", borderColor: "#2a4d3e" }}>{t("be.publicarJa")}</button>
                )}
                {it.estado === "publicada" && (
                  <button onClick={() => despublicar(it.id)} style={{ ...btnMini, color: "#e0894f", borderColor: "#5a4a18" }}>{t("be.tirarDoAr")}</button>
                )}
                <button onClick={() => editar(it.id)} style={btnMini}>{t("be.editar")}</button>
                <button onClick={() => apagar(it.id)} style={{ ...btnMini, color: "#ef8d83", borderColor: "#5a2f2c" }}>{t("be.apagar")}</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

/** "sai daqui a 4h" — para o editor saber se tem tempo de mexer. */
function faltamHoras(iso: string, t: ReturnType<typeof useT>): string {
  const ms = Date.parse(iso) - Date.now();
  if (!Number.isFinite(ms)) return "";
  if (ms <= 0) return t("be.saiProxima");
  const h = Math.floor(ms / 3600000);
  if (h >= 1) return t("be.saiHoras", { h });
  return t("be.saiMin", { min: Math.max(1, Math.round(ms / 60000)) });
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
          <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 52 }} aria-hidden="true">
            🙅
          </span>
        </div>
        <h1 style={{ fontFamily: FD, fontSize: 19, fontWeight: 700, textTransform: "uppercase", margin: "6px 0 10px" }}>
          {t("be.porAquiNao")}
        </h1>
        <p style={{ fontSize: 14, color: "#93a39a", lineHeight: 1.6, margin: "0 0 20px" }}>
          {t("be.semAcessoCorpo")}
        </p>
        <a href="/blog" style={{ display: "inline-block", background: GOLD, color: "#1b211e", fontFamily: FD, fontSize: 13.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", padding: "12px 24px", borderRadius: 11, textDecoration: "none" }}>
          {t("be.irBlog")}
        </a>
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
