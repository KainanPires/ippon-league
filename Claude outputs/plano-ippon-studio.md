# Ippon Studio — Análise e Plano de Implementação

> **Estado: plano para aprovação. Nenhum código foi escrito.**
> Isto é o que pediste: primeiro percebo a arquitetura atual, mostro o que
> reaproveito, desenho a segurança e o isolamento, proponho um plano por fases
> e listo ficheiros e riscos. Só avanço para código depois do teu "sim".

---

## 0. O que é o Ippon Studio (em 20 segundos)

Um ambiente **interno, só para ti (admin)**, dentro da própria app, para
**simular e gravar cenas** do jogo — montar uma equipa de mentira, escolher
capitão, "correr" uma competição inventada, ver pontos a subir e um ranking a
mexer — para depois **gravares o ecrã** e fazeres os criativos (Reels/Shorts).

A regra de ouro: o Studio **finge**, mas finge com o **motor verdadeiro**. Os
pontos que aparecem no Studio saem das **mesmas funções** que pontuam o jogo a
sério. Assim as cenas do anúncio nunca mentem sobre como o jogo funciona — e não
existe um segundo motor a divergir do oficial.

E o Studio **não toca em nada real**: não escreve nas tabelas do Supabase, não
cria competições falsas no calendário, não altera atletas, não mexe no teu
rascunho de equipa verdadeiro. Vive num "mundo à parte", com dados só dele.

---

## 1. Análise da estrutura atual

### 1.1 Componentes que dá para reaproveitar (não reescrever)

O jogo já tem, prontas, quase todas as peças visuais que uma cena de anúncio
precisa. O plano é **importá-las tal como estão**:

- **`components/Escudo.tsx`** — o escudo/identidade da equipa (`Escudo`,
  `DEFAULT_IDENTITY`, `type Identity`). É o que dá cara ao "meu time".
- **O mascote (Dôdo)** — `Mascot` (recebe `belt={cor}` e `expression`). É a cara
  da marca, e aparece em todos os criativos.
- **A grelha de atletas do "Meu Time"** (`app/meu-time/page.tsx`) — a `Cell` (card
  do atleta com avatar de kimono, país, categoria, capitão com moldura), a
  `EmptyCell` (vaga por preencher), o layout de 4 colunas masculino/feminino, o
  destaque de capitão. É exatamente a "tela de tatame" que o documento mestre
  descreve.
- **O mercado** (`app/mercado/page.tsx`) — o `type Athlete`, os estados visuais
  (`Elite`, `Em alta`, `Barganha`…), os `STATUS_COLORS`, os filtros. Serve para
  a cena "escolher os 8 atletas".
- **A tabela de ranking** (`app/oficial/[tipo]/page.tsx` e `app/liga/[codigo]/page.tsx`)
  — a linha de ranking (`MembroRank`: nome_time, escudo, pontos, posição, is_pro),
  a ordenação, o destaque da minha posição. Serve para a cena "subi no ranking".
- **Faixas e cores por faixa** — `useFaixa()` (cor + nome da faixa), que já muda o
  visual conforme a faixa. Serve para a cena "mudei de faixa".

**Conclusão:** o Studio é sobretudo **montagem** de componentes que já existem,
alimentados por dados de mentira. Pouca coisa nova de raiz.

### 1.2 O motor de pontuação (o que NÃO se toca, e como se reutiliza)

O motor é todo feito de **funções puras** (sem base de dados), o que é perfeito
para o Studio: dá para chamá-las com dados inventados e obter os pontos oficiais.

- **`lib/engine.ts`** — `POINTS` (a tabela oficial: ippon +10, waza-ari +4,
  yuko +2…), `scoreActions(acoes[])`, `scoreShidosSofridos(n)` (custo crescente),
  `scoreShidosProvocados(n)` (bónus crescente), e as funções de faixa por
  percentil.
- **`lib/ijf.ts`** — `scoreContestSide(luta, lado)` e `scoreContestForPerson`,
  que aplicam TODAS as regras fechadas contigo (incluindo o ippon "fantasma" do
  hansoku-make e os shidos crescentes).

**Como o Studio pontua sem duplicar nada:** cada "luta simulada" do Studio é um
objeto com a mesma forma que o motor já lê (os campos `ippon_b`, `waza_w`,
`penalty_b`…). Passamos esse objeto a `scoreContestSide()` — **a mesmíssima
função do jogo real** — e mostramos o resultado. Zero regras copiadas, zero
risco de divergir. Se um dia mudares a tabela de pontos, o Studio muda junto,
sozinho.

> Compromisso explícito: **não crio nenhuma função de pontuação nova**. O Studio
> só *chama* as que já existem.

### 1.3 O sistema de autorização (como o jogo já protege o "só admin")

O projeto já tem o padrão certo, em dois sabores, e eu vou seguir o mesmo — não
inventar um novo:

