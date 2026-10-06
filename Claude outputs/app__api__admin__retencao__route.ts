// app/api/admin/retencao/route.ts
//
// RETENÇÃO (só admin, só-leitura) — a ESTRELA-GUIA do lançamento.
//
// Responde a três perguntas, por ordem de importância:
//   1. ATIVAÇÃO: das contas que existem, quantas chegaram a montar equipa?
//      (quem nunca monta equipa não é jogador — é um registo.)
//   2. JOGADORES POR COMPETIÇÃO: quantos montaram equipa em cada evento, por ordem
//      de data. Mostra se o apelo cresce ou cai quando o Mundial passar.
//   3. RETENÇÃO competição→competição: dos que jogaram a competição A, quantos
//      voltaram a jogar a seguinte (B). É O número que decide se temos produto.
//      Mostra também quantos eram NOVOS em B (não tinham jogado A).
//
// "Jogou uma competição" = tem uma equipa com atletas (equipas.atletas não vazio)
// para essa competição. Um rascunho vazio não conta.
//
// As competições de TESTE de setembro ficam marcadas (teste=true) e NÃO entram na
// "estrela" (o número de retenção que reportamos), para não sujar o sinal. A 1ª
// retenção real aparece quando houver uma 2ª competição real jogada (depois do
// Mundial, com Marraquexe).
//
// GET /api/admin/retencao
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { CALENDARIO_2026 } from "@/lib/calendario";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Competições antes desta data são consideradas TESTE (setembro de lançamento).
const CORTE_TESTE = Date.parse("2026-10-01T00:00:00Z");

async function ehAdmin(req: Request): Promise<boolean> {
  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
    if (!token) return false;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const pub = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
    if (!url || !pub || !supabaseAdmin) return false;
    const sb = createClient(url, pub, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await sb.auth.getUser();
    const uid = data?.user?.id;
    if (error || !uid) return false;
    const { data: row } = await supabaseAdmin.from("users").select("is_admin").eq("id", uid).maybeSingle();
    return !!row?.is_admin;
  } catch {
    return false;
  }
}

function dataDaComp(id: string): number | null {
  const c = CALENDARIO_2026.find((x) => x.idCompeticao === id);
  if (!c?.de) return null;
  const t = Date.parse(String(c.de).replace(/\//g, "-") + "T00:00:00Z");
  return Number.isFinite(t) ? t : null;
}
function nomeDaComp(id: string): string {
  return CALENDARIO_2026.find((x) => x.idCompeticao === id)?.nome || `Competição ${id}`;
}

export async function GET(req: Request) {
  if (!supabaseAdmin) return NextResponse.json({ ok: false, erro: "Servidor sem ligação." }, { status: 500 });
  if (!(await ehAdmin(req))) return NextResponse.json({ ok: false, erro: "Não autorizado." }, { status: 401 });

  // 1) Total de contas.
  let totalContas = 0;
  try {
    const { count } = await supabaseAdmin.from("users").select("id", { count: "exact", head: true });
    totalContas = count || 0;
  } catch { /* segue */ }

  // 2) Todas as equipas COM atletas (quem jogou cada competição).
  //    Base pequena (centenas); lê tudo e agrupa em memória.
  const jogadoresPorComp = new Map<string, Set<string>>(); // id_comp -> set(user_id)
  const ativaram = new Set<string>(); // user_ids que montaram equipa alguma vez
  try {
    const { data } = await supabaseAdmin
      .from("equipas")
      .select("user_id, id_competicao, atletas")
      .limit(200000);
    for (const e of data || []) {
      const uid = e.user_id ? String(e.user_id) : "";
      const comp = e.id_competicao ? String(e.id_competicao) : "";
      const atletas = Array.isArray(e.atletas) ? (e.atletas as unknown[]) : [];
      if (!uid || !comp || atletas.length === 0) continue; // rascunho vazio não conta
      ativaram.add(uid);
      if (!jogadoresPorComp.has(comp)) jogadoresPorComp.set(comp, new Set());
      jogadoresPorComp.get(comp)!.add(uid);
    }
  } catch (e) {
    return NextResponse.json({ ok: false, erro: "Não consegui ler as equipas.", detalhe: String((e as Error)?.message || e) }, { status: 500 });
  }

  // 3) Competições com jogadores, por ordem de data (sem data vai para o fim).
  const comps = [...jogadoresPorComp.keys()].map((id) => {
    const data = dataDaComp(id);
    return {
      id,
      nome: nomeDaComp(id),
      data,
      data_iso: data ? new Date(data).toISOString().slice(0, 10) : null,
      teste: data != null ? data < CORTE_TESTE : false,
      jogadores: jogadoresPorComp.get(id)!.size,
      // ids de quem jogou (só admin): deixa o cliente cruzar QUALQUER seleção de
      // competições (sobreposições, retenção à escolha) sem novas idas ao servidor.
      jogadores_ids: [...jogadoresPorComp.get(id)!],
    };
  }).sort((a, b) => {
    if (a.data == null && b.data == null) return 0;
    if (a.data == null) return 1;
    if (b.data == null) return -1;
    return a.data - b.data;
  });

  // 4) Retenção entre competições CONSECUTIVAS (na ordem de data).
  const retencao = comps.slice(1).map((destino, i) => {
    const origem = comps[i];
    const setA = jogadoresPorComp.get(origem.id)!;
    const setB = jogadoresPorComp.get(destino.id)!;
    let voltaram = 0;
    for (const u of setA) if (setB.has(u)) voltaram++;
    const novos = setB.size - voltaram;
    return {
      de_id: origem.id, de_nome: origem.nome,
      para_id: destino.id, para_nome: destino.nome,
      base: setA.size,            // jogaram A
      voltaram,                   // desses, jogaram B também
      pct: setA.size > 0 ? Math.round((voltaram / setA.size) * 100) : 0,
      novos,                      // jogadores de B que não tinham jogado A
      ambas_reais: !origem.teste && !destino.teste,
    };
  });

  // 5) A ESTRELA: a retenção mais recente entre DUAS competições reais.
  const reais = retencao.filter((r) => r.ambas_reais);
  const estrela = reais.length > 0 ? reais[reais.length - 1] : null;

  return NextResponse.json({
    ok: true,
    agora: new Date().toISOString(),
    total_contas: totalContas,
    ativaram: ativaram.size,
    ativaram_pct: totalContas > 0 ? Math.round((ativaram.size / totalContas) * 100) : 0,
    competicoes: comps,
    retencao,
    estrela, // null até existir uma 2ª competição real jogada
  });
}
