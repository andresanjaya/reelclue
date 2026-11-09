import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// Mock DB client
const mockDb = {
  from: vi.fn(),
  rpc: vi.fn(),
};

vi.mock("../../src/lib/server/db/client", () => ({
  createDbClient: () => mockDb,
}));

// Mock session functions
const mockCreateGameSession = vi.fn();
const mockGetOrCreatePlayer = vi.fn();

vi.mock("../../src/lib/server/game/session", async importOriginal => {
  const actual = await importOriginal<typeof import("../../src/lib/server/game/session")>();
  return {
    ...actual,
    createGameSession: (...args: unknown[]) => mockCreateGameSession(...args),
    getOrCreatePlayer: (...args: unknown[]) => mockGetOrCreatePlayer(...args),
  };
});

import {
  _resetDailyPuzzleCacheForTesting,
  getOrCreateDailyPuzzle,
  getPlayerDailyStatus,
  startDailyChallenge,
} from "../../src/lib/server/daily/service";

describe("Daily challenge service: persistence, frozen catalog, and attempt rules", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetDailyPuzzleCacheForTesting();
  });

  it("returns frozen daily puzzle from database if already exists", async () => {
    const frozenRounds = [
      { ordinal: 1, movie_id: 101, mode: "poster", reveal_seed: "seed-1" },
      { ordinal: 2, movie_id: 102, mode: "title", reveal_seed: "seed-2" },
    ];

    mockDb.from.mockImplementation((table: string) => {
      if (table === "daily_challenges") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  challenge_date: "2026-11-09",
                  catalog_version_id: "catalog-uuid-frozen",
                  rounds: frozenRounds,
                },
                error: null,
              }),
            }),
          }),
        };
      }
      return {};
    });

    const puzzle = await getOrCreateDailyPuzzle("2026-11-09");
    expect(puzzle.challengeDate).toBe("2026-11-09");
    expect(puzzle.catalogVersionId).toBe("catalog-uuid-frozen");
    expect(puzzle.rounds).toEqual(frozenRounds);
  });

  it("generates and inserts new daily puzzle when not already in database", async () => {
    const candidates = Array.from({ length: 25 }, (_, i) => ({
      tmdb_id: 200 + i,
      tier: "medium",
      eligible_modes: ["poster", "title", "synopsis", "cast", "genre"],
    }));

    let insertedRecord: unknown = null;

    mockDb.from.mockImplementation((table: string) => {
      if (table === "daily_challenges") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: insertedRecord, error: null }),
            }),
          }),
          insert: (record: unknown) => {
            insertedRecord = record;
            return {
              select: () => ({
                maybeSingle: async () => ({ data: record, error: null }),
              }),
            };
          },
        };
      }
      if (table === "catalog_versions") {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: () => ({
                  maybeSingle: async () => ({ data: { id: "catalog-active-123" }, error: null }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === "movies") {
        return {
          select: () => ({
            eq: () => ({
              eq: async () => ({ data: candidates, error: null }),
            }),
          }),
        };
      }
      return {};
    });

    const puzzle = await getOrCreateDailyPuzzle("2026-11-15");
    expect(puzzle.challengeDate).toBe("2026-11-15");
    expect(puzzle.catalogVersionId).toBe("catalog-active-123");
    expect(puzzle.rounds).toHaveLength(10);
    expect(insertedRecord).toBeTruthy();
  });

  it("returns player status accurately when player has no prior attempts", async () => {
    mockDb.from.mockImplementation((table: string) => {
      if (table === "anonymous_players") {
        return {
          select: () => ({
            eq: () => ({
              gt: () => ({
                maybeSingle: async () => ({ data: { id: "player-uuid-1" } }),
              }),
            }),
          }),
        };
      }
      if (table === "daily_challenge_attempts") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: async () => ({ data: [] }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    const validToken = "a".repeat(64);
    const status = await getPlayerDailyStatus(validToken, "2026-11-09");

    expect(status.hasOfficialAttempt).toBe(false);
    expect(status.canStartOfficial).toBe(true);
    expect(status.canResume).toBe(false);
    expect(status.officialSession).toBeNull();
  });

  it("reports active session as resumable when official attempt is in-progress", async () => {
    mockDb.from.mockImplementation((table: string) => {
      if (table === "anonymous_players") {
        return {
          select: () => ({
            eq: () => ({
              gt: () => ({
                maybeSingle: async () => ({ data: { id: "player-uuid-1" } }),
              }),
            }),
          }),
        };
      }
      if (table === "daily_challenge_attempts") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: async () => ({
                  data: [
                    { id: "att-1", session_id: "sess-active", is_official: true, created_at: "2026-11-09T08:00:00Z" },
                  ],
                }),
              }),
            }),
          }),
        };
      }
      if (table === "game_sessions") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: "sess-active",
                  state: "active",
                  score: 350,
                  current_round: 4,
                  expires_at: new Date(Date.now() + 3600_000).toISOString(),
                },
              }),
            }),
          }),
        };
      }
      return {};
    });

    const validToken = "b".repeat(64);
    const status = await getPlayerDailyStatus(validToken, "2026-11-09");

    expect(status.hasOfficialAttempt).toBe(true);
    expect(status.canStartOfficial).toBe(false);
    expect(status.canResume).toBe(true);
    expect(status.officialSession?.score).toBe(350);
    expect(status.officialSession?.currentRound).toBe(4);
  });

  it("startDailyChallenge starts official attempt, links attempt in DB, and passes preselected rounds", async () => {
    mockGetOrCreatePlayer.mockResolvedValue({
      token: "tok-1",
      tokenHash: "hash-1",
      playerId: "player-id-1",
    });

    mockCreateGameSession.mockResolvedValue({
      id: "new-session-id-123",
      mode: "mixed",
      level: "medium",
    });

    let attemptInserted: unknown = null;

    mockDb.from.mockImplementation((table: string) => {
      if (table === "daily_challenges") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  challenge_date: "2026-11-09",
                  catalog_version_id: "cat-1",
                  rounds: Array.from({ length: 10 }, (_, i) => ({ ordinal: i + 1, movie_id: 100 + i, mode: "poster", reveal_seed: `s-${i}` })),
                },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "daily_challenge_attempts") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: null }),
                }),
              }),
            }),
          }),
          insert: async (rec: unknown) => {
            attemptInserted = rec;
            return { error: null };
          },
        };
      }
      return {};
    });

    const result = await startDailyChallenge({
      playerToken: "a".repeat(64),
      actionId: "11111111-2222-3333-4444-555555555555",
      isPractice: false,
      dateStr: "2026-11-09",
    });

    expect(result.sessionId).toBe("new-session-id-123");
    expect(result.isOfficial).toBe(true);
    expect(result.isResumed).toBe(false);

    expect(mockCreateGameSession).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "mixed",
        level: "medium",
        preselectedRounds: expect.any(Array),
      })
    );

    expect(attemptInserted).toEqual({
      player_id: "player-id-1",
      challenge_date: "2026-11-09",
      session_id: "new-session-id-123",
      is_official: true,
    });
  });

  it("startDailyChallenge resumes active official attempt when already in progress", async () => {
    mockGetOrCreatePlayer.mockResolvedValue({
      token: "tok-1",
      tokenHash: "hash-1",
      playerId: "player-id-1",
    });

    mockDb.from.mockImplementation((table: string) => {
      if (table === "daily_challenges") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  challenge_date: "2026-11-09",
                  catalog_version_id: "cat-1",
                  rounds: [],
                },
              }),
            }),
          }),
        };
      }
      if (table === "daily_challenge_attempts") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: { session_id: "active-sess-id" } }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === "game_sessions") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: "active-sess-id",
                  state: "active",
                  expires_at: new Date(Date.now() + 3600_000).toISOString(),
                },
              }),
            }),
          }),
        };
      }
      return {};
    });

    const result = await startDailyChallenge({
      playerToken: "a".repeat(64),
      actionId: "22222222-3333-4444-5555-666666666666",
      isPractice: false,
      dateStr: "2026-11-09",
    });

    expect(result.sessionId).toBe("active-sess-id");
    expect(result.isOfficial).toBe(true);
    expect(result.isResumed).toBe(true);
    // Did NOT call createGameSession
    expect(mockCreateGameSession).not.toHaveBeenCalled();
  });

  it("rejects starting another official attempt if official attempt is already completed", async () => {
    mockGetOrCreatePlayer.mockResolvedValue({
      token: "tok-1",
      tokenHash: "hash-1",
      playerId: "player-id-1",
    });

    mockDb.from.mockImplementation((table: string) => {
      if (table === "daily_challenges") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { challenge_date: "2026-11-09", catalog_version_id: "cat-1", rounds: [] },
              }),
            }),
          }),
        };
      }
      if (table === "daily_challenge_attempts") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: { session_id: "completed-sess-id" } }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === "game_sessions") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: "completed-sess-id",
                  state: "completed",
                  expires_at: new Date(Date.now() + 3600_000).toISOString(),
                },
              }),
            }),
          }),
        };
      }
      return {};
    });

    await expect(
      startDailyChallenge({
        playerToken: "a".repeat(64),
        actionId: "33333333-4444-5555-6666-777777777777",
        isPractice: false,
        dateStr: "2026-11-09",
      })
    ).rejects.toThrowError(/already completed the official Daily Challenge/);
  });
});

