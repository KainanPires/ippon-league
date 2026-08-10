// lib/ligasOficiais.ts
//
// INSCRICAO NAS LIGAS OFICIAIS (Mundial + Continental).
//
// REGRA (decidida com o Kainan):
//   - Quem tem Pro ou Pro Max esta na Liga Mundial e na continental do seu pais.
//   - Quem cancela a renovacao NAO sai nada. Continua a jogar e a pontuar ate
//     ao fim do periodo pago.
//   - Quando o acesso termina mesmo (o /api/subscricoes/expirar rebaixa), sai
//     das ligas oficiais e a pontuacao dele desaparece do ranking.
//
// PORQUE VIVE AQUI E NAO NAS ROTAS:
// O nivel muda em quatro sitios (duas vezes no webhook da Stripe, duas no
// expirar). Se a inscricao fosse copiada para os quatro, mais tarde alguem
// corrigia um e esquecia os outros - foi exatamente assim que a pontuacao
// ficou partida em tres rotas durante dois meses. Uma funcao, um sitio.
//
// NUNCA rebenta o chamador: se algo correr mal aqui, o pagamento e o
// rebaixamento nao podem falhar por causa de uma liga. Falha em silencio.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { continenteDoPais, type Continente } from "@/lib/continentes";

// Nome de cada liga continental na tabela `leagues`.
// NOTA: a Pan-America chama-se "Liga Americas" (plural) e o NOME_CONTINENTE
// diz "America" (singular), por isso nao da para construir o nome a partir
// dele - tem de ser este mapa explicito.
//
// FRAGIL: se alguem renomear uma liga na base de dados, a inscricao para em
// silencio. A correcao definitiva e dar a `leagues` uma coluna `continente`
// com o codigo (EUR/PAN/ASI/AFR/OCE) e passar a casar por ai.
const NOME_LIGA: Record<Continente, string> = {
  EUR: "Liga Europa",
  PAN: "Liga Américas",
  ASI: "Liga Ásia",
  AFR: "Liga África",
  OCE: "Liga Oceânia",
};

/**
 * Poe o utilizador nas ligas oficiais certas, ou tira-o de todas, conforme o
 * nivel que estiver gravado em `public.users` NESTE momento.
 *
 * Chamar SEMPRE depois de escrever is_pro / is_pro_max, nunca antes.
 */
export async function sincronizarLigasOficiais(uid: string): Promise<void> {
  if (!supabaseAdmin || !uid) return;

  try {
    // 1) O nivel e o pais, lidos de public.users (nunca do user_metadata).
    const { data: u } = await supabaseAdmin
      .from("users")
      .select("id, is_pro, is_pro_max, continente, country_code")
      .eq("id", uid)
      .maybeSingle();

    if (!u) return;

    const temAcesso = !!u.is_pro || !!u.is_pro_max;

    // 2) As ligas oficiais que ESTA função gere: a Mundial e as continentais.
    //
    // O filtro pelo `scope` é essencial. A liga da Copa do Dôdo também é
    // type="oficial", e sem este filtro ela entrava na lista de "oficiais" —
    // com o efeito de que o passo 6, ao remover o que não é devido, EXPULSAVA
    // da Copa toda a gente na primeira sincronização depois de um pagamento.
    //
    // A Copa tem scope="privada" e é gerida pelo /api/dodo, por sorteio.
    // Aqui não se lhe toca.
    const { data: oficiais } = await supabaseAdmin
      .from("leagues")
      .select("id, name, scope")
      .eq("type", "oficial")
      .in("scope", ["mundial", "continental"]);

    const todas = oficiais || [];
    if (todas.length === 0) return;

    const idsOficiais = todas.map((l) => String(l.id));

    // 3) Sem acesso -> sai de todas as oficiais. As ligas de amigos ficam.
    if (!temAcesso) {
      await supabaseAdmin
        .from("league_members")
        .delete()
        .eq("user_id", uid)
        .in("league_id", idsOficiais);
      return;
    }

    // 4) Com acesso -> Mundial + continental do pais.
    //    O continente vem da coluna `continente`; se estiver vazia, deriva-se
    //    do country_code pela mesma funcao que o resto da app usa.
    const cont: Continente | null =
      (u.continente as Continente | null) || continenteDoPais(u.country_code as string | null);

    const nomeContinental = cont ? NOME_LIGA[cont] : null;

    const devidas = todas
      .filter((l) => {
        if (String(l.scope) === "mundial") return true;
        if (String(l.scope) === "continental" && nomeContinental) {
          return String(l.name) === nomeContinental;
        }
        return false;
      })
      .map((l) => String(l.id));

    if (devidas.length === 0) return;

    // 5) Quais ja tem? (Em vez de confiar num indice unico que pode nao
    //    existir, verifica-se antes de inserir.)
    const { data: jaTem } = await supabaseAdmin
      .from("league_members")
      .select("league_id")
      .eq("user_id", uid)
      .in("league_id", idsOficiais);

    const atuais = new Set((jaTem || []).map((m) => String(m.league_id)));

    const aInserir = devidas
      .filter((id) => !atuais.has(id))
      .map((league_id) => ({ league_id, user_id: uid }));

    if (aInserir.length > 0) {
      await supabaseAdmin.from("league_members").insert(aInserir);
    }

    // 6) Mudou de pais? Sai da continental errada, sem tocar na mundial.
    const aRemover = Array.from(atuais).filter((id) => !devidas.includes(id));
    if (aRemover.length > 0) {
      await supabaseAdmin
        .from("league_members")
        .delete()
        .eq("user_id", uid)
        .in("league_id", aRemover);
    }
  } catch {
    // Falha em silencio: uma liga nao pode partir um pagamento.
  }
}
