"use client";

// app/blog/editor/page.tsx
//
// PAINEL DE EDIÇÃO — onde se escrevem as notícias do Blog do Dôdo.
//
// ---------------------------------------------------------------------------
// PARA QUEM TRABALHA SOZINHO
//
// Quem escreve não deve precisar de pedir nada a ninguém: escreve, carrega a
// imagem, agenda e publica. Sem aprovações, sem passos intermédios.
//
// Por isso não há fluxo de revisão nem funções com permissões diferentes. Com
// uma ou duas pessoas, isso seria mais trabalho a manter do que a resolver —
// e desenhar um sistema de permissões antes de existir equipa é desenhar no
// vazio. Quando a equipa crescer, revê-se com o problema à frente.
//
// ---------------------------------------------------------------------------
// A LISTA E O FORMULÁRIO NA MESMA PÁGINA
//
// Escrever notícias é um trabalho de repetição: publica-se uma, começa-se a
// seguinte. Separar em duas páginas obrigaria a navegar de cada vez.
// ---------------------------------------------------------------------------

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";

/** Os tipos que uma pessoa escreve. Os outros são gerados pelo motor. */
const TIPOS = [
  { id: "editorial", nome: "Editorial" },
  { id: "entrevista", nome: "Entrevista" },
  { id: "antevisao", nome: "Antevisão" },
  { id: "analise", nome: "Análise" },
  { id: "curiosidade", nome: "Curiosidade" },
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
  publicar_em: string | null; criada_em: string; autor_nome: string | null;
}

