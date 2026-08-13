// lib/dicionarioNotif.ts
//
// DICIONÁRIO DAS NOTIFICAÇÕES (templates), nas 5 línguas.
//
// É um módulo PURO: sem React, sem Supabase, sem hooks. Por isso pode ser
// importado tanto no cliente como no servidor. Aqui vivem só os textos FIXOS das
// notificações guardadas/push — mercado, faixa, liga, copa, Dôdo, fim de
// competição — que são sempre a mesma frase com variáveis ({nome}, {liga}, …).
//
// As notícias do Blog (texto livre) NÃO vêm aqui: essas traduzem-se por IA e a
// tradução vive em hub_noticias.traducoes (ver lib/traduzirNoticia.ts).
//
// Cada leva da Fase 3 acrescenta a este objeto as chaves da sua fonte. O
// servidor (lib/i18nServidor.ts) usa `renderNotif` para escolher a língua de
// quem recebe e preencher as variáveis.

export type LinguaNotif = "pt" | "en" | "es" | "fr" | "de";
export const LINGUAS_NOTIF: LinguaNotif[] = ["pt", "en", "es", "fr", "de"];

// Cada chave traz as 5 traduções. Termos de judô (ippon, waza-ari…) e nomes
// próprios (Ippon League, Copa do Dôdo, Judocoins…) ficam iguais em todas.
type Entrada = Record<LinguaNotif, string>;

