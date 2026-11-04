# MOBILE_AUDIT.md — Auditoria técnica da Ippon League

**Data:** 4 nov 2026 · **Fase:** 1 (só leitura, nada alterado)
**Fonte:** repositório público `github.com/KainanPires/ippon-league`, branch principal, último commit `7522f29` (31 out 2026), 1679 commits analisados.
**Limitações:** não tive acesso à Vercel, à Supabase, à Stripe nem ao site em funcionamento (o domínio está bloqueado na rede deste ambiente). Não corri `npm install` nem `next build`. Tudo o que está abaixo vem da leitura do código.

---

## 1. Diagnóstico da tecnologia atual

| Área | O que encontrei | Evidência |
|---|---|---|
| Framework | **Next.js 16.2.7** (App Router) + **React 19.2** + TypeScript | `package.json` |
| Estilos | Tailwind CSS 4 + estilos inline | `postcss.config.mjs`, componentes |
| Frontend | 50 páginas, **48 são `"use client"`** | `app/**/page.tsx` |
| Backend | **102 API routes** dentro do próprio Next.js (`app/api/**/route.ts`) | `app/api/` |
| Base de dados | **Supabase** (Postgres). O browser usa a chave pública; o servidor usa `SUPABASE_SECRET_KEY` | `lib/supabase.ts`, `lib/supabaseAdmin.ts` |
| Autenticação | Supabase Auth: **email + password** (`signUp`, `signInWithPassword`, `resetPasswordForEmail`). Não há login com Google/Apple | `app/entrar`, `app/comecar`, `app/redefinir-senha` |
| Sessão | Guardada pelo cliente Supabase no `localStorage`; as APIs recebem `Authorization: Bearer <token>` | `lib/auth.ts`, rotas `uidDoPedido()` |
| Hosting/deploy | **Vercel** (cron diário às 06:00 em `/api/cron`) | `vercel.json` |
| Academy | Deploy separado em `academy.ipponleague.com`, servido em `/academy` por rewrite | `next.config.ts` |
| PWA | Manifesto (`start_url: /inicio`, `standalone`, ícones 192/512) + service worker | `app/manifest.ts`, `public/sw.js` |
| Service worker | Só push + clique; **sem cache offline** | `public/sw.js` |
| Notificações | **Web Push (VAPID)** com a biblioteca `web-push`; tabela de subscrições; autorreparação da subscrição | `lib/pushServer.ts`, `app/api/push/*` |
| Pagamentos | **Stripe por REST (sem SDK)**: Pro 8,99 €/mês, Pro Max 9,99 €/mês, subida 0,99 €, 7 dias grátis, cupões; **pacotes de Judocoins de 20 € a 70 €** | `lib/stripe.ts`, `lib/planos.ts`, `app/api/stripe/*`, `app/api/judocoins/*` |
| Assinaturas | Webhook da Stripe dá acesso (`is_pro`, `is_pro_max`); expiração por rota | `app/api/stripe/webhook`, `app/api/subscricoes/expirar` |
| Email | Resend (envio + webhook Svix) | `lib/email.ts`, `app/api/email/webhook` |
| Analytics | PostHog EU, com proxy em `/ingest`, começa desligado até haver consentimento | `lib/analytics.ts`, `next.config.ts` |
| IA | API da Anthropic para traduzir notícias | `lib/traduzirNoticia.ts` |
| Dados externos | `data.ijf.org` (resultados e atletas) | `lib/ijf.ts` |
| Testes | 2 ficheiros (motor de pontuação + aviso de favoritos), ~300 linhas | `tests/` |
| Línguas | i18n no cliente | `lib/i18n.ts` |

**Resumo:** é uma aplicação Next.js com servidor (não é um site estático). O ecrã e o backend estão no mesmo projeto e no mesmo domínio. A base de dados e a autenticação estão na Supabase.

## 2. Compatibilidade com Capacitor

