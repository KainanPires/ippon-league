// app/api/copa/sortear/route.ts
//
// SORTEIO DA COPA IPPON (servidor, chave secreta).
//
// Disparo "preguiçoso": a página da liga chama esta rota quando deteta que a
// liga é copa, a data de fecho da inscrição já passou, e ainda não foi sorteada.
// A rota é IDEMPOTENTE: se já estiver sorteada, não faz nada (evita corridas).
//
// Recebe (POST): { league_id }
// Faz:
//   1) valida que a liga é copa em estado "inscricao" e que o prazo passou
//   2) lê os inscritos (league_members)
//   3) gera a 1ª ronda (lib/copa) e grava em copa_confrontos
//   4) marca copa_estado = "sorteada"
// Devolve: { ok, sorteada, confrontos } ou { ok:false, erro }
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { gerarPrimeiraRonda, competicaoPorId } from "@/lib/copa";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ ok: false, erro: "Servidor sem ligação." }, { status: 500 });
  }

  let corpo: { league_id?: string };
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ ok: false, erro: "Pedido inválido." }, { status: 400 });
  }
  const league_id = (corpo.league_id || "").trim();
  if (!league_id) return NextResponse.json({ ok: false, erro: "Falta league_id." }, { status: 400 });

  // 1) Lê a liga e valida que é copa por sortear.
  const { data: liga } = await supabaseAdmin
    .from("leagues")
    .select("id, formato, copa_estado, copa_fecho_inscricao, copa_competicao_inicial")
    .eq("id", league_id)
    .maybeSingle();

  if (!liga) return NextResponse.json({ ok: false, erro: "Liga não encontrada." }, { status: 404 });
  if (liga.formato !== "copa") {
    return NextResponse.json({ ok: false, erro: "Esta liga não é uma copa." }, { status: 400 });
  }

  // Idempotência: se já está sorteada (ou além), não repete.
  if (liga.copa_estado && liga.copa_estado !== "inscricao") {
    return NextResponse.json({ ok: true, sorteada: false, jaEstava: true, estado: liga.copa_estado });
  }

  // O prazo de inscrição tem de ter passado.
  if (!liga.copa_fecho_inscricao) {
    return NextResponse.json({ ok: false, erro: "A copa não tem data de fecho definida." }, { status: 400 });
  }
  const agora = Date.now();
  const fecho = new Date(liga.copa_fecho_inscricao).getTime();
  if (agora < fecho) {
    return NextResponse.json({ ok: true, sorteada: false, aindaAberta: true });
  }

  // A competição inicial tem de existir no calendário.
  const idCompInicial = (liga.copa_competicao_inicial || "").trim();
  if (!idCompInicial || !competicaoPorId(idCompInicial)) {
    return NextResponse.json({ ok: false, erro: "A competição inicial da copa não é válida." }, { status: 400 });
  }

  // 2) Inscritos (membros da liga).
  const { data: membros } = await supabaseAdmin
    .from("league_members")
    .select("user_id")
    .eq("league_id", league_id);
  const inscritos = (membros || []).map((m) => m.user_id);

  // Precisa de pelo menos 2 para haver chave. Com menos, fica em inscrição.
  if (inscritos.length < 2) {
    return NextResponse.json({ ok: false, erro: "São precisos pelo menos 2 inscritos para sortear a copa.", poucos: true }, { status: 400 });
  }

  // 3) Gera a 1ª ronda e grava.
  const confrontos = gerarPrimeiraRonda(inscritos, idCompInicial);
  const linhas = confrontos.map((c) => ({
    league_id,
    ronda: c.ronda,
    ordem: c.ordem,
    fase: c.fase,
    jogador_a: c.jogador_a,
    jogador_b: c.jogador_b,
    id_competicao: c.id_competicao,
    estado: c.estado,
    // Confrontos com bye já têm vencedor decidido (passam automaticamente).
    ...(c.jogador_b === null
      ? { vencedor: c.jogador_a, decidido_por: "bye", estado: "decidido" }
      : {}),
  }));

  const { error: erroInsert } = await supabaseAdmin
    .from("copa_confrontos")
    .insert(linhas);
  if (erroInsert) {
    return NextResponse.json({ ok: false, erro: "Não foi possível gravar a chave.", detalhe: erroInsert.message }, { status: 500 });
  }

  // 4) Marca a copa como sorteada.
  await supabaseAdmin
    .from("leagues")
    .update({ copa_estado: "sorteada" })
    .eq("id", league_id);

  return NextResponse.json({ ok: true, sorteada: true, confrontos: linhas.length, inscritos: inscritos.length });
}
