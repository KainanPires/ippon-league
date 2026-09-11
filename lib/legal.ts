"use client";

// lib/legal.ts
//
// CONTEÚDO LEGAL DA IPPON LEAGUE — Termos de Utilização e Política de Privacidade.
//
// O português é a VERSÃO OFICIAL. As outras línguas são traduções por
// conveniência; em caso de divergência, prevalece o português.
//
// ATUALIZAR: quando o texto legal mudar, muda-se aqui — e as CINCO línguas
// mudam sempre no mesmo lote. Se uma tradução ficar para trás, sobe-se a versão
// só no PT: a página deteta a diferença de versão e mostra o português oficial
// com um aviso, para nunca aparecer texto velho em silêncio.
//
// Gerado a partir dos documentos-fonte (.md), para o texto na app ser igual aos
// documentos entregues. Inclui as cláusulas que já viviam nas páginas antigas:
// "Ippon Pro é informativo — não garante resultados", os prémios por liga, e as
// comunicações de marketing com consentimento.

import type { Lingua } from "@/lib/i18n";

export type LegalBloco =
  | { tipo: "p"; texto: string }
  | { tipo: "lista"; itens: string[] };
export type LegalSeccao = { titulo: string; blocos: LegalBloco[] };
export type LegalDoc = {
  titulo: string;
  atualizado: string;
  versao: string;
  oficial: string;
  seccoes: LegalSeccao[];
};

export const VERSAO_OFICIAL = "1.0";

