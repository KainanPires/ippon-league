// app/api/liga/campeoes/route.ts
//
// CAMPEÕES DO ANO das ligas oficiais (servidor, chave secreta).
//
// Lê o livro de campeões (campeoes_oficiais), preenchido pelo cron no fecho do
// ano. Devolve o pódio (1º/2º/3º) do ano pedido (ou do mais recente fechado).
//
// Recebe (GET): ?tipo=mundial|continental & [ano=AAAA] & [user_id=<uuid> p/ continental]
// Devolve: { ok, ano, tipo, continente, podio: [{ posicao, user_id, nome_time, escudo, pontos }] }
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ ok: false, erro: "Servidor sem ligação." }, { status: 500 });
  }
  const { searchParams } = new URL(req.url);
  const tipo = (searchParams.get("tipo") || "").trim();
  const anoParam = (searchParams.get("ano") || "").trim();
  const user_id = (searchParams.get("user_id") || "").trim();

  if (tipo !== "mundial" && tipo !== "continental") {
    return NextResponse.json({ ok: false, erro: "tipo deve ser 'mundial' ou 'continental'." }, { status: 400 });
  }

  // Para a continental, descobrir o continente do utilizador.
  let continente = "";
  if (tipo === "continental") {
    if (!user_id) return NextResponse.json({ ok: false, erro: "Falta ?user_id= para a continental." }, { status: 400 });
    const { data: eu } = await supabaseAdmin
      .from("users")
      .select("continente")
      .eq("id", user_id)
      .maybeSingle();
    continente = eu?.continente ? String(eu.continente) : "";
    if (!continente) {
      return NextResponse.json({ ok: true, ano: null, tipo, continente: null, podio: [] });
    }
  }

  // Qual ano? O pedido, ou o mais recente fechado para este tipo/continente.
  let ano: number | null = anoParam && /^\d{4}$/.test(anoParam) ? parseInt(anoParam, 10) : null;
  if (ano === null) {
    let qAno = supabaseAdmin
      .from("campeoes_oficiais")
      .select("ano")
      .eq("tipo", tipo)
      .order("ano", { ascending: false })
      .limit(1);
    // No mundial guardamos continente=''; na continental, o código do continente.
    qAno = qAno.eq("continente", tipo === "mundial" ? "" : continente);
    const { data: ultimo } = await qAno;
    ano = ultimo && ultimo.length > 0 ? Number(ultimo[0].ano) : null;
  }
  if (ano === null) {
    return NextResponse.json({ ok: true, ano: null, tipo, continente: continente || null, podio: [] });
  }

  // Lê o pódio desse ano (1º/2º/3º).
  let q = supabaseAdmin
    .from("campeoes_oficiais")
    .select("posicao, user_id, nome_time, escudo, pontos")
    .eq("tipo", tipo)
    .eq("ano", ano)
    .order("posicao", { ascending: true });
  q = q.eq("continente", tipo === "mundial" ? "" : continente);
  const { data: linhas } = await q;

  const podio = (linhas || []).map((l) => ({
    posicao: Number(l.posicao),
    user_id: String(l.user_id),
    nome_time: l.nome_time ?? "Equipa",
    escudo: l.escudo ?? null,
    pontos: Number(l.pontos ?? 0),
  }));

  return NextResponse.json({ ok: true, ano, tipo, continente: continente || null, podio });
}
