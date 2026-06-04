"use client";

import { useState, useEffect } from "react";
import { Mascot } from "@/components/Mascot";

const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";

const HAS_TEAM = false;
const USER = { belt: "Branca" };

const STEPS = [
  { title: "Sou o teu sensei!", text: "Vou ensinar-te a jogar em 1 minuto. Avança quando quiseres — ou pula." },
  { title: "Monta a tua equipa", text: "100 Judocoins, 8 atletas e 1 capitão (pontua a dobrar). É por aqui que começas." },
  { title: "Pontua pelas ações", text: "Ippon +10, waza-ari +4, shido a favor +1. Acompanhas tudo ao vivo no início." },
  { title: "Competições e ligas", text: "Cada Grand Slam ou Mundial é uma rodada. Dispute ligas mundial, nacional e de amigos." },
  { title: "Sobe de faixa", text: "O teu desempenho mensal muda a tua faixa — e o visual do jogo. Boa sorte!" },
];

const PRO_BENEFITS = ["Scout avançado dos atletas", "Valorização esperada da rodada", "Dicas e capitães recomendados", "Ligas e badges exclusivos"];

export default function Inicio() {
  const [phase, setPhase] = useState<"welcome" | "tutorial" | null>(null);
  const [step, setStep] = useState(0);
  const [name, setName] = useState("campeão");

  useEffect(() => {
    try {
      const savedName = localStorage.getItem("ippon_name");
      if (savedName) setName(savedName);
      if (localStorage.getItem("ippon_onboarding") === "pending") {
        setPhase("welcome");
      }
    } catch {}
  }, []);

  function finishOnboarding() {
    try {
      localStorage.setItem("ippon_onboarding", "done");
    } catch {}
    setPhase(null);
  }

  function openTutorial() {
    setStep(0);
    setPhase("tutorial");
  }

  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: FB }}>
      <style>{`@keyframes ilpulse{0%,100%{opacity:1}50%{opacity:.3}} .ilpulse{animation:ilpulse 1.2s ease-in-out infinite}`}</style>

      <div style={{ maxWidth: 460, margin: "0 auto", padding: "16px 14px 86px" }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <a href="/perfil" style={{ display: "flex", alignItems: "center", gap: 9, background: "#141a17", border: "1px solid #243029", borderRadius: 999, padding: "5px 14px 5px 5px", textDecoration: "none", color: "#f1ede2" }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#1c3a2e", overflow: "hidden", flexShrink: 0 }}>
              <Mascot belt="#efeadd" expression="feliz" />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.1 }}>{name}</div>
              <div style={{ fontSize: 11, color: GOLD }}>Faixa {USER.belt}</div>
            </div>
          </a>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={openTutorial} aria-label="Como se joga" style={iconBtn}>?</button>
            <div style={{ position: "relative", ...iconBtn, cursor: "default" }}>
              <BellIcon />
              <span style={{ position: "absolute", top: 7, right: 8, width: 7, height: 7, borderRadius: "50%", background: "#e2655a" }} />
            </div>
          </div>
        </header>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: GOLD, borderRadius: 14, padding: "11px 14px", marginBottom: 14 }}>
          <div>
            <div style={{ fontFamily: FD, fontSize: 15, fontWeight: 700, color: "#3a2a08", textTransform: "uppercase" }}>Ippon Pro · 4,90€</div>
            <div style={{ fontSize: 11, color: "#5c4410" }}>Joga com vantagem competitiva</div>
          </div>
          <span style={{ background: "#1b211e", color: GOLD, fontSize: 11, fontWeight: 700, padding: "7px 12px", borderRadius: 9, whiteSpace: "nowrap" }}>Assinar</span>
        </div>

        {HAS_TEAM ? <TeamBuilt /> : <TeamCreate />}

        <Card>
          <CardTitle>Próxima competição</CardTitle>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Grand Slam Paris 2026</div>
          <div style={{ fontSize: 12, color: "#93a39a", marginTop: 2 }}>Paris, França · Sénior</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
            <span style={{ fontSize: 12, color: "#7fd1a3" }}>Mercado fecha em 3d 14h</span>
            <a href="/criar-equipa" style={{ background: "#1c3a2e", color: "#aee9c9", fontSize: 11, fontWeight: 700, padding: "6px 12px", borderRadius: 8, textDecoration: "none" }}>Escalar</a>
          </div>
        </Card>

        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 9 }}>
            <span className="ilpulse" style={{ width: 8, height: 8, borderRadius: "50%", background: "#e2655a" }} />
            <span style={{ fontFamily: FD, fontSize: 14, fontWeight: 700, textTransform: "uppercase", color: "#e2655a" }}>Ao vivo agora</span>
          </div>
          {[["Abe", "Maruyama", "-66kg"], ["Agbegnenou", "Trstenjak", "-63kg"], ["Riner", "Saito", "+100kg"]].map(([a, b, cat]) => (
            <div key={cat} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "3px 0" }}>
              <span>{a} <span style={{ color: "#93a39a" }}>vs</span> {b}</span>
              <span style={{ color: "#93a39a", fontSize: 11 }}>{cat}</span>
            </div>
          ))}
        </Card>

        <a href="/ligas" style={{ textDecoration: "none", color: "inherit", display: "block" }}>
          <Card>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <CardTitle>As tuas ligas</CardTitle>
              <span style={{ fontFamily: FD, fontSize: 12, fontWeight: 700, color: GOLD }}>Ver todas ›</span>
            </div>
            {[["Mundial", "#1.243"], ["Continental · Europa", "#312"], ["Nacional · Portugal", "#14"]].map(([l, p]) => (
              <div key={l} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0" }}>
                <span style={{ fontSize: 13 }}>{l}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: GOLD }}>{p}</span>
              </div>
            ))}
          </Card>
        </a>

        <div style={{ marginTop: 4 }}>
          <div style={{ fontFamily: FD, fontSize: 14, fontWeight: 700, textTransform: "uppercase", marginBottom: 9 }}>Notícias e novidades</div>
          <div style={{ display: "flex", gap: 7, marginBottom: 10, flexWrap: "wrap" }}>
            <span style={{ background: "#1c3a2e", color: "#aee9c9", fontSize: 11, padding: "5px 11px", borderRadius: 999 }}>Judô</span>
            <span style={{ background: "#141a17", border: "1px solid #243029", color: "#93a39a", fontSize: 11, padding: "5px 11px", borderRadius: 999 }}>IJF</span>
            <span style={{ background: "#141a17", border: "1px solid #243029", color: "#93a39a", fontSize: 11, padding: "5px 11px", borderRadius: 999 }}>Grand Slam</span>
          </div>
          <div style={{ border: "1px solid #243029", borderRadius: 14, overflow: "hidden" }}>
            <div style={{ height: 96, background: "linear-gradient(135deg,#1c3a2e,#2a4d3e)" }} />
            <div style={{ padding: 11 }}>
              <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.25 }}>Quem pode valorizar no Grand Slam de Paris</div>
              <div style={{ fontSize: 11, color: "#93a39a", marginTop: 3 }}>Scout da rodada · há 2h</div>
            </div>
          </div>
        </div>
      </div>

      <nav style={{ position: "fixed", left: 0, right: 0, bottom: 0, height: 62, background: "#0f1411", borderTop: "1px solid #243029", display: "flex", alignItems: "center", justifyContent: "space-around" }}>
        <Tab label="Início" active icon={<HomeIcon />} href="/inicio" />
        <Tab label="Competições" icon={<TrophyIcon />} href="/ligas" />
        <Tab label="Pro" icon={<BoltIcon />} />
        <Tab label="Amigos" icon={<FriendsIcon />} />
      </nav>

      {phase === "welcome" && <Welcome name={name} onYosh={() => { setStep(0); setPhase("tutorial"); }} />}
      {phase === "tutorial" && <Tutorial step={step} setStep={setStep} onClose={finishOnboarding} />}
    </main>
  );
}

