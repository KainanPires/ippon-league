-- ============================================================================
-- DIAGNÓSTICO — quem é elegível para a sequência de e-mails do Fundador  (06/10/2026)
-- ============================================================================
-- Só LEITURA (SELECT). Não muda nada. Responde a "cadê toda a gente?": mostra o
-- funil desde o total de contas até quem recebe cada e-mail.
--
-- A sequência (e3/e4/e5) vai a: fundador = true E sem Stripe E com consentimento
-- de marketing E com e-mail. O promo_e1 (boas-vindas) ainda exige registo nos
-- últimos 7 dias — por isso o número do E1 é pequeno de propósito.
-- ============================================================================
select
  count(*)                                                              as total_contas,
  count(*) filter (where email is not null)                             as com_email,
  count(*) filter (where fundador)                                      as fundadores,
  count(*) filter (where aceita_email_marketing)                        as consentiram_marketing,
  count(*) filter (where stripe_subscription_id is not null)            as ja_pagantes_stripe,

  -- QUEM RECEBE e3/e4/e5 (em dezembro) — a base da conversão, sem janela de 7 dias:
  count(*) filter (
    where fundador
      and aceita_email_marketing
      and stripe_subscription_id is null
      and email is not null
  )                                                                     as elegiveis_sequencia,

  -- QUEM RECEBERIA o promo_e1 HOJE — a mesma base, mas só registos dos últimos 7 dias:
  count(*) filter (
    where fundador
      and aceita_email_marketing
      and stripe_subscription_id is null
      and email is not null
      and first_seen_at >= now() - interval '7 days'
      and first_seen_at <= now() - interval '20 hours'
  )                                                                     as elegiveis_e1_agora
from public.users;

-- ----------------------------------------------------------------------------
-- Se "consentiram_marketing" vier muito baixo, é aí que está o teto. Para ver
-- quantos Fundadores NÃO deram consentimento (não recebem marketing, por lei):
-- ----------------------------------------------------------------------------
select
  count(*) filter (where fundador and not aceita_email_marketing)       as fundadores_sem_consentimento,
  count(*) filter (where fundador and aceita_email_marketing)           as fundadores_com_consentimento
from public.users;
