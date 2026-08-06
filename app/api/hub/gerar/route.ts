// app/api/hub/gerar/route.ts
//
// GERA AS NOTÍCIAS DO HUB a partir dos dados de uma competição já congelada.
//
// ---------------------------------------------------------------------------
// QUANDO CORRE
//
// Chamada pelo cron depois de cada congelamento. É seguro chamá-la muitas vezes:
// a tabela tem um índice único por (tipo, competição, chave), e usamos upsert
// com `ignoreDuplicates`. Uma segunda passagem não duplica nada.
//
// Isso importa porque o cron corre de HORA A HORA. Sem essa garantia, o mural
// enchia-se de repetições em poucas horas — foi o que aconteceu com as
// notificações de faixa a 1 de agosto.
//
//   GET /api/hub/gerar?key=SEGREDO            -> as competições recém-congeladas
//   GET /api/hub/gerar?key=SEGREDO&comp=1598  -> força uma competição
//   GET /api/hub/gerar?key=SEGREDO&simular=1  -> mostra o que faria, sem gravar
// ---------------------------------------------------------------------------
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { CALENDARIO_2026, nomeCompeticao, competicaoFechada, numeroDaRodada } from "@/lib/calendario";
import { NOME_CONTINENTE, type Continente } from "@/lib/continentes";
import {
  noticiaMelhorRodada, noticiaAtletaDestaque, noticiaValorizacao,
  noticiaDesvalorizacao, noticiaMaisEscalado, noticiaCopaCampeao,
  noticiaMaisRico, noticiaLiderPontos, noticiaPercursoCampeao,
  noticiaCampeaoAno, noticiaRicoAno,
  contarCampanha,
  type NoticiaNova,
} from "@/lib/gerarNoticias";
import { continenteDoPais } from "@/lib/continentes";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/** Quantos dias para trás procurar competições a noticiar. */
const JANELA_DIAS = 10;

/**
 * Horas em REVISÃO antes de uma notícia gerada se publicar sozinha.
 *
 * As automáticas nascem em rascunho para o editor as poder melhorar — um
 * resultado seco vira uma história quando passa por uma mão humana. Mas não
 * podem ficar presas à espera de alguém: ao fim deste tempo saem na mesma.
 *
 * 6 horas: dá para rever a rodada de domingo antes de a segunda-feira começar.
 */
