-- sql/favoritos_notif_estado.sql
--
-- Controlo de IDEMPOTÊNCIA das notificações de favoritos (Pro Max).
-- Guarda, por (utilizador, atleta, competição), quantas lutas desse atleta já
-- tínhamos "visto" da última vez que corremos o aviso. Na passagem seguinte, se
-- o nº de lutas subiu, é porque o atleta lutou de novo -> enviamos UM push.
--
-- Regra anti-spam: na PRIMEIRA vez que vemos um par (user, atleta) apenas
-- gravamos o número atual (seed), SEM notificar. Assim ninguém recebe avisos de
-- lutas que aconteceram ANTES de ter favoritado, nem no primeiro deploy.

create table if not exists public.favoritos_notif_estado (
  user_id        uuid not null,
  id_person      text not null,
  id_competicao  text not null,
  ultimas_lutas  int  not null default 0,
  atualizado_em  timestamptz not null default now(),
  primary key (user_id, id_person, id_competicao)
);

-- Leitura rápida por competição (o cron lê tudo desta competição de uma vez).
create index if not exists favoritos_notif_estado_comp_idx
  on public.favoritos_notif_estado (id_competicao);