1. **Páginas de editor** (`app/blog/editor`, `app/chaveamento/editor`): a página
   tem um estado `acesso` (`"a-ver"` → `"sim"` / `"nao"`). A decisão real é do
   **servidor**: manda-se o **token da sessão** (`Authorization: Bearer …`), o
   servidor faz `getUser()` e confirma um **papel na tabela `users`** (hoje é a
   coluna `is_chaveador`). Se não for, a rota devolve 401 e a página mostra "sem
   acesso". Esconder o botão no frontend **não** é a segurança — a segurança é o
   servidor recusar.
2. **Rotas de dados/cron** (`/api/estado-crons`, etc.): protegidas por
   `?key=CRON_SECRET`, validado no servidor contra `process.env.CRON_SECRET`.

Hoje **não existe** uma coluna `is_admin`. Para o Studio proponho a opção mais
limpa e segura (secção 3).

### 1.4 i18n (as 5 línguas)

`lib/i18n.ts` dá `useT()` (tradutor) e `useLingua()` (`{ lingua, mudar }`). O
padrão que já usámos (termo de consentimento, email) é: os textos próprios de uma
página pequena vivem num **`Record<Lingua, …>` local** dentro do componente, e
**não** no dicionário global de 9600 linhas. O Studio segue esse padrão — os seus
textos (botões "Gravar cena", "Correr rodada"…) ficam num mapa local. O botão de
trocar de língua usa `useLingua().mudar`, para gravares cenas em PT, EN, ES, FR
ou DE.

---

## 2. Princípios de segurança e isolamento (as tuas regras, ponto a ponto)

| A tua exigência | Como o plano a cumpre |
|---|---|
| Autorização validada **no servidor**, não só esconder botões | Rota `/api/studio/acesso` que lê o token da sessão, faz `getUser()` e confirma o papel de admin na tabela `users`. A página só renderiza depois do "sim" do servidor. |
| Não usar uma **variável no frontend** como segurança | A variável de frontend só controla o *ecrã* ("a-ver/sim/não"). Quem manda é o servidor. Idêntico aos editores que já tens. |
| Operações do Studio **não escrevem** nas tabelas/serviços reais | O Studio não chama **nenhuma** rota que escreva (nada de `/api/equipa`, `/api/liga`, webhook, etc.). Os dados dele vivem em **estado local + JSON**, com chaves de armazenamento próprias (`ippon_studio_*`), separadas das reais (`ippon_montar_*`, drafts). |
| Não criar uma **competição fictícia** nas tabelas de competições reais | A "competição" do Studio é um objeto em memória/JSON, nunca entra no `CALENDARIO_2026` nem em nenhuma tabela. |
| Não criar um **segundo motor** de pontuação | O Studio chama `scoreContestSide()` / `scoreActions()` do motor oficial. Não escreve regras próprias. |
| **Não indexar** a página nos motores de pesquisa | `metadata.robots = { index:false, follow:false }` na rota `/admin/studio` + `Disallow` no `robots.txt`. |
| Não inventar resultados **históricos** nem alterar dados oficiais dos atletas | O Studio nunca escreve em `resultados_atletas`, `atletas_cache`, `equipas`, etc. Os "atletas" dele são fictícios (nomes/países inventados ou avatares genéricos), marcados como demo. |
| Não usar imagens/vídeos externos sem direitos | Só o que já é nosso: o Dôdo, os avatares de kimono, as cores da marca. Nada de fotos reais de atletas. |

---

## 3. Estratégia de acesso admin (recomendação)

**Recomendo a Opção A.** Mais limpa, alinhada com o que já fazes, e não obriga
a decorar segredos no URL.

- **Opção A — papel `is_admin` na tabela `users` (recomendada).**
  Marcas a tua conta com `is_admin = true` (uma linha, uma vez, direto no
  Supabase). A rota `/api/studio/acesso` confirma esse papel pelo token da
  sessão, tal como o `is_chaveador` já faz. Vantagem: é a tua conta normal, sem
  segredos no link, e serve para qualquer futura ferramenta de admin. Custo:
  criar a coluna (1 minuto no Supabase) — dizes-me e eu deixo o SQL pronto.

- **Opção B — porta por `CRON_SECRET` no URL.**
  Entras em `/admin/studio?key=…` e o servidor valida contra `process.env`.
  Vantagem: zero mudanças na base de dados. Desvantagem: o segredo anda no URL
  (arriscado se gravares o ecrã com a barra de endereço à vista) e é o mesmo
  segredo dos crons.

Seja qual for a que escolheres, o **princípio é o mesmo**: a decisão é do
servidor. Preciso só que me digas **A ou B** antes de eu escrever código.

---

## 4. Plano de implementação (simples, por fases)

### Fase 1 — o essencial (o que te desbloqueia os criativos)

Tudo numa rota nova, `/admin/studio`, isolada:

1. **Acesso admin** — servidor valida (Opção A ou B). Sem acesso → "sem acesso".
2. **Ambiente isolado** — estado próprio + JSON de cenário; chaves
   `ippon_studio_*`; nada de rotas de escrita.
3. **Montar equipa simulada** — reaproveita a grelha de tatame e o mercado;
   escolher 8 atletas fictícios dentro de 100 JC.
