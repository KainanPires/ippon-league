// app/api/nome-disponivel/route.ts
//
// VERIFICA SE UM NOME DE TIME ESTÁ LIVRE (servidor, chave secreta).
//
// O nome do time é único em TODA a app (decisão do Kainan). Vive na coluna
// `nome` da tabela `equipas` — um utilizador pode ter o mesmo nome em várias
// linhas (uma por competição), por isso comparamos por utilizador, não por linha.
//
// "Igual" = ignorando maiúsculas/minúsculas E acentos: "Samurai" = "samurai" =
// "Samuraí". Assim não há dois nomes que parecem o mesmo.
//
// Recebe (GET): ?nome=<nome>&user_id=<uuid de quem pergunta>
// Devolve:
//   { ok:true, livre:true }                          o nome está livre
//   { ok:true, livre:false, sugestoes:[...] }        ocupado + alternativas livres
//   { ok:false, erro }                               nome inválido / erro
//
// As sugestões são SÓ nomes realmente livres (verificados contra a base).
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Normaliza para comparação: minúsculas, sem acentos, espaços colapsados.
// "Samuraí  PT " -> "samurai pt". É a "chave" pela qual dois nomes se dizem iguais.
function normalizar(s: string): string {
  return (s || "")
    .normalize("NFD")                     // separa acentos das letras
    .replace(/[\u0300-\u036f]/g, "")      // remove os acentos
    .trim()
    .replace(/\s+/g, " ")                 // colapsa espaços
    .toLowerCase();
}

export async function GET(req: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ ok: false, erro: "Servidor sem ligação." }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const nomeOriginal = (searchParams.get("nome") || "").trim();
  const user_id = (searchParams.get("user_id") || "").trim();

  if (nomeOriginal.length < 2) {
    return NextResponse.json({ ok: false, erro: "Nome demasiado curto." }, { status: 400 });
  }

  // 1) Junta TODOS os nomes de time já usados (com o user_id de cada um, para
  //    ignorar as linhas do próprio). Lê em lotes para não estourar limites.
  const usadosPorOutros = new Set<string>(); // chaves normalizadas de OUTROS users
  try {
    const PAGINA = 1000;
    for (let inicio = 0; ; inicio += PAGINA) {
      const { data, error } = await supabaseAdmin
        .from("equipas")
        .select("nome, user_id")
        .not("nome", "is", null)
        .range(inicio, inicio + PAGINA - 1);
      if (error) break;
      const linhas = data || [];
      for (const l of linhas) {
        const nome = String(l.nome ?? "").trim();
        if (!nome) continue;
        if (user_id && String(l.user_id) === user_id) continue; // o próprio não conta
        usadosPorOutros.add(normalizar(nome));
      }
      if (linhas.length < PAGINA) break; // última página
    }
  } catch {
    return NextResponse.json({ ok: false, erro: "Não foi possível verificar agora." }, { status: 500 });
  }

  const chave = normalizar(nomeOriginal);

  // 2) Está livre? (ninguém mais o usa)
  if (!usadosPorOutros.has(chave)) {
    return NextResponse.json({ ok: true, livre: true });
  }

  // 3) Ocupado: gera sugestões disponíveis a partir do nome pedido.
  const sugestoes = gerarSugestoes(nomeOriginal, usadosPorOutros);
  return NextResponse.json({ ok: true, livre: false, sugestoes });
}

// Gera até 3 variações do nome que estejam REALMENTE livres (não usadas).
// Tenta, por ordem: "Nome 2", "Nome 3"... e alguns sufixos curtos. Cada
// candidata é normalizada e testada contra o conjunto de nomes ocupados.
function gerarSugestoes(base: string, ocupados: Set<string>): string[] {
  const limpo = base.trim().replace(/\s+/g, " ");
  const out: string[] = [];
  const candidatas: string[] = [];

  // Números 2..20 (o mais natural: "Samurai 2").
  for (let i = 2; i <= 20; i++) candidatas.push(`${limpo} ${i}`);
  // Alguns sufixos curtos, caso os números também estejam tomados.
  for (const suf of ["PT", "BR", "JR", "X", "Pro", "Dojo"]) candidatas.push(`${limpo} ${suf}`);

  for (const c of candidatas) {
    if (c.length > 24) continue; // o campo aceita no máximo 24 caracteres
    if (!ocupados.has(normalizar(c))) {
      out.push(c);
      if (out.length >= 3) break;
    }
  }
  return out;
}
