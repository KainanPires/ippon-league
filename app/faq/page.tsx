"use client";

// Perguntas Frequentes (FAQ) — explicativo + passo a passo. Acedido pelo perfil.
//
// IDIOMA: o conteúdo da FAQ é longo e cheio de negritos no meio das frases, por
// isso não vive no lib/i18n (seriam dezenas de chaves e inflava o dicionário).
// Vive AQUI, num CONTEUDO por língua, e o negrito escreve-se com **marcadores**
// (estilo markdown), interpretados pelo <Rico>. A língua vem do useLingua(); o
// título e o "Voltar" reutilizam as chaves comuns via useT().
import { useState } from "react";
import { useT, useLingua, type Lingua } from "@/lib/i18n";

const FD = "var(--font-geist-mono), system-ui, sans-serif";
const FB = "var(--font-geist-sans), system-ui, sans-serif";
const GOLD = "#d9a441";

// Um bloco de resposta: um parágrafo (`p`) ou uma lista de passos (`l`).
type Bloco = { p: string } | { l: string[] };
type QA = { p: string; r: Bloco[] };
type Grupo = { titulo: string; itens: QA[] };
type Conteudo = { grupos: Grupo[]; naoEncontraste: string; falaConnosco: string };

// Negrito no meio da frase: **texto**. Divide em ** e engrossa os ímpares.
function Rico({ txt }: { txt: string }) {
  const partes = txt.split("**");
  return <>{partes.map((seg, i) => (i % 2 === 1 ? <strong key={i} style={{ color: "#f1ede2" }}>{seg}</strong> : seg))}</>;
}
function Resposta({ blocos }: { blocos: Bloco[] }) {
  return (
    <>
      {blocos.map((b, i) =>
        "l" in b ? (
          <ol key={i} style={{ margin: "8px 0 0", paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>
            {b.l.map((it, j) => (
              <li key={j} style={{ fontSize: 13.5, color: "#c7d0c9", lineHeight: 1.5 }}><Rico txt={it} /></li>
            ))}
          </ol>
        ) : (
          <p key={i} style={{ fontSize: 13.5, color: "#c7d0c9", lineHeight: 1.55, margin: "0 0 8px" }}><Rico txt={b.p} /></p>
        )
      )}
    </>
  );
}

const PT: Conteudo = {
  naoEncontraste: "Não encontraste a resposta?",
  falaConnosco: "Fala connosco",
  grupos: [
    {
      titulo: "Notificações",
      itens: [
        {
          p: "Não recebo notificações no iPhone. O que faço?",
          r: [
            { p: "No iPhone, as notificações da Ippon League só funcionam com a app instalada no ecrã e aberta por aí. Confirma, por esta ordem:" },
            { l: [
              "Tens a app **instalada no ecrã principal**? Se não, instala-a primeiro (vê “Como instalo a app no telemóvel?”).",
              "Abre a app **pelo ícone do Dôdo**, e não pelo Safari.",
              "Confirma que o **Modo de Isolamento** está desligado: Definições → Privacidade e Segurança → Modo de Isolamento → desligar (e reiniciar o iPhone). Este modo da Apple bloqueia as notificações de apps web.",
              "Na app, vai a **Perfil → Notificações → Ativar notificações** e aceita o pedido.",
              "Verifica ainda em Definições → Notificações → **Ippon League** se estão permitidas.",
            ] },
          ],
        },
        {
          p: "Não recebo notificações no Android. O que faço?",
          r: [
            { p: "No Android, confirma estes passos:" },
            { l: [
              "Instala a app: no Chrome, menu **⋮** → **Adicionar à página inicial** (ou Instalar aplicação).",
              "Abre pela app e vai a **Perfil → Notificações → Ativar notificações**, e permite.",
              "Confirma nas definições do telemóvel que as notificações da app estão ligadas.",
            ] },
            { p: "Se mesmo assim não funcionar, **fala connosco** (Perfil → Ajuda e contacto) e diz-nos o **modelo do telemóvel** e **o que aparece no ecrã** (se puderes, com um print). Estamos a melhorar o suporte para Android e a tua informação ajuda-nos a resolver." },
          ],
        },
      ],
    },
    {
      titulo: "Instalar a app",
      itens: [
        {
          p: "Como instalo a app no telemóvel?",
          r: [
            { p: "Tens o tutorial completo em **Perfil → Instalar a app no telemóvel** (deteta o teu aparelho). Em resumo:" },
            { l: [
              "**iPhone (Safari):** escreve **www.ipponleague.com** na barra → botão Partilhar → Adicionar ao ecrã principal.",
              "**Android (Chrome):** escreve **www.ipponleague.com** na barra → menu ⋮ → Adicionar à página inicial.",
            ] },
            { p: "Importante: escreve o endereço completo na barra, **não pesquises no Google**." },
          ],
        },
      ],
    },
    {
      titulo: "Como se joga",
      itens: [
        {
          p: "Como funciona a Ippon League?",
          r: [
            { p: "Começas com **100 Judocoins (JC)** e montas uma equipa de **8 atletas**, escolhendo **1 capitão** (que pontua a dobrar). Cada competição internacional (Grand Slam, Mundial, etc.) é uma rodada." },
            { p: "Os teus atletas pontuam pelas **ações reais** que fazem nas lutas. Conforme se saem, ganhas ou perdes pontos, e o teu património em JC sobe ou desce. Disputas ligas e podes subir de faixa." },
          ],
        },
        {
          p: "Como ganho (e perco) pontos?",
          r: [
            { p: "Os pontos vêm das ações dos teus atletas nas lutas:" },
            { l: [
              "Ippon: **+10** · Waza-ari: **+4** · Yuko: **+2** · Shido provocado no adversário: **+1**",
              "Ippon sofrido: **-5** · Waza-ari sofrido: **-2** · Yuko sofrido: **-1** · Shido recebido: **-2** · Hansoku-make: **-10**",
            ] },
            { p: "O teu **capitão** pontua a dobrar para a equipa. Não pontuamos por vitória ou medalha — só pelas ações — para o jogo não ser previsível." },
          ],
        },
        {
          p: "Como ganho Judocoins e como evito perdê-los?",
          r: [
            { p: "Atenção: os **pontos** (a tua pontuação na rodada) são uma coisa; os **Judocoins** (o teu património) são outra. Começas com **100 JC** e esse valor sobe ou desce conforme os atletas que escalaste **valorizam ou desvalorizam**." },
            { p: "Um atleta **valoriza** quando supera a expectativa de desempenho dele, e **desvaloriza** quando fica abaixo. Se escalaste um atleta que valorizou, o teu património aumenta; se desvalorizou, diminui." },
            { p: "Para ganhar JC e evitar perder:" },
            { l: [
              "Procura atletas **subvalorizados** ou em boa fase, que podem render acima do esperado.",
              "Cuidado com atletas **muito caros**: já é esperado muito deles, por isso é mais fácil desvalorizarem.",
              "Equilibra a equipa — não gastes tudo em nomes caros.",
            ] },
            { p: "Para o mercado não disparar, aplicamos sempre **metade** da valorização calculada — funciona como um travão que mantém os preços estáveis." },
          ],
        },
        {
          p: "O que são as faixas e como subo ou desço?",
          r: [
            { p: "A tua faixa representa o teu **desempenho recente** comparado com os outros jogadores, não uma progressão fixa. Por isso podes **subir, manter ou descer** de faixa." },
            { p: "A ordem é: Branca → Azul → Amarela → Verde → Roxa → Marrom → Preta. As mais altas são para os jogadores no topo do mês. A tua faixa muda também o visual do jogo." },
          ],
        },
        {
          p: "O que é o Ippon Pro?",
          r: [
            { p: "O Ippon Pro é a assinatura que te dá **vantagem competitiva** antes de escalares:" },
            { l: [
              "Scout avançado e histórico de cada atleta.",
              "Análise da tua equipa e dica de capitão.",
              "Acompanhamento mais completo no dia da competição.",
              "Chaveamento da competição: vês a chave quando sai e no fim, com os resultados.",
            ] },
            { p: "Vês os detalhes em **Perfil → Ippon Pro e Pro Max**." },
          ],
        },
        {
          p: "O que é o Ippon Pro Max?",
          r: [
            { p: "O Ippon Pro Max inclui **tudo o que o Pro tem** — e ainda acrescenta:" },
            { l: [
              "**Chave ao vivo:** acompanha o chaveamento a decorrer em tempo real, durante a competição. Disponível nas competições de topo (Mundial, Grand Slam, Grand Prix, Masters e Olimpíadas).",
              "**Alerta dos teus favoritos:** avisamos quando um atleta que segues é o próximo a lutar.",
              "**Até 10 ligas e copas** (o dobro do Pro).",
              "**Análise da chave:** quem tem mais hipótese de pontuar muito ou chegar longe, pelos confrontos prováveis. Também nas competições de topo.",
              "**Grupo exclusivo** (WhatsApp/Telegram) só para membros Pro Max.",
              "**Layout e visual exclusivos** Pro Max.",
            ] },
            { p: "Os **Clássicos** (competições do passado) não têm chave ao vivo nem análise, por já terem acontecido." },
            { p: "Vês os detalhes em **Perfil → Ippon Pro e Pro Max**." },
          ],
        },
      ],
    },
    {
      titulo: "Clássicos",
      itens: [
        {
          p: "O que são os Clássicos?",
          r: [
            { p: "Os **Clássicos** são competições marcantes do passado do judô (de anos anteriores) que trazemos de volta para jogar. Aparecem sempre **identificados como “Clássico”** no nome, para nunca os confundires com uma competição atual." },
            { p: "Servem para que haja **sempre uma rodada para jogar**, mesmo nas semanas em que não há nenhuma competição internacional no calendário (como nas pausas de inverno e de verão)." },
          ],
        },
        {
          p: "Como funcionam os Clássicos?",
          r: [
            { p: "Jogas exatamente como numa competição normal: montas a tua equipa com os **8 atletas**, escolhes o **capitão** e pontuas pelas **ações** dos atletas nessa competição (ippon, waza-ari, etc.)." },
            { p: "A diferença é só a origem: em vez de uma competição a decorrer agora, é uma competição que já aconteceu e que reativámos. As regras de pontuação, valorização e faixas são as mesmas de sempre." },
          ],
        },
      ],
    },
    {
      titulo: "A minha conta",
      itens: [
        {
          p: "Esqueci-me da senha. Como recupero?",
          r: [
            { l: [
              "No ecrã de entrar, escreve o teu **email**.",
              "Toca em **“Esqueceste a senha?”**.",
              "Recebes um **email** com um link. Abre-o.",
              "Define a **nova senha** e entra com ela.",
            ] },
          ],
        },
        {
          p: "Como mudo o meu email ou a minha senha?",
          r: [
            { p: "Tudo no **Perfil**:" },
            { l: [
              "**Email:** Perfil → editar os teus dados → muda o email. Recebes um email de confirmação; o email só muda depois de o confirmares.",
              "**Senha:** Perfil → Segurança → alterar senha (pede a senha atual e a nova).",
            ] },
          ],
        },
      ],
    },
  ],
};

const EN: Conteudo = {
  naoEncontraste: "Didn't find the answer?",
  falaConnosco: "Contact us",
  grupos: [
    {
      titulo: "Notifications",
      itens: [
        {
          p: "I don't get notifications on iPhone. What do I do?",
          r: [
            { p: "On iPhone, Ippon League notifications only work with the app installed on the home screen and opened from there. Check, in this order:" },
            { l: [
              "Do you have the app **installed on the home screen**? If not, install it first (see “How do I install the app on my phone?”).",
              "Open the app **from the Dôdo icon**, not from Safari.",
              "Make sure **Lockdown Mode** is off: Settings → Privacy & Security → Lockdown Mode → turn off (and restart the iPhone). This Apple mode blocks web app notifications.",
              "In the app, go to **Profile → Notifications → Enable notifications** and accept the request.",
              "Also check in Settings → Notifications → **Ippon League** that they're allowed.",
            ] },
          ],
        },
        {
          p: "I don't get notifications on Android. What do I do?",
          r: [
            { p: "On Android, check these steps:" },
            { l: [
              "Install the app: in Chrome, menu **⋮** → **Add to Home screen** (or Install app).",
              "Open it from the app and go to **Profile → Notifications → Enable notifications**, and allow.",
              "Check in your phone's settings that the app's notifications are on.",
            ] },
            { p: "If it still doesn't work, **contact us** (Profile → Help & contact) and tell us the **phone model** and **what appears on screen** (a screenshot helps if you can). We're improving Android support and your info helps us fix it." },
          ],
        },
      ],
    },
    {
      titulo: "Installing the app",
      itens: [
        {
          p: "How do I install the app on my phone?",
          r: [
            { p: "There's a full tutorial in **Profile → Install the app on your phone** (it detects your device). In short:" },
            { l: [
              "**iPhone (Safari):** type **www.ipponleague.com** in the bar → Share button → Add to Home Screen.",
              "**Android (Chrome):** type **www.ipponleague.com** in the bar → menu ⋮ → Add to Home screen.",
            ] },
            { p: "Important: type the full address in the bar, **don't search on Google**." },
          ],
        },
      ],
    },
    {
      titulo: "How to play",
      itens: [
        {
          p: "How does Ippon League work?",
          r: [
            { p: "You start with **100 Judocoins (JC)** and build a team of **8 athletes**, choosing **1 captain** (who scores double). Each international competition (Grand Slam, Worlds, etc.) is a round." },
            { p: "Your athletes score from the **real actions** they make in their fights. Depending on how they do, you gain or lose points, and your JC net worth goes up or down. You compete in leagues and can move up a belt." },
          ],
        },
        {
          p: "How do I gain (and lose) points?",
          r: [
            { p: "Points come from your athletes' actions in the fights:" },
            { l: [
              "Ippon: **+10** · Waza-ari: **+4** · Yuko: **+2** · Shido drawn on the opponent: **+1**",
              "Ippon conceded: **-5** · Waza-ari conceded: **-2** · Yuko conceded: **-1** · Shido received: **-2** · Hansoku-make: **-10**",
            ] },
            { p: "Your **captain** scores double for the team. We don't score by win or medal — only by actions — so the game isn't predictable." },
          ],
        },
        {
          p: "How do I earn Judocoins and avoid losing them?",
          r: [
            { p: "Note: **points** (your round score) are one thing; **Judocoins** (your net worth) are another. You start with **100 JC** and that value rises or falls depending on whether the athletes you picked **gain or lose value**." },
            { p: "An athlete **gains value** when they beat their performance expectation, and **loses value** when they fall short. If you picked an athlete who gained value, your net worth grows; if they lost value, it drops." },
            { p: "To earn JC and avoid losing:" },
            { l: [
              "Look for **undervalued** athletes or ones in good form, who can deliver above expectations.",
              "Be careful with **very expensive** athletes: a lot is already expected of them, so it's easier for them to lose value.",
              "Balance the team — don't spend everything on expensive names.",
            ] },
            { p: "To keep the market from spiking, we always apply **half** of the calculated change — it works as a brake that keeps prices stable." },
          ],
        },
        {
          p: "What are belts and how do I move up or down?",
          r: [
            { p: "Your belt represents your **recent performance** compared with other players, not a fixed progression. So you can **move up, hold or move down** a belt." },
            { p: "The order is: White → Blue → Yellow → Green → Purple → Brown → Black. The highest ones are for the players at the top of the month. Your belt also changes the game's look." },
          ],
        },
        {
          p: "What is Ippon Pro?",
          r: [
            { p: "Ippon Pro is the subscription that gives you a **competitive edge** before you line up:" },
            { l: [
              "Advanced scout and each athlete's history.",
              "Analysis of your team and a captain tip.",
              "Fuller live coverage on competition day.",
              "Competition bracket: you see the bracket when it's out and at the end, with the results.",
            ] },
            { p: "You see the details in **Profile → Ippon Pro and Pro Max**." },
          ],
        },
        {
          p: "What is Ippon Pro Max?",
          r: [
            { p: "Ippon Pro Max includes **everything Pro has** — and also adds:" },
            { l: [
              "**Live bracket:** follow the bracket in real time, during the competition. Available in the top competitions (Worlds, Grand Slam, Grand Prix, Masters and Olympics).",
              "**Favourites alert:** we let you know when an athlete you follow is next to fight.",
              "**Up to 10 leagues and cups** (double the Pro).",
              "**Bracket analysis:** who has the best chance to score big or go far, by the likely matchups. Also in the top competitions.",
              "**Exclusive group** (WhatsApp/Telegram) only for Pro Max members.",
              "**Exclusive layout and look** for Pro Max.",
            ] },
            { p: "The **Classics** (past competitions) don't have a live bracket or analysis, since they've already happened." },
            { p: "You see the details in **Profile → Ippon Pro and Pro Max**." },
          ],
        },
      ],
    },
    {
      titulo: "Classics",
      itens: [
        {
          p: "What are the Classics?",
          r: [
            { p: "The **Classics** are memorable competitions from judo's past (from earlier years) that we bring back to play. They always appear **marked as “Classic”** in the name, so you never confuse them with a current competition." },
            { p: "They exist so there's **always a round to play**, even in weeks with no international competition on the calendar (like the winter and summer breaks)." },
          ],
        },
        {
          p: "How do the Classics work?",
          r: [
            { p: "You play exactly like in a normal competition: you build your team with the **8 athletes**, choose the **captain** and score from the athletes' **actions** in that competition (ippon, waza-ari, etc.)." },
            { p: "The only difference is the source: instead of a competition happening now, it's one that already took place and we reactivated. The scoring, value and belt rules are the same as always." },
          ],
        },
      ],
    },
    {
      titulo: "My account",
      itens: [
        {
          p: "I forgot my password. How do I recover it?",
          r: [
            { l: [
              "On the sign-in screen, type your **email**.",
              "Tap **“Forgot your password?”**.",
              "You get an **email** with a link. Open it.",
              "Set the **new password** and sign in with it.",
            ] },
          ],
        },
        {
          p: "How do I change my email or my password?",
          r: [
            { p: "All in **Profile**:" },
            { l: [
              "**Email:** Profile → edit your details → change the email. You get a confirmation email; the email only changes after you confirm it.",
              "**Password:** Profile → Security → change password (asks for the current one and the new one).",
            ] },
          ],
        },
      ],
    },
  ],
};

const ES: Conteudo = {
  naoEncontraste: "¿No encontraste la respuesta?",
  falaConnosco: "Contáctanos",
  grupos: [
    {
      titulo: "Notificaciones",
      itens: [
        {
          p: "No recibo notificaciones en el iPhone. ¿Qué hago?",
          r: [
            { p: "En el iPhone, las notificaciones de Ippon League solo funcionan con la app instalada en la pantalla y abierta desde ahí. Comprueba, en este orden:" },
            { l: [
              "¿Tienes la app **instalada en la pantalla de inicio**? Si no, instálala primero (mira “¿Cómo instalo la app en el móvil?”).",
              "Abre la app **desde el icono del Dôdo**, no desde Safari.",
              "Comprueba que el **Modo de Aislamiento** está desactivado: Ajustes → Privacidad y Seguridad → Modo de Aislamiento → desactivar (y reinicia el iPhone). Este modo de Apple bloquea las notificaciones de apps web.",
              "En la app, ve a **Perfil → Notificaciones → Activar notificaciones** y acepta la solicitud.",
              "Comprueba también en Ajustes → Notificaciones → **Ippon League** que están permitidas.",
            ] },
          ],
        },
        {
          p: "No recibo notificaciones en Android. ¿Qué hago?",
          r: [
            { p: "En Android, comprueba estos pasos:" },
            { l: [
              "Instala la app: en Chrome, menú **⋮** → **Añadir a la pantalla de inicio** (o Instalar aplicación).",
              "Ábrela desde la app y ve a **Perfil → Notificaciones → Activar notificaciones**, y permite.",
              "Comprueba en los ajustes del móvil que las notificaciones de la app están activadas.",
            ] },
            { p: "Si aun así no funciona, **contáctanos** (Perfil → Ayuda y contacto) y dinos el **modelo del móvil** y **lo que aparece en pantalla** (con una captura si puedes). Estamos mejorando el soporte para Android y tu información nos ayuda a resolverlo." },
          ],
        },
      ],
    },
    {
      titulo: "Instalar la app",
      itens: [
        {
          p: "¿Cómo instalo la app en el móvil?",
          r: [
            { p: "Tienes el tutorial completo en **Perfil → Instalar la app en el móvil** (detecta tu dispositivo). En resumen:" },
            { l: [
              "**iPhone (Safari):** escribe **www.ipponleague.com** en la barra → botón Compartir → Añadir a pantalla de inicio.",
              "**Android (Chrome):** escribe **www.ipponleague.com** en la barra → menú ⋮ → Añadir a la pantalla de inicio.",
            ] },
            { p: "Importante: escribe la dirección completa en la barra, **no busques en Google**." },
          ],
        },
      ],
    },
    {
      titulo: "Cómo se juega",
      itens: [
        {
          p: "¿Cómo funciona Ippon League?",
          r: [
            { p: "Empiezas con **100 Judocoins (JC)** y montas un equipo de **8 atletas**, eligiendo **1 capitán** (que puntúa doble). Cada competición internacional (Grand Slam, Mundial, etc.) es una jornada." },
            { p: "Tus atletas puntúan por las **acciones reales** que hacen en los combates. Según cómo les vaya, ganas o pierdes puntos, y tu patrimonio en JC sube o baja. Compites en ligas y puedes subir de cinturón." },
          ],
        },
        {
          p: "¿Cómo gano (y pierdo) puntos?",
          r: [
            { p: "Los puntos vienen de las acciones de tus atletas en los combates:" },
            { l: [
              "Ippon: **+10** · Waza-ari: **+4** · Yuko: **+2** · Shido provocado al rival: **+1**",
              "Ippon recibido: **-5** · Waza-ari recibido: **-2** · Yuko recibido: **-1** · Shido recibido: **-2** · Hansoku-make: **-10**",
            ] },
            { p: "Tu **capitán** puntúa doble para el equipo. No puntuamos por victoria ni medalla — solo por las acciones — para que el juego no sea previsible." },
          ],
        },
        {
          p: "¿Cómo gano Judocoins y cómo evito perderlos?",
          r: [
            { p: "Atención: los **puntos** (tu puntuación de la jornada) son una cosa; los **Judocoins** (tu patrimonio) son otra. Empiezas con **100 JC** y ese valor sube o baja según si los atletas que alineaste **se revalorizan o se devalúan**." },
            { p: "Un atleta **se revaloriza** cuando supera su expectativa de rendimiento, y **se devalúa** cuando queda por debajo. Si alineaste a un atleta que se revalorizó, tu patrimonio aumenta; si se devaluó, disminuye." },
            { p: "Para ganar JC y evitar perder:" },
            { l: [
              "Busca atletas **infravalorados** o en buena forma, que pueden rendir por encima de lo esperado.",
              "Cuidado con los atletas **muy caros**: ya se espera mucho de ellos, así que es más fácil que se devalúen.",
              "Equilibra el equipo — no lo gastes todo en nombres caros.",
            ] },
            { p: "Para que el mercado no se dispare, aplicamos siempre **la mitad** de la revalorización calculada — funciona como un freno que mantiene los precios estables." },
          ],
        },
        {
          p: "¿Qué son los cinturones y cómo subo o bajo?",
          r: [
            { p: "Tu cinturón representa tu **rendimiento reciente** comparado con los demás jugadores, no una progresión fija. Por eso puedes **subir, mantener o bajar** de cinturón." },
            { p: "El orden es: Blanco → Azul → Amarillo → Verde → Morado → Marrón → Negro. Los más altos son para los jugadores en lo alto del mes. Tu cinturón también cambia el aspecto del juego." },
          ],
        },
        {
          p: "¿Qué es Ippon Pro?",
          r: [
            { p: "Ippon Pro es la suscripción que te da **ventaja competitiva** antes de alinear:" },
            { l: [
              "Scout avanzado e historial de cada atleta.",
              "Análisis de tu equipo y consejo de capitán.",
              "Seguimiento más completo el día de la competición.",
              "Cuadro de la competición: ves el cuadro cuando sale y al final, con los resultados.",
            ] },
            { p: "Ves los detalles en **Perfil → Ippon Pro y Pro Max**." },
          ],
        },
        {
          p: "¿Qué es Ippon Pro Max?",
          r: [
            { p: "Ippon Pro Max incluye **todo lo que tiene Pro** — y además añade:" },
            { l: [
              "**Cuadro en vivo:** sigue el cuadro en tiempo real, durante la competición. Disponible en las competiciones de élite (Mundial, Grand Slam, Grand Prix, Masters y Olimpiadas).",
              "**Alerta de tus favoritos:** te avisamos cuando un atleta que sigues es el próximo en combatir.",
              "**Hasta 10 ligas y copas** (el doble que Pro).",
              "**Análisis del cuadro:** quién tiene más opciones de puntuar mucho o llegar lejos, por los enfrentamientos probables. También en las competiciones de élite.",
              "**Grupo exclusivo** (WhatsApp/Telegram) solo para miembros Pro Max.",
              "**Diseño y aspecto exclusivos** Pro Max.",
            ] },
            { p: "Los **Clásicos** (competiciones del pasado) no tienen cuadro en vivo ni análisis, por haber ocurrido ya." },
            { p: "Ves los detalles en **Perfil → Ippon Pro y Pro Max**." },
          ],
        },
      ],
    },
    {
      titulo: "Clásicos",
      itens: [
        {
          p: "¿Qué son los Clásicos?",
          r: [
            { p: "Los **Clásicos** son competiciones destacadas del pasado del judo (de años anteriores) que traemos de vuelta para jugar. Aparecen siempre **identificados como “Clásico”** en el nombre, para que nunca los confundas con una competición actual." },
            { p: "Sirven para que **siempre haya una jornada para jugar**, incluso en las semanas sin ninguna competición internacional en el calendario (como en las pausas de invierno y verano)." },
          ],
        },
        {
          p: "¿Cómo funcionan los Clásicos?",
          r: [
            { p: "Juegas exactamente como en una competición normal: montas tu equipo con los **8 atletas**, eliges el **capitán** y puntúas por las **acciones** de los atletas en esa competición (ippon, waza-ari, etc.)." },
            { p: "La diferencia es solo el origen: en vez de una competición en curso ahora, es una que ya ocurrió y que reactivamos. Las reglas de puntuación, revalorización y cinturones son las de siempre." },
          ],
        },
      ],
    },
    {
      titulo: "Mi cuenta",
      itens: [
        {
          p: "Olvidé mi contraseña. ¿Cómo la recupero?",
          r: [
            { l: [
              "En la pantalla de entrar, escribe tu **email**.",
              "Toca en **“¿Olvidaste la contraseña?”**.",
              "Recibes un **email** con un enlace. Ábrelo.",
              "Define la **nueva contraseña** y entra con ella.",
            ] },
          ],
        },
        {
          p: "¿Cómo cambio mi email o mi contraseña?",
          r: [
            { p: "Todo en **Perfil**:" },
            { l: [
              "**Email:** Perfil → editar tus datos → cambia el email. Recibes un email de confirmación; el email solo cambia después de que lo confirmes.",
              "**Contraseña:** Perfil → Seguridad → cambiar contraseña (pide la actual y la nueva).",
            ] },
          ],
        },
      ],
    },
  ],
};

const FR: Conteudo = {
  naoEncontraste: "Tu n'as pas trouvé la réponse ?",
  falaConnosco: "Contacte-nous",
  grupos: [
    {
      titulo: "Notifications",
      itens: [
        {
          p: "Je ne reçois pas de notifications sur iPhone. Que faire ?",
          r: [
            { p: "Sur iPhone, les notifications d'Ippon League ne fonctionnent qu'avec l'app installée sur l'écran et ouverte depuis là. Vérifie, dans cet ordre :" },
            { l: [
              "As-tu l'app **installée sur l'écran d'accueil** ? Sinon, installe-la d'abord (vois « Comment installer l'app sur le téléphone ? »).",
              "Ouvre l'app **par l'icône du Dôdo**, et non par Safari.",
              "Vérifie que le **Mode Isolement** est désactivé : Réglages → Confidentialité et sécurité → Mode Isolement → désactiver (et redémarre l'iPhone). Ce mode d'Apple bloque les notifications des apps web.",
              "Dans l'app, va dans **Profil → Notifications → Activer les notifications** et accepte la demande.",
              "Vérifie aussi dans Réglages → Notifications → **Ippon League** qu'elles sont autorisées.",
            ] },
          ],
        },
        {
          p: "Je ne reçois pas de notifications sur Android. Que faire ?",
          r: [
            { p: "Sur Android, vérifie ces étapes :" },
            { l: [
              "Installe l'app : dans Chrome, menu **⋮** → **Ajouter à l'écran d'accueil** (ou Installer l'application).",
              "Ouvre-la depuis l'app et va dans **Profil → Notifications → Activer les notifications**, et autorise.",
              "Vérifie dans les réglages du téléphone que les notifications de l'app sont activées.",
            ] },
            { p: "Si ça ne marche toujours pas, **contacte-nous** (Profil → Aide et contact) et indique le **modèle du téléphone** et **ce qui apparaît à l'écran** (avec une capture si tu peux). On améliore le support Android et ton info nous aide à résoudre." },
          ],
        },
      ],
    },
    {
      titulo: "Installer l'app",
      itens: [
        {
          p: "Comment installer l'app sur le téléphone ?",
          r: [
            { p: "Tu as le tutoriel complet dans **Profil → Installer l'app sur le téléphone** (il détecte ton appareil). En résumé :" },
            { l: [
              "**iPhone (Safari) :** tape **www.ipponleague.com** dans la barre → bouton Partager → Sur l'écran d'accueil.",
              "**Android (Chrome) :** tape **www.ipponleague.com** dans la barre → menu ⋮ → Ajouter à l'écran d'accueil.",
            ] },
            { p: "Important : tape l'adresse complète dans la barre, **ne cherche pas sur Google**." },
          ],
        },
      ],
    },
    {
      titulo: "Comment jouer",
      itens: [
        {
          p: "Comment fonctionne Ippon League ?",
          r: [
            { p: "Tu commences avec **100 Judocoins (JC)** et tu montes une équipe de **8 athlètes**, en choisissant **1 capitaine** (qui marque double). Chaque compétition internationale (Grand Slam, Mondiaux, etc.) est une journée." },
            { p: "Tes athlètes marquent par les **actions réelles** qu'ils font dans leurs combats. Selon leurs résultats, tu gagnes ou perds des points, et ton patrimoine en JC monte ou baisse. Tu joues des ligues et tu peux monter de ceinture." },
          ],
        },
        {
          p: "Comment gagner (et perdre) des points ?",
          r: [
            { p: "Les points viennent des actions de tes athlètes dans les combats :" },
            { l: [
              "Ippon : **+10** · Waza-ari : **+4** · Yuko : **+2** · Shido provoqué à l'adversaire : **+1**",
              "Ippon encaissé : **-5** · Waza-ari encaissé : **-2** · Yuko encaissé : **-1** · Shido reçu : **-2** · Hansoku-make : **-10**",
            ] },
            { p: "Ton **capitaine** marque double pour l'équipe. On ne marque pas par victoire ni médaille — seulement par les actions — pour que le jeu ne soit pas prévisible." },
          ],
        },
        {
          p: "Comment gagner des Judocoins et éviter d'en perdre ?",
          r: [
            { p: "Attention : les **points** (ton score de la journée) sont une chose ; les **Judocoins** (ton patrimoine) en sont une autre. Tu commences avec **100 JC** et cette valeur monte ou baisse selon que les athlètes que tu as alignés **prennent ou perdent de la valeur**." },
            { p: "Un athlète **prend de la valeur** quand il dépasse son attente de performance, et **en perd** quand il reste en dessous. Si tu as aligné un athlète qui a pris de la valeur, ton patrimoine augmente ; s'il en a perdu, il diminue." },
            { p: "Pour gagner des JC et éviter d'en perdre :" },
            { l: [
              "Cherche des athlètes **sous-évalués** ou en forme, qui peuvent rendre au-dessus des attentes.",
              "Attention aux athlètes **très chers** : on attend déjà beaucoup d'eux, il est donc plus facile qu'ils perdent de la valeur.",
              "Équilibre l'équipe — ne dépense pas tout en noms chers.",
            ] },
            { p: "Pour que le marché ne s'emballe pas, on applique toujours **la moitié** de la variation calculée — ça agit comme un frein qui garde les prix stables." },
          ],
        },
        {
          p: "Que sont les ceintures et comment monter ou descendre ?",
          r: [
            { p: "Ta ceinture représente ta **performance récente** comparée aux autres joueurs, pas une progression fixe. Tu peux donc **monter, rester ou descendre** de ceinture." },
            { p: "L'ordre est : Blanche → Bleue → Jaune → Verte → Violette → Marron → Noire. Les plus hautes sont pour les joueurs en tête du mois. Ta ceinture change aussi l'apparence du jeu." },
          ],
        },
        {
          p: "Qu'est-ce qu'Ippon Pro ?",
          r: [
            { p: "Ippon Pro est l'abonnement qui te donne un **avantage compétitif** avant d'aligner :" },
            { l: [
              "Scout avancé et historique de chaque athlète.",
              "Analyse de ton équipe et conseil de capitaine.",
              "Suivi plus complet le jour de la compétition.",
              "Tableau de la compétition : tu vois le tableau quand il sort et à la fin, avec les résultats.",
            ] },
            { p: "Tu vois les détails dans **Profil → Ippon Pro et Pro Max**." },
          ],
        },
        {
          p: "Qu'est-ce qu'Ippon Pro Max ?",
          r: [
            { p: "Ippon Pro Max inclut **tout ce qu'a le Pro** — et ajoute encore :" },
            { l: [
              "**Tableau en direct :** suis le tableau en temps réel, pendant la compétition. Disponible dans les compétitions de haut niveau (Mondiaux, Grand Slam, Grand Prix, Masters et Jeux olympiques).",
              "**Alerte de tes favoris :** on te prévient quand un athlète que tu suis est le prochain à combattre.",
              "**Jusqu'à 10 ligues et coupes** (le double du Pro).",
              "**Analyse du tableau :** qui a le plus de chances de marquer gros ou d'aller loin, selon les confrontations probables. Aussi dans les compétitions de haut niveau.",
              "**Groupe exclusif** (WhatsApp/Telegram) réservé aux membres Pro Max.",
              "**Mise en page et visuel exclusifs** Pro Max.",
            ] },
            { p: "Les **Classiques** (compétitions du passé) n'ont pas de tableau en direct ni d'analyse, car elles ont déjà eu lieu." },
            { p: "Tu vois les détails dans **Profil → Ippon Pro et Pro Max**." },
          ],
        },
      ],
    },
    {
      titulo: "Classiques",
      itens: [
        {
          p: "Que sont les Classiques ?",
          r: [
            { p: "Les **Classiques** sont des compétitions marquantes du passé du judo (des années précédentes) qu'on ramène pour jouer. Elles apparaissent toujours **identifiées comme « Classique »** dans le nom, pour que tu ne les confondes jamais avec une compétition actuelle." },
            { p: "Elles servent à ce qu'il y ait **toujours une journée à jouer**, même les semaines sans aucune compétition internationale au calendrier (comme les pauses d'hiver et d'été)." },
          ],
        },
        {
          p: "Comment fonctionnent les Classiques ?",
          r: [
            { p: "Tu joues exactement comme dans une compétition normale : tu montes ton équipe avec les **8 athlètes**, tu choisis le **capitaine** et tu marques par les **actions** des athlètes dans cette compétition (ippon, waza-ari, etc.)." },
            { p: "La seule différence est l'origine : au lieu d'une compétition en cours maintenant, c'est une qui a déjà eu lieu et qu'on a réactivée. Les règles de score, de valeur et de ceintures sont les mêmes que d'habitude." },
          ],
        },
      ],
    },
    {
      titulo: "Mon compte",
      itens: [
        {
          p: "J'ai oublié mon mot de passe. Comment le récupérer ?",
          r: [
            { l: [
              "Sur l'écran de connexion, tape ton **email**.",
              "Touche **« Mot de passe oublié ? »**.",
              "Tu reçois un **email** avec un lien. Ouvre-le.",
              "Définis le **nouveau mot de passe** et connecte-toi avec.",
            ] },
          ],
        },
        {
          p: "Comment changer mon email ou mon mot de passe ?",
          r: [
            { p: "Tout dans le **Profil** :" },
            { l: [
              "**Email :** Profil → modifier tes données → change l'email. Tu reçois un email de confirmation ; l'email ne change qu'après confirmation.",
              "**Mot de passe :** Profil → Sécurité → changer le mot de passe (demande l'actuel et le nouveau).",
            ] },
          ],
        },
      ],
    },
  ],
};

const DE: Conteudo = {
  naoEncontraste: "Antwort nicht gefunden?",
  falaConnosco: "Kontaktiere uns",
  grupos: [
    {
      titulo: "Benachrichtigungen",
      itens: [
        {
          p: "Ich erhalte keine Benachrichtigungen auf dem iPhone. Was tun?",
          r: [
            { p: "Auf dem iPhone funktionieren die Benachrichtigungen von Ippon League nur mit der auf dem Bildschirm installierten und von dort geöffneten App. Prüfe in dieser Reihenfolge:" },
            { l: [
              "Hast du die App **auf dem Home-Bildschirm installiert**? Wenn nicht, installiere sie zuerst (siehe „Wie installiere ich die App auf dem Handy?“).",
              "Öffne die App **über das Dôdo-Symbol**, nicht über Safari.",
              "Stelle sicher, dass der **Blockierungsmodus** aus ist: Einstellungen → Datenschutz & Sicherheit → Blockierungsmodus → ausschalten (und iPhone neu starten). Dieser Apple-Modus blockiert Benachrichtigungen von Web-Apps.",
              "Geh in der App zu **Profil → Benachrichtigungen → Benachrichtigungen aktivieren** und akzeptiere die Anfrage.",
              "Prüfe außerdem unter Einstellungen → Mitteilungen → **Ippon League**, ob sie erlaubt sind.",
            ] },
          ],
        },
        {
          p: "Ich erhalte keine Benachrichtigungen auf Android. Was tun?",
          r: [
            { p: "Prüfe auf Android diese Schritte:" },
            { l: [
              "Installiere die App: in Chrome, Menü **⋮** → **Zum Startbildschirm hinzufügen** (oder App installieren).",
              "Öffne sie über die App und geh zu **Profil → Benachrichtigungen → Benachrichtigungen aktivieren**, und erlaube.",
              "Prüfe in den Handy-Einstellungen, dass die Benachrichtigungen der App an sind.",
            ] },
            { p: "Wenn es trotzdem nicht klappt, **kontaktiere uns** (Profil → Hilfe & Kontakt) und nenne das **Handy-Modell** und **was auf dem Bildschirm erscheint** (wenn möglich mit Screenshot). Wir verbessern den Android-Support und deine Info hilft uns, es zu lösen." },
          ],
        },
      ],
    },
    {
      titulo: "App installieren",
      itens: [
        {
          p: "Wie installiere ich die App auf dem Handy?",
          r: [
            { p: "Es gibt eine vollständige Anleitung unter **Profil → App auf dem Handy installieren** (erkennt dein Gerät). Kurz gesagt:" },
            { l: [
              "**iPhone (Safari):** tippe **www.ipponleague.com** in die Leiste → Teilen-Button → Zum Home-Bildschirm.",
              "**Android (Chrome):** tippe **www.ipponleague.com** in die Leiste → Menü ⋮ → Zum Startbildschirm hinzufügen.",
            ] },
            { p: "Wichtig: tippe die vollständige Adresse in die Leiste, **suche nicht bei Google**." },
          ],
        },
      ],
    },
    {
      titulo: "So wird gespielt",
      itens: [
        {
          p: "Wie funktioniert Ippon League?",
          r: [
            { p: "Du startest mit **100 Judocoins (JC)** und stellst ein Team aus **8 Athleten** auf, wobei du **1 Kapitän** wählst (der doppelt punktet). Jeder internationale Wettkampf (Grand Slam, WM usw.) ist eine Runde." },
            { p: "Deine Athleten punkten durch die **realen Aktionen** in ihren Kämpfen. Je nachdem, wie sie abschneiden, gewinnst oder verlierst du Punkte, und dein Vermögen in JC steigt oder fällt. Du spielst Ligen und kannst im Gürtel aufsteigen." },
          ],
        },
        {
          p: "Wie gewinne (und verliere) ich Punkte?",
          r: [
            { p: "Die Punkte kommen aus den Aktionen deiner Athleten in den Kämpfen:" },
            { l: [
              "Ippon: **+10** · Waza-ari: **+4** · Yuko: **+2** · Beim Gegner provoziertes Shido: **+1**",
              "Kassiertes Ippon: **-5** · Kassiertes Waza-ari: **-2** · Kassiertes Yuko: **-1** · Erhaltenes Shido: **-2** · Hansoku-make: **-10**",
            ] },
            { p: "Dein **Kapitän** punktet doppelt für das Team. Wir werten nicht nach Sieg oder Medaille — nur nach den Aktionen — damit das Spiel nicht vorhersehbar ist." },
          ],
        },
        {
          p: "Wie verdiene ich Judocoins und vermeide, sie zu verlieren?",
          r: [
            { p: "Achtung: die **Punkte** (deine Rundenwertung) sind das eine; die **Judocoins** (dein Vermögen) das andere. Du startest mit **100 JC** und dieser Wert steigt oder fällt, je nachdem, ob die von dir aufgestellten Athleten **an Wert gewinnen oder verlieren**." },
            { p: "Ein Athlet **gewinnt an Wert**, wenn er seine Leistungserwartung übertrifft, und **verliert an Wert**, wenn er darunter bleibt. Hast du einen Athleten aufgestellt, der an Wert gewann, wächst dein Vermögen; verlor er, sinkt es." },
            { p: "Um JC zu verdienen und Verluste zu vermeiden:" },
            { l: [
              "Suche **unterbewertete** Athleten oder solche in guter Form, die über den Erwartungen liefern können.",
              "Vorsicht bei **sehr teuren** Athleten: von ihnen wird schon viel erwartet, daher verlieren sie leichter an Wert.",
              "Halte das Team ausgewogen — gib nicht alles für teure Namen aus.",
            ] },
            { p: "Damit der Markt nicht explodiert, wenden wir immer **die Hälfte** der berechneten Wertänderung an — das wirkt wie eine Bremse, die die Preise stabil hält." },
          ],
        },
        {
          p: "Was sind die Gürtel und wie steige ich auf oder ab?",
          r: [
            { p: "Dein Gürtel steht für deine **jüngste Leistung** im Vergleich zu den anderen Spielern, nicht für einen festen Aufstieg. Deshalb kannst du im Gürtel **aufsteigen, halten oder absteigen**." },
            { p: "Die Reihenfolge ist: Weiß → Blau → Gelb → Grün → Lila → Braun → Schwarz. Die höchsten sind für die Spieler an der Monatsspitze. Dein Gürtel ändert auch das Aussehen des Spiels." },
          ],
        },
        {
          p: "Was ist Ippon Pro?",
          r: [
            { p: "Ippon Pro ist das Abo, das dir einen **Wettbewerbsvorteil** gibt, bevor du aufstellst:" },
            { l: [
              "Erweiterter Scout und Historie jedes Athleten.",
              "Analyse deines Teams und Kapitäns-Tipp.",
              "Umfassendere Live-Begleitung am Wettkampftag.",
              "Wettkampfbaum: du siehst den Baum, wenn er erscheint, und am Ende, mit den Ergebnissen.",
            ] },
            { p: "Die Details siehst du unter **Profil → Ippon Pro und Pro Max**." },
          ],
        },
        {
          p: "Was ist Ippon Pro Max?",
          r: [
            { p: "Ippon Pro Max enthält **alles, was Pro hat** — und ergänzt außerdem:" },
            { l: [
              "**Live-Baum:** verfolge den Baum in Echtzeit, während des Wettkampfs. Verfügbar bei den Top-Wettkämpfen (WM, Grand Slam, Grand Prix, Masters und Olympia).",
              "**Favoriten-Alarm:** wir sagen Bescheid, wenn ein Athlet, dem du folgst, als Nächster kämpft.",
              "**Bis zu 10 Ligen und Pokale** (doppelt so viel wie Pro).",
              "**Baum-Analyse:** wer die besten Chancen hat, viel zu punkten oder weit zu kommen, nach den wahrscheinlichen Duellen. Auch bei den Top-Wettkämpfen.",
              "**Exklusive Gruppe** (WhatsApp/Telegram) nur für Pro-Max-Mitglieder.",
              "**Exklusives Layout und Design** für Pro Max.",
            ] },
            { p: "Die **Klassiker** (vergangene Wettkämpfe) haben keinen Live-Baum und keine Analyse, da sie bereits stattgefunden haben." },
            { p: "Die Details siehst du unter **Profil → Ippon Pro und Pro Max**." },
          ],
        },
      ],
    },
    {
      titulo: "Klassiker",
      itens: [
        {
          p: "Was sind die Klassiker?",
          r: [
            { p: "Die **Klassiker** sind prägende Wettkämpfe aus der Vergangenheit des Judo (aus früheren Jahren), die wir zum Spielen zurückbringen. Sie erscheinen immer **als „Klassiker“ gekennzeichnet** im Namen, damit du sie nie mit einem aktuellen Wettkampf verwechselst." },
            { p: "Sie sorgen dafür, dass es **immer eine Runde zum Spielen** gibt, auch in Wochen ohne internationalen Wettkampf im Kalender (wie in den Winter- und Sommerpausen)." },
          ],
        },
        {
          p: "Wie funktionieren die Klassiker?",
          r: [
            { p: "Du spielst genau wie in einem normalen Wettkampf: du stellst dein Team mit den **8 Athleten** auf, wählst den **Kapitän** und punktest durch die **Aktionen** der Athleten in diesem Wettkampf (Ippon, Waza-ari usw.)." },
            { p: "Der einzige Unterschied ist der Ursprung: statt eines gerade laufenden Wettkampfs ist es einer, der bereits stattfand und den wir reaktiviert haben. Die Regeln für Wertung, Wert und Gürtel sind dieselben wie immer." },
          ],
        },
      ],
    },
    {
      titulo: "Mein Konto",
      itens: [
        {
          p: "Ich habe mein Passwort vergessen. Wie stelle ich es wieder her?",
          r: [
            { l: [
              "Tippe im Anmeldebildschirm deine **E-Mail** ein.",
              "Tippe auf **„Passwort vergessen?“**.",
              "Du erhältst eine **E-Mail** mit einem Link. Öffne ihn.",
              "Lege das **neue Passwort** fest und melde dich damit an.",
            ] },
          ],
        },
        {
          p: "Wie ändere ich meine E-Mail oder mein Passwort?",
          r: [
            { p: "Alles im **Profil**:" },
            { l: [
              "**E-Mail:** Profil → deine Daten bearbeiten → E-Mail ändern. Du erhältst eine Bestätigungs-E-Mail; die E-Mail ändert sich erst nach der Bestätigung.",
              "**Passwort:** Profil → Sicherheit → Passwort ändern (fragt das aktuelle und das neue ab).",
            ] },
          ],
        },
      ],
    },
  ],
};

const CONTEUDO: Record<Lingua, Conteudo> = { pt: PT, en: EN, es: ES, fr: FR, de: DE };

export default function FAQ() {
  const t = useT();
  const { lingua } = useLingua();
  const [aberta, setAberta] = useState<string | null>(null);
  const conteudo = CONTEUDO[lingua] || PT;

  return (
    <main style={{ minHeight: "100vh", background: "#0c0e0d", color: "#f1ede2", fontFamily: FB }}>
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "16px 14px 60px" }}>
        <header style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <a href="/perfil" aria-label={t("comum.voltar")} style={{ width: 36, height: 36, borderRadius: "50%", border: "1px solid #243029", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none", color: "#93a39a", flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
          </a>
          <h1 style={{ fontFamily: FD, fontSize: 21, fontWeight: 700, textTransform: "uppercase", margin: 0 }}>{t("perfil.infoFaq")}</h1>
        </header>

        {conteudo.grupos.map((g) => (
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
                    {open && <div style={{ padding: "0 14px 14px" }}><Resposta blocos={qa.r} /></div>}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        <div style={{ background: "#121815", border: `1px solid ${GOLD}`, borderRadius: 14, padding: 16, textAlign: "center" }}>
          <div style={{ fontSize: 14, color: "#c7d0c9", marginBottom: 10 }}>{conteudo.naoEncontraste}</div>
          <a href="/ajuda" style={{ display: "inline-block", background: GOLD, color: "#1b211e", fontFamily: FD, fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", padding: "11px 20px", borderRadius: 11, textDecoration: "none" }}>{conteudo.falaConnosco}</a>
        </div>
      </div>
    </main>
  );
}
