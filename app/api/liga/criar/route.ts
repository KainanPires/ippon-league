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
// Limites (só contam ligas de amigos; oficiais não contam):
//   Free → criar no máximo 1 · participar no máximo 2 (a criada conta)
//   Pro  → criar no máximo 5 · participar no máximo 5 (a criada conta)
//
// Recebe (POST, corpo JSON):
//   { user_id, nome, descricao?, formato, privacidade, escudo }
// Devolve:
//   { ok, liga: { id, invite_code, ... } }  ou  { ok:false, erro }
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { competicaoPorId } from "@/lib/copa";
import { estadoMercado } from "@/lib/calendario";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// --- Limites por plano ---
const LIMITE_CRIAR_FREE = 1;
const LIMITE_CRIAR_PRO = 5;
const LIMITE_PARTICIPAR_FREE = 2;
const LIMITE_PARTICIPAR_PRO = 5;

// Gera um código de convite curto e legível (sem letras/números ambíguos).
function novoCodigo(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
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

// Em quantas ligas de AMIGOS o utilizador participa (criadas + entradas).
async function contarParticipacoesAmigos(user_id: string): Promise<number> {
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

// Quantas ligas de AMIGOS o utilizador CRIOU (é o dono).
async function contarCriadasAmigos(user_id: string): Promise<number> {
  if (!supabaseAdmin) return 0;
  try {
    const { count } = await supabaseAdmin
      .from("leagues")
      .select("id", { count: "exact", head: true })
      .eq("created_by", user_id)
      .eq("type", "amigos");
    return count ?? 0;
  } catch {
    return 0;
  }
}

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
    copa_competicao_inicial?: string | null;
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
  const copaCompInicial = (corpo.copa_competicao_inicial || "").trim();

  // Validações mínimas.
  if (!user_id) return NextResponse.json({ ok: false, erro: "Sessão em falta. Entra para criar uma liga." }, { status: 401 });
  if (nome.length < 2) return NextResponse.json({ ok: false, erro: "Dá um nome à tua liga (mínimo 2 letras)." }, { status: 400 });

  const pro = await ehPro(user_id);
  const limiteCriar = pro ? LIMITE_CRIAR_PRO : LIMITE_CRIAR_FREE;
  const limiteParticipar = pro ? LIMITE_PARTICIPAR_PRO : LIMITE_PARTICIPAR_FREE;

  // Limite 1: quantas já criou.
  const criadas = await contarCriadasAmigos(user_id);
  if (criadas >= limiteCriar) {
    return NextResponse.json({
      ok: false,
      limite: true,
      erro: pro
        ? "Já criaste 5 ligas — é o máximo, mesmo com Ippon Pro."
        : "Com a conta gratuita podes criar 1 liga. Passa a Ippon Pro para criares até 5.",
    }, { status: 403 });
  }

  // Limite 2: em quantas participa (a nova vai ocupar mais um lugar).
  const participacoes = await contarParticipacoesAmigos(user_id);
  if (participacoes >= limiteParticipar) {
    return NextResponse.json({
      ok: false,
      limite: true,
      erro: pro
        ? "Já estás em 5 ligas de amigos — é o máximo, mesmo com Ippon Pro."
        : "Já estás em 2 ligas de amigos. Passa a Ippon Pro para entrares e criares até 5.",
    }, { status: 403 });
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

  // Campos de copa: só quando formato="copa". O admin escolheu a competição
  // inicial; o fecho da inscrição é automático (1h antes dela começar).
  let copaCampos: Record<string, unknown> = {};
  if (formato === "copa") {
    const comp = competicaoPorId(copaCompInicial);
    if (!comp) {
      return NextResponse.json({ ok: false, erro: "Escolhe uma competição de arranque válida para a copa." }, { status: 400 });
    }
    // estadoMercado dá-nos o fecho do mercado (= início - 1h) dessa competição.
    const est = estadoMercado(comp);
    const fechoIso = est.fecho ? est.fecho.toISOString()
      : new Date(comp.de.replace(/\//g, "-") + "T00:00:00").toISOString();
    copaCampos = {
      copa_competicao_inicial: copaCompInicial,
      copa_fecho_inscricao: fechoIso,
      copa_estado: "inscricao",
    };
  }

  // 1) Cria a liga. type="amigos" distingue das oficiais (type="oficial").
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
      ...copaCampos,
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
