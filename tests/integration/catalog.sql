-- All rows fictional. Test migration transactions only; never a real imported catalog.
begin;
grant select on prepared_fixture to service_role;
set role service_role;
select pg_temp.assert_raises($s$select public.stage_catalog('[]','{"source":"fixture","rulesVersion":"base-v1","tieringVersion":"tiering-v1","asOf":"2026-11-04"}')$s$, 'P0001');
select pg_temp.assert_raises($s$select public.stage_catalog(rows,report) from prepared_fixture$s$, 'P0001');
select pg_temp.assert_true((select report->>'candidates' = '1' and report->>'duplicates' = '2' from prepared_fixture), 'fake-provider dedupe before DB stage');
select pg_temp.assert_true((select report->>'tieringVersion' = 'tiering-v1' from prepared_fixture), 'fake-provider reviewed tiering output');
select pg_temp.assert_raises($s$select public.activate_catalog('10000000-0000-0000-0000-000000000004')$s$, 'P0001');

-- Test only: simulate real source attestation for prepared fictional rows inside disposable DB.
create temporary table import_rows as select rows as data, report || '{"source":"tmdb"}'::jsonb as summary from prepared_fixture;
create temporary table staged as select public.stage_catalog(data, summary) id from import_rows;
select pg_temp.assert_true((select status = 'staging' and tiering_version = 'tiering-v1' from public.catalog_versions where id = (select id from staged)), 'staged with reviewed tiering_version');
select pg_temp.assert_true((select tier = 'easy' and familiarity_score is not null from public.movies where catalog_version_id = (select id from staged)), 'staged movie has valid tier and familiarity');
select pg_temp.assert_raises('select public.activate_catalog(''' || (select id from staged) || ''')', 'P0001');
select pg_temp.assert_true((select count(*) = 1 from public.catalog_versions where status = 'active'), 'old active unchanged');

select pg_temp.assert_raises('select public.stage_catalog(' || quote_literal((select data || data from import_rows)::text) || '::jsonb,' || quote_literal((select summary from import_rows)::text) || '::jsonb)', '23505');
select pg_temp.assert_true((select count(*) = 1 from public.catalog_versions where source = 'tmdb'), 'bad-row stage rolls back whole version');

-- Test coverage gate and atomic activation with 300 compliant movies
delete from public.movies where catalog_version_id = (select id from staged);
insert into public.movies(catalog_version_id,tmdb_id,title,original_title,release_date,release_year,vote_count,vote_average,popularity,
 runtime,original_language,source_revision,tier,familiarity_score,eligible_modes)
select (select id from staged), n, 'Fictional test ' || n, 'Fictional test ' || n, '2000-01-01',2000,
 case when n <= 100 then 6000 when n <= 200 then 2500 else 1200 end,
 8,1,90,'en','fixture-test',
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
