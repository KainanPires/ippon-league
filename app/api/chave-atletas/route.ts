// app/api/chave-atletas/route.ts
//
// CHAVE DE ATLETAS — devolve a chave de uma categoria já DESENHADA, COM PAYWALL
// NO SERVIDOR. A decisão de "o que cada nível pode ver" é feita AQUI, antes de
// qualquer dado sair do servidor:
//
//   - sem sessão / grátis -> acesso "negado", sem chave.
//   - Pro    -> vê a moldura e o resultado FINAL (quando há campeão); enquanto a
//               categoria está A DECORRER, NÃO recebe as lutas (estado "congelado").
//   - Pro Max -> vê tudo, ao vivo.
//
// VERIFICAÇÃO FORTE: o navegador envia o token de sessão no cabeçalho
// Authorization: Bearer <token>. Com esse token confirmamos QUEM é o utilizador
// (não dá para falsificar) e lemos is_pro / is_pro_max da tabela `users` (a fonte
// segura — o utilizador não a edita). É isto que torna o bloqueio real, e não
// apenas visual no navegador.
//
// FONTE DO MOVIMENTO: a tabela resultados_atletas, mantida fresca pelo cron.
//
// Uso: GET /api/chave-atletas?comp=3149&cat=-73  (com Authorization: Bearer ...)
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  desenharChave,
  type MolduraCategoria,
  type ResultadosPorId,
  type IdentidadesPorId,
  type PoolId,
} from "@/lib/motorChave";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Nível de acesso resolvido a partir do token (no servidor).
type Nivel = "promax" | "pro" | "gratis";

// Confirma a sessão pelo token e devolve o nível REAL (lido da tabela users).
// Sem token válido -> "gratis" (tratado como sem acesso).
async function nivelDoPedido(req: Request): Promise<Nivel> {
  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
    if (!token) return "gratis";

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const pub = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
    if (!url || !pub) return "gratis";

    // Cliente "do utilizador": serve só para confirmar a identidade do token.
    // (Diferente do supabaseAdmin, que lê os dados da chave.)
    const sb = createClient(url, pub, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error } = await sb.auth.getUser();
    const uid = userData?.user?.id;
    if (error || !uid) return "gratis";

    // A VERDADE do nível está na tabela users (fonte segura). Lemos com o admin.
    if (!supabaseAdmin) return "gratis";
    const { data: row } = await supabaseAdmin
      .from("users")
      .select("is_pro, is_pro_max")
      .eq("id", uid)
      .maybeSingle();
    if (row?.is_pro_max) return "promax";
    if (row?.is_pro) return "pro";
    return "gratis";
  } catch {
    return "gratis";
  }
}

