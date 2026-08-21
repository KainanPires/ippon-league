"use client";

// i18n da Academy — só interface. O conteúdo longo (lições, perguntas,
// nomes das faixas) vive na Supabase, em tabelas por língua.
// Termos de judô e nomes próprios NÃO se traduzem.

import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type Lang = "pt" | "en" | "es" | "fr" | "de";
export const LINGUAS: Lang[] = ["pt", "en", "es", "fr", "de"];

const T = {
  marca:            { pt: "Ippon League Academy", en: "Ippon League Academy", es: "Ippon League Academy", fr: "Ippon League Academy", de: "Ippon League Academy" },
  faixaEstudo:      { pt: "Faixa de Estudo",      en: "Study Belt",           es: "Cinturón de Estudio",  fr: "Ceinture d'Étude",     de: "Lerngürtel" },
  ola:              { pt: "Olá!",                 en: "Hi!",                  es: "¡Hola!",               fr: "Salut !",              de: "Hallo!" },
  souDodo:          { pt: "Sou o Dôdo, o teu professor.", en: "I'm Dôdo, your teacher.", es: "Soy Dôdo, tu profesor.", fr: "Je suis Dôdo, ton professeur.", de: "Ich bin Dôdo, dein Lehrer." },
  treinoDeHoje:     { pt: "Treino de hoje",       en: "Today's training",     es: "Entrenamiento de hoy", fr: "Entraînement du jour", de: "Heutiges Training" },
  comecar:          { pt: "Começar",              en: "Start",                es: "Empezar",              fr: "Commencer",            de: "Starten" },
  continuar:        { pt: "Continuar",            en: "Continue",             es: "Continuar",            fr: "Continuer",            de: "Weiter" },
  sequencia:        { pt: "Sequência",            en: "Streak",               es: "Racha",                fr: "Série",                de: "Serie" },
  dias:             { pt: "dias",                 en: "days",                 es: "días",                 fr: "jours",                de: "Tage" },
  acertaste:        { pt: "Certo!",               en: "Correct!",             es: "¡Correcto!",           fr: "Correct !",            de: "Richtig!" },
  falhaste:         { pt: "Quase.",               en: "Almost.",              es: "Casi.",                fr: "Presque.",             de: "Fast." },
  resultado:        { pt: "Resultado",            en: "Result",               es: "Resultado",            fr: "Résultat",             de: "Ergebnis" },
  de:               { pt: "de",                   en: "of",                   es: "de",                   fr: "sur",                  de: "von" },
  terminar:         { pt: "Terminar",             en: "Finish",               es: "Terminar",             fr: "Terminer",             de: "Beenden" },
  inicio:           { pt: "Início",               en: "Home",                 es: "Inicio",               fr: "Accueil",              de: "Start" },
  quiz:             { pt: "Quiz",                 en: "Quiz",                 es: "Quiz",                 fr: "Quiz",                 de: "Quiz" },
  faixa:            { pt: "Faixa",                en: "Belt",                 es: "Cinturón",             fr: "Ceinture",             de: "Gürtel" },
  oTeuPercurso:     { pt: "O teu percurso",       en: "Your path",            es: "Tu recorrido",         fr: "Ton parcours",         de: "Dein Weg" },
  licoesFeitas:     { pt: "lições feitas",        en: "lessons done",         es: "lecciones hechas",     fr: "leçons faites",        de: "Lektionen erledigt" },
  aRever:           { pt: "a rever",              en: "to review",            es: "por repasar",          fr: "à réviser",            de: "zu wiederholen" },
  fazerExame:       { pt: "Fazer o exame",        en: "Take the exam",        es: "Hacer el examen",      fr: "Passer l'examen",      de: "Prüfung machen" },
  faltamLicoes:     { pt: "Faltam %n% lições",    en: "%n% lessons to go",    es: "Faltan %n% lecciones", fr: "Encore %n% leçons",    de: "Noch %n% Lektionen" },
  avisoSensei:      { pt: "Esta é a tua Faixa de Estudo. A faixa do tatame quem a dá é o teu sensei.", en: "This is your Study Belt. The belt on the tatame is given by your sensei.", es: "Este es tu Cinturón de Estudio. El cinturón del tatami lo da tu sensei.", fr: "Ceci est ta Ceinture d'Étude. La ceinture du tatami, c'est ton sensei qui la donne.", de: "Das ist dein Lerngürtel. Den Gürtel auf dem Tatami vergibt dein Sensei." },
  exame:            { pt: "Exame",                 en: "Exam",                 es: "Examen",               fr: "Examen",               de: "Prüfung" },
  exameDe:          { pt: "Exame de",              en: "Exam for",             es: "Examen de",            fr: "Examen de",            de: "Prüfung für" },
  comecarExame:     { pt: "Começar o exame",       en: "Start the exam",       es: "Empezar el examen",    fr: "Commencer l'examen",   de: "Prüfung starten" },
  perguntas:        { pt: "perguntas",             en: "questions",            es: "preguntas",            fr: "questions",            de: "Fragen" },
  paraPassar:       { pt: "para passar",           en: "to pass",              es: "para aprobar",         fr: "pour réussir",         de: "zum Bestehen" },
  porPergunta:      { pt: "por pergunta",          en: "per question",         es: "por pregunta",         fr: "par question",         de: "pro Frage" },
  semVoltarAtras:   { pt: "Sem voltar atrás. As perguntas são sorteadas no momento.", en: "No going back. Questions are drawn on the spot.", es: "Sin volver atrás. Las preguntas se sortean en el momento.", fr: "Pas de retour en arrière. Les questions sont tirées sur le moment.", de: "Kein Zurück. Die Fragen werden im Moment gezogen." },
  exameAprovado:    { pt: "Passaste!",             en: "You passed!",          es: "¡Aprobaste!",          fr: "Réussi !",             de: "Bestanden!" },
  exameChumbado:    { pt: "Ainda não.",            en: "Not yet.",             es: "Todavía no.",          fr: "Pas encore.",          de: "Noch nicht." },
  podesRepetir:     { pt: "Podes repetir daqui a 24 horas — ou já a seguir a um treino de recuperação.", en: "You can retry in 24 hours — or right after a recovery session.", es: "Puedes repetir en 24 horas — o justo después de un entrenamiento de recuperación.", fr: "Tu peux réessayer dans 24 heures — ou juste après un entraînement de rattrapage.", de: "Du kannst in 24 Stunden erneut antreten — oder direkt nach einem Auffrischungstraining." },
  esperaAte:        { pt: "Podes tentar a partir de", en: "You can try again from", es: "Puedes intentar desde", fr: "Tu peux réessayer à partir de", de: "Du kannst es erneut versuchen ab" },
  semMaisFaixas:    { pt: "Já tens todas as faixas. Continua a treinar!", en: "You have every belt. Keep training!", es: "Ya tienes todos los cinturones. ¡Sigue entrenando!", fr: "Tu as toutes les ceintures. Continue à t'entraîner !", de: "Du hast alle Gürtel. Trainiere weiter!" },
  entrar:           { pt: "Entrar",               en: "Sign in",              es: "Entrar",               fr: "Se connecter",         de: "Anmelden" },
  senha:            { pt: "senha",                 en: "password",             es: "contraseña",           fr: "mot de passe",         de: "Passwort" },
  credenciaisErradas:{ pt: "Email ou senha errados.", en: "Wrong email or password.", es: "Email o contraseña incorrectos.", fr: "Email ou mot de passe incorrect.", de: "E-Mail oder Passwort falsch." },
  esqueciSenha:     { pt: "Esqueci-me da senha",   en: "Forgot my password",   es: "Olvidé mi contraseña", fr: "Mot de passe oublié",  de: "Passwort vergessen" },
  semConta:         { pt: "Ainda não tens conta?", en: "No account yet?",      es: "¿Aún no tienes cuenta?", fr: "Pas encore de compte ?", de: "Noch kein Konto?" },
  criarNaIppon:     { pt: "Cria na Ippon League",  en: "Create it on Ippon League", es: "Créala en Ippon League", fr: "Crée-le sur Ippon League", de: "Auf Ippon League erstellen" },
  mesmaConta:       { pt: "A mesma conta da Ippon League.", en: "The same account as Ippon League.", es: "La misma cuenta de Ippon League.", fr: "Le même compte qu'Ippon League.", de: "Dasselbe Konto wie Ippon League." },
  emailEnviado:     { pt: "Verifica o teu email.", en: "Check your email.",   es: "Revisa tu correo.",    fr: "Vérifie ton email.",   de: "Prüfe deine E-Mail." },
  semPerguntas:     { pt: "Ainda não há perguntas para hoje.", en: "No questions for today yet.", es: "Aún no hay preguntas para hoy.", fr: "Pas encore de questions pour aujourd'hui.", de: "Heute noch keine Fragen." },
  aprender:         { pt: "Aprender",              en: "Learn",                es: "Aprender",             fr: "Apprendre",            de: "Lernen" },
  praticar:         { pt: "Praticar",              en: "Practise",             es: "Practicar",            fr: "S'entraîner",          de: "Üben" },
  licaoFeita:       { pt: "Lição concluída",       en: "Lesson complete",      es: "Lección completada",   fr: "Leçon terminée",       de: "Lektion abgeschlossen" },
  proximaLicao:     { pt: "Próxima lição",         en: "Next lesson",          es: "Próxima lección",      fr: "Leçon suivante",       de: "Nächste Lektion" },
  voltar:           { pt: "Voltar",                en: "Back",                 es: "Volver",               fr: "Retour",               de: "Zurück" },
  semLicoes:        { pt: "Ainda não há lições aqui.", en: "No lessons here yet.", es: "Aún no hay lecciones aquí.", fr: "Pas encore de leçons ici.", de: "Hier gibt es noch keine Lektionen." },
  concluidas:       { pt: "concluídas",            en: "completed",            es: "completadas",          fr: "terminées",            de: "abgeschlossen" },
  rever:            { pt: "Rever",                 en: "Review",               es: "Repasar",              fr: "Réviser",              de: "Wiederholen" },
  novo:             { pt: "Novo",                  en: "New",                  es: "Nuevo",                fr: "Nouveau",              de: "Neu" },
  semPraticaAinda:  { pt: "Esta lição ainda não tem perguntas. Lê e segue em frente.", en: "This lesson has no questions yet. Read it and move on.", es: "Esta lección aún no tiene preguntas. Léela y sigue.", fr: "Cette leçon n'a pas encore de questions. Lis-la et continue.", de: "Diese Lektion hat noch keine Fragen. Lies sie und mach weiter." },
  continuarTrilho:  { pt: "Continuar o trilho",    en: "Continue the path",    es: "Continuar el camino",  fr: "Continuer le parcours", de: "Weiter auf dem Pfad" },
  pontos:           { pt: "pontos",                en: "points",               es: "puntos",               fr: "points",               de: "Punkte" },
  ranking:          { pt: "Ranking",               en: "Ranking",              es: "Ranking",              fr: "Classement",           de: "Rangliste" },
  hoje:             { pt: "Hoje",                  en: "Today",                es: "Hoy",                  fr: "Aujourd'hui",          de: "Heute" },
  semana:           { pt: "Semana",                en: "Week",                 es: "Semana",               fr: "Semaine",              de: "Woche" },
  sempre:           { pt: "Sempre",                en: "All time",             es: "Siempre",              fr: "Toujours",             de: "Gesamt" },
  melhorSequencia:  { pt: "melhor",                en: "best",                 es: "mejor",                fr: "record",               de: "Bestwert" },
  posicao:          { pt: "Posição",               en: "Position",             es: "Posición",             fr: "Position",             de: "Platz" },
  semRanking:       { pt: "Ainda ninguém pontuou. Sê o primeiro.", en: "Nobody has scored yet. Be the first.", es: "Nadie ha puntuado aún. Sé el primero.", fr: "Personne n'a encore marqué. Sois le premier.", de: "Noch niemand hat gepunktet. Sei der Erste." },
  oTeuNome:         { pt: "O teu nome no ranking", en: "Your name on the ranking", es: "Tu nombre en el ranking", fr: "Ton nom au classement", de: "Dein Name in der Rangliste" },
  guardar:          { pt: "Guardar",               en: "Save",                 es: "Guardar",              fr: "Enregistrer",          de: "Speichern" },
  apelidoCurto:     { pt: "Entre 3 e 18 caracteres.", en: "Between 3 and 18 characters.", es: "Entre 3 y 18 caracteres.", fr: "Entre 3 et 18 caractères.", de: "Zwischen 3 und 18 Zeichen." },
  apelidoInvalido:  { pt: "Só letras, números, espaço, ponto, hífen ou underscore.", en: "Only letters, numbers, space, dot, hyphen or underscore.", es: "Solo letras, números, espacio, punto, guion o guion bajo.", fr: "Seulement lettres, chiffres, espace, point, tiret ou underscore.", de: "Nur Buchstaben, Zahlen, Leerzeichen, Punkt, Bindestrich oder Unterstrich." },
  apelidoOcupado:   { pt: "Esse nome já está a ser usado.", en: "That name is taken.", es: "Ese nombre ya está en uso.", fr: "Ce nom est déjà pris.", de: "Dieser Name ist vergeben." },
  apelidoGuardado:  { pt: "Guardado.",             en: "Saved.",               es: "Guardado.",            fr: "Enregistré.",          de: "Gespeichert." },
  comoSeGanham:     { pt: "Como se ganham pontos", en: "How points work",      es: "Cómo se ganan puntos", fr: "Comment gagner des points", de: "Wie man Punkte bekommt" },
  regraPontos1:     { pt: "Primeira vez que acertas uma pergunta: pontos completos.", en: "First time you get a question right: full points.", es: "La primera vez que aciertas una pregunta: puntos completos.", fr: "La première fois que tu réponds juste : points complets.", de: "Beim ersten richtigen Mal: volle Punkte." },
  regraPontos2:     { pt: "Ao rever no dia seguinte ou depois: metade.", en: "Reviewing a day later or more: half.", es: "Al repasar al día siguiente o después: la mitad.", fr: "En révisant le lendemain ou plus tard : la moitié.", de: "Bei Wiederholung am Folgetag oder später: die Hälfte." },
  regraPontos3:     { pt: "Repetir a mesma pergunta logo a seguir: 1 ponto.", en: "Repeating the same question right away: 1 point.", es: "Repetir la misma pregunta enseguida: 1 punto.", fr: "Répéter la même question aussitôt : 1 point.", de: "Dieselbe Frage sofort wiederholen: 1 Punkt." },
  regraPontos4:     { pt: "Cinco respostas num dia contam para a sequência, e dão bónus.", en: "Five answers in a day count for the streak, and give a bonus.", es: "Cinco respuestas en un día cuentan para la racha y dan bonus.", fr: "Cinq réponses dans la journée comptent pour la série et donnent un bonus.", de: "Fünf Antworten am Tag zählen für die Serie und geben Bonus." },
  semLapis:         { pt: "Ficaste sem lápis",     en: "You're out of pencils", es: "Te quedaste sin lápices", fr: "Tu n'as plus de crayons", de: "Keine Stifte mehr" },
  semLapisTexto:    { pt: "Cada erro no treino gasta um lápis. Eles voltam sozinhos com o tempo.", en: "Every mistake in training costs a pencil. They come back on their own over time.", es: "Cada error en el entrenamiento gasta un lápiz. Vuelven solos con el tiempo.", fr: "Chaque erreur à l'entraînement coûte un crayon. Ils reviennent d'eux-mêmes avec le temps.", de: "Jeder Fehler im Training kostet einen Stift. Sie kommen mit der Zeit von selbst zurück." },
  em:               { pt: "em",                     en: "in",                   es: "en",                   fr: "dans",                 de: "in" },
  maisLapis:        { pt: "Queres mais lápis?",     en: "Want more pencils?",   es: "¿Quieres más lápices?", fr: "Tu veux plus de crayons ?", de: "Mehr Stifte?" },
  proLapis:         { pt: "15 lápis, e um de volta a cada meia hora.", en: "15 pencils, and one back every half hour.", es: "15 lápices, y uno de vuelta cada media hora.", fr: "15 crayons, et un de retour toutes les demi-heures.", de: "15 Stifte, und alle 30 Minuten einer zurück." },
  proMaxLapis:      { pt: "Lápis ilimitados. Estuda sem parar.", en: "Unlimited pencils. Study without stopping.", es: "Lápices ilimitados. Estudia sin parar.", fr: "Crayons illimités. Étudie sans t'arrêter.", de: "Unbegrenzte Stifte. Lerne ohne Pause." },
  verPlanos:        { pt: "Ver os planos",          en: "See the plans",        es: "Ver los planes",       fr: "Voir les formules",    de: "Pläne ansehen" },
  lerSemLapis:      { pt: "Ler lições não gasta lápis", en: "Reading lessons costs no pencils", es: "Leer lecciones no gasta lápices", fr: "Lire les leçons ne coûte pas de crayons", de: "Lektionen lesen kostet keine Stifte" },
  avisosTitulo:     { pt: "Queres que eu te avise?",  en: "Want me to remind you?", es: "¿Quieres que te avise?", fr: "Tu veux que je te rappelle ?", de: "Soll ich dich erinnern?" },
  avisosTexto:      { pt: "Aviso-te quando a tua sequência estiver em risco e quando os teus lápis voltarem. Nada mais.", en: "I'll tell you when your streak is at risk and when your pencils come back. Nothing else.", es: "Te aviso cuando tu racha esté en riesgo y cuando vuelvan tus lápices. Nada más.", fr: "Je te préviens quand ta série est en danger et quand tes crayons reviennent. Rien d'autre.", de: "Ich melde mich, wenn deine Serie in Gefahr ist und wenn deine Stifte zurück sind. Sonst nichts." },
  avisosLigar:      { pt: "Avisa-me",                 en: "Remind me",            es: "Avísame",              fr: "Préviens-moi",         de: "Erinnere mich" },
  avisosRecusado:   { pt: "Bloqueaste os avisos neste browser. Para os voltar a ligar tens de o fazer nas definições do site.", en: "You blocked notifications in this browser. To turn them back on you have to do it in the site settings.", es: "Bloqueaste los avisos en este navegador. Para reactivarlos hay que hacerlo en los ajustes del sitio.", fr: "Tu as bloqué les notifications dans ce navigateur. Pour les réactiver, il faut passer par les paramètres du site.", de: "Du hast Benachrichtigungen in diesem Browser blockiert. Zum Reaktivieren musst du in die Website-Einstellungen." },
  avisosIosTitulo:  { pt: "Para receber avisos no iPhone", en: "To get alerts on iPhone", es: "Para recibir avisos en el iPhone", fr: "Pour recevoir des alertes sur iPhone", de: "Für Hinweise auf dem iPhone" },
  avisosIosTexto:   { pt: "O iPhone só entrega avisos a apps que estão no ecrã principal. No Safari, toca no botão de partilha e escolhe «Adicionar ao ecrã principal». Depois abre a Academy pelo ícone novo e volta aqui.", en: "iPhone only delivers alerts to apps on the Home Screen. In Safari, tap the share button and choose “Add to Home Screen”. Then open the Academy from the new icon and come back here.", es: "El iPhone solo entrega avisos a apps que están en la pantalla de inicio. En Safari, toca el botón de compartir y elige «Añadir a pantalla de inicio». Luego abre la Academy desde el icono nuevo y vuelve aquí.", fr: "L'iPhone ne délivre des alertes qu'aux apps présentes sur l'écran d'accueil. Dans Safari, touche le bouton de partage et choisis « Sur l'écran d'accueil ». Ouvre ensuite l'Academy depuis la nouvelle icône et reviens ici.", de: "Das iPhone liefert Hinweise nur an Apps auf dem Home-Bildschirm. Tippe in Safari auf Teilen und wähle „Zum Home-Bildschirm“. Öffne die Academy dann über das neue Symbol und komm hierher zurück." },
  irFantasy:        { pt: "Fantasy",                  en: "Fantasy",              es: "Fantasy",              fr: "Fantasy",              de: "Fantasy" },
  academy:          { pt: "Academy",                en: "Academy",              es: "Academy",              fr: "Academy",              de: "Academy" },
  instalarTitulo:   { pt: "Põe a Academy no teu ecrã", en: "Put the Academy on your screen", es: "Pon la Academy en tu pantalla", fr: "Mets l'Academy sur ton écran", de: "Hol dir die Academy auf den Bildschirm" },
  instalarTexto:    { pt: "Fica com ícone próprio, abre sem browser e recebe os avisos.", en: "Its own icon, opens without the browser, and gets the alerts.", es: "Con icono propio, abre sin navegador y recibe los avisos.", fr: "Sa propre icône, s'ouvre sans navigateur et reçoit les alertes.", de: "Eigenes Symbol, öffnet ohne Browser und erhält die Hinweise." },
  instalarBotao:    { pt: "Instalar",                en: "Install",              es: "Instalar",             fr: "Installer",            de: "Installieren" },
  instalarIos:      { pt: "No Safari, toca no botão de partilha e escolhe «Adicionar ao ecrã principal». É também o que destranca os avisos no iPhone.", en: "In Safari, tap the share button and choose “Add to Home Screen”. That's also what unlocks alerts on iPhone.", es: "En Safari, toca el botón de compartir y elige «Añadir a pantalla de inicio». Es también lo que desbloquea los avisos en el iPhone.", fr: "Dans Safari, touche le bouton de partage et choisis « Sur l'écran d'accueil ». C'est aussi ce qui débloque les alertes sur iPhone.", de: "Tippe in Safari auf Teilen und wähle „Zum Home-Bildschirm“. Das schaltet auch die Hinweise auf dem iPhone frei." },
  emailLabel:       { pt: "Email",                   en: "Email",                es: "Email",                fr: "Email",                de: "E-Mail" },
  placeholderEmail: { pt: "tu@email.com",            en: "you@email.com",        es: "tu@email.com",         fr: "toi@email.com",        de: "du@email.com" },
  entrarDojo:       { pt: "Entrar no dojo",          en: "Enter the dojo",       es: "Entrar en el dojo",    fr: "Entrer dans le dojo",  de: "Ins Dojo" },
  mostrarSenha:     { pt: "Mostrar a senha",         en: "Show password",        es: "Mostrar la contraseña", fr: "Afficher le mot de passe", de: "Passwort anzeigen" },
  esconderSenha:    { pt: "Esconder a senha",        en: "Hide password",        es: "Ocultar la contraseña", fr: "Masquer le mot de passe", de: "Passwort verbergen" },
  aProcessar:       { pt: "A entrar...",             en: "Signing in...",        es: "Entrando...",          fr: "Connexion...",         de: "Anmelden..." },
  preencher:        { pt: "Preenche os dois campos.", en: "Fill in both fields.", es: "Rellena los dos campos.", fr: "Remplis les deux champs.", de: "Fülle beide Felder aus." },
  emailInvalido:    { pt: "Esse email não parece certo.", en: "That email doesn't look right.", es: "Ese email no parece correcto.", fr: "Cet email ne semble pas correct.", de: "Diese E-Mail sieht nicht richtig aus." },
  naoConfirmado:    { pt: "Confirma o teu email antes de entrar.", en: "Confirm your email before signing in.", es: "Confirma tu email antes de entrar.", fr: "Confirme ton email avant de te connecter.", de: "Bestätige deine E-Mail vor dem Anmelden." },
  entrarFalhou:     { pt: "Não foi possível entrar. Tenta outra vez.", en: "Couldn't sign in. Try again.", es: "No se pudo entrar. Inténtalo otra vez.", fr: "Connexion impossible. Réessaie.", de: "Anmeldung fehlgeschlagen. Versuch es erneut." },
  recEscreveEmail:  { pt: "Escreve primeiro o teu email.", en: "Write your email first.", es: "Escribe primero tu email.", fr: "Écris d'abord ton email.", de: "Schreib zuerst deine E-Mail." },
  recEnviado:       { pt: "Enviámos um link para %email%.", en: "We sent a link to %email%.", es: "Enviamos un enlace a %email%.", fr: "Nous avons envoyé un lien à %email%.", de: "Wir haben einen Link an %email% geschickt." },
  recFalhou:        { pt: "Não foi possível enviar. Tenta outra vez.", en: "Couldn't send it. Try again.", es: "No se pudo enviar. Inténtalo otra vez.", fr: "Envoi impossible. Réessaie.", de: "Senden fehlgeschlagen. Versuch es erneut." },
  criarConta:       { pt: "Criar conta",             en: "Create account",       es: "Crear cuenta",         fr: "Créer un compte",      de: "Konto erstellen" },
  perfil:           { pt: "Perfil",                  en: "Profile",              es: "Perfil",               fr: "Profil",               de: "Profil" },
  idioma:           { pt: "Idioma",                  en: "Language",             es: "Idioma",               fr: "Langue",               de: "Sprache" },
  entrarParaEstudar:{ pt: "Entrar para estudar",     en: "Sign in to study",     es: "Entrar para estudiar", fr: "Entrer pour étudier",  de: "Zum Lernen anmelden" },
  campeao:          { pt: "Campeão",                 en: "Champion",             es: "Campeón",              fr: "Champion",             de: "Champion" },
  meusResultados:   { pt: "Os meus resultados",      en: "My results",           es: "Mis resultados",       fr: "Mes résultats",        de: "Meine Ergebnisse" },
  meusResultadosSub:{ pt: "Os teus pontos e o teu lugar", en: "Your points and your place", es: "Tus puntos y tu lugar", fr: "Tes points et ta place", de: "Deine Punkte und dein Platz" },
  centralMax:       { pt: "A tua central Pro Max",   en: "Your Pro Max hub",     es: "Tu central Pro Max",   fr: "Ton centre Pro Max",   de: "Deine Pro-Max-Zentrale" },
  centralMaxSub:    { pt: "Lápis sem fim e as tuas vantagens no máximo", en: "Endless pencils and all your perks at maximum", es: "Lápices sin fin y tus ventajas al máximo", fr: "Des crayons sans fin et tous tes avantages au maximum", de: "Endlose Stifte und alle Vorteile im Maximum" },
  centralPro:       { pt: "A tua central Pro",       en: "Your Pro hub",         es: "Tu central Pro",       fr: "Ton centre Pro",       de: "Deine Pro-Zentrale" },
  centralProSub:    { pt: "Mais lápis e recarga mais depressa", en: "More pencils and a faster refill", es: "Más lápices y recarga más rápida", fr: "Plus de crayons et une recharge plus rapide", de: "Mehr Stifte und schnelleres Nachladen" },
  abrir:            { pt: "Abrir",                   en: "Open",                 es: "Abrir",                fr: "Ouvrir",               de: "Öffnen" },
  promoPro:         { pt: "Torna-te Ippon Pro",      en: "Become Ippon Pro",     es: "Hazte Ippon Pro",      fr: "Deviens Ippon Pro",    de: "Werde Ippon Pro" },
  promoProSub:      { pt: "15 lápis, recarga em 30 minutos e o judogui do Dôdo", en: "15 pencils, a 30-minute refill and Dôdo's judogi", es: "15 lápices, recarga en 30 minutos y el judogui del Dôdo", fr: "15 crayons, recharge en 30 minutes et le judogi du Dôdo", de: "15 Stifte, Nachladen in 30 Minuten und Dôdos Judogi" },
  promoVer:         { pt: "Ver",                     en: "See",                  es: "Ver",                  fr: "Voir",                 de: "Ansehen" },
  minhaCaminhada:   { pt: "A minha caminhada",       en: "My journey",           es: "Mi camino",            fr: "Mon parcours",         de: "Mein Weg" },
  minhaCaminhadaSub:{ pt: "Percorre o dojo lição a lição e gradua-te.", en: "Walk the dojo lesson by lesson and grade up.", es: "Recorre el dojo lección a lección y gradúate.", fr: "Parcours le dojo leçon après leçon et gradue-toi.", de: "Geh durch das Dojo, Lektion für Lektion, und steig auf." },
  continuarCaminhada:{ pt: "Continuar a caminhada",  en: "Continue the journey", es: "Continuar el camino",  fr: "Continuer le parcours", de: "Weiter auf dem Weg" },
  comoFunciona:     { pt: "Como funciona",           en: "How it works",         es: "Cómo funciona",        fr: "Comment ça marche",    de: "So funktioniert es" },
  falaConnosco:     { pt: "Fala connosco",           en: "Talk to us",           es: "Habla con nosotros",   fr: "Parle-nous",           de: "Sprich mit uns" },
  avisos:           { pt: "Avisos",                  en: "Alerts",               es: "Avisos",               fr: "Alertes",              de: "Hinweise" },
  lapis:            { pt: "Lápis",                   en: "Pencils",              es: "Lápices",              fr: "Crayons",              de: "Stifte" },
  seguinte:         { pt: "Seguinte",                en: "Next",                 es: "Siguiente",            fr: "Suivant",              de: "Weiter" },
  fechar:           { pt: "Fechar",                  en: "Close",                es: "Cerrar",               fr: "Fermer",               de: "Schließen" },
  tut1t:            { pt: "A tua Faixa de Estudo",   en: "Your Study Belt",      es: "Tu Cinturón de Estudio", fr: "Ta Ceinture d'Étude", de: "Dein Lerngürtel" },
  tut1c:            { pt: "Mede o que já sabes, e sobe com exames. A faixa do tatame continua a ser do teu sensei — esta é só de conhecimento.", en: "It measures what you know and rises with exams. The belt on the tatame is still your sensei's — this one is knowledge only.", es: "Mide lo que ya sabes y sube con exámenes. El cinturón del tatami sigue siendo de tu sensei — este es solo de conocimiento.", fr: "Elle mesure ce que tu sais et monte avec les examens. La ceinture du tatami reste celle de ton sensei — celle-ci n'est que de connaissance.", de: "Er misst, was du weißt, und steigt mit Prüfungen. Der Gürtel auf dem Tatami bleibt Sache deines Senseis — dieser ist nur Wissen." },
  tut2t:            { pt: "As lições",               en: "The lessons",          es: "Las lecciones",        fr: "Les leçons",           de: "Die Lektionen" },
  tut2c:            { pt: "Curtas, uma de cada vez. O que aprendes hoje volta daqui a uns dias para rever — é assim que fica.", en: "Short, one at a time. What you learn today comes back in a few days to review — that's how it sticks.", es: "Cortas, una cada vez. Lo que aprendes hoy vuelve en unos días para repasar — así se queda.", fr: "Courtes, une à la fois. Ce que tu apprends aujourd'hui revient dans quelques jours pour révision — c'est comme ça que ça reste.", de: "Kurz, eine nach der anderen. Was du heute lernst, kommt in ein paar Tagen zur Wiederholung zurück — so bleibt es." },
  tut3t:            { pt: "O treino de hoje",        en: "Today's training",     es: "El entrenamiento de hoy", fr: "L'entraînement du jour", de: "Das heutige Training" },
  tut3c:            { pt: "Dez perguntas sorteadas. Cinco respostas chegam para manter a sequência viva — e a sequência dá pontos a mais.", en: "Ten drawn questions. Five answers are enough to keep the streak alive — and the streak gives extra points.", es: "Diez preguntas sorteadas. Cinco respuestas bastan para mantener viva la racha — y la racha da puntos extra.", fr: "Dix questions tirées au sort. Cinq réponses suffisent à garder la série vivante — et la série donne des points en plus.", de: "Zehn gezogene Fragen. Fünf Antworten reichen, um die Serie am Leben zu halten — und die Serie gibt Extrapunkte." },
  tut4t:            { pt: "Os lápis",                en: "The pencils",          es: "Los lápices",          fr: "Les crayons",          de: "Die Stifte" },
  tut4c:            { pt: "Cada erro no treino gasta um lápis, e eles voltam com o tempo. Ler lições nunca gasta, e o exame também não.", en: "Each mistake in training costs a pencil, and they come back over time. Reading lessons never costs one, and neither does the exam.", es: "Cada error en el entrenamiento gasta un lápiz, y vuelven con el tiempo. Leer lecciones nunca gasta, y el examen tampoco.", fr: "Chaque erreur à l'entraînement coûte un crayon, et ils reviennent avec le temps. Lire des leçons ne coûte rien, l'examen non plus.", de: "Jeder Fehler im Training kostet einen Stift, und sie kommen mit der Zeit zurück. Lektionen lesen kostet nie einen, die Prüfung auch nicht." },
  perfilTitulo:     { pt: "Perfil",                  en: "Profile",              es: "Perfil",               fr: "Profil",               de: "Profil" },
  voltarInicio:     { pt: "Voltar ao início",        en: "Back to home",         es: "Volver al inicio",     fr: "Retour à l'accueil",   de: "Zurück zum Start" },
  osMeusDados:      { pt: "Os meus dados",           en: "My details",           es: "Mis datos",            fr: "Mes données",          de: "Meine Daten" },
  tocaVer:          { pt: "Toca para ver os teus dados", en: "Tap to see your details", es: "Toca para ver tus datos", fr: "Touche pour voir tes données", de: "Tippe, um deine Daten zu sehen" },
  tocaFechar:       { pt: "Toca para fechar",        en: "Tap to close",         es: "Toca para cerrar",     fr: "Touche pour fermer",   de: "Tippe zum Schließen" },
  nome:             { pt: "Nome",                    en: "Name",                 es: "Nombre",               fr: "Nom",                  de: "Name" },
  dadosPartilhados: { pt: "O nome e o email são da conta que serve os dois produtos.", en: "Your name and email belong to the account that serves both products.", es: "El nombre y el email son de la cuenta que sirve a los dos productos.", fr: "Le nom et l'email appartiennent au compte qui sert les deux produits.", de: "Name und E-Mail gehören zum Konto, das beide Produkte bedient." },
  editarNaIppon:    { pt: "Editar os dados",         en: "Edit details",         es: "Editar los datos",     fr: "Modifier les données", de: "Daten bearbeiten" },
  seguranca:        { pt: "Segurança",               en: "Security",             es: "Seguridad",            fr: "Sécurité",             de: "Sicherheit" },
  alterarSenha:     { pt: "Alterar a senha",         en: "Change password",      es: "Cambiar la contraseña", fr: "Changer le mot de passe", de: "Passwort ändern" },
  senhaAtual:       { pt: "Senha atual",             en: "Current password",     es: "Contraseña actual",    fr: "Mot de passe actuel",  de: "Aktuelles Passwort" },
  novaSenha:        { pt: "Nova senha",              en: "New password",         es: "Nueva contraseña",     fr: "Nouveau mot de passe", de: "Neues Passwort" },
  confirmarSenha:   { pt: "Confirmar a nova senha",  en: "Confirm the new password", es: "Confirmar la nueva contraseña", fr: "Confirmer le nouveau mot de passe", de: "Neues Passwort bestätigen" },
  phMinimo:         { pt: "Mínimo 6 caracteres",     en: "At least 6 characters", es: "Mínimo 6 caracteres", fr: "Au moins 6 caractères", de: "Mindestens 6 Zeichen" },
  senhaAlterada:    { pt: "Senha alterada.",         en: "Password changed.",    es: "Contraseña cambiada.", fr: "Mot de passe changé.", de: "Passwort geändert." },
  errSenhaAtual:    { pt: "Escreve a tua senha atual.", en: "Enter your current password.", es: "Escribe tu contraseña actual.", fr: "Écris ton mot de passe actuel.", de: "Gib dein aktuelles Passwort ein." },
  errNovaCurta:     { pt: "A nova senha precisa de 6 caracteres ou mais.", en: "The new password needs 6 characters or more.", es: "La nueva contraseña necesita 6 caracteres o más.", fr: "Le nouveau mot de passe doit faire 6 caractères ou plus.", de: "Das neue Passwort braucht 6 Zeichen oder mehr." },
  errNaoCoincidem:  { pt: "As duas não coincidem.",  en: "The two don't match.", es: "Las dos no coinciden.", fr: "Les deux ne correspondent pas.", de: "Die beiden stimmen nicht überein." },
  errIgual:         { pt: "A nova senha tem de ser diferente da atual.", en: "The new password must be different from the current one.", es: "La nueva contraseña debe ser distinta de la actual.", fr: "Le nouveau mot de passe doit être différent de l'actuel.", de: "Das neue Passwort muss sich vom aktuellen unterscheiden." },
  errAtualIncorreta:{ pt: "A senha atual não está certa.", en: "The current password isn't right.", es: "La contraseña actual no es correcta.", fr: "Le mot de passe actuel n'est pas correct.", de: "Das aktuelle Passwort stimmt nicht." },
  errAlterarSenha:  { pt: "Não foi possível alterar. Tenta outra vez.", en: "Couldn't change it. Try again.", es: "No se pudo cambiar. Inténtalo otra vez.", fr: "Changement impossible. Réessaie.", de: "Ändern fehlgeschlagen. Versuch es erneut." },
  aAlterar:         { pt: "A alterar...",            en: "Changing...",          es: "Cambiando...",         fr: "Changement...",        de: "Wird geändert..." },
  judoguiDodo:      { pt: "O judogui do Dôdo",       en: "Dôdo's judogi",        es: "El judogui del Dôdo",  fr: "Le judogi du Dôdo",    de: "Dôdos Judogi" },
  judoguiBranco:    { pt: "Branco",                  en: "White",                es: "Blanco",               fr: "Blanc",                de: "Weiß" },
  judoguiAzul:      { pt: "Azul",                    en: "Blue",                 es: "Azul",                 fr: "Bleu",                 de: "Blau" },
  judoguiPro:       { pt: "O judogui azul é de quem tem Ippon Pro.", en: "The blue judogi is for Ippon Pro members.", es: "El judogui azul es de quien tiene Ippon Pro.", fr: "Le judogi bleu est pour les membres Ippon Pro.", de: "Das blaue Judogi gehört Ippon-Pro-Mitgliedern." },
  desbloquearPro:   { pt: "Desbloquear com o Pro",   en: "Unlock with Pro",      es: "Desbloquear con Pro",  fr: "Débloquer avec le Pro", de: "Mit Pro freischalten" },
  lingua:           { pt: "Idioma",                  en: "Language",             es: "Idioma",               fr: "Langue",               de: "Sprache" },
  notificacoes:     { pt: "Notificações",            en: "Notifications",        es: "Notificaciones",       fr: "Notifications",        de: "Benachrichtigungen" },
  assinatura:       { pt: "Assinatura",              en: "Subscription",         es: "Suscripción",          fr: "Abonnement",           de: "Abonnement" },
  oTeuPlano:        { pt: "O teu plano",             en: "Your plan",            es: "Tu plan",              fr: "Ton offre",            de: "Dein Plan" },
  planoGratuito:    { pt: "Gratuito",                en: "Free",                 es: "Gratuito",             fr: "Gratuit",              de: "Kostenlos" },
  recargaCada:      { pt: "recarga a cada",          en: "refill every",         es: "recarga cada",         fr: "recharge toutes les",  de: "Nachladen alle" },
  minutos:          { pt: "minutos",                 en: "minutes",              es: "minutos",              fr: "minutes",              de: "Minuten" },
  semLimite:        { pt: "Sem limite",              en: "No limit",             es: "Sin límite",           fr: "Sans limite",          de: "Ohne Limit" },
  verFaixa:         { pt: "Ver a minha faixa",       en: "See my belt",          es: "Ver mi cinturón",      fr: "Voir ma ceinture",     de: "Meinen Gürtel ansehen" },
  infoPoliticas:    { pt: "Informação e políticas",  en: "Information and policies", es: "Información y políticas", fr: "Informations et politiques", de: "Informationen und Richtlinien" },
  infoSobre:        { pt: "Sobre a Academy",         en: "About the Academy",    es: "Sobre la Academy",     fr: "À propos de l'Academy", de: "Über die Academy" },
  infoFaq:          { pt: "Perguntas frequentes",    en: "Frequently asked questions", es: "Preguntas frecuentes", fr: "Questions fréquentes", de: "Häufige Fragen" },
  infoTermos:       { pt: "Termos",                  en: "Terms",                es: "Términos",             fr: "Conditions",           de: "Bedingungen" },
  infoPrivacidade:  { pt: "Privacidade",             en: "Privacy",              es: "Privacidad",           fr: "Confidentialité",      de: "Datenschutz" },
  infoAjuda:        { pt: "Ajuda",                   en: "Help",                 es: "Ayuda",                fr: "Aide",                 de: "Hilfe" },
  sair:             { pt: "Sair",                    en: "Sign out",             es: "Salir",                fr: "Se déconnecter",       de: "Abmelden" },
  aSair:            { pt: "A sair...",               en: "Signing out...",       es: "Saliendo...",          fr: "Déconnexion...",       de: "Abmelden..." },
  versaoTestes:     { pt: "versão de testes",        en: "test version",         es: "versión de pruebas",   fr: "version de test",      de: "Testversion" },
  telefone:         { pt: "Telefone",                en: "Phone",                es: "Teléfono",             fr: "Téléphone",            de: "Telefon" },
  telefoneOpcional: { pt: "Telefone (opcional)",     en: "Phone (optional)",     es: "Teléfono (opcional)",  fr: "Téléphone (facultatif)", de: "Telefon (optional)" },
  phNome:           { pt: "O teu nome",              en: "Your name",            es: "Tu nombre",            fr: "Ton nom",              de: "Dein Name" },
  phNumero:         { pt: "Número",                  en: "Number",               es: "Número",               fr: "Numéro",               de: "Nummer" },
  aGuardar:         { pt: "A guardar...",            en: "Saving...",            es: "Guardando...",         fr: "Enregistrement...",    de: "Wird gespeichert..." },
  cancelar:         { pt: "Cancelar",                en: "Cancel",               es: "Cancelar",             fr: "Annuler",              de: "Abbrechen" },
  erroGuardar:      { pt: "Não foi possível guardar. Tenta outra vez.", en: "Couldn't save. Try again.", es: "No se pudo guardar. Inténtalo otra vez.", fr: "Enregistrement impossible. Réessaie.", de: "Speichern fehlgeschlagen. Versuch es erneut." },
  emailJaExiste:    { pt: "Esse email já está numa conta.", en: "That email is already on an account.", es: "Ese email ya está en una cuenta.", fr: "Cet email est déjà sur un compte.", de: "Diese E-Mail gehört bereits zu einem Konto." },
  erroEmail:        { pt: "Não foi possível mudar o email.", en: "Couldn't change the email.", es: "No se pudo cambiar el email.", fr: "Impossible de changer l'email.", de: "E-Mail konnte nicht geändert werden." },
  emailAviso:       { pt: "Se mudares o email, vais receber uma confirmação no endereço novo. Até confirmares, entras com o antigo.", en: "If you change the email, you'll get a confirmation at the new address. Until you confirm, you sign in with the old one.", es: "Si cambias el email, recibirás una confirmación en la dirección nueva. Hasta confirmar, entras con el antiguo.", fr: "Si tu changes d'email, tu recevras une confirmation à la nouvelle adresse. Jusque-là, tu te connectes avec l'ancienne.", de: "Wenn du die E-Mail änderst, bekommst du eine Bestätigung an die neue Adresse. Bis dahin meldest du dich mit der alten an." },
  emailPendente:    { pt: "Confirma no email que enviámos para %E%.", en: "Confirm via the email we sent to %E%.", es: "Confirma en el email que enviamos a %E%.", fr: "Confirme via l'email envoyé à %E%.", de: "Bestätige über die E-Mail an %E%." },
  paisNoFantasy:    { pt: "O país e a faixa do teu perfil de competição mudam-se na Ippon League.", en: "The country and belt on your competition profile are changed on Ippon League.", es: "El país y el cinturón de tu perfil de competición se cambian en Ippon League.", fr: "Le pays et la ceinture de ton profil de compétition se changent sur Ippon League.", de: "Land und Gürtel deines Wettkampfprofils änderst du auf Ippon League." },
  guardado:         { pt: "Guardado.",               en: "Saved.",               es: "Guardado.",            fr: "Enregistré.",          de: "Gespeichert." },
  proximaFaixa:     { pt: "Próxima faixa",            en: "Next belt",            es: "Próximo cinturón",     fr: "Ceinture suivante",    de: "Nächster Gürtel" },
  proximoLapis:     { pt: "Próximo lápis em %t%",      en: "Next pencil in %t%",   es: "Próximo lápiz en %t%", fr: "Prochain crayon dans %t%", de: "Nächster Stift in %t%" },
  lapisCheios:      { pt: "Tens todos os lápis.",      en: "You have every pencil.", es: "Tienes todos los lápices.", fr: "Tu as tous tes crayons.", de: "Du hast alle Stifte." },
  lapisSemFim:      { pt: "Lápis sem fim.",            en: "Endless pencils.",     es: "Lápices sin fin.",     fr: "Des crayons sans fin.", de: "Endlose Stifte." },
  confirmarSair:    { pt: "Queres mesmo sair?",        en: "Do you really want to sign out?", es: "¿Seguro que quieres salir?", fr: "Veux-tu vraiment te déconnecter ?", de: "Willst du dich wirklich abmelden?" },
  simSair:          { pt: "Sim, sair",                 en: "Yes, sign out",        es: "Sí, salir",            fr: "Oui, me déconnecter",  de: "Ja, abmelden" },
  faixaConquistada: { pt: "Faixa conquistada",         en: "Belt earned",          es: "Cinturón conseguido",  fr: "Ceinture obtenue",     de: "Gürtel erreicht" },
  aMinhaEquipa:     { pt: "A minha equipa",           en: "My team",              es: "Mi equipo",            fr: "Mon équipe",           de: "Mein Team" },
  escudoNome:       { pt: "Escudo e nome do time",     en: "Crest and team name",  es: "Escudo y nombre del equipo", fr: "Blason et nom de l'équipe", de: "Wappen und Teamname" },
  mudarEscudo:      { pt: "Mudar escudo",              en: "Change crest",         es: "Cambiar escudo",       fr: "Changer de blason",    de: "Wappen ändern" },
  escudoTitulo:     { pt: "O meu escudo",             en: "My crest",             es: "Mi escudo",            fr: "Mon blason",           de: "Mein Wappen" },
  semNome:          { pt: "Sem nome",                 en: "No name",              es: "Sin nombre",           fr: "Sans nom",             de: "Ohne Namen" },
  sortear:          { pt: "Sortear",                  en: "Shuffle",              es: "Sortear",              fr: "Tirer au sort",        de: "Auslosen" },
  nomeTime:         { pt: "Nome do time",             en: "Team name",            es: "Nombre del equipo",    fr: "Nom de l'équipe",      de: "Teamname" },
  phNomeTime:       { pt: "Escreve o nome do teu time", en: "Write your team name", es: "Escribe el nombre de tu equipo", fr: "Écris le nom de ton équipe", de: "Schreib deinen Teamnamen" },
  erroNomeTime:     { pt: "Dá um nome ao teu time — pelo menos 2 letras.", en: "Give your team a name — at least 2 letters.", es: "Dale un nombre a tu equipo — al menos 2 letras.", fr: "Donne un nom à ton équipe — au moins 2 lettres.", de: "Gib deinem Team einen Namen — mindestens 2 Buchstaben." },
  nomeEmUso:        { pt: "Esse nome já está a ser usado. Escolhe outro.", en: "That name is already taken. Pick another.", es: "Ese nombre ya está en uso. Elige otro.", fr: "Ce nom est déjà pris. Choisis-en un autre.", de: "Dieser Name ist schon vergeben. Wähl einen anderen." },
  nomeUnicoInfo:    { pt: "Os nomes de time são únicos: ninguém pode ter o mesmo que tu.", en: "Team names are unique: nobody else can have yours.", es: "Los nombres de equipo son únicos: nadie más puede tener el tuyo.", fr: "Les noms d'équipe sont uniques : personne d'autre ne peut avoir le tien.", de: "Teamnamen sind einmalig: niemand sonst kann deinen haben." },
  aVerificarNome:   { pt: "A verificar o nome...",    en: "Checking the name...", es: "Comprobando el nombre...", fr: "Vérification du nom...", de: "Name wird geprüft..." },
  daNomeSalvar:     { pt: "Dá um nome para guardar",  en: "Name it to save",      es: "Dale un nombre para guardar", fr: "Donne-lui un nom pour enregistrer", de: "Zum Speichern benennen" },
  salvarEscudo:     { pt: "Guardar o escudo",         en: "Save the crest",       es: "Guardar el escudo",    fr: "Enregistrer le blason", de: "Wappen speichern" },
  escolherForma:    { pt: "Escolhe a forma",          en: "Choose the shape",     es: "Elige la forma",       fr: "Choisis la forme",     de: "Wähl die Form" },
  escolherEstampa:  { pt: "Escolhe a estampa",        en: "Choose the pattern",   es: "Elige el estampado",   fr: "Choisis le motif",     de: "Wähl das Muster" },
  escolherCores:    { pt: "Escolhe as cores",         en: "Choose the colours",   es: "Elige los colores",    fr: "Choisis les couleurs", de: "Wähl die Farben" },
  escolherAdorno:   { pt: "Escolhe o símbolo",        en: "Choose the symbol",    es: "Elige el símbolo",     fr: "Choisis le symbole",   de: "Wähl das Symbol" },
  aPintar:          { pt: "A pintar:",                en: "Painting:",            es: "Pintando:",            fr: "En train de peindre :", de: "Du färbst:" },
  semBordaIcone:    { pt: "Sem contorno",             en: "No outline",           es: "Sin contorno",         fr: "Sans contour",         de: "Ohne Kontur" },
  anterior:         { pt: "Anterior",                 en: "Previous",             es: "Anterior",             fr: "Précédent",            de: "Zurück" },
  corFundo1:        { pt: "Fundo 1",                  en: "Background 1",         es: "Fondo 1",              fr: "Fond 1",               de: "Hintergrund 1" },
  corFundo2:        { pt: "Fundo 2",                  en: "Background 2",         es: "Fondo 2",              fr: "Fond 2",               de: "Hintergrund 2" },
  corBordaFundo:    { pt: "Borda",                    en: "Border",               es: "Borde",                fr: "Bordure",              de: "Rand" },
  corIcone:         { pt: "Símbolo",                  en: "Symbol",               es: "Símbolo",              fr: "Symbole",              de: "Symbol" },
  corBordaIcone:    { pt: "Contorno",                 en: "Outline",              es: "Contorno",             fr: "Contour",              de: "Kontur" },
  corEstampa1:      { pt: "Estampa 1",                en: "Pattern 1",            es: "Estampado 1",          fr: "Motif 1",              de: "Muster 1" },
  corEstampa2:      { pt: "Estampa 2",                en: "Pattern 2",            es: "Estampado 2",          fr: "Motif 2",              de: "Muster 2" },
  mudaNosDoisTitulo:{ pt: "Isto muda nos dois",       en: "This changes in both", es: "Esto cambia en los dos", fr: "Ceci change des deux côtés", de: "Das ändert sich in beiden" },
  mudaNosDoisTexto: { pt: "O escudo e o nome do time são os mesmos na Academy e na Ippon League. Ao guardar, mudam nos dois sítios.", en: "The crest and team name are the same on the Academy and on Ippon League. Saving changes them in both places.", es: "El escudo y el nombre del equipo son los mismos en la Academy y en Ippon League. Al guardar, cambian en los dos sitios.", fr: "Le blason et le nom de l'équipe sont les mêmes sur l'Academy et sur Ippon League. En enregistrant, ils changent des deux côtés.", de: "Wappen und Teamname sind in der Academy und bei Ippon League dieselben. Beim Speichern ändern sie sich an beiden Stellen." },
  guardarNosDois:   { pt: "Guardar nos dois",         en: "Save in both",         es: "Guardar en los dos",   fr: "Enregistrer des deux côtés", de: "In beiden speichern" },
  vaisTrocarNome:   { pt: "O nome passa de %a% para %b%.", en: "The name goes from %a% to %b%.", es: "El nombre pasa de %a% a %b%.", fr: "Le nom passe de %a% à %b%.", de: "Der Name wird von %a% zu %b%." },
  nomeAnteriorLivre:{ pt: "O nome antigo fica livre para outra pessoa.", en: "The old name becomes free for someone else.", es: "El nombre antiguo queda libre para otra persona.", fr: "L'ancien nom redevient libre pour quelqu'un d'autre.", de: "Der alte Name wird für andere frei." },
  aCarregar:        { pt: "A carregar...",        en: "Loading...",           es: "Cargando...",          fr: "Chargement...",        de: "Lädt..." },
} as const;

