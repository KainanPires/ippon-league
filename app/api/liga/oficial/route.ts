// app/api/liga/oficial/route.ts
//
// RANKING DAS LIGAS OFICIAIS (servidor, chave secreta).
//
// Ligas oficiais = Mundial e Continental. Todos VEEM, mas só PRO aparece no
// ranking. A continental é a do continente do próprio utilizador.
//
// Recebe (GET): ?tipo=mundial|continental & user_id=<uuid> & comp=<id_competicao>
// Devolve:
// {
  // ok, tipo, continente, nomeContinente,
  // membros: [{ user_id, nome_time, escudo, escalou, pontos, posicao, is_pro }]
  // }
//
// Escala bem: os participantes vêm da tabela public.users (indexada por is_pro e
  // continente), não de uma varredura do Auth. A pontuação de cada um vem da mesma
// fonte do resto da app (resultados da competição, capitão a dobrar).
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getCompetitorContests, scoreContestForPerson, type IjfContest } from "@/lib/ijf";
import { NOME_CONTINENTE, type Continente } from "@/lib/continentes";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Quantos Pro buscar no máximo (proteção; o ranking mostra os melhores).
const LIMITE = 1000;
interface MembroRank {
  user_id: string;
  nome_time: string;
  escudo: unknown;
  escalou: boolean;
  pontos: number;
  posicao: number;
  is_pro: boolean;
}
export async function GET(req: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ ok: false, erro: "Servidor sem ligação." }, { status: 500 });
  }
  const { searchParams } = new URL(req.url);
  const tipo = (searchParams.get("tipo") || "").trim();
  const user_id = (searchParams.get("user_id") || "").trim();
  const comp = (searchParams.get("comp") || "").trim();
  if (tipo !== "mundial" && tipo !== "continental") {
    return NextResponse.json({ ok: false, erro: "tipo deve ser 'mundial' ou 'continental'." }, { status: 400 });
  }
  if (!comp) return NextResponse.json({ ok: false, erro: "Falta ?comp=<id_competicao>." }, { status: 400 });
  // 1) Para a continental, descobrir o continente do utilizador que pergunta.
let continente: Continente | null = null;
let nomeContinente: string | null = null;
if (tipo === "continental") {
  if (!user_id) return NextResponse.json({ ok: false, erro: "Falta ?user_id= para a continental." }, { status: 400 });
  const { data: eu } = await supabaseAdmin
  .from("users")
  .select("continente")
  .eq("id", user_id)
  .maybeSingle();
  continente = (eu?.continente as Continente | null) ?? null;
  if (!continente) {
    // Sem continente conhecido: devolve vazio com aviso (em vez de erro).
    return NextResponse.json({ ok: true, tipo, continente: null, nomeContinente: null, membros: [], semContinente: true });
  }
  nomeContinente = NOME_CONTINENTE[continente];
}
// 2) Participantes = utilizadores Pro (filtrados por continente na continental).
let q = supabaseAdmin.from("users").select("id, is_pro, continente").eq("is_pro", true).limit(LIMITE);
if (tipo === "continental" && continente) q = q.eq("continente", continente);
const { data: pros } = await q;
const userIds = (pros || []).map((p) => p.id as string);
if (userIds.length === 0) {
  return NextResponse.json({ ok: true, tipo, continente, nomeContinente, membros: [] });
}
// 4) Equipas destes utilizadores NESTA competição (nome do time, escudo, atletas).
const { data: equipas } = await supabaseAdmin
.from("equipas")
.select("user_id, nome, escudo, atletas, capitao")
.eq("id_competicao", comp)
.in("user_id", userIds);
const equipaDe = new Map<string, { nome: string; escudo: unknown; atletas: string[]; capitao: string | null }>();
for (const e of equipas || []) {
  const ids = Array.isArray(e.atletas) ? (e.atletas as string[]).map(String) : [];
  equipaDe.set(e.user_id, { nome: e.nome ?? "Equipa", escudo: e.escudo ?? null, atletas: ids, capitao: e.capitao ? String(e.capitao) : null });
}
// 4b) Pontuação por atleta: só os atletas que alguém escalou, cada id uma vez.
const idsNecessarios = new Set<string>();
for (const eq of Array.from(equipaDe.values())) {
  for (const aid of eq.atletas) idsNecessarios.add(aid);
}
const pontosPorAtleta = await pontuacaoPorAtletas(Array.from(idsNecessarios), comp);
// 5) Calcula a pontuação de cada participante.
const linhas: MembroRank[] = userIds.map((uid) => {
    const eq = equipaDe.get(uid);
    if (!eq || eq.atletas.length === 0) {
      return { user_id: uid, nome_time: eq?.nome ?? "—", escudo: eq?.escudo ?? null, escalou: false, pontos: 0, posicao: 0, is_pro: true };
    }
    let total = 0;
    for (const aid of eq.atletas) {
      const p = pontosPorAtleta[aid] ?? 0;
      total += p;
      if (eq.capitao && aid === eq.capitao) total += p; // capitão a dobrar
    }
    return {
      user_id: uid,
      nome_time: eq.nome,
      escudo: eq.escudo,
      escalou: true,
      pontos: Math.round(total * 10) / 10,
      posicao: 0,
      is_pro: true,
    };
  });
