// lib/scout.ts
//
// ANÁLISE PROFUNDA DE ATLETAS — a "joia do Pro".
// Lógica PURA (corre no servidor, porque vai à API do JudoBase). SEM UI.
// Monta um "dossiê" por atleta a partir da estrutura REAL da API (confirmada
// por sondagem em 12/06/2026, id_person 63577):
//
//   competitor.info     -> perfil (país, faixa, técnica, treinador, idade)
//   competitor.contests -> histórico de lutas (nº comps, % vitórias, H2H, forma)
//   competitor.results  -> participações COM colocação (títulos, "nesta comp")
//   competitor.medals   -> contagem de medalhas por colocação
//
// REAPROVEITA o lib/ijf.ts (não duplica): getCompetitor, getCompetitorContests
// e scoreContestForPerson já lá existem. Só as duas ações que o ijf.ts ainda
// não expõe (results, medals) têm aqui um pequeno fetch próprio — para NÃO
// mexer no ijf.ts na véspera do teste. Consolidar no ijf.ts depois de sábado.
//
// NÃO usa person.info de propósito: essa ação expõe telemóvel e email pessoais
// do atleta (risco RGPD). Tudo o que precisamos está no competitor.info.

import {
  getCompetitor,
  getCompetitorContests,
  scoreContestForPerson,
  type IjfContest,
} from "@/lib/ijf";

/* =========================================================================
 * TIPOS — a forma REAL dos dados (do JSON sondado)
 * ========================================================================= */

// Uma luta de competitor.contests traz MAIS campos do que o IjfContest tipado
// no ijf.ts (que foi pensado para competition.contests). Em runtime os campos
// abaixo existem; aqui estendemos o tipo para os podermos ler com segurança.
type ContestRich = IjfContest & {
  competition_name?: string;
  competition_date?: string; // "2021-05-01"
  date_raw?: string; // "2021/05/01"
  weight?: string; // "-60"
  age?: string; // "Seniors"
  round_name?: string; // "best 64"
  person_white?: string;
  person_blue?: string;
  person_white_family_name?: string;
  person_blue_family_name?: string;
  person_white_given_name?: string;
  person_blue_given_name?: string;
  country_short_white?: string;
  country_short_blue?: string;
};

// Uma linha de competitor.results (cada competição mapeia a um array com 1 linha).
interface ResultRow {
  id_competition: string;
  competition_name: string;
  competition_date: string; // "01-May-2021"
  date_raw: string; // "2021/05/01"
  date_from?: string;
  date_to?: string;
  rank: string; // "Continental Championships", "Grand Slam", ...
  rank_group: string; // "cont_champ","gs","gp","wc","cont_open","cont_cup","oth"
  age?: string; // "Seniors"
  weight?: string; // "-60"
  place_name: string; // "participations","quarterfinals","semifinal","final","won finals"
  place: string; // "tp" | "1" | "2" | "3" | "5" | "7"...
  is_disqualified?: string; // "0" | "1"
  valuable?: string | null;
}

/* =========================================================================
 * SAÍDA — o dossiê
 * ========================================================================= */

export type Medalha = "ouro" | "prata" | "bronze";

export interface PerfilAtleta {
  idPerson: string;
  nome: string;
  pais: string | null; // sigla (MLT, JPN, ...)
  paisNome: string | null; // por extenso
  faixa: string | null; // belt
  tecnica: string | null; // ftechique (técnica preferida)
  treinador: string | null; // coach
  idade: number | null;
  categorias: string[];
}

export interface Experiencia {
  competicoes: number; // nº de competições distintas com lutas
  lutas: number; // nº de lutas no histórico
  vitorias: number;
  derrotas: number;
  taxaVitoria: number; // 0..1 (sobre lutas decididas)
}

