-- ============================================================================
-- SELO DE FUNDADOR  (06/10/2026)
-- ============================================================================
-- Marca quem entrou na janela de lançamento. É um selo PERMANENTE: fica com a
-- pessoa para sempre, mesmo depois de o Pro Max de promoção acabar. É o que
-- transforma "foi grátis" em "fui Fundador" (estatuto), e dá verdade à promessa
-- dos e-mails ("o teu selo de Fundador fica contigo para sempre").
--
-- ⚠️ REGRA DE BACKUP: fazer snapshot/export de public.users ANTES (é um UPDATE,
--    não destrutivo, mas a regra é absoluta). Já tens a cópia bkp_users_2026_10_06;
--    se preferires, cria outra: create table bkp_users_selo as select * from public.users;
--
-- Não destrutivo: só adiciona uma coluna e marca a true quem é da coorte.
-- ============================================================================

-- 1) coluna (default false, nunca nula)
alter table public.users
  add column if not exists fundador boolean not null default false;

comment on column public.users.fundador is
  'Fundador = entrou na janela de lançamento. Selo permanente (perfil/ranking/partilha). NÃO muda quando o Pro Max de promoção acaba.';

-- 2) backfill: toda a coorte de lançamento (quem tem promo_lancamento_ate) é Fundador.
update public.users
set fundador = true
where promo_lancamento_ate is not null
  and fundador = false;

-- 3) conferir
select
  count(*)                                   as total_contas,
  count(*) filter (where fundador) as fundadores
from public.users;
