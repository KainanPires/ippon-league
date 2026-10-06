// app/api/admin/push-teste/route.ts
//
// FERRAMENTA DE TESTE (protegida por CRON_SECRET): envia os pushes de narração
// de favoritos para a conta do fundador, para confirmar que o WEB PUSH chega ao
// telemóvel. Faz as duas coisas que o insert no banco sozinho NÃO faz:
//   1) insere no sino (tabela `notificacoes`);
//   2) dispara o push real via `enviarPushPara` (o mesmo caminho do mercado).
//
// GET /api/admin/push-teste?secret=<CRON_SECRET>[&email=<alvo>]
//
// Nota: o push só chega ao aparelho que ESTÁ INSCRITO. Se o telemóvel não
// receber mas o computador sim, é porque a subscrição do telemóvel não existe:
// abrir a app NO TELEMÓVEL e ativar as notificações lá, depois correr de novo.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { enviarPushPara } from "@/lib/pushServer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALVO_DEFAULT = "pireskainan@gmail.com";

const MENSAGENS = [
  {
    tipo: "favorito",
    titulo: "🥋 Seu favorito venceu a semifinal",
    corpo: "Hifumi Abe venceu Denis Vieru por ippon e está na FINAL. Vai encontrar Joshiro Maruyama.",
    link: "/inicio",
  },
  {
    tipo: "favorito",
    titulo: "🏆 Está na final!",
    corpo: "Hifumi Abe garantiu a vaga na final do Mundial de Baku. Acompanhe ao vivo.",
    link: "/inicio",
  },
  {
    tipo: "favorito",
    titulo: "😔 Seu favorito foi eliminado",
    corpo: "Daniel Cargnin perdeu nas quartas para Hidayat Heydarov por ippon e está fora da competição.",
    link: "/inicio",
  },
];

async function uidPorEmail(email: string): Promise<string | null> {
  if (!supabaseAdmin) return null;
  // Procura nas páginas de utilizadores do Auth (base pequena; 10 páginas chegam).
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data) return null;
    const u = data.users.find((x) => (x.email || "").toLowerCase() === email.toLowerCase());
    if (u) return u.id;
    if (data.users.length < 200) break;
  }
  return null;
}

export async function GET(req: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ ok: false, erro: "Servidor sem ligação." }, { status: 500 });
  }
  const { searchParams } = new URL(req.url);
  const segredo = searchParams.get("secret") || "";
  if (!process.env.CRON_SECRET || segredo !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, erro: "Não autorizado." }, { status: 401 });
  }

  // REGRA PERMANENTE (pós-lançamento): teste só vai para o fundador. Ignoramos
  // qualquer ?email= — nenhum teste pode apontar para outra conta nem para todos.
  const email = ALVO_DEFAULT;
  const uid = await uidPorEmail(email);
  if (!uid) {
    return NextResponse.json({ ok: false, erro: "Conta não encontrada.", email }, { status: 404 });
  }

  let sino = 0;
  let push = 0;
  const erros: string[] = [];
  for (const m of MENSAGENS) {
    try {
      await supabaseAdmin.from("notificacoes").insert({
        user_id: uid,
        tipo: m.tipo,
        titulo: m.titulo,
        corpo: m.corpo,
        link: m.link,
      });
      sino++;
    } catch (e) {
      erros.push("sino: " + String((e as Error)?.message || e));
    }
    try {
      await enviarPushPara([uid], { titulo: m.titulo, corpo: m.corpo, link: m.link });
      push++;
    } catch (e) {
      erros.push("push: " + String((e as Error)?.message || e));
    }
  }

  return NextResponse.json({ ok: true, email, uid, sino, push, erros });
}
