-- 202611040008_daily_challenge.sql
-- Server-persisted daily challenge assignments and owned player attempts.

begin;

-- Table to store frozen daily 10-round puzzle assignments
create table if not exists public.daily_challenges (
  challenge_date date primary key,
  catalog_version_id uuid not null references public.catalog_versions(id),
  rounds jsonb not null,
  created_at timestamptz not null default now()
);

-- Table to track player daily challenge attempts
create table if not exists public.daily_challenge_attempts (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.anonymous_players(id) on delete cascade,
  challenge_date date not null references public.daily_challenges(challenge_date) on delete cascade,
  session_id uuid not null references public.game_sessions(id) on delete cascade,
  is_official boolean not null default true,
  created_at timestamptz not null default now()
);

-- Partial unique index ensuring at most one official attempt per player per date
create unique index if not exists idx_unique_official_daily_attempt
  on public.daily_challenge_attempts (player_id, challenge_date)
  where is_official = true;

create index if not exists idx_daily_attempts_session
  on public.daily_challenge_attempts (session_id);

-- RLS setup
alter table public.daily_challenges enable row level security;
alter table public.daily_challenge_attempts enable row level security;

revoke all on public.daily_challenges from public, anon, authenticated;
revoke all on public.daily_challenge_attempts from public, anon, authenticated;

grant select, insert, update on public.daily_challenges to service_role;
grant select, insert, update, delete on public.daily_challenge_attempts to service_role;

commit;

