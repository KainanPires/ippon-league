// app/api/alerta-indisponivel/route.ts
//
// RECONCILIAR O MERCADO COM A CHAVE + AVISAR QUEM FICOU COM ATLETA DE FORA.
// Chamado por um cron externo (cron-job.org) a cada 1-3 min. Leve: fora de
// competição sai logo.
//
// REGRA (verdade = a CHAVE oficial):
//   Quem estava no mercado mas NÃO entrou na chave de uma categoria JÁ sorteada
//   (= desistiu / não competiu) é REMOVIDO do mercado. Categorias ainda SEM
//   chave ficam intactas. É essa remoção que faz a app marcar "indisponível" e
//   que dispara o push a quem escalou esse atleta.
//
// DEPOIS da reconciliação: avisa, UMA vez por utilizador e competição, quem tem
// na equipa um atleta que já não está no mercado — para ir rever/substituir.
//
// Fontes: chave_atletas (molduras/pools) = verdade; atletas_cache = mercado;
// equipas = quem escalou. Anti-duplicado = alertas_enviados (insere-primeiro, só
// envia se o INSERT foi novo). Push + sino via criarNotificacaoServidor.
//
// ENSAIO: ?seco=1 -> mostra o que REMOVERIA do mercado e QUEM avisaria, sem
// tocar em nada (nem remove, nem envia, nem marca avisados).
//
// Proteção: ?key=<CRON_SECRET ou LEMBRETE_CRON_SECRET>. Sem isso, 401.
import { NextResponse } from "next/server";
import { focoMercado, nomeCompeticao } from "@/lib/calendario";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { criarNotificacaoServidor } from "@/lib/notificacoesServidor";
import { linguasDeVarios } from "@/lib/i18nServidor";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const POOLS = ["A", "B", "C", "D"] as const;
// Normaliza a categoria para casar "-60", "-60 kg", "-60kg" -> "-60".
const normCat = (c: unknown) => String(c || "").toLowerCase().replace(/kg/g, "").replace(/\s+/g, "").trim();

function autorizado(key: string | null): boolean {
  const a = process.env.CRON_SECRET;
  const b = process.env.LEMBRETE_CRON_SECRET;
  if (!key) return false;
  return (!!a && key === a) || (!!b && key === b);
}

// Mensagem localizada. O produto tem 7 línguas (pt/en/es/fr/de/ja/ru); aqui
// cobrimos as 5 principais e ja/ru caem em "pt" pelo fallback abaixo. n = nº de
// atletas que saíram.
const TXT: Record<string, { titulo: string; corpo: (n: number) => string }> = {
  pt: {
    titulo: "A tua equipa precisa de ti 🥋",
    corpo: (n) => n > 1
      ? `${n} dos teus atletas saíram da competição e não vão pontuar. Entra e substitui-os enquanto a categoria não começa.`
      : "Um atleta teu saiu da competição e não vai pontuar. Entra e substitui-o enquanto a categoria não começa.",
  },
  en: {
    titulo: "Your team needs you 🥋",
    corpo: (n) => n > 1
      ? `${n} of your athletes withdrew from the competition and won't score. Jump in and replace them before their category starts.`
      : "One of your athletes withdrew from the competition and won't score. Jump in and replace them before their category starts.",
  },
  es: {
    titulo: "Tu equipo te necesita 🥋",
    corpo: (n) => n > 1
      ? `${n} de tus atletas se retiraron de la competición y no puntuarán. Entra y sustitúyelos antes de que empiece su categoría.`
      : "Uno de tus atletas se retiró de la competición y no puntuará. Entra y sustitúyelo antes de que empiece su categoría.",
  },
  fr: {
    titulo: "Ton équipe a besoin de toi 🥋",
    corpo: (n) => n > 1
      ? `${n} de tes athlètes se sont retirés de la compétition et ne marqueront pas. Connecte-toi et remplace-les avant le début de leur catégorie.`
      : "Un de tes athlètes s'est retiré de la compétition et ne marquera pas. Connecte-toi et remplace-le avant le début de sa catégorie.",
  },
  de: {
    titulo: "Dein Team braucht dich 🥋",
    corpo: (n) => n > 1
      ? `${n} deiner Athleten haben sich vom Wettkampf zurückgezogen und punkten nicht. Geh rein und ersetze sie, bevor ihre Kategorie beginnt.`
      : "Einer deiner Athleten hat sich vom Wettkampf zurückgezogen und punktet nicht. Geh rein und ersetze ihn, bevor seine Kategorie beginnt.",
  },
};

