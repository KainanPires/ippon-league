// lib/notificarMercado.ts
//
// Notificações de MERCADO (Grupo B), chamadas pelo cron 1x/dia.
//  - ABERTO: uma vez por competição, a todos, a convidar a montar (com prazo).
//  - VÉSPERA DO FECHO: uma vez por competição, SÓ a quem JÁ montou, a lembrar
//    que ainda dá para conferir/ajustar a equipa antes de fechar (~1 dia antes).
//  - FECHADO: uma vez por competição, personalizado — quem montou ("está em
//    jogo") vs quem não montou ("ficaste de fora, prepara a próxima").
//
// Idempotente via `eventos_notificados`: o cron corre todos os dias, mas cada
// aviso sai UMA vez por competição. USAR APENAS NO SERVIDOR.
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { enviarPushPara } from "@/lib/pushServer";
import { focoMercado, estadoMercado, textoFecho, formatarContagem } from "@/lib/calendario";

// Janela do lembrete de véspera: dispara quando falta ISTO ou menos para o
// fecho (e ainda há tempo > 0). 28h (e não 24h) dá folga: como o cron corre
// 1x/dia, garante que apanhamos o dia anterior mesmo que a hora do cron e a
// hora do fecho não estejam perfeitamente alinhadas.
const VESPERA_MS = 28 * 60 * 60 * 1000;

// Reserva um evento (idempotência). true = ainda não tinha sido notificado.
async function reservarEvento(chave: string): Promise<boolean> {
  if (!supabaseAdmin) return false;
  try {
    const { error } = await supabaseAdmin.from("eventos_notificados").insert({ chave });
    return !error; // erro = chave já existia = já notificado
  } catch {
    return false;
  }
}

// Todos os utilizadores registados (ids).
async function todosOsUtilizadores(): Promise<string[]> {
  if (!supabaseAdmin) return [];
  const { data } = await supabaseAdmin.from("users").select("id");
  return (data || []).map((u) => String(u.id)).filter(Boolean);
}

// Utilizadores que montaram equipa para uma competição (ids únicos).
async function quemMontou(idComp: string): Promise<string[]> {
  if (!supabaseAdmin) return [];
  const { data } = await supabaseAdmin.from("equipas").select("user_id").eq("id_competicao", idComp);
  return [...new Set((data || []).map((e) => String(e.user_id)).filter(Boolean))];
}

// Notifica muitos utilizadores de uma vez (sino em massa + push em massa).
async function notificarMuitos(
  userIds: string[],
  n: { tipo: string; titulo: string; corpo?: string; link?: string }
): Promise<void> {
  if (!supabaseAdmin) return;
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return;
  try {
    const linhas = ids.map((user_id) => ({
      user_id,
      tipo: n.tipo,
      titulo: n.titulo,
      corpo: n.corpo ?? null,
      link: n.link ?? null,
    }));
    await supabaseAdmin.from("notificacoes").insert(linhas);
  } catch {}
  try {
    await enviarPushPara(ids, { titulo: n.titulo, corpo: n.corpo, link: n.link });
  } catch {}
}

/**
 * Verifica o estado do mercado e envia as notificações de aberto/véspera/fechado.
 * Idempotente: cada aviso sai uma vez por competição.
 */
