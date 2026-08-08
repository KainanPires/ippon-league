// app/api/stripe/webhook/route.ts
//
// OS AVISOS DA STRIPE — é aqui que o acesso é dado e tirado.
//
// A Stripe chama esta rota sempre que algo acontece a um pagamento ou a uma
// subscrição. É a única peça de toda a integração autorizada a mexer no nível
// de alguém, porque é a única que sabe se o dinheiro entrou mesmo.
//
// Configurar em: Stripe -> Developers -> Webhooks
// Morada: https://www.ipponleague.com/api/stripe/webhook
// Eventos: checkout.session.completed
// customer.subscription.updated
// customer.subscription.deleted
// invoice.payment_succeeded
// invoice.payment_failed
//
// ---------------------------------------------------------------------------
// A ASSINATURA É A FECHADURA
//
// Esta morada é pública. Sem verificar a assinatura, qualquer pessoa que a
// descobrisse podia enviar-lhe um pedido a fingir um pagamento e dar-se Pro Max
// a si própria. A verificação vem primeiro que tudo, e um pedido sem assinatura
// válida é recusado sem sequer ser lido.
//
// Por isso o corpo é lido com req.text() e não req.json(): a Stripe assina os
// bytes exatos que enviou, e qualquer reinterpretação parte a assinatura.
//
// ---------------------------------------------------------------------------
// RESPONDER 200 QUASE SEMPRE
//
// Um erro devolvido faz a Stripe repetir o envio, com espaçamento crescente,
// durante três dias. Isso é bom quando a base de dados esteve em baixo, e mau
// quando o evento simplesmente não nos interessa — ficaríamos a receber o mesmo
// aviso durante três dias por nada.
//
// Regra: 200 para tudo o que foi tratado ou ignorado de propósito; erro só
// quando algo falhou mesmo e vale a pena tentar de novo.
//
// ---------------------------------------------------------------------------
// SÓ A SUBSCRIÇÃO ATUAL MANDA
//
// Os avisos da Stripe não chegam pela ordem em que os acontecimentos ocorreram.
// Quem cancela e volta a subscrever minutos depois gera dois avisos quase ao
// mesmo tempo — "a A foi cancelada" e "a B foi criada" — e eles podem chegar
// trocados.
//
// A primeira versão deste ficheiro lia "cancelamento" e desligava o acesso, sem
// perguntar DE QUAL subscrição. Se o cancelamento da A chegasse depois da
// criação da B, tirava o acesso que a pessoa acabara de pagar.
//
// Agora, antes de mexer no acesso, compara-se: esta subscrição é a que está
// guardada na conta? Se for uma antiga, ignora-se. Um cancelamento de uma
// subscrição que já não é a da pessoa não tem nada a dizer sobre o acesso dela.
//
// A exceção é quando a conta ainda não tem subscrição guardada — aí a que
// chegar é a primeira, e é aceite.
//
// ---------------------------------------------------------------------------
// A FONTE DE VERDADE CONTINUA A SER `users`
//
// Este ficheiro escreve is_pro e is_pro_max, que é o que o resto da app lê. As
// colunas novas (pro_expira_em, renova_automaticamente, cancelado_em) registam
// de onde veio esse acesso e até quando dura — servem o cron e o ecrã do
// perfil, não o controlo de acesso.
// ---------------------------------------------------------------------------
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { nivelDoPreco, stripeFetch, verificarAssinatura, fimDoPeriodo, PRECOS, type Nivel } from "@/lib/stripe";
import { criarNotificacaoServidor } from "@/lib/notificacoesServidor";
import { sincronizarLigasOficiais } from "@/lib/ligasOficiais";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
interface Assinatura {
  id: string;
  status: string;
  customer: string;
  cancel_at_period_end?: boolean;
  current_period_end?: number;
  canceled_at?: number | null;
  items?: { data: { id: string; price?: { id?: string }; current_period_end?: number | null }[] };
  metadata?: Record<string, string>;
}
/** Segundos do Unix para texto ISO, que é o que a coluna timestamptz espera. */
function paraData(seg: number | null | undefined): string | null {
  if (!seg || !Number.isFinite(seg)) return null;
  return new Date(seg * 1000).toISOString();
}
/** Encontra o utilizador pelo cliente da Stripe, ou pelos metadados do evento. */
async function acharUtilizador(customer?: string, metaUserId?: string): Promise<string | null> {
  if (!supabaseAdmin) return null;
  if (metaUserId) return metaUserId;
  if (!customer) return null;
  const { data } = await supabaseAdmin
  .from("users").select("id").eq("stripe_customer_id", customer).maybeSingle();
  return data?.id ? String(data.id) : null;
}
/**
* Grava o estado de uma subscrição na conta.
*
* Um só sítio a decidir o nível a partir do que a Stripe diz — em vez de cada
* evento escrever à sua maneira e as versões divergirem.
*/
async function aplicarSubscricao(sub: Assinatura): Promise<void> {
  if (!supabaseAdmin) return;
  const uid = await acharUtilizador(sub.customer, sub.metadata?.user_id);
  if (!uid) return;
  // --- ESTA SUBSCRIÇÃO AINDA É A DESTA CONTA? ---
  // Ver a nota do topo. Um aviso atrasado de uma subscrição antiga não pode
  // desfazer o que uma mais recente já decidiu.
  const { data: atual } = await supabaseAdmin
  .from("users").select("stripe_subscription_id").eq("id", uid).maybeSingle();
  const guardada = atual?.stripe_subscription_id ? String(atual.stripe_subscription_id) : "";
  if (guardada && guardada !== sub.id) {
    // Há uma subscrição guardada e não é esta. Só se ignora se ESTA já não
    // estiver viva — uma subscrição ativa que não é a guardada significa que
    // algo se perdeu pelo caminho, e aí vale a pena atualizar em vez de ignorar.
    const estaViva = ["active", "trialing", "past_due"].includes(sub.status);
    if (!estaViva) return;
  }
  const priceId = sub.items?.data?.[0]?.price?.id;
  const nivel: Nivel | null = nivelDoPreco(priceId);
  // 'trialing' conta como ativa: a pessoa está a usar os 7 dias e tem acesso.
  const ativa = ["active", "trialing"].includes(sub.status);
  const campos: Record<string, unknown> = {
    stripe_subscription_id: sub.id,
    stripe_customer_id: sub.customer,
    pro_expira_em: paraData(fimDoPeriodo(sub)),
    renova_automaticamente: !sub.cancel_at_period_end,
    cancelado_em: sub.cancel_at_period_end ? (paraData(sub.canceled_at) ?? new Date().toISOString()) : null,
  };
  if (ativa && nivel) {
    // Níveis cumulativos: quem tem Pro Max tem também Pro. É assim que o resto
    // da app já lê o acesso, e mudar isso agora partia meia dúzia de ecrãs.
    campos.is_pro = true;
    campos.is_pro_max = nivel === "promax";
  } else if (!ativa) {
    // Cancelada, expirada, ou por pagar. O acesso sai.
    campos.is_pro = false;
    campos.is_pro_max = false;
  }
  // Se está ativa mas o preço é desconhecido, não se mexe no nível: mais vale
  // deixar como está do que adivinhar e dar o nível errado.
  await supabaseAdmin.from("users").update(campos).eq("id", uid);

  // Ligas oficiais: entra ao ganhar Pro, sai quando o acesso termina.
  // Depois do update, nunca antes - a funcao le o nivel de public.users.
  await sincronizarLigasOficiais(uid);
}
export async function POST(req: Request) {
  // O corpo em bruto, tal como chegou. Nunca req.json() — ver a nota do topo.
  const corpoTexto = await req.text();
  const assinatura = req.headers.get("stripe-signature");
  const valido = await verificarAssinatura(corpoTexto, assinatura, process.env.STRIPE_WEBHOOK_SECRET);
  if (!valido) {
    return NextResponse.json({ erro: "Assinatura inválida." }, { status: 400 });
  }
  if (!supabaseAdmin) {
    // Aqui SIM devolvemos erro: a Stripe repete, e quando a base de dados
    // voltar o evento é processado. Perder um pagamento por uma falha passageira
    // seria bem pior do que uns reenvios.
    return NextResponse.json({ erro: "Servidor sem ligação." }, { status: 500 });
  }
  let evento: { type: string; data: { object: Record<string, unknown> } };
  try {
    evento = JSON.parse(corpoTexto);
  } catch {
    return NextResponse.json({ erro: "Corpo ilegível." }, { status: 400 });
  }
  const obj = evento.data?.object || {};
  try {
    switch (evento.type) {
      // --- Alguém acabou de pagar no ecrã da Stripe ---
      case "checkout.session.completed": {
        const sessao = obj as {
          mode?: string;
          customer?: string;
          subscription?: string;
          client_reference_id?: string;
          metadata?: Record<string, string>;
        };
        const uid = await acharUtilizador(sessao.customer, sessao.metadata?.user_id || sessao.client_reference_id);
        if (!uid) break;
        // Guarda o cliente logo, mesmo antes de saber mais nada: é o fio que
        // liga esta conta à Stripe daqui em diante.
        if (sessao.customer) {
          await supabaseAdmin.from("users")
          .update({ stripe_customer_id: sessao.customer }).eq("id", uid);
        }
        // SUBIDA PARA PRO MAX: pagou os 4,99. Agora troca-se o preço da
        // subscrição. Sem proporcionalidade — a diferença já foi paga aqui, e
        // cobrá-la outra vez seria cobrar duas vezes a mesma coisa.
        if (sessao.mode === "payment" && sessao.metadata?.acao === "subida") {
          const { data: u } = await supabaseAdmin
          .from("users").select("stripe_subscription_id").eq("id", uid).maybeSingle();
          if (u?.stripe_subscription_id) {
            const sub = await stripeFetch<Assinatura>(`subscriptions/${u.stripe_subscription_id}`);
            const itemId = sub.items?.data?.[0]?.id;
            if (itemId) {
              await stripeFetch(`subscriptions/${u.stripe_subscription_id}`, "POST", {
                  items: [{ id: itemId, price: PRECOS.promax }],
                  proration_behavior: "none",
                  metadata: { user_id: uid, nivel: "promax" },
                });
              await supabaseAdmin.from("users").update({ is_pro_max: true }).eq("id", uid);
              await sincronizarLigasOficiais(uid);
            }
          }
          break;
        }
        // SUBSCRIÇÃO NOVA: lê-se a subscrição à Stripe em vez de confiar na
        // sessão. A sessão diz o que foi pedido; a subscrição diz o que ficou.
        if (sessao.subscription) {
          const sub = await stripeFetch<Assinatura>(`subscriptions/${sessao.subscription}`);
          await aplicarSubscricao(sub);
          try {
            const promax = nivelDoPreco(sub.items?.data?.[0]?.price?.id) === "promax";
            await criarNotificacaoServidor({
                paraUserId: uid,
                tipo: "subscricao_ativa",
                titulo: promax ? "Bem-vindo ao Ippon Pro Max" : "Bem-vindo ao Ippon Pro",
                corpo: sub.status === "trialing"
                ? "Os teus 7 dias grátis começaram agora. Tens acesso a tudo desde já, e só és cobrado no fim do período de teste. Podes cancelar quando quiseres."
                : "A tua subscrição está ativa. Bom proveito — e boa sorte nas próximas rodadas.",
                link: "/perfil",
              });
          } catch { /* o acesso está dado; o aviso é um extra */ }
        }
        break;
      }
      // --- Mudou alguma coisa: nível, cancelamento agendado, renovação ---
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await aplicarSubscricao(obj as unknown as Assinatura);
        break;
      }
      // --- Renovou e pagou: estende o acesso ---
      case "invoice.payment_succeeded": {
        const fatura = obj as { subscription?: string };
        if (fatura.subscription) {
          const sub = await stripeFetch<Assinatura>(`subscriptions/${fatura.subscription}`);
          await aplicarSubscricao(sub);
        }
        break;
      }
      // --- O cartão falhou ---
      // NÃO se tira o acesso aqui. A Stripe volta a tentar durante dias, e a
      // maior parte destas falhas resolve-se sozinha — cartão expirado,
      // saldo momentâneo. Tirar o Pro à primeira falha castiga quem já pagou
      // meses a fio por um problema que se resolve em 48 horas. Quando as
      // tentativas se esgotarem, a Stripe cancela e o evento de cancelamento
      // trata do resto.
      case "invoice.payment_failed": {
        const fatura = obj as { customer?: string };
        const uid = await acharUtilizador(fatura.customer);
        if (uid) {
          try {
            await criarNotificacaoServidor({
                paraUserId: uid,
                tipo: "pagamento_falhou",
                titulo: "Não conseguimos cobrar a tua subscrição",
                corpo: "O pagamento não passou. Continuas com acesso e vamos tentar outra vez nos próximos dias. Se o cartão mudou, podes atualizá-lo no teu perfil.",
                link: "/perfil",
              });
          } catch { /* idem */ }
        }
        break;
      }
      default:
      // Evento que não nos interessa. 200 na mesma, senão a Stripe repetia-o
      // durante três dias por nada.
      break;
    }
  } catch (e) {
    // Falhou a processar um evento que nos interessa: erro, para a Stripe
    // repetir. É preferível processar duas vezes a perder um pagamento — todas
    // as operações aqui são de escrita idempotente, e repetir não faz mal.
    console.error("[stripe/webhook]", evento.type, e);
    return NextResponse.json({ erro: "Falha a processar." }, { status: 500 });
  }
  return NextResponse.json({ recebido: true });
}