export interface ResultadoCompeticao {
  idCompeticao: string;
  nome: string;
  data: string; // date_raw (YYYY/MM/DD)
  ano: number | null;
  nivel: string; // rank_group
  nivelLabel: string; // legível
  colocacao: string; // já legível ("Campeão", "Vice-campeão", "Participação"...)
  place: number | null;
  medalha: Medalha | null;
  pequenosEstados: boolean; // é um campeonato de "Pequenos Estados"?
  pontosNossos: number | null; // pontos no NOSSO sistema (se houver lutas)
}

export interface Conquista {
  nome: string;
  ano: number | null;
  nivel: string; // rank_group
  nivelLabel: string;
  prestigio: number; // peso interno para ordenar
  medalha: Medalha;
  pequenosEstados: boolean;
  continental: boolean; // campeonato continental?
  mundial: boolean; // mundial / olímpico?
}

export interface FormaRecente {
  competicoes: ResultadoCompeticao[]; // últimas N (passadas), mais recente primeiro
  pontosMedios: number | null; // média de pontos nossos nessas competições
}

export interface ConfrontoDireto {
  idAdversario: string;
  nomeAdversario: string | null;
  lutas: number;
  vitorias: number; // do NOSSO atleta
  derrotas: number;
  detalhe: { competicao: string; ano: number | null; venceu: boolean }[];
}

export interface NivelDesempenho {
  nivel: string; // rank_group
  nivelLabel: string;
  participacoes: number; // nº de competições passadas deste nível
  podios: number;
  ouro: number;
  prata: number;
  bronze: number;
  melhorColocacao: string; // legível ("Campeão", "5.º lugar", "—")
  pontosMedios: number | null; // média no NOSSO sistema neste nível
  ehNivelDestaCompeticao: boolean; // é o nível da competição-alvo?
}

export interface Dossie {
  perfil: PerfilAtleta;
  experiencia: Experiencia;
  medalhas: { ouro: number; prata: number; bronze: number; total: number };
  conquistas: Conquista[]; // só pódios, ordenadas por prestígio desc
  melhorResultado: Conquista | null; // a de maior prestígio (calculada por nós)
  formaRecente: FormaRecente;
  desempenhoPorNivel: NivelDesempenho[]; // track-record por nível de evento (Grand Slam, Open, ...)
  confrontoDireto: ConfrontoDireto | null; // só se passarmos o id do adversário
  avisos: string[]; // notas de qualidade de dados
}

/* =========================================================================
 * FETCH das duas ações que faltam no ijf.ts (results, medals)
 * ========================================================================= */

const IJF_BASE = "https://data.ijf.org/api/get_json";
const TIMEOUT_MS = 15000;

function buildUrl(action: string, params: Record<string, string>): string {
  const qs = Object.entries(params)
    .map(([k, v]) => `&params%5B${k}%5D=${encodeURIComponent(v)}`)
    .join("");
  return `${IJF_BASE}?access_token=&params%5Baction%5D=${action}${qs}`;
}

async function callIjf<T>(action: string, params: Record<string, string>): Promise<T | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(buildUrl(action, params), {
      cache: "no-store",
      signal: ctrl.signal,
      headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 (IpponLeague)" },
    });
    const text = await res.text();
    clearTimeout(timer);
    if (text.includes("unknown action")) return null;
    return JSON.parse(text) as T;
  } catch {
    clearTimeout(timer);
    return null;
  }
}

// competitor.results vem como objeto { id_competition: [linha] }. Achatamos.
export async function getCompetitorResults(idPerson: string): Promise<ResultRow[]> {
  const data = await callIjf<Record<string, ResultRow[]>>("competitor.results", { id_person: idPerson });
  if (!data || typeof data !== "object") return [];
  const rows: ResultRow[] = [];
  for (const v of Object.values(data)) {
    if (Array.isArray(v)) for (const r of v) if (r && typeof r === "object") rows.push(r);
  }
  return rows;
}

