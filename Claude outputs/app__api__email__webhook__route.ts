// app/api/email/webhook/route.ts
//
// OS AVISOS DO RESEND — medição do ciclo de vida de cada e-mail.
//
// O Resend chama esta rota sempre que algo acontece a um e-mail que enviámos:
// foi entregue, aberto, clicado, devolvido (bounce) ou marcado como spam. Aqui
// espelhamos isso no PostHog, cruzado pelo user_id, para se ver o funil
// "enviado -> entregue -> aberto -> clicado -> voltou a montar equipa" e saber
// que TIPO de e-mail (boas-vindas vs. reengajamento) rende mais.
//
// Configurar em: Resend -> Webhooks -> Add Endpoint
// Morada: https://www.ipponleague.com/api/email/webhook
// Eventos: email.sent, email.delivered, email.opened, email.clicked,
//          email.bounced, email.complained
// (Abrir/clicar exige "Open tracking"/"Click tracking" ligados no domínio.)
//
// ---------------------------------------------------------------------------
// A ASSINATURA É A FECHADURA (tal como no webhook da Stripe)
//
// Esta morada é pública. O Resend assina cada pedido com o padrão Svix
// (cabeçalhos svix-id / svix-timestamp / svix-signature) usando o "Signing
// Secret" do endpoint. Verificamos ANTES de ler o corpo: um pedido sem
// assinatura válida é recusado. O corpo é lido com req.text() (bytes exatos)
// porque a assinatura cobre o corpo em bruto.
//
// ---------------------------------------------------------------------------
// RESPONDER 200 QUASE SEMPRE
//
// Como na Stripe: um erro faz o Resend repetir o envio. Isto é só um espelho de
// analytics — nada financeiro — por isso um evento que não medimos, ou que não
// conseguimos associar a ninguém, devolve 200 e segue. Erro só se a assinatura
// falhar (400).
//
// ---------------------------------------------------------------------------
// PRIVACIDADE
//
// Ao PostHog vai só o user_id (pseudónimo) + o TIPO de e-mail + o id do Resend.
// O e-mail em si (morada) nunca sai daqui: quando é preciso, usamo-lo só para
// descobrir o user_id na base de dados e deitamo-lo fora.
// ---------------------------------------------------------------------------
import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { trackServer, type ServerEventName } from "@/lib/analytics.server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Tipos do Resend -> nomes da nossa taxonomia. O que não estiver aqui, ignora-se.
const MAPA: Record<string, ServerEventName> = {
  "email.sent": "email_sent",
  "email.delivered": "email_delivered",
  "email.opened": "email_opened",
  "email.clicked": "email_clicked",
  "email.bounced": "email_bounced",
  "email.complained": "email_complained",
};

/**
 * Verifica a assinatura Svix do Resend. O segredo tem o formato "whsec_<base64>";
 * o conteúdo assinado é `${svix-id}.${svix-timestamp}.${corpo}` e a assinatura é
 * o HMAC-SHA256 em base64. O cabeçalho svix-signature pode trazer várias
 * assinaturas separadas por espaço, cada uma no formato "v1,<base64>".
 */
function assinaturaValida(
  corpo: string,
  id: string | null,
  timestamp: string | null,
  cabecalho: string | null,
  segredo: string | undefined,
): boolean {
  if (!segredo || !id || !timestamp || !cabecalho) return false;
  const base = segredo.startsWith("whsec_") ? segredo.slice(6) : segredo;
  let chave: Buffer;
  try { chave = Buffer.from(base, "base64"); } catch { return false; }
  const conteudo = `${id}.${timestamp}.${corpo}`;
  const esperado = createHmac("sha256", chave).update(conteudo).digest("base64");
  const esperadoBuf = Buffer.from(esperado, "base64");
  for (const parte of cabecalho.split(" ")) {
    const virgula = parte.indexOf(",");
    const sig = virgula >= 0 ? parte.slice(virgula + 1) : parte;
    try {
      const buf = Buffer.from(sig, "base64");
      if (buf.length === esperadoBuf.length && timingSafeEqual(buf, esperadoBuf)) return true;
    } catch { /* tenta a próxima assinatura */ }
  }
  return false;
}

/** Extrai as etiquetas ({tipo, user_id}) que pomos em cada envio (lib/email.ts).
 *  Defensivo: o Resend pode devolvê-las como lista [{name,value}] ou como objeto. */
function lerEtiquetas(data: Record<string, unknown>): { tipo?: string; userId?: string } {
  const t = (data as { tags?: unknown }).tags;
  const mapa: Record<string, string> = {};
  if (Array.isArray(t)) {
    for (const it of t) {
      const o = it as { name?: unknown; value?: unknown };
      if (o && o.name != null) mapa[String(o.name)] = String(o.value ?? "");
    }
  } else if (t && typeof t === "object") {
    for (const [k, v] of Object.entries(t as Record<string, unknown>)) mapa[k] = String(v ?? "");
  }
  return { tipo: mapa.tipo, userId: mapa.user_id };
}

/** Fallback: descobre o user_id pela morada de e-mail (só se as etiquetas não
 *  trouxerem o user_id). O e-mail é usado e descartado; nunca vai para o analytics. */
async function acharPorEmail(to: unknown): Promise<string | null> {
  if (!supabaseAdmin) return null;
  const email = Array.isArray(to) ? to[0] : to;
  if (!email) return null;
  const { data } = await supabaseAdmin
    .from("users").select("id").eq("email", String(email)).maybeSingle();
  return data?.id ? String(data.id) : null;
}

export async function POST(req: Request) {
  const corpo = await req.text();
  const valida = assinaturaValida(
    corpo,
    req.headers.get("svix-id"),
    req.headers.get("svix-timestamp"),
    req.headers.get("svix-signature"),
    process.env.RESEND_WEBHOOK_SECRET,
  );
  if (!valida) {
    return NextResponse.json({ erro: "Assinatura inválida." }, { status: 400 });
  }

  let evento: { type?: string; data?: Record<string, unknown> };
  try {
    evento = JSON.parse(corpo);
  } catch {
    return NextResponse.json({ erro: "Corpo ilegível." }, { status: 400 });
  }

  const nome = MAPA[String(evento.type || "")];
  // Tipo que não medimos (ex.: email.delivery_delayed) — 200 e segue.
  if (!nome) return NextResponse.json({ recebido: true });

  const data = evento.data || {};
  const { tipo, userId } = lerEtiquetas(data);
  let uid = userId || null;
  if (!uid) uid = await acharPorEmail((data as { to?: unknown }).to);
  // Sem ninguém a quem associar (ex.: e-mail de teste, morada apagada) — ignora.
  if (!uid) return NextResponse.json({ recebido: true });

  try {
    await trackServer(uid, nome, {
      tipo: tipo || "desconhecido",
      email_id: String((data as { email_id?: unknown }).email_id ?? ""),
    });
  } catch { /* o analytics nunca rebenta o webhook */ }

  return NextResponse.json({ recebido: true });
}
