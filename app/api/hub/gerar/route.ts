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
import { CALENDARIO_2026, nomeCompeticao, competicaoFechada } from "@/lib/calendario";
import { NOME_CONTINENTE, type Continente } from "@/lib/continentes";
import {
  noticiaMelhorRodada, noticiaAtletaDestaque, noticiaValorizacao,
  noticiaDesvalorizacao, noticiaMaisEscalado, noticiaCopaCampeao,
  type NoticiaNova,
} from "@/lib/gerarNoticias";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Quantos dias para trás procurar competições a noticiar. */
const JANELA_DIAS = 10;

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

    // --- 1) Melhor da rodada (mundial e continentais) ---
    const { data: melhores } = await supabaseAdmin
      .from("melhores_rodada")
      .select("nome_time, pontos, escopo, continente, n_participantes")
      .eq("id_competicao", comp);
    for (const m of melhores || []) {
      const n = noticiaMelhorRodada({
        nomeTime: String(m.nome_time || ""),
        pontos: Number(m.pontos || 0),
        escopo: String(m.escopo || ""),
        continente: NOME_CONTINENTE[String(m.continente) as Continente] || String(m.continente || ""),
        nParticipantes: Number(m.n_participantes || 0),
        idComp: comp, nomeComp,
      });
      if (n) novas.push(n);
    }

    // --- 2) O atleta que mais pontuou ---
    const { data: top } = await supabaseAdmin
      .from("resultados_atletas")
      .select("nome, country_code, weight_category, pontos")
      .eq("id_competicao", comp)
      .order("pontos", { ascending: false })
      .limit(1);
    if (top && top[0]) {
      const n = noticiaAtletaDestaque({
        nome: String(top[0].nome || ""),
        pais: String(top[0].country_code || ""),
        categoria: String(top[0].weight_category || ""),
        pontos: Number(top[0].pontos || 0),
        idComp: comp, nomeComp,
      });
      if (n) novas.push(n);
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
      .select("nome, country_code, preco_antes, preco_novo, variacao_jc")
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
      });
      if (n) novas.push(n);
    }
    const { data: quedas } = await supabaseAdmin
      .from("resultados_atletas")
      .select("nome, country_code, preco_antes, preco_novo, variacao_jc")
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
      });
      if (n) novas.push(n);
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

  // --- 6) Copas que terminaram ---
  // Fora do ciclo das competições: uma copa acaba numa rodada, mas a notícia é
  // sobre a liga, não sobre a competição.
  try {
    const { data: copas } = await supabaseAdmin
      .from("leagues")
      .select("id, name")
      .eq("formato", "copa").eq("copa_estado", "terminada")
      .order("id", { ascending: false }).limit(10);
    for (const liga of copas || []) {
      const { data: final } = await supabaseAdmin
        .from("copa_confrontos")
        .select("jogador_a, jogador_b, vencedor")
        .eq("league_id", liga.id).eq("fase", "final").maybeSingle();
      if (!final?.vencedor) continue;
      const perdedor = final.vencedor === final.jogador_a ? final.jogador_b : final.jogador_a;
      const nomeDe = async (uid: string | null): Promise<string> => {
        if (!uid) return "";
        const { data } = await supabaseAdmin!
          .from("equipas").select("nome").eq("user_id", uid)
          .order("id_competicao", { ascending: false }).limit(1).maybeSingle();
        return String(data?.nome || "");
      };
      const { count } = await supabaseAdmin
        .from("league_members").select("id", { count: "exact", head: true }).eq("league_id", liga.id);
      const n = noticiaCopaCampeao({
        nomeLiga: String(liga.name || "Copa"),
        campeao: await nomeDe(String(final.vencedor)),
        vice: await nomeDe(perdedor ? String(perdedor) : null) || null,
        participantes: count ?? 0,
        ligaId: String(liga.id),
      });
      if (n) novas.push(n);
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

    const { error } = await supabaseAdmin.from("hub_noticias").insert({
      tipo: n.tipo, titulo: n.titulo, corpo: n.corpo, resumo: n.resumo,
      id_competicao: n.id_competicao ?? null,
      nome_competicao: n.nome_competicao ?? null,
      dados: n.dados ?? {},
      destaque: !!n.destaque,
    });
    if (!error) gravadas++;
  }

  return NextResponse.json({ ok: true, candidatas: novas.length, gravadas, ja_existiam: jaExistiam });
}
