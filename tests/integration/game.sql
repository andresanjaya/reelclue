-- RC-008 Game Lifecycle Integration Tests
begin;
set role service_role;

-- 1. Setup 10 movies in active fixture catalog
insert into public.movies (catalog_version_id, tmdb_id, title, original_title, release_date,
  release_year, vote_count, vote_average, popularity, runtime, original_language, tier,
  approved_aliases, source_revision, eligible_modes)
select '10000000-0000-0000-0000-000000000001', n, 'Fictional movie ' || n, 'Fictional movie ' || n,
  '2000-01-01', 2000, 6000, 8, 1, 90, 'en', 'easy', array[]::text[], 'fixture-v1',
  array['poster', 'title', 'synopsis', 'cast', 'genre']
from generate_series(101, 115) n
on conflict do nothing;

-- 2. Setup player
insert into public.anonymous_players (id, token_hash, created_at, expires_at)
values ('20000000-0000-0000-0000-000000000099', repeat('9', 64), now(), now() + interval '30 days')
on conflict do nothing;

-- 3. Prepare 10 rounds jsonb
create temporary table test_rounds_json as
select jsonb_agg(jsonb_build_object(
  'movie_id', n,
  'ordinal', n - 100,
  'mode', 'title',
  'reveal_seed', gen_random_uuid()
)) as data
from generate_series(101, 110) n;

-- 4. Test unauthorized player on session creation
select pg_temp.assert_raises(
  $s$select public.create_game_session(repeat('0', 64), gen_random_uuid(), repeat('1', 64), 'title', 'easy', (select data from test_rounds_json))$s$,
  '40100'
);

-- 5. Test invalid round count (< 10)
select pg_temp.assert_raises(
  $s$select public.create_game_session(repeat('9', 64), gen_random_uuid(), repeat('1', 64), 'title', 'easy', '[]'::jsonb)$s$,
  '40001'
);

-- 6. Create game session successfully
create temporary table created_session as
select public.create_game_session(
  repeat('9', 64),
  '50000000-0000-0000-0000-000000000001'::uuid,
  repeat('1', 64),
  'title',
  'easy',
  (select data from test_rounds_json)
) as res;

select pg_temp.assert_true(
  (select (res->>'is_existing')::boolean = false from created_session),
  'session created freshly'
);

create temporary table active_session_id as
select (res->>'id')::uuid as id from created_session;

-- 7. Test creation idempotency: same action ID + same payload returns existing session
create temporary table retry_session as
select public.create_game_session(
  repeat('9', 64),
  '50000000-0000-0000-0000-000000000001'::uuid,
  repeat('1', 64),
  'title',
  'easy',
  (select data from test_rounds_json)
) as res;

select pg_temp.assert_true(
  (select (res->>'is_existing')::boolean = true and (res->>'id')::uuid = (select id from active_session_id) from retry_session),
  'idempotent retry returns existing session'
);

-- 8. Test creation conflict: same action ID + different payload raises 40901
select pg_temp.assert_raises(
  $s$select public.create_game_session(
    repeat('9', 64),
    '50000000-0000-0000-0000-000000000001'::uuid,
    repeat('2', 64),
    'title',
    'easy',
    (select data from test_rounds_json)
  )$s$,
  '40901'
);

-- 9. Verify 10 rounds exist for created session
select pg_temp.assert_true(
  (select count(*) = 10 from public.game_rounds where session_id = (select id from active_session_id)),
  'exactly 10 rounds created'
);

create temporary table first_round as
select id from public.game_rounds where session_id = (select id from active_session_id) and ordinal = 1;

