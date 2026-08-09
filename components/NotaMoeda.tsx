// components/NotaMoeda.tsx
//
// Uma linha discreta a avisar que o preço sai na moeda local de quem compra.
//
// PORQUE EXISTE
// A montra escreve os preços em euros (lib/precos.ts), porque é em euros que se
// recebe. Mas a Stripe tem o Adaptive Pricing ligado: um brasileiro lê "7,99€"
// na página e vê "R$ 49,90" no checkout. É o mesmo valor, mas a surpresa cai no
// pior momento — o de decidir pagar.
//
// COMO USAR
//   import { NotaMoeda } from "@/components/NotaMoeda";
//   ...
//   <NotaMoeda />
//
// Pôr por baixo de qualquer bloco que mostre preço: /ippon-pro, /pro-max,
// /sobre-pro, o cartão da subscrição no perfil.
//
// Aceita `align` e `style` para encaixar em cartões alinhados de formas
// diferentes, mas o TEXTO vem sempre do PRECO.notaMoeda — não se escreve a
// frase à mão em lado nenhum, pela mesma razão que não se escrevem os preços.

import { PRECO } from "@/lib/precos";

export function NotaMoeda({
  align = "center",
  style,
}: {
  align?: "left" | "center" | "right";
  style?: React.CSSProperties;
}) {
  return (
    <p
      style={{
        fontSize: 11,
        lineHeight: 1.5,
        color: "#7c8a82",
        textAlign: align,
        margin: "6px 0 0",
        ...style,
      }}
    >
      {PRECO.notaMoeda}
    </p>
  );
}