// 6) Ordena (quem escalou e tem mais pontos primeiro; quem não escalou ao fundo).
linhas.sort((a, b) => {
    if (a.escalou !== b.escalou) return a.escalou ? -1 : 1;
    return b.pontos - a.pontos;
  });
// 7) Posição com empates a partilhar lugar.
for (const l of linhas) {
  l.posicao = linhas.filter((o) => o.escalou && o.pontos > l.pontos).length + 1;
}
return NextResponse.json({ ok: true, tipo, continente, nomeContinente, membros: linhas });
}
// ---------------------------------------------------------------------------
// PONTUACAO POR ATLETA
//
// Via competitor.contests (as lutas DE CADA ATLETA, filtradas por competicao),
// igual ao /api/resultados no modo por_atleta, ao congelar.ts, ao /api/liga e
// ao /api/liga/geral.
//
// NAO usar competition.contests aqui: vem incompleto durante e logo apos o
// evento (so algumas categorias), deixando a 0 atletas que ja lutaram. Foi o
// que pos uma equipa a 107 no Meu Time e a 0 no ranking, na competicao 1746.
// ---------------------------------------------------------------------------

// A liga oficial pode ter muitos participantes a partilhar atletas. Cache curta
// por instancia, para nao repetir idas ao JudoBase a cada atualizacao.
const CACHE_MS = 20000;
const cacheLutas = new Map<string, { t: number; lutas: IjfContest[] }>();

async function lutasDoAtleta(id: string): Promise<IjfContest[]> {
  const agora = Date.now();
  const guardado = cacheLutas.get(id);
  if (guardado && agora - guardado.t < CACHE_MS) return guardado.lutas;

  const lutas = (await getCompetitorContests(id)) || [];
  cacheLutas.set(id, { t: agora, lutas });
  return lutas;
}

async function pontuacaoPorAtletas(ids: string[], comp: string): Promise<Record<string, number>> {
  const pontos: Record<string, number> = {};
  if (ids.length === 0) return pontos;

  const LOTE = 8;
  for (let i = 0; i < ids.length; i += LOTE) {
    const lote = ids.slice(i, i + LOTE);
    await Promise.all(
      lote.map(async (id) => {
          try {
            const todas = await lutasDoAtleta(id);
            const desta = todas.filter((f) => String(f.id_competition) === comp);
            let soma = 0;
            for (const f of desta) soma += scoreContestForPerson(f, id);
            pontos[id] = Math.round(soma * 10) / 10;
          } catch {
            pontos[id] = 0;
          }
        })
    );
  }

  return pontos;
}
