// app/api/liga/campeoes/route.ts
//
// CAMPEÕES DO ANO das ligas oficiais (servidor, chave secreta).
//
// Lê o livro de campeões (campeoes_oficiais), preenchido pelo cron no fecho do
// ano. Devolve o pódio (1º/2º/3º) do ano pedido (ou do mais recente fechado).
//
// Recebe (GET): ?tipo=mundial|continental & [ano=AAAA] & [user_id=<uuid> p/ continental]
// Devolve: { ok, ano, tipo, continente, podio: [{ posicao, user_id, nome_time, escudo, pontos }] }
//
// ---------------------------------------------------------------------------
// REGRA DA ÉPOCA FECHADA (não remover sem pensar duas vezes)
//
// O título de "Campeão do Ano" só existe quando a época TERMINA. O cron corre o
// fecharAnoOficial a 1 de janeiro, sempre para o ano ANTERIOR, e recusa fechar o
// ano em curso. Mas o livro de campeões pode ter linhas de um ano ainda a
// decorrer — escritas antes dessa proteção existir, ou por SQL à mão. Se as
// servíssemos, o utilizador via-se "Campeão 2026" a meio de 2026, com o total
// provisório da época como se fosse definitivo.
//
// Por isso esta rota só devolve anos JÁ TERMINADOS (ano < ano atual):
//   • sem ?ano=  → escolhe o ano mais recente ENTRE OS FECHADOS (salta o ano em
//                  curso mesmo que ele seja o mais alto da tabela);
//   • com ?ano=  → se o ano ainda não fechou, devolve pódio vazio e
//                  epocaEmCurso:true (o cliente trata como "sem título").
//
// A posição durante a época em curso vê-se no ranking da liga oficial
// (/api/liga/geral), que é o sítio certo para ela — não num certificado.
// ---------------------------------------------------------------------------
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
  // Ano em curso: nenhuma época igual ou posterior a este já fechou.
  const anoAtual = new Date().getFullYear();
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
  // Ano pedido à mão que ainda não terminou: não há campeão a dar.
  if (ano !== null && ano >= anoAtual) {
    return NextResponse.json({ ok: true, ano: null, tipo, continente: continente || null, podio: [], epocaEmCurso: true });
  }
  if (ano === null) {
    let qAno = supabaseAdmin
      .from("campeoes_oficiais")
      .select("ano")
      .eq("tipo", tipo)
      .lt("ano", anoAtual)          // só épocas JÁ TERMINADAS (ver regra no topo)
      .order("ano", { ascending: false })
      .limit(1);
    // No mundial o continente foi guardado como '' (ou null em dados antigos);
    // aceitamos os dois. Na continental, o código do continente.
    if (tipo === "mundial") {
      qAno = qAno.or("continente.eq.,continente.is.null");
    } else {
      qAno = qAno.eq("continente", continente);
    }
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
  if (tipo === "mundial") {
    q = q.or("continente.eq.,continente.is.null");
  } else {
    q = q.eq("continente", continente);
  }
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
