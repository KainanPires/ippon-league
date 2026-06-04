"use client";

import { useState, useEffect } from "react";
import { Mascot } from "@/components/Mascot";
import { type Athlete } from "@/lib/athletes";
import { loadDraft, saveDraft, loadSaved, commitSaved, resolve, jcLeft, counts, isComplete, missing, type TeamState } from "@/lib/team";

const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";

const IOC: Record<string, string> = {
  JP: "JPN", FR: "FRA", BR: "BRA", GE: "GEO", KZ: "KAZ", AZ: "AZE", BE: "BEL",
  TR: "TUR", UZ: "UZB", RU: "AIN", DE: "GER", XK: "KOS", IT: "ITA", CA: "CAN",
  SI: "SLO", HR: "CRO", NL: "NED",
};
const code3 = (iso: string) => IOC[iso] || iso;
const fmt = (n: number) => String(Math.round(n * 10) / 10);

type Guide = "welcome" | "counter" | "slot" | null;
type Modal = { kind: "missing" | "saved" | "trash" } | { kind: "athlete"; a: Athlete } | null;

export default function CriarEquipa() {
  const [guide, setGuide] = useState<Guide>(null);
  const [draft, setDraft] = useState<TeamState>({ ids: [], captain: null });
  const [saved, setSaved] = useState<TeamState>({ ids: [], captain: null });
  const [modal, setModal] = useState<Modal>(null);

  useEffect(() => {
    try {
      setDraft(loadDraft());
      setSaved(loadSaved());
      if (!localStorage.getItem("ippon_team_tutorial")) setGuide("welcome");
    } catch {}
  }, []);

  function update(next: TeamState) { setDraft(next); saveDraft(next); }
  function naoMostrarMais() { try { localStorage.setItem("ippon_team_tutorial", "skip"); } catch {} setGuide(null); }
  function openGuide() { setGuide("welcome"); }

  function setCaptain(id: string) {
    update({ ...draft, captain: draft.captain === id ? null : id });
    setModal(null);
  }
  function clearAll() { update({ ids: [], captain: null }); setModal(null); }
  function revert() { setDraft(saved); saveDraft(saved); }
  function save() {
    if (isComplete(draft)) { commitSaved(draft); setSaved(draft); setModal({ kind: "saved" }); }
    else { setModal({ kind: "missing" }); }
  }

  const all = resolve(draft.ids);
  const males = all.filter((a) => a.gender === "M");
  const females = all.filter((a) => a.gender === "F");
  const total = all.length;
  const left = jcLeft(draft);
  const changed = JSON.stringify(draft) !== JSON.stringify(saved);
  const firstEmpty = males.length < 4 ? { row: "M", i: males.length } : females.length < 4 ? { row: "F", i: females.length } : null;

  function renderRow(list: Athlete[], row: "M" | "F") {
    return Array.from({ length: 4 }).map((_, i) => {
      const a = list[i];
      const highlight = guide === "slot" && firstEmpty != null && firstEmpty.row === row && firstEmpty.i === i;
      return a
        ? <FilledSlot key={row + i} a={a} isCaptain={draft.captain === a.id} onClick={() => setModal({ kind: "athlete", a })} />
        : <EmptySlot key={row + i} highlight={highlight} />;
    });
  }

  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: FB }}>
      <style>{`@keyframes ilglow{0%,100%{box-shadow:0 0 0 3px rgba(74,144,217,0.55)}50%{box-shadow:0 0 0 8px rgba(74,144,217,0.18)}} .ilglow{animation:ilglow 1.3s ease-in-out infinite;border-radius:10px}`}</style>

      <div style={{ maxWidth: 460, margin: "0 auto", padding: "14px 14px 104px" }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
            <a href="/inicio" aria-label="Voltar" style={{ width: 36, height: 36, borderRadius: "50%", border: "1px solid #243029", display: "flex", alignItems: "center", justifyContent: "center", color: "#cfd8d2", textDecoration: "none", flexShrink: 0 }}>
              <BackIcon />
            </a>
            <div style={{ width: 40, height: 46, flexShrink: 0 }}><EscudoPlaceholder /></div>
            <div style={{ minWidth: 0 }}>
              <h1 style={{ fontFamily: FD, fontSize: 18, fontWeight: 700, textTransform: "uppercase", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>A tua equipa</h1>
              <div style={{ fontSize: 11, color: "#93a39a" }}>1 por categoria · 4 masc + 4 fem</div>
            </div>
          </div>
          <button onClick={openGuide} aria-label="Como montar a equipa" style={{ width: 36, height: 36, bo
