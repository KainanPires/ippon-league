import { NextResponse } from "next/server";
import { competicaoDaSemana, competicaoFechada, focoMercado, CALENDARIO_2026, type SemanaCalendario } from "@/lib/calendario";
import { getCompetitionCompetitorsRaw, mapCompetitorsToAthletes } from "@/lib/ijf";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { congelarCompeticao } from "@/lib/congelar";
import { competicaoPorId } from "@/lib/copa";
import { notificarMercado } from "@/lib/notificarMercado";
import { criarNotificacaoServidor } from "@/lib/notificacoesServidor";
import { mensagensModaisDeHoje } from "@/lib/mensagensEspeciais";
import { NOME_CONTINENTE, type Continente } from "@/lib/continentes";
// CRON — o motor automático da Ippon League.
//
// DESENHO (mudou: ler antes de mexer)
// -----------------------------------
// Antes, o cron preparava os preços primeiro (14 categorias, ~18s cada ≈ 252s)
// e só depois congelava os resultados. Numa função com 300s de teto, isso punha
// a parte CRÍTICA — a que dá pontos e património às pessoas — a correr com o
// orçamento quase gasto. Se os preços se arrastassem, o congelamento morria.
//
// Agora é ao contrário, e com três travões:
//
// 1. ORDEM. Primeiro o que não pode falhar (congelar, apurar, notificar).
// Os preços vão para o FIM, com o tempo que sobrar. Preços atrasados umas
// horas são um incómodo; pontos por congelar são um jogo partido.
//
// 2. CURSOR nos preços. Cada corrida faz as categorias que couberem e guarda
// onde ficou (linha _cursor_precos no atletas_cache). A corrida seguinte
// continua dali. O cursor reinicia quando muda a competição-alvo OU quando
// muda o dia — garante uma passagem completa por dia, fatiada.
//
// 3. ORÇAMENTO. Nenhuma etapa nova arranca depois de MS_ORCAMENTO menos a sua
// margem. O cron termina sempre com resposta, nunca a meio.
//
// PRESSUPOSTO: este cron passa a correr DE HORA A HORA (cron-job.org), não 1x/dia.
// Com ~5 categorias por corrida, a passagem completa dos preços fecha em ~3h.
// Todas as outras etapas são idempotentes (congelar tem retoma; mercado e datas
  // têm travão por dia/competição; faixas só notificam quem muda mesmo), por isso
// correr de hora a hora não duplica nada.
//
// /api/cron -> corrida normal (congelar → apurar → avisar → preços)
// /api/cron?comp=ID -> força a competição-alvo dos preços
// /api/cron?key=SEGREDO -> disparo MANUAL para teste (em vez do cabeçalho da Vercel)
// /api/cron?congelar=ID -> força CONGELAR uma competição específica
// /api/cron?recongelar=ID -> limpa e volta a congelar do zero
// /api/cron?precos=1 -> força as 14 categorias de uma vez (ignora cursor e orçamento)
// /api/cron?diag=1 -> NÃO congela: mostra as contas do filtro de candidatas
// /api/cron?datas=1 -> força SÓ as notificações de datas especiais
// /api/cron?mercado=1 -> força SÓ as notificações de mercado
// /api/cron?melhores=ID -> força os Melhores da Rodada de uma competição
// /api/cron?encerrar=1 -> força SÓ o encerramento de ligas terminadas
// /api/cron?apurar=LEAGUE_ID -> força apurar uma copa
// /api/cron?fecharano=AAAA -> fecha a época de um ano JÁ TERMINADO
//
// Etapas, pela ordem em que correm:
// (A) atualiza "a competir agora" (aviso no Mercado)
// (C) CONGELA as competições recentes terminadas (motor lib/congelar)
// (C-quater) MELHORES DA RODADA das competições recém-congeladas
// (C-bis) APURA as copas ativas (mata-mata)
// (C-ter) ENCERRA as ligas de pontos corridos cuja janela acabou
// (D) no dia 1, recalcula as faixas do mês anterior (users.belt)
// (D-bis) a 1 de janeiro, fecha a época oficial do ano anterior
// (E) notificações de mercado (aberto/fechado)
// (F) notificações de DATAS ESPECIAIS (aniversário, Dia do Judô)
// (B) PREÇOS da competição que se aproxima — por cursor, com o que sobrar
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
// Linha especial no cache que marca o que JÁ foi feito uma vez. Sem isto, uma
// tarefa "do dia 1" corria a cada corrida do cron — e como ele passou a correr
// de HORA A HORA, isso deu 24 recálculos de faixa a 1 de agosto, com 24 rondas
// de notificações a cada utilizador. (Foi assim que aconteceu: a guarda "só no
  // dia 1" bastava quando o cron era diário, e deixou de bastar sem ninguém
  // reparar. Tarefas de "uma vez por período" precisam de marca própria, não de
  // depender da frequência com que o cron é chamado.)
const CHAVE_FEITO = "_feito_uma_vez";
// Linha especial no cache que guarda o CURSOR dos preços: { comp, dia, indice }.
// Vive no atletas_cache para não precisar de tabela nova (mesmo padrão do ao-vivo).
const CHAVE_CURSOR_PRECOS = "_cursor_precos";
// A partir de quantos jogadores ativos os percentis de faixa "ligam".
//
// Com poucos jogadores, um percentil não significa nada ("top 5%" de 4 pessoas
  // é zero pessoas), por isso o normal é 100 e, abaixo disso, fica toda a gente na
// branca. MAS isso torna as faixas impossíveis de TESTAR antes do lançamento —
// a virada do mês passava em silêncio e ninguém sabia se o motor funcionava.
//
// Por isso o mínimo é configurável: põe FAIXAS_MIN_JOGADORES=2 nas variáveis de
// ambiente da Vercel para testar a virada do mês com as contas de teste, e
// apaga a variável no lançamento para voltar aos 100. Sem redeploy de código.
//
// LEITURA TOLERANTE: extraímos o primeiro número que aparecer no valor, em vez
// de exigir que ele seja um número puro. Motivo prático: é fácil guardar 2 com
// aspas ("2") ou colado a outra coisa, e Number('"2"') dá NaN — o cron caía em
// silêncio nos 100 e a virada do mês passava sem faixas. Assim, "2", '2', ' 2 '
// e =2 funcionam todos.
const MIN_JOGADORES = (() => {
    const bruto = String(process.env.FAIXAS_MIN_JOGADORES ?? "");
    const achado = bruto.match(/\d+/);
    const v = achado ? parseInt(achado[0], 10) : NaN;
    return Number.isFinite(v) && v > 0 ? v : 100;
  })();
