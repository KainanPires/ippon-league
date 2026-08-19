// lib/congelar.ts
//
// MOTOR DE CONGELAMENTO PÓS-COMPETIÇÃO (Fase A).
// USAR APENAS NO SERVIDOR (usa supabaseAdmin + API do JudoBase).
//
// Quando uma competição termina (regra das 60h, ver lib/calendario), este motor
// "congela" o resultado dela nas tabelas:
// - resultados_atletas -> ranking de atletas + valorização (Modelo B)
// - precos_atletas -> preço central de cada atleta (evolui rodada a rodada)
// - resultados_rodada -> resultado de cada utilizador (pontos, património)
// - pontuacoes -> pontos por utilizador (mantém-se; alimenta faixas)
// - users.patrimony_jc -> património ATUAL de cada utilizador
//
// FONTE CORRETA: pontua cada atleta por competitor.contests (lutas POR atleta),
// filtrado pela competição. NUNCA usa competition.contests (vem incompleto
  // durante/após o evento — foi a causa do bug dos pontos a zero na Tahiti).
//
// IDEMPOTENTE: correr de novo dá o mesmo resultado (upserts + património
  // recalculado do zero). O cron reprocessa a janela recente todos os dias sem inchar.
//
// MODELO ECONÓMICO (decidido com o Kainan):
// - Preço ÚNICO e tabelado (vive em precos_atletas).
// - Modelo B: valoriza/desvaloriza por cima do preço anterior, comparando os
// pontos SIMPLES com a expectativa (70% média 12m + 30% últimas 3). Aplica
// METADE da variação (amortecedor). Nunca abaixo de 2 JC. Sem teto.
// - Modelo A (calcularForma): preço INICIAL de atleta novo (sem preço anterior).
// - Capitão pontua x2 para a EQUIPA, mas o preço valoriza por pontos SIMPLES.
// - Património = 100 + soma das valorizações dos atletas escalados, recalculado
// do zero por época (sem teto de crescimento). Reinicia a 100 a cada ano.
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  getCompetitionCompetitorsRaw,
  mapCompetitorsToAthletes,
  getCompetitorContests,
  scoreContestForPerson,
  type IjfContest,
} from "@/lib/ijf";
import { calcularForma } from "@/lib/forma";
import { computeNewPrice } from "@/lib/engine";
import { notificarFimDeCompeticao } from "@/lib/notificarCompeticao";
import { lerLutasManuais, indexarManuaisPorAtleta, aplicarManuaisNoCongelamento } from "@/lib/lutasManuais";
const round1 = (n: number): number => Math.round(n * 10) / 10;
// Orçamento de tempo por execução do congelamento de UMA competição. Deixa
// folga dentro do maxDuration do cron (300s). Se estourar, para e retoma na
// próxima execução (os atletas já feitos ficam em resultados_atletas).
const ORCAMENTO_MS = 240 * 1000;
export interface ResultadoCongelamento {
  comp: string;
  jaCongelada: boolean;
  atletasProcessados: number;
  atletasEmFalta: number;
  utilizadores: number;
  completa: boolean;
  nota?: string;
}
// --------------------------------------------------------------------------
// 1) PONTUAR ATLETAS — por competitor.contests, com valorização (Modelo B).
// --------------------------------------------------------------------------
// Processa os atletas que ainda NÃO estão em resultados_atletas (retoma de onde
  // parou). Respeita o orçamento de tempo. Devolve quantos processou e quantos faltam.
