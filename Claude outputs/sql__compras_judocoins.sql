-- =============================================================================
-- CARTEIRA DE JUDOCOINS COMPRADOS  (razão / ledger)
-- Corre isto no Supabase (SQL Editor). É aditivo e seguro — não mexe em nada
-- do que já existe. Corre primeiro no ambiente que usas para testar.
-- =============================================================================
--
-- Uma linha por COMPRA CONFIRMADA. O saldo comprado de um utilizador é a soma
-- dos `jc` das suas linhas que ainda não expiraram. Guardar linha a linha (e
-- não um número numa coluna do `users`) dá histórico, auditoria e — o mais
-- importante — idempotência: o webhook da Stripe pode chegar duas vezes, mas o
-- UNIQUE em `stripe_session_id` garante que cada pagamento credita UMA só vez.

create table if not exists public.compras_judocoins (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null,
  -- A sessão de checkout da Stripe. UNIQUE = a rede contra creditar a dobrar.
  stripe_session_id  text not null unique,
  jc                 integer not null check (jc > 0),
  -- Valor pago em cêntimos (auditoria). Pode ficar a null se não vier no evento.
  euros_cent         integer,
  criado_em          timestamptz not null default now(),
  -- Quando o saldo comprado expira (30 dez da época). O reset anual limpa-o.
  expira_em          timestamptz not null,
  estado             text not null default 'creditado'
);

-- O saldo válido consulta-se por (user_id, expira_em > now()) — este índice serve.
create index if not exists idx_compras_jc_user
  on public.compras_judocoins (user_id, expira_em);

-- -----------------------------------------------------------------------------
-- RLS: o DONO pode LER as suas compras (para a app mostrar o saldo). NINGUÉM
-- escreve pelo cliente — o único que insere é o servidor (webhook), com a chave
-- de serviço, que ignora a RLS. Sem policy de insert/update/delete de propósito.
-- -----------------------------------------------------------------------------
alter table public.compras_judocoins enable row level security;

drop policy if exists "dono le as suas compras jc" on public.compras_judocoins;
create policy "dono le as suas compras jc"
  on public.compras_judocoins
  for select
  using (auth.uid() = user_id);
