"use client";

// lib/useNivel.ts
//
// O NÍVEL DE SUBSCRIÇÃO, NUM SÍTIO SÓ.
//
// ---------------------------------------------------------------------------
// OS DOIS PROBLEMAS QUE ISTO RESOLVE
//
// 1. OS NÍVEIS SÃO CUMULATIVOS E O CÓDIGO NÃO SABIA DISSO.
//
//    Grátis ⊂ Pro ⊂ Pro Max. Tudo o que o Pro faz, o Pro Max também faz.
//
//    Mas metade dos ecrãs faz isto:
//        setIsPro(!!meta?.is_pro);
//    ...e depois `if (isPro)` para uma funcionalidade Pro. Um utilizador Pro Max
//    com is_pro=false é tratado como GRÁTIS — perde tudo, depois de pagar o
//    nível mais alto. Hoje não acontece porque as contas têm os dois campos a
//    true por sorte, não por desenho.
//
//    Aqui, `ehPro` é verdadeiro para Pro E para Pro Max. Sempre.
//
// 2. A FONTE ERA A ERRADA.
//
//    Os ecrãs liam do `user_metadata` da sessão; as rotas que bloqueiam a sério
//    (/api/chave-atletas, /api/confrontos) leem da tabela `users`. Duas fontes
//    que se atualizam por caminhos diferentes acabam sempre por divergir — e aí
//    a app mostra uma coisa e o servidor responde outra.
//
//    Aqui lê-se da tabela `users`, a mesma que o servidor usa.
//
// ---------------------------------------------------------------------------
// ISTO NÃO É UM BLOQUEIO DE SEGURANÇA
//
// Corre no browser: serve para DESENHAR o ecrã (mostrar ou esconder, convidar a
// subir de nível). Não protege dados — quem quiser, muda-o nas DevTools.
//
// A proteção a sério vive sempre no servidor, com `nivelDoPedido()` a ler a
// tabela `users` a partir do token. Se uma funcionalidade paga expõe dados,
// tem de haver bloqueio LÁ, não aqui.
// ---------------------------------------------------------------------------

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export type Nivel = "gratis" | "pro" | "promax";

// Cache em memória, partilhada por todas as páginas desta sessão. O nível muda
// raramente (ao subscrever), por isso não faz sentido ir à base de dados em
// cada ecrã. Morre quando a app recarrega.
let cacheNivel: Nivel | null = null;
let buscaEmCurso: Promise<Nivel> | null = null;

/** Esquece o nível em cache. Chamar depois de subscrever ou trocar de conta. */
export function limparCacheNivel(): void {
  cacheNivel = null;
  buscaEmCurso = null;
}

async function buscarNivel(): Promise<Nivel> {
  try {
    const { data } = await supabase.auth.getSession();
    const uid = data.session?.user?.id;
    if (!uid) return "gratis";
    const { data: row } = await supabase
      .from("users").select("is_pro, is_pro_max").eq("id", uid).maybeSingle();
    const r = row as { is_pro?: boolean; is_pro_max?: boolean } | null;
    if (r?.is_pro_max) return "promax";
    if (r?.is_pro) return "pro";
    return "gratis";
  } catch {
    // Em caso de dúvida, o nível mais baixo: é melhor um Pro ver um convite a
    // mais do que um grátis entrar numa porta que não pagou.
    return "gratis";
  }
}

export interface NivelAtual {
  nivel: Nivel;
  /** Tem pelo menos Pro? Verdadeiro TAMBÉM para Pro Max — os níveis são cumulativos. */
  ehPro: boolean;
  /** Tem Pro Max? */
  ehProMax: boolean;
  /** Já sabemos o nível real? (false = ainda a carregar) */
  pronto: boolean;
}

/**
 * O nível de subscrição do utilizador com sessão iniciada.
 *
 * Enquanto carrega devolve "gratis" com pronto=false — assim o ecrã desenha já,
 * e nunca mostra por engano uma funcionalidade paga a quem não a tem. Use
 * `pronto` se quiser esconder um convite a subir de nível até ter a certeza
 * (evita o piscar de "sê Pro" a quem já é).
 *
 * Uso:
 *   const { ehPro, ehProMax } = useNivel();
 *   {ehPro && <AnaliseDeCapitao />}       // Pro e Pro Max
 *   {ehProMax && <CorDoTatame />}         // só Pro Max
 *   {!ehPro && <ConviteParaPro />}
 */
export function useNivel(): NivelAtual {
  const [nivel, setNivel] = useState<Nivel>(cacheNivel ?? "gratis");
  const [pronto, setPronto] = useState<boolean>(cacheNivel !== null);

  useEffect(() => {
    let vivo = true;
    if (cacheNivel !== null) {
      setNivel(cacheNivel);
      setPronto(true);
      return () => { vivo = false; };
    }
    if (!buscaEmCurso) buscaEmCurso = buscarNivel();
    buscaEmCurso
      .then((n) => {
        cacheNivel = n;
        if (vivo) { setNivel(n); setPronto(true); }
      })
      .catch(() => { if (vivo) setPronto(true); });
    return () => { vivo = false; };
  }, []);

  return {
    nivel,
    // A regra cumulativa vive AQUI, uma vez. Nenhum ecrã tem de se lembrar dela.
    ehPro: nivel === "pro" || nivel === "promax",
    ehProMax: nivel === "promax",
    pronto,
  };
}
