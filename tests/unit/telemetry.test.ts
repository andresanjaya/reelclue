// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { generateRequestId, logTelemetry, type SafeLogEntry } from "../../src/lib/server/security/telemetry";

describe("telemetry & logging redaction", () => {
  it("generates random request IDs with rc_ prefix", () => {
    const id1 = generateRequestId();
    const id2 = generateRequestId();
    expect(id1).toMatch(/^rc_[0-9a-f]{16}$/);
    expect(id2).toMatch(/^rc_[0-9a-f]{16}$/);
    expect(id1).not.toBe(id2);
  });

  it("logs structured JSON without raw IP, player tokens, or guess text", () => {
    const consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    const entry: SafeLogEntry = {
      requestId: "rc_1234567890abcdef",
      routeClass: "api.games.guess",
      status: 200,
      durationMs: 42,
      providerStatus: "ok",
      catalogVersion: "cat-20261104",
      clientHash: "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90",
    };

    logTelemetry(entry);

    expect(consoleSpy).toHaveBeenCalledOnce();
    const logged = JSON.parse(consoleSpy.mock.calls[0][0]);
    expect(logged.requestId).toBe("rc_1234567890abcdef");
    expect(logged.routeClass).toBe("api.games.guess");
    expect(logged.status).toBe(200);
    expect(logged.durationMs).toBe(42);
    expect(logged.catalogVersion).toBe("cat-20261104");
    expect(logged.clientHash).toBe("a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90");
    expect(logged.ts).toBeDefined();

    // Verify raw forbidden fields do not exist
    expect(logged).not.toHaveProperty("ip");
    expect(logged).not.toHaveProperty("token");
    expect(logged).not.toHaveProperty("guess");
    expect(logged).not.toHaveProperty("answer");

    consoleSpy.mockRestore();
  });

  it("logs 5xx errors via console.error with aggregate error codes", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const entry: SafeLogEntry = {
      requestId: "rc_error_test",
      routeClass: "api.games.create",
      status: 503,
      durationMs: 15,
      errorCode: "SERVICE_UNAVAILABLE",
    };

    logTelemetry(entry);

    expect(errorSpy).toHaveBeenCalledOnce();
    const logged = JSON.parse(errorSpy.mock.calls[0][0]);
    expect(logged.status).toBe(503);
    expect(logged.errorCode).toBe("SERVICE_UNAVAILABLE");

    errorSpy.mockRestore();
  });
});
