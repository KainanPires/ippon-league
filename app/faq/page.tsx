"use client";

// Perguntas Frequentes (FAQ) — explicativo + passo a passo. Acedido pelo perfil.
import { useState } from "react";

const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";

type QA = { p: string; r: React.ReactNode };
type Grupo = { titulo: string; itens: QA[] };

const Passos = ({ children }: { children: React.ReactNode }) => (
  <ol style={{ margin: "8px 0 0", paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>{children}</ol>
);
const Li = ({ children }: { children: React.ReactNode }) => (
  <li style={{ fontSize: 13.5, color: "#c7d0c9", lineHeight: 1.5 }}>{children}</li>
);
const P = ({ children }: { children: React.ReactNode }) => (
  <p style={{ fontSize: 13.5, color: "#c7d0c9", lineHeight: 1.55, margin: "0 0 8px" }}>{children}</p>
);
const B = ({ children }: { children: React.ReactNode }) => <strong style={{ color: "#f1ede2" }}>{children}</strong>;

const GRUPOS: Grupo[] = [
  {
    titulo: "Notificações",
    itens: [
      {
        p: "Não recebo notificações no iPhone. O que faço?",
        r: (
          <>
            <P>No iPhone, as notificações da Ippon League só funcionam com a app instalada no ecrã e aberta por aí. Confirma, por esta ordem:</P>
            <Passos>
              <Li>Tens a app <B>instalada no ecrã principal</B>? Se não, instala-a primeiro (vê “Como instalo a app no telemóvel?”).</Li>
              <Li>Abre a app <B>pelo ícone do Dôdo</B>, e não pelo Safari.</Li>
              <Li>Confirma que o <B>Modo de Isolamento</B> está desligado: Definições → Privacidade e Segurança → Modo de Isolamento → desligar (e reiniciar o iPhone). Este modo da Apple bloqueia as notificações de apps web.</Li>
              <Li>Na app, vai a <B>Perfil → Notificações → Ativar notificações</B> e aceita o pedido.</Li>
              <Li>Verifica ainda em Definições → Notificações → <B>Ippon League</B> se estão permitidas.</Li>
            </Passos>
          </>
        ),
      },
      {
        p: "Não recebo notificações no Android. O que faço?",
        r: (
          <>
            <P>No Android, confirma estes passos:</P>
            <Passos>
              <Li>Instala a app: no Chrome, menu <B>⋮</B> → <B>Adicionar à página inicial</B> (ou Instalar aplicação).</Li>
              <Li>Abre pela app e vai a <B>Perfil → Notificações → Ativar notificações</B>, e permite.</Li>
              <Li>Confirma nas definições do telemóvel que as notificações da app estão ligadas.</Li>
            </Passos>
            <P>Se mesmo assim não funcionar, <B>fala connosco</B> (Perfil → Ajuda e contacto) e diz-nos o <B>modelo do telemóvel</B> e <B>o que aparece no ecrã</B> (se puderes, com um print). Estamos a melhorar o suporte para Android e a tua informação ajuda-nos a resolver.</P>
          </>
        ),
      },
    ],
  },
  {
    titulo: "Instalar a app",
    itens: [
      {
        p: "Como instalo a app no telemóvel?",
        r: (
          <>
            <P>Tens o tutorial completo em <B>Perfil → Instalar a app no telemóvel</B> (deteta o teu aparelho). Em resumo:</P>
            <Passos>
              <Li><B>iPhone (Safari):</B> escreve <B>www.ipponleague.com</B> na barra → botão Partilhar → Adicionar ao ecrã principal.</Li>
              <Li><B>Android (Chrome):</B> escreve <B>www.ipponleague.com</B> na barra → menu ⋮ → Adicionar à página inicial.</Li>
            </Passos>
            <P>Importante: escreve o endereço completo na barra, <B>não pesquises no Google</B>.</P>
          </>
        ),
      },
    ],
  },
  {
    titulo: "Como se joga",
    itens: [
      {
        p: "Como funciona a Ippon League?",
        r: (
          <>
            <P>Começas com <B>100 Judocoins (JC)</B> e montas uma equipa de <B>8 atletas</B>, escolhendo <B>1 capitão</B> (que pontua a dobrar). Cada competição internacional (Grand Slam, Mundial, etc.) é uma rodada.</P>
            <P>Os teus atletas pontuam pelas <B>ações reais</B> que fazem nas lutas. Conforme se saem, ganhas ou perdes pontos, e o teu património em JC sobe ou desce. Disputas ligas e podes subir de faixa.</P>
          </>
        ),
      },
      {
        p: "Como ganho (e perco) pontos?",
        r: (
          <>
            <P>Os pontos vêm das ações dos teus atletas nas lutas:</P>
            <Passos>
              <Li>Ippon: <B>+10</B> · Waza-ari: <B>+4</B> · Yuko: <B>+2</B> · Shido provocado no adversário: <B>+1</B></Li>
              <Li>Ippon sofrido: <B>-5</B> · Waza-ari sofrido: <B>-2</B> · Yuko sofrido: <B>-1</B> · Shido recebido: <B>-2</B> · Hansoku-make: <B>-10</B></Li>
            </Passos>
            <P>O teu <B>capitão</B> pontua a dobrar para a equipa. Não pontuamos por vitória ou medalha — só pelas ações — para o jogo não ser previsível.</P>
          </>
        ),
      },
      {
        p: "Como ganho Judocoins e como evito perdê-los?",
        r: (
          <>
            <P>Atenção: os <B>pontos</B> (a tua pontuação na rodada) são uma coisa; os <B>Judocoins</B> (o teu património) são outra. Começas com <B>100 JC</B> e esse valor sobe ou desce conforme os atletas que escalaste <B>valorizam ou desvalorizam</B>.</P>
            <P>Um atleta <B>valoriza</B> quando supera a expectativa de desempenho dele, e <B>desvaloriza</B> quando fica abaixo. Se escalaste um atleta que valorizou, o teu património aumenta; se desvalorizou, diminui.</P>
            <P>Para ganhar JC e evitar perder:</P>
            <Passos>
              <Li>Procura atletas <B>subvalorizados</B> ou em boa fase, que podem render acima do esperado.</Li>
              <Li>Cuidado com atletas <B>muito caros</B>: já é esperado muito deles, por isso é mais fácil desvalorizarem.</Li>
              <Li>Equilibra a equipa — não gastes tudo em nomes caros.</Li>
            </Passos>
            <P>Para o mercado não disparar, aplicamos sempre <B>metade</B> da valorização calculada — funciona como um travão que mantém os preços estáveis.</P>
          </>
        ),
      },
      {
        p: "O que são as faixas e como subo ou desço?",
        r: (
          <>
            <P>A tua faixa representa o teu <B>desempenho recente</B> comparado com os outros jogadores, não uma progressão fixa. Por isso podes <B>subir, manter ou descer</B> de faixa.</P>
            <P>A ordem é: Branca → Azul → Amarela → Verde → Roxa → Marrom → Preta. As mais altas são para os jogadores no topo do mês. A tua faixa muda também o visual do jogo.</P>
          </>
        ),
      },
      {
        p: "O que é o Ippon Pro?",
        r: (
          <>
            <P>O Ippon Pro é a assinatura que te dá <B>vantagem competitiva</B> antes de escalares:</P>
            <Passos>
              <Li>Scout avançado e histórico de cada atleta.</Li>
              <Li>Análise da tua equipa e dica de capitão.</Li>
              <Li>Acompanhamento mais completo no dia da competição.</Li>
            </Passos>
            <P>Vês os detalhes em <B>Perfil → Ippon Pro</B>.</P>
          </>
        ),
      },
    ],
  },
  {
    titulo: "Clássicos",
    itens: [
      {
        p: "O que são os Clássicos?",
        r: (
          <>
            <P>Os <B>Clássicos</B> são competições marcantes do passado do judô (de anos anteriores) que trazemos de volta para jogar. Aparecem sempre <B>identificados como “Clássico”</B> no nome, para nunca os confundires com uma competição atual.</P>
            <P>Servem para que haja <B>sempre uma rodada para jogar</B>, mesmo nas semanas em que não há nenhuma competição internacional no calendário (como nas pausas de inverno e de verão).</P>
          </>
        ),
      },
      {
        p: "Como funcionam os Clássicos?",
        r: (
          <>
            <P>Jogas exatamente como numa competição normal: montas a tua equipa com os <B>8 atletas</B>, escolhes o <B>capitão</B> e pontuas pelas <B>ações</B> dos atletas nessa competição (ippon, waza-ari, etc.).</P>
            <P>A diferença é só a origem: em vez de uma competição a decorrer agora, é uma competição que já aconteceu e que reativámos. As regras de pontuação, valorização e faixas são as mesmas de sempre.</P>
          </>
        ),
      },
    ],
  },
  {
    titulo: "A minha conta",
    itens: [
      {
        p: "Esqueci-me da senha. Como recupero?",
        r: (
          <Passos>
            <Li>No ecrã de entrar, escreve o teu <B>email</B>.</Li>
            <Li>Toca em <B>“Esqueceste a senha?”</B>.</Li>
            <Li>Recebes um <B>email</B> com um link. Abre-o.</Li>
            <Li>Define a <B>nova senha</B> e entra com ela.</Li>
          </Passos>
        ),
      },
      {
        p: "Como mudo o meu email ou a minha senha?",
        r: (
          <>
            <P>Tudo no <B>Perfil</B>:</P>
            <Passos>
              <Li><B>Email:</B> Perfil → editar os teus dados → muda o email. Recebes um email de confirmação; o email só muda depois de o confirmares.</Li>
              <Li><B>Senha:</B> Perfil → Segurança → alterar senha (pede a senha atual e a nova).</Li>
            </Passos>
          </>
        ),
      },
    ],
  },
];

export default function FAQ() {
  const [aberta, setAberta] = useState<string | null>(null);

  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: FB }}>
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "16px 14px 60px" }}>
        <header style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <a href="/perfil" aria-label="Voltar" style={{ width: 36, height: 36, borderRadius: "50%", border: "1px solid #243029", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none", color: "#93a39a", flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
          </a>
          <h1 style={{ fontFamily: FD, fontSize: 21, fontWeight: 700, textTransform: "uppercase", margin: 0 }}>Perguntas frequentes</h1>
        </header>

        {GRUPOS.map((g) => (
          <div key={g.titulo} style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: FD, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: GOLD, marginBottom: 8 }}>{g.titulo}</div>
            <div style={{ background: "#121815", border: "1px solid #243029", borderRadius: 14, overflow: "hidden" }}>
              {g.itens.map((qa, i) => {
                const id = g.titulo + ":" + i;
                const open = aberta === id;
                return (
                  <div key={id} style={{ borderTop: i === 0 ? "none" : "1px solid #1a221d" }}>
                    <button
                      onClick={() => setAberta(open ? null : id)}
                      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, width: "100%", textAlign: "left", padding: "14px 14px", background: "transparent", border: "none", color: "#f1ede2", fontFamily: FB, fontSize: 14, fontWeight: 600, cursor: "pointer" }}
                    >
                      <span style={{ flex: 1 }}>{qa.p}</span>
                      <span style={{ color: GOLD, fontSize: 18, transform: open ? "rotate(45deg)" : "none", transition: "transform .15s" }}>+</span>
                    </button>
                    {open && <div style={{ padding: "0 14px 14px" }}>{qa.r}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        <div style={{ background: "#121815", border: `1px solid ${GOLD}`, borderRadius: 14, padding: 16, textAlign: "center" }}>
          <div style={{ fontSize: 14, color: "#c7d0c9", marginBottom: 10 }}>Não encontraste a resposta?</div>
          <a href="/ajuda" style={{ display: "inline-block", background: GOLD, color: "#1b211e", fontFamily: FD, fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", padding: "11px 20px", borderRadius: 11, textDecoration: "none" }}>Fala connosco</a>
        </div>
      </div>
    </main>
  );
}