-- 10. Test ownership violation: different player token raises 40401 (generic not found for other owners)
select pg_temp.assert_raises(
  'select public.apply_game_action(' ||
    quote_literal(repeat('a', 64)) || ',' ||
    quote_literal((select id from active_session_id)::text) || '::uuid,' ||
    quote_literal(gen_random_uuid()::text) || '::uuid,' ||
    quote_literal(repeat('3', 64)) || ',' ||
    '''hint'',' ||
    quote_literal((select id from first_round)::text) || '::uuid,' ||
    '0)',
  '40401'
);

-- 11. Test stale revision mismatch raises 40902
select pg_temp.assert_raises(
  'select public.apply_game_action(' ||
    quote_literal(repeat('9', 64)) || ',' ||
    quote_literal((select id from active_session_id)::text) || '::uuid,' ||
    quote_literal(gen_random_uuid()::text) || '::uuid,' ||
    quote_literal(repeat('3', 64)) || ',' ||
    '''hint'',' ||
    quote_literal((select id from first_round)::text) || '::uuid,' ||
    '99)',
  '40902'
);

-- 12. Test hint mutation (0 -> 1)
create temporary table hint_1_res as
select public.apply_game_action(
  repeat('9', 64),
  (select id from active_session_id),
  '60000000-0000-0000-0000-000000000001'::uuid,
  repeat('4', 64),
  'hint',
  (select id from first_round),
  0
) as res;

select pg_temp.assert_true(
  (select (res->>'hint_stage')::int = 1 and (res->>'revision')::int = 1 from hint_1_res),
  'hint 1 applied and revision incremented'
);

-- 13. Test action idempotency: same action ID on mutation returns cached snapshot without incrementing revision
create temporary table hint_1_retry as
select public.apply_game_action(
  repeat('9', 64),
  (select id from active_session_id),
  '60000000-0000-0000-0000-000000000001'::uuid,
  repeat('4', 64),
  'hint',
  (select id from first_round),
  0
) as res;

select pg_temp.assert_true(
  (select (res->>'cached')::boolean = true from hint_1_retry),
  'idempotent mutation retry returns cached'
);

select pg_temp.assert_true(
  (select revision = 1 from public.game_sessions where id = (select id from active_session_id)),
  'revision not incremented twice on retry'
);

-- 14. Test action conflict: same action ID with different payload raises 40901
select pg_temp.assert_raises(
  'select public.apply_game_action(' ||
    quote_literal(repeat('9', 64)) || ',' ||
    quote_literal((select id from active_session_id)::text) || '::uuid,' ||
    '''60000000-0000-0000-0000-000000000001''::uuid,' ||
    quote_literal(repeat('5', 64)) || ',' ||
    '''hint'',' ||
    quote_literal((select id from first_round)::text) || '::uuid,' ||
    '1)',
  '40901'
);

-- 15. Advance hints to max (stage 3)
select public.apply_game_action(
  repeat('9', 64),
  (select id from active_session_id),
  gen_random_uuid(),
  repeat('6', 64),
  'hint',
  (select id from first_round),
  1
);

select public.apply_game_action(
  repeat('9', 64),
  (select id from active_session_id),
  gen_random_uuid(),
  repeat('7', 64),
  'hint',
  (select id from first_round),
  2
);

-- Test exceeding hint limit (hint stage >= 3 raises 40906)
select pg_temp.assert_raises(
  'select public.apply_game_action(' ||
    quote_literal(repeat('9', 64)) || ',' ||
    quote_literal((select id from active_session_id)::text) || '::uuid,' ||
    quote_literal(gen_random_uuid()::text) || '::uuid,' ||
    quote_literal(repeat('8', 64)) || ',' ||
    '''hint'',' ||
    quote_literal((select id from first_round)::text) || '::uuid,' ||
    '3)',
  '40906'
);

-- 16. Test advancing next round while current round is still in 'guessing' raises 40908
select pg_temp.assert_raises(
  'select public.apply_game_action(' ||
    quote_literal(repeat('9', 64)) || ',' ||
    quote_literal((select id from active_session_id)::text) || '::uuid,' ||
    quote_literal(gen_random_uuid()::text) || '::uuid,' ||
    quote_literal(repeat('8', 64)) || ',' ||
    '''next'',' ||
    quote_literal((select id from first_round)::text) || '::uuid,' ||
    '3)',
  '40908'
);

