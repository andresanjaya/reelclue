// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../../src/lib/server/security/rate-limit", () => ({
  enforceRateLimits: vi.fn(),
  RATE_LIMIT_POLICIES: { sessionGet: [], sessionCreate: [] },
}));

const { mockGetPlayerDailyStatus, mockStartDailyChallenge } = vi.hoisted(() => ({
  mockGetPlayerDailyStatus: vi.fn(),
  mockStartDailyChallenge: vi.fn(),
}));

vi.mock("../../src/lib/server/daily/service", () => ({
  getPlayerDailyStatus: mockGetPlayerDailyStatus,
  startDailyChallenge: mockStartDailyChallenge,
}));

vi.mock("../../src/lib/server/game/session", () => ({
  PLAYER_COOKIE_NAME: "reelclue_player",
  validateOrigin: vi.fn(),
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

import { GET } from "../../src/app/api/daily/route";
import { POST } from "../../src/app/api/daily/play/route";
import { GameError } from "../../src/lib/server/game/session";

describe("Daily challenge API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/daily", () => {
    it("returns 200 with daily status", async () => {
      mockGetPlayerDailyStatus.mockResolvedValueOnce({
        challengeDate: "2026-11-09",
        resetAt: "2026-11-10T00:00:00.000Z",
        secondsUntilReset: 7200,
        hasOfficialAttempt: false,
        officialSession: null,
        canStartOfficial: true,
        canResume: false,
        practiceAttemptsCount: 0,
      });

      const req = new Request("http://localhost/api/daily", {
        headers: { cookie: "reelclue_player=" + "a".repeat(64) },
      });
      const res = await GET(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.challengeDate).toBe("2026-11-09");
      expect(res.headers.get("Cache-Control")).toBe("no-store, private");
      expect(res.headers.get("X-Request-Id")).toBeTruthy();
    });
  });

  describe("POST /api/daily/play", () => {
    it("returns 401 when player cookie is missing", async () => {
      const validUuid = "11111111-2222-4333-8444-555555555555";
      const req = new Request("http://localhost/api/daily/play", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionId: validUuid }),
      });
      const res = await POST(req);

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error.code).toBe("UNAUTHORIZED");
    });

    it("returns 400 when actionId is missing or not a valid UUID", async () => {
      const req = new Request("http://localhost/api/daily/play", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: "reelclue_player=" + "b".repeat(64),
        },
        body: JSON.stringify({ actionId: "invalid-uuid" }),
      });
      const res = await POST(req);

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 201 when new daily session is created", async () => {
      mockStartDailyChallenge.mockResolvedValueOnce({
        sessionId: "daily-sess-new",
        isOfficial: true,
        isResumed: false,
      });

      const validUuid = "11111111-2222-4333-8444-555555555555";
      const req = new Request("http://localhost/api/daily/play", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: "reelclue_player=" + "b".repeat(64),
        },
        body: JSON.stringify({ actionId: validUuid }),
      });
      const res = await POST(req);

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.sessionId).toBe("daily-sess-new");
      expect(json.isOfficial).toBe(true);
      expect(json.isResumed).toBe(false);
    });

    it("returns 200 when existing in-progress session is resumed", async () => {
      mockStartDailyChallenge.mockResolvedValueOnce({
        sessionId: "daily-sess-resumed",
        isOfficial: true,
        isResumed: true,
      });

      const validUuid = "22222222-3333-4444-8555-666666666666";
      const req = new Request("http://localhost/api/daily/play", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: "reelclue_player=" + "b".repeat(64),
        },
        body: JSON.stringify({ actionId: validUuid }),
      });
      const res = await POST(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.sessionId).toBe("daily-sess-resumed");
      expect(json.isResumed).toBe(true);
    });

    it("returns 409 Conflict when official attempt already completed", async () => {
      mockStartDailyChallenge.mockRejectedValueOnce(
        new GameError(409, "DAILY_ALREADY_COMPLETED", "Official daily challenge already completed for today.")
      );

      const validUuid = "33333333-4444-4555-8666-777777777777";
      const req = new Request("http://localhost/api/daily/play", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: "reelclue_player=" + "b".repeat(64),
        },
        body: JSON.stringify({ actionId: validUuid, isPractice: false }),
      });
      const res = await POST(req);

      expect(res.status).toBe(409);
      const json = await res.json();
      expect(json.error.code).toBe("DAILY_ALREADY_COMPLETED");
    });
  });
});

