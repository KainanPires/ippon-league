-- =====================================================================
-- SELO DE SENSEI (sazonal, semanal)
-- =====================================================================
-- Dá-se o selo ao CRIADOR de uma liga de amigos cuja liga tenha >= 20
-- membros ATIVOS (montaram/atualizaram equipa nos últimos 7 dias) na semana.
-- É sazonal: renova-se semana a semana. Se numa semana a liga não chega aos
-- 20, o criador perde o selo na semana seguinte (a data expira).
--
-- Guardado em users.sensei_ate = até quando o selo é válido.
--   NULL  ou data no passado  -> SEM selo
--   data no futuro            -> COM selo (ativo)
--
-- Recalculado por /api/sensei-semanal (cron semanal). Idempotente.
--
-- ⚠️ BACKUP primeiro (produto no ar). Correr no SQL Editor do Supabase.
-- =====================================================================

alter table public.users
  add column if not exists sensei_ate timestamptz;

-- Índice para as consultas de ranking (quem tem o selo ativo agora).
create index if not exists idx_users_sensei_ate
  on public.users (sensei_ate);

-- Verificação (opcional): quantas contas têm o selo ativo neste momento.
-- select count(*) from public.users where sensei_ate is not null and sensei_ate > now();
