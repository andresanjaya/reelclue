begin;

-- Create session and 10 rounds atomically; idempotent retry on (player_id, creation_action_id).
create or replace function public.create_game_session(
  p_player_token_hash text,
  p_action_id uuid,
  p_request_hash text,
  p_mode text,
  p_level text,
  p_rounds jsonb
)
returns jsonb
language plpgsql security invoker set search_path = pg_catalog
as $$
declare
  v_player_id uuid;
  v_session_id uuid;
  v_catalog_id uuid;
  v_rules_version text;
  v_existing record;
  v_round record;
begin
  select id into v_player_id from public.anonymous_players
    where token_hash = p_player_token_hash and expires_at > now();
  if not found then
    raise exception 'Unauthorized player' using errcode = '40100';
  end if;

  -- Idempotency check on session creation
  select * into v_existing from public.game_sessions
    where player_id = v_player_id and creation_action_id = p_action_id;
  if found then
    if v_existing.creation_request_hash <> p_request_hash then
      raise exception 'Creation action ID reused with different payload' using errcode = '40901';
    end if;
    return jsonb_build_object(
      'id', v_existing.id,
      'is_existing', true
    );
  end if;

  select id, rules_version into v_catalog_id, v_rules_version
    from public.catalog_versions where status = 'active' order by imported_at desc limit 1;
  if not found then
    raise exception 'No active catalog version' using errcode = '50301';
  end if;

  if jsonb_typeof(p_rounds) is distinct from 'array' or jsonb_array_length(p_rounds) <> 10 then
    raise exception 'Game session requires exactly 10 rounds' using errcode = '40001';
  end if;

  insert into public.game_sessions(
    player_id, creation_action_id, creation_request_hash,
    catalog_version_id, rules_version, mode, level, state, current_round, score, revision
  ) values (
    v_player_id, p_action_id, p_request_hash,
    v_catalog_id, v_rules_version, p_mode, p_level, 'active', 1, 0, 0
  ) returning id into v_session_id;

  for v_round in select * from jsonb_to_recordset(p_rounds) as r(
    movie_id bigint, ordinal integer, mode text, reveal_seed uuid
  ) loop
    insert into public.game_rounds(
      session_id, catalog_version_id, movie_id, ordinal, mode,
      hint_stage, wrong_attempts, state, score, reveal_seed
    ) values (
      v_session_id, v_catalog_id, v_round.movie_id, v_round.ordinal, v_round.mode,
      0, 0, 'guessing', 0, coalesce(v_round.reveal_seed, gen_random_uuid())
    );
  end loop;

  return jsonb_build_object(
    'id', v_session_id,
    'is_existing', false
  );
end;
$$;

-- Apply state mutation atomically under row locks; idempotent retry on (session_id, action_id).
create or replace function public.apply_game_action(
  p_player_token_hash text,
  p_session_id uuid,
  p_action_id uuid,
  p_request_hash text,
  p_action_type text,
  p_round_id uuid,
  p_expected_revision integer,
  p_reveal_snapshot jsonb default null
)
returns jsonb
language plpgsql security invoker set search_path = pg_catalog
as $$
declare
  v_player_id uuid;
  v_session public.game_sessions%rowtype;
  v_round public.game_rounds%rowtype;
  v_existing_action record;