export async function GET(req: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ ok: false, erro: "Servidor sem ligação." }, { status: 500 });
  }

  // ---- PAYWALL: quem está a pedir? ----
  const nivel = await nivelDoPedido(req);
  if (nivel === "gratis") {
    // Sem acesso: não devolvemos dados nenhuns da chave.
    return NextResponse.json({ ok: true, acesso: "negado", nivel: "gratis" }, { status: 200 });
  }

  const { searchParams } = new URL(req.url);
  const comp = (searchParams.get("comp") || "").trim();
  const cat = (searchParams.get("cat") || "").trim();
  if (!comp || !cat) {
    return NextResponse.json(
      { ok: false, erro: "Faltam ?comp= e ?cat=. Ex.: /api/chave-atletas?comp=3149&cat=-73" },
      { status: 400 }
    );
  }

  // 1) Moldura da categoria.
  const { data: linha, error: errMold } = await supabaseAdmin
    .from("chave_atletas")
    .select("genero, pools")
    .eq("id_competicao", comp)
    .eq("weight_category", cat)
    .maybeSingle();
  if (errMold) {
    return NextResponse.json({ ok: false, erro: "Erro a ler a moldura." }, { status: 500 });
  }
  if (!linha || !linha.pools) {
    return NextResponse.json({
      ok: true, acesso: "ok", nivel, comp, cat, genero: null, existeMoldura: false,
      estado: "naoComecou", chave: null, moldura: null, infos: {},
      atualizado_em: new Date().toISOString(),
    });
  }

  // Normaliza a moldura.
  const poolsRaw = linha.pools as Record<string, unknown>;
  const pools = {} as Record<PoolId, string[]>;
  for (const p of ["A", "B", "C", "D"] as PoolId[]) {
    const arr = Array.isArray(poolsRaw?.[p]) ? (poolsRaw[p] as unknown[]) : [];
    pools[p] = arr.map((x) => String(x));
  }
  let byes: Partial<Record<PoolId, string[]>> | undefined;
  const byesRaw = (poolsRaw?.["byes"] ?? null) as Record<string, unknown> | null;
  if (byesRaw) {
    byes = {};
    for (const p of ["A", "B", "C", "D"] as PoolId[]) {
      const arr = Array.isArray(byesRaw?.[p]) ? (byesRaw[p] as unknown[]) : [];
      if (arr.length) byes[p] = arr.map((x) => String(x));
    }
  }
  const moldura: MolduraCategoria = { pools, byes };

  const todosIds = new Set<string>();
  for (const p of ["A", "B", "C", "D"] as PoolId[]) for (const id of pools[p]) todosIds.add(id);

  // 2) Movimento + pontos + ações da TABELA (mantida fresca pelo cron).
  const { data: res } = await supabaseAdmin
    .from("resultados_atletas")
    .select("id_person, nome, country_code, vitorias, derrotas, pontos, n_lutas, vencidos, lutas, acoes")
    .eq("id_competicao", comp)
    .eq("weight_category", cat);
  const resultados: ResultadosPorId = {};
  const identidades: IdentidadesPorId = {};
  const infos: Record<string, { pontos: number; nLutas: number; acoes: unknown }> = {};
  // Índice de ações POR LUTA: acoesPar[`${atleta}->${adversario}`] = ações do atleta nesse confronto.
  const acoesPar: Record<string, { i: number; w: number; y: number; s: number }> = {};
  for (const r of res || []) {
    const id = String(r.id_person);
    const venc = Array.isArray(r.vencidos) ? (r.vencidos as unknown[]).map((x) => String(x)) : [];
    resultados[id] = { vitorias: Number(r.vitorias) || 0, derrotas: Number(r.derrotas) || 0, vencidos: venc };
    identidades[id] = { nome: r.nome ? String(r.nome) : undefined, pais: r.country_code ? String(r.country_code) : undefined };
    infos[id] = { pontos: Number(r.pontos) || 0, nLutas: Number(r.n_lutas) || 0, acoes: r.acoes ?? null };
    const lutas = Array.isArray(r.lutas) ? (r.lutas as Array<Record<string, unknown>>) : [];
    for (const lt of lutas) {
      const adv = lt?.adv != null ? String(lt.adv) : "";
      if (!adv) continue;
      acoesPar[`${id}->${adv}`] = {
        i: Number(lt.i) || 0, w: Number(lt.w) || 0, y: Number(lt.y) || 0, s: Number(lt.s) || 0,
      };
    }
  }

  // 3) Nomes de TODOS os inscritos (cache) — para byes/quem ainda não lutou.
  try {
    const { data: cacheRow } = await supabaseAdmin
      .from("atletas_cache").select("atletas").eq("id_competition", comp).maybeSingle();
    const lista = Array.isArray(cacheRow?.atletas)
      ? (cacheRow!.atletas as Array<{ id?: unknown; name?: unknown; countryIso?: unknown }>)
      : [];
    for (const a of lista) {
      const id = a?.id != null ? String(a.id) : "";
      if (!id || !todosIds.has(id)) continue;
      const atual = identidades[id] || {};
      if (!atual.nome && a?.name) atual.nome = String(a.name);
      if (!atual.pais && a?.countryIso) atual.pais = String(a.countryIso);
      identidades[id] = atual;
    }
  } catch { /* segue com o que houver */ }

  // 4) Corre o motor.
  const chave = desenharChave(moldura, resultados, identidades);

  // Estado da categoria (derivado da chave), também calculado no SERVIDOR:
  //  - "terminada": há campeão; "aDecorrer": há lutas decididas mas sem campeão;
  //  - "naoComecou": nenhuma luta decidida ainda.
  const todasLutas = [
    ...(["A", "B", "C", "D"] as PoolId[]).flatMap((p) => chave.pools[p].lutas),
    ...chave.meias,
    ...(chave.final ? [chave.final] : []),
    ...chave.repescagens,
    ...chave.bronzes,
  ];
  const estado: "naoComecou" | "aDecorrer" | "terminada" =
    chave.campeao ? "terminada"
      : todasLutas.some((l) => l && l.vencedor) ? "aDecorrer"
        : "naoComecou";

  // ---- PAYWALL (parte 2): o Pro vê o quadro INICIAL, nunca o decorrer ----
  // Se é Pro (não Pro Max) e a categoria está a decorrer, corremos o motor OUTRA
  // VEZ mas SEM resultados: sai o quadro tal como começou (quem enfrenta quem,
  // byes no sítio), sem vencedores, sem progressão e sem pontos. Assim o Pro vê a
  // chave inicial — e nenhum dado do decorrer sai do servidor.
  if (nivel === "pro" && estado === "aDecorrer") {
    const chaveInicial = desenharChave(moldura, {}, identidades);
    return NextResponse.json({
      ok: true, acesso: "ok", nivel, comp, cat,
      genero: linha.genero ? String(linha.genero) : null,
      existeMoldura: true, estado, bloqueado: true,
      chave: chaveInicial, moldura: { pools, byes: byes ?? null }, infos: {},
      atualizado_em: new Date().toISOString(),
    });
  }

  // 5) Anexa a cada lado de cada luta as ações DAQUELE confronto (selos no cartão).
  const aplicar = (luta: { azul: { id: string | null; acoes?: unknown }; branco: { id: string | null; acoes?: unknown } } | null) => {
    if (!luta) return;
    const a = luta.azul?.id, b = luta.branco?.id;
    if (a && b) {
      const av = acoesPar[`${a}->${b}`];
      const bv = acoesPar[`${b}->${a}`];
      if (av) luta.azul.acoes = av;
      if (bv) luta.branco.acoes = bv;
    }
  };
  for (const p of ["A", "B", "C", "D"] as PoolId[]) for (const l of chave.pools[p].lutas) aplicar(l);
  for (const l of chave.meias) aplicar(l);
  aplicar(chave.final);
  for (const l of chave.repescagens) aplicar(l);
  for (const l of chave.bronzes) aplicar(l);

  return NextResponse.json({
    ok: true,
    acesso: "ok",
    nivel,
    comp,
    cat,
    genero: linha.genero ? String(linha.genero) : null,
    existeMoldura: true,
    estado,
    chave,
    moldura: { pools, byes: byes ?? null },
    infos,
    atualizado_em: new Date().toISOString(),
  });
}
