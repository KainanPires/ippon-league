// app/api/copa/podio/route.ts
//
// PÓDIO + DADOS DOS CERTIFICADOS DA COPA IPPON (servidor, chave secreta).
//
// Só faz sentido para uma copa TERMINADA. Devolve, para cada posição do pódio
// (campeão, vice, 3º), tudo o que o certificado precisa:
// - escudo + nome do time + se é Pro
// - pontos totais na copa (soma dos pontos desse jogador em todos os confrontos
  // que jogou) e média por rodada (total ÷ rondas jogadas, sem contar byes)
// Mais os metadados da liga: nome, nº de participantes, data de término (a data
  // da competição onde a final foi disputada).
//
// Recebe (GET): ?id=<league_id> ou ?codigo=<invite_code>
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { competicaoPorId } from "@/lib/copa";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
interface DadosPosicao {
  user_id: string;
  nome_time: string;
  escudo: unknown;
  is_pro: boolean;
  pontos_total: number; // soma dos pontos na copa
  rondas_jogadas: number; // confrontos que jogou (sem byes)
  media: number; // pontos_total / rondas_jogadas
}
export async function GET(req: Request) {
  if (!supabaseAdmin) return NextResponse.json({ erro: "Servidor sem ligação." }, { status: 500 });
  const { searchParams } = new URL(req.url);
  const idParam = (searchParams.get("id") || "").trim();
  const codigo = (searchParams.get("codigo") || "").trim().toUpperCase();
  if (!idParam && !codigo) return NextResponse.json({ erro: "Falta ?id ou ?codigo." }, { status: 400 });
  const consulta = supabaseAdmin.from("leagues").select("id, name, formato, copa_estado");
  const { data: liga } = idParam
  ? await consulta.eq("id", idParam).maybeSingle()
  : await consulta.eq("invite_code", codigo).maybeSingle();
  if (!liga) return NextResponse.json({ erro: "Liga não encontrada." }, { status: 404 });
  if (liga.formato !== "copa") return NextResponse.json({ erro: "Não é uma copa." }, { status: 400 });
  if (liga.copa_estado !== "terminada") {
    return NextResponse.json({ ok: true, terminada: false, copa_estado: liga.copa_estado });
  }
  const league_id = liga.id;
  // Todos os confrontos da copa.
  const { data: confrontos } = await supabaseAdmin
  .from("copa_confrontos")
  .select("ronda, fase, jogador_a, jogador_b, pontos_a, pontos_b, vencedor")
  .eq("league_id", league_id);
  const lista = confrontos || [];
  // O pódio: campeão e vice saem da final; 3º sai do bronze.
  const final = lista.find((c) => c.fase === "final");
  const bronze = lista.find((c) => c.fase === "bronze");
  if (!final || !final.vencedor) {
    return NextResponse.json({ erro: "A copa não tem final decidida." }, { status: 400 });
  }
  const campeaoId = final.vencedor;
  const viceId = final.vencedor === final.jogador_a ? final.jogador_b : final.jogador_a;
  const terceiroId = bronze?.vencedor ?? null;
  // Nº de participantes (membros da liga).
  const { data: membros } = await supabaseAdmin
  .from("league_members")
  .select("user_id")
  .eq("league_id", league_id);
  const participantes = (membros || []).length;
  // Data de término = data da competição onde a final foi disputada.
  let dataFim: string | null = null;
  {
    const { data: finalRow } = await supabaseAdmin
    .from("copa_confrontos")
    .select("id_competicao")
    .eq("league_id", league_id)
    .eq("fase", "final")
    .maybeSingle();
    const comp = finalRow?.id_competicao ? competicaoPorId(finalRow.id_competicao) : null;
    dataFim = comp?.de ?? null; // "YYYY/MM/DD"
  }
  // Calcula pontos totais + rondas jogadas de cada jogador do pódio.
  function statsDe(uid: string | null): { pontos: number; rondas: number } {
    if (!uid) return { pontos: 0, rondas: 0 };
    let pontos = 0, rondas = 0;
    for (const c of lista) {
      // Só conta confrontos REAIS (com adversário); byes não somam ronda nem pontos.
      if (c.jogador_a === uid && c.jogador_b) {
        pontos += Number(c.pontos_a ?? 0);
        rondas++;
      } else if (c.jogador_b === uid && c.jogador_a) {
        pontos += Number(c.pontos_b ?? 0);
        rondas++;
      }
    }
    return { pontos: Math.round(pontos * 10) / 10, rondas };
  }
  const ids = [campeaoId, viceId, terceiroId].filter((x): x is string => !!x);
  const identidades = await identidadesEPro(ids);
  function montar(uid: string | null): DadosPosicao | null {
    if (!uid) return null;
    const s = statsDe(uid);
    const idn = identidades[uid];
    const media = s.rondas > 0 ? Math.round((s.pontos / s.rondas) * 10) / 10 : 0;
    return {
      user_id: uid,
      nome_time: idn?.nome_time ?? "Equipa",
      escudo: idn?.escudo ?? null,
      is_pro: idn?.is_pro ?? false,
      pontos_total: s.pontos,
      rondas_jogadas: s.rondas,
      media,
    };
  }
  return NextResponse.json({
      ok: true,
      terminada: true,
      liga: { id: liga.id, name: liga.name },
      participantes,
      dataFim, // "YYYY/MM/DD"
      podio: {
        campeao: montar(campeaoId),
        vice: montar(viceId),
        terceiro: montar(terceiroId),
      },
    });
}
// Nome do time + escudo + is_pro de cada jogador.
async function identidadesEPro(userIds: string[]): Promise<Record<string, { nome_time: string; escudo: unknown; is_pro: boolean }>> {
  const out: Record<string, { nome_time: string; escudo: unknown; is_pro: boolean }> = {};
  if (!supabaseAdmin || userIds.length === 0) return out;
  // Equipa mais recente de cada um (para o escudo + nome).
  const { data: equipas } = await supabaseAdmin
  .from("equipas")
  .select("user_id, nome, escudo, id_competicao")
  .in("user_id", userIds)
  .order("id_competicao", { ascending: false });
  for (const e of equipas || []) {
    if (!out[e.user_id]) {
      out[e.user_id] = { nome_time: e.nome ?? "Equipa", escudo: e.escudo ?? null, is_pro: false };
    }
  }
  // is_pro de cada um — DA TABELA `users`, nunca do user_metadata.
  //
  // O metadata deixou de ser sincronizado quando o is_pro saiu do trigger
  // ippon_sync_user: quem paga fica com is_pro=true em `users` (é lá que o
  // webhook da Stripe escreve) e com o metadata a dizer false para sempre.
  // Um campeão da Copa que paga aparecia no pódio sem crachá.
  //
  // De caminho, deixa de fazer um getUserById por pessoa: uma consulta só.
  for (const uid of userIds) {
    if (!out[uid]) out[uid] = { nome_time: "Equipa", escudo: null, is_pro: false };
  }
  try {
    const { data: niveis } = await supabaseAdmin
      .from("users")
      .select("id, is_pro, is_pro_max")
      .in("id", userIds);

    for (const u of niveis || []) {
      const id = String(u.id);
      if (out[id]) out[id].is_pro = !!u.is_pro || !!u.is_pro_max;
    }
  } catch { /* ficam false */ }
  return out;
}
