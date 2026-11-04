begin;

create table public.catalog_versions (
  id uuid primary key default gen_random_uuid(),
  rules_version text not null check (length(btrim(rules_version)) between 1 and 100),
  imported_at timestamptz not null default now(),
  status text not null default 'staging' check (status in ('staging', 'active', 'retired')),
  summary jsonb not null default '{}' check (jsonb_typeof(summary) = 'object')
);
create unique index catalog_one_active on public.catalog_versions (status) where status = 'active';

create table public.movies (
  catalog_version_id uuid not null references public.catalog_versions(id) on delete cascade,
  tmdb_id bigint not null check (tmdb_id > 0),
  title text not null check (length(btrim(title)) > 0),
  original_title text not null,
  release_date date not null,
  release_year integer not null check (release_year between 1800 and 9999),
  vote_count integer not null check (vote_count >= 0),
  vote_average numeric not null check (vote_average between 0 and 10),
  popularity numeric not null check (popularity >= 0 and popularity <> 'NaN'::numeric),
  revenue bigint check (revenue >= 0),
  familiarity_score double precision check (familiarity_score between 0 and 1),
  tier text check (tier in ('easy', 'medium', 'hard')),
  runtime integer not null check (runtime > 0),
  original_language text not null,
  genres text[] not null default '{}',
  sanitized_synopsis text,
  directors jsonb not null default '[]' check (jsonb_typeof(directors) = 'array'),
  cast_members jsonb not null default '[]' check (jsonb_typeof(cast_members) = 'array'),
  approved_aliases text[] not null default '{}',
  poster_path text,
  source_revision text not null,
  eligible_modes text[] not null default '{}' check (
    eligible_modes <@ array['poster', 'title', 'synopsis', 'cast', 'genre']::text[]
    and array_position(eligible_modes, null) is null
  ),
  primary key (catalog_version_id, tmdb_id)
);
create index movies_coverage on public.movies (catalog_version_id, tier);

create table public.anonymous_players (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days'),
  check (expires_at > created_at)
);

create table public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.anonymous_players(id) on delete restrict,
  creation_action_id uuid not null,
  creation_request_hash text not null check (creation_request_hash ~ '^[0-9a-f]{64}$'),
  catalog_version_id uuid not null references public.catalog_versions(id) on delete restrict,
  rules_version text not null,
  mode text not null check (mode in ('poster', 'title', 'synopsis', 'cast', 'genre', 'mixed')),
  level text not null check (level in ('easy', 'medium', 'hard')),
  state text not null default 'active' check (state in ('active', 'completed', 'expired')),
  current_round integer not null default 1 check (current_round between 1 and 10),
  score integer not null default 0 check (score between 0 and 2000),
  revision integer not null default 0 check (revision >= 0),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  completed_at timestamptz,
  unique (player_id, creation_action_id),
  unique (id, catalog_version_id),
  check (expires_at > created_at),
  check ((state = 'completed') = (completed_at is not null)),
  check (completed_at is null or completed_at between created_at and expires_at)
);
create index sessions_player on public.game_sessions (player_id);
create index sessions_retention on public.game_sessions (state, created_at, completed_at);

create table public.game_rounds (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  catalog_version_id uuid not null,
  movie_id bigint not null,
  ordinal integer not null check (ordinal between 1 and 10),
  mode text not null check (mode in ('poster', 'title', 'synopsis', 'cast', 'genre')),
  hint_stage integer not null default 0 check (hint_stage between 0 and 3),
  wrong_attempts integer not null default 0 check (wrong_attempts between 0 and 3),
  state text not null default 'guessing' check (state in ('guessing', 'correct', 'skipped', 'exhausted')),
  score integer not null default 0 check (score between 0 and 200),
  reveal_seed uuid not null default gen_random_uuid(),
  reveal_snapshot jsonb check (jsonb_typeof(reveal_snapshot) = 'object'),
  foreign key (session_id, catalog_version_id) references public.game_sessions(id, catalog_version_id) on delete cascade,
  foreign key (catalog_version_id, movie_id) references public.movies(catalog_version_id, tmdb_id) on delete restrict,
  unique (session_id, ordinal),
  unique (session_id, movie_id),
  unique (id, session_id),
  unique (id, catalog_version_id),
  check (state = 'correct' or score = 0),
  check (state <> 'guessing' or wrong_attempts < 3),
  check (state <> 'exhausted' or wrong_attempts = 3)
);

create table public.game_actions (
  session_id uuid not null references public.game_sessions(id) on delete cascade,
  idempotency_key uuid not null,
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  action_type text not null check (action_type in ('guess', 'hint', 'skip', 'next')),
  round_id uuid not null,
  response_snapshot jsonb not null check (jsonb_typeof(response_snapshot) = 'object'),
  created_at timestamptz not null default now(),
  primary key (session_id, idempotency_key),
  foreign key (round_id, session_id) references public.game_rounds(id, session_id) on delete cascade
);
create index actions_retention on public.game_actions (created_at);

