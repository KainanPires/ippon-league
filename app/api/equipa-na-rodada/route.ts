// app/api/equipa-na-rodada/route.ts
//
// Devolve a EQUIPA que um utilizador usou numa competição específica, para o
// modo VISITA (ver o dojo de um rival na liga, ou de qualquer equipa numa ronda
// da Copa, incluindo a própria numa ronda passada).
//
// IMPORTANTE: a equipa é lida de `equipas` POR competição (id_competicao). Como
// cada ronda da copa é uma competição diferente, esta é a escalação FIXA daquela
// rodada — não muda quando o jogador edita a equipa para a próxima competição.
// Os pontos vêm de `resultados_atletas` (congelado). Sem risco de "equipa errada".
//
// PORTÃO ANTI-CÓPIA (servidor): esta rota NÃO devolve a escalação de uma
// competição cujo mercado ainda está ABERTO — ver o time e o capitão de um rival
// antes do fecho permitiria copiá-los. A regra está no SERVIDOR (não só no clique
// do cliente), por isso é à prova de URL escrito à mão, e vale para a liga e para
// a Copa. Não precisa de autenticar quem pede: o próprio jogador nunca lê a sua
// própria equipa por aqui na ronda atual (usa a sessão dele, via loadSavedCloudFor);
// esta rota serve só para VER equipas no modo visita, que deve respeitar o fecho.
// Assim que o mercado fecha (competição a decorrer e, depois, encerrada), a
// escalação fica visível normalmente.
//
// NOME DA COMPETIÇÃO: usa nomeCompeticao() de lib/calendario, que esconde a
// CIDADE dos clássicos enquanto o mercado está aberto. Isto é essencial aqui:
// a resposta `bloqueado` é mostrada ao utilizador com o nome da competição, e
// devolver "Grand Prix The Hague 2018" seria entregar, na própria mensagem que
// diz "ainda não podes ver", a informação que permite ir ao JudoBase buscar os
// resultados de 2018. Era um buraco dentro da própria trave.
//
// Uso: /api/equipa-na-rodada?user=<uuid>&comp=<id_competicao>
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { CALENDARIO_2026, estadoMercado, nomeCompeticao } from "@/lib/calendario";
import { hidratarHorarios } from "@/lib/horarios";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Nome a MOSTRAR desta competição (cidade escondida se for clássico por abrir).
function nomeParaMostrar(id: string): string {
  const s = CALENDARIO_2026.find((c) => c.idCompeticao === id);
  return s ? nomeCompeticao(s) : `Competição ${id}`;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const user = (searchParams.get("user") || "").trim();
  const comp = (searchParams.get("comp") || "").trim();

  if (!supabaseAdmin || !user || !comp) {
    return NextResponse.json({ ok: false, erro: "Faltam parâmetros." }, { status: 400 });
  }

  // PORTÃO ANTI-CÓPIA: mercado ainda aberto -> não revelamos a escalação.
  // (Se a competição não estiver no calendário, não há "mercado" gerido aqui;
  // nesse caso seguimos em frente — só os ids do calendário valem como rodadas.)
  await hidratarHorarios();
  const semana = CALENDARIO_2026.find((c) => c.idCompeticao === comp);
  if (semana && estadoMercado(semana).estado === "aberto") {
    return NextResponse.json({
      ok: true,
      bloqueado: true,
      mercado_aberto: true,
      competicao: { id: comp, nome: nomeParaMostrar(comp) },
    });
  }

  // 1) A escalação fixa daquela competição.
  const { data: eq } = await supabaseAdmin
    .from("equipas")
    .select("user_id, nome, escudo, atletas, capitao")
    .eq("user_id", user)
    .eq("id_competicao", comp)
    .maybeSingle();

  if (!eq) {
    return NextResponse.json({
      ok: true,
      tem_equipa: false,
      competicao: { id: comp, nome: nomeParaMostrar(comp) },
    });
  }

  const ids = Array.isArray(eq.atletas) ? (eq.atletas as unknown[]).map(String) : [];
  const capitao = eq.capitao ? String(eq.capitao) : null;

  // 2) Pontos + dados (nome/país/categoria) congelados desta competição.
  const { data: res } = await supabaseAdmin
    .from("resultados_atletas")
    .select("id_person, nome, country_code, weight_category, pontos")
    .eq("id_competicao", comp)
    .in("id_person", ids.length > 0 ? ids : ["__none__"]);

  const porId = new Map<string, { nome: string; pais: string; categoria: string; pontos: number }>();
  for (const r of res || []) {
    porId.set(String(r.id_person), {
      nome: String(r.nome || ""),
      pais: String(r.country_code || ""),
      categoria: String(r.weight_category || ""),
      pontos: Number(r.pontos) || 0,
    });
  }

  // 3) Fallback de NOME para atletas sem resultado congelado (ex.: não lutou):
  //    procura no atletas_cache da competição.
  const faltamNome = ids.filter((id) => !porId.has(id));
  if (faltamNome.length > 0) {
    const { data: cacheRow } = await supabaseAdmin
      .from("atletas_cache")
      .select("atletas")
      .eq("id_competition", comp)
      .maybeSingle();
    const lista = (cacheRow && Array.isArray(cacheRow.atletas)) ? (cacheRow.atletas as Record<string, unknown>[]) : [];
    const cacheById = new Map<string, Record<string, unknown>>();
    for (const a of lista) cacheById.set(String((a as { id?: unknown }).id ?? ""), a);
    for (const id of faltamNome) {
      const a = cacheById.get(id);
      if (a) {
        porId.set(id, {
          nome: String((a as { name?: unknown }).name ?? "Atleta"),
          pais: String((a as { countryIso?: unknown }).countryIso ?? ""),
          categoria: String((a as { category?: unknown }).category ?? ""),
          pontos: 0,
        });
      }
    }
  }

  // 4) Monta a lista na ordem da escalação. Pontos SIMPLES por atleta.
  const atletas = ids.map((id) => {
    const d = porId.get(id);
    return {
      id,
      nome: d?.nome || "Atleta",
      pais: d?.pais || "",
      categoria: d?.categoria || "",
      pontos: d ? Math.round(d.pontos * 10) / 10 : 0,
      capitao: id === capitao,
    };
  });

  // Total da equipa (capitão a dobrar), para fechar a conta.
  let total = 0;
  for (const a of atletas) total += a.capitao ? a.pontos * 2 : a.pontos;
  total = Math.round(total * 10) / 10;

  return NextResponse.json({
    ok: true,
    tem_equipa: true,
    nome_time: String(eq.nome || "Equipa"),
    escudo: eq.escudo ?? null,
    capitao,
    competicao: { id: comp, nome: nomeParaMostrar(comp) },
    atletas,
    total,
  });
}
