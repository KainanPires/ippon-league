// app/api/liga/geral/route.ts
//
// RANKING GERAL (ACUMULADO) — AO VIVO — de um conjunto de utilizadores.
// Servidor, chave secreta (supabaseAdmin). Serve as ligas oficiais (Mundial/
// Continental) E as ligas de amigos, conforme o "alvo" pedido.
//
// O QUE É O "GERAL AO VIVO" (decidido com o Kainan):
//   Geral = (Σ pontos das rodadas JÁ FECHADAS, da tabela resultados_rodada)
//         + (pontos da rodada que DECORRE agora, ao vivo do IJF)
//   Assim o acumulado sobe em tempo real durante a competição e, quando ela
//   congela, esse valor passa a fazer parte do histórico — nada salta nem se
//   perde. A rodada a decorrer só é somada uma vez (ver "comp" e "evitar duplo").
//
// JUDOCOINS: vem de users.patrimony_jc (preenchido pelo congelar.ts). É o
// património ATUAL de cada jogador. Devolvido em cada linha para a vista "JC"
// das ligas de amigos (as oficiais ignoram-no).
//
// Recebe (GET), por um de dois modos de "alvo":
//   • Liga de amigos:  ?league=<league_id>&comp=<id_competicao>
//   • Oficial:         ?tipo=mundial|continental&user_id=<uuid>&comp=<id_competicao>
//
// Devolve:
//   { ok, membros: [{ user_id, nome_time, escudo, pontos_geral, pontos_rodada,
//                     patrimonio, escalou, posicao, is_pro }] }
//   - pontos_geral  : acumulado ao vivo (histórico + rodada atual)
//   - pontos_rodada : só a rodada que decorre/decorreu (ao vivo do IJF)
//   - patrimonio    : users.patrimony_jc (para a vista Judocoins)
//
// A app pode ordenar pelo campo que quiser (geral, rodada, ou património).
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getCompetitionContests, scoreContestSide } from "@/lib/ijf";
import { NOME_CONTINENTE, type Continente } from "@/lib/continentes";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Teto de participantes nas oficiais (proteção). Amigos não tem teto prático.
const LIMITE_OFICIAL = 1000;

interface MembroGeral {
  user_id: string;
  nome_time: string;
  escudo: unknown;
  pontos_geral: number;   // acumulado ao vivo
  pontos_rodada: number;  // só a rodada atual (ao vivo)
  patrimonio: number;     // users.patrimony_jc
  escalou: boolean;       // tem equipa nesta rodada?
  posicao: number;        // posição no GERAL (1 = líder)
  is_pro: boolean;
}

