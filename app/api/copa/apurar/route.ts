// app/api/copa/apurar/route.ts
//
// APURAMENTO DE RONDA DA COPA IPPON (servidor, chave secreta).
//
// Disparado por: (1) o cron, após congelar as competições (automático), e
// (2) a página da liga (disparo preguiçoso ao abrir). IDEMPOTENTE: se a ronda
// atual ainda tem competição a decorrer, ou já está decidida e a seguinte já
// existe, não duplica nada.
//
// MOTOR (Fase 2+3): usa gerarRondaSeguinteComRepescagem (lib/copa) — eliminação +
// repescagem em paralelo com as semis + bloco final com 2 bronzes cruzados. A
// escalação de cada confronto é decidida pela cascata (pontos -> capitão ->
// sorteio) e os pontos vêm de resultados_atletas (CONGELADO pelo motor
// lib/congelar). A `metade` (lado da chave) é lida e propagada para a
// repescagem/cruzamento funcionarem; a `fase` aceita o valor "repescagem".
//
// ---------------------------------------------------------------------------
// A FINAL — JANELA DO ACUMULADO (regra decidida com o Kainan; MUDOU)
//
// ANTES (errado): a final somava a competição da final com a da SEMIFINAL —
// olhava para TRÁS. Isso fazia o título depender de rondas já jogadas, e até
// premiava quem teve bye (passou sem lutar mas levava os pontos dessa rodada).
//
// AGORA: a janela do acumulado ABRE NA FINAL e vai PARA A FRENTE.
//   • Os finalistas ficam conhecidos mais cedo do que os medalhistas de bronze,
//     porque a repescagem ainda está a decorrer. Esse tempo de espera não é
//     tempo morto: cada competição que acontece durante a espera conta para os
//     dois finalistas.
//   • O último dia da repescagem é também o último dia de fazer pontos na final.
//   • Nada do que fizeram nos quartos ou nas semifinais conta para o título.
//
// Na prática isto traduz-se em duas regras no código:
//   1) A final SÓ é decidida quando não sobra mais nenhum confronto pendente na
//      copa (a repescagem e os bronzes decidem-se primeiro). Até lá fica
//      pendente, à espera.
//   2) Quando é decidida, somam-se os pontos dos finalistas em TODAS as
//      competições da janela: da competição da final (inclusive) até à última
//      competição usada por qualquer confronto desta copa. Se alguma dessas
//      competições ainda não estiver congelada, a final espera mais.
//
// Numa chave pequena (final e bronze na mesma competição) a janela tem uma só
// competição — a final vale pela sua própria rodada, como se espera.
// ---------------------------------------------------------------------------
//
// HERANÇA DE EQUIPA (regra decidida com o Kainan)
// Quem não montar equipa numa rodada NÃO fica zerado: herda a última equipa que
// guardou, e continua a herdá-la sucessivamente até salvar uma nova. Só os
// atletas que lutaram nessa competição pontuam (os outros valem 0, naturalmente,
// porque não estão em resultados_atletas). A ordem "última equipa" é a do
// CALENDÁRIO (semana da rodada), não a ordem alfabética dos ids.
//
// O que faz:
//   1) encontra a ronda mais baixa com confrontos PENDENTES
//   2) confirma que a competição dessa ronda já está CONGELADA — se não, não apura
//   3) decide os confrontos NÃO-finais dessa ronda
//   4) se já não sobrar nada pendente, decide a FINAL pela janela acumulada
//   5) quando a ronda fica toda decidida, gera a ronda seguinte (com repescagem)
//
// Recebe (POST): { league_id }
// Devolve: { ok, apurou, ronda, decididos, gerouProxima, terminada, finalAEsperar }
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { decidirConfronto, gerarRondaSeguinteComRepescagem, idCompeticaoSeguinte, type PontosJogador, type ConfrontoRonda } from "@/lib/copa";
import { numeroDaRodada } from "@/lib/calendario";
import { criarNotificacaoServidor } from "@/lib/notificacoesServidor";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Ordem CRONOLÓGICA de uma competição (a sua semana no calendário). É o que
// permite dizer "esta rodada é anterior àquela" sem depender do id (os
// clássicos têm ids baixos mas podem estar no fim do ano). -1 = desconhecida.
function ordemDaComp(idComp: string): number {
  const n = numeroDaRodada(String(idComp));
  return n ?? -1;
}

