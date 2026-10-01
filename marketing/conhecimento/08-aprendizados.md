# 08 · Aprendizados

Cada correção do Kainan entra aqui, datada, com a regra resultante. Só regras que o Kainan confirmou.

- 2026-09-30 · O Dôdo é um **ornitorrinco**, não um dodô — nunca descrevê-lo como ave nos prompts.
- 2026-09-30 · As referências são direcionamento, não padrão fechado.
- 2026-09-30 · Ainda não há limite fixo de gasto: fase de exploração do formato. Cada peça tem o seu teto, autorizado pelo Kainan.
- 2026-09-30 · Aprovar a ideia/roteiro não autoriza gastar.
- 2026-09-30 · **Permanente:** seguir sempre as técnicas de conteúdo viral (ver `05-diretrizes-referencias.md` → "Regra permanente"): primeira fala em grande e empolgada a anunciar o tema, gancho visual forte sobre a dúvida/erro do público, emoção mantida até ao fim, re-ganchos e retenção visual.
- 2026-09-30 · ~~a narração gera-se uma fala por cena~~ → **substituída** (ver linha seguinte): falas soltas quebravam a voz entre cenas.
- 2026-09-30 · **Permanente:** a narração gera-se em **blocos contínuos** (2–3 takes por vídeo), com a emoção a mudar **de forma gradual**, como uma pessoa real a falar: o grito do gancho desce para o tom de conversa ao longo de 2–3 frases, sem saltos. Emoção indicada pela escrita (maiúsculas, reticências, pontuação).
- 2026-09-30 · **Permanente:** o STOP/gancho vem **na cara** do espectador (gesto e texto em direção à lente) e o primeiro quadro mostra **identidade de judô + Ippon League** (tatame, judogi, logótipo, "JUDO FANS") para quem é do meio se reconhecer.
- 2026-09-30 · **Permanente:** todo o vídeo termina com **CTA para montar a equipa com o link** ("link na bio" / link na legenda).
- 2026-09-30 · **Permanente:** usar **atletas reais e conhecidos** de cada categoria (nomes públicos, como na app) para o público reconhecer que é judô — nunca nomes inventados. Só nome, país e categoria; nunca foto/vídeo do atleta. Números que não sejam resultados reais levam o selo **EXAMPLE**. Nomes de **utilizadores** da app continuam protegidos.
- 2026-09-30 · **Permanente:** o Dôdo **atua** — pose, gesto e expressão mostram o que está a ser dito (STOP → palma para a lente; atenção → dedo levantado; perda → triste; ganho → comemora). Biblioteca em `04-dodo.md`.
- 2026-09-30 · **Permanente:** exemplos podem ser lúdicos, mas os **números seguem sempre as regras reais do jogo** (pontos por ação, preço, Judocoins). Todo o exemplo com números entra em `plano.json → exemplos` e o `validar` recalcula-o contra `lib/engine.ts` — número errado bloqueia o plano. Na tela, **pontos** e **preço** aparecem separados e com rótulo, para ninguém confundir.
- 2026-09-30 · **Permanente:** **pontuação** e **Judocoins/património** são **conteúdos separados**, nunca o mesmo vídeo.
  - Pontuação = como os pontos se fazem nas lutas (ações, shidos, capitão); ângulo: campeão/favorito nem sempre pontua mais — leva shidos, sofre pontos; judô limpo e agressivo pontua mais.
  - Judocoins = valorização/desvalorização, como ganhar, perder, recuperar e em que focar.
- 2026-09-30 · Verificado no código (30/09): waza-ari sofrido **−2** (lib/engine.ts e tabela pública em /como-jogar). Património: o **preço** muda metade da diferença (pontos − preço); o dono **ganha metade** da subida do preço e **perde a descida inteira** (lib/congelar.ts, modelo v2). Património parte de 100 a cada época. ⚠️ Esta assimetria não está explicada aos jogadores em /como-jogar.
- 2026-09-30 · Exemplos de luta com shidos e hansoku-make também são verificados: `plano.json → exemplos[].lutas[]` aceita `{eu:{ippon,waza,yuko,shido}, adv:{...}}` e o teste compara com as funções reais de lib/engine.ts.
- 2026-09-30 · **Permanente:** entoação **assimétrica** — a voz não mantém um tom só; muda com cada informação (grito, suspense lento, rajada rápida nos números, professor seco, voz baixa antes do perigo, peso crescente, alívio, CTA caloroso). Marca-se na escrita da fala e no campo `audio.narracao.entoacao` do plano.
- 2026-09-30 · **Permanente:** as cenas feitas pela Máquina entregam-se **animadas (MP4)**, não como imagens paradas: cada elemento entra no momento em que a narração fala dele (estúdio animado em `marketing/estudio/`).
- 2026-09-30 · **Permanente:** carrossel entrega-se em dois passos: (1) uma folha com todas as páginas juntas, só para aprovar; (2) depois de aprovado, **cada página em ficheiro separado** (JPG 1080×1350, `pagina_01.jpg`…), pronta para postar.
- 2026-09-30 · **Permanente (retrospetiva como-pontuar):** narração **sem pausas de respiração**. Mantém entoação e emoção, mas corrida, sem silêncios entre frases (não é falar mais rápido). Na escrita: sem reticências, poucas frases soltas, ligar com vírgulas e dois-pontos. Depois de gerar, a Máquina corta os silêncios acima de ~0,15 s antes de montar.
- 2026-09-30 · **Permanente:** o vídeo entrega-se **já com todo o som**: efeitos sonoros em cada elemento que aparece e música de fundo, mixados com a voz. A Máquina vai buscar o que gerou no Higgsfield, monta o vídeo completo e entrega o MP4 final. A música pode ser escolhida pelo Kainan (a Máquina põe uma provisória).
- 2026-09-30 · Pendente: melhorar a exportação para PowerPoint (o carrossel em imagens ficou muito bom; o .pptx não).
- 2026-10-01 · **Permanente:** módulo de voz aprovado (`11-voz-e-narracao.md`). Supera as notas anteriores sobre narração. A voz da marca passa a ser construída sobre a voz real do Kainan.

## Registo de resultados por peça
`marketing/campanhas/registro-resultados.csv` — colunas: data_publicacao, campanha, versao, rede, formato, angulo, utm_campaign, utm_content, duracao_s, idioma, creditos_gastos, views, conclusao_pct, saves, partilhas, cliques, registos, equipas_montadas, pro_iniciados, notas.
Eventos do funil no código (`lib/analytics.ts`): landing_viewed, signup_started, signup_completed, team_saved, paywall_viewed, trial_started, subscription_started.

## Retrospetiva de campanha
Depois de cada peça publicada: preencher `templates/retrospectiva.md` em `campanhas/<id>/retrospectiva.md`.
Classificar cada aprendizado como **permanente** (confirmado pelo Kainan), **desta campanha** ou **hipótese** (um só resultado). Só os permanentes entram na lista acima.
Mudanças às diretrizes: propostas com motivo; aplicadas só depois de aprovadas, com o texto anterior guardado em "Histórico" no ficheiro alterado. Regras de gasto e autorizações nunca mudam por retrospetiva.
