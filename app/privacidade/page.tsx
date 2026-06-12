"use client";

import { useEffect, useState } from "react";
import { temSessao } from "@/lib/auth";

const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";
const EMAIL = "support@ipponleague.com";
const ATUALIZADO = "junho de 2026";

export default function Privacidade() {
  const [logado, setLogado] = useState(false);
  useEffect(() => { temSessao().then(setLogado).catch(() => setLogado(false)); }, []);

  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: FB }}>
      <div style={{ maxWidth: 460, margin: "0 auto", padding: "14px 16px 48px" }}>
        <header style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 8 }}>
          <a href={logado ? "/perfil" : "/"} aria-label="Voltar" style={{ width: 34, height: 34, borderRadius: "50%", border: "1px solid #243029", display: "flex", alignItems: "center", justifyContent: "center", color: "#cfd8d2", textDecoration: "none", flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
          </a>
          <h1 style={{ fontFamily: FD, fontSize: 18, fontWeight: 700, textTransform: "uppercase", margin: 0 }}>Política de privacidade</h1>
        </header>
        <p style={{ fontSize: 12, color: "#7c8a82", margin: "0 0 18px" }}>Última atualização: {ATUALIZADO}</p>

        <Intro>
          A tua privacidade é importante para nós. Esta política explica, de forma simples, que dados recolhemos, para que os usamos e que direitos tens. A Ippon League é gerida por Kainan Pires (o &quot;responsável&quot;), com sede em Portugal.
        </Intro>

        <Sec n="1" t="Que dados recolhemos">
          Recolhemos os dados que nos dás ao criar conta e ao jogar:
          <Lista itens={[
            "Dados de conta: email, nome, telefone e país.",
            "Dados de jogo: a tua equipa, escudo, pontuação, faixa e atividade dentro do jogo.",
            "Dados técnicos básicos necessários para a app funcionar (por exemplo, para te manter com sessão iniciada).",
          ]} />
        </Sec>

        <Sec n="2" t="Para que usamos os teus dados">
          Usamos os teus dados para:
          <Lista itens={[
            "Criar e gerir a tua conta.",
            "Fazer o jogo funcionar: montar equipas, calcular pontuações, ligas e rankings.",
            "Comunicar contigo sobre o jogo (avisos importantes, mudanças no serviço).",
            "Enviar novidades e ofertas — apenas se deres o teu consentimento (ver ponto 4).",
            "Melhorar a app e perceber como podemos torná-la melhor para ti.",
          ]} />
        </Sec>

        <Sec n="3" t="Base legal">
          Tratamos os teus dados com base na execução do serviço que pediste (a tua conta e o jogo), no teu consentimento (para marketing) e no nosso interesse legítimo em melhorar a Ippon League. Não vendemos os teus dados pessoais a terceiros.
        </Sec>

        <Sec n="4" t="Comunicações de marketing">
          Só te enviamos novidades e ofertas se tu o autorizares expressamente. Podes retirar esse consentimento a qualquer momento — em cada email haverá uma forma de cancelar, ou podes escrever-nos. Cancelar o marketing não afeta a tua conta nem o jogo.
        </Sec>

        <Sec n="5" t="Os teus direitos">
          Tens o direito de, a qualquer momento:
          <Lista itens={[
            "Aceder aos teus dados e saber o que temos sobre ti.",
            "Corrigir dados incorretos ou desatualizados.",
            "Apagar a tua conta e os teus dados.",
            "Retirar o consentimento de marketing.",
            "Opor-te a determinados tratamentos.",
          ]} />
          Para exercer qualquer destes direitos, escreve-nos para <Email />.
        </Sec>

        <Sec n="6" t="Durante quanto tempo guardamos os dados">
          Guardamos os teus dados enquanto a tua conta estiver ativa. Se apagares a conta, eliminamos ou anonimizamos os teus dados pessoais, exceto o que a lei nos obrigue a manter.
        </Sec>

        <Sec n="7" t="Segurança">
          Usamos serviços e medidas técnicas para proteger os teus dados. Ainda assim, nenhum sistema é 100% infalível — comprometemo-nos a agir com diligência e a avisar-te se algo de grave acontecer aos teus dados.
        </Sec>

        <Sec n="8" t="Idade mínima">
          A Ippon League destina-se a maiores de 16 anos. Se tomarmos conhecimento de que recolhemos dados de alguém com menos de 16 anos sem a devida autorização, eliminamos esses dados.
        </Sec>

        <Sec n="9" t="Alterações a esta política">
          Esta política pode ser atualizada à medida que a Ippon League evolui e passa a recolher ou usar novos dados. Quando isso acontecer, atualizamos esta página e a data no topo. Aconselhamos-te a consultá-la de vez em quando.
        </Sec>

        <Sec n="10" t="Contacto">
          Para qualquer questão sobre privacidade ou sobre os teus dados, fala connosco: <Email />.
        </Sec>

        <div style={{ background: "#121815", border: "1px solid #243029", borderRadius: 12, padding: "14px 16px", marginTop: 8 }}>
          <p style={{ fontSize: 12, color: "#7c8a82", lineHeight: 1.6, margin: 0 }}>Esta é uma versão inicial da nossa política de privacidade, criada para a fase de testes da Ippon League. Será revista e formalizada à medida que o projeto cresce.</p>
        </div>
      </div>
    </main>
  );
}

function Intro({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 14.5, color: "#c7d0c9", lineHeight: 1.7, margin: "0 0 22px" }}>{children}</p>;
}

function Sec({ n, t, children }: { n: string; t: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 22 }}>
      <h2 style={{ fontFamily: FD, fontSize: 15, fontWeight: 700, textTransform: "uppercase", margin: "0 0 8px", color: GOLD }}>{n}. {t}</h2>
      <div style={{ fontSize: 14, color: "#c7d0c9", lineHeight: 1.65 }}>{children}</div>
    </section>
  );
}

function Lista({ itens }: { itens: string[] }) {
  return (
    <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
      {itens.map((it, i) => (
        <li key={i} style={{ marginBottom: 6, lineHeight: 1.6 }}>{it}</li>
      ))}
    </ul>
  );
}

function Email() {
  return <a href={`mailto:${EMAIL}`} style={{ color: GOLD, fontWeight: 700, textDecoration: "none" }}>{EMAIL}</a>;
}