// Pontos de cada atleta (id_person) numa competição — LÊ DO CONGELADO
// (resultados_atletas). Devolve o mapa e o nº de atletas (para saber se já congelou).
async function pontuacaoCongelada(comp: string): Promise<{ pontos: Record<string, number>; nAtletas: number }> {
  if (!supabaseAdmin) return { pontos: {}, nAtletas: 0 };
  const { data } = await supabaseAdmin
    .from("resultados_atletas")
    .select("id_person, pontos")
    .eq("id_competicao", comp);
  const pontos: Record<string, number> = {};
  for (const r of data || []) pontos[String(r.id_person)] = Number(r.pontos) || 0;
  return { pontos, nAtletas: (data || []).length };
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

  const { data: liga } = await supabaseAdmin
    .from("leagues")
    .select("*")
    .eq("id", league_id)
    .maybeSingle();
  if (!liga) return NextResponse.json({ ok: false, erro: "Liga não encontrada." }, { status: 404 });
  if (liga.formato !== "copa") return NextResponse.json({ ok: false, erro: "Não é uma copa." }, { status: 400 });
  if (liga.copa_estado !== "sorteada" && liga.copa_estado !== "a_decorrer") {
    return NextResponse.json({ ok: true, apurou: false, estado: liga.copa_estado });
  }

  const nomeLiga = String(liga.name || "a tua liga");
  // Link DIRETO para a copa: a página abre em /liga/[codigo]/chave. O apurar só
  // tem o league_id (uuid), por isso buscamos o código da liga sem depender do
  // nome exato da coluna (codigo / code / invite_code / slug). Se não houver,
  // cai no /ligas de sempre (nunca fica pior do que estava).
  const ligaRec = liga as Record<string, unknown>;
  const codigoLiga = String(
    ligaRec.codigo ?? ligaRec.code ?? ligaRec.invite_code ?? ligaRec.slug ?? ""
  ).trim();
  const linkCopa = codigoLiga ? `/liga/${codigoLiga}/chave` : "/ligas";
  // As CONQUISTAS (campeão, vice, 3º) viram um "resultado" e devem abrir a aba de
  // Resultados (onde estão os títulos). As notificações de andamento (avançou,
  // eliminado, repescagem) continuam a ir para a chave (linkCopa).
  const linkResultados = "/ligas?aba=resultados";

  // 1) Todos os confrontos da liga (inclui `metade`, necessária à repescagem).
  const { data: todos } = await supabaseAdmin
    .from("copa_confrontos")
    .select("id, ronda, ordem, fase, jogador_a, jogador_b, id_competicao, vencedor, estado, metade")
    .eq("league_id", league_id)
    .order("ronda", { ascending: true })
    .order("ordem", { ascending: true });

  const confrontos = todos || [];
  if (confrontos.length === 0) {
    return NextResponse.json({ ok: false, erro: "Esta copa ainda não tem chave." }, { status: 400 });
  }

  const pendentes = confrontos.filter((c) => c.estado === "pendente");
  if (pendentes.length === 0) {
    return NextResponse.json({ ok: true, apurou: false, semPendentes: true, estado: liga.copa_estado });
  }
  const rondaAtual = Math.min(...pendentes.map((c) => c.ronda));
  const confrontosRonda = confrontos.filter((c) => c.ronda === rondaAtual);
  const pendentesRonda = confrontosRonda.filter((c) => c.estado === "pendente");

  const comp = pendentesRonda[0].id_competicao;
  if (!comp) return NextResponse.json({ ok: false, erro: "Ronda sem competição definida." }, { status: 400 });

  // 2) A competição já está CONGELADA? (tem resultados em resultados_atletas).
  // É a fonte fiável: o motor de congelamento já calculou os pontos corretos.
  // Se ainda não congelou, não apuramos (a competição não terminou / não foi
  // processada pelo cron ainda).
  const { pontos: pontosAtleta, nAtletas } = await pontuacaoCongelada(comp);
  if (nAtletas === 0) {
    return NextResponse.json({ ok: true, apurou: false, aDecorrer: true, ronda: rondaAtual, motivo: "competicao_nao_congelada" });
  }

  // Marca como "a decorrer" assim que começamos a apurar a 1ª ronda.
  if (liga.copa_estado === "sorteada") {
    await supabaseAdmin.from("leagues").update({ copa_estado: "a_decorrer" }).eq("id", league_id);
  }

  // 3) Pontos de cada JOGADOR (equipa) envolvido nesta ronda.
  const jogadores = new Set<string>();
  for (const c of pendentesRonda) {
    if (c.jogador_a) jogadores.add(c.jogador_a);
    if (c.jogador_b) jogadores.add(c.jogador_b);
  }
  const pontosJogador = await pontosPorJogador(Array.from(jogadores), comp, pontosAtleta);

  // Separa a(s) FINAL(is) do resto: a final é sempre a última a decidir-se.
  const pendentesFinal = pendentesRonda.filter((c) => String(c.fase) === "final");
  const pendentesOutros = pendentesRonda.filter((c) => String(c.fase) !== "final");

  let decididos = 0;

  // Grava a decisão de um confronto e envia as notificações da sua fase.
  async function processarConfronto(
    c: { id: string; fase: string | null; jogador_a: string; jogador_b: string | null },
    pa: PontosJogador,
    pb: PontosJogador
  ) {
    if (!supabaseAdmin) return;
    if (!c.jogador_b) {
      await supabaseAdmin.from("copa_confrontos").update({
        vencedor: c.jogador_a, decidido_por: "bye", estado: "decidido",
      }).eq("id", c.id);
      decididos++;
      return;
    }
    const r = decidirConfronto(c.jogador_a, c.jogador_b, pa, pb);
    await supabaseAdmin.from("copa_confrontos").update({
      pontos_a: r.pontos_a,
      pontos_b: r.pontos_b,
      vencedor: r.vencedor,
      decidido_por: r.decidido_por,
      estado: "decidido",
    }).eq("id", c.id);
    decididos++;

    const vencedor = r.vencedor;
    const perdedor = vencedor === c.jogador_a ? c.jogador_b : c.jogador_a;
    const fase = String(c.fase || "");

    if (fase === "final") {
      await criarNotificacaoServidor({
        paraUserId: vencedor,
        tipo: "copa_campeao",
        titulo: "És o CAMPEÃO da Copa Ippon! 🏆",
        corpo: `Venceste a final e és o campeão da Copa "${nomeLiga}". Que conquista!`,
        link: linkResultados,
      });
      if (perdedor) {
        await criarNotificacaoServidor({
          paraUserId: perdedor,
          tipo: "copa_eliminado",
          titulo: "Vice-campeão da Copa Ippon 🥈",
          corpo: `Chegaste à final da Copa "${nomeLiga}" e ficaste em 2º. Grande campanha!`,
          link: linkResultados,
        });
      }
    } else if (fase === "bronze") {
      // Vencedor do bronze sobe ao pódio (3º). O perdedor fica às portas do pódio.
      await criarNotificacaoServidor({
        paraUserId: vencedor,
        tipo: "copa_avancou",
        titulo: "3º lugar na Copa Ippon 🥉",
        corpo: `Venceste a disputa do bronze na Copa "${nomeLiga}". Subiste ao pódio!`,
        link: linkResultados,
      });
      if (perdedor) {
        await criarNotificacaoServidor({
          paraUserId: perdedor,
          tipo: "copa_eliminado",
          titulo: "Às portas do pódio",
          corpo: `Perdeste a disputa do bronze na Copa "${nomeLiga}", mas chegaste muito longe. Que campanha!`,
          link: linkCopa,
        });
      }
    } else if (fase === "repescagem") {
      // A repescagem é a última chance: quem ganha segue para o bronze; quem
      // perde, aí sim, está eliminado.
      await criarNotificacaoServidor({
        paraUserId: vencedor,
        tipo: "copa_avancou",
        titulo: "Venceste na repescagem! 🔁",
        corpo: `Ganhaste o teu confronto de repescagem na Copa "${nomeLiga}" e segues para a disputa do bronze. A segunda chance é tua!`,
        link: linkCopa,
      });
      if (perdedor) {
        await criarNotificacaoServidor({
          paraUserId: perdedor,
          tipo: "copa_eliminado",
          titulo: "Eliminado na repescagem",
          corpo: `Perdeste o confronto de repescagem na Copa "${nomeLiga}". Foi uma boa campanha — para a próxima, a revanche é tua!`,
          link: linkCopa,
        });
      }
    } else {
      // Fase "normal" (quartos/semis): o VENCEDOR avança. O PERDEDOR NÃO é
      // notificado de eliminação — no judô há repescagem: quem perde um quarto
      // vai à repescagem, quem perde uma semi vai ao bronze. Será notificado
      // nessa fase (ganhar/perder a repescagem, ou o bronze). Evita o falso
      // "foste eliminado" a quem ainda tem campanha pela frente.
      await criarNotificacaoServidor({
        paraUserId: vencedor,
        tipo: "copa_avancou",
        titulo: "Avançaste na Copa! ⚔️",
        corpo: `Venceste o teu confronto na Copa "${nomeLiga}". Segues em frente — prepara a próxima ronda!`,
        link: linkCopa,
      });
    }
  }

  // 3a) Decide primeiro tudo o que NÃO é final (bronzes, repescagens, normais).
  for (const c of pendentesOutros) {
    const pa = pontosJogador[c.jogador_a] ?? { total: 0, capitao: 0, escalou: false };
    const pb = c.jogador_b ? (pontosJogador[c.jogador_b] ?? { total: 0, capitao: 0, escalou: false }) : { total: 0, capitao: 0, escalou: false };
    await processarConfronto(c, pa, pb);
  }

  // 3b) A FINAL. Só se decide quando mais nada está pendente na copa — é isso
  //     que dá aos finalistas o tempo de espera durante a repescagem, e é esse
  //     tempo que a janela do acumulado mede.
  let finalAEsperar = false;
  let janelaFinal: string[] = [];
  if (pendentesFinal.length > 0) {
    const { data: aindaPendentes } = await supabaseAdmin
      .from("copa_confrontos")
      .select("id, fase")
      .eq("league_id", league_id)
      .eq("estado", "pendente");
    const sobramNaoFinais = (aindaPendentes || []).filter((c) => String(c.fase) !== "final").length;

    if (sobramNaoFinais > 0) {
      finalAEsperar = true; // a repescagem/bronze ainda decorre: a final espera
    } else {
      // JANELA: da competição da final (inclusive) até à última competição
      // usada por qualquer confronto desta copa, por ordem de calendário.
      const compFinal = String(pendentesFinal[0].id_competicao || comp);
      const ordemFinal = ordemDaComp(compFinal);
      const idsUsados: string[] = [];
      for (const c of confrontos) {
        const id = String((c as { id_competicao?: unknown }).id_competicao ?? "");
        if (id) idsUsados.push(id);
      }
      janelaFinal = Array.from(new Set(idsUsados))
        .filter((id) => ordemDaComp(id) >= ordemFinal)
        .sort((a, b) => ordemDaComp(a) - ordemDaComp(b));
      if (janelaFinal.length === 0) janelaFinal = [compFinal];

      const finalistas = pendentesFinal
        .flatMap((c) => [c.jogador_a, c.jogador_b])
        .filter((x): x is string => !!x);

      // Soma os pontos dos finalistas em cada competição da janela. Se alguma
      // ainda não estiver congelada, a final espera mais (não se decide a meio).
      const acum: Record<string, PontosJogador> = {};
      for (const f of finalistas) acum[f] = { total: 0, capitao: 0, escalou: false };
      let janelaCompleta = true;
      for (const idc of janelaFinal) {
        const { pontos: pAtl, nAtletas: n } = await pontuacaoCongelada(idc);
        if (n === 0) { janelaCompleta = false; break; }
        const pj = await pontosPorJogador(finalistas, idc, pAtl);
        for (const f of finalistas) {
          const x = pj[f] ?? { total: 0, capitao: 0, escalou: false };
          acum[f] = {
            total: Math.round((acum[f].total + x.total) * 10) / 10,
            capitao: Math.round((acum[f].capitao + x.capitao) * 10) / 10,
            escalou: acum[f].escalou || x.escalou,
          };
        }
      }

      if (!janelaCompleta) {
        finalAEsperar = true;
      } else {
        for (const c of pendentesFinal) {
          const pa = acum[c.jogador_a] ?? { total: 0, capitao: 0, escalou: false };
          const pb = c.jogador_b ? (acum[c.jogador_b] ?? { total: 0, capitao: 0, escalou: false }) : { total: 0, capitao: 0, escalou: false };
          await processarConfronto(c, pa, pb);
        }
      }
    }
  }

  // 4) A ronda ficou toda decidida? Gera a ronda seguinte (com repescagem).
  const { data: rondaFinal } = await supabaseAdmin
    .from("copa_confrontos")
    .select("ronda, ordem, fase, jogador_a, jogador_b, vencedor, estado, metade")
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
      const idProxima = idCompeticaoSeguinte(comp);
      if (idProxima) {
        const novos = gerarRondaSeguinteComRepescagem(rondaFinal as ConfrontoRonda[], idProxima);
        if (novos.length > 0) {
          const linhas = novos.map((n) => ({
            league_id,
            ronda: n.ronda,
            ordem: n.ordem,
            fase: n.fase,
            jogador_a: n.jogador_a,
            jogador_b: n.jogador_b,
            id_competicao: n.id_competicao,
            metade: n.metade,
            estado: "pendente",
            ...(n.jogador_b === null ? { vencedor: n.jogador_a, decidido_por: "bye", estado: "decidido" } : {}),
          }));
          await supabaseAdmin.from("copa_confrontos").insert(linhas);
          gerouProxima = true;
        }

        // NOTIFICAÇÃO AO PERDEDOR de confronto NORMAL (opção B, validada com o
        // Kainan): usamos os confrontos REALMENTE gerados (`novos`) como fonte da
        // verdade — quem ficou numa repescagem ou bronze TEM segunda chance; quem
        // perdeu e não aparece em lado nenhum foi ELIMINADO. Assim nunca prometemos
        // uma repescagem que não existe (ex.: rondas cedo de chaves grandes).
        const continuam = new Set<string>();
        for (const n of novos) {
          if (n.fase === "repescagem" || n.fase === "bronze") {
            if (n.jogador_a) continuam.add(n.jogador_a);
            if (n.jogador_b) continuam.add(n.jogador_b);
          }
        }
        // Perdedores dos confrontos NORMAIS desta ronda (com adversário real).
        const normaisDaRonda = (rondaFinal || []).filter((c) => String(c.fase) === "normal");
        for (const c of normaisDaRonda) {
          if (!c.jogador_b) continue; // bye não tem perdedor
          const perdedorN = c.vencedor === c.jogador_a ? c.jogador_b : c.jogador_a;
          if (!perdedorN) continue;
          if (continuam.has(perdedorN)) {
            // Ainda tem campanha: vai à repescagem ou ao bronze.
            await criarNotificacaoServidor({
              paraUserId: perdedorN,
              tipo: "copa_eliminado",
              titulo: "Perdeste este confronto — mas não acabou! 🔁",
              corpo: `Foste eliminado deste confronto na Copa "${nomeLiga}", mas a tua campanha continua: ainda podes lutar pelo 3º lugar. Não desanimes — vamos a essa repescagem!`,
              link: linkCopa,
            });
          } else {
            // Sem segunda chance: eliminado da Copa.
            await criarNotificacaoServidor({
              paraUserId: perdedorN,
              tipo: "copa_eliminado",
              titulo: "Eliminado da Copa",
              corpo: `Foste eliminado da Copa "${nomeLiga}". Foi uma boa campanha — para a próxima, a revanche é tua!`,
              link: linkCopa,
            });
          }
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
    finalAEsperar,                                     // a final está à espera da repescagem
    janela_final: janelaFinal.length > 0 ? janelaFinal : undefined, // competições que contaram para o título
  });
}

