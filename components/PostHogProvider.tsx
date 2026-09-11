"use client";

// components/PostHogProvider.tsx
//
// Envolve a app: (1) garante o arranque do analytics, (2) dispara o pageview a
// cada mudança de rota (o App Router não o faz sozinho), (3) monta o banner de
// consentimento. Não instrumenta nenhum evento de negócio — isso é nas telas.
//
// O rastreador de pageview vive dentro de <Suspense> porque usa
// useSearchParams(), que no App Router exige uma fronteira de Suspense; sem ela,
// a app inteira cairia em render dinâmico.

import { Suspense, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { initAnalytics, trackPageview } from "@/lib/analytics";
import { ConsentimentoAnalytics } from "@/components/ConsentimentoAnalytics";

function RastreadorPageview() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  useEffect(() => {
    if (!pathname) return;
    // Pré-consentimento o PostHog está opted-out, por isso isto é inofensivo.
    trackPageview(typeof window !== "undefined" ? window.location.href : undefined);
  }, [pathname, searchParams]);
  return null;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => { initAnalytics(); }, []);
  return (
    <>
      {children}
      <Suspense fallback={null}>
        <RastreadorPageview />
      </Suspense>
      <ConsentimentoAnalytics />
    </>
  );
}
