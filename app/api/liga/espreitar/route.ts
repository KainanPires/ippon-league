// app/api/liga/espreitar/route.ts
//
// PRÉ-VISUALIZAR uma liga por código, SEM inscrever ninguém (servidor, leitura).
//
// Serve o cartão "espreitar antes de entrar": quem abre um link de liga e ainda
// não é membro vê primeiro os dados públicos e decide se entra. A inscrição real
// continua a ser feita pelo /api/liga/entrar (só quando carrega no botão).
//
// Recebe (GET): ?codigo=<invite_code>&user_id=<opcional>
// Devolve:
//   { ok:true, liga, nMembros, jaMembro }   dados públicos da liga
//   { ok:false, erro }                       código não encontrado / inválido
//
// O objeto `liga` tem a MESMA forma do que o /api/liga/entrar devolve, para a
// página poder usar os dois sem traduzir nada.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ ok: false, erro: "Servidor sem ligação à base de dados." }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const codigo = (searchParams.get("codigo") || "").trim().toUpperCase();
  const user_id = (searchParams.get("user_id") || "").trim();
  if (codigo.length < 4) {
    return NextResponse.json({ ok: false, erro: "Código inválido." }, { status: 400 });
  }

  // 1) Liga pelo código — mesmo conjunto de campos do /api/liga/entrar, para a
  //    página receber um `liga` com a forma a que já está habituada.
  const { data: liga, error } = await supabaseAdmin
    .from("leagues")
    .select("id, name, type, formato, privacidade, descricao, escudo, invite_code, copa_estado, copa_fecho_inscricao, copa_competicao_inicial, liga_competicao_inicial, fim_tipo, fim_valor, estado")
    .eq("invite_code", codigo)
    .maybeSingle();
  if (error || !liga) {
    return NextResponse.json({ ok: false, erro: "Não encontrámos nenhuma liga com esse código." }, { status: 404 });
  }

  // 2) Quantos membros tem (para mostrar "N membros" no cartão).
  const { count } = await supabaseAdmin
    .from("league_members")
    .select("id", { count: "exact", head: true })
    .eq("league_id", liga.id);

  // 3) O utilizador (se veio identificado) já é membro? Se sim, a página abre a
  //    liga direto, sem mostrar o cartão de pré-visualização.
  let jaMembro = false;
  if (user_id) {
    const { data: membro } = await supabaseAdmin
      .from("league_members")
      .select("id")
      .eq("league_id", liga.id)
      .eq("user_id", user_id)
      .maybeSingle();
    jaMembro = !!membro;
  }

  return NextResponse.json({ ok: true, liga, nMembros: count ?? 0, jaMembro });
}
