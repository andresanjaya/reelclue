-- RC-009 Answer Validation and Scoring Integration Tests
begin;
set role service_role;

-- 1. Setup 10 movies in active fixture catalog
insert into public.movies (catalog_version_id, tmdb_id, title, original_title, release_date,
  release_year, vote_count, vote_average, popularity, runtime, original_language, tier,
  approved_aliases, source_revision, eligible_modes)
select '10000000-0000-0000-0000-000000000001', n, 'Scoring Test Movie ' || n, 'Scoring Test Movie ' || n,
  '2000-01-01', 2000, 6000, 8, 1, 90, 'en', 'easy', array['Alias ' || n]::text[], 'fixture-v1',
  array['poster', 'title', 'synopsis', 'cast', 'genre']
from generate_series(201, 210) n
on conflict do nothing;

-- 2. Setup player
insert into public.anonymous_players (id, token_hash, created_at, expires_at)
values ('20000000-0000-0000-0000-000000000088', repeat('8', 64), now(), now() + interval '30 days')
on conflict do nothing;

-- 3. Prepare rounds jsonb
create temporary table scoring_rounds_json as
select jsonb_agg(jsonb_build_object(
  'movie_id', n,
  'ordinal', n - 200,
  'mode', 'title',
  'reveal_seed', gen_random_uuid()
)) as data
from generate_series(201, 210) n;

-- 4. Create session for scoring tests
create temporary table scoring_session_res as
select public.create_game_session(
  repeat('8', 64),
  '70000000-0000-0000-0000-000000000001'::uuid,
  repeat('1', 64),
  'title',
  'easy',
  (select data from scoring_rounds_json)
) as res;

create temporary table scoring_session_id as
select (res->>'id')::uuid as id from scoring_session_res;

create temporary table scoring_round_1 as
select id, movie_id from public.game_rounds where session_id = (select id from scoring_session_id) and ordinal = 1;

-- 5. Test 1st wrong guess consumes 1 attempt
create temporary table wrong_1_res as
select public.apply_game_guess(
  repeat('8', 64),
  (select id from scoring_session_id),
  '80000000-0000-0000-0000-000000000001'::uuid,
  repeat('01', 32),
  (select id from scoring_round_1),
  0,
  'wrong movie title',
  null,
  false,
  null
) as res;

select pg_temp.assert_true(
  (select (res->>'outcome') = 'wrong' and (res->>'wrong_attempts')::int = 1 and (res->>'revision')::int = 1 from wrong_1_res),
  'first wrong guess increments wrong_attempts to 1 and increments revision'
);

-- 6. Test duplicate wrong guess consumes NO attempt and does not increment revision
create temporary table duplicate_wrong_res as
select public.apply_game_guess(
  repeat('8', 64),
  (select id from scoring_session_id),
  '80000000-0000-0000-0000-000000000002'::uuid,
  repeat('02', 32),
  (select id from scoring_round_1),
  1,
  'wrong movie title',
  null,
  false,
  null
) as res;

select pg_temp.assert_true(
  (select (res->>'outcome') = 'wrong' and (res->>'is_duplicate')::boolean = true and (res->>'wrong_attempts')::int = 1 and (res->>'revision')::int = 1 from duplicate_wrong_res),
  'duplicate wrong text consumes no attempt'
);

-- 7. Test ambiguous guess consumes NO attempt and does not increment revision
create temporary table ambiguous_res as
select public.apply_game_guess(
  repeat('8', 64),
  (select id from scoring_session_id),
  '80000000-0000-0000-0000-000000000003'::uuid,
  repeat('0a', 32),
  (select id from scoring_round_1),
  1,
  'ambiguous title',
  null,
  true,
  null
) as res;

select pg_temp.assert_true(
  (select (res->>'outcome') = 'ambiguous' and (res->>'wrong_attempts')::int = 1 and (res->>'revision')::int = 1 from ambiguous_res),
  'ambiguous guess consumes no attempt and records outcome ambiguous'
);

