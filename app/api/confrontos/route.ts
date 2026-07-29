// app/api/confrontos/route.ts
//
// ANÁLISE DE CONFRONTOS DIRETOS — quem ganha a quem, e com que probabilidade.
//
// Uso: GET /api/confrontos?comp=1598&cat=-73  (com Authorization: Bearer <token>)
//
// ---------------------------------------------------------------------------
// DE ONDE VÊM OS DADOS
//
// Da linha `_confrontos_<comp>_<cat>` do atletas_cache, escrita pelo
// /api/calcular enquanto calcula os preços. Não há chamadas ao JudoBase aqui:
// esta rota é só leitura e contas. Responde em milissegundos.
//
// Se a linha não existir, a categoria ainda não foi calculada desde que a
// extração entrou no ar — basta correr /api/calcular?comp=&cat=&gender= (ou
// esperar pela passagem diária do cron).
// ---------------------------------------------------------------------------
//
// ---------------------------------------------------------------------------
// A CONTA DA PROBABILIDADE — e o problema honesto que ela resolve
//
// No judô, dois atletas encontram-se UMA ou DUAS vezes. Uma percentagem tirada
// de 2 confrontos não é uma probabilidade: é ruído com ar de ciência. Num
// produto pago, apresentar isso como certeza destrói a confiança à primeira vez
// que falha.
//
// Por isso combinamos duas coisas, dando ao histórico o peso que a amostra
// merece:
//
//   p_base   = força relativa dos dois (a expectativa que já calculamos p/ preços)
//   p_direto = vitórias / (vitórias + derrotas) entre eles
//   n        = número de confrontos diretos
//
//   p_final  = (n × p_direto + K × p_base) / (n + K)
//
// Com n=0 vale só a força. Com n=K é meio a meio. Com n=10 o histórico direto
// domina. É suave, e explicável a qualquer utilizador.
//
// K e S estão isolados em constantes: são os dois números a afinar quando
// houver dados de uso real, tal como se fez ao EXPECTATIVA_TOPO.
// ---------------------------------------------------------------------------
//
// PAYWALL (no servidor, antes de qualquer dado sair):
//   grátis  -> nada
//   Pro     -> o RANKING FACTUAL de confrontos (V-D entre inscritos). É facto,
//              não previsão — mostra valor sem dar a análise toda.
//   Pro Max -> + probabilidades e os confrontos favoráveis/desfavoráveis
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { CALENDARIO_2026, nomeCompeticao } from "@/lib/calendario";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * K — quantos confrontos diretos valem tanto como a estimativa por forma.
 * Com K=3: 3 confrontos = meio a meio; 9 confrontos = 75% histórico.
 * Subir K = mais conservador (confia mais na forma). Descer = mais reativo.
 */
const K_CONFIANCA = 3;

/**
 * S — sensibilidade da diferença de força.
 * Uma diferença de S pontos de expectativa dá ~73% de probabilidade.
 * Com S=8: 8 pontos de diferença = 73%; 16 pontos = 88%.
 * Subir S = achata as diferenças. Descer = exagera-as.
 */
const S_FORCA = 8;

type Nivel = "promax" | "pro" | "gratis";
interface RegistoConfronto { v: number; d: number }
interface FichaConfrontos {
  nome: string;
  pais: string;
  preco: number;
  expectativa: number;
  contra: Record<string, RegistoConfronto>;
}
interface MatrizGuardada {
  comp: string;
  cat: string;
  gender: string;
  classico: boolean;
  ano_base: number | null;
  n_atletas: number;
  fichas: Record<string, FichaConfrontos>;
}

// Confirma a sessão pelo token e devolve o nível REAL (lido da tabela users).
// Cópia deliberada do /api/chave-atletas: as duas rotas têm de decidir o acesso
// exatamente da mesma maneira, e é preferível repetir 25 linhas a criar uma
// dependência entre rotas que se pode partir sem ninguém dar por isso.
async function nivelDoPedido(req: Request): Promise<Nivel> {
  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
    if (!token) return "gratis";
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const pub = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
    if (!url || !pub) return "gratis";
    const sb = createClient(url, pub, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error } = await sb.auth.getUser();
    const uid = userData?.user?.id;
    if (error || !uid) return "gratis";
    if (!supabaseAdmin) return "gratis";
    const { data: row } = await supabaseAdmin
      .from("users").select("is_pro, is_pro_max").eq("id", uid).maybeSingle();
    if (row?.is_pro_max) return "promax";
    if (row?.is_pro) return "pro";
    return "gratis";
  } catch {
    return "gratis";
  }
}

/** Probabilidade de A vencer B só pela diferença de força (curva logística). */
function probPorForca(expA: number, expB: number): number {
  return 1 / (1 + Math.exp(-(expA - expB) / S_FORCA));
}

/**
 * Probabilidade final de A vencer B: mistura a força com o histórico direto,
 * pesada pelo número de confrontos. Ver a explicação no topo do ficheiro.
 */
function probFinal(expA: number, expB: number, reg: RegistoConfronto | undefined): number {
  const pBase = probPorForca(expA, expB);
  const n = reg ? reg.v + reg.d : 0;
  if (n === 0) return pBase;
  const pDireto = reg!.v / n;
  return (n * pDireto + K_CONFIANCA * pBase) / (n + K_CONFIANCA);
}

const pct = (x: number) => Math.round(x * 1000) / 10; // uma casa decimal