- **Em "modo estático" (`output: export`): não é compatível.** As 102 API routes, o webhook da Stripe e os crons precisam do servidor da Vercel. Exportar tudo como ficheiros obrigaria a mover o backend para outro sítio, ou seja, reconstruir.
- **Em "modo URL remota" (`server.url = https://www.ipponleague.com`): é compatível.** A app nativa é uma "casca" que abre o site atual. O código é 100% reutilizado e cada deploy na Vercel atualiza logo as apps, sem passar outra vez pela revisão das lojas.
- O que muda dentro da casca:
  - **Push:** o WebView do iPhone (WKWebView) **não suporta Web Push**. Em iOS são precisas notificações nativas (APNs/FCM), e o servidor (`lib/pushServer.ts`) tem de ganhar um segundo canal de envio.
  - **Safe areas:** o `BarraTopo` já usa `env(safe-area-inset-top)`, mas o `viewport` em `app/layout.tsx` não tem `viewportFit: "cover"`. Sem isso o valor é 0 e a barra fica por baixo do notch.
  - **Links externos** (Stripe, Instagram, email): têm de abrir fora da app ou ser escondidos (ver pagamentos).

## 3. Melhor caminho para Android

**Recomendação provisória: Trusted Web Activity (TWA)**, a decidir na Fase 2.
- Abre o site no Chrome em ecrã inteiro e partilha a sessão, o service worker e o **Web Push, que continuam a funcionar sem mudanças no servidor**.
- Só exige o ficheiro `/.well-known/assetlinks.json` no domínio (pequena alteração em produção, que fica sujeita à tua autorização).
- A build gera-se com Bubblewrap/PWABuilder (AAB assinado).
- Alternativa: Capacitor também em Android, para ter um projeto único com o iOS. É mais trabalho porque obriga a ter push nativo também em Android.

## 4. Melhor caminho para iPhone

**Capacitor em modo URL remota**, com funções nativas mínimas:
- Push nativo (plugin `@capacitor/push-notifications` + APNs, ou FCM).
- Universal Links para `/liga/<código>` (convites) e para os emails de recuperação de password.
- Splash, ícone e gestão de links externos.
- **Problema prático:** pelos caminhos `C:\Users\kaina\...` no `build-erro.txt`, trabalhas em **Windows**, e o iOS precisa de Xcode (macOS). Solução: build na cloud com um runner macOS (GitHub Actions ou Codemagic), sem precisares de um Mac.

## 5. Principais riscos (por gravidade)