create table public.game_guesses (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null,
  catalog_version_id uuid not null,
  normalized_guess text check (length(btrim(normalized_guess)) between 1 and 600),
  selected_movie_id bigint,
  outcome text not null check (outcome in ('wrong', 'correct', 'ambiguous')),
  ordinal integer not null check (ordinal >= 1),
  created_at timestamptz not null default now(),
  foreign key (round_id, catalog_version_id) references public.game_rounds(id, catalog_version_id) on delete cascade,
  foreign key (catalog_version_id, selected_movie_id) references public.movies(catalog_version_id, tmdb_id) on delete restrict,
  check ((normalized_guess is null) <> (selected_movie_id is null))
);
create unique index guesses_wrong_text on public.game_guesses (round_id, normalized_guess) where outcome = 'wrong' and normalized_guess is not null;
create unique index guesses_wrong_choice on public.game_guesses (round_id, selected_movie_id) where outcome = 'wrong' and selected_movie_id is not null;
create index guesses_retention on public.game_guesses (created_at);

create table public.rate_limit_buckets (
  bucket_hash text not null check (bucket_hash ~ '^[0-9a-f]{64}$'),
  route_class text not null check (length(btrim(route_class)) between 1 and 100),
  window_start timestamptz not null,
  count integer not null check (count >= 0),
  expires_at timestamptz not null,
  primary key (bucket_hash, route_class, window_start),
  check (expires_at > window_start and expires_at <= window_start + interval '24 hours')
);
create index buckets_retention on public.rate_limit_buckets (expires_at);

-- No browser policies, table privileges or RPC grants. Server routes must check cookie ownership.
grant usage on schema public to service_role;
alter table public.catalog_versions enable row level security;
alter table public.movies enable row level security;
alter table public.anonymous_players enable row level security;
alter table public.game_sessions enable row level security;
alter table public.game_rounds enable row level security;
alter table public.game_actions enable row level security;
alter table public.game_guesses enable row level security;
alter table public.rate_limit_buckets enable row level security;

revoke all on table public.catalog_versions, public.movies, public.anonymous_players,
  public.game_sessions, public.game_rounds, public.game_actions, public.game_guesses,
  public.rate_limit_buckets from public, anon, authenticated;
grant select, insert, update, delete on table public.catalog_versions, public.movies,
  public.anonymous_players, public.game_sessions, public.game_rounds, public.game_actions,
  public.game_guesses, public.rate_limit_buckets to service_role;

-- Applies to functions created by this migration role in future migrations too.
-- Global PUBLIC default must be revoked globally; schema-only REVOKE cannot subtract it.
alter default privileges revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

create function public.catalog_coverage()
returns table (catalog_version_id uuid, rules_version text, status text, total bigint, coverage jsonb)
language sql stable security invoker set search_path = pg_catalog
as $$
  select c.id, c.rules_version, c.status,
    (select count(*) from public.movies m where m.catalog_version_id = c.id),
    coalesce((
      select jsonb_agg(to_jsonb(counts) order by counts.tier, counts.mode)
      from (
        select m.tier, mode, count(*) as count
        from public.movies m cross join lateral unnest(m.eligible_modes) mode
        where m.catalog_version_id = c.id and m.tier is not null
        group by m.tier, mode
      ) counts
    ), '[]'::jsonb)
  from public.catalog_versions c order by c.imported_at, c.id;
$$;

create function public.purge_expired()
returns jsonb
language plpgsql security invoker set search_path = pg_catalog
as $$
declare
  actions_count bigint; guesses_count bigint; sessions_count bigint;
  players_count bigint; catalogs_count bigint; buckets_count bigint;
begin
  -- One transaction. Catalog deletion cannot race a newly referencing session's FK.
  update public.game_sessions set state = 'expired', revision = revision + 1
    where state = 'active' and expires_at <= now();
  delete from public.game_actions where created_at <= now() - interval '7 days';
  get diagnostics actions_count = row_count;
  delete from public.game_guesses where created_at <= now() - interval '7 days';
  get diagnostics guesses_count = row_count;
  delete from public.game_sessions
    where (state <> 'completed' and created_at <= now() - interval '7 days')
       or (state = 'completed' and completed_at <= now() - interval '30 days');
  get diagnostics sessions_count = row_count;
  -- Expired identity hashes remain only while retained sessions still require their FK.
  delete from public.anonymous_players p where p.expires_at <= now()
    and not exists (select 1 from public.game_sessions s where s.player_id = p.id);
  get diagnostics players_count = row_count;
  delete from public.catalog_versions c where c.status = 'retired'
    and not exists (select 1 from public.game_sessions s where s.catalog_version_id = c.id);
  get diagnostics catalogs_count = row_count;
  delete from public.rate_limit_buckets where ctid in (
    select ctid from public.rate_limit_buckets where expires_at <= now() order by expires_at limit 10000
  );
  get diagnostics buckets_count = row_count;
  return jsonb_build_object('actions', actions_count, 'guesses', guesses_count,
    'sessions', sessions_count, 'players', players_count, 'catalogs', catalogs_count, 'buckets', buckets_count);
end;
$$;

revoke all on function public.catalog_coverage(), public.purge_expired() from public, anon, authenticated;
grant execute on function public.catalog_coverage(), public.purge_expired() to service_role;

commit;
