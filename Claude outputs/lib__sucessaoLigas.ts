// lib/sucessaoLigas.ts
//
// SUCESSÃO DE ADMIN (o "bastão") E FECHO DE LIGAS quando o dono perde o Pro.
// USAR APENAS NO SERVIDOR (supabaseAdmin). Tudo best-effort: nunca rebenta o
// chamador (pagamento/rebaixamento/saída não podem falhar por causa de uma liga).
//
// REGRA (decidida com o Kainan, 01/10/2026):
//   - Os limites mantêm-se (grátis 1 liga + 1 copa). Concluídas não contam.
//   - Quando um dono perde o Pro e fica acima do limite, as ligas EXCEDENTES que
//     ele criou: passam o bastão a um MEMBRO Pro (se vários e o dono não escolheu,
//     sorteio); se NÃO houver nenhum Pro, a liga é APAGADA (abertas e privadas).
//   - Uma liga já TERMINADA fica no histórico e não conta — nunca se lhe toca.
//   - A liga que passa o bastão continua de onde parou (pontos/histórico intactos).
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { criarNotificacaoServidor } from "@/lib/notificacoesServidor";
import { LIMITES } from "@/lib/planos";

type LigaRow = {
  id: string; name?: unknown; formato?: unknown; estado?: unknown;
  copa_estado?: unknown; created_by?: unknown; scope?: unknown;
};

/** A liga já terminou? (mesma regra do resto da app) */
function terminada(l: LigaRow): boolean {
  if (String(l.formato) === "copa") return String(l.copa_estado) === "terminada";
  return String(l.estado) === "terminada";
}

/** IDs dos membros Pro de uma liga, excluindo `excluir` (quem está a sair). */
async function membrosProDaLiga(leagueId: string, excluir: string): Promise<string[]> {
  if (!supabaseAdmin) return [];
  const { data: membros } = await supabaseAdmin
    .from("league_members").select("user_id").eq("league_id", leagueId);
  const ids = (membros || []).map((m) => String(m.user_id)).filter((id) => id && id !== excluir);
  if (ids.length === 0) return [];
  const { data: users } = await supabaseAdmin
    .from("users").select("id, is_pro, is_pro_max").in("id", ids);
  return (users || [])
    .filter((u) => u.is_pro || u.is_pro_max)
    .map((u) => String(u.id));
}

/** Apaga uma liga por completo. Nunca uma terminada (essa fica no histórico). */
async function apagarLiga(leagueId: string): Promise<void> {
  if (!supabaseAdmin) return;
  // Avisa os membros ANTES de apagar (depois já não há a quem perguntar).
  try {
    const { data: liga } = await supabaseAdmin.from("leagues").select("name").eq("id", leagueId).maybeSingle();
    const nome = liga?.name ? String(liga.name) : "";
    const { data: membros } = await supabaseAdmin.from("league_members").select("user_id").eq("league_id", leagueId);
    for (const m of membros || []) {
      try {
        await criarNotificacaoServidor({
          paraUserId: String(m.user_id),
          tipo: "liga_encerrada",
          chaveTitulo: "liga.encerradaSemProTitulo",
          chaveCorpo: "liga.encerradaSemProCorpo",
          vars: { liga: nome },
          link: "/ligas",
        });
      } catch { /* aviso é extra */ }
    }
  } catch { /* se falhar o aviso, apaga na mesma */ }
  // Ordem: confrontos -> pedidos -> membros -> a liga (mesma do reset manual).
  for (const passo of [
    () => supabaseAdmin!.from("copa_confrontos").delete().eq("league_id", leagueId),
    () => supabaseAdmin!.from("league_requests").delete().eq("league_id", leagueId),
    () => supabaseAdmin!.from("league_members").delete().eq("league_id", leagueId),
    () => supabaseAdmin!.from("leagues").delete().eq("id", leagueId),
  ]) {
    try { await passo(); } catch { /* best-effort: segue para o próximo passo */ }
  }
}

/** Passa o bastão a `novoAdmin` e avisa-o. */
async function passarBastao(leagueId: string, nome: string, novoAdmin: string): Promise<void> {
  if (!supabaseAdmin) return;
  await supabaseAdmin.from("leagues").update({ created_by: novoAdmin }).eq("id", leagueId);
  try {
    await criarNotificacaoServidor({
      paraUserId: novoAdmin,
      tipo: "liga_bastao",
      chaveTitulo: "liga.bastaoRecebidoTitulo",
      chaveCorpo: "liga.bastaoRecebidoCorpo",
      vars: { liga: nome },
      link: "/ligas",
    });
  } catch { /* aviso é extra */ }
}