// Para cada jogador, calcula os pontos da equipa dele na competição (capitão a
// dobrar) e os pontos BASE do capitão (para o desempate). Mesma lógica do ranking.
//
// HERANÇA: quem não guardou equipa NESTA competição herda a última equipa que
// guardou numa rodada ANTERIOR (por ordem de calendário). Continua a herdá-la
// sucessivamente enquanto não salvar uma nova. Só quem nunca escalou fica a
// zeros com escalou=false.
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

  // HERANÇA para quem não escalou nesta rodada.
  const semEquipa = userIds.filter((u) => !equipaDe.has(u));
  if (semEquipa.length > 0) {
    const ordemAlvo = ordemDaComp(comp);
    const { data: antigas } = await supabaseAdmin
      .from("equipas")
      .select("user_id, atletas, capitao, id_competicao")
      .in("user_id", semEquipa);
    // Para cada jogador, fica com a equipa da rodada ANTERIOR mais recente.
    const melhor = new Map<string, { ordem: number; atletas: string[]; capitao: string | null }>();
    for (const e of antigas || []) {
      const o = ordemDaComp(String(e.id_competicao));
      if (o < 0) continue;                              // competição fora do calendário
      if (ordemAlvo >= 0 && o >= ordemAlvo) continue;   // só rodadas anteriores
      const ids = Array.isArray(e.atletas) ? (e.atletas as string[]).map(String) : [];
      if (ids.length === 0) continue;
      const uid = String(e.user_id);
      const atual = melhor.get(uid);
      if (!atual || o > atual.ordem) {
        melhor.set(uid, { ordem: o, atletas: ids, capitao: e.capitao ? String(e.capitao) : null });
      }
    }
    for (const [uid, m] of melhor) {
      equipaDe.set(uid, { atletas: m.atletas, capitao: m.capitao });
    }
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
        total += p;
        pontosCapitao = p;
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
