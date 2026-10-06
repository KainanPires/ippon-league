# Ippon League — Sprint de Analytics · FASE A (Auditoria) + Arquitetura

**Data:** 11 de setembro de 2026
**Âmbito desta entrega:** Fase A (auditoria) + a arquitetura de Analytics para aprovares **antes** de escrever código.
**Nada foi alterado no produto.** Nenhum ficheiro do repositório foi tocado.

> Como vamos trabalhar: eu não tenho ligação direta ao teu GitHub nesta sessão, por isso **leio** o código pelo índice do Project (o repo está sincronizado lá) e **escrevo** entregando-te ficheiros prontos a substituir, com type-check, como temos feito. Cada fase que envolva código: explico → aprovas → pedes/mandas os ficheiros exatos → devolvo prontos → testas → só então avançamos.

---

## 1. AUDITORIA — o estado atual

### 1.1 Stack confirmada
- **Next.js (App Router)** · **Supabase** (auth + Postgres) · **Stripe** (webhook = fonte da verdade dos pagamentos) · **PWA** · cron horário via **cron-job.org** a bater em `/api/cron`.
- 5 línguas (pt/en/es/fr/de). Área de chaveador (`is_chaveador`).

### 1.2 Product analytics atual: **não existe**
Não há PostHog, GA, Plausible nem tracking de eventos no código. Isto é bom: é terreno limpo, montamos de raiz e bem, sem legado a limpar. Hoje só consegues ver o que está *dentro* da base (contas, equipas, pagamentos) — não vês **de onde vêm** as pessoas nem **onde desistem**.

### 1.3 Como as equipas se ligam às competições — a base da Retenção
A tabela **`equipas`** guarda uma linha por **(user_id, id_competicao)** com `nome`, `escudo`, `atletas[]` (8 ids) e `capitao`. Cada ronda da Copa e cada competição é um `id_competicao` diferente, e a escalação daquela ronda fica **fixa** ali.

Isto é ouro para a tua Prioridade 7, porque significa que **Competition Player e Competition Retention são deriváveis diretamente do Supabase**, sem depender do PostHog:
- **Competition Player** de uma competição = existe uma linha em `equipas` para aquele `id_competicao` com 8 atletas + capitão.
- **Returning Competition Player** = o mesmo `user_id` tem linha válida na competição N e na N+1 elegível.
- **Competition Retention** = contagem(N∩N+1) ÷ contagem(N). Uma query SQL resolve.

Ou seja: a métrica mais importante da sprint **não fica refém de uma ferramenta externa** — fica no teu próprio banco. O PostHog serve para o comportamento *fino* (funil, origem, conteúdo); o Supabase fica como fonte da verdade da retenção.

### 1.4 `focoMercado()` — como funciona hoje (base da Prioridade 9)
Vive em `lib/calendario.ts` e é a regra única de mercado usada por toda a app. Devolve:
- `atual` — a competição da semana.
- `alvo` — a competição de **mercado aberto**, onde se monta equipa. **Se o mercado da atual já fechou (início − 1h) ou a atual já terminou (regra das 60h), `alvo` avança automaticamente para a próxima.**
- `aDecorrer` — a competição a decorrer (mercado fechado), se houver.

**Descoberta importante:** quando há uma competição a decorrer, o `alvo` **já aponta para a próxima**. A página `criar-equipa` já usa o `alvo` — portanto já monta para a próxima. **O atrito está na página `mercado`**, que hoje **bloqueia por completo** enquanto `aDecorrer` existe (mostra "mercado fechado" e não carrega nada). Ou seja: parte da tua Prioridade 9 já está meia-resolvida pela arquitetura; o que falta é a *experiência* de encaminhar o novo utilizador para montar a **próxima** em vez de bater na parede. Detalho na secção 5 — mas **não implemento sem a tua aprovação e sem ver os ficheiros completos**.

### 1.5 A pontuação e os "quatro locais" (base da Prioridade 11)
Mapeei onde a pontuação vive hoje:

