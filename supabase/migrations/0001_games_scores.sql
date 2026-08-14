-- SPEC 05: esquema base de juegos y puntuaciones.

create table games (
  id           text primary key,
  title        text not null,
  short        text not null,
  long         text not null,
  cat          text not null check (cat in ('ARCADE','PUZZLE','SHOOTER','VERSUS')),
  cover        text not null,
  color        text not null check (color in ('cyan','magenta','yellow','green')),
  sort_order   int  not null,
  created_at   timestamptz not null default now()
);

create table scores (
  id           uuid primary key default gen_random_uuid(),
  game_id      text not null references games(id) on delete cascade,
  player_name  text not null check (char_length(player_name) between 1 and 10),
  score        int  not null check (score >= 0 and score <= 10000000),
  user_id      uuid,
  created_at   timestamptz not null default now()
);

create index scores_game_score_idx on scores (game_id, score desc);

create view game_stats as
  select game_id, max(score) as best, count(*) as plays
  from scores
  group by game_id;

-- Postgres crea las vistas como SECURITY DEFINER por defecto; sin esto el
-- linter de seguridad de Supabase marca game_stats como ERROR.
alter view game_stats set (security_invoker = true);

alter table games enable row level security;
alter table scores enable row level security;

create policy "games_select_public" on games
  for select
  to anon, authenticated
  using (true);

create policy "scores_select_public" on scores
  for select
  to anon, authenticated
  using (true);

create policy "scores_insert_public" on scores
  for insert
  to anon, authenticated
  with check (true);
