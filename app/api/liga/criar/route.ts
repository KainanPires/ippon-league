// app/api/liga/criar/route.ts
//
// CRIAR LIGA (no servidor, com a chave secreta — passa por cima do RLS).
//
// O cliente não toca nas tabelas diretamente (o RLS está ligado sem políticas,
// por isso a chave pública não escreve). Esta rota usa supabaseAdmin, igual ao
// /api/atletas, e faz duas coisas numa só chamada:
//   1) cria a liga na tabela `leagues`
//   2) mete o criador como primeiro membro na `league_members`
//
// Recebe (POST, corpo JSON):
//   { user_id, nome, descricao?, formato, privacidade, escudo }
// Devolve:
//   { ok, liga: { id, invite_code, ... } }  ou  { ok:false, erro }
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Gera um código de convite curto e legível (sem letras/números ambíguos).
function novoCodigo(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}


// Conta em quantas ligas de AMIGOS (type "amigos") o utilizador já está.
async function contarLigasAmigos(user_id: string): Promise<number> {
  if (!supabaseAdmin) return 0;
  try {
    const { data: filiacoes } = await supabaseAdmin
      .from("league_members")
      .select("league_id")
      .eq("user_id", user_id);
    const ids = (filiacoes || []).map((f) => f.league_id);
    if (ids.length === 0) return 0;
    const { count } = await supabaseAdmin
      .from("leagues")
      .select("id", { count: "exact", head: true })
      .in("id", ids)
      .eq("type", "amigos");
    return count ?? 0;
  } catch {
    return 0;
  }
}

// É Pro? (lê do user_metadata do Auth)
async function ehPro(user_id: string): Promise<boolean> {
  if (!supabaseAdmin) return false;
  try {
    const { data } = await supabaseAdmin.auth.admin.getUserById(user_id);
    const meta = data?.user?.user_metadata as { is_pro?: boolean } | undefined;
    return !!meta?.is_pro;
  } catch {
    return false;
  }
}

// Limite de ligas de amigos para quem não é Pro.
const LIMITE_AMIGOS_FREE = 2;

export async function POST(req: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ ok: false, erro: "Servidor sem ligação à base de dados." }, { status: 500 });
  }

  let corpo: {
    user_id?: string;
    nome?: string;
    descricao?: string;
    formato?: string;
    privacidade?: string;
    escudo?: unknown;
  };
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ ok: false, erro: "Pedido inválido." }, { status: 400 });
  }

  const user_id = (corpo.user_id || "").trim();
  const nome = (corpo.nome || "").trim();
  const descricao = (corpo.descricao || "").trim();
  const formato = (corpo.formato || "pontos").trim();
  const privacidade = (corpo.privacidade || "fechada").trim();
  const escudo = corpo.escudo ?? null;

  // Validações mínimas.
  if (!user_id) return NextResponse.json({ ok: false, erro: "Sessão em falta. Entra para criar uma liga." }, { status: 401 });
  if (nome.length < 2) return NextResponse.json({ ok: false, erro: "Dá um nome à tua liga (mínimo 2 letras)." }, { status: 400 });

  // Limite: quem não é Pro só pode estar em 2 ligas de amigos.
  const pro = await ehPro(user_id);
  if (!pro) {
    const quantas = await contarLigasAmigos(user_id);
    if (quantas >= LIMITE_AMIGOS_FREE) {
      return NextResponse.json({
        ok: false,
        limite: true,
        erro: "Já estás em 2 ligas de amigos. Passa a Ippon Pro para criares e entrares em ligas ilimitadas.",
      }, { status: 403 });
    }
  }

  // Gera um código único (tenta algumas vezes para evitar colisão rara).
  let invite_code = novoCodigo();
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const { data: existe } = await supabaseAdmin
      .from("leagues")
      .select("id")
      .eq("invite_code", invite_code)
      .maybeSingle();
    if (!existe) break;
    invite_code = novoCodigo();
  }

  // 1) Cria a liga. type="amigos" distingue das 18 oficiais (type="oficial").
  const { data: liga, error: erroLiga } = await supabaseAdmin
    .from("leagues")
    .insert({
      name: nome,
      type: "amigos",
      scope: "privada",
      created_by: user_id,
      invite_code,
      descricao: descricao || null,
      formato,
      privacidade,
      escudo,
    })
    .select()
    .single();

  if (erroLiga || !liga) {
    return NextResponse.json({ ok: false, erro: "Não foi possível criar a liga.", detalhe: erroLiga?.message }, { status: 500 });
  }

  // 2) Mete o criador como primeiro membro.
  const { error: erroMembro } = await supabaseAdmin
    .from("league_members")
    .insert({
      league_id: liga.id,
      user_id,
      score: 0,
      position: 1,
    });

  if (erroMembro) {
    // A liga foi criada mas o membro falhou. Não é fatal — o criador pode entrar
    // depois pelo código. Mas avisamos para sabermos que aconteceu.
    return NextResponse.json({
      ok: true,
      aviso: "Liga criada, mas não te adicionámos automaticamente. Entra com o código.",
      liga: { id: liga.id, name: liga.name, invite_code: liga.invite_code, formato, privacidade },
    });
  }

  return NextResponse.json({
    ok: true,
    liga: {
      id: liga.id,
      name: liga.name,
      invite_code: liga.invite_code,
      descricao: liga.descricao,
      formato,
      privacidade,
    },
  });
}
