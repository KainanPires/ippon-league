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
import { competicaoPorId } from "@/lib/copa";

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

  // Janela início→fim da liga de amigos (Peça 4). Só as ligas de pontos corridos
  // com início/fim definidos a têm; oficiais e ligas antigas (campos NULL) ficam
  // sem janela e contam tudo, como antes. `limiteEfetivo`: para fim por mês é o
  // FIM do mês de fim (a competição desse mês ainda conta), para fim por competição
  // é a data dessa competição.
  let janelaIni: Date | null = null;
  let janelaFim: Date | null = null;

  if (league_id) {
    // LIGA DE AMIGOS: membros da liga.
    const { data: membros } = await supabaseAdmin
      .from("league_members")
      .select("user_id")
      .eq("league_id", league_id);
    userIds = (membros || []).map((m) => String(m.user_id));

    // Lê a janela desta liga (se tiver).
    const { data: ligaRow } = await supabaseAdmin
      .from("leagues")
      .select("liga_competicao_inicial, fim_tipo, fim_valor, fim_data")
      .eq("id", league_id)
      .maybeSingle();
    if (ligaRow) {
      const compIni = competicaoPorId(String(ligaRow.liga_competicao_inicial || ""));
      if (compIni) janelaIni = new Date(compIni.de.replace(/\//g, "-") + "T00:00:00");
      const fimTipo = String(ligaRow.fim_tipo || "");
      if (fimTipo === "mes") {
        // fim_valor = "AAAA-MM" → último instante desse mês (a competição do mês conta).
        const m = /^(\d{4})-(\d{2})$/.exec(String(ligaRow.fim_valor || ""));
        if (m) {
          const ano = Number(m[1]);
          const mesIdx = Number(m[2]) - 1;
          // dia 0 do mês seguinte = último dia deste mês.
          janelaFim = new Date(ano, mesIdx + 1, 0, 23, 59, 59);
        }
      } else if (fimTipo === "competicao") {
        const compFim = competicaoPorId(String(ligaRow.fim_valor || ""));
        if (compFim) janelaFim = new Date(compFim.de.replace(/\//g, "-") + "T23:59:59");
      }
      // Recurso: se não deu para derivar pela intenção, usa a fim_data crua.
      if (!janelaFim && ligaRow.fim_data) {
        const d = new Date(String(ligaRow.fim_data));
        if (!isNaN(d.getTime())) janelaFim = d;
      }
    }
  } else if (tipo === "mundial" || tipo === "continental") {
    // OFICIAL: utilizadores Pro (filtrados por continente na continental).
    // ÉPOCA ANUAL: a liga oficial conta só os pontos do ANO CIVIL corrente
    // (1/jan–31/dez). A 1/jan o ranking recomeça do zero. Reutilizamos o
    // mecanismo de janela (janelaIni/janelaFim + dentroDaJanela) já existente.
    const anoAtual = new Date().getFullYear();
    janelaIni = new Date(anoAtual, 0, 1, 0, 0, 0);        // 1 de janeiro
    janelaFim = new Date(anoAtual, 11, 31, 23, 59, 59);   // 31 de dezembro
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
  // Uma competição conta para esta liga? Fora da janela início→fim → não conta.
  // Sem janela (oficiais / ligas antigas) → conta sempre. Competições que não
  // estão no calendário (data desconhecida) contam, para não perder pontos.
  function dentroDaJanela(idComp: string): boolean {
    if (!janelaIni && !janelaFim) return true;
    const c = competicaoPorId(idComp);
    if (!c) return true;
    const d = new Date(c.de.replace(/\//g, "-") + "T12:00:00");
    if (isNaN(d.getTime())) return true;
    if (janelaIni && d < janelaIni) return false;
    if (janelaFim && d > janelaFim) return false;
    return true;
  }

  const { data: rodadas } = await supabaseAdmin
    .from("resultados_rodada")
    .select("user_id, pontos_rodada, id_competicao")
    .in("user_id", userIds);

  const geralPorUser = new Map<string, number>();
  for (const r of rodadas || []) {
    const u = String(r.user_id);
    if (String(r.id_competicao) === comp) continue; // a atual entra ao vivo
    if (!dentroDaJanela(String(r.id_competicao))) continue; // fora da janela da liga
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
  // A competição atual conta para esta liga? (Se já é depois do fim da liga, ou
  // antes do início, a rodada ao vivo não entra no geral desta liga.)
  const atualNaJanela = dentroDaJanela(comp);

  const linhas: MembroGeral[] = userIds.map((uid) => {
    const eq = equipaDe.get(uid);
    // Rodada ao vivo (só se escalou nesta competição E ela está na janela da liga).
    let pontosRodada = 0;
    let escalou = false;
    if (eq && eq.atletas.length > 0 && atualNaJanela) {
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
