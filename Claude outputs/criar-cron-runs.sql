-- criar-cron-runs.sql
--
-- REGISTO DURÁVEL DOS CRONS (observabilidade — modelo de exame).
--
-- Cada corrida de um cron grava aqui UMA linha no fim: que job, correu bem?,
-- quanto tempo, e as LEITURAS (observado / esperado / limite / estado) que o
-- lib/referencias produziu. É o histórico que responde a "o congelamento correu
-- ontem?", "o maestro esteve vivo durante a competição?", "algo falhou?".
--
-- RLS ligado SEM políticas: só o service role (supabaseAdmin) lê e escreve.
-- Nenhum cliente do navegador toca nesta tabela.

create table if not exists public.cron_runs (
  id            bigint generated always as identity primary key,
  job           text        not null,             -- "cron" | "maestro" | "chave-viva" | "vigia"
  ok            boolean     not null default true,
  estado        text        not null default 'ok',-- "ok" | "aviso" | "alarme"
  iniciado_em   timestamptz,
  terminado_em  timestamptz not null default now(),
  ms            integer,
  comp          text,                              -- competição em contexto, se houver
  ao_vivo       boolean     not null default false,
  leituras      jsonb,                             -- array de Leitura (o "exame")
  resumo        jsonb,                             -- payload cru da corrida
  erro          text,                              -- mensagem, se a corrida rebentou
  alertado_em   timestamptz                        -- quando saiu email deste alarme (throttle)
);

-- "última corrida de cada job" e as consultas por janela de tempo.
create index if not exists cron_runs_job_terminado_idx
  on public.cron_runs (job, terminado_em desc);

-- Para o throttle de alertas (procura o último alarme já avisado de um job).
create index if not exists cron_runs_job_estado_alertado_idx
  on public.cron_runs (job, estado, alertado_em desc);

alter table public.cron_runs enable row level security;
-- Sem políticas de propósito: fechada a todos os clientes; só o service role passa.

-- LIMPEZA (opcional): mantém ~60 dias. Corre à mão de vez em quando, ou agenda.
-- delete from public.cron_runs where terminado_em < now() - interval '60 days';