export async function notificarMercado(hoje: Date = new Date()): Promise<{ aberto: string | null; vespera: string | null; fechado: string | null }> {
  if (!supabaseAdmin) return { aberto: null, vespera: null, fechado: null };
  const foco = focoMercado(hoje);
  let aberto: string | null = null;
  let vespera: string | null = null;
  let fechado: string | null = null;

  // --- MERCADO ABERTO (competição alvo) ---
  // REGRA: o mercado da PRÓXIMA competição só "abre" depois de a competição que
  // está a decorrer terminar. Enquanto houver uma competição a decorrer
  // (foco.aDecorrer), NÃO anunciamos o mercado aberto da seguinte — senão sai
  // cedo demais (ex.: anunciar o Qingdao enquanto o Ulaanbaatar ainda joga).
  // A verificação do aDecorrer vem ANTES da reserva do evento, para não "queimar"
  // a chave: assim, quando a competição atual terminar, o anúncio ainda pode sair.
  if (foco.alvo && !foco.aDecorrer && estadoMercado(foco.alvo, hoje).estado === "aberto") {
    if (await reservarEvento(`mercado_aberto:${foco.alvo.idCompeticao}`)) {
      const ids = await todosOsUtilizadores();
      const prazo = textoFecho(foco.alvo, hoje); // ex.: "Mercado fecha em 3 dias"
      await notificarMuitos(ids, {
        tipo: "mercado",
        titulo: `🥋 Mercado aberto: ${foco.alvo.nome}`,
        corpo: `Já podes montar a tua equipa para o ${foco.alvo.nome}. ${prazo} — escala os teus 8 atletas e o capitão antes de fechar!`,
        link: "/inicio",
      });
      aberto = foco.alvo.idCompeticao;
    }
  }

  // --- VÉSPERA DO FECHO (competição alvo, mercado ainda aberto) ---
  // Dispara quando falta ~1 dia para o mercado fechar e SÓ para quem JÁ montou —
  // um empurrão para conferir/ajustar a equipa antes do fecho. Quem ainda não
  // montou NÃO recebe este (a regra pedida foi só para quem montou). Uma vez por
  // competição (chave mercado_vespera:<id>).
  // Também aqui só faz sentido se NÃO houver competição a decorrer (a véspera é
  // do fecho do mercado da próxima — não enquanto outra ainda joga).
  if (foco.alvo && !foco.aDecorrer) {
    const est = estadoMercado(foco.alvo, hoje);
    // "Falta cerca de 1 dia": com hora oficial usamos msAteFecho; sem hora,
    // calculamos os ms até à meia-noite do dia de início (quando o mercado fecha).
    let msAteFecho: number | null = est.msAteFecho;
    if (msAteFecho === null) {
      const inicioDia = new Date(foco.alvo.de.replace(/\//g, "-") + "T00:00:00").getTime();
      msAteFecho = inicioDia - hoje.getTime();
    }
    const naJanela = msAteFecho !== null && msAteFecho > 0 && msAteFecho <= VESPERA_MS;
    if (naJanela && (await reservarEvento(`mercado_vespera:${foco.alvo.idCompeticao}`))) {
      const montaram = await quemMontou(foco.alvo.idCompeticao);
      if (montaram.length > 0) {
        const restante = formatarContagem(msAteFecho); // ex.: "23h 10min" ou "1d 0h"
        await notificarMuitos(montaram, {
          tipo: "mercado",
          titulo: `⏰ Última chance para ajustar: ${foco.alvo.nome}`,
          corpo: `O mercado do ${foco.alvo.nome} fecha em ${restante}. Ainda dá para trocar atletas ou mudar o capitão — confere a tua equipa antes de fechar!`,
          link: "/meu-time",
        });
      }
      vespera = foco.alvo.idCompeticao;
    }
  }

  // --- MERCADO FECHADO (competição a decorrer) ---
  if (foco.aDecorrer && (await reservarEvento(`mercado_fechado:${foco.aDecorrer.idCompeticao}`))) {
    const comp = foco.aDecorrer;
    const montaram = await quemMontou(comp.idCompeticao);
    const setMont = new Set(montaram);
    const todos = await todosOsUtilizadores();
    const naoMontaram = todos.filter((id) => !setMont.has(id));

    // Quem montou: a equipa está em jogo.
    await notificarMuitos(montaram, {
      tipo: "mercado",
      titulo: `Mercado fechado: ${comp.nome} vai começar`,
      corpo: `A tua equipa está escalada e em jogo no ${comp.nome}. Boa sorte! Acompanha a pontuação ao vivo.`,
      link: "/meu-time",
    });

    // Quem não montou: ficou de fora — incentivo para a próxima.
    await notificarMuitos(naoMontaram, {
      tipo: "mercado",
      titulo: `Mercado fechado: ${comp.nome}`,
      corpo: `O mercado fechou e não montaste equipa para o ${comp.nome}. Ficaste de fora desta rodada — prepara-te para a próxima!`,
      link: "/inicio",
    });

    fechado = comp.idCompeticao;
  }

  return { aberto, vespera, fechado };
}
