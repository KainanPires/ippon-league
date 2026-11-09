// app/api/equipa/substituir/route.ts
//
// SUBSTITUIÇÃO PÓS-FECHO (exceção controlada) — trocar UM atleta que SAIU da
// competição (desistiu) por outro, com o mercado já fechado. Regras validadas
// no SERVIDOR (a trava tem de ser real, não só visual no cliente):
//   1) Bearer token -> utilizador (não falsificável).
//   2) Competição A DECORRER (é a única altura em que o mercado fecha).
//   3) saiId está na equipa E já NÃO está no mercado reconciliado (saiu mesmo).
//   4) entraId está no mercado e não está já na equipa.
//   5) TRAVA POR CATEGORIA: a categoria do substituto tem chave e ainda não tem
//      resultado (estado === "naoComecou").
//   6) Equipa continua válida: 4M + 4F, categorias distintas por género.
//   7) ORÇAMENTO: substituto não custa mais do que o atleta que saiu.
//
// POST /api/equipa/substituir  (Authorization: Bearer <token>)
//   corpo: { comp, saiId, entraId }
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { montarChaveDaBase } from "@/lib/montarChave";
import { focoMercado } from "@/lib/calendario";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const normCat = (c: unknown) => String(c || "").toLowerCase().replace(/kg/g, "").replace(/\s+/g, "").trim();
const erro = (msg: string, status = 400) => NextResponse.json({ ok: false, erro: msg }, { status });

// Bearer token -> id do utilizador (confirma QUEM é, sem falsificar). Mesmo
// padrão do /api/chave-atletas.
async function userDoPedido(req: Request): Promise<string> {
  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
    if (!token) return "";
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const pub = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
    if (!url || !pub) return "";
    const sb = createClient(url, pub, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await sb.auth.getUser();
    if (error || !data?.user?.id) return "";
    return String(data.user.id);
  } catch {
    return "";
  }
}

export async function POST(req: Request) {
  if (!supabaseAdmin) return erro("Servidor sem ligação.", 500);

  const userId = await userDoPedido(req);
  if (!userId) return erro("Sem sessão válida.", 401);

  let body: { comp?: string; saiId?: string; entraId?: string };
  try { body = await req.json(); } catch { return erro("Pedido inválido."); }
  const comp = String(body?.comp || "").trim();
  const saiId = String(body?.saiId || "").trim();
  const entraId = String(body?.entraId || "").trim();
  if (!comp || !saiId || !entraId) return erro("Faltam dados.");
  if (saiId === entraId) return erro("Atletas iguais.");

  // Competição a decorrer.
  const aDecorrer = focoMercado().aDecorrer;
  if (!aDecorrer || String(aDecorrer.idCompeticao) !== comp) return erro("Esta competição não está a decorrer.");

  // Equipa do utilizador.
  const { data: eq } = await supabaseAdmin
    .from("equipas").select("atletas, capitao, precos")
    .eq("user_id", userId).eq("id_competicao", comp).maybeSingle();
  if (!eq) return erro("Não tens equipa nesta competição.", 404);
  const atletas = Array.isArray(eq.atletas) ? (eq.atletas as unknown[]).map(String) : [];
  const capitao = eq.capitao != null ? String(eq.capitao) : null;
  const precos: Record<string, number> = (eq.precos && typeof eq.precos === "object")
    ? { ...(eq.precos as Record<string, number>) } : {};
  if (!atletas.includes(saiId)) return erro("Esse atleta não está na tua equipa.");
  if (atletas.includes(entraId)) return erro("Esse atleta já está na tua equipa.");

  // Mercado reconciliado.
  const { data: cacheRow } = await supabaseAdmin
    .from("atletas_cache").select("atletas").eq("id_competition", comp).maybeSingle();
  const mercado = Array.isArray(cacheRow?.atletas) ? (cacheRow!.atletas as Array<Record<string, unknown>>) : [];
  const porId = new Map<string, Record<string, unknown>>();
  for (const a of mercado) if (a?.id != null) porId.set(String(a.id), a);

  if (porId.has(saiId)) return erro("Esse atleta ainda está na competição — não é preciso substituir.");
  const entra = porId.get(entraId);
  if (!entra) return erro("O substituto não está disponível nesta competição.");
  const entraGen = String(entra.gender || "").toUpperCase();
  const entraCat = normCat(entra.category);
  const entraPreco = Number(entra.priceJc) || 0;

  // TRAVA POR CATEGORIA (falha em segurança: sem chave -> recusa).
  const chaveCat = await montarChaveDaBase(comp, entraCat);
  if (!chaveCat.existeMoldura) return erro("Essa categoria ainda não tem chave.");
  if (chaveCat.estado !== "naoComecou") return erro("A categoria já começou — já não dá para mexer aqui.", 409);

  // Equipa válida: 4M + 4F, categorias distintas por género.
  const mantidos = atletas.filter((i) => i !== saiId);
  let mas = 0, fem = 0;
  const catsMas = new Set<string>(), catsFem = new Set<string>();
  for (const i of mantidos) {
    const a = porId.get(i);
    if (!a) continue;
    const g = String(a.gender || "").toUpperCase();
    const c = normCat(a.category);
    if (g === "M") { mas++; catsMas.add(c); }
    else if (g === "F") { fem++; catsFem.add(c); }
  }
  if (entraGen === "M") {
    if (mas >= 4) return erro("Já tens 4 atletas masculinos.");
    if (catsMas.has(entraCat)) return erro("Já tens um atleta nessa categoria.");
  } else if (entraGen === "F") {
    if (fem >= 4) return erro("Já tens 4 atletas femininas.");
    if (catsFem.has(entraCat)) return erro("Já tens uma atleta nessa categoria.");
  } else {
    return erro("Substituto sem género definido.");
  }

  // ORÇAMENTO: substituto não custa mais do que o que saiu.
  const precoSai = Number(precos[saiId]);
  if (Number.isFinite(precoSai) && entraPreco > precoSai + 1e-9) {
    return erro(`O substituto (JC ${entraPreco}) custa mais do que o atleta que saiu (JC ${precoSai}).`);
  }

  // Aplica.
  const novosAtletas = atletas.map((i) => (i === saiId ? entraId : i));
  const novoCapitao = capitao === saiId ? entraId : capitao;
  const novosPrecos = { ...precos };
  delete novosPrecos[saiId];
  novosPrecos[entraId] = entraPreco;

  const { error } = await supabaseAdmin.from("equipas").update({
    atletas: novosAtletas, capitao: novoCapitao, precos: novosPrecos,
    atualizado_em: new Date().toISOString(),
  }).eq("user_id", userId).eq("id_competicao", comp);
  if (error) return erro("Falha a gravar a substituição.", 500);

  return NextResponse.json({ ok: true, comp, saiu: saiId, entrou: entraId, categoria: String(entra.category || ""), capitao: novoCapitao });
}
