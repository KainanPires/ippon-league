// app/api/favoritos-notificar/route.ts
//
// NOTIFICAÇÃO DO ATLETA FAVORITO (benefício Pro Max).
//
// Quando um atleta que o utilizador marcou como FAVORITO luta numa competição a
// decorrer, enviamos um push: "o teu favorito venceu / perdeu". É uma das
// promessas do Ippon Pro Max — por isso SÓ utilizadores Pro Max recebem.
//
// COMO FUNCIONA (sem bater outra vez no JudoBase):
//   • O `chave-maestro` já mantém a tabela `resultados_atletas` fresca de minuto
//     a minuto, com vitórias/derrotas e o nº de lutas de cada atleta na
//     competição ao vivo. Esta rota LÊ daí — é rápido e não gasta chamadas à API.
//   • Guardamos, por (user, atleta, comp), quantas lutas já tínhamos visto
//     (tabela `favoritos_notif_estado`). Se o nº subiu, o atleta lutou de novo
//     -> mandamos UM push sobre a última luta.
//
// ANTI-SPAM (importante):
//   • Na PRIMEIRA vez que vemos um par (user, atleta) só gravamos o número atual
//     (seed), SEM notificar. Assim ninguém recebe avisos de lutas anteriores a
//     ter favoritado, nem na primeira vez que isto corre.
//   • Idempotente: cada luta nova gera no máximo um push por utilizador.
//
// LÍNGUA: o texto sai na língua de cada utilizador (agruparPorLingua + renderNotif),
// igual às notificações de mercado.
//
// SEGURANÇA: ?key= (env CHAVE_CRON_KEY), igual ao chave-maestro/chave-viva.
// Uso no cron-job.org (de minuto a minuto, durante o evento):
//   GET /api/favoritos-notificar?key=SEGREDO&comp=3151
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { enviarPushPara } from "@/lib/pushServer";
import { renderNotif, agruparPorLingua, type LinguaNotif } from "@/lib/i18nServidor";
import { CALENDARIO_2026, competicaoRollingAtiva, focoMercado } from "@/lib/calendario";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// Teto de segurança de envios por passagem (a base é pequena; o cron corre
// muitas vezes, por isso se sobrar fica para a próxima volta).
const MAX_ENVIOS = 800;

type LutaDL = { adv?: string; venceu?: boolean };
interface Resultado {
  id_person: string;
  nome: string | null;
  weight_category: string | null;
  vitorias: number;
  derrotas: number;
  n_lutas: number;
  lutas: LutaDL[];
}

