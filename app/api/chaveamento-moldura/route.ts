// app/api/chaveamento-moldura/route.ts
//
// MOLDURA DA CHAVE — ler, gravar e avisar. É a ponte entre o editor manual do
// responsável (is_chaveador) e a tabela `chave_atletas` que alimenta a chave ao
// vivo do Pro/Pro Max. O cron "Chave Maestro" (/api/chave-viva) lê essa moldura
// e preenche o movimento (resultados do JudoBase). Aqui só se monta a ESTRUTURA.
//
//   GET  /api/chaveamento-moldura?comp=ID
//        • chaveador  -> molduras completas (pools) para editar
//        • outros     -> só { existe } (não vaza os pools — são conteúdo Pro)
//   POST /api/chaveamento-moldura   (Authorization: Bearer <token>, is_chaveador)
//        { acao:"gravar",  comp, categoria, genero, pools }
//        { acao:"apagar",  comp, categoria }
//        { acao:"avisar",  comp }   -> notifica todos, UMA vez (chaveamento_avisos)
//
// A `pools` é o objeto { A:[ids], B:[ids], C:[ids], D:[ids], byes:{A:[ids],…} }
// — a mesma forma que o motorChave/montarChave já lêem de `chave_atletas.pools`.
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { criarNotificacaoServidor } from "@/lib/notificacoesServidor";
import { nomeCompeticaoPorId } from "@/lib/calendario";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Confirma que quem pede é um chaveador. Devolve o uid, ou null. */
async function chaveadorDoPedido(req: Request): Promise<string | null> {
  try {
    const auth = req.headers.get("authorization") || "";
    const tok = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
    if (!tok) return null;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const pub = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
    if (!url || !pub || !supabaseAdmin) return null;
    const sb = createClient(url, pub, {
      global: { headers: { Authorization: `Bearer ${tok}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await sb.auth.getUser();
    if (error || !data?.user?.id) return null;
    const uid = data.user.id;
    const { data: u } = await supabaseAdmin.from("users").select("is_chaveador").eq("id", uid).maybeSingle();
    return u?.is_chaveador ? uid : null;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  if (!supabaseAdmin) return NextResponse.json({ ok: false, erro: "Servidor sem ligação." }, { status: 500 });
  const { searchParams } = new URL(req.url);
  const comp = (searchParams.get("comp") || "").trim();
  if (!comp) return NextResponse.json({ ok: false, erro: "Falta ?comp=." }, { status: 400 });

  const { data } = await supabaseAdmin
    .from("chave_atletas")
    .select("weight_category, genero, pools")
    .eq("id_competicao", comp);
  const molduras = data || [];

  const uid = await chaveadorDoPedido(req);
  if (uid) {
    // Editor: molduras completas (com os pools).
    return NextResponse.json({ ok: true, autorizado: true, molduras });
  }
  // Restantes: só se existe (os pools são conteúdo Pro — não se devolvem aqui).
  return NextResponse.json({
    ok: true,
    autorizado: false,
    existe: molduras.length > 0,
    categorias: molduras.map((m) => String((m as { weight_category?: unknown }).weight_category || "")),
  });
}

export async function POST(req: Request) {
  if (!supabaseAdmin) return NextResponse.json({ ok: false, erro: "Servidor sem ligação." }, { status: 500 });
  const uid = await chaveadorDoPedido(req);
  if (!uid) return NextResponse.json({ ok: false, erro: "Não autorizado." }, { status: 401 });

  let body: { acao?: string; comp?: string; categoria?: string; genero?: string; pools?: unknown };
  try { body = await req.json(); } catch {
    return NextResponse.json({ ok: false, erro: "Pedido inválido." }, { status: 400 });
  }
  const acao = String(body.acao || "");
  const comp = String(body.comp || "").trim();
  if (!comp) return NextResponse.json({ ok: false, erro: "Falta a competição." }, { status: 400 });

  // --- GRAVAR a moldura de uma categoria ---
  if (acao === "gravar") {
    const categoria = String(body.categoria || "").trim();
    const genero = body.genero ? String(body.genero) : null;
    const pools = body.pools;
    if (!categoria) return NextResponse.json({ ok: false, erro: "Falta a categoria." }, { status: 400 });
    if (!pools || typeof pools !== "object") return NextResponse.json({ ok: false, erro: "Moldura inválida." }, { status: 400 });

    // select-depois-update/insert (não dependemos do nome da constraint única).
    const { data: ex } = await supabaseAdmin
      .from("chave_atletas")
      .select("id")
      .eq("id_competicao", comp)
      .eq("weight_category", categoria)
      .maybeSingle();
    if (ex?.id) {
      const { error } = await supabaseAdmin.from("chave_atletas").update({ genero, pools }).eq("id", ex.id);
      if (error) return NextResponse.json({ ok: false, erro: "Não foi possível guardar." }, { status: 500 });
    } else {
      const { error } = await supabaseAdmin.from("chave_atletas").insert({ id_competicao: comp, weight_category: categoria, genero, pools });
      if (error) return NextResponse.json({ ok: false, erro: "Não foi possível guardar." }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  // --- APAGAR a moldura de uma categoria ---
  if (acao === "apagar") {
    const categoria = String(body.categoria || "").trim();
    if (!categoria) return NextResponse.json({ ok: false, erro: "Falta a categoria." }, { status: 400 });
    await supabaseAdmin.from("chave_atletas").delete().eq("id_competicao", comp).eq("weight_category", categoria);
    return NextResponse.json({ ok: true });
  }

  // --- AVISAR os jogadores (uma vez só por competição) ---
  if (acao === "avisar") {
    const { data: ja } = await supabaseAdmin
      .from("chaveamento_avisos").select("id_competicao").eq("id_competicao", comp).maybeSingle();
    if (ja) return NextResponse.json({ ok: true, jaAvisado: true });

    const compNome = nomeCompeticaoPorId(comp) || comp;
    const { data: users } = await supabaseAdmin.from("users").select("id");
    let avisados = 0;
    for (const u of users || []) {
      try {
        await criarNotificacaoServidor({
          paraUserId: String(u.id),
          tipo: "chave_disponivel",
          chaveTitulo: "chave.notifTitulo",
          chaveCorpo: "chave.notifCorpo",
          vars: { comp: compNome },
          link: "/chave-atletas",
        });
        avisados++;
      } catch { /* falha de um não bloqueia os outros */ }
    }
    await supabaseAdmin.from("chaveamento_avisos").insert({ id_competicao: comp });
    return NextResponse.json({ ok: true, avisados });
  }

  return NextResponse.json({ ok: false, erro: "Ação desconhecida." }, { status: 400 });
}
