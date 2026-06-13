// app/api/pontuacoes/registar/route.ts
//
// REGISTAR PONTUAÇÕES DE UMA COMPETIÇÃO (servidor, chave secreta).
//
// Para uma competição TERMINADA, calcula quantos pontos cada JOGADOR fez com a
// sua equipa (8 atletas + capitão a dobrar) e grava na tabela `pontuacoes`.
// É a base das FAIXAS (somar por mês) e do RANKING GERAL (somar por ano).
//
// IDEMPOTENTE: upsert em (user_id, id_competicao). Registar a mesma competição
// duas vezes não duplica — só atualiza os pontos (caso a competição ainda decorra
// e os pontos mudem, o último registo prevalece).
//
// Recebe (POST): { comp }   (id_competition do JudoBase)
// Devolve: { ok, comp, mes, registados, tem_resultados }
//
// Só grava se a competição já tiver lutas (resultados). Se ainda não começou
// (mapa de pontos vazio), não grava nada e devolve tem_resultados:false.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getCompetitionContests, scoreContestSide } from "@/lib/ijf";
import { CALENDARIO_2026 } from "@/lib/calendario";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// "2026/06/13" -> "2026-06" (mês da competição, para somar faixas por mês).
function mesDaCompeticao(comp: string): string | null {
  const s = CALENDARIO_2026.find((c) => c.idCompeticao === comp);
  if (!s) return null;
  // s.de vem como "AAAA/MM/DD"; o mês são os primeiros 7 chars com "-".
  return s.de.slice(0, 7).replace("/", "-");
}

export async function POST(req: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ ok: false, erro: "Servidor sem ligação." }, { status: 500 });
  }

  let corpo: { comp?: string };
  try { corpo = await req.json(); } catch {
    return NextResponse.json({ ok: false, erro: "Pedido inválido." }, { status: 400 });
  }
  const comp = (corpo.comp || "").trim();
  if (!comp) return NextResponse.json({ ok: false, erro: "Falta comp." }, { status: 400 });

  const mes = mesDaCompeticao(comp);
  if (!mes) return NextResponse.json({ ok: false, erro: "Competição não está no calendário." }, { status: 404 });

  // 1) Pontos por atleta (id_person) nesta competição. Se vazio, não terminou.
  const contests = await getCompetitionContests(comp);
  if (contests.length === 0) {
    return NextResponse.json({ ok: true, comp, mes, registados: 0, tem_resultados: false });
  }
  const pontosAtleta: Record<string, number> = {};
  for (const f of contests) {
    const lados: ["b" | "w", string][] = [
      ["b", String(f.id_person_blue ?? "")],
      ["w", String(f.id_person_white ?? "")],
    ];
    for (const [side, id] of lados) {
      if (!id) continue;
      pontosAtleta[id] = (pontosAtleta[id] ?? 0) + scoreContestSide(f, side);
    }
  }

  // 2) Todas as equipas escaladas NESTA competição (qualquer jogador).
  const { data: equipas } = await supabaseAdmin
    .from("equipas")
    .select("user_id, atletas, capitao")
    .eq("id_competicao", comp);

  const lista = equipas || [];
  if (lista.length === 0) {
    return NextResponse.json({ ok: true, comp, mes, registados: 0, tem_resultados: true });
  }

  // 3) Calcula os pontos de cada jogador e prepara as linhas para upsert.
  const linhas = lista.map((e) => {
    const ids = Array.isArray(e.atletas) ? (e.atletas as string[]).map(String) : [];
    const capitao = e.capitao ? String(e.capitao) : null;
    let total = 0;
    for (const aid of ids) {
      const p = pontosAtleta[aid] ?? 0;
      total += p;
      if (capitao && aid === capitao) total += p; // capitão a dobrar
    }
    return {
      user_id: e.user_id,
      id_competicao: comp,
      pontos: Math.round(total * 10) / 10,
      mes,
      atualizada_em: new Date().toISOString(),
    };
  });

  // 4) Upsert na chave única (user_id, id_competicao): não duplica, atualiza.
  const { error } = await supabaseAdmin
    .from("pontuacoes")
    .upsert(linhas, { onConflict: "user_id,id_competicao" });

  if (error) {
    return NextResponse.json({ ok: false, erro: "Não foi possível gravar as pontuações." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, comp, mes, registados: linhas.length, tem_resultados: true });
}
