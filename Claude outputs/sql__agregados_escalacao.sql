-- Tabela de cache dos "mais escalados" (o time mais escalado da rodada, do mês
-- e do ano). O cron /api/cron/mais-escalados reescreve estas linhas de hora a
-- hora; a rota admin /api/admin/mais-escalados lê daqui (instantâneo).
--
-- Correr ANTES de fazer deploy da rota do cron.
--
-- chave: "comp:<id>" | "mes:AAAA-MM" | "ano:AAAA"
-- dados: o agregado completo (ranking, top_capitaes, etc.) em JSON.
create table if not exists public.agregados_escalacao (
  chave          text primary key,
  rotulo         text,
  total_times    int  not null default 0,
  dados          jsonb not null default '{}'::jsonb,
  atualizado_em  timestamptz not null default now()
);

comment on table public.agregados_escalacao is
  'Cache dos "mais escalados" por escopo (comp/mes/ano). Reescrito de hora a hora pelo cron /api/cron/mais-escalados. Admin-only via /api/admin/mais-escalados.';