| # | Risco | Gravidade | Detalhe |
|---|---|---|---|
| R1 | **Pagamentos Stripe dentro das apps** | 🔴 Bloqueador | Pro, Pro Max e Judocoins (moeda de jogo) são bens digitais. A Apple exige In-App Purchase (3.1.1) e a Google exige Play Billing. As exceções da Google na EEE (faturação alternativa) **exigem empresa registada**. Na v1 a compra tem de ficar **escondida nas apps**. |
| R2 | **Desbloquear Pro comprado na web, no iPhone** | 🟠 Alto | A 3.1.3(b) só cobre isto se as mesmas compras também existirem como IAP. Mostrar Pro a quem pagou na web sem oferecer IAP pode dar rejeição. É uma decisão tua (ver D-03). |
| R3 | **Não existe eliminação de conta pelo próprio utilizador** | 🔴 Bloqueador | Só existe limpeza de contas inativas (`api/contas-inativas`). As duas lojas exigem que a conta se possa apagar dentro da app, e a Google exige também um link web para isso. |
| R4 | **Rejeição Apple 4.2 ("site embrulhado")** | 🟠 Alto | Uma casca que só abre o site é muitas vezes rejeitada. Mitigação: push nativo, deep links, partilha nativa e ecrã offline. |
| R5 | **Push no iOS** | 🟠 Médio | É preciso um canal APNs/FCM em paralelo com o Web Push, com uma tabela ou coluna nova na Supabase. É uma migração aditiva que precisa de backup antes. |
| R6 | **Teste fechado obrigatório da Google** | 🟠 Calendário | Numa conta pessoal: 12 testadores durante 14 dias seguidos antes de poder pedir acesso a produção. |
| R7 | **Dados públicos na App Store da UE (DSA)** | 🟡 Pessoal | Como pessoa singular que vende, a página da app mostra a tua morada (ou apartado), telefone e email. |
| R8 | **Deploy direto para produção** | 🟡 Processo | 158 commits num mês, quase todos no ramo principal (deploy automático). As mudanças para mobile devem ir para um ramo + Preview da Vercel. |
| R9 | **Repositório público** | 🟡 Segurança | **Não encontrei segredos** no código nem nos 1679 commits (procurei chaves Stripe, Supabase, Resend, Anthropic, `.env`, `.pem`). Mesmo assim, a lógica de negócio e as rotas de admin ficam à vista. Vale a pena tornar o repositório privado (a Vercel continua a funcionar). |
| R10 | **IA de terceiros** | 🟡 A verificar | A Apple exige divulgação e consentimento se houver dados pessoais enviados a IA de terceiros. Aqui parece ser só tradução de notícias; falta confirmar. |
| R11 | **Poucos testes automáticos** | 🟡 Qualidade | Só o motor de pontuação está coberto. |
| R12 | **Lixo no repositório** | ⚪ Baixo | `build-erro.txt` (673 KB), `lib/app/api/atletas/route.ts` perdido, `termos-pro/` e `teste-judobase/` fora de `app/`. |

## 6. O que já joga a favor
- Backend e base de dados únicos: web e apps veem os mesmos dados sem migração.
- Login só com email e password, por isso o "Sign in with Apple" **não é obrigatório**.
- Já existem manifesto PWA, ícones, safe area no topo, partilha nativa (`navigator.share`) nos convites, páginas de privacidade e termos, e consentimento de analytics.
- O acesso Pro é dado pelo webhook e não pelo cliente (bom desenho).
- Nenhum segredo exposto no repositório.

## 7. Ferramentas a instalar (no teu PC)
- **Node.js LTS + Git** (provavelmente já tens).
- **Android Studio** (para testar o AAB num emulador ou no teu telemóvel). Opcional se usarmos PWABuilder.
- **Java JDK 17** (vem com o Android Studio).
- iOS: **nada local.** Builds num runner macOS na cloud. Testes no iPhone via **TestFlight**.

## 8. Contas a criar
| Conta | Custo | Notas |
|---|---|---|
| Google Play Console (pessoal) | 25 USD, pagamento único | Verificação de identidade; 12 testadores durante 14 dias |
| Apple Developer Program (individual) | 99 USD/ano | Apple ID com 2FA; dados de trader DSA |
| Firebase (FCM) | Grátis | Só se houver push nativo |
| Codemagic ou GitHub Actions macOS | Grátis no nível inicial | Builds iOS |

## 9. Cronograma realista
| Semana | Android | iOS |
|---|---|---|
| 1 | Conta Play + verificação; eliminação de conta; esconder compras; build TWA; iniciar teste fechado | Inscrição Apple; projeto Capacitor; build na cloud |
| 2–3 | Teste fechado a correr (14 dias, é o caminho crítico) | Push nativo, deep links, TestFlight |
| 3–4 | Pedido de produção (a revisão pode levar até ~7 dias) e publicação | Submissão; possível ronda de rejeição 4.2/3.1.1 |

**Estimativa:** Android publicado em ~3–4 semanas; iOS em ~3–5 semanas, com margem para uma rejeição.

## 10. Custos
- Obrigatórios: **25 USD + 99 USD/ano** (cerca de 115 € no primeiro ano).
- Opcionais: apartado postal para não expor a morada (preço variável); Mac em segunda mão (desnecessário com build na cloud).
- IAP no futuro: comissão Apple/Google de 15% para quem fatura menos de 1 M USD/ano no programa de pequenas empresas.
