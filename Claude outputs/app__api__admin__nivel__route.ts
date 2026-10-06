// app/api/admin/nivel/route.ts
//
// ADMIN — dar/tirar Pro e Pro Max a uma conta (para criar conteúdo e testar).
//
// AUTORIZAÇÃO NO SERVIDOR (não é "esconder um botão"): a identidade vem do TOKEN
// da sessão e exige-se users.is_admin = true. Uma conta sem is_admin leva 401,
// mesmo que chegue ao endpoint a escrever o URL à mão. Mesmo padrão do
// is_chaveador (app/api/chaveamento).
//
// Esta é uma peça AUTORIZADA a mexer em is_pro/is_pro_max (além do lib/useNivel
// e do webhook da Stripe): uma ferramenta de admin, protegida no servidor.
// Escreve por OBJETO LITERAL na tabela `users` (nunca no user_metadata, que
// continua a não ser fonte de nível) — por isso não é o furo que o lint tranca.
//
//   GET  /api/admin/nivel                 -> { ok, admin:true, utilizadores:[...] }  (lista)
//   GET  /api/admin/nivel?email=...       -> { ok, encontrado, email, nome, nivel }
//   POST /api/admin/nivel  { email, nivel }             uma conta
//   POST /api/admin/nivel  { emails:[...], nivel }      lote
//     nivel: "gratis" | "pro" | "promax"
//
// Authorization: Bearer <token da sessão>  (nos dois métodos).
//
// SEGURANÇA / AUDITORIA: cada alteração deixa um registo permanente na tabela
// `admin_nivel_log` (quem alterou, o quê, quando) E dispara um EMAIL de alerta
// para ALERTA_EMAIL (deve ser um endereço DIFERENTE do login do admin, para um
// atacante que controle o email do login não conseguir apagar o aviso). Assim,
// mesmo que algo passe, fica prova e chega um aviso. As duas coisas são
// "melhor esforço": nunca fazem a alteração falhar.
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Confirma que quem pede é admin. Devolve { uid, email }, ou null. */
async function adminDoPedido(req: Request): Promise<{ uid: string; email: string } | null> {
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
    const email = String(data.user.email || "");
    const { data: u } = await supabaseAdmin.from("users").select("is_admin").eq("id", uid).maybeSingle();
    return u?.is_admin ? { uid, email } : null;
  } catch {
    return null;
  }
}

/** Nível legível a partir da linha da tabela users. */
function nivelDoRow(row: Record<string, unknown> | null | undefined): "gratis" | "pro" | "promax" {
  if (!row) return "gratis";
  if (row.is_pro_max) return "promax";
  if (row.is_pro) return "pro";
  return "gratis";
}

const ROTULO_NIVEL: Record<string, string> = { gratis: "Gratuito", pro: "Pro", promax: "Pro Max" };

function esc(v: unknown): string {
  return String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Regista a alteração na tabela de auditoria. Nunca lança. */
async function registarLog(linha: Record<string, unknown>): Promise<void> {
  if (!supabaseAdmin) return;
  try {
    await supabaseAdmin.from("admin_nivel_log").insert(linha);
  } catch {
    /* auditoria é best-effort: não pode partir a alteração */
  }
}

/** Manda um email de alerta ao fundador. Nunca lança. */
async function enviarAlerta(assunto: string, html: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.ALERTA_EMAIL || process.env.MAIL_TO || "";
  const from = process.env.MAIL_FROM || "Ippon League <support@ipponleague.com>";
  if (!apiKey || !to) return;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ from, to, subject: assunto, html }),
    });
  } catch {
    /* email é conveniência; o registo na base é a prova */
  }
}