export const NOTIF: Record<string, Entrada> = {
  "liga.pedidoTitulo": {
    pt: "Novo pedido na tua liga",
    en: "New request in your league",
    es: "Nueva solicitud en tu liga",
    fr: "Nouvelle demande dans ta ligue",
    de: "Neue Anfrage in deiner Liga",
  },
  "liga.pedidoCorpo": {
    pt: "Alguém quer entrar na liga \"{liga}\". Vê os pedidos para aprovar ou recusar.",
    en: "Someone wants to join the league \"{liga}\". Check the requests to approve or decline.",
    es: "Alguien quiere entrar en la liga \"{liga}\". Revisa las solicitudes para aceptar o rechazar.",
    fr: "Quelqu'un veut rejoindre la ligue \"{liga}\". Consulte les demandes pour accepter ou refuser.",
    de: "Jemand möchte der Liga \"{liga}\" beitreten. Sieh dir die Anfragen an, um zu bestätigen oder abzulehnen.",
  },
  "liga.recusadoTitulo": {
    pt: "Pedido de liga não aceite",
    en: "League request not accepted",
    es: "Solicitud de liga no aceptada",
    fr: "Demande de ligue non acceptée",
    de: "Liga-Anfrage nicht angenommen",
  },
  "liga.recusadoCorpo": {
    pt: "O teu pedido para a liga \"{liga}\" não foi aceite desta vez. Há muitas outras ligas para entrares!",
    en: "Your request to join \"{liga}\" wasn't accepted this time. There are plenty of other leagues to join!",
    es: "Tu solicitud para la liga \"{liga}\" no fue aceptada esta vez. ¡Hay muchas otras ligas para entrar!",
    fr: "Ta demande pour la ligue \"{liga}\" n'a pas été acceptée cette fois. Il y a plein d'autres ligues à rejoindre !",
    de: "Deine Anfrage für die Liga \"{liga}\" wurde diesmal nicht angenommen. Es gibt viele andere Ligen zum Beitreten!",
  },
  "liga.aprovadoTitulo": {
    pt: "Entraste na liga!",
    en: "You're in the league!",
    es: "¡Entraste en la liga!",
    fr: "Tu es dans la ligue !",
    de: "Du bist in der Liga!",
  },
  "liga.aprovadoCorpo": {
    pt: "O teu pedido para a liga \"{liga}\" foi aceite. Boa sorte na competição!",
    en: "Your request to join \"{liga}\" was accepted. Good luck in the competition!",
    es: "Tu solicitud para la liga \"{liga}\" fue aceptada. ¡Buena suerte en la competición!",
    fr: "Ta demande pour la ligue \"{liga}\" a été acceptée. Bonne chance dans la compétition !",
    de: "Deine Anfrage für die Liga \"{liga}\" wurde angenommen. Viel Erfolg im Wettkampf!",
  },
  "copa.bronze3Titulo": {
    pt: "3º lugar na Copa Ippon 🥉",
    en: "3rd place in the Copa Ippon 🥉",
    es: "3.º puesto en la Copa Ippon 🥉",
    fr: "3e place dans la Copa Ippon 🥉",
    de: "3. Platz in der Copa Ippon 🥉",
  },
  "copa.bronzeAutoCorpo": {
    pt: "Subiste ao pódio da Copa \"{liga}\". Não houve ninguém para disputar o bronze do teu lado da chave, por isso o 3º lugar é teu. Grande campanha!",
    en: "You reached the podium of the Copa \"{liga}\". There was no one to contest the bronze on your side of the bracket, so 3rd place is yours. Great run!",
    es: "Subiste al podio de la Copa \"{liga}\". No hubo nadie para disputar el bronce en tu lado del cuadro, así que el 3.º puesto es tuyo. ¡Gran campaña!",
    fr: "Tu montes sur le podium de la Copa \"{liga}\". Personne ne pouvait disputer le bronze de ton côté du tableau, donc la 3e place est à toi. Belle campagne !",
    de: "Du stehst auf dem Podium der Copa \"{liga}\". Auf deiner Seite des Baums gab es niemanden für Bronze, also gehört der 3. Platz dir. Starke Kampagne!",
  },
  "copa.campeaoTitulo": {
    pt: "És o CAMPEÃO da Copa Ippon! 🏆",
    en: "You're the CHAMPION of the Copa Ippon! 🏆",
    es: "¡Eres el CAMPEÓN de la Copa Ippon! 🏆",
    fr: "Tu es le CHAMPION de la Copa Ippon ! 🏆",
    de: "Du bist der CHAMPION der Copa Ippon! 🏆",
  },
  "copa.campeaoCorpo": {
    pt: "Venceste a final e és o campeão da Copa \"{liga}\". Que conquista!",
    en: "You won the final and you're the champion of the Copa \"{liga}\". What an achievement!",
    es: "Ganaste la final y eres el campeón de la Copa \"{liga}\". ¡Qué logro!",
    fr: "Tu as gagné la finale et tu es le champion de la Copa \"{liga}\". Quel exploit !",
    de: "Du hast das Finale gewonnen und bist der Champion der Copa \"{liga}\". Was für ein Erfolg!",
  },
  "copa.viceTitulo": {
    pt: "Vice-campeão da Copa Ippon 🥈",
    en: "Runner-up of the Copa Ippon 🥈",
    es: "Subcampeón de la Copa Ippon 🥈",
    fr: "Finaliste de la Copa Ippon 🥈",
    de: "Vizemeister der Copa Ippon 🥈",
  },
  "copa.viceCorpo": {
    pt: "Chegaste à final da Copa \"{liga}\" e ficaste em 2º. Grande campanha!",
    en: "You reached the final of the Copa \"{liga}\" and finished 2nd. Great run!",
    es: "Llegaste a la final de la Copa \"{liga}\" y quedaste 2.º. ¡Gran campaña!",
    fr: "Tu as atteint la finale de la Copa \"{liga}\" et terminé 2e. Belle campagne !",
    de: "Du hast das Finale der Copa \"{liga}\" erreicht und wurdest 2. Starke Kampagne!",
  },
  "copa.bronzeVencidoCorpo": {
    pt: "Venceste a disputa do bronze na Copa \"{liga}\". Subiste ao pódio!",
    en: "You won the bronze match in the Copa \"{liga}\". You made the podium!",
    es: "Ganaste la disputa del bronce en la Copa \"{liga}\". ¡Subiste al podio!",
    fr: "Tu as gagné le match pour le bronze dans la Copa \"{liga}\". Tu montes sur le podium !",
    de: "Du hast das Spiel um Bronze in der Copa \"{liga}\" gewonnen. Du bist aufs Podium gekommen!",
  },
  "copa.portasPodioTitulo": {
    pt: "Às portas do pódio",
    en: "Just short of the podium",
    es: "A las puertas del podio",
    fr: "Aux portes du podium",
    de: "Knapp am Podium vorbei",
  },
  "copa.portasPodioCorpo": {
    pt: "Perdeste a disputa do bronze na Copa \"{liga}\", mas chegaste muito longe. Que campanha!",
    en: "You lost the bronze match in the Copa \"{liga}\", but you came a long way. What a run!",
    es: "Perdiste la disputa del bronce en la Copa \"{liga}\", pero llegaste muy lejos. ¡Qué campaña!",
    fr: "Tu as perdu le match pour le bronze dans la Copa \"{liga}\", mais tu es allé très loin. Quelle campagne !",
    de: "Du hast das Spiel um Bronze in der Copa \"{liga}\" verloren, bist aber sehr weit gekommen. Was für eine Kampagne!",
  },
  "copa.repescagemVenceuTitulo": {
    pt: "Venceste na repescagem! 🔁",
    en: "You won in the repechage! 🔁",
    es: "¡Ganaste en la repesca! 🔁",
    fr: "Tu as gagné au repêchage ! 🔁",
    de: "Du hast in der Trostrunde gewonnen! 🔁",
  },
  "copa.repescagemVenceuCorpo": {
    pt: "Ganhaste o teu confronto de repescagem na Copa \"{liga}\" e segues para a disputa do bronze. A segunda chance é tua!",
    en: "You won your repechage match in the Copa \"{liga}\" and move on to the bronze match. The second chance is yours!",
    es: "Ganaste tu enfrentamiento de repesca en la Copa \"{liga}\" y avanzas a la disputa del bronce. ¡La segunda oportunidad es tuya!",
    fr: "Tu as gagné ton match de repêchage dans la Copa \"{liga}\" et tu passes au match pour le bronze. La seconde chance est à toi !",
    de: "Du hast dein Trostrunden-Duell in der Copa \"{liga}\" gewonnen und ziehst ins Spiel um Bronze ein. Die zweite Chance gehört dir!",
  },
  "copa.repescagemPerdeuTitulo": {
    pt: "Eliminado na repescagem",
    en: "Out in the repechage",
    es: "Eliminado en la repesca",
    fr: "Éliminé au repêchage",
    de: "In der Trostrunde ausgeschieden",
  },
  "copa.repescagemPerdeuCorpo": {
    pt: "Perdeste o confronto de repescagem na Copa \"{liga}\". Foi uma boa campanha — para a próxima, a revanche é tua!",
    en: "You lost your repechage match in the Copa \"{liga}\". It was a good run — next time, the rematch is yours!",
    es: "Perdiste el enfrentamiento de repesca en la Copa \"{liga}\". Fue una buena campaña — ¡la próxima, la revancha es tuya!",
    fr: "Tu as perdu ton match de repêchage dans la Copa \"{liga}\". Belle campagne — la prochaine fois, la revanche est à toi !",
    de: "Du hast dein Trostrunden-Duell in der Copa \"{liga}\" verloren. Es war eine gute Kampagne — nächstes Mal gehört die Revanche dir!",
  },
  "copa.avancouTitulo": {
    pt: "Avançaste na Copa! ⚔️",
    en: "You advanced in the Copa! ⚔️",
    es: "¡Avanzaste en la Copa! ⚔️",
    fr: "Tu as avancé dans la Copa ! ⚔️",
    de: "Du bist in der Copa weiter! ⚔️",
  },
  "copa.avancouCorpo": {
    pt: "Venceste o teu confronto na Copa \"{liga}\". Segues em frente — prepara a próxima ronda!",
    en: "You won your match in the Copa \"{liga}\". You move on — get ready for the next round!",
    es: "Ganaste tu enfrentamiento en la Copa \"{liga}\". Avanzas — ¡prepárate para la próxima ronda!",
    fr: "Tu as gagné ton match dans la Copa \"{liga}\". Tu continues — prépare le prochain tour !",
    de: "Du hast dein Duell in der Copa \"{liga}\" gewonnen. Du kommst weiter — mach dich bereit für die nächste Runde!",
  },
  "copa.paraRepescagemTitulo": {
    pt: "Perdeste este confronto — mas não acabou! 🔁",
    en: "You lost this match — but it's not over! 🔁",
    es: "Perdiste este enfrentamiento — ¡pero no se acabó! 🔁",
    fr: "Tu as perdu ce match — mais ce n'est pas fini ! 🔁",
    de: "Du hast dieses Duell verloren — aber es ist nicht vorbei! 🔁",
  },
  "copa.paraRepescagemCorpo": {
    pt: "Foste eliminado deste confronto na Copa \"{liga}\", mas a tua campanha continua: ainda podes lutar pelo 3º lugar. Não desanimes — vamos a essa repescagem!",
    en: "You were knocked out of this match in the Copa \"{liga}\", but your run continues: you can still fight for 3rd place. Don't give up — on to the repechage!",
    es: "Fuiste eliminado de este enfrentamiento en la Copa \"{liga}\", pero tu campaña continúa: aún puedes luchar por el 3.º puesto. ¡No te desanimes — a por la repesca!",
    fr: "Tu as été éliminé de ce match dans la Copa \"{liga}\", mais ta campagne continue : tu peux encore te battre pour la 3e place. Ne baisse pas les bras — direction le repêchage !",
    de: "Du bist aus diesem Duell in der Copa \"{liga}\" ausgeschieden, aber deine Kampagne geht weiter: Du kannst noch um Platz 3 kämpfen. Kopf hoch — ab in die Trostrunde!",
  },
  "copa.eliminadoTitulo": {
    pt: "Eliminado da Copa",
    en: "Out of the Copa",
    es: "Eliminado de la Copa",
    fr: "Éliminé de la Copa",
    de: "Aus der Copa ausgeschieden",
  },
  "copa.eliminadoCorpo": {
    pt: "Foste eliminado da Copa \"{liga}\". Foi uma boa campanha — para a próxima, a revanche é tua!",
    en: "You're out of the Copa \"{liga}\". It was a good run — next time, the rematch is yours!",
    es: "Fuiste eliminado de la Copa \"{liga}\". Fue una buena campaña — ¡la próxima, la revancha es tuya!",
    fr: "Tu es éliminé de la Copa \"{liga}\". Belle campagne — la prochaine fois, la revanche est à toi !",
    de: "Du bist aus der Copa \"{liga}\" ausgeschieden. Es war eine gute Kampagne — nächstes Mal gehört die Revanche dir!",
  },
  "comp.mundial1Titulo": {
    pt: "👑 És o nº1 do {comp}!",
    en: "👑 You're #1 at {comp}!",
    es: "👑 ¡Eres el nº1 del {comp}!",
    fr: "👑 Tu es le nº1 du {comp} !",
    de: "👑 Du bist die Nr. 1 beim {comp}!",
  },
  "comp.mundial1Corpo": {
    pt: "Ficaste em 1º lugar numa competição de nível {nivel}, com {pontos} pts. Estás entre os melhores do mundo na Ippon League. Que feito histórico!",
    en: "You finished 1st in a {nivel}-level competition with {pontos} pts. You're among the best in the world on the Ippon League. What a historic achievement!",
    es: "Terminaste 1.º en una competición de nivel {nivel}, con {pontos} pts. Estás entre los mejores del mundo en la Ippon League. ¡Qué logro histórico!",
    fr: "Tu as terminé 1er dans une compétition de niveau {nivel}, avec {pontos} pts. Tu es parmi les meilleurs du monde sur l'Ippon League. Quel exploit historique !",
    de: "Du wurdest 1. in einem Wettkampf der Stufe {nivel} mit {pontos} Pkt. Du gehörst zu den Besten der Welt in der Ippon League. Was für ein historischer Erfolg!",
  },
  "comp.mundial2Titulo": {
    pt: "🥈 Vice-campeão do {comp}!",
    en: "🥈 Runner-up at {comp}!",
    es: "🥈 ¡Subcampeón del {comp}!",
    fr: "🥈 Finaliste du {comp} !",
    de: "🥈 Vizemeister beim {comp}!",
  },
  "comp.mundial2Corpo": {
    pt: "Que feito! Ficaste em 2º lugar numa competição de nível {nivel}, com {pontos} pts. Estás no pódio dos melhores do mundo — falta tão pouco para o topo!",
    en: "What a result! You finished 2nd in a {nivel}-level competition with {pontos} pts. You're on the podium of the world's best — so close to the top!",
    es: "¡Qué logro! Terminaste 2.º en una competición de nivel {nivel}, con {pontos} pts. Estás en el podio de los mejores del mundo — ¡te falta tan poco para la cima!",
    fr: "Quel exploit ! Tu as terminé 2e dans une compétition de niveau {nivel}, avec {pontos} pts. Tu es sur le podium des meilleurs du monde — si près du sommet !",
    de: "Was für eine Leistung! Du wurdest 2. in einem Wettkampf der Stufe {nivel} mit {pontos} Pkt. Du stehst auf dem Podium der Weltbesten — so nah an der Spitze!",
  },
  "comp.mundial3Titulo": {
    pt: "🥉 No pódio do {comp}!",
    en: "🥉 On the podium at {comp}!",
    es: "🥉 ¡En el podio del {comp}!",
    fr: "🥉 Sur le podium du {comp} !",
    de: "🥉 Auf dem Podium beim {comp}!",
  },
  "comp.mundial3Corpo": {
    pt: "Brilhante! 3º lugar numa competição de nível {nivel}, com {pontos} pts. Subiste ao pódio mundial da Ippon League — orgulha-te disso!",
    en: "Brilliant! 3rd place in a {nivel}-level competition with {pontos} pts. You made the Ippon League world podium — be proud of it!",
    es: "¡Brillante! 3.º puesto en una competición de nivel {nivel}, con {pontos} pts. Subiste al podio mundial de la Ippon League — ¡siéntete orgulloso!",
    fr: "Brillant ! 3e place dans une compétition de niveau {nivel}, avec {pontos} pts. Tu es monté sur le podium mondial de l'Ippon League — sois-en fier !",
    de: "Brillant! 3. Platz in einem Wettkampf der Stufe {nivel} mit {pontos} Pkt. Du hast das Weltpodium der Ippon League erreicht — sei stolz darauf!",
  },
  "comp.venceu1Titulo": {
    pt: "🥇 Venceste a {rotulo}!",
    en: "🥇 You won the {rotulo}!",
    es: "🥇 ¡Ganaste la {rotulo}!",
    fr: "🥇 Tu as gagné la {rotulo} !",
    de: "🥇 Du hast die {rotulo} gewonnen!",
  },
  "comp.venceu1Corpo": {
    pt: "Ficaste em 1º lugar no {comp} com {pontos} pts. Que rodada! Vê como ficou a tua liga.",
    en: "You finished 1st at {comp} with {pontos} pts. What a round! See how your league turned out.",
    es: "Terminaste 1.º en el {comp} con {pontos} pts. ¡Qué ronda! Mira cómo quedó tu liga.",
    fr: "Tu as terminé 1er au {comp} avec {pontos} pts. Quelle journée ! Regarde le classement de ta ligue.",
    de: "Du wurdest 1. beim {comp} mit {pontos} Pkt. Was für eine Runde! Sieh dir an, wie deine Liga steht.",
  },
  "comp.lugar2Titulo": {
    pt: "🥈 2º lugar na {rotulo}!",
    en: "🥈 2nd place in the {rotulo}!",
    es: "🥈 ¡2.º puesto en la {rotulo}!",
    fr: "🥈 2e place dans la {rotulo} !",
    de: "🥈 2. Platz in der {rotulo}!",
  },
  "comp.lugar2Corpo": {
    pt: "Grande rodada no {comp}: {pontos} pts e o vice-pódio. Vê a tua liga.",
    en: "Great round at {comp}: {pontos} pts and the runner-up spot. Check your league.",
    es: "Gran ronda en el {comp}: {pontos} pts y el subcampeonato. Mira tu liga.",
    fr: "Belle journée au {comp} : {pontos} pts et la place de finaliste. Regarde ta ligue.",
    de: "Starke Runde beim {comp}: {pontos} Pkt und der Vizeplatz. Sieh dir deine Liga an.",
  },
  "comp.lugar3Titulo": {
    pt: "🥉 3º lugar na {rotulo}!",
    en: "🥉 3rd place in the {rotulo}!",
    es: "🥉 ¡3.º puesto en la {rotulo}!",
    fr: "🥉 3e place dans la {rotulo} !",
    de: "🥉 3. Platz in der {rotulo}!",
  },
  "comp.lugar3Corpo": {
    pt: "Subiste ao pódio no {comp} com {pontos} pts. Vê a tua liga.",
    en: "You made the podium at {comp} with {pontos} pts. Check your league.",
    es: "Subiste al podio en el {comp} con {pontos} pts. Mira tu liga.",
    fr: "Tu es monté sur le podium au {comp} avec {pontos} pts. Regarde ta ligue.",
    de: "Du bist beim {comp} aufs Podium gekommen mit {pontos} Pkt. Sieh dir deine Liga an.",
  },
  "comp.resultadoTitulo": {
    pt: "Resultado da {rotulo}",
    en: "{rotulo} result",
    es: "Resultado de la {rotulo}",
    fr: "Résultat de la {rotulo}",
    de: "Ergebnis der {rotulo}",
  },
  "comp.resultadoCorpo": {
    pt: "O {comp} terminou. Fizeste {pontos} pts — vê a tua posição na liga.",
    en: "{comp} is over. You scored {pontos} pts — see your spot in the league.",
    es: "El {comp} terminó. Hiciste {pontos} pts — mira tu posición en la liga.",
    fr: "Le {comp} est terminé. Tu as fait {pontos} pts — vois ta position dans la ligue.",
    de: "Der {comp} ist vorbei. Du hast {pontos} Pkt gemacht — sieh dir deine Position in der Liga an.",
  },
  "mercado.abertoTitulo": {
    pt: "🥋 Mercado aberto: {comp}",
    en: "🥋 Market open: {comp}",
    es: "🥋 Mercado abierto: {comp}",
    fr: "🥋 Marché ouvert : {comp}",
    de: "🥋 Markt offen: {comp}",
  },
  "mercado.abertoCorpo": {
    pt: "Já podes montar a tua equipa para o {comp}. O mercado fecha em {tempo} — escala os teus 8 atletas e o capitão antes de fechar!",
    en: "You can now build your team for {comp}. The market closes in {tempo} — line up your 8 athletes and captain before it closes!",
    es: "Ya puedes montar tu equipo para el {comp}. El mercado cierra en {tempo} — ¡alinea a tus 8 atletas y al capitán antes del cierre!",
    fr: "Tu peux maintenant constituer ton équipe pour le {comp}. Le marché ferme dans {tempo} — aligne tes 8 athlètes et ton capitaine avant la fermeture !",
    de: "Du kannst jetzt dein Team für {comp} aufstellen. Der Markt schließt in {tempo} — stell deine 8 Athleten und den Kapitän auf, bevor er schließt!",
  },
  "mercado.ajustarTitulo": {
    pt: "⏰ Última chance para ajustar: {comp}",
    en: "⏰ Last chance to adjust: {comp}",
    es: "⏰ Última oportunidad para ajustar: {comp}",
    fr: "⏰ Dernière chance pour ajuster : {comp}",
    de: "⏰ Letzte Chance zum Anpassen: {comp}",
  },
  "mercado.ajustarCorpo": {
    pt: "O mercado do {comp} fecha em {tempo}. Ainda dá para trocar atletas ou mudar o capitão — confere a tua equipa antes de fechar!",
    en: "The market for {comp} closes in {tempo}. You can still swap athletes or change the captain — check your team before it closes!",
    es: "El mercado del {comp} cierra en {tempo}. Aún puedes cambiar atletas o al capitán — ¡revisa tu equipo antes del cierre!",
    fr: "Le marché du {comp} ferme dans {tempo}. Tu peux encore changer d'athlètes ou de capitaine — vérifie ton équipe avant la fermeture !",
    de: "Der Markt für {comp} schließt in {tempo}. Du kannst noch Athleten oder den Kapitän tauschen — prüfe dein Team, bevor er schließt!",
  },
  "mercado.fechadoJogoTitulo": {
    pt: "Mercado fechado: {comp} vai começar",
    en: "Market closed: {comp} is about to start",
    es: "Mercado cerrado: {comp} va a empezar",
    fr: "Marché fermé : {comp} va commencer",
    de: "Markt geschlossen: {comp} beginnt gleich",
  },
  "mercado.fechadoJogoCorpo": {
    pt: "A tua equipa está escalada e em jogo no {comp}. Boa sorte! Acompanha a pontuação ao vivo.",
    en: "Your team is lined up and in play at {comp}. Good luck! Follow the scoring live.",
    es: "Tu equipo está alineado y en juego en el {comp}. ¡Buena suerte! Sigue la puntuación en directo.",
    fr: "Ton équipe est alignée et en jeu au {comp}. Bonne chance ! Suis les points en direct.",
    de: "Dein Team ist aufgestellt und im Spiel beim {comp}. Viel Glück! Verfolge die Punkte live.",
  },
  "mercado.fechadoForaTitulo": {
    pt: "Mercado fechado: {comp}",
    en: "Market closed: {comp}",
    es: "Mercado cerrado: {comp}",
    fr: "Marché fermé : {comp}",
    de: "Markt geschlossen: {comp}",
  },
  "mercado.fechadoForaCorpo": {
    pt: "O mercado fechou e não montaste equipa para o {comp}. Ficaste de fora desta rodada — prepara-te para a próxima!",
    en: "The market closed and you didn't build a team for {comp}. You're out this round — get ready for the next one!",
    es: "El mercado cerró y no montaste equipo para el {comp}. Te quedaste fuera de esta ronda — ¡prepárate para la próxima!",
    fr: "Le marché a fermé et tu n'as pas constitué d'équipe pour le {comp}. Tu es hors-jeu cette journée — prépare-toi pour la prochaine !",
    de: "Der Markt hat geschlossen und du hast kein Team für {comp} aufgestellt. Du bist diese Runde raus — mach dich bereit für die nächste!",
  },
  "dodo.sorteadoTitulo": {
    pt: "🏆 Entraste na {numero}ª Copa do Dôdo!",
    en: "🏆 You're in the Copa do Dôdo #{numero}!",
    es: "🏆 ¡Entraste en la {numero}.ª Copa do Dôdo!",
    fr: "🏆 Tu es dans la {numero}e Copa do Dôdo !",
    de: "🏆 Du bist in der {numero}. Copa do Dôdo!",
  },
  "dodo.sorteadoCorpo": {
    pt: "Parabéns — a tua vaga saiu no sorteio. És um dos {n} em prova e, a partir de agora, cada rodada elimina metade. Fica atento às competições seguintes: os pontos da tua equipa contam a sério e não há segunda hipótese. Vais representar o teu país e o teu continente. Boa sorte, campeão!",
    en: "Congratulations — your spot came up in the draw. You're one of {n} in the running and, from now on, each round eliminates half. Keep an eye on the coming competitions: your team's points count for real and there's no second chance. You'll represent your country and your continent. Good luck, champion!",
    es: "¡Enhorabuena! — tu plaza salió en el sorteo. Eres uno de {n} en competición y, a partir de ahora, cada ronda elimina a la mitad. Atento a las próximas competiciones: los puntos de tu equipo cuentan de verdad y no hay segunda oportunidad. Representarás a tu país y a tu continente. ¡Buena suerte, campeón!",
    fr: "Félicitations — ta place est sortie au tirage. Tu es l'un des {n} en lice et, à partir de maintenant, chaque tour élimine la moitié. Reste attentif aux prochaines compétitions : les points de ton équipe comptent pour de vrai et il n'y a pas de seconde chance. Tu représenteras ton pays et ton continent. Bonne chance, champion !",
    de: "Glückwunsch — dein Platz kam bei der Auslosung. Du bist einer von {n} im Rennen und ab jetzt scheidet in jeder Runde die Hälfte aus. Behalte die kommenden Wettkämpfe im Auge: Die Punkte deines Teams zählen wirklich und es gibt keine zweite Chance. Du vertrittst dein Land und deinen Kontinent. Viel Glück, Champion!",
  },
  "dodo.naoSorteadoTitulo": {
    pt: "A tua vaga não saiu no sorteio",
    en: "Your spot didn't come up in the draw",
    es: "Tu plaza no salió en el sorteo",
    fr: "Ta place n'est pas sortie au tirage",
    de: "Dein Platz kam nicht bei der Auslosung",
  },
  "dodo.naoSorteadoCorpo": {
    pt: "Houve mais inscritos do que lugares na {numero}ª Copa do Dôdo e o sorteio decidiu. Não teve nada a ver com o teu desempenho — foi mesmo sorte. A próxima edição volta a abrir com todas as vagas em jogo, e podes acompanhar esta Copa na mesma. Até lá, há as ligas Mundial e Continental a correr.",
    en: "There were more entrants than spots in the Copa do Dôdo #{numero}, and the draw decided. It had nothing to do with your performance — it was pure luck. The next edition opens again with every spot up for grabs, and you can still follow this Copa. Until then, the World and Continental leagues are running.",
    es: "Hubo más inscritos que plazas en la {numero}.ª Copa do Dôdo y el sorteo decidió. No tuvo nada que ver con tu rendimiento — fue pura suerte. La próxima edición vuelve a abrir con todas las plazas en juego, y puedes seguir esta Copa igualmente. Hasta entonces, están las ligas Mundial y Continental en marcha.",
    fr: "Il y a eu plus d'inscrits que de places dans la {numero}e Copa do Dôdo, et le tirage a décidé. Cela n'a rien à voir avec ta performance — c'était de la pure chance. La prochaine édition rouvre avec toutes les places en jeu, et tu peux suivre cette Copa quand même. D'ici là, les ligues Mondiale et Continentale sont en cours.",
    de: "Es gab mehr Anmeldungen als Plätze in der {numero}. Copa do Dôdo, und die Auslosung hat entschieden. Es hatte nichts mit deiner Leistung zu tun — es war reines Glück. Die nächste Ausgabe öffnet wieder mit allen Plätzen, und du kannst diese Copa trotzdem verfolgen. Bis dahin laufen die Welt- und Kontinentalligen.",
  },
  "dodo.inscricaoTitulo": {
    pt: "Inscrição feita na {numero}ª Copa do Dôdo",
    en: "You're entered in the Copa do Dôdo #{numero}",
    es: "Inscripción hecha en la {numero}.ª Copa do Dôdo",
    fr: "Inscription faite à la {numero}e Copa do Dôdo",
    de: "Anmeldung für die {numero}. Copa do Dôdo erledigt",
  },
  "dodo.inscricaoCorpo": {
    pt: "Estás no sorteio, a concorrer pelas vagas do teu continente ({cont}). O sorteio sai a {data}, na véspera da competição que abre a Copa, e avisamos-te aqui no momento. Não é por ordem de chegada: teres-te inscrito hoje ou no último dia dá exatamente a mesma hipótese.",
    en: "You're in the draw, competing for your continent's spots ({cont}). The draw takes place on {data}, the eve of the competition that opens the Copa, and we'll let you know right here when it does. It's not first-come, first-served: entering today or on the last day gives you exactly the same chance.",
    es: "Estás en el sorteo, compitiendo por las plazas de tu continente ({cont}). El sorteo se hace el {data}, la víspera de la competición que abre la Copa, y te avisamos aquí en el momento. No es por orden de llegada: inscribirte hoy o el último día te da exactamente la misma oportunidad.",
    fr: "Tu es dans le tirage, en lice pour les places de ton continent ({cont}). Le tirage a lieu le {data}, la veille de la compétition qui ouvre la Copa, et on te prévient ici à ce moment-là. Ce n'est pas premier arrivé, premier servi : t'inscrire aujourd'hui ou le dernier jour te donne exactement la même chance.",
    de: "Du bist in der Auslosung und kämpfst um die Plätze deines Kontinents ({cont}). Die Auslosung findet am {data} statt, am Vorabend des Wettkampfs, der die Copa eröffnet, und wir sagen dir hier sofort Bescheid. Es gilt nicht: wer zuerst kommt — ob du dich heute oder am letzten Tag anmeldest, gibt dir genau dieselbe Chance.",
  },
  "faixa.subiuTitulo": {
    pt: "🥋 Subiste para a faixa {faixa}!",
    en: "🥋 You moved up to the {faixa} belt!",
    es: "🥋 ¡Subiste al cinturón {faixa}!",
    fr: "🥋 Tu es passé à la ceinture {faixa} !",
    de: "🥋 Du bist auf den {faixa} Gürtel aufgestiegen!",
  },
  "faixa.subiuCorpo": {
    pt: "Parabéns! O teu desempenho levou-te à faixa {faixa}. Estás entre os melhores — continua assim e vai mais longe!",
    en: "Congratulations! Your performance took you to the {faixa} belt. You're among the best — keep it up and go even further!",
    es: "¡Enhorabuena! Tu rendimiento te llevó al cinturón {faixa}. Estás entre los mejores — ¡sigue así y llega más lejos!",
    fr: "Félicitations ! Ta performance t'a mené à la ceinture {faixa}. Tu es parmi les meilleurs — continue comme ça et va encore plus loin !",
    de: "Glückwunsch! Deine Leistung hat dich auf den {faixa} Gürtel gebracht. Du gehörst zu den Besten — weiter so und komm noch weiter!",
  },
  "faixa.desceuTitulo": {
    pt: "Faixa {faixa} — a próxima é tua",
    en: "{faixa} belt — the next one is yours",
    es: "Cinturón {faixa} — el próximo es tuyo",
    fr: "Ceinture {faixa} — la prochaine est à toi",
    de: "{faixa} Gürtel — der nächste gehört dir",
  },
  "faixa.desceuCorpo": {
    pt: "Desta vez desceste para a faixa {faixa}, mas isto faz parte do jogo. Monta uma boa equipa na próxima rodada e recupera o teu lugar — acreditamos em ti!",
    en: "This time you dropped to the {faixa} belt, but that's part of the game. Build a good team next round and win your spot back — we believe in you!",
    es: "Esta vez bajaste al cinturón {faixa}, pero eso es parte del juego. Monta un buen equipo en la próxima ronda y recupera tu lugar — ¡creemos en ti!",
    fr: "Cette fois tu es redescendu à la ceinture {faixa}, mais ça fait partie du jeu. Constitue une bonne équipe à la prochaine journée et reprends ta place — on croit en toi !",
    de: "Diesmal bist du auf den {faixa} Gürtel abgestiegen, aber das gehört zum Spiel. Stell in der nächsten Runde ein gutes Team auf und hol dir deinen Platz zurück — wir glauben an dich!",
  },
  "faixa.mantidaTitulo": {
    pt: "🥋 Mantiveste a faixa {faixa}",
    en: "🥋 You kept the {faixa} belt",
    es: "🥋 Mantuviste el cinturón {faixa}",
    fr: "🥋 Tu as gardé la ceinture {faixa}",
    de: "🥋 Du hast den {faixa} Gürtel gehalten",
  },
  "faixa.mantidaTopoCorpo": {
    pt: "Fechaste o mês na faixa {faixa} — o topo da Ippon League. Agora é aguentar lá em cima: no próximo mês há quem venha atrás do teu lugar.",
    en: "You ended the month on the {faixa} belt — the top of the Ippon League. Now it's about holding on up there: next month, others will be coming for your spot.",
    es: "Cerraste el mes en el cinturón {faixa} — la cima de la Ippon League. Ahora toca aguantar ahí arriba: el próximo mes habrá quien venga a por tu lugar.",
    fr: "Tu as terminé le mois sur la ceinture {faixa} — le sommet de l'Ippon League. Maintenant il faut tenir là-haut : le mois prochain, d'autres viendront pour ta place.",
    de: "Du hast den Monat auf dem {faixa} Gürtel beendet — der Spitze der Ippon League. Jetzt heißt es, oben zu bleiben: Nächsten Monat kommen andere für deinen Platz.",
  },
  "faixa.mantidaPortaCorpo": {
    pt: "Fechaste o mês na faixa {faixa}, mesmo à porta da seguinte. No próximo mês é tua.",
    en: "You ended the month on the {faixa} belt, right on the doorstep of the next one. Next month it's yours.",
    es: "Cerraste el mes en el cinturón {faixa}, justo a las puertas del siguiente. El próximo mes es tuyo.",
    fr: "Tu as terminé le mois sur la ceinture {faixa}, juste aux portes de la suivante. Le mois prochain, elle est à toi.",
    de: "Du hast den Monat auf dem {faixa} Gürtel beendet, direkt vor dem nächsten. Nächsten Monat gehört er dir.",
  },
  "faixa.mantidaFaltaCorpo": {
    pt: "Fechaste o mês na faixa {faixa}. Faltaram {falta} pontos para a {faixaAcima} — dá para ir buscá-los no próximo mês!",
    en: "You ended the month on the {faixa} belt. You were {falta} points short of the {faixaAcima} — you can go get them next month!",
    es: "Cerraste el mes en el cinturón {faixa}. Te faltaron {falta} puntos para el {faixaAcima} — ¡puedes ir a por ellos el próximo mes!",
    fr: "Tu as terminé le mois sur la ceinture {faixa}. Il t'a manqué {falta} points pour la {faixaAcima} — tu peux aller les chercher le mois prochain !",
    de: "Du hast den Monat auf dem {faixa} Gürtel beendet. Dir fehlten {falta} Punkte für den {faixaAcima} — die kannst du dir nächsten Monat holen!",
  },
  "melhorRodada.mundialTitulo": {
    pt: "🥇 És o Melhor da Rodada — Mundial!",
    en: "🥇 You're the Best of the Round — World!",
    es: "🥇 ¡Eres el Mejor de la Ronda — Mundial!",
    fr: "🥇 Tu es le Meilleur de la Journée — Mondial !",
    de: "🥇 Du bist der Beste der Runde — Welt!",
  },
  "melhorRodada.mundialMaisTitulo": {
    pt: "🥇 És o Melhor da Rodada — Mundial + {cont}!",
    en: "🥇 You're the Best of the Round — World + {cont}!",
    es: "🥇 ¡Eres el Mejor de la Ronda — Mundial + {cont}!",
    fr: "🥇 Tu es le Meilleur de la Journée — Mondial + {cont} !",
    de: "🥇 Du bist der Beste der Runde — Welt + {cont}!",
  },
  "melhorRodada.continentalTitulo": {
    pt: "🥇 És o Melhor da Rodada — {cont}!",
    en: "🥇 You're the Best of the Round — {cont}!",
    es: "🥇 ¡Eres el Mejor de la Ronda — {cont}!",
    fr: "🥇 Tu es le Meilleur de la Journée — {cont} !",
    de: "🥇 Du bist der Beste der Runde — {cont}!",
  },
  "melhorRodada.mundialCorpo": {
    pt: "Parabéns! Foste o nº1 do mundo em {comp}. Vê e partilha o teu certificado na liga oficial.",
    en: "Congratulations! You were #1 in the world at {comp}. See and share your certificate in the official league.",
    es: "¡Enhorabuena! Fuiste el nº1 del mundo en {comp}. Mira y comparte tu certificado en la liga oficial.",
    fr: "Félicitations ! Tu as été le nº1 du monde au {comp}. Vois et partage ton certificat dans la ligue officielle.",
    de: "Glückwunsch! Du warst die Nr. 1 der Welt beim {comp}. Sieh dir dein Zertifikat an und teile es in der offiziellen Liga.",
  },
  "melhorRodada.continentalCorpo": {
    pt: "Parabéns! Foste o nº1 de {cont} em {comp}. Vê e partilha o teu certificado na liga oficial.",
    en: "Congratulations! You were the #1 of {cont} at {comp}. See and share your certificate in the official league.",
    es: "¡Enhorabuena! Fuiste el nº1 de {cont} en {comp}. Mira y comparte tu certificado en la liga oficial.",
    fr: "Félicitations ! Tu as été le nº1 de {cont} au {comp}. Vois et partage ton certificat dans la ligue officielle.",
    de: "Glückwunsch! Du warst die Nr. 1 von {cont} beim {comp}. Sieh dir dein Zertifikat an und teile es in der offiziellen Liga.",
  },
  "evento.aniversarioTitulo": {
    pt: "Parabéns!",
    en: "Happy birthday!",
    es: "¡Feliz cumpleaños!",
    fr: "Joyeux anniversaire !",
    de: "Alles Gute zum Geburtstag!",
  },
  "evento.aniversarioCorpo": {
    pt: "Hoje é o teu dia, e nós cá da Ippon League queremos celebrá-lo contigo! 🥋 Estamos muito felizes por fazeres parte desta comunidade de apaixonados pelo judô. Que este novo ano te traga muitas alegrias, conquistas no tatame e fora dele — e que continues a crescer e a divertir-te connosco. Um grande abraço, e parabéns! 🎂",
    en: "Today is your day, and all of us at the Ippon League want to celebrate it with you! 🥋 We're so happy you're part of this community of judo lovers. May this new year bring you plenty of joy, wins on the tatame and beyond — and may you keep growing and having fun with us. A big hug, and happy birthday! 🎂",
    es: "¡Hoy es tu día, y en la Ippon League queremos celebrarlo contigo! 🥋 Estamos muy felices de que formes parte de esta comunidad de apasionados por el judo. Que este nuevo año te traiga muchas alegrías, logros en el tatame y fuera de él — y que sigas creciendo y divirtiéndote con nosotros. ¡Un fuerte abrazo y feliz cumpleaños! 🎂",
    fr: "Aujourd'hui, c'est ton jour, et toute l'équipe de l'Ippon League veut le célébrer avec toi ! 🥋 Nous sommes très heureux que tu fasses partie de cette communauté de passionnés de judo. Que cette nouvelle année t'apporte plein de joies, des victoires sur le tatame et en dehors — et que tu continues à grandir et à t'amuser avec nous. Une grosse accolade, et joyeux anniversaire ! 🎂",
    de: "Heute ist dein Tag, und wir alle bei der Ippon League wollen ihn mit dir feiern! 🥋 Wir freuen uns sehr, dass du Teil dieser Gemeinschaft von Judo-Fans bist. Möge dir dieses neue Jahr viel Freude bringen, Erfolge auf dem Tatame und darüber hinaus — und mögest du weiter mit uns wachsen und Spaß haben. Eine große Umarmung und alles Gute zum Geburtstag! 🎂",
  },
  "evento.diaDoJudoTitulo": {
    pt: "Dia Mundial do Judô",
    en: "World Judo Day",
    es: "Día Mundial del Judo",
    fr: "Journée mondiale du judo",
    de: "Welt-Judo-Tag",
  },
  "evento.diaDoJudoCorpo": {
    pt: "Hoje é o Dia Mundial do Judô! Parabéns a todos os que amam este desporto. Que tal homenagear a data com uma escalação de respeito?",
    en: "Today is World Judo Day! Congratulations to everyone who loves this sport. How about honoring the day with a lineup to be proud of?",
    es: "¡Hoy es el Día Mundial del Judo! Enhorabuena a todos los que aman este deporte. ¿Qué tal homenajear la fecha con una alineación de respeto?",
    fr: "Aujourd'hui, c'est la Journée mondiale du judo ! Félicitations à tous ceux qui aiment ce sport. Et si tu rendais hommage à cette date avec une composition de respect ?",
    de: "Heute ist der Welt-Judo-Tag! Glückwunsch an alle, die diesen Sport lieben. Wie wäre es, den Tag mit einer Aufstellung zu ehren, die sich sehen lassen kann?",
  },

  // --- EMAIL de confirmação de conta (app/api/verificar-email) ---
  // Sai na língua de quem recebe (users.lingua). {marca} recebe o "Ippon League"
  // em <strong>; {nome} recebe o primeiro nome já escapado; {horas} a validade.
  "email.confirmarAssunto": {
    pt: "Confirma o teu email — Ippon League",
    en: "Confirm your email — Ippon League",
    es: "Confirma tu correo — Ippon League",
    fr: "Confirme ton e-mail — Ippon League",
    de: "Bestätige deine E-Mail — Ippon League",
  },
  "email.confirmarFallbackNome": {
    pt: "Campeão",
    en: "Champion",
    es: "Campeón",
    fr: "Champion",
    de: "Champion",
  },
  "email.confirmarSaudacao": {
    pt: "Olá, {nome}!",
    en: "Hi, {nome}!",
    es: "¡Hola, {nome}!",
    fr: "Salut, {nome} !",
    de: "Hallo, {nome}!",
  },
  "email.confirmarFrase": {
    pt: "Falta um passo para a tua conta na {marca} ficar completa: confirmar que este email é mesmo teu.",
    en: "There's one step left to complete your {marca} account: confirming that this email is really yours.",
    es: "Falta un paso para completar tu cuenta en la {marca}: confirmar que este correo es realmente tuyo.",
    fr: "Il reste une étape pour finaliser ton compte sur l'{marca} : confirmer que cet e-mail est bien le tien.",
    de: "Nur noch ein Schritt, um dein Konto bei der {marca} abzuschließen: bestätigen, dass diese E-Mail wirklich dir gehört.",
  },
  "email.confirmarBotao": {
    pt: "Confirmar o meu email",
    en: "Confirm my email",
    es: "Confirmar mi correo",
    fr: "Confirmer mon e-mail",
    de: "Meine E-Mail bestätigen",
  },
  "email.confirmarValidade": {
    pt: "Serve durante {horas} horas. Se expirar, pedes outro dentro da app.",
    en: "It works for {horas} hours. If it expires, request another one inside the app.",
    es: "Sirve durante {horas} horas. Si caduca, pide otro dentro de la app.",
    fr: "Valable {horas} heures. S'il expire, demandes-en un autre dans l'appli.",
    de: "Gültig für {horas} Stunden. Wenn er abläuft, fordere in der App einen neuen an.",
  },
  "email.confirmarIgnora": {
    pt: "Se não foste tu que te registaste, ignora este email — sem confirmação, nada acontece.",
    en: "If you didn't sign up, just ignore this email — without confirmation, nothing happens.",
    es: "Si no fuiste tú quien se registró, ignora este correo — sin confirmación, no pasa nada.",
    fr: "Si ce n'est pas toi qui t'es inscrit, ignore cet e-mail — sans confirmation, rien ne se passe.",
    de: "Wenn du dich nicht registriert hast, ignoriere diese E-Mail einfach — ohne Bestätigung passiert nichts.",
  },

  // --- CONTAS INATIVAS (app/api/contas-inativas) — email + sino ---
  // {dias} = quantos dias faltam; {time} = " <strong>NomeTime</strong>" ou "".
  // A saudação e o nome-de-recurso reaproveitam as chaves do email de confirmação.
  "inativa.emailAssunto": {
    pt: "A tua conta será apagada em {dias} dias",
    en: "Your account will be deleted in {dias} days",
    es: "Tu cuenta será eliminada en {dias} días",
    fr: "Ton compte sera supprimé dans {dias} jours",
    de: "Dein Konto wird in {dias} Tagen gelöscht",
  },
  "inativa.emailFrase1": {
    pt: "Há quase um ano que não entras na <strong>Ippon League</strong>, e a tua conta{time} será apagada dentro de <strong>{dias} dias</strong>.",
    en: "You haven't been to the <strong>Ippon League</strong> in almost a year, and your account{time} will be deleted in <strong>{dias} days</strong>.",
    es: "Hace casi un año que no entras en la <strong>Ippon League</strong>, y tu cuenta{time} será eliminada dentro de <strong>{dias} días</strong>.",
    fr: "Cela fait presque un an que tu n'es pas venu sur l'<strong>Ippon League</strong>, et ton compte{time} sera supprimé dans <strong>{dias} jours</strong>.",
    de: "Du warst seit fast einem Jahr nicht mehr bei der <strong>Ippon League</strong>, und dein Konto{time} wird in <strong>{dias} Tagen</strong> gelöscht.",
  },
  "inativa.emailFrase2": {
    pt: "Se voltares, fica tudo como estava — e a contagem recomeça. Basta abrir a app uma vez.",
    en: "If you come back, everything stays as it was — and the countdown resets. Just open the app once.",
    es: "Si vuelves, todo queda como estaba — y la cuenta atrás se reinicia. Solo tienes que abrir la app una vez.",
    fr: "Si tu reviens, tout reste comme avant — et le compte à rebours repart. Il suffit d'ouvrir l'appli une fois.",
    de: "Wenn du zurückkommst, bleibt alles, wie es war — und der Countdown beginnt von vorn. Öffne die App einfach einmal.",
  },
  "inativa.emailBotao": {
    pt: "Voltar ao dojo",
    en: "Back to the dojo",
    es: "Volver al dojo",
    fr: "Retour au dojo",
    de: "Zurück ins Dojo",
  },
  "inativa.emailRodape": {
    pt: "Se preferires não continuar, não precisas de fazer nada. O nome do teu time volta a ficar disponível para outra pessoa.",
    en: "If you'd rather not continue, you don't need to do anything. Your team's name becomes available for someone else.",
    es: "Si prefieres no continuar, no necesitas hacer nada. El nombre de tu time vuelve a quedar disponible para otra persona.",
    fr: "Si tu préfères ne pas continuer, tu n'as rien à faire. Le nom de ton équipe redevient disponible pour quelqu'un d'autre.",
    de: "Wenn du lieber nicht weitermachst, musst du nichts tun. Der Name deines Teams wird wieder für jemand anderen frei.",
  },
  "inativa.sinoCorpo": {
    pt: "Há quase um ano que não entras. Abre a app uma vez para manteres tudo como está.",
    en: "You haven't been here in almost a year. Open the app once to keep everything as it is.",
    es: "Hace casi un año que no entras. Abre la app una vez para mantener todo como está.",
    fr: "Cela fait presque un an que tu n'es pas venu. Ouvre l'appli une fois pour tout garder comme c'est.",
    de: "Du warst seit fast einem Jahr nicht mehr hier. Öffne die App einmal, um alles so zu behalten, wie es ist.",
  },
};