-- 8. Test 2nd distinct wrong guess consumes 2nd attempt
create temporary table wrong_2_res as
select public.apply_game_guess(
  repeat('8', 64),
  (select id from scoring_session_id),
  '80000000-0000-0000-0000-000000000004'::uuid,
  repeat('03', 32),
  (select id from scoring_round_1),
  1,
  'second wrong guess',
  null,
  false,
  null
) as res;

select pg_temp.assert_true(
  (select (res->>'outcome') = 'wrong' and (res->>'wrong_attempts')::int = 2 and (res->>'revision')::int = 2 from wrong_2_res),
  'second wrong guess increments wrong_attempts to 2'
);

-- 9. Test 3rd wrong guess exhausts the round (state -> exhausted, score -> 0)
create temporary table wrong_3_res as
select public.apply_game_guess(
  repeat('8', 64),
  (select id from scoring_session_id),
  '80000000-0000-0000-0000-000000000005'::uuid,
  repeat('04', 32),
  (select id from scoring_round_1),
  2,
  'third wrong guess',
  null,
  false,
  '{"title":"Scoring Test Movie 201"}'::jsonb
) as res;

select pg_temp.assert_true(
  (select (res->>'outcome') = 'wrong' and (res->>'wrong_attempts')::int = 3 and (res->>'round_state') = 'exhausted' and (res->>'round_score')::int = 0 and (res->>'revision')::int = 3 from wrong_3_res),
  'third wrong guess exhausts round'
);

