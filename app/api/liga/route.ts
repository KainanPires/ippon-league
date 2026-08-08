// app/api/liga/route.ts
//
// RANKING AO VIVO DE UMA LIGA (servidor, chave secreta).
//
// Recebe (GET): ?id=<league_id>&comp=<id_competicao>
//   - id   : a liga
//   - comp : a competicao cuja rodada esta a valer (a app passa a que decorre)
//
// Faz, para cada membro da liga:
//   1) encontra a equipa dele NESSA competicao (user_id + id_competicao)
//   2) le os 8 atletas e o capitao
//   3) soma a pontuacao de cada atleta, capitao a dobrar
// Depois ordena do maior para o menor e devolve a tabela classificativa.
//
// ---------------------------------------------------------------------------
// FONTE DOS PONTOS - LER ANTES DE MEXER
//
// Pontua via competitor.contests (as lutas DE CADA ATLETA, filtradas por
// competicao), tal como o /api/resultados no modo por_atleta.
//
// NAO usar competition.contests aqui. Esse endpoint vem INCOMPLETO durante e
// logo apos o evento: devolve so algumas categorias. Os atletas das categorias
// em falta ficavam a 0 e o membro aparecia com +0 no ranking, com o nome da
// equipa certo e "Escalou" a verde - indistinguivel de quem nao pontuou mesmo.
//
// Foi exatamente o que aconteceu na competicao 1746: uma equipa somava 107 no
// Meu Time (que ja pontuava por atleta) e 0 na liga, na mesma rodada, enquanto
// outro membro pontuava 80 por os atletas dele calharem nas categorias que o
// competition.contests devolvia. O bug tinha sido corrigido no /api/resultados
// e nunca foi propagado para aqui.
// ---------------------------------------------------------------------------
//
// PORTAO ANTI-ESPREITADELA: com o mercado ainda ABERTO esta rota nao devolve
// pontos, pela mesma razao do /api/resultados - nos classicos as lutas ja
// existem no JudoBase, e o ranking da liga era uma forma de as espreitar sem
// passar pelo Meu Time. Competicoes fora do CALENDARIO_2026 passam a frente.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getCompetitorContests, scoreContestForPerson, type IjfContest } from "@/lib/ijf";
import { CALENDARIO_2026, pontosVisiveisPorId } from "@/lib/calendario";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface MembroRank {
  user_id: string;
  nome_time: string;
  escudo: unknown;
  escalou: boolean; // tem equipa nesta competicao?
  pontos: number;
  posicao: number;
  is_pro: boolean;
  is_pro_max: boolean;
}

