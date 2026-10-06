-- Promoção de lançamento (Mundial) — marca quem entrou na janela e até quando
-- tem o Pro Max GRÁTIS. NULL = conta normal (não é da promoção).
--
-- Correr ANTES de fazer deploy das rotas /api/promo/aderir e /api/promo/expirar.
alter table public.users
  add column if not exists promo_lancamento_ate timestamptz;

comment on column public.users.promo_lancamento_ate is
  'Fim do Pro Max de lançamento (grátis). NULL = conta normal. O cron /api/promo/expirar rebaixa quem já passou desta data E nunca subscreveu na Stripe.';
