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

export type Lingua = "pt" | "en" | "es" | "fr" | "de";

export const LINGUAS: { id: Lingua; nome: string; bandeira: string }[] = [
  { id: "pt", nome: "Português", bandeira: "🇵🇹" },
  { id: "en", nome: "English", bandeira: "🇬🇧" },
  { id: "es", nome: "Español", bandeira: "🇪🇸" },
  { id: "fr", nome: "Français", bandeira: "🇫🇷" },
  { id: "de", nome: "Deutsch", bandeira: "🇩🇪" },
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
  "entrar.dojo": "Entrar no dojo",
  "entrar.slogan": "O jogo oficial dos fãs de judô",
  "entrar.placeholderEmail": "tu@email.com",
  "entrar.preencher": "Preenche o email e a senha.",
  "entrar.esconderSenha": "Esconder senha",
  "entrar.aProcessar": "A processar…",
  "entrar.simCorrigir": "Sim, corrigir",
  "entrar.servidor": "A ligação ao servidor não está configurada. Tenta mais tarde.",
  "entrar.naoConfirmado": "Ainda não confirmaste o email. Verifica a tua caixa de entrada.",
  "entrar.falhou": "Não foi possível entrar. Tenta novamente.",
  "entrar.recEscreveEmail": "Escreve o teu email primeiro, para te enviarmos o link de recuperação.",
  "entrar.recFalhou": "Não foi possível enviar o link. Tenta novamente.",
  "entrar.recEnviado": "Enviámos um link para {email}. Abre-o para definires uma nova senha.",

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
  "comecar.beta": "Beta",
  "comecar.entrarAgora": "Entrar agora",
  "comecar.phEmail": "email@exemplo.com",
  "comecar.entraNoJogo": "Entra no jogo",
  "comecar.sub": "Cria a tua conta para montares a equipa e disputares com fãs de judô do mundo todo.",
  "comecar.phNome": "O teu nome",
  "comecar.phSenha": "Mínimo 6 caracteres",
  "comecar.phTelemovel": "Número de telemóvel",
  "comecar.contacto": "Contacto (opcional)",
  "comecar.selecionaFaixa": "Seleciona a tua faixa",
  "comecar.selecionaPais": "Seleciona o teu país",
  "comecar.procurar": "Procurar…",
  "comecar.procurarPais": "Procurar país…",
  "comecar.semResultados": "Sem resultados",
  "comecar.comecarJogar": "Começar a jogar",
  "comecar.jaTens": "Já tens conta?",
  "comecar.entrar": "Entrar",
  "comecar.novidades": "Ao continuar, aceitas receber novidades da Ippon League.",
  "comecar.temCerteza": "Tens a certeza de que é {email}?",
  "comecar.naoCorrigir": "Não, corrigir para {sugestao}",
  "comecar.seEstiverCerto": "Se estiver certo, carrega outra vez em criar conta.",
  "decl.titulo": "Confirma os teus dados",
  "decl.corpo": "Declaras que todas as informações fornecidas, incluindo a tua {dataNasc}, são {verdadeiras}.",
  "decl.dataNasc": "data de nascimento",
  "decl.verdadeiras": "verdadeiras e corretas",
  "decl.aviso": "Informações falsas podem levar ao encerramento da conta. Ao confirmar, aceitas os",
  "decl.termos": "Termos de Utilização",
  "decl.e": "e a",
  "decl.privacidade": "Política de Privacidade",
  "decl.confirmar": "Confirmar e criar conta",
  "decl.aCriarConta": "A criar conta…",
  "decl.voltarRever": "Voltar e rever",

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

  // --- início ---
  "inicio.entrarParaJogar": "Entrar para jogar",
  "inicio.criarEquipa": "Cria a tua equipa",
  "inicio.criarEquipaSub": "Monta 8 atletas com 100 Judocoins e escolhe o teu capitão.",
  "inicio.criarEquipaBtn": "Criar a minha equipa",
  "inicio.minhaEquipa": "A minha equipa",
  "inicio.verEquipa": "Ver a minha equipa",
  "inicio.escalar": "Escalar",
  "inicio.ultima": "Última",
  "inicio.valor": "Valor",
  "inicio.campeao": "Campeão",
  "inicio.meusResumos": "Os meus resumos",
  "inicio.meusResumosSub": "Revê e partilha cada rodada",
  "inicio.centralMax": "A tua central Pro Max",
  "inicio.centralMaxSub": "Scout, personalização e as tuas vantagens no máximo",
  "inicio.centralPro": "A tua central Pro",
  "inicio.centralProSub": "Análise do teu time e as tuas vantagens",
  "inicio.abrir": "Abrir",
  "inicio.assinar": "Assinar",
  "inicio.proSub": "Joga com vantagem competitiva",
  "inicio.aoVivo": "Ao vivo agora",
  "inicio.aoVivoSub": "Acompanha o chaveamento ao vivo",
  "inicio.tuasLigas": "As tuas ligas",
  "inicio.verTodas": "Ver todas ›",
  "inicio.aCarregarLigas": "A carregar as tuas ligas…",
  "inicio.confirmaEmail": "Confirma o teu email",
  "inicio.competicaoAtual": "Competição atual",
  "inicio.proximaCompeticao": "Próxima competição",
  "inicio.classicoAtual": "Clássico atual",
  "inicio.proximoClassico": "Próximo clássico",
  "inicio.entraPrimeiro": "Entra na tua conta primeiro.",
  "inicio.jaConfirmado": "Já está confirmado!",
  "inicio.acabamosEnviar": "Acabámos de enviar.",
  "inicio.naoEnviouAgora": "Não conseguimos enviar agora. Tenta daqui a pouco.",
  "inicio.enviado": "Enviado! Vê a tua caixa de entrada (e o spam).",
  "inicio.naoEnviou": "Não conseguimos enviar agora.",
  "inicio.ofertaLancamento": "Oferta de lançamento",
  "inicio.sejaProAgora": "Seja Ippon Pro agora",
  "inicio.saberMais": "Saber mais",
  "inicio.continuarSemPagar": "Continuar sem pagar",
  "inicio.pularTutorial": "Pular tutorial ✕",
  "inicio.vamos": "Vamos!",

  // tutorial de boas-vindas do início
  "tut.intro": "Vou mostrar-te o essencial em 1 minuto. Avança quando quiseres — ou pula.",
  "tut.comoFunciona": "Como funciona",
  "tut.montaEquipaSub": "100 Judocoins, 8 atletas e 1 capitão (pontua a dobrar). É por aqui que começas.",
  "inicio.tocaProSub": "Toca aqui para teres o Ippon Pro: scout avançado, análise do teu time e dica de capitão. {preco}.",
  "tut.montaEquipa": "Monta a tua equipa",
  "tut.pontuaAcoes": "Pontua pelas ações",
  "tut.pontuaAcoesSub": "Ippon +10, waza-ari +4, shido a favor +1. Acompanhas tudo ao vivo no início.",
  "tut.competicoes": "Competições e ligas",
  "tut.competicoesSub": "Cada Grand Slam ou Mundial é uma rodada. Dispute ligas mundial, nacional e de amigos.",
  "tut.sobeFaixa": "Sobe de faixa",
  "tut.sobeFaixaSub": "O teu desempenho mensal muda a tua faixa — e o visual do jogo. Boa sorte!",

  // vantagens do Pro, no cartão de venda
  "vant.scout": "Scout avançado: histórico de cada atleta",
  "vant.analise": "Análise do teu time e dica de capitão",
  "vant.valorizacao": "Maior possibilidade de valorização, pela análise",
  "vant.aoVivo": "Acompanhamento ao vivo no dia da competição",
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
  "entrar.dojo": "Enter the dojo",
  "entrar.slogan": "The official game for judo fans",
  "entrar.placeholderEmail": "you@email.com",
  "entrar.preencher": "Fill in your email and password.",
  "entrar.esconderSenha": "Hide password",
  "entrar.aProcessar": "Working…",
  "entrar.simCorrigir": "Yes, fix it",
  "entrar.servidor": "The server connection isn't set up. Please try later.",
  "entrar.naoConfirmado": "You haven't confirmed your email yet. Check your inbox.",
  "entrar.falhou": "We couldn't sign you in. Please try again.",
  "entrar.recEscreveEmail": "Type your email first, so we can send you the reset link.",
  "entrar.recFalhou": "We couldn't send the link. Please try again.",
  "entrar.recEnviado": "We sent a link to {email}. Open it to set a new password.",

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

  "comecar.beta": "Beta",
  "comecar.entrarAgora": "Sign in now",
  "comecar.phEmail": "email@example.com",
  "comecar.entraNoJogo": "Get in the game",
  "comecar.sub": "Create your account to build your team and compete with judo fans from all over the world.",
  "comecar.phNome": "Your name",
  "comecar.phSenha": "At least 6 characters",
  "comecar.phTelemovel": "Phone number",
  "comecar.contacto": "Phone (optional)",
  "comecar.selecionaFaixa": "Choose your belt",
  "comecar.selecionaPais": "Choose your country",
  "comecar.procurar": "Search…",
  "comecar.procurarPais": "Search country…",
  "comecar.semResultados": "No results",
  "comecar.comecarJogar": "Start playing",
  "comecar.jaTens": "Already have an account?",
  "comecar.entrar": "Sign in",
  "comecar.novidades": "By continuing, you agree to receive news from Ippon League.",
  "comecar.temCerteza": "Are you sure it's {email}?",
  "comecar.naoCorrigir": "No, change it to {sugestao}",
  "comecar.seEstiverCerto": "If it's right, tap create account again.",
  "decl.titulo": "Confirm your details",
  "decl.corpo": "You declare that all the information provided, including your {dataNasc}, is {verdadeiras}.",
  "decl.dataNasc": "date of birth",
  "decl.verdadeiras": "true and correct",
  "decl.aviso": "False information may lead to your account being closed. By confirming, you accept the",
  "decl.termos": "Terms of Use",
  "decl.e": "and the",
  "decl.privacidade": "Privacy Policy",
  "decl.confirmar": "Confirm and create account",
  "decl.aCriarConta": "Creating account…",
  "decl.voltarRever": "Go back and review",

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

  // --- home ---
  "inicio.entrarParaJogar": "Sign in to play",
  "inicio.criarEquipa": "Build your team",
  "inicio.criarEquipaSub": "Pick 8 athletes with 100 Judocoins and choose your captain.",
  "inicio.criarEquipaBtn": "Build my team",
  "inicio.minhaEquipa": "My team",
  "inicio.verEquipa": "View my team",
  "inicio.escalar": "Pick team",
  "inicio.ultima": "Last",
  "inicio.valor": "Value",
  "inicio.campeao": "Champion",
  "inicio.meusResumos": "My round cards",
  "inicio.meusResumosSub": "Look back and share every round",
  "inicio.centralMax": "Your Pro Max hub",
  "inicio.centralMaxSub": "Scout, personalisation and all your perks at full",
  "inicio.centralPro": "Your Pro hub",
  "inicio.centralProSub": "Your team analysis and your perks",
  "inicio.abrir": "Open",
  "inicio.assinar": "Subscribe",
  "inicio.proSub": "Play with a competitive edge",
  "inicio.aoVivo": "Live now",
  "inicio.aoVivoSub": "Follow the bracket live",
  "inicio.tuasLigas": "Your leagues",
  "inicio.verTodas": "See all ›",
  "inicio.aCarregarLigas": "Loading your leagues…",
  "inicio.confirmaEmail": "Confirm your email",
  "inicio.competicaoAtual": "Current competition",
  "inicio.proximaCompeticao": "Next competition",
  "inicio.classicoAtual": "Current classic",
  "inicio.proximoClassico": "Next classic",
  "inicio.entraPrimeiro": "Sign in to your account first.",
  "inicio.jaConfirmado": "Already confirmed!",
  "inicio.acabamosEnviar": "Just sent.",
  "inicio.naoEnviouAgora": "We couldn't send it now. Try again shortly.",
  "inicio.enviado": "Sent! Check your inbox (and spam).",
  "inicio.naoEnviou": "We couldn't send it now.",
  "inicio.ofertaLancamento": "Launch offer",
  "inicio.sejaProAgora": "Go Ippon Pro now",
  "inicio.saberMais": "Learn more",
  "inicio.continuarSemPagar": "Continue for free",
  "inicio.pularTutorial": "Skip tutorial ✕",
  "inicio.vamos": "Let's go!",

  "tut.intro": "I'll show you the essentials in 1 minute. Move on whenever you like — or skip.",
  "tut.comoFunciona": "How it works",
  "tut.montaEquipaSub": "100 Judocoins, 8 athletes and 1 captain (double points). This is where you start.",
  "inicio.tocaProSub": "Tap here to get Ippon Pro: advanced scout, team analysis and captain tip. {preco}.",
  "tut.montaEquipa": "Build your team",
  "tut.pontuaAcoes": "Score through actions",
  "tut.pontuaAcoesSub": "Ippon +10, waza-ari +4, shido in your favour +1. Follow it all live on the home screen.",
  "tut.competicoes": "Competitions and leagues",
  "tut.competicoesSub": "Every Grand Slam or Worlds is a round. Play world, national and friends' leagues.",
  "tut.sobeFaixa": "Move up a belt",
  "tut.sobeFaixaSub": "Your monthly performance changes your belt — and how the game looks. Good luck!",

  "vant.scout": "Advanced scout: every athlete's history",
  "vant.analise": "Your team analysis and captain tip",
  "vant.valorizacao": "Better odds of gaining value, through the analysis",
  "vant.aoVivo": "Live tracking on competition day",
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
  "entrar.dojo": "Entrar en el dojo",
  "entrar.slogan": "El juego oficial de los aficionados al judo",
  "entrar.placeholderEmail": "tu@correo.com",
  "entrar.preencher": "Rellena el correo y la contraseña.",
  "entrar.esconderSenha": "Ocultar contraseña",
  "entrar.aProcessar": "Procesando…",
  "entrar.simCorrigir": "Sí, corregir",
  "entrar.servidor": "La conexión al servidor no está configurada. Inténtalo más tarde.",
  "entrar.naoConfirmado": "Todavía no has confirmado el correo. Revisa tu bandeja de entrada.",
  "entrar.falhou": "No pudimos iniciar sesión. Inténtalo de nuevo.",
  "entrar.recEscreveEmail": "Escribe tu correo primero para enviarte el enlace de recuperación.",
  "entrar.recFalhou": "No pudimos enviar el enlace. Inténtalo de nuevo.",
  "entrar.recEnviado": "Enviamos un enlace a {email}. Ábrelo para crear una contraseña nueva.",

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

  "comecar.beta": "Beta",
  "comecar.entrarAgora": "Iniciar sesión ahora",
  "comecar.phEmail": "correo@ejemplo.com",
  "comecar.entraNoJogo": "Entra en el juego",
  "comecar.sub": "Crea tu cuenta para montar tu equipo y competir con aficionados al judo de todo el mundo.",
  "comecar.phNome": "Tu nombre",
  "comecar.phSenha": "Mínimo 6 caracteres",
  "comecar.phTelemovel": "Número de móvil",
  "comecar.contacto": "Contacto (opcional)",
  "comecar.selecionaFaixa": "Elige tu cinturón",
  "comecar.selecionaPais": "Elige tu país",
  "comecar.procurar": "Buscar…",
  "comecar.procurarPais": "Buscar país…",
  "comecar.semResultados": "Sin resultados",
  "comecar.comecarJogar": "Empezar a jugar",
  "comecar.jaTens": "¿Ya tienes cuenta?",
  "comecar.entrar": "Iniciar sesión",
  "comecar.novidades": "Al continuar, aceptas recibir novedades de Ippon League.",
  "comecar.temCerteza": "¿Seguro que es {email}?",
  "comecar.naoCorrigir": "No, corregir a {sugestao}",
  "comecar.seEstiverCerto": "Si es correcto, pulsa otra vez en crear cuenta.",
  "decl.titulo": "Confirma tus datos",
  "decl.corpo": "Declaras que toda la información facilitada, incluida tu {dataNasc}, es {verdadeiras}.",
  "decl.dataNasc": "fecha de nacimiento",
  "decl.verdadeiras": "verdadera y correcta",
  "decl.aviso": "La información falsa puede provocar el cierre de la cuenta. Al confirmar, aceptas los",
  "decl.termos": "Términos de Uso",
  "decl.e": "y la",
  "decl.privacidade": "Política de Privacidad",
  "decl.confirmar": "Confirmar y crear cuenta",
  "decl.aCriarConta": "Creando cuenta…",
  "decl.voltarRever": "Volver y revisar",

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

  // --- inicio ---
  "inicio.entrarParaJogar": "Entrar para jugar",
  "inicio.criarEquipa": "Crea tu equipo",
  "inicio.criarEquipaSub": "Elige 8 atletas con 100 Judocoins y escoge tu capitán.",
  "inicio.criarEquipaBtn": "Crear mi equipo",
  "inicio.minhaEquipa": "Mi equipo",
  "inicio.verEquipa": "Ver mi equipo",
  "inicio.escalar": "Alinear",
  "inicio.ultima": "Última",
  "inicio.valor": "Valor",
  "inicio.campeao": "Campeón",
  "inicio.meusResumos": "Mis resúmenes",
  "inicio.meusResumosSub": "Repasa y comparte cada jornada",
  "inicio.centralMax": "Tu central Pro Max",
  "inicio.centralMaxSub": "Scout, personalización y todas tus ventajas al máximo",
  "inicio.centralPro": "Tu central Pro",
  "inicio.centralProSub": "Análisis de tu equipo y tus ventajas",
  "inicio.abrir": "Abrir",
  "inicio.assinar": "Suscribirse",
  "inicio.proSub": "Juega con ventaja competitiva",
  "inicio.aoVivo": "En directo ahora",
  "inicio.aoVivoSub": "Sigue el cuadro en directo",
  "inicio.tuasLigas": "Tus ligas",
  "inicio.verTodas": "Ver todas ›",
  "inicio.aCarregarLigas": "Cargando tus ligas…",
  "inicio.confirmaEmail": "Confirma tu correo",
  "inicio.competicaoAtual": "Competición actual",
  "inicio.proximaCompeticao": "Próxima competición",
  "inicio.classicoAtual": "Clásico actual",
  "inicio.proximoClassico": "Próximo clásico",
  "inicio.entraPrimeiro": "Entra en tu cuenta primero.",
  "inicio.jaConfirmado": "¡Ya está confirmado!",
  "inicio.acabamosEnviar": "Acabamos de enviarlo.",
  "inicio.naoEnviouAgora": "No pudimos enviarlo ahora. Inténtalo en un momento.",
  "inicio.enviado": "¡Enviado! Revisa tu bandeja de entrada (y el spam).",
  "inicio.naoEnviou": "No pudimos enviarlo ahora.",
  "inicio.ofertaLancamento": "Oferta de lanzamiento",
  "inicio.sejaProAgora": "Hazte Ippon Pro ahora",
  "inicio.saberMais": "Saber más",
  "inicio.continuarSemPagar": "Seguir sin pagar",
  "inicio.pularTutorial": "Saltar tutorial ✕",
  "inicio.vamos": "¡Vamos!",

  "tut.intro": "Te enseño lo esencial en 1 minuto. Avanza cuando quieras — o sáltalo.",
  "tut.comoFunciona": "Cómo funciona",
  "tut.montaEquipaSub": "100 Judocoins, 8 atletas y 1 capitán (puntúa doble). Aquí es donde empiezas.",
  "inicio.tocaProSub": "Toca aquí para tener Ippon Pro: scout avanzado, análisis de tu equipo y consejo de capitán. {preco}.",
  "tut.montaEquipa": "Monta tu equipo",
  "tut.pontuaAcoes": "Puntúa por las acciones",
  "tut.pontuaAcoesSub": "Ippon +10, waza-ari +4, shido a favor +1. Lo sigues todo en directo en el inicio.",
  "tut.competicoes": "Competiciones y ligas",
  "tut.competicoesSub": "Cada Grand Slam o Mundial es una jornada. Compite en ligas mundial, nacional y de amigos.",
  "tut.sobeFaixa": "Sube de cinturón",
  "tut.sobeFaixaSub": "Tu rendimiento mensual cambia tu cinturón — y el aspecto del juego. ¡Suerte!",

  "vant.scout": "Scout avanzado: historial de cada atleta",
  "vant.analise": "Análisis de tu equipo y consejo de capitán",
  "vant.valorizacao": "Más posibilidades de revalorización, gracias al análisis",
  "vant.aoVivo": "Seguimiento en directo el día de la competición",
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
  "entrar.dojo": "Entrer dans le dojo",
  "entrar.slogan": "Le jeu officiel des fans de judo",
  "entrar.placeholderEmail": "toi@email.com",
  "entrar.preencher": "Renseigne ton e-mail et ton mot de passe.",
  "entrar.esconderSenha": "Masquer le mot de passe",
  "entrar.aProcessar": "Traitement…",
  "entrar.simCorrigir": "Oui, corriger",
  "entrar.servidor": "La connexion au serveur n'est pas configurée. Réessaie plus tard.",
  "entrar.naoConfirmado": "Tu n'as pas encore confirmé ton e-mail. Vérifie ta boîte de réception.",
  "entrar.falhou": "Connexion impossible. Réessaie.",
  "entrar.recEscreveEmail": "Écris d'abord ton e-mail, pour qu'on t'envoie le lien de récupération.",
  "entrar.recFalhou": "Impossible d'envoyer le lien. Réessaie.",
  "entrar.recEnviado": "Nous avons envoyé un lien à {email}. Ouvre-le pour définir un nouveau mot de passe.",

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

  "comecar.beta": "Bêta",
  "comecar.entrarAgora": "Se connecter",
  "comecar.phEmail": "email@exemple.com",
  "comecar.entraNoJogo": "Entre dans le jeu",
  "comecar.sub": "Crée ton compte pour composer ton équipe et affronter des fans de judo du monde entier.",
  "comecar.phNome": "Ton nom",
  "comecar.phSenha": "6 caractères minimum",
  "comecar.phTelemovel": "Numéro de téléphone",
  "comecar.contacto": "Contact (facultatif)",
  "comecar.selecionaFaixa": "Choisis ta ceinture",
  "comecar.selecionaPais": "Choisis ton pays",
  "comecar.procurar": "Rechercher…",
  "comecar.procurarPais": "Rechercher un pays…",
  "comecar.semResultados": "Aucun résultat",
  "comecar.comecarJogar": "Commencer à jouer",
  "comecar.jaTens": "Tu as déjà un compte ?",
  "comecar.entrar": "Se connecter",
  "comecar.novidades": "En continuant, tu acceptes de recevoir les actualités d'Ippon League.",
  "comecar.temCerteza": "Tu es sûr que c'est {email} ?",
  "comecar.naoCorrigir": "Non, corriger en {sugestao}",
  "comecar.seEstiverCerto": "Si c'est correct, appuie à nouveau sur créer un compte.",
  "decl.titulo": "Confirme tes informations",
  "decl.corpo": "Tu déclares que toutes les informations fournies, y compris ta {dataNasc}, sont {verdadeiras}.",
  "decl.dataNasc": "date de naissance",
  "decl.verdadeiras": "véridiques et exactes",
  "decl.aviso": "De fausses informations peuvent entraîner la fermeture du compte. En confirmant, tu acceptes les",
  "decl.termos": "Conditions d'utilisation",
  "decl.e": "et la",
  "decl.privacidade": "Politique de confidentialité",
  "decl.confirmar": "Confirmer et créer le compte",
  "decl.aCriarConta": "Création du compte…",
  "decl.voltarRever": "Revenir et vérifier",

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

  // --- accueil ---
  "inicio.entrarParaJogar": "Se connecter pour jouer",
  "inicio.criarEquipa": "Compose ton équipe",
  "inicio.criarEquipaSub": "Choisis 8 athlètes avec 100 Judocoins et désigne ton capitaine.",
  "inicio.criarEquipaBtn": "Composer mon équipe",
  "inicio.minhaEquipa": "Mon équipe",
  "inicio.verEquipa": "Voir mon équipe",
  "inicio.escalar": "Composer",
  "inicio.ultima": "Dernière",
  "inicio.valor": "Valeur",
  "inicio.campeao": "Champion",
  "inicio.meusResumos": "Mes résumés",
  "inicio.meusResumosSub": "Revois et partage chaque journée",
  "inicio.centralMax": "Ton espace Pro Max",
  "inicio.centralMaxSub": "Scout, personnalisation et tous tes avantages au maximum",
  "inicio.centralPro": "Ton espace Pro",
  "inicio.centralProSub": "L'analyse de ton équipe et tes avantages",
  "inicio.abrir": "Ouvrir",
  "inicio.assinar": "S'abonner",
  "inicio.proSub": "Joue avec un avantage",
  "inicio.aoVivo": "En direct",
  "inicio.aoVivoSub": "Suis le tableau en direct",
  "inicio.tuasLigas": "Tes ligues",
  "inicio.verTodas": "Voir tout ›",
  "inicio.aCarregarLigas": "Chargement de tes ligues…",
  "inicio.confirmaEmail": "Confirme ton e-mail",
  "inicio.competicaoAtual": "Compétition en cours",
  "inicio.proximaCompeticao": "Prochaine compétition",
  "inicio.classicoAtual": "Classique en cours",
  "inicio.proximoClassico": "Prochain classique",
  "inicio.entraPrimeiro": "Connecte-toi d'abord à ton compte.",
  "inicio.jaConfirmado": "Déjà confirmé !",
  "inicio.acabamosEnviar": "Nous venons de l'envoyer.",
  "inicio.naoEnviouAgora": "Envoi impossible pour l'instant. Réessaie dans un moment.",
  "inicio.enviado": "Envoyé ! Regarde ta boîte de réception (et les indésirables).",
  "inicio.naoEnviou": "Envoi impossible pour l'instant.",
  "inicio.ofertaLancamento": "Offre de lancement",
  "inicio.sejaProAgora": "Passe à Ippon Pro",
  "inicio.saberMais": "En savoir plus",
  "inicio.continuarSemPagar": "Continuer sans payer",
  "inicio.pularTutorial": "Passer le tutoriel ✕",
  "inicio.vamos": "C'est parti !",

  "tut.intro": "Je te montre l'essentiel en 1 minute. Avance quand tu veux — ou passe.",
  "tut.comoFunciona": "Comment ça marche",
  "tut.montaEquipaSub": "100 Judocoins, 8 athlètes et 1 capitaine (points doublés). C'est par là que tu commences.",
  "inicio.tocaProSub": "Appuie ici pour avoir Ippon Pro : scout avancé, analyse de ton équipe et conseil de capitaine. {preco}.",
  "tut.montaEquipa": "Compose ton équipe",
  "tut.pontuaAcoes": "Marque par les actions",
  "tut.pontuaAcoesSub": "Ippon +10, waza-ari +4, shido en ta faveur +1. Tu suis tout en direct depuis l'accueil.",
  "tut.competicoes": "Compétitions et ligues",
  "tut.competicoesSub": "Chaque Grand Slam ou Mondial est une journée. Joue les ligues mondiale, nationale et entre amis.",
  "tut.sobeFaixa": "Monte en ceinture",
  "tut.sobeFaixaSub": "Tes résultats du mois changent ta ceinture — et l'allure du jeu. Bonne chance !",

  "vant.scout": "Scout avancé : l'historique de chaque athlète",
  "vant.analise": "L'analyse de ton équipe et le conseil de capitaine",
  "vant.valorizacao": "Plus de chances de prendre de la valeur, grâce à l'analyse",
  "vant.aoVivo": "Suivi en direct le jour de la compétition",
};

