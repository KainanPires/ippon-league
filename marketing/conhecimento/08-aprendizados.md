# 08 · Aprendizados

Cada correção do Kainan entra aqui, datada, com a regra resultante. Só regras que o Kainan confirmou.

- 2026-09-30 · O Dôdo é um **ornitorrinco**, não um dodô — nunca descrevê-lo como ave nos prompts.
- 2026-09-30 · As referências são direcionamento, não padrão fechado.
- 2026-09-30 · Ainda não há limite fixo de gasto: fase de exploração do formato. Cada peça tem o seu teto, autorizado pelo Kainan.
- 2026-09-30 · Aprovar a ideia/roteiro não autoriza gastar.
- 2026-09-30 · **Permanente:** seguir sempre as técnicas de conteúdo viral (ver `05-diretrizes-referencias.md` → "Regra permanente"): primeira fala em grande e empolgada a anunciar o tema, gancho visual forte sobre a dúvida/erro do público, emoção mantida até ao fim, re-ganchos e retenção visual.
- 2026-09-30 · **Permanente:** a narração gera-se uma fala por cena, com a emoção de cada momento indicada no texto.

## Registo de resultados por peça
`marketing/campanhas/registro-resultados.csv` — colunas: data_publicacao, campanha, versao, rede, formato, angulo, utm_campaign, utm_content, duracao_s, idioma, creditos_gastos, views, conclusao_pct, saves, partilhas, cliques, registos, equipas_montadas, pro_iniciados, notas.
Eventos do funil no código (`lib/analytics.ts`): landing_viewed, signup_started, signup_completed, team_saved, paywall_viewed, trial_started, subscription_started.

## Retrospetiva de campanha
Depois de cada peça publicada: preencher `templates/retrospectiva.md` em `campanhas/<id>/retrospectiva.md`.
Classificar cada aprendizado como **permanente** (confirmado pelo Kainan), **desta campanha** ou **hipótese** (um só resultado). Só os permanentes entram na lista acima.
Mudanças às diretrizes: propostas com motivo; aplicadas só depois de aprovadas, com o texto anterior guardado em "Histórico" no ficheiro alterado. Regras de gasto e autorizações nunca mudam por retrospetiva.
