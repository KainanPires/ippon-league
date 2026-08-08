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
//    nível mais alto.
//
//    Aqui, `ehPro` é verdadeiro para Pro E para Pro Max. Sempre.
//
// 2. A FONTE ERA A ERRADA.
//
//    Os ecrãs liam do `user_metadata` da sessão; as rotas que bloqueiam a sério
//    leem da tabela `users`. Duas fontes que se atualizam por caminhos
//    diferentes acabam sempre por divergir.
//
//    Aqui lê-se da tabela `users`, a mesma que o servidor usa.
//
// ---------------------------------------------------------------------------
// UMA FALHA NUNCA VAI PARA A CACHE  (corrigido)
//
// A versão anterior guardava o resultado fosse ele qual fosse. Como o
// `buscarNivel` devolve "gratis" quando alguma coisa corre mal — a sessão ainda
// não estava pronta, a rede falhou, a consulta demorou — bastava UMA falha logo
// no arranque para "gratis" ficar guardado como se fosse verdade.
//
// E a partir daí NENHUMA página voltava a perguntar: o cacheNivel deixava de ser
// nulo, o buscaEmCurso ficava com a promessa já resolvida, e não havia forma de
// sair daquilo sem recarregar a aplicação de raiz. Um subscritor pagante ficava
// a ver-se como grátis, e nem sequer aparecia um pedido à base de dados nas
// ferramentas do browser — porque não havia pedido nenhum.
//
// Agora distingue-se "sei que é grátis" de "não consegui saber". Só o primeiro
// é guardado. O segundo devolve "gratis" para o ecrã desenhar, mas deixa a
// próxima página tentar outra vez.
//
// ---------------------------------------------------------------------------
// DEPOIS DE PAGAR, É PRECISO ESQUECER
//
// A cache é boa: o nível muda raramente e não vale a pena consultar a base de
// dados em cada ecrã. Mas quando muda, muda mesmo — e é aí que a app tem de
// chamar `limparCacheNivel()`.
//
// O sítio óbvio é o regresso do pagamento (/perfil?pagamento=ok). Sem isso, a
// pessoa paga, volta à app, e continua a ver-se como grátis até fechar tudo.
//
// ---------------------------------------------------------------------------
// ISTO NÃO É UM BLOQUEIO DE SEGURANÇA
//
// Corre no browser: serve para DESENHAR o ecrã. Não protege dados — quem quiser,
// muda-o nas ferramentas de programação. A proteção a sério vive no servidor.
// ---------------------------------------------------------------------------

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export type Nivel = "gratis" | "pro" | "promax";

/** O que a consulta devolveu, e se foi de facto uma resposta. */
interface Resultado {
  nivel: Nivel;
  /** Falso quando não conseguimos saber — nesse caso NÃO se guarda. */
  fiavel: boolean;
}

// Cache em memória, partilhada por todas as páginas desta sessão. Morre quando a
// app recarrega. Só guarda respostas fiáveis.
let cacheNivel: Nivel | null = null;
let buscaEmCurso: Promise<Resultado> | null = null;

/** Esquece o nível em cache. Chamar depois de subscrever ou trocar de conta. */
export function limparCacheNivel(): void {
  cacheNivel = null;
  buscaEmCurso = null;
}

async function buscarNivel(): Promise<Resultado> {
  try {
    const { data } = await supabase.auth.getSession();
    const uid = data.session?.user?.id;

    // Sem sessão é uma resposta a sério: esta pessoa é mesmo grátis.
    if (!uid) return { nivel: "gratis", fiavel: true };

    const { data: row, error } = await supabase
      .from("users").select("is_pro, is_pro_max").eq("id", uid).maybeSingle();

    // Erro na consulta, ou linha que não veio: NÃO sabemos o nível. Devolve-se o
    // mais baixo para o ecrã não expor nada, mas sem guardar — senão um soluço
    // de rede condenava a sessão inteira a "grátis".
    if (error || !row) return { nivel: "gratis", fiavel: false };

    const r = row as { is_pro?: boolean; is_pro_max?: boolean };
    if (r.is_pro_max) return { nivel: "promax", fiavel: true };
    if (r.is_pro) return { nivel: "pro", fiavel: true };
    return { nivel: "gratis", fiavel: true };
  } catch {
    // Em caso de dúvida, o nível mais baixo — mas por saber, não por decidir.
    return { nivel: "gratis", fiavel: false };
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
 * `pronto` se quiser esconder um convite a subir de nível até ter a certeza.
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
      .then((r) => {
        // SÓ respostas fiáveis são guardadas. Uma falha deixa a cache vazia para
        // a próxima página poder tentar de novo.
        if (r.fiavel) cacheNivel = r.nivel;
        else buscaEmCurso = null;

        if (vivo) { setNivel(r.nivel); setPronto(true); }
      })
      .catch(() => {
        buscaEmCurso = null;
        if (vivo) setPronto(true);
      });

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