4. **Capitão** — escolher, com moldura dourada (a dobrar, como no jogo).
5. **Pontuação simulada** — um painel simples ("este atleta fez ippon", "levou
   shido"…) que alimenta o **motor oficial** e mostra os pontos a somar. Capitão
   a dobrar.
6. **Ranking demo** — uma tabela com equipas fictícias (nomes/escudos inventados)
   onde a tua sobe conforme os pontos, para a cena "subi no ranking".
7. **Modo de gravação** — um botão "limpar interface" que esconde barras/avisos e
   deixa o ecrã limpo para gravar (9:16 amigável).
8. **Trocar de língua** — PT/EN/ES/FR/DE, para gravar cada mercado.
9. **Primeiro guião pronto — "FILME 01: DESAFIO DE ESCALAÇÃO"** — um cenário JSON
   já preenchido (atletas, valores, uma sequência de ações) para gravares a
   primeira cena sem montar nada à mão.

### Fase 2 — só se precisares (depois de validar a Fase 1)

Animação de subida/queda de faixa em modo demo; cartões de partilha ("campeão da
liga") em branco para gravar; mais cenários-guião (mercado, valorização, mata-mata);
"passo-a-passo" automático que corre uma cena sozinho para gravação sem mãos.

> Não construo a Fase 2 já. Fica desenhada, mas só avança se a Fase 1 provar que
> vale a pena.

---

## 5. Ficheiros a criar / modificar

### A criar (novos, isolados)

- `app/admin/studio/page.tsx` — a página do Studio (client). Importa os
  componentes existentes; **exporta `metadata.robots` noindex** (via um
  `layout.tsx` irmão, porque a página é `"use client"`).
- `app/admin/studio/layout.tsx` — só para o `metadata` (noindex) do ramo.
- `app/api/studio/acesso/route.ts` — valida o admin no servidor (leitura apenas;
  não escreve nada).
- `lib/studio/cenarios.ts` — os cenários-guião em JSON/TS (ex.: "FILME 01"),
  dados fictícios, tipados. Puro, sem rede.
- `lib/studio/motor.ts` — uma **fina camada de cola** que pega nas ações
  simuladas e chama `scoreContestSide` / `scoreActions` do motor **oficial**.
  Não contém regras próprias — só adapta a forma dos dados.

### A modificar (mínimo, sem risco)

- `public/robots.txt` — acrescentar `Disallow: /admin/` (uma linha).
- *(Opção A, se a escolheres)* deixo-te o **SQL** para `alter table users add
  column is_admin boolean default false` e marcar a tua conta — **tu** corres no
  Supabase; eu não toco na base.

> **Não** modifico `lib/engine.ts`, `lib/ijf.ts`, `lib/team.ts`, o calendário,
> nem nenhuma rota existente. O Studio é aditivo.

---

## 6. Riscos de interferência com a app pública (e como os fecho)

1. **Partilhar armazenamento com o jogo real** (apagar o teu rascunho de equipa).
   → Chaves `ippon_studio_*`, nunca as reais. Zero cruzamento. *(É a mesma
   família de bugs do mercado que acabámos de corrigir — por isso vou com cuidado
   redobrado aqui.)*
2. **Escrever sem querer numa tabela real.** → O Studio não importa nem chama
   nenhuma rota de escrita nem o `supabaseAdmin`. A rota `/api/studio/acesso` é só
   leitura.
3. **A página aparecer no Google / ser achada por utilizadores.** → noindex +
   `Disallow` + acesso barrado no servidor.
4. **O motor divergir e o anúncio mostrar pontos errados.** → Reutilização do
   motor oficial; nada de regras copiadas.
5. **Peso no build / na app.** → Uma rota nova e leve; não altera caminhos que os
   utilizadores usam.
6. **Direitos de imagem.** → Só assets nossos (Dôdo, kimonos, cores). Nada de
   atletas reais.

---

## 7. Critérios de aceitação (como saberemos que está bem feito)

- Só a tua conta (admin) entra em `/admin/studio`; outra conta é recusada **pelo
  servidor** (não só sem botão).
- Montas 8 atletas fictícios, escolhes capitão, e os pontos que aparecem batem
  **certo com o motor oficial** (capitão a dobrar).
- O ranking demo mexe conforme os pontos.
- Trocas de língua e a cena aparece em PT/EN/ES/FR/DE.
- O "FILME 01" carrega pronto para gravar.
- Depois de usar o Studio: o teu **rascunho de equipa real continua intacto**,
  nenhuma tabela mudou, nenhuma competição nova apareceu.
- A página não é indexável.

---

## 8. O que preciso de ti para arrancar

1. **Opção A ou B** para o acesso admin (recomendo A).
2. Confirmação de que a **rota `/admin/studio`** te serve como morada (ou preferes
   outra, ex. `/studio`).
3. Um "sim" ao **âmbito da Fase 1** acima.

Assim que responderes, começo pela Fase 1 — e, como sempre, faço **primeiro em
português** e só depois traduzo para as outras quatro línguas.

---

*Fim do plano. Nada será implementado até à tua aprovação.*
