begin;

alter table public.catalog_versions add column source text not null default 'legacy'
  check (source in ('legacy', 'tmdb', 'fixture'));
alter table public.catalog_versions add column tiering_version text;

-- Stage all rows in one transaction. Any bad row rolls back version and rows together.
create function public.stage_catalog(p_rows jsonb, p_summary jsonb)
returns uuid language plpgsql security invoker set search_path = pg_catalog
as $$
declare version_id uuid;
begin
  if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) not between 1 and 1000
     or jsonb_typeof(p_summary) is distinct from 'object'
     or p_summary->>'source' is distinct from 'tmdb'
     or p_summary->>'rulesVersion' is distinct from 'base-v1'
     or p_summary->>'tiers' is distinct from 'pending_rc007'
     or p_summary->>'asOf' is null then
    raise exception 'Invalid catalog staging input';
  end if;
  insert into public.catalog_versions(rules_version, source, summary)
    values ('base-v1', 'tmdb', p_summary) returning id into version_id;
  insert into public.movies(catalog_version_id, tmdb_id, title, original_title, release_date,
    release_year, vote_count, vote_average, popularity, revenue, runtime, original_language,
    genres, sanitized_synopsis, directors, cast_members, approved_aliases, poster_path, source_revision, eligible_modes)
  select version_id, m.tmdb_id, m.title, m.original_title, m.release_date, m.release_year,
    m.vote_count, m.vote_average, m.popularity, m.revenue, m.runtime, m.original_language,
    m.genres, m.sanitized_synopsis, m.directors, m.cast_members, m.approved_aliases,
    m.poster_path, m.source_revision, m.eligible_modes
  from jsonb_to_recordset(p_rows) as m(tmdb_id bigint, title text, original_title text,
    release_date date, release_year integer, vote_count integer, vote_average numeric,
    popularity numeric, revenue bigint, runtime integer, original_language text, genres text[],
    sanitized_synopsis text, directors jsonb, cast_members jsonb, approved_aliases text[],
    poster_path text, source_revision text, eligible_modes text[]);
  if exists(select 1 from public.movies where catalog_version_id = version_id and (
    runtime < 60 or vote_count < 500 or release_date > (p_summary->>'asOf')::date - 90
    or release_year <> extract(year from release_date) or cardinality(eligible_modes) = 0
    or cardinality(approved_aliases) <> 0)) then
    raise exception 'Catalog base eligibility failed';
  end if;
  return version_id;
end;
$$;

-- RC-007 must populate validated tiers and tiering_version before any activation.
create function public.activate_catalog(p_version uuid)
returns void language plpgsql security invoker set search_path = pg_catalog
as $$
declare v public.catalog_versions%rowtype; level_name text; mode_name text;
begin
  -- Serialize competing activations and movie edits during final coverage check/swap.
  lock table public.catalog_versions, public.movies in share row exclusive mode;
  select * into v from public.catalog_versions where id = p_version;
  if not found or v.status <> 'staging' or v.source <> 'tmdb' or nullif(btrim(v.tiering_version), '') is null then
    raise exception 'Catalog activation requires real source and reviewed tiering';
  end if;
  if exists(select 1 from public.movies m where m.catalog_version_id = p_version and
    (m.tier is null or m.familiarity_score is null or m.vote_count < 500 or m.runtime < 60
     or (m.tier = 'easy' and m.vote_count < 5000)
     or (m.tier = 'medium' and m.vote_count < 1500)
     or (m.tier = 'hard' and (m.vote_count > 9999 or m.vote_average < 7)))) then
    raise exception 'Catalog tier gates failed';
  end if;
  foreach level_name in array array['easy','medium','hard'] loop
    if (select count(*) from public.movies where catalog_version_id = p_version and tier = level_name) < 100 then
      raise exception 'Catalog tier coverage shortage';
    end if;
    foreach mode_name in array array['poster','title','synopsis','cast','genre'] loop
      if (select count(*) from public.movies where catalog_version_id = p_version and tier = level_name and mode_name = any(eligible_modes)) < 30 then
        raise exception 'Catalog mode coverage shortage';
      end if;
    end loop;
  end loop;
  update public.catalog_versions set status = 'retired' where status = 'active';
  update public.catalog_versions set status = 'active' where id = p_version;
end;
$$;

revoke all on function public.stage_catalog(jsonb, jsonb), public.activate_catalog(uuid) from public, anon, authenticated;
grant execute on function public.stage_catalog(jsonb, jsonb), public.activate_catalog(uuid) to service_role;

commit;
