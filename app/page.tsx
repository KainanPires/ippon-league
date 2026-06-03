export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-12 relative overflow-hidden"
      style={{ background: "#1565C0", fontFamily: "'Nunito', sans-serif" }}>

      {/* Círculos de fundo */}
      <div className="absolute rounded-full pointer-events-none"
        style={{ width: 280, height: 280, background: "#1976D2", top: -100, right: -80, opacity: 0.5 }} />
      <div className="absolute rounded-full pointer-events-none"
        style={{ width: 180, height: 180, background: "#1976D2", bottom: -50, left: -50, opacity: 0.35 }} />

      {/* Badge */}
      <div className="mb-5 px-4 py-1 rounded-full text-xs font-black uppercase tracking-widest"
        style={{ background: "#FDD835", color: "#0D47A1" }}>
        Fantasy Game de Judô
      </div>

      {/* Logo */}
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl font-black"
          style={{ background: "#FDD835", color: "#0D47A1" }}>
          一
        </div>
        <h1 className="text-4xl font-black text-white tracking-tight">Ippon League</h1>
      </div>

      {/* Tagline */}
      <p className="text-xs font-bold uppercase tracking-widest mb-6" style={{ color: "#BBDEFB" }}>
        O jogo oficial dos fãs de judô
      </p>

      {/* Mascote SVG */}
      <svg width="180" height="200" viewBox="0 0 180 200" className="mb-5">
        <ellipse cx="90" cy="182" rx="42" ry="7" fill="rgba(0,0,0,0.18)" />
        <ellipse cx="90" cy="138" rx="36" ry="44" fill="#4DB6AC" />
        <ellipse cx="90" cy="92" rx="32" ry="34" fill="#4DB6AC" />
        <ellipse cx="38" cy="128" rx="22" ry="12" fill="white" transform="rotate(-30,38,128)" />
        <ellipse cx="142" cy="128" rx="22" ry="12" fill="white" transform="rotate(30,142,128)" />
        <ellipse cx="38" cy="128" rx="18" ry="9" fill="#f0f0f0" transform="rotate(-30,38,128)" />
        <ellipse cx="142" cy="128" rx="18" ry="9" fill="#f0f0f0" transform="rotate(30,142,128)" />
        <ellipse cx="24" cy="138" rx="10" ry="6" fill="#E65100" transform="rotate(-30,24,138)" />
        <ellipse cx="156" cy="138" rx="10" ry="6" fill="#E65100" transform="rotate(30,156,138)" />
        <ellipse cx="24" cy="139" rx="8" ry="4" fill="#FF8F00" transform="rotate(-30,24,139)" />
        <ellipse cx="156" cy="139" rx="8" ry="4" fill="#FF8F00" transform="rotate(30,156,139)" />
        <line x1="17" y1="136" x2="31" y2="140" stroke="#BF360C" strokeWidth="1" />
        <line x1="149" y1="136" x2="163" y2="140" stroke="#BF360C" strokeWidth="1" />
        <ellipse cx="90" cy="92" rx="30" ry="32" fill="#4DB6AC" />
        <ellipse cx="77" cy="82" rx="9" ry="10" fill="white" />
        <ellipse cx="103" cy="82" rx="9" ry="10" fill="white" />
        <circle cx="78" cy="83" r="6" fill="#1A237E" />
        <circle cx="104" cy="83" r="6" fill="#1A237E" />
        <circle cx="80" cy="81" r="2.5" fill="white" />
        <circle cx="106" cy="81" r="2.5" fill="white" />
        <ellipse cx="90" cy="105" rx="26" ry="11" fill="#E65100" />
        <ellipse cx="90" cy="105" rx="23" ry="8" fill="#FF8F00" />
        <ellipse cx="90" cy="109" rx="20" ry="6" fill="#E65100" />
        <path d="M77 103 Q90 109 103 103" stroke="#BF360C" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        <rect x="58" y="120" width="64" height="52" rx="7" fill="white" />
        <rect x="58" y="120" width="32" height="52" rx="4" fill="white" />
        <rect x="90" y="120" width="32" height="52" rx="4" fill="white" />
        <line x1="58" y1="122" x2="90" y2="146" stroke="#E0E0E0" strokeWidth="1.5" />
        <line x1="122" y1="122" x2="90" y2="146" stroke="#E0E0E0" strokeWidth="1.5" />
        <rect x="67" y="140" width="46" height="8" rx="4" fill="#212121" />
        <ellipse cx="72" cy="172" rx="12" ry="7" fill="#E65100" />
        <ellipse cx="108" cy="172" rx="12" ry="7" fill="#E65100" />
        <ellipse cx="72" cy="173" rx="10" ry="5" fill="#FF8F00" />
        <ellipse cx="108" cy="173" rx="10" ry="5" fill="#FF8F00" />
        <ellipse cx="90" cy="65" rx="10" ry="6" fill="#26A69A" transform="rotate(-5,90,65)" />
        <ellipse cx="87" cy="59" rx="7" ry="4" fill="#26A69A" transform="rotate(10,87,59)" />
        <ellipse cx="93" cy="59" rx="7" ry="4" fill="#26A69A" transform="rotate(-10,93,59)" />
      </svg>

      {/* Descrição */}
      <p className="text-center text-sm leading-relaxed mb-8 max-w-xs" style={{ color: "#E3F2FD" }}>
        Monta a tua equipa com{" "}
        <span className="font-black" style={{ color: "#FDD835" }}>100 Judocoins</span>,
        escolhe o capitão, pontua pelas ações reais e sobe de faixa com fãs do mundo inteiro.
      </p>

      {/* Botões */}
      <div className="flex gap-3 w-full max-w-xs mb-7">
        <button className="flex-1 py-4 rounded-2xl text-base font-black cursor-pointer border-0"
          style={{ background: "#FDD835", color: "#0D47A1" }}>
          Começar a jogar
        </button>
        <button className="flex-1 py-4 rounded-2xl text-base font-bold cursor-pointer text-white"
          style={{ background: "rgba(255,255,255,0.12)", border: "2px solid rgba(255,255,255,0.3)" }}>
          Saber mais
        </button>
      </div>

      {/* Stats */}
      <div className="flex gap-2 w-full max-w-xs mb-6">
        {[
          { val: "100", lbl: "Judocoins" },
          { val: "8", lbl: "Atletas" },
          { val: "7", lbl: "Faixas" },
          { val: "+10", lbl: "Por Ippon" },
        ].map((s) => (
          <div key={s.lbl} className="flex-1 rounded-xl py-2 text-center"
            style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)" }}>
            <div className="text-lg font-black" style={{ color: "#FDD835" }}>{s.val}</div>
            <div className="text-xs font-bold uppercase tracking-wide mt-0.5" style={{ color: "#BBDEFB" }}>{s.lbl}</div>
          </div>
        ))}
      </div>

      {/* Faixas */}
      <div className="flex gap-1.5 mb-1.5">
        {["#f5f5f5", "#1565C0", "#FDD835", "#2E7D32", "#7B1FA2", "#4E2C0E", "#212121"].map((c, i) => (
          <div key={i} className="w-8 h-2 rounded-full"
            style={{ background: c, border: i === 0 || i === 6 ? "1px solid rgba(255,255,255,0.3)" : "none" }} />
        ))}
      </div>
      <p className="text-xs mb-5" style={{ color: "#90CAF9" }}>
        branca · azul · amarela · verde · roxa · marrom · preta
      </p>

      {/* Valorização */}
      <div className="flex gap-2">
        <div className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-black"
          style={{ background: "rgba(76,175,80,0.2)", color: "#A5D6A7", border: "1px solid rgba(76,175,80,0.4)" }}>
          +12.5 JC valorização
        </div>
        <div className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-black"
          style={{ background: "rgba(244,67,54,0.2)", color: "#EF9A9A", border: "1px solid rgba(244,67,54,0.4)" }}>
          -3.2 JC desvalorização
        </div>
      </div>

    </main>
  );
}