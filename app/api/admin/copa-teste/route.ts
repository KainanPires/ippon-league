// app/api/admin/copa-teste/route.ts
//
// FERRAMENTA DE TESTE (so admin): monta uma COPA IPPON completa, do inicio ao
// fim, usando as contas Pro que ja existem - para podermos VER o mata-mata a
// funcionar de ponta a ponta sem esperar por uma epoca inteira de competicoes.
//
// PORQUE ISTO EXISTE
// Uma copa a serio prende cada ronda a uma competicao real do calendario, e so
// competicoes com dados congelados dao pontos. Hoje so tres classicos tem lutas
// reais no JudoBase e chaveiam-se em seguida:
//   1601 (Osaka 2018) -> 1598 (Haia 2018) -> 1746 (Montreal 2019)
// Como o mercado dessas competicoes ja nao abre, ninguem consegue montar equipa
// para elas pela app - por isso nao ha maneira de encher uma copa a mao. Esta
// rota faz esse trabalho: escolhe os participantes, monta-lhes uma equipa valida
// em cada classico, cria a liga da copa e faz o sorteio. A partir dai e so
// congelar os classicos e apurar (ver os passos no fim).
//
// O QUE ESCREVE (em tabelas reais, mas SO nisto):
//   - leagues        - uma liga nova "COPA TESTE" (formato copa, privada)
//   - league_members - as contas Pro escolhidas como membros dessa liga
//   - copa_confrontos - a chave sorteada dessa liga
//   - equipas        - uma equipa por conta Pro em cada classico da chave,
//                      MAS so quando essa conta ainda nao tem equipa nesse
//                      classico (nunca sobrescreve uma equipa ja guardada).
// Nao toca em nenhuma conta que nao seja Pro, nem em nenhuma outra liga.
//
// SEGURANCA: so admin. Confirma a identidade pelo token (Authorization: Bearer)
// e exige users.is_admin - o mesmo portao do /api/admin/nivel. O corpo nao traz
// nivel nenhum: os participantes saem da tabela users (is_pro=true).
//
// Endpoints:
//   GET  /api/admin/copa-teste   -> pre-visualizacao (no de Pros, liga ja criada)
//   POST /api/admin/copa-teste   { max?, recriar? }
//
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  gerarPrimeiraRonda,
  competicaoPorId,
  idCompeticaoSeguinte,
  tamanhoChave,
  numeroDeRondas,
} from "@/lib/copa";
import { estadoMercado } from "@/lib/calendario";
import type { Athlete } from "@/lib/athletes";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// A competicao de arranque da chave. As seguintes derivam-se do calendario
// (idCompeticaoSeguinte), exatamente como o /api/copa/apurar as vai buscar - por
// isso as equipas que montamos ficam sempre na competicao certa de cada ronda.
const COMP_INICIAL = "1601"; // Osaka 2018 (classico com dados reais)

// Teto de participantes. Com 3 classicos disponiveis a chave tem no maximo 3
// rondas, o que da para 8 jogadores (quartos -> meias -> final). Acima disso a 4a
// ronda precisaria de uma competicao que ainda nao tem dados. E um TESTE - 8
// chega para exercitar byes, repescagem, dois bronzes e a final acumulada.
const MAX_PARTICIPANTES = 8;

const NOME_LIGA = "COPA TESTE";