| # | Local | Papel |
|---|---|---|
| 1 | `lib/engine.ts` | Motor puro: `POINTS`, `scoreActions`, `scoreShidosSofridos`, `scoreShidosProvocados`, `computeNewPrice`. As **regras** de pontos. |
| 2 | `lib/ijf.ts` → `scoreContestSide` / `contestActions` / `scoreContestForPerson` | Traduz uma luta do JudoBase em pontos (shido crescente, ippon-fantasma do hansoku). |
| 3 | `lib/lutasManuais.ts` → `pontosLadoManual` | Pontos das lutas manuais (espelha as regras do #2). |
| 4 | Consumidores: `lib/congelar.ts`, `app/api/resultados`, `app/api/liga/oficial`, `app/api/pontuacao`, `app/api/diagnostico`, copa | Chamam os de cima para calcular rankings/prémios/valorização. |

O risco (que já causou o bug do shido provocado) é a lógica de shido estar replicada entre o #2 e o #3. **A tua ordem é a certa:** primeiro **testes de caracterização** que fixam o comportamento atual (número a número), só depois unificar — e a refatoração **não pode mudar nenhuma regra nem nenhum ponto**. Já existe, aliás, uma ferramenta a teu favor: `app/api/diagnostico` compara campos crus vs pontos do motor — é a base perfeita para os testes.

### 1.6 Observabilidade atual (base da Prioridade 10)
O cron (`/api/cron`) é idempotente e tem orçamento de tempo e travões de deduplicação (`reservarEvento`, cursor de preços). Mas **as falhas hoje são silenciosas** — não há tabela de execuções nem "health status". Se o JudoBase falhar, se uma competição não congelar ou se os pontos vierem a zero, ninguém é avisado. Proposta simples na secção 6 (sem overengineering).

### 1.7 Tabelas relevantes que já existem
`users` (id, is_pro, is_pro_max, continente, country_code, patrimony_jc, lingua, data_nascimento, name, email, stripe_customer/subscription), `equipas`, `resultados_atletas`, `precos_atletas`, `resultados_rodada`, `pontuacoes`, `leagues`, `lutas_manuais`, `atletas_favoritos`, `atletas_cache`, colunas de verificação de email. **Não há** colunas de atribuição (utm/origem) — proponho criá-las na secção 3.

---

## 2. ARQUITETURA DE ANALYTICS (aprovar antes de implementar)

### 2.1 Ferramenta: PostHog — compatível, confirmado na doc atual
Verifiquei a documentação atual do PostHog para Next.js App Router. Encaixa na tua stack:
- **Cliente:** `posthog-js`, inicializado no `instrumentation-client.ts` (o ficheiro que o Next.js App Router usa para setup client-side).
- **Servidor:** `posthog-node` (para eventos server-side, ex.: confirmação de pagamento via webhook Stripe) — com `flushAt: 1` e `await shutdown()`.
- **Identidade:** `posthog.identify(<user_id do Supabase>)` depois do login; `posthog.reset()` no logout. Anónimos ficam com o distinct_id automático (é o que liga a visita ao registo).
- **PWA + anónimos + Stripe:** todos suportados.
- **Região de dados:** recomendo **PostHog Cloud EU** (dados na UE) por seres operador em Portugal — decisão a validar com o advogado (ver 2.5).

### 2.2 Camada centralizada — `lib/analytics.ts` (o contrato)
Nada de chamar `posthog.capture(...)` espalhado pela app. Uma camada única:

```
lib/analytics.ts
  ├─ track(event: EventName, props?: EventProps)   // client
  ├─ identify(userId) / resetIdentity()
  ├─ EventName  = união fechada de nomes (TypeScript não deixa inventar eventos)
  └─ sanitize() // remove/《bloqueia》propriedades proibidas antes de enviar

lib/analytics.server.ts
  └─ trackServer(userId, event, props)  // posthog-node, p/ webhook Stripe etc.
```

O que isto te dá (os teus objetivos):
- **Nomenclatura consistente** — os nomes de evento são um tipo TypeScript; escrever um evento fora da lista **não compila**. Zero eventos "à solta".
- **Sem duplicados** — um único sítio dispara cada evento.
- **Propriedades padronizadas** — `language`, `country`, `platform`, `user_plan` são injetadas automaticamente pela camada, não repetidas em cada chamada.
- **Trocar de ferramenta no futuro** — se um dia saíres do PostHog, mudas *um* ficheiro; a app inteira continua a chamar `track(...)`.
- **Privacidade por construção** — a `sanitize()` recusa enviar campos proibidos (secção 2.5), mesmo que alguém tente por engano.

### 2.3 Convenção de nomes
`objeto_ação`, minúsculas, snake_case, sempre no passado do resultado: `signup_completed`, `team_saved`, `checkout_started`. É a convenção que a tua sprint já usa — mantemo-la.

### 2.4 Client vs Server
- **Client** (posthog-js): tudo o que é comportamento no ecrã — `landing_viewed`, `market_viewed`, `athlete_added`, `team_saved`, `paywall_viewed`.
- **Server** (posthog-node): tudo o que tem de ser **verdade financeira/de estado** — `subscription_started`, `subscription_renewed`, `subscription_cancelled` disparados **a partir do webhook da Stripe**, nunca do browser. Assim o analytics nunca contradiz a Stripe (que continua a fonte oficial).

### 2.5 Privacidade (RGPD) — e o que o advogado tem de validar
**Nunca** enviar para o analytics: nome, email, telefone, data de nascimento, password, conteúdo privado. Usamos o **`user_id` do Supabase** (pseudónimo) como identificador — nunca o email. A `sanitize()` bloqueia estes campos na origem.

**Três pontos que EU não decido — marco para o advogado:**
1. **Consentimento.** Em Portugal/UE, analytics de produto normalmente exige **consentimento** (ePrivacy/RGPD). Duas vias: (a) um **banner de consentimento** antes de ativar o PostHog, ou (b) arrancar em modo **sem cookies / memória** até haver consentimento. Recomendo decidir com o advogado qual — e implementamos a que ele validar.
2. **A tua Política de Privacidade atual diz "não usamos cookies de rastreamento".** Ativar o PostHog **contradiz isso**. Antes de ligar, a Política tem de ser atualizada (subprocessador PostHog, base legal, região de dados). Já temos o documento — é uma edição pequena, mas **tem de acontecer antes** de o tracking entrar em produção.
3. **Região de dados** (EU vs US) e **DPA** com o PostHog — validação do advogado.

### 2.6 Identidade: anónimo → identificado
Visitante chega → PostHog dá-lhe um `distinct_id` anónimo → ele navega, vê a landing, começa o registo (tudo ligado a esse id) → cria conta → `identify(user_id)` **funde** a jornada anónima com o utilizador real. É isto que te deixa responder "das pessoas que chegaram, quantas se registaram" — a mesma pessoa, antes e depois da conta.

### 2.7 Reverse proxy (recomendado)
O PostHog recomenda um reverse proxy para os eventos não serem bloqueados por ad-blockers. **Sinergia:** já usas **Cloudflare** — dá para servir o proxy por lá (ou por rewrite do Next.js). Fica para a fase de implementação; menciono para saberes que não há custo/ferramenta nova.

---

## 3. ATRIBUIÇÃO / UTM (Prioridade 3) — abordagem proposta

**Captura:** na primeira entrada, um pequeno script lê os `utm_*` do URL e o `referrer`, e guarda-os no aparelho (cookie/localStorage) **antes** de a pessoa navegar — para não se perderem enquanto ela circula pela app antes de criar conta.

**First-touch e last-touch (é simples e vale a pena):**
- **First-touch:** a origem é gravada **uma vez** e nunca sobrescrita — "como me conheceu".
- **Last-touch:** atualiza-se a cada nova visita com `utm` — "o que a trouxe desta vez".

**Persistência:** quando a pessoa cria conta, a camada escreve a origem no **Supabase**, em colunas novas na `users` (migration proposta, a validar contigo):
```
first_utm_source, first_utm_medium, first_utm_campaign, first_utm_content, first_utm_term, first_referrer, first_seen_at
last_utm_source,  last_utm_medium,  last_utm_campaign,  last_utm_content,  last_utm_term,  last_referrer
```
Assim distingues Instagram, TikTok, YouTube, Google, WhatsApp, **atleta parceiro**, influenciador, federação, clube, anúncio pago, conteúdo editorial, **referral** — e podes cruzar origem × retenção **em SQL**, não só no PostHog.

**Referral (Prioridade 6):** o link de convite de liga já existe (`/liga/<codigo>`). Proponho anexar um parâmetro de referral (ex.: `?ref=<user_id_ou_codigo>`) e, no registo, gravar `referred_by` na `users`. Assim atribuis B ao convite de A **sem criar recompensas** (a sprint pede: primeiro medir o comportamento natural).

---

## 4. DEFINIÇÕES CANÓNICAS (para os KPIs baterem certo)

Fixadas aqui para toda a sprint (e para o `docs/analytics.md`):
- **Activated Player** = utilizador que **guardou uma equipa válida de 8 atletas** (evento `team_saved` + linha em `equipas`).
- **Competition Player (comp N)** = tem equipa válida guardada para N.
- **Returning Competition Player** = Competition Player de N que também o é da N+1 elegível.
- **Competition Retention (N→N+1)** = Returning ÷ Competition Players de N.

Cada uma existe em **duas formas**: como **evento PostHog** (para funis rápidos) e como **query SQL no Supabase** (para a verdade auditável). O `docs/analytics.md` vai trazer as duas.

---

## 5. PRIORIDADE 9 (mercado fechado → próxima competição) — análise, SEM implementar

**Como é hoje:** `criar-equipa` já monta para `focoMercado().alvo` (que já é a próxima quando há uma a decorrer). A página **`mercado`** é que bloqueia inteira durante `aDecorrer`.

**Edge cases a tratar antes de mexer:**
- Não permitir entrada/pontos retroativos na competição a decorrer (a regra anti-espreitadela e o congelamento já protegem isto — não lhe tocamos).
- Utilizador **existente** que já montou para a atual não pode ser afetado.
- Momento de transição (as 60h / mudança de `alvo`) não pode deixar o utilizador num limbo.
- Clássicos (cidade escondida) mantêm o comportamento.

**Proposta (a detalhar e só depois de ver `mercado/page.tsx` e `criar-equipa/page.tsx` completos):** quando `aDecorrer` existe, em vez do ecrã "mercado fechado" seco, mostrar *"Esta competição já começou — a próxima já está à tua espera"* com um CTA que leva a montar a equipa da `alvo` (próxima). Sem alterar a competição a decorrer nem dar vantagem. E medimos com `market_closed_experience_viewed`, `next_competition_cta_clicked`, `next_competition_team_started`, `next_competition_team_saved` para saber se resolveu.

---

## 6. PRIORIDADE 10 (observabilidade) — proposta simples

Sem overengineering, adequado ao estágio:
- **Tabela `cron_execucoes`** (uma linha por corrida do cron): etapa, início/fim, duração, `ok`/`erro`, contadores (atletas processados, competições congeladas). O cron já produz estes números — só falta gravá-los.
- **Verificações de sanidade** que escrevem um estado (`health`): cron não correu nas últimas X h, JudoBase indisponível/anormal, competição não congelou, pontuação inesperadamente zero, Copa não avançou.
- **Alerta** simples: quando uma verificação falha, um email (Resend, que já usas) para o `support@`/`legal@`. Sem serviço novo.
- Opcional mais tarde: **Sentry** (plano grátis) para erros de runtime. Fica como "nice to have", não bloqueia o lançamento.

---

## 7. ORDEM DE EXECUÇÃO e o que preciso de ti para avançar

Sigo exatamente as tuas fases. Para cada fase de código, digo-te **que ficheiros preciso** (envias como .docx/colados, como temos feito):

| Fase | O que faço | Ficheiros que vou precisar de ti |
|---|---|---|
| **A. Auditoria** | ✅ este documento | — |
| **B. Arquitetura analytics** | `lib/analytics.ts` + `.server.ts` + init | `package.json`, `next.config.ts`, `app/layout.tsx`, `instrumentation-client.ts` (se existir) |
| **C. Aquisição/cadastro** | `landing_viewed`, `signup_started/completed` | `app/comecar/page.tsx` (já tenho), a landing (`app/page.tsx`) |
| **D. UTM/attribution** | captura + migration `users` + persistência no registo | a rota de criação de conta / trigger, `app/comecar` |
| **E. Ativação** | eventos do fluxo de equipa | `app/criar-equipa/page.tsx`, `app/mercado/page.tsx`, `lib/team.ts` |
| **F. Engagement/social** | ranking, ligas, convites | páginas de liga, ranking, convite |
| **G. Retenção** | as queries SQL + eventos | (deriva de `equipas` — pouco código de app) |
| **H. Monetização** | eventos no webhook + paywall | `app/api/stripe/webhook`, `app/ippon-pro`, `app/pro-max` |
| **I. Mercado fechado** | a experiência da Prioridade 9 | `app/mercado/page.tsx`, `app/criar-equipa/page.tsx` completos |
| **J. Observabilidade** | tabela + verificações + alerta | `app/api/cron/route.ts`, `lib/congelar.ts` |
| **K. Testes + pontuação única** | testes de caracterização, depois unificar | `lib/engine.ts`, `lib/ijf.ts`, `lib/lutasManuais.ts` completos |
| **L. Dashboard** | dashboards PostHog + queries Supabase | — (config, não código) |
| **M. Documentação** | `docs/analytics.md` + relatório final | — |

Depois de cada fase: explico o que fiz, mostro ficheiros alterados e migrations, e verifico regressões (type-check) antes de avançar.

---

## 8. O que NÃO será alterado (eco das tuas restrições)
100 JC iniciais · preços · valorização · pontuação (regras) · 8 atletas · 4+4 · categorias · capitão · faixas · ligas · Copa do Dôdo · **cadastro (nenhum campo removido, sem login social)** · tutoriais · planos · preços de assinatura · trial · estrutura do Fantasy. Sem Academia, streak, badges, marketplace, publicidade, app nativa, japonês. **Medir e proteger — não redesenhar.**

---

## 9. Decisões que preciso de ti para arrancar a Fase B
1. **Aprovas o PostHog** como ferramenta e esta arquitetura centralizada? (Se preferires alternativa — ex.: manter tudo em Supabase + um analytics mais leve — dizes e eu adapto.)
2. **Região de dados: EU** (recomendo) ou US?
3. **Consentimento:** banner vs modo sem-cookies-até-consentir — ou preferes falar com o advogado primeiro e só depois ligamos o tracking? (Podemos implementar a camada e os eventos **desligados** e só ativar quando o jurídico der luz verde — assim não paramos a sprint.)
4. Confirmas que, quando chegarmos a cada fase, me envias os ficheiros da tabela acima.

Assim que responderes a estas quatro, arranco a **Fase B** (a camada de analytics) com os ficheiros que pedir.