export async function GET(req: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ erro: "Servidor sem ligacao." }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const league_id = (searchParams.get("id") || "").trim();
  const comp = (searchParams.get("comp") || "").trim();

  if (!league_id) return NextResponse.json({ erro: "Falta ?id=<league_id>." }, { status: 400 });
  if (!comp) return NextResponse.json({ erro: "Falta ?comp=<id_competicao>." }, { status: 400 });

  // 0) Dados da liga (cabecalho).
  const { data: liga } = await supabaseAdmin
    .from("leagues")
    .select("id, name, formato, privacidade, descricao, escudo, invite_code")
    .eq("id", league_id)
    .maybeSingle();

  if (!liga) return NextResponse.json({ erro: "Liga nao encontrada." }, { status: 404 });

  // 1) Membros da liga.
  const { data: membros } = await supabaseAdmin
    .from("league_members")
    .select("user_id")
    .eq("league_id", league_id);

  const userIds = (membros || []).map((m) => String(m.user_id));

  if (userIds.length === 0) {
    return NextResponse.json({ liga, comp, membros: [] });
  }

  // 2) Equipas destes membros NESTA competicao.
  const { data: equipas } = await supabaseAdmin
    .from("equipas")
    .select("user_id, nome, escudo, atletas, capitao")
    .eq("id_competicao", comp)
    .in("user_id", userIds);

  const equipaDe = new Map<string, { nome: string; escudo: unknown; atletas: string[]; capitao: string | null }>();
  for (const e of equipas || []) {
    const ids = Array.isArray(e.atletas) ? (e.atletas as string[]).map(String) : [];
    equipaDe.set(String(e.user_id), {
      nome: e.nome ?? "Equipa",
      escudo: e.escudo ?? null,
      atletas: ids,
      capitao: e.capitao ? String(e.capitao) : null,
    });
  }

  // 3) Nivel de cada membro (de public.users - NUNCA do user_metadata).
  const nivelDe = await nivelDosMembros(userIds);

  // 4) Mercado ainda aberto? Entao ninguem ve pontos. Devolve a lista com quem
  //    ja escalou, tudo a zero.
  const noCalendario = CALENDARIO_2026.some((c) => c.idCompeticao === comp);
  const bloqueado = noCalendario && !pontosVisiveisPorId(comp);

  // 5) Pontuacao por atleta. So se buscam os atletas que alguem escalou, e cada
  //    id uma unica vez (varias equipas partilham atletas).
  const idsNecessarios = new Set<string>();
  if (!bloqueado) {
    for (const eq of Array.from(equipaDe.values())) {
      for (const aid of eq.atletas) idsNecessarios.add(aid);
    }
  }
  const pontosPorAtleta = await pontuacaoPorAtletas(Array.from(idsNecessarios), comp);

  // 6) Calcula a pontuacao de cada membro.
  const linhas: MembroRank[] = userIds.map((uid) => {
    const nivel = nivelDe[uid] ?? { is_pro: false, is_pro_max: false };
    const eq = equipaDe.get(uid);

    if (!eq) {
      return {
        user_id: uid,
        nome_time: "-",
        escudo: null,
        escalou: false,
        pontos: 0,
        posicao: 0,
        is_pro: nivel.is_pro,
        is_pro_max: nivel.is_pro_max,
      };
    }

    let total = 0;
    for (const aid of eq.atletas) {
      const p = pontosPorAtleta[aid] ?? 0;
      total += p;
      if (eq.capitao && aid === eq.capitao) total += p; // capitao conta a dobrar
    }

    return {
      user_id: uid,
      nome_time: eq.nome,
      escudo: eq.escudo,
      escalou: eq.atletas.length > 0,
      pontos: Math.round(total * 10) / 10,
      posicao: 0,
      is_pro: nivel.is_pro,
      is_pro_max: nivel.is_pro_max,
    };
  });

  // 7) Ordena (quem escalou e tem mais pontos primeiro; quem nao escalou ao fundo).
  linhas.sort((a, b) => {
    if (a.escalou !== b.escalou) return a.escalou ? -1 : 1;
    return b.pontos - a.pontos;
  });

  // 8) Posicao com empates a partilhar lugar.
  for (const l of linhas) {
    l.posicao = linhas.filter((o) => o.escalou && o.pontos > l.pontos).length + 1;
  }

  return NextResponse.json({
    liga,
    comp,
    bloqueado,
    mercado_aberto: bloqueado,
    membros: linhas,
  });
}

// ---------------------------------------------------------------------------
// PONTUACAO POR ATLETA
//
// Mesma via do /api/resultados?persons=... : competitor.contests por atleta,
// filtrado pela competicao. Ver o cabecalho para saber porque nao se usa aqui
// o competition.contests.
// ---------------------------------------------------------------------------

// O ranking da liga refresca ao vivo e varios membros escalam os mesmos
// atletas. Sem isto, cada tick eram dezenas de idas ao JudoBase para dados que
// nao mudaram. Cache curta, por instancia.
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

  // Em lotes, para nao abrir uma ligacao por atleta de uma vez so numa liga grande.
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

// Le o nivel de public.users. O user_metadata deixou de ser sincronizado pelo
// webhook da Stripe: quem le de la ve false num subscritor que pagou.
// Uma consulta so, em vez de um getUserById por membro.
async function nivelDosMembros(
  userIds: string[]
): Promise<Record<string, { is_pro: boolean; is_pro_max: boolean }>> {
  const out: Record<string, { is_pro: boolean; is_pro_max: boolean }> = {};
  for (const uid of userIds) out[uid] = { is_pro: false, is_pro_max: false };
  if (!supabaseAdmin) return out;

  const { data } = await supabaseAdmin
    .from("users")
    .select("id, is_pro, is_pro_max")
    .in("id", userIds);

  for (const u of data || []) {
    const max = !!u.is_pro_max;
    out[String(u.id)] = { is_pro: !!u.is_pro || max, is_pro_max: max };
  }

  return out;
}
