import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  _resetMemoryStorageForTesting,
  clearLocalHistory,
  dismissActiveSession,
  getActiveResumableSession,
  getDefaultStorageData,
  loadLocalData,
  markActiveSessionCompleted,
  MAX_COMPLETED_SESSIONS,
  MAX_RECENT_MOVIES,
  recordCompletedSession,
  saveActiveSession,
  saveLocalData,
  savePreferences,
  SCHEMA_VERSION,
  STORAGE_KEY,
} from "../../src/lib/client/storage";

describe("Local storage engine (storage.ts)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    _resetMemoryStorageForTesting();
    vi.restoreAllMocks();
  });

  it("returns default schema data when storage is empty", () => {
    const data = loadLocalData();
    expect(data.version).toBe(SCHEMA_VERSION);
    expect(data.completed_session_ids).toEqual([]);
    expect(data.recent_movie_ids).toEqual([]);
    expect(data.stats).toEqual({});
    expect(data.preferences).toEqual({});
    expect(data.last_session).toBeNull();
  });

  it("heals and returns default structure when JSON is corrupt or version mismatch", () => {
    window.localStorage.setItem(STORAGE_KEY, "invalid-json{{}");
    const data = loadLocalData();
    expect(data.version).toBe(SCHEMA_VERSION);
    expect(data.completed_session_ids).toEqual([]);

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 999, invalid: true }));
    const migrated = loadLocalData();
    expect(migrated.version).toBe(SCHEMA_VERSION);
    expect(migrated.completed_session_ids).toEqual([]);
  });

  it("falls back to in-memory store when localStorage throws QuotaExceededError or is blocked", () => {
    // Scenario 1: Storage blocked entirely
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("QuotaExceededError", "QuotaExceededError");
    });

    const defaultData = getDefaultStorageData();
    defaultData.preferences = { mode: "cast", level: "hard" };

    saveLocalData(defaultData);

    // Reading should still retrieve the in-memory fallback
    const loaded = loadLocalData();
    expect(loaded.preferences.mode).toBe("cast");
    expect(loaded.preferences.level).toBe("hard");

    setItemSpy.mockRestore();

    // Scenario 2: Test key passes, but saving actual data triggers QuotaExceededError
    const selectiveSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation((key: string) => {
      if (key === STORAGE_KEY) {
        throw new DOMException("QuotaExceededError", "QuotaExceededError");
      }
    });

    const quotaData = getDefaultStorageData();
    quotaData.preferences = { mode: "genre", level: "easy" };
    const saved = saveLocalData(quotaData);
    expect(saved).toBe(false);

    const loadedFromQuotaFallback = loadLocalData();
    expect(loadedFromQuotaFallback.preferences.mode).toBe("genre");

    selectiveSpy.mockRestore();
  });

  it("deduplicates completed sessions and appends results only once", () => {
    const mockResult = {
      id: "sess-1234",
      mode: "poster",
      level: "easy",
      score: 85,
      correct_count: 9,
      total_rounds: 10,
      total_hints_used: 3,
      total_wrong_attempts: 2,
      rounds: [{ reveal: { tmdb_id: 101 } }, { reveal: { tmdb_id: 102 } }],
    };

    const firstRecord = recordCompletedSession(mockResult);
    expect(firstRecord).toBe(true);

    const secondRecord = recordCompletedSession(mockResult);
    expect(secondRecord).toBe(false);

    const data = loadLocalData();
    expect(data.completed_session_ids).toEqual(["sess-1234"]);
    expect(data.stats["poster:easy"]).toEqual({
      games_played: 1,
      total_score: 85,
      best_score: 85,
      total_correct_rounds: 9,
      total_rounds: 10,
      total_hints_used: 3,
      total_wrong_attempts: 2,
    });
  });

  it("enforces boundary of 100 completed sessions and 30 recent movie IDs", () => {
    // Fill storage with 105 sessions and 35 movies
    const initial = getDefaultStorageData();
    for (let i = 1; i <= 105; i++) {
      initial.completed_session_ids.push(`session-${i}`);
    }
    for (let m = 1; m <= 35; m++) {
      initial.recent_movie_ids.push(m);
    }
    saveLocalData(initial);

    const loaded = loadLocalData();
    expect(loaded.completed_session_ids).toHaveLength(MAX_COMPLETED_SESSIONS);
    expect(loaded.completed_session_ids[0]).toBe("session-6");
    expect(loaded.completed_session_ids[99]).toBe("session-105");

    expect(loaded.recent_movie_ids).toHaveLength(MAX_RECENT_MOVIES);
    expect(loaded.recent_movie_ids[0]).toBe(6);
    expect(loaded.recent_movie_ids[29]).toBe(35);
  });

  it("accurately updates best score and aggregates multiple sessions per mode/level", () => {
    recordCompletedSession({
      id: "sess-1",
      mode: "synopsis",
      level: "medium",
      score: 70,
      correct_count: 7,
      total_rounds: 10,
      total_hints_used: 4,
      total_wrong_attempts: 3,
      rounds: [{ reveal: { tmdb_id: 201 } }],
    });

    recordCompletedSession({
      id: "sess-2",
      mode: "synopsis",
      level: "medium",
      score: 90,
      correct_count: 9,
      total_rounds: 10,
      total_hints_used: 1,
      total_wrong_attempts: 1,
      rounds: [{ reveal: { tmdb_id: 202 } }],
    });

    const stat = loadLocalData().stats["synopsis:medium"];
    expect(stat.games_played).toBe(2);
    expect(stat.total_score).toBe(160);
    expect(stat.best_score).toBe(90);
    expect(stat.total_correct_rounds).toBe(16);
    expect(stat.total_rounds).toBe(20);
    expect(stat.total_hints_used).toBe(5);
    expect(stat.total_wrong_attempts).toBe(4);
  });

  it("saves and loads user preferences", () => {
    savePreferences({ mode: "genre", level: "hard" });

    const data = loadLocalData();
    expect(data.preferences.mode).toBe("genre");
    expect(data.preferences.level).toBe("hard");
  });

  it("manages active session, checks expiration, and allows dismissal", () => {
    saveActiveSession({ id: "active-100", mode: "mixed", level: "easy" });

    const active = getActiveResumableSession();
    expect(active).not.toBeNull();
    expect(active?.id).toBe("active-100");
    expect(active?.mode).toBe("mixed");
    expect(active?.level).toBe("easy");

    // Dismiss active session
    dismissActiveSession();
    expect(getActiveResumableSession()).toBeNull();

    // Expired session (> 24 hours)
    const oldTime = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    const data = loadLocalData();
    data.last_session = {
      id: "old-sess",
      mode: "poster",
      level: "easy",
      saved_at: oldTime,
      state: "active",
    };
    saveLocalData(data);

    expect(getActiveResumableSession()).toBeNull();

    // Completed state should not be resumable
    data.last_session.saved_at = new Date().toISOString();
    data.last_session.state = "completed";
    saveLocalData(data);

    expect(getActiveResumableSession()).toBeNull();

    // markActiveSessionCompleted
    data.last_session.state = "active";
    saveLocalData(data);
    markActiveSessionCompleted("old-sess");
    expect(loadLocalData().last_session?.state).toBe("completed");
  });

  it("clears local history while preserving user preferences", () => {
    savePreferences({ mode: "title", level: "medium" });
    recordCompletedSession({
      id: "sess-keep-pref",
      mode: "title",
      level: "medium",
      score: 80,
      correct_count: 8,
      total_rounds: 10,
      total_hints_used: 2,
      total_wrong_attempts: 1,
      rounds: [{ reveal: { tmdb_id: 501 } }],
    });

    clearLocalHistory();

    const after = loadLocalData();
    expect(after.completed_session_ids).toEqual([]);
    expect(after.recent_movie_ids).toEqual([]);
    expect(after.stats).toEqual({});
    expect(after.last_session).toBeNull();
    expect(after.preferences).toEqual({
      mode: "title",
      level: "medium",
    });
  });
});
