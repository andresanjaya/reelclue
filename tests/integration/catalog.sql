-- All rows fictional. Test migration transactions only; never a real imported catalog.
begin;
grant select on prepared_fixture to service_role;
set role service_role;
select pg_temp.assert_raises($s$select public.stage_catalog('[]','{"source":"fixture","rulesVersion":"base-v1","tiers":"pending_rc007","asOf":"2026-11-04"}')$s$, 'P0001');
select pg_temp.assert_raises($s$select public.stage_catalog(rows,report) from prepared_fixture$s$, 'P0001');
select pg_temp.assert_true((select report->>'candidates' = '1' and report->>'duplicates' = '2' from prepared_fixture), 'fake-provider dedupe before DB stage');
select pg_temp.assert_raises($s$select public.activate_catalog('10000000-0000-0000-0000-000000000004')$s$, 'P0001');

-- Test only: simulate real source attestation for prepared fictional rows inside disposable DB.
create temporary table import_rows as select rows as data from prepared_fixture;
create temporary table staged as select public.stage_catalog(data,
  '{"source":"tmdb","rulesVersion":"base-v1","tiers":"pending_rc007","asOf":"2026-11-04"}') id from import_rows;
select pg_temp.assert_true((select status = 'staging' and tiering_version is null from public.catalog_versions where id = (select id from staged)), 'stage only');
select pg_temp.assert_raises('select public.activate_catalog(''' || (select id from staged) || ''')', 'P0001');
select pg_temp.assert_true((select count(*) = 1 from public.catalog_versions where status = 'active'), 'old active unchanged');

select pg_temp.assert_raises('select public.stage_catalog(' || quote_literal((select data || data from import_rows)::text) || '::jsonb,' || quote_literal('{"source":"tmdb","rulesVersion":"base-v1","tiers":"pending_rc007","asOf":"2026-11-04"}') || '::jsonb)', '23505');
select pg_temp.assert_true((select count(*) = 1 from public.catalog_versions where source = 'tmdb'), 'bad-row stage rolls back whole version');

-- Simulate RC-007's future output only inside rollback transaction; no tiering engine added here.
update public.catalog_versions set tiering_version = 'fixture-test-only' where id = (select id from staged);
select pg_temp.assert_raises('select public.activate_catalog(''' || (select id from staged) || ''')', 'P0001');
delete from public.movies where catalog_version_id = (select id from staged);
insert into public.movies(catalog_version_id,tmdb_id,title,original_title,release_date,release_year,vote_count,vote_average,popularity,
 runtime,original_language,source_revision,tier,familiarity_score,eligible_modes)
select (select id from staged), n, 'Fictional test ' || n, 'Fictional test ' || n, '2000-01-01',2000,6000,8,1,90,'en','fixture-test',
 case when n <= 100 then 'easy' when n <= 200 then 'medium' else 'hard' end,0.5,array['poster','title','synopsis','cast','genre']
from generate_series(1,300) n;
update public.catalog_versions set source = 'fixture' where id = (select id from staged);
select pg_temp.assert_raises('select public.activate_catalog(''' || (select id from staged) || ''')', 'P0001');
update public.catalog_versions set source = 'tmdb' where id = (select id from staged);
select public.activate_catalog((select id from staged));
select pg_temp.assert_true((select status = 'active' from public.catalog_versions where id = (select id from staged)), 'atomic activation after coverage');
select pg_temp.assert_true((select status = 'retired' from public.catalog_versions where id = '10000000-0000-0000-0000-000000000001'), 'previous catalog retired not deleted');
reset role;
set role anon;
select pg_temp.assert_raises($s$select public.stage_catalog('[]','{}')$s$, '42501');
select pg_temp.assert_raises($s$select public.activate_catalog(gen_random_uuid())$s$, '42501');
reset role;
set role authenticated;
select pg_temp.assert_raises($s$select public.stage_catalog('[]','{}')$s$, '42501');
select pg_temp.assert_raises($s$select public.activate_catalog(gen_random_uuid())$s$, '42501');
reset role;
rollback;
