// app/api/push/migrar/route.ts
//
// MIGRAÇÃO SILENCIOSA de subscrição. Chamada pelo service worker no evento
// pushsubscriptionchange: o browser trocou a subscrição (a antiga morreu, nasceu
// uma nova). Como o SW não tem sessão, ele diz-nos o ENDPOINT ANTIGO e o NOVO.
// Aqui encontramos a linha da subscrição antiga (que já está ligada a uma conta)
// e atualizamo-la para os dados novos — preservando o user_id. Assim a mesma
// conta continua a receber push sem o utilizador tocar em nada.
//
// Sem autenticação por cabeçalho (o SW não a consegue enviar), mas seguro: só
// afeta uma linha cujo endpoint antigo o próprio aparelho já possuía. O endpoint
// é uma URL longa e não é exposta em lado nenhum.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Corpo = {
  oldEndpoint?: string | null;
  endpoint?: string;
  p256dh?: string;
  auth?: string;
};

export async function POST(req: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ ok: false, erro: "Sem base de dados." }, { status: 500 });
  }
  let b: Corpo;
  try {
    b = (await req.json()) as Corpo;
  } catch {
    return NextResponse.json({ ok: false, erro: "JSON inválido." }, { status: 400 });
  }

  const endpoint = (b.endpoint || "").trim();
  const p256dh = (b.p256dh || "").trim();
  const auth = (b.auth || "").trim();
  const oldEndpoint = (b.oldEndpoint || "").trim();

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ ok: false, erro: "Faltam dados da subscrição nova." }, { status: 400 });
  }

  // 1) Descobrir a conta a partir do endpoint ANTIGO (é a única pista que temos).
  let userId: string | null = null;
  if (oldEndpoint) {
    const { data } = await supabaseAdmin
      .from("push_subscriptions")
      .select("user_id")
      .eq("endpoint", oldEndpoint)
      .maybeSingle();
    userId = (data?.user_id as string) || null;
  }

  // 2) Se encontrámos a conta, apagamos a linha antiga (morta) e gravamos a nova
  //    ligada a essa conta. Upsert por endpoint (chave única) evita duplicados.
  if (userId) {
    try {
      if (oldEndpoint) {
        await supabaseAdmin.from("push_subscriptions").delete().eq("endpoint", oldEndpoint);
      }
      await supabaseAdmin
        .from("push_subscriptions")
        .upsert({ user_id: userId, endpoint, p256dh, auth }, { onConflict: "endpoint" });
      return NextResponse.json({ ok: true, migrada: true });
    } catch {
      return NextResponse.json({ ok: false, erro: "Falha ao migrar." }, { status: 500 });
    }
  }

  // 3) Não sabemos a conta (sem endpoint antigo, ou já não existia). Não podemos
  //    criar uma linha sem user_id — a reconciliação no arranque da app trata
  //    disto assim que o utilizador abrir a Ippon League.
  return NextResponse.json({ ok: true, migrada: false });
}
