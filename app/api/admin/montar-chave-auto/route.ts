// app/api/admin/montar-chave-auto/route.ts
//
// RECONSTRUIR A MOLDURA DE UMA CATEGORIA a partir da estrutura REAL do sorteio
// (os 4 pools), resolvendo os IDs do JudoBase automaticamente — inclusive os
// atletas que faltam nos inscritos (resolvidos pelo resultado da luta contra
// alguém que JÁ está na lista). So-admin (chave CRON_SECRET).
//
// PORQUÊ: a moldura é montada à mão e, quando um atleta não está nos inscritos
// (ou está com ID trocado), o par fica errado e a chave não faz a pessoa passar.
// Esta rota põe a moldura exatamente como o sorteio real, com os IDs certos, para
// o motor (head-to-head) ligar as vitórias e avançar toda a gente.
//
//   GET /api/admin/montar-chave-auto?key=SEGREDO&seco=1   -> ENSAIO (só relatório)
//   GET /api/admin/montar-chave-auto?key=SEGREDO          -> grava (se tudo resolvido)
//   GET ...&force=1                                        -> grava mesmo com faltas
//
// É específica para o Mundial de Baku (3151), -70 feminino. A estrutura (ordem de
// cada pool + byes) está no ESTRUTURA abaixo, transcrita dos prints do sorteio.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getCompetitionCompetitorsRaw, mapCompetitorsToAthletes, getCompetitionContests, getCompetitor } from "@/lib/ijf";
import type { Athlete } from "@/lib/athletes";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const COMP = "3151";
const CAT = "-70";
const GENERO = "F";
type PoolId = "A" | "B" | "C" | "D";
const POOLS: PoolId[] = ["A", "B", "C", "D"];

// Uma entrada do pool, na ORDEM visual do print.
//   q    = pedaço distintivo do apelido para casar com o JudoBase (minúsculas, sem acentos)
//   nome = nome para mostrar (usado se a atleta for acrescentada aos inscritos)
//   pais = código de 3 letras (como o JudoBase e o cache usam)
//   bye  = true se passa direto à 2.ª ronda (não luta na 1.ª)
interface Ent { q: string; nome: string; pais: string; bye?: boolean }

// --- Estrutura REAL do -70 (dos 4 prints do sorteio). Ordem = de cima para baixo. ---
const ESTRUTURA: Record<PoolId, Ent[]> = {
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

  // 1) Roster do JudoBase (inscritos) + cache atual, só -70 feminino.
  const raw = await getCompetitionCompetitorsRaw(COMP);
  const doJudo = mapCompetitorsToAthletes(raw);
  let cacheAtual: Athlete[] = [];
  try {
    const { data } = await supabaseAdmin.from("atletas_cache").select("atletas").eq("id_competition", COMP).maybeSingle();
    if (Array.isArray(data?.atletas)) cacheAtual = data!.atletas as Athlete[];
  } catch { /* segue sem cache */ }

  const normCat = (c?: string) => norm(String(c || "").replace(/kg/gi, ""));
  const ehCat = (a: Athlete) => normCat(a.category) === normCat(CAT) && String(a.gender || "").toUpperCase() === GENERO;

  // Índice id->atleta e lista para casar por nome (JudoBase primeiro, cache a seguir).
  const porId = new Map<string, Athlete>();
  for (const a of [...doJudo, ...cacheAtual]) if (a?.id && !porId.has(String(a.id))) porId.set(String(a.id), a);
  const roster = [...porId.values()].filter(ehCat);

  // 2) Casa cada entrada por apelido (q) + país; país só desempata.
  type Resolvido = { ent: Ent; pool: PoolId; id: string | null; via: string; nomeJudo?: string; ambig?: string[] };
  const resolvidos: Resolvido[] = [];
  const byQ = new Map<string, Resolvido>();
  for (const pool of POOLS) {
    for (const ent of ESTRUTURA[pool]) {
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
  //    alguém que JÁ temos. Precisamos das lutas do JudoBase.
  const faltam = resolvidos.filter((r) => !r.id && !r.ambig);
  if (faltam.length > 0) {
    const contests = await getCompetitionContests(COMP);
    // Adversário(s) de um id numa luta qualquer da competição.
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
    for (const pool of POOLS) {
      const ents = ESTRUTURA[pool];
      for (const [i, j] of paresR1(ents)) {
        const ri = byQ.get(ents[i].q)!, rj = byQ.get(ents[j].q)!;
        // par com um resolvido e um em falta -> o em falta é o adversário do resolvido.
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

  // Pools em IDs (na ordem) + byes em IDs.
  const poolsIds: Record<PoolId, string[]> = { A: [], B: [], C: [], D: [] };
  const byesIds: Record<PoolId, string[]> = { A: [], B: [], C: [], D: [] };
  for (const pool of POOLS) {
    for (const ent of ESTRUTURA[pool]) {
      const r = byQ.get(ent.q)!;
      if (r.id) { poolsIds[pool].push(r.id); if (ent.bye) byesIds[pool].push(r.id); }
    }
  }

  if (seco || (naoResolvidos.length > 0 && !force)) {
    return NextResponse.json({
      ok: naoResolvidos.length === 0,
      modo: seco ? "ensaio" : "bloqueado (há atletas por resolver — confirma e corrige, ou usa &force=1)",
      comp: COMP, cat: CAT,
      total: resolvidos.length, resolvidos: resolvidos.length - naoResolvidos.length, porResolver: naoResolvidos.length,
      naoResolvidos: naoResolvidos.map((r) => `${r.pool}: ${r.ent.nome} (${r.ent.pais})`),
      relatorio,
    });
  }

  // 5) GRAVA: acrescenta aos inscritos quem falta, e escreve a moldura.
  const cachePorId = new Map<string, Athlete>(cacheAtual.map((a) => [String(a.id), a]));
  let acrescentados = 0;
  for (const r of resolvidos) {
    if (!r.id || cachePorId.has(r.id)) continue;
    const base = porId.get(r.id);
    cachePorId.set(r.id, base ?? {
      id: r.id, name: r.ent.nome, countryIso: r.ent.pais, gender: GENERO, category: CAT,
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

  const poolsPayload = { A: poolsIds.A, B: poolsIds.B, C: poolsIds.C, D: poolsIds.D, byes: byesIds };
  try {
    const { data: ex } = await supabaseAdmin
      .from("chave_atletas").select("id").eq("id_competicao", COMP).eq("weight_category", CAT).maybeSingle();
    if (ex?.id) await supabaseAdmin.from("chave_atletas").update({ genero: GENERO, pools: poolsPayload }).eq("id", ex.id);
    else await supabaseAdmin.from("chave_atletas").insert({ id_competicao: COMP, weight_category: CAT, genero: GENERO, pools: poolsPayload });
  } catch (e) {
    return NextResponse.json({ ok: false, erro: "Falha a gravar a moldura.", detalhe: String((e as Error)?.message || e) }, { status: 500 });
  }

  return NextResponse.json({
    ok: true, modo: "gravado", comp: COMP, cat: CAT,
    inscritos_acrescentados: acrescentados, total_inscritos: novaLista.length,
    moldura: { A: poolsIds.A.length, B: poolsIds.B.length, C: poolsIds.C.length, D: poolsIds.D.length },
    relatorio,
  });
}
