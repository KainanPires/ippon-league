"use client";

// lib/i18n.ts
//
// AS LÍNGUAS DA IPPON LEAGUE
//
// O documento fundador diz "global desde o início". Até aqui a app só falava
// português — um francês ou um brasileiro conseguiam jogar, mas um espanhol ou
// um americano não passavam do registo.
//
// ---------------------------------------------------------------------------
// COMO FUNCIONA
//
//   const t = useT();
//   <h1>{t("inicio.titulo")}</h1>
//   <p>{t("mercado.saldo", { jc: "17.5" })}</p>
//
// Uma chave por frase. O português é a língua de origem: é nele que as frases
// são escritas primeiro e é ele que serve de recurso quando falta tradução.
//
// FALTA UMA TRADUÇÃO? Devolve o português, não a chave.
// Um ecrã meio traduzido é feio; um ecrã a mostrar "inicio.titulo" está partido.
// Assim podemos traduzir aos poucos sem nunca quebrar nada.
//
// ---------------------------------------------------------------------------
// O QUE NÃO SE TRADUZ — e porquê
//
// Os termos de judo são universais: um judoca japonês, brasileiro ou francês
// diz "ippon", "waza-ari", "shido". Traduzir "ippon" para "full point" seria
// afastar a app de quem percebe do assunto.
//
//   ippon · waza-ari · yuko · shido · hansoku-make · judogi · tatame · dojo
//   golden score · osaekomi · e os nomes das faixas
//
// Os nomes próprios do produto também não: Ippon League, Ippon Pro, Pro Max,
// Judocoins (JC), Copa do Dôdo.
//
// ---------------------------------------------------------------------------
// O JAPONÊS
//
// Fica de fora por decisão, até haver quem reveja. Traduzir mal os termos de
// judo em japonês é pior do que não traduzir de todo. A estrutura já o aceita:
// acrescentar "ja" a LINGUAS e ao dicionário chega.
// ---------------------------------------------------------------------------

