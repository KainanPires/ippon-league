-- ============================================================================
-- PRO MAX GRÁTIS PARA TODOS ATÉ 01/01/2027  (decisão de 06/10/2026)
-- ============================================================================
-- Estende/concede o Pro Max de lançamento a TODA a base ativa até ao penhasco
-- de 01/01/2027. Objetivo: criar hábito e retenção antes de começar a cobrar
-- (a cobrança arranca em 2027). O cron /api/promo/expirar continua igual — como
-- todas as contas passam a ter promo_lancamento_ate = 2027-01-01, ninguém é
-- rebaixado antes dessa data.
--
-- ⚠️ REGRA DE BACKUP DO PROJETO: fazer SNAPSHOT/EXPORT da tabela public.users
--    ANTES de correr isto. É um UPDATE, não destrutivo, mas a regra é absoluta.
--
-- SEGURANÇA desta migração:
--   • NÃO toca em quem é cliente pago a sério (stripe_subscription_id preenchido).
--   • Só CONCEDE acesso (põe is_pro/is_pro_max a true e uma data no futuro).
--     Não remove nada, não apaga contas, não mexe em pontos/equipas/faixas.
--   • IDEMPOTENTE: pode correr várias vezes; o WHERE ignora quem já está em dia.
--     Dá para correr de novo mais tarde para apanhar registos novos de nov/dez
--     (embora a rota /api/promo/aderir atualizada já os apanhe no registo).
-- ============================================================================

-- 1) (opcional, recomendado) ver o estado ANTES
select
  count(*)                                                           as total_contas,
  count(*) filter (where stripe_subscription_id is not null)         as pagantes_stripe,
  count(*) filter (where promo_lancamento_ate = '2027-01-01T00:00:00Z') as ja_ate_jan
from public.users;

-- 2) a concessão
update public.users
set is_pro = true,
    is_pro_max = true,
    promo_lancamento_ate = '2027-01-01T00:00:00Z',
    renova_automaticamente = false
where stripe_subscription_id is null
  and (promo_lancamento_ate is null
       or promo_lancamento_ate < '2027-01-01T00:00:00Z');

-- 3) verificação DEPOIS (pagantes devem ficar intactos)
select
  count(*)                                                           as total_contas,
  count(*) filter (where is_pro_max
                     and promo_lancamento_ate = '2027-01-01T00:00:00Z') as promax_gratis_ate_jan,
  count(*) filter (where stripe_subscription_id is not null)         as pagantes_intactos
from public.users;
