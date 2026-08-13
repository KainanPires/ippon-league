// app/api/hub/traduzir/route.ts
//
// TRADUZ AS NOTÍCIAS PUBLICADAS que ainda não têm tradução.
//
// ---------------------------------------------------------------------------
// PORQUE É UMA VARREDURA, E NÃO UM GATILHO ÚNICO
//
// Uma notícia fica "publicada" de TRÊS formas diferentes:
//   1) o editor carrega em "Publicar";
//   2) o motor publica-a sozinho ao fim das horas de revisão;
//   3) as agendadas saem à hora marcada — por uma função no Postgres.
// Não há um único sítio no código por onde todas passem. Por isso a tradução é
// uma VARREDURA: esta rota procura notícias já publicadas SEM `traducoes` e trata
// delas. É idempotente e segura de chamar de hora a hora — o cron chama-a.
//
// O editor, além disso, chama-a (POST) logo a seguir a publicar, para a SUA
// notícia sair traduzida em segundos e não à espera da próxima passagem do cron.
//
//   GET  /api/hub/traduzir?key=SEGREDO         -> varre um lote (cron)
//   GET  /api/hub/traduzir?key=SEGREDO&id=X    -> força uma notícia
//   POST /api/hub/traduzir   { id }  (editor autenticado) -> traduz uma agora
// ---------------------------------------------------------------------------
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { traduzirNoticia } from "@/lib/traduzirNoticia";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Quantas traduzir por passagem. Baixo de propósito: cada uma é uma chamada à
// API, e o cron passa de hora a hora — não é preciso despachar tudo de uma vez.
const LOTE = 8;

type Linha = { id: string; titulo: string; resumo: string | null; corpo: string };

async function traduzirLinha(l: Linha): Promise<boolean> {
  const trad = await traduzirNoticia({
    titulo: l.titulo || "",
    resumo: l.resumo || "",
    corpo: l.corpo || "",
  });
  if (!trad) return false;
  const { error } = await supabaseAdmin!.from("hub_noticias").update({ traducoes: trad }).eq("id", l.id);
  return !error;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const key = (searchParams.get("key") || "").trim();
  if (!process.env.CRON_SECRET || key !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, erro: "Não autorizado." }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ ok: false, erro: "Servidor sem ligação." }, { status: 500 });
  }
  const id = (searchParams.get("id") || "").trim();

  // Força uma notícia específica (reescreve mesmo que já tenha tradução).
  if (id) {
    const { data } = await supabaseAdmin
      .from("hub_noticias")
      .select("id, titulo, resumo, corpo")
      .eq("id", id).maybeSingle();
    if (!data) return NextResponse.json({ ok: false, erro: "Não encontrada." }, { status: 404 });
    const ok = await traduzirLinha(data as Linha);
    return NextResponse.json({ ok, traduzidas: ok ? 1 : 0 });
  }

  // Varredura: publicadas, ainda sem traduções, mais recentes primeiro.
  const { data } = await supabaseAdmin
    .from("hub_noticias")
    .select("id, titulo, resumo, corpo")
    .eq("estado", "publicada")
    .is("traducoes", null)
    .order("criada_em", { ascending: false })
    .limit(LOTE);
  const linhas = (data as Linha[]) || [];
  let traduzidas = 0;
  for (const l of linhas) {
    if (await traduzirLinha(l)) traduzidas++;
  }
  return NextResponse.json({ ok: true, candidatas: linhas.length, traduzidas });
}

// O editor, ao publicar, chama isto para a notícia sair traduzida logo.
// Autoriza pelo token da sessão de quem chama — tem de ser um editor.
export async function POST(req: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ ok: false, erro: "Servidor sem ligação." }, { status: 500 });
  }
  const auth = req.headers.get("authorization") || "";
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  if (!token) return NextResponse.json({ ok: false, erro: "Sem sessão." }, { status: 401 });

  const { data: u } = await supabaseAdmin.auth.getUser(token);
  const uid = u?.user?.id;
  if (!uid) return NextResponse.json({ ok: false, erro: "Sessão inválida." }, { status: 401 });
  const { data: perfil } = await supabaseAdmin.from("users").select("is_editor").eq("id", uid).maybeSingle();
  if (!perfil?.is_editor) return NextResponse.json({ ok: false, erro: "Não autorizado." }, { status: 403 });

  let id = "";
  try {
    const body = (await req.json()) as { id?: string };
    id = String(body?.id || "").trim();
  } catch {}
  if (!id) return NextResponse.json({ ok: false, erro: "Falta o id." }, { status: 400 });

  const { data } = await supabaseAdmin
    .from("hub_noticias")
    .select("id, titulo, resumo, corpo")
    .eq("id", id).maybeSingle();
  if (!data) return NextResponse.json({ ok: false, erro: "Não encontrada." }, { status: 404 });
  const ok = await traduzirLinha(data as Linha);
  return NextResponse.json({ ok, traduzidas: ok ? 1 : 0 });
}