// Nomes das FAIXAS por língua — iguais aos que a app mostra no resto do ecrã
// (ver faixa.* no lib/i18n). Uma notificação diz "faixa {faixa}", e {faixa} tem
// de sair no nome traduzido, não no valor canónico ("roxa").
const FAIXAS_NOME: Record<string, Entrada> = {
  branca: { pt: "Branca", en: "White", es: "Blanco", fr: "Blanche", de: "Weiß" },
  azul: { pt: "Azul", en: "Blue", es: "Azul", fr: "Bleue", de: "Blau" },
  amarela: { pt: "Amarela", en: "Yellow", es: "Amarillo", fr: "Jaune", de: "Gelb" },
  verde: { pt: "Verde", en: "Green", es: "Verde", fr: "Verte", de: "Grün" },
  roxa: { pt: "Roxa", en: "Purple", es: "Morado", fr: "Violette", de: "Lila" },
  marrom: { pt: "Marrom", en: "Brown", es: "Marrón", fr: "Marron", de: "Braun" },
  preta: { pt: "Preta", en: "Black", es: "Negro", fr: "Noire", de: "Schwarz" },
};

/** Nome de uma faixa (valor canónico "roxa") na língua pedida. */
export function nomeFaixaEm(lingua: LinguaNotif, canonica: string): string {
  const e = FAIXAS_NOME[String(canonica || "").toLowerCase()];
  return e ? e[lingua] || e.pt : String(canonica || "");
}