export default function EditorBlog() {
  const [acesso, setAcesso] = useState<"a-ver" | "sim" | "nao">("a-ver");
  const [meuNome, setMeuNome] = useState("");
  const [lista, setLista] = useState<Item[]>([]);
  const [f, setF] = useState<Rascunho>(VAZIO);
  const [aGravar, setAGravar] = useState(false);
  const [aCarregarImg, setACarregarImg] = useState(false);
  const [msg, setMsg] = useState("");
  const [erro, setErro] = useState("");

  // Só entra quem tem is_editor. A verificação é também no servidor (RLS), esta
  // é para o ecrã não desenhar um formulário que nunca gravaria nada.
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
      .select("id, tipo, titulo, estado, publicar_em, criada_em, autor_nome")
      .not("autor_id", "is", null)
      .order("criada_em", { ascending: false })
      .limit(40);
    setLista((data as Item[]) || []);
  }, []);

  useEffect(() => { if (acesso === "sim") void carregarLista(); }, [acesso, carregarLista]);

  // --- Imagem: carrega para o Storage e guarda o endereço ---
  async function escolherImagem(ficheiro: File) {
    setErro(""); setACarregarImg(true);
    try {
      // Nome único: a data mais um número. Sem isto, duas notícias com uma foto
      // chamada "capa.jpg" escreviam uma por cima da outra.
      const ext = (ficheiro.name.split(".").pop() || "jpg").toLowerCase();
      const nome = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from("blog").upload(nome, ficheiro, { upsert: false });
      if (error) {
        // Também aqui: o erro real. O mais comum é o bucket "blog" não existir
        // ou não ter política de escrita para editores.
        const e = error as { message?: string };
        setErro(`Imagem: ${e.message || "não foi possível carregar"}`);
        return;
      }
      const { data } = supabase.storage.from("blog").getPublicUrl(nome);
      setF((x) => ({ ...x, imagem_url: data.publicUrl }));
    } catch {
      setErro("Não foi possível carregar a imagem.");
    } finally {
      setACarregarImg(false);
    }
  }

  async function guardar(estado: "rascunho" | "agendada" | "publicada") {
    setErro(""); setMsg("");
    if (!f.titulo.trim()) { setErro("A notícia precisa de um título."); return; }
    if (!f.corpo.trim()) { setErro("A notícia precisa de texto."); return; }
    if (estado === "agendada" && !f.publicar_em) { setErro("Escolhe a data e a hora para publicar."); return; }
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
        destaque: f.destaque,
        autor_id: uid,
        autor_nome: meuNome || null,
        dados: {},
      };
      const res = f.id
        ? await supabase.from("hub_noticias").update(linha).eq("id", f.id)
        : await supabase.from("hub_noticias").insert(linha);
      if (res.error) {
        // MOSTRA O ERRO REAL. A primeira versão dizia só "não foi possível
        // guardar" — o que não ajuda ninguém a resolver nada. Uma mensagem
        // genérica esconde exatamente a informação de que se precisa.
        //
        // Os erros mais prováveis aqui:
        //   • falta política de INSERT na tabela (a RLS recusa a escrita)
        //   • um valor não passa numa constraint (tipo ou estado inválido)
        //   • uma coluna que o SQL ainda não criou
        const e = res.error as { message?: string; details?: string; hint?: string; code?: string };
        const partes = [e.message, e.details, e.hint, e.code ? `(código ${e.code})` : ""].filter(Boolean);
        setErro(partes.join(" · ") || "Não foi possível guardar.");
        return;
      }
      setMsg(estado === "publicada" ? "Publicada!" : estado === "agendada" ? "Agendada." : "Guardada como rascunho.");
      setF(VAZIO);
      await carregarLista();
    } catch {
      setErro("Não foi possível guardar.");
    } finally {
      setAGravar(false);
    }
  }

  async function editar(id: string) {
    const { data } = await supabase.from("hub_noticias").select("*").eq("id", id).maybeSingle();
    if (!data) return;
    const d = data as Record<string, unknown>;
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

  async function apagar(id: string) {
    if (!confirm("Apagar esta notícia? Não dá para recuperar.")) return;
    await supabase.from("hub_noticias").delete().eq("id", id);
    await carregarLista();
  }

  if (acesso === "a-ver") {
    return <Centro texto="A verificar…" />;
  }
  if (acesso === "nao") {
    return <Centro texto="Esta página é para a equipa editorial." />;
  }

  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: FB }}>
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "14px 14px 60px" }}>
        <header style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 18 }}>
          <a href="/blog" aria-label="Ver o blog" style={{ width: 34, height: 34, borderRadius: "50%", border: "1px solid #243029", display: "flex", alignItems: "center", justifyContent: "center", color: "#cfd8d2", textDecoration: "none", flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
          </a>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontFamily: FD, fontSize: 18, fontWeight: 700, textTransform: "uppercase", margin: 0 }}>Escrever</h1>
            <div style={{ fontSize: 11.5, color: "#93a39a" }}>{meuNome || "Editor"}</div>
          </div>
        </header>

        {/* ---------- FORMULÁRIO ---------- */}
        <div style={{ background: "#121815", border: "1px solid #243029", borderRadius: 14, padding: 15, marginBottom: 22 }}>
          <Campo label="Tipo">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {TIPOS.map((t) => (
                <button key={t.id} onClick={() => setF((x) => ({ ...x, tipo: t.id }))}
                  style={{ background: f.tipo === t.id ? GOLD : "transparent", border: `1px solid ${f.tipo === t.id ? GOLD : "#2a3a33"}`, color: f.tipo === t.id ? "#1b211e" : "#93a39a", fontFamily: FD, fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", padding: "7px 12px", borderRadius: 8, cursor: "pointer" }}>
                  {t.nome}
                </button>
              ))}
            </div>
          </Campo>

          <Campo label="Título">
            <input value={f.titulo} onChange={(e) => setF((x) => ({ ...x, titulo: e.target.value }))}
              placeholder="O que aconteceu, numa linha" style={inp} />
          </Campo>

          <Campo label="Resumo" ajuda="A linha que aparece no carrossel. Se ficar vazio, usamos o início do texto.">
            <input value={f.resumo} onChange={(e) => setF((x) => ({ ...x, resumo: e.target.value }))}
              placeholder="Uma frase curta" style={inp} />
          </Campo>

          <Campo label="Texto">
            <textarea value={f.corpo} onChange={(e) => setF((x) => ({ ...x, corpo: e.target.value }))}
              placeholder="A notícia" rows={9} style={{ ...inp, resize: "vertical", lineHeight: 1.6 }} />
          </Campo>

          <Campo label="Imagem" ajuda="jpg, png ou webp. Fica guardada connosco.">
            {f.imagem_url ? (
              <div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.imagem_url} alt="" style={{ width: "100%", borderRadius: 10, display: "block", marginBottom: 8 }} />
                <button onClick={() => setF((x) => ({ ...x, imagem_url: "" }))}
                  style={{ background: "transparent", border: "none", color: "#ef8d83", fontSize: 12, cursor: "pointer", fontFamily: FB, padding: 0, textDecoration: "underline" }}>
                  Trocar imagem
                </button>
              </div>
            ) : (
              <input type="file" accept="image/*" disabled={aCarregarImg}
                onChange={(e) => { const fi = e.target.files?.[0]; if (fi) void escolherImagem(fi); }}
                style={{ ...inp, padding: 9 }} />
            )}
            {aCarregarImg && <div style={{ fontSize: 12, color: "#93a39a", marginTop: 6 }}>A carregar…</div>}
          </Campo>

          {f.imagem_url && (
            <Campo label="Crédito da imagem" ajuda="De quem é a foto. Importante quando não é nossa.">
              <input value={f.imagem_credito} onChange={(e) => setF((x) => ({ ...x, imagem_credito: e.target.value }))}
                placeholder="Foto: nome" style={inp} />
            </Campo>
          )}

          <Campo label="Vídeo nas redes" ajuda="Se houver vídeo sobre esta notícia, cola aqui as ligações.">
            <input value={f.link_instagram} onChange={(e) => setF((x) => ({ ...x, link_instagram: e.target.value }))}
              placeholder="Instagram" style={{ ...inp, marginBottom: 7 }} />
            <input value={f.link_tiktok} onChange={(e) => setF((x) => ({ ...x, link_tiktok: e.target.value }))}
              placeholder="TikTok" style={{ ...inp, marginBottom: 7 }} />
            <input value={f.link_youtube} onChange={(e) => setF((x) => ({ ...x, link_youtube: e.target.value }))}
              placeholder="YouTube" style={inp} />
          </Campo>

          <Campo label="Agendar" ajuda="Deixa vazio para publicar já.">
            <input type="datetime-local" value={f.publicar_em}
              onChange={(e) => setF((x) => ({ ...x, publicar_em: e.target.value }))} style={inp} />
          </Campo>

          <label style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer", marginBottom: 14 }}>
            <input type="checkbox" checked={f.destaque} onChange={(e) => setF((x) => ({ ...x, destaque: e.target.checked }))}
              style={{ width: 17, height: 17, accentColor: GOLD }} />
            <span style={{ fontSize: 13, color: "#c7d0c9" }}>Destacar (aparece primeiro no carrossel)</span>
          </label>

          {erro && <Aviso cor="#ef8d83" texto={erro} />}
          {msg && <Aviso cor="#7fd1a3" texto={msg} />}

          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button onClick={() => guardar("rascunho")} disabled={aGravar} style={btnSec}>Rascunho</button>
            {f.publicar_em && <button onClick={() => guardar("agendada")} disabled={aGravar} style={btnSec}>Agendar</button>}
            <button onClick={() => guardar("publicada")} disabled={aGravar} style={btnPri}>
              {aGravar ? "A guardar…" : f.id ? "Atualizar" : "Publicar"}
            </button>
          </div>
          {f.id && (
            <button onClick={() => { setF(VAZIO); setMsg(""); setErro(""); }}
              style={{ width: "100%", marginTop: 9, background: "transparent", border: "none", color: "#7c8a82", fontSize: 12, cursor: "pointer", fontFamily: FB }}>
              Cancelar edição e escrever nova
            </button>
          )}
        </div>

        {/* ---------- O QUE JÁ ESCREVI ---------- */}
        <div style={{ fontFamily: FD, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#93a39a", marginBottom: 10 }}>
          Escritas ({lista.length})
        </div>
        {lista.length === 0 ? (
          <div style={{ fontSize: 13, color: "#5f6f67", textAlign: "center", padding: "20px 0" }}>
            Ainda não escreveste nenhuma.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {lista.map((it) => (
              <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "#121815", border: "1px solid #243029", borderRadius: 11, padding: "10px 12px" }}>
                <span style={{ flexShrink: 0, fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", padding: "3px 7px", borderRadius: 5,
                  background: it.estado === "publicada" ? "#13301f" : it.estado === "agendada" ? "#2a2410" : "#1a2028",
                  color: it.estado === "publicada" ? "#7fd1a3" : it.estado === "agendada" ? GOLD : "#7c8a82" }}>
                  {it.estado === "publicada" ? "no ar" : it.estado === "agendada" ? "agendada" : "rascunho"}
                </span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: "#d6ddd6", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.titulo}</span>
                <button onClick={() => editar(it.id)} style={btnMini}>Editar</button>
                <button onClick={() => apagar(it.id)} style={{ ...btnMini, color: "#ef8d83", borderColor: "#5a2f2c" }}>Apagar</button>
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
