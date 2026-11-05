// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { dbClientMock } = vi.hoisted(() => ({
  dbClientMock: vi.fn(),
}));

vi.mock("../../src/lib/server/db/client", () => ({
  createDbClient: dbClientMock,
}));

import { GET } from "../../src/app/api/health/route";

describe("GET /api/health endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 healthy when database active catalog is ready", async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: "catalog-20261104", status: "active" },
        error: null,
      }),
    };
    dbClientMock.mockReturnValue({ from: vi.fn(() => query) });

    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store, private");
    expect(res.headers.get("X-Request-ID")).toBeDefined();

    const body = await res.json();
    expect(body.status).toBe("healthy");
    expect(body.catalog).toBe("ready");
    expect(body.timestamp).toBeDefined();

    // Must never leak catalog IDs, DB schema, or secrets
    expect(body).not.toHaveProperty("id");
    expect(body).not.toHaveProperty("schema");
    expect(body).not.toHaveProperty("key");
  });

  it("returns 503 with Retry-After: 5 when database query fails", async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "connection timeout" },
      }),
    };
    dbClientMock.mockReturnValue({ from: vi.fn(() => query) });

    const res = await GET();
    expect(res.status).toBe(503);
    expect(res.headers.get("Retry-After")).toBe("5");
    expect(res.headers.get("Cache-Control")).toBe("no-store, private");

    const body = await res.json();
    expect(body.status).toBe("unhealthy");
    expect(body.error).toBe("Database service unavailable");
    expect(body).not.toHaveProperty("connection timeout");
  });

  it("returns 503 when database throws unexpected exception", async () => {
    dbClientMock.mockImplementation(() => {
      throw new Error("fatal network collapse");
    });

    const res = await GET();
    expect(res.status).toBe(503);
    expect(res.headers.get("Retry-After")).toBe("5");

    const body = await res.json();
    expect(body.status).toBe("unhealthy");
    expect(body.error).toBe("Database service unavailable");
    expect(JSON.stringify(body)).not.toContain("fatal network collapse");
  });
});
