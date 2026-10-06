-- ============================================================================
-- POSIÇÃO/TOTAL no histórico de faixas (para o "Top X%" do cartão)  (06/10/2026)
-- ============================================================================
-- Guarda, por mês, a posição da pessoa no ranking mundial e o total de jogadores,
-- para o cartão de faixa poder dizer "Top X%" real. O cron do recálculo mensal
-- preenche. Tem dados a partir de 1 de novembro (primeira virada de faixa).
--
-- Só ALTER TABLE ADD COLUMN (não toca em dados). Backup na mesma, por regra.
-- ============================================================================
alter table public.faixas_historico
  add column if not exists posicao int,
  add column if not exists total   int;

comment on column public.faixas_historico.posicao is 'Posição no ranking MUNDIAL desse mês (1 = topo).';
comment on column public.faixas_historico.total   is 'Total de jogadores considerados nesse mês (para o Top X%).';