async function pontuarAtletasDaCompeticao(
  idComp: string,
  inicioMs: number
): Promise<{ processados: number; faltam: number; semInscritos?: boolean; erros?: number }> {
  if (!supabaseAdmin) return { processados: 0, faltam: -1, semInscritos: true };
  // Lista de inscritos da competição (com identidade: nome, país, categoria...).
  let inscritos = mapCompetitorsToAthletes(await getCompetitionCompetitorsRaw(idComp));
  // FALLBACK PARA CLÁSSICOS: o JudoBase ao vivo não devolve inscritos para
  // competições antigas revividas (ex.: Osaka 2018 = id 1601 devolve vazio).
  // Nesse caso, usamos os inscritos já guardados em atletas_cache (a lista que
    // foi montada quando a competição entrou no jogo). As lutas de cada atleta
  // continuam a vir por competitor.contests (funciona por atleta, mesmo em
    // clássicos) — só a LISTA de quem participa é que vem do cache.
  if (inscritos.length === 0 && supabaseAdmin) {
    const { data: cacheRow } = await supabaseAdmin
    .from("atletas_cache")
    .select("atletas")
    .eq("id_competition", idComp)
    .maybeSingle();
    const doCache = Array.isArray(cacheRow?.atletas) ? (cacheRow!.atletas as Array<Record<string, unknown>>) : [];
    inscritos = doCache
    .filter((a) => a?.id != null)
    .map((a) => ({
          id: String(a.id),
          name: a.name != null ? String(a.name) : "",
          countryIso: a.countryIso != null ? String(a.countryIso) : "",
          category: a.category != null ? String(a.category) : "",
          gender: a.gender != null ? String(a.gender) : "",
        })) as typeof inscritos;
  }
  // SEM LISTA DE INSCRITOS — e isto NÃO é o mesmo que "está tudo feito".
  //
  // Devolver faltam:0 aqui fazia o congelarCompeticao concluir que a competição
  // estava pronta e marcá-la como `completa: true` com ZERO atletas
  // processados. A partir daí o cron dava-a por congelada e nunca mais lá
  // voltava: uma competição inteira ficava sem pontos, sem preços e sem
  // património, e ninguém dava por isso.
  //
  // Acontece quando a API do JudoBase falha ou quando um clássico não tem
  // `atletas_cache`. Nesses casos a competição TEM de voltar a ser tentada.
  if (inscritos.length === 0) {
    return { processados: 0, faltam: -1, semInscritos: true };
  }
  // Quais já estão congelados (para retomar sem repetir).
  const { data: jaFeitos } = await supabaseAdmin
  .from("resultados_atletas")
  .select("id_person")
  .eq("id_competicao", idComp);
  const feitos = new Set((jaFeitos || []).map((r) => String(r.id_person)));

  // Quantos falharam A GRAVAR. Não é o mesmo que "faltam por processar": estes
  // foram tentados e a base de dados recusou.
  let erros = 0;
  // Preços atuais (para o Modelo B partir do preço anterior).
  const { data: precosLinhas } = await supabaseAdmin
  .from("precos_atletas")
  .select("id_person, preco_atual");
  const precoAtualPorId = new Map<string, number>();
  for (const p of precosLinhas || []) precoAtualPorId.set(String(p.id_person), Number(p.preco_atual));
  // Lutas manuais desta competição (o JudoBase não as leu), por atleta — para
  // contarem nos pontos e no preço, tal como as reais.
  const manuaisIdx = indexarManuaisPorAtleta(await lerLutasManuais(idComp));
  let processados = 0;
  let faltam = 0;
  for (const atleta of inscritos) {
    const id = String(atleta.id);
    if (feitos.has(id)) continue; // já congelado
    // Respeita o orçamento de tempo: se estourou, o resto fica para a próxima.
    if (Date.now() - inicioMs > ORCAMENTO_MS) {
      faltam++;
      continue;
    }
    // Lutas do atleta (uma busca serve para pontos E expectativa).
    let lutas: IjfContest[] = [];
    try {
      lutas = await getCompetitorContests(id);
    } catch {
      faltam++;
      continue;
    }
    // Lutas DESTA competição -> pontos, n_lutas, V/D.
    const desta = (lutas || []).filter((f) => String(f.id_competition) === idComp);
    const manuaisDoAtleta = manuaisIdx.get(id) || [];
    // Inscrito mas não lutou (e sem luta manual): não entra no ranking.
    if (desta.length === 0 && manuaisDoAtleta.length === 0) continue;
    let pontos = 0;
    let vitorias = 0;
    let derrotas = 0;
    const advsLidos = new Set<string>(); // adversários já dados pelo JudoBase
    // Agregado de AÇÕES (a "razão" do ponto): soma de todas as lutas. Só para
    // exibição no popup do ranking. O total de pontos vem de scoreContestForPerson.
    const acc = { ippon: 0, waza: 0, yuko: 0, shido_provocado: 0, ippon_sof: 0, waza_sof: 0, yuko_sof: 0, shido_sof: 0 };
    for (const f of desta) {
      const oppId = String(f.id_person_blue) === id ? String(f.id_person_white ?? "") : String(f.id_person_blue ?? "");
      if (oppId) advsLidos.add(oppId);
      pontos += scoreContestForPerson(f, id);
      const w = String(f.id_winner ?? "");
      if (w && w !== "0") {
        if (w === id) vitorias++;
        else derrotas++;
      }
      // Lado do atleta nesta luta + agregação das ações (campos crus da API).
      const lado = String(f.id_person_blue) === id ? "b" : (String(f.id_person_white) === id ? "w" : null);
      if (lado) {
        const opp = lado === "b" ? "w" : "b";
        const num = (campo: string) => { const x = parseInt(String((f as unknown as Record<string, unknown>)[campo] ?? "0"), 10); return isNaN(x) ? 0 : x; };
        const hansoku = num("penalty_b") >= 3 || num("penalty_w") >= 3;
        // Em hansoku-make o ippon é fantasma: não o contamos (nem feito nem sofrido).
        if (!hansoku) {
          acc.ippon += num(`ippon_${lado}`);
          acc.ippon_sof += num(`ippon_${opp}`);
        }
        acc.waza += num(`waza_${lado}`);
        acc.yuko += num(`yuko_${lado}`);
        acc.waza_sof += num(`waza_${opp}`);
        acc.yuko_sof += num(`yuko_${opp}`);
        acc.shido_provocado += num(`penalty_${opp}`); // shido do adversário = provocado por este atleta
        acc.shido_sof += num(`penalty_${lado}`); // shido deste lado = sofrido
      }
    }
    // Funde as lutas manuais (as que o JudoBase não leu) nos pontos, V/D e ações.
    // `advsLidos` evita duplicar quando o JudoBase já apanhou o confronto.
    const extraManual = aplicarManuaisNoCongelamento(acc, manuaisDoAtleta, id, advsLidos);
    pontos += extraManual.pontos;
    vitorias += extraManual.vitorias;
    derrotas += extraManual.derrotas;
    pontos = round1(pontos);
    // Remove os campos a zero para o jsonb ficar compacto (o popup só mostra o que existe).
    const acoes: Record<string, number> = {};
    for (const [k, v] of Object.entries(acc)) if (v > 0) acoes[k] = v;
    // Expectativa: calcularForma sobre TODO o histórico (reaproveita a busca).
    const forma = calcularForma(lutas, id);
    const expectativa = forma.expectativa;
    // Preço anterior: do central (precos_atletas) OU, se atleta novo, o inicial
    // do Modelo A (calcularForma já dá um preço de partida do histórico).
    const precoAntes = precoAtualPorId.has(id) ? precoAtualPorId.get(id)! : forma.preco;
    // Modelo B: valoriza/desvaloriza por cima do preço anterior.
    const r = computeNewPrice(precoAntes, expectativa, pontos);
    // Grava no ranking de atletas (congelado).
    const { error: erroAtleta } = await supabaseAdmin.from("resultados_atletas").upsert(
      {
        id_competicao: idComp,
        id_person: id,
        nome: atleta.name,
        country_code: atleta.countryIso,
        weight_category: atleta.category,
        gender: atleta.gender,
        pontos,
        n_lutas: desta.length + extraManual.nLutas,
        vitorias,
        derrotas,
        preco_antes: round1(precoAntes),
        preco_novo: r.newPrice,
        variacao_jc: r.delta,
        variacao_pct: r.appliedVariationPct,
        acoes,
        congelado_em: new Date().toISOString(),
      },
      { onConflict: "id_competicao,id_person" }
    );

    // O ERRO TEM DE SER VISTO.
    //
    // Se este upsert falhar em silêncio, o atleta não entra em
    // `resultados_atletas` — e como é essa tabela que diz "quem já está feito",
    // ele volta a ser tentado na corrida seguinte. Isso salva-o. Mas o
    // `processados++` corria na mesma, dando um número maior do que a realidade.
    if (erroAtleta) {
      erros++;
      continue; // não conta como processado, não grava o preço, tenta na próxima
    }

    // Atualiza o preço central (passa a ser o preço de mercado para a próxima rodada).
    //
    // ESTE É O MAIS PERIGOSO DOS DOIS. O Modelo B valoriza SEMPRE por cima do
    // preço anterior. Um preço que não grava não fica só desatualizado nesta
    // rodada: a rodada seguinte parte do valor errado, e a seguinte também.
    // O erro propaga-se para sempre — e é o património dos jogadores.
    const { error: erroPreco } = await supabaseAdmin.from("precos_atletas").upsert(
      {
        id_person: id,
        preco_atual: r.newPrice,
        expectativa: round1(expectativa),
        ultima_competicao: idComp,
        atualizado_em: new Date().toISOString(),
      },
      { onConflict: "id_person" }
    );

    if (erroPreco) {
      // O ranking já gravou mas o preço não. Apagar a linha do ranking devolve
      // este atleta à fila: na próxima corrida refaz-se tudo, do princípio, com
      // o preço anterior correto. Mais vale repetir trabalho do que deixar um
      // preço errado a contaminar todas as rodadas seguintes.
      await supabaseAdmin
      .from("resultados_atletas")
      .delete()
      .eq("id_competicao", idComp)
      .eq("id_person", id);
      erros++;
      continue;
    }

    processados++;
  }
  return { processados, faltam, erros };
}
// --------------------------------------------------------------------------
// 2) PONTUAR UTILIZADORES — lê de resultados_atletas (SEM API). Rápido.
// --------------------------------------------------------------------------
// Só corre quando os atletas já estão todos congelados (senão os pontos saíam
  // incompletos). Grava resultados_rodada e atualiza pontuacoes.
