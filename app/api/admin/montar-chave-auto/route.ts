// app/api/admin/montar-chave-auto/route.ts
//
// RECONSTRUIR A MOLDURA de uma categoria a partir da estrutura REAL do sorteio
// (os pools), resolvendo os IDs do JudoBase automaticamente — inclusive atletas
// que faltam nos inscritos (resolvidos pelo resultado da luta contra alguém que
// JÁ está na lista). So-admin (chave CRON_SECRET).
//
// PORQUÊ: a moldura é montada à mão e, quando um atleta não está nos inscritos
// (ou está com par/ID trocado), o motor (head-to-head) não faz a pessoa passar e
// a chave fica "—". Esta rota põe a moldura exatamente como o sorteio real.
//
// MERGE POR POOL: para cada categoria indico só os pools de que tenho o print.
// Os pools NÃO indicados ficam como estão (não se apagam). Assim dá para corrigir
// só o Pool D do -78 sem tocar em A/B/C.
//
//   GET /api/admin/montar-chave-auto?key=SEGREDO&cat=-78&seco=1  -> ENSAIO (só relatório)
//   GET /api/admin/montar-chave-auto?key=SEGREDO&cat=-78         -> grava (se tudo resolvido)
//   GET ...&force=1                                               -> grava mesmo com faltas
//   (cat omitido = -70, por retrocompatibilidade.)
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getCompetitionCompetitorsRaw, mapCompetitorsToAthletes, getCompetitionContests, getCompetitor } from "@/lib/ijf";
import type { Athlete } from "@/lib/athletes";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const COMP = "3151";
type PoolId = "A" | "B" | "C" | "D";
const POOLS: PoolId[] = ["A", "B", "C", "D"];

const CATS_F = new Set(["-48", "-52", "-57", "-63", "-70", "-78", "+78"]);
const generoDaCat = (cat: string): "M" | "F" => (CATS_F.has(cat) ? "F" : "M");

// Uma entrada do pool, na ORDEM visual do print.
//   q    = pedaço distintivo do apelido para casar com o JudoBase (minúsculas, sem acentos)
//   nome = nome para mostrar (usado se o atleta for acrescentado aos inscritos)
//   pais = código de 3 letras (como o JudoBase e o cache usam)
//   bye  = true se passa direto à 2.ª ronda (não luta na 1.ª)
interface Ent { q: string; nome: string; pais: string; bye?: boolean }

