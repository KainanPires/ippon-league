-- =============================================================================
-- REEMBOLSOS DOS JUDOCOINS — acrescenta a ligação ao pagamento da Stripe.
-- Corre isto DEPOIS do sql__compras_judocoins.sql (a tabela já existe). Aditivo.
-- =============================================================================
--
-- O evento de reembolso da Stripe traz o `payment_intent`, não o id da sessão de
-- checkout. Por isso guardamos o payment_intent em cada compra: quando chega um
-- reembolso (ou uma disputa/chargeback), o webhook encontra a compra por aqui e
-- marca-a `reembolsado` — o que a tira do saldo na hora.

alter table public.compras_judocoins
  add column if not exists stripe_payment_intent text;

create index if not exists idx_compras_jc_pi
  on public.compras_judocoins (stripe_payment_intent);
