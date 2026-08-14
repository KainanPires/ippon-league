"use client";

// components/CarregarHorarios.tsx
//
// Ao arrancar a app, busca os horários manuais (/api/horarios) e injeta-os no
// lib/calendario. A partir daí, todos os ecrãs usam o fecho de mercado certo,
// sem precisarem de saber deste componente. Renderiza nada.
import { useEffect } from "react";
import { aplicarHorarios } from "@/lib/calendario";

export function CarregarHorarios() {
  useEffect(() => {
    let vivo = true;
    fetch("/api/horarios")
      .then((r) => r.json())
      .then((j) => { if (vivo && j?.horarios) aplicarHorarios(j.horarios); })
      .catch(() => { /* fica na estimativa por fuso */ });
    return () => { vivo = false; };
  }, []);
  return null;
}
