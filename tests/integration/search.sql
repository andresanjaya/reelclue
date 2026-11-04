-- RC-010 Catalog Search Integration Tests
begin;
set role service_role;

-- 1. Setup fixture catalog movies with exact, prefix, substring, alias, and remakes
insert into public.catalog_versions (id, rules_version, status, summary)
values ('10000000-0000-0000-0000-000000000099', 'fixture-retired', 'retired', '{"test":true}')
on conflict do nothing;

insert into public.movies (catalog_version_id, tmdb_id, title, original_title, release_date,
  release_year, vote_count, vote_average, popularity, runtime, original_language, tier,
  approved_aliases, source_revision, eligible_modes)
values
  ('10000000-0000-0000-0000-000000000001', 501, 'The Matrix', 'The Matrix', '1999-03-31', 1999, 20000, 8.2, 50.5, 136, 'en', 'easy', array['Matrix 1']::text[], 'fixture-v1', array['title', 'poster']::text[]),
  ('10000000-0000-0000-0000-000000000001', 502, 'The Matrix Reloaded', 'The Matrix Reloaded', '2003-05-15', 2003, 10000, 7.0, 30.2, 138, 'en', 'easy', array[]::text[], 'fixture-v1', array['title', 'poster']::text[]),
  ('10000000-0000-0000-0000-000000000001', 503, 'The Matrix Revolutions', 'The Matrix Revolutions', '2003-11-05', 2003, 9000, 6.7, 25.1, 129, 'en', 'easy', array[]::text[], 'fixture-v1', array['title', 'poster']::text[]),
  ('10000000-0000-0000-0000-000000000001', 504, 'The Matrix Resurrections', 'The Matrix Resurrections', '2021-12-22', 2021, 5000, 5.8, 20.0, 148, 'en', 'medium', array[]::text[], 'fixture-v1', array['title', 'poster']::text[]),
  ('10000000-0000-0000-0000-000000000001', 505, 'Something Matrix Inside', 'Something Matrix Inside', '2010-01-01', 2010, 500, 6.0, 10.0, 90, 'en', 'hard', array[]::text[], 'fixture-v1', array['title', 'poster']::text[]),
  ('10000000-0000-0000-0000-000000000001', 506, 'Virtual World', 'Matrix In Disguise', '2005-01-01', 2005, 400, 6.0, 5.0, 90, 'en', 'hard', array[]::text[], 'fixture-v1', array['title', 'poster']::text[]),
  ('10000000-0000-0000-0000-000000000001', 507, 'Cyber World', 'Cyber World', '2008-01-01', 2008, 300, 6.0, 4.0, 90, 'en', 'hard', array['Matrix Alias']::text[], 'fixture-v1', array['title', 'poster']::text[]),
  -- Remakes: same title, different years
  ('10000000-0000-0000-0000-000000000001', 508, 'Solaris', 'Solyaris', '1972-03-20', 1972, 2000, 8.0, 15.0, 167, 'ru', 'medium', array[]::text[], 'fixture-v1', array['title', 'poster']::text[]),
  ('10000000-0000-0000-0000-000000000001', 509, 'Solaris', 'Solaris', '2002-11-27', 2002, 1800, 6.2, 12.0, 99, 'en', 'medium', array[]::text[], 'fixture-v1', array['title', 'poster']::text[]),
  -- Extra movies to test limit 8
  ('10000000-0000-0000-0000-000000000001', 510, 'Matrix Extra 1', 'Matrix Extra 1', '2011-01-01', 2011, 100, 5.0, 2.0, 90, 'en', 'hard', array[]::text[], 'fixture-v1', array['title', 'poster']::text[]),
  ('10000000-0000-0000-0000-000000000001', 511, 'Matrix Extra 2', 'Matrix Extra 2', '2012-01-01', 2012, 100, 5.0, 1.0, 90, 'en', 'hard', array[]::text[], 'fixture-v1', array['title', 'poster']::text[]),
  -- Inactive catalog movie (retired catalog) should NEVER be returned
  ('10000000-0000-0000-0000-000000000099', 599, 'The Matrix Inactive', 'The Matrix Inactive', '2020-01-01', 2020, 9999, 9.0, 99.0, 120, 'en', 'easy', array[]::text[], 'fixture-v0', array['title', 'poster']::text[])
on conflict do nothing;

-- 2. Test search returns max 8 items
create temporary table search_matrix as
select * from public.search_catalog_movies('Matrix', 8);

select pg_temp.assert_true(
  (select count(*) = 8 from search_matrix),
  'search caps results at 8 items'
);

-- 3. Test exact and prefix ordering: 'The Matrix' matches first for query 'The Matrix'
create temporary table search_exact as
select * from public.search_catalog_movies('The Matrix', 8);

select pg_temp.assert_true(
  (select tmdb_id from search_exact limit 1) = 501,
  'exact match ranked first'
);

-- Prefix match 'Matrix Extra' matches prefix first
create temporary table search_prefix as
select * from public.search_catalog_movies('Matrix Extra', 8);

select pg_temp.assert_true(
  (select tmdb_id from search_prefix limit 1) in (510, 511),
  'prefix match ranked higher than substring match'
);

-- 4. Test retired catalog version excluded
select pg_temp.assert_true(
  not exists (select 1 from search_matrix where tmdb_id = 599),
  'movies from retired or non-active catalog versions are never returned'
);

-- 5. Test alias and original title matching
create temporary table search_alias as
select * from public.search_catalog_movies('Matrix Alias', 8);

select pg_temp.assert_true(
  (select count(*) = 1 and tmdb_id = 507 from search_alias group by tmdb_id),
  'search matches against approved_aliases'
);

create temporary table search_orig as
select * from public.search_catalog_movies('In Disguise', 8);

select pg_temp.assert_true(
  (select count(*) = 1 and tmdb_id = 506 from search_orig group by tmdb_id),
  'search matches against original_title'
);

-- 6. Test remakes show distinct release years for identical titles
create temporary table search_solaris as
select * from public.search_catalog_movies('Solaris', 8);

select pg_temp.assert_true(
  (select count(*) = 2 and count(distinct release_year) = 2 from search_solaris),
  'remakes with same title return distinct release years'
);

-- 7. Test query shorter than 2 chars returns empty table
create temporary table search_short as
select * from public.search_catalog_movies('M', 8);

select pg_temp.assert_true(
  (select count(*) = 0 from search_short),
  'search with query shorter than 2 chars returns no rows'
);

-- 8. Test role denial: anon and authenticated cannot execute search_catalog_movies
reset role;
set role anon;
select pg_temp.assert_raises($s$select * from public.search_catalog_movies('Matrix', 8)$s$, '42501');

reset role;
set role authenticated;
select pg_temp.assert_raises($s$select * from public.search_catalog_movies('Matrix', 8)$s$, '42501');

reset role;
rollback;