// ESTRUTURAS por categoria. Cada categoria indica SÓ os pools de que há print; os
// restantes mantêm-se. Ordem de cada pool = de cima para baixo no print do sorteio.
const ESTRUTURAS: Record<string, Partial<Record<PoolId, Ent[]>>> = {
  "-70": {
    A: [
      { q: "cvjetko", nome: "Lara Cvjetko", pais: "CRO", bye: true },
      { q: "corozo", nome: "Celinda Corozo", pais: "ECU" },
      { q: "dijke", nome: "Sanne van Dijke", pais: "NED" },
      { q: "aghayeva", nome: "Sudaba Aghayeva", pais: "AZE" },
      { q: "roustant", nome: "Ai Tsunoda Roustant", pais: "ESP" },
      { q: "koren", nome: "Nika Koren", pais: "SLO", bye: true },
      { q: "stangherlin", nome: "Giorgia Stangherlin", pais: "ITA", bye: true },
      { q: "olsen", nome: "Laerke Olsen", pais: "DEN" },
      { q: "samardzic", nome: "Aleksandra Samardzic", pais: "BIH" },
      { q: "khaidem", nome: "Taibanganbi Chanu Khaidem", pais: "IND", bye: true },
      { q: "nilsson", nome: "Ingrid Nilsson", pais: "SWE", bye: true },
    ],
    B: [
      { q: "butkereit", nome: "Miriam Butkereit", pais: "GER", bye: true },
      { q: "lishchenko", nome: "Tamara Lishchenko", pais: "AIN" },
      { q: "razzokberdieva", nome: "Khurshida Razzokberdieva", pais: "UZB" },
      { q: "liu", nome: "Lu Liu", pais: "CHN" },
      { q: "andric", nome: "Aleksandra Andric", pais: "SRB" },
      { q: "garriga", nome: "Isabelle Garriga", pais: "USA", bye: true },
      { q: "eme", nome: "Clemence Eme", pais: "FRA", bye: true },
      { q: "liao", nome: "Yu-Jung Liao", pais: "TPE" },
      { q: "teltsidou", nome: "Elisavet Teltsidou", pais: "GRE" },
      { q: "silva", nome: "Neuane Silva", pais: "BRA", bye: true },
      { q: "fizelova", nome: "Ema Fizelova", pais: "SVK", bye: true },
    ],
    C: [
      { q: "coughlan", nome: "Aoife Coughlan", pais: "AUS", bye: true },
      { q: "myers", nome: "Melisa Myers", pais: "USA" },
      { q: "polleres", nome: "Michaela Polleres", pais: "AUT" },
      { q: "schuster", nome: "Kaja Schuster", pais: "SLO" },
      { q: "lee", nome: "Yereng Lee", pais: "KOR" },
      { q: "takhellambam", nome: "Inunganbi Takhellambam", pais: "IND", bye: true },
      { q: "taimazova", nome: "Medina Taimazova", pais: "AIN", bye: true },
      { q: "pina", nome: "Tais Pina", pais: "POR", bye: true },
      { q: "pedrotti", nome: "Irene Pedrotti", pais: "ITA" },
      { q: "kowalewska", nome: "Aleksandra Kowalewska", pais: "POL" },
      { q: "petersen", nome: "Kelly Petersen Pollard", pais: "GBR", bye: true },
    ],
    D: [
      { q: "tanaka", nome: "Shiho Tanaka", pais: "JPN", bye: true },
      { q: "voogd", nome: "Margit de Voogd", pais: "NED" },
      { q: "vetterli", nome: "Gioia Vetterli", pais: "SUI" },
      { q: "moscalu", nome: "Serafima Moscalu", pais: "ROU" },
      { q: "rasoanaivo", nome: "Aina Laure Rasoanaivo Razafy", pais: "MAD" },
      { q: "scoccimarro", nome: "Giovanna Scoccimarro", pais: "GER", bye: true },
      { q: "eriksson", nome: "Ida Eriksson", pais: "SWE", bye: true },
      { q: "yuldoshova", nome: "Shirinjon Yuldoshova", pais: "UZB", bye: true },
      { q: "gulbani", nome: "Nino Gulbani", pais: "GEO" },
      { q: "feng", nome: "Yingying Feng", pais: "CHN" },
      { q: "goshen", nome: "Maya Goshen", pais: "ISR", bye: true },
    ],
  },
  // -78 feminino — só o Pool D (do print do sorteio). A/B/C ficam como estão.
  "-78": {
    D: [
      { q: "lobnik", nome: "Metka Lobnik", pais: "SLO", bye: true },
      { q: "rylkevich", nome: "Sliviane Rylkevich", pais: "BLR" },
      { q: "zhenzhao", nome: "Zhenzhao Ma", pais: "CHN" },
      { q: "freitas", nome: "Beatriz Freitas", pais: "BRA" },
      { q: "zabic", nome: "Milica Zabic", pais: "SRB" },
      { q: "wang", nome: "Shu-Hui Hsu Wang", pais: "TPE", bye: true },
      { q: "sampaio", nome: "Patricia Sampaio", pais: "POR", bye: true },
      { q: "onua", nome: "Lotanna Onua", pais: "USA" },
      { q: "gulenay", nome: "Tuana Gulenay", pais: "TUR" },
      { q: "juyun", nome: "Juyun Kim", pais: "KOR", bye: true },
      { q: "verschaere", nome: "Vicky Verschaere", pais: "BEL", bye: true },
    ],
  },
};

// IDs forçados à mão (preenche-se aqui SE o ensaio não resolver alguém): q -> id.
const ID_OVERRIDE: Record<string, string> = {};

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const norm = (s: string) => semAcento(String(s || "")).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// Pares da 1.ª ronda, pela mesma regra do motor: tira os byes, empareja seguidos.
function paresR1(ents: Ent[]): [number, number][] {
  const idxFighters = ents.map((_, i) => i).filter((i) => !ents[i].bye);
  const pares: [number, number][] = [];
  for (let k = 0; k + 1 < idxFighters.length; k += 2) pares.push([idxFighters[k], idxFighters[k + 1]]);
  return pares;
}