export async function GET(req: Request) {
  const t0 = Date.now();
  if (!supabaseAdmin) return NextResponse.json({ ok: false, erro: "Servidor sem ligação." }, { status: 500 });
  const { searchParams } = new URL(req.url);
  if (!autorizado(searchParams.get("key"))) {
    return NextResponse.json({ ok: false, erro: "Não autorizado." }, { status: 401 });
  }
  // ?seco=1 => ENSAIO: não remove, não envia, não marca avisados.
  const seco = searchParams.get("seco") === "1";

  // 1) Só age se houver competição a decorrer (mercado fechado). Fora disso, ~0 custo.
  const foco = focoMercado();
  const aDecorrer = foco.aDecorrer;
  if (!aDecorrer) {
    return NextResponse.json({ ok: true, a_decorrer: null, enviados: 0, ms: Date.now() - t0 });
  }
  const comp = String(aDecorrer.idCompeticao);
  const nomeComp = nomeCompeticao(aDecorrer);

  // 2) CHAVE = verdade. Todas as categorias com moldura; união dos pools = quem
  //    REALMENTE compete. Também guardamos QUE categorias já têm chave.
  const { data: chaves } = await supabaseAdmin
    .from("chave_atletas").select("weight_category, pools").eq("id_competicao", comp);
  const linhasChave = chaves || [];
  if (linhasChave.length === 0) {
    return NextResponse.json({ ok: true, a_decorrer: nomeComp, chave: "por sair", enviados: 0, ms: Date.now() - t0 });
  }
  const catsComChave = new Set<string>();
  const naChave = new Set<string>();
  for (const row of linhasChave) {
    catsComChave.add(normCat((row as { weight_category?: unknown }).weight_category));
    const pools = ((row as { pools?: unknown }).pools && typeof (row as { pools?: unknown }).pools === "object")
      ? (row as { pools: Record<string, unknown> }).pools : {};
    for (const p of POOLS) {
      const arr = Array.isArray(pools[p]) ? (pools[p] as unknown[]) : [];
      for (const id of arr) naChave.add(String(id));
    }
  }

  // 3) Mercado atual (atletas_cache).
  const { data: cacheRow } = await supabaseAdmin
    .from("atletas_cache").select("atletas").eq("id_competition", comp).maybeSingle();
  const lista = Array.isArray(cacheRow?.atletas) ? (cacheRow!.atletas as Array<Record<string, unknown>>) : [];
  // Guarda de segurança: sem mercado carregado, não fazemos nada (evita apagar
  // tudo ou avisar em massa por causa de um tick em que o cache veio vazio).
  if (lista.length === 0) {
    return NextResponse.json({ ok: true, a_decorrer: nomeComp, erro: "cache vazio", enviados: 0, ms: Date.now() - t0 });
  }

  // 4) RECONCILIAÇÃO: remove do mercado quem, numa categoria JÁ com chave, não
  //    está na chave. (Falha em segurança: categoria sem chave, ou categoria do
  //    mercado que não casa com nenhuma com chave -> mantém-se.)
  const remover: Array<{ id: string; name: string; cat: string }> = [];
  const mantidos: Array<Record<string, unknown>> = [];
  for (const a of lista) {
    const id = a?.id != null ? String(a.id) : "";
    const cat = normCat(a?.category);
    const foraDaChave = !!id && catsComChave.has(cat) && !naChave.has(id);
    if (foraDaChave) remover.push({ id, name: String(a?.name || "?"), cat });
    else mantidos.push(a);
  }
  const inscritos = new Set(mantidos.map((a) => String(a?.id)));

  // 5) Grava o mercado reconciliado (fora do ensaio).
  if (!seco && remover.length > 0) {
    try {
      await supabaseAdmin.from("atletas_cache").upsert(
        { id_competition: comp, atletas: mantidos, total: mantidos.length, atualizado_em: new Date().toISOString() },
        { onConflict: "id_competition" }
      );
    } catch { /* se a gravação falhar, segue só com a deteção em memória */ }
  }

  // 6) Equipas afetadas: têm na equipa alguém que já NÃO está no mercado reconciliado.
  const { data: equipas } = await supabaseAdmin
    .from("equipas").select("user_id, atletas").eq("id_competicao", comp);
  const todas = equipas || [];
  const afetados: { user_id: string; n: number }[] = [];
  for (const e of todas) {
    const ids = Array.isArray(e.atletas) ? (e.atletas as unknown[]).map(String) : [];
    if (ids.length === 0) continue;
    const fora = ids.filter((i) => !inscritos.has(i));
    if (fora.length > 0) afetados.push({ user_id: String(e.user_id), n: fora.length });
  }

  // ENSAIO: mostra o que removeria e quem avisaria, sem tocar em nada.
  if (seco) {
    return NextResponse.json({
      ok: true, modo: "ensaio", a_decorrer: nomeComp,
      categorias_com_chave: catsComChave.size,
      remover_do_mercado: remover.length, remover_amostra: remover.slice(0, 25),
      afetados: afetados.length, afetados_amostra: afetados.slice(0, 10),
      total_equipas: todas.length, ms: Date.now() - t0,
    });
  }

  if (afetados.length === 0) {
    return NextResponse.json({ ok: true, a_decorrer: nomeComp, removidos: remover.length, afetados: 0, enviados: 0, ms: Date.now() - t0 });
  }

  // 7) Línguas dos afetados + envio (uma vez por user+comp; insere-primeiro).
  const ids = afetados.map((a) => a.user_id);
  const langs = await linguasDeVarios(ids);
  let enviados = 0;
  for (const a of afetados) {
    const id_fight = `indisp::${comp}`;
    let inseriu = false;
    try {
      const { error } = await supabaseAdmin
        .from("alertas_enviados")
        .insert({ user_id: a.user_id, id_fight, tipo: "atleta_indisponivel" });
      inseriu = !error;
    } catch { inseriu = false; }
    if (!inseriu) continue;
    try {
      const T = TXT[langs[a.user_id] ?? "pt"] ?? TXT.pt;
      await criarNotificacaoServidor({
        paraUserId: a.user_id,
        tipo: "atleta_indisponivel",
        titulo: T.titulo,
        corpo: T.corpo(a.n),
        link: "/substituir",
      });
      enviados++;
    } catch { /* push de um não bloqueia os outros */ }
  }

  return NextResponse.json({
    ok: true,
    a_decorrer: nomeComp,
    removidos: remover.length,
    afetados: afetados.length,
    enviados,
    ms: Date.now() - t0,
  });
}
