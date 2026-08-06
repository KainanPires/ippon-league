// app/api/dodo/verificar-pro/route.ts
//
// QUEM DEIXA DE TER PRO SAI DO MATA-MATA DO DÔDO.
//
// ---------------------------------------------------------------------------
// O PROBLEMA QUE ISTO FECHA
//
// A subscrição tem 7 dias grátis. Sem esta verificação, o caminho era óbvio:
// assinar, inscrever-se na Copa, cancelar dentro dos 7 dias, e continuar a
// disputar um mata-mata que é só para membros — sem nunca ter pago nada.
//
// ---------------------------------------------------------------------------
// O QUE ISTO NÃO FAZ: PUNIR QUEM CANCELA
//
// Uma subscrição paga vale um ano inteiro, mesmo depois de cancelada. Quem paga
// e cancela no dia seguinte continua Pro até ao fim do período — e continua na
// Copa, com todo o direito.
//
// Por isso a verificação olha para `is_pro` / `is_pro_max` na tabela, que é o
// que reflete o acesso REAL. Não olha para "cancelou ou não": cancelar não tira
// nada a ninguém no imediato.
//
// Quem sai é quem já não tem acesso — porque nunca pagou, ou porque o período
// terminou.
//
// ---------------------------------------------------------------------------
// O ADVERSÁRIO PASSA
//
// Não se deixa o lugar vazio: quem ia defrontar o desqualificado avança à ronda
// seguinte. Uma chave com um buraco a meio é pior do que um apuramento sem
// jogo — e o adversário não tem culpa nenhuma.
//
//   GET /api/dodo/verificar-pro?key=SEGREDO
//   GET /api/dodo/verificar-pro?key=SEGREDO&simular=1
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { criarNotificacaoServidor } from "@/lib/notificacoesServidor";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const key = (searchParams.get("key") || "").trim();
  if (!process.env.CRON_SECRET || key !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, erro: "Não autorizado." }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ ok: false, erro: "Servidor sem ligação." }, { status: 500 });
  }
  const simular = (searchParams.get("simular") || "").trim() === "1";

  // A edição a decorrer. Sem chave montada não há nada a verificar.
  const { data: edicao } = await supabaseAdmin
    .from("dodo_edicoes").select("id, numero, league_id, estado")
    .in("estado", ["sorteada", "a_decorrer"])
    .order("numero", { ascending: false }).maybeSingle();
  if (!edicao?.league_id) {
    return NextResponse.json({ ok: true, nada: "Nenhuma edição a decorrer." });
  }

  // Quem continua em jogo.
  const { data: emJogo } = await supabaseAdmin
    .from("dodo_inscricoes")
    .select("id, user_id")
    .eq("edicao_id", edicao.id).eq("sorteada", true)
    .is("desqualificada_em", null);
  const lista = emJogo || [];
  if (lista.length === 0) {
    return NextResponse.json({ ok: true, nada: "Ninguém em jogo." });
  }

  // O nível REAL de cada um, agora. Em lotes, para não fazer uma consulta por
  // pessoa.
  const semPro: string[] = [];
  for (let i = 0; i < lista.length; i += 200) {
    const ids = lista.slice(i, i + 200).map((x) => String(x.user_id));
    const { data: us } = await supabaseAdmin
      .from("users").select("id, is_pro, is_pro_max").in("id", ids);
    const nivelDe = new Map<string, boolean>();
    for (const u of us || []) nivelDe.set(String(u.id), !!u.is_pro || !!u.is_pro_max);
    for (const id of ids) {
      // Quem não aparecer na consulta (conta apagada, por exemplo) também sai.
      if (!nivelDe.get(id)) semPro.push(id);
    }
  }

  if (semPro.length === 0) {
    return NextResponse.json({ ok: true, verificados: lista.length, desqualificados: 0 });
  }
  if (simular) {
    return NextResponse.json({ ok: true, simulacao: true, verificados: lista.length, desqualificados: semPro.length, ids: semPro });
  }

  const avancaram: { adversario: string; ronda: number }[] = [];

  for (const uid of semPro) {
    // 1) Marca a saída.
    await supabaseAdmin.from("dodo_inscricoes")
      .update({ desqualificada_em: new Date().toISOString(), motivo_saida: "sem_pro" })
      .eq("edicao_id", edicao.id).eq("user_id", uid);

    // 2) Confrontos por decidir onde ele está. O adversário passa.
    const { data: confrontos } = await supabaseAdmin
      .from("copa_confrontos")
      .select("id, ronda, jogador_a, jogador_b, vencedor")
      .eq("league_id", edicao.league_id)
      .is("vencedor", null)
      .or(`jogador_a.eq.${uid},jogador_b.eq.${uid}`);

    for (const c of confrontos || []) {
      const souA = String(c.jogador_a) === uid;
      const adversario = souA ? c.jogador_b : c.jogador_a;
      if (!adversario) continue;
      await supabaseAdmin.from("copa_confrontos")
        .update({ vencedor: adversario, estado: "decidido" })
        .eq("id", c.id);
      avancaram.push({ adversario: String(adversario), ronda: Number(c.ronda) });

      // 3) Avisa o adversário. Ele avançou sem jogar e tem de perceber porquê —
      //    caso contrário parece um erro da app.
      await criarNotificacaoServidor({
        paraUserId: String(adversario),
        tipo: "dodo_avanco",
        titulo: "Avançaste no Mata-Mata do Dôdo",
        corpo: "O teu adversário deixou de ser membro Ippon Pro e saiu da competição. Estás na próxima ronda.",
        link: "/dodo",
      }).catch(() => {});
    }

    // 4) E avisa quem saiu, para não descobrir sozinho.
    await criarNotificacaoServidor({
      paraUserId: uid,
      tipo: "dodo_saida",
      titulo: "Saíste do Mata-Mata do Dôdo",
      corpo: "A competição é exclusiva para membros Ippon Pro. Volta a ser Pro para participares na próxima edição.",
      link: "/ippon-pro",
    }).catch(() => {});
  }

  return NextResponse.json({
    ok: true,
    edicao: edicao.numero,
    verificados: lista.length,
    desqualificados: semPro.length,
    adversarios_que_avancaram: avancaram.length,
  });
}
