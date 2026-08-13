// lib/noticiaLingua.ts
//
// Escolhe os campos de uma notícia na LÍNGUA DO LEITOR.
//
// O português é o original (colunas titulo/resumo/corpo). As outras línguas vivem
// em `traducoes` (ver lib/traduzirNoticia.ts e a coluna hub_noticias.traducoes).
// Aqui só se decide O QUE MOSTRAR: se a pessoa lê noutra língua e há tradução,
// devolve-se a tradução; senão, cai-se no português. Nunca mostra a chave crua
// nem um campo vazio.
//
// É um módulo de CLIENTE (sem chamadas à API, sem chave). Serve o carrossel, a
// lista e o artigo.

export interface CamposTraduzidos {
  titulo?: string | null;
  resumo?: string | null;
  corpo?: string | null;
}

export interface NoticiaTraduzivel {
  titulo: string;
  resumo?: string | null;
  corpo: string;
  traducoes?: Record<string, CamposTraduzidos> | null;
}

export interface NoticiaNaLingua {
  titulo: string;
  resumo: string;
  corpo: string;
  traduzida: boolean;   // true = está a MOSTRAR uma tradução (não o português)
  temTraducao: boolean; // true = EXISTE tradução para esta língua (mesmo que se veja o original)
}

/**
 * Devolve os campos a mostrar. Se `verOriginal` for true, força o português
 * mesmo havendo tradução — é o que o botão "ver original" do artigo usa.
 */
export function noticiaNaLingua(
  n: NoticiaTraduzivel,
  lingua: string,
  verOriginal = false
): NoticiaNaLingua {
  const orig = {
    titulo: n.titulo || "",
    resumo: (n.resumo ?? "") || "",
    corpo: n.corpo || "",
  };
  const tr = lingua !== "pt" ? n.traducoes?.[lingua] : undefined;
  const temTraducao = !!(tr && (tr.titulo || tr.corpo));
  if (!temTraducao || verOriginal) {
    return { ...orig, traduzida: false, temTraducao };
  }
  return {
    titulo: tr!.titulo || orig.titulo,
    resumo: (tr!.resumo ?? "") || orig.resumo,
    corpo: tr!.corpo || orig.corpo,
    traduzida: true,
    temTraducao: true,
  };
}
