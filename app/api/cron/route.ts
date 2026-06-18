import { NextResponse } from "next/server";
import { competicaoDaSemana, competicaoFechada, focoMercado, CALENDARIO_2026, type SemanaCalendario } from "@/lib/calendario";
import { getCompetitionCompetitorsRaw, mapCompetitorsToAthletes } from "@/lib/ijf";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { congelarCompeticao } from "@/lib/congelar";
import { competicaoPorId } from "@/lib/copa";
import { notificarMercado } from "@/lib/notificarMercado";
import { criarNotificacaoServidor } from "@/lib/notificacoesServidor";
import { mensagensModaisDeHoje } from "@/lib/mensagensEspeciais";

// CRON — prepara sozinho os preços/forma da competição que se aproxima.
// Corre 1x/dia (vercel.json). Com Fluid Compute, uma função corre até 300s — as
// 14 categorias (~18s cada ≈ 252s) cabem numa só execução, em sequência.
//
//   /api/cron                  -> prepara a competição que se aproxima (14 categorias)
//   /api/cron?comp=ID          -> força uma competição específica
//   /api/cron?key=SEGREDO      -> disparo MANUAL para teste (em vez do cabeçalho da Vercel)
//   /api/cron?congelar=ID      -> força CONGELAR uma competição específica (teste)
//   /api/cron?datas=1          -> força SÓ as notificações de datas especiais (teste)
//
// Etapas:
//   (A) atualiza "a competir agora" (aviso no Mercado)
//   (B) prepara preços da competição que se aproxima (14 categorias via /api/calcular)
//   (C) CONGELA as competições recentes terminadas (motor lib/congelar): preenche
//       resultados_atletas, resultados_rodada, precos_atletas, pontuacoes,
//       users.patrimony_jc — com a FONTE CORRETA (competitor.contests por atleta).
//   (D) no início do mês (dia 1), recalcula as faixas do mês anterior (users.belt)
//   (E) notificações de mercado (aberto/fechado)
//   (F) notificações de DATAS ESPECIAIS por push: aniversário (por utilizador) e
//       Dia Mundial do Judô (a todos). Sino + push, idempotente por dia.
//
// Protegido por CRON_SECRET: a Vercel envia "Authorization: Bearer <CRON_SECRET>"
// automaticamente; em alternativa aceitamos ?key=<CRON_SECRET> para testares à mão.
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CATS: { cat: string; gender: "M" | "F" }[] = [
  { cat: "-60", gender: "M" }, { cat: "-66", gender: "M" }, { cat: "-73", gender: "M" },
  { cat: "-81", gender: "M" }, { cat: "-90", gender: "M" }, { cat: "-100", gender: "M" },
  { cat: "+100", gender: "M" },
  { cat: "-48", gender: "F" }, { cat: "-52", gender: "F" }, { cat: "-57", gender: "F" },
  { cat: "-63", gender: "F" }, { cat: "-70", gender: "F" }, { cat: "-78", gender: "F" },
  { cat: "+78", gender: "F" },
];

// Linha especial no cache que guarda quem está a competir AGORA.
const CHAVE_AO_VIVO = "_a_competir_agora";

// A partir de quantos jogadores ativos os percentis de faixa "ligam".
const MIN_JOGADORES = 100;
// Janela (dias) para procurar competições recém-terminadas a congelar.
const JANELA_DIAS = 21;
// Faixas por ordem (melhor → pior). 5+10+15+20+20+20 = 90%; resto (~10%) = branca.
const ESCADA: { faixa: string; fatia: number }[] = [
  { faixa: "preta", fatia: 0.05 }, { faixa: "marrom", fatia: 0.10 }, { faixa: "roxa", fatia: 0.15 },
  { faixa: "verde", fatia: 0.20 }, { faixa: "amarela", fatia: 0.20 }, { faixa: "azul", fatia: 0.20 },
];

// Aceita o segredo por cabeçalho (Vercel) OU por ?key= (teste manual).
function autorizado(req: Request, key: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  if (key && key === secret) return true;
  const auth = req.headers.get("authorization") || "";
  return auth === `Bearer ${secret}`;
}

