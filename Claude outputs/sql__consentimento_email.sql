-- Consentimento de email de marketing (opt-in explícito, RGPD/GDPR).
-- NULL/false = não consentiu. Governa SÓ emails de novidades/dicas/promoções;
-- os transacionais (verificação, avisos de rodada) não dependem disto.
--
-- Correr ANTES de fazer deploy do /comecar e da rota /api/consentimento-email.
alter table public.users
  add column if not exists aceita_email_marketing boolean not null default false;

comment on column public.users.aceita_email_marketing is
  'Consentimento explícito para emails de MARKETING (novidades/dicas/promoções), RGPD. Transacionais não dependem disto. Gravado no registo via /api/consentimento-email.';

-- Útil quando fores exportar a lista de quem pode receber newsletter:
--   select email, name from public.users where aceita_email_marketing = true;
