"use client";

import { useEffect, useState } from "react";
import { temSessao } from "@/lib/auth";

const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";
const EMAIL = "support@ipponleague.com";
const ATUALIZADO = "junho de 2026";

export default function Termos() {
  const [logado, setLogado] = useState(false);
  useEffect(() => { temSessao().then(setLogado).catch(() => setLogado(false)); }, []);

  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: FB }}>
      <div style={{ maxWidth: 460, margin: "0 auto", padding: "14px 16px 48px" }}>
        <header style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 8 }}>
          <a href={logado ? "/perfil" : "/"} aria-label="Voltar" style={{ width: 34, height: 34, borderRadius: "50%", border: "1px solid #243029", display: "flex", alignItems: "center", justifyContent: "center", color: "#cfd8d2", textDecoration: "none", flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
          </a>
          <h1 style={{ fontFamily: FD, fontSize: 18, fontWeight: 700, textTransform: "uppercase", margin: 0 }}>Termos de utilização</h1>
        </header>
        <p style={{ fontSize: 12, color: "#7c8a82", margin: "0 0 18px" }}>Última atualização: {ATUALIZADO}</p>

        <Intro>
          Bem-vindo à Ippon League. Estes termos definem as regras de utilização da plataforma, gerida por Kainan Pires (o &quot;responsável&quot;), com sede em Portugal. Ao criar conta ou usar a Ippon League, aceitas estes termos. Se não concordares, não deverás usar a plataforma.
        </Intro>

        <Sec n="1" t="Quem pode usar">
          A Ippon League destina-se a pessoas com 16 anos ou mais. Ao usar a plataforma, declaras ter pelo menos 16 anos.
        </Sec>

        <Sec n="2" t="A tua conta">
          És responsável por manter os teus dados de conta corretos e por guardar a tua palavra-passe em segurança. Não partilhes a tua conta com terceiros. Avisa-nos se suspeitares de qualquer acesso indevido.
        </Sec>

        <Sec n="3" t="Como deves usar a Ippon League">
          Comprometes-te a usar a plataforma de forma justa e respeitosa. Em particular, não deves:
          <Lista itens={[
            "Tentar manipular pontuações, rankings ou o sistema de jogo.",
            "Usar robôs, scripts ou meios automáticos para obter vantagem.",
            "Criar contas falsas ou múltiplas para fins abusivos.",
            "Perturbar o funcionamento da plataforma ou prejudicar outros jogadores.",
          ]} />
          Podemos suspender ou encerrar contas que violem estas regras.
        </Sec>

        <Sec n="4" t="O jogo e os dados das competições">
          As pontuações baseiam-se nas ações reais dos atletas em competições oficiais, a partir de dados de fontes externas (como o JudoBase/IJF). Esses dados podem conter atrasos, erros ou indisponibilidades fora do nosso controlo. Esforçamo-nos por refletir os resultados com rigor, mas não podemos garantir que estejam sempre completos ou imediatos.
        </Sec>

        <Sec n="5" t="Ippon Pro (assinatura)">
          O Ippon Pro é uma assinatura opcional. As suas condições são:
          <Lista itens={[
            "Período gratuito de 7 dias: se cancelares dentro desses 7 dias, não és cobrado.",
            "Após o período gratuito, a assinatura é anual e renova-se automaticamente.",
            "Podes cancelar quando quiseres: manténs o acesso até ao fim do período já pago e não há nova renovação.",
            "O cancelamento não dá direito a reembolso do período em curso.",
          ]} />
        </Sec>

        <Sec n="6" t="O Ippon Pro é informativo — não garante resultados">
          Esta é uma condição essencial. O Ippon Pro oferece <strong style={{ color: GOLD }}>apenas informação</strong>, baseada em dados e no histórico dos atletas: resultados em competições passadas e tendências de desempenho com base nesse histórico. O Ippon Pro <strong style={{ color: GOLD }}>não monta a tua equipa por ti, não indica em quem apostar e não diz quem vai ganhar</strong>. Ao assinar, reconheces e aceitas que o Ippon Pro é <strong style={{ color: GOLD }}>meramente informativo e não garante qualquer resultado</strong> — nem vitórias, nem pontuação, nem subida de faixa, nem prémios. As leituras que mostramos são possibilidades e tendências, nunca certezas, e a decisão é sempre tua. O responsável não se responsabiliza por decisões tomadas com base nestas informações.
        </Sec>

        <Sec n="7" t="Prémios">
          A Ippon League pode atribuir prémios em determinadas ligas (por exemplo, prémios por rodada e de fim de temporada na Liga Mundial, e de fim de temporada na Liga Continental). Os prémios, condições de elegibilidade e formas de atribuição são definidos a cada temporada, podem depender de patrocinadores e podem ser alterados. A elegibilidade pode estar associada à assinatura Ippon Pro.
        </Sec>

        <Sec n="8" t="Conteúdo e propriedade">
          A marca Ippon League, o seu design, textos, logótipos e mascote são propriedade do responsável e não podem ser usados sem autorização. Os nomes de atletas e dados de competições pertencem às respetivas entidades e são usados apenas para fins informativos e de jogo.
        </Sec>

        <Sec n="9" t="Limitação de responsabilidade">
          A Ippon League é fornecida &quot;tal como está&quot;. Esforçamo-nos por manter o serviço disponível e correto, mas não garantimos que esteja sempre livre de erros ou interrupções, nem nos responsabilizamos por falhas de fontes externas de dados ou por danos resultantes do uso da plataforma, na medida permitida por lei.
        </Sec>

        <Sec n="10" t="Privacidade">
          O tratamento dos teus dados é explicado na nossa <a href="/privacidade" style={{ color: GOLD, fontWeight: 700, textDecoration: "none" }}>Política de privacidade</a>, que faz parte integrante destes termos.
        </Sec>

        <Sec n="11" t="Alterações aos termos">
          Podemos atualizar estes termos à medida que a Ippon League evolui. Quando o fizermos, atualizamos esta página e a data no topo. O uso continuado da plataforma após alterações significa que aceitas os novos termos.
        </Sec>

        <Sec n="12" t="Lei aplicável">
          Estes termos regem-se pela lei portuguesa. Qualquer litígio será resolvido nos tribunais competentes de Portugal, sem prejuízo dos direitos que a lei te confere enquanto consumidor.
        </Sec>

        <Sec n="13" t="Contacto">
          Para qualquer questão sobre estes termos, escreve-nos para <Email />.
        </Sec>

        <div style={{ background: "#121815", border: "1px solid #243029", borderRadius: 12, padding: "14px 16px", marginTop: 8 }}>
          <p style={{ fontSize: 12, color: "#7c8a82", lineHeight: 1.6, margin: 0 }}>Esta é uma versão inicial dos nossos termos de utilização, criada para a fase de testes da Ippon League. Será revista e formalizada à medida que o projeto cresce.</p>
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
