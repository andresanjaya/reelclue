// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../../src/lib/server/security/rate-limit", () => ({ enforceRateLimits: vi.fn(), RATE_LIMIT_POLICIES: { results: [] } }));

const { fetchResultsMock } = vi.hoisted(() => ({
  fetchResultsMock: vi.fn(),
}));

vi.mock("../../src/lib/server/game/session", () => ({
  fetchGameResults: fetchResultsMock,
  hashToken: (t: string) => `hash-${t}`,
  PLAYER_COOKIE_NAME: "reelclue_player",
  GameError: class GameError extends Error {
    status: number;
    code: string;
    retryable: boolean;
    constructor(status: number, code: string, message: string, retryable = false) {
      super(message);
      this.status = status;
      this.code = code;
      this.retryable = retryable;
    }
  },
}));

import { GET } from "../../src/app/api/games/[id]/results/route";
import { GameError } from "../../src/lib/server/game/session";

const callRoute = (sessionId = "test-session", cookie?: string) =>
  GET(
    new Request(`http://localhost/api/games/${sessionId}/results`, {
      headers: cookie ? { cookie } : {},
    }),
    { params: Promise.resolve({ id: sessionId }) }
  );

describe("GET /api/games/[id]/results API route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when anonymous player cookie is missing", async () => {
    const res = await callRoute("session-1");
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(res.headers.get("Cache-Control")).toBe("no-store, private");
  });

  it("returns 404 when session does not exist or belongs to another player", async () => {
    fetchResultsMock.mockRejectedValueOnce(
      new GameError(404, "NOT_FOUND", "Game session not found")
    );

    const res = await callRoute("foreign-session", "reelclue_player=my-token");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_FOUND");
    expect(res.headers.get("Cache-Control")).toBe("no-store, private");
  });

  it("returns 409 Conflict when game session is not completed yet", async () => {
    fetchResultsMock.mockRejectedValueOnce(
      new GameError(409, "SESSION_INCOMPLETE", "Game session is not completed yet")
    );

    const res = await callRoute("active-session", "reelclue_player=my-token");
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe("SESSION_INCOMPLETE");
    expect(res.headers.get("Cache-Control")).toBe("no-store, private");
  });

  it("returns 410 Gone when session has expired", async () => {
    fetchResultsMock.mockRejectedValueOnce(
      new GameError(410, "SESSION_EXPIRED", "Game session expired")
    );

    const res = await callRoute("expired-session", "reelclue_player=my-token");
    expect(res.status).toBe(410);
    const body = await res.json();
    expect(body.error.code).toBe("SESSION_EXPIRED");
  });

  it("returns 200 with completed results when authorized and complete", async () => {
    const mockResults = {
      id: "session-1",
      mode: "mixed",
      level: "easy",
      state: "completed",
      score: 850,
      max_score: 1000,
      accuracy: 90,
      correct_count: 9,
      total_rounds: 10,
      total_hints_used: 4,
      total_wrong_attempts: 3,
      completed_at: "2026-11-05T10:00:00.000Z",
      rounds: [],
    };

    fetchResultsMock.mockResolvedValueOnce(mockResults);

    const res = await callRoute("session-1", "reelclue_player=my-token");
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store, private");
    const data = await res.json();
    expect(data.score).toBe(850);
    expect(data.accuracy).toBe(90);
  });
});
