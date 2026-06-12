// app/api/copa/apurar/route.ts
//
// APURAMENTO DE RONDA DA COPA IPPON (servidor, chave secreta).
//
// Disparo "preguiçoso": a página da liga chama esta rota quando deteta que a
// copa está sorteada/a decorrer e a competição da ronda atual já terminou.
// IDEMPOTENTE: se a ronda atual ainda tem competição a decorrer, ou já está toda
// decidida e a seguinte já existe, não duplica nada.
//
// O que faz:
//   1) encontra a ronda mais baixa com confrontos PENDENTES
//   2) confirma que a competição dessa ronda já terminou (tem resultados)
//   3) para cada confronto pendente: calcula os pontos de cada jogador
//      (mesma lógica do ranking: equipa na competição, capitão a dobrar) e
//      decide o vencedor com o desempate em cascata (pontos → capitão → sorteio)
//   4) quando a ronda fica toda decidida, gera a ronda seguinte (final+bronze
//      nas semifinais); se era a final, marca a copa como terminada
//
// Recebe (POST): { league_id }
// Devolve: { ok, apurou, ronda, decididos, gerouProxima, terminada }
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getCompetitionContests, scoreContestSide } from "@/lib/ijf";
import { decidirConfronto, gerarRondaSeguinte, idCompeticaoSeguinte, type PontosJogador, type ConfrontoDB } from "@/lib/copa";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Pontos de cada atleta (id_person) numa competição — igual ao /api/resultados.
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
  return { ...pontos, __n_lutas: contests.length } as Record<string, number>;
}

export async function POST(req: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ ok: false, erro: "Servidor sem ligação." }, { status: 500 });
  }

  let corpo: { league_id?: string };
  try { corpo = await req.json(); } catch {
    return NextResponse.json({ ok: false, erro: "Pedido inválido." }, { status: 400 });
  }
  const league_id = (corpo.league_id || "").trim();
  if (!league_id) return NextResponse.json({ ok: false, erro: "Falta league_id." }, { status: 400 });

  // Liga é copa e já sorteada?
  const { data: liga } = await supabaseAdmin
    .from("leagues")
    .select("id, formato, copa_estado")
    .eq("id", league_id)
    .maybeSingle();
  if (!liga) return NextResponse.json({ ok: false, erro: "Liga não encontrada." }, { status: 404 });
  if (liga.formato !== "copa") return NextResponse.json({ ok: false, erro: "Não é uma copa." }, { status: 400 });
  if (liga.copa_estado !== "sorteada" && liga.copa_estado !== "a_decorrer") {
    return NextResponse.json({ ok: true, apurou: false, estado: liga.copa_estado });
  }

  // 1) Todos os confrontos da liga.
  const { data: todos } = await supabaseAdmin
    .from("copa_confrontos")
    .select("id, ronda, ordem, fase, jogador_a, jogador_b, id_competicao, vencedor, estado")
    .eq("league_id", league_id)
    .order("ronda", { ascending: true })
    .order("ordem", { ascending: true });

  const confrontos = todos || [];
  if (confrontos.length === 0) {
    return NextResponse.json({ ok: false, erro: "Esta copa ainda não tem chave." }, { status: 400 });
  }

  // A ronda mais baixa com algum confronto PENDENTE.
  const pendentes = confrontos.filter((c) => c.estado === "pendente");
  if (pendentes.length === 0) {
    return NextResponse.json({ ok: true, apurou: false, semPendentes: true, estado: liga.copa_estado });
  }
  const rondaAtual = Math.min(...pendentes.map((c) => c.ronda));
  const confrontosRonda = confrontos.filter((c) => c.ronda === rondaAtual);
  const pendentesRonda = confrontosRonda.filter((c) => c.estado === "pendente");

  // A competição desta ronda (todos os confrontos da ronda têm a mesma).
  const comp = pendentesRonda[0].id_competicao;
  if (!comp) return NextResponse.json({ ok: false, erro: "Ronda sem competição definida." }, { status: 400 });

  // 2) A competição já terminou? (tem lutas/resultados). Se não, ainda não apura.
  const pontosAtletaRaw = await pontuacaoDaCompeticao(comp);
  const nLutas = (pontosAtletaRaw.__n_lutas as number) || 0;
  delete (pontosAtletaRaw as Record<string, number>).__n_lutas;
  if (nLutas === 0) {
    return NextResponse.json({ ok: true, apurou: false, aDecorrer: true, ronda: rondaAtual });
  }

  // Marca como "a decorrer" assim que começamos a apurar a 1ª ronda.
  if (liga.copa_estado === "sorteada") {
    await supabaseAdmin.from("leagues").update({ copa_estado: "a_decorrer" }).eq("id", league_id);
  }

  // 3) Calcular os pontos de cada JOGADOR (equipa) envolvido nesta ronda.
  const jogadores = new Set<string>();
  for (const c of pendentesRonda) {
    if (c.jogador_a) jogadores.add(c.jogador_a);
    if (c.jogador_b) jogadores.add(c.jogador_b);
  }
  const pontosJogador = await pontosPorJogador(Array.from(jogadores), comp, pontosAtletaRaw);

  // Decide cada confronto pendente e grava.
  let decididos = 0;
  for (const c of pendentesRonda) {
    // Confronto com bye (jogador_b null) já deve estar decidido; salvaguarda.
    if (!c.jogador_b) {
      await supabaseAdmin.from("copa_confrontos").update({
        vencedor: c.jogador_a, decidido_por: "bye", estado: "decidido",
      }).eq("id", c.id);
      decididos++;
      continue;
    }
    const pa = pontosJogador[c.jogador_a] ?? { total: 0, capitao: 0, escalou: false };
    const pb = pontosJogador[c.jogador_b] ?? { total: 0, capitao: 0, escalou: false };
    const r = decidirConfronto(c.jogador_a, c.jogador_b, pa, pb);
    await supabaseAdmin.from("copa_confrontos").update({
      pontos_a: r.pontos_a,
      pontos_b: r.pontos_b,
      vencedor: r.vencedor,
      decidido_por: r.decidido_por,
      estado: "decidido",
    }).eq("id", c.id);
    decididos++;
  }

  // 4) A ronda ficou toda decidida? Releio os vencedores reais da base de dados
  // (mais seguro que reconstruir em memória) e, se sim, gero a ronda seguinte.
  const { data: rondaFinal } = await supabaseAdmin
    .from("copa_confrontos")
    .select("ronda, ordem, fase, jogador_a, jogador_b, vencedor, estado")
    .eq("league_id", league_id)
    .eq("ronda", rondaAtual)
    .order("ordem", { ascending: true });

  const todaDecidida = (rondaFinal || []).every((c) => c.estado === "decidido");
  let gerouProxima = false;
  let terminada = false;

  if (todaDecidida) {
    const eraFinal = (rondaFinal || []).some((c) => c.fase === "final");
    if (eraFinal) {
      await supabaseAdmin.from("leagues").update({ copa_estado: "terminada" }).eq("id", league_id);
      terminada = true;
    } else {
      // Gera a ronda seguinte na competição seguinte do calendário.
      const idProxima = idCompeticaoSeguinte(comp);
      if (idProxima) {
        const novos = gerarRondaSeguinte(rondaFinal as ConfrontoDB[], idProxima);
        if (novos.length > 0) {
          const linhas = novos.map((n) => ({
            league_id,
            ronda: n.ronda,
            ordem: n.ordem,
            fase: n.fase,
            jogador_a: n.jogador_a,
            jogador_b: n.jogador_b,
            id_competicao: n.id_competicao,
            estado: "pendente",
            // bye na ronda seguinte já fica decidido
            ...(n.jogador_b === null ? { vencedor: n.jogador_a, decidido_por: "bye", estado: "decidido" } : {}),
          }));
          await supabaseAdmin.from("copa_confrontos").insert(linhas);
          gerouProxima = true;
        }
      }
    }
  }

  return NextResponse.json({
    ok: true,
    apurou: true,
    ronda: rondaAtual,
    decididos,
    todaDecidida,
    gerouProxima,
    terminada,
  });
}

