// app/api/pontuacoes/registar/route.ts
//
// REGISTAR PONTUACOES DE UMA COMPETICAO (servidor, chave secreta).
//
// Para uma competicao TERMINADA, calcula quantos pontos cada JOGADOR fez com a
// sua equipa (8 atletas + capitao a dobrar) e grava na tabela `pontuacoes`.
// E a base das FAIXAS (somar por mes) e do RANKING GERAL (somar por ano).
//
// IDEMPOTENTE: upsert em (user_id, id_competicao). Registar a mesma competicao
// duas vezes nao duplica - so atualiza os pontos (caso a competicao ainda decorra
// e os pontos mudem, o ultimo registo prevalece).
//
// Recebe (POST): { comp } (id_competition do JudoBase)
// Devolve: { ok, comp, mes, registados, tem_resultados }
//
// So grava se a competicao ja tiver lutas (resultados). Se ainda nao comecou
// (nenhum atleta escalado tem lutas), nao grava nada e devolve tem_resultados:false.
//
// ---------------------------------------------------------------------------
// FONTE DOS PONTOS - LER ANTES DE MEXER
//
// Pontua via competitor.contests (as lutas DE CADA ATLETA, filtradas por
// competicao), igual ao /api/resultados no modo por_atleta, ao lib/congelar.ts,
// ao /api/liga e ao /api/liga/geral.
//
// NAO usar competition.contests aqui. Esse endpoint vem INCOMPLETO durante e
// logo apos o evento: devolve so algumas categorias, deixando a 0 atletas que
// ja lutaram. Como esta rota ESCREVE, o erro nao se corrige ao recarregar - fica
// gravado. Na competicao 1746 uma equipa valia 107 e era contada como 0.
//
// ATENCAO: esta rota e o lib/congelar.ts escrevem AMBOS em `pontuacoes`, com a
// mesma chave de conflito. Quem correr por ultimo prevalece. Enquanto os dois
// existirem, tem de usar a MESMA fonte de pontos, senao um desfaz o outro.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getCompetitorContests, scoreContestForPerson, type IjfContest } from "@/lib/ijf";
import { CALENDARIO_2026 } from "@/lib/calendario";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// "2026/06/13" -> "2026-06" (mes da competicao, para somar faixas por mes).
function mesDaCompeticao(comp: string): string | null {
  const s = CALENDARIO_2026.find((c) => c.idCompeticao === comp);
  if (!s) return null;
  // s.de vem como "AAAA/MM/DD"; o mes sao os primeiros 7 chars com "-".
  return s.de.slice(0, 7).replace("/", "-");
}

export async function POST(req: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ ok: false, erro: "Servidor sem ligacao." }, { status: 500 });
  }

  let corpo: { comp?: string };
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ ok: false, erro: "Pedido invalido." }, { status: 400 });
  }

  const comp = (corpo.comp || "").trim();
  if (!comp) return NextResponse.json({ ok: false, erro: "Falta comp." }, { status: 400 });

  const mes = mesDaCompeticao(comp);
  if (!mes) return NextResponse.json({ ok: false, erro: "Competicao nao esta no calendario." }, { status: 404 });

  // 1) Todas as equipas escaladas NESTA competicao (qualquer jogador).
  //    Vem primeiro: sao elas que dizem que atletas e preciso pontuar.
  const { data: equipas } = await supabaseAdmin
    .from("equipas")
    .select("user_id, atletas, capitao")
    .eq("id_competicao", comp);

  const lista = equipas || [];
  if (lista.length === 0) {
    return NextResponse.json({ ok: true, comp, mes, registados: 0, tem_resultados: false });
  }

  // 2) Pontos por atleta, so dos que alguem escalou, e cada id uma unica vez.
  const idsNecessarios = new Set<string>();
  for (const e of lista) {
    const ids = Array.isArray(e.atletas) ? (e.atletas as string[]).map(String) : [];
    for (const aid of ids) idsNecessarios.add(aid);
  }

  const { pontos: pontosAtleta, nLutas } = await pontuacaoPorAtletas(Array.from(idsNecessarios), comp);

  // 3) Sem lutas nenhumas -> a competicao ainda nao comecou. Nao grava nada.
  //    (Antes este teste era contests.length === 0 sobre a competicao inteira.)
  if (nLutas === 0) {
    return NextResponse.json({ ok: true, comp, mes, registados: 0, tem_resultados: false });
  }

  // 4) Calcula os pontos de cada jogador e prepara as linhas para upsert.
  const linhas = lista.map((e) => {
    const ids = Array.isArray(e.atletas) ? (e.atletas as string[]).map(String) : [];
    const capitao = e.capitao ? String(e.capitao) : null;

    let total = 0;
    for (const aid of ids) {
      const p = pontosAtleta[aid] ?? 0;
      total += p;
      if (capitao && aid === capitao) total += p; // capitao a dobrar
    }

    return {
      user_id: e.user_id,
      id_competicao: comp,
      pontos: Math.round(total * 10) / 10,
      mes,
      atualizada_em: new Date().toISOString(),
    };
  });

  // 5) Upsert na chave unica (user_id, id_competicao): nao duplica, atualiza.
  const { error } = await supabaseAdmin
    .from("pontuacoes")
    .upsert(linhas, { onConflict: "user_id,id_competicao" });

  if (error) {
    return NextResponse.json({ ok: false, erro: "Nao foi possivel gravar as pontuacoes." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, comp, mes, registados: linhas.length, tem_resultados: true });
}

// ---------------------------------------------------------------------------
// PONTUACAO POR ATLETA (ver a nota da fonte no cabecalho).
// Devolve tambem quantas lutas foram encontradas, para saber se a competicao
// ja comecou - o teste que antes se fazia com competition.contests.
// ---------------------------------------------------------------------------
async function pontuacaoPorAtletas(
  ids: string[],
  comp: string
): Promise<{ pontos: Record<string, number>; nLutas: number }> {
  const pontos: Record<string, number> = {};
  let nLutas = 0;
  if (ids.length === 0) return { pontos, nLutas };

  // Em lotes, para nao abrir uma ligacao por atleta de uma vez so.
  const LOTE = 8;
  for (let i = 0; i < ids.length; i += LOTE) {
    const lote = ids.slice(i, i + LOTE);
    await Promise.all(
      lote.map(async (id) => {
        try {
          const todas: IjfContest[] = (await getCompetitorContests(id)) || [];
          const desta = todas.filter((f) => String(f.id_competition) === comp);
          let soma = 0;
          for (const f of desta) soma += scoreContestForPerson(f, id);
          pontos[id] = Math.round(soma * 10) / 10;
          nLutas += desta.length;
        } catch {
          pontos[id] = 0;
        }
      })
    );
  }

  return { pontos, nLutas };
}