begin
  select id into v_player_id from public.anonymous_players
    where token_hash = p_player_token_hash and expires_at > now();
  if not found then
    raise exception 'Unauthorized player' using errcode = '40100';
  end if;

  -- 1. Idempotency check
  select * into v_existing_action from public.game_actions
    where session_id = p_session_id and idempotency_key = p_action_id;
  if found then
    if v_existing_action.request_hash <> p_request_hash then
      raise exception 'Action ID reused with different payload' using errcode = '40901';
    end if;
    return jsonb_build_object(
      'cached', true,
      'response_snapshot', v_existing_action.response_snapshot
    );
  end if;

  -- 2. Lock session row
  select * into v_session from public.game_sessions where id = p_session_id for update;
  if not found or v_session.player_id <> v_player_id then
    raise exception 'Game session not found' using errcode = '40401';
  end if;

  if v_session.expires_at <= now() or v_session.state = 'expired' then
    raise exception 'Game session expired' using errcode = '41001';
  end if;

  if v_session.revision <> p_expected_revision then
    raise exception 'Revision mismatch: expected %, got %', p_expected_revision, v_session.revision using errcode = '40902';
  end if;

  if v_session.state = 'completed' then
    raise exception 'Game session is already completed' using errcode = '40903';
  end if;

  -- 3. Lock active round row
  select * into v_round from public.game_rounds where id = p_round_id and session_id = p_session_id for update;
  if not found then
    raise exception 'Round not found in session' using errcode = '40402';
  end if;

  if v_round.ordinal <> v_session.current_round then
    raise exception 'Target round is not current round' using errcode = '40904';
  end if;

  -- 4. Apply action
  if p_action_type = 'hint' then
    if v_round.state <> 'guessing' then
      raise exception 'Cannot request hint on non-active round' using errcode = '40905';
    end if;
    if v_round.hint_stage >= 3 then
      raise exception 'No hints remaining' using errcode = '40906';
    end if;
    update public.game_rounds set hint_stage = hint_stage + 1 where id = v_round.id
      returning * into v_round;

  elsif p_action_type = 'skip' then
    if v_round.state <> 'guessing' then
      raise exception 'Cannot skip non-active round' using errcode = '40907';
    end if;
    update public.game_rounds set
      state = 'skipped',
      score = 0,
      reveal_snapshot = coalesce(p_reveal_snapshot, '{}'::jsonb)
    where id = v_round.id returning * into v_round;

  elsif p_action_type = 'next' then
    if v_round.state = 'guessing' then
      raise exception 'Cannot advance before completing current round' using errcode = '40908';
    end if;
    if v_session.current_round < 10 then
      update public.game_sessions set current_round = current_round + 1 where id = v_session.id
        returning * into v_session;
    elsif v_session.current_round = 10 then
      update public.game_sessions set state = 'completed', completed_at = now() where id = v_session.id
        returning * into v_session;
    end if;

  else
    raise exception 'Invalid action type: %', p_action_type using errcode = '40002';
  end if;

  -- 5. Increment session revision
  update public.game_sessions set revision = revision + 1 where id = v_session.id
    returning * into v_session;

  -- 6. Insert action record into game_actions atomically
  insert into public.game_actions(
    session_id, idempotency_key, request_hash, action_type, round_id, response_snapshot
  ) values (
    p_session_id, p_action_id, p_request_hash, p_action_type, p_round_id, '{}'::jsonb
  );

  return jsonb_build_object(
    'cached', false,
    'session_id', v_session.id,
    'round_id', v_round.id,
    'current_round', v_session.current_round,
    'revision', v_session.revision,
    'state', v_session.state,
    'score', v_session.score,
    'hint_stage', v_round.hint_stage,
    'round_state', v_round.state,
    'round_score', v_round.score
  );
end;
$$;

-- Record response snapshot for an action atomically
create or replace function public.record_game_action(
  p_session_id uuid,
  p_action_id uuid,
  p_request_hash text,
  p_action_type text,
  p_round_id uuid,
  p_response_snapshot jsonb
)
returns void
language plpgsql security invoker set search_path = pg_catalog
as $$
begin
  insert into public.game_actions(
    session_id, idempotency_key, request_hash, action_type, round_id, response_snapshot
  ) values (
    p_session_id, p_action_id, p_request_hash, p_action_type, p_round_id, p_response_snapshot
  ) on conflict (session_id, idempotency_key) do update
    set response_snapshot = excluded.response_snapshot;
end;
$$;

revoke all on function public.create_game_session(text, uuid, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.create_game_session(text, uuid, text, text, text, jsonb) to service_role;

revoke all on function public.apply_game_action(text, uuid, uuid, text, text, uuid, integer, jsonb) from public, anon, authenticated;
grant execute on function public.apply_game_action(text, uuid, uuid, text, text, uuid, integer, jsonb) to service_role;

revoke all on function public.record_game_action(uuid, uuid, text, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.record_game_action(uuid, uuid, text, text, uuid, jsonb) to service_role;

commit;