import { createContext, createElement, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";

export type Lingua = "pt" | "en" | "es" | "fr";

export const LINGUAS: { id: Lingua; nome: string; bandeira: string }[] = [
  { id: "pt", nome: "Português", bandeira: "🇵🇹" },
  { id: "en", nome: "English", bandeira: "🇬🇧" },
  { id: "es", nome: "Español", bandeira: "🇪🇸" },
  { id: "fr", nome: "Français", bandeira: "🇫🇷" },
];

const CHAVE_LOCAL = "ippon_lingua";

// ---------------------------------------------------------------------------
// O DICIONÁRIO
//
// Organizado por ecrã. A chave descreve o sítio e o papel da frase, não o texto
// — assim, mudar o texto português não obriga a mexer nas chaves.
//
// {var} são substituições. O nome da variável é o mesmo em todas as línguas.
// ---------------------------------------------------------------------------

type Dicionario = Record<string, string>;

const PT: Dicionario = {
  // --- comum ---
  "comum.voltar": "Voltar",
  "comum.continuar": "Continuar",
  "comum.seguinte": "Seguinte",
  "comum.anterior": "Anterior",
  "comum.cancelar": "Cancelar",
  "comum.guardar": "Guardar",
  "comum.fechar": "Fechar",
  "comum.confirmar": "Confirmar",
  "comum.carregando": "A carregar…",
  "comum.erro": "Algo correu mal. Tenta outra vez.",
  "comum.pular": "Pular",
  "comum.naoMostrarMais": "Não mostrar mais",
  "comum.verMais": "Ver mais",
  "comum.de": "de",
  "comum.pontos": "pontos",
  "comum.pts": "pts",

  // --- entrar / registo ---
  "entrar.titulo": "Entrar",
  "entrar.email": "Email",
  "entrar.senha": "Senha",
  "entrar.mostrarSenha": "Mostrar senha",
  "entrar.esqueci": "Esqueci-me da senha",
  "entrar.semConta": "Ainda não tens conta?",
  "entrar.criarConta": "Criar conta",
  "entrar.aEntrar": "A entrar…",
  "entrar.credenciaisErradas": "Email ou senha incorretos.",

  "comecar.titulo": "Criar a tua conta",
  "comecar.nome": "Nome",
  "comecar.dataNasc": "Data de nascimento",
  "comecar.telefone": "Telemóvel (opcional)",
  "comecar.faixa": "A tua faixa",
  "comecar.pais": "O teu país",
  "comecar.semFaixa": "Ainda não tenho faixa",
  "comecar.criar": "Criar conta",
  "comecar.aCriar": "A criar…",
  "comecar.jaTenhoConta": "Já tenho conta",
  "comecar.contaCriada": "Conta criada!",
  "comecar.podesEntrar": "Já podes entrar e montar a tua equipa.",
  "comecar.emailConfirmacao":
    "Vamos enviar-te um email para {email} para confirmares o endereço. Não é preciso esperar — mas confirma quando puderes, para não perderes avisos das rodadas.",

  // erros do formulário
  "erro.nome": "Diz-nos o teu nome.",
  "erro.emailFalta": "Precisamos do teu email.",
  "erro.emailInvalido": "Esse email não parece válido.",
  "erro.senhaFalta": "Cria uma senha.",
  "erro.senhaCurta": "A senha precisa de pelo menos 6 caracteres.",
  "erro.dataFalta": "Indica a tua data de nascimento.",
  "erro.dataFutura": "Essa data não pode ser no futuro.",
  "erro.faixaFalta": "Escolhe a tua faixa.",
  "erro.paisFalta": "Escolhe o teu país.",
  "erro.emailExiste": "Já existe uma conta com este email. Tenta entrar.",
  "erro.senhaRecusada": "Essa senha não é aceite. Tenta outra (mín. 6 caracteres).",
  "erro.contaFalhou": "Não foi possível criar a conta. Tenta novamente.",

  // --- navegação ---
  "nav.inicio": "Início",
  "nav.competicoes": "Competições",
  "nav.atletas": "Atletas",
  "nav.pro": "Pro",
  "nav.proNovidade": "{label} — novidade",

  // --- equipa ---
  "equipa.meuTime": "Meu time",
  "equipa.patrimonio": "Património",
  "equipa.saldo": "Saldo",
  "equipa.capitao": "Capitão",
  "equipa.editar": "Editar equipa",
  "equipa.guardada": "Equipa guardada",
  "equipa.semEquipa": "Ainda não tens uma equipa guardada para esta competição.",
  "equipa.rodadaADecorrer": "A rodada está a decorrer!",
  "equipa.valorEquipa": "Valor da equipa: JC {valor}",

  // --- mercado ---
  "mercado.titulo": "Mercado",
  "mercado.aberto": "Mercado aberto",
  "mercado.fechado": "Mercado fechado",
  "mercado.fechaEm": "Fecha em {tempo}",
  "mercado.procurar": "Procurar atleta",
  "mercado.comprar": "Comprar",
  "mercado.vender": "Vender",
  "mercado.semSaldo": "Sem saldo para este atleta.",

  // --- ligas ---
  "ligas.titulo": "Competições",
  "ligas.minhasLigas": "As minhas ligas",
  "ligas.criarLiga": "Criar liga",
  "ligas.entrarComCodigo": "Entrar com código",
  "ligas.mundial": "Liga Mundial",
  "ligas.continental": "Liga {continente}",
  "ligas.membros": "{n} membros",
  "ligas.escalou": "Escalou",
  "ligas.naoEscalou": "Ainda não escalou",

  // --- chave ---
  "chave.principal": "Chave principal",
  "chave.repescagem": "Repescagem e bronzes",
  "chave.vazia": "A chave aparece quando o sorteio correr.",
  "chave.deslize": "deslize para ver toda a chave",
  "chave.passou": "Passou (sem adversário)",
  "chave.aAguardar": "a aguardar",
  "chave.proximoConfronto": "Próximo confronto",

  // --- pro ---
  "pro.central": "A minha central Pro",
  "pro.centralMax": "A minha central Pro Max",
  "pro.membro": "Membro Ippon Pro",
  "pro.membroMax": "Membro Pro Max",
  "pro.serMax": "Sê Pro Max",
  "pro.passarMax": "Passar a Pro Max",
  "pro.rever": "Rever o que tenho com o {plano}",
  "pro.comunidade": "Comunidade Pro Max",
  "pro.comunidadeSub":
    "Grupo de WhatsApp: notícias, rodadas e conversa de judo. A entrada é aprovada por um administrador.",

  // --- preços ---
  "precos.porMes": "/mês",
  "precos.notaMoeda": "Valor cobrado na tua moeda local, à taxa de câmbio do dia.",
  "precos.contratar": "Contratar {plano}",
  "precos.aAbrir": "A abrir…",

  // --- faixas (o NOME da faixa não se traduz; o rótulo sim) ---
  "faixa.atual": "Faixa atual",
  "faixa.subiste": "Subiste para a faixa {faixa}!",
  "faixa.desceste": "Desceste para a faixa {faixa}. Recupera na próxima rodada.",

  // --- perfil ---
  "perfil.titulo": "Perfil",
  "perfil.lingua": "Idioma",
  "perfil.assinatura": "A minha assinatura",
  "perfil.seguranca": "Segurança",
  "perfil.alterarSenha": "Alterar senha",
  "perfil.notificacoes": "Notificações",
  "perfil.sair": "Terminar sessão",
};

// --- INGLÊS ---
const EN: Dicionario = {
  "comum.voltar": "Back",
  "comum.continuar": "Continue",
  "comum.seguinte": "Next",
  "comum.anterior": "Previous",
  "comum.cancelar": "Cancel",
  "comum.guardar": "Save",
  "comum.fechar": "Close",
  "comum.confirmar": "Confirm",
  "comum.carregando": "Loading…",
  "comum.erro": "Something went wrong. Please try again.",
  "comum.pular": "Skip",
  "comum.naoMostrarMais": "Don't show again",
  "comum.verMais": "See more",
  "comum.de": "of",
  "comum.pontos": "points",
  "comum.pts": "pts",

  "entrar.titulo": "Sign in",
  "entrar.email": "Email",
  "entrar.senha": "Password",
  "entrar.mostrarSenha": "Show password",
  "entrar.esqueci": "Forgot your password?",
  "entrar.semConta": "Don't have an account yet?",
  "entrar.criarConta": "Create account",
  "entrar.aEntrar": "Signing in…",
  "entrar.credenciaisErradas": "Wrong email or password.",

  "comecar.titulo": "Create your account",
  "comecar.nome": "Name",
  "comecar.dataNasc": "Date of birth",
  "comecar.telefone": "Phone (optional)",
  "comecar.faixa": "Your belt",
  "comecar.pais": "Your country",
  "comecar.semFaixa": "I don't have a belt yet",
  "comecar.criar": "Create account",
  "comecar.aCriar": "Creating…",
  "comecar.jaTenhoConta": "I already have an account",
  "comecar.contaCriada": "Account created!",
  "comecar.podesEntrar": "You can sign in and build your team.",
  "comecar.emailConfirmacao":
    "We'll send an email to {email} so you can confirm your address. No need to wait — but confirm when you can, so you don't miss round alerts.",

  "erro.nome": "Tell us your name.",
  "erro.emailFalta": "We need your email.",
  "erro.emailInvalido": "That email doesn't look valid.",
  "erro.senhaFalta": "Create a password.",
  "erro.senhaCurta": "Your password needs at least 6 characters.",
  "erro.dataFalta": "Enter your date of birth.",
  "erro.dataFutura": "That date can't be in the future.",
  "erro.faixaFalta": "Choose your belt.",
  "erro.paisFalta": "Choose your country.",
  "erro.emailExiste": "An account with this email already exists. Try signing in.",
  "erro.senhaRecusada": "That password wasn't accepted. Try another (min. 6 characters).",
  "erro.contaFalhou": "We couldn't create the account. Please try again.",

  "nav.inicio": "Home",
  "nav.competicoes": "Competitions",
  "nav.atletas": "Athletes",
  "nav.pro": "Pro",
  "nav.proNovidade": "{label} — new",

  "equipa.meuTime": "My team",
  "equipa.patrimonio": "Net worth",
  "equipa.saldo": "Balance",
  "equipa.capitao": "Captain",
  "equipa.editar": "Edit team",
  "equipa.guardada": "Team saved",
  "equipa.semEquipa": "You haven't saved a team for this competition yet.",
  "equipa.rodadaADecorrer": "The round is under way!",
  "equipa.valorEquipa": "Team value: JC {valor}",

  "mercado.titulo": "Market",
  "mercado.aberto": "Market open",
  "mercado.fechado": "Market closed",
  "mercado.fechaEm": "Closes in {tempo}",
  "mercado.procurar": "Search athlete",
  "mercado.comprar": "Buy",
  "mercado.vender": "Sell",
  "mercado.semSaldo": "Not enough balance for this athlete.",

  "ligas.titulo": "Competitions",
  "ligas.minhasLigas": "My leagues",
  "ligas.criarLiga": "Create league",
  "ligas.entrarComCodigo": "Join with a code",
  "ligas.mundial": "World League",
  "ligas.continental": "{continente} League",
  "ligas.membros": "{n} members",
  "ligas.escalou": "Team in",
  "ligas.naoEscalou": "No team yet",

  "chave.principal": "Main bracket",
  "chave.repescagem": "Repechage and bronzes",
  "chave.vazia": "The bracket appears once the draw is made.",
  "chave.deslize": "swipe to see the whole bracket",
  "chave.passou": "Bye (no opponent)",
  "chave.aAguardar": "waiting",
  "chave.proximoConfronto": "Next match",

  "pro.central": "My Pro hub",
  "pro.centralMax": "My Pro Max hub",
  "pro.membro": "Ippon Pro member",
  "pro.membroMax": "Pro Max member",
  "pro.serMax": "Go Pro Max",
  "pro.passarMax": "Upgrade to Pro Max",
  "pro.rever": "Review what {plano} gives me",
  "pro.comunidade": "Pro Max community",
  "pro.comunidadeSub":
    "WhatsApp group: news, rounds and judo talk. Entry is approved by an admin.",

  "precos.porMes": "/month",
  "precos.notaMoeda": "Charged in your local currency, at today's exchange rate.",
  "precos.contratar": "Get {plano}",
  "precos.aAbrir": "Opening…",

  "faixa.atual": "Current belt",
  "faixa.subiste": "You moved up to the {faixa} belt!",
  "faixa.desceste": "You dropped to the {faixa} belt. Win it back next round.",

  "perfil.titulo": "Profile",
  "perfil.lingua": "Language",
  "perfil.assinatura": "My subscription",
  "perfil.seguranca": "Security",
  "perfil.alterarSenha": "Change password",
  "perfil.notificacoes": "Notifications",
  "perfil.sair": "Sign out",
};

// --- ESPANHOL ---
const ES: Dicionario = {
  "comum.voltar": "Volver",
  "comum.continuar": "Continuar",
  "comum.seguinte": "Siguiente",
  "comum.anterior": "Anterior",
  "comum.cancelar": "Cancelar",
  "comum.guardar": "Guardar",
  "comum.fechar": "Cerrar",
  "comum.confirmar": "Confirmar",
  "comum.carregando": "Cargando…",
  "comum.erro": "Algo salió mal. Inténtalo de nuevo.",
  "comum.pular": "Saltar",
  "comum.naoMostrarMais": "No mostrar más",
  "comum.verMais": "Ver más",
  "comum.de": "de",
  "comum.pontos": "puntos",
  "comum.pts": "pts",

  "entrar.titulo": "Iniciar sesión",
  "entrar.email": "Correo",
  "entrar.senha": "Contraseña",
  "entrar.mostrarSenha": "Mostrar contraseña",
  "entrar.esqueci": "¿Olvidaste tu contraseña?",
  "entrar.semConta": "¿Aún no tienes cuenta?",
  "entrar.criarConta": "Crear cuenta",
  "entrar.aEntrar": "Entrando…",
  "entrar.credenciaisErradas": "Correo o contraseña incorrectos.",

  "comecar.titulo": "Crea tu cuenta",
  "comecar.nome": "Nombre",
  "comecar.dataNasc": "Fecha de nacimiento",
  "comecar.telefone": "Móvil (opcional)",
  "comecar.faixa": "Tu cinturón",
  "comecar.pais": "Tu país",
  "comecar.semFaixa": "Todavía no tengo cinturón",
  "comecar.criar": "Crear cuenta",
  "comecar.aCriar": "Creando…",
  "comecar.jaTenhoConta": "Ya tengo cuenta",
  "comecar.contaCriada": "¡Cuenta creada!",
  "comecar.podesEntrar": "Ya puedes entrar y montar tu equipo.",
  "comecar.emailConfirmacao":
    "Te enviaremos un correo a {email} para que confirmes la dirección. No hace falta esperar, pero confírmalo cuando puedas para no perderte los avisos de las jornadas.",

  "erro.nome": "Dinos tu nombre.",
  "erro.emailFalta": "Necesitamos tu correo.",
  "erro.emailInvalido": "Ese correo no parece válido.",
  "erro.senhaFalta": "Crea una contraseña.",
  "erro.senhaCurta": "La contraseña necesita al menos 6 caracteres.",
  "erro.dataFalta": "Indica tu fecha de nacimiento.",
  "erro.dataFutura": "Esa fecha no puede ser futura.",
  "erro.faixaFalta": "Elige tu cinturón.",
  "erro.paisFalta": "Elige tu país.",
  "erro.emailExiste": "Ya existe una cuenta con este correo. Intenta iniciar sesión.",
  "erro.senhaRecusada": "Esa contraseña no se acepta. Prueba otra (mín. 6 caracteres).",
  "erro.contaFalhou": "No pudimos crear la cuenta. Inténtalo de nuevo.",

  "nav.inicio": "Inicio",
  "nav.competicoes": "Competiciones",
  "nav.atletas": "Atletas",
  "nav.pro": "Pro",
  "nav.proNovidade": "{label} — novedad",

  "equipa.meuTime": "Mi equipo",
  "equipa.patrimonio": "Patrimonio",
  "equipa.saldo": "Saldo",
  "equipa.capitao": "Capitán",
  "equipa.editar": "Editar equipo",
  "equipa.guardada": "Equipo guardado",
  "equipa.semEquipa": "Todavía no has guardado un equipo para esta competición.",
  "equipa.rodadaADecorrer": "¡La jornada está en marcha!",
  "equipa.valorEquipa": "Valor del equipo: JC {valor}",

  "mercado.titulo": "Mercado",
  "mercado.aberto": "Mercado abierto",
  "mercado.fechado": "Mercado cerrado",
  "mercado.fechaEm": "Cierra en {tempo}",
  "mercado.procurar": "Buscar atleta",
  "mercado.comprar": "Comprar",
  "mercado.vender": "Vender",
  "mercado.semSaldo": "No tienes saldo para este atleta.",

  "ligas.titulo": "Competiciones",
  "ligas.minhasLigas": "Mis ligas",
  "ligas.criarLiga": "Crear liga",
  "ligas.entrarComCodigo": "Entrar con código",
  "ligas.mundial": "Liga Mundial",
  "ligas.continental": "Liga {continente}",
  "ligas.membros": "{n} miembros",
  "ligas.escalou": "Alineó",
  "ligas.naoEscalou": "Aún no alineó",

  "chave.principal": "Cuadro principal",
  "chave.repescagem": "Repesca y bronces",
  "chave.vazia": "El cuadro aparece cuando se haga el sorteo.",
  "chave.deslize": "desliza para ver todo el cuadro",
  "chave.passou": "Pasó (sin rival)",
  "chave.aAguardar": "esperando",
  "chave.proximoConfronto": "Próximo combate",

  "pro.central": "Mi central Pro",
  "pro.centralMax": "Mi central Pro Max",
  "pro.membro": "Miembro Ippon Pro",
  "pro.membroMax": "Miembro Pro Max",
  "pro.serMax": "Hazte Pro Max",
  "pro.passarMax": "Pasar a Pro Max",
  "pro.rever": "Repasar lo que tengo con {plano}",
  "pro.comunidade": "Comunidad Pro Max",
  "pro.comunidadeSub":
    "Grupo de WhatsApp: noticias, jornadas y conversación de judo. La entrada la aprueba un administrador.",

  "precos.porMes": "/mes",
  "precos.notaMoeda": "Se cobra en tu moneda local, al cambio del día.",
  "precos.contratar": "Contratar {plano}",
  "precos.aAbrir": "Abriendo…",

  "faixa.atual": "Cinturón actual",
  "faixa.subiste": "¡Has subido al cinturón {faixa}!",
  "faixa.desceste": "Has bajado al cinturón {faixa}. Recupéralo en la próxima jornada.",

  "perfil.titulo": "Perfil",
  "perfil.lingua": "Idioma",
  "perfil.assinatura": "Mi suscripción",
  "perfil.seguranca": "Seguridad",
  "perfil.alterarSenha": "Cambiar contraseña",
  "perfil.notificacoes": "Notificaciones",
  "perfil.sair": "Cerrar sesión",
};

// --- FRANCÊS ---
const FR: Dicionario = {
  "comum.voltar": "Retour",
  "comum.continuar": "Continuer",
  "comum.seguinte": "Suivant",
  "comum.anterior": "Précédent",
  "comum.cancelar": "Annuler",
  "comum.guardar": "Enregistrer",
  "comum.fechar": "Fermer",
  "comum.confirmar": "Confirmer",
  "comum.carregando": "Chargement…",
  "comum.erro": "Une erreur est survenue. Réessaie.",
  "comum.pular": "Passer",
  "comum.naoMostrarMais": "Ne plus afficher",
  "comum.verMais": "Voir plus",
  "comum.de": "sur",
  "comum.pontos": "points",
  "comum.pts": "pts",

  "entrar.titulo": "Se connecter",
  "entrar.email": "E-mail",
  "entrar.senha": "Mot de passe",
  "entrar.mostrarSenha": "Afficher le mot de passe",
  "entrar.esqueci": "Mot de passe oublié ?",
  "entrar.semConta": "Pas encore de compte ?",
  "entrar.criarConta": "Créer un compte",
  "entrar.aEntrar": "Connexion…",
  "entrar.credenciaisErradas": "E-mail ou mot de passe incorrect.",

  "comecar.titulo": "Crée ton compte",
  "comecar.nome": "Nom",
  "comecar.dataNasc": "Date de naissance",
  "comecar.telefone": "Téléphone (facultatif)",
  "comecar.faixa": "Ta ceinture",
  "comecar.pais": "Ton pays",
  "comecar.semFaixa": "Je n'ai pas encore de ceinture",
  "comecar.criar": "Créer un compte",
  "comecar.aCriar": "Création…",
  "comecar.jaTenhoConta": "J'ai déjà un compte",
  "comecar.contaCriada": "Compte créé !",
  "comecar.podesEntrar": "Tu peux te connecter et composer ton équipe.",
  "comecar.emailConfirmacao":
    "Nous t'enverrons un e-mail à {email} pour confirmer ton adresse. Pas besoin d'attendre — mais confirme dès que tu peux, pour ne pas rater les alertes des journées.",

  "erro.nome": "Dis-nous ton nom.",
  "erro.emailFalta": "Il nous faut ton e-mail.",
  "erro.emailInvalido": "Cet e-mail ne semble pas valide.",
  "erro.senhaFalta": "Crée un mot de passe.",
  "erro.senhaCurta": "Le mot de passe doit faire au moins 6 caractères.",
  "erro.dataFalta": "Indique ta date de naissance.",
  "erro.dataFutura": "Cette date ne peut pas être dans le futur.",
  "erro.faixaFalta": "Choisis ta ceinture.",
  "erro.paisFalta": "Choisis ton pays.",
  "erro.emailExiste": "Un compte existe déjà avec cet e-mail. Essaie de te connecter.",
  "erro.senhaRecusada": "Ce mot de passe n'est pas accepté. Essaie-en un autre (min. 6 caractères).",
  "erro.contaFalhou": "Impossible de créer le compte. Réessaie.",

  "nav.inicio": "Accueil",
  "nav.competicoes": "Compétitions",
  "nav.atletas": "Athlètes",
  "nav.pro": "Pro",
  "nav.proNovidade": "{label} — nouveau",

  "equipa.meuTime": "Mon équipe",
  "equipa.patrimonio": "Patrimoine",
  "equipa.saldo": "Solde",
  "equipa.capitao": "Capitaine",
  "equipa.editar": "Modifier l'équipe",
  "equipa.guardada": "Équipe enregistrée",
  "equipa.semEquipa": "Tu n'as pas encore enregistré d'équipe pour cette compétition.",
  "equipa.rodadaADecorrer": "La journée est en cours !",
  "equipa.valorEquipa": "Valeur de l'équipe : JC {valor}",

  "mercado.titulo": "Marché",
  "mercado.aberto": "Marché ouvert",
  "mercado.fechado": "Marché fermé",
  "mercado.fechaEm": "Ferme dans {tempo}",
  "mercado.procurar": "Rechercher un athlète",
  "mercado.comprar": "Acheter",
  "mercado.vender": "Vendre",
  "mercado.semSaldo": "Solde insuffisant pour cet athlète.",

  "ligas.titulo": "Compétitions",
  "ligas.minhasLigas": "Mes ligues",
  "ligas.criarLiga": "Créer une ligue",
  "ligas.entrarComCodigo": "Rejoindre avec un code",
  "ligas.mundial": "Ligue Mondiale",
  "ligas.continental": "Ligue {continente}",
  "ligas.membros": "{n} membres",
  "ligas.escalou": "Équipe validée",
  "ligas.naoEscalou": "Pas encore d'équipe",

  "chave.principal": "Tableau principal",
  "chave.repescagem": "Repêchage et bronzes",
  "chave.vazia": "Le tableau apparaît après le tirage.",
  "chave.deslize": "fais glisser pour voir tout le tableau",
  "chave.passou": "Exempté (sans adversaire)",
  "chave.aAguardar": "en attente",
  "chave.proximoConfronto": "Prochain combat",

  "pro.central": "Mon espace Pro",
  "pro.centralMax": "Mon espace Pro Max",
  "pro.membro": "Membre Ippon Pro",
  "pro.membroMax": "Membre Pro Max",
  "pro.serMax": "Passe en Pro Max",
  "pro.passarMax": "Passer en Pro Max",
  "pro.rever": "Revoir ce que {plano} m'apporte",
  "pro.comunidade": "Communauté Pro Max",
  "pro.comunidadeSub":
    "Groupe WhatsApp : actualités, journées et discussions de judo. L'entrée est validée par un administrateur.",

  "precos.porMes": "/mois",
  "precos.notaMoeda": "Facturé dans ta monnaie locale, au taux du jour.",
  "precos.contratar": "Souscrire {plano}",
  "precos.aAbrir": "Ouverture…",

  "faixa.atual": "Ceinture actuelle",
  "faixa.subiste": "Tu es passé à la ceinture {faixa} !",
  "faixa.desceste": "Tu es redescendu à la ceinture {faixa}. Reprends-la à la prochaine journée.",

  "perfil.titulo": "Profil",
  "perfil.lingua": "Langue",
  "perfil.assinatura": "Mon abonnement",
  "perfil.seguranca": "Sécurité",
  "perfil.alterarSenha": "Changer le mot de passe",
  "perfil.notificacoes": "Notifications",
  "perfil.sair": "Se déconnecter",
};

const DICIONARIOS: Record<Lingua, Dicionario> = { pt: PT, en: EN, es: ES, fr: FR };

// ---------------------------------------------------------------------------
// QUE LÍNGUA MOSTRAR
//
// 1. A que a pessoa escolheu (guardada na conta e em cache local)
// 2. A do browser, se for uma das que temos
// 3. Português
//
// A escolha guarda-se no `user_metadata`, como os tutoriais: é uma preferência,
// sobrevive a logins e a troca de telemóvel. (O NÍVEL de subscrição é que nunca
// vem de lá.)
// ---------------------------------------------------------------------------

export function linguaDoBrowser(): Lingua {
  try {
    const bruto = (navigator.language || "pt").slice(0, 2).toLowerCase();
    // pt-BR e pt-PT partilham dicionário: as diferenças de vocabulário do jogo
    // são poucas e o judo fala a mesma língua nos dois lados.
    if (bruto === "en" || bruto === "es" || bruto === "fr" || bruto === "pt") return bruto as Lingua;
  } catch {
    /* servidor, ou browser sem navigator */
  }
  return "pt";
}

export function linguaGuardadaLocal(): Lingua | null {
  try {
    const l = localStorage.getItem(CHAVE_LOCAL);
    if (l === "pt" || l === "en" || l === "es" || l === "fr") return l;
  } catch {}
  return null;
}

export async function gravarLingua(l: Lingua): Promise<void> {
  try { localStorage.setItem(CHAVE_LOCAL, l); } catch {}
  try {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return; // visitante: fica só a cache local
    await supabase.auth.updateUser({ data: { lingua: l } });
  } catch {}
}

async function linguaDaConta(): Promise<Lingua | null> {
  try {
    const { data } = await supabase.auth.getSession();
    const meta = data.session?.user?.user_metadata as { lingua?: string } | undefined;
    const l = meta?.lingua;
    if (l === "pt" || l === "en" || l === "es" || l === "fr") return l;
  } catch {}
  return null;
}

// ---------------------------------------------------------------------------

interface Contexto {
  lingua: Lingua;
  mudar: (l: Lingua) => void;
  t: (chave: string, vars?: Record<string, string | number>) => string;
}

const LinguaContexto = createContext<Contexto | null>(null);

/** Substitui {var} pelos valores dados. */
function preencher(texto: string, vars?: Record<string, string | number>): string {
  if (!vars) return texto;
  let out = texto;
  for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v));
  return out;
}