// Janela (dias) para procurar competições recém-terminadas a congelar.
const JANELA_DIAS = 21;
// ---------------------------------------------------------------------------
// ORÇAMENTO DE TEMPO
// A função tem maxDuration=300s. Trabalhamos até 240s e guardamos 60s de folga
// para a resposta e para o arranque frio. Cada etapa tem a sua MARGEM: é o
// tempo que essa etapa precisa, no pior caso, para não ficar a meio.
// ---------------------------------------------------------------------------
const MS_ORCAMENTO = 240_000;
const MS_MARGEM_ETAPA = 20_000; // etapas curtas (notificações, faixas)
const MS_MARGEM_CATEGORIA = 30_000; // uma categoria de preços (~18s + folga)
const MS_MARGEM_COMPETICAO = 45_000; // congelar uma competição
/** Ainda há tempo para começar uma etapa que precisa de `margem` ms? */
function haTempo(t0: number, margem: number): boolean {
  return Date.now() - t0 < MS_ORCAMENTO - margem;
}
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
// ---------------------------------------------------------------------------
// MARCAS DE "JÁ FEITO" — para tarefas que só devem correr UMA VEZ por período.
//
// Guardadas todas numa linha do atletas_cache, como um objeto { marca: ISO }.
// Uma linha só (e não uma por marca) porque são poucas e lidas em conjunto.
// ---------------------------------------------------------------------------
async function lerFeitos(): Promise<Record<string, string>> {
  if (!supabaseAdmin) return {};
  try {
    const { data } = await supabaseAdmin
    .from("atletas_cache").select("atletas").eq("id_competition", CHAVE_FEITO).maybeSingle();
    const a = data?.atletas;
    return (a && typeof a === "object" && !Array.isArray(a)) ? (a as Record<string, string>) : {};
  } catch { return {}; }
}
// DEVOLVE SE GRAVOU. O comentário antigo dizia "se falhar, no pior caso
// repete-se — não se perde trabalho". Isso é falso para as tarefas que
// NOTIFICAM.
//
// A marca das faixas existe precisamente porque, no dia 1, o cron corre 24
// vezes: sem ela, cada jogador recebia 24 notificações de mudança de faixa. Se
// o recálculo corre e a marca não grava, a hora seguinte repete tudo — e é
// exatamente o cenário das 58 notificações da Copa do Dôdo.
//
// Quem chama tem de saber, e a resposta do cron tem de o dizer.
async function marcarFeito(marca: string): Promise<boolean> {
  if (!supabaseAdmin) return false;
  try {
    const atuais = await lerFeitos();
    const { error } = await supabaseAdmin.from("atletas_cache").upsert(
      {
        id_competition: CHAVE_FEITO,
        atletas: { ...atuais, [marca]: new Date().toISOString() },
        total: Object.keys(atuais).length + 1,
        atualizado_em: new Date().toISOString(),
      },
      { onConflict: "id_competition" }
    );
    if (error) {
      console.error(`[cron] marca "${marca}" NÃO gravou: ${error.message}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error(`[cron] marca "${marca}" rebentou:`, e);
    return false;
  }
}
/** Chave do dia ("AAAA-MM-DD") para o cursor reiniciar todos os dias. */
function chaveDia(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
// Diz se uma competição (pela data do calendário) já começou — está a decorrer.
function jaComecou(c: SemanaCalendario, hoje: Date): boolean {
  const ini = new Date(c.de.replace(/\//g, "-") + "T00:00:00");
  const fim = new Date(ini.getTime() + 6 * 86400000);
  return hoje >= ini && hoje <= fim;
}
// ---------------------------------------------------------------------------
// CURSOR DOS PREÇOS — onde ficámos na última corrida.
// Guardado como { comp, dia, indice } na linha _cursor_precos do atletas_cache.
// comp = competição-alvo (se mudar, recomeça do zero)
// dia = "AAAA-MM-DD" (se mudar, recomeça: uma passagem completa por dia)
// indice = próxima categoria a fazer (0..CATS.length)
// ---------------------------------------------------------------------------
async function lerCursorPrecos(): Promise<{ comp: string; dia: string; indice: number } | null> {
  if (!supabaseAdmin) return null;
  try {
    const { data } = await supabaseAdmin
    .from("atletas_cache")
    .select("atletas")
    .eq("id_competition", CHAVE_CURSOR_PRECOS)
    .maybeSingle();
    const a = data?.atletas as { comp?: unknown; dia?: unknown; indice?: unknown } | null;
    if (!a || typeof a !== "object" || Array.isArray(a)) return null;
    const indice = Number(a.indice);
    return {
      comp: String(a.comp ?? ""),
      dia: String(a.dia ?? ""),
      indice: Number.isFinite(indice) && indice >= 0 ? indice : 0,
    };
  } catch {
    return null;
  }
}
async function gravarCursorPrecos(comp: string, dia: string, indice: number): Promise<void> {
  if (!supabaseAdmin) return;
  try {
    await supabaseAdmin.from("atletas_cache").upsert(
      {
        id_competition: CHAVE_CURSOR_PRECOS,
        atletas: { comp, dia, indice },
        total: indice,
        atualizado_em: new Date().toISOString(),
      },
      { onConflict: "id_competition" }
    );
  } catch { /* o cursor é uma otimização: se falhar, na próxima recomeça do zero */ }
}
// Guarda (ou limpa) a lista de IDs de quem está a competir agora.
async function atualizarAoVivo(hoje: Date): Promise<{ ao_vivo: string | null; atletas_ao_vivo: number }> {
  if (!supabaseAdmin) return { ao_vivo: null, atletas_ao_vivo: 0 };
  const atual = competicaoDaSemana(hoje);
  const aDecorrer = jaComecou(atual, hoje);
  if (!aDecorrer) {
    // LIMPA a lista de "a competir agora". Se este upsert falhar, a app fica a
    // dizer que há atletas em prova quando a competição já acabou — um aviso
    // errado é pior do que aviso nenhum, por isso o erro vai na resposta.
    const { error } = await supabaseAdmin.from("atletas_cache").upsert(
      { id_competition: CHAVE_AO_VIVO, atletas: [], total: 0, atualizado_em: new Date().toISOString() },
      { onConflict: "id_competition" }
    );
    if (error) return { ao_vivo: `erro ao limpar: ${error.message}`, atletas_ao_vivo: 0 };
    return { ao_vivo: null, atletas_ao_vivo: 0 };
  }
  const raw = await getCompetitionCompetitorsRaw(atual.idCompeticao);
  const atletas = mapCompetitorsToAthletes(raw);
  const ids = atletas.map((a) => a.id).filter(Boolean);
  const payload = { id_competicao: atual.idCompeticao, nome: atual.nome, ids };
  const { error } = await supabaseAdmin.from("atletas_cache").upsert(
    { id_competition: CHAVE_AO_VIVO, atletas: payload, total: ids.length, atualizado_em: new Date().toISOString() },
    { onConflict: "id_competition" }
  );
  // Se falhar, a lista fica a do ciclo anterior. O erro sobe na resposta em vez
  // de a app mostrar atletas desatualizados sem ninguém saber porquê.
  if (error) return { ao_vivo: `erro ao gravar: ${error.message}`, atletas_ao_vivo: 0 };
  return { ao_vivo: atual.nome, atletas_ao_vivo: ids.length };
}
// (C) CONGELA as competições recentes que já TERMINARAM (regra das 60h).
// Usa o motor lib/congelar (fonte correta competitor.contests). Idempotente:
// o motor tem retoma e não incha. Devolve um resumo por competição.
//
// ORÇAMENTO: não começa uma competição nova sem MS_MARGEM_COMPETICAO de folga.
// Se parar a meio, `parouPorTempo` fica true e a corrida seguinte apanha o resto
// (a competição continua na janela dos 21 dias, e o motor retoma onde ficou).
type ResumoCongelamento = { comp: string; nome: string; processados: number; faltam: number; utilizadores: number; completa: boolean };
async function congelarRecentes(hoje: Date, t0: number): Promise<{ feitos: ResumoCongelamento[]; parouPorTempo: boolean }> {
  const agora = hoje.getTime();
  const janelaMs = JANELA_DIAS * 24 * 60 * 60 * 1000;
  const candidatas = CALENDARIO_2026.filter((s) => {
      const inicio = new Date(s.de.replace(/\//g, "-") + "T00:00:00").getTime();
      const dentroDaJanela = inicio <= agora && agora - inicio <= janelaMs;
      return dentroDaJanela && competicaoFechada(s, hoje); // só as JÁ TERMINADAS (60h)
    });
  const feitos: ResumoCongelamento[] = [];
  let parouPorTempo = false;
  for (const s of candidatas) {
    if (!haTempo(t0, MS_MARGEM_COMPETICAO)) { parouPorTempo = true; break; }
    const mes = s.de.slice(0, 7).replace("/", "-");
    const anoEpoca = parseInt(s.de.slice(0, 4), 10);
    try {
      const r = await congelarCompeticao(s.idCompeticao, mes, anoEpoca);
      feitos.push({ comp: s.idCompeticao, nome: s.nome, processados: r.atletasProcessados, faltam: r.atletasEmFalta, utilizadores: r.utilizadores, completa: r.completa });
    } catch {
      feitos.push({ comp: s.idCompeticao, nome: s.nome, processados: 0, faltam: -1, utilizadores: 0, completa: false });
    }
  }
  return { feitos, parouPorTempo };
}
// (C-bis) APURA as copas ativas (mata-mata). Depois de congelar as competições,
// chama o /api/copa/apurar de cada liga que é copa e está a decorrer/sorteada.
// O apurar lê de resultados_atletas (já congelado acima), por isso decide bem.
// É o que torna o mata-mata AUTOMÁTICO (já não depende de alguém abrir a página).
async function apurarCopasAtivas(base: string, t0: number): Promise<{ league_id: string; nome: string; apurou: boolean }[]> {
  if (!supabaseAdmin) return [];
  const { data: copas } = await supabaseAdmin
  .from("leagues")
  .select("id, name, copa_estado")
  .eq("formato", "copa")
  .in("copa_estado", ["sorteada", "a_decorrer"]);
  const out: { league_id: string; nome: string; apurou: boolean }[] = [];
  for (const liga of copas || []) {
    if (!haTempo(t0, MS_MARGEM_ETAPA)) break;
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
    if (!fimEfetivo) continue; // sem fim definido (liga antiga): não toca
    if (hoje > fimEfetivo) idsParaEncerrar.push(String(liga.id));
  }
  for (const id of idsParaEncerrar) {
    await supabaseAdmin.from("leagues").update({ estado: "terminada" }).eq("id", id);
  }
  return { encerradas: idsParaEncerrar.length, ids: idsParaEncerrar };
}
// FIM EFETIVO de uma liga de pontos corridos (mesma regra da Peça 4 / liga-geral):
// • fim por mês → último instante do mês de fim (a competição do mês conta);
// • fim por competição → a data dessa competição (fim do dia);
// • recurso → a fim_data crua, se nada acima resolver.
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
async function recalcularFaixas(mes: string): Promise<{ jogadores: number; percentilAtivo: boolean; distribuicao: Record<string, number>; gravadas: number; falhadas: number; primeiroErro: string | null; minJogadores: number; minVindoDoAmbiente: boolean; minBruto: string | null }> {
  // minJogadores/minVindoDoAmbiente vão na resposta do cron para se poder VER que
  // limiar está mesmo a ser usado — sem isto, uma variável de ambiente que não
  // chega à função é indistinguível de uma que chega (ambas dão 'branca' a todos).
  const minInfo = {
    minJogadores: MIN_JOGADORES,
    minVindoDoAmbiente: !!process.env.FAIXAS_MIN_JOGADORES,
    minBruto: process.env.FAIXAS_MIN_JOGADORES ?? null, // valor cru, para depurar
  };
  if (!supabaseAdmin) return { jogadores: 0, percentilAtivo: false, distribuicao: {}, gravadas: 0, falhadas: 0, primeiroErro: null, ...minInfo };
  const { data: linhas } = await supabaseAdmin.from("pontuacoes").select("user_id, pontos").eq("mes", mes);
  const soma = new Map<string, number>();
  for (const l of linhas || []) soma.set(l.user_id, (soma.get(l.user_id) ?? 0) + (l.pontos ?? 0));
  const jogadores = [...soma.entries()].map(([user_id, total]) => ({ user_id, total }));
  const n = jogadores.length;
  if (n === 0) return { jogadores: 0, percentilAtivo: false, distribuicao: {}, gravadas: 0, falhadas: 0, primeiroErro: null, ...minInfo };
  jogadores.sort((a, b) => b.total - a.total);
  const percentilAtivo = n >= MIN_JOGADORES;
  const distribuicao: Record<string, number> = {};
  const atualizacoes: { user_id: string; faixa: string }[] = [];
  // Pontos de cada jogador no mês (para dizer quanto falta para a faixa acima).
  const totalDe = new Map<string, number>();
  for (const j of jogadores) totalDe.set(j.user_id, j.total);
  // Cortes de cada faixa (índice a partir do qual já não se pertence a ela).
  // Declarado FORA do if para as notificações o poderem usar.
  const limites: { faixa: string; ate: number }[] = [];
  if (!percentilAtivo) {
    for (const j of jogadores) atualizacoes.push({ user_id: j.user_id, faixa: "branca" });
    distribuicao["branca"] = n;
  } else {
    let acum = 0;
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
  // GRAVA a faixa de cada jogador — VERIFICANDO o resultado.
  //
  // Antes isto era um `await update(...)` sem olhar para o erro. Se a escrita
  // falhasse (constraint, id inexistente, permissões), o código seguia e mandava
  // à mesma a notificação "subiste para roxa" — enquanto a base ficava noutra
  // faixa. Foi assim que apareceram notificações que não batiam certo com o que
  // a app mostrava, sem nada nos registos a explicar porquê.
  //
  // Agora: quem falha a gravação NÃO é notificado (seria mentira), e a resposta
  // do cron diz quantas gravaram, quantas falharam e qual foi o primeiro erro.
  let faixasGravadas = 0;
  const faixasFalhadas: { user_id: string; faixa: string; erro: string }[] = [];
  for (const a of atualizacoes) {
    const { error } = await supabaseAdmin.from("users").update({ belt: a.faixa }).eq("id", a.user_id);
    if (error) {
      faixasFalhadas.push({ user_id: a.user_id, faixa: a.faixa, erro: String(error.message || "falha") });
      continue;
    }
    faixasGravadas++;
  }
  // Quem não ficou gravado não recebe notificação nenhuma.
  const naoGravou = new Set(faixasFalhadas.map((f) => f.user_id));
  // Notificação de fecho do mês. TODA A GENTE recebe uma — subiu, desceu ou
  // manteve. Antes só havia subida e descida, e quem mantinha a faixa não sabia
  // de nada: virava o mês e ficava sem perceber como tinha corrido. (Pedido do
    // Kainan.) Só quando o percentil está ativo (≥ MIN_JOGADORES); abaixo disso
  // está toda a gente na branca e não há nada de real a dizer.
  if (percentilAtivo) {
    for (const a of atualizacoes) {
      if (naoGravou.has(a.user_id)) continue; // a gravação falhou: não se anuncia
      const antes = faixaAntiga.get(a.user_id) ?? "branca";
      if (antes !== a.faixa) {
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
        continue;
      }
      // MANTEVE a faixa. Dizemos quanto faltou para a seguinte, para o mês não
      // acabar num vazio. Quem já é preta está no topo: não há "seguinte".
      const falta = pontosParaFaixaAcima(a.faixa, a.user_id, jogadores, limites, totalDe);
      const corpo = falta === null
      ? `Fechaste o mês na faixa ${nomeFaixa(a.faixa)} — o topo da Ippon League. Agora é aguentar lá em cima: no próximo mês há quem venha atrás do teu lugar.`
      : falta <= 0
      ? `Fechaste o mês na faixa ${nomeFaixa(a.faixa)}, mesmo à porta da seguinte. No próximo mês é tua.`
      : `Fechaste o mês na faixa ${nomeFaixa(a.faixa)}. Faltaram ${falta} pontos para a ${nomeFaixa(faixaAcimaDe(a.faixa))} — dá para ir buscá-los no próximo mês!`;
      await criarNotificacaoServidor({
          paraUserId: a.user_id,
          tipo: "faixa_mantida",
          titulo: `🥋 Mantiveste a faixa ${nomeFaixa(a.faixa)}`,
          corpo,
          link: "/inicio",
        });
    }
  }
  return {
    jogadores: n,
    percentilAtivo,
    distribuicao,
    gravadas: faixasGravadas,
    falhadas: faixasFalhadas.length,
    primeiroErro: faixasFalhadas[0]?.erro ?? null,
    ...minInfo,
  };
}
// A faixa imediatamente ACIMA desta na escada. "" se já for a melhor (preta).
function faixaAcimaDe(faixa: string): string {
  const d = degrauDaFaixa(faixa);
  if (d <= 0) return ""; // preta: não há acima
  return ESCADA[d - 1].faixa;
}
// Posição de uma faixa na ESCADA (0 = preta, ... 5 = azul). A branca não está
// na escada (é o resto), por isso fica no degrau a seguir ao último.
function degrauDaFaixa(faixa: string): number {
  const i = ESCADA.findIndex((e) => e.faixa === faixa);
  return i >= 0 ? i : ESCADA.length;
}
// Quantos PONTOS faltaram a este jogador para chegar à faixa acima da sua.
// Devolve null se já é a melhor faixa (preta) ou se não der para calcular.
//
// Como: para entrar na faixa acima é preciso estar dentro do corte dela
// (`ate`). Quem estivesse na última posição desse corte fez `pontosDoCorte`;
// a diferença para os pontos deste jogador é o que lhe faltou.
function pontosParaFaixaAcima(
  faixa: string,
  userId: string,
  jogadores: { user_id: string; total: number }[],
  limites: { faixa: string; ate: number }[],
  totalDe: Map<string, number>
): number | null {
  const d = degrauDaFaixa(faixa);
  if (d <= 0) return null; // preta: está no topo
  const alvo = limites[d - 1]; // o corte da faixa acima
  if (!alvo || alvo.ate <= 0) return null;
  const idxCorte = Math.min(alvo.ate - 1, jogadores.length - 1);
  const pontosDoCorte = jogadores[idxCorte]?.total ?? 0;
  const meus = totalDe.get(userId) ?? 0;
  return Math.round((pontosDoCorte - meus) * 10) / 10;
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
// • Dia do Judô (e outros eventos GLOBAIS push=true): a todos os utilizadores.
// • Aniversário: só a quem faz anos hoje.
//
// Idempotente por dia: antes de enviar, vê quem já recebeu HOJE esse tipo (via
  // tabela notificacoes), para um re-disparo manual não duplicar. É isto que
// permite o cron correr de hora a hora sem inundar ninguém.
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
// partir da data de nascimento (sem nome, para push genérico mas correto).
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
// Nome PT do continente para rótulos/mensagens. Defensivo (aceita string solta).
function nomeContinentePT(cont: string): string {
  return NOME_CONTINENTE[cont as Continente] ?? cont;
}
// ---------------------------------------------------------------------------
// MELHORES DA RODADA. Para uma competição JÁ CONGELADA e COMPLETA, calcula o
// vencedor da rodada (só Pro, como na liga oficial) e grava em melhores_rodada:
// • mundial → o nº1 do mundo. Como o nº1 do mundo é sempre também o nº1 do
// seu continente, este certificado é COMBINADO (Mundial + esse
  // continente). Guardamos o continente dele para o rótulo.
// • continental → o nº1 de cada continente cujo melhor NÃO seja o nº1 do mundo
// (esse já está coberto pelo combinado).
// Só conta quem pontuou (> 0). Empates no topo: todos os empatados ganham.
// Idempotente: se já há linhas para esta competição, não repete (nem push).
// ---------------------------------------------------------------------------
async function registrarMelhoresRodada(comp: string, nomeComp: string): Promise<{ gravados: number; jaExistia: boolean; push: number }> {
  const out = { gravados: 0, jaExistia: false, push: 0 };
  if (!supabaseAdmin) return out;
  // Idempotência: já calculado para esta competição? Não repete.
  const { data: ja } = await supabaseAdmin.from("melhores_rodada").select("id").eq("id_competicao", comp).limit(1);
  if (ja && ja.length > 0) { out.jaExistia = true; return out; }
  // 1) Pontos da rodada por utilizador (já congelado em resultados_rodada).
const { data: rod } = await supabaseAdmin.from("resultados_rodada").select("user_id, pontos_rodada").eq("id_competicao", comp);
const pts = new Map<string, number>();
for (const r of rod || []) pts.set(String(r.user_id), Number(r.pontos_rodada ?? 0));
if (pts.size === 0) return out;
const ids = [...pts.keys()];
// 2) Só Pro entram (consistente com a liga oficial). Lê is_pro + continente em lotes.
const proCont = new Map<string, string>(); // user_id -> continente ("" se desconhecido)
for (let i = 0; i < ids.length; i += 500) {
  const lote = ids.slice(i, i + 500);
  const { data } = await supabaseAdmin.from("users").select("id, is_pro, continente").in("id", lote);
  for (const u of data || []) if (u.is_pro) proCont.set(String(u.id), u.continente ? String(u.continente) : "");
}
if (proCont.size === 0) return out;
// Nº de participantes (Pro que escalaram) por âmbito — para o "entre N participantes".
const nMundial = proCont.size;
const nPorCont = new Map<string, number>();
for (const c of proCont.values()) if (c) nPorCont.set(c, (nPorCont.get(c) ?? 0) + 1);
// Candidatos a vencedor: Pro com pontos > 0.
const cand = [...proCont.entries()]
.map(([user_id, continente]) => ({ user_id, continente, pontos: pts.get(user_id) ?? 0 }))
.filter((c) => c.pontos > 0);
if (cand.length === 0) return out;
// 3) Identidade (nome + escudo) da equipa nesta competição.
const identDe = new Map<string, { nome: string; escudo: unknown }>();
for (let i = 0; i < ids.length; i += 500) {
  const lote = ids.slice(i, i + 500);
  const { data } = await supabaseAdmin.from("equipas").select("user_id, nome, escudo").eq("id_competicao", comp).in("user_id", lote);
  for (const e of data || []) identDe.set(String(e.user_id), { nome: e.nome ?? "Equipa", escudo: e.escudo ?? null });
}
// 4) Vencedor(es) MUNDIAL = máximo global (com empates).
const maxGlobal = Math.max(...cand.map((c) => c.pontos));
const mundialWinners = cand.filter((c) => c.pontos === maxGlobal);
const mundialIds = new Set(mundialWinners.map((c) => c.user_id));
// 5) Vencedor(es) CONTINENTAIS = máximo de cada continente, EXCLUINDO os
// vencedores mundiais (cobertos pelo certificado combinado).
const porCont = new Map<string, typeof cand>();
for (const c of cand) {
  if (!c.continente) continue;
  if (!porCont.has(c.continente)) porCont.set(c.continente, []);
  porCont.get(c.continente)!.push(c);
}
type Linha = { escopo: "mundial" | "continental"; continente: string; combinado: boolean; user_id: string; pontos: number; nPart: number };
const linhas: Linha[] = [];
for (const w of mundialWinners) {
  linhas.push({ escopo: "mundial", continente: w.continente, combinado: true, user_id: w.user_id, pontos: w.pontos, nPart: nMundial });
}
for (const [cont, lista] of porCont.entries()) {
  const maxK = Math.max(...lista.map((c) => c.pontos));
  const venc = lista.filter((c) => c.pontos === maxK && !mundialIds.has(c.user_id));
  for (const v of venc) {
    linhas.push({ escopo: "continental", continente: cont, combinado: false, user_id: v.user_id, pontos: v.pontos, nPart: nPorCont.get(cont) ?? lista.length });
  }
}
// 6) Grava (upsert idempotente) e notifica cada vencedor (sino + push).
for (const l of linhas) {
  const ident = identDe.get(l.user_id) || { nome: "Equipa", escudo: null };
  const { error } = await supabaseAdmin.from("melhores_rodada").upsert({
      id_competicao: comp,
      nome_competicao: nomeComp,
      escopo: l.escopo,
      continente: l.continente,
      combinado: l.combinado,
      user_id: l.user_id,
      nome_time: ident.nome,
      escudo: ident.escudo,
      pontos: Math.round(l.pontos * 10) / 10,
      n_participantes: l.nPart,
    }, { onConflict: "id_competicao,escopo,continente,user_id" });
  if (error) continue;
  out.gravados++;
  const rotulo = l.escopo === "mundial"
  ? `Mundial${l.continente ? ` + ${nomeContinentePT(l.continente)}` : ""}`
  : nomeContinentePT(l.continente);
  const ondeFoi = l.escopo === "mundial" ? "do mundo" : `de ${nomeContinentePT(l.continente)}`;
  try {
    await criarNotificacaoServidor({
        paraUserId: l.user_id,
        tipo: "melhor_rodada",
        titulo: `🥇 És o Melhor da Rodada — ${rotulo}!`,
        corpo: `Parabéns! Foste o nº1 ${ondeFoi} em ${nomeComp}. Vê e partilha o teu certificado na liga oficial.`,
        link: l.escopo === "mundial" ? "/oficial/mundial" : "/oficial/continental",
      });
    out.push++;
  } catch { /* push de um vencedor não bloqueia os outros */ }
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
    // DIAGNÓSTICO do 401. Não revela o segredo — só tamanhos e sim/não. Chega
    // para distinguir as três causas possíveis de "Não autorizado":
    // tem_segredo:false -> a variável CRON_SECRET não está a chegar à
    // função (não existe, ou está definida noutro
      // ambiente/âmbito que este deployment não vê)
    // tamanhos diferentes -> a chave enviada no ?key= não é a mesma
    // (valor trocado, ou o URL cortou-a num
      // caractere especial como & # + %)
    // segredo_com_espacos:true -> ficou um espaço/newline colado ao valor ao
    // guardar; invisível na Vercel, mas quebra a
    // comparação exata
    const seg = process.env.CRON_SECRET || "";
    return NextResponse.json({
        erro: "Não autorizado.",
        diag: {
          tem_segredo: !!process.env.CRON_SECRET,
          tamanho_segredo: seg.length,
          tamanho_chave_recebida: (key || "").length,
          segredo_com_espacos: seg !== seg.trim(),
          recebeu_cabecalho: !!req.headers.get("authorization"),
        },
      }, { status: 401 });
  }
  const base = baseUrl(req);
  const t0 = Date.now();
  const hoje = new Date();
  // DIAGNÓSTICO das candidatas a congelar: ?diag=1
  // Não congela nada — mostra, para cada semana perto de hoje, as contas do
  // filtro (horas desde o início, dentro da janela, terminada). É a resposta a
  // "porque é que a competição X não congelou sozinha?", sem adivinhar.
  const soDiag = (searchParams.get("diag") || "").trim();
  if (soDiag) {
    const agora = hoje.getTime();
    const janelaMs = JANELA_DIAS * 24 * 60 * 60 * 1000;
    const linhas = CALENDARIO_2026.map((s) => {
        const inicio = new Date(s.de.replace(/\//g, "-") + "T00:00:00").getTime();
        const horas = Math.round(((agora - inicio) / 3600000) * 10) / 10;
        const dentroDaJanela = inicio <= agora && agora - inicio <= janelaMs;
        const terminada = competicaoFechada(s, hoje);
        return {
          id: s.idCompeticao, nome: s.nome, de: s.de,
          inicio_iso: new Date(inicio).toISOString(),
          horas_desde_inicio: horas,
          dentroDaJanela, terminada,
          candidata: dentroDaJanela && terminada,
        };
      }).filter((l) => l.horas_desde_inicio > -720 && l.horas_desde_inicio < 1440);
    return NextResponse.json({
        feito: true, modo: "diagnostico",
        servidor_agora_iso: hoje.toISOString(),
        servidor_agora_local: hoje.toString(),
        fuso_offset_min: hoje.getTimezoneOffset(), // 0 na Vercel = UTC
        cursor_precos: await lerCursorPrecos(),
        candidatas: linhas.filter((l) => l.candidata).map((l) => l.id),
        linhas, ms_total: Date.now() - t0,
      });
  }
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
  const soMercado = (searchParams.get("mercado") || "").trim();
  if (soMercado) {
    let r: { aberto: string | null; fechado: string | null } | null = null;
    try { r = await notificarMercado(hoje); } catch { /* não bloqueia */ }
    return NextResponse.json({ feito: true, modo: "mercado_forcado", mercado: r, ms_total: Date.now() - t0 });
  }
  // Disparo manual SÓ das notificações de DATAS ESPECIAIS (teste): ?datas=1
  const soDatas = (searchParams.get("datas") || "").trim();
  if (soDatas) {
    let r: { dia_do_judo: number; aniversarios: number; outras_globais: number } = { dia_do_judo: 0, aniversarios: 0, outras_globais: 0 };
    try { r = await notificarDatasEspeciais(hoje); } catch { /* não bloqueia */ }
    return NextResponse.json({ feito: true, modo: "datas_forcado", datas: r, ms_total: Date.now() - t0 });
  }
  // Disparo manual dos MELHORES DA RODADA de uma competição (teste): ?melhores=ID
  // Com &refazer=1 apaga primeiro as linhas dessa competição, para recalcular do
  // zero (útil ao afinar). Sem refazer, respeita a idempotência (não repete).
  const soMelhores = (searchParams.get("melhores") || "").trim();
  if (soMelhores) {
    const refazer = (searchParams.get("refazer") || "").trim() === "1";
    if (refazer && supabaseAdmin) {
      await supabaseAdmin.from("melhores_rodada").delete().eq("id_competicao", soMelhores);
    }
    const s = CALENDARIO_2026.find((c) => c.idCompeticao === soMelhores);
    const nome = s ? s.nome : soMelhores;
    let r: { gravados: number; jaExistia: boolean; push: number } = { gravados: 0, jaExistia: false, push: 0 };
    // Disparo MANUAL: o erro tem de aparecer. Num catch vazio, a resposta vem
    // com `feito: true` e zeros, e não se distingue "correu e não havia nada"
    // de "rebentou" — e este é o caminho que se usa justamente quando algo já
    // correu mal.
    let erroMelhores: string | undefined;
    try { r = await registrarMelhoresRodada(soMelhores, nome); }
    catch (e) { erroMelhores = e instanceof Error ? e.message : String(e); }
    return NextResponse.json({ feito: !erroMelhores, modo: "melhores_forcado", comp: soMelhores, refez: refazer, resultado: r, erro: erroMelhores, ms_total: Date.now() - t0 });
  }
  // Disparo manual SÓ do encerramento de ligas terminadas (teste): ?encerrar=1
  const soEncerrar = (searchParams.get("encerrar") || "").trim();
  if (soEncerrar) {
    let r: { encerradas: number; ids: string[] } = { encerradas: 0, ids: [] };
    // Idem: disparo manual, o erro vai na resposta.
    let erroEncerrar: string | undefined;
    try { r = await encerrarLigasTerminadas(hoje); }
    catch (e) { erroEncerrar = e instanceof Error ? e.message : String(e); }
    return NextResponse.json({ feito: !erroEncerrar, modo: "encerrar_forcado", ligas_encerradas: r, erro: erroEncerrar, ms_total: Date.now() - t0 });
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
  // =========================================================================
  // CORRIDA NORMAL — pela ordem de importância. O que dá pontos vem primeiro;
  // os preços ficam para o fim, com o tempo que sobrar.
  // =========================================================================
  // (A) Atualiza a lista de "a competir agora" (para o aviso no Mercado).
  let aoVivo: { ao_vivo: string | null; atletas_ao_vivo: number } = { ao_vivo: null, atletas_ao_vivo: 0 };
  try {
    aoVivo = await atualizarAoVivo(hoje);
  } catch (e) {
    aoVivo = { ao_vivo: `erro: ${(e as { message?: string })?.message || "falha"}`, atletas_ao_vivo: 0 };
  }
  // (C) CONGELA as competições recentes terminadas (motor lib/congelar).
  // Preenche resultados_atletas, resultados_rodada, precos_atletas, pontuacoes
  // e users.patrimony_jc — com a fonte correta. Idempotente.
  let congelamentos: ResumoCongelamento[] = [];
  let congelamentoParou = false;
  try {
    const r = await congelarRecentes(hoje, t0);
    congelamentos = r.feitos;
    congelamentoParou = r.parouPorTempo;
  } catch { /* não bloqueia o resto do cron */ }
  // (C-quater) MELHORES DA RODADA: para cada competição recém-congelada e COMPLETA,
  // grava o(s) vencedor(es) da rodada (mundial combinado + continentais) e notifica.
  // Uma vez por competição (idempotente). Só quando o congelamento está completo,
  // para não premiar com dados parciais.
  const melhoresRodada: { comp: string; nome: string; gravados: number; jaExistia: boolean; push: number }[] = [];
  try {
    for (const c of congelamentos) {
      if (!c.completa) continue;
      if (!haTempo(t0, MS_MARGEM_ETAPA)) break;
      const r = await registrarMelhoresRodada(c.comp, c.nome);
      melhoresRodada.push({ comp: c.comp, nome: c.nome, ...r });
    }
  } catch { /* não bloqueia */ }
  // (C-bis) APURA as copas ativas (mata-mata) com os dados já congelados.
  let copas: { league_id: string; nome: string; apurou: boolean }[] = [];
  try {
    if (haTempo(t0, MS_MARGEM_ETAPA)) copas = await apurarCopasAtivas(base, t0);
  } catch { /* não bloqueia */ }
  // (C-ter) ENCERRA as ligas de pontos corridos cuja janela início→fim acabou.
  let ligasEncerradas: { encerradas: number; ids: string[] } = { encerradas: 0, ids: [] };
  try {
    if (haTempo(t0, MS_MARGEM_ETAPA)) ligasEncerradas = await encerrarLigasTerminadas(hoje);
  } catch { /* não bloqueia */ }
  // Tarefas de "uma vez por período" que esta corrida saltou por já estarem
  // feitas. Vai na resposta: sem isto, uma corrida que não faz nada é
  // indistinguível de uma que falhou em silêncio.
  const jaFeitoHoje: string[] = [];

  // Marcas que a tarefa correu mas NÃO conseguiu gravar. Se aparecer aqui algo,
  // a tarefa vai repetir-se na próxima hora — com as notificações incluídas.
  const marcasFalhadas: string[] = [];
  // (D) No início do mês (dia 1), recalcula as faixas do mês anterior. Permite
  // também forçar via ?faixas=AAAA-MM para teste manual.
  let faixas: { mes: string; jogadores: number; percentilAtivo: boolean; distribuicao: Record<string, number>; gravadas: number; falhadas: number; primeiroErro: string | null; minJogadores: number; minVindoDoAmbiente: boolean; minBruto: string | null } | null = null;
  const forcarFaixas = (searchParams.get("faixas") || "").trim();
  try {
    if (forcarFaixas) {
      const r = await recalcularFaixas(forcarFaixas);
      faixas = { mes: forcarFaixas, ...r };
    } else if (hoje.getDate() === 1 && haTempo(t0, MS_MARGEM_ETAPA)) {
      const mes = mesAnteriorDe(hoje);
      // UMA VEZ POR MÊS. A marca é o próprio mês recalculado, por isso a segunda
      // corrida do dia 1 (e todas as outras) encontra-a e não repete. Sem isto,
      // com o cron de hora a hora, cada jogador recebia 24 notificações de faixa
      // no mesmo dia.
      const feitos = await lerFeitos();
      const marca = `faixas_${mes}`;
      if (!feitos[marca]) {
        const r = await recalcularFaixas(mes);
        faixas = { mes, ...r };
        // Se a marca não gravar, a corrida seguinte volta a recalcular E A
        // NOTIFICAR. Fica registado na resposta para se ver logo, em vez de os
        // jogadores receberem a mesma notificação de hora a hora.
        if (!(await marcarFeito(marca))) marcasFalhadas.push(marca);
      } else {
        jaFeitoHoje.push(marca);
      }
    }
  } catch { /* não bloqueia */ }
  // (D-bis) FECHO DA ÉPOCA OFICIAL: no dia 1 de JANEIRO, fecha o ano que acabou
  // (grava o pódio anual mundial + continentais no livro de campeões).
  let fechoAnual: { ano: number; mundial: number; continentais: Record<string, number> } | null = null;
  try {
    if (hoje.getDate() === 1 && hoje.getMonth() === 0 && haTempo(t0, MS_MARGEM_ETAPA)) { // 1 de janeiro
      // UMA VEZ POR ANO, pela mesma razão das faixas: a 1 de janeiro o cron
      // corre 24 vezes, e sem marca reescrevia o pódio (e as notificações de
        // campeão) a cada hora.
      const anoFechar = hoje.getFullYear() - 1;
      const feitos = await lerFeitos();
      const marca = `ano_${anoFechar}`;
      if (!feitos[marca]) {
        fechoAnual = await fecharAnoOficial(anoFechar);
        // Idem: sem marca, o pódio do ano é reescrito (e os campeões
        // notificados) a cada hora do dia 1 de janeiro.
        if (!(await marcarFeito(marca))) marcasFalhadas.push(marca);
      } else {
        jaFeitoHoje.push(marca);
      }
    }
  } catch { /* não bloqueia */ }
  // (E) Notificações de MERCADO (aberto/fechado), idempotentes. Uma vez por
  // competição. Não bloqueia o resto do cron se falhar.
  let mercado: { aberto: string | null; vespera: string | null; fechado: string | null } | null = null;
  try {
    if (haTempo(t0, MS_MARGEM_ETAPA)) mercado = await notificarMercado(hoje);
  } catch { /* não bloqueia */ }
  // (E-bis) LEMBRETE DE VERIFICAÇÃO DE EMAIL — um por dia a quem ainda não
  // confirmou. A rota é que trata do "um por dia" (guarda de 20 horas), por isso
  // é seguro chamá-la de hora a hora: das 24 chamadas, só a primeira envia.
  let emailsVerificacao: { candidatos: number; enviados: number } | null = null;
  try {
    if (haTempo(t0, MS_MARGEM_ETAPA)) {
      const r = await fetch(`${base}/api/verificar-email?cron=1&key=${encodeURIComponent(process.env.CRON_SECRET || "")}`, {
          method: "POST",
        });
      const j = await r.json().catch(() => null);
      if (j && j.ok) emailsVerificacao = { candidatos: Number(j.candidatos || 0), enviados: Number(j.enviados || 0) };
    }
  } catch { /* não bloqueia o resto do cron */ }
  // (E-ter) CONTAS INATIVAS — avisa quem está prestes a perder a conta, e apaga
  // quem passou o ano. A rota trata do "uma vez por dia" (guarda de 20h), por
  // isso é seguro chamá-la de hora a hora.
  let contasInativas: { avisados: number; apagados: number } | null = null;
  try {
    if (haTempo(t0, MS_MARGEM_ETAPA)) {
      const r = await fetch(`${base}/api/contas-inativas?key=${encodeURIComponent(process.env.CRON_SECRET || "")}`);
      const j = await r.json().catch(() => null);
      if (j && j.ok) contasInativas = { avisados: Number(j.avisados || 0), apagados: Number(j.apagados || 0) };
    }
  } catch { /* não bloqueia o resto do cron */ }
  // (E-quater) HUB DA COMUNIDADE — gera as notícias das competições já
  // congeladas. A rota verifica se cada notícia já existe antes de a escrever,
  // por isso é seguro chamá-la de hora a hora.
  let hubNoticias: { candidatas: number; gravadas: number } | null = null;
  try {
    if (haTempo(t0, MS_MARGEM_ETAPA)) {
      const r = await fetch(`${base}/api/hub/gerar?key=${encodeURIComponent(process.env.CRON_SECRET || "")}`);
      const j = await r.json().catch(() => null);
      if (j && j.ok) hubNoticias = { candidatas: Number(j.candidatas || 0), gravadas: Number(j.gravadas || 0) };
    }
  } catch { /* não bloqueia o resto do cron */ }
  // (E-quinquies) Notícias AGENDADAS que já chegaram à hora. Uma notícia
  // escrita para sair às 9h fica invisível até lá — assim o editor pode
  // preparar a semana toda de uma vez.
  let agendadasPublicadas = 0;
  try {
    if (supabaseAdmin && haTempo(t0, MS_MARGEM_ETAPA)) {
      const { data } = await supabaseAdmin.rpc("ippon_publicar_agendadas");
      agendadasPublicadas = Number(data ?? 0);
      // E retira os destaques fora de prazo (48h) — ver hub-destaque-expira.sql.
      await supabaseAdmin.rpc("ippon_limpar_destaques");
    }
  } catch { /* não bloqueia o resto do cron */ }
  // (E-quinquies-bis) TRADUÇÃO DAS NOTÍCIAS — traduz para EN/ES/FR/DE as notícias
  // já publicadas que ainda não têm tradução: as geradas pelo motor e as agendadas
  // que acabaram de sair. As escritas pelo editor já se traduzem no ato de publicar
  // (o editor chama a rota); esta varredura é a rede de segurança para as restantes.
  // Idempotente e barata: só toca nas que ainda estão por traduzir, em lotes.
  let noticiasTraduzidas: { candidatas: number; traduzidas: number } | null = null;
  try {
    if (haTempo(t0, MS_MARGEM_ETAPA)) {
      const r = await fetch(`${base}/api/hub/traduzir?key=${encodeURIComponent(process.env.CRON_SECRET || "")}`);
      const j = await r.json().catch(() => null);
      if (j && j.ok) noticiasTraduzidas = { candidatas: Number(j.candidatas || 0), traduzidas: Number(j.traduzidas || 0) };
    }
  } catch { /* não bloqueia o resto do cron */ }
  // (E-sexies) MATA-MATA DO DÔDO: sorteia quando as inscrições fecham, e retira
  // quem deixou de ter Pro (o adversário avança). Ambas as rotas não fazem nada
  // quando não há edição a decorrer, por isso é barato chamá-las sempre.
  let dodo: { sorteio: unknown; desqualificados: number; edicao_aberta: number } | null = null;
  try {
    if (haTempo(t0, MS_MARGEM_ETAPA)) {
      const seg = encodeURIComponent(process.env.CRON_SECRET || "");
      // Abre a edição seguinte quando a atual chega às meias-finais. Só faz
      // alguma coisa se o ciclo automático estiver ligado em dodo_config —
      // antes do lançamento, fica desligado e nada abre sozinho.
      let abriu = 0;
      try {
        if (supabaseAdmin) {
          const { data } = await supabaseAdmin.rpc("ippon_abrir_proxima_copa");
          abriu = Number(data ?? 0);
        }
      } catch { /* sem ciclo: segue */ }
      const rs = await fetch(`${base}/api/dodo?sortear=1&key=${seg}`).then((r) => r.json()).catch(() => null);
      const rv = await fetch(`${base}/api/dodo/verificar-pro?key=${seg}`).then((r) => r.json()).catch(() => null);
      dodo = { sorteio: rs?.ok ? rs : null, desqualificados: Number(rv?.desqualificados || 0), edicao_aberta: abriu };
    }
  } catch { /* não bloqueia o resto do cron */ }
  // (F) Notificações de DATAS ESPECIAIS por push (aniversário + Dia do Judô).
  // Idempotente por dia. Não bloqueia o resto do cron se falhar.
  let datas: { dia_do_judo: number; aniversarios: number; outras_globais: number } | null = null;
  try {
    if (haTempo(t0, MS_MARGEM_ETAPA)) datas = await notificarDatasEspeciais(hoje);
  } catch { /* não bloqueia */ }
  // -------------------------------------------------------------------------
  // (B) PREÇOS da competição que se aproxima — POR CURSOR, no fim.
  //
  // IMPORTANTE: calcula a competição que o MERCADO vai mostrar — focoMercado().alvo
  // — e não competicaoDaSemana(). Quando o mercado da competição da semana já
  // fechou, o mercado salta para a PRÓXIMA (alvo); se o cron calculasse a "da
  // semana", a competição que se escala ficava sem preços (média 0.0).
  //
  // O cursor guarda a próxima categoria a fazer. Reinicia quando muda a
  // competição-alvo ou quando muda o dia. Com ?precos=1 faz as 14 de uma vez,
  // ignorando cursor e orçamento (para testes à mão).
  // -------------------------------------------------------------------------
  // comp começa como string (não string|null): o cursor precisa de a comparar
  // e de a gravar, e um null aqui rebentava a tipagem.
  let comp = (searchParams.get("comp") || "").trim();
  let alvo: SemanaCalendario | null = null;
  if (!comp) {
    alvo = focoMercado(hoje).alvo;
    comp = alvo.idCompeticao;
  }
  const forcarPrecos = (searchParams.get("precos") || "").trim() === "1";
  const diaHoje = chaveDia(hoje);
  let inicio = 0;
  if (!forcarPrecos) {
    const cur = await lerCursorPrecos();
    if (cur && cur.comp === comp && cur.dia === diaHoje) inicio = Math.min(cur.indice, CATS.length);
  }
  const passos: Array<{ categoria: string; ok: boolean; atualizados?: number; ms?: number; nota?: string }> = [];
  let i = inicio;
  while (i < CATS.length) {
    if (!forcarPrecos && !haTempo(t0, MS_MARGEM_CATEGORIA)) break;
    const { cat, gender } = CATS[i];
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
    i++;
  }
  // Grava onde ficámos. Se chegou ao fim, o índice fica em CATS.length e as
  // corridas seguintes de hoje não repetem trabalho (só amanhã, com dia novo).
  if (!forcarPrecos) await gravarCursorPrecos(comp, diaHoje, i);
  const totalAtualizados = passos.reduce((s, p) => s + (p.atualizados || 0), 0);
  const ok = passos.filter((p) => p.ok).length;
  return NextResponse.json({
      feito: true,
      comp,
      competicao: alvo ? alvo.nome : "(forçada por id)",
      classico: alvo ? alvo.classico : undefined,
      a_competir_agora: aoVivo.ao_vivo,
      atletas_a_competir_agora: aoVivo.atletas_ao_vivo,
      congelamentos,
      congelamento_parou_por_tempo: congelamentoParou,
      melhores_rodada: melhoresRodada,
      copas,
      ligas_encerradas: ligasEncerradas,
      faixas,
      fecho_anual: fechoAnual,
      ja_feito: jaFeitoHoje,
      marcas_falhadas: marcasFalhadas,
      mercado,
      datas,
      emails_verificacao: emailsVerificacao,
      contas_inativas: contasInativas,
      hub_noticias: hubNoticias,
      dodo,
      noticias_agendadas_publicadas: agendadasPublicadas,
      noticias_traduzidas: noticiasTraduzidas,
      // Estado dos preços nesta corrida (cursor): de onde partiu, onde ficou.
      precos: {
        dia: diaHoje,
        de_categoria: inicio,
        ate_categoria: i,
        total_categorias: CATS.length,
        passagem_completa: i >= CATS.length,
        forcado: forcarPrecos,
        categorias_ok: `${ok}/${passos.length}`,
        total_atletas_atualizados: totalAtualizados,
      },
      ms_total: Date.now() - t0,
      passos,
    });
}
