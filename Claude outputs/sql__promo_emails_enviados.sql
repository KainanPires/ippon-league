-- ============================================================================
-- RESERVA DE ENVIO dos e-mails da sequência de lançamento (Fundador)   (06/10/2026)
-- ============================================================================
-- Garante que cada pessoa recebe cada e-mail da sequência UMA só vez, mesmo com
-- o cron a correr de hora a hora. O cron /api/promo/emails faz "reserva primeiro":
-- tenta inserir (user_id, tipo); se já existir (conflito da PK), salta; se o envio
-- falhar, apaga a reserva para tentar na corrida seguinte.
--
-- tipo: 'promo_e1' (boas-vindas Fundador), 'promo_e3' (faltam 7 dias),
--       'promo_e4' (faltam 2 dias), 'promo_e5' (penhasco, 1 de janeiro).
--
-- NOTA sobre backup: isto CRIA uma tabela nova e vazia (create table if not
-- exists). Não toca em nenhum dado existente, por isso não há nada para fazer
-- backup desta vez (a regra nº1 aplica-se a alterações de dados já existentes).
-- ============================================================================
create table if not exists public.promo_emails_enviados (
  user_id    uuid        not null,
  tipo       text        not null,
  enviado_em timestamptz not null default now(),
  resend_id  text,
  primary key (user_id, tipo)
);

comment on table public.promo_emails_enviados is
  'Reserva/idempotência dos e-mails da sequência de lançamento (Fundador). Uma linha por (pessoa, tipo de e-mail). Preenchida pelo cron /api/promo/emails.';

-- conferir (deve dar 0 em tabela nova)
select count(*) as reservas from public.promo_emails_enviados;
