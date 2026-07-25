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
import { montarChaveDaBase } from "@/lib/montarChave";
import { focoMercado, CALENDARIO_2026 } from "@/lib/calendario";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Milissegundos em 24h — janela em que já mostramos a PRÓXIMA competição.
const VINTE_QUATRO_H = 24 * 3600 * 1000;

// Converte a data "YYYY/MM/DD" do calendário em milissegundos (início do dia).
function dataMs(de?: string): number {
  if (!de) return 0;
  const t = Date.parse(de.replace(/\//g, "-"));
  return isNaN(t) ? 0 : t;
}

// Decide QUAL competição a chave deve mostrar quando a página não indica uma.
// Regra (por prioridade):
//   1) Se há uma a decorrer COM molduras -> essa (ao vivo).
//   2) Se falta < 24h para a próxima REAL (não clássico) e ela tem molduras -> essa.
//   3) Caso contrário -> a competição COM molduras mais recente no tempo
//      (a "última com chave"), para se poder rever durante a semana.
// `idsComMolduras` = competições que têm molduras na tabela chave_atletas.
// Devolve o id da competição a mostrar, ou "" se não houver nenhuma com chave.
function escolherCompeticao(idsComMolduras: Set<string>): string {
  if (idsComMolduras.size === 0) return "";

  let foco: ReturnType<typeof focoMercado> | null = null;
  try { foco = focoMercado(); } catch { foco = null; }

  // 1) A decorrer com molduras.
  const aDecorrer = foco?.aDecorrer?.idCompeticao;
  if (aDecorrer && idsComMolduras.has(String(aDecorrer))) return String(aDecorrer);

  // 2) Próxima real dentro de 24h, com molduras (o alvo já salta clássicos).
  const alvo = foco?.alvo;
  if (alvo && !alvo.classico && idsComMolduras.has(String(alvo.idCompeticao))) {
    const faltam = dataMs(alvo.de) - Date.now();
    if (faltam <= VINTE_QUATRO_H) return String(alvo.idCompeticao);
  }

  // 3) A última COM molduras, por data do calendário (mais recente já começada).
  //    Ordena as entradas do calendário que têm molduras por data desc e escolhe
  //    a primeira cuja data de início já passou. Se nenhuma tiver começado (caso
  //    raro), escolhe a mais recente à mesma.
  const comMoldura = CALENDARIO_2026
    .filter((c) => idsComMolduras.has(String(c.idCompeticao)))
    .map((c) => ({ id: String(c.idCompeticao), ms: dataMs(c.de) }))
    .sort((a, b) => b.ms - a.ms);
  if (comMoldura.length > 0) {
    const agora = Date.now();
    const jaComecou = comMoldura.find((c) => c.ms <= agora);
    return (jaComecou || comMoldura[0]).id;
  }

  // Molduras existem mas nenhuma está no calendário: mostra uma qualquer (a
  // primeira do conjunto) para não deixar o ecrã vazio.
  return Array.from(idsComMolduras)[0];
}

// Nome legível da competição (do calendário), para a página mostrar no rótulo.
function nomeDaCompeticao(id: string): string | null {
  const c = CALENDARIO_2026.find((x) => String(x.idCompeticao) === String(id));
  return c ? c.nome : null;
}

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
  let comp = (searchParams.get("comp") || "").trim();
  const cat = (searchParams.get("cat") || "").trim();

  // Se a página não indicou a competição, a API escolhe qual mostrar (a que está
  // a decorrer, a próxima dentro de 24h, ou a última com chave). Para isso lê os
  // ids que têm molduras na base e aplica a regra.
  let compAuto = false;
  if (!comp) {
    const { data: idsRows } = await supabaseAdmin
      .from("chave_atletas")
      .select("id_competicao");
    const ids = new Set<string>((idsRows || []).map((r) => String(r.id_competicao)));
    comp = escolherCompeticao(ids);
    compAuto = true;
  }

  if (!comp || !cat) {
    return NextResponse.json(
      { ok: false, erro: "Faltam dados. Indica ?cat= (a competição é escolhida automaticamente).", semChave: !comp },
      { status: 400 }
    );
  }

  // ---- Monta a chave a partir da base (lógica partilhada com o alerta-chave) ----
  const m = await montarChaveDaBase(comp, cat);

  if (!m.existeMoldura) {
    return NextResponse.json({
      ok: true, acesso: "ok", nivel, comp, compAuto, compNome: nomeDaCompeticao(comp), cat,
      genero: null, existeMoldura: false, estado: "naoComecou",
      chave: null, moldura: null, infos: {},
      atualizado_em: new Date().toISOString(),
    });
  }

  // ---- PAYWALL (parte 2): o Pro vê o quadro INICIAL, nunca o decorrer ----
  // Pro (não Pro Max) numa categoria a decorrer recebe o quadro inicial (sem
  // vencedores) — os dados do decorrer não saem do servidor.
  if (nivel === "pro" && m.estado === "aDecorrer") {
    return NextResponse.json({
      ok: true, acesso: "ok", nivel, comp, compAuto, compNome: nomeDaCompeticao(comp), cat,
      genero: m.genero, existeMoldura: true, estado: m.estado, bloqueado: true,
      chave: m.chaveInicial, moldura: m.moldura, infos: {},
      atualizado_em: new Date().toISOString(),
    });
  }

  return NextResponse.json({
    ok: true,
    acesso: "ok",
    nivel,
    comp,
    compAuto,
    compNome: nomeDaCompeticao(comp),
    cat,
    genero: m.genero,
    existeMoldura: true,
    estado: m.estado,
    chave: m.chave,
    moldura: m.moldura,
    infos: m.infos,
    atualizado_em: new Date().toISOString(),
  });
}
