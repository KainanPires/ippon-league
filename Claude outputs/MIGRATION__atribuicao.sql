-- Fase D — Atribuição (de onde veio cada jogador).
-- Correr UMA vez no Supabase (SQL Editor). Só ACRESCENTA colunas à users; não
-- toca em nada do que já existe. Seguro de repetir (IF NOT EXISTS).

alter table public.users
  add column if not exists first_utm_source   text,
  add column if not exists first_utm_medium   text,
  add column if not exists first_utm_campaign text,
  add column if not exists first_utm_content  text,
  add column if not exists first_utm_term     text,
  add column if not exists first_referrer     text,
  add column if not exists first_seen_at      timestamptz,
  add column if not exists last_utm_source    text,
  add column if not exists last_utm_medium    text,
  add column if not exists last_utm_campaign  text,
  add column if not exists last_utm_content   text,
  add column if not exists last_utm_term      text,
  add column if not exists last_referrer      text,
  add column if not exists referred_by        text;
