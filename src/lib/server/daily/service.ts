import "server-only";
import { createDbClient } from "../db/client.ts";
import {
  GameError,
  createGameSession,
  getOrCreatePlayer,
  hashToken,
} from "../game/session.ts";
import type { SelectedRound, PoolCandidate } from "../game/selection.ts";
import {
  generateDailyRounds,
  getNextUtcMidnight,
  getSecondsUntilUtcMidnight,
  getUtcDateString,
} from "./puzzle.ts";

export interface DailyPuzzle {
  challengeDate: string;
  catalogVersionId: string;
  rounds: SelectedRound[];
}

export interface DailyStatusDto {
  challengeDate: string;
  resetAt: string;
  secondsUntilReset: number;
  hasOfficialAttempt: boolean;
  officialSession: {
    id: string;
    state: "active" | "completed" | "expired";
    score: number;
    currentRound: number;
  } | null;
  canStartOfficial: boolean;
  canResume: boolean;
  practiceAttemptsCount: number;
}

/**
 * In-memory fallback cache for test/offline environments
 */
const dailyPuzzleCache = new Map<string, DailyPuzzle>();

export function _resetDailyPuzzleCacheForTesting(): void {
  dailyPuzzleCache.clear();
}

/**
 * Retrieves or initializes the frozen daily 10-round puzzle for a given UTC date.
 */
export async function getOrCreateDailyPuzzle(
  dateStr: string = getUtcDateString()
): Promise<DailyPuzzle> {
  const cached = dailyPuzzleCache.get(dateStr);
  if (cached) return cached;

  const db = createDbClient();

  // 1. Check if daily challenge is already frozen in database
  const { data: existing, error: queryErr } = await db
    .from("daily_challenges")
    .select("challenge_date, catalog_version_id, rounds")
    .eq("challenge_date", dateStr)
    .maybeSingle();

  if (!queryErr && existing) {
    const puzzle: DailyPuzzle = {
      challengeDate: existing.challenge_date,
      catalogVersionId: existing.catalog_version_id,
      rounds: existing.rounds as SelectedRound[],
    };
    dailyPuzzleCache.set(dateStr, puzzle);
    return puzzle;
  }

  // 2. Fetch active catalog version
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

  // 3. Query medium tier candidates from catalog
  const { data: candidates, error: candError } = await db
    .from("movies")
    .select("tmdb_id, tier, eligible_modes")
    .eq("catalog_version_id", catalog.id)
    .eq("tier", "medium");

  if (candError || !candidates) {
    throw new GameError(500, "CATALOG_QUERY_FAILED", "Failed to query catalog for daily challenge");
  }

  const pool: PoolCandidate[] = candidates.map((c: { tmdb_id: number; tier: string; eligible_modes: string[] }) => ({
    tmdb_id: c.tmdb_id,
    tier: c.tier,
    eligible_modes: c.eligible_modes,
  }));

  // 4. Generate deterministic daily rounds
  const rounds = generateDailyRounds(pool, dateStr, catalog.id);

  // 5. Persist daily challenge assignment
  const { data: inserted, error: insertError } = await db
    .from("daily_challenges")
    .insert({
      challenge_date: dateStr,
      catalog_version_id: catalog.id,
      rounds,
    })
    .select("challenge_date, catalog_version_id, rounds")
    .maybeSingle();

  if (insertError) {
    // If concurrent race condition occurred, re-fetch winning assignment
    const { data: winner } = await db
      .from("daily_challenges")
      .select("challenge_date, catalog_version_id, rounds")
      .eq("challenge_date", dateStr)
      .maybeSingle();

    if (winner) {
      const puzzle: DailyPuzzle = {
        challengeDate: winner.challenge_date,
        catalogVersionId: winner.catalog_version_id,
        rounds: winner.rounds as SelectedRound[],
      };
      dailyPuzzleCache.set(dateStr, puzzle);
      return puzzle;
    }
  }

  const puzzle: DailyPuzzle = {
    challengeDate: inserted?.challenge_date ?? dateStr,
    catalogVersionId: inserted?.catalog_version_id ?? catalog.id,
    rounds: (inserted?.rounds ?? rounds) as SelectedRound[],
  };

  dailyPuzzleCache.set(dateStr, puzzle);
  return puzzle;
}

/**
 * Returns the player's Daily Challenge status for the current UTC day.
 */
