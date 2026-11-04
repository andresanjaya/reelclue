-- Fictional data only. Harness creates a new network-isolated database every time.
do $$ begin
  if current_database() <> 'reelclue_isolated_test' then
    raise exception 'Fixture seed requires the disposable reelclue_isolated_test database';
  end if;
end $$;

insert into public.catalog_versions (id, rules_version, status, summary) values
  ('10000000-0000-0000-0000-000000000001', 'fixture-v1', 'active', '{"fixture":true}'),
  ('10000000-0000-0000-0000-000000000002', 'fixture-v0', 'retired', '{"fixture":true}'),
  ('10000000-0000-0000-0000-000000000003', 'fixture-unused', 'retired', '{"fixture":true}'),
  ('10000000-0000-0000-0000-000000000004', 'fixture-staging', 'staging', '{"fixture":true}');

insert into public.movies (catalog_version_id, tmdb_id, title, original_title, release_date,
  release_year, vote_count, vote_average, popularity, runtime, original_language, tier,
  approved_aliases, source_revision, eligible_modes)
select c.id, n, 'Fictional fixture ' || n, 'Fictional fixture ' || n, '2000-01-01',
  2000, 6000, 8, 1, 90, 'en', 'easy', array['Fixture alias ' || n], 'fixture-v1',
  array['title', 'synopsis']
from public.catalog_versions c cross join generate_series(1, 2) n;

insert into public.anonymous_players (id, token_hash, created_at, expires_at) values
  ('20000000-0000-0000-0000-000000000001', repeat('a', 64), now() - interval '1 day', now() + interval '29 days'),
  ('20000000-0000-0000-0000-000000000002', repeat('b', 64), now() - interval '60 days', now() - interval '30 days'),
  ('20000000-0000-0000-0000-000000000003', repeat('c', 64), now() - interval '35 days', now() - interval '5 days');

insert into public.game_sessions (id, player_id, creation_action_id, creation_request_hash,
  catalog_version_id, rules_version, mode, level, state, created_at, expires_at, completed_at)
values
  -- Live game references retired catalog: cleanup must preserve both.
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', gen_random_uuid(), repeat('d', 64),
   '10000000-0000-0000-0000-000000000002', 'fixture-v0', 'title', 'easy', 'active', now(), now() + interval '24 hours', null),
  -- Incomplete game past seven-day retention.
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', gen_random_uuid(), repeat('e', 64),
   '10000000-0000-0000-0000-000000000001', 'fixture-v1', 'title', 'easy', 'active', now() - interval '8 days', now() - interval '7 days', null),
  -- Old result past thirty-day retention.
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002', gen_random_uuid(), repeat('f', 64),
   '10000000-0000-0000-0000-000000000001', 'fixture-v1', 'title', 'easy', 'completed', now() - interval '32 days', now() - interval '31 days', now() - interval '31 days'),
  -- Retained result owns expired player identity until result retention ends.
  ('30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000003', gen_random_uuid(), repeat('a', 64),
   '10000000-0000-0000-0000-000000000002', 'fixture-v0', 'title', 'easy', 'completed', now() - interval '10 days', now() - interval '9 days', now() - interval '9 days'),
  -- Expired but still within seven-day incomplete retention.
  ('30000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000001', gen_random_uuid(), repeat('b', 64),
   '10000000-0000-0000-0000-000000000001', 'fixture-v1', 'title', 'easy', 'active', now() - interval '2 days', now() - interval '1 day', null);

insert into public.game_rounds (id, session_id, catalog_version_id, movie_id, ordinal, mode)
select ('40000000-0000-0000-0000-' || lpad(row_number() over (order by id)::text, 12, '0'))::uuid,
  id, catalog_version_id, 1, 1, 'title' from public.game_sessions;

insert into public.game_actions (session_id, idempotency_key, request_hash, action_type, round_id, response_snapshot, created_at)
select session_id, gen_random_uuid(), repeat('a',64), 'hint', id, '{"revision":1}', now() - interval '8 days'
from public.game_rounds where session_id = '30000000-0000-0000-0000-000000000001';
insert into public.game_actions (session_id, idempotency_key, request_hash, action_type, round_id, response_snapshot)
select session_id, gen_random_uuid(), repeat('b',64), 'hint', id, '{"revision":2}'
from public.game_rounds where session_id = '30000000-0000-0000-0000-000000000001';
insert into public.game_guesses (round_id, catalog_version_id, normalized_guess, outcome, ordinal, created_at)
select id, catalog_version_id, 'old fictional guess', 'wrong', 1, now() - interval '8 days'
from public.game_rounds where session_id = '30000000-0000-0000-0000-000000000001';
insert into public.game_guesses (round_id, catalog_version_id, normalized_guess, outcome, ordinal)
select id, catalog_version_id, 'recent fictional guess', 'wrong', 2
from public.game_rounds where session_id = '30000000-0000-0000-0000-000000000001';
insert into public.rate_limit_buckets values
  (repeat('a',64), 'fixture', now() - interval '2 hours', 1, now() - interval '1 hour'),
  (repeat('b',64), 'fixture', now(), 1, now() + interval '1 hour');

set role service_role;
select * from public.catalog_coverage();
reset role;
