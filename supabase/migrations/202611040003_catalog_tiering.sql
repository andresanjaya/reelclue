begin;

-- RC-007 stages validated tiers and familiarity scores atomically with catalog versions.
create or replace function public.stage_catalog(p_rows jsonb, p_summary jsonb)
returns uuid language plpgsql security invoker set search_path = pg_catalog
as $$
declare version_id uuid;
begin
  if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) not between 1 and 1000
     or jsonb_typeof(p_summary) is distinct from 'object'
     or p_summary->>'source' is distinct from 'tmdb'
     or p_summary->>'rulesVersion' is distinct from 'base-v1'
     or p_summary->>'tieringVersion' is distinct from 'tiering-v1'
     or p_summary->>'asOf' is null then
    raise exception 'Invalid catalog staging input';
  end if;
  insert into public.catalog_versions(rules_version, source, summary, tiering_version)
    values ('base-v1', 'tmdb', p_summary, p_summary->>'tieringVersion') returning id into version_id;
  insert into public.movies(catalog_version_id, tmdb_id, title, original_title, release_date,
    release_year, vote_count, vote_average, popularity, revenue, runtime, original_language,
    genres, sanitized_synopsis, directors, cast_members, approved_aliases, poster_path, source_revision,
    eligible_modes, tier, familiarity_score)
  select version_id, m.tmdb_id, m.title, m.original_title, m.release_date, m.release_year,
    m.vote_count, m.vote_average, m.popularity, m.revenue, m.runtime, m.original_language,
    m.genres, m.sanitized_synopsis, m.directors, m.cast_members, m.approved_aliases,
    m.poster_path, m.source_revision, m.eligible_modes, m.tier, m.familiarity_score
  from jsonb_to_recordset(p_rows) as m(tmdb_id bigint, title text, original_title text,
    release_date date, release_year integer, vote_count integer, vote_average numeric,
    popularity numeric, revenue bigint, runtime integer, original_language text, genres text[],
    sanitized_synopsis text, directors jsonb, cast_members jsonb, approved_aliases text[],
    poster_path text, source_revision text, eligible_modes text[], tier text, familiarity_score double precision);
  if exists(select 1 from public.movies where catalog_version_id = version_id and (
    runtime < 60 or vote_count < 500 or release_date > (p_summary->>'asOf')::date - 90
    or release_year <> extract(year from release_date) or cardinality(eligible_modes) = 0
    or cardinality(approved_aliases) <> 0 or tier is null or familiarity_score is null
    or (tier = 'easy' and vote_count < 5000)
    or (tier = 'medium' and vote_count < 1500)
    or (tier = 'hard' and (vote_count > 9999 or vote_average < 7)))) then
    raise exception 'Catalog base eligibility or tier gates failed';
  end if;
  return version_id;
end;
$$;

revoke all on function public.stage_catalog(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.stage_catalog(jsonb, jsonb) to service_role;

commit;