-- 10. Test terminal lock: submitting guess on exhausted round raises 40905
select pg_temp.assert_raises(
  'select public.apply_game_guess(' ||
    quote_literal(repeat('8', 64)) || ',' ||
    quote_literal((select id from scoring_session_id)::text) || '::uuid,' ||
    quote_literal(gen_random_uuid()::text) || '::uuid,' ||
    quote_literal(repeat('05', 32)) || ',' ||
    quote_literal((select id from scoring_round_1)::text) || '::uuid,' ||
    '3,' ||
    '''another guess'',' ||
    'null, false, null)',
  '40905'
);

-- 11. Advance to round 2 via next action
select public.apply_game_action(
  repeat('8', 64),
  (select id from scoring_session_id),
  gen_random_uuid(),
  repeat('11', 32),
  'next',
  (select id from scoring_round_1),
  3
);

create temporary table scoring_round_2 as
select id, movie_id from public.game_rounds where session_id = (select id from scoring_session_id) and ordinal = 2;

-- 12. Test correct answer scoring on round 2:
-- Round 2 is fresh (0 wrong attempts, 0 hints on Easy -> scores 100 points)
create temporary table correct_res as
select public.apply_game_guess(
  repeat('8', 64),
  (select id from scoring_session_id),
  '80000000-0000-0000-0000-000000000010'::uuid,
  repeat('c1', 32),
  (select id from scoring_round_2),
  4,
  null,
  (select movie_id from scoring_round_2),
  false,
  '{"title":"Scoring Test Movie 202"}'::jsonb
) as res;

select pg_temp.assert_true(
  (select (res->>'outcome') = 'correct' and (res->>'points')::int = 100 and (res->>'round_state') = 'correct' and (res->>'session_score')::int = 100 and (res->>'revision')::int = 5 from correct_res),
  'correct answer scores 100 points on Easy with 0 wrong and 0 hints'
);

-- 13. Test idempotency on guess: re-sending same action ID returns cached response
create temporary table correct_retry as
select public.apply_game_guess(
  repeat('8', 64),
  (select id from scoring_session_id),
  '80000000-0000-0000-0000-000000000010'::uuid,
  repeat('c1', 32),
  (select id from scoring_round_2),
  4,
  null,
  (select movie_id from scoring_round_2),
  false,
  '{"title":"Scoring Test Movie 202"}'::jsonb
) as res;

select pg_temp.assert_true(
  (select (res->>'cached')::boolean = true from correct_retry),
  'idempotent retry on guess returns cached'
);

select pg_temp.assert_true(
  (select score = 100 from public.game_sessions where id = (select id from scoring_session_id)),
  'session score not increased twice on retry'
);

-- 14. Test terminal lock on correct round: submitting another guess raises 40905
select pg_temp.assert_raises(
  'select public.apply_game_guess(' ||
    quote_literal(repeat('8', 64)) || ',' ||
    quote_literal((select id from scoring_session_id)::text) || '::uuid,' ||
    quote_literal(gen_random_uuid()::text) || '::uuid,' ||
    quote_literal(repeat('c2', 32)) || ',' ||
    quote_literal((select id from scoring_round_2)::text) || '::uuid,' ||
    '5,' ||
    'null,' ||
    quote_literal((select movie_id from scoring_round_2)::text) || '::bigint, false, null)',
  '40905'
);

-- 15. Advance to round 3 to test 0-point correct answer (2 wrong attempts + 3 hints on Easy -> 100 - 50 - 60 = 0 points)
select public.apply_game_action(
  repeat('8', 64),
  (select id from scoring_session_id),
  gen_random_uuid(),
  repeat('12', 32),
  'next',
  (select id from scoring_round_2),
  5
);

create temporary table scoring_round_3 as
select id, movie_id from public.game_rounds where session_id = (select id from scoring_session_id) and ordinal = 3;

-- Add 3 hints (revisions 6, 7, 8)
select public.apply_game_action(repeat('8', 64), (select id from scoring_session_id), gen_random_uuid(), repeat('21', 32), 'hint', (select id from scoring_round_3), 6);
select public.apply_game_action(repeat('8', 64), (select id from scoring_session_id), gen_random_uuid(), repeat('22', 32), 'hint', (select id from scoring_round_3), 7);
select public.apply_game_action(repeat('8', 64), (select id from scoring_session_id), gen_random_uuid(), repeat('23', 32), 'hint', (select id from scoring_round_3), 8);

-- Add 2 wrong guesses (revisions 9, 10)
select public.apply_game_guess(repeat('8', 64), (select id from scoring_session_id), gen_random_uuid(), repeat('26', 32), (select id from scoring_round_3), 9, 'wrong guess 1', null, false, null);
select public.apply_game_guess(repeat('8', 64), (select id from scoring_session_id), gen_random_uuid(), repeat('27', 32), (select id from scoring_round_3), 10, 'wrong guess 2', null, false, null);

-- Now submit correct answer (revision 11)
create temporary table zero_point_correct as
select public.apply_game_guess(
  repeat('8', 64),
  (select id from scoring_session_id),
  gen_random_uuid(),
  repeat('33', 32),
  (select id from scoring_round_3),
  11,
  null,
  (select movie_id from scoring_round_3),
  false,
  '{"title":"Scoring Test Movie 203"}'::jsonb
) as res;

select pg_temp.assert_true(
  (select (res->>'outcome') = 'correct' and (res->>'points')::int = 0 and (res->>'round_state') = 'correct' and (res->>'session_score')::int = 100 from zero_point_correct),
  'correct answer with 2 wrong and 3 hints on Easy scores exactly 0 points without going negative'
);

-- 16. Verify browser roles cannot execute apply_game_guess
reset role;
set role anon;
select pg_temp.assert_raises($s$select public.apply_game_guess('','00000000-0000-0000-0000-000000000000'::uuid,'00000000-0000-0000-0000-000000000000'::uuid,'','00000000-0000-0000-0000-000000000000'::uuid,0)$s$, '42501');

reset role;
set role authenticated;
select pg_temp.assert_raises($s$select public.apply_game_guess('','00000000-0000-0000-0000-000000000000'::uuid,'00000000-0000-0000-0000-000000000000'::uuid,'','00000000-0000-0000-0000-000000000000'::uuid,0)$s$, '42501');

reset role;
rollback;