/**
 * Garante que uma liga tem um admin Pro válido, ou apaga-a.
 * Chamar quando o dono vai sair/perder o acesso a esta liga.
 *   - terminada -> não toca (histórico).
 *   - há membro(s) Pro (excluindo quem sai) -> passa o bastão (preferido, senão sorteio).
 *   - nenhum Pro -> apaga a liga.
 * `saindoUid` é o dono que está a perder a liga (excluído dos candidatos).
 */
export async function sucederOuApagarLiga(
  leagueId: string,
  opts: { saindoUid: string; preferido?: string } = { saindoUid: "" },
): Promise<{ resultado: "transferida" | "apagada" | "mantida"; novoAdmin?: string }> {
  if (!supabaseAdmin || !leagueId) return { resultado: "mantida" };
  try {
    const { data: liga } = await supabaseAdmin
      .from("leagues")
      .select("id, name, formato, estado, copa_estado, created_by, scope, type")
      .eq("id", leagueId)
      .maybeSingle();
    if (!liga) return { resultado: "mantida" };
    if (String(liga.type) !== "amigos") return { resultado: "mantida" }; // oficiais não se gerem aqui
    if (terminada(liga as LigaRow)) return { resultado: "mantida" }; // concluída: fica no histórico

    const nome = liga.name ? String(liga.name) : "";
    const pros = await membrosProDaLiga(leagueId, opts.saindoUid);

    if (pros.length === 0) {
      await apagarLiga(leagueId);
      return { resultado: "apagada" };
    }

    // Escolhe o sucessor: o preferido (se for Pro e membro), senão sorteio.
    let novo = opts.preferido && pros.includes(opts.preferido) ? opts.preferido : null;
    if (!novo) novo = pros[Math.floor(Math.random() * pros.length)];
    await passarBastao(leagueId, nome, novo);
    return { resultado: "transferida", novoAdmin: novo };
  } catch {
    return { resultado: "mantida" };
  }
}

/**
 * No momento em que um utilizador perde MESMO o acesso Pro: resolve as ligas de
 * amigos ATIVAS que ele CRIOU e que ficam acima do limite gratuito. Mantém, por
 * formato, as `LIMITES.gratis` com mais membros (as mais valiosas); as restantes
 * passam o bastão a um membro Pro (sorteio) ou são apagadas (sem Pro).
 * Best-effort: nunca rebenta o webhook/cron de pagamento.
 */
export async function resolverLigasAoPerderPro(uid: string): Promise<void> {
  if (!supabaseAdmin || !uid) return;
  try {
    // Só age se o utilizador está MESMO sem acesso agora (lê da tabela users).
    const { data: u } = await supabaseAdmin
      .from("users").select("is_pro, is_pro_max").eq("id", uid).maybeSingle();
    if (u?.is_pro || u?.is_pro_max) return; // ainda tem acesso: nada a fazer

    // Ligas de amigos ATIVAS que ele criou.
    const { data: ligas } = await supabaseAdmin
      .from("leagues")
      .select("id, name, formato, estado, copa_estado, created_by, type")
      .eq("type", "amigos")
      .eq("created_by", uid);
    const ativas = (ligas || []).filter((l) => !terminada(l as LigaRow));
    if (ativas.length === 0) return;

    // Contagem de membros por liga (para manter as mais valiosas).
    const comContagem: { id: string; formato: string; membros: number }[] = [];
    for (const l of ativas) {
      const { count } = await supabaseAdmin
        .from("league_members").select("id", { count: "exact", head: true }).eq("league_id", String(l.id));
      comContagem.push({ id: String(l.id), formato: String(l.formato), membros: count ?? 0 });
    }

    // Por formato, mantém as LIMITES.gratis com mais membros; o resto é excedente.
    for (const formato of ["pontos", "copa"] as const) {
      const doFormato = comContagem
        .filter((l) => (formato === "copa" ? l.formato === "copa" : l.formato !== "copa"))
        .sort((a, b) => b.membros - a.membros);
      const teto = LIMITES.gratis[formato];
      const excedente = doFormato.slice(teto); // acima do limite gratuito
      for (const l of excedente) {
        // O dono sai desta liga (deixa de ser membro) e corre a sucessão.
        try { await supabaseAdmin.from("league_members").delete().eq("league_id", l.id).eq("user_id", uid); } catch {}
        await sucederOuApagarLiga(l.id, { saindoUid: uid });
      }
    }
  } catch {
    /* best-effort */
  }
}