export const PRIVACIDADE: Record<Lingua, LegalDoc> = {
  "pt": {
    "titulo": "Política de Privacidade — Ippon League",
    "atualizado": "11 de setembro de 2026",
    "versao": "1.0",
    "oficial": "**Versão oficial:** esta Política foi redigida em português, que é a versão oficial. As traduções para outras línguas são fornecidas por conveniência; em caso de divergência, prevalece a versão portuguesa.",
    "seccoes": [
      {
        "titulo": "1. Quem somos",
        "blocos": [
          {
            "tipo": "p",
            "texto": "A Ippon League («nós», «nosso») é um jogo online de fantasy de judô, acessível como aplicação web / PWA em **www.ipponleague.com**."
          },
          {
            "tipo": "p",
            "texto": "O responsável pelo tratamento dos teus dados pessoais é **Kainan Pires**, a operar como pessoa singular em **Portugal**."
          },
          {
            "tipo": "p",
            "texto": "Contacto para questões de privacidade: **support@ipponleague.com**"
          },
          {
            "tipo": "p",
            "texto": "A Ippon League **não é afiliada, patrocinada nem endossada** pela International Judo Federation (IJF), pelo JudoBase, nem por qualquer atleta, federação ou organização de judô."
          }
        ]
      },
      {
        "titulo": "2. Que dados recolhemos",
        "blocos": [
          {
            "tipo": "p",
            "texto": "**Dados que nos dás ao criar conta e jogar:**"
          },
          {
            "tipo": "lista",
            "itens": [
              "Endereço de email e palavra-passe (a palavra-passe é gerida pelo nosso fornecedor de autenticação, o Supabase — nós não a vemos nem guardamos em texto simples).",
              "Nome, data de nascimento e país.",
              "Telemóvel (opcional).",
              "A tua faixa de judô (informativa).",
              "O nome e o escudo/identidade visual da tua equipa.",
              "A língua que escolheste.",
              "Atletas favoritos, equipas montadas, ligas e a tua atividade no jogo."
            ]
          },
          {
            "tipo": "p",
            "texto": "**Dados gerados pela utilização:**"
          },
          {
            "tipo": "lista",
            "itens": [
              "Nível de assinatura (gratuito, Ippon Pro, Ippon Pro Max) e o estado da mesma.",
              "Notificações no sino e, se as ativares, a subscrição de notificações push do teu aparelho (o «endpoint» do serviço de push, as chaves técnicas e o identificador do navegador/aparelho).",
              "Endereço IP, data/hora de acesso e registos técnicos, recolhidos pelos nossos fornecedores de alojamento por motivos de segurança e funcionamento."
            ]
          },
          {
            "tipo": "p",
            "texto": "**Dados de pagamento:**"
          },
          {
            "tipo": "lista",
            "itens": [
              "Se assinares o Ippon Pro ou Pro Max, o pagamento é processado pela **Stripe**. Os dados do cartão são inseridos diretamente na Stripe — **nós não recebemos nem guardamos o número do teu cartão**. Recebemos da Stripe apenas o identificador de cliente/assinatura, o estado do pagamento e as datas."
            ]
          },
          {
            "tipo": "p",
            "texto": "**Reivindicação de perfil de atleta (opcional):**"
          },
          {
            "tipo": "lista",
            "itens": [
              "Se fores atleta e reivindicares o teu perfil, recolhemos o teu Instagram e enviamos um código de verificação por mensagem direta."
            ]
          },
          {
            "tipo": "p",
            "texto": "**Dados que NÃO são pessoais dos utilizadores:** os nomes, países, categorias e resultados de atletas de competições vêm de fontes públicas do circuito internacional (IJF/JudoBase) e são factos desportivos públicos, não dados que recolhemos sobre ti."
          }
        ]
      },
      {
        "titulo": "3. Para que usamos os dados e com que base legal",
        "blocos": [
          {
            "tipo": "lista",
            "itens": [
              "**Gerir a tua conta e deixar-te jogar** — base: execução do contrato (os Termos de Utilização).",
              "**Processar a tua assinatura e cobrança** — base: execução do contrato e cumprimento de obrigações legais (fiscais/contabilísticas).",
              "**Enviar notificações push** (o teu atleta vai lutar, avisos de mercado, etc.) — base: o teu consentimento, que podes retirar a qualquer momento no perfil ou nas definições do aparelho.",
              "**Emails de serviço** (confirmação de email, recuperação de palavra-passe, avisos essenciais) — base: execução do contrato.",
              "**Enviar novidades e ofertas** sobre a Ippon League — base: o teu consentimento, que podes retirar a qualquer momento (cada email traz uma forma de cancelar; cancelar não afeta a tua conta nem o jogo).",
              "**Segurança, prevenção de fraude e abuso, e melhoria do produto** — base: interesse legítimo."
            ]
          },
          {
            "tipo": "p",
            "texto": "Não vendemos os teus dados pessoais. Não fazemos publicidade personalizada. Se um dia introduzirmos anúncios ou análises que o exijam, pediremos o teu consentimento antes."
          }
        ]
      },
      {
        "titulo": "4. Com quem partilhamos (subprocessadores)",
        "blocos": [
          {
            "tipo": "p",
            "texto": "Usamos fornecedores de confiança que tratam dados por nossa conta, apenas para fazer o serviço funcionar:"
          },
          {
            "tipo": "lista",
            "itens": [
              "**Supabase** — base de dados e autenticação (conta, dados de perfil).",
              "**Stripe** — pagamentos e gestão de assinaturas.",
              "**Vercel** — alojamento da aplicação, rede de entrega e registos técnicos.",
              "**PostHog** (região UE) — análise de utilização do produto, só com o teu consentimento (ver a secção dos cookies).",
              "**Apple** (Apple Push Notification service) e **Google** (Firebase Cloud Messaging) — entrega das notificações push ao teu aparelho.",
              "**cron-job.org** — serviço que aciona tarefas automáticas no horário certo (não recebe dados pessoais para além do necessário para chamar o serviço).",
              "**Fornecedor de email** — envio dos emails de serviço."
            ]
          },
          {
            "tipo": "p",
            "texto": "O grupo de comunidade é no **WhatsApp** (Meta): ao entrares, passas a estar sujeito à política de privacidade do WhatsApp."
          }
        ]
      },
      {
        "titulo": "5. Transferências internacionais",
        "blocos": [
          {
            "tipo": "p",
            "texto": "Alguns destes fornecedores podem tratar dados fora do Espaço Económico Europeu (por exemplo, nos Estados Unidos). Quando isso acontece, a transferência é feita ao abrigo de mecanismos previstos no RGPD, como decisões de adequação ou as Cláusulas Contratuais-Tipo da Comissão Europeia."
          }
        ]
      },
      {
        "titulo": "6. Durante quanto tempo guardamos",
        "blocos": [
          {
            "tipo": "p",
            "texto": "Guardamos os teus dados enquanto a tua conta estiver ativa. Se pedires para apagar a conta, apagamos os teus dados pessoais, exceto o que a lei nos obriga a manter durante mais tempo (por exemplo, registos de faturação para efeitos fiscais). Alguns registos técnicos são apagados automaticamente ao fim de curtos períodos."
          }
        ]
      },
      {
        "titulo": "7. Menores",
        "blocos": [
          {
            "tipo": "p",
            "texto": "A Ippon League é para maiores de **13 anos** — a idade mínima para dar consentimento em Portugal (Lei n.º 58/2019) e a mesma usada por redes como o Instagram e o TikTok. No registo pedimos a data de nascimento e **não deixamos criar conta a quem tenha menos de 13 anos**. Não recolhemos, com conhecimento, dados de menores de 13 anos. Se soubermos que existe uma conta de um menor de 13, apagamo-la. Se és pai/mãe ou tutor e achas que o teu educando criou uma conta, contacta-nos em support@ipponleague.com."
          }
        ]
      },
      {
        "titulo": "8. Os teus direitos",
        "blocos": [
          {
            "tipo": "p",
            "texto": "Ao abrigo do RGPD, tens direito a: aceder aos teus dados; corrigi-los; apagá-los; limitar ou opor-te ao tratamento; à portabilidade; e a retirar o consentimento (por exemplo, desligar as notificações) sem afetar o que foi feito antes. Podes exercer estes direitos em **support@ipponleague.com**."
          },
          {
            "tipo": "p",
            "texto": "Tens também o direito de apresentar reclamação à autoridade de controlo em Portugal, a **Comissão Nacional de Proteção de Dados (CNPD)** — www.cnpd.pt."
          }
        ]
      },
      {
        "titulo": "9. Cookies e armazenamento local",
        "blocos": [
          {
            "tipo": "p",
            "texto": "Usamos armazenamento essencial no teu navegador para: manter a sessão iniciada, lembrar a língua escolhida, lembrar que já viste os tutoriais e as tuas preferências de interface — sem estes, a aplicação não funciona. Além disso, com o **teu consentimento**, usamos o **PostHog** (na região UE) para análise de utilização do produto: perceber como o jogo é usado e melhorá-lo. Só ativamos esta análise depois de aceitares o aviso que aparece na aplicação, e podes recusar sem afetar o jogo. Não usamos cookies de publicidade."
          }
        ]
      },
      {
        "titulo": "10. Segurança",
        "blocos": [
          {
            "tipo": "p",
            "texto": "Usamos ligações cifradas (HTTPS) e fornecedores que aplicam medidas de segurança reconhecidas. Nenhum sistema é 100% seguro, mas trabalhamos para proteger os teus dados e limitar quem lhes acede."
          }
        ]
      },
      {
        "titulo": "11. Alterações a esta política",
        "blocos": [
          {
            "tipo": "p",
            "texto": "Podemos atualizar esta política. Quando o fizermos, mudamos a data no topo e, se a alteração for importante, avisamos-te na aplicação."
          }
        ]
      },
      {
        "titulo": "12. Contacto",
        "blocos": [
          {
            "tipo": "p",
            "texto": "Dúvidas sobre privacidade ou os teus dados: **support@ipponleague.com**."
          }
        ]
      }
    ]
  },
  "en": {
    "titulo": "Privacy Policy — Ippon League",
    "atualizado": "11 September 2026",
    "versao": "1.0",
    "oficial": "**Official version:** this Policy was drafted in Portuguese, which is the official version. Translations into other languages are provided for convenience; in case of any discrepancy, the Portuguese version prevails.",
    "seccoes": [
      {
        "titulo": "1. Who we are",
        "blocos": [
          {
            "tipo": "p",
            "texto": "Ippon League (\"we\", \"us\", \"our\") is an online judo fantasy game, available as a web app / PWA at **www.ipponleague.com**."
          },
          {
            "tipo": "p",
            "texto": "The controller of your personal data is **Kainan Pires**, operating as an individual (sole trader) in **Portugal**."
          },
          {
            "tipo": "p",
            "texto": "Privacy contact: **support@ipponleague.com**"
          },
          {
            "tipo": "p",
            "texto": "Ippon League is **not affiliated with, sponsored by, or endorsed by** the International Judo Federation (IJF), JudoBase, or any athlete, federation, or judo organisation."
          }
        ]
      },
      {
        "titulo": "2. What data we collect",
        "blocos": [
          {
            "tipo": "p",
            "texto": "**Data you give us when you create an account and play:**"
          },
          {
            "tipo": "lista",
            "itens": [
              "Email address and password (the password is managed by our authentication provider, Supabase — we do not see it or store it in plain text).",
              "Name, date of birth, and country.",
              "Phone number (optional).",
              "Your judo belt (informational).",
              "Your team's name and its crest/visual identity.",
              "The language you chose.",
              "Favourite athletes, teams you build, leagues, and your in-game activity."
            ]
          },
          {
            "tipo": "p",
            "texto": "**Data generated by use:**"
          },
          {
            "tipo": "lista",
            "itens": [
              "Subscription level (free, Ippon Pro, Ippon Pro Max) and its status.",
              "In-app bell notifications and, if you enable them, your device's push notification subscription (the push service \"endpoint\", the technical keys, and your browser/device identifier).",
              "IP address, access date/time, and technical logs, collected by our hosting providers for security and operational purposes."
            ]
          },
          {
            "tipo": "p",
            "texto": "**Payment data:**"
          },
          {
            "tipo": "lista",
            "itens": [
              "If you subscribe to Ippon Pro or Pro Max, payment is processed by **Stripe**. Card details are entered directly into Stripe — **we do not receive or store your card number**. From Stripe we only receive the customer/subscription identifier, the payment status, and the dates."
            ]
          },
          {
            "tipo": "p",
            "texto": "**Athlete profile claim (optional):**"
          },
          {
            "tipo": "lista",
            "itens": [
              "If you are an athlete and claim your profile, we collect your Instagram and send a verification code by direct message."
            ]
          },
          {
            "tipo": "p",
            "texto": "**Data that is NOT users' personal data:** athlete names, countries, categories, and competition results come from public sources on the international circuit (IJF/JudoBase) and are public sporting facts, not data we collect about you."
          }
        ]
      },
      {
        "titulo": "3. Why we use data and on what legal basis",
        "blocos": [
          {
            "tipo": "lista",
            "itens": [
              "**To manage your account and let you play** — basis: performance of the contract (the Terms of Use).",
              "**To process your subscription and billing** — basis: performance of the contract and compliance with legal (tax/accounting) obligations.",
              "**To send push notifications** (your athlete is about to fight, market alerts, etc.) — basis: your consent, which you can withdraw at any time in your profile or in your device settings.",
              "**Service emails** (email confirmation, password recovery, essential alerts) — basis: performance of the contract.",
              "**Send news and offers** about Ippon League — basis: your consent, which you can withdraw at any time (every email has an unsubscribe link; unsubscribing does not affect your account or the game).",
              "**Security, fraud and abuse prevention, and product improvement** — basis: legitimate interest."
            ]
          },
          {
            "tipo": "p",
            "texto": "We do not sell your personal data. We do not do personalised advertising. If we ever introduce ads or analytics that require it, we will ask for your consent first."
          }
        ]
      },
      {
        "titulo": "4. Who we share with (sub-processors)",
        "blocos": [
          {
            "tipo": "p",
            "texto": "We use trusted providers who process data on our behalf, only to make the service work:"
          },
          {
            "tipo": "lista",
            "itens": [
              "**Supabase** — database and authentication (account, profile data).",
              "**Stripe** — payments and subscription management.",
              "**Vercel** — application hosting, delivery network, and technical logs.",
              "**PostHog** (EU region) — product usage analytics, only with your consent (see the cookies section).",
              "**Apple** (Apple Push Notification service) and **Google** (Firebase Cloud Messaging) — delivery of push notifications to your device.",
              "**cron-job.org** — service that triggers automated tasks on schedule (receives no personal data beyond what is needed to call the service).",
              "**Email provider** — sending service emails."
            ]
          },
          {
            "tipo": "p",
            "texto": "The community group is on **WhatsApp** (Meta): by joining, you become subject to WhatsApp's privacy policy."
          }
        ]
      },
      {
        "titulo": "5. International transfers",
        "blocos": [
          {
            "tipo": "p",
            "texto": "Some of these providers may process data outside the European Economic Area (for example, in the United States). When that happens, the transfer is made under mechanisms provided for in the GDPR, such as adequacy decisions or the European Commission's Standard Contractual Clauses."
          }
        ]
      },
      {
        "titulo": "6. How long we keep data",
        "blocos": [
          {
            "tipo": "p",
            "texto": "We keep your data while your account is active. If you ask to delete your account, we delete your personal data, except what the law requires us to keep for longer (for example, billing records for tax purposes). Some technical logs are deleted automatically after short periods."
          }
        ]
      },
      {
        "titulo": "7. Minors",
        "blocos": [
          {
            "tipo": "p",
            "texto": "Ippon League is for people aged **13 and over** — the minimum age to give consent in Portugal (Law no. 58/2019) and the same used by networks such as Instagram and TikTok. At registration we ask for the date of birth and **we do not allow anyone under 13 to create an account**. We do not knowingly collect data from children under 13. If we learn that an account belongs to a child under 13, we delete it. If you are a parent or guardian and believe your child created an account, contact us at support@ipponleague.com."
          }
        ]
      },
      {
        "titulo": "8. Your rights",
        "blocos": [
          {
            "tipo": "p",
            "texto": "Under the GDPR, you have the right to: access your data; correct it; delete it; restrict or object to processing; data portability; and withdraw consent (for example, turning off notifications) without affecting what was done before. You can exercise these rights at **support@ipponleague.com**."
          },
          {
            "tipo": "p",
            "texto": "You also have the right to lodge a complaint with the supervisory authority in Portugal, the **National Data Protection Commission (CNPD)** — www.cnpd.pt."
          }
        ]
      },
      {
        "titulo": "9. Cookies and local storage",
        "blocos": [
          {
            "tipo": "p",
            "texto": "We use essential storage in your browser to: keep your session logged in, remember your chosen language, remember that you have seen the tutorials, and your interface preferences — without these, the app does not work. In addition, with **your consent**, we use **PostHog** (in the EU region) for product usage analytics: to understand how the game is used and improve it. We only enable this after you accept the notice shown in the app, and you can decline without affecting the game. We do not use advertising cookies."
          }
        ]
      },
      {
        "titulo": "10. Security",
        "blocos": [
          {
            "tipo": "p",
            "texto": "We use encrypted connections (HTTPS) and providers that apply recognised security measures. No system is 100% secure, but we work to protect your data and limit who can access it."
          }
        ]
      },
      {
        "titulo": "11. Changes to this policy",
        "blocos": [
          {
            "tipo": "p",
            "texto": "We may update this policy. When we do, we change the date at the top and, if the change is significant, we notify you in the app."
          }
        ]
      },
      {
        "titulo": "12. Contact",
        "blocos": [
          {
            "tipo": "p",
            "texto": "Questions about privacy or your data: **support@ipponleague.com**."
          }
        ]
      }
    ]
  },
  "es": {
    "titulo": "Política de Privacidad — Ippon League",
    "atualizado": "11 de septiembre de 2026",
    "versao": "1.0",
    "oficial": "**Versión oficial:** esta Política fue redactada en portugués, que es la versión oficial. Las traducciones a otros idiomas se ofrecen por conveniencia; en caso de discrepancia, prevalece la versión portuguesa.",
    "seccoes": [
      {
        "titulo": "1. Quiénes somos",
        "blocos": [
          {
            "tipo": "p",
            "texto": "Ippon League («nosotros», «nuestro») es un juego de fantasy de judo en línea, disponible como aplicación web / PWA en **www.ipponleague.com**."
          },
          {
            "tipo": "p",
            "texto": "El responsable del tratamiento de tus datos personales es **Kainan Pires**, que opera como persona física (autónomo) en **Portugal**."
          },
          {
            "tipo": "p",
            "texto": "Contacto para privacidad: **support@ipponleague.com**"
          },
          {
            "tipo": "p",
            "texto": "Ippon League **no está afiliada, patrocinada ni respaldada** por la Federación Internacional de Judo (IJF), por JudoBase, ni por ningún atleta, federación u organización de judo."
          }
        ]
      },
      {
        "titulo": "2. Qué datos recopilamos",
        "blocos": [
          {
            "tipo": "p",
            "texto": "**Datos que nos das al crear una cuenta y jugar:**"
          },
          {
            "tipo": "lista",
            "itens": [
              "Dirección de correo electrónico y contraseña (la contraseña la gestiona nuestro proveedor de autenticación, Supabase — no la vemos ni la guardamos en texto plano).",
              "Nombre, fecha de nacimiento y país.",
              "Teléfono (opcional).",
              "Tu cinturón de judo (informativo).",
              "El nombre y el escudo/identidad visual de tu equipo.",
              "El idioma que elegiste.",
              "Atletas favoritos, equipos que montas, ligas y tu actividad en el juego."
            ]
          },
          {
            "tipo": "p",
            "texto": "**Datos generados por el uso:**"
          },
          {
            "tipo": "lista",
            "itens": [
              "Nivel de suscripción (gratuito, Ippon Pro, Ippon Pro Max) y su estado.",
              "Notificaciones en la campana y, si las activas, la suscripción de notificaciones push de tu dispositivo (el «endpoint» del servicio de push, las claves técnicas y el identificador del navegador/dispositivo).",
              "Dirección IP, fecha/hora de acceso y registros técnicos, recopilados por nuestros proveedores de alojamiento por motivos de seguridad y funcionamiento."
            ]
          },
          {
            "tipo": "p",
            "texto": "**Datos de pago:**"
          },
          {
            "tipo": "lista",
            "itens": [
              "Si te suscribes a Ippon Pro o Pro Max, el pago lo procesa **Stripe**. Los datos de la tarjeta se introducen directamente en Stripe — **no recibimos ni guardamos el número de tu tarjeta**. De Stripe solo recibimos el identificador de cliente/suscripción, el estado del pago y las fechas."
            ]
          },
          {
            "tipo": "p",
            "texto": "**Reivindicación de perfil de atleta (opcional):**"
          },
          {
            "tipo": "lista",
            "itens": [
              "Si eres atleta y reivindicas tu perfil, recopilamos tu Instagram y enviamos un código de verificación por mensaje directo."
            ]
          },
          {
            "tipo": "p",
            "texto": "**Datos que NO son datos personales de los usuarios:** los nombres, países, categorías y resultados de atletas de competiciones provienen de fuentes públicas del circuito internacional (IJF/JudoBase) y son hechos deportivos públicos, no datos que recopilamos sobre ti."
          }
        ]
      },
      {
        "titulo": "3. Para qué usamos los datos y con qué base legal",
        "blocos": [
          {
            "tipo": "lista",
            "itens": [
              "**Gestionar tu cuenta y dejarte jugar** — base: ejecución del contrato (los Términos de Uso).",
              "**Procesar tu suscripción y cobro** — base: ejecución del contrato y cumplimiento de obligaciones legales (fiscales/contables).",
              "**Enviar notificaciones push** (tu atleta va a luchar, avisos de mercado, etc.) — base: tu consentimiento, que puedes retirar en cualquier momento en tu perfil o en los ajustes del dispositivo.",
              "**Correos de servicio** (confirmación de correo, recuperación de contraseña, avisos esenciales) — base: ejecución del contrato.",
              "**Enviar novedades y ofertas** sobre Ippon League — base: tu consentimiento, que puedes retirar en cualquier momento (cada correo incluye una forma de cancelar; cancelar no afecta a tu cuenta ni al juego).",
              "**Seguridad, prevención de fraude y abuso, y mejora del producto** — base: interés legítimo."
            ]
          },
          {
            "tipo": "p",
            "texto": "No vendemos tus datos personales. No hacemos publicidad personalizada. Si algún día introducimos anuncios o análisis que lo requieran, pediremos tu consentimiento antes."
          }
        ]
      },
      {
        "titulo": "4. Con quién compartimos (subencargados)",
        "blocos": [
          {
            "tipo": "p",
            "texto": "Usamos proveedores de confianza que tratan datos por cuenta nuestra, solo para hacer funcionar el servicio:"
          },
          {
            "tipo": "lista",
            "itens": [
              "**Supabase** — base de datos y autenticación (cuenta, datos de perfil).",
              "**Stripe** — pagos y gestión de suscripciones.",
              "**Vercel** — alojamiento de la aplicación, red de entrega y registros técnicos.",
              "**PostHog** (región UE) — analítica de uso del producto, solo con tu consentimiento (ver la sección de cookies).",
              "**Apple** (Apple Push Notification service) y **Google** (Firebase Cloud Messaging) — entrega de las notificaciones push a tu dispositivo.",
              "**cron-job.org** — servicio que activa tareas automáticas en el horario correcto (no recibe datos personales más allá de lo necesario para llamar al servicio).",
              "**Proveedor de correo** — envío de los correos de servicio."
            ]
          },
          {
            "tipo": "p",
            "texto": "El grupo de comunidad está en **WhatsApp** (Meta): al entrar, quedas sujeto a la política de privacidad de WhatsApp."
          }
        ]
      },
      {
        "titulo": "5. Transferencias internacionales",
        "blocos": [
          {
            "tipo": "p",
            "texto": "Algunos de estos proveedores pueden tratar datos fuera del Espacio Económico Europeo (por ejemplo, en Estados Unidos). Cuando eso ocurre, la transferencia se realiza al amparo de mecanismos previstos en el RGPD, como decisiones de adecuación o las Cláusulas Contractuales Tipo de la Comisión Europea."
          }
        ]
      },
      {
        "titulo": "6. Durante cuánto tiempo guardamos",
        "blocos": [
          {
            "tipo": "p",
            "texto": "Guardamos tus datos mientras tu cuenta esté activa. Si pides eliminar la cuenta, eliminamos tus datos personales, salvo lo que la ley nos obliga a conservar durante más tiempo (por ejemplo, registros de facturación para efectos fiscales). Algunos registros técnicos se eliminan automáticamente al cabo de cortos periodos."
          }
        ]
      },
      {
        "titulo": "7. Menores",
        "blocos": [
          {
            "tipo": "p",
            "texto": "Ippon League es para mayores de **13 años** — la edad mínima para dar el consentimiento en Portugal (Ley n.º 58/2019) y la misma que usan redes como Instagram y TikTok. En el registro pedimos la fecha de nacimiento y **no permitimos crear cuenta a quien tenga menos de 13 años**. No recopilamos, con conocimiento, datos de menores de 13 años. Si sabemos que existe una cuenta de un menor de 13, la eliminamos. Si eres padre/madre o tutor y crees que tu menor a cargo creó una cuenta, contáctanos en support@ipponleague.com."
          }
        ]
      },
      {
        "titulo": "8. Tus derechos",
        "blocos": [
          {
            "tipo": "p",
            "texto": "Al amparo del RGPD, tienes derecho a: acceder a tus datos; rectificarlos; suprimirlos; limitar u oponerte al tratamiento; a la portabilidad; y a retirar el consentimiento (por ejemplo, desactivar las notificaciones) sin afectar a lo hecho antes. Puedes ejercer estos derechos en **support@ipponleague.com**."
          },
          {
            "tipo": "p",
            "texto": "También tienes derecho a presentar una reclamación ante la autoridad de control en Portugal, la **Comisión Nacional de Protección de Datos (CNPD)** — www.cnpd.pt."
          }
        ]
      },
      {
        "titulo": "9. Cookies y almacenamiento local",
        "blocos": [
          {
            "tipo": "p",
            "texto": "Usamos almacenamiento esencial en tu navegador para: mantener la sesión iniciada, recordar el idioma elegido, recordar que ya viste los tutoriales y tus preferencias de interfaz — sin estos, la aplicación no funciona. Además, con **tu consentimiento**, usamos **PostHog** (en la región UE) para analítica de uso del producto: entender cómo se usa el juego y mejorarlo. Solo lo activamos después de que aceptes el aviso que aparece en la aplicación, y puedes rechazarlo sin afectar al juego. No usamos cookies de publicidad."
          }
        ]
      },
      {
        "titulo": "10. Seguridad",
        "blocos": [
          {
            "tipo": "p",
            "texto": "Usamos conexiones cifradas (HTTPS) y proveedores que aplican medidas de seguridad reconocidas. Ningún sistema es 100% seguro, pero trabajamos para proteger tus datos y limitar quién accede a ellos."
          }
        ]
      },
      {
        "titulo": "11. Cambios en esta política",
        "blocos": [
          {
            "tipo": "p",
            "texto": "Podemos actualizar esta política. Cuando lo hagamos, cambiamos la fecha en la parte superior y, si el cambio es importante, te avisamos en la aplicación."
          }
        ]
      },
      {
        "titulo": "12. Contacto",
        "blocos": [
          {
            "tipo": "p",
            "texto": "Dudas sobre privacidad o tus datos: **support@ipponleague.com**."
          }
        ]
      }
    ]
  },
  "fr": {
    "titulo": "Politique de Confidentialité — Ippon League",
    "atualizado": "11 septembre 2026",
    "versao": "1.0",
    "oficial": "**Version officielle :** cette Politique a été rédigée en portugais, qui est la version officielle. Les traductions dans d'autres langues sont fournies par commodité ; en cas de divergence, la version portugaise prévaut.",
    "seccoes": [
      {
        "titulo": "1. Qui nous sommes",
        "blocos": [
          {
            "tipo": "p",
            "texto": "Ippon League (« nous », « notre ») est un jeu de fantasy de judo en ligne, accessible en tant qu'application web / PWA sur **www.ipponleague.com**."
          },
          {
            "tipo": "p",
            "texto": "Le responsable du traitement de tes données personnelles est **Kainan Pires**, exerçant en tant que personne physique (travailleur indépendant) au **Portugal**."
          },
          {
            "tipo": "p",
            "texto": "Contact pour la confidentialité : **support@ipponleague.com**"
          },
          {
            "tipo": "p",
            "texto": "Ippon League **n'est pas affiliée, parrainée ni approuvée** par la Fédération Internationale de Judo (IJF), par JudoBase, ni par aucun athlète, fédération ou organisation de judo."
          }
        ]
      },
      {
        "titulo": "2. Quelles données nous collectons",
        "blocos": [
          {
            "tipo": "p",
            "texto": "**Données que tu nous fournis en créant un compte et en jouant :**"
          },
          {
            "tipo": "lista",
            "itens": [
              "Adresse e-mail et mot de passe (le mot de passe est géré par notre prestataire d'authentification, Supabase — nous ne le voyons pas et ne le stockons pas en clair).",
              "Nom, date de naissance et pays.",
              "Téléphone (facultatif).",
              "Ta ceinture de judo (informative).",
              "Le nom et le blason/l'identité visuelle de ton équipe.",
              "La langue que tu as choisie.",
              "Athlètes favoris, équipes que tu montes, ligues et ton activité dans le jeu."
            ]
          },
          {
            "tipo": "p",
            "texto": "**Données générées par l'utilisation :**"
          },
          {
            "tipo": "lista",
            "itens": [
              "Niveau d'abonnement (gratuit, Ippon Pro, Ippon Pro Max) et son état.",
              "Notifications dans la cloche et, si tu les actives, l'abonnement aux notifications push de ton appareil (l'« endpoint » du service push, les clés techniques et l'identifiant du navigateur/appareil).",
              "Adresse IP, date/heure d'accès et journaux techniques, collectés par nos hébergeurs pour des raisons de sécurité et de fonctionnement."
            ]
          },
          {
            "tipo": "p",
            "texto": "**Données de paiement :**"
          },
          {
            "tipo": "lista",
            "itens": [
              "Si tu t'abonnes à Ippon Pro ou Pro Max, le paiement est traité par **Stripe**. Les données de la carte sont saisies directement dans Stripe — **nous ne recevons ni ne stockons ton numéro de carte**. De Stripe, nous ne recevons que l'identifiant client/abonnement, l'état du paiement et les dates."
            ]
          },
          {
            "tipo": "p",
            "texto": "**Revendication de profil d'athlète (facultatif) :**"
          },
          {
            "tipo": "lista",
            "itens": [
              "Si tu es athlète et que tu revendiques ton profil, nous collectons ton Instagram et envoyons un code de vérification par message privé."
            ]
          },
          {
            "tipo": "p",
            "texto": "**Données qui NE sont PAS des données personnelles des utilisateurs :** les noms, pays, catégories et résultats des athlètes des compétitions proviennent de sources publiques du circuit international (IJF/JudoBase) et sont des faits sportifs publics, non des données que nous collectons sur toi."
          }
        ]
      },
      {
        "titulo": "3. Pourquoi nous utilisons les données et sur quelle base légale",
        "blocos": [
          {
            "tipo": "lista",
            "itens": [
              "**Gérer ton compte et te laisser jouer** — base : exécution du contrat (les Conditions d'Utilisation).",
              "**Traiter ton abonnement et la facturation** — base : exécution du contrat et respect des obligations légales (fiscales/comptables).",
              "**Envoyer des notifications push** (ton athlète va combattre, alertes de marché, etc.) — base : ton consentement, que tu peux retirer à tout moment dans ton profil ou dans les paramètres de l'appareil.",
              "**E-mails de service** (confirmation d'e-mail, récupération de mot de passe, alertes essentielles) — base : exécution du contrat.",
              "**Envoyer des nouveautés et des offres** sur Ippon League — base : ton consentement, que tu peux retirer à tout moment (chaque e-mail contient un lien de désabonnement ; se désabonner n'affecte ni ton compte ni le jeu).",
              "**Sécurité, prévention de la fraude et des abus, et amélioration du produit** — base : intérêt légitime."
            ]
          },
          {
            "tipo": "p",
            "texto": "Nous ne vendons pas tes données personnelles. Nous ne faisons pas de publicité personnalisée. Si un jour nous introduisons des publicités ou des analyses qui l'exigent, nous demanderons ton consentement au préalable."
          }
        ]
      },
      {
        "titulo": "4. Avec qui nous partageons (sous-traitants)",
        "blocos": [
          {
            "tipo": "p",
            "texto": "Nous utilisons des prestataires de confiance qui traitent les données pour notre compte, uniquement pour faire fonctionner le service :"
          },
          {
            "tipo": "lista",
            "itens": [
              "**Supabase** — base de données et authentification (compte, données de profil).",
              "**Stripe** — paiements et gestion des abonnements.",
              "**Vercel** — hébergement de l'application, réseau de distribution et journaux techniques.",
              "**PostHog** (région UE) — analyse d'utilisation du produit, uniquement avec ton consentement (voir la section cookies).",
              "**Apple** (Apple Push Notification service) et **Google** (Firebase Cloud Messaging) — livraison des notifications push à ton appareil.",
              "**cron-job.org** — service qui déclenche des tâches automatiques à l'heure prévue (ne reçoit pas de données personnelles au-delà de ce qui est nécessaire pour appeler le service).",
              "**Prestataire d'e-mail** — envoi des e-mails de service."
            ]
          },
          {
            "tipo": "p",
            "texto": "Le groupe communautaire est sur **WhatsApp** (Meta) : en le rejoignant, tu es soumis à la politique de confidentialité de WhatsApp."
          }
        ]
      },
      {
        "titulo": "5. Transferts internationaux",
        "blocos": [
          {
            "tipo": "p",
            "texto": "Certains de ces prestataires peuvent traiter des données en dehors de l'Espace Économique Européen (par exemple, aux États-Unis). Lorsque cela se produit, le transfert est effectué au titre de mécanismes prévus par le RGPD, tels que des décisions d'adéquation ou les Clauses Contractuelles Types de la Commission Européenne."
          }
        ]
      },
      {
        "titulo": "6. Combien de temps nous conservons",
        "blocos": [
          {
            "tipo": "p",
            "texto": "Nous conservons tes données tant que ton compte est actif. Si tu demandes à supprimer ton compte, nous supprimons tes données personnelles, sauf ce que la loi nous oblige à conserver plus longtemps (par exemple, les registres de facturation à des fins fiscales). Certains journaux techniques sont supprimés automatiquement après de courtes périodes."
          }
        ]
      },
      {
        "titulo": "7. Mineurs",
        "blocos": [
          {
            "tipo": "p",
            "texto": "Ippon League est destinée aux personnes de **13 ans et plus** — l'âge minimum pour donner son consentement au Portugal (loi n° 58/2019) et le même que celui utilisé par des réseaux comme Instagram et TikTok. Lors de l'inscription, nous demandons la date de naissance et **nous ne permettons pas à quiconque de moins de 13 ans de créer un compte**. Nous ne collectons pas sciemment de données de mineurs de moins de 13 ans. Si nous apprenons qu'un compte appartient à un mineur de moins de 13 ans, nous le supprimons. Si tu es parent ou tuteur et que tu penses que ton enfant a créé un compte, contacte-nous à support@ipponleague.com."
          }
        ]
      },
      {
        "titulo": "8. Tes droits",
        "blocos": [
          {
            "tipo": "p",
            "texto": "En vertu du RGPD, tu as le droit de : accéder à tes données ; les rectifier ; les supprimer ; limiter ou t'opposer au traitement ; à la portabilité ; et retirer ton consentement (par exemple, désactiver les notifications) sans affecter ce qui a été fait avant. Tu peux exercer ces droits à **support@ipponleague.com**."
          },
          {
            "tipo": "p",
            "texto": "Tu as également le droit d'introduire une réclamation auprès de l'autorité de contrôle au Portugal, la **Commission Nationale de Protection des Données (CNPD)** — www.cnpd.pt."
          }
        ]
      },
      {
        "titulo": "9. Cookies et stockage local",
        "blocos": [
          {
            "tipo": "p",
            "texto": "Nous utilisons le stockage essentiel dans ton navigateur pour : maintenir ta session connectée, mémoriser la langue choisie, mémoriser que tu as vu les tutoriels et tes préférences d'interface — sans cela, l'application ne fonctionne pas. De plus, avec **ton consentement**, nous utilisons **PostHog** (dans la région UE) pour l'analyse d'utilisation du produit : comprendre comment le jeu est utilisé et l'améliorer. Nous ne l'activons qu'après que tu aies accepté l'avis affiché dans l'application, et tu peux refuser sans que le jeu soit affecté. Nous n'utilisons pas de cookies publicitaires."
          }
        ]
      },
      {
        "titulo": "10. Sécurité",
        "blocos": [
          {
            "tipo": "p",
            "texto": "Nous utilisons des connexions chiffrées (HTTPS) et des prestataires qui appliquent des mesures de sécurité reconnues. Aucun système n'est sûr à 100 %, mais nous travaillons à protéger tes données et à limiter qui y accède."
          }
        ]
      },
      {
        "titulo": "11. Modifications de cette politique",
        "blocos": [
          {
            "tipo": "p",
            "texto": "Nous pouvons mettre à jour cette politique. Lorsque nous le faisons, nous changeons la date en haut et, si le changement est important, nous t'informons dans l'application."
          }
        ]
      },
      {
        "titulo": "12. Contact",
        "blocos": [
          {
            "tipo": "p",
            "texto": "Questions sur la confidentialité ou tes données : **support@ipponleague.com**."
          }
        ]
      }
    ]
  },
  "de": {
    "titulo": "Datenschutzerklärung — Ippon League",
    "atualizado": "11. September 2026",
    "versao": "1.0",
    "oficial": "**Offizielle Fassung:** Diese Erklärung wurde auf Portugiesisch verfasst, was die offizielle Fassung ist. Übersetzungen in andere Sprachen werden aus Gründen der Zweckmäßigkeit bereitgestellt; im Falle von Abweichungen ist die portugiesische Fassung maßgeblich.",
    "seccoes": [
      {
        "titulo": "1. Wer wir sind",
        "blocos": [
          {
            "tipo": "p",
            "texto": "Ippon League („wir\", „unser\") ist ein Online-Judo-Fantasy-Spiel, verfügbar als Web-App / PWA unter **www.ipponleague.com**."
          },
          {
            "tipo": "p",
            "texto": "Verantwortlicher für die Verarbeitung deiner personenbezogenen Daten ist **Kainan Pires**, tätig als natürliche Person (Einzelunternehmer) in **Portugal**."
          },
          {
            "tipo": "p",
            "texto": "Kontakt für Datenschutzfragen: **support@ipponleague.com**"
          },
          {
            "tipo": "p",
            "texto": "Ippon League ist **nicht mit der International Judo Federation (IJF), JudoBase oder einem Athleten, Verband oder einer Judo-Organisation verbunden, wird von diesen nicht gesponsert und nicht unterstützt**."
          }
        ]
      },
      {
        "titulo": "2. Welche Daten wir erheben",
        "blocos": [
          {
            "tipo": "p",
            "texto": "**Daten, die du uns bei der Kontoerstellung und beim Spielen gibst:**"
          },
          {
            "tipo": "lista",
            "itens": [
              "E-Mail-Adresse und Passwort (das Passwort wird von unserem Authentifizierungsanbieter Supabase verwaltet — wir sehen es nicht und speichern es nicht im Klartext).",
              "Name, Geburtsdatum und Land.",
              "Telefonnummer (optional).",
              "Dein Judo-Gürtel (informativ).",
              "Der Name und das Wappen/die visuelle Identität deines Teams.",
              "Die von dir gewählte Sprache.",
              "Lieblingsathleten, aufgestellte Teams, Ligen und deine Aktivität im Spiel."
            ]
          },
          {
            "tipo": "p",
            "texto": "**Durch die Nutzung erzeugte Daten:**"
          },
          {
            "tipo": "lista",
            "itens": [
              "Abonnementstufe (kostenlos, Ippon Pro, Ippon Pro Max) und deren Status.",
              "Glocken-Benachrichtigungen und, falls du sie aktivierst, das Push-Benachrichtigungs-Abonnement deines Geräts (der „Endpoint\" des Push-Dienstes, die technischen Schlüssel und die Browser-/Gerätekennung).",
              "IP-Adresse, Zugriffsdatum/-zeit und technische Protokolle, die von unseren Hosting-Anbietern aus Sicherheits- und Betriebsgründen erhoben werden."
            ]
          },
          {
            "tipo": "p",
            "texto": "**Zahlungsdaten:**"
          },
          {
            "tipo": "lista",
            "itens": [
              "Wenn du Ippon Pro oder Pro Max abonnierst, wird die Zahlung von **Stripe** abgewickelt. Die Kartendaten werden direkt bei Stripe eingegeben — **wir erhalten und speichern deine Kartennummer nicht**. Von Stripe erhalten wir nur die Kunden-/Abonnementkennung, den Zahlungsstatus und die Daten."
            ]
          },
          {
            "tipo": "p",
            "texto": "**Athletenprofil-Beanspruchung (optional):**"
          },
          {
            "tipo": "lista",
            "itens": [
              "Wenn du Athlet bist und dein Profil beanspruchst, erheben wir deinen Instagram-Account und senden einen Bestätigungscode per Direktnachricht."
            ]
          },
          {
            "tipo": "p",
            "texto": "**Daten, die KEINE personenbezogenen Daten der Nutzer sind:** Namen, Länder, Kategorien und Wettkampfergebnisse von Athleten stammen aus öffentlichen Quellen des internationalen Zirkuits (IJF/JudoBase) und sind öffentliche sportliche Fakten, keine Daten, die wir über dich erheben."
          }
        ]
      },
      {
        "titulo": "3. Wofür wir Daten verwenden und auf welcher Rechtsgrundlage",
        "blocos": [
          {
            "tipo": "lista",
            "itens": [
              "**Verwaltung deines Kontos und Ermöglichung des Spielens** — Grundlage: Vertragserfüllung (die Nutzungsbedingungen).",
              "**Abwicklung deines Abonnements und der Abrechnung** — Grundlage: Vertragserfüllung und Erfüllung gesetzlicher (steuer-/buchhalterischer) Pflichten.",
              "**Versand von Push-Benachrichtigungen** (dein Athlet kämpft gleich, Marktwarnungen usw.) — Grundlage: deine Einwilligung, die du jederzeit in deinem Profil oder in den Geräteeinstellungen widerrufen kannst.",
              "**Service-E-Mails** (E-Mail-Bestätigung, Passwortwiederherstellung, wesentliche Warnungen) — Grundlage: Vertragserfüllung.",
              "**Neuigkeiten und Angebote senden** über Ippon League — Grundlage: deine Einwilligung, die du jederzeit widerrufen kannst (jede E-Mail enthält einen Abmeldelink; die Abmeldung wirkt sich nicht auf dein Konto oder das Spiel aus).",
              "**Sicherheit, Betrugs- und Missbrauchsprävention sowie Produktverbesserung** — Grundlage: berechtigtes Interesse."
            ]
          },
          {
            "tipo": "p",
            "texto": "Wir verkaufen deine personenbezogenen Daten nicht. Wir betreiben keine personalisierte Werbung. Sollten wir eines Tages Werbung oder Analysen einführen, die dies erfordern, werden wir zuvor deine Einwilligung einholen."
          }
        ]
      },
      {
        "titulo": "4. Mit wem wir teilen (Auftragsverarbeiter)",
        "blocos": [
          {
            "tipo": "p",
            "texto": "Wir nutzen vertrauenswürdige Anbieter, die Daten in unserem Auftrag verarbeiten, ausschließlich um den Dienst funktionsfähig zu machen:"
          },
          {
            "tipo": "lista",
            "itens": [
              "**Supabase** — Datenbank und Authentifizierung (Konto, Profildaten).",
              "**Stripe** — Zahlungen und Abonnementverwaltung.",
              "**Vercel** — Hosting der Anwendung, Auslieferungsnetzwerk und technische Protokolle.",
              "**PostHog** (EU-Region) — Produktnutzungsanalyse, nur mit deiner Einwilligung (siehe Abschnitt Cookies).",
              "**Apple** (Apple Push Notification service) und **Google** (Firebase Cloud Messaging) — Zustellung der Push-Benachrichtigungen an dein Gerät.",
              "**cron-job.org** — Dienst, der automatisierte Aufgaben zur richtigen Zeit auslöst (erhält keine personenbezogenen Daten über das zum Aufruf des Dienstes Notwendige hinaus).",
              "**E-Mail-Anbieter** — Versand der Service-E-Mails."
            ]
          },
          {
            "tipo": "p",
            "texto": "Die Community-Gruppe ist auf **WhatsApp** (Meta): Wenn du beitrittst, unterliegst du der Datenschutzerklärung von WhatsApp."
          }
        ]
      },
      {
        "titulo": "5. Internationale Übermittlungen",
        "blocos": [
          {
            "tipo": "p",
            "texto": "Einige dieser Anbieter können Daten außerhalb des Europäischen Wirtschaftsraums (zum Beispiel in den Vereinigten Staaten) verarbeiten. Wenn dies geschieht, erfolgt die Übermittlung auf Grundlage von in der DSGVO vorgesehenen Mechanismen, wie Angemessenheitsbeschlüssen oder den Standardvertragsklauseln der Europäischen Kommission."
          }
        ]
      },
      {
        "titulo": "6. Wie lange wir Daten aufbewahren",
        "blocos": [
          {
            "tipo": "p",
            "texto": "Wir bewahren deine Daten auf, solange dein Konto aktiv ist. Wenn du die Löschung deines Kontos verlangst, löschen wir deine personenbezogenen Daten, mit Ausnahme dessen, was uns das Gesetz länger aufzubewahren verpflichtet (zum Beispiel Abrechnungsunterlagen zu Steuerzwecken). Einige technische Protokolle werden nach kurzen Zeiträumen automatisch gelöscht."
          }
        ]
      },
      {
        "titulo": "7. Minderjährige",
        "blocos": [
          {
            "tipo": "p",
            "texto": "Ippon League ist für Personen ab **13 Jahren** — das Mindestalter für die Einwilligung in Portugal (Gesetz Nr. 58/2019) und dasselbe, das von Netzwerken wie Instagram und TikTok verwendet wird. Bei der Registrierung fragen wir das Geburtsdatum ab und **erlauben niemandem unter 13 Jahren, ein Konto zu erstellen**. Wir erheben nicht wissentlich Daten von Kindern unter 13 Jahren. Wenn wir erfahren, dass ein Konto einem Kind unter 13 Jahren gehört, löschen wir es. Wenn du Elternteil oder Erziehungsberechtigter bist und glaubst, dass dein Kind ein Konto erstellt hat, kontaktiere uns unter support@ipponleague.com."
          }
        ]
      },
      {
        "titulo": "8. Deine Rechte",
        "blocos": [
          {
            "tipo": "p",
            "texto": "Nach der DSGVO hast du das Recht auf: Zugang zu deinen Daten; deren Berichtigung; deren Löschung; Einschränkung oder Widerspruch gegen die Verarbeitung; Datenübertragbarkeit; und Widerruf der Einwilligung (zum Beispiel Abschalten der Benachrichtigungen), ohne dass dies das zuvor Getane berührt. Du kannst diese Rechte unter **support@ipponleague.com** ausüben."
          },
          {
            "tipo": "p",
            "texto": "Du hast außerdem das Recht, eine Beschwerde bei der Aufsichtsbehörde in Portugal einzureichen, der **Nationalen Datenschutzkommission (CNPD)** — www.cnpd.pt."
          }
        ]
      },
      {
        "titulo": "9. Cookies und lokaler Speicher",
        "blocos": [
          {
            "tipo": "p",
            "texto": "Wir verwenden wesentlichen Speicher in deinem Browser, um: deine Sitzung angemeldet zu halten, die gewählte Sprache zu merken, zu merken, dass du die Tutorials gesehen hast, und deine Oberflächen-Einstellungen — ohne diese funktioniert die App nicht. Zusätzlich verwenden wir mit **deiner Einwilligung** **PostHog** (in der EU-Region) zur Produktnutzungsanalyse: um zu verstehen, wie das Spiel genutzt wird, und es zu verbessern. Wir aktivieren dies erst, nachdem du den Hinweis in der App akzeptiert hast, und du kannst ablehnen, ohne dass das Spiel beeinträchtigt wird. Wir verwenden keine Werbe-Cookies."
          }
        ]
      },
      {
        "titulo": "10. Sicherheit",
        "blocos": [
          {
            "tipo": "p",
            "texto": "Wir verwenden verschlüsselte Verbindungen (HTTPS) und Anbieter, die anerkannte Sicherheitsmaßnahmen anwenden. Kein System ist zu 100 % sicher, aber wir arbeiten daran, deine Daten zu schützen und einzuschränken, wer darauf zugreifen kann."
          }
        ]
      },
      {
        "titulo": "11. Änderungen dieser Erklärung",
        "blocos": [
          {
            "tipo": "p",
            "texto": "Wir können diese Erklärung aktualisieren. Wenn wir das tun, ändern wir das Datum oben und informieren dich, falls die Änderung wesentlich ist, in der Anwendung."
          }
        ]
      },
      {
        "titulo": "12. Kontakt",
        "blocos": [
          {
            "tipo": "p",
            "texto": "Fragen zum Datenschutz oder zu deinen Daten: **support@ipponleague.com**."
          }
        ]
      }
    ]
  }
};

