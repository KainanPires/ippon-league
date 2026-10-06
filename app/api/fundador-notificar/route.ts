// app/api/fundador-notificar/route.ts
//
// NOTIFICAÇÃO DE PARABÉNS DE FUNDADOR (uma vez por pessoa).
//
// Quando criámos o selo de Fundador, quisemos avisar quem já é Fundador: um
// parabéns cativante, a dizer que tem um selo exclusivo de quem chegou no início.
// Fica no sino (e vai push) e aparece quando a pessoa volta à app.
//
// SEGURO POR DEFEITO (regra pós-lançamento: teste só para o fundador):
//   • SEM parâmetro  -> envia SÓ para a tua conta (pireskainan@gmail.com). Serve
//     para veres a mensagem no teu telemóvel antes de a mandar para toda a gente.
//   • ?todos=1        -> envia para TODOS os Fundadores que ainda não receberam.
//
// IDEMPOTENTE: só manda a quem não tem já uma notificação tipo "fundador_selo".
// Re-correr é seguro (apanha novos Fundadores, nunca repete).
//
// LÍNGUA: sai na língua de cada pessoa (criarNotificacaoServidor + dicionário).
//
// SEGURANÇA: ?key= (env CRON_SECRET).
//   GET /api/fundador-notificar?key=SEGREDO            (pré-visualização, só tu)
//   GET /api/fundador-notificar?key=SEGREDO&todos=1    (envio real, a todos)
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { criarNotificacaoServidor } from "@/lib/notificacoesServidor";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const ALVO_PREVIEW = "pireskainan@gmail.com";
const TIPO = "fundador_selo";
const MAX_ENVIOS = 1000; // teto de segurança por passagem

async function uidPorEmail(email: string): Promise<string | null> {
  if (!supabaseAdmin) return null;
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data) return null;
    const u = data.users.find((x) => (x.email || "").toLowerCase() === email.toLowerCase());
    if (u) return u.id;
    if (data.users.length < 200) break;
  }
  return null;
}

export async function GET(req: Request) {
  if (!supabaseAdmin) return NextResponse.json({ ok: false, erro: "Servidor sem ligação." }, { status: 500 });
  const { searchParams } = new URL(req.url);
  const key = searchParams.get("key") || "";
  if (!process.env.CRON_SECRET || key !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, erro: "Não autorizado." }, { status: 401 });
  }
  const todos = searchParams.get("todos") === "1";

  // 1) Quem vai receber.
  let alvoIds: string[] = [];
  if (!todos) {
    // Pré-visualização: só a tua conta (mesmo que ainda não sejas Fundador na base,
    // mandamos para veres o texto; a mensagem é a mesma).
    const uid = await uidPorEmail(ALVO_PREVIEW);
    if (!uid) return NextResponse.json({ ok: false, erro: "Conta de pré-visualização não encontrada." }, { status: 404 });
    alvoIds = [uid];
  } else {
    // Todos os Fundadores (paginado).
    const ids: string[] = [];
    for (let from = 0; from < 100000; from += 1000) {
      const { data, error } = await supabaseAdmin.from("users").select("id").eq("fundador", true).range(from, from + 999);
      if (error || !data || data.length === 0) break;
      for (const r of data) ids.push(String(r.id));
      if (data.length < 1000) break;
    }
    alvoIds = ids;
  }
  if (alvoIds.length === 0) return NextResponse.json({ ok: true, enviados: 0, nada: "Sem destinatários." });

  // 2) Quem JÁ recebeu (idempotência): tira-os da lista.
  const jaRecebeu = new Set<string>();
  try {
    // Lê em lotes de ids para não puxar a tabela toda.
    for (let i = 0; i < alvoIds.length; i += 300) {
      const lote = alvoIds.slice(i, i + 300);
      const { data } = await supabaseAdmin.from("notificacoes").select("user_id").eq("tipo", TIPO).in("user_id", lote);
      for (const r of data || []) jaRecebeu.add(String(r.user_id));
    }
  } catch { /* na dúvida, segue (pode reenviar em caso raro) */ }
  const porEnviar = alvoIds.filter((id) => !jaRecebeu.has(id));

  // 3) Envia (sino + push, na língua de cada um), com teto de segurança.
  let enviados = 0;
  const erros: string[] = [];
  for (const uid of porEnviar) {
    if (enviados >= MAX_ENVIOS) break;
    try {
      await criarNotificacaoServidor({
        paraUserId: uid,
        tipo: TIPO,
        chaveTitulo: "fundadorSelo.titulo",
        chaveCorpo: "fundadorSelo.corpo",
        link: "/perfil",
      });
      enviados++;
    } catch (e) {
      erros.push(String((e as Error)?.message || e));
    }
  }

  return NextResponse.json({
    ok: true,
    modo: todos ? "todos" : "pre_visualizacao",
    alvo: alvoIds.length,
    ja_tinham: jaRecebeu.size,
    enviados,
    erros: erros.slice(0, 5),
  });
}