const HORAS_REVISAO = 6;
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const key = (searchParams.get("key") || "").trim();
  if (!process.env.CRON_SECRET || key !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, erro: "Não autorizado." }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ ok: false, erro: "Servidor sem ligação." }, { status: 500 });
  }
  const simular = (searchParams.get("simular") || "").trim() === "1";
  const compForcada = (searchParams.get("comp") || "").trim();
  const agora = new Date();
  // Que competições noticiar: a forçada, ou as que terminaram há pouco.
  const semanas = compForcada
    ? CALENDARIO_2026.filter((s) => s.idCompeticao === compForcada)
    : CALENDARIO_2026.filter((s) => {
        const ini = new Date(s.de.replace(/\//g, "-") + "T00:00:00").getTime();
        const dias = (agora.getTime() - ini) / 86400000;
        return dias >= 0 && dias <= JANELA_DIAS && competicaoFechada(s, agora);
      });
  const novas: NoticiaNova[] = [];
  for (const semana of semanas) {
    const comp = semana.idCompeticao;
    // Nome COMPLETO: a competição já terminou, logo a cidade pode aparecer.
    const nomeComp = nomeCompeticao(semana, agora);
    // A rodada vai nos títulos: sem ela, "foi a melhor do mundo" confunde-se
    // com um título anual.
    const rodada = numeroDaRodada(comp);
    // --- 1) Melhor da rodada (mundial e continentais) ---
    // O ESCUDO vem junto: é a única imagem que estas notícias podem ter, e é
    // nossa — desenhada a partir de uma configuração (forma, cores, símbolo),
    // não um ficheiro. Por isso guarda-se em `dados`, e o ecrã desenha-a.
    //
    // Uma notícia sobre uma equipa com o escudo dela ao lado vale muito mais do
    // que um ícone genérico de troféu. E quando houver foto do jogador (com
    // consentimento), substitui-se — a estrutura já suporta as duas.
    const { data: melhores } = await supabaseAdmin
      .from("melhores_rodada")
      .select("nome_time, pontos, escopo, continente, n_participantes, escudo")
      .eq("id_competicao", comp);
    for (const m of melhores || []) {
      const n = noticiaMelhorRodada({
        nomeTime: String(m.nome_time || ""),
        pontos: Number(m.pontos || 0),
        escopo: String(m.escopo || ""),
        continente: NOME_CONTINENTE[String(m.continente) as Continente] || String(m.continente || ""),
        nParticipantes: Number(m.n_participantes || 0),
        idComp: comp, nomeComp, rodada,
      });
      if (n) {
        // O ESCUDO da equipa vai junto: é a única imagem que uma notícia gerada
        // pode ter, e é nossa. Desenhado a partir da configuração, não é um
        // ficheiro — por isso viaja em `dados`.
        n.dados = { ...(n.dados || {}), escudo: m.escudo ?? null };
        // A notícia do melhor CONTINENTAL é dessa região; a mundial é de todos.
        if (String(m.escopo) !== "mundial") n.continente = String(m.continente || "") || null;
        novas.push(n);
      }
    }
    // Nomes de todos os atletas desta competição: precisamos deles para dizer
    // CONTRA QUEM cada um lutou. Uma consulta só, reutilizada em várias notícias.
    const nomePorId = new Map<string, string>();
    try {
      const { data: todos } = await supabaseAdmin
        .from("resultados_atletas").select("id_person, nome").eq("id_competicao", comp);
      for (const a of todos || []) nomePorId.set(String(a.id_person), String(a.nome || ""));
    } catch { /* sem nomes: a campanha sai sem adversários */ }
    const apelidoDe = (id: string): string => {
      const n = nomePorId.get(id) || "";
      const p = n.trim().split(/\s+/);
      return p.length > 1 ? p[p.length - 1] : p[0] || "";
    };

    // --- 2) O atleta que mais pontuou ---
    const { data: top } = await supabaseAdmin
      .from("resultados_atletas")
      .select("id_person, nome, country_code, weight_category, pontos, lutas")
      .eq("id_competicao", comp)
      .order("pontos", { ascending: false })
      .limit(1);
    if (top && top[0]) {
      // A campanha luta a luta, quando existe. Só as competições com moldura
      // montada a têm (é a Chave Maestro que a grava) — nas outras, a notícia
      // sai só com o total, sem inventar nada.
      const campanha = contarCampanha(
        Array.isArray(top[0].lutas) ? (top[0].lutas as never[]) : null,
        apelidoDe,
      );
      const n = noticiaAtletaDestaque({
        nome: String(top[0].nome || ""),
        pais: String(top[0].country_code || ""),
        categoria: String(top[0].weight_category || ""),
        pontos: Number(top[0].pontos || 0),
        idComp: comp, nomeComp, campanha, rodada,
      });
      // País do atleta: uma notícia sobre um brasileiro interessa mais no Brasil.
      if (n) {
        n.pais = String(top[0].country_code || "") || null;
        novas.push(n);
      }
    }
    // --- 3) e 4) Maior valorização e maior queda ---
    //
    // Os dados vêm de `resultados_atletas`, não de `precos_atletas`. A segunda
    // guarda só o preço ATUAL — não tem memória do antes. A primeira guarda
    // `preco_antes` e `preco_novo` de cada rodada, que é exatamente a variação
    // que interessa contar.
    //
    // (Andei a procurar na tabela errada e cheguei a pensar que era preciso
    // mexer no motor de congelamento para guardar o histórico. Não é: ele já o
    // grava, na tabela dos resultados.)
    const { data: precos } = await supabaseAdmin
      .from("resultados_atletas")
      .select("nome, country_code, preco_antes, preco_novo, variacao_jc, lutas")
      .eq("id_competicao", comp)
      .not("preco_antes", "is", null)
      .not("preco_novo", "is", null)
      .order("variacao_jc", { ascending: false })
      .limit(1);
    if (precos && precos[0] && Number(precos[0].variacao_jc) > 0) {
      const p = precos[0];
      const n = noticiaValorizacao({
        nome: String(p.nome || ""), pais: String(p.country_code || ""),
        de: Number(p.preco_antes || 0), para: Number(p.preco_novo || 0),
        idComp: comp, nomeComp,
        campanha: contarCampanha(Array.isArray(p.lutas) ? (p.lutas as never[]) : null, apelidoDe),
      });
      if (n) { n.pais = String(p.country_code || "") || null; novas.push(n); }
    }
    const { data: quedas } = await supabaseAdmin
      .from("resultados_atletas")
      .select("nome, country_code, preco_antes, preco_novo, variacao_jc, lutas")
      .eq("id_competicao", comp)
      .not("preco_antes", "is", null)
      .not("preco_novo", "is", null)
      .order("variacao_jc", { ascending: true })
      .limit(1);
    if (quedas && quedas[0] && Number(quedas[0].variacao_jc) < 0) {
      const p = quedas[0];
      const n = noticiaDesvalorizacao({
        nome: String(p.nome || ""), pais: String(p.country_code || ""),
        de: Number(p.preco_antes || 0), para: Number(p.preco_novo || 0),
        idComp: comp, nomeComp,
        campanha: contarCampanha(Array.isArray(p.lutas) ? (p.lutas as never[]) : null, apelidoDe),
      });
      if (n) { n.pais = String(p.country_code || "") || null; novas.push(n); }
    }
    // --- 5) O atleta mais escalado ---
    const { data: equipas } = await supabaseAdmin
      .from("equipas").select("atletas").eq("id_competicao", comp);
    if (equipas && equipas.length > 0) {
      const conta = new Map<string, number>();
      for (const e of equipas) {
        const ids = Array.isArray(e.atletas) ? (e.atletas as unknown[]).map(String) : [];
        // Set: se a mesma equipa tiver o atleta duas vezes (não devia), conta uma.
        for (const id of new Set(ids)) conta.set(id, (conta.get(id) ?? 0) + 1);
      }
      const maior = [...conta.entries()].sort((a, b) => b[1] - a[1])[0];
      if (maior) {
        const { data: at } = await supabaseAdmin
          .from("resultados_atletas").select("nome, country_code")
          .eq("id_competicao", comp).eq("id_person", maior[0]).maybeSingle();
        if (at?.nome) {
          const n = noticiaMaisEscalado({
            nome: String(at.nome), pais: String(at.country_code || ""),
            equipas: maior[1], total: equipas.length,
            idComp: comp, nomeComp,
          });
          if (n) novas.push(n);
        }
      }
    }
  }
  // ========================================================================
  // NOTÍCIAS SOBRE O ESTADO DO JOGO
  //
  // Estas não são de uma rodada: são de quem está por cima AGORA. Por isso
  // ficam fora do ciclo das competições, e são refeitas de tempos a tempos —
  // a chave inclui o dia, para o líder de hoje não colidir com o de ontem.
  // ========================================================================
  const hoje = agora.toISOString().slice(0, 10);

  // --- 5) O maior património (mundial e por continente) ---
  try {
    const { data: ricos } = await supabaseAdmin
      .from("users")
      .select("id, patrimony_jc, continente")
      .gt("patrimony_jc", 0)
      .order("patrimony_jc", { ascending: false })
      .limit(200);
    const lista = ricos || [];
    // O nome e o escudo vêm da última equipa guardada — é a mais representativa.
    const equipaDeUser = async (uid: string): Promise<{ nome: string; escudo: unknown }> => {
      const { data } = await supabaseAdmin!
        .from("equipas").select("nome, escudo").eq("user_id", uid)
        .order("id_competicao", { ascending: false }).limit(1).maybeSingle();
      return { nome: String(data?.nome || ""), escudo: data?.escudo ?? null };
    };
    if (lista[0]) {
      const eq = await equipaDeUser(String(lista[0].id));
      const seg = lista[1] ? await equipaDeUser(String(lista[1].id)) : null;
      const n = noticiaMaisRico({
        nomeTime: eq.nome, patrimonio: Number(lista[0].patrimony_jc || 0),
        escopo: "mundial", escudo: eq.escudo,
        segundo: seg ? { nomeTime: seg.nome, patrimonio: Number(lista[1].patrimony_jc || 0) } : null,
      });
      if (n) { n.dados = { ...(n.dados || {}), chave: `rico-mundial-${hoje}` }; novas.push(n); }
    }
    // Por continente: o primeiro de cada um.
    const porCont = new Map<string, typeof lista>();
    for (const u of lista) {
      const c = String(u.continente || "");
      if (!c) continue;
      if (!porCont.has(c)) porCont.set(c, []);
      porCont.get(c)!.push(u);
    }
    for (const [cont, us] of porCont) {
      // Com um só jogador num continente, "o mais rico" não diz nada.
      if (us.length < 2) continue;
      const eq = await equipaDeUser(String(us[0].id));
      const seg = await equipaDeUser(String(us[1].id));
      const n = noticiaMaisRico({
        nomeTime: eq.nome, patrimonio: Number(us[0].patrimony_jc || 0),
        escopo: "continental", continente: NOME_CONTINENTE[cont as Continente] || cont,
        escudo: eq.escudo,
        segundo: { nomeTime: seg.nome, patrimonio: Number(us[1].patrimony_jc || 0) },
      });
      if (n) {
        n.dados = { ...(n.dados || {}), chave: `rico-${cont}-${hoje}` };
        n.continente = cont;
        novas.push(n);
      }
    }
  } catch { /* sem património: salta */ }

  // --- 6) Quem acumulou mais pontos ---
  try {
    const { data: pts } = await supabaseAdmin
      .from("pontuacoes").select("user_id, pontos").limit(5000);
    const soma = new Map<string, { total: number; rodadas: number }>();
    for (const p of pts || []) {
      const k = String(p.user_id);
      const a = soma.get(k) || { total: 0, rodadas: 0 };
      a.total += Number(p.pontos || 0); a.rodadas++;
      soma.set(k, a);
    }
    const ordenado = [...soma.entries()].sort((a, b) => b[1].total - a[1].total);
    if (ordenado[0]) {
      const eqDe = async (uid: string) => {
        const { data } = await supabaseAdmin!
          .from("equipas").select("nome, escudo").eq("user_id", uid)
          .order("id_competicao", { ascending: false }).limit(1).maybeSingle();
        return { nome: String(data?.nome || ""), escudo: data?.escudo ?? null };
      };
      const eq = await eqDe(ordenado[0][0]);
      const seg = ordenado[1] ? await eqDe(ordenado[1][0]) : null;
      const n = noticiaLiderPontos({
        nomeTime: eq.nome, pontos: ordenado[0][1].total, rodadas: ordenado[0][1].rodadas,
        escopo: "mundial", escudo: eq.escudo,
        segundo: seg ? { nomeTime: seg.nome, pontos: ordenado[1][1].total } : null,
      });
      if (n) { n.dados = { ...(n.dados || {}), chave: `lider-mundial-${hoje}` }; novas.push(n); }
    }
  } catch { /* sem pontuações: salta */ }

  // --- BALANÇO DO ANO ---
  //
  // Só depois de o ano fechar. O `campeoes_oficiais` já guarda os pódios
  // anuais (é o `fecharAnoOficial` do cron que os escreve a 1 de janeiro), por
  // isso lemos de lá em vez de recalcular.
  //
  // `?ano=2026` força a geração para testar sem esperar por janeiro.
  const anoPedido = Number(searchParams.get("ano") || 0);
  const anoFechado = anoPedido || (agora.getMonth() === 0 ? agora.getFullYear() - 1 : 0);
  if (anoFechado > 0) {
    try {
      const { data: podios } = await supabaseAdmin
        .from("campeoes_oficiais")
        .select("tipo, continente, posicao, user_id, pontos")
        .eq("ano", anoFechado)
        .order("posicao", { ascending: true });
      const eqDe = async (uid: string) => {
        const { data } = await supabaseAdmin!
          .from("equipas").select("nome, escudo").eq("user_id", uid)
          .order("id_competicao", { ascending: false }).limit(1).maybeSingle();
        return { nome: String(data?.nome || ""), escudo: data?.escudo ?? null };
      };
      // Quantas rodadas teve o ano, para dizer a média por rodada.
      const rodadasDoAno = CALENDARIO_2026.length;
      // Agrupa por âmbito: mundial, e um por continente.
      const porAmbito = new Map<string, typeof podios>();
      for (const p of podios || []) {
        const k = String(p.tipo) === "mundial" ? "mundial" : `c:${p.continente}`;
        if (!porAmbito.has(k)) porAmbito.set(k, []);
        porAmbito.get(k)!.push(p);
      }
      for (const [amb, lista] of porAmbito) {
        if (!lista || lista.length === 0) continue;
        const primeiro = lista[0];
        const segundo = lista[1];
        const eq = await eqDe(String(primeiro.user_id));
        const seg = segundo ? await eqDe(String(segundo.user_id)) : null;
        const mundial = amb === "mundial";
        const cont = mundial ? undefined : amb.slice(2);
        const n = noticiaCampeaoAno({
          nomeTime: eq.nome, pontos: Number(primeiro.pontos || 0), ano: anoFechado,
          escopo: mundial ? "mundial" : "continental",
          continente: cont ? (NOME_CONTINENTE[cont as Continente] || cont) : undefined,
          rodadas: rodadasDoAno, escudo: eq.escudo,
          segundo: seg ? { nomeTime: seg.nome, pontos: Number(segundo.pontos || 0) } : null,
        });
        if (n) { if (cont) n.continente = cont; novas.push(n); }
      }

      // O mais rico no fecho do ano: o património de hoje, no dia em que o ano
      // acaba, é o que conta.
      const { data: ricosAno } = await supabaseAdmin
        .from("users").select("id, patrimony_jc, continente")
        .gt("patrimony_jc", 0).order("patrimony_jc", { ascending: false }).limit(1);
      if (ricosAno && ricosAno[0]) {
        const eq = await eqDe(String(ricosAno[0].id));
        const n = noticiaRicoAno({
          nomeTime: eq.nome, patrimonio: Number(ricosAno[0].patrimony_jc || 0),
          ano: anoFechado, escopo: "mundial", escudo: eq.escudo,
        });
        if (n) novas.push(n);
      }
    } catch { /* sem pódios do ano: salta */ }
  }

  // --- 7) Copas que terminaram ---
  // Fora do ciclo das competições: uma copa acaba numa rodada, mas a notícia é
  // sobre a liga, não sobre a competição.
  try {
    const { data: copas } = await supabaseAdmin
      .from("leagues")
      .select("id, name, type")
      .eq("formato", "copa").eq("copa_estado", "terminada")
      .order("id", { ascending: false }).limit(10);
    for (const liga of copas || []) {
      const { data: final } = await supabaseAdmin
        .from("copa_confrontos")
        .select("jogador_a, jogador_b, vencedor")
        .eq("league_id", liga.id).eq("fase", "final").maybeSingle();
      if (!final?.vencedor) continue;
      const perdedor = final.vencedor === final.jogador_a ? final.jogador_b : final.jogador_a;
      // Nome E escudo da equipa: a última que guardaram é a mais representativa.
      const equipaDe = async (uid: string | null): Promise<{ nome: string; escudo: unknown }> => {
        if (!uid) return { nome: "", escudo: null };
        const { data } = await supabaseAdmin!
          .from("equipas").select("nome, escudo").eq("user_id", uid)
          .order("id_competicao", { ascending: false }).limit(1).maybeSingle();
        return { nome: String(data?.nome || ""), escudo: data?.escudo ?? null };
      };
      const { count } = await supabaseAdmin
        .from("league_members").select("id", { count: "exact", head: true }).eq("league_id", liga.id);
      const eqCampeao = await equipaDe(String(final.vencedor));
      const eqVice = await equipaDe(perdedor ? String(perdedor) : null);
      const n = noticiaCopaCampeao({
        nomeLiga: String(liga.name || "Copa"),
        campeao: eqCampeao.nome,
        vice: eqVice.nome || null,
        participantes: count ?? 0,
        ligaId: String(liga.id),
      });
      if (n) { n.dados = { ...(n.dados || {}), escudo: eqCampeao.escudo }; novas.push(n); }

      // O PERCURSO, ronda a ronda. Só para as ligas OFICIAIS: uma copa entre
      // amigos não é notícia para o mural; a mundial e as continentais são.
      if (String(liga.type) === "oficial") {
        try {
          const { data: confrontos } = await supabaseAdmin
            .from("copa_confrontos")
            .select("ronda, fase, jogador_a, jogador_b, pontos_a, pontos_b, vencedor")
            .eq("league_id", liga.id).eq("vencedor", final.vencedor)
            .order("ronda", { ascending: true });
          const percurso = [];
          for (const c of confrontos || []) {
            const souA = String(c.jogador_a) === String(final.vencedor);
            const advId = souA ? c.jogador_b : c.jogador_a;
            if (!advId) continue;
            const adv = await equipaDe(String(advId));
            percurso.push({
              ronda: String(c.fase || `Ronda ${c.ronda}`),
              adversario: adv.nome,
              meus: Number(souA ? c.pontos_a : c.pontos_b) || 0,
              dele: Number(souA ? c.pontos_b : c.pontos_a) || 0,
            });
          }
          const np = noticiaPercursoCampeao({
            nomeLiga: String(liga.name || "Copa"),
            campeao: eqCampeao.nome,
            participantes: count ?? 0,
            ligaId: String(liga.id),
            percurso,
            escudo: eqCampeao.escudo,
          });
          if (np) novas.push(np);
        } catch { /* sem confrontos: fica só a notícia do campeão */ }
      }
    }
  } catch { /* sem copas: salta */ }
  if (simular) {
    return NextResponse.json({ ok: true, simulacao: true, geradas: novas.length, noticias: novas });
  }
  // GRAVA — verificando primeiro se já existe.
  //
  // Podia bastar o índice único da tabela, mas ele usa expressões (coalesce),
  // e o `onConflict` do Supabase espera nomes de colunas. Em vez de contar com
  // isso, perguntamos antes de escrever: é uma consulta a mais por notícia, e
  // são poucas por rodada.
  //
  // Isto tem de ser à prova de repetição porque o cron corre de HORA A HORA. Sem
  // a verificação, o mural enchia-se de cópias em poucas horas — foi assim que
  // as notificações de faixa saíram 24 vezes a 1 de agosto.
  let gravadas = 0;
  let jaExistiam = 0;
  for (const n of novas) {
    const chave = String((n.dados as { chave?: unknown } | undefined)?.chave ?? "");
    let q = supabaseAdmin.from("hub_noticias").select("id").eq("tipo", n.tipo).limit(1);
    q = n.id_competicao ? q.eq("id_competicao", n.id_competicao) : q.is("id_competicao", null);
    if (chave) q = q.eq("dados->>chave", chave);
    const { data: existe } = await q;
    if (existe && existe.length > 0) { jaExistiam++; continue; }
    // NASCE EM REVISÃO, não publicada.
    //
    // O editor tem assim a hipótese de melhorar a notícia antes de alguém a ver
    // — e as automáticas são as que mais ganham com isso: um resultado seco
    // vira uma história quando passa por uma mão humana.
    //
    // Mas não fica presa à espera de ninguém: o `publicar_auto_em` faz o cron
    // publicá-la ao fim de HORAS_REVISAO, mesmo que ninguém lhe toque.
    const { error } = await supabaseAdmin.from("hub_noticias").insert({
      tipo: n.tipo, titulo: n.titulo, corpo: n.corpo, resumo: n.resumo,
      id_competicao: n.id_competicao ?? null,
      nome_competicao: n.nome_competicao ?? null,
      dados: n.dados ?? {},
      destaque: !!n.destaque,
      pais: n.pais ?? null,
      continente: n.continente ?? null,
      estado: "revisao",
      publicar_auto_em: new Date(Date.now() + HORAS_REVISAO * 3600 * 1000).toISOString(),
    });
    if (!error) gravadas++;
  }
  return NextResponse.json({ ok: true, candidatas: novas.length, gravadas, ja_existiam: jaExistiam });
}
