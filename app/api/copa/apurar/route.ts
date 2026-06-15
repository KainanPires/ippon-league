// app/api/copa/apurar/route.ts
//
// APURAMENTO DE RONDA DA COPA IPPON (servidor, chave secreta).
//
// Disparado por: (1) o cron, após congelar as competições (automático), e
// (2) a página da liga (disparo preguiçoso ao abrir). IDEMPOTENTE: se a ronda
// atual ainda tem competição a decorrer, ou já está decidida e a seguinte já
// existe, não duplica nada.
//
// FONTE DOS PONTOS (corrigido): lê de resultados_atletas (CONGELADO pelo motor
// lib/congelar), NÃO de getCompetitionContests (que vinha incompleto durante e
// após o evento — era a causa de o apurar nunca decidir, o bug do mata-mata).
//
// O que faz:
//   1) encontra a ronda mais baixa com confrontos PENDENTES
//   2) confirma que a competição dessa ronda já está CONGELADA (tem resultados
//      em resultados_atletas) — se não, ainda não apura
//   3) para cada confronto: calcula os pontos de cada jogador (equipa na
//      competição, capitão a dobrar) e decide com o desempate em cascata
//   4) quando a ronda fica toda decidida, gera a ronda seguinte
//
// Recebe (POST): { league_id }
// Devolve: { ok, apurou, ronda, decididos, gerouProxima, terminada }
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { decidirConfronto, gerarRondaSeguinte, idCompeticaoSeguinte, competicaoPorId, type PontosJogador, type ConfrontoDB } from "@/lib/copa";
import { criarNotificacaoServidor } from "@/lib/notificacoesServidor";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
    .select("id, name, formato, copa_estado")
    .eq("id", league_id)
    .maybeSingle();
  if (!liga) return NextResponse.json({ ok: false, erro: "Liga não encontrada." }, { status: 404 });
  if (liga.formato !== "copa") return NextResponse.json({ ok: false, erro: "Não é uma copa." }, { status: 400 });
  if (liga.copa_estado !== "sorteada" && liga.copa_estado !== "a_decorrer") {
    return NextResponse.json({ ok: true, apurou: false, estado: liga.copa_estado });
  }

  const nomeLiga = String(liga.name || "a tua liga");
  const linkCopa = "/ligas";

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

  let decididos = 0;
  for (const c of pendentesRonda) {
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

    const vencedor = r.vencedor;
    const perdedor = vencedor === c.jogador_a ? c.jogador_b : c.jogador_a;
    const fase = String(c.fase || "");
    if (fase === "final") {
      await criarNotificacaoServidor({
        paraUserId: vencedor,
        tipo: "copa_campeao",
        titulo: "És o CAMPEÃO da Copa Ippon! 🏆",
        corpo: `Venceste a final e és o campeão da Copa da liga "${nomeLiga}". Que conquista!`,
        link: linkCopa,
      });
      if (perdedor) {
        await criarNotificacaoServidor({
          paraUserId: perdedor,
          tipo: "copa_eliminado",
          titulo: "Vice-campeão da Copa Ippon 🥈",
          corpo: `Chegaste à final da Copa da liga "${nomeLiga}" e ficaste em 2º. Grande campanha!`,
          link: linkCopa,
        });
      }
    } else if (fase === "bronze") {
      await criarNotificacaoServidor({
        paraUserId: vencedor,
        tipo: "copa_avancou",
        titulo: "3º lugar na Copa Ippon 🥉",
        corpo: `Venceste o confronto de 3º lugar na Copa da liga "${nomeLiga}". Subiste ao pódio!`,
        link: linkCopa,
      });
    } else {
      await criarNotificacaoServidor({
        paraUserId: vencedor,
        tipo: "copa_avancou",
        titulo: "Avançaste na Copa! ⚔️",
        corpo: `Venceste o teu confronto na Copa da liga "${nomeLiga}". Segues em frente — prepara a próxima ronda!`,
        link: linkCopa,
      });
      if (perdedor) {
        await criarNotificacaoServidor({
          paraUserId: perdedor,
          tipo: "copa_eliminado",
          titulo: "Eliminado da Copa",
          corpo: `Foste eliminado da Copa da liga "${nomeLiga}" nesta ronda. Na próxima edição, a revanche é tua!`,
          link: linkCopa,
        });
      }
    }
  }

  // 4) A ronda ficou toda decidida? Gera a ronda seguinte.
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