const DE: Dicionario = {

  // --- comum ---
  "comum.voltar": "Zurück",
  "comum.continuar": "Weiter",
  "comum.seguinte": "Weiter",
  "comum.anterior": "Zurück",
  "comum.cancelar": "Abbrechen",
  "comum.guardar": "Speichern",
  "comum.fechar": "Schließen",
  "comum.confirmar": "Bestätigen",
  "comum.carregando": "Wird geladen…",
  "comum.erro": "Etwas ist schiefgelaufen. Bitte versuche es erneut.",
  "comum.pular": "Überspringen",
  "comum.naoMostrarMais": "Nicht mehr anzeigen",
  "comum.verMais": "Mehr anzeigen",
  "comum.de": "von",
  "comum.pontos": "Punkte",
  "comum.pts": "Pkt",

  // --- entrar / registo ---
  "entrar.titulo": "Anmelden",
  "entrar.email": "E-Mail",
  "entrar.senha": "Passwort",
  "entrar.mostrarSenha": "Passwort anzeigen",
  "entrar.esqueci": "Passwort vergessen?",
  "entrar.semConta": "Noch kein Konto?",
  "entrar.criarConta": "Konto erstellen",
  "entrar.aEntrar": "Anmeldung…",
  "entrar.credenciaisErradas": "E-Mail oder Passwort falsch.",
  "entrar.dojo": "Betritt das Dojo",
  "entrar.slogan": "Das offizielle Spiel für Judo-Fans",
  "entrar.placeholderEmail": "du@email.com",
  "entrar.preencher": "Gib E-Mail und Passwort ein.",
  "entrar.esconderSenha": "Passwort verbergen",
  "entrar.aProcessar": "Wird verarbeitet…",
  "entrar.simCorrigir": "Ja, korrigieren",
  "entrar.servidor": "Die Serververbindung ist nicht eingerichtet. Bitte später versuchen.",
  "entrar.naoConfirmado": "Du hast deine E-Mail noch nicht bestätigt. Sieh in deinem Postfach nach.",
  "entrar.falhou": "Anmeldung nicht möglich. Bitte versuche es erneut.",
  "entrar.recEscreveEmail": "Gib zuerst deine E-Mail ein, damit wir dir den Link schicken können.",
  "entrar.recFalhou": "Der Link konnte nicht gesendet werden. Bitte versuche es erneut.",
  "entrar.recEnviado": "Wir haben einen Link an {email} geschickt. Öffne ihn, um ein neues Passwort zu setzen.",

  "comecar.titulo": "Erstelle dein Konto",
  "comecar.nome": "Name",
  "comecar.dataNasc": "Geburtsdatum",
  "comecar.telefone": "Telefon (optional)",
  "comecar.faixa": "Dein Gürtel",
  "comecar.pais": "Dein Land",
  "comecar.semFaixa": "Ich habe noch keinen Gürtel",
  "comecar.criar": "Konto erstellen",
  "comecar.aCriar": "Wird erstellt…",
  "comecar.jaTenhoConta": "Ich habe schon ein Konto",
  "comecar.contaCriada": "Konto erstellt!",
  "comecar.podesEntrar": "Du kannst dich anmelden und dein Team aufstellen.",
  "comecar.emailConfirmacao": "Wir schicken eine E-Mail an {email}, damit du deine Adresse bestätigen kannst. Du musst nicht warten — bestätige aber, sobald du kannst, um keine Runden-Hinweise zu verpassen.",

  // erros do formulário
  "comecar.beta": "Beta",
  "comecar.entrarAgora": "Jetzt anmelden",
  "comecar.phEmail": "email@beispiel.com",
  "comecar.entraNoJogo": "Steig ins Spiel ein",
  "comecar.sub": "Erstelle dein Konto, stelle dein Team auf und miss dich mit Judo-Fans aus aller Welt.",
  "comecar.phNome": "Dein Name",
  "comecar.phSenha": "Mindestens 6 Zeichen",
  "comecar.phTelemovel": "Handynummer",
  "comecar.contacto": "Kontakt (optional)",
  "comecar.selecionaFaixa": "Wähle deinen Gürtel",
  "comecar.selecionaPais": "Wähle dein Land",
  "comecar.procurar": "Suchen…",
  "comecar.procurarPais": "Land suchen…",
  "comecar.semResultados": "Keine Ergebnisse",
  "comecar.comecarJogar": "Losspielen",
  "comecar.jaTens": "Hast du schon ein Konto?",
  "comecar.entrar": "Anmelden",
  "comecar.novidades": "Wenn du fortfährst, erklärst du dich damit einverstanden, Neuigkeiten von Ippon League zu erhalten.",
  "comecar.temCerteza": "Bist du sicher, dass es {email} ist?",
  "comecar.naoCorrigir": "Nein, ändern in {sugestao}",
  "comecar.seEstiverCerto": "Wenn es stimmt, tippe erneut auf Konto erstellen.",
  "decl.titulo": "Bestätige deine Angaben",
  "decl.corpo": "Du erklärst, dass alle angegebenen Informationen, einschließlich deines {dataNasc}, {verdadeiras} sind.",
  "decl.dataNasc": "Geburtsdatums",
  "decl.verdadeiras": "wahr und richtig",
  "decl.aviso": "Falsche Angaben können zur Schließung des Kontos führen. Mit der Bestätigung akzeptierst du die",
  "decl.termos": "Nutzungsbedingungen",
  "decl.e": "und die",
  "decl.privacidade": "Datenschutzerklärung",
  "decl.confirmar": "Bestätigen und Konto erstellen",
  "decl.aCriarConta": "Konto wird erstellt…",
  "decl.voltarRever": "Zurück und prüfen",

  "erro.nome": "Sag uns deinen Namen.",
  "erro.emailFalta": "Wir brauchen deine E-Mail.",
  "erro.emailInvalido": "Diese E-Mail sieht nicht gültig aus.",
  "erro.senhaFalta": "Erstelle ein Passwort.",
  "erro.senhaCurta": "Das Passwort braucht mindestens 6 Zeichen.",
  "erro.dataFalta": "Gib dein Geburtsdatum an.",
  "erro.dataFutura": "Dieses Datum kann nicht in der Zukunft liegen.",
  "erro.faixaFalta": "Wähle deinen Gürtel.",
  "erro.paisFalta": "Wähle dein Land.",
  "erro.emailExiste": "Es gibt bereits ein Konto mit dieser E-Mail. Versuche dich anzumelden.",
  "erro.senhaRecusada": "Dieses Passwort wurde nicht akzeptiert. Versuche ein anderes (mind. 6 Zeichen).",
  "erro.contaFalhou": "Das Konto konnte nicht erstellt werden. Bitte versuche es erneut.",

  // --- navegação ---
  "nav.inicio": "Start",
  "nav.competicoes": "Wettkämpfe",
  "nav.atletas": "Athleten",
  "nav.pro": "Pro",
  "nav.proNovidade": "{label} — neu",

  // --- equipa ---
  "equipa.meuTime": "Mein Team",
  "equipa.patrimonio": "Vermögen",
  "equipa.saldo": "Guthaben",
  "equipa.capitao": "Kapitän",
  "equipa.editar": "Team bearbeiten",
  "equipa.guardada": "Team gespeichert",
  "equipa.semEquipa": "Du hast für diesen Wettkampf noch kein Team gespeichert.",
  "equipa.rodadaADecorrer": "Die Runde läuft!",
  "equipa.valorEquipa": "Teamwert: JC {valor}",

  // --- mercado ---
  "mercado.titulo": "Markt",
  "mercado.aberto": "Markt offen",
  "mercado.fechado": "Markt geschlossen",
  "mercado.fechaEm": "Schließt in {tempo}",
  "mercado.procurar": "Athlet suchen",
  "mercado.comprar": "Kaufen",
  "mercado.vender": "Verkaufen",
  "mercado.semSaldo": "Nicht genug Guthaben für diesen Athleten.",

  // --- ligas ---
  "ligas.titulo": "Wettkämpfe",
  "ligas.minhasLigas": "Meine Ligen",
  "ligas.criarLiga": "Liga erstellen",
  "ligas.entrarComCodigo": "Mit Code beitreten",
  "ligas.mundial": "Weltliga",
  "ligas.continental": "Liga {continente}",
  "ligas.membros": "{n} Mitglieder",
  "ligas.escalou": "Team steht",
  "ligas.naoEscalou": "Noch kein Team",

  // --- chave ---
  "chave.principal": "Hauptturnierbaum",
  "chave.repescagem": "Trostrunde und Bronze",
  "chave.vazia": "Der Turnierbaum erscheint nach der Auslosung.",
  "chave.deslize": "wischen, um den ganzen Baum zu sehen",
  "chave.passou": "Freilos (kein Gegner)",
  "chave.aAguardar": "wartet",
  "chave.proximoConfronto": "Nächster Kampf",

  // --- pro ---
  "pro.central": "Meine Pro-Zentrale",
  "pro.centralMax": "Meine Pro-Max-Zentrale",
  "pro.membro": "Ippon-Pro-Mitglied",
  "pro.membroMax": "Pro-Max-Mitglied",
  "pro.serMax": "Werde Pro Max",
  "pro.passarMax": "Auf Pro Max upgraden",
  "pro.rever": "Ansehen, was mir {plano} bringt",
  "pro.comunidade": "Pro-Max-Community",
  "pro.comunidadeSub": "WhatsApp-Gruppe: Neuigkeiten, Runden und Judo-Gespräche. Der Beitritt wird von einem Admin freigegeben.",

  // --- preços ---
  "precos.porMes": "/Monat",
  "precos.notaMoeda": "Abrechnung in deiner Landeswährung, zum Tageskurs.",
  "precos.contratar": "{plano} holen",
  "precos.aAbrir": "Wird geöffnet…",

  // --- faixas (o NOME da faixa não se traduz; o rótulo sim) ---
  "faixa.atual": "Aktueller Gürtel",
  "faixa.subiste": "Du bist zum {faixa} Gürtel aufgestiegen!",
  "faixa.desceste": "Du bist zum {faixa} Gürtel abgestiegen. Hol ihn dir in der nächsten Runde zurück.",

  // --- perfil ---
  "perfil.titulo": "Profil",
  "perfil.lingua": "Sprache",
  "perfil.assinatura": "Mein Abo",
  "perfil.seguranca": "Sicherheit",
  "perfil.alterarSenha": "Passwort ändern",
  "perfil.notificacoes": "Benachrichtigungen",
  "perfil.sair": "Abmelden",

  // --- Start ---
  "inicio.entrarParaJogar": "Zum Spielen anmelden",
  "inicio.criarEquipa": "Stelle dein Team auf",
  "inicio.criarEquipaSub": "Wähle 8 Athleten mit 100 Judocoins und bestimme deinen Kapitän.",
  "inicio.criarEquipaBtn": "Mein Team aufstellen",
  "inicio.minhaEquipa": "Mein Team",
  "inicio.verEquipa": "Mein Team ansehen",
  "inicio.escalar": "Aufstellen",
  "inicio.ultima": "Letzte",
  "inicio.valor": "Wert",
  "inicio.campeao": "Champion",
  "inicio.meusResumos": "Meine Rundenkarten",
  "inicio.meusResumosSub": "Jede Runde nachlesen und teilen",
  "inicio.centralMax": "Deine Pro-Max-Zentrale",
  "inicio.centralMaxSub": "Scout, Personalisierung und alle Vorteile im Maximum",
  "inicio.centralPro": "Deine Pro-Zentrale",
  "inicio.centralProSub": "Die Analyse deines Teams und deine Vorteile",
  "inicio.abrir": "Öffnen",
  "inicio.assinar": "Abonnieren",
  "inicio.proSub": "Spiele mit einem Vorsprung",
  "inicio.aoVivo": "Jetzt live",
  "inicio.aoVivoSub": "Verfolge den Turnierbaum live",
  "inicio.tuasLigas": "Deine Ligen",
  "inicio.verTodas": "Alle ansehen ›",
  "inicio.aCarregarLigas": "Deine Ligen werden geladen…",
  "inicio.confirmaEmail": "Bestätige deine E-Mail",
  "inicio.competicaoAtual": "Aktueller Wettkampf",
  "inicio.proximaCompeticao": "Nächster Wettkampf",
  "inicio.classicoAtual": "Aktueller Klassiker",
  "inicio.proximoClassico": "Nächster Klassiker",
  "inicio.entraPrimeiro": "Melde dich zuerst in deinem Konto an.",
  "inicio.jaConfirmado": "Schon bestätigt!",
  "inicio.acabamosEnviar": "Gerade verschickt.",
  "inicio.naoEnviouAgora": "Der Versand hat nicht geklappt. Versuche es gleich noch einmal.",
  "inicio.enviado": "Verschickt! Sieh in deinem Postfach nach (auch im Spam).",
  "inicio.naoEnviou": "Der Versand hat nicht geklappt.",
  "inicio.ofertaLancamento": "Startangebot",
  "inicio.sejaProAgora": "Jetzt Ippon Pro werden",
  "inicio.saberMais": "Mehr erfahren",
  "inicio.continuarSemPagar": "Kostenlos weiter",
  "inicio.pularTutorial": "Tutorial überspringen ✕",
  "inicio.vamos": "Los geht's!",

  "tut.intro": "Ich zeige dir das Wichtigste in 1 Minute. Geh weiter, wann du willst — oder überspringe.",
  "tut.comoFunciona": "So funktioniert es",
  "tut.montaEquipaSub": "100 Judocoins, 8 Athleten und 1 Kapitän (doppelte Punkte). Hier fängst du an.",
  "inicio.tocaProSub": "Tippe hier für Ippon Pro: erweiterter Scout, Team-Analyse und Kapitänstipp. {preco}.",
  "tut.montaEquipa": "Stelle dein Team auf",
  "tut.pontuaAcoes": "Punkte durch Aktionen",
  "tut.pontuaAcoesSub": "Ippon +10, Waza-ari +4, Shido zu deinen Gunsten +1. Alles live auf der Startseite.",
  "tut.competicoes": "Wettkämpfe und Ligen",
  "tut.competicoesSub": "Jeder Grand Slam oder jede WM ist eine Runde. Spiele Welt-, National- und Freundesligen.",
  "tut.sobeFaixa": "Steig im Gürtel auf",
  "tut.sobeFaixaSub": "Deine Monatsleistung verändert deinen Gürtel — und das Aussehen des Spiels. Viel Erfolg!",

  "vant.scout": "Erweiterter Scout: die Historie jedes Athleten",
  "vant.analise": "Die Analyse deines Teams und der Kapitänstipp",
  "vant.valorizacao": "Bessere Chancen auf Wertsteigerung, dank der Analyse",
  "vant.aoVivo": "Live-Verfolgung am Wettkampftag",
};

const DICIONARIOS: Record<Lingua, Dicionario> = { pt: PT, en: EN, es: ES, fr: FR, de: DE };

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
    if (bruto === "en" || bruto === "es" || bruto === "fr" || bruto === "de" || bruto === "pt") return bruto as Lingua;
  } catch {
    /* servidor, ou browser sem navigator */
  }
  return "pt";
}

export function linguaGuardadaLocal(): Lingua | null {
  try {
    const l = localStorage.getItem(CHAVE_LOCAL);
    if (l === "pt" || l === "en" || l === "es" || l === "fr" || l === "de") return l;
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
    if (l === "pt" || l === "en" || l === "es" || l === "fr" || l === "de") return l;
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