// competitor.medals vem como { "1":"2", "2":"2", "3":"1", ... } (place -> contagem).
export async function getCompetitorMedals(idPerson: string): Promise<Record<string, number>> {
  const data = await callIjf<Record<string, unknown>>("competitor.medals", { id_person: idPerson });
  const out: Record<string, number> = {};
  if (data && typeof data === "object") {
    for (const [k, v] of Object.entries(data)) {
      const n = Number(v);
      if (!isNaN(n)) out[k] = n;
    }
  }
  return out;
}

/* =========================================================================
 * HELPERS
 * ========================================================================= */

const NIVEL_LABEL: Record<string, string> = {
  olympic: "Jogos Olímpicos",
  wc: "Campeonato do Mundo",
  world_cup: "Taça do Mundo",
  masters: "Masters",
  cont_champ: "Campeonato Continental",
  gs: "Grand Slam",
  gp: "Grand Prix",
  cont_open: "Continental Open",
  cont_cup: "Taça Continental",
  oth: "Outros eventos",
};

// Prestígio relativo para ordenar conquistas (maior = mais importante).
const NIVEL_PRESTIGIO: Record<string, number> = {
  olympic: 100,
  wc: 90,
  masters: 80,
  cont_champ: 70,
  gs: 60,
  gp: 50,
  cont_open: 30,
  cont_cup: 25,
  oth: 10,
};

function nivelLabel(grupo: string): string {
  return NIVEL_LABEL[grupo] ?? "Competição";
}

// "RYUJU NAGAYAMA" / "james" -> "Ryuju Nagayama"
function titleCase(s: string): string {
  return s.toLowerCase().replace(/(^|[\s-])([a-zà-ú])/g, (_m, sep: string, c: string) => sep + c.toUpperCase());
}

function anoDe(data: string | undefined): number | null {
  if (!data) return null;
  const m = String(data).match(/(\d{4})/);
  return m ? Number(m[1]) : null;
}

