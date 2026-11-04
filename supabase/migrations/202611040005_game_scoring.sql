begin;

-- Atomically evaluate a game guess under row locks; handle attempts, duplicates, ambiguity, and scoring.
create or replace function public.apply_game_guess(
  p_player_token_hash text,
  p_session_id uuid,
  p_action_id uuid,
  p_request_hash text,
  p_round_id uuid,
  p_expected_revision integer,
  p_normalized_guess text default null,
  p_selected_movie_id bigint default null,
  p_is_ambiguous boolean default false,
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
  v_existing_guess record;
  v_is_duplicate boolean := false;
  v_is_correct boolean := false;
  v_points integer := 0;
  v_base_score integer := 100;
  v_guess_ordinal integer;
begin
  select id into v_player_id from public.anonymous_players
    where token_hash = p_player_token_hash and expires_at > now();
  if not found then
    raise exception 'Unauthorized player' using errcode = '40100';
  end if;

  -- 1. Idempotency check on action
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

  if v_round.state <> 'guessing' then
    raise exception 'Cannot submit guess on non-active round' using errcode = '40905';
  end if;

  -- 4. Ambiguous check: consumes no attempt and does not increment revision
  if p_is_ambiguous then
    select coalesce(max(ordinal), 0) + 1 into v_guess_ordinal from public.game_guesses where round_id = v_round.id;
    insert into public.game_guesses(
      round_id, catalog_version_id, normalized_guess, selected_movie_id, outcome, ordinal
    ) values (
      v_round.id, v_round.catalog_version_id, p_normalized_guess, p_selected_movie_id, 'ambiguous', v_guess_ordinal
    );

    insert into public.game_actions(
      session_id, idempotency_key, request_hash, action_type, round_id, response_snapshot
    ) values (
      p_session_id, p_action_id, p_request_hash, 'guess', p_round_id, '{}'::jsonb
    ) on conflict (session_id, idempotency_key) do nothing;

    return jsonb_build_object(
      'cached', false,
      'outcome', 'ambiguous',
      'is_duplicate', false,
      'points', 0,
      'wrong_attempts', v_round.wrong_attempts,
      'round_state', v_round.state,
      'round_score', v_round.score,
      'session_score', v_session.score,
      'revision', v_session.revision
    );
  end if;

  -- 5. Determine if guess is correct
  if p_selected_movie_id is not null and p_selected_movie_id = v_round.movie_id then
    v_is_correct := true;
  end if;

  if v_is_correct then
    if v_session.level = 'easy' then v_base_score := 100;
    elsif v_session.level = 'medium' then v_base_score := 150;
    else v_base_score := 200;
    end if;

    v_points := greatest(0, v_base_score - (25 * v_round.wrong_attempts) - (20 * v_round.hint_stage));

    update public.game_rounds set
      state = 'correct',
      score = v_points,
      reveal_snapshot = coalesce(p_reveal_snapshot, '{}'::jsonb)
    where id = v_round.id returning * into v_round;

    update public.game_sessions set
      score = score + v_points,
      revision = revision + 1
    where id = v_session.id returning * into v_session;

    select coalesce(max(ordinal), 0) + 1 into v_guess_ordinal from public.game_guesses where round_id = v_round.id;
    insert into public.game_guesses(
      round_id, catalog_version_id, normalized_guess, selected_movie_id, outcome, ordinal
    ) values (
      v_round.id, v_round.catalog_version_id, p_normalized_guess, p_selected_movie_id, 'correct', v_guess_ordinal
    );

    insert into public.game_actions(
      session_id, idempotency_key, request_hash, action_type, round_id, response_snapshot
    ) values (
      p_session_id, p_action_id, p_request_hash, 'guess', p_round_id, '{}'::jsonb
    );

    return jsonb_build_object(
      'cached', false,
      'outcome', 'correct',
      'is_duplicate', false,
      'points', v_points,
      'wrong_attempts', v_round.wrong_attempts,
      'round_state', v_round.state,
      'round_score', v_round.score,
      'session_score', v_session.score,
      'revision', v_session.revision
    );

  else
    -- Wrong guess: check for exact duplicate wrong guess
    if p_normalized_guess is not null then
      select * into v_existing_guess from public.game_guesses
        where round_id = v_round.id and outcome = 'wrong' and normalized_guess = p_normalized_guess;
      if found then
        v_is_duplicate := true;
      end if;
    elsif p_selected_movie_id is not null then
      select * into v_existing_guess from public.game_guesses
        where round_id = v_round.id and outcome = 'wrong' and selected_movie_id = p_selected_movie_id;
      if found then
        v_is_duplicate := true;
      end if;
    end if;

    if v_is_duplicate then
      insert into public.game_actions(
        session_id, idempotency_key, request_hash, action_type, round_id, response_snapshot
      ) values (
        p_session_id, p_action_id, p_request_hash, 'guess', p_round_id, '{}'::jsonb
      ) on conflict (session_id, idempotency_key) do nothing;

      return jsonb_build_object(
        'cached', false,
        'outcome', 'wrong',
        'is_duplicate', true,
        'points', 0,
        'wrong_attempts', v_round.wrong_attempts,
        'round_state', v_round.state,
        'round_score', v_round.score,
        'session_score', v_session.score,
        'revision', v_session.revision
      );
    end if;

    -- Non-duplicate wrong guess consumes 1 attempt
    v_round.wrong_attempts := v_round.wrong_attempts + 1;

    select coalesce(max(ordinal), 0) + 1 into v_guess_ordinal from public.game_guesses where round_id = v_round.id;
    insert into public.game_guesses(
      round_id, catalog_version_id, normalized_guess, selected_movie_id, outcome, ordinal
    ) values (
      v_round.id, v_round.catalog_version_id, p_normalized_guess, p_selected_movie_id, 'wrong', v_guess_ordinal
    );

    if v_round.wrong_attempts >= 3 then
      update public.game_rounds set
        wrong_attempts = v_round.wrong_attempts,
        state = 'exhausted',
        score = 0,
        reveal_snapshot = coalesce(p_reveal_snapshot, '{}'::jsonb)
      where id = v_round.id returning * into v_round;
    else
      update public.game_rounds set
        wrong_attempts = v_round.wrong_attempts
      where id = v_round.id returning * into v_round;
    end if;

    update public.game_sessions set
      revision = revision + 1
    where id = v_session.id returning * into v_session;

    insert into public.game_actions(
      session_id, idempotency_key, request_hash, action_type, round_id, response_snapshot
    ) values (
      p_session_id, p_action_id, p_request_hash, 'guess', p_round_id, '{}'::jsonb
    );

    return jsonb_build_object(
      'cached', false,
      'outcome', 'wrong',
      'is_duplicate', false,
      'points', 0,
      'wrong_attempts', v_round.wrong_attempts,
      'round_state', v_round.state,
      'round_score', v_round.score,
      'session_score', v_session.score,
      'revision', v_session.revision
    );
  end if;
end;
$$;

revoke all on function public.apply_game_guess(text, uuid, uuid, text, uuid, integer, text, bigint, boolean, jsonb) from public, anon, authenticated;
grant execute on function public.apply_game_guess(text, uuid, uuid, text, uuid, integer, text, bigint, boolean, jsonb) to service_role;

commit;
