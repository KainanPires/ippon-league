"use client";

// HOOK reutilizável: lembrete "esqueceste de salvar o teu time".
//
// PROBLEMA que resolve: o gatilho antigo vivia só na página "Meu Time" e
// dependia do estado `dirty` dessa página. Mas a edição real acontece sobretudo
// no MERCADO (escolher/trocar atletas), pelo que sair do mercado nunca disparava
// o lembrete. Aqui a regra deixa de depender da página: o que conta é se existe
// um RASCUNHO por salvar (diferente da equipa guardada, com ≥1 atleta).
//
// COMO USAR (em qualquer página de edição — mercado, meu-time, criar-equipa):
//   useLembreteSalvar(userId, idComp);
// onde userId é o id da conta (ou null) e idComp a competição de mercado aberto.
//
// COMPORTAMENTO:
//  • Ao SAIR do ecrã (visibilitychange → página escondida) com rascunho por
//    salvar → agenda o lembrete no servidor (/api/lembrete-salvar, acao agendar).
//  • Ao VOLTAR ao ecrã sem nada por salvar → cancela.
//  • Usa keepalive: o pedido completa mesmo com a página a adormecer (iOS).
//  • O servidor é a barreira final: recusa agendar com mercado fechado.
//
// "Por salvar" = loadDraftFor(idComp) difere de loadSavedFor(idComp) E o
// rascunho tem pelo menos 1 atleta. (Decisão de produto: apanhar quem montou a
// meio e se distraiu.)
import { useEffect } from "react";
import { loadDraftFor, loadSavedFor, type TeamState } from "@/lib/team";

function mesmaEquipa(a: TeamState, b: TeamState): boolean {
  if ((a.captain || "") !== (b.captain || "")) return false;
  if (a.ids.length !== b.ids.length) return false;
  return [...a.ids].sort().join(",") === [...b.ids].sort().join(",");
}

// Há um rascunho que vale a pena lembrar de salvar?
function haRascunhoPorSalvar(idComp: string): boolean {
  try {
    const rascunho = loadDraftFor(idComp);
    if (!rascunho || rascunho.ids.length === 0) return false; // nada montado
    const guardado = loadSavedFor(idComp);
    return !mesmaEquipa(rascunho, guardado); // só se difere do que está guardado
  } catch {
    return false;
  }
}

function agendar(userId: string, idComp: string) {
  try {
    fetch("/api/lembrete-salvar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, id_competicao: idComp, acao: "agendar" }),
      keepalive: true,
    }).catch(() => {});
  } catch { /* sem rede: não bloqueia */ }
}
function cancelar(userId: string, idComp: string) {
  try {
    fetch("/api/lembrete-salvar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, id_competicao: idComp, acao: "cancelar" }),
      keepalive: true,
    }).catch(() => {});
  } catch { /* sem rede: não bloqueia */ }
}

export function useLembreteSalvar(userId: string | null | undefined, idComp: string | null | undefined) {
  useEffect(() => {
    if (!userId || !idComp) return;
    const uid = userId;
    const comp = idComp;
    function aoMudarVisibilidade() {
      if (typeof document === "undefined") return;
      if (document.hidden) {
        // Saiu do ecrã: se há rascunho por salvar, agenda o lembrete.
        if (haRascunhoPorSalvar(comp)) agendar(uid, comp);
      } else {
        // Voltou ao ecrã: se já não há nada por salvar, cancela.
        if (!haRascunhoPorSalvar(comp)) cancelar(uid, comp);
      }
    }
    document.addEventListener("visibilitychange", aoMudarVisibilidade);
    return () => document.removeEventListener("visibilitychange", aoMudarVisibilidade);
  }, [userId, idComp]);
}
