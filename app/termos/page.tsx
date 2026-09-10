"use client";

// app/termos/page.tsx — Termos de Utilização, na língua escolhida na app.
import { PaginaLegal } from "@/components/PaginaLegal";
import { TERMOS } from "@/lib/legal";

export default function TermosPage() {
  return <PaginaLegal docs={TERMOS} />;
}
