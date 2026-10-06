-- ============================================================================
-- HISTÓRICO DE FAIXAS DA ÉPOCA  (06/10/2026)
-- ============================================================================
-- Guarda, por utilizador e por MÊS, com que faixa a pessoa ficou nesse mês (e se
-- subiu/desceu/manteve). É o que permite, no perfil, mostrar o percurso da época
-- (um "boneco" por mês com a faixa respetiva) e partilhar cada um.
--
-- Preenchido pelo cron do recálculo mensal de faixas (etapa D). A 1ª linha real
-- aparece a 1 de novembro (recálculo sobre outubro). Antes disso fica vazia.
--
-- ⚠️ REGRA DE BACKUP: snapshot/export antes. É só CREATE TABLE (não toca em dados
--    existentes), mas a regra é fixa.
-- ============================================================================
create table if not exists public.faixas_historico (
  user_id       uuid        not null,
  mes           text        not null,   -- 'AAAA-MM' do mês avaliado
  belt          text        not null,   -- faixa com que ficou nesse mês
  belt_anterior text,                    -- faixa do mês anterior (null se desconhecida)
  situacao      text,                    -- 'subiu' | 'desceu' | 'manteve'
  criado_em     timestamptz not null default now(),
  primary key (user_id, mes)
);

comment on table public.faixas_historico is
  'Percurso de faixas por mês (perfil + partilhável). Preenchido pelo cron de faixas; upsert por (user_id, mes).';

-- Índice para ler rápido o percurso de um utilizador (perfil).
create index if not exists idx_faixas_historico_user on public.faixas_historico (user_id, mes desc);