// Data de hoje em "YYYY/MM/DD" (mesma forma que date_raw -> compara lexicalmente).
function hojeRaw(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}/${mm}/${dd}`;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

function medalhaDePlace(place: number | null): Medalha | null {
  if (place === 1) return "ouro";
  if (place === 2) return "prata";
  if (place === 3) return "bronze";
  return null;
}

// Colocação legível: prioriza a medalha; senão usa o place_name.
function colocacaoLegivel(placeName: string, medalha: Medalha | null): string {
  if (medalha === "ouro") return "Campeão";
  if (medalha === "prata") return "Vice-campeão";
  if (medalha === "bronze") return "3.º lugar";
  const mapa: Record<string, string> = {
    "won finals": "Campeão",
    final: "Finalista",
    semifinal: "Semifinal",
    quarterfinals: "Quartos de final",
    participations: "Participação",
  };
  return mapa[placeName] ?? "Participação";
}

// Colocação legível a partir de um lugar numérico (1..N). Usada no resumo por nível.
function colocacaoDePlace(place: number | null): string {
  if (place === null) return "—";
  if (place === 1) return "Campeão";
  if (place === 2) return "Vice-campeão";
  if (place === 3) return "3.º lugar";
  return `${place}.º lugar`;
}

function ehPequenosEstados(nome: string): boolean {
  return /small states|pequenos estados/i.test(nome || "");
}

// Infere o NÍVEL (rank_group) de uma competição a partir do nome. Heurística
// segura: se errar, o resumo por nível continua todo lá — só não destaca a linha.
function inferirNivel(nome: string): string | null {
  const n = (nome || "").toLowerCase();
  if (/olympic|olímpic/.test(n)) return "olympic";
  if (/world championship|campeonato do mundo/.test(n)) return "wc";
  if (/masters/.test(n)) return "masters";
  if (/grand slam/.test(n)) return "gs";
  if (/grand prix/.test(n)) return "gp";
  if (/(continental|european|pan.?american|african|asian|oceania[n]?) championship/.test(n)) return "cont_champ";
  if (/\bcup\b|taça/.test(n)) return "cont_cup";
  if (/\bopen\b/.test(n)) return "cont_open";
  return null;
}

// Convertemos cada ResultRow num ResultadoCompeticao (já legível).
function rowParaResultado(r: ResultRow, pontosPorComp: Map<string, number>): ResultadoCompeticao {
  const place = (() => {
    const n = parseInt(String(r.place), 10);
    return isNaN(n) ? null : n;
  })();
  const medalha = medalhaDePlace(place);
  const idc = String(r.id_competition);
  return {
    idCompeticao: idc,
    nome: r.competition_name || "Competição",
    data: r.date_raw || "",
    ano: anoDe(r.date_raw || r.competition_date),
    nivel: r.rank_group || "oth",
    nivelLabel: nivelLabel(r.rank_group || "oth"),
    colocacao: colocacaoLegivel(r.place_name || "", medalha),
    place,
    medalha,
    pequenosEstados: ehPequenosEstados(r.competition_name || ""),
    pontosNossos: pontosPorComp.has(idc) ? round1(pontosPorComp.get(idc)!) : null,
  };
}

/* =========================================================================
 * MONTAR O DOSSIÊ
 * ========================================================================= */

export async function montarDossie(
  idPerson: string,
  opts: { nomeCompeticaoAlvo?: string; idAdversario?: string } = {}
): Promise<Dossie | null> {
  const id = String(idPerson);

  const [info, contestsRaw, rows, medalsRaw] = await Promise.all([
    getCompetitor(id),
    getCompetitorContests(id),
    getCompetitorResults(id),
    getCompetitorMedals(id),
  ]);

  // Sem perfil não há dossiê (atleta inexistente ou API em baixo).
  if (!info) return null;

  const contests = contestsRaw as ContestRich[];
  const avisos: string[] = [];

  /* ---- Perfil -------------------------------------------------------- */
  const i = info as typeof info & {
    given_name?: string;
    family_name?: string;
    country?: string;
    country_short?: string;
    coach?: string;
    best_result?: string | null;
    age?: string;
    categories?: string[];
  };
  const nome = titleCase(`${i.given_name ?? ""} ${i.family_name ?? ""}`.trim()) || "Atleta";
  const idade = (() => {
    const n = parseInt(String(i.age ?? ""), 10);
    return isNaN(n) ? null : n;
  })();
  const perfil: PerfilAtleta = {
    idPerson: id,
    nome,
    pais: i.country_short || null,
    paisNome: i.country || null,
    faixa: i.belt || null,
    tecnica: i.ftechique || null,
    treinador: i.coach || null,
    idade,
    categorias: Array.isArray(i.categories) ? i.categories : [],
  };

  /* ---- Pontos NOSSOS por competição (a partir das lutas) ------------- */
  // Usa o motor real (scoreContestForPerson) para somar, por competição, os
  // pontos que este atleta faria no nosso jogo. Liga o scout à pontuação real.
  const pontosPorComp = new Map<string, number>();
  for (const c of contests) {
    const idc = String(c.id_competition ?? "");
    if (!idc) continue;
    pontosPorComp.set(idc, (pontosPorComp.get(idc) ?? 0) + scoreContestForPerson(c, id));
  }

  /* ---- Experiência (nº comps, lutas, % vitórias) --------------------- */
  const compsDistintas = new Set<string>();
  let vitorias = 0;
  let derrotas = 0;
  let decididas = 0;
  for (const c of contests) {
    if (c.id_competition) compsDistintas.add(String(c.id_competition));
    const w = String(c.id_winner ?? "");
    if (!w || w === "0") continue; // luta sem resultado
    decididas++;
    if (w === id) vitorias++;
    else derrotas++;
  }
  const experiencia: Experiencia = {
    competicoes: compsDistintas.size,
    lutas: contests.length,
    vitorias,
    derrotas,
    taxaVitoria: decididas > 0 ? round1((vitorias / decididas) * 100) / 100 : 0,
  };

  /* ---- Medalhas ------------------------------------------------------ */
  const ouro = medalsRaw["1"] ?? 0;
  const prata = medalsRaw["2"] ?? 0;
  const bronze = medalsRaw["3"] ?? 0;
  const medalhas = { ouro, prata, bronze, total: ouro + prata + bronze };

  /* ---- Conquistas (só pódios) + melhor resultado --------------------- */
  const conquistas: Conquista[] = [];
  for (const r of rows) {
    if (String(r.is_disqualified ?? "0") === "1") continue;
    const place = parseInt(String(r.place), 10);
    const medalha = medalhaDePlace(isNaN(place) ? null : place);
    if (!medalha) continue; // só pódios (1/2/3)
    const grupo = r.rank_group || "oth";
    const pe = ehPequenosEstados(r.competition_name || "");
    // Pequenos Estados pesa menos (é um continental "menor") — para sermos honestos.
    const prestigio = (NIVEL_PRESTIGIO[grupo] ?? 10) - (pe ? 25 : 0);
    conquistas.push({
      nome: r.competition_name || "Competição",
      ano: anoDe(r.date_raw || r.competition_date),
      nivel: grupo,
      nivelLabel: nivelLabel(grupo),
      prestigio,
      medalha,
      pequenosEstados: pe,
      continental: grupo === "cont_champ",
      mundial: grupo === "wc" || grupo === "olympic",
    });
  }
  const ordemMedalha: Record<Medalha, number> = { ouro: 0, prata: 1, bronze: 2 };
  conquistas.sort((a, b) => {
    if (b.prestigio !== a.prestigio) return b.prestigio - a.prestigio;
    if (ordemMedalha[a.medalha] !== ordemMedalha[b.medalha]) return ordemMedalha[a.medalha] - ordemMedalha[b.medalha];
    return (b.ano ?? 0) - (a.ano ?? 0);
  });
  const melhorResultado = conquistas[0] ?? null;
  if (!i.best_result && melhorResultado) {
    avisos.push("Melhor resultado calculado a partir do histórico (a API não o fornece para este atleta).");
  }

  /* ---- Forma recente (últimas competições passadas) ------------------ */
  const hoje = hojeRaw();
  const passadas = rows
    .filter((r) => (r.date_raw || "") && r.date_raw <= hoje)
    .sort((a, b) => (b.date_raw || "").localeCompare(a.date_raw || ""))
    .slice(0, 5)
    .map((r) => rowParaResultado(r, pontosPorComp));
  const comPontos = passadas.filter((p) => p.pontosNossos !== null);
  const pontosMedios =
    comPontos.length > 0 ? round1(comPontos.reduce((s, p) => s + (p.pontosNossos ?? 0), 0) / comPontos.length) : null;
  const formaRecente: FormaRecente = { competicoes: passadas, pontosMedios };

  /* ---- Desempenho por NÍVEL de evento (robusto, sem casar nomes) ----- */
  // Em vez de "já jogou nesta competição exata?" (frágil — cada Open muda de
  // cidade e de nome), mostramos como o atleta se sai em cada NÍVEL: Grand Slam,
  // Open, Campeonato Continental, etc. Se conseguirmos inferir o nível da
  // competição-alvo, assinalamos a linha relevante (ehNivelDestaCompeticao).
  const nivelAlvo = opts.nomeCompeticaoAlvo ? inferirNivel(opts.nomeCompeticaoAlvo) : null;
  const porNivel = new Map<string, ResultRow[]>();
  for (const r of rows) {
    if ((r.date_raw || "") > hoje) continue; // só competições passadas
    const g = r.rank_group || "oth";
    if (!porNivel.has(g)) porNivel.set(g, []);
    porNivel.get(g)!.push(r);
  }
  const desempenhoPorNivel: NivelDesempenho[] = [];
  for (const [g, lista] of porNivel) {
    let ouroN = 0;
    let prataN = 0;
    let bronzeN = 0;
    let podios = 0;
    let melhorPlace: number | null = null;
    const pts: number[] = [];
    for (const r of lista) {
      const place = parseInt(String(r.place), 10);
      const med = medalhaDePlace(isNaN(place) ? null : place);
      if (med === "ouro") ouroN++;
      else if (med === "prata") prataN++;
      else if (med === "bronze") bronzeN++;
      if (med) podios++;
      if (!isNaN(place) && (melhorPlace === null || place < melhorPlace)) melhorPlace = place;
      const p = pontosPorComp.get(String(r.id_competition));
      if (typeof p === "number") pts.push(p);
    }
    desempenhoPorNivel.push({
      nivel: g,
      nivelLabel: nivelLabel(g),
      participacoes: lista.length,
      podios,
      ouro: ouroN,
      prata: prataN,
      bronze: bronzeN,
      melhorColocacao: colocacaoDePlace(melhorPlace),
      pontosMedios: pts.length > 0 ? round1(pts.reduce((s, x) => s + x, 0) / pts.length) : null,
      ehNivelDestaCompeticao: nivelAlvo !== null && g === nivelAlvo,
    });
  }
  // Ordena pelo prestígio do nível (mais alto primeiro).
  desempenhoPorNivel.sort((a, b) => (NIVEL_PRESTIGIO[b.nivel] ?? 0) - (NIVEL_PRESTIGIO[a.nivel] ?? 0));

  /* ---- Confronto direto (head-to-head) ------------------------------- */
  let confrontoDireto: ConfrontoDireto | null = null;
  if (opts.idAdversario) {
    const adv = String(opts.idAdversario);
    const ourFamily = (i.family_name || "").toUpperCase();
    const rel = contests.filter((c) => {
      const azul = String(c.id_person_blue);
      const branco = String(c.id_person_white);
      const temNos = azul === id || branco === id;
      const temAdv = azul === adv || branco === adv;
      return temNos && temAdv;
    });
    let v = 0;
    let d = 0;
    let nomeAdv: string | null = null;
    const detalhe = rel.map((c) => {
      const decidido = c.id_winner && String(c.id_winner) !== "0";
      const venceu = String(c.id_winner) === id;
      if (decidido) {
        if (venceu) v++;
        else d++;
      }
      // Nome do adversário: ancorado pelo APELIDO do nosso atleta (os rótulos
      // blue/white estão trocados vs os ids — ver nota no topo). Fallback: ids.
      const whiteFam = (c.person_white_family_name || "").toUpperCase();
      const blueFam = (c.person_blue_family_name || "").toUpperCase();
      let g = "";
      let f = "";
      if (whiteFam && whiteFam === ourFamily) {
        g = c.person_blue_given_name || "";
        f = c.person_blue_family_name || "";
      } else if (blueFam && blueFam === ourFamily) {
        g = c.person_white_given_name || "";
        f = c.person_white_family_name || "";
      } else if (String(c.id_person_blue) === id) {
        g = c.person_white_given_name || "";
        f = c.person_white_family_name || "";
      } else {
        g = c.person_blue_given_name || "";
        f = c.person_blue_family_name || "";
      }
      const n = titleCase(`${g} ${f}`.trim());
      if (n) nomeAdv = n;
      return { competicao: c.competition_name || "", ano: anoDe(c.competition_date || c.date_raw), venceu };
    });
    detalhe.sort((a, b) => (b.ano ?? 0) - (a.ano ?? 0));
    confrontoDireto = { idAdversario: adv, nomeAdversario: nomeAdv, lutas: rel.length, vitorias: v, derrotas: d, detalhe };
  }

  return {
    perfil,
    experiencia,
    medalhas,
    conquistas,
    melhorResultado,
    formaRecente,
    desempenhoPorNivel,
    confrontoDireto,
    avisos,
  };
}
