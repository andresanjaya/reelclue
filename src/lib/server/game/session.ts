import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { createDbClient } from "../db/client.ts";
import {
  serializeGameSession,
  serializeTerminalReveal,
  type AmbiguousChoice,
  type DbRound,
  type DbSession,
  type GuessResponseDto,
  type SafeSessionDto,
} from "./dto.ts";
import {
  CatalogShortageError,
  selectGameRounds,
  type PoolCandidate,
  type SessionLevel,
  type SessionMode,
} from "./selection.ts";
import type { MovieDetails } from "./clues.ts";
import { normalizeTitle, validateGuessInput } from "../../game-rules/normalization.ts";
import { decodeChoiceHandle, encodeChoiceHandle } from "./choiceHandle.ts";

export const PLAYER_COOKIE_NAME = "reelclue_player";

export class GameError extends Error {
  readonly status: number;
  readonly code: string;
  readonly retryable: boolean;

  constructor(status: number, code: string, message: string, retryable = false) {
    super(message);
    this.name = "GameError";
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function hashPayload(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export function generatePlayerToken(): string {
  return randomBytes(32).toString("hex");
}

export async function getOrCreatePlayer(cookieToken?: string) {
  const db = createDbClient();

  if (cookieToken && /^[0-9a-f]{64}$/.test(cookieToken)) {
    const tokenHash = hashToken(cookieToken);
    const { data, error } = await db
      .from("anonymous_players")
      .select("id")
      .eq("token_hash", tokenHash)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (!error && data) {
      return { token: cookieToken, tokenHash, playerId: data.id, isNew: false };
    }
  }

  const token = generatePlayerToken();
  const tokenHash = hashToken(token);
  const { data, error } = await db
    .from("anonymous_players")
    .insert({ token_hash: tokenHash })
    .select("id")
    .single();

  if (error || !data) {
    throw new GameError(500, "PLAYER_CREATION_FAILED", "Failed to create anonymous player");
  }

  return { token, tokenHash, playerId: data.id, isNew: true };
}

export function validateOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return; // Non-browser or same-origin direct request without origin header

  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) return;

  try {
    const originUrl = new URL(origin);
    const originHost = originUrl.host;
    if (originHost !== host) {
      throw new GameError(403, "FORBIDDEN", "Cross-origin requests are forbidden");
    }
  } catch (e) {
    if (e instanceof GameError) throw e;
    throw new GameError(403, "FORBIDDEN", "Invalid origin header");
  }
}

function handleDbRpcError(error: { code?: string; message: string }): never {
  const msg = error.message;
  if (msg.includes("40100") || msg.includes("Unauthorized player")) {
    throw new GameError(401, "UNAUTHORIZED", "Missing or invalid player identity");
  }
  if (msg.includes("40401") || msg.includes("Game session not found") || msg.includes("40402")) {
    throw new GameError(404, "NOT_FOUND", "Game session not found");
  }
  if (msg.includes("40901") || msg.includes("Action ID reused with different payload")) {
    throw new GameError(409, "PAYLOAD_MISMATCH", "Action ID reused with different payload");
  }
  if (msg.includes("40902") || msg.includes("Revision mismatch")) {
    throw new GameError(409, "STALE_REVISION", "Revision mismatch; retry with current revision");
  }
  if (msg.includes("40903") || msg.includes("Game session is already completed")) {
    throw new GameError(409, "SESSION_COMPLETED", "Game session is already completed");
  }
  if (msg.includes("40904") || msg.includes("Target round is not current round")) {
    throw new GameError(409, "INVALID_ROUND", "Target round is not current round");
  }
  if (msg.includes("40905") || msg.includes("Cannot request hint on non-active round")) {
    throw new GameError(409, "ROUND_NOT_ACTIVE", "Cannot request hint on non-active round");
  }
  if (msg.includes("40906") || msg.includes("No hints remaining")) {
    throw new GameError(409, "NO_HINTS_REMAINING", "No hints remaining for this round");
  }
  if (msg.includes("40907") || msg.includes("Cannot skip non-active round")) {
    throw new GameError(409, "ROUND_NOT_ACTIVE", "Cannot skip non-active round");
  }
  if (msg.includes("40908") || msg.includes("Cannot advance before completing current round")) {
    throw new GameError(409, "ROUND_NOT_FINISHED", "Cannot advance before completing current round");
  }
  if (msg.includes("41001") || msg.includes("Game session expired")) {
    throw new GameError(410, "SESSION_EXPIRED", "Game session expired");
  }
  if (msg.includes("50301") || msg.includes("No active catalog version")) {
    throw new GameError(503, "CATALOG_UNAVAILABLE", "No active catalog version available", true);
  }
  throw new GameError(500, "INTERNAL_ERROR", error.message);
}

export async function createGameSession(opts: {
  playerToken: string;
  actionId: string;
  mode: SessionMode;
  level: SessionLevel;
  recentMovieIds?: number[];
}): Promise<SafeSessionDto> {
  const db = createDbClient();
  const playerTokenHash = hashToken(opts.playerToken);
  const requestHash = hashPayload({ mode: opts.mode, level: opts.level });

  // 1. Get active catalog
  const { data: catalog, error: catError } = await db
    .from("catalog_versions")
    .select("id")
    .eq("status", "active")
    .order("imported_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (catError || !catalog) {
    throw new GameError(503, "CATALOG_UNAVAILABLE", "Active catalog unavailable", true);
  }

  // 2. Query candidates for pool
  const { data: candidates, error: candError } = await db
    .from("movies")
    .select("tmdb_id, tier, eligible_modes")
    .eq("catalog_version_id", catalog.id)
    .eq("tier", opts.level);

  if (candError || !candidates) {
    throw new GameError(500, "CATALOG_QUERY_FAILED", "Failed to query catalog");
  }

  const pool: PoolCandidate[] = candidates.map(c => ({
    tmdb_id: c.tmdb_id,
    tier: c.tier,
    eligible_modes: c.eligible_modes,
  }));

  // 3. Select 10 rounds
  let selectedRounds;
  try {
    selectedRounds = selectGameRounds(pool, opts.mode, opts.recentMovieIds ?? []);
  } catch (err) {
    if (err instanceof CatalogShortageError) {
      throw new GameError(400, "CATALOG_SHORTAGE", err.message);
    }
    throw err;
  }

  // 4. Call RPC create_game_session
  const { data: sessionResult, error: rpcError } = await db.rpc("create_game_session", {
    p_player_token_hash: playerTokenHash,
    p_action_id: opts.actionId,
    p_request_hash: requestHash,
    p_mode: opts.mode,
    p_level: opts.level,
    p_rounds: selectedRounds,
  });

  if (rpcError) {
    handleDbRpcError(rpcError);
  }

  const sessionId = (sessionResult as { id: string }).id;
  return fetchSafeSession(sessionId, playerTokenHash);
}

export async function fetchSafeSession(
  sessionId: string,
  playerTokenHash: string
): Promise<SafeSessionDto> {
  const db = createDbClient();

  // 1. Fetch player ID
  const { data: player, error: pError } = await db
    .from("anonymous_players")
    .select("id")
    .eq("token_hash", playerTokenHash)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (pError || !player) {
    throw new GameError(401, "UNAUTHORIZED", "Missing or invalid player identity");
  }

  // 2. Fetch session
  const { data: session, error: sError } = await db
    .from("game_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();

  if (sError || !session) {
    throw new GameError(404, "NOT_FOUND", "Game session not found");
  }

  // PRD: Wrong owner cannot access game; return generic 404
  if (session.player_id !== player.id) {
    throw new GameError(404, "NOT_FOUND", "Game session not found");
  }

  if (new Date(session.expires_at).getTime() <= Date.now() || session.state === "expired") {
    if (session.state === "active") {
      await db.from("game_sessions").update({ state: "expired", revision: session.revision + 1 }).eq("id", sessionId);
    }
    throw new GameError(410, "SESSION_EXPIRED", "Game session expired");
  }

  // 3. Fetch active round and completed rounds
  const { data: rounds, error: rError } = await db
    .from("game_rounds")
    .select("*")
    .eq("session_id", sessionId)
    .order("ordinal", { ascending: true });

  if (rError || !rounds || rounds.length !== 10) {
    throw new GameError(500, "ROUNDS_QUERY_FAILED", "Failed to retrieve game rounds");
  }

  const activeRound = rounds.find(r => r.ordinal === session.current_round) ?? rounds[9];
  const completedRounds = rounds.filter(
    r => r.ordinal < session.current_round || session.state === "completed"
  );

  // 4. Fetch movies for active round + completed rounds ONLY
  const neededMovieIds = [
    activeRound.movie_id,
    ...completedRounds.map(r => r.movie_id),
  ];

  const { data: movies, error: mError } = await db
    .from("movies")
    .select("tmdb_id, title, original_title, release_year, original_language, genres, sanitized_synopsis, directors, cast_members, poster_path")
    .eq("catalog_version_id", session.catalog_version_id)
    .in("tmdb_id", neededMovieIds);

  if (mError || !movies) {
    throw new GameError(500, "MOVIES_QUERY_FAILED", "Failed to retrieve movie details");
  }

  const movieMap = new Map<number, MovieDetails>(movies.map(m => [m.tmdb_id, m as MovieDetails]));
  const activeMovie = movieMap.get(activeRound.movie_id);
  if (!activeMovie) {
    throw new GameError(500, "MOVIE_NOT_FOUND", "Active movie metadata not found");
  }

  const completedPairs = completedRounds.map(r => {
    const movie = movieMap.get(r.movie_id);
    if (!movie) throw new GameError(500, "MOVIE_NOT_FOUND", "Completed movie metadata not found");
    return { round: r as DbRound, movie };
  });

  return serializeGameSession(session as DbSession, activeRound as DbRound, activeMovie, completedPairs);
}

export async function mutateGameAction(opts: {
  playerToken: string;
  sessionId: string;
  actionId: string;
  actionType: "hint" | "skip" | "next";
  roundId: string;
  revision: number;
}): Promise<SafeSessionDto> {
  const db = createDbClient();
  const playerTokenHash = hashToken(opts.playerToken);
  const requestHash = hashPayload({
    roundId: opts.roundId,
    actionId: opts.actionId,
    revision: opts.revision,
    actionType: opts.actionType,
  });

  // If skipping, prefetch movie details for reveal_snapshot
  let revealSnapshot: Record<string, unknown> | null = null;
  if (opts.actionType === "skip") {
    const { data: roundData } = await db
      .from("game_rounds")
      .select("*, movies(*)")
      .eq("id", opts.roundId)
      .eq("session_id", opts.sessionId)
      .maybeSingle();

    if (roundData && roundData.movies) {
      revealSnapshot = serializeTerminalReveal(
        { ...(roundData as DbRound), state: "skipped", score: 0 },
        roundData.movies as MovieDetails
      );
    }
  }

  const { data: rpcResult, error: rpcError } = await db.rpc("apply_game_action", {
    p_player_token_hash: playerTokenHash,
    p_session_id: opts.sessionId,
    p_action_id: opts.actionId,
    p_request_hash: requestHash,
    p_action_type: opts.actionType,
    p_round_id: opts.roundId,
    p_expected_revision: opts.revision,
    p_reveal_snapshot: revealSnapshot,
  });

  if (rpcError) {
    handleDbRpcError(rpcError);
  }

  const result = rpcResult as { cached: boolean; response_snapshot?: SafeSessionDto };
  if (result.cached && result.response_snapshot && Object.keys(result.response_snapshot).length > 0) {
    return result.response_snapshot;
  }

  const updatedSession = await fetchSafeSession(opts.sessionId, playerTokenHash);

  // Persist response snapshot for idempotency
  await db.rpc("record_game_action", {
    p_session_id: opts.sessionId,
    p_action_id: opts.actionId,
    p_request_hash: requestHash,
    p_action_type: opts.actionType,
    p_round_id: opts.roundId,
    p_response_snapshot: updatedSession,
  });

  return updatedSession;
}

export async function submitGameGuess(opts: {
  playerToken: string;
  sessionId: string;
  actionId: string;
  roundId: string;
  revision: number;
  answerText?: string;
  choiceHandle?: string;
}): Promise<GuessResponseDto> {
  const db = createDbClient();
  const playerTokenHash = hashToken(opts.playerToken);

  // 1. Input validation
  const hasText = typeof opts.answerText === "string";
  const hasChoice = typeof opts.choiceHandle === "string";

  if (hasText === hasChoice) {
    throw new GameError(400, "INVALID_INPUT", "Must provide exactly one of answerText or choiceHandle");
  }

  let normalizedGuess: string | null = null;
  let selectedMovieId: number | null = null;
  let isAmbiguous = false;
  let choices: AmbiguousChoice[] | undefined;

  if (hasText) {
    const check = validateGuessInput(opts.answerText);
    if (!check.valid || !check.normalized) {
      throw new GameError(400, "INVALID_INPUT", check.error ?? "Invalid guess input");
    }
    normalizedGuess = check.normalized;

    // Fetch catalog_version_id for session
    const { data: sessionData } = await db
      .from("game_sessions")
      .select("catalog_version_id")
      .eq("id", opts.sessionId)
      .maybeSingle();

    if (!sessionData) {
      throw new GameError(404, "NOT_FOUND", "Game session not found");
    }

    // Query movies in this catalog to find matches on canonical, original, or aliases
    const { data: candidates } = await db
      .from("movies")
      .select("tmdb_id, title, original_title, release_year, approved_aliases")
      .eq("catalog_version_id", sessionData.catalog_version_id);

    const matches = (candidates ?? []).filter(m => {
      if (normalizeTitle(m.title) === normalizedGuess) return true;
      if (normalizeTitle(m.original_title) === normalizedGuess) return true;
      const aliases = (m.approved_aliases as string[] | null) ?? [];
      return aliases.some((a: string) => normalizeTitle(a) === normalizedGuess);
    });

    if (matches.length > 1) {
      isAmbiguous = true;
      choices = matches.map(m => ({
        choiceHandle: encodeChoiceHandle(m.tmdb_id),
        title: m.title,
        releaseYear: m.release_year,
      }));
    } else if (matches.length === 1) {
      selectedMovieId = matches[0].tmdb_id;
    } else {
      selectedMovieId = null;
    }
  } else if (hasChoice) {
    const decodedId = decodeChoiceHandle(opts.choiceHandle!);
    if (!decodedId) {
      throw new GameError(400, "INVALID_CHOICE_HANDLE", "Invalid or expired choice handle");
    }
    selectedMovieId = decodedId;
  }

  const requestHash = hashPayload({
    roundId: opts.roundId,
    actionId: opts.actionId,
    revision: opts.revision,
    answerText: normalizedGuess ?? null,
    choiceHandle: selectedMovieId ?? null,
  });

  // Prefetch movie details for terminal reveal snapshot
  let revealSnapshot: Record<string, unknown> | null = null;
  const { data: roundData } = await db
    .from("game_rounds")
    .select("*, movies(*)")
    .eq("id", opts.roundId)
    .eq("session_id", opts.sessionId)
    .maybeSingle();

  if (roundData && roundData.movies) {
    revealSnapshot = serializeTerminalReveal(
      roundData as DbRound,
      roundData.movies as MovieDetails
    );
  }

  const { data: rpcResult, error: rpcError } = await db.rpc("apply_game_guess", {
    p_player_token_hash: playerTokenHash,
    p_session_id: opts.sessionId,
    p_action_id: opts.actionId,
    p_request_hash: requestHash,
    p_round_id: opts.roundId,
    p_expected_revision: opts.revision,
    p_normalized_guess: normalizedGuess,
    p_selected_movie_id: selectedMovieId,
    p_is_ambiguous: isAmbiguous,
    p_reveal_snapshot: revealSnapshot,
  });

  if (rpcError) {
    handleDbRpcError(rpcError);
  }

  const result = rpcResult as {
    cached: boolean;
    response_snapshot?: GuessResponseDto;
    outcome: "correct" | "wrong" | "ambiguous";
    is_duplicate: boolean;
    points: number;
    wrong_attempts: number;
  };

  if (result.cached && result.response_snapshot && Object.keys(result.response_snapshot).length > 0) {
    return result.response_snapshot;
  }

  const updatedSession = await fetchSafeSession(opts.sessionId, playerTokenHash);

  const responseDto: GuessResponseDto = {
    outcome: result.outcome,
    is_duplicate: result.is_duplicate,
    points: result.points,
    wrong_attempts: result.wrong_attempts,
    ...(isAmbiguous
      ? {
          message: "More than one movie has this title. Choose the year.",
          choices,
        }
      : {}),
    session: updatedSession,
  };

  await db.rpc("record_game_action", {
    p_session_id: opts.sessionId,
    p_action_id: opts.actionId,
    p_request_hash: requestHash,
    p_action_type: "guess",
    p_round_id: opts.roundId,
    p_response_snapshot: responseDto,
  });

  return responseDto;
}