export async function GET(req: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ ok: false, erro: "Servidor sem ligação." }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const league_id = (searchParams.get("league") || "").trim();
  const tipo = (searchParams.get("tipo") || "").trim();
  const user_id = (searchParams.get("user_id") || "").trim();
  const comp = (searchParams.get("comp") || "").trim();

  if (!comp) return NextResponse.json({ ok: false, erro: "Falta ?comp=<id_competicao>." }, { status: 400 });

  // -------------------------------------------------------------------------
  // 1) Quem são os participantes? Dois modos de alvo.
  // -------------------------------------------------------------------------
  let userIds: string[] = [];
  let nomeContinente: string | null = null;
  let continente: Continente | null = null;

  if (league_id) {
    // LIGA DE AMIGOS: membros da liga.
    const { data: membros } = await supabaseAdmin
      .from("league_members")
      .select("user_id")
      .eq("league_id", league_id);
    userIds = (membros || []).map((m) => String(m.user_id));
  } else if (tipo === "mundial" || tipo === "continental") {
    // OFICIAL: utilizadores Pro (filtrados por continente na continental).
    if (tipo === "continental") {
      if (!user_id) return NextResponse.json({ ok: false, erro: "Falta ?user_id= para a continental." }, { status: 400 });
      const { data: eu } = await supabaseAdmin
        .from("users")
        .select("continente")
        .eq("id", user_id)
        .maybeSingle();
      continente = (eu?.continente as Continente | null) ?? null;
      if (!continente) {
        return NextResponse.json({ ok: true, tipo, continente: null, nomeContinente: null, membros: [], semContinente: true });
      }
      nomeContinente = NOME_CONTINENTE[continente];
    }
    let q = supabaseAdmin.from("users").select("id").eq("is_pro", true).limit(LIMITE_OFICIAL);
    if (tipo === "continental" && continente) q = q.eq("continente", continente);
    const { data: pros } = await q;
    userIds = (pros || []).map((p) => String(p.id));
  } else {
    return NextResponse.json({ ok: false, erro: "Indica ?league= (amigos) ou ?tipo= (oficial)." }, { status: 400 });
  }

  if (userIds.length === 0) {
    return NextResponse.json({ ok: true, tipo: tipo || "amigos", continente, nomeContinente, membros: [] });
  }

  // -------------------------------------------------------------------------
  // 2) HISTÓRICO FECHADO: soma de pontos_rodada por utilizador, de TODAS as
  //    rodadas já congeladas. EXCLUI a competição que decorre agora (comp), para
  //    não a contar duas vezes (ela entra ao vivo no passo 4).
  // -------------------------------------------------------------------------
  const { data: rodadas } = await supabaseAdmin
    .from("resultados_rodada")
    .select("user_id, pontos_rodada, id_competicao")
    .in("user_id", userIds);

  const geralPorUser = new Map<string, number>();
  for (const r of rodadas || []) {
    const u = String(r.user_id);
    if (String(r.id_competicao) === comp) continue; // a atual entra ao vivo
    geralPorUser.set(u, (geralPorUser.get(u) ?? 0) + Number(r.pontos_rodada ?? 0));
  }

  // -------------------------------------------------------------------------
  // 3) Equipas destes utilizadores NA competição atual (para a rodada ao vivo).
  // -------------------------------------------------------------------------
  const { data: equipas } = await supabaseAdmin
    .from("equipas")
    .select("user_id, nome, escudo, atletas, capitao")
    .eq("id_competicao", comp)
    .in("user_id", userIds);

  const equipaDe = new Map<string, { nome: string; escudo: unknown; atletas: string[]; capitao: string | null }>();
  for (const e of equipas || []) {
    const ids = Array.isArray(e.atletas) ? (e.atletas as string[]).map(String) : [];
    equipaDe.set(String(e.user_id), { nome: e.nome ?? "Equipa", escudo: e.escudo ?? null, atletas: ids, capitao: e.capitao ? String(e.capitao) : null });
  }

  // -------------------------------------------------------------------------
  // 4) RODADA AO VIVO: pontos de cada atleta na competição atual (uma ida ao IJF).
  // -------------------------------------------------------------------------
  const pontosPorAtleta = await pontuacaoDaCompeticao(comp);

  // -------------------------------------------------------------------------
  // 5) Património atual (Judocoins) + nome/escudo de quem não escalou agora.
  //    Buscamos users.patrimony_jc e, como recurso para o nome/escudo de quem
  //    não tem equipa nesta rodada, lemos também a sua identidade na tabela users.
  // -------------------------------------------------------------------------
  const { data: usersRows } = await supabaseAdmin
    .from("users")
    .select("id, name, patrimony_jc, is_pro")
    .in("id", userIds);
  const patrimonioDe = new Map<string, number>();
  const nomeContaDe = new Map<string, string>();
  const proDe = new Map<string, boolean>();
  for (const u of usersRows || []) {
    patrimonioDe.set(String(u.id), Number(u.patrimony_jc ?? 100));
    if (u.name) nomeContaDe.set(String(u.id), String(u.name));
    proDe.set(String(u.id), !!u.is_pro);
  }
  // Nome/escudo preferenciais: o da equipa de QUALQUER rodada (mais fiável que
  // users.name). Buscamos uma linha de equipa por utilizador para o cartão.
  const { data: idents } = await supabaseAdmin
    .from("equipas")
    .select("user_id, nome, escudo")
    .in("user_id", userIds);
  const identDe = new Map<string, { nome: string; escudo: unknown }>();
  for (const e of idents || []) {
    if (!identDe.has(String(e.user_id)) && (e.nome || e.escudo)) {
      identDe.set(String(e.user_id), { nome: e.nome ?? "Equipa", escudo: e.escudo ?? null });
    }
  }

  // -------------------------------------------------------------------------
  // 6) Monta cada linha: geral = histórico + rodada ao vivo.
  // -------------------------------------------------------------------------
  const linhas: MembroGeral[] = userIds.map((uid) => {
    const eq = equipaDe.get(uid);
    // Rodada ao vivo (só se escalou nesta competição).
    let pontosRodada = 0;
    let escalou = false;
    if (eq && eq.atletas.length > 0) {
      escalou = true;
      for (const aid of eq.atletas) {
        const p = pontosPorAtleta[aid] ?? 0;
        pontosRodada += p;
        if (eq.capitao && aid === eq.capitao) pontosRodada += p; // capitão a dobrar
      }
    }
    pontosRodada = Math.round(pontosRodada * 10) / 10;

    const historico = geralPorUser.get(uid) ?? 0;
    const geral = Math.round((historico + pontosRodada) * 10) / 10;

    // Nome/escudo: o da equipa desta rodada > o de qualquer equipa > o da conta.
    const ident = eq ?? identDe.get(uid);
    const nome = ident?.nome ?? nomeContaDe.get(uid) ?? "—";
    const escudo = (ident as { escudo?: unknown } | undefined)?.escudo ?? null;

    return {
      user_id: uid,
      nome_time: nome,
      escudo,
      pontos_geral: geral,
      pontos_rodada: pontosRodada,
      patrimonio: Math.round((patrimonioDe.get(uid) ?? 100) * 10) / 10,
      escalou,
      posicao: 0,
      is_pro: proDe.get(uid) ?? false,
    };
  });

  // -------------------------------------------------------------------------
  // 7) Posição pelo GERAL (líder = mais pontos acumulados). Empates partilham.
  //    Quem nunca pontuou (geral 0 e não escalou) vai para o fundo, mas mantém-se
  //    na lista para a pessoa se ver.
  // -------------------------------------------------------------------------
  linhas.sort((a, b) => b.pontos_geral - a.pontos_geral);
  for (const l of linhas) {
    l.posicao = linhas.filter((o) => o.pontos_geral > l.pontos_geral).length + 1;
  }

  return NextResponse.json({ ok: true, tipo: tipo || "amigos", continente, nomeContinente, comp, membros: linhas });
}

// Soma, por atleta (id_person), os pontos de todas as lutas da competição.
// (Mesma fonte e regras das outras rotas de ranking — números consistentes.)
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
