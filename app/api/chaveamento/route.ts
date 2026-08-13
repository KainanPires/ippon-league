// app/api/chaveamento/route.ts
//
// PUBLICAR um chaveamento e AVISAR os jogadores.
//
// O editor de chaveamento (is_chaveador) grava a chave direto na tabela (RLS
// deixa). Mas publicar é aqui, no servidor, por dois motivos:
//   1) a notificação a TODOS os utilizadores precisa da chave secreta
//      (supabaseAdmin) — o cliente não pode escrever notificações a terceiros;
//   2) a notificação sai UMA vez só por competição (campo `notificado`), para
//      não repetir se o editor voltar a carregar em "Atualizar".
//
//   POST /api/chaveamento   { id }   (Authorization: Bearer <token da sessão>)
//
// A mensagem sai na LÍNGUA de cada pessoa: usamos as chaves chave.notif* do
// dicionário do servidor, e o criarNotificacaoServidor trata da tradução + push.
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { criarNotificacaoServidor } from "@/lib/notificacoesServidor";

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

export async function POST(req: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ ok: false, erro: "Servidor sem ligação." }, { status: 500 });
  }
  const uid = await chaveadorDoPedido(req);
  if (!uid) {
    return NextResponse.json({ ok: false, erro: "Não autorizado." }, { status: 401 });
  }

  let body: { id?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ ok: false, erro: "Pedido inválido." }, { status: 400 });
  }
  const id = String(body.id || "").trim();
  if (!id) return NextResponse.json({ ok: false, erro: "Falta o id." }, { status: 400 });

  const { data: chave } = await supabaseAdmin
    .from("hub_chaveamentos")
    .select("id, id_competicao, nome_competicao, notificado")
    .eq("id", id)
    .maybeSingle();
  if (!chave) return NextResponse.json({ ok: false, erro: "Chaveamento não encontrado." }, { status: 404 });

  // Publica.
  await supabaseAdmin
    .from("hub_chaveamentos")
    .update({ estado: "publicado", publicado_em: new Date().toISOString() })
    .eq("id", id);

  // Notifica todos — UMA vez só por competição.
  //
  // Nota de escala (honesta): isto percorre todos os utilizadores um a um
  // (sino + push por cada). Para uma base grande convém passar a envio em lote /
  // fila. Para o MVP é suficiente — é o mesmo padrão do Dia do Judô no cron.
  let avisados = 0;
  if (!chave.notificado) {
    const comp = String(chave.nome_competicao || "");
    const link = `/chaveamento/${encodeURIComponent(String(chave.id_competicao))}`;
    const { data: users } = await supabaseAdmin.from("users").select("id");
    for (const u of users || []) {
      try {
        await criarNotificacaoServidor({
          paraUserId: String(u.id),
          tipo: "chave_disponivel",
          chaveTitulo: "chave.notifTitulo",
          chaveCorpo: "chave.notifCorpo",
          vars: { comp },
          link,
        });
        avisados++;
      } catch { /* falha de um não bloqueia os outros */ }
    }
    await supabaseAdmin.from("hub_chaveamentos").update({ notificado: true }).eq("id", id);
  }

  return NextResponse.json({ ok: true, avisados });
}