export async function GET(req: Request) {
  if (!supabaseAdmin) return NextResponse.json({ ok: false, erro: "Servidor sem ligação." }, { status: 500 });
  const { searchParams } = new URL(req.url);
  const key = (searchParams.get("key") || "").trim();
  if (!process.env.CRON_SECRET || key !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, erro: "Não autorizado." }, { status: 401 });
  }
  const seco = searchParams.get("seco") === "1";
  const force = searchParams.get("force") === "1";
  const cat = (searchParams.get("cat") || "-70").trim();
  const estrutura = ESTRUTURAS[cat];
  if (!estrutura) {
    return NextResponse.json({ ok: false, erro: `Sem estrutura para a categoria ${cat}.`, categorias: Object.keys(ESTRUTURAS) }, { status: 400 });
  }
  const genero = generoDaCat(cat);
  const poolsDaEstrutura = POOLS.filter((p) => Array.isArray(estrutura[p]));

  // 1) Roster do JudoBase (inscritos) + cache atual, filtrado por categoria/género.
  const raw = await getCompetitionCompetitorsRaw(COMP);
  const doJudo = mapCompetitorsToAthletes(raw);
  let cacheAtual: Athlete[] = [];
  try {
    const { data } = await supabaseAdmin.from("atletas_cache").select("atletas").eq("id_competition", COMP).maybeSingle();
    if (Array.isArray(data?.atletas)) cacheAtual = data!.atletas as Athlete[];
  } catch { /* segue sem cache */ }

  const normCat = (c?: string) => norm(String(c || "").replace(/kg/gi, ""));
  const ehCat = (a: Athlete) => normCat(a.category) === normCat(cat) && String(a.gender || "").toUpperCase() === genero;

  const porId = new Map<string, Athlete>();
  for (const a of [...doJudo, ...cacheAtual]) if (a?.id && !porId.has(String(a.id))) porId.set(String(a.id), a);
  const roster = [...porId.values()].filter(ehCat);

  // 2) Casa cada entrada por apelido (q) + país; país só desempata.
  type Resolvido = { ent: Ent; pool: PoolId; id: string | null; via: string; nomeJudo?: string; ambig?: string[] };
  const resolvidos: Resolvido[] = [];
  const byQ = new Map<string, Resolvido>();
  for (const pool of poolsDaEstrutura) {
    for (const ent of estrutura[pool]!) {
      let id: string | null = null, via = "", nomeJudo: string | undefined, ambig: string[] | undefined;
      if (ID_OVERRIDE[ent.q]) { id = ID_OVERRIDE[ent.q]; via = "override"; nomeJudo = porId.get(id)?.name; }
      else {
        const cands = roster.filter((a) => norm(a.name).includes(ent.q));
        const porPais = cands.filter((a) => String(a.countryIso || "").toUpperCase() === ent.pais.toUpperCase());
        const escolha = porPais.length === 1 ? porPais : cands;
        if (escolha.length === 1) { id = String(escolha[0].id); via = "inscritos"; nomeJudo = escolha[0].name; }
        else if (escolha.length > 1) { ambig = escolha.map((a) => `${a.name} (${a.countryIso}) #${a.id}`); }
      }
      const r: Resolvido = { ent, pool, id, via, nomeJudo, ambig };
      resolvidos.push(r);
      byQ.set(ent.q, r);
    }
  }

  // 3) Para quem faltou: resolver pelo RESULTADO — o adversário de 1.ª ronda de
  //    alguém que JÁ temos.
  const faltam = resolvidos.filter((r) => !r.id && !r.ambig);
  if (faltam.length > 0) {
    const contests = await getCompetitionContests(COMP);
    const advDe = (idp: string): string[] => {
      const out: string[] = [];
      for (const f of contests) {
        const b = String(f.id_person_blue || ""), w = String(f.id_person_white || "");
        if (b === idp && w) out.push(w);
        else if (w === idp && b) out.push(b);
      }
      return out;
    };
    const jaUsados = new Set(resolvidos.map((r) => r.id).filter(Boolean) as string[]);
    for (const pool of poolsDaEstrutura) {
      const ents = estrutura[pool]!;
      for (const [i, j] of paresR1(ents)) {
        const ri = byQ.get(ents[i].q)!, rj = byQ.get(ents[j].q)!;
        const resolvidoLado = ri.id ? ri : rj.id ? rj : null;
        const emFalta = !ri.id ? ri : !rj.id ? rj : null;
        if (!resolvidoLado || !emFalta || emFalta.id) continue;
        const advs = advDe(resolvidoLado.id!).filter((x) => !jaUsados.has(x));
        const unicos = [...new Set(advs)];
        if (unicos.length === 1) {
          emFalta.id = unicos[0]; emFalta.via = "resultado"; jaUsados.add(unicos[0]);
          try { const c = await getCompetitor(unicos[0]); if (c) emFalta.nomeJudo = `${c.given_name ?? ""} ${c.family_name ?? ""}`.trim(); } catch {}
        } else if (unicos.length > 1) {
          emFalta.ambig = unicos.map((x) => `#${x}`);
        }
      }
    }
  }

  // 4) Relatório.
  const relatorio = resolvidos.map((r) => ({
    pool: r.pool, print: `${r.ent.nome} (${r.ent.pais})`, bye: !!r.ent.bye,
    id: r.id, via: r.via || (r.ambig ? "AMBÍGUO" : "NÃO ENCONTRADO"),
    judobase: r.nomeJudo || null, ambiguidades: r.ambig || undefined,
  }));
  const naoResolvidos = resolvidos.filter((r) => !r.id);

  // IDs (na ordem) + byes dos pools DA ESTRUTURA.
  const poolsIds: Record<PoolId, string[]> = { A: [], B: [], C: [], D: [] };
  const byesIds: Record<PoolId, string[]> = { A: [], B: [], C: [], D: [] };
  for (const pool of poolsDaEstrutura) {
    for (const ent of estrutura[pool]!) {
      const r = byQ.get(ent.q)!;
      if (r.id) { poolsIds[pool].push(r.id); if (ent.bye) byesIds[pool].push(r.id); }
    }
  }

  if (seco || (naoResolvidos.length > 0 && !force)) {
    return NextResponse.json({
      ok: naoResolvidos.length === 0,
      modo: seco ? "ensaio" : "bloqueado (há atletas por resolver — confirma e corrige, ou usa &force=1)",
      comp: COMP, cat, genero, pools_a_substituir: poolsDaEstrutura,
      total: resolvidos.length, resolvidos: resolvidos.length - naoResolvidos.length, porResolver: naoResolvidos.length,
      naoResolvidos: naoResolvidos.map((r) => `${r.pool}: ${r.ent.nome} (${r.ent.pais})`),
      relatorio,
    });
  }

  // 5) GRAVA: acrescenta aos inscritos quem falta.
  const cachePorId = new Map<string, Athlete>(cacheAtual.map((a) => [String(a.id), a]));
  let acrescentados = 0;
  for (const r of resolvidos) {
    if (!r.id || cachePorId.has(r.id)) continue;
    const base = porId.get(r.id);
    cachePorId.set(r.id, base ?? {
      id: r.id, name: r.ent.nome, countryIso: r.ent.pais, gender: genero, category: cat,
      priceJc: 2, variation: 0, avg: 0, last: 0, status: "Aposta",
    });
    acrescentados++;
  }
  const novaLista = [...cachePorId.values()];
  try {
    await supabaseAdmin.from("atletas_cache").upsert(
      { id_competition: COMP, atletas: novaLista, total: novaLista.length, atualizado_em: new Date().toISOString() },
      { onConflict: "id_competition" }
    );
  } catch (e) {
    return NextResponse.json({ ok: false, erro: "Falha a gravar inscritos.", detalhe: String((e as Error)?.message || e) }, { status: 500 });
  }

  // 6) MERGE com a moldura existente: substitui só os pools da estrutura; mantém os outros.
  let exId: string | null = null;
  const exPools: Record<string, unknown> = {};
  const exByes: Record<string, unknown> = {};
  try {
    const { data: exRow } = await supabaseAdmin
      .from("chave_atletas").select("id, pools").eq("id_competicao", COMP).eq("weight_category", cat).maybeSingle();
    exId = exRow?.id ? String(exRow.id) : null;
    const p = (exRow?.pools && typeof exRow.pools === "object") ? exRow.pools as Record<string, unknown> : {};
    for (const k of POOLS) exPools[k] = p[k];
    const b = (p.byes && typeof p.byes === "object") ? p.byes as Record<string, unknown> : {};
    for (const k of POOLS) exByes[k] = b[k];
  } catch { /* sem moldura anterior: cria do zero com só os pools dados */ }

  const poolsFinal: Record<PoolId, string[]> = { A: [], B: [], C: [], D: [] };
  const byesFinal: Record<PoolId, string[]> = { A: [], B: [], C: [], D: [] };
  for (const p of POOLS) {
    if (estrutura[p]) { poolsFinal[p] = poolsIds[p]; byesFinal[p] = byesIds[p]; }
    else {
      poolsFinal[p] = Array.isArray(exPools[p]) ? (exPools[p] as unknown[]).map(String) : [];
      byesFinal[p] = Array.isArray(exByes[p]) ? (exByes[p] as unknown[]).map(String) : [];
    }
  }
  const poolsPayload = { A: poolsFinal.A, B: poolsFinal.B, C: poolsFinal.C, D: poolsFinal.D, byes: byesFinal };

  try {
    if (exId) await supabaseAdmin.from("chave_atletas").update({ genero, pools: poolsPayload }).eq("id", exId);
    else await supabaseAdmin.from("chave_atletas").insert({ id_competicao: COMP, weight_category: cat, genero, pools: poolsPayload });
  } catch (e) {
    return NextResponse.json({ ok: false, erro: "Falha a gravar a moldura.", detalhe: String((e as Error)?.message || e) }, { status: 500 });
  }

  return NextResponse.json({
    ok: true, modo: "gravado", comp: COMP, cat, genero,
    pools_substituidos: poolsDaEstrutura,
    inscritos_acrescentados: acrescentados, total_inscritos: novaLista.length,
    moldura: { A: poolsFinal.A.length, B: poolsFinal.B.length, C: poolsFinal.C.length, D: poolsFinal.D.length },
    relatorio,
  });
}