export type Chave = keyof typeof T;

// A LÍNGUA VIVE NUM SÍTIO SÓ.
//
// Antes, cada componente que chamava useLang() tinha a sua própria cópia do
// estado. Enquanto o seletor estava dentro da página funcionava por acidente:
// era a mesma cópia. Assim que o seletor passou a ser um componente à parte,
// clicar numa bandeira mudava a língua só dele — a página não dava por nada.
//
// Com o provider há UMA língua para toda a app, e quem a mudar muda-a para
// todos os ecrãs de uma vez. É o mesmo que a Ippon League faz.
//
// (Sem JSX de propósito: este ficheiro é .ts, e renomeá-lo obrigaria a mexer
// em todos os imports. createElement faz exactamente o mesmo.)

type Contexto = [Lang, (l: Lang) => void];

const CtxLingua = createContext<Contexto>(["pt", () => {}]);

export function LinguaProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>("pt");

  useEffect(() => {
    const guardada = document.cookie.match(/(?:^|; )ila_lang=([a-z]{2})/)?.[1] as Lang | undefined;
    if (guardada && LINGUAS.includes(guardada)) { setLang(guardada); return; }
    const nav = navigator.language.slice(0, 2) as Lang;
    if (LINGUAS.includes(nav)) setLang(nav);
  }, []);

  const mudar = useCallback((l: Lang) => {
    document.cookie = `ila_lang=${l}; path=/; max-age=31536000`;
    setLang(l);
  }, []);

  const valor = useMemo<Contexto>(() => [lang, mudar], [lang, mudar]);

  return createElement(CtxLingua.Provider, { value: valor }, children);
}

export function useLang(): Contexto {
  return useContext(CtxLingua);
}

export function useT(lang: Lang) {
  return (chave: Chave, vars?: Record<string, string | number>) => {
    let texto: string = T[chave][lang] ?? T[chave].pt;
    if (vars) for (const [k, v] of Object.entries(vars)) texto = texto.split(`%${k}%`).join(String(v));
    return texto;
  };
}
