// app/api/copa/chave/route.ts
//
// CHAVE DA COPA IPPON (servidor, chave secreta) — para a tela visual.
//
// Recebe (GET): ?id=<league_id>
// Devolve a chave inteira: os confrontos por ronda + a identidade de cada
// jogador (nome do time + escudo) para a tela desenhar sem mais pedidos.
//
// Também devolve metadados úteis: estado da copa, nº de inscritos, nº total de
// rondas previstas (para mostrar as rondas futuras "a aguardar"), e o pódio
// quando a copa terminou.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { tamanhoChave, numeroDeRondas } from "@/lib/copa";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface Identidade {
  user_id: string;
  nome_time: string;
  escudo: unknown;
}

export async function GET(req: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ erro: "Servidor sem ligação." }, { status: 500 });
  }
  const { searchParams } = new URL(req.url);
  const league_id_param = (searchParams.get("id") || "").trim();
  const codigo = (searchParams.get("codigo") || "").trim().toUpperCase();
  if (!league_id_param && !codigo) {
    return NextResponse.json({ erro: "Falta ?id=<league_id> ou ?codigo=<invite_code>." }, { status: 400 });
  }

  // Liga + estado da copa (por id ou por código de convite).
  const consulta = supabaseAdmin
    .from("leagues")
    .select("id, name, formato, copa_estado, copa_competicao_inicial, escudo");
  const { data: liga } = league_id_param
    ? await consulta.eq("id", league_id_param).maybeSingle()
    : await consulta.eq("invite_code", codigo).maybeSingle();
  if (!liga) return NextResponse.json({ erro: "Liga não encontrada." }, { status: 404 });
  if (liga.formato !== "copa") return NextResponse.json({ erro: "Não é uma copa." }, { status: 400 });

  const league_id = liga.id;

  // Confrontos (toda a chave), por ronda e ordem.
  const { data: confrontos } = await supabaseAdmin
    .from("copa_confrontos")
    .select("id, ronda, ordem, fase, jogador_a, jogador_b, id_competicao, pontos_a, pontos_b, vencedor, decidido_por, estado")
    .eq("league_id", league_id)
    .order("ronda", { ascending: true })
    .order("ordem", { ascending: true });

  const lista = confrontos || [];

  // Inscritos (para saber o tamanho da chave e listar quem está, mesmo sem sorteio).
  const { data: membros } = await supabaseAdmin
    .from("league_members")
    .select("user_id")
    .eq("league_id", league_id);
  const userIds = (membros || []).map((m) => m.user_id);
  const nInscritos = userIds.length;

  // Quem está REALMENTE na chave (saiu no sorteio). Pode ser menos do que os
  // inscritos: quem entrou na liga DEPOIS do sorteio não tem lugar na chave.
  const naChave = new Set<string>();
  for (const c of lista) {
    if (c.jogador_a) naChave.add(String(c.jogador_a));
    if (c.jogador_b) naChave.add(String(c.jogador_b));
  }
  const nNaChave = naChave.size;

  // Identidade (nome do time + escudo) de cada jogador envolvido.
  // Junta os jogadores dos confrontos + os inscritos (para a sala de espera).
  const envolvidos = new Set<string>(userIds);
  for (const c of lista) {
    if (c.jogador_a) envolvidos.add(c.jogador_a);
    if (c.jogador_b) envolvidos.add(c.jogador_b);
  }
  const identidades = await identidadesDe(Array.from(envolvidos), liga.copa_competicao_inicial);

  // Nº total de rondas previstas (para desenhar as futuras "a aguardar").
  const tamanho = nInscritos >= 2 ? tamanhoChave(nInscritos) : 0;
  const totalRondas = tamanho >= 2 ? numeroDeRondas(tamanho) : 0;

  // Nº de PARTICIPANTES que REALMENTE jogaram (escalaram em alguma ronda da copa).
  // Para o certificado anti-boicote: "Campeão entre N participantes".
  const nParticiparam = await contarParticipantes(lista, Array.from(naChave));

  // Pódio (só quando terminada).
  let podio: { campeao?: string; vice?: string; terceiro?: string } = {};
  if (liga.copa_estado === "terminada") {
    const final = lista.find((c) => c.fase === "final");
    const bronze = lista.find((c) => c.fase === "bronze");
    if (final && final.vencedor) {
      podio.campeao = final.vencedor;
      podio.vice = final.vencedor === final.jogador_a ? (final.jogador_b ?? undefined) : final.jogador_a;
    }
    if (bronze && bronze.vencedor) podio.terceiro = bronze.vencedor;
  }

  return NextResponse.json({
    liga: { id: liga.id, name: liga.name, escudo: liga.escudo, copa_estado: liga.copa_estado },
    confrontos: lista,
    identidades,        // { user_id: { nome_time, escudo } }
    nInscritos,
    nNaChave,           // quantos saíram no sorteio (<= nInscritos)
    nParticiparam,
    totalRondas,
    podio,
  });
}