// ---------------------------------------------------------------------------
// AUTORIZACAO - so admin (igual ao /api/admin/nivel).
// ---------------------------------------------------------------------------
async function adminDoPedido(req: Request): Promise<{ uid: string } | null> {
  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
    if (!token) return null;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const pub = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
    if (!url || !pub || !supabaseAdmin) return null;
    const sb = createClient(url, pub, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await sb.auth.getUser();
    const uid = data?.user?.id;
    if (error || !uid) return null;
    const { data: row } = await supabaseAdmin
      .from("users")
      .select("is_admin")
      .eq("id", uid)
      .maybeSingle();
    return row?.is_admin ? { uid } : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// ALEATORIO DETERMINISTICO - para cada (conta, competicao) sair uma equipa
// diferente mas estavel. Assim as pontuacoes variam entre jogadores (senao os
// confrontos empatavam todos e iam parar ao sorteio), e correr a rota outra vez
// da a mesma equipa (nada de baguncar dados a cada clique).
// ---------------------------------------------------------------------------
function semente(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function baralhar<T>(lista: T[], rnd: () => number): T[] {
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------------------------------------------------------------------------
// MONTAR UMA EQUIPA VALIDA - 4 masculinos + 4 femininos, cada um de uma
// categoria de peso diferente, dentro de 100 JC. E a mesma regra que o Mercado
// impoe a quem monta a mao. Se o plantel do classico nao tiver as 8 categorias,
// cai para "8 atletas distintos mais baratos" - o motor da copa nao revalida a
// equipa, mas queremos dados realistas.
// ---------------------------------------------------------------------------
interface EquipaMontada {
  atletas: string[];
  capitao: string;
  precos: Record<string, number>;
}

function montarEquipa(cache: Athlete[], rnd: () => number): EquipaMontada | null {
  const validos = cache.filter((a) => a && a.id && (a.gender === "M" || a.gender === "F"));
  if (validos.length < 8) return null;

  const escolhePorGenero = (genero: "M" | "F"): Athlete[] => {
    const doGenero = validos.filter((a) => a.gender === genero);
    // Agrupa por categoria e baralha as categorias e os atletas dentro de cada.
    const porCat = new Map<string, Athlete[]>();
    for (const a of doGenero) {
      const cat = String(a.category || "").trim() || "-";
      if (!porCat.has(cat)) porCat.set(cat, []);
      porCat.get(cat)!.push(a);
    }
    const cats = baralhar(Array.from(porCat.keys()), rnd);
    const escolhidos: Athlete[] = [];
    for (const cat of cats) {
      if (escolhidos.length >= 4) break;
      const opts = baralhar(porCat.get(cat)!, rnd);
      escolhidos.push(opts[0]);
    }
    return escolhidos;
  };

  let pick = [...escolhePorGenero("M"), ...escolhePorGenero("F")];

  // Se nao deu 8 (categorias a menos num genero), completa com os mais baratos
  // que ainda nao estao na equipa - mantendo ids distintos.
  if (pick.length < 8) {
    const dentro = new Set(pick.map((a) => a.id));
    const resto = validos
      .filter((a) => !dentro.has(a.id))
      .sort((x, y) => (x.priceJc || 0) - (y.priceJc || 0));
    for (const a of resto) {
      if (pick.length >= 8) break;
      pick.push(a);
      dentro.add(a.id);
    }
  }
  if (pick.length < 8) return null;
  pick = pick.slice(0, 8);

  // ORCAMENTO: se passar de 100 JC, troca o mais caro pelo atleta mais barato
  // disponivel na mesma categoria e genero que ainda nao esteja na equipa.
  const soma = (t: Athlete[]) => t.reduce((s, a) => s + (a.priceJc || 0), 0);
  let tentativas = 0;
  while (soma(pick) > 100 && tentativas < 40) {
    tentativas++;
    // O mais caro da equipa.
    let idxCaro = 0;
    for (let i = 1; i < pick.length; i++) {
      if ((pick[i].priceJc || 0) > (pick[idxCaro].priceJc || 0)) idxCaro = i;
    }
    const caro = pick[idxCaro];
    const idsAtuais = new Set(pick.map((a) => a.id));
    const substituto = validos
      .filter(
        (a) =>
          a.gender === caro.gender &&
          String(a.category) === String(caro.category) &&
          !idsAtuais.has(a.id) &&
          (a.priceJc || 0) < (caro.priceJc || 0)
      )
      .sort((x, y) => (x.priceJc || 0) - (y.priceJc || 0))[0];
    if (!substituto) break; // nao ha por onde baixar - deixa como esta
    pick[idxCaro] = substituto;
  }

  const atletas = pick.map((a) => String(a.id));
  const precos: Record<string, number> = {};
  for (const a of pick) precos[String(a.id)] = a.priceJc || 0;
  const capitao = atletas[Math.floor(rnd() * atletas.length)];
  return { atletas, capitao, precos };
}

// Le o plantel (atletas_cache) de uma competicao.
async function lerCache(comp: string): Promise<Athlete[]> {
  if (!supabaseAdmin) return [];
  const { data } = await supabaseAdmin
    .from("atletas_cache")
    .select("atletas")
    .eq("id_competition", comp)
    .maybeSingle();
  return Array.isArray(data?.atletas) ? (data!.atletas as Athlete[]) : [];
}

// As competicoes que a chave vai usar, por ordem de ronda: 1601 e as seguintes
// do calendario, tantas quantas as rondas. Para alem de derivar, confirma que
// cada uma existe no calendario.
function compsDaChave(n: number): { comps: string[]; erro?: string } {
  if (!competicaoPorId(COMP_INICIAL)) {
    return { comps: [], erro: `A competicao inicial ${COMP_INICIAL} nao esta no calendario.` };
  }
  const rondas = numeroDeRondas(tamanhoChave(n));
  const comps: string[] = [COMP_INICIAL];
  for (let i = 1; i < rondas; i++) {
    const seg = idCompeticaoSeguinte(comps[i - 1]);
    if (!seg) return { comps, erro: `Nao ha competicao seguinte depois de ${comps[i - 1]} no calendario.` };
    comps.push(seg);
  }
  return { comps };
}

// ---------------------------------------------------------------------------
// GET - pre-visualizacao (nao escreve nada).
// ---------------------------------------------------------------------------
export async function GET(req: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ ok: false, erro: "Servidor sem ligacao." }, { status: 500 });
  }
  const admin = await adminDoPedido(req);
  if (!admin) return NextResponse.json({ ok: false, erro: "Nao autorizado." }, { status: 401 });

  // ESPREITAR (so-leitura): ?debug=confrontos devolve a chave gravada da ultima
  // COPA TESTE (mesmo terminada) - ronda, ordem, fase, metade e quem lutou. E o
  // que precisamos para ver se a repescagem chegou a ser criada e se a `metade`
  // ficou gravada nos quartos.
  const debug = (new URL(req.url).searchParams.get("debug") || "").trim();
  if (debug === "confrontos") {
    const { data: ligaQualquer } = await supabaseAdmin
      .from("leagues")
      .select("id, invite_code, copa_estado")
      .eq("name", NOME_LIGA)
      .eq("formato", "copa")
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!ligaQualquer) {
      return NextResponse.json({ ok: true, semLiga: true, nota: "Nao ha nenhuma COPA TESTE ainda." });
    }
    const { data: confrontos } = await supabaseAdmin
      .from("copa_confrontos")
      .select("ronda, ordem, fase, metade, jogador_a, jogador_b, vencedor, decidido_por, estado, id_competicao")
      .eq("league_id", ligaQualquer.id)
      .order("ronda", { ascending: true })
      .order("ordem", { ascending: true });
    // Resumo por ronda: quantos de cada fase e quantos tem metade definida.
    const porRonda: Record<string, { total: number; fases: Record<string, number>; comMetade: number }> = {};
    for (const c of confrontos || []) {
      const r = String(c.ronda);
      if (!porRonda[r]) porRonda[r] = { total: 0, fases: {}, comMetade: 0 };
      porRonda[r].total++;
      const f = String(c.fase || "?");
      porRonda[r].fases[f] = (porRonda[r].fases[f] || 0) + 1;
      if (c.metade === "cima" || c.metade === "baixo") porRonda[r].comMetade++;
    }
    return NextResponse.json({
      ok: true,
      league_id: ligaQualquer.id,
      invite_code: ligaQualquer.invite_code,
      copa_estado: ligaQualquer.copa_estado,
      resumo_por_ronda: porRonda,
      confrontos: confrontos || [],
    });
  }

  const { data: pros } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("is_pro", true);
  const totalPros = (pros || []).length;
  const usados = Math.min(totalPros, MAX_PARTICIPANTES);

  const { data: existente } = await supabaseAdmin
    .from("leagues")
    .select("id, name, invite_code, copa_estado, formato")
    .eq("name", NOME_LIGA)
    .eq("formato", "copa")
    .neq("copa_estado", "terminada")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { comps } = compsDaChave(usados);
  return NextResponse.json({
    ok: true,
    total_pros: totalPros,
    participantes_no_teste: usados,
    max: MAX_PARTICIPANTES,
    comps_da_chave: comps,
    ligaExistente: existente
      ? { id: existente.id, invite_code: existente.invite_code, copa_estado: existente.copa_estado }
      : null,
  });
}