-- 17. Test skipping round
create temporary table skip_res as
select public.apply_game_action(
  repeat('9', 64),
  (select id from active_session_id),
  gen_random_uuid(),
  repeat('9', 64),
  'skip',
  (select id from first_round),
  3,
  '{"title":"Fictional movie 101"}'::jsonb
) as res;

select pg_temp.assert_true(
  (select (res->>'round_state')::text = 'skipped' and (res->>'round_score')::int = 0 and (res->>'revision')::int = 4 from skip_res),
  'skip round transition to skipped with 0 score'
);

-- Test hint on skipped round raises 40905
select pg_temp.assert_raises(
  'select public.apply_game_action(' ||
    quote_literal(repeat('9', 64)) || ',' ||
    quote_literal((select id from active_session_id)::text) || '::uuid,' ||
    quote_literal(gen_random_uuid()::text) || '::uuid,' ||
    quote_literal(repeat('a', 64)) || ',' ||
    '''hint'',' ||
    quote_literal((select id from first_round)::text) || '::uuid,' ||
    '4)',
  '40905'
);

-- 18. Test advance to next round after skipped
create temporary table next_res as
select public.apply_game_action(
  repeat('9', 64),
  (select id from active_session_id),
  gen_random_uuid(),
  repeat('b', 64),
  'next',
  (select id from first_round),
  4
) as res;

select pg_temp.assert_true(
  (select (res->>'current_round')::int = 2 and (res->>'revision')::int = 5 from next_res),
  'advanced to round 2'
);

-- 19. Test 24h Expiry: set created_at and expires_at in past
update public.game_sessions
  set created_at = now() - interval '25 hours',
      expires_at = now() - interval '1 hour'
  where id = (select id from active_session_id);

select pg_temp.assert_raises(
  'select public.apply_game_action(' ||
    quote_literal(repeat('9', 64)) || ',' ||
    quote_literal((select id from active_session_id)::text) || '::uuid,' ||
    quote_literal(gen_random_uuid()::text) || '::uuid,' ||
    quote_literal(repeat('c', 64)) || ',' ||
    '''hint'',' ||
    quote_literal((select id from first_round)::text) || '::uuid,' ||
    '5)',
  '41001'
);

-- 20. Verify browser roles denied direct execution of RPCs
reset role;
set role anon;
select pg_temp.assert_raises($s$select public.create_game_session('','00000000-0000-0000-0000-000000000000'::uuid,'','','','[]'::jsonb)$s$, '42501');
select pg_temp.assert_raises($s$select public.apply_game_action('','00000000-0000-0000-0000-000000000000'::uuid,'00000000-0000-0000-0000-000000000000'::uuid,'','','00000000-0000-0000-0000-000000000000'::uuid,0)$s$, '42501');
select pg_temp.assert_raises($s$select public.record_game_action('00000000-0000-0000-0000-000000000000'::uuid,'00000000-0000-0000-0000-000000000000'::uuid,'','','00000000-0000-0000-0000-000000000000'::uuid,'{}'::jsonb)$s$, '42501');

reset role;
set role authenticated;
select pg_temp.assert_raises($s$select public.create_game_session('','00000000-0000-0000-0000-000000000000'::uuid,'','','','[]'::jsonb)$s$, '42501');
select pg_temp.assert_raises($s$select public.apply_game_action('','00000000-0000-0000-0000-000000000000'::uuid,'00000000-0000-0000-0000-000000000000'::uuid,'','','00000000-0000-0000-0000-000000000000'::uuid,0)$s$, '42501');
select pg_temp.assert_raises($s$select public.record_game_action('00000000-0000-0000-0000-000000000000'::uuid,'00000000-0000-0000-0000-000000000000'::uuid,'','','00000000-0000-0000-0000-000000000000'::uuid,'{}'::jsonb)$s$, '42501');

reset role;
rollback;
