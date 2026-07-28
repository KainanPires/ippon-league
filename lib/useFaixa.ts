"use client";

// lib/useFaixa.ts
//
// A FAIXA DO JOGO, num sítio só.
//
// PROBLEMA QUE ISTO RESOLVE: a faixa estava espalhada e inconsistente. O /inicio
// lia-a da base de dados, mas o /meu-time tinha `const BELT = "Branca"` fixo no
// topo do ficheiro (dizia "Faixa Branca" a toda a gente, mesmo a quem fosse
// preta), e o /criar-equipa e o /mercado pintavam o Dôdo com cores fixas
// (#efeadd, #141110) sem sequer carregar a faixa. Resultado: o mesmo jogador via
// uma faixa diferente conforme o ecrã.
//
// Passar a faixa à mão a cada página resolveria hoje e voltaria a partir-se na
// próxima página nova. Por isso: um hook. Quem precisa da faixa chama useFaixa()
// e pronto — não há como esquecer, não há como divergir.
//
// CACHE: a faixa só muda na virada do mês (o cron recalcula a 1). Não faz sentido
// ir à base de dados em cada ecrã, por isso guardamos em memória no módulo: a
// primeira página que a pede busca-a, as seguintes usam a mesma. A cache morre
// quando a app recarrega, o que é mais do que suficiente.
//
// Uso:
//   const { faixa, cor, nome } = useFaixa();
//   <Mascot belt={cor} expression="feliz" />
//   <div>Faixa {nome}</div>

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { normalizarFaixa, corDaFaixa, nomeDaFaixa, type Faixa } from "@/lib/faixas";

// Cache em memória, partilhada por todas as páginas desta sessão.
let cacheFaixa: Faixa | null = null;
let buscaEmCurso: Promise<Faixa> | null = null;

/**
 * Esquece a faixa em cache. Chamar quando ela pode ter mudado — por exemplo,
 * depois de o utilizador ver a notificação de subida/descida de faixa, ou ao
 * trocar de conta no mesmo aparelho.
 */
export function limparCacheFaixa(): void {
  cacheFaixa = null;
  buscaEmCurso = null;
}

async function buscarFaixa(): Promise<Faixa> {
  try {
    const { data } = await supabase.auth.getSession();
    const uid = data.session?.user?.id;
    if (!uid) return "branca"; // visitante: branca, a mais neutra
    const { data: row } = await supabase.from("users").select("belt").eq("id", uid).maybeSingle();
    return normalizarFaixa((row as { belt?: unknown } | null)?.belt as string | null | undefined);
  } catch {
    return "branca";
  }
}

export interface FaixaAtual {
  faixa: Faixa;    // chave ("roxa")
  cor: string;     // hex para o Mascot e adornos ("#7a4fa3")
  nome: string;    // nome bonito para mostrar ("Roxa")
  pronta: boolean; // já sabemos a faixa real? (false = ainda a carregar)
}

/**
 * A faixa do jogo do utilizador com sessão iniciada.
 *
 * Enquanto carrega devolve "branca" com pronta=false — assim o ecrã desenha já,
 * sem saltos nem espaços em branco, e a cor certa entra assim que chega. Use
 * `pronta` se quiser esconder algo até ter a certeza (raramente é preciso).
 */
export function useFaixa(): FaixaAtual {
  const [faixa, setFaixa] = useState<Faixa>(cacheFaixa ?? "branca");
  const [pronta, setPronta] = useState<boolean>(cacheFaixa !== null);

  useEffect(() => {
    let vivo = true;
    if (cacheFaixa !== null) {
      setFaixa(cacheFaixa);
      setPronta(true);
      return () => { vivo = false; };
    }
    // Uma única busca, mesmo que várias páginas peçam ao mesmo tempo.
    if (!buscaEmCurso) buscaEmCurso = buscarFaixa();
    buscaEmCurso
      .then((f) => {
        cacheFaixa = f;
        if (vivo) { setFaixa(f); setPronta(true); }
      })
      .catch(() => { if (vivo) setPronta(true); });
    return () => { vivo = false; };
  }, []);

  return { faixa, cor: corDaFaixa(faixa), nome: nomeDaFaixa(faixa), pronta };
}