// Conta jogadores DISTINTOS DA CHAVE que escalaram (têm equipa na tabela
// equipas) em alguma das competições desta copa.
//
// IMPORTANTE: filtra pelos jogadores da chave. Sem esse filtro, a consulta
// contava TODOS os utilizadores da app que escalaram nessas competições — numa
// copa de 4 amigos o certificado diria "Campeão entre 850 participantes".
// Quem entrou na liga depois do sorteio também não conta: não disputou a copa.
async function contarParticipantes(
  confrontos: { id_competicao: string }[],
  jogadoresDaChave: string[]
): Promise<number> {
  if (!supabaseAdmin) return 0;
  const comps = Array.from(new Set(confrontos.map((c) => c.id_competicao).filter(Boolean)));
  if (comps.length === 0 || jogadoresDaChave.length === 0) return 0;
  const { data: eqs } = await supabaseAdmin
    .from("equipas")
    .select("user_id")
    .in("id_competicao", comps)
    .in("user_id", jogadoresDaChave);
  const distintos = new Set<string>((eqs || []).map((e) => String(e.user_id)));
  return distintos.size;
}

// Lê o nome do time + escudo de cada jogador. Tenta a equipa na competição
// inicial da copa; se não houver, cai para a equipa mais recente desse user.
async function identidadesDe(userIds: string[], compInicial: string | null): Promise<Record<string, Identidade>> {
  const out: Record<string, Identidade> = {};
  if (!supabaseAdmin || userIds.length === 0) return out;

  // 1ª tentativa: equipa na competição inicial da copa.
  if (compInicial) {
    const { data: eqs } = await supabaseAdmin
      .from("equipas")
      .select("user_id, nome, escudo")
      .eq("id_competicao", compInicial)
      .in("user_id", userIds);
    for (const e of eqs || []) {
      out[e.user_id] = { user_id: e.user_id, nome_time: e.nome ?? "Equipa", escudo: e.escudo ?? null };
    }
  }

  // Para quem ainda não tem identidade, busca a equipa mais recente.
  const faltam = userIds.filter((u) => !out[u]);
  if (faltam.length > 0) {
    const { data: outras } = await supabaseAdmin
      .from("equipas")
      .select("user_id, nome, escudo, id_competicao")
      .in("user_id", faltam)
      .order("id_competicao", { ascending: false });
    for (const e of outras || []) {
      if (!out[e.user_id]) {
        out[e.user_id] = { user_id: e.user_id, nome_time: e.nome ?? "Equipa", escudo: e.escudo ?? null };
      }
    }
  }

  // Fallback final para quem não tem nenhuma equipa.
  for (const u of userIds) {
    if (!out[u]) out[u] = { user_id: u, nome_time: "Equipa", escudo: null };
  }
  return out;
}
