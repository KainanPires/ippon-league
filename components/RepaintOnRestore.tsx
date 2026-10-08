"use client";

// components/RepaintOnRestore.tsx
//
// CORREÇÃO de "tela branca até tocar" no iOS Safari (Kainan, 08/10/2026).
//
// Sintoma: ao voltar de uma navegação de página inteira (ex.: a liga abre o dojo
// de um rival com `window.location.href` e depois a pessoa volta), o iOS restaura
// a página do bfcache mas NÃO desenha o primeiro frame — fica branco até um toque/
// scroll forçar a repintura. Não é um erro de JS (o error boundary não dispara);
// é um bug de repintura do WebKit.
//
// Aqui forçamos ESSA repintura automaticamente nos momentos de restauro:
//   • pageshow com persisted=true  -> veio do bfcache (o caso clássico)
//   • visibilitychange -> visível  -> a app voltou a primeiro plano (PWA/standby)
// O "empurrão" é um scroll de 1px e volta (imperceptível), mais uma leitura de
// layout — exatamente o que o toque da pessoa já fazia, mas sozinho.

import { useEffect } from "react";

export function RepaintOnRestore() {
  useEffect(() => {
    const nudge = () => {
      try {
        requestAnimationFrame(() => {
          const y = window.scrollY || 0;
          // leitura força o cálculo de layout
          void document.body.offsetHeight;
          // scroll de 1px e volta: obriga o WebKit a pintar um frame novo
          window.scrollTo(0, y + 1);
          window.scrollTo(0, y);
        });
      } catch { /* ambiente sem window/scroll: ignora */ }
    };

    const onPageShow = (e: PageTransitionEvent) => { if (e.persisted) nudge(); };
    const onVisible = () => { if (document.visibilityState === "visible") nudge(); };

    window.addEventListener("pageshow", onPageShow);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("pageshow", onPageShow);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return null;
}