export function traduzir(lingua: Lingua, chave: string, vars?: Record<string, string | number>): string {
  // Recurso ao português quando falta tradução — nunca à chave crua.
  const texto = DICIONARIOS[lingua][chave] ?? PT[chave] ?? chave;
  return preencher(texto, vars);
}

export function LinguaProvider({ children }: { children: ReactNode }) {
  // Arranca em português no servidor e no primeiro render, para o HTML do
  // servidor e o do cliente coincidirem. A língua real entra logo a seguir.
  const [lingua, setLingua] = useState<Lingua>("pt");

  useEffect(() => {
    let vivo = true;
    const local = linguaGuardadaLocal();
    if (local) setLingua(local);
    else setLingua(linguaDoBrowser());

    // A conta tem a última palavra: é o que segue a pessoa entre aparelhos.
    linguaDaConta().then((l) => {
      if (vivo && l) {
        setLingua(l);
        try { localStorage.setItem(CHAVE_LOCAL, l); } catch {}
      }
    });
    return () => { vivo = false; };
  }, []);

  function mudar(l: Lingua) {
    setLingua(l);
    void gravarLingua(l);
  }

  const valor: Contexto = {
    lingua,
    mudar,
    t: (chave, vars) => traduzir(lingua, chave, vars),
  };

  return createElement(LinguaContexto.Provider, { value: valor }, children);
}

/** O hook do dia a dia: `const t = useT();` */
export function useT(): (chave: string, vars?: Record<string, string | number>) => string {
  const ctx = useContext(LinguaContexto);
  // Sem provider (um componente isolado, um teste), devolve português em vez de
  // rebentar. Um ecrã em português é melhor do que um ecrã em branco.
  if (!ctx) return (chave, vars) => traduzir("pt", chave, vars);
  return ctx.t;
}

/** Para o seletor de idioma no perfil. */
export function useLingua(): { lingua: Lingua; mudar: (l: Lingua) => void } {
  const ctx = useContext(LinguaContexto);
  if (!ctx) return { lingua: "pt", mudar: () => {} };
  return { lingua: ctx.lingua, mudar: ctx.mudar };
}