// Nomes dos CONTINENTES por código (EUR/PAN/ASI/AFR/OCE), nas 5 línguas. Mesmo
// modelo das faixas: a notificação diz "de {cont}" e {cont} sai traduzido.
const CONTINENTES_NOME: Record<string, Entrada> = {
  EUR: { pt: "Europa", en: "Europe", es: "Europa", fr: "Europe", de: "Europa" },
  PAN: { pt: "América", en: "the Americas", es: "América", fr: "Amériques", de: "Amerika" },
  ASI: { pt: "Ásia", en: "Asia", es: "Asia", fr: "Asie", de: "Asien" },
  AFR: { pt: "África", en: "Africa", es: "África", fr: "Afrique", de: "Afrika" },
  OCE: { pt: "Oceânia", en: "Oceania", es: "Oceanía", fr: "Océanie", de: "Ozeanien" },
};

/** Nome de um continente (código "EUR") na língua pedida. */
export function nomeContinenteEm(lingua: LinguaNotif, codigo: string): string {
  const e = CONTINENTES_NOME[String(codigo || "").toUpperCase()];
  return e ? e[lingua] || e.pt : String(codigo || "");
}

/** Substitui {var} pelos valores dados. */
function preencher(texto: string, vars?: Record<string, string | number>): string {
  if (!vars) return texto;
  let out = texto;
  for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v));
  return out;
}

