// app/api/alerta-chave/route.ts
//
// ALERTA "O TEU ATLETA É O PRÓXIMO A LUTAR" — chamado por um cron externo
// (cron-job.org) a cada 1-3 min. Leve: fora de competição sai logo.
//
// Como funciona, a cada disparo:
//   1) Confirma a key (mesmo segredo do URL no cron-job.org).
//   2) focoMercado().aDecorrer — há competição a decorrer? Se não, sai (custo ~0).
//   3) Lê os favoritos (atletas_favoritos): que id_person são seguidos e por quem.
//   4) Para cada categoria, chama /api/chave (a MESMA verdade que a página mostra),
//      calcula a PRÓXIMA luta de cada bloco (zonas, repescagem/bronze, meias/final).
//   5) Se um lado dessa próxima luta é um atleta seguido, avisa os seguidores —
//      exceto os já avisados sobre essa luta (alertas_enviados, anti-repetição).
//
// O push sai por criarNotificacaoServidor (sino + push) — a MESMA via dos
// aniversários, que já chega ao telemóvel.
//
// Proteção: ?key=<CRON_SECRET ou segredo do URL>. Sem isso, 401.
import { NextResponse } from "next/server";
import { focoMercado } from "@/lib/calendario";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { criarNotificacaoServidor } from "@/lib/notificacoesServidor";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

// As 14 categorias do judô (campo `weight` do JudoBase). Fixas e universais.
const CATS = ["-60", "-66", "-73", "-81", "-90", "-100", "+100", "-48", "-52", "-57", "-63", "-70", "-78", "+78"];

// Segredo aceite por ?key=. Usa CRON_SECRET; se quiseres um segredo próprio para
// este cron, define LEMBRETE_CRON_SECRET no ambiente — qualquer um dos dois serve.
function autorizado(key: string | null): boolean {
  const a = process.env.CRON_SECRET;
  const b = process.env.LEMBRETE_CRON_SECRET;
  if (!key) return false;
  return (!!a && key === a) || (!!b && key === b);
}

function baseUrl(req: Request): string {
  try { const u = new URL(req.url); return `${u.protocol}//${u.host}`; }
  catch { return process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : ""; }
}

// --- Tipos mínimos do que /api/chave devolve (só o que usamos) ---
interface LadoChave { id: string; nome: string; pais: string }
interface LutaChave { id: string; round: number; ordem: number; azul: LadoChave; branco: LadoChave; decidida: boolean }
interface ChaveResp {
  ok: boolean; vazio?: boolean; nome_competicao?: string;
  zonas?: { zona: number; lutas: LutaChave[] }[];
  meias?: LutaChave[]; final?: LutaChave | null; bronzes?: LutaChave[];
}

// A próxima luta de um conjunto: 1ª não decidida com AMBOS os lados definidos,
// menor round e depois menor ordem. (Mesma regra do pontinho da página.)
function proximaLuta(lutas: LutaChave[]): LutaChave | null {
  const cand = lutas.filter((l) => !l.decidida && !!l.azul?.id && !!l.branco?.id);
  if (cand.length === 0) return null;
  cand.sort((a, b) => (Number(a.round) - Number(b.round)) || (Number(a.ordem) - Number(b.ordem)));
  return cand[0];
}

