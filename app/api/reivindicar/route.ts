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

/**
 * Quanto tempo um código serve.
 *
 * Sozinho o código não abre nada — só funciona na conta que fez o pedido. Mas um
 * segredo sem prazo é um segredo que só piora: um código enviado ao Instagram
 * errado, ou esquecido numa conversa antiga, continuaria a valer meses depois.
 *
 * 48h é tempo de sobra para ver um DM e responder, e curto o bastante para um
 * engano não se arrastar. Passado o prazo pede-se outro — é um clique.
 */
const VALIDADE_HORAS = 48;
const novaExpiracao = () => new Date(Date.now() + VALIDADE_HORAS * 3600 * 1000).toISOString();

// ---------------------------------------------------------------------------
// AVISO POR EMAIL — para os pedidos não ficarem à espera de alguém se lembrar
// de espreitar a página de administração.
//
// Segue o mesmo padrão do /api/mensagens: chamada direta à API do Resend, sem
// biblioteca partilhada (o projeto não tem uma). Se o RESEND_API_KEY não estiver
// definido, não faz nada — e o pedido grava na mesma. O email é uma conveniência,
// nunca uma condição.
//
// O email leva o CÓDIGO já dentro, para se poder copiar direto para o DM sem ter
// de abrir mais nada.
// ---------------------------------------------------------------------------
const MAIL_TO = process.env.MAIL_TO || "support@ipponleague.com";
const MAIL_FROM = process.env.MAIL_FROM || "Ippon League <support@ipponleague.com>";

/**
 * O que a app já sabe sobre quem está a reivindicar.
 *
 * PORQUÊ: sem isto, cada pedido era só "alguém diz ser o Shohei Ono" + um
 * Instagram. Para responder era preciso investigar caso a caso. Com o nome, a
 * idade e o país à frente, a maioria dos pedidos falsos cai à primeira vista —
 * um "atleta" de 45 anos a reivindicar um júnior, ou um país que não bate com o
 * do atleta, dispensa qualquer investigação.
 *
 * São dados que a pessoa já deu no registo. Não se pede nada de novo.
 */
interface FichaUtilizador {
  nome: string;
  email: string;
  idade: number | null;
  dataNascimento: string | null;
  pais: string | null;
  desdeQuando: string | null;
  equipas: number;
}

function idadeDe(nasc: string | null): number | null {
  if (!nasc) return null;
  const d = new Date(nasc);
  if (isNaN(d.getTime())) return null;
  const hoje = new Date();
  let anos = hoje.getFullYear() - d.getFullYear();
  const m = hoje.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < d.getDate())) anos--;
  return anos >= 0 && anos < 120 ? anos : null;
}

async function fichaDoUtilizador(uid: string): Promise<FichaUtilizador> {
  const vazia: FichaUtilizador = { nome: "", email: "", idade: null, dataNascimento: null, pais: null, desdeQuando: null, equipas: 0 };
  if (!supabaseAdmin) return vazia;
  try {
    const { data: u } = await supabaseAdmin
      .from("users")
      .select("name, email, data_nascimento, country_code")
      .eq("id", uid).maybeSingle();
    // Há quanto tempo tem conta, e quantas vezes jogou. Uma conta criada há
    // cinco minutos, sem nenhuma equipa montada, é um sinal — não uma prova,
    // mas ajuda a ordenar a fila de quem responder primeiro.
    let desdeQuando: string | null = null;
    try {
      const { data: auth } = await supabaseAdmin.auth.admin.getUserById(uid);
      desdeQuando = auth?.user?.created_at ?? null;
    } catch { /* sem data de criação: segue */ }
    let equipas = 0;
    try {
      const { count } = await supabaseAdmin
        .from("equipas").select("user_id", { count: "exact", head: true }).eq("user_id", uid);
      equipas = count ?? 0;
    } catch { /* sem contagem: segue */ }
    const nasc = u?.data_nascimento ? String(u.data_nascimento) : null;
    return {
      nome: String(u?.name || ""),
      email: String(u?.email || ""),
      idade: idadeDe(nasc),
      dataNascimento: nasc,
      pais: u?.country_code ? String(u.country_code) : null,
      desdeQuando,
      equipas,
    };
  } catch { return vazia; }
}