export const TERMOS: Record<Lingua, LegalDoc> = {
  "pt": {
    "titulo": "Termos de Utilização — Ippon League",
    "atualizado": "10 de setembro de 2026",
    "versao": "1.0",
    "oficial": "**Versão oficial:** estes Termos foram redigidos em português, que é a versão oficial. As traduções para outras línguas são fornecidas por conveniência; em caso de divergência, prevalece a versão portuguesa.",
    "seccoes": [
      {
        "titulo": "1. Aceitação",
        "blocos": [
          {
            "tipo": "p",
            "texto": "Ao criar conta ou usar a Ippon League (**www.ipponleague.com**), aceitas estes Termos de Utilização e a Política de Privacidade. Se não concordares, não uses o serviço."
          },
          {
            "tipo": "p",
            "texto": "A Ippon League é operada por **Kainan Pires**, pessoa singular, em **Portugal**. Contacto: **support@ipponleague.com**."
          }
        ]
      },
      {
        "titulo": "2. O que é a Ippon League",
        "blocos": [
          {
            "tipo": "p",
            "texto": "A Ippon League é um jogo online de fantasy inspirado no judô: montas uma equipa de atletas, escolhes um capitão, e pontuas conforme as ações reais dos atletas nas competições internacionais. É entretenimento — uma camada de jogo e comunidade por cima do judô mundial."
          },
          {
            "tipo": "p",
            "texto": "A Ippon League **não é afiliada, patrocinada nem endossada** pela IJF, pelo JudoBase, nem por qualquer atleta ou federação. Os nomes e resultados de atletas são factos desportivos públicos, usados a título informativo."
          }
        ]
      },
      {
        "titulo": "3. Elegibilidade e conta",
        "blocos": [
          {
            "tipo": "lista",
            "itens": [
              "Tens de ter **13 anos ou mais** para usar a Ippon League. No registo é pedida a data de nascimento; quem tiver menos de 13 anos não pode criar conta.",
              "És responsável por manter a tua palavra-passe segura e por tudo o que acontece na tua conta.",
              "Dás informação verdadeira ao registar-te.",
              "Uma pessoa não deve criar várias contas para obter vantagens (por exemplo, repetir o período de teste gratuito)."
            ]
          }
        ]
      },
      {
        "titulo": "4. Judocoins e natureza do jogo",
        "blocos": [
          {
            "tipo": "lista",
            "itens": [
              "Os **Judocoins (JC)** são uma moeda virtual do jogo, sem qualquer valor monetário. Não se compram, não se vendem, não se convertem em dinheiro e não são transferíveis.",
              "A Ippon League **não é uma aposta nem um jogo de azar**. Não apostas dinheiro, não há prémios em dinheiro dependentes de sorte, e a assinatura paga dá acesso a funcionalidades — nunca a maiores probabilidades de ganhar dinheiro.",
              "A Ippon League pode atribuir prémios em determinadas ligas (por exemplo, prémios por rodada e de fim de época na Liga Mundial, e de fim de época na Liga Continental). Os prémios, as condições de elegibilidade e as formas de atribuição são definidos a cada época, podem depender de patrocinadores e podem ser alterados. A elegibilidade pode estar associada à assinatura Ippon Pro."
            ]
          }
        ]
      },
      {
        "titulo": "5. Assinatura Ippon Pro e Ippon Pro Max",
        "blocos": [
          {
            "tipo": "lista",
            "itens": [
              "O Ippon Pro e o Ippon Pro Max são assinaturas **mensais**, que renovam automaticamente até seres tu a cancelar.",
              "Quem nunca subscreveu tem **7 dias de teste gratuito**. Só há um teste por pessoa.",
              "O preço é o que aparece no ecrã de subscrição no momento em que subscreves. O pagamento e os impostos aplicáveis são tratados pela **Stripe**.",
              "Ao subscreveres, declaras ter idade e capacidade legal para contratar ou, se aplicável, autorização do titular do meio de pagamento que usares.",
              "**Cancelamento:** podes cancelar a qualquer momento no teu perfil.",
              "Durante o teste gratuito, cancelar desliga a renovação e mantém o acesso até ao fim dos 7 dias, sem qualquer cobrança.",
              "Depois do teste, cancelar mantém o acesso até ao fim do período mensal já pago; não há nova cobrança e o acesso termina nessa data.",
              "**Reembolsos:** por se tratar de conteúdo digital de acesso imediato, e havendo um período de teste gratuito, os valores já cobrados de um período em curso não são, em regra, reembolsados, salvo quando a lei o exija. Os teus direitos de consumidor ao abrigo da lei portuguesa e da UE mantêm-se."
            ]
          },
          {
            "tipo": "lista",
            "itens": [
              "**O Ippon Pro é informativo e não garante resultados.** Dá acesso a informação baseada em dados e no histórico dos atletas (resultados passados e tendências de desempenho). Não monta a tua equipa, não indica em quem apostar e não diz quem vai ganhar. Ao subscrever, aceitas que o Ippon Pro é meramente informativo e não garante qualquer resultado — nem vitórias, nem pontuação, nem subida de faixa, nem prémios. As leituras que mostramos são possibilidades e tendências, nunca certezas, e a decisão é sempre tua."
            ]
          }
        ]
      },
      {
        "titulo": "6. Utilização aceitável",
        "blocos": [
          {
            "tipo": "p",
            "texto": "Concordas em não: fazer batota ou explorar falhas; aceder ao serviço por meios automáticos não autorizados (bots, scraping) para além do uso normal; tentar contornar o pagamento ou o acesso Pro; perturbar o funcionamento; usar linguagem ou conteúdos ofensivos, ilegais ou que violem direitos de terceiros no nome da equipa, escudo ou outros conteúdos que insiras."
          }
        ]
      },
      {
        "titulo": "7. Conteúdos e propriedade intelectual",
        "blocos": [
          {
            "tipo": "lista",
            "itens": [
              "A aplicação, a marca «Ippon League», a mascote (o Dôdo), o design e o código são nossos ou dos nossos licenciadores. Não os podes copiar nem reutilizar sem autorização.",
              "Os conteúdos que crias (nome da equipa, escudo) continuam a ser da tua responsabilidade; ao inseri-los, dás-nos autorização para os mostrar dentro do jogo. Não podes usar conteúdos ofensivos ou que violem direitos de terceiros.",
              "Os dados de atletas e competições provêm de fontes públicas (IJF/JudoBase) e são usados a título factual e informativo."
            ]
          }
        ]
      },
      {
        "titulo": "8. Dados de terceiros e disponibilidade",
        "blocos": [
          {
            "tipo": "lista",
            "itens": [
              "A pontuação e o acompanhamento dependem de dados de terceiros, que podem ter erros, atrasos ou lacunas. Fazemos os possíveis por corrigir e completar (incluindo correções manuais), mas **não garantimos** que os dados estejam sempre completos ou corretos em tempo real.",
              "O serviço é fornecido «tal como está». Podemos alterar, suspender ou descontinuar funcionalidades, e não garantimos disponibilidade ininterrupta."
            ]
          }
        ]
      },
      {
        "titulo": "9. Responsabilidade",
        "blocos": [
          {
            "tipo": "p",
            "texto": "Na medida máxima permitida por lei, não somos responsáveis por danos indiretos resultantes do uso do jogo. Nada nestes Termos afasta os direitos que a lei imperativa te garante como consumidor."
          }
        ]
      },
      {
        "titulo": "10. Encerramento",
        "blocos": [
          {
            "tipo": "p",
            "texto": "Podes apagar a tua conta a qualquer momento. Podemos suspender ou encerrar contas que violem estes Termos."
          }
        ]
      },
      {
        "titulo": "11. Alterações",
        "blocos": [
          {
            "tipo": "p",
            "texto": "Podemos atualizar estes Termos. Mudamos a data no topo e, se a alteração for importante, avisamos na aplicação. Continuar a usar depois disso significa que aceitas os novos Termos."
          }
        ]
      },
      {
        "titulo": "12. Lei aplicável e resolução de litígios",
        "blocos": [
          {
            "tipo": "p",
            "texto": "Estes Termos regem-se pela **lei portuguesa**. Os litígios de consumo podem ser submetidos à plataforma de Resolução de Litígios em Linha da União Europeia (**ec.europa.eu/consumers/odr**) e às entidades de resolução alternativa de litígios de consumo competentes em Portugal."
          }
        ]
      },
      {
        "titulo": "13. Contacto",
        "blocos": [
          {
            "tipo": "p",
            "texto": "**support@ipponleague.com**"
          }
        ]
      }
    ]
  },
  "en": {
    "titulo": "Terms of Use — Ippon League",
    "atualizado": "10 September 2026",
    "versao": "1.0",
    "oficial": "**Official version:** these Terms were drafted in Portuguese, which is the official version. Translations into other languages are provided for convenience; in case of any discrepancy, the Portuguese version prevails.",
    "seccoes": [
      {
        "titulo": "1. Acceptance",
        "blocos": [
          {
            "tipo": "p",
            "texto": "By creating an account or using Ippon League (**www.ipponleague.com**), you accept these Terms of Use and the Privacy Policy. If you do not agree, do not use the service."
          },
          {
            "tipo": "p",
            "texto": "Ippon League is operated by **Kainan Pires**, an individual, in **Portugal**. Contact: **support@ipponleague.com**."
          }
        ]
      },
      {
        "titulo": "2. What Ippon League is",
        "blocos": [
          {
            "tipo": "p",
            "texto": "Ippon League is an online fantasy game inspired by judo: you build a team of athletes, choose a captain, and score based on the athletes' real actions in international competitions. It is entertainment — a game and community layer on top of world judo."
          },
          {
            "tipo": "p",
            "texto": "Ippon League is **not affiliated with, sponsored by, or endorsed by** the IJF, JudoBase, or any athlete or federation. Athlete names and results are public sporting facts, used for informational purposes."
          }
        ]
      },
      {
        "titulo": "3. Eligibility and account",
        "blocos": [
          {
            "tipo": "lista",
            "itens": [
              "You must be **13 or older** to use Ippon League. At registration your date of birth is requested; anyone under 13 cannot create an account.",
              "You are responsible for keeping your password secure and for everything that happens on your account.",
              "You give truthful information when you register.",
              "One person must not create several accounts to gain advantages (for example, repeating the free trial)."
            ]
          }
        ]
      },
      {
        "titulo": "4. Judocoins and the nature of the game",
        "blocos": [
          {
            "tipo": "lista",
            "itens": [
              "**Judocoins (JC)** are a virtual in-game currency, with no monetary value. They cannot be bought, sold, converted into money, or transferred.",
              "Ippon League is **not gambling or a game of chance**. You do not bet money, there are no cash prizes dependent on luck, and the paid subscription gives access to features — never to higher chances of winning money.",
              "Ippon League may award prizes in certain leagues (for example, per-round and end-of-season prizes in the World League, and end-of-season prizes in the Continental League). The prizes, eligibility conditions, and how they are awarded are defined each season, may depend on sponsors, and may change. Eligibility may be linked to the Ippon Pro subscription."
            ]
          }
        ]
      },
      {
        "titulo": "5. Ippon Pro and Ippon Pro Max subscriptions",
        "blocos": [
          {
            "tipo": "lista",
            "itens": [
              "Ippon Pro and Ippon Pro Max are **monthly** subscriptions that renew automatically until you cancel.",
              "Anyone who has never subscribed gets a **7-day free trial**. There is only one trial per person.",
              "The price is what appears on the subscription screen at the time you subscribe. Payment and applicable taxes are handled by **Stripe**.",
              "By subscribing, you declare that you are of legal age and have the legal capacity to contract or, where applicable, the authorisation of the holder of the payment method you use.",
              "**Cancellation:** you can cancel at any time in your profile.",
              "During the free trial, cancelling turns off renewal and keeps access until the end of the 7 days, with no charge.",
              "After the trial, cancelling keeps access until the end of the monthly period already paid; there is no new charge and access ends on that date.",
              "**Refunds:** because this is digital content with immediate access, and there is a free trial period, amounts already charged for an ongoing period are, as a rule, not refunded, except where the law requires it. Your consumer rights under Portuguese and EU law remain unaffected."
            ]
          },
          {
            "tipo": "lista",
            "itens": [
              "**Ippon Pro is informational and does not guarantee results.** It gives access to information based on data and on athletes' history (past results and performance trends). It does not build your team, does not tell you who to bet on, and does not say who will win. By subscribing, you accept that Ippon Pro is merely informational and does not guarantee any result — not wins, not points, not belt promotion, not prizes. The readings we show are possibilities and trends, never certainties, and the decision is always yours."
            ]
          }
        ]
      },
      {
        "titulo": "6. Acceptable use",
        "blocos": [
          {
            "tipo": "p",
            "texto": "You agree not to: cheat or exploit bugs; access the service by unauthorised automated means (bots, scraping) beyond normal use; try to bypass payment or Pro access; disrupt operation; use offensive, illegal, or third-party-rights-infringing language or content in your team name, crest, or other content you enter."
          }
        ]
      },
      {
        "titulo": "7. Content and intellectual property",
        "blocos": [
          {
            "tipo": "lista",
            "itens": [
              "The application, the \"Ippon League\" brand, the mascot (the Dôdo), the design, and the code are ours or our licensors'. You may not copy or reuse them without authorisation.",
              "The content you create (team name, crest) remains your responsibility; by entering it, you give us permission to display it within the game. You may not use offensive content or content that infringes third-party rights.",
              "Athlete and competition data comes from public sources (IJF/JudoBase) and is used on a factual and informational basis."
            ]
          }
        ]
      },
      {
        "titulo": "8. Third-party data and availability",
        "blocos": [
          {
            "tipo": "lista",
            "itens": [
              "Scoring and tracking depend on third-party data, which may contain errors, delays, or gaps. We do our best to correct and complete it (including manual corrections), but **we do not guarantee** that the data is always complete or correct in real time.",
              "The service is provided \"as is\". We may change, suspend, or discontinue features, and we do not guarantee uninterrupted availability."
            ]
          }
        ]
      },
      {
        "titulo": "9. Liability",
        "blocos": [
          {
            "tipo": "p",
            "texto": "To the maximum extent permitted by law, we are not liable for indirect damages resulting from use of the game. Nothing in these Terms removes the rights that mandatory law guarantees you as a consumer."
          }
        ]
      },
      {
        "titulo": "10. Termination",
        "blocos": [
          {
            "tipo": "p",
            "texto": "You can delete your account at any time. We may suspend or terminate accounts that violate these Terms."
          }
        ]
      },
      {
        "titulo": "11. Changes",
        "blocos": [
          {
            "tipo": "p",
            "texto": "We may update these Terms. We change the date at the top and, if the change is significant, we notify you in the app. Continuing to use it afterwards means you accept the new Terms."
          }
        ]
      },
      {
        "titulo": "12. Governing law and dispute resolution",
        "blocos": [
          {
            "tipo": "p",
            "texto": "These Terms are governed by **Portuguese law**. Consumer disputes may be submitted to the European Union's Online Dispute Resolution platform (**ec.europa.eu/consumers/odr**) and to the competent alternative consumer dispute resolution bodies in Portugal."
          }
        ]
      },
      {
        "titulo": "13. Contact",
        "blocos": [
          {
            "tipo": "p",
            "texto": "**support@ipponleague.com**"
          }
        ]
      }
    ]
  },
  "es": {
    "titulo": "Términos de Uso — Ippon League",
    "atualizado": "10 de septiembre de 2026",
    "versao": "1.0",
    "oficial": "**Versión oficial:** estos Términos fueron redactados en portugués, que es la versión oficial. Las traducciones a otros idiomas se ofrecen por conveniencia; en caso de discrepancia, prevalece la versión portuguesa.",
    "seccoes": [
      {
        "titulo": "1. Aceptación",
        "blocos": [
          {
            "tipo": "p",
            "texto": "Al crear una cuenta o usar Ippon League (**www.ipponleague.com**), aceptas estos Términos de Uso y la Política de Privacidad. Si no estás de acuerdo, no uses el servicio."
          },
          {
            "tipo": "p",
            "texto": "Ippon League está operada por **Kainan Pires**, persona física, en **Portugal**. Contacto: **support@ipponleague.com**."
          }
        ]
      },
      {
        "titulo": "2. Qué es Ippon League",
        "blocos": [
          {
            "tipo": "p",
            "texto": "Ippon League es un juego de fantasy en línea inspirado en el judo: montas un equipo de atletas, eliges un capitán y puntúas según las acciones reales de los atletas en las competiciones internacionales. Es entretenimiento — una capa de juego y comunidad sobre el judo mundial."
          },
          {
            "tipo": "p",
            "texto": "Ippon League **no está afiliada, patrocinada ni respaldada** por la IJF, por JudoBase, ni por ningún atleta o federación. Los nombres y resultados de atletas son hechos deportivos públicos, usados a título informativo."
          }
        ]
      },
      {
        "titulo": "3. Elegibilidad y cuenta",
        "blocos": [
          {
            "tipo": "lista",
            "itens": [
              "Tienes que tener **13 años o más** para usar Ippon League. En el registro se pide la fecha de nacimiento; quien tenga menos de 13 años no puede crear cuenta.",
              "Eres responsable de mantener tu contraseña segura y de todo lo que ocurra en tu cuenta.",
              "Das información veraz al registrarte.",
              "Una persona no debe crear varias cuentas para obtener ventajas (por ejemplo, repetir el periodo de prueba gratuito)."
            ]
          }
        ]
      },
      {
        "titulo": "4. Judocoins y naturaleza del juego",
        "blocos": [
          {
            "tipo": "lista",
            "itens": [
              "Los **Judocoins (JC)** son una moneda virtual del juego, sin ningún valor monetario. No se compran, no se venden, no se convierten en dinero y no son transferibles.",
              "Ippon League **no es una apuesta ni un juego de azar**. No apuestas dinero, no hay premios en efectivo dependientes de la suerte, y la suscripción de pago da acceso a funcionalidades — nunca a mayores probabilidades de ganar dinero.",
              "Ippon League puede otorgar premios en determinadas ligas (por ejemplo, premios por jornada y de fin de temporada en la Liga Mundial, y de fin de temporada en la Liga Continental). Los premios, las condiciones de elegibilidad y las formas de atribución se definen cada temporada, pueden depender de patrocinadores y pueden cambiar. La elegibilidad puede estar asociada a la suscripción Ippon Pro."
            ]
          }
        ]
      },
      {
        "titulo": "5. Suscripción Ippon Pro e Ippon Pro Max",
        "blocos": [
          {
            "tipo": "lista",
            "itens": [
              "Ippon Pro e Ippon Pro Max son suscripciones **mensuales** que se renuevan automáticamente hasta que las canceles.",
              "Quien nunca se ha suscrito tiene **7 días de prueba gratuita**. Solo hay una prueba por persona.",
              "El precio es el que aparece en la pantalla de suscripción en el momento en que te suscribes. El pago y los impuestos aplicables los gestiona **Stripe**.",
              "Al suscribirte, declaras tener edad y capacidad legal para contratar o, si procede, la autorización del titular del medio de pago que utilices.",
              "**Cancelación:** puedes cancelar en cualquier momento en tu perfil.",
              "Durante la prueba gratuita, cancelar desactiva la renovación y mantiene el acceso hasta el final de los 7 días, sin ningún cobro.",
              "Después de la prueba, cancelar mantiene el acceso hasta el final del periodo mensual ya pagado; no hay nuevo cobro y el acceso termina en esa fecha.",
              "**Reembolsos:** por tratarse de contenido digital de acceso inmediato, y existiendo un periodo de prueba gratuita, los importes ya cobrados de un periodo en curso no se reembolsan, por regla general, salvo cuando la ley lo exija. Tus derechos de consumidor al amparo de la ley portuguesa y de la UE se mantienen."
            ]
          },
          {
            "tipo": "lista",
            "itens": [
              "**Ippon Pro es informativo y no garantiza resultados.** Da acceso a información basada en datos y en el historial de los atletas (resultados pasados y tendencias de rendimiento). No monta tu equipo, no indica a quién apostar y no dice quién va a ganar. Al suscribirte, aceptas que Ippon Pro es meramente informativo y no garantiza ningún resultado — ni victorias, ni puntuación, ni subida de cinturón, ni premios. Las lecturas que mostramos son posibilidades y tendencias, nunca certezas, y la decisión es siempre tuya."
            ]
          }
        ]
      },
      {
        "titulo": "6. Uso aceptable",
        "blocos": [
          {
            "tipo": "p",
            "texto": "Aceptas no: hacer trampas o explotar fallos; acceder al servicio por medios automáticos no autorizados (bots, scraping) más allá del uso normal; intentar eludir el pago o el acceso Pro; perturbar el funcionamiento; usar lenguaje o contenidos ofensivos, ilegales o que violen derechos de terceros en el nombre del equipo, escudo u otros contenidos que introduzcas."
          }
        ]
      },
      {
        "titulo": "7. Contenidos y propiedad intelectual",
        "blocos": [
          {
            "tipo": "lista",
            "itens": [
              "La aplicación, la marca «Ippon League», la mascota (el Dôdo), el diseño y el código son nuestros o de nuestros licenciantes. No puedes copiarlos ni reutilizarlos sin autorización.",
              "Los contenidos que creas (nombre del equipo, escudo) siguen siendo de tu responsabilidad; al introducirlos, nos das autorización para mostrarlos dentro del juego. No puedes usar contenidos ofensivos o que violen derechos de terceros.",
              "Los datos de atletas y competiciones provienen de fuentes públicas (IJF/JudoBase) y se usan a título factual e informativo."
            ]
          }
        ]
      },
      {
        "titulo": "8. Datos de terceros y disponibilidad",
        "blocos": [
          {
            "tipo": "lista",
            "itens": [
              "La puntuación y el seguimiento dependen de datos de terceros, que pueden tener errores, retrasos o lagunas. Hacemos lo posible por corregir y completar (incluyendo correcciones manuales), pero **no garantizamos** que los datos estén siempre completos o correctos en tiempo real.",
              "El servicio se proporciona «tal cual». Podemos cambiar, suspender o descontinuar funcionalidades, y no garantizamos disponibilidad ininterrumpida."
            ]
          }
        ]
      },
      {
        "titulo": "9. Responsabilidad",
        "blocos": [
          {
            "tipo": "p",
            "texto": "En la medida máxima permitida por la ley, no somos responsables de daños indirectos derivados del uso del juego. Nada en estos Términos elimina los derechos que la ley imperativa te garantiza como consumidor."
          }
        ]
      },
      {
        "titulo": "10. Cierre",
        "blocos": [
          {
            "tipo": "p",
            "texto": "Puedes eliminar tu cuenta en cualquier momento. Podemos suspender o cerrar cuentas que violen estos Términos."
          }
        ]
      },
      {
        "titulo": "11. Cambios",
        "blocos": [
          {
            "tipo": "p",
            "texto": "Podemos actualizar estos Términos. Cambiamos la fecha en la parte superior y, si el cambio es importante, avisamos en la aplicación. Continuar usándola después de eso significa que aceptas los nuevos Términos."
          }
        ]
      },
      {
        "titulo": "12. Ley aplicable y resolución de litigios",
        "blocos": [
          {
            "tipo": "p",
            "texto": "Estos Términos se rigen por la **ley portuguesa**. Los litigios de consumo pueden someterse a la plataforma de Resolución de Litigios en Línea de la Unión Europea (**ec.europa.eu/consumers/odr**) y a las entidades de resolución alternativa de litigios de consumo competentes en Portugal."
          }
        ]
      },
      {
        "titulo": "13. Contacto",
        "blocos": [
          {
            "tipo": "p",
            "texto": "**support@ipponleague.com**"
          }
        ]
      }
    ]
  },
  "fr": {
    "titulo": "Conditions d'Utilisation — Ippon League",
    "atualizado": "10 septembre 2026",
    "versao": "1.0",
    "oficial": "**Version officielle :** ces Conditions ont été rédigées en portugais, qui est la version officielle. Les traductions dans d'autres langues sont fournies par commodité ; en cas de divergence, la version portugaise prévaut.",
    "seccoes": [
      {
        "titulo": "1. Acceptation",
        "blocos": [
          {
            "tipo": "p",
            "texto": "En créant un compte ou en utilisant Ippon League (**www.ipponleague.com**), tu acceptes ces Conditions d'Utilisation et la Politique de Confidentialité. Si tu n'es pas d'accord, n'utilise pas le service."
          },
          {
            "tipo": "p",
            "texto": "Ippon League est exploitée par **Kainan Pires**, personne physique, au **Portugal**. Contact : **support@ipponleague.com**."
          }
        ]
      },
      {
        "titulo": "2. Ce qu'est Ippon League",
        "blocos": [
          {
            "tipo": "p",
            "texto": "Ippon League est un jeu de fantasy en ligne inspiré du judo : tu montes une équipe d'athlètes, tu choisis un capitaine, et tu marques des points selon les actions réelles des athlètes lors des compétitions internationales. C'est du divertissement — une couche de jeu et de communauté par-dessus le judo mondial."
          },
          {
            "tipo": "p",
            "texto": "Ippon League **n'est pas affiliée, parrainée ni approuvée** par l'IJF, par JudoBase, ni par aucun athlète ou fédération. Les noms et résultats des athlètes sont des faits sportifs publics, utilisés à titre informatif."
          }
        ]
      },
      {
        "titulo": "3. Éligibilité et compte",
        "blocos": [
          {
            "tipo": "lista",
            "itens": [
              "Tu dois avoir **13 ans ou plus** pour utiliser Ippon League. Lors de l'inscription, la date de naissance est demandée ; toute personne de moins de 13 ans ne peut pas créer de compte.",
              "Tu es responsable de garder ton mot de passe sécurisé et de tout ce qui se passe sur ton compte.",
              "Tu fournis des informations véridiques lors de l'inscription.",
              "Une personne ne doit pas créer plusieurs comptes pour obtenir des avantages (par exemple, répéter la période d'essai gratuite)."
            ]
          }
        ]
      },
      {
        "titulo": "4. Judocoins et nature du jeu",
        "blocos": [
          {
            "tipo": "lista",
            "itens": [
              "Les **Judocoins (JC)** sont une monnaie virtuelle du jeu, sans aucune valeur monétaire. Ils ne s'achètent pas, ne se vendent pas, ne se convertissent pas en argent et ne sont pas transférables.",
              "Ippon League **n'est pas un pari ni un jeu de hasard**. Tu ne paries pas d'argent, il n'y a pas de prix en espèces dépendant de la chance, et l'abonnement payant donne accès à des fonctionnalités — jamais à de plus grandes chances de gagner de l'argent.",
              "Ippon League peut attribuer des prix dans certaines ligues (par exemple, des prix par journée et de fin de saison dans la Ligue Mondiale, et de fin de saison dans la Ligue Continentale). Les prix, les conditions d'éligibilité et les modalités d'attribution sont définis chaque saison, peuvent dépendre de partenaires et peuvent changer. L'éligibilité peut être liée à l'abonnement Ippon Pro."
            ]
          }
        ]
      },
      {
        "titulo": "5. Abonnement Ippon Pro et Ippon Pro Max",
        "blocos": [
          {
            "tipo": "lista",
            "itens": [
              "Ippon Pro et Ippon Pro Max sont des abonnements **mensuels** qui se renouvellent automatiquement jusqu'à ce que tu les annules.",
              "Quiconque ne s'est jamais abonné bénéficie de **7 jours d'essai gratuit**. Il n'y a qu'un essai par personne.",
              "Le prix est celui qui apparaît sur l'écran d'abonnement au moment où tu t'abonnes. Le paiement et les taxes applicables sont gérés par **Stripe**.",
              "En t'abonnant, tu déclares avoir l'âge et la capacité juridique de contracter ou, le cas échéant, l'autorisation du titulaire du moyen de paiement que tu utilises.",
              "**Annulation :** tu peux annuler à tout moment dans ton profil.",
              "Pendant l'essai gratuit, annuler désactive le renouvellement et maintient l'accès jusqu'à la fin des 7 jours, sans aucun débit.",
              "Après l'essai, annuler maintient l'accès jusqu'à la fin de la période mensuelle déjà payée ; il n'y a pas de nouveau débit et l'accès prend fin à cette date.",
              "**Remboursements :** s'agissant de contenu numérique d'accès immédiat, et en présence d'une période d'essai gratuite, les montants déjà débités pour une période en cours ne sont, en règle générale, pas remboursés, sauf lorsque la loi l'exige. Tes droits de consommateur au titre de la loi portugaise et de l'UE restent inchangés."
            ]
          },
          {
            "tipo": "lista",
            "itens": [
              "**Ippon Pro est informatif et ne garantit pas de résultats.** Il donne accès à des informations fondées sur des données et sur l'historique des athlètes (résultats passés et tendances de performance). Il ne compose pas ton équipe, n'indique pas sur qui parier et ne dit pas qui va gagner. En t'abonnant, tu acceptes qu'Ippon Pro est purement informatif et ne garantit aucun résultat — ni victoires, ni points, ni passage de ceinture, ni prix. Les lectures que nous montrons sont des possibilités et des tendances, jamais des certitudes, et la décision t'appartient toujours."
            ]
          }
        ]
      },
      {
        "titulo": "6. Utilisation acceptable",
        "blocos": [
          {
            "tipo": "p",
            "texto": "Tu acceptes de ne pas : tricher ou exploiter des failles ; accéder au service par des moyens automatiques non autorisés (bots, scraping) au-delà d'un usage normal ; tenter de contourner le paiement ou l'accès Pro ; perturber le fonctionnement ; utiliser un langage ou des contenus offensants, illégaux ou portant atteinte aux droits de tiers dans le nom de l'équipe, le blason ou d'autres contenus que tu insères."
          }
        ]
      },
      {
        "titulo": "7. Contenus et propriété intellectuelle",
        "blocos": [
          {
            "tipo": "lista",
            "itens": [
              "L'application, la marque « Ippon League », la mascotte (le Dôdo), le design et le code nous appartiennent ou appartiennent à nos concédants. Tu ne peux pas les copier ni les réutiliser sans autorisation.",
              "Les contenus que tu crées (nom de l'équipe, blason) restent sous ta responsabilité ; en les insérant, tu nous donnes l'autorisation de les afficher dans le jeu. Tu ne peux pas utiliser de contenus offensants ou portant atteinte aux droits de tiers.",
              "Les données des athlètes et des compétitions proviennent de sources publiques (IJF/JudoBase) et sont utilisées à titre factuel et informatif."
            ]
          }
        ]
      },
      {
        "titulo": "8. Données de tiers et disponibilité",
        "blocos": [
          {
            "tipo": "lista",
            "itens": [
              "Le score et le suivi dépendent de données de tiers, qui peuvent comporter des erreurs, des retards ou des lacunes. Nous faisons de notre mieux pour corriger et compléter (y compris par des corrections manuelles), mais **nous ne garantissons pas** que les données soient toujours complètes ou correctes en temps réel.",
              "Le service est fourni « tel quel ». Nous pouvons modifier, suspendre ou interrompre des fonctionnalités, et nous ne garantissons pas une disponibilité ininterrompue."
            ]
          }
        ]
      },
      {
        "titulo": "9. Responsabilité",
        "blocos": [
          {
            "tipo": "p",
            "texto": "Dans la mesure maximale permise par la loi, nous ne sommes pas responsables des dommages indirects résultant de l'utilisation du jeu. Rien dans ces Conditions n'écarte les droits que la loi impérative te garantit en tant que consommateur."
          }
        ]
      },
      {
        "titulo": "10. Résiliation",
        "blocos": [
          {
            "tipo": "p",
            "texto": "Tu peux supprimer ton compte à tout moment. Nous pouvons suspendre ou fermer les comptes qui violent ces Conditions."
          }
        ]
      },
      {
        "titulo": "11. Modifications",
        "blocos": [
          {
            "tipo": "p",
            "texto": "Nous pouvons mettre à jour ces Conditions. Nous changeons la date en haut et, si le changement est important, nous t'informons dans l'application. Continuer à l'utiliser après cela signifie que tu acceptes les nouvelles Conditions."
          }
        ]
      },
      {
        "titulo": "12. Loi applicable et résolution des litiges",
        "blocos": [
          {
            "tipo": "p",
            "texto": "Ces Conditions sont régies par la **loi portugaise**. Les litiges de consommation peuvent être soumis à la plateforme de Règlement en Ligne des Litiges de l'Union Européenne (**ec.europa.eu/consumers/odr**) et aux entités de règlement extrajudiciaire des litiges de consommation compétentes au Portugal."
          }
        ]
      },
      {
        "titulo": "13. Contact",
        "blocos": [
          {
            "tipo": "p",
            "texto": "**support@ipponleague.com**"
          }
        ]
      }
    ]
  },
  "de": {
    "titulo": "Nutzungsbedingungen — Ippon League",
    "atualizado": "10. September 2026",
    "versao": "1.0",
    "oficial": "**Offizielle Fassung:** Diese Bedingungen wurden auf Portugiesisch verfasst, was die offizielle Fassung ist. Übersetzungen in andere Sprachen werden aus Gründen der Zweckmäßigkeit bereitgestellt; im Falle von Abweichungen ist die portugiesische Fassung maßgeblich.",
    "seccoes": [
      {
        "titulo": "1. Annahme",
        "blocos": [
          {
            "tipo": "p",
            "texto": "Indem du ein Konto erstellst oder Ippon League (**www.ipponleague.com**) nutzt, akzeptierst du diese Nutzungsbedingungen und die Datenschutzerklärung. Wenn du nicht einverstanden bist, nutze den Dienst nicht."
          },
          {
            "tipo": "p",
            "texto": "Ippon League wird von **Kainan Pires**, einer natürlichen Person, in **Portugal** betrieben. Kontakt: **support@ipponleague.com**."
          }
        ]
      },
      {
        "titulo": "2. Was Ippon League ist",
        "blocos": [
          {
            "tipo": "p",
            "texto": "Ippon League ist ein vom Judo inspiriertes Online-Fantasy-Spiel: Du stellst ein Team von Athleten auf, wählst einen Kapitän und erzielst Punkte anhand der realen Aktionen der Athleten bei internationalen Wettkämpfen. Es ist Unterhaltung — eine Spiel- und Community-Ebene über dem Welt-Judo."
          },
          {
            "tipo": "p",
            "texto": "Ippon League ist **nicht mit der IJF, JudoBase oder einem Athleten oder Verband verbunden, wird von diesen nicht gesponsert und nicht unterstützt**. Athletennamen und -ergebnisse sind öffentliche sportliche Fakten, die zu Informationszwecken verwendet werden."
          }
        ]
      },
      {
        "titulo": "3. Berechtigung und Konto",
        "blocos": [
          {
            "tipo": "lista",
            "itens": [
              "Du musst **13 Jahre oder älter** sein, um Ippon League zu nutzen. Bei der Registrierung wird das Geburtsdatum abgefragt; wer jünger als 13 Jahre ist, kann kein Konto erstellen.",
              "Du bist dafür verantwortlich, dein Passwort sicher zu halten und für alles, was auf deinem Konto geschieht.",
              "Du gibst bei der Registrierung wahrheitsgemäße Informationen an.",
              "Eine Person darf nicht mehrere Konten erstellen, um Vorteile zu erlangen (zum Beispiel die kostenlose Testphase zu wiederholen)."
            ]
          }
        ]
      },
      {
        "titulo": "4. Judocoins und Natur des Spiels",
        "blocos": [
          {
            "tipo": "lista",
            "itens": [
              "Die **Judocoins (JC)** sind eine virtuelle Spielwährung ohne jeglichen Geldwert. Sie können nicht gekauft, verkauft, in Geld umgewandelt oder übertragen werden.",
              "Ippon League ist **keine Wette und kein Glücksspiel**. Du setzt kein Geld ein, es gibt keine vom Zufall abhängigen Geldpreise, und das kostenpflichtige Abonnement gibt Zugang zu Funktionen — niemals zu höheren Chancen, Geld zu gewinnen.",
              "Ippon League kann in bestimmten Ligen Preise vergeben (zum Beispiel Preise pro Runde und zum Saisonende in der Welt-Liga sowie zum Saisonende in der Kontinental-Liga). Die Preise, die Teilnahmebedingungen und die Art der Vergabe werden je Saison festgelegt, können von Sponsoren abhängen und können sich ändern. Die Berechtigung kann an das Ippon-Pro-Abonnement geknüpft sein."
            ]
          }
        ]
      },
      {
        "titulo": "5. Abonnement Ippon Pro und Ippon Pro Max",
        "blocos": [
          {
            "tipo": "lista",
            "itens": [
              "Ippon Pro und Ippon Pro Max sind **monatliche** Abonnements, die sich automatisch verlängern, bis du sie kündigst.",
              "Wer noch nie abonniert hat, erhält **7 Tage kostenlose Testphase**. Es gibt nur eine Testphase pro Person.",
              "Der Preis ist der, der zum Zeitpunkt deines Abonnements auf dem Abonnement-Bildschirm erscheint. Zahlung und anwendbare Steuern werden von **Stripe** abgewickelt.",
              "Mit dem Abonnement erklärst du, das gesetzliche Alter und die gesetzliche Fähigkeit zum Vertragsabschluss zu haben oder, sofern zutreffend, die Zustimmung des Inhabers des von dir verwendeten Zahlungsmittels.",
              "**Kündigung:** Du kannst jederzeit in deinem Profil kündigen.",
              "Während der kostenlosen Testphase deaktiviert eine Kündigung die Verlängerung und behält den Zugang bis zum Ende der 7 Tage, ohne jegliche Belastung.",
              "Nach der Testphase behält eine Kündigung den Zugang bis zum Ende des bereits bezahlten Monatszeitraums; es erfolgt keine neue Belastung und der Zugang endet an diesem Datum.",
              "**Erstattungen:** Da es sich um digitale Inhalte mit sofortigem Zugang handelt und eine kostenlose Testphase besteht, werden bereits berechnete Beträge für einen laufenden Zeitraum in der Regel nicht erstattet, außer wo das Gesetz es verlangt. Deine Verbraucherrechte nach portugiesischem und EU-Recht bleiben unberührt."
            ]
          },
          {
            "tipo": "lista",
            "itens": [
              "**Ippon Pro ist informativ und garantiert keine Ergebnisse.** Es gibt Zugang zu Informationen auf Basis von Daten und der Historie der Athleten (frühere Ergebnisse und Leistungstrends). Es stellt nicht dein Team zusammen, sagt dir nicht, auf wen du setzen sollst, und sagt nicht, wer gewinnen wird. Mit dem Abonnement akzeptierst du, dass Ippon Pro rein informativ ist und kein Ergebnis garantiert — weder Siege noch Punkte noch Gürtelaufstieg noch Preise. Die angezeigten Einschätzungen sind Möglichkeiten und Trends, niemals Gewissheiten, und die Entscheidung liegt immer bei dir."
            ]
          }
        ]
      },
      {
        "titulo": "6. Zulässige Nutzung",
        "blocos": [
          {
            "tipo": "p",
            "texto": "Du stimmst zu, nicht: zu betrügen oder Fehler auszunutzen; auf den Dienst durch nicht autorisierte automatisierte Mittel (Bots, Scraping) über die normale Nutzung hinaus zuzugreifen; zu versuchen, die Zahlung oder den Pro-Zugang zu umgehen; den Betrieb zu stören; beleidigende, illegale oder Rechte Dritter verletzende Sprache oder Inhalte im Teamnamen, Wappen oder anderen von dir eingefügten Inhalten zu verwenden."
          }
        ]
      },
      {
        "titulo": "7. Inhalte und geistiges Eigentum",
        "blocos": [
          {
            "tipo": "lista",
            "itens": [
              "Die Anwendung, die Marke „Ippon League\", das Maskottchen (der Dôdo), das Design und der Code gehören uns oder unseren Lizenzgebern. Du darfst sie ohne Genehmigung nicht kopieren oder wiederverwenden.",
              "Die von dir erstellten Inhalte (Teamname, Wappen) bleiben in deiner Verantwortung; indem du sie einfügst, gibst du uns die Erlaubnis, sie innerhalb des Spiels anzuzeigen. Du darfst keine beleidigenden oder Rechte Dritter verletzenden Inhalte verwenden.",
              "Athleten- und Wettkampfdaten stammen aus öffentlichen Quellen (IJF/JudoBase) und werden auf faktischer und informativer Basis verwendet."
            ]
          }
        ]
      },
      {
        "titulo": "8. Daten Dritter und Verfügbarkeit",
        "blocos": [
          {
            "tipo": "lista",
            "itens": [
              "Punktevergabe und Verfolgung hängen von Daten Dritter ab, die Fehler, Verzögerungen oder Lücken enthalten können. Wir tun unser Bestes, um zu korrigieren und zu vervollständigen (einschließlich manueller Korrekturen), aber **wir garantieren nicht**, dass die Daten immer vollständig oder in Echtzeit korrekt sind.",
              "Der Dienst wird „wie besehen\" bereitgestellt. Wir können Funktionen ändern, aussetzen oder einstellen, und wir garantieren keine ununterbrochene Verfügbarkeit."
            ]
          }
        ]
      },
      {
        "titulo": "9. Haftung",
        "blocos": [
          {
            "tipo": "p",
            "texto": "Im gesetzlich maximal zulässigen Umfang haften wir nicht für indirekte Schäden, die aus der Nutzung des Spiels entstehen. Nichts in diesen Bedingungen schließt die Rechte aus, die dir das zwingende Recht als Verbraucher garantiert."
          }
        ]
      },
      {
        "titulo": "10. Beendigung",
        "blocos": [
          {
            "tipo": "p",
            "texto": "Du kannst dein Konto jederzeit löschen. Wir können Konten, die gegen diese Bedingungen verstoßen, aussetzen oder schließen."
          }
        ]
      },
      {
        "titulo": "11. Änderungen",
        "blocos": [
          {
            "tipo": "p",
            "texto": "Wir können diese Bedingungen aktualisieren. Wir ändern das Datum oben und informieren dich, falls die Änderung wesentlich ist, in der Anwendung. Die weitere Nutzung danach bedeutet, dass du die neuen Bedingungen akzeptierst."
          }
        ]
      },
      {
        "titulo": "12. Anwendbares Recht und Streitbeilegung",
        "blocos": [
          {
            "tipo": "p",
            "texto": "Diese Bedingungen unterliegen dem **portugiesischen Recht**. Verbraucherstreitigkeiten können der Plattform zur Online-Streitbeilegung der Europäischen Union (**ec.europa.eu/consumers/odr**) und den zuständigen Stellen zur alternativen Verbraucherstreitbeilegung in Portugal vorgelegt werden."
          }
        ]
      },
      {
        "titulo": "13. Kontakt",
        "blocos": [
          {
            "tipo": "p",
            "texto": "**support@ipponleague.com**"
          }
        ]
      }
    ]
  }
};

