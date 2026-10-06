// lib/reengajarEmail.ts
//
// EMAIL DE REENGAJAMENTO na véspera do fecho do mercado — SÓ SERVIDOR.
//
// A quem NÃO montou equipa para a competição-alvo, um email a puxá-lo de volta
// a montar antes do fecho. Decisão do Kainan: vai para TODOS os que não
// montaram (verificados ou não). Complementa o push de véspera (que vai só para
// quem JÁ montou, a lembrar de ajustar).
//
// Renderiza na língua de cada um (users.lingua) e envia individualmente (cada
// pessoa recebe o seu email, nunca uma lista partilhada). Chamado UMA vez por
// competição (a idempotência é do lado de quem chama — a reserva da véspera).
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { renderNotif, type LinguaNotif } from "@/lib/dicionarioNotif";
import { enviarEmailResend, emailHtmlBase, escHtml } from "@/lib/email";

const SITE = "https://www.ipponleague.com";

function normLingua(v: unknown): LinguaNotif {
  const s = String(v || "").toLowerCase();
  return (["pt", "en", "es", "fr", "de", "ja", "ru"].includes(s) ? s : "pt") as LinguaNotif;
}

/**
 * Envia o email de reengajamento a todos os utilizadores que NÃO estão em
 * `montaramIds` (os que não montaram para `idComp`). Devolve quantos foram
 * enviados. `nomeComp` e `tempo` são texto controlado (calendário/contagem),
 * por isso não se escapam; só o NOME do utilizador é escapado.
 */
export async function reengajarNaoMontaram(
  idComp: string,
  nomeComp: string,
  tempo: string,
  montaramIds: string[],
): Promise<number> {
  if (!supabaseAdmin) return 0;
  const montou = new Set(montaramIds.map(String));
  const { data } = await supabaseAdmin.from("users").select("id, email, name, lingua");
  const alvo = (data || []).filter((u) => u.email && !montou.has(String(u.id)));
  if (alvo.length === 0) return 0;

  const link = `${SITE}/criar-equipa`;
  let enviados = 0;
  for (const u of alvo) {
    const lingua = normLingua(u.lingua);
    const primeiroNome = String(u.name || "").trim().split(" ")[0] || renderNotif(lingua, "email.confirmarFallbackNome");
    const html = emailHtmlBase({
      saudacao: renderNotif(lingua, "email.confirmarSaudacao", { nome: escHtml(primeiroNome) }),
      corpo: renderNotif(lingua, "email.reengajarIntro", { comp: nomeComp, tempo }),
      botaoTexto: renderNotif(lingua, "email.reengajarBotao"),
      botaoLink: link,
      notas: [renderNotif(lingua, "email.reengajarRodape")],
      naoResponder: renderNotif(lingua, "email.naoResponder"),
    });
    const assunto = renderNotif(lingua, "email.reengajarAssunto", { comp: nomeComp });
    const r = await enviarEmailResend({
      to: String(u.email),
      subject: assunto,
      html,
      tags: { tipo: "reengajar", user_id: String(u.id) },
    });
    if (r.ok) enviados++;
  }
  return enviados;
}
