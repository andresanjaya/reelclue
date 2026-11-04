\set ON_ERROR_STOP on
create function pg_temp.assert_true(ok boolean, label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'Assertion failed: %', label; end if; end $$;
create function pg_temp.assert_raises(statement text, expected text) returns void language plpgsql as $$
begin
  begin execute statement;
  exception when others then
    if sqlstate = expected then return; end if;
    raise exception 'Expected SQLSTATE %, got %', expected, sqlstate;
  end;
  raise exception 'Expected SQLSTATE %, statement succeeded', expected;
end $$;

grant execute on function pg_temp.assert_true(boolean, text), pg_temp.assert_raises(text, text) to anon, authenticated, service_role;

select pg_temp.assert_raises($s$insert into public.catalog_versions(rules_version,status) values ('duplicate','active')$s$, '23505');
select pg_temp.assert_raises($s$insert into public.anonymous_players(token_hash) values ('raw-token')$s$, '23514');
select pg_temp.assert_raises($s$insert into public.anonymous_players(token_hash) values (repeat('a',64))$s$, '23505');
select pg_temp.assert_raises($s$update public.game_sessions set player_id = gen_random_uuid()$s$, '23503');
select pg_temp.assert_raises($s$update public.game_sessions set current_round = 11$s$, '23514');
select pg_temp.assert_raises($s$update public.game_sessions set revision = -1$s$, '23514');
select pg_temp.assert_raises($s$update public.game_sessions set creation_action_id = (select creation_action_id from public.game_sessions where id = '30000000-0000-0000-0000-000000000001') where id = '30000000-0000-0000-0000-000000000005'$s$, '23505');
select pg_temp.assert_raises($s$update public.game_rounds set hint_stage = 4$s$, '23514');
select pg_temp.assert_raises($s$update public.game_rounds set wrong_attempts = 3$s$, '23514');
select pg_temp.assert_raises($s$update public.game_rounds set ordinal = 0$s$, '23514');
select pg_temp.assert_raises($s$update public.game_rounds set score = 201$s$, '23514');
select pg_temp.assert_raises($s$update public.game_rounds set catalog_version_id = '10000000-0000-0000-0000-000000000003'$s$, '23503');
select pg_temp.assert_raises($s$delete from public.catalog_versions where id = '10000000-0000-0000-0000-000000000002'$s$, '23503');
select pg_temp.assert_raises($s$insert into public.game_rounds(session_id,catalog_version_id,movie_id,ordinal,mode) select session_id,catalog_version_id,2,ordinal,mode from public.game_rounds limit 1$s$, '23505');
select pg_temp.assert_raises($s$insert into public.game_rounds(session_id,catalog_version_id,movie_id,ordinal,mode) select session_id,catalog_version_id,movie_id,2,mode from public.game_rounds limit 1$s$, '23505');
select pg_temp.assert_raises($s$insert into public.game_actions select * from public.game_actions limit 1$s$, '23505');
select pg_temp.assert_raises($s$update public.game_actions set round_id = '40000000-0000-0000-0000-000000000002'$s$, '23503');
select pg_temp.assert_raises($s$insert into public.game_guesses(round_id,catalog_version_id,normalized_guess,outcome,ordinal) select round_id,catalog_version_id,normalized_guess,outcome,ordinal from public.game_guesses limit 1$s$, '23505');
select pg_temp.assert_raises($s$update public.game_guesses set selected_movie_id = 2$s$, '23514');
select pg_temp.assert_raises($s$update public.game_guesses set catalog_version_id = '10000000-0000-0000-0000-000000000003'$s$, '23503');
begin;
insert into public.game_guesses (round_id,catalog_version_id,selected_movie_id,outcome,ordinal)
select round_id,catalog_version_id,2,'wrong',3 from public.game_guesses limit 1;
select pg_temp.assert_raises($s$insert into public.game_guesses(round_id,catalog_version_id,selected_movie_id,outcome,ordinal) select round_id,catalog_version_id,selected_movie_id,outcome,ordinal from public.game_guesses where selected_movie_id is not null limit 1$s$, '23505');
rollback;
select pg_temp.assert_raises($s$update public.rate_limit_buckets set expires_at = window_start + interval '25 hours'$s$, '23514');

-- Check every table's ACL and RLS, and actual denial under both browser roles.
do $$ declare t text; r text; f text;
begin
  foreach t in array array['catalog_versions','movies','anonymous_players','game_sessions','game_rounds','game_actions','game_guesses','rate_limit_buckets'] loop
    perform pg_temp.assert_true((select relrowsecurity from pg_class where oid = ('public.' || t)::regclass), t || ' RLS');
    foreach r in array array['anon','authenticated'] loop
      perform pg_temp.assert_true(not has_table_privilege(r,'public.' || t,'SELECT,INSERT,UPDATE,DELETE'), r || ' no table ACL');
      execute format('set local role %I',r);
      perform pg_temp.assert_raises('select * from public.' || t, '42501');
      perform pg_temp.assert_raises('delete from public.' || t, '42501');
      reset role;
    end loop;
  end loop;
  foreach f in array array['catalog_coverage','purge_expired'] loop
    foreach r in array array['anon','authenticated'] loop
      perform pg_temp.assert_true(not has_function_privilege(r,'public.' || f || '()','EXECUTE'), r || ' no RPC');
      execute format('set local role %I',r);
      perform pg_temp.assert_raises('select public.' || f || '()', '42501');
      reset role;
    end loop;
  end loop;
end $$;

-- RLS still denies rows if someone mistakenly grants table access later.
begin;
grant select, insert on public.movies to anon, authenticated;
set local role anon;
select pg_temp.assert_true((select count(*) = 0 from public.movies), 'anon RLS returns no answers');
select pg_temp.assert_raises($s$insert into public.movies(catalog_version_id,tmdb_id,title,original_title,release_date,release_year,vote_count,vote_average,popularity,runtime,original_language,source_revision) values ('10000000-0000-0000-0000-000000000001',99,'Fiction','Fiction','2000-01-01',2000,500,7,1,90,'en','fixture')$s$, '42501');
set local role authenticated;
select pg_temp.assert_true((select count(*) = 0 from public.movies), 'authenticated RLS returns no answers');
rollback;

set role service_role;
select pg_temp.assert_true((select count(*) = 4 from public.catalog_coverage()), 'server coverage version count');
select pg_temp.assert_true((select total = 2 and coverage @> '[{"tier":"easy","mode":"title","count":2}]' from public.catalog_coverage() where status = 'active'), 'coverage tier/mode counts');
select public.purge_expired();
select pg_temp.assert_true((select count(*) = 3 from public.game_sessions), 'expired session/result purge');
select pg_temp.assert_true((select state = 'expired' and revision = 1 from public.game_sessions where id = '30000000-0000-0000-0000-000000000005'), 'expired retained game transitions once');
select pg_temp.assert_true((select count(*) = 3 from public.game_rounds), 'round cascade');
select pg_temp.assert_true((select count(*) = 1 from public.game_actions), 'old actions removed/recent retained');
select pg_temp.assert_true((select count(*) = 1 from public.game_guesses), 'old guesses removed/recent retained');
select pg_temp.assert_true((select count(*) = 2 from public.anonymous_players), 'expired unreferenced player removed');
select pg_temp.assert_true((select count(*) = 1 from public.rate_limit_buckets), 'expired buckets removed');
select pg_temp.assert_true((select count(*) = 3 from public.catalog_versions), 'only unused retired catalog removed');
select pg_temp.assert_true(exists(select 1 from public.catalog_versions where id = '10000000-0000-0000-0000-000000000002'), 'referenced retired version retained');
select pg_temp.assert_true(exists(select 1 from public.catalog_versions where status = 'active'), 'active catalog retained');
select pg_temp.assert_true(exists(select 1 from public.catalog_versions where status = 'staging'), 'staging catalog retained');
select pg_temp.assert_true(public.purge_expired() = '{"actions":0,"guesses":0,"sessions":0,"players":0,"catalogs":0,"buckets":0}'::jsonb, 'purge repeat safe');
-- Once final references age out, retired catalog and expired identity may be removed.
update public.game_sessions set created_at = now() - interval '40 days', expires_at = now() - interval '39 days',
  completed_at = case when state = 'completed' then now() - interval '39 days' else null end
where catalog_version_id = '10000000-0000-0000-0000-000000000002';
select public.purge_expired();
select pg_temp.assert_true(not exists(select 1 from public.catalog_versions where id = '10000000-0000-0000-0000-000000000002'), 'retired catalog removed after final reference');
select pg_temp.assert_true(not exists(select 1 from public.anonymous_players where id = '20000000-0000-0000-0000-000000000003'), 'expired identity removed after final result');
reset role;

-- A newly created RPC must not inherit PostgreSQL's PUBLIC execute default.
begin;
create function public.fixture_future_rpc() returns integer language sql set search_path = pg_catalog as 'select 1';
select pg_temp.assert_true(not has_function_privilege('anon','public.fixture_future_rpc()','EXECUTE'), 'future RPC anon default denied');
select pg_temp.assert_true(not has_function_privilege('authenticated','public.fixture_future_rpc()','EXECUTE'), 'future RPC authenticated default denied');
rollback;
