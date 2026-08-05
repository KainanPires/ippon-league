"use client";

// app/pro/… e app/pro-max-central/… decidem quem entra; este ficheiro decide
// PARA ONDE se vai.
//
// ---------------------------------------------------------------------------
// O PROBLEMA QUE ISTO RESOLVE
//
// A barra de navegação de baixo está escrita à mão em CADA página (não há um
// componente partilhado). O ícone "Pro" aponta para sítios diferentes conforme o
// nível:
//     Pro Max -> /pro-max-central
//     Pro     -> /pro
//     grátis  -> /ippon-pro   (a página de vendas)
//
// Só o /inicio foi migrado para o useNivel(). As outras páginas continuavam a
// ler o nível do user_metadata — que deixou de ser sincronizado quando tirámos
// isso do trigger. Resultado: um Pro Max saía do /inicio, tocava em "Pro"
// noutro ecrã qualquer, e ia parar à página de VENDAS. Depois de ter pago.
//
// A correção certa seria uma barra partilhada. Mas isso obriga a mexer em todas
// as páginas de uma vez — mais risco, e não é o que está partido agora.
//
// Em vez disso: um destino ÚNICO, /pro-central, que decide sozinho para onde
// mandar. Todas as barras podem apontar para aqui sem saberem nada do nível, e
// deixa de haver forma de a resposta divergir entre ecrãs.
// ---------------------------------------------------------------------------

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useNivel } from "@/lib/useNivel";

export default function ProCentral() {
  const router = useRouter();
  const { ehPro, ehProMax, pronto } = useNivel();

  useEffect(() => {
    // Espera saber o nível. Sem isto, mandava toda a gente para as vendas no
    // instante em que a página abre — que é exatamente o bug que veio corrigir.
    if (!pronto) return;
    if (ehProMax) router.replace("/pro-max-central");
    else if (ehPro) router.replace("/pro");
    else router.replace("/ippon-pro");
  }, [pronto, ehPro, ehProMax, router]);

  // Ecrã de passagem: dura o tempo de uma leitura à base de dados.
  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#7c8a82", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-geist-mono), system-ui, sans-serif", fontSize: 13, letterSpacing: "0.14em", textTransform: "uppercase" }}>
      A abrir…
    </main>
  );
}