// Junta todos os "blocos" de uma categoria, cada um com a sua próxima luta.
function blocosDaChave(c: ChaveResp): LutaChave[] {
  const blocos: LutaChave[][] = [];
  for (const z of c.zonas || []) blocos.push(z.lutas || []);
  blocos.push(c.bronzes || []);
  const mf = [...(c.meias || [])];
  if (c.final) mf.push(c.final);
  blocos.push(mf);
  const proximas: LutaChave[] = [];
  for (const b of blocos) {
    const p = proximaLuta(b);
    if (p) proximas.push(p);
  }
  return proximas;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const key = searchParams.get("key");
  if (!autorizado(key)) {
    return NextResponse.json({ ok: false, erro: "Não autorizado." }, { status: 401 });
  }
  const t0 = Date.now();

  if (!supabaseAdmin) {
    return NextResponse.json({ ok: false, erro: "Sem ligação ao Supabase." }, { status: 500 });
  }

  // (2) Há competição a decorrer? Se não, sai já — barato.
  const foco = focoMercado();
  const aDecorrer = foco.aDecorrer;
  if (!aDecorrer) {
    return NextResponse.json({ ok: true, a_decorrer: null, nota: "Sem competição a decorrer.", ms: Date.now() - t0 });
  }
  const comp = aDecorrer.idCompeticao;
  const nomeComp = aDecorrer.nome;

  // (3) Favoritos: id_person -> lista de user_id que o seguem.
  const seguidoresDe = new Map<string, string[]>();
  try {
    const { data } = await supabaseAdmin.from("atletas_favoritos").select("user_id, id_person");
    for (const f of data || []) {
      const idp = String(f.id_person);
      const uid = String(f.user_id);
      if (!idp || !uid) continue;
      if (!seguidoresDe.has(idp)) seguidoresDe.set(idp, []);
      seguidoresDe.get(idp)!.push(uid);
    }
  } catch { /* sem favoritos: nada a fazer */ }

  if (seguidoresDe.size === 0) {
    return NextResponse.json({ ok: true, a_decorrer: nomeComp, nota: "Ninguém segue atletas.", ms: Date.now() - t0 });
  }

  // (4) Lê a chave de cada categoria (a mesma verdade da página).
  // OTIMIZAÇÃO FUTURA: só pedir as categorias onde há favoritos — por agora,
  // com poucos utilizadores, pedir as 14 é leve e simples.
  const base = baseUrl(req);
  const avisos: { user_id: string; id_person: string; nome: string; id_fight: string }[] = [];

  for (const cat of CATS) {
    let chave: ChaveResp | null = null;
    try {
      const r = await fetch(`${base}/api/chave?comp=${comp}&cat=${encodeURIComponent(cat)}`, { cache: "no-store" });
      chave = await r.json();
    } catch { chave = null; }
    if (!chave || !chave.ok || chave.vazio) continue;

    // (5) Próxima luta de cada bloco; se um lado é seguido, marca aviso.
    for (const luta of blocosDaChave(chave)) {
      for (const lado of [luta.azul, luta.branco]) {
        if (!lado?.id) continue;
        const seguidores = seguidoresDe.get(String(lado.id));
        if (!seguidores) continue;
        for (const uid of seguidores) {
          avisos.push({ user_id: uid, id_person: String(lado.id), nome: lado.nome, id_fight: String(luta.id) });
        }
      }
    }
  }

  if (avisos.length === 0) {
    return NextResponse.json({ ok: true, a_decorrer: nomeComp, candidatos: 0, enviados: 0, ms: Date.now() - t0 });
  }

  // Anti-repetição: tira os que já foram avisados sobre aquela luta.
  // Lê de uma vez os pares (user_id, id_fight) já registados para estas lutas.
  const fights = Array.from(new Set(avisos.map((a) => a.id_fight)));
  const jaAvisado = new Set<string>(); // chave "user_id::id_fight"
  try {
    const { data } = await supabaseAdmin
      .from("alertas_enviados")
      .select("user_id, id_fight")
      .eq("tipo", "proxima_luta")
      .in("id_fight", fights);
    for (const r of data || []) jaAvisado.add(`${r.user_id}::${r.id_fight}`);
  } catch { /* se falhar a leitura, seguimos — o unique da tabela ainda protege */ }

  // Envia os que faltam. Grava primeiro o "já avisei" (idempotente pelo unique),
  // e só envia o push se o INSERT foi novo — assim, mesmo com dois disparos quase
  // simultâneos, não há push duplicado.
  let enviados = 0;
  const apelido = (n: string) => (n || "").trim().split(/\s+/).filter((w) => w.length > 1 && w === w.toUpperCase())[0] || (n || "").split(/\s+/)[0] || "o teu atleta";
  for (const a of avisos) {
    const chave = `${a.user_id}::${a.id_fight}`;
    if (jaAvisado.has(chave)) continue;
    jaAvisado.add(chave); // evita duplicar dentro do mesmo disparo (vários blocos)

    // Tenta gravar o registo. Se já existir (corrida), o unique faz falhar e não enviamos.
    let inseriu = false;
    try {
      const { error } = await supabaseAdmin
        .from("alertas_enviados")
        .insert({ user_id: a.user_id, id_fight: a.id_fight, tipo: "proxima_luta" });
      inseriu = !error;
    } catch { inseriu = false; }
    if (!inseriu) continue;

    try {
      await criarNotificacaoServidor({
        paraUserId: a.user_id,
        tipo: "proxima_luta",
        titulo: `🥋 ${apelido(a.nome)} é já a seguir!`,
        corpo: `Em ${nomeComp}, ${apelido(a.nome)} é a próxima luta no seu bloco. Fica atento — vai a entrar no tatame.`,
        link: "/chave",
      });
      enviados++;
    } catch { /* push de um não bloqueia os outros */ }
  }

  return NextResponse.json({
    ok: true,
    a_decorrer: nomeComp,
    candidatos: avisos.length,
    enviados,
    ms: Date.now() - t0,
  });
}
