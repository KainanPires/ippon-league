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
import { Mascot } from "@/components/Mascot";

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
  publicar_em: string | null; publicar_auto_em: string | null;
  criada_em: string; autor_nome: string | null;
  autor_id: string | null;   // null = gerada pelo motor
}

export default function EditorBlog() {
  const [acesso, setAcesso] = useState<"a-ver" | "sim" | "nao">("a-ver");
  const [meuNome, setMeuNome] = useState("");
  const [lista, setLista] = useState<Item[]>([]);
  const [f, setF] = useState<Rascunho>(VAZIO);
  // Os `dados` da notícia (chave de unicidade, escudo da equipa) NÃO se editam
  // no painel — mas também não se podem perder. Guardamos os originais aqui e
  // devolvemo-los tal e qual ao gravar.
  //
  // Foi por os apagar que editar uma notícia gerada dava "duplicate key": sem a
  // chave, duas notícias do mesmo tipo e da mesma competição passavam a ser
  // indistinguíveis para o índice único. E o escudo da equipa desaparecia.
  const [dadosOriginais, setDadosOriginais] = useState<Record<string, unknown>>({});
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
    // Tudo o que o editor pode gerir: o que escreveu, MAIS as geradas que estão
    // à espera de revisão. Antes só mostrava as escritas — e as automáticas
    // publicavam-se sem ninguém as ver.
    const { data } = await supabase
      .from("hub_noticias")
      .select("id, tipo, titulo, estado, publicar_em, publicar_auto_em, criada_em, autor_nome, autor_id")
      .order("criada_em", { ascending: false })
      .limit(60);
    const todas = (data as Item[]) || [];
    // As que esperam revisão primeiro: são as que têm prazo.
    setLista([
      ...todas.filter((x) => x.estado === "revisao"),
      ...todas.filter((x) => x.estado !== "revisao" && x.autor_id),
    ]);
  }, []);

  useEffect(() => { if (acesso === "sim") void carregarLista(); }, [acesso, carregarLista]);

  // --- Imagem: carrega para o Storage e guarda o endereço ---
  //
  // Cada passo diz o que está a fazer. A primeira versão falhava em silêncio: o
  // campo de ficheiro continuava lá, sem pré-visualização e sem erro, e não
  // havia forma de saber se a imagem tinha subido, se o formato era recusado,
  // ou se nada tinha sequer acontecido.
  async function escolherImagem(ficheiro: File) {
    setErro(""); setMsg(""); setACarregarImg(true);
    try {
      // Limite do Supabase por omissão: 50 MB. Uma foto de telemóvel moderna
      // passa disso com facilidade, e o erro que vem de lá não é claro.
      if (ficheiro.size > 45 * 1024 * 1024) {
        setErro(`A imagem tem ${(ficheiro.size / 1024 / 1024).toFixed(1)} MB — demasiado grande. Reduz para menos de 45 MB.`);
        return;
      }
      // Nome único: a data mais um número. Sem isto, duas notícias com uma foto
      // chamada "capa.jpg" escreviam uma por cima da outra.
      const ext = (ficheiro.name.split(".").pop() || "jpg").toLowerCase();
      const nome = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      // Sem sessão não há permissão nenhuma no Storage — e é uma causa fácil
      // de despistar mal (parece um problema de permissões da pasta).
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        setErro("A tua sessão expirou. Recarrega a página e entra outra vez.");
        return;
      }
      const { error } = await supabase.storage.from("blog").upload(nome, ficheiro, { upsert: false });
      if (error) {
        // Também aqui: o erro real. O mais comum é o bucket "blog" não existir
        // ou não ter política de escrita para editores.
        const e = error as { message?: string };
        setErro(`Imagem: ${e.message || "não foi possível carregar"}`);
        return;
      }
      const { data } = supabase.storage.from("blog").getPublicUrl(nome);
      if (!data?.publicUrl) {
        setErro("A imagem subiu mas não conseguimos o endereço dela. Confirma que o bucket 'blog' está público.");
        return;
      }
      setF((x) => ({ ...x, imagem_url: data.publicUrl }));
      setMsg("Imagem carregada.");
    } catch (e) {
      const m = e instanceof Error ? e.message : "";
      setErro(`Não foi possível carregar a imagem.${m ? ` (${m})` : ""}`);
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
        // Ao mexer numa notícia gerada, ela deixa de estar em revisão: passou
        // por uma pessoa, que é o que a revisão queria garantir.
        publicar_auto_em: null,
        destaque: f.destaque,
        // O autor fica registado para uso INTERNO (saber quem escreveu o quê,
        // e para a política de leitura deixar cada um ver os seus rascunhos).
        // Mas o que aparece ao leitor é "Equipa Ippon League": o nome de quem
        // escreve muda quando a equipa muda, e a notícia é da marca.
        autor_id: uid,
        autor_nome: meuNome || null,
        // Preserva o que já lá estava (chave e escudo). Ver a nota em
        // `dadosOriginais`.
        dados: dadosOriginais,
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
      setDadosOriginais({});
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
    // Guarda os dados originais antes de encher o formulário.
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

  /** Publica já uma notícia que está em revisão, sem esperar pelo prazo. */
  async function publicarJa(id: string) {
    await supabase.from("hub_noticias")
      .update({ estado: "publicada", publicar_auto_em: null }).eq("id", id);
    await carregarLista();
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
    return <SemAcesso />;
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
            {/* Quem está a escrever é informação de bastidor. O que sai
                assinado é sempre "Equipa Ippon League". */}
            <div style={{ fontSize: 11.5, color: "#93a39a" }}>
              {meuNome ? `${meuNome} · publica como Equipa Ippon League` : "Equipa Ippon League"}
            </div>
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
              <input type="file" accept="image/jpeg,image/png,image/webp" disabled={aCarregarImg}
                onChange={(e) => { const fi = e.target.files?.[0]; if (fi) void escolherImagem(fi); }}
                style={{ ...inp, padding: 9 }} />
            )}
            {aCarregarImg && (
              <div style={{ fontSize: 12, color: GOLD, marginTop: 6, fontWeight: 700 }}>A carregar a imagem…</div>
            )}
            {!aCarregarImg && !f.imagem_url && (
              // Diz o que é preciso acontecer. Sem isto, escolher o ficheiro e
              // não ver nada acontecer parece que já está feito — e a notícia
              // sai sem imagem.
              <div style={{ fontSize: 11, color: "#5f6f67", marginTop: 5 }}>
                Depois de escolher, a imagem aparece aqui. Se não aparecer, alguma coisa correu mal.
              </div>
            )}
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
            <button onClick={() => { setF(VAZIO); setDadosOriginais({}); setMsg(""); setErro(""); }}
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
                  background: it.estado === "publicada" ? "#13301f" : it.estado === "revisao" ? "#2a1f1c" : it.estado === "agendada" ? "#2a2410" : "#1a2028",
                  color: it.estado === "publicada" ? "#7fd1a3" : it.estado === "revisao" ? "#ef8d83" : it.estado === "agendada" ? GOLD : "#7c8a82" }}>
                  {it.estado === "publicada" ? "no ar" : it.estado === "revisao" ? "a rever" : it.estado === "agendada" ? "agendada" : "rascunho"}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 13, color: "#d6ddd6", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.titulo}</span>
                  {/* Quanto falta para sair sozinha. Sem isto, "a rever" não
                      diz se há tempo de mexer ou se é já a seguir. */}
                  {it.estado === "revisao" && it.publicar_auto_em && (
                    <span style={{ display: "block", fontSize: 10, color: "#7c8a82", marginTop: 1 }}>
                      {faltamHoras(it.publicar_auto_em)}
                    </span>
                  )}
                  {!it.autor_id && (
                    <span style={{ display: "block", fontSize: 10, color: "#5f6f67", marginTop: 1 }}>gerada automaticamente</span>
                  )}
                </span>
                {it.estado === "revisao" && (
                  <button onClick={() => publicarJa(it.id)} style={{ ...btnMini, color: "#7fd1a3", borderColor: "#2a4d3e" }}>Publicar já</button>
                )}
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