// Idade mínima para criar conta (ver secção "Menores" da Política e secção
// "Elegibilidade" dos Termos). É verificada no registo (app/comecar).
export const IDADE_MINIMA = 13;

// Frases de interface das páginas legais e a mensagem de idade no registo.
// Vivem aqui (e não no i18n) para todo o conteúdo legal ficar num só ficheiro.
export const LEGAL_UI: Record<Lingua, {
  atualizado: string;
  versao: string;
  desatualizada: string;
  verOficial: string;
  idadeMinima: string;
  voltar: string;
}> = {
  pt: {
    atualizado: "Última atualização",
    versao: "Versão",
    desatualizada: "Esta tradução pode estar desatualizada. A versão oficial e atual está em português.",
    verOficial: "Ver versão oficial (português)",
    idadeMinima: "Tens de ter pelo menos 13 anos para criar conta.",
    voltar: "Voltar",
  },
  en: {
    atualizado: "Last updated",
    versao: "Version",
    desatualizada: "This translation may be out of date. The official, current version is in Portuguese.",
    verOficial: "View official version (Portuguese)",
    idadeMinima: "You must be at least 13 to create an account.",
    voltar: "Back",
  },
  es: {
    atualizado: "Última actualización",
    versao: "Versión",
    desatualizada: "Esta traducción puede estar desactualizada. La versión oficial y actual está en portugués.",
    verOficial: "Ver versión oficial (portugués)",
    idadeMinima: "Tienes que tener al menos 13 años para crear una cuenta.",
    voltar: "Volver",
  },
  fr: {
    atualizado: "Dernière mise à jour",
    versao: "Version",
    desatualizada: "Cette traduction peut être obsolète. La version officielle et à jour est en portugais.",
    verOficial: "Voir la version officielle (portugais)",
    idadeMinima: "Tu dois avoir au moins 13 ans pour créer un compte.",
    voltar: "Retour",
  },
  de: {
    atualizado: "Letzte Aktualisierung",
    versao: "Version",
    desatualizada: "Diese Übersetzung ist möglicherweise veraltet. Die offizielle und aktuelle Fassung ist auf Portugiesisch.",
    verOficial: "Offizielle Fassung ansehen (Portugiesisch)",
    idadeMinima: "Du musst mindestens 13 Jahre alt sein, um ein Konto zu erstellen.",
    voltar: "Zurück",
  },
};