export async function getPlayerDailyStatus(
  cookieToken?: string,
  dateStr: string = getUtcDateString()
): Promise<DailyStatusDto> {
  const resetAt = getNextUtcMidnight().toISOString();
  const secondsUntilReset = getSecondsUntilUtcMidnight();

  if (!cookieToken || !/^[0-9a-f]{64}$/.test(cookieToken)) {
    return {
      challengeDate: dateStr,
      resetAt,
      secondsUntilReset,
      hasOfficialAttempt: false,
      officialSession: null,
      canStartOfficial: true,
      canResume: false,
      practiceAttemptsCount: 0,
    };
  }

  const db = createDbClient();
  const tokenHash = hashToken(cookieToken);

  const { data: player } = await db
    .from("anonymous_players")
    .select("id")
    .eq("token_hash", tokenHash)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (!player) {
    return {
      challengeDate: dateStr,
      resetAt,
      secondsUntilReset,
      hasOfficialAttempt: false,
      officialSession: null,
      canStartOfficial: true,
      canResume: false,
      practiceAttemptsCount: 0,
    };
  }

  // Query player's attempts for this date
  const { data: attempts } = await db
    .from("daily_challenge_attempts")
    .select("id, session_id, is_official, created_at")
    .eq("player_id", player.id)
    .eq("challenge_date", dateStr)
    .order("created_at", { ascending: false });

  const attemptList = attempts ?? [];
  const officialAttempt = attemptList.find(a => a.is_official);
  const practiceCount = attemptList.filter(a => !a.is_official).length;

  if (!officialAttempt) {
    return {
      challengeDate: dateStr,
      resetAt,
      secondsUntilReset,
      hasOfficialAttempt: false,
      officialSession: null,
      canStartOfficial: true,
      canResume: false,
      practiceAttemptsCount: practiceCount,
    };
  }

  // Fetch official session state
  const { data: session } = await db
    .from("game_sessions")
    .select("id, state, score, current_round, expires_at")
    .eq("id", officialAttempt.session_id)
    .maybeSingle();

  if (!session) {
    return {
      challengeDate: dateStr,
      resetAt,
      secondsUntilReset,
      hasOfficialAttempt: true,
      officialSession: null,
      canStartOfficial: false,
      canResume: false,
      practiceAttemptsCount: practiceCount,
    };
  }

  const isExpired = new Date(session.expires_at).getTime() <= Date.now() || session.state === "expired";
  const sessionState: "active" | "completed" | "expired" = isExpired
    ? "expired"
    : session.state === "completed"
      ? "completed"
      : "active";

  const canResume = sessionState === "active";

  return {
    challengeDate: dateStr,
    resetAt,
    secondsUntilReset,
    hasOfficialAttempt: true,
    officialSession: {
      id: session.id,
      state: sessionState,
      score: session.score,
      currentRound: session.current_round,
    },
    canStartOfficial: false,
    canResume,
    practiceAttemptsCount: practiceCount,
  };
}

/**
 * Initiates or resumes a Daily Challenge game session for a player.
 */
export async function startDailyChallenge(opts: {
  playerToken: string;
  actionId: string;
  isPractice?: boolean;
  dateStr?: string;
}): Promise<{ sessionId: string; isOfficial: boolean; isResumed: boolean }> {
  const dateStr = opts.dateStr ?? getUtcDateString();
  const db = createDbClient();

  // 1. Ensure player identity
  const player = await getOrCreatePlayer(opts.playerToken);

  // 2. Resolve frozen daily puzzle
  const puzzle = await getOrCreateDailyPuzzle(dateStr);

  const isPractice = Boolean(opts.isPractice);

  // 3. For official attempts, check existing record
  if (!isPractice) {
    const { data: existingAttempt } = await db
      .from("daily_challenge_attempts")
      .select("session_id")
      .eq("player_id", player.playerId)
      .eq("challenge_date", dateStr)
      .eq("is_official", true)
      .maybeSingle();

    if (existingAttempt) {
      // Check existing session state
      const { data: session } = await db
        .from("game_sessions")
        .select("id, state, expires_at")
        .eq("id", existingAttempt.session_id)
        .maybeSingle();

      if (session) {
        const isExpired = new Date(session.expires_at).getTime() <= Date.now() || session.state === "expired";
        if (session.state === "active" && !isExpired) {
          // Resume existing in-progress session
          return { sessionId: session.id, isOfficial: true, isResumed: true };
        }
        if (session.state === "completed") {
          throw new GameError(
            409,
            "DAILY_ALREADY_COMPLETED",
            "You have already completed the official Daily Challenge for today. You can play again in practice mode."
          );
        }
        if (isExpired) {
          throw new GameError(
            410,
            "DAILY_SESSION_EXPIRED",
            "Today's official Daily Challenge session has expired. You can play again in practice mode."
          );
        }
      }
    }
  }

  // 4. Create new 10-round game session with preselected daily rounds
  const session = await createGameSession({
    playerToken: opts.playerToken,
    actionId: opts.actionId,
    mode: "mixed",
    level: "medium",
    preselectedRounds: puzzle.rounds,
  });

  // 5. Track attempt in daily_challenge_attempts
  await db.from("daily_challenge_attempts").insert({
    player_id: player.playerId,
    challenge_date: dateStr,
    session_id: session.id,
    is_official: !isPractice,
  });

  return {
    sessionId: session.id,
    isOfficial: !isPractice,
    isResumed: false,
  };
}