// Para cada jogador, calcula os pontos da equipa dele na competição (capitão a
// dobrar) e os pontos BASE do capitão (para o desempate). Mesma lógica do ranking.
async function pontosPorJogador(
  userIds: string[],
  comp: string,
  pontosAtleta: Record<string, number>
): Promise<Record<string, PontosJogador>> {
  const out: Record<string, PontosJogador> = {};
  if (!supabaseAdmin || userIds.length === 0) return out;

  const { data: equipas } = await supabaseAdmin
    .from("equipas")
    .select("user_id, atletas, capitao")
    .eq("id_competicao", comp)
    .in("user_id", userIds);

  const equipaDe = new Map<string, { atletas: string[]; capitao: string | null }>();
  for (const e of equipas || []) {
    const ids = Array.isArray(e.atletas) ? (e.atletas as string[]).map(String) : [];
    equipaDe.set(e.user_id, { atletas: ids, capitao: e.capitao ? String(e.capitao) : null });
  }

  for (const uid of userIds) {
    const eq = equipaDe.get(uid);
    if (!eq || eq.atletas.length === 0) {
      out[uid] = { total: 0, capitao: 0, escalou: false };
      continue;
    }
    let total = 0;
    let pontosCapitao = 0;
    for (const aid of eq.atletas) {
      const p = pontosAtleta[aid] ?? 0;
      total += p;
      if (eq.capitao && aid === eq.capitao) {
        total += p; // capitão a dobrar no total
        pontosCapitao = p; // base, para o desempate
      }
    }
    out[uid] = {
      total: Math.round(total * 10) / 10,
      capitao: Math.round(pontosCapitao * 10) / 10,
      escalou: true,
    };
  }
  return out;
}