export async function GET(req: Request) {
  if (!supabaseAdmin) return NextResponse.json({ ok: false, erro: "Servidor sem ligação." }, { status: 500 });
  const admin = await adminDoPedido(req);
  if (!admin) return NextResponse.json({ ok: false, erro: "Não autorizado." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const email = (searchParams.get("email") || "").trim().toLowerCase();

  // Procura de UMA conta (mantido por compatibilidade).
  if (email) {
    const { data: row } = await supabaseAdmin
      .from("users")
      .select("id, email, name, is_pro, is_pro_max")
      .ilike("email", email)
      .maybeSingle();
    if (!row) return NextResponse.json({ ok: true, admin: true, encontrado: false, email });
    return NextResponse.json({
      ok: true,
      admin: true,
      encontrado: true,
      email: String(row.email || email),
      nome: row.name ? String(row.name) : null,
      nivel: nivelDoRow(row as Record<string, unknown>),
    });
  }

  // LISTA de todas as contas (para o painel filtrar do lado do cliente).
  // Ordenada por email. Teto alto de segurança; a filtragem é local.
  const { data: rows } = await supabaseAdmin
    .from("users")
    .select("email, name, is_pro, is_pro_max")
    .not("email", "is", null)
    .order("email", { ascending: true })
    .limit(2000);
  const utilizadores = (rows || [])
    .map((r) => ({
      email: String((r as Record<string, unknown>).email || ""),
      nome: (r as Record<string, unknown>).name ? String((r as Record<string, unknown>).name) : null,
      nivel: nivelDoRow(r as Record<string, unknown>),
    }))
    .filter((u) => u.email);
  return NextResponse.json({ ok: true, admin: true, utilizadores });
}

export async function POST(req: Request) {
  if (!supabaseAdmin) return NextResponse.json({ ok: false, erro: "Servidor sem ligação." }, { status: 500 });
  const admin = await adminDoPedido(req);
  if (!admin) return NextResponse.json({ ok: false, erro: "Não autorizado." }, { status: 401 });

  let body: { email?: string; emails?: unknown; nivel?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, erro: "Pedido inválido." }, { status: 400 });
  }
  const nivel = String(body.nivel || "").trim();
  if (!["gratis", "pro", "promax"].includes(nivel)) {
    return NextResponse.json({ ok: false, erro: "nivel deve ser gratis, pro ou promax." }, { status: 400 });
  }
  // Escrita por objeto literal na tabela (não no metadata). Cumulativo: promax
  // implica pro.
  const novo = { is_pro: nivel !== "gratis", is_pro_max: nivel === "promax" };
  const quando = new Date().toISOString();

  // --- LOTE: { emails: [...], nivel } — mudar vários de uma vez. ---
  if (Array.isArray(body.emails)) {
    const emails = body.emails
      .map((e) => String(e || "").trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 2000);
    if (emails.length === 0) return NextResponse.json({ ok: false, erro: "Lista de emails vazia." }, { status: 400 });
    const { error } = await supabaseAdmin.from("users").update(novo).in("email", emails);
    if (error) return NextResponse.json({ ok: false, erro: "Não foi possível gravar o lote." }, { status: 500 });

    await registarLog({ quando, admin_uid: admin.uid, admin_email: admin.email, acao: "lote", para: nivel, n: emails.length, emails });
    await enviarAlerta(
      `⚠️ Ippon: ${emails.length} conta(s) → ${ROTULO_NIVEL[nivel]}`,
      `<div style="font-family:system-ui,sans-serif;font-size:14px;line-height:1.6;color:#111">
        <p><strong>Alteração de nível EM LOTE no painel de admin.</strong></p>
        <p>Admin: <strong>${esc(admin.email || admin.uid)}</strong><br>
        Contas afetadas: <strong>${emails.length}</strong><br>
        Novo nível: <strong>${esc(ROTULO_NIVEL[nivel])}</strong><br>
        Quando: ${esc(quando)}</p>
        <p style="font-size:12px;color:#666">Emails: ${esc(emails.join(", "))}</p>
        <p style="font-size:12px;color:#a00">Se não foste tu, muda a password, ativa 2FA e revê o painel imediatamente.</p>
      </div>`
    );
    return NextResponse.json({ ok: true, lote: true, contados: emails.length, nivel });
  }

  // --- UMA conta: { email, nivel } ---
  const email = String(body.email || "").trim().toLowerCase();
  if (!email) return NextResponse.json({ ok: false, erro: "Falta o email." }, { status: 400 });

  const { data: row } = await supabaseAdmin
    .from("users")
    .select("id, email, name, is_pro, is_pro_max")
    .ilike("email", email)
    .maybeSingle();
  if (!row?.id) return NextResponse.json({ ok: false, erro: "Não há conta com esse email." }, { status: 404 });

  const de = nivelDoRow(row as Record<string, unknown>);
  const { error } = await supabaseAdmin.from("users").update(novo).eq("id", row.id);
  if (error) return NextResponse.json({ ok: false, erro: "Não foi possível gravar." }, { status: 500 });

  const alvoEmail = String(row.email || email);
  await registarLog({ quando, admin_uid: admin.uid, admin_email: admin.email, acao: "um", alvo_email: alvoEmail, de, para: nivel });
  await enviarAlerta(
    `⚠️ Ippon: ${alvoEmail} → ${ROTULO_NIVEL[nivel]}`,
    `<div style="font-family:system-ui,sans-serif;font-size:14px;line-height:1.6;color:#111">
      <p><strong>Alteração de nível no painel de admin.</strong></p>
      <p>Admin: <strong>${esc(admin.email || admin.uid)}</strong><br>
      Conta: <strong>${esc(alvoEmail)}</strong><br>
      Mudança: <strong>${esc(ROTULO_NIVEL[de])}</strong> → <strong>${esc(ROTULO_NIVEL[nivel])}</strong><br>
      Quando: ${esc(quando)}</p>
      <p style="font-size:12px;color:#a00">Se não foste tu, muda a password, ativa 2FA e revê o painel imediatamente.</p>
    </div>`
  );

  return NextResponse.json({
    ok: true,
    email: alvoEmail,
    nome: row.name ? String(row.name) : null,
    nivel,
  });
}
