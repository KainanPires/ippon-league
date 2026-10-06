// app/termos-pro/page.tsx
//
// Termo de Conhecimento e Consentimento do Ippon Pro / Pro Max.
// Página estática (só texto), por agora em português — as restantes línguas
// entram quando o produto escalar. É o alvo do link "Termo de Entrega e
// Consentimento" na caixa de consentimento do checkout (/ippon-pro e /pro-max).
//
// Nota: rascunho a validar por advogado antes de qualquer versão definitiva.

import type { ReactNode } from "react";

const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";

const Sec = ({ n, titulo, children }: { n: number; titulo: string; children: ReactNode }) => (
  <section style={{ marginBottom: 22 }}>
    <h2 style={{ fontFamily: FD, fontSize: 15, fontWeight: 700, color: GOLD, margin: "0 0 8px" }}>
      {n}. {titulo}
    </h2>
    <div style={{ fontSize: 14, color: "#cfd8d2", lineHeight: 1.65 }}>{children}</div>
  </section>
);

export default function TermosPro() {
  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: FB }}>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "16px 18px 64px" }}>
        <header style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 16 }}>
          <a href="/ippon-pro" aria-label="Voltar" style={{ width: 34, height: 34, borderRadius: "50%", border: "1px solid #243029", display: "flex", alignItems: "center", justifyContent: "center", color: "#cfd8d2", textDecoration: "none", flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
          </a>
          <h1 style={{ fontFamily: FD, fontSize: 17, fontWeight: 700, textTransform: "uppercase", margin: 0 }}>Termo de Entrega e Consentimento</h1>
        </header>

        <p style={{ fontSize: 12.5, color: "#7c8a82", margin: "0 0 20px" }}>
          Última atualização: 22 de setembro de 2026 · Responsável: Kainan Pires (particular)
        </p>

        <p style={{ fontSize: 14, color: "#cfd8d2", lineHeight: 1.65, margin: "0 0 22px" }}>
          Ao assinar o Ippon Pro ou o Ippon Pro Max, reconheces e aceitas os pontos abaixo. Escrevemo-los de forma clara de propósito: queremos que saibas exatamente o que recebes e o que não te podemos garantir.
        </p>

        <Sec n={1} titulo="O que a tua assinatura te dá">
          O Ippon Pro e o Ippon Pro Max dão-te acesso a <strong>ferramentas, informação e funcionalidades</strong> dentro da Ippon League — por exemplo scout dos atletas, análise do teu time, participação em ligas oficiais, capitão, indicadores de valorização, acesso ao chaveamento e (no Pro Max) à chave ao vivo, alertas, mais ligas, análise de chave, layout e o grupo da comunidade. Estas ferramentas servem para jogares com mais informação. Não decidem o teu time por ti nem garantem qualquer resultado. O acesso exato a cada funcionalidade é o que está descrito na página de cada plano no momento da assinatura.
        </Sec>

        <Sec n={2} titulo="Dados das competições (chaves, inscritos, resultados, pontuação)">
          As informações de competições — calendário, atletas inscritos, chaveamentos, resultados das lutas e pontuação ao vivo — <strong>provêm de fontes oficiais e terceiras</strong>, nomeadamente a Federação Internacional de Judo (IJF) e o JudoBase. A Ippon League recolhe, organiza e apresenta esses dados de boa-fé, mas não os produz nem os controla. Por isso, e apesar do nosso esforço, <strong>não garantimos</strong> que estejam sempre completos, corretos ou disponíveis em tempo real: podem chegar com atraso, conter erros da fonte, ou faltar temporariamente. Quando detetamos um erro, corrigimo-lo assim que possível. Nenhuma decisão de jogo, pontuação, valorização ou classificação que dependa desses dados é da nossa responsabilidade quando o erro tem origem na fonte externa.
        </Sec>

        <Sec n={3} titulo="Natureza do jogo">
          A Ippon League é um jogo de <strong>entretenimento e estratégia</strong> sobre o judo. Não é uma casa de apostas nem um produto de investimento. A pontuação, a faixa, o património em Judocoins e a posição no ranking são elementos do jogo, sem valor monetário, e não são garantidos — dependem do desempenho dos atletas reais, que não controlamos.
        </Sec>

        <Sec n={4} titulo="Prémios e experiências">
          Eventuais prémios ou experiências <strong>dependem de patrocinadores e podem variar de época para época, ou não existir</strong> num dado período. A tua assinatura pode dar-te elegibilidade ou o direito a concorrer a esses prémios — nunca a garantia de os receber. Quando um formato do jogo (por exemplo, uma copa) atribui vagas por sorteio, ser assinante dá-te a possibilidade de participar, não a certeza de seres sorteado.
        </Sec>

        <Sec n={5} titulo="Calendário e disponibilidade">
          O calendário de competições é definido por entidades externas (IJF e organizadores) e <strong>pode mudar</strong> — competições podem ser adicionadas, adiadas ou canceladas por essas entidades, o que afeta as “rodadas” jogáveis. Fazemos o possível por manter o serviço disponível e atualizado (esforço razoável), mas não garantimos funcionamento ininterrupto nem isento de falhas.
        </Sec>

        <Sec n={6} titulo="Não afiliação">
          A Ippon League <strong>não é afiliada, patrocinada nem endossada</strong> pela IJF, pelo JudoBase, por federações nacionais ou por organizadores de competições. Nomes, marcas e dados de terceiros pertencem aos respetivos titulares e são usados apenas para identificar as competições e os atletas.
        </Sec>

        <Sec n={7} titulo="Pagamento, renovação e cancelamento">
          O pagamento é processado pela <strong>Stripe</strong>; a Ippon League não guarda os dados do teu cartão. Tens <strong>7 dias de teste gratuito</strong>: só és cobrado no fim desse período, caso não canceles antes. Depois, a assinatura renova-se automaticamente no fim de cada período, ao preço em vigor, até a cancelares. Podes cancelar quando quiseres; ao cancelar, mantens o acesso até ao fim do período já pago e não voltas a ser cobrado.
        </Sec>

        <Sec n={8} titulo="Alterações ao serviço e a este termo">
          Podemos melhorar, alterar ou descontinuar funcionalidades, e ajustar preços, com aviso prévio razoável e sem retirar o essencial do plano que contrataste. Se este termo mudar de forma relevante, avisamos-te antes de a alteração se aplicar a ti.
        </Sec>

        <Sec n={9} titulo="O teu consentimento">
          Ao clicares em “Li e aceito” e ao concluíres a assinatura, confirmas que leste e aceitaste este termo. <strong>Este consentimento não cria para a Ippon League qualquer obrigação além das descritas aqui</strong> — em particular, não nos torna responsáveis pela exatidão ou pelo momento dos dados de competição de origem externa, nem pela atribuição de prémios que dependam de terceiros.
        </Sec>

        <p style={{ fontSize: 12.5, color: "#7c8a82", lineHeight: 1.6, marginTop: 8 }}>
          Dúvidas ou pedidos: <a href="mailto:support@ipponleague.com" style={{ color: GOLD }}>support@ipponleague.com</a>.
        </p>
      </div>
    </main>
  );
}
