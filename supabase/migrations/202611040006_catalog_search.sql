begin;

-- Search movies across all tiers in the active catalog version.
-- Matches against title, original_title, and approved_aliases.
-- Returns at most 8 items: tmdb_id, title, release_year.
-- Exposes no answer flags, popularity ranks, tier, or session membership.
create or replace function public.search_catalog_movies(
  p_query text,
  p_limit integer default 8
)
returns table (
  tmdb_id bigint,
  title text,
  release_year integer
)
language plpgsql stable security definer set search_path = pg_catalog
as $$
declare
  v_catalog_id uuid;
  v_trimmed text;
  v_pattern text;
begin
  v_trimmed := btrim(p_query);
  if length(v_trimmed) < 2 then
    return;
  end if;

  select id into v_catalog_id from public.catalog_versions
    where status = 'active'
    order by imported_at desc
    limit 1;

  if v_catalog_id is null then
    return;
  end if;

  v_pattern := '%' || v_trimmed || '%';

  return query
  select m.tmdb_id, m.title, m.release_year
  from public.movies m
  where m.catalog_version_id = v_catalog_id
    and (
      m.title ilike v_pattern
      or m.original_title ilike v_pattern
      or exists (
        select 1 from unnest(m.approved_aliases) alias
        where alias ilike v_pattern
      )
    )
  order by
    case
      when lower(m.title) = lower(v_trimmed) then 0
      when lower(m.title) like lower(v_trimmed) || '%' then 1
      when lower(m.original_title) = lower(v_trimmed) then 2
      when lower(m.original_title) like lower(v_trimmed) || '%' then 3
      else 4
    end,
    m.popularity desc,
    m.tmdb_id asc
  limit least(greatest(coalesce(p_limit, 8), 1), 8);
end;
$$;

revoke all on function public.search_catalog_movies(text, integer) from public, anon, authenticated;
grant execute on function public.search_catalog_movies(text, integer) to service_role;

commit;
