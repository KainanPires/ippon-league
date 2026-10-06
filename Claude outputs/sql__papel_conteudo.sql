-- Papel "conteúdo" — dá acesso só ao painel /admin/mais-escalados (social media),
-- SEM dar admin nem editor do blog. A barreira é login + papel: a página não tem
-- segredo no URL, por isso pode partilhar-se e tirar print à vontade.
--
-- Correr ANTES de fazer deploy da página.

-- 1) criar a coluna (só na 1.ª vez)
alter table public.users
  add column if not exists is_conteudo boolean not null default false;

comment on column public.users.is_conteudo is
  'Dá acesso ao painel /admin/mais-escalados (equipa de conteúdo/social media). Não dá admin.';

-- 2) DAR acesso a uma pessoa (ela precisa de já ter conta na app; troca o email):
--    update public.users set is_conteudo = true  where email = 'social@exemplo.com';

-- 3) TIRAR o acesso (ex.: trocou de pessoa):
--    update public.users set is_conteudo = false where email = 'social@exemplo.com';

-- Nota: depois de mudar o papel, a pessoa precisa de RECARREGAR a app (o papel
-- fica em cache na sessão). Tu (is_admin) já vês o painel sem precisar disto.
