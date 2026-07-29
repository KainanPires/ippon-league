// app/api/liga/sair/route.ts
//
// SAIR DE UMA LIGA (servidor, chave secreta).
//
// Recebe (POST): { user_id, league_id }
// Devolve: { ok:true, saiu:true } | { ok:false, erro, motivo }
//
// ---------------------------------------------------------------------------
// PORQUE ISTO EXISTE
//
// O limite de participação (1 liga + 1 mata-mata no grátis) só faz sentido se
// houver por onde sair. Até agora não havia: quem entrasse numa liga ficava lá
// preso, e a mensagem "para entrares noutra, sai primeiro da atual" era um
// convite para uma porta que não existia.
// ---------------------------------------------------------------------------
//
// ---------------------------------------------------------------------------
// AS TRÊS TRAVAS (regra do Kainan, 29/07/2026)
//
// 1. MATA-MATA SORTEADO — não se sai.
//    Depois do sorteio, cada pessoa é um lugar na chave. Sair a meio deixaria
//    confrontos órfãos e falsearia o resultado de quem já a defrontou. Antes do
//    sorteio (estado "inscricao") não há nada montado, por isso sair é inofensivo
//    e permite-se. Terminada, também se pode sair — já não conta para o limite,
//    mas alguém pode querer arrumar a lista.
//
// 2. O CRIADOR NÃO ABANDONA — enquanto houver mais alguém e a liga não tiver
//    acabado. Uma liga sem dono fica sem quem aprove pedidos, sorteie a copa ou
//    a encerre. Se for o único membro, pode sair (a liga fica vazia, e isso é
//    problema dele).
//
// 3. QUEM NÃO É MEMBRO não sai de nada — devolve-se sucesso à mesma
//    (idempotente), para um duplo clique não dar erro.
//
// NOTA sobre o que NÃO se apaga: a saída remove a filiação (league_members), mas
// NÃO apaga a equipa nem os pontos dessa pessoa nas rodadas já jogadas. Esses
// dados são dela e do histórico da competição, não da liga.
// ---------------------------------------------------------------------------
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** A liga já terminou? (mesma regra do /ligas, /inicio, /mercado, /entrar, /pedir) */
function ligaTerminada(l: { formato?: unknown; estado?: unknown; copa_estado?: unknown }): boolean {
  if (String(l.formato) === "copa") return String(l.copa_estado) === "terminada";
  return String(l.estado) === "terminada";
}

/** A copa já foi sorteada (ou está a decorrer)? A partir daí ninguém sai. */
function copaEmCurso(l: { formato?: unknown; copa_estado?: unknown }): boolean {
  if (String(l.formato) !== "copa") return false;
  const e = String(l.copa_estado ?? "inscricao");
  return e === "sorteada" || e === "a_decorrer";
}

export async function POST(req: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ ok: false, erro: "Servidor sem ligação à base de dados." }, { status: 500 });
  }

  let corpo: { user_id?: string; league_id?: string };
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ ok: false, erro: "Pedido inválido." }, { status: 400 });
  }
  const user_id = (corpo.user_id || "").trim();
  const league_id = (corpo.league_id || "").trim();
  if (!user_id) return NextResponse.json({ ok: false, erro: "Entra na tua conta." }, { status: 401 });
  if (!league_id) return NextResponse.json({ ok: false, erro: "Falta league_id." }, { status: 400 });

  // 1) A liga existe?
  const { data: liga } = await supabaseAdmin
    .from("leagues")
    .select("id, name, type, formato, estado, copa_estado, created_by")
    .eq("id", league_id)
    .maybeSingle();
  if (!liga) {
    return NextResponse.json({ ok: false, erro: "Liga não encontrada." }, { status: 404 });
  }

  // 2) É mesmo membro? Se não, nada a fazer — mas devolvemos sucesso, para um
  //    duplo clique (ou um pedido repetido) não parecer um erro ao utilizador.
  const { data: filiacao } = await supabaseAdmin
    .from("league_members")
    .select("id")
    .eq("league_id", league_id)
    .eq("user_id", user_id)
    .maybeSingle();
  if (!filiacao) {
    return NextResponse.json({ ok: true, saiu: false, jaNaoEra: true });
  }

  const acabou = ligaTerminada(liga);

  // 3) TRAVA 1 — mata-mata já sorteado.
  if (copaEmCurso(liga)) {
    return NextResponse.json({
      ok: false,
      motivo: "copa_em_curso",
      erro: "Esta Copa já foi sorteada — não dá para sair a meio. Quando terminar, ficas livre para entrar noutra.",
    }, { status: 403 });
  }

  // 4) TRAVA 2 — o criador só sai se for o último, ou se a liga já acabou.
  const souODono = String(liga.created_by ?? "") === user_id;
  if (souODono && !acabou) {
    const { count } = await supabaseAdmin
      .from("league_members")
      .select("id", { count: "exact", head: true })
      .eq("league_id", league_id);
    const outros = (count ?? 1) - 1;
    if (outros > 0) {
      return NextResponse.json({
        ok: false,
        motivo: "dono_com_membros",
        outros,
        erro: outros === 1
          ? "Criaste esta liga e ainda há mais alguém nela. Enquanto a liga estiver a decorrer, o criador tem de ficar."
          : `Criaste esta liga e ainda há mais ${outros} pessoas nela. Enquanto a liga estiver a decorrer, o criador tem de ficar.`,
      }, { status: 403 });
    }
  }

  // 5) Sai. Não mexemos em equipas nem em pontos: são do jogador e do histórico
  //    da competição, não da liga.
  const { error } = await supabaseAdmin
    .from("league_members")
    .delete()
    .eq("league_id", league_id)
    .eq("user_id", user_id);
  if (error) {
    return NextResponse.json({ ok: false, erro: "Não foi possível sair da liga." }, { status: 500 });
  }

  // 5-bis) Limpa um pedido pendente antigo, se existir. Sem isto, quem saísse de
  //    uma liga "por aprovação" ficava com um pedido fantasma e não conseguia
  //    voltar a pedir mais tarde.
  try {
    await supabaseAdmin
      .from("league_requests")
      .delete()
      .eq("league_id", league_id)
      .eq("user_id", user_id);
  } catch { /* não bloqueia a saída */ }

  return NextResponse.json({
    ok: true,
    saiu: true,
    liga: { id: liga.id, name: liga.name, formato: liga.formato },
  });
}
