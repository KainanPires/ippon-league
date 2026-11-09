# MOBILE_TASKS.md — Tarefas e estados

Estados: ⏳ pendente · 🔄 em execução · ⛔ bloqueado · ✅ concluído

| ID | Tarefa | Fase | Quem | Estado |
|---|---|---|---|---|
| T-01 | Auditoria técnica (só leitura) | 1 | Claude | ✅ |
| T-02 | Criar conta Google Play Console (pessoal) — paga e documentos submetidos a 4 nov; verificação "Em análise" | 5 | Fundador | 🔄 a aguardar Google |
| T-03 | Aprovar arquitetura e decidir D-03 | 2 | Fundador | ✅ |
| T-04 | Inscrição Apple Developer (individual) — paga a 4 nov (99 €/ano), à espera da aprovação da Apple (email no endereço Hotmail do Apple ID) | 5 | Fundador | 🔄 a aguardar Apple |
| T-05 | **Recrutar 15–20 testadores Android (contas Google/Gmail)** | 4 | Fundador | ⏳ ← próxima do fundador |
| T-06 | Criar ramo `mobile` (feito 4 nov) + confirmar Preview Vercel | 3 | Claude + Fundador | 🔄 |
| T-07 | Eliminação de conta (UI + API + `/apagar-conta`) — testada no Preview a 4 nov (conta gratuita; tudo a 0; liga passou a outro membro). Falta: teste com Pro em Stripe modo teste | 3 | Claude + Fundador | ✅ |
| T-08 | Deteção "dentro da app" + esconder compras; iOS tratado como grátis (só de ecrã) — revisto a 4 nov em Android/iOS com conta Pro Max e gratuita | 3 | Claude + Fundador | ✅ |
| T-09 | `viewportFit: cover` + safe area na barra inferior — código no ramo `mobile`, falta ver num iPhone | 3 | Claude + Fundador | 🔄 |
| T-10 | Build Android TWA (PWABuilder) — `.aab` v1.0.0 (code 1) verificado a 4 nov: `com.ipponleague.app`, start `/inicio?app=android`, notificações por delegação, assinatura = `assetlinks.json` (ramo `mobile`). Falta: `assetlinks` em produção + impressão da Google após 1.º upload | 3 | Fundador + Claude | ✅ build |
| T-11 | Projeto iOS Capacitor 8 em `/mobile` (URL remota `/inicio?app=ios`, só iPhone, retrato, 1.0.0 build 1, ícone/splash provisórios do Dôdo) + workflow GitHub Actions `ios-build.yml` — **BUILD SUCCEEDED** a 4 nov (Xcode 26.6, run 41890873327). **8 nov:** build assinada enviada para a App Store Connect (versão 1.0.0, build 3, run 42512944643) pelo workflow `ios-testflight.yml` (disparo: alterar `mobile/ios-release.txt`; archive sem assinatura + assinatura de distribuição na nuvem na exportação; chave API de **Administrador** em GitHub Secrets `ASC_KEY_ID`/`ASC_ISSUER_ID`/`ASC_KEY_P8` — a de Gestor de apps não tem permissão de assinatura na nuvem e deve ser revogada). Falta: testar no iPhone pelo TestFlight; ícone 1024 final | 3 | Claude | 🔄 |
| T-12 | Push nativo iOS (APNs/FCM) + canal no servidor; substituir no Perfil o bloco "Estás a abrir pelo navegador…" + diagnóstico pelo pedido de permissão nativo | 3 | Claude | ⏳ |
| T-13 | Universal/App Links (convites, recuperação de password) | 3 | Claude | ⏳ |
| T-14 | Plano de testes + testes manuais em dispositivo | 4 | Ambos | ⏳ |
| T-15 | Fichas das lojas, privacidade, Data Safety, classificação etária | 5 | Ambos | ⏳ |
| T-16 | Teste fechado Google (14 dias) | 5 | Fundador | ⏳ |
| T-17 | Submissões e publicação | 6 | Fundador | ⏳ |
| T-18 | **v1.1 — Compras nas apps**: produtos nas lojas (Pro, Pro Max, subida, pacotes JC), acordos de pagamento Apple/Google, ligação ao servidor (RevenueCat), testes de compra, rever regras UE/EUA de links externos; reativar Pro no iPhone; **atualizar na Play Console a Classificação de conteúdo ("Compras digitais" → Sim) e a Segurança dos dados, e na App Store as etiquetas de privacidade/IAP** | v1.1 | Claude + Fundador | ⏳ depois do lançamento |
| T-19 | Classificação de conteúdo **enviada a 6 nov** (IARC 3+ / PEGI 3 / ESRB Everyone; jogos de azar: Não; compras digitais: Não). **Refazer** se D-14 = B/C ou se as apps mostrarem prémios, e na v1.1 (compras) | 5 | Fundador | ✅ (rever com D-14) |
| T-20 | Conta de revisão Pro Max: tirar `promo_lancamento_ate` (senão é rebaixada a 01/01/2027) ou repor Pro Max nesse dia | 5 | Fundador | ⏳ |
| T-21 | **Ramo `mobile` juntado à produção** a 6 nov 12:27 (commit `6174268`, autorizado pelo fundador; deploy Vercel Production OK). Rollback: Vercel → Deployments → versão `5751d58` → Instant Rollback | 3 | Claude | ✅ |
| T-22 | Play Console (8 nov): app criada (`com.ipponleague.app`), conteúdo do app preenchido (privacidade, login de revisão Pro Max, sem anúncios, classificação 3+, público 13+, segurança dos dados, comerciante, categoria Desporto), página da loja com ícone/gráfico/3 capturas; teste fechado Alpha com grupo `ippon-league-testers@googlegroups.com`, versão 1.0.0 (1) carregada. Assinatura: Google adotou a chave PWABuilder (SHA-256 `65:BC:…:2D:28`, já no assetlinks). Chave guardada no Drive do fundador + 2.ª cópia | 5 | Fundador + Claude | ✅ |
| T-16 | **Teste fechado: enviar para revisão** → quando aprovado, enviar link de instalação ao grupo e contar 14 dias com ≥12 testadores | 5 | Fundador | 🔄 |
| T-23 | Antes do lançamento público: refazer capturas em alta resolução (DPR 3, ≥1080 px) + 4.ª captura (mercado aberto ou liga de demonstração sem nomes reais) | 5 | Fundador | ⏳ |
| T-24 | Apps sem convites para o Pro (Apple 3.1.1/3.1.3, Play Billing): textos alternativos `APP` em lib/i18n.ts, `data-so-web` (esconde nas apps), `data-esconder-ios`, seletor do tatame, Análise de confrontos, mensagem de limite; fundo escuro nas apps; notificações escondidas no iPhone até T-12. Ícone novo (Dôdo maior, vetorial) na build 4. No ramo `mobile` (preview), **falta autorização para produção** | 3 | Claude | 🔄 |

### Estado a 9 nov 2026
- iOS: build 1.0.0 (4) (ícone novo) no TestFlight; página da App Store preenchida (textos, 4 capturas 1206×2622, privacidade publicada, classificação 13+ por "Concursos", categoria Desporto/Jogos, preço Grátis, lançamento MANUAL, conta de revisão + notas em inglês). DSA (comerciante) em revisão na Apple. Pronto para "Enviar para revisão" (fundador).
- Android: teste fechado aprovado e publicado; 6 testadores inscritos (meta 12 → 14 dias).
- Judocoins: fecho antecipado (chaves completas +2h) e mercado só depois do cálculo — em produção (9e96884).