const iconBtn: React.CSSProperties = {
  width: 36, height: 36, borderRadius: "50%", border: "1px solid #243029", background: "transparent",
  color: "#93a39a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, cursor: "pointer",
};

function Card({ children }: { children: React.ReactNode }) {
  return <div style={{ background: "#121815", border: "1px solid #243029", borderRadius: 14, padding: 13, marginBottom: 12 }}>{children}</div>;
}
function CardTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily: FD, fontSize: 14, fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>{children}</div>;
}

function TeamCreate() {
  return (
    <div style={{ border: "1px solid #2a4d3e", borderRadius: 16, overflow: "hidden", marginBottom: 14, background: "repeating-linear-gradient(45deg,#1c3a2e 0 16px,#1a352a 16px 32px)" }}>
      <div style={{ padding: "20px 16px", textAlign: "center" }}>
        <div style={{ width: 64, height: 64, margin: "0 auto 6px" }}>
          <Mascot belt="#efeadd" expression="feliz" />
        </div>
        <div style={{ fontFamily: FD, fontSize: 20, fontWeight: 700, textTransform: "uppercase" }}>Cria a tua equipa</div>
        <div style={{ fontSize: 12, color: "#cfe4d8", margin: "4px 0 14px" }}>Monta 8 atletas com 100 Judocoins e escolhe o teu capitão.</div>
        <a href="/criar-equipa" style={{ display: "block", background: GOLD, color: "#1b211e", fontFamily: FD, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", padding: 13, borderRadius: 11, fontSize: 15, textDecoration: "none" }}>
          Criar a minha equipa
        </a>
      </div>
    </div>
  );
}

function TeamBuilt() {
  return (
    <div style={{ border: "1px solid #243029", borderRadius: 16, overflow: "hidden", marginBottom: 14 }}>
      <div style={{ background: "#1c3a2e", padding: 9, textAlign: "center", fontFamily: FD, fontSize: 13, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#aee9c9" }}>Mundial</div>
      <div style={{ background: "#0f1411", padding: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <div style={{ width: 48, height: 48 }}>
            <Mascot belt="#7a4fa3" expression="determinado" />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>Dojo dos Sonhos</div>
            <div style={{ fontSize: 12, color: GOLD }}>Faixa Roxa</div>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", textAlign: "center", marginBottom: 12 }}>
          {[["JC 100", "Património"], ["86", "Última"], ["86", "Total"]].map(([v, l]) => (
            <div key={l}>
              <div style={{ fontFamily: FD, fontSize: 17, fontWeight: 700, color: l === "Património" ? GOLD : "#f1ede2" }}>{v}</div>
              <div style={{ fontSize: 10, color: "#93a39a", textTransform: "uppercase" }}>{l}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 12, color: "#7fd1a3", marginBottom: 10 }}>Mercado fecha em 3d 14h</div>
        <a href="/meu-time" style={{ display: "block", background: GOLD, color: "#1b211e", textAlign: "center", fontFamily: FD, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", padding: 12, borderRadius: 11, fontSize: 14, textDecoration: "none" }}>
          Ver o meu time
        </a>
      </div>
    </div>
  );
}

function Tab({ label, icon, active, href }: { label: string; icon: React.ReactNode; active?: boolean; href?: string }) {
  const baseStyle: React.CSSProperties = { display: "flex", flexDirection: "column", alignItems: "center", gap: 3, color: active ? GOLD : "#6f7d76", textDecoration: "none" };
  const content = (
    <>
      {icon}
      <span style={{ fontSize: 11, fontWeight: active ? 700 : 400 }}>{label}</span>
    </>
  );
  return href ? <a href={href} style={baseStyle}>{content}</a> : <div style={baseStyle}>{content}</div>;
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(6,8,7,0.78)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18, zIndex: 100 }}>
      <div style={{ width: "100%", maxWidth: 320 }}>{children}</div>
    </div>
  );
}

function Welcome({ name, onYosh }: { name: string; onYosh: () => void }) {
  return (
    <Overlay>
      <div style={{ background: "#121815", border: `1px solid ${GOLD}`, borderRadius: 16, padding: 22, textAlign: "center" }}>
        <div style={{ width: 92, height: 92, margin: "0 auto 4px" }}>
          <Mascot belt="#141110" expression="comemorando" />
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: GOLD }}>Bem-vindo ao dojo</div>
        <h1 style={{ fontFamily: FD, fontSize: 24, fontWeight: 700, textTransform: "uppercase", margin: "4px 0 8px" }}>Olá, {name}!</h1>
        <p style={{ fontSize: 14, color: "#c7d0c9", lineHeight: 1.55, margin: "0 0 20px" }}>
          Conseguiste! A tua conta está pronta e nós vamos divertir-nos muito. Monta a tua equipa, chama os amigos e vê quem é o melhor sensei!
        </p>
        <button onClick={onYosh} style={{ width: "100%", padding: 14, borderRadius: 12, border: "none", background: GOLD, color: "#1b211e", fontFamily: FD, fontSize: 17, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", cursor: "pointer" }}>
          Yosh!
        </button>
        <div style={{ fontSize: 11, color: "#7c8a82", marginTop: 8 }}>“Yosh!” — vamos lá, em japonês</div>
      </div>
    </Overlay>
  );
}

function Tutorial({ step, setStep, onClose }: { step: number; setStep: (s: number) => void; onClose: () => void }) {
  const isPro = step >= STEPS.length;
  const total = STEPS.length + 1;
  return (
    <Overlay>
      <div style={{ textAlign: "right", marginBottom: 8 }}>
        <button onClick={onClose} style={{ background: "transparent", border: "none", color: "#cfd8d2", fontSize: 12, cursor: "pointer", fontFamily: FB }}>
          {isPro ? "Fechar ✕" : "Pular tutorial ✕"}
        </button>
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} style={{ flex: 1, height: 4, borderRadius: 999, background: i <= step ? GOLD : "#3a463f" }} />
        ))}
      </div>

      {!isPro ? (
        <div style={{ background: "#121815", border: `1px solid ${GOLD}`, borderRadius: 16, padding: 18 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={{ width: 64, height: 64, flexShrink: 0 }}>
              <Mascot belt="#141110" expression="indicando" />
            </div>
            <div>
              <div style={{ fontFamily: FD, fontSize: 16, fontWeight: 700, textTransform: "uppercase", marginBottom: 5 }}>{STEPS[step].title}</div>
              <p style={{ fontSize: 13, color: "#c7d0c9", lineHeight: 1.5, margin: 0 }}>{STEPS[step].text}</p>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16 }}>
            <button onClick={() => step > 0 && setStep(step - 1)} style={{ background: "transparent", border: "none", color: step === 0 ? "#3c463f" : "#93a39a", fontSize: 13, fontWeight: 700, cursor: step === 0 ? "default" : "pointer", fontFamily: FB }}>Anterior</button>
            <span style={{ fontSize: 11, color: "#5f6f67" }}>{step + 1} de {total}</span>
            <button onClick={() => setStep(step + 1)} style={{ background: GOLD, border: "none", color: "#1b211e", padding: "9px 18px", borderRadius: 9, fontFamily: FD, fontSize: 13, fontWeight: 700, textTransform: "uppercase", cursor: "pointer" }}>Seguinte</button>
          </div>
        </div>
      ) : (
        <div style={{ background: "#121815", border: `1px solid ${GOLD}`, borderRadius: 16, padding: 18, textAlign: "center" }}>
          <div style={{ width: 72, height: 72, margin: "0 auto 2px" }}>
            <Mascot belt="#141110" expression="sabio" />
          </div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: GOLD }}>Oferta de lançamento</div>
          <div style={{ fontFamily: FD, fontSize: 18, fontWeight: 700, textTransform: "uppercase", margin: "4px 0" }}>Ippon Pro</div>
          <div style={{ margin: "6px 0 12px" }}>
            <span style={{ fontSize: 14, color: "#7c8a82", textDecoration: "line-through" }}>9,90€</span>{" "}
            <span style={{ fontFamily: FD, fontSize: 28, fontWeight: 700, color: GOLD }}>4,90€</span>
            <span style={{ fontSize: 12, color: "#93a39a" }}>/mês</span>
          </div>
          <div style={{ textAlign: "left", display: "flex", flexDirection: "column", gap: 7, marginBottom: 16 }}>
            {PRO_BENEFITS.map((b) => (
              <div key={b} style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
                <span style={{ color: GOLD, fontWeight: 700 }}>✓</span>
                <span style={{ fontSize: 13, color: "#c7d0c9" }}>{b}</span>
              </div>
            ))}
          </div>
          <button onClick={onClose} style={{ width: "100%", background: GOLD, color: "#1b211e", border: "none", fontFamily: FD, fontWeight: 700, textTransform: "uppercase", padding: 11, borderRadius: 10, fontSize: 14, cursor: "pointer" }}>Quero o Ippon Pro</button>
          <button onClick={onClose} style={{ marginTop: 10, background: "transparent", border: "none", color: "#93a39a", fontSize: 12, cursor: "pointer", fontFamily: FB }}>Talvez depois</button>
        </div>
      )}
    </Overlay>
  );
}

function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}
function HomeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" />
    </svg>
  );
}
function TrophyIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 4h8v5a4 4 0 0 1-8 0V4z" /><path d="M8 6H5v2a3 3 0 0 0 3 3M16 6h3v2a3 3 0 0 1-3 3M10 17h4M9 21h6M12 13v4" />
    </svg>
  );
}
function BoltIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />
    </svg>
  );
}
function FriendsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
