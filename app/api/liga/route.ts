// app/api/liga/route.ts
//
// RANKING AO VIVO DE UMA LIGA (servidor, chave secreta).
//
// Recebe (GET): ?id=<league_id>&comp=<id_competicao>
//   - id   : a liga
//   - comp : a competição cuja rodada está a valer (a app passa a que decorre)
//
// Faz, para cada membro da liga:
//   1) encontra a equipa dele NESSA competição (user_id + id_competicao)
//   2) lê os 8 atletas e o capitão
//   3) soma a pontuação de cada atleta (do /api/resultados), capitão a dobrar
// Depois ordena do maior para o menor e devolve a tabela classificativa.
//
// As pontuações vêm de /api/resultados (mesma fonte, mesmas regras de shido/hansoku).
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getCompetitionContests, scoreContestSide } from "@/lib/ijf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface MembroRank {
  user_id: string;
  nome_time: string;
  escudo: unknown;
  escalou: boolean;       // tem equipa nesta competição?
  pontos: number;
  posicao: number;
  is_pro: boolean;
}

export async function GET(req: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ erro: "Servidor sem ligação." }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const league_id = (searchParams.get("id") || "").trim();
  const comp = (searchParams.get("comp") || "").trim();
  if (!league_id) return NextResponse.json({ erro: "Falta ?id=<league_id>." }, { status: 400 });
  if (!comp) return NextResponse.json({ erro: "Falta ?comp=<id_competicao>." }, { status: 400 });

  // 0) Dados da liga (cabeçalho).
  const { data: liga } = await supabaseAdmin
    .from("leagues")
    .select("id, name, formato, privacidade, descricao, escudo, invite_code")
    .eq("id", league_id)
    .maybeSingle();

  if (!liga) return NextResponse.json({ erro: "Liga não encontrada." }, { status: 404 });

  // 1) Membros da liga.
  const { data: membros } = await supabaseAdmin
    .from("league_members")
    .select("user_id")
    .eq("league_id", league_id);

  const userIds = (membros || []).map((m) => m.user_id);
  if (userIds.length === 0) {
    return NextResponse.json({ liga, comp, membros: [] });
  }

  // 2) Pontuação de TODOS os atletas nesta competição (uma só ida ao IJF).
  const pontosPorAtleta = await pontuacaoDaCompeticao(comp);

  // 3) Equipas destes membros NESTA competição.
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

  // 4) is_pro de cada membro (lê do user_metadata do Auth).
  const proDe = await proDosMembros(userIds);

  // 5) Calcula a pontuação de cada membro.
  const linhas: MembroRank[] = userIds.map((uid) => {
    const eq = equipaDe.get(uid);
    if (!eq) {
      return { user_id: uid, nome_time: "—", escudo: null, escalou: false, pontos: 0, posicao: 0, is_pro: proDe[uid] ?? false };
    }
    let total = 0;
    for (const aid of eq.atletas) {
      const p = pontosPorAtleta[aid] ?? 0;
      total += p;
      if (eq.capitao && aid === eq.capitao) total += p; // capitão conta a dobrar
    }
    return {
      user_id: uid,
      nome_time: eq.nome,
      escudo: eq.escudo,
      escalou: eq.atletas.length > 0,
      pontos: Math.round(total * 10) / 10,
      posicao: 0,
      is_pro: proDe[uid] ?? false,
    };
  });

  // 6) Ordena (quem escalou e tem mais pontos primeiro; quem não escalou ao fundo).
  linhas.sort((a, b) => {
    if (a.escalou !== b.escalou) return a.escalou ? -1 : 1;
    return b.pontos - a.pontos;
  });

  // 7) Posição com empates a partilhar lugar.
  for (const l of linhas) {
    l.posicao = linhas.filter((o) => o.escalou && (o.pontos > l.pontos)).length + 1;
  }

  return NextResponse.json({ liga, comp, membros: linhas });
}

// Soma, por atleta (id_person), os pontos de todas as lutas da competição.
async function pontuacaoDaCompeticao(comp: string): Promise<Record<string, number>> {
  const contests = await getCompetitionContests(comp);
  const pontos: Record<string, number> = {};
  for (const f of contests) {
    const lados: ["b" | "w", string][] = [
      ["b", String(f.id_person_blue ?? "")],
      ["w", String(f.id_person_white ?? "")],
    ];
    for (const [side, id] of lados) {
      if (!id) continue;
      pontos[id] = (pontos[id] ?? 0) + scoreContestSide(f, side);
    }
  }
  return pontos;
}

// Lê o is_pro de cada utilizador a partir do user_metadata do Auth.
async function proDosMembros(userIds: string[]): Promise<Record<string, boolean>> {
  const out: Record<string, boolean> = {};
  if (!supabaseAdmin) return out;
  for (const uid of userIds) {
    try {
      const { data } = await supabaseAdmin.auth.admin.getUserById(uid);
      const meta = data?.user?.user_metadata as { is_pro?: boolean } | undefined;
      out[uid] = !!meta?.is_pro;
    } catch {
      out[uid] = false;
    }
  }
  return out;
}
