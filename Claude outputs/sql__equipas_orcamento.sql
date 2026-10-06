-- Economia Fase A2 — orçamento validado por equipa guardada.
--
-- ⚠️ CORRER ESTE SQL *ANTES* DO DEPLOY DO CÓDIGO. O motor de congelamento passa
-- a LER as colunas `orcamento`/`orcamento_comprado` da tabela `equipas` e a
-- GRAVAR `inativa` em `resultados_rodada`. Sem estas colunas, o PostgREST recusa
-- a consulta/escrita (não ignora colunas desconhecidas) e a rodada não pontua.
--
-- Guarda, na linha da equipa, o orçamento com que ela foi VALIDADA no momento
-- em que o jogador a gravou (fonte: /api/orcamento):
--   orcamento           = base total (património atual + JC comprados válidos)
--   orcamento_comprado  = a parte desse orçamento que veio de JC comprados
--
-- PORQUÊ: no fecho do mercado, o motor de congelamento precisa de decidir se a
-- equipa guardada ainda cabe no orçamento. Recalcular o orçamento no momento do
-- congelamento seria frágil (o património já foi mexido pela própria rodada, e o
-- cron reprocessa a janela recente todos os dias — o número mudaria a cada
-- passagem). Guardar o orçamento validado à gravação torna o veredito ESTÁVEL e
-- idempotente, e permite reagir a reembolsos: se o jogador comprou JC, montou
-- uma equipa cara e depois foi reembolsado, os JC saem do saldo e a equipa passa
-- a estar ACIMA do orçamento -> fica inativa nessa rodada (0 pontos, sem ganho
-- nem perda). Ver lib/congelar.ts -> pontuarUtilizadoresDaCompeticao.
--
-- Colunas OPCIONAIS: linhas antigas (gravadas antes desta funcionalidade) ficam
-- com NULL e o motor, na dúvida, pontua-as NORMALMENTE — nunca penaliza por
-- falta de dados.

alter table public.equipas
  add column if not exists orcamento numeric,
  add column if not exists orcamento_comprado numeric;

comment on column public.equipas.orcamento is
  'Orçamento total (JC) com que a equipa foi validada à gravação: património + JC comprados. NULL em linhas antigas.';
comment on column public.equipas.orcamento_comprado is
  'Parte do orçamento (JC) vinda de JC comprados, à gravação. Serve para descontar reembolsos no congelamento. NULL em linhas antigas.';

-- Marca de rodada INATIVA por orçamento (equipa acima do orçamento no fecho do
-- mercado). O motor grava-a em resultados_rodada; a UI/notificações usam-na para
-- explicar o 0 a 0 (0 pontos, sem ganho nem perda). Default false para as linhas
-- já existentes ficarem coerentes.
alter table public.resultados_rodada
  add column if not exists inativa boolean not null default false;

comment on column public.resultados_rodada.inativa is
  'true = rodada inativa por orçamento (equipa acima do orçamento no fecho): 0 pontos, sem ganho nem perda de património.';
