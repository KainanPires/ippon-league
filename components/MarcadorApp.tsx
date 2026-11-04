"use client";

// components/MarcadorApp.tsx
//
// Corre uma vez em todas as páginas (está no layout). Se o site estiver dentro
// de uma app das lojas:
//   1. marca <html data-app="android|ios"> — o globals.css usa isto para
//      esconder os links de compra (ver "APPS DAS LOJAS" no fim do ficheiro);
//   2. se a página atual for de venda (loja, Pro, Pro Max), volta ao /inicio.
// No browser normal não faz nada.

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { plataforma, ehPaginaVenda } from "@/lib/plataforma";

export default function MarcadorApp() {
  const caminho = usePathname() || "/";
  useEffect(() => {
    const p = plataforma();
    if (p === "web") return;
    document.documentElement.dataset.app = p;
    if (ehPaginaVenda(caminho)) window.location.replace("/inicio");
  }, [caminho]);
  return null;
}
