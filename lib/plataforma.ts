"use client";

// lib/plataforma.ts
//
// ONDE ESTÁ A CORRER O SITE: no browser normal, na app Android (TWA) ou na app
// iPhone (Capacitor)?
//
// PORQUE IMPORTA (decisões D-02 e D-03, MOBILE_DECISIONS.md)
//   - Dentro das apps NÃO se vende nada (Pro, Pro Max, Judocoins): as lojas
//     exigem o seu próprio sistema de pagamento para bens digitais.
//   - No iPhone, além disso, as funções Pro não aparecem a ninguém (regra
//     3.1.3(b) da Apple) — toda a gente é tratada como "grátis".
//   - No browser normal, NADA muda.
//
// COMO SE DETETA (por ordem)
//   1. ?app=android | ?app=ios no URL — é o endereço de arranque das apps.
//   2. Capacitor presente (window.Capacitor) ou User-Agent com "IpponLeagueApp".
//   3. Referrer "android-app://..." — o Chrome põe-no ao abrir uma TWA.
//   4. O que ficou guardado no sessionStorage nesta "aba".
//
// PORQUE sessionStorage E NÃO localStorage: a TWA partilha o armazenamento com o
// Chrome do telemóvel. Um localStorage marcaria TAMBÉM o Chrome normal como
// "app" e esconderia a loja a quem está no site. O sessionStorage vive só na
// aba da app.

export type Plataforma = "web" | "android" | "ios";

const CHAVE = "ippon_app";

declare global {
  interface Window {
    Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string };
  }
}

let cache: Plataforma | null = null;

export function plataforma(): Plataforma {
  if (cache) return cache;
  if (typeof window === "undefined") return "web";
  let p: Plataforma = "web";
  try {
    const q = new URLSearchParams(window.location.search).get("app");
    const ua = navigator.userAgent || "";
    const cap = window.Capacitor;
    if (q === "android" || q === "ios") p = q;
    else if (cap?.isNativePlatform?.()) p = cap.getPlatform?.() === "android" ? "android" : "ios";
    else if (/IpponLeagueApp\/ios/i.test(ua)) p = "ios";
    else if (/IpponLeagueApp\/android/i.test(ua)) p = "android";
    else if ((document.referrer || "").startsWith("android-app://")) p = "android";
    else {
      const s = sessionStorage.getItem(CHAVE);
      if (s === "android" || s === "ios") p = s;
    }
    if (p !== "web") sessionStorage.setItem(CHAVE, p);
  } catch { /* em dúvida: web, que é o comportamento de sempre */ }
  cache = p;
  return p;
}

/** Está dentro de uma das apps das lojas? */
export function emApp(): boolean {
  return plataforma() !== "web";
}

/** Páginas de VENDA — dentro das apps, quem lá chegar volta ao início. */
export const PAGINAS_VENDA = ["/loja", "/ippon-pro", "/pro-max", "/sobre-pro", "/termos-pro"];

export function ehPaginaVenda(caminho: string): boolean {
  // /pro-max-central é a área do assinante, não a página de venda.
  if (caminho.startsWith("/pro-max-central")) return false;
  return PAGINAS_VENDA.some((p) => caminho === p || caminho.startsWith(p + "/"));
}
