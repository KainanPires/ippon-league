// app/api/liga/mercado/route.ts
//
// MERCADO DE LIGAS (servidor, chave secreta).
//
// Lista as ligas ABERTAS (privacidade = "aberta") — as únicas que aparecem
// publicamente. As "fechadas" só se acede por código, por isso NÃO entram aqui.
//
// Recebe (GET): ?user_id=<uuid>  (opcional — para saber em quais já está)
// Devolve: { ligas: [{ id, name, formato, privacidade, escudo, invite_code,
//                       membros, sou_membro, sou_dono }] }
//
// Nota de filtro: as ligas de amigos são gravadas com scope="privada" mesmo
// quando a privacidade é "aberta". Por isso filtramos por `privacidade`, não
// por `scope`.
//
// ---------------------------------------------------------------------------
// PRINCÍPIO DESTE ECRÃ: o mercado mostra SÓ o que dá mesmo para entrar.
//
// Antes, uma copa já terminada (com campeão e certificados emitidos) continuava
// listada como se estivesse aberta. Quem clicasse em "Entrar" era recusado pelo
// /api/liga/entrar — anunciávamos algo que não funcionava. E uma liga de pontos
// corridos terminada era pior: essa nem sequer tem guarda na entrada.
//
// Ficam de fora, portanto:
//   • ligas TERMINADAS (pontos: estado='terminada'; copa: copa_estado='terminada')
//   • copas com INSCRIÇÕES FECHADAS (já sorteadas, a decorrer, ou passado o
//     prazo copa_fecho_inscricao) — mesma regra do /api/liga/entrar e /pedir,
//     copiada aqui de propósito para os três concordarem sempre.
//
// Uma liga terminada não desaparece do jogo: quem participou continua a vê-la
// em /ligas → Resultados, com o pódio e o certificado. Só deixa de se anunciar
// como se estivesse à espera de gente.
//
// BÓNUS DE DESEMPENHO: o filtro corre ANTES da contagem de membros, que faz uma
// consulta por liga. Menos ligas na lista, menos consultas.
// ---------------------------------------------------------------------------
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type LigaBruta = {
  formato?: unknown;
  estado?: unknown;
  copa_estado?: unknown;
  copa_fecho_inscricao?: unknown;
};

// A liga já TERMINOU? (mesma regra do ecrã /ligas e do cartão do /inicio)
function ligaTerminada(l: LigaBruta): boolean {
  if (String(l.formato) === "copa") return String(l.copa_estado) === "terminada";
  return String(l.estado) === "terminada";
}

// As inscrições desta COPA já fecharam? (mesma regra do /entrar e do /pedir)
// Fechado = estado já não é "inscricao" OU o prazo de fecho já passou.
// Para ligas de pontos corridos devolve sempre false.
function copaInscricoesFechadas(l: LigaBruta): boolean {
  if (String(l.formato) !== "copa") return false;
  const estado = String(l.copa_estado ?? "inscricao");
  if (estado !== "inscricao") return true; // sorteada / a decorrer / terminada
  const fecho = l.copa_fecho_inscricao ? new Date(String(l.copa_fecho_inscricao)).getTime() : null;
  if (fecho && Date.now() >= fecho) return true; // prazo passou
  return false;
}

// Aparece no mercado? Só o que ainda aceita gente nova.
function visivelNoMercado(l: LigaBruta): boolean {
  if (ligaTerminada(l)) return false;
  if (copaInscricoesFechadas(l)) return false;
  return true;
}

export async function GET(req: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ ligas: [], erro: "Servidor sem ligação." }, { status: 500 });
  }
  const { searchParams } = new URL(req.url);
  const user_id = (searchParams.get("user_id") || "").trim();
  // 1) Ligas visíveis no mercado: "aberta" (entra direto) e "mediante_pedido"
  //    (pede aprovação). As "fechada" NUNCA aparecem aqui.
  //    Trazemos também estado / copa_estado / copa_fecho_inscricao — são o que
  //    decide se a liga ainda aceita gente (ver visivelNoMercado).
  const { data: ligas, error } = await supabaseAdmin
    .from("leagues")
    .select("id, name, formato, privacidade, descricao, escudo, invite_code, created_by, created_at, estado, copa_estado, copa_fecho_inscricao")
    .in("privacidade", ["aberta", "mediante_pedido"])
    .order("created_at", { ascending: false });
  if (error) {
    return NextResponse.json({ ligas: [], erro: "Não foi possível carregar o mercado." }, { status: 500 });
  }
  // 1-bis) Fora as terminadas e as copas com inscrições fechadas. Antes da
  //        contagem de membros, para não gastar consultas com quem não entra.
  const lista = (ligas || []).filter((l) => visivelNoMercado(l as LigaBruta));
  if (lista.length === 0) return NextResponse.json({ ligas: [] });
  const ligaIds = lista.map((l) => l.id);
  // 2) Nº de membros de cada liga (uma contagem por liga).
  const contagens: Record<string, number> = {};
  for (const id of ligaIds) {
    const { count } = await supabaseAdmin
      .from("league_members")
      .select("id", { count: "exact", head: true })
      .eq("league_id", id);
    contagens[id] = count ?? 0;
  }
  // 3) Em quais é que ESTE utilizador já está (para mostrar "Abrir" em vez de "Entrar").
  const meusIds = new Set<string>();
  if (user_id) {
    const { data: filiacoes } = await supabaseAdmin
      .from("league_members")
      .select("league_id")
      .eq("user_id", user_id)
      .in("league_id", ligaIds);
    for (const f of filiacoes || []) meusIds.add(f.league_id);
  }
  const saida = lista.map((l) => ({
    id: l.id,
    name: l.name,
    formato: l.formato,
    privacidade: l.privacidade,
    descricao: l.descricao,
    escudo: l.escudo,
    invite_code: l.invite_code,
    membros: contagens[l.id] ?? 1,
    sou_membro: meusIds.has(l.id),
    sou_dono: l.created_by === user_id,
  }));
  return NextResponse.json({ ligas: saida });
}