export async function GET(req: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ ok: false, erro: "Servidor sem ligação." }, { status: 500 });
  }

  // ---- PAYWALL: quem está a pedir? ----
  const nivel = await nivelDoPedido(req);
  if (nivel === "gratis") {
    return NextResponse.json({ ok: true, acesso: "negado", nivel: "gratis" });
  }

  const { searchParams } = new URL(req.url);
  const comp = (searchParams.get("comp") || "").trim();
  const cat = (searchParams.get("cat") || "").trim();
  if (!comp || !cat) {
    return NextResponse.json({ ok: false, erro: "Faltam ?comp= e ?cat=." }, { status: 400 });
  }

  // ---- Lê a matriz gravada pelo /api/calcular ----
  const { data: linha } = await supabaseAdmin
    .from("atletas_cache")
    .select("atletas, atualizado_em")
    .eq("id_competition", `_confrontos_${comp}_${cat}`)
    .maybeSingle();

  const m = (linha?.atletas ?? null) as MatrizGuardada | null;
  if (!m || !m.fichas || Object.keys(m.fichas).length === 0) {
    return NextResponse.json({
      ok: true, acesso: "ok", nivel, comp, cat,
      semDados: true,
      nota: "Esta categoria ainda não foi analisada. Corre /api/calcular para ela, ou espera pela passagem diária.",
    });
  }

  const ids = Object.keys(m.fichas);
  const semana = CALENDARIO_2026.find((s) => s.idCompeticao === comp);

  // ---- 1) RANKING FACTUAL (Pro e Pro Max): V-D entre os inscritos ----
  // Não é previsão nenhuma — é o que aconteceu. Por isso pode ir para o Pro.
  const base = ids.map((id) => {
    const f = m.fichas[id];
    let v = 0, d = 0, adversarios = 0;
    for (const reg of Object.values(f.contra)) { v += reg.v; d += reg.d; adversarios++; }
    const n = v + d;
    return {
      id,
      nome: f.nome,
      pais: f.pais,
      preco: f.preco,
      confrontos: {
        adversarios,            // quantos DOS INSCRITOS já enfrentou
        lutas: n,
        vitorias: v,
        derrotas: d,
        taxa: n > 0 ? pct(v / n) : null, // null = sem histórico, não 0%
      },
    };
  });

  if (nivel === "pro") {
    // Pro: só o factual, ordenado por taxa de vitória (e depois por amostra).
    const ordenado = [...base].sort((a, b) => {
      const ta = a.confrontos.taxa ?? -1, tb = b.confrontos.taxa ?? -1;
      if (tb !== ta) return tb - ta;
      return b.confrontos.lutas - a.confrontos.lutas;
    });
    return NextResponse.json({
      ok: true, acesso: "ok", nivel, comp, cat,
      compNome: semana ? nomeCompeticao(semana) : null,
      classico: m.classico, ano_base: m.ano_base,
      atletas: ordenado,
      atualizado_em: linha?.atualizado_em ?? null,
      nota: "Histórico entre os inscritos desta categoria. As probabilidades fazem parte do Ippon Pro Max.",
    });
  }

  // ---- 2) PROBABILIDADES (só Pro Max) ----
  // Força relativa = soma das probabilidades de vencer cada um dos outros.
  // A probabilidade de vencer a categoria é a fatia de cada um nessa soma.
  // É uma aproximação — ignora quem apanha quem na chave —, mas é honesta e
  // explicável. Quando houver moldura, pode-se simular a chave a sério.
  const forca: Record<string, number> = {};
  const detalhe: Record<string, { id: string; nome: string; pais: string; v: number; d: number; prob: number }[]> = {};
  for (const a of ids) {
    const fa = m.fichas[a];
    let soma = 0;
    const linhas: { id: string; nome: string; pais: string; v: number; d: number; prob: number }[] = [];
    for (const b of ids) {
      if (a === b) continue;
      const fb = m.fichas[b];
      const reg = fa.contra[b];
      const p = probFinal(fa.expectativa, fb.expectativa, reg);
      soma += p;
      // Só guardamos o detalhe de quem JÁ se enfrentou — é o que tem história
      // para contar. Contra os outros, a estimativa é só força e não acrescenta.
      if (reg && reg.v + reg.d > 0) {
        linhas.push({ id: b, nome: fb.nome, pais: fb.pais, v: reg.v, d: reg.d, prob: pct(p) });
      }
    }
    forca[a] = soma;
    linhas.sort((x, y) => y.prob - x.prob);
    detalhe[a] = linhas;
  }
  const somaTotal = Object.values(forca).reduce((s, x) => s + x, 0) || 1;

  const atletas = ids.map((id) => {
    const b = base.find((x) => x.id === id)!;
    const linhas = detalhe[id];
    return {
      ...b,
      expectativa: m.fichas[id].expectativa,
      // Probabilidade de vencer a categoria. `amostra` diz em quantos confrontos
      // reais ela se apoia — sem isso o utilizador não distingue uma leitura
      // sólida de um palpite, e é isso que faz um número destes ser honesto.
      probabilidade: pct(forca[id] / somaTotal),
      amostra: b.confrontos.lutas,
      // Onde domina e onde sofre: as 3 melhores e as 3 piores relações.
      favoraveis: linhas.slice(0, 3),
      desfavoraveis: linhas.slice(-3).reverse(),
    };
  }).sort((a, b) => b.probabilidade - a.probabilidade);

  return NextResponse.json({
    ok: true, acesso: "ok", nivel, comp, cat,
    compNome: semana ? nomeCompeticao(semana) : null,
    classico: m.classico, ano_base: m.ano_base,
    // Deixamos os parâmetros à vista: quem quiser perceber de onde vêm os
    // números consegue, e nós conseguimos afinar sem caçar constantes no código.
    modelo: { k_confianca: K_CONFIANCA, s_forca: S_FORCA },
    atletas,
    atualizado_em: linha?.atualizado_em ?? null,
  });
}