// ---------------------------------------------------------------------------
// POST - cria a copa de teste do zero.
// ---------------------------------------------------------------------------
export async function POST(req: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ ok: false, erro: "Servidor sem ligacao." }, { status: 500 });
  }
  const admin = await adminDoPedido(req);
  if (!admin) return NextResponse.json({ ok: false, erro: "Nao autorizado." }, { status: 401 });

  let corpo: { max?: number; recriar?: boolean } = {};
  try {
    corpo = await req.json();
  } catch {
    corpo = {};
  }
  const recriar = corpo.recriar === true;
  const maxPedido = Number(corpo.max);
  const teto =
    Number.isFinite(maxPedido) && maxPedido > 0
      ? Math.min(Math.floor(maxPedido), MAX_PARTICIPANTES)
      : MAX_PARTICIPANTES;

  // Ja existe uma COPA TESTE por terminar? Nao duplicamos sem pedirem.
  if (!recriar) {
    const { data: existente } = await supabaseAdmin
      .from("leagues")
      .select("id, invite_code, copa_estado")
      .eq("name", NOME_LIGA)
      .eq("formato", "copa")
      .neq("copa_estado", "terminada")
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existente) {
      return NextResponse.json({
        ok: true,
        jaExistia: true,
        league_id: existente.id,
        invite_code: existente.invite_code,
        copa_estado: existente.copa_estado,
        nota: "Ja existe uma COPA TESTE por terminar. Envia recriar:true para criar outra.",
      });
    }
  }

  // 1) Participantes: contas Pro (inclui Pro Max, porque is_pro=true nas duas).
  const { data: pros } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("is_pro", true)
    .limit(500);
  const todosPro = (pros || []).map((p) => String(p.id));
  if (todosPro.length < 2) {
    return NextResponse.json(
      { ok: false, erro: "Sao precisas pelo menos 2 contas Pro para uma copa. Da Pro a mais contas em /admin/niveis." },
      { status: 400 }
    );
  }
  const participantes = todosPro.slice(0, teto);

  // 2) Competicoes da chave (por ordem de ronda).
  const { comps, erro: erroComps } = compsDaChave(participantes.length);
  if (erroComps) {
    return NextResponse.json({ ok: false, erro: erroComps }, { status: 400 });
  }

  // 3) Monta equipas por conta em cada competicao da chave - sem sobrescrever.
  const relatorioEquipas: Array<{ comp: string; criadas: number; jaTinham: number; semPlantel?: boolean }> = [];
  for (const comp of comps) {
    const cache = await lerCache(comp);
    if (cache.length < 8) {
      relatorioEquipas.push({ comp, criadas: 0, jaTinham: 0, semPlantel: true });
      continue; // sem plantel guardado: a ronda dessa competicao nao tera equipas nossas
    }
    // Quem ja tem equipa nesta competicao fica intocado.
    const { data: jaTem } = await supabaseAdmin
      .from("equipas")
      .select("user_id")
      .eq("id_competicao", comp)
      .in("user_id", participantes);
    const comEquipa = new Set((jaTem || []).map((e) => String(e.user_id)));

    const linhas: Array<Record<string, unknown>> = [];
    for (const uid of participantes) {
      if (comEquipa.has(uid)) continue;
      const eq = montarEquipa(cache, mulberry32(semente(`${uid}:${comp}`)));
      if (!eq) continue;
      linhas.push({
        user_id: uid,
        id_competicao: comp,
        nome: NOME_LIGA,
        escudo: null,
        atletas: eq.atletas,
        capitao: eq.capitao,
        precos: eq.precos,
        atualizado_em: new Date().toISOString(),
      });
    }
    if (linhas.length > 0) {
      // upsert com o mesmo conflito que a app usa; como ja filtramos quem tinha
      // equipa, na pratica so insere linhas novas.
      await supabaseAdmin.from("equipas").upsert(linhas, { onConflict: "user_id,id_competicao" });
    }
    relatorioEquipas.push({ comp, criadas: linhas.length, jaTinham: comEquipa.size });
  }

  // 4) Cria a liga da copa. O fecho da inscricao fica no PASSADO (o mercado do
  //    classico fechou em 2018), para o sorteio poder acontecer ja.
  const compIniObj = competicaoPorId(COMP_INICIAL)!;
  const est = estadoMercado(compIniObj);
  const fechoIso = est.fecho
    ? est.fecho.toISOString()
    : new Date(Date.now() - 60000).toISOString();

  const { data: liga, error: erroLiga } = await supabaseAdmin
    .from("leagues")
    .insert({
      name: NOME_LIGA,
      type: "amigos",
      scope: "privada",
      created_by: admin.uid,
      invite_code: novoCodigo(),
      descricao: "Copa de teste (admin) - chave completa nos classicos.",
      formato: "copa",
      privacidade: "fechada",
      escudo: null,
      copa_competicao_inicial: COMP_INICIAL,
      copa_fecho_inscricao: fechoIso,
      copa_estado: "inscricao",
      estado: "ativa",
    })
    .select("id, invite_code")
    .single();
  if (erroLiga || !liga) {
    return NextResponse.json(
      { ok: false, erro: "Nao foi possivel criar a liga.", detalhe: erroLiga?.message },
      { status: 500 }
    );
  }

  // 5) Mete os participantes como membros.
  const membros = participantes.map((uid) => ({
    league_id: liga.id,
    user_id: uid,
    score: 0,
    position: 0,
    entrou_competicao: COMP_INICIAL,
  }));
  const { error: erroMembros } = await supabaseAdmin.from("league_members").insert(membros);
  if (erroMembros) {
    return NextResponse.json(
      { ok: false, erro: "A liga foi criada mas os membros falharam.", detalhe: erroMembros.message, league_id: liga.id },
      { status: 500 }
    );
  }

  // 6) Sorteio: gera a 1a ronda e grava (igual ao /api/copa/sortear e ao /dodo).
  const confrontos = gerarPrimeiraRonda(participantes, COMP_INICIAL);
  const linhasConfronto = confrontos.map((c) => ({
    league_id: liga.id,
    ronda: c.ronda,
    ordem: c.ordem,
    fase: c.fase,
    jogador_a: c.jogador_a,
    jogador_b: c.jogador_b,
    id_competicao: c.id_competicao,
    estado: c.estado,
    metade: c.metade,
    ...(c.jogador_b === null
      ? { vencedor: c.jogador_a, decidido_por: "bye", estado: "decidido" }
      : {}),
  }));
  const { error: erroChave } = await supabaseAdmin.from("copa_confrontos").insert(linhasConfronto);
  if (erroChave) {
    return NextResponse.json(
      { ok: false, erro: "A liga foi criada mas a chave falhou.", detalhe: erroChave.message, league_id: liga.id },
      { status: 500 }
    );
  }
  await supabaseAdmin.from("leagues").update({ copa_estado: "sorteada" }).eq("id", liga.id);

  return NextResponse.json({
    ok: true,
    league_id: liga.id,
    invite_code: liga.invite_code,
    link: `/liga/${liga.invite_code}`,
    participantes: participantes.length,
    total_pros: todosPro.length,
    comps_da_chave: comps,
    confrontos: linhasConfronto.length,
    equipas: relatorioEquipas,
    passos: [
      `Congela os classicos da chave: /api/cron?key=SEGREDO&recongelar=${comps.join(" , recongelar=")}`,
      `Depois apura ronda a ronda: /api/cron?key=SEGREDO&apurar=${liga.id} (uma vez por ronda, a medida que cada classico fica congelado). Ou abre a pagina da liga, que apura sozinha ao carregar.`,
    ],
  });
}

// Codigo de convite curto e legivel (sem caracteres ambiguos).
function novoCodigo(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}