export async function GET(req: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ ok: false, erro: "Servidor sem ligação." }, { status: 500 });
  }
  const { searchParams } = new URL(req.url);
  const key = searchParams.get("key") || "";
  if (!process.env.CHAVE_CRON_KEY || key !== process.env.CHAVE_CRON_KEY) {
    return NextResponse.json({ ok: false, erro: "Não autorizado." }, { status: 401 });
  }

  // Competição: ?comp= (recomendado no rolling) ou a que está a decorrer.
  let comp = (searchParams.get("comp") || "").trim();
  if (!comp) {
    try { comp = String(competicaoRollingAtiva()?.idCompeticao || ""); } catch {}
  }
  if (!comp) {
    try { comp = String(focoMercado()?.aDecorrer?.idCompeticao || ""); } catch {}
  }
  if (!comp) {
    return NextResponse.json({ ok: true, comp: null, nada: "Nenhuma competição a decorrer." });
  }
  const nomeComp = CALENDARIO_2026.find((c) => c.idCompeticao === comp)?.nome || `Competição ${comp}`;

  // 1) Favoritos (global, por atleta). Base pequena.
  const { data: favRows } = await supabaseAdmin
    .from("atletas_favoritos")
    .select("user_id, id_person");
  const favs = (favRows || []).map((r) => ({ user_id: String(r.user_id), id_person: String(r.id_person) }))
    .filter((r) => r.user_id && r.id_person);
  if (favs.length === 0) {
    return NextResponse.json({ ok: true, comp, nada: "Sem favoritos.", enviados: 0 });
  }

  // 2) Só utilizadores Pro Max (é um benefício Pro Max). Filtramos no PRÓPRIO
  // SELECT (.eq("is_pro_max", true)) e só recolhemos os ids — não lemos o nível
  // como propriedade em JS (consulta a `users`, que é a fonte de verdade).
  const userIds = [...new Set(favs.map((f) => f.user_id))];
  const promax = new Set<string>();
  for (let i = 0; i < userIds.length; i += 300) {
    const lote = userIds.slice(i, i + 300);
    const { data: us } = await supabaseAdmin.from("users").select("id").eq("is_pro_max", true).in("id", lote);
    for (const u of us || []) promax.add(String(u.id));
  }
  const favsPro = favs.filter((f) => promax.has(f.user_id));
  if (favsPro.length === 0) {
    return NextResponse.json({ ok: true, comp, nada: "Sem favoritos de utilizadores Pro Max.", enviados: 0 });
  }

  // Atletas favoritados (por Pro Max) e quem os favoritou.
  const favsByAtleta = new Map<string, string[]>();
  for (const f of favsPro) {
    const arr = favsByAtleta.get(f.id_person) || [];
    arr.push(f.user_id);
    favsByAtleta.set(f.id_person, arr);
  }
  const atletaIds = [...favsByAtleta.keys()];

  // 3) Resultados AO VIVO destes atletas nesta competição (os que o maestro já gravou).
  const resultadoDe = new Map<string, Resultado>();
  for (let i = 0; i < atletaIds.length; i += 200) {
    const lote = atletaIds.slice(i, i + 200);
    const { data: rs } = await supabaseAdmin
      .from("resultados_atletas")
      .select("id_person, nome, weight_category, vitorias, derrotas, n_lutas, lutas")
      .eq("id_competicao", comp)
      .in("id_person", lote);
    for (const r of rs || []) {
      resultadoDe.set(String(r.id_person), {
        id_person: String(r.id_person),
        nome: (r.nome as string | null) ?? null,
        weight_category: (r.weight_category as string | null) ?? null,
        vitorias: Number(r.vitorias) || 0,
        derrotas: Number(r.derrotas) || 0,
        n_lutas: Number(r.n_lutas) || 0,
        lutas: Array.isArray(r.lutas) ? (r.lutas as LutaDL[]) : [],
      });
    }
  }

  // 4) Estado anterior (quantas lutas já tínhamos visto por user+atleta).
  const estado = new Map<string, number>(); // chave `${user}|${person}` -> ultimas_lutas
  {
    const { data: est } = await supabaseAdmin
      .from("favoritos_notif_estado")
      .select("user_id, id_person, ultimas_lutas")
      .eq("id_competicao", comp)
      .in("id_person", atletaIds);
    for (const e of est || []) estado.set(`${e.user_id}|${e.id_person}`, Number(e.ultimas_lutas) || 0);
  }

  // 5) Decide, por atleta, quem notificar (e quem apenas semear).
  const agora = new Date().toISOString();
  const upserts: { user_id: string; id_person: string; id_competicao: string; ultimas_lutas: number; atualizado_em: string }[] = [];
  // Agrupa por atleta -> conjunto de users a notificar (todos recebem o MESMO texto desse atleta).
  const notificar: { atleta: Resultado; users: string[] }[] = [];

  for (const [atletaId, users] of favsByAtleta) {
    const r = resultadoDe.get(atletaId);
    const nAtual = r ? r.n_lutas : 0;
    const paraNotificar: string[] = [];
    for (const uid of users) {
      const chave = `${uid}|${atletaId}`;
      const prev = estado.get(chave);
      if (prev === undefined) {
        // Primeira vez que vemos este par: SEED, sem notificar.
        upserts.push({ user_id: uid, id_person: atletaId, id_competicao: comp, ultimas_lutas: nAtual, atualizado_em: agora });
      } else if (nAtual > prev) {
        // O atleta lutou de novo desde a última vez -> notificar + atualizar.
        paraNotificar.push(uid);
        upserts.push({ user_id: uid, id_person: atletaId, id_competicao: comp, ultimas_lutas: nAtual, atualizado_em: agora });
      }
      // nAtual === prev (ou menor, impossível): nada a fazer.
    }
    if (r && paraNotificar.length > 0) notificar.push({ atleta: r, users: paraNotificar });
  }

  // 6) Envia, por atleta, agrupando os destinatários por língua.
  let enviados = 0;
  const errosEnvio: string[] = [];
  for (const { atleta, users } of notificar) {
    if (enviados >= MAX_ENVIOS) break;
    const venceu = atleta.lutas.length > 0 ? atleta.lutas[atleta.lutas.length - 1].venceu === true : true;
    const nome = (atleta.nome || "").trim() || "O teu favorito";
    const placar = `${atleta.vitorias}-${atleta.derrotas}`;
    const vars = { nome, comp: nomeComp, placar };
    const link = `/chave-atletas?comp=${encodeURIComponent(comp)}${atleta.weight_category ? `&cat=${encodeURIComponent(atleta.weight_category)}` : ""}`;
    const chaveTitulo = venceu ? "favorito.venceuTitulo" : "favorito.perdeuTitulo";
    const chaveCorpo = venceu ? "favorito.venceuCorpo" : "favorito.perdeuCorpo";

    let grupos: Record<string, string[]> = {};
    try { grupos = await agruparPorLingua(users); } catch { grupos = { pt: users }; }
    for (const [lg, gids] of Object.entries(grupos)) {
      if (!gids.length) continue;
      const titulo = renderNotif(lg as LinguaNotif, chaveTitulo, vars);
      const corpo = renderNotif(lg as LinguaNotif, chaveCorpo, vars);
      try {
        await supabaseAdmin.from("notificacoes").insert(
          gids.map((user_id) => ({ user_id, tipo: "favorito", titulo, corpo, link }))
        );
      } catch (e) { errosEnvio.push("sino:" + String((e as Error)?.message || e)); }
      try {
        await enviarPushPara(gids, { titulo, corpo, link });
        enviados += gids.length;
      } catch (e) { errosEnvio.push("push:" + String((e as Error)?.message || e)); }
    }
  }

  // 7) Grava o estado (seeds + avanços) num upsert.
  if (upserts.length > 0) {
    try {
      await supabaseAdmin.from("favoritos_notif_estado").upsert(upserts, { onConflict: "user_id,id_person,id_competicao" });
    } catch (e) { errosEnvio.push("estado:" + String((e as Error)?.message || e)); }
  }

  return NextResponse.json({
    ok: true,
    comp,
    favoritos_pro: favsPro.length,
    atletas: atletaIds.length,
    com_resultado: resultadoDe.size,
    estado_gravado: upserts.length,       // seeds + avanços
    notificacoes_enviadas: enviados,
    erros: errosEnvio.slice(0, 5),
    atualizado_em: agora,
  });
}