async function pontuarUtilizadoresDaCompeticao(idComp: string, mes: string): Promise<number> {
  if (!supabaseAdmin) return 0;
  // Pontos e variação de cada atleta desta competição (já congelados).
  const { data: atletas } = await supabaseAdmin
  .from("resultados_atletas")
  .select("id_person, pontos, variacao_jc")
  .eq("id_competicao", idComp);
  const pontosAtleta = new Map<string, number>();
  const variacaoAtleta = new Map<string, number>();
  for (const a of atletas || []) {
    pontosAtleta.set(String(a.id_person), Number(a.pontos));
    variacaoAtleta.set(String(a.id_person), Number(a.variacao_jc));
  }
  // Equipas que escalaram para esta competição.
  const { data: equipas } = await supabaseAdmin
  .from("equipas")
  .select("user_id, atletas, capitao")
  .eq("id_competicao", idComp);
  const lista = equipas || [];
  if (lista.length === 0) return 0;
  const linhasRodada: Record<string, unknown>[] = [];
  const linhasPontuacoes: Record<string, unknown>[] = [];
  for (const e of lista) {
    const ids = Array.isArray(e.atletas) ? (e.atletas as string[]).map(String) : [];
    const capitao = e.capitao ? String(e.capitao) : null;
    let pontosRodada = 0;
    let ganhoPatrimonio = 0;
    let melhor: string | null = null;
    let pior: string | null = null;
    let melhorPts = -Infinity;
    let piorPts = Infinity;
    for (const aid of ids) {
      const base = pontosAtleta.get(aid) ?? 0;
      // Pontos para a equipa: capitão dobra.
      pontosRodada += aid === capitao ? base * 2 : base;
      // Valorização: pelos pontos SIMPLES (variação já calculada por atleta).
      ganhoPatrimonio += variacaoAtleta.get(aid) ?? 0;
      // Melhor/pior pelo desempenho SIMPLES.
      if (base > melhorPts) { melhorPts = base; melhor = aid; }
      if (base < piorPts) { piorPts = base; pior = aid; }
    }
    pontosRodada = round1(pontosRodada);
    ganhoPatrimonio = round1(ganhoPatrimonio);
    linhasRodada.push({
        id_competicao: idComp,
        user_id: e.user_id,
        pontos_rodada: pontosRodada,
        ganho_patrimonio: ganhoPatrimonio,
        patrimonio_acumulado: 100, // recalculado depois (recalcularPatrimonios)
        melhor_atleta: melhor,
        pior_atleta: pior,
        congelado_em: new Date().toISOString(),
      });
    linhasPontuacoes.push({
        user_id: e.user_id,
        id_competicao: idComp,
        pontos: pontosRodada,
        mes,
        atualizada_em: new Date().toISOString(),
      });
  }
  // Os erros destes dois upserts TÊM de subir.
  //
  // O `resultados_rodada` é a fonte do património (o recalcularPatrimonios soma
    // os `ganho_patrimonio` de lá). O `pontuacoes` alimenta as faixas. Um upsert
  // destes a falhar em silêncio deixava TODA A GENTE sem pontos nessa rodada,
  // com a competição marcada como congelada e nada a assinalar o problema.
  //
  // Lança-se em vez de devolver: aqui não há retoma parcial — ou a rodada grava
  // para todos, ou não grava. O congelarRecentes apanha e a competição volta a
  // ser tentada na corrida seguinte, em vez de ficar dada como fechada.
  if (linhasRodada.length > 0) {
    const { error } = await supabaseAdmin
    .from("resultados_rodada")
    .upsert(linhasRodada, { onConflict: "id_competicao,user_id" });
    if (error) throw new Error(`resultados_rodada: ${error.message}`);
  }
  if (linhasPontuacoes.length > 0) {
    const { error } = await supabaseAdmin
    .from("pontuacoes")
    .upsert(linhasPontuacoes, { onConflict: "user_id,id_competicao" });
    if (error) throw new Error(`pontuacoes: ${error.message}`);
  }
  return linhasRodada.length;
}
// --------------------------------------------------------------------------
// 3) RECALCULAR PATRIMÓNIOS — do zero, por época. Sem teto de crescimento.
// --------------------------------------------------------------------------
// Para cada utilizador: património = 100 + soma dos ganhos de TODAS as
// competições da época atual (resultados_rodada congeladas desde o início do ano).
// "Recalcular do zero" garante que reprocessar não incha o número.
async function recalcularPatrimonios(anoEpoca: number): Promise<number> {
  if (!supabaseAdmin) return 0;
  // Competições da época: o ano está no id? Não — está na data do calendário.
  // Aqui usamos uma marca simples: a coluna congelado_em do ano da época.
  // Somamos ganho_patrimonio por utilizador de todas as resultados_rodada cujo
  // congelado_em é do ano da época.
  const inicioAno = new Date(Date.UTC(anoEpoca, 0, 1)).toISOString();
  const fimAno = new Date(Date.UTC(anoEpoca + 1, 0, 1)).toISOString();
  const { data: rodadas } = await supabaseAdmin
  .from("resultados_rodada")
  .select("user_id, ganho_patrimonio, congelado_em")
  .gte("congelado_em", inicioAno)
  .lt("congelado_em", fimAno);
  // Soma por utilizador.
  const ganhoPorUser = new Map<string, number>();
  for (const r of rodadas || []) {
    const u = String(r.user_id);
    ganhoPorUser.set(u, (ganhoPorUser.get(u) ?? 0) + Number(r.ganho_patrimonio ?? 0));
  }
  let atualizados = 0;
  let falhados = 0;
  for (const [userId, ganho] of ganhoPorUser) {
    const patrimonio = round1(100 + ganho); // parte de 100, sem teto
    const { error } = await supabaseAdmin
    .from("users")
    .update({ patrimony_jc: patrimonio })
    .eq("id", userId);
    if (error) { falhados++; continue; }
    atualizados++;
  }

  // Aqui NÃO se lança: o património é recalculado do zero em cada corrida, por
  // isso quem falhou hoje é corrigido amanhã sem intervenção. Mas fica no
  // registo — se o número for sempre o mesmo, há algo que não se resolve só.
  if (falhados > 0) {
    console.warn(`[congelar] património: ${falhados} utilizador(es) não gravaram`);
  }
  return atualizados;
}
// --------------------------------------------------------------------------
// FUNÇÃO PRINCIPAL — congela uma competição (idempotente, com retoma).
// --------------------------------------------------------------------------
export async function congelarCompeticao(idComp: string, mes: string, anoEpoca: number): Promise<ResultadoCongelamento> {
  const inicioMs = Date.now();
  if (!supabaseAdmin) {
    return { comp: idComp, jaCongelada: false, atletasProcessados: 0, atletasEmFalta: 0, utilizadores: 0, completa: false, nota: "Sem supabaseAdmin." };
  }
  // 1) Pontua os atletas que faltam (com retoma e orçamento de tempo).
const { processados, faltam, semInscritos, erros } = await pontuarAtletasDaCompeticao(idComp, inicioMs);

// SEM LISTA DE INSCRITOS: a API falhou ou o clássico não tem cache. NÃO se
// fecha a competição — se se fechasse, o cron dava-a por congelada e ela
// ficava sem pontos para sempre.
if (semInscritos) {
  return {
    comp: idComp, jaCongelada: false, atletasProcessados: 0,
    atletasEmFalta: -1, utilizadores: 0, completa: false,
    nota: "Sem lista de inscritos (API ou cache). Volta a tentar na próxima execução.",
  };
}
// Se ainda faltam atletas (orçamento esgotado ou API falhou), NÃO fecha a
// competição — retoma na próxima execução. Os utilizadores só são pontuados
// quando os atletas estiverem todos prontos (senão os pontos saíam incompletos).
if (faltam > 0) {
  return {
    comp: idComp, jaCongelada: false, atletasProcessados: processados,
    atletasEmFalta: faltam, utilizadores: 0, completa: false,
    nota: "Parcial: retoma na próxima execução.",
  };
}

// ALGUNS FALHARAM A GRAVAR. Não faltam por processar — foram tentados e a base
// de dados recusou. Não se pontuam os utilizadores com o ranking incompleto:
// os pontos sairiam a menos e ficariam gravados assim.
if (erros && erros > 0) {
  return {
    comp: idComp, jaCongelada: false, atletasProcessados: processados,
    atletasEmFalta: erros, utilizadores: 0, completa: false,
    nota: `${erros} atleta(s) não gravaram. Retoma na próxima execução.`,
  };
}
// 2) Atletas todos prontos -> pontua os utilizadores (sem API).
const utilizadores = await pontuarUtilizadoresDaCompeticao(idComp, mes);
// 3) Recalcula os patrimónios da época (do zero, idempotente).
await recalcularPatrimonios(anoEpoca);
// 4) Notifica o fim da competição (pódio + campeão Mundial/Continental).
// Idempotente por dentro (tabela eventos_notificados): o cron reprocessa tod
// os dias, mas a notificação sai uma só vez. Falha em silêncio.
try {
  await notificarFimDeCompeticao(idComp);
} catch {}
return {
  comp: idComp, jaCongelada: processados === 0, atletasProcessados: processados,
  atletasEmFalta: 0, utilizadores, completa: true,
};
}
