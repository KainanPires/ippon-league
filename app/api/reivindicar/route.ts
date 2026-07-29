// app/api/reivindicar/route.ts
//
// REIVINDICAR UM PERFIL DE ATLETA — "és tu? prova-o".
//
// ---------------------------------------------------------------------------
// COMO FUNCIONA
//
//   1. O atleta vê-se na app e clica em "És tu?". Deixa o INSTAGRAM.
//      -> POST { acao: "pedir" }  ... fica um pedido PENDENTE com um código.
//
//   2. O Kainan vê a lista de pendentes (GET ?admin=1&key=) e envia o código
//      por DM, da conta oficial, para o Instagram indicado.
//
//   3. O atleta introduz o código na app.
//      -> POST { acao: "verificar" } ... se bater, fica VERIFICADO.
//
// O código NUNCA sai desta rota para quem pede — só na vista de administração.
// É isso que o torna uma prova: quem o introduz recebeu-o naquele contacto.
//
// SÓ INSTAGRAM, e de propósito. Chegou a aceitar WhatsApp e foi retirado: um
// número de telemóvel não prova nada — qualquer pessoa escreve um qualquer e
// atende. Uma conta de Instagram de um atleta de topo, não: está ligada no
// perfil da IJF, tem milhares de seguidores e publica das competições. Dá para
// confirmar a olho antes sequer de enviar o código.
//
// ---------------------------------------------------------------------------
// IDENTIDADE PELO TOKEN, NÃO PELO CORPO DO PEDIDO
//
// Quase todas as rotas do projeto recebem o `user_id` no corpo e confiam nele.
// Aqui NÃO: isto decide quem é quem, e aceitar um user_id à letra deixaria
// qualquer pessoa reivindicar em nome de outra conta. O uid vem do token da
// sessão (padrão do /api/chave-atletas e /api/confrontos).
// ---------------------------------------------------------------------------
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Tentativas de código antes de bloquear o pedido. */
const MAX_TENTATIVAS = 6;

/** Gera um código curto e legível ao telefone: IPPON-7K3M. */
function gerarCodigo(): string {
  // Sem 0/O nem 1/I: são os que se confundem a ler em voz alta ou num DM.
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 4; i++) s += abc[Math.floor(Math.random() * abc.length)];
  return `IPPON-${s}`;
}

/** Quem está a pedir, a partir do token. null = sem sessão válida. */
async function uidDoPedido(req: Request): Promise<string | null> {
  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
    if (!token) return null;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const pub = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
    if (!url || !pub) return null;
    const sb = createClient(url, pub, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await sb.auth.getUser();
    if (error) return null;
    return data?.user?.id ?? null;
  } catch {
    return null;
  }
}

/** Normaliza um @ de Instagram: tira o @, espaços e um URL colado. */
function limparInstagram(v: string): string {
  return v.trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/\/+$/, "")
    .replace(/^@+/, "")
    .toLowerCase();
}

// ---------------------------------------------------------------------------
// GET — três usos:
//   ?verificados=1              -> lista de id_person verificados (para os selos)
//   ?id_person=123              -> estado deste atleta + se sou eu que pedi
//   ?admin=1&key=CRON_SECRET    -> pendentes COM o código (só para o Kainan)
// ---------------------------------------------------------------------------
export async function GET(req: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ ok: false, erro: "Servidor sem ligação." }, { status: 500 });
  }
  const { searchParams } = new URL(req.url);

  // --- Vista de administração: a lista de pedidos, com os códigos ---
  if (searchParams.get("admin") === "1") {
    const key = (searchParams.get("key") || "").trim();
    if (!process.env.CRON_SECRET || key !== process.env.CRON_SECRET) {
      return NextResponse.json({ ok: false, erro: "Não autorizado." }, { status: 401 });
    }
    const { data } = await supabaseAdmin
      .from("atletas_reivindicacoes")
      .select("id, id_person, nome_atleta, user_id, tipo_contacto, contacto, codigo, estado, tentativas, criado_em, verificado_em")
      .order("criado_em", { ascending: false })
      .limit(200);
    return NextResponse.json({ ok: true, pedidos: data || [] });
  }

  // --- Lista de atletas verificados (para mostrar o selo) ---
  if (searchParams.get("verificados") === "1") {
    const { data } = await supabaseAdmin
      .from("atletas_reivindicacoes")
      .select("id_person")
      .eq("estado", "verificado");
    return NextResponse.json({ ok: true, ids: (data || []).map((r) => String(r.id_person)) });
  }

  // --- Estado de UM atleta ---
  const idPerson = (searchParams.get("id_person") || "").trim();
  if (!idPerson) {
    return NextResponse.json({ ok: false, erro: "Falta ?id_person=." }, { status: 400 });
  }
  const uid = await uidDoPedido(req);
  const { data } = await supabaseAdmin
    .from("atletas_reivindicacoes")
    .select("user_id, estado, tentativas")
    .eq("id_person", idPerson);
  const linhas = data || [];
  const verificado = linhas.some((r) => r.estado === "verificado");
  const meu = uid ? linhas.find((r) => String(r.user_id) === uid) : undefined;
  return NextResponse.json({
    ok: true,
    verificado,
    // O que ESTE utilizador tem em curso, para o ecrã saber o que mostrar.
    meuEstado: meu ? String(meu.estado) : null,
    tentativasEsgotadas: meu ? Number(meu.tentativas) >= MAX_TENTATIVAS : false,
    temSessao: !!uid,
  });
}

