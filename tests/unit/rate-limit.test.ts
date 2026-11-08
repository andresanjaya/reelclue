// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { dbClientMock } = vi.hoisted(() => ({
  dbClientMock: vi.fn(),
}));

vi.mock("../../src/lib/server/db/client", () => ({
  createDbClient: dbClientMock,
}));

import {
  consumeRateLimit,
  enforceRateLimits,
  extractClientIp,
  hashIdentifier,
  type RateLimitPolicy,
} from "../../src/lib/server/security/rate-limit";
import { GameError } from "../../src/lib/server/game/session";

describe("rate limiting security module (RC-022)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("extractClientIp", () => {
    it("extracts first IP from x-forwarded-for header", () => {
      const request = new Request("http://localhost", {
        headers: { "x-forwarded-for": "203.0.113.195, 70.41.3.18, 150.172.238.178" },
      });
      expect(extractClientIp(request)).toBe("203.0.113.195");
    });

    it("falls back to x-real-ip when x-forwarded-for is missing", () => {
      const request = new Request("http://localhost", {
        headers: { "x-real-ip": "198.51.100.42" },
      });
      expect(extractClientIp(request)).toBe("198.51.100.42");
    });

    it("defaults to 127.0.0.1 when no forwarding headers exist", () => {
      const request = new Request("http://localhost");
      expect(extractClientIp(request)).toBe("127.0.0.1");
    });
  });

  describe("hashIdentifier", () => {
    it("generates exact 64-hex lowercase character string matching DB constraint regex", () => {
      const hash1 = hashIdentifier("203.0.113.195", "ip:");
      const hash2 = hashIdentifier("my-secret-browser-token-12345", "browser:");

      expect(hash1).toMatch(/^[0-9a-f]{64}$/);
      expect(hash2).toMatch(/^[0-9a-f]{64}$/);
      expect(hash1).not.toBe(hash2);
    });

    it("produces deterministic hash for identical input", () => {
      const hashA = hashIdentifier("192.168.1.1", "ip:");
      const hashB = hashIdentifier("192.168.1.1", "ip:");
      expect(hashA).toBe(hashB);
    });
  });

  describe("consumeRateLimit", () => {
    const validHash = "a".repeat(64);

    it("fails closed when DB client, RPC, or response is missing", async () => {
      for (const client of [() => { throw new Error("unconfigured"); }, () => ({}), () => ({ rpc: vi.fn().mockResolvedValue({ data: null, error: null }) })]) {
        dbClientMock.mockImplementation(client);
        await expect(consumeRateLimit(validHash, "session_create", 10, 600)).rejects.toMatchObject({ status: 503, code: "SERVICE_UNAVAILABLE" });
      }
    });

    it("allows request when under configured limit", async () => {
      const rpcMock = vi.fn().mockResolvedValue({
        data: { allowed: true, count: 5, limit: 10 },
        error: null,
      });
      dbClientMock.mockReturnValue({ rpc: rpcMock });

      const result = await consumeRateLimit(validHash, "session_create", 10, 600);
      expect(result.allowed).toBe(true);
      expect(result.count).toBe(5);
      expect(result.retryAfter).toBeGreaterThan(0);
      expect(rpcMock).toHaveBeenCalledWith("consume_rate_limit", {
        p_bucket_hash: validHash,
        p_route_class: "session_create",
        p_window_start: expect.any(String),
        p_expires_at: expect.any(String),
        p_limit: 10,
      });
    });

    it("throws 429 RATE_LIMITED with valid retryAfter when limit exceeded", async () => {
      const rpcMock = vi.fn().mockResolvedValue({
        data: { allowed: false, count: 11, limit: 10 },
        error: null,
      });
      dbClientMock.mockReturnValue({ rpc: rpcMock });

      try {
        await consumeRateLimit(validHash, "session_create", 10, 600);
        expect.unreachable();
      } catch (err) {
        expect(err).toBeInstanceOf(GameError);
        const gameErr = err as GameError;
        expect(gameErr.status).toBe(429);
        expect(gameErr.code).toBe("RATE_LIMITED");
        expect(gameErr.retryable).toBe(true);
        expect(gameErr.retryAfter).toBeGreaterThan(0);
        expect(gameErr.retryAfter).toBeLessThanOrEqual(600);
      }
    });

    it("fails closed when rate-limit RPC has not been migrated (PGRST202)", async () => {
      const rpcMock = vi.fn().mockResolvedValue({
        data: null,
        error: { code: "PGRST202", message: "function not found" },
      });
      dbClientMock.mockReturnValue({ rpc: rpcMock });

      await expect(consumeRateLimit(validHash, "session_create", 10, 600)).rejects.toMatchObject({
        status: 503,
        code: "SERVICE_UNAVAILABLE",
      });
    });

    it("throws 503 SERVICE_UNAVAILABLE when database RPC encounters error", async () => {
      const rpcMock = vi.fn().mockResolvedValue({
        data: null,
        error: { message: "database offline" },
      });
      dbClientMock.mockReturnValue({ rpc: rpcMock });

      try {
        await consumeRateLimit(validHash, "session_create", 10, 600);
        expect.unreachable();
      } catch (err) {
        expect(err).toBeInstanceOf(GameError);
        const gameErr = err as GameError;
        expect(gameErr.status).toBe(503);
        expect(gameErr.code).toBe("SERVICE_UNAVAILABLE");
        expect(gameErr.retryable).toBe(true);
        expect(gameErr.retryAfter).toBe(5);
      }
    });
  });

  describe("concurrent multi-instance race test", () => {
    it("coordinates concurrent consumption through atomic RPC without lost increments", async () => {
      let atomicCounter = 0;
      const limit = 50;

      const rpcMock = vi.fn().mockImplementation(async () => {
        atomicCounter += 1;
        return {
          data: {
            allowed: atomicCounter <= limit,
            count: atomicCounter,
            limit,
          },
          error: null,
        };
      });

      dbClientMock.mockReturnValue({ rpc: rpcMock });

      const hash = "b".repeat(64);
      const concurrency = 25;

      const results = await Promise.all(
        Array.from({ length: concurrency }).map(() =>
          consumeRateLimit(hash, "concurrency_test", limit, 60)
        )
      );

      expect(results).toHaveLength(concurrency);
      expect(atomicCounter).toBe(concurrency);
      expect(rpcMock).toHaveBeenCalledTimes(concurrency);
    });
  });

  describe("enforceRateLimits", () => {
    it("checks browser policy when token present, and IP policy", async () => {
      const rpcMock = vi.fn().mockResolvedValue({
        data: { allowed: true, count: 1, limit: 10 },
        error: null,
      });
      dbClientMock.mockReturnValue({ rpc: rpcMock });

      const request = new Request("http://localhost", {
        headers: { "x-forwarded-for": "10.0.0.1" },
      });

      const policies: readonly RateLimitPolicy[] = [
        { routeClass: "test_browser", limit: 10, windowSeconds: 60, by: "browser" },
        { routeClass: "test_ip", limit: 30, windowSeconds: 60, by: "ip" },
      ];

      await enforceRateLimits(request, policies, "dummy-token-123");

      expect(rpcMock).toHaveBeenCalledTimes(2);
      expect(rpcMock.mock.calls[0][1].p_route_class).toBe("test_browser");
      expect(rpcMock.mock.calls[1][1].p_route_class).toBe("test_ip");
    });
  });
});