/**
 * Devolve o texto de uma chave na língua pedida, com recurso ao português e, em
 * último caso, à própria chave (nunca devolve vazio). `vars` preenche os {campos}.
 *
 * FAIXAS: passa-se o valor canónico em `faixaCanonica` / `faixaAcimaCanonica`, e
 * aqui expõe-se o nome JÁ traduzido como {faixa} / {faixaAcima}. Assim o nome da
 * faixa sai na língua de quem recebe, sem que quem chama saiba a língua.
 */
export function renderNotif(
  lingua: LinguaNotif,
  chave: string,
  vars?: Record<string, string | number>
): string {
  const e = NOTIF[chave];
  const texto = (e && (e[lingua] || e.pt)) || chave;
  let v = vars;
  const temEspeciais = vars && (
    vars.faixaCanonica !== undefined ||
    vars.faixaAcimaCanonica !== undefined ||
    vars.contCanonica !== undefined
  );
  if (vars && temEspeciais) {
    v = { ...vars };
    if (vars.faixaCanonica !== undefined) v.faixa = nomeFaixaEm(lingua, String(vars.faixaCanonica));
    if (vars.faixaAcimaCanonica !== undefined) v.faixaAcima = nomeFaixaEm(lingua, String(vars.faixaAcimaCanonica));
    if (vars.contCanonica !== undefined) v.cont = nomeContinenteEm(lingua, String(vars.contCanonica));
  }
  return preencher(texto, v);
}
