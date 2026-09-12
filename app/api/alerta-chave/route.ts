// app/api/alerta-chave/route.ts
//
// ALERTA "O TEU ATLETA É O PRÓXIMO A LUTAR" — chamado por um cron externo
// (cron-job.org) a cada 1-3 min. Leve: fora de competição sai logo.
//
// Como funciona, a cada disparo:
//   1) Confirma a key (mesmo segredo do URL no cron-job.org).
//   2) focoMercado().aDecorrer — há competição a decorrer? Se não, sai (custo ~0).
//   3) Lê os favoritos (atletas_favoritos): que id_person são seguidos e por quem.
//   4) Para cada categoria, lê a chave pela biblioteca montarChaveDaBase (a
//      MESMA verdade que a página mostra, direto da base — sem passar pela API
//      nem furar o Paywall), e calcula a PRÓXIMA luta de cada bloco.
//   5) Se um lado dessa próxima luta é um atleta seguido, avisa os seguidores —
//      exceto os já avisados sobre essa luta (alertas_enviados, anti-repetição).
//
// O push sai por criarNotificacaoServidor (sino + push) — a MESMA via dos
// aniversários, que já chega ao telemóvel.
//
// Proteção: ?key=<CRON_SECRET ou segredo do URL>. Sem isso, 401.
//
// ---------------------------------------------------------------------------
// SÓ PRO MAX É AVISADO
//
// Favoritar um atleta é GRÁTIS: a estrela também serve para filtrar no Mercado,
// e fechá-la tiraria uma comodidade a toda a gente sem vender nada. O que é pago
// é o AVISO — saber que o teu atleta entra no tatame a seguir.
//
// Quem favoritou sem ser Pro Max continua a ver a estrela e a filtrar por ela;
// só não recebe a notificação. É um funil natural: a pessoa já demonstrou
// interesse naquele atleta, e é aí que o convite ao Pro Max faz sentido.
//
// O filtro está AQUI, no servidor, e não na página: é o único sítio onde não
// pode ser contornado.
// ---------------------------------------------------------------------------
import { NextResponse } from "next/server";
import { focoMercado, nomeCompeticao } from "@/lib/calendario";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { criarNotificacaoServidor } from "@/lib/notificacoesServidor";
import { montarChaveDaBase } from "@/lib/montarChave";
import { linguasDeVarios, type LinguaNotif } from "@/lib/i18nServidor";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;
// As 14 categorias do judô (campo `weight` do JudoBase). Fixas e universais.
const CATS = ["-60", "-66", "-73", "-81", "-90", "-100", "+100", "-48", "-52", "-57", "-63", "-70", "-78", "+78"];
// Segredo aceite por ?key=. Usa CRON_SECRET; se quiseres um segredo próprio para
// este cron, define LEMBRETE_CRON_SECRET no ambiente — qualquer um dos dois serve.
function autorizado(key: string | null): boolean {
  const a = process.env.CRON_SECRET;
  const b = process.env.LEMBRETE_CRON_SECRET;
  if (!key) return false;
  return (!!a && key === a) || (!!b && key === b);
}
// --- Tipos mínimos da chave que a biblioteca devolve (só o que usamos) ---
// (a estrutura vem de motorChave via montarChaveDaBase)
interface LadoChave { id: string | null; nome?: string; pais?: string }
interface LutaChave { chaveId?: string; azul: LadoChave; branco: LadoChave; vencedor: string | null }
interface ChaveNova {
  pools: Record<string, { lutas: LutaChave[] }>;
  meias: LutaChave[];
  final: LutaChave | null;
  repescagens: LutaChave[];
  bronzes: LutaChave[];
}
// Vista RICA da mesma chave: a biblioteca devolve mais do que o ChaveNova usa —
// estado por luta, ações por lado (para o MÉTODO da vitória) e os medalhados.
interface AcoesLado { i: number; w: number; y: number; s: number }
interface LadoRico { id: string | null; nome?: string; pais?: string; acoes?: AcoesLado }
interface LutaRica { chaveId?: string; azul: LadoRico; branco: LadoRico; vencedor: string | null; estado?: string }
interface ChaveRica {
  pools: Record<string, { lutas: LutaRica[] }>;
  meias: LutaRica[];
  final: LutaRica | null;
  repescagens: LutaRica[];
  bronzes: LutaRica[];
  campeao?: string | null;
  vice?: string | null;
  terceiros?: string[];
}
// Sobrenome em maiúsculas do JudoBase (ex.: "LIMA"), com recurso à 1ª palavra.
function apelido(n: string): string {
  return (n || "").trim().split(/\s+/).filter((w) => w.length > 1 && w === w.toUpperCase())[0] || (n || "").split(/\s+/)[0] || "o teu atleta";
}
// Adversário como "Sobrenome (PAÍS)" — sem parênteses se não houver país.
function advTxt(l?: LadoRico): string {
  const nome = apelido(l?.nome || "");
  const pais = (l?.pais || "").trim();
  return pais ? `${nome} (${pais})` : nome;
}
// TEXTOS DAS NOTIFICAÇÕES DE FAVORITOS, nas 5 línguas.
// Render por LÍNGUA DE QUEM RECEBE (linguasDeVarios). Os termos de judô (ippon,
// waza-ári, yuko) NÃO se traduzem — só o conector e a estrutura da frase. O
// adversário "SOBRENOME (PAÍS)" e o nome da competição são iguais em todas.
interface TxtNotif {
  metodo: (ac?: AcoesLado) => string; // " por ippon" (com espaço à frente) ou ""
  proxTitulo: (a: string) => string;
  proxCorpo: (comp: string, a: string) => string;
  venceuTitulo: (a: string) => string;
  venceuCorpo: (comp: string, a: string, adv: string, met: string) => string;
  perdeuTitulo: (a: string) => string;
  perdeuCorpo: (comp: string, a: string, adv: string, met: string) => string;
  bronzeTitulo: (a: string) => string;
  bronzeCom: (comp: string, a: string, adv: string) => string;
  bronzeSem: (comp: string, a: string) => string;
  finalTitulo: (a: string) => string;
  finalCom: (comp: string, a: string, adv: string) => string;
  finalSem: (comp: string, a: string) => string;
  ouroTitulo: (a: string) => string;   ouroCorpo: (comp: string, a: string, cat: string) => string;
  prataTitulo: (a: string) => string;  prataCorpo: (comp: string, a: string, cat: string) => string;
  bronzeMedTitulo: (a: string) => string; bronzeMedCorpo: (comp: string, a: string, cat: string) => string;
}
const TXT: Record<LinguaNotif, TxtNotif> = {
  pt: {
    metodo: (ac) => !ac ? "" : ac.i > 0 ? " por ippon" : ac.w >= 2 ? " por dois waza-áris" : ac.w === 1 ? " por waza-ári" : ac.y > 0 ? " por yuko" : "",
    proxTitulo: (a) => `🥋 ${a} é já a seguir!`,
    proxCorpo: (comp, a) => `Em ${comp}, ${a} é a próxima luta no seu bloco. Fica atento — vai entrar no tatame.`,
    venceuTitulo: (a) => `🥋 ${a} venceu e avança`,
    venceuCorpo: (comp, a, adv, met) => `Em ${comp}, ${a} venceu ${adv}${met} e avança.`,
    perdeuTitulo: (a) => `🥋 ${a} perdeu`,
    perdeuCorpo: (comp, a, adv, met) => `Em ${comp}, ${a} perdeu para ${adv}${met}.`,
    bronzeTitulo: (a) => `🥋 ${a} vai ao bronze`,
    bronzeCom: (comp, a, adv) => `Em ${comp}, ${a} vai lutar pelo bronze com ${adv}.`,
    bronzeSem: (comp, a) => `Em ${comp}, ${a} vai lutar pelo bronze.`,
    finalTitulo: (a) => `🥋 ${a} está na final!`,
    finalCom: (comp, a, adv) => `Em ${comp}, ${a} está na final, contra ${adv}!`,
    finalSem: (comp, a) => `Em ${comp}, ${a} está na final!`,
    ouroTitulo: (a) => `🥇 ${a} é campeão!`,       ouroCorpo: (comp, a, cat) => `Em ${comp}, ${a} é campeão em ${cat} kg.`,
    prataTitulo: (a) => `🥈 ${a} é vice-campeão!`,  prataCorpo: (comp, a, cat) => `Em ${comp}, ${a} é vice-campeão (prata) em ${cat} kg.`,
    bronzeMedTitulo: (a) => `🥉 ${a} é bronze!`,    bronzeMedCorpo: (comp, a, cat) => `Em ${comp}, ${a} fica com o bronze em ${cat} kg.`,
  },
  en: {
    metodo: (ac) => !ac ? "" : ac.i > 0 ? " by ippon" : ac.w >= 2 ? " by two waza-ari" : ac.w === 1 ? " by waza-ari" : ac.y > 0 ? " by yuko" : "",
    proxTitulo: (a) => `🥋 ${a} is up next!`,
    proxCorpo: (comp, a) => `At ${comp}, ${a} is up next in their block. Stay tuned — stepping onto the mat.`,
    venceuTitulo: (a) => `🥋 ${a} won and advances`,
    venceuCorpo: (comp, a, adv, met) => `At ${comp}, ${a} beat ${adv}${met} and advances.`,
    perdeuTitulo: (a) => `🥋 ${a} lost`,
    perdeuCorpo: (comp, a, adv, met) => `At ${comp}, ${a} lost to ${adv}${met}.`,
    bronzeTitulo: (a) => `🥋 ${a} fights for bronze`,
    bronzeCom: (comp, a, adv) => `At ${comp}, ${a} will fight for bronze against ${adv}.`,
    bronzeSem: (comp, a) => `At ${comp}, ${a} will fight for bronze.`,
    finalTitulo: (a) => `🥋 ${a} is in the final!`,
    finalCom: (comp, a, adv) => `At ${comp}, ${a} is in the final, against ${adv}!`,
    finalSem: (comp, a) => `At ${comp}, ${a} is in the final!`,
    ouroTitulo: (a) => `🥇 ${a} is the champion!`,     ouroCorpo: (comp, a, cat) => `At ${comp}, ${a} is the champion in ${cat} kg.`,
    prataTitulo: (a) => `🥈 ${a} takes silver!`,        prataCorpo: (comp, a, cat) => `At ${comp}, ${a} is runner-up (silver) in ${cat} kg.`,
    bronzeMedTitulo: (a) => `🥉 ${a} takes bronze!`,    bronzeMedCorpo: (comp, a, cat) => `At ${comp}, ${a} takes bronze in ${cat} kg.`,
  },
  es: {
    metodo: (ac) => !ac ? "" : ac.i > 0 ? " por ippon" : ac.w >= 2 ? " por dos waza-ari" : ac.w === 1 ? " por waza-ari" : ac.y > 0 ? " por yuko" : "",
    proxTitulo: (a) => `🥋 ¡${a} es el siguiente!`,
    proxCorpo: (comp, a) => `En ${comp}, ${a} es el próximo combate de su bloque. Atento — sube al tatami.`,
    venceuTitulo: (a) => `🥋 ${a} venció y avanza`,
    venceuCorpo: (comp, a, adv, met) => `En ${comp}, ${a} venció a ${adv}${met} y avanza.`,
    perdeuTitulo: (a) => `🥋 ${a} perdió`,
    perdeuCorpo: (comp, a, adv, met) => `En ${comp}, ${a} perdió ante ${adv}${met}.`,
    bronzeTitulo: (a) => `🥋 ${a} pelea por el bronce`,
    bronzeCom: (comp, a, adv) => `En ${comp}, ${a} peleará por el bronce contra ${adv}.`,
    bronzeSem: (comp, a) => `En ${comp}, ${a} peleará por el bronce.`,
    finalTitulo: (a) => `🥋 ¡${a} está en la final!`,
    finalCom: (comp, a, adv) => `En ${comp}, ${a} está en la final, contra ${adv}!`,
    finalSem: (comp, a) => `En ${comp}, ${a} está en la final!`,
    ouroTitulo: (a) => `🥇 ¡${a} es campeón!`,       ouroCorpo: (comp, a, cat) => `En ${comp}, ${a} es campeón en ${cat} kg.`,
    prataTitulo: (a) => `🥈 ¡${a} es subcampeón!`,   prataCorpo: (comp, a, cat) => `En ${comp}, ${a} es subcampeón (plata) en ${cat} kg.`,
    bronzeMedTitulo: (a) => `🥉 ¡${a} es bronce!`,    bronzeMedCorpo: (comp, a, cat) => `En ${comp}, ${a} se lleva el bronce en ${cat} kg.`,
  },
  fr: {
    metodo: (ac) => !ac ? "" : ac.i > 0 ? " par ippon" : ac.w >= 2 ? " par deux waza-ari" : ac.w === 1 ? " par waza-ari" : ac.y > 0 ? " par yuko" : "",
    proxTitulo: (a) => `🥋 ${a} arrive !`,
    proxCorpo: (comp, a) => `À ${comp}, ${a} est le prochain combat de son bloc. Reste attentif — il entre sur le tatami.`,
    venceuTitulo: (a) => `🥋 ${a} gagne et avance`,
    venceuCorpo: (comp, a, adv, met) => `À ${comp}, ${a} a battu ${adv}${met} et avance.`,
    perdeuTitulo: (a) => `🥋 ${a} a perdu`,
    perdeuCorpo: (comp, a, adv, met) => `À ${comp}, ${a} a perdu contre ${adv}${met}.`,
    bronzeTitulo: (a) => `🥋 ${a} pour le bronze`,
    bronzeCom: (comp, a, adv) => `À ${comp}, ${a} disputera le bronze contre ${adv}.`,
    bronzeSem: (comp, a) => `À ${comp}, ${a} disputera le bronze.`,
    finalTitulo: (a) => `🥋 ${a} est en finale !`,
    finalCom: (comp, a, adv) => `À ${comp}, ${a} est en finale, contre ${adv} !`,
    finalSem: (comp, a) => `À ${comp}, ${a} est en finale !`,
    ouroTitulo: (a) => `🥇 ${a} est champion !`,       ouroCorpo: (comp, a, cat) => `À ${comp}, ${a} est champion en ${cat} kg.`,
    prataTitulo: (a) => `🥈 ${a} est vice-champion !`,  prataCorpo: (comp, a, cat) => `À ${comp}, ${a} est vice-champion (argent) en ${cat} kg.`,
    bronzeMedTitulo: (a) => `🥉 ${a} en bronze !`,      bronzeMedCorpo: (comp, a, cat) => `À ${comp}, ${a} décroche le bronze en ${cat} kg.`,
  },
  de: {
    metodo: (ac) => !ac ? "" : ac.i > 0 ? " durch Ippon" : ac.w >= 2 ? " durch zwei Waza-ari" : ac.w === 1 ? " durch Waza-ari" : ac.y > 0 ? " durch Yuko" : "",
    proxTitulo: (a) => `🥋 ${a} ist gleich dran!`,
    proxCorpo: (comp, a) => `Bei ${comp} ist ${a} als Nächstes im Block dran. Bleib dran — gleich auf der Matte.`,
    venceuTitulo: (a) => `🥋 ${a} gewinnt und zieht weiter`,
    venceuCorpo: (comp, a, adv, met) => `Bei ${comp} hat ${a} ${adv}${met} besiegt und zieht weiter.`,
    perdeuTitulo: (a) => `🥋 ${a} verliert`,
    perdeuCorpo: (comp, a, adv, met) => `Bei ${comp} hat ${a} gegen ${adv}${met} verloren.`,
    bronzeTitulo: (a) => `🥋 ${a} kämpft um Bronze`,
    bronzeCom: (comp, a, adv) => `Bei ${comp} kämpft ${a} gegen ${adv} um Bronze.`,
    bronzeSem: (comp, a) => `Bei ${comp} kämpft ${a} um Bronze.`,
    finalTitulo: (a) => `🥋 ${a} steht im Finale!`,
    finalCom: (comp, a, adv) => `Bei ${comp} steht ${a} im Finale, gegen ${adv}!`,
    finalSem: (comp, a) => `Bei ${comp} steht ${a} im Finale!`,
    ouroTitulo: (a) => `🥇 ${a} ist Meister!`,        ouroCorpo: (comp, a, cat) => `Bei ${comp} ist ${a} Meister in ${cat} kg.`,
    prataTitulo: (a) => `🥈 ${a} holt Silber!`,       prataCorpo: (comp, a, cat) => `Bei ${comp} ist ${a} Vizemeister (Silber) in ${cat} kg.`,
    bronzeMedTitulo: (a) => `🥉 ${a} holt Bronze!`,   bronzeMedCorpo: (comp, a, cat) => `Bei ${comp} holt ${a} Bronze in ${cat} kg.`,
  },
};
// A próxima luta de um conjunto: 1ª ainda SEM vencedor com AMBOS os lados
// definidos. (Mesma regra do pontinho da página.) A ordem já vem correta da
// biblioteca (as lutas são geradas por ronda), por isso basta a primeira.
function proximaLuta(lutas: LutaChave[]): LutaChave | null {
  return lutas.find((l) => !l.vencedor && !!l.azul?.id && !!l.branco?.id) || null;
}
// Junta todos os "blocos" de uma categoria, cada um com a sua próxima luta.
// Blocos: cada pool (A-D), as repescagens, os bronzes, e as meias+final.
function blocosDaChave(c: ChaveNova): LutaChave[] {
  const blocos: LutaChave[][] = [];
  for (const p of ["A", "B", "C", "D"]) blocos.push(c.pools?.[p]?.lutas || []);
  blocos.push(c.repescagens || []);
  blocos.push(c.bronzes || []);
  const mf = [...(c.meias || [])];
  if (c.final) mf.push(c.final);
  blocos.push(mf);
  const proximas: LutaChave[] = [];
  for (const b of blocos) {
    const p = proximaLuta(b);
    if (p) proximas.push(p);
  }
  return proximas;
}
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const key = searchParams.get("key");
  if (!autorizado(key)) {
    return NextResponse.json({ ok: false, erro: "Não autorizado." }, { status: 401 });
  }
  const t0 = Date.now();
  if (!supabaseAdmin) {
    return NextResponse.json({ ok: false, erro: "Sem ligação ao Supabase." }, { status: 500 });
  }
  // (2) Há competição a decorrer? Se não, sai já — barato.
  const foco = focoMercado();
  const aDecorrer = foco.aDecorrer;
  if (!aDecorrer) {
    return NextResponse.json({ ok: true, a_decorrer: null, nota: "Sem competição a decorrer.", ms: Date.now() - t0 });
  }
  const comp = aDecorrer.idCompeticao;
  // Nome COMPLETO: a competição está a decorrer, logo o mercado já fechou e a
  // cidade pode aparecer. (Com `.nome` cru sairia o nome curto dos clássicos —
  // seguro, mas menos informativo. Ver a nota em lib/calendario.)
  const nomeComp = nomeCompeticao(aDecorrer);
  // (3) Favoritos: id_person -> lista de user_id que o seguem.
  const seguidoresDe = new Map<string, string[]>();
  try {
    const { data } = await supabaseAdmin.from("atletas_favoritos").select("user_id, id_person");
    for (const f of data || []) {
      const idp = String(f.id_person);
      const uid = String(f.user_id);
      if (!idp || !uid) continue;
      if (!seguidoresDe.has(idp)) seguidoresDe.set(idp, []);
      seguidoresDe.get(idp)!.push(uid);
    }
  } catch { /* sem favoritos: nada a fazer */ }
  if (seguidoresDe.size === 0) {
    return NextResponse.json({ ok: true, a_decorrer: nomeComp, nota: "Ninguém segue atletas.", ms: Date.now() - t0 });
  }

  // (3-bis) FILTRO PRO MAX. Ficamos só com os seguidores que têm Pro Max — é a
  // eles que o aviso pertence. Lê da tabela `users` (a fonte de verdade), em
  // lotes, e limpa os restantes das listas antes de sequer olhar para a chave:
  // assim nem se gasta tempo a calcular avisos que não seriam enviados.
  const todosSeguidores = Array.from(new Set(Array.from(seguidoresDe.values()).flat()));
  const proMax = new Set<string>();
  try {
    for (let i = 0; i < todosSeguidores.length; i += 500) {
      const lote = todosSeguidores.slice(i, i + 500);
      const { data } = await supabaseAdmin
        .from("users").select("id, is_pro_max").in("id", lote);
      for (const u of data || []) if (u.is_pro_max) proMax.add(String(u.id));
    }
  } catch { /* se falhar a leitura, não avisamos ninguém: melhor calar do que dar de graça */ }
  for (const [idp, uids] of Array.from(seguidoresDe.entries())) {
    const soPro = uids.filter((u) => proMax.has(u));
    if (soPro.length === 0) seguidoresDe.delete(idp);
    else seguidoresDe.set(idp, soPro);
  }
  if (seguidoresDe.size === 0) {
    return NextResponse.json({
      ok: true, a_decorrer: nomeComp,
      seguidores_total: todosSeguidores.length,
      seguidores_promax: proMax.size,
      nota: "Ninguém com Pro Max segue atletas.",
      ms: Date.now() - t0,
    });
  }
  // (4) Lê a chave de cada categoria pela biblioteca (a mesma verdade da página,
  // direto da base). OTIMIZAÇÃO FUTURA: só as categorias com favoritos — por
  // agora, com poucos utilizadores, as 14 são leves.
  const avisos: { user_id: string; id_person: string; nome: string; id_fight: string; cat: string }[] = [];
  // Narração: resultado / bronze / final / medalha. Guardamos um RENDER (monta o
  // texto na língua de quem recebe), não texto fixo — traduz para as 5 línguas.
  type Render = (lg: LinguaNotif) => { titulo: string; corpo: string };
  const eventos: { user_id: string; id_fight: string; tipo: string; cat: string; render: Render }[] = [];
  const POOLS = ["A", "B", "C", "D"];
  for (const cat of CATS) {
    const m = await montarChaveDaBase(comp, cat);
    // Categoria sem moldura ou que ainda nem começou: nada a fazer.
    if (!m.existeMoldura || !m.chave || m.estado === "naoComecou") continue;
    const chave = m.chave as unknown as ChaveNova;   // para a próxima luta
    const chaveR = m.chave as unknown as ChaveRica;   // para a narração

    // (A) PRÓXIMA LUTA — só enquanto a categoria DECORRE (comportamento original).
    if (m.estado === "aDecorrer") {
      for (const luta of blocosDaChave(chave)) {
        const idFight = `${cat}#${luta.chaveId || `${luta.azul?.id}-${luta.branco?.id}`}`;
        for (const lado of [luta.azul, luta.branco]) {
          if (!lado?.id) continue;
          const seguidores = seguidoresDe.get(String(lado.id));
          if (!seguidores) continue;
          for (const u of seguidores) {
            avisos.push({ user_id: u, id_person: String(lado.id), nome: lado.nome || "", id_fight: idFight, cat });
          }
        }
      }
    }

    // (B) NARRAÇÃO — vale para a decorrer E para terminada (as medalhas saem no fim).
    // Guardamos um RENDER por evento (não texto): a mensagem é montada na língua
    // de quem recebe, mais abaixo. Assim traduz para as 5 línguas.
    const emite = (idPerson: string, id_fight: string, tipo: string, render: Render) => {
      const seg = seguidoresDe.get(idPerson);
      if (!seg) return;
      for (const u of seg) eventos.push({ user_id: u, id_fight, tipo, cat, render });
    };
    // Nome/país de cada id desta categoria (as medalhas vêm só como ids).
    const identDe = new Map<string, LadoRico>();
    const reg = (l?: LadoRico) => { if (l?.id) identDe.set(l.id, l); };
    for (const p of POOLS) for (const l of chaveR.pools?.[p]?.lutas || []) { reg(l.azul); reg(l.branco); }
    for (const l of [...(chaveR.meias || []), chaveR.final, ...(chaveR.repescagens || []), ...(chaveR.bronzes || [])]) {
      if (l) { reg(l.azul); reg(l.branco); }
    }

    // Resultado de cada luta DECIDIDA (pools + meias + repescagens). A final e os
    // bronzes têm eventos próprios (final / medalha) — não entram aqui.
    const lutasResultado: LutaRica[] = [
      ...POOLS.flatMap((p) => chaveR.pools?.[p]?.lutas || []),
      ...(chaveR.meias || []),
      ...(chaveR.repescagens || []),
    ];
    for (const l of lutasResultado) {
      if (!l || l.estado !== "decidida" || !l.vencedor || !l.chaveId) continue;
      for (const lado of [l.azul, l.branco]) {
        if (!lado?.id || !seguidoresDe.has(lado.id)) continue;
        const outro = lado.id === l.azul?.id ? l.branco : l.azul;
        if (!outro?.id) continue; // sem adversário (bye): não há "venceu fulano"
        const venceu = l.vencedor === lado.id;
        const ap = apelido(lado.nome || "");
        const adv = advTxt(outro);
        const acVenc = venceu ? lado.acoes : outro.acoes; // ações de QUEM venceu
        emite(lado.id, `res#${cat}#${l.chaveId}#${lado.id}`, "resultado", (lg) => {
          const T = TXT[lg];
          const met = T.metodo(acVenc);
          return venceu
            ? { titulo: T.venceuTitulo(ap), corpo: T.venceuCorpo(nomeComp, ap, adv, met) }
            : { titulo: T.perdeuTitulo(ap), corpo: T.perdeuCorpo(nomeComp, ap, adv, met) };
        });
      }
    }
    // Disputa do bronze (ainda por lutar): avisa quem lá está; nomeia o adversário se já se souber.
    for (const l of chaveR.bronzes || []) {
      if (!l || l.estado === "decidida") continue;
      for (const lado of [l.azul, l.branco]) {
        if (!lado?.id || !seguidoresDe.has(lado.id)) continue;
        const outro = lado.id === l.azul?.id ? l.branco : l.azul;
        const ap = apelido(lado.nome || "");
        const adv = outro?.id ? advTxt(outro) : null;
        emite(lado.id, `bronze#${cat}#${lado.id}`, "bronze", (lg) => {
          const T = TXT[lg];
          return { titulo: T.bronzeTitulo(ap), corpo: adv ? T.bronzeCom(nomeComp, ap, adv) : T.bronzeSem(nomeComp, ap) };
        });
      }
    }
    // Final (ainda por lutar): nomeia o adversário se já se souber.
    const fin = chaveR.final;
    if (fin && fin.estado !== "decidida") {
      for (const lado of [fin.azul, fin.branco]) {
        if (!lado?.id || !seguidoresDe.has(lado.id)) continue;
        const outro = lado.id === fin.azul?.id ? fin.branco : fin.azul;
        const ap = apelido(lado.nome || "");
        const adv = outro?.id ? advTxt(outro) : null;
        emite(lado.id, `final#${cat}#${lado.id}`, "final", (lg) => {
          const T = TXT[lg];
          return { titulo: T.finalTitulo(ap), corpo: adv ? T.finalCom(nomeComp, ap, adv) : T.finalSem(nomeComp, ap) };
        });
      }
    }
    // Medalhas (categoria terminada / final e bronzes decididos).
    const medalhas: Array<{ id?: string | null; medalha: "ouro" | "prata" | "bronze" }> = [
      { id: chaveR.campeao ?? null, medalha: "ouro" },
      { id: chaveR.vice ?? null, medalha: "prata" },
      ...(chaveR.terceiros || []).map((tid) => ({ id: tid, medalha: "bronze" as const })),
    ];
    for (const md of medalhas) {
      if (!md.id || !seguidoresDe.has(md.id)) continue;
      const ap = apelido(identDe.get(md.id)?.nome || "");
      const kind = md.medalha;
      const catAtual = cat;
      emite(md.id, `medalha#${cat}#${md.id}`, "medalha", (lg) => {
        const T = TXT[lg];
        if (kind === "ouro") return { titulo: T.ouroTitulo(ap), corpo: T.ouroCorpo(nomeComp, ap, catAtual) };
        if (kind === "prata") return { titulo: T.prataTitulo(ap), corpo: T.prataCorpo(nomeComp, ap, catAtual) };
        return { titulo: T.bronzeMedTitulo(ap), corpo: T.bronzeMedCorpo(nomeComp, ap, catAtual) };
      });
    }
  }
  // LÍNGUA DE CADA DESTINATÁRIO, numa só consulta (para render por pessoa). Quem
  // não tiver língua definida cai em "pt".
  const mapaLingua = await linguasDeVarios([...avisos.map((a) => a.user_id), ...eventos.map((e) => e.user_id)]);
  const lgDe = (userId: string): LinguaNotif => mapaLingua[userId] || "pt";

  // --- (A) PRÓXIMA LUTA: anti-repetição + envio (comportamento original) ---
  // Lê de uma vez os pares (user_id, id_fight) já registados para estas lutas.
  const fights = Array.from(new Set(avisos.map((a) => a.id_fight)));
  const jaAvisado = new Set<string>(); // chave "user_id::id_fight"
  if (fights.length) {
    try {
      const { data } = await supabaseAdmin
        .from("alertas_enviados")
        .select("user_id, id_fight")
        .eq("tipo", "proxima_luta")
        .in("id_fight", fights);
      for (const r of data || []) jaAvisado.add(`${r.user_id}::${r.id_fight}`);
    } catch { /* se falhar a leitura, seguimos — o unique da tabela ainda protege */ }
  }
  // Envia os que faltam. Grava primeiro o "já avisei" (idempotente pelo unique),
  // e só envia o push se o INSERT foi novo — assim, mesmo com dois disparos quase
  // simultâneos, não há push duplicado.
  let enviados = 0;
  for (const a of avisos) {
    const chaveA = `${a.user_id}::${a.id_fight}`;
    if (jaAvisado.has(chaveA)) continue;
    jaAvisado.add(chaveA); // evita duplicar dentro do mesmo disparo (vários blocos)
    let inseriu = false;
    try {
      const { error } = await supabaseAdmin
        .from("alertas_enviados")
        .insert({ user_id: a.user_id, id_fight: a.id_fight, tipo: "proxima_luta" });
      inseriu = !error;
    } catch { inseriu = false; }
    if (!inseriu) continue;
    try {
      const T = TXT[lgDe(a.user_id)];
      const ap = apelido(a.nome);
      await criarNotificacaoServidor({
        paraUserId: a.user_id,
        tipo: "proxima_luta",
        titulo: T.proxTitulo(ap),
        corpo: T.proxCorpo(nomeComp, ap),
        // Link com a categoria DO atleta (e a competição): ao tocar, a chave abre
        // já na categoria certa — ex.: Davi Lima (-81) abre nos -81, não nos -73.
        link: `/chave-atletas?comp=${encodeURIComponent(comp)}&cat=${encodeURIComponent(a.cat)}`,
      });
      enviados++;
    } catch { /* push de um não bloqueia os outros */ }
  }

  // --- (B) NARRAÇÃO: resultado / bronze / final / medalha ---
  // Uma vez cada, garantido pelo INSERT único (id_fight já traz o prefixo do tipo).
  // Mensagem e link já vêm prontos de cima.
  let eventosEnviados = 0;
  for (const e of eventos) {
    let inseriu = false;
    try {
      const { error } = await supabaseAdmin
        .from("alertas_enviados")
        .insert({ user_id: e.user_id, id_fight: e.id_fight, tipo: e.tipo });
      inseriu = !error;
    } catch { inseriu = false; }
    if (!inseriu) continue;
    try {
      const { titulo, corpo } = e.render(lgDe(e.user_id));
      await criarNotificacaoServidor({
        paraUserId: e.user_id,
        tipo: e.tipo,
        titulo,
        corpo,
        link: `/chave-atletas?comp=${encodeURIComponent(comp)}&cat=${encodeURIComponent(e.cat)}`,
      });
      eventosEnviados++;
    } catch { /* push de um não bloqueia os outros */ }
  }

  return NextResponse.json({
    ok: true,
    a_decorrer: nomeComp,
    // Quantos seguidores existem ao todo e quantos são Pro Max — dá para ver de
    // relance se o filtro está a apertar demais (ou se ninguém subscreveu ainda).
    seguidores_total: todosSeguidores.length,
    seguidores_promax: proMax.size,
    candidatos: avisos.length,
    enviados,
    eventos: eventos.length,
    eventos_enviados: eventosEnviados,
    ms: Date.now() - t0,
  });
}
