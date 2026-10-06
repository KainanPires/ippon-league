-- ============================================================================
-- BACKUP (regra nº1)  —  correr ANTES de sql/faixas_historico_percentil.sql
-- ============================================================================
-- Esta alteração só acrescenta colunas (posicao/total) à tabela faixas_historico,
-- por isso o backup é uma cópia dessa tabela. (Hoje está vazia, mas segue a regra.)
-- Se precisares de reverter, apagas as colunas ou restauras desta cópia.
-- ============================================================================

-- 1) cópia de segurança
create table if not exists public.bkp_faixas_historico_2026_10_06 as
select * from public.faixas_historico;

-- 2) conferir (os dois números têm de bater certo)
select
  (select count(*) from public.faixas_historico)                 as agora,
  (select count(*) from public.bkp_faixas_historico_2026_10_06)  as backup;
