"use client";

// app/privacidade/page.tsx — Política de Privacidade, na língua escolhida na app.
import { PaginaLegal } from "@/components/PaginaLegal";
import { PRIVACIDADE } from "@/lib/legal";

export default function PrivacidadePage() {
  return <PaginaLegal docs={PRIVACIDADE} />;
}