function esc(v: string): string {
  return String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function avisarPorEmail(d: { atleta: string; idPerson: string; instagram: string; codigo: string; ficha?: FichaUtilizador }): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;
  const html = `
    <div style="font-family:system-ui,sans-serif;font-size:14px;line-height:1.6;color:#111">
      <p style="margin:0 0 12px"><strong>Alguém diz ser ${esc(d.atleta || d.idPerson)}.</strong></p>
      <p style="margin:0 0 4px"><strong>Instagram:</strong>
        <a href="https://instagram.com/${esc(d.instagram)}">@${esc(d.instagram)}</a></p>
      <p style="margin:0 0 4px"><strong>Atleta:</strong> ${esc(d.atleta)} (id ${esc(d.idPerson)})</p>
      ${d.ficha ? `
      <hr style="border:none;border-top:1px solid #ddd;margin:14px 0" />
      <p style="margin:0 0 8px;font-weight:700">O que a conta diz sobre esta pessoa</p>
      <table style="border-collapse:collapse;font-size:13px">
        <tr><td style="padding:2px 12px 2px 0;color:#666">Nome</td><td>${esc(d.ficha.nome) || "<em>não preenchido</em>"}</td></tr>
        <tr><td style="padding:2px 12px 2px 0;color:#666">Email</td><td>${esc(d.ficha.email)}</td></tr>
        <tr><td style="padding:2px 12px 2px 0;color:#666">Idade</td><td>${d.ficha.idade !== null ? `${d.ficha.idade} anos (${esc(d.ficha.dataNascimento || "")})` : "<em>não preenchida</em>"}</td></tr>
        <tr><td style="padding:2px 12px 2px 0;color:#666">País</td><td>${esc(d.ficha.pais || "") || "<em>não preenchido</em>"}</td></tr>
        <tr><td style="padding:2px 12px 2px 0;color:#666">Conta criada</td><td>${d.ficha.desdeQuando ? esc(new Date(d.ficha.desdeQuando).toLocaleDateString("pt-PT")) : "—"}</td></tr>
        <tr><td style="padding:2px 12px 2px 0;color:#666">Equipas montadas</td><td>${d.ficha.equipas}</td></tr>
      </table>
      <p style="margin:10px 0 0;color:#666;font-size:12px">
        Compara com o que sabes do atleta: a idade bate com a categoria? O país é o mesmo?
        Se não bater, não vale a pena responder.
      </p>` : ""}
      <hr style="border:none;border-top:1px solid #ddd;margin:14px 0" />
      <p style="margin:0 0 6px">Código a enviar por mensagem direta:</p>
      <p style="margin:0 0 14px;font-family:ui-monospace,monospace;font-size:22px;font-weight:700;letter-spacing:2px">${esc(d.codigo)}</p>
      <p style="margin:0 0 8px;color:#666;font-size:12px">
        Confirma primeiro o perfil no Instagram (deve bater com o do site da IJF).
        Só depois envia o código — é ele que prova que a conta é da pessoa.
      </p>
      <p style="margin:0;color:#666;font-size:12px">
        Válido ${VALIDADE_HORAS} horas. Passado esse tempo, a pessoa pode pedir outro na app.
      </p>
    </div>`;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: MAIL_FROM,
        to: [MAIL_TO],
        subject: `[Ippon League] Reivindicação: ${d.atleta || d.idPerson}`,
        html,
      }),
    });
  } catch { /* o pedido já está gravado; o email é extra */ }
}

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
      .select("id, id_person, nome_atleta, user_id, tipo_contacto, contacto, codigo, estado, tentativas, criado_em, verificado_em, codigo_expira_em")
      .order("criado_em", { ascending: false })
      .limit(200);
    // Junta a ficha de cada pedinte — os mesmos dados que vão no email, para
    // quem preferir ver a lista toda de uma vez em vez de abrir email a email.
    const pedidos = [];
    for (const p of data || []) {
      pedidos.push({ ...p, quem: await fichaDoUtilizador(String(p.user_id)) });
    }
    return NextResponse.json({ ok: true, pedidos });
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
    .select("user_id, estado, tentativas, codigo_expira_em")
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
    // Para o ecrã poder oferecer "pedir código novo" em vez de deixar a pessoa
    // a tentar um código que já não serve.
    codigoExpirado: meu?.codigo_expira_em ? Date.now() > Date.parse(String(meu.codigo_expira_em)) : false,
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
        .update({ tipo_contacto: tipo, contacto, codigo, estado: "pendente", tentativas: 0, criado_em: new Date().toISOString(), codigo_expira_em: novaExpiracao() })
        .eq("id", existente.id);
      await avisarPorEmail({ atleta: (corpo.nome_atleta || "").trim(), idPerson, instagram: contacto, codigo, ficha: await fichaDoUtilizador(uid) });
      return NextResponse.json({ ok: true, pedido: true, reenviado: true });
    }

    const { error } = await supabaseAdmin.from("atletas_reivindicacoes").insert({
      id_person: idPerson,
      nome_atleta: (corpo.nome_atleta || "").trim() || null,
      user_id: uid,
      tipo_contacto: tipo,
      contacto,
      codigo,
      codigo_expira_em: novaExpiracao(),
    });
    if (error) {
      return NextResponse.json({ ok: false, erro: "Não foi possível registar o pedido." }, { status: 500 });
    }
    // Avisa por email, com o código pronto a copiar e a ficha de quem pediu.
    await avisarPorEmail({ atleta: (corpo.nome_atleta || "").trim(), idPerson, instagram: contacto, codigo, ficha: await fichaDoUtilizador(uid) });
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
      .select("id, codigo, estado, tentativas, codigo_expira_em")
      .eq("id_person", idPerson).eq("user_id", uid).maybeSingle();
    if (!pedido) {
      return NextResponse.json({ ok: false, erro: "Não há nenhum pedido teu para este atleta." }, { status: 404 });
    }
    if (String(pedido.estado) === "verificado") {
      return NextResponse.json({ ok: true, verificado: true, jaEra: true });
    }
    // Expirado? Não se compara sequer — pede-se um novo.
    const expira = pedido.codigo_expira_em ? Date.parse(String(pedido.codigo_expira_em)) : 0;
    if (expira > 0 && Date.now() > expira) {
      return NextResponse.json({
        ok: false, expirado: true,
        erro: "Este código já expirou. Pede um código novo.",
      }, { status: 410 });
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

  // ===================== NOVO CÓDIGO =====================
  // Para quando o código se perde, expira, ou foi enviado ao sítio errado.
  // Gerar um novo INVALIDA o anterior — é o mesmo campo. Também limpa as
  // tentativas: o contador existe para travar quem adivinha, não para punir
  // quem nunca chegou a receber o código.
  if (corpo.acao === "novo-codigo") {
    const { data: pedido } = await supabaseAdmin
      .from("atletas_reivindicacoes")
      .select("id, estado, contacto")
      .eq("id_person", idPerson).eq("user_id", uid).maybeSingle();
    if (!pedido) {
      return NextResponse.json({ ok: false, erro: "Não há nenhum pedido teu para este atleta." }, { status: 404 });
    }
    if (String(pedido.estado) === "verificado") {
      return NextResponse.json({ ok: true, jaEs: true });
    }
    const codigo = gerarCodigo();
    const { error } = await supabaseAdmin
      .from("atletas_reivindicacoes")
      .update({ codigo, codigo_expira_em: novaExpiracao(), tentativas: 0, estado: "pendente" })
      .eq("id", pedido.id);
    if (error) {
      return NextResponse.json({ ok: false, erro: "Não foi possível gerar um código novo." }, { status: 500 });
    }
    await avisarPorEmail({
      atleta: (corpo.nome_atleta || "").trim(), idPerson,
      instagram: String(pedido.contacto || ""), codigo,
      ficha: await fichaDoUtilizador(uid),
    });
    return NextResponse.json({ ok: true, pedido: true, novo: true });
  }

  return NextResponse.json({ ok: false, erro: "Ação desconhecida." }, { status: 400 });
}