function baseUrl(req: Request): string {
  try {
    const u = new URL(req.url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "";
  }
}

// Diz se uma competição (pela data do calendário) já começou — está a decorrer.
function jaComecou(c: SemanaCalendario, hoje: Date): boolean {
  const ini = new Date(c.de.replace(/\//g, "-") + "T00:00:00");
  const fim = new Date(ini.getTime() + 6 * 86400000);
  return hoje >= ini && hoje <= fim;
}

// Guarda (ou limpa) a lista de IDs de quem está a competir agora.
async function atualizarAoVivo(hoje: Date): Promise<{ ao_vivo: string | null; atletas_ao_vivo: number }> {
  if (!supabaseAdmin) return { ao_vivo: null, atletas_ao_vivo: 0 };

  const atual = competicaoDaSemana(hoje);
  const aDecorrer = jaComecou(atual, hoje);

  if (!aDecorrer) {
    await supabaseAdmin.from("atletas_cache").upsert(
      { id_competition: CHAVE_AO_VIVO, atletas: [], total: 0, atualizado_em: new Date().toISOString() },
      { onConflict: "id_competition" }
    );
    return { ao_vivo: null, atletas_ao_vivo: 0 };
  }

  const raw = await getCompetitionCompetitorsRaw(atual.idCompeticao);
  const atletas = mapCompetitorsToAthletes(raw);
  const ids = atletas.map((a) => a.id).filter(Boolean);
  const payload = { id_competicao: atual.idCompeticao, nome: atual.nome, ids };

  await supabaseAdmin.from("atletas_cache").upsert(
    { id_competition: CHAVE_AO_VIVO, atletas: payload, total: ids.length, atualizado_em: new Date().toISOString() },
    { onConflict: "id_competition" }
  );

  return { ao_vivo: atual.nome, atletas_ao_vivo: ids.length };
}

// (C) CONGELA as competições recentes que já TERMINARAM (regra das 60h).
// Usa o motor lib/congelar (fonte correta competitor.contests). Idempotente:
// o motor tem retoma e não incha. Devolve um resumo por competição.
async function congelarRecentes(hoje: Date): Promise<{ comp: string; nome: string; processados: number; faltam: number; utilizadores: number; completa: boolean }[]> {
  const agora = hoje.getTime();
  const janelaMs = JANELA_DIAS * 24 * 60 * 60 * 1000;
  const candidatas = CALENDARIO_2026.filter((s) => {
    const inicio = new Date(s.de.replace(/\//g, "-") + "T00:00:00").getTime();
    const dentroDaJanela = inicio <= agora && agora - inicio <= janelaMs;
    return dentroDaJanela && competicaoFechada(s, hoje); // só as JÁ TERMINADAS (60h)
  });

  const out: { comp: string; nome: string; processados: number; faltam: number; utilizadores: number; completa: boolean }[] = [];
  for (const s of candidatas) {
    const mes = s.de.slice(0, 7).replace("/", "-");
    const anoEpoca = parseInt(s.de.slice(0, 4), 10);
    try {
      const r = await congelarCompeticao(s.idCompeticao, mes, anoEpoca);
      out.push({ comp: s.idCompeticao, nome: s.nome, processados: r.atletasProcessados, faltam: r.atletasEmFalta, utilizadores: r.utilizadores, completa: r.completa });
    } catch (e) {
      out.push({ comp: s.idCompeticao, nome: s.nome, processados: 0, faltam: -1, utilizadores: 0, completa: false });
    }
  }
  return out;
}

// (C-bis) APURA as copas ativas (mata-mata). Depois de congelar as competições,
// chama o /api/copa/apurar de cada liga que é copa e está a decorrer/sorteada.
// O apurar lê de resultados_atletas (já congelado acima), por isso decide bem.
// É o que torna o mata-mata AUTOMÁTICO (já não depende de alguém abrir a página).
async function apurarCopasAtivas(base: string): Promise<{ league_id: string; nome: string; apurou: boolean }[]> {
  if (!supabaseAdmin) return [];
  const { data: copas } = await supabaseAdmin
    .from("leagues")
    .select("id, name, copa_estado")
    .eq("formato", "copa")
    .in("copa_estado", ["sorteada", "a_decorrer"]);

  const out: { league_id: string; nome: string; apurou: boolean }[] = [];
  for (const liga of copas || []) {
    try {
      const r = await fetch(`${base}/api/copa/apurar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ league_id: liga.id }),
      });
      const j = await r.json().catch(() => null);
      out.push({ league_id: String(liga.id), nome: String(liga.name || ""), apurou: !!(j && j.apurou) });
    } catch {
      out.push({ league_id: String(liga.id), nome: String(liga.name || ""), apurou: false });
    }
  }
  return out;
}

// (C-ter) ENCERRA as ligas de PONTOS CORRIDOS cuja janela início→fim já acabou.
// Marca estado='terminada'. Critério: hoje já passou o FIM EFETIVO da janela
// (para fim por mês, o fim do mês; para fim por competição, a data dessa
// competição). Não notifica (decidido: só marcar). Só toca em ligas 'ativa' com
// fim definido — ligas antigas (sem fim) e copas ficam de fora.
async function encerrarLigasTerminadas(hoje: Date): Promise<{ encerradas: number; ids: string[] }> {
  if (!supabaseAdmin) return { encerradas: 0, ids: [] };
  const { data: ligas } = await supabaseAdmin
    .from("leagues")
    .select("id, fim_tipo, fim_valor, fim_data, estado, formato")
    .eq("formato", "pontos")
    .eq("estado", "ativa");

  const idsParaEncerrar: string[] = [];
  for (const liga of ligas || []) {
    const fimEfetivo = fimEfetivoDaLiga(liga);
    if (!fimEfetivo) continue;          // sem fim definido (liga antiga): não toca
    if (hoje > fimEfetivo) idsParaEncerrar.push(String(liga.id));
  }

  for (const id of idsParaEncerrar) {
    await supabaseAdmin.from("leagues").update({ estado: "terminada" }).eq("id", id);
  }
  return { encerradas: idsParaEncerrar.length, ids: idsParaEncerrar };
}

// FIM EFETIVO de uma liga de pontos corridos (mesma regra da Peça 4 / liga-geral):
//  • fim por mês        → último instante do mês de fim (a competição do mês conta);
//  • fim por competição → a data dessa competição (fim do dia);
//  • recurso            → a fim_data crua, se nada acima resolver.
// Devolve null se a liga não tem fim definido.
function fimEfetivoDaLiga(liga: { fim_tipo?: unknown; fim_valor?: unknown; fim_data?: unknown }): Date | null {
  const fimTipo = String(liga.fim_tipo || "");
  if (fimTipo === "mes") {
    const m = /^(\d{4})-(\d{2})$/.exec(String(liga.fim_valor || ""));
    if (m) {
      const ano = Number(m[1]);
      const mesIdx = Number(m[2]) - 1;
      return new Date(ano, mesIdx + 1, 0, 23, 59, 59); // último dia do mês de fim
    }
  } else if (fimTipo === "competicao") {
    const c = competicaoPorId(String(liga.fim_valor || ""));
    if (c) return new Date(c.de.replace(/\//g, "-") + "T23:59:59");
  }
  if (liga.fim_data) {
    const d = new Date(String(liga.fim_data));
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

// (D) Recalcula as faixas de um mês por percentil e grava em users.belt.
async function recalcularFaixas(mes: string): Promise<{ jogadores: number; percentilAtivo: boolean; distribuicao: Record<string, number> }> {
  if (!supabaseAdmin) return { jogadores: 0, percentilAtivo: false, distribuicao: {} };

  const { data: linhas } = await supabaseAdmin.from("pontuacoes").select("user_id, pontos").eq("mes", mes);
  const soma = new Map<string, number>();
  for (const l of linhas || []) soma.set(l.user_id, (soma.get(l.user_id) ?? 0) + (l.pontos ?? 0));

  const jogadores = [...soma.entries()].map(([user_id, total]) => ({ user_id, total }));
  const n = jogadores.length;
  if (n === 0) return { jogadores: 0, percentilAtivo: false, distribuicao: {} };

  jogadores.sort((a, b) => b.total - a.total);
  const percentilAtivo = n >= MIN_JOGADORES;
  const distribuicao: Record<string, number> = {};
  const atualizacoes: { user_id: string; faixa: string }[] = [];

  if (!percentilAtivo) {
    for (const j of jogadores) atualizacoes.push({ user_id: j.user_id, faixa: "branca" });
    distribuicao["branca"] = n;
  } else {
    let acum = 0;
    const limites: { faixa: string; ate: number }[] = [];
    for (const passo of ESCADA) { acum += passo.fatia; limites.push({ faixa: passo.faixa, ate: Math.round(acum * n) }); }
    for (let i = 0; i < n; i++) {
      const cap = limites.find((l) => i < l.ate);
      const faixa = cap ? cap.faixa : "branca";
      atualizacoes.push({ user_id: jogadores[i].user_id, faixa });
      distribuicao[faixa] = (distribuicao[faixa] ?? 0) + 1;
    }
  }

  // Faixas ANTIGAS (antes de gravar), para sabermos quem mudou e em que sentido.
  // Só precisamos disto se o percentil estiver ativo (senão está toda a gente na
  // branca e não há mudança real a celebrar).
  const faixaAntiga = new Map<string, string>();
  if (percentilAtivo) {
    const ids = atualizacoes.map((a) => a.user_id);
    // Lê em lotes para não estourar o limite do .in().
    for (let i = 0; i < ids.length; i += 500) {
      const lote = ids.slice(i, i + 500);
      const { data } = await supabaseAdmin.from("users").select("id, belt").in("id", lote);
      for (const u of data || []) faixaAntiga.set(String(u.id), String(u.belt ?? "branca"));
    }
  }

  for (const a of atualizacoes) {
    await supabaseAdmin.from("users").update({ belt: a.faixa }).eq("id", a.user_id);
  }

  // Notificação de SUBIDA / DESCIDA de faixa. Só quando o percentil está ativo
  // (≥ MIN_JOGADORES) e só a quem REALMENTE mudou de faixa. Subida = festa;
  // descida = motivação sem desânimo. (Decidido com o Kainan.)
  if (percentilAtivo) {
    for (const a of atualizacoes) {
      const antes = faixaAntiga.get(a.user_id) ?? "branca";
      if (antes === a.faixa) continue; // não mudou: não notifica
      const subiu = ordemFaixa(a.faixa) > ordemFaixa(antes);
      if (subiu) {
        await criarNotificacaoServidor({
          paraUserId: a.user_id,
          tipo: "faixa_subiu",
          titulo: `🥋 Subiste para a faixa ${nomeFaixa(a.faixa)}!`,
          corpo: `Parabéns! O teu desempenho levou-te à faixa ${nomeFaixa(a.faixa)}. Estás entre os melhores — continua assim e vai mais longe!`,
          link: "/inicio",
        });
      } else {
        await criarNotificacaoServidor({
          paraUserId: a.user_id,
          tipo: "faixa_desceu",
          titulo: `Faixa ${nomeFaixa(a.faixa)} — a próxima é tua`,
          corpo: `Desta vez desceste para a faixa ${nomeFaixa(a.faixa)}, mas isto faz parte do jogo. Monta uma boa equipa na próxima rodada e recupera o teu lugar — acreditamos em ti!`,
          link: "/inicio",
        });
      }
    }
  }

  return { jogadores: n, percentilAtivo, distribuicao };
}

// Ordem das faixas (maior nº = melhor). Para distinguir subida de descida.
function ordemFaixa(faixa: string): number {
  const ordem: Record<string, number> = {
    branca: 0, azul: 1, amarela: 2, verde: 3, roxa: 4, marrom: 5, preta: 6,
  };
  return ordem[faixa] ?? 0;
}

// Nome bonito da faixa para mostrar nas notificações.
function nomeFaixa(faixa: string): string {
  const nomes: Record<string, string> = {
    branca: "Branca", azul: "Azul", amarela: "Amarela", verde: "Verde",
    roxa: "Roxa", marrom: "Marrom", preta: "Preta",
  };
  return nomes[faixa] ?? faixa;
}

// Mês anterior ao da data dada, "AAAA-MM".
function mesAnteriorDe(d: Date): string {
  const x = new Date(d.getFullYear(), d.getMonth(), 1);
  x.setMonth(x.getMonth() - 1);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// (F) DATAS ESPECIAIS por PUSH.
//
// Usa o MESMO motor dos modais (lib/mensagensEspeciais) para o texto ser único:
// se um texto mudar lá, muda aqui também. Só envia o que o motor marca com
// push=true — hoje, aniversário e Dia Mundial do Judô. As grandes competições
// estão a push=false (já há o aviso de mercado), por isso não entram.
//
//  • Dia do Judô (e outros eventos GLOBAIS push=true): a todos os utilizadores.
//  • Aniversário: só a quem faz anos hoje.
//
// Idempotente por dia: antes de enviar, vê quem já recebeu HOJE esse tipo (via
// tabela notificacoes), para um re-disparo manual não duplicar.
//
// Escala (nota honesta): o envio do Dia do Judô percorre todos os utilizadores
// um a um. Para uma base grande, isto deve passar a um envio em lote / fila.
// Para o MVP é suficiente.
// ---------------------------------------------------------------------------
async function notificarDatasEspeciais(hoje: Date): Promise<{ dia_do_judo: number; aniversarios: number; outras_globais: number }> {
  const out = { dia_do_judo: 0, aniversarios: 0, outras_globais: 0 };
  if (!supabaseAdmin) return out;

  // Eventos GLOBAIS com push de hoje (tipicamente o Dia do Judô). Pedimos ao
  // motor com utilizador "neutro" (sem aniversário, sem continente) e a
  // competição da semana — e ficamos só com push=true que NÃO sejam aniversário.
  const compSemana = competicaoDaSemana(hoje);
  const globais = mensagensModaisDeHoje(
    hoje,
    { nome: null, dataNascimento: null, continente: null },
    { nome: compSemana.nome, nivel: compSemana.nivel, classico: compSemana.classico, idCompeticao: compSemana.idCompeticao },
  ).filter((m) => m.push && m.tipo !== "aniversario");

  // Aniversariantes de hoje.
  const aniversariantes = await userIdsComAniversario(hoje);

  // Idempotência: quem já recebeu HOJE cada um destes tipos.
  const inicioDia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 0, 0, 0).toISOString();
  const tiposCheck = Array.from(new Set([...globais.map((m) => `evento_${m.tipo}`), "evento_aniversario"]));
  const jaFeito = new Set<string>();
  if (tiposCheck.length > 0) {
    try {
      const { data } = await supabaseAdmin
        .from("notificacoes")
        .select("user_id, tipo")
        .gte("criada_em", inicioDia)
        .in("tipo", tiposCheck);
      for (const r of data || []) jaFeito.add(`${r.tipo}::${r.user_id}`);
    } catch { /* sem idempotência prévia: segue */ }
  }

  // 1) GLOBAIS → todos os utilizadores.
  if (globais.length > 0) {
    const ids = await todosOsUserIds();
    for (const m of globais) {
      const tipo = `evento_${m.tipo}`;
      for (const uid of ids) {
        if (jaFeito.has(`${tipo}::${uid}`)) continue;
        try {
          await criarNotificacaoServidor({ paraUserId: uid, tipo, titulo: m.titulo, corpo: m.texto, link: "/inicio" });
          jaFeito.add(`${tipo}::${uid}`);
          if (m.tipo === "dia_do_judo") out.dia_do_judo++; else out.outras_globais++;
        } catch { /* falha de um utilizador não bloqueia os outros */ }
      }
    }
  }

  // 2) ANIVERSÁRIOS → só quem faz anos hoje. O motor devolve o texto certo a
  //    partir da data de nascimento (sem nome, para push genérico mas correto).
  for (const u of aniversariantes) {
    const tipo = "evento_aniversario";
    if (jaFeito.has(`${tipo}::${u.id}`)) continue;
    const msg = mensagensModaisDeHoje(hoje, { nome: null, dataNascimento: u.dataNascimento, continente: null }, null)
      .find((x) => x.tipo === "aniversario");
    if (!msg) continue;
    try {
      await criarNotificacaoServidor({ paraUserId: u.id, tipo, titulo: msg.titulo, corpo: msg.texto, link: "/inicio" });
      jaFeito.add(`${tipo}::${u.id}`);
      out.aniversarios++;
    } catch { /* não bloqueia os outros */ }
  }

  return out;
}

// Todos os IDs de utilizadores (paginado, para passar o limite de 1000 do PostgREST).
async function todosOsUserIds(): Promise<string[]> {
  if (!supabaseAdmin) return [];
  const ids: string[] = [];
  const PAG = 1000;
  for (let from = 0; from < 100000; from += PAG) {
    const { data, error } = await supabaseAdmin.from("users").select("id").range(from, from + PAG - 1);
    if (error || !data || data.length === 0) break;
    for (const r of data) ids.push(String(r.id));
    if (data.length < PAG) break;
  }
  return ids;
}

// IDs (e data de nascimento) de quem faz anos HOJE. Compara só mês-dia ("MM-DD"),
// para o aniversário cair todos os anos. Paginado.
async function userIdsComAniversario(hoje: Date): Promise<{ id: string; dataNascimento: string }[]> {
  if (!supabaseAdmin) return [];
  const alvo = `${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
  const out: { id: string; dataNascimento: string }[] = [];
  const PAG = 1000;
  for (let from = 0; from < 100000; from += PAG) {
    const { data, error } = await supabaseAdmin
      .from("users")
      .select("id, data_nascimento")
      .not("data_nascimento", "is", null)
      .range(from, from + PAG - 1);
    if (error || !data || data.length === 0) break;
    for (const r of data) {
      const dn = r.data_nascimento ? String(r.data_nascimento) : "";
      const mmdd = dn.slice(5, 10); // "AAAA-MM-DD" -> "MM-DD"
      if (mmdd === alvo) out.push({ id: String(r.id), dataNascimento: dn });
    }
    if (data.length < PAG) break;
  }
  return out;
}

// FECHO DA ÉPOCA OFICIAL (anual). Calcula o pódio do ANO indicado — Mundial e
// cada Continental — e grava em campeoes_oficiais (livro de campeões). Só Pro
// entram (como no ranking ao vivo). Idempotente: upsert pela chave única, por
// isso re-correr o fecho do mesmo ano atualiza, não duplica.
// Os continentes são descobertos a partir dos dados (continentes com Pro), para
// não depender de uma lista fixa.
async function fecharAnoOficial(ano: number): Promise<{ ano: number; mundial: number; continentais: Record<string, number> }> {
  const out = { ano, mundial: 0, continentais: {} as Record<string, number> };
  if (!supabaseAdmin) return out;

  // Soma de pontos do ANO por utilizador (só competições cuja data cai no ano).
  // Lê o histórico congelado (resultados_rodada) e filtra pelo ano da competição.
  const noAno = (idComp: string): boolean => {
    const c = competicaoPorId(idComp);
    if (!c) return false; // sem data conhecida não conta para o ano
    const a = parseInt(String(c.de).slice(0, 4), 10);
    return a === ano;
  };

  // 1) Quem é Pro e qual o seu continente (mundial = todos; continental = por grupo).
  const { data: pros } = await supabaseAdmin
    .from("users")
    .select("id, continente, patrimony_jc")
    .eq("is_pro", true);
  const prosLista = (pros || []).map((p) => ({ id: String(p.id), continente: (p.continente ? String(p.continente) : null) }));
  if (prosLista.length === 0) return out;
  const idsPro = new Set(prosLista.map((p) => p.id));

  // 2) Soma dos pontos do ano, por utilizador Pro.
  const { data: rodadas } = await supabaseAdmin
    .from("resultados_rodada")
    .select("user_id, pontos_rodada, id_competicao");
  const pontosPorUser = new Map<string, number>();
  for (const r of rodadas || []) {
    const u = String(r.user_id);
    if (!idsPro.has(u)) continue;
    if (!noAno(String(r.id_competicao))) continue;
    pontosPorUser.set(u, (pontosPorUser.get(u) ?? 0) + Number(r.pontos_rodada ?? 0));
  }

  // 3) Identidade (nome + escudo) de cada Pro, da equipa mais recente.
  const { data: eqs } = await supabaseAdmin
    .from("equipas")
    .select("user_id, nome, escudo, id_competicao")
    .in("user_id", prosLista.map((p) => p.id))
    .order("id_competicao", { ascending: false });
  const identDe = new Map<string, { nome: string; escudo: unknown }>();
  for (const e of eqs || []) {
    const u = String(e.user_id);
    if (!identDe.has(u)) identDe.set(u, { nome: e.nome ?? "Equipa", escudo: e.escudo ?? null });
  }

  // Grava o pódio (top 3 por pontos > 0) de um grupo de utilizadores.
  // Nota: no mundial guardamos continente='' (não null) para casar com o índice
  // único (ano,tipo,COALESCE(continente,''),posicao) e o upsert funcionar.
  async function gravarPodio(tipo: "mundial" | "continental", continente: string, userIds: string[]) {
    const ordenados = userIds
      .map((u) => ({ u, pts: pontosPorUser.get(u) ?? 0 }))
      .filter((x) => x.pts > 0)
      .sort((a, b) => b.pts - a.pts)
      .slice(0, 3);
    let gravados = 0;
    for (let i = 0; i < ordenados.length; i++) {
      const { u, pts } = ordenados[i];
      const ident = identDe.get(u) || { nome: "Equipa", escudo: null };
      const { error } = await supabaseAdmin!
        .from("campeoes_oficiais")
        .upsert(
          {
            ano, tipo, continente,
            posicao: i + 1,
            user_id: u,
            nome_time: ident.nome,
            escudo: ident.escudo,
            pontos: Math.round(pts * 10) / 10,
          },
          { onConflict: "ano,tipo,continente,posicao" }
        );
      if (!error) gravados++; // conta só o que GRAVOU de facto (não o que tentou)
    }
    return gravados;
  }

  // 4) Mundial: todos os Pro.
  out.mundial = await gravarPodio("mundial", "", prosLista.map((p) => p.id));

  // 5) Continental: um pódio por continente que tenha Pro.
  const porContinente = new Map<string, string[]>();
  for (const p of prosLista) {
    if (!p.continente) continue;
    if (!porContinente.has(p.continente)) porContinente.set(p.continente, []);
    porContinente.get(p.continente)!.push(p.id);
  }
  for (const [cont, ids] of porContinente.entries()) {
    out.continentais[cont] = await gravarPodio("continental", cont, ids);
  }

  return out;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const key = searchParams.get("key");

  if (!autorizado(req, key)) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }

  const base = baseUrl(req);
  const t0 = Date.now();
  const hoje = new Date();

  // Disparo manual de APURAR uma copa específica (teste): ?apurar=LEAGUE_ID
  const apurarId = (searchParams.get("apurar") || "").trim();
  if (apurarId) {
    try {
      const r = await fetch(`${base}/api/copa/apurar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ league_id: apurarId }),
      });
      const j = await r.json().catch(() => null);
      return NextResponse.json({ feito: true, modo: "apurar_forcado", resultado: j, ms_total: Date.now() - t0 });
    } catch (e) {
      return NextResponse.json({ feito: false, modo: "apurar_forcado", erro: String((e as { message?: string })?.message || "falha") });
    }
  }

  // Disparo manual de RE-CONGELAMENTO (limpa e refaz do zero): ?recongelar=ID
  // Útil quando mudámos o motor e queremos refazer uma competição já congelada,
  // sem ter de apagar à mão no Supabase. Limpa as linhas dessa competição nas
  // tabelas de resultados e depois congela de novo.
  const recongelarId = (searchParams.get("recongelar") || "").trim();
  if (recongelarId) {
    if (supabaseAdmin) {
      await supabaseAdmin.from("resultados_atletas").delete().eq("id_competicao", recongelarId);
      await supabaseAdmin.from("resultados_rodada").delete().eq("id_competicao", recongelarId);
    }
    const s = CALENDARIO_2026.find((c) => c.idCompeticao === recongelarId);
    const mes = s ? s.de.slice(0, 7).replace("/", "-") : new Date().toISOString().slice(0, 7);
    const anoEpoca = s ? parseInt(s.de.slice(0, 4), 10) : hoje.getUTCFullYear();
    const r = await congelarCompeticao(recongelarId, mes, anoEpoca);
    return NextResponse.json({ feito: true, modo: "recongelar_forcado", limpou: true, resultado: r, ms_total: Date.now() - t0 });
  }

  // Disparo manual de congelamento de UMA competição (teste): ?congelar=ID
  const congelarId = (searchParams.get("congelar") || "").trim();
  if (congelarId) {
    const s = CALENDARIO_2026.find((c) => c.idCompeticao === congelarId);
    const mes = s ? s.de.slice(0, 7).replace("/", "-") : new Date().toISOString().slice(0, 7);
    const anoEpoca = s ? parseInt(s.de.slice(0, 4), 10) : hoje.getUTCFullYear();
    const r = await congelarCompeticao(congelarId, mes, anoEpoca);
    return NextResponse.json({ feito: true, modo: "congelar_forcado", resultado: r, ms_total: Date.now() - t0 });
  }

  // Disparo manual SÓ das notificações de mercado (teste rápido): ?mercado=1
  // Corre apenas a etapa (E) e responde de imediato, sem as 14 categorias.
  const soMercado = (searchParams.get("mercado") || "").trim();
  if (soMercado) {
    let r: { aberto: string | null; fechado: string | null } | null = null;
    try { r = await notificarMercado(hoje); } catch { /* não bloqueia */ }
    return NextResponse.json({ feito: true, modo: "mercado_forcado", mercado: r, ms_total: Date.now() - t0 });
  }

  // Disparo manual SÓ das notificações de DATAS ESPECIAIS (teste): ?datas=1
  // Corre apenas a etapa (F) (aniversário + Dia do Judô) e responde de imediato.
  const soDatas = (searchParams.get("datas") || "").trim();
  if (soDatas) {
    let r: { dia_do_judo: number; aniversarios: number; outras_globais: number } = { dia_do_judo: 0, aniversarios: 0, outras_globais: 0 };
    try { r = await notificarDatasEspeciais(hoje); } catch { /* não bloqueia */ }
    return NextResponse.json({ feito: true, modo: "datas_forcado", datas: r, ms_total: Date.now() - t0 });
  }

  // Disparo manual SÓ do encerramento de ligas terminadas (teste): ?encerrar=1
  const soEncerrar = (searchParams.get("encerrar") || "").trim();
  if (soEncerrar) {
    let r: { encerradas: number; ids: string[] } = { encerradas: 0, ids: [] };
    try { r = await encerrarLigasTerminadas(hoje); } catch { /* não bloqueia */ }
    return NextResponse.json({ feito: true, modo: "encerrar_forcado", ligas_encerradas: r, ms_total: Date.now() - t0 });
  }

  // Disparo manual do FECHO DA ÉPOCA OFICIAL de um ano: ?fecharano=AAAA
  // Calcula e grava o pódio anual (mundial + continentais) no livro de campeões.
  // PROTEÇÃO: só se pode fechar um ano JÁ TERMINADO (AAAA < ano atual). Fechar o
  // ano em curso gravaria um campeão prematuro. O fecho automático de 1/jan trata
  // sempre do ano anterior (já terminado), por isso não é afetado por esta regra.
  const fecharAno = (searchParams.get("fecharano") || "").trim();
  if (fecharAno && /^\d{4}$/.test(fecharAno)) {
    const anoPedido = parseInt(fecharAno, 10);
    const anoAtual = hoje.getFullYear();
    if (anoPedido >= anoAtual) {
      return NextResponse.json({
        feito: false,
        modo: "fechar_ano_recusado",
        erro: `Só é possível fechar um ano já terminado. ${anoPedido} ${anoPedido === anoAtual ? "ainda está a decorrer" : "ainda não chegou"}. O ano em curso fecha-se sozinho a 1 de janeiro.`,
        ms_total: Date.now() - t0,
      }, { status: 400 });
    }
    let r: { ano: number; mundial: number; continentais: Record<string, number> } | null = null;
    try { r = await fecharAnoOficial(anoPedido); } catch { /* não bloqueia */ }
    return NextResponse.json({ feito: true, modo: "fechar_ano_forcado", fecho: r, ms_total: Date.now() - t0 });
  }

  // (A) Atualiza a lista de "a competir agora" (para o aviso no Mercado).
  let aoVivo: { ao_vivo: string | null; atletas_ao_vivo: number } = { ao_vivo: null, atletas_ao_vivo: 0 };
  try {
    aoVivo = await atualizarAoVivo(hoje);
  } catch (e) {
    aoVivo = { ao_vivo: `erro: ${(e as { message?: string })?.message || "falha"}`, atletas_ao_vivo: 0 };
  }

  // (B) Prepara os preços da competição que se aproxima (14 categorias).
  // IMPORTANTE: calcula a competição que o MERCADO vai mostrar — focoMercado().alvo
  // — e não competicaoDaSemana(). Quando o mercado da competição da semana já
  // fechou, o mercado salta para a PRÓXIMA (alvo); se o cron calculasse a "da
  // semana", a competição que se escala ficava sem preços (média 0.0). Alinhar
  // os dois resolve isso.
  let comp = searchParams.get("comp");
  let alvo: SemanaCalendario | null = null;
  if (!comp) {
    alvo = focoMercado(hoje).alvo;
    comp = alvo.idCompeticao;
  }

  const passos: Array<{ categoria: string; ok: boolean; atualizados?: number; ms?: number; nota?: string }> = [];
  for (const { cat, gender } of CATS) {
    const catUrl = encodeURIComponent(cat);
    const url = `${base}/api/calcular?comp=${comp}&cat=${catUrl}&gender=${gender}`;
    try {
      const r = await fetch(url, { cache: "no-store" });
      const j = (await r.json()) as { sucesso?: boolean; atualizados?: number; ms?: number; nota?: string; erro?: string };
      passos.push({
        categoria: `${cat} ${gender}`,
        ok: !!j?.sucesso || typeof j?.atualizados === "number",
        atualizados: j?.atualizados,
        ms: j?.ms,
        nota: j?.erro || j?.nota,
      });
    } catch (e) {
      passos.push({ categoria: `${cat} ${gender}`, ok: false, nota: (e as { message?: string })?.message || "falha" });
    }
  }

  const totalAtualizados = passos.reduce((s, p) => s + (p.atualizados || 0), 0);
  const ok = passos.filter((p) => p.ok).length;

  // (C) CONGELA as competições recentes terminadas (motor lib/congelar).
  // Preenche resultados_atletas, resultados_rodada, precos_atletas, pontuacoes
  // e users.patrimony_jc — com a fonte correta. Idempotente.
  let congelamentos: { comp: string; nome: string; processados: number; faltam: number; utilizadores: number; completa: boolean }[] = [];
  try {
    congelamentos = await congelarRecentes(hoje);
  } catch { /* não bloqueia o resto do cron */ }

  // (C-bis) APURA as copas ativas (mata-mata) com os dados já congelados.
  let copas: { league_id: string; nome: string; apurou: boolean }[] = [];
  try {
    copas = await apurarCopasAtivas(base);
  } catch { /* não bloqueia */ }

  // (C-ter) ENCERRA as ligas de pontos corridos cuja janela início→fim acabou.
  let ligasEncerradas: { encerradas: number; ids: string[] } = { encerradas: 0, ids: [] };
  try {
    ligasEncerradas = await encerrarLigasTerminadas(hoje);
  } catch { /* não bloqueia */ }

  // (D) No início do mês (dia 1), recalcula as faixas do mês anterior. Permite
  //     também forçar via ?faixas=AAAA-MM para teste manual.
  let faixas: { mes: string; jogadores: number; percentilAtivo: boolean; distribuicao: Record<string, number> } | null = null;
  const forcarFaixas = (searchParams.get("faixas") || "").trim();
  try {
    if (forcarFaixas) {
      const r = await recalcularFaixas(forcarFaixas);
      faixas = { mes: forcarFaixas, ...r };
    } else if (hoje.getDate() === 1) {
      const mes = mesAnteriorDe(hoje);
      const r = await recalcularFaixas(mes);
      faixas = { mes, ...r };
    }
  } catch { /* não bloqueia */ }

  // (D-bis) FECHO DA ÉPOCA OFICIAL: no dia 1 de JANEIRO, fecha o ano que acabou
  //         (grava o pódio anual mundial + continentais no livro de campeões).
  let fechoAnual: { ano: number; mundial: number; continentais: Record<string, number> } | null = null;
  try {
    if (hoje.getDate() === 1 && hoje.getMonth() === 0) { // 1 de janeiro
      fechoAnual = await fecharAnoOficial(hoje.getFullYear() - 1);
    }
  } catch { /* não bloqueia */ }

  // (E) Notificações de MERCADO (aberto/fechado), idempotentes. Uma vez por
  //     competição. Não bloqueia o resto do cron se falhar.
  let mercado: { aberto: string | null; vespera: string | null; fechado: string | null } | null = null;
  try {
    mercado = await notificarMercado(hoje);
  } catch { /* não bloqueia */ }

  // (F) Notificações de DATAS ESPECIAIS por push (aniversário + Dia do Judô).
  //     Idempotente por dia. Não bloqueia o resto do cron se falhar.
  let datas: { dia_do_judo: number; aniversarios: number; outras_globais: number } | null = null;
  try {
    datas = await notificarDatasEspeciais(hoje);
  } catch { /* não bloqueia */ }

  return NextResponse.json({
    feito: true,
    comp,
    competicao: alvo ? alvo.nome : "(forçada por id)",
    classico: alvo ? alvo.classico : undefined,
    a_competir_agora: aoVivo.ao_vivo,
    atletas_a_competir_agora: aoVivo.atletas_ao_vivo,
    categorias_ok: `${ok}/${CATS.length}`,
    total_atletas_atualizados: totalAtualizados,
    congelamentos,
    copas,
    ligas_encerradas: ligasEncerradas,
    faixas,
    fecho_anual: fechoAnual,
    mercado,
    datas,
    ms_total: Date.now() - t0,
    passos,
  });
}