// ---------------------------------------------------------------------------
// POST — { acao: "pedir" | "verificar", ... }
// ---------------------------------------------------------------------------
export async function POST(req: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ ok: false, erro: "Servidor sem ligação." }, { status: 500 });
  }
  const uid = await uidDoPedido(req);
  if (!uid) {
    return NextResponse.json({ ok: false, erro: "Entra na tua conta para reivindicares o perfil." }, { status: 401 });
  }

  let corpo: { acao?: string; id_person?: string; nome_atleta?: string; tipo_contacto?: string; contacto?: string; codigo?: string };
  try { corpo = await req.json(); } catch {
    return NextResponse.json({ ok: false, erro: "Pedido inválido." }, { status: 400 });
  }
  const idPerson = (corpo.id_person || "").trim();
  if (!idPerson) return NextResponse.json({ ok: false, erro: "Falta o atleta." }, { status: 400 });

  // ===================== PEDIR =====================
  if (corpo.acao === "pedir") {
    // Só Instagram (ver a nota no topo). O campo mantém-se na base para o caso
    // de um dia entrar outra rede — mas aqui só se aceita este valor.
    const tipo = "instagram";
    const cru = (corpo.contacto || "").trim();
    if (cru.length < 3) {
      return NextResponse.json({ ok: false, erro: "Escreve o teu Instagram." }, { status: 400 });
    }
    const contacto = limparInstagram(cru);
    if (contacto.length < 3 || /\s/.test(contacto)) {
      return NextResponse.json({ ok: false, erro: "Esse Instagram não parece válido." }, { status: 400 });
    }

    // Já há alguém verificado neste atleta? Então não se aceitam mais pedidos.
    const { data: jaVerif } = await supabaseAdmin
      .from("atletas_reivindicacoes")
      .select("id").eq("id_person", idPerson).eq("estado", "verificado").maybeSingle();
    if (jaVerif) {
      return NextResponse.json({ ok: false, jaVerificado: true, erro: "Este perfil já foi verificado." }, { status: 409 });
    }

    // Um pedido por pessoa e por atleta: se já existe, atualiza o contacto e
    // gera um código novo (o antigo pode ter-se perdido) — mas mantém o estado.
    const { data: existente } = await supabaseAdmin
      .from("atletas_reivindicacoes")
      .select("id, estado").eq("id_person", idPerson).eq("user_id", uid).maybeSingle();

    const codigo = gerarCodigo();
    if (existente) {
      if (String(existente.estado) === "verificado") {
        return NextResponse.json({ ok: true, jaEs: true });
      }
      await supabaseAdmin
        .from("atletas_reivindicacoes")
        .update({ tipo_contacto: tipo, contacto, codigo, estado: "pendente", tentativas: 0, criado_em: new Date().toISOString() })
        .eq("id", existente.id);
      return NextResponse.json({ ok: true, pedido: true, reenviado: true });
    }

    const { error } = await supabaseAdmin.from("atletas_reivindicacoes").insert({
      id_person: idPerson,
      nome_atleta: (corpo.nome_atleta || "").trim() || null,
      user_id: uid,
      tipo_contacto: tipo,
      contacto,
      codigo,
    });
    if (error) {
      return NextResponse.json({ ok: false, erro: "Não foi possível registar o pedido." }, { status: 500 });
    }
    // Repare: o código NÃO vai na resposta. Quem pede não o pode saber — é
    // isso que faz dele uma prova.
    return NextResponse.json({ ok: true, pedido: true });
  }

  // ===================== VERIFICAR =====================
  if (corpo.acao === "verificar") {
    const tentado = (corpo.codigo || "").trim().toUpperCase().replace(/\s+/g, "");
    if (!tentado) return NextResponse.json({ ok: false, erro: "Escreve o código." }, { status: 400 });

    const { data: pedido } = await supabaseAdmin
      .from("atletas_reivindicacoes")
      .select("id, codigo, estado, tentativas")
      .eq("id_person", idPerson).eq("user_id", uid).maybeSingle();
    if (!pedido) {
      return NextResponse.json({ ok: false, erro: "Não há nenhum pedido teu para este atleta." }, { status: 404 });
    }
    if (String(pedido.estado) === "verificado") {
      return NextResponse.json({ ok: true, verificado: true, jaEra: true });
    }
    if (Number(pedido.tentativas) >= MAX_TENTATIVAS) {
      return NextResponse.json({ ok: false, bloqueado: true, erro: "Demasiadas tentativas. Fala connosco para receberes um código novo." }, { status: 429 });
    }

    // Conta a tentativa ANTES de comparar — assim uma falha de rede a meio não
    // dá tentativas de graça a quem esteja a adivinhar.
    await supabaseAdmin
      .from("atletas_reivindicacoes")
      .update({ tentativas: Number(pedido.tentativas) + 1 })
      .eq("id", pedido.id);

    if (String(pedido.codigo).toUpperCase() !== tentado) {
      const restantes = Math.max(0, MAX_TENTATIVAS - (Number(pedido.tentativas) + 1));
      return NextResponse.json({ ok: false, erro: "Código errado.", tentativas_restantes: restantes }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("atletas_reivindicacoes")
      .update({ estado: "verificado", verificado_em: new Date().toISOString() })
      .eq("id", pedido.id);
    if (error) {
      // O índice único deixa passar UM verificado por atleta. Se falhar aqui, é
      // quase de certeza porque outra pessoa chegou primeiro.
      return NextResponse.json({ ok: false, erro: "Este perfil já foi verificado por outra conta." }, { status: 409 });
    }
    return NextResponse.json({ ok: true, verificado: true });
  }

  return NextResponse.json({ ok: false, erro: "Ação desconhecida." }, { status: 400 });
}