/** "sai daqui a 4h" — para o editor saber se tem tempo de mexer. */
function faltamHoras(iso: string): string {
  const ms = Date.parse(iso) - Date.now();
  if (!Number.isFinite(ms)) return "";
  if (ms <= 0) return "sai na próxima passagem";
  const h = Math.floor(ms / 3600000);
  if (h >= 1) return `sai daqui a ${h}h`;
  return `sai daqui a ${Math.max(1, Math.round(ms / 60000))} min`;
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

/**
 * Quem não é editor.
 *
 * O acesso a sério é garantido pela BASE DE DADOS: as políticas exigem
 * is_editor para inserir, editar ou apagar. Este ecrã é só cortesia — evita
 * mostrar um formulário que nunca gravaria nada.
 *
 * Com o Dôdo a fazer o gesto de "aqui não". Uma frase seca a dizer que a página
 * não é para si soa a porta na cara; o mesmo dito pelo mascote da app soa a
 * "enganaste-te no caminho".
 */
function SemAcesso() {
  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: FB, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ maxWidth: 320, textAlign: "center" }}>
        <div style={{ position: "relative", width: 130, height: 130, margin: "0 auto 6px" }}>
          <Mascot belt="#efeadd" expression="indicando" />
          {/* Braços cruzados por cima do Dôdo: "aqui não". */}
          <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 52 }} aria-hidden="true">
            🙅
          </span>
        </div>
        <h1 style={{ fontFamily: FD, fontSize: 19, fontWeight: 700, textTransform: "uppercase", margin: "6px 0 10px" }}>
          Por aqui não
        </h1>
        <p style={{ fontSize: 14, color: "#93a39a", lineHeight: 1.6, margin: "0 0 20px" }}>
          Esta zona é da equipa que escreve as notícias. Se estás à procura do blog, é já a seguir.
        </p>
        <a href="/blog" style={{ display: "inline-block", background: GOLD, color: "#1b211e", fontFamily: FD, fontSize: 13.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", padding: "12px 24px", borderRadius: 11, textDecoration: "none" }}>
          Ir para o Blog do Dôdo
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
