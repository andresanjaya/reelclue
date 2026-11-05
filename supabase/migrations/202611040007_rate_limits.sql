-- 202611040007_rate_limits.sql
-- Atomic distributed rate limit consumption for rate_limit_buckets.

begin;

create or replace function public.consume_rate_limit(
  p_bucket_hash text,
  p_route_class text,
  p_window_start timestamptz,
  p_expires_at timestamptz,
  p_limit integer
) returns jsonb language plpgsql security definer as $$
declare
  v_count integer;
  v_allowed boolean;
begin
  insert into public.rate_limit_buckets (bucket_hash, route_class, window_start, count, expires_at)
  values (p_bucket_hash, p_route_class, p_window_start, 1, p_expires_at)
  on conflict (bucket_hash, route_class, window_start)
  do update set count = rate_limit_buckets.count + 1
  returning count into v_count;

  v_allowed := (v_count <= p_limit);
  return jsonb_build_object(
    'allowed', v_allowed,
    'count', v_count,
    'limit', p_limit,
    'reset_at', p_expires_at
  );
end;
$$;

revoke all on function public.consume_rate_limit(text, text, timestamptz, timestamptz, integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, text, timestamptz, timestamptz, integer) to service_role;

commit;
